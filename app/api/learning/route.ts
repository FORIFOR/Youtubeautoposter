import { z } from "zod";
import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { config } from "@/lib/config";
import { compare } from "@/lib/growth";
import { LearningRepository } from "@/lib/learning-repository";
import { diagnoseExperiment, makeLearningDraft, productionPackage, type LearningDraft } from "@/lib/learning";
import { runLearning } from "@/lib/learning-runner";
const id = z.string().min(1).max(100);
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("policy"), experimentId: id, enabled: z.boolean(), autoDraft: z.boolean(), version: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("draft"), experimentId: id, title: z.string().trim().min(1).max(150), variant: z.enum(["A","B"]).optional() }).strict(),
  z.object({ action: z.literal("run") }).strict(),
  z.object({ action: z.literal("package"), draftId: id, expectedRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal("complete"), draftId: id, videoId: id, expectedRevision: z.number().int().positive(), confirmed: z.literal(true) }).strict()
]);
export async function GET(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), repo = new LearningRepository(), cfg = config();
  const [data, policies, runtime] = await Promise.all([repo.state(ownerId), repo.policies(ownerId), repo.runtime(ownerId)]);
  return json({ ownerId, data, policies, runtime, dataApiConfigured: Boolean(cfg.apiKey && cfg.channelId),
    experiments: data.experiments.map(e => ({ id: e.id, diagnosis: diagnoseExperiment(e, data), comparison: compare(e, data) })) });
}); }
export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), value = input.parse(await jsonBody(request)), repo = new LearningRepository();
  if (value.action === "run") {
    const cfg = config();
    if (!cfg.apiKey || !cfg.channelId) throw new AppError("APIキーとチャンネルIDを設定してください。",409);
    return json(await runLearning(ownerId, repo.db, cfg, true));
  }
  if (value.action === "package" || value.action === "complete") {
    const draft = await repo.draft(ownerId, value.draftId) as LearningDraft | null;
    if (!draft) throw new AppError("下書きが見つかりません。",404);
    if (draft.revision !== value.expectedRevision) throw new AppError("下書きが更新されています。再表示してください。",409);
    if (draft.status !== "reviewed") throw new AppError("先に台本を確認済みにしてください。",409);
    if (value.action === "package") return json(await productionPackage(draft));
    if (draft.completedAt) throw new AppError("この下書きは公開動画と関連付け済みです。",409);
    const data = await repo.state(ownerId), video = data.videos.find(v => v.id === value.videoId);
    if (!video || !video.verified || video.experimentId !== draft.experimentId || (draft.plannedVariant && video.variant !== draft.plannedVariant)) throw new AppError("同じ比較計画の確認済み動画を指定してください。",409);
    const next = { ...draft, revision: draft.revision + 1, completedAt: new Date().toISOString(), publishedVideoId: video.id, completionProvenance: "user_confirmed" as const };
    if (!await repo.updateDraft(ownerId, next, JSON.stringify(draft))) throw new AppError("同時更新が発生しました。",409);
    return json(next);
  }
  const experiment = await repo.experiment(ownerId, value.experimentId);
  if (!experiment) throw new AppError("比較計画が見つかりません。",404);
  if (value.action === "policy") {
    if (!await repo.setPolicy(ownerId, experiment.id, { enabled: value.enabled, autoDraft: value.autoDraft, version: value.version })) throw new AppError("設定が更新されています。再表示してください。",409);
    return json(await repo.policy(ownerId, experiment.id));
  }
  const data = await repo.state(ownerId), evidence = compare(experiment, data);
  const draft = makeLearningDraft(experiment, data, evidence, value.title, new Date(), value.variant);
  await repo.addDraft(ownerId, draft);
  return json(draft,201);
}); }
