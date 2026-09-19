import { collect } from "./collector";
import { compare } from "./growth";
import { evidenceKey, makeLearningDraft } from "./learning";
import { LearningRepository } from "./learning-repository";
import { YouTubeClient, type YouTubeConfig } from "./youtube";
import { Repository } from "./repository";

class ScopedRepository extends Repository {
  constructor(db: D1Database, private readonly experimentIds: Set<string>) { super(db); }
  override async state(ownerId: string) {
    const state = await super.state(ownerId);
    return { ...state, videos: state.videos.filter(v => this.experimentIds.has(v.experimentId)) };
  }
}
export async function runLearning(ownerId: string, db: D1Database, config: YouTubeConfig, manual = false) {
  const repo = new LearningRepository(db), runtime = await repo.runtime(ownerId);
  if (runtime?.blocked && !manual) return { summary: "接続設定の修正待ちです。画面から再試行してください。", skipped: true };
  const policies = await repo.policies(ownerId);
  const enabled = new Set(Object.entries(policies).filter(([,p]) => p.enabled).map(([id]) => id));
  if (!enabled.size && !manual) return { summary: "定期収集は停止中です。", skipped: true };
  const startedAt = new Date().toISOString();
  try {
    const result = await collect(ownerId, manual ? new Repository(db) : new ScopedRepository(db, enabled), new YouTubeClient(config));
    const data = await repo.state(ownerId);
    let draftsCreated = 0;
    for (const experiment of data.experiments) {
      if (!policies[experiment.id]?.enabled || !policies[experiment.id]?.autoDraft) continue;
      if (experiment.channelId !== config.channelId) continue;
      const evidence = compare(experiment, data), hash = await evidenceKey(experiment, evidence);
      if (!hash) continue;
      const draft = makeLearningDraft(experiment, data, evidence, `${experiment.conditions.series}・次の検証`, new Date(), undefined, `auto-${hash}`);
      if (await repo.addAutomaticDraft(ownerId, hash, draft)) draftsCreated++;
    }
    const blocked = result.errors.some(code => /authorization_required|quota_exceeded|api_key_missing|http_403/.test(code));
    const summary = `${result.summary} / 次の下書き ${draftsCreated}件`;
    await repo.recordRuntime(ownerId, { startedAt, finishedAt: new Date().toISOString(), trigger: manual ? "manual" : "scheduled",
      blocked, summary, errors: result.errors, draftsCreated,
      lastSuccessfulObservation: data.observations.filter(o => o.source === "youtube_data" && o.status === "collected" && o.views !== null)
        .map(o => o.observedAt).sort().at(-1) ?? null });
    return { ...result, summary, draftsCreated, blocked };
  } catch {
    await repo.recordRuntime(ownerId, { startedAt, finishedAt: new Date().toISOString(), trigger: manual ? "manual" : "scheduled",
      blocked: true, summary: "収集または保存に失敗しました。設定を確認して再試行してください。" });
    throw new Error("learning_run_failed");
  }
}
