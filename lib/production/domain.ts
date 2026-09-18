/** Immutable source -> script plan -> artifact -> human approval -> upload. */
import { z } from "zod";
import { digest } from "../learning";
import type { LearningDraft } from "../learning";
import type { Experiment } from "../growth";

export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const identifier = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const sceneSchema = z.object({ narration: text(350), caption: text(70), imagePrompt: text(1600) }).strict();
export const planSchema = z.object({
  title: text(100).refine(s => !/[<>]/.test(s)), description: text(3500),
  scenes: z.array(sceneSchema).min(1).max(6), rationale: text(2000),
  evidenceRefs: z.array(text(100)).max(32), caveats: z.array(text(500)).min(1).max(8)
}).strict();
export type Plan = z.infer<typeof planSchema>;
export const metadataSchema = z.object({ title: text(100).refine(s => !/[<>]/.test(s)),
  description: z.string().max(4400).refine(s => !/[<>]/.test(s)), privacy: z.enum(["private", "unlisted", "public"]),
  madeForKids: z.boolean(), containsSyntheticMedia: z.boolean() }).strict();
export type Metadata = z.infer<typeof metadataSchema>;
export const DISCLOSURE = "この動画の音声はAIにより生成されています。";
export function normalizeMetadata(input: Metadata): Metadata {
  const value = metadataSchema.parse(input);
  const description = value.description.includes(DISCLOSURE) ? value.description : `${value.description}\n\n${DISCLOSURE}`;
  if (new TextEncoder().encode(description).byteLength > 5000) throw new Error("説明文はAI音声の注記を含めてUTF-8で5000バイト以内にしてください");
  return { ...value, description };
}
export type Source = { draftId: string; draftRevision: number; experimentId: string; channelId: string;
  variant: "A" | "B"; title: string; script: string; evidence: LearningDraft["evidence"]; conditions: Experiment["conditions"] };
export function sourceOf(draft: LearningDraft, experiment: Experiment): Source {
  if (draft.completedAt) throw new Error("公開動画に関連付け済みの台本です");
  if (draft.experimentId !== experiment.id) throw new Error("比較計画が一致しません");
  return { draftId: draft.id, draftRevision: draft.revision, experimentId: experiment.id,
    channelId: experiment.channelId, variant: draft.plannedVariant ?? "A", title: draft.title,
    script: draft.script, evidence: draft.evidence, conditions: experiment.conditions };
}
export function validatePlan(input: unknown, source: Source): Plan {
  const plan = planSchema.parse(input);
  const refs = new Set(source.evidence.groups.flatMap(g => g.observationIds));
  if (plan.evidenceRefs.some(id => !refs.has(id))) throw new Error("台本の観測IDが元の根拠にありません");
  if (plan.scenes.some(s => /\[(?:TODO|本文|ここに)|［(?:本文|ここに|要記入)|<script/i.test(s.narration))) throw new Error("台本に未記入の箇所があります");
  return plan;
}
export type Stage = "queued_plan" | "planning" | "planned" | "queued_render" | "rendering" | "ready" |
  "approved" | "queued_upload" | "uploading" | "uploaded" | "queued_check" | "checking" | "uncertain" | "failed" | "cancelled";
export type Task = "plan" | "render" | "upload" | "check";
export const ACTIVE: Stage[] = ["planning", "rendering", "uploading", "checking"];
export type Artifact = { key: string; sha256: string; size: number; duration: number;
  width: number; height: number; planHash: string; profile: string; createdAt: string };
export type Approval = { digest: string; reviewer: string; expiresAt: string; videoHash: string; planHash: string;
  sourceHash: string; channelId: string; metadata: Metadata };
export type RemoteVideo = { id: string; channelId: string; title: string; privacy: "private" | "unlisted" | "public";
  processed: boolean; duration: number | null; publishedAt: string; checkedAt: string };
export type Job = { id: string; ownerId: string; version: number; createdAt: string; updatedAt: string;
  stage: Stage; source: Source; sourceHash: string; consentText: boolean; consentMedia: boolean;
  plan?: Plan; planHash?: string; planModel?: string; artifact?: Artifact; approval?: Approval;
  lease?: string; leaseUntil?: string; task?: Task; error?: string; remote?: RemoteVideo; registeredVideoId?: string; uploadAttempts?: number };
export async function makeJob(ownerId: string, source: Source, now = new Date()): Promise<Job> {
  return { id: crypto.randomUUID(), ownerId, version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    stage: "queued_plan", source, sourceHash: await digest(source), consentText: true, consentMedia: false };
}
export async function approvalFor(job: Job, reviewer: string, input: Metadata, now = new Date()): Promise<Approval> {
  if (job.stage !== "ready" || !job.artifact || !job.planHash || job.artifact.planHash !== job.planHash) throw new Error("完成動画を確認してから承認してください");
  const metadata = normalizeMetadata(input);
  if (metadata.madeForKids !== (job.source.conditions.audience === "kids")) throw new Error("比較計画の対象と子ども向け設定が一致しません");
  const value = { reviewer, videoHash: job.artifact.sha256, planHash: job.planHash, sourceHash: job.sourceHash,
    channelId: job.source.channelId, metadata, expiresAt: new Date(now.getTime() + 86400000).toISOString() };
  return { ...value, digest: await digest(value) };
}
export async function assertApproval(job: Job, now = new Date()) {
  const a = job.approval;
  if (!a || !job.artifact || Date.parse(a.expiresAt) <= now.getTime() ||
    a.videoHash !== job.artifact.sha256 || a.planHash !== job.planHash || a.sourceHash !== job.sourceHash ||
    a.channelId !== job.source.channelId) throw new Error("承認が無効または期限切れです。完成動画を再確認してください");
  const { digest: value, ...signed } = a;
  if (await digest(signed) !== value) throw new Error("承認内容が一致しません");
}
export function assertLease(job: Job, lease: string, now = new Date()) {
  if (!ACTIVE.includes(job.stage) || !job.lease || job.lease !== lease || !job.leaseUntil || Date.parse(job.leaseUntil) <= now.getTime()) throw new Error("実行権限が期限切れまたは失効しています");
}
export function publicJob(job: Job) {
  // The browser can inspect all of its content, but not worker execution tokens.
  const { lease: _lease, leaseUntil: _until, ...rest } = job;
  return rest;
}

/** Single byte-range only; reject invalid/unsatisfiable ranges without R2 IO. */
export function videoRange(value: string | null, size: number): {offset:number;length:number} | null {
  if (!value) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1]&&!m[2])) throw new Error("invalid_range");
  const start = m[1] ? Number(m[1]) : Math.max(0, size-Number(m[2]));
  const end = m[1] && m[2] ? Math.min(size-1,Number(m[2])) : size-1;
  if (![start,end].every(Number.isSafeInteger) || start<0 || start>=size || end<start || (!m[1]&&Number(m[2])<=0)) throw new Error("invalid_range");
  return {offset:start,length:end-start+1};
}
