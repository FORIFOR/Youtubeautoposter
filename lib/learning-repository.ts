import { Repository } from "./repository";
import { DEFAULT_POLICY, type LearningDraft, type Policy } from "./learning";

export class LearningRepository extends Repository {
  async policies(ownerId: string): Promise<Record<string, Policy>> {
    const result = await this.db.prepare("SELECT experiment_id, payload, version FROM learning_settings WHERE owner_id = ?")
      .bind(ownerId).all<{ experiment_id: string; payload: string; version: number }>();
    return Object.fromEntries(result.results.map(r => [r.experiment_id, { ...JSON.parse(r.payload), version: r.version }]));
  }
  async policy(ownerId: string, experimentId: string): Promise<Policy> {
    return (await this.policies(ownerId))[experimentId] ?? { ...DEFAULT_POLICY };
  }
  async setPolicy(ownerId: string, experimentId: string, policy: Policy) {
    const payload = JSON.stringify({ enabled: policy.enabled, autoDraft: policy.autoDraft });
    const statement = policy.version === 0 ?
      this.db.prepare("INSERT OR IGNORE INTO learning_settings(owner_id,experiment_id,payload,version) VALUES(?,?,?,1)").bind(ownerId, experimentId, payload) :
      this.db.prepare("UPDATE learning_settings SET payload=?,version=version+1 WHERE owner_id=? AND experiment_id=? AND version=?").bind(payload, ownerId, experimentId, policy.version);
    return (await statement.run()).meta.changes > 0;
  }
  async runtime(ownerId: string): Promise<Record<string, unknown> | null> {
    const row = await this.db.prepare("SELECT payload FROM learning_runtime WHERE owner_id=?").bind(ownerId).first<{ payload: string }>();
    return row ? JSON.parse(row.payload) : null;
  }
  async recordRuntime(ownerId: string, value: Record<string, unknown>) {
    await this.db.prepare("INSERT INTO learning_runtime(owner_id,payload) VALUES(?,?) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload")
      .bind(ownerId, JSON.stringify(value)).run();
  }
  async addAutomaticDraft(ownerId: string, evidenceHash: string, draft: LearningDraft): Promise<boolean> {
    const since = new Date(Date.parse(draft.createdAt) - 24 * 3600000).toISOString();
    // D1 batch is transactional. Re-check consent, pending cap and cooldown in
    // SQL, not just in the scheduler's stale read. Replays use a deterministic ID.
    const results = await this.db.batch([
      this.db.prepare(`INSERT OR IGNORE INTO drafts(id,owner_id,experiment_id,payload,created_at)
        SELECT ?,?,?,?,? WHERE
        EXISTS(SELECT 1 FROM learning_settings WHERE owner_id=? AND experiment_id=?
          AND json_extract(payload,'$.enabled')=1 AND json_extract(payload,'$.autoDraft')=1)
        AND (SELECT count(*) FROM drafts WHERE owner_id=? AND experiment_id=?
          AND json_extract(payload,'$.completedAt') IS NULL) < 2
        AND NOT EXISTS(SELECT 1 FROM learning_decisions WHERE owner_id=? AND experiment_id=? AND created_at>=?)`)
        .bind(draft.id, ownerId, draft.experimentId, JSON.stringify(draft), draft.createdAt,
          ownerId, draft.experimentId, ownerId, draft.experimentId, ownerId, draft.experimentId, since),
      this.db.prepare(`INSERT OR IGNORE INTO learning_decisions(owner_id,experiment_id,evidence_hash,draft_id,created_at)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM drafts WHERE id=? AND owner_id=?)`)
        .bind(ownerId, draft.experimentId, evidenceHash, draft.id, draft.createdAt, draft.id, ownerId)
    ]);
    return results[0].meta.changes > 0;
  }
}
