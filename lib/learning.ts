/** Deterministic evidence -> unpublished draft planning. No model or publishing authority. */
import type { Draft, Experiment, Recommendation, StudioData } from "./growth";

export type LearningDraft = Draft & {
  mode: "exploration" | "observation" | "retest";
  plannedVariant: "A" | "B";
  parentObservationIds: string[];
  completedAt?: string;
  publishedVideoId?: string;
  completionProvenance?: "user_confirmed";
};
export type Policy = { enabled: boolean; autoDraft: boolean; version: number };
export const DEFAULT_POLICY: Policy = { enabled: false, autoDraft: false, version: 0 };

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().filter(k => object[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(object[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
export async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export function observationIds(evidence: Recommendation): string[] {
  return [...new Set(evidence.groups.flatMap(g => g.observationIds))].sort();
}
export async function evidenceKey(experiment: Experiment, evidence: Recommendation): Promise<string | null> {
  if (evidence.source !== "youtube_data" || !observationIds(evidence).length) return null;
  // generatedAt changes on every call, but is not new evidence.
  return digest({ experimentId: experiment.id, conditions: experiment.conditions,
    variantA: experiment.variantA, variantB: experiment.variantB,
    definition: evidence.definition, groups: evidence.groups, status: evidence.status,
    minSamples: experiment.minSamples, threshold: experiment.threshold });
}
export function makeLearningDraft(experiment: Experiment, data: StudioData, evidence: Recommendation,
  title: string, now = new Date(), variant?: "A" | "B", id: string = crypto.randomUUID()): LearningDraft {
  const modes = { insufficient_data: "exploration", inconclusive: "observation", retest_candidate: "retest" } as const;
  const counts = { A: 0, B: 0 };
  data.videos.filter(v => v.experimentId === experiment.id).forEach(v => counts[v.variant]++);
  (data.drafts as LearningDraft[]).filter(d => d.experimentId === experiment.id && !d.completedAt)
    .forEach(d => { if (d.plannedVariant) counts[d.plannedVariant]++; });
  const plannedVariant = variant ?? evidence.candidate ?? (counts.A <= counts.B ? "A" : "B");
  const mode = modes[evidence.status];
  const opening = plannedVariant === "A" ? experiment.variantA : experiment.variantB;
  const script = `［${mode === "retest" ? "再検証用" : "未検証の探索用"}・台本テンプレート／人の執筆と確認が必要］\n\n` +
    `［冒頭：${opening}］\n［本編：${title}を、一つの具体例で説明する］\n［結び：本編で示した内容を一文で振り返る］\n\n` +
    `固定条件：${experiment.conditions.series} / ${experiment.conditions.voice} / ${experiment.conditions.visualStyle} / ` +
    `${experiment.conditions.durationMin}〜${experiment.conditions.durationMax}秒\n` +
    `観測に基づく次の検証：${evidence.nextChange}\n変更は冒頭の一要素に限定。成功や因果効果は未確認。`;
  return { id, title, experimentId: experiment.id, status: "draft", revision: 1,
    createdAt: now.toISOString(), mode, plannedVariant, script, evidence,
    parentObservationIds: observationIds(evidence) };
}
export function diagnoseExperiment(experiment: Experiment, data: StudioData, now = new Date()) {
  const videos = data.videos.filter(v => v.experimentId === experiment.id);
  const valid = videos.filter(v => v.verified && v.channelId === experiment.channelId);
  const ids = new Set(valid.map(v => v.id));
  const measured = data.observations.filter(o => ids.has(o.videoId) && o.source === "youtube_data" &&
    o.status === "collected" && o.definition === "youtube_data_v3:viewCount:2025-03-31" &&
    o.views !== null && Number.isSafeInteger(o.views) && o.views >= 0 && Date.parse(o.observedAt) <= now.getTime());
  const latest = [...measured].sort((a,b) => b.observedAt.localeCompare(a.observedAt))[0];
  const missed = data.observations.filter(o => ids.has(o.videoId) && o.status === "missed").length;
  const analytics = data.analytics.filter(a => ids.has(a.videoId) && Date.parse(a.fetchedAt) <= now.getTime());
  const state = !videos.length ? "no_videos" : !valid.length ? "needs_verification" : !latest ?
    (missed ? "missing_measurement" : "awaiting_measurement") : latest.views === 0 ? "observed_zero" : "measured";
  const actions = {
    no_videos: "探索用の下書きを作成し、制作・公開後に動画を登録してください。",
    needs_verification: "公開状態・チャンネル・尺の確認を優先してください。",
    missing_measurement: "収集プロセスと観測時刻を確認してください。遅い数値を欠測に代入しません。",
    awaiting_measurement: "次の観測時刻を待ちます。未取得の指標をゼロにしません。",
    observed_zero: "実測は0です。表示機会の不足と離脱は、この値だけでは区別できません。",
    measured: "再生数に加え、取得できた日別視聴時間・共有・登録も確認してください。"
  };
  return { state, action: actions[state], verifiedVideos: valid.length, missed,
    lastSuccessfulObservation: latest?.observedAt ?? null, latestViews: latest?.views ?? null,
    analyticsAvailable: analytics.length > 0, analytics,
    exposureKnown: false, causalEffectKnown: false };
}
export async function productionPackage(draft: LearningDraft) {
  if (draft.status !== "reviewed") throw new Error("台本を確認済みにしてから制作へ渡してください");
  return { schemaVersion: "1.0", kind: "reviewed_script_package", draftId: draft.id,
    draftRevision: draft.revision, title: draft.title, script: draft.script,
    plannedVariant: draft.plannedVariant ?? null, conditions: draft.evidence.fixedConditions,
    evidence: draft.evidence, scriptHash: await digest({ title: draft.title, script: draft.script }),
    renderReady: false, publishAllowed: false,
    requiredNextStep: "場面画像・ナレーション・字幕を制作計画に落とし込み、完成MP4を別途レビューしてください。" };
}
