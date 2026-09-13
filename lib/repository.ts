import { database } from "@/db";
import type { AnalyticsRow, Draft, Experiment, Observation, StudioData, Video } from "./growth";
export class Repository {
  constructor(readonly db: D1Database = database()) {}
  async state(ownerId: string): Promise<StudioData> {
    const tables = ["experiments", "videos", "observations", "analytics", "drafts"] as const;
    const results = await this.db.batch<{ payload: string }>(tables.map(table => this.db.prepare(`SELECT payload FROM ${table} WHERE owner_id = ? ORDER BY rowid`).bind(ownerId)));
    return Object.fromEntries(tables.map((table, i) => [table, results[i].results.map(row => JSON.parse(row.payload))])) as StudioData;
  }
  async experiment(ownerId: string, id: string): Promise<Experiment | null> { const row = await this.db.prepare("SELECT payload FROM experiments WHERE owner_id = ? AND id = ?").bind(ownerId, id).first<{ payload: string }>(); return row ? JSON.parse(row.payload) : null; }
  async addExperiment(ownerId: string, e: Experiment) { await this.db.prepare("INSERT INTO experiments (id, owner_id, payload, created_at) VALUES (?, ?, ?, ?)").bind(e.id, ownerId, JSON.stringify(e), e.createdAt).run(); }
  async addVideo(ownerId: string, v: Video) { await this.db.prepare("INSERT INTO videos (id, owner_id, experiment_id, youtube_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(v.id, ownerId, v.experimentId, v.youtubeId, JSON.stringify(v), v.createdAt).run(); }
  async updateVideo(ownerId: string, v: Video) { await this.db.prepare("UPDATE videos SET payload = ? WHERE id = ? AND owner_id = ?").bind(JSON.stringify(v), v.id, ownerId).run(); }
  async observation(ownerId: string, o: Observation) { const res = await this.db.prepare("INSERT INTO observations (id, owner_id, video_id, checkpoint, payload) VALUES (?, ?, ?, ?, ?) ON CONFLICT(video_id, checkpoint) DO NOTHING").bind(o.id, ownerId, o.videoId, o.checkpoint, JSON.stringify(o)).run(); return res.meta.changes > 0; }
  async analytics(ownerId: string, rows: AnalyticsRow[]) { for (let i = 0; i < rows.length; i += 50) { await this.db.batch(rows.slice(i, i + 50).map(a => this.db.prepare("INSERT INTO analytics (id, owner_id, video_id, day, payload) VALUES (?, ?, ?, ?, ?) ON CONFLICT(video_id, day) DO UPDATE SET payload = excluded.payload").bind(crypto.randomUUID(), ownerId, a.videoId, a.day, JSON.stringify(a)))); } }
  async lastAnalyticsAttempt(videoId: string) { return (await this.db.prepare("SELECT attempted_at FROM analytics_attempts WHERE video_id = ?").bind(videoId).first<{ attempted_at: string }>())?.attempted_at ?? null; }
  async markAnalyticsAttempt(videoId: string, at: string) { await this.db.prepare("INSERT INTO analytics_attempts (video_id, attempted_at) VALUES (?, ?) ON CONFLICT(video_id) DO UPDATE SET attempted_at = excluded.attempted_at").bind(videoId, at).run(); }
  async addDraft(ownerId: string, d: Draft) { await this.db.prepare("INSERT INTO drafts (id, owner_id, experiment_id, payload, created_at) VALUES (?, ?, ?, ?, ?)").bind(d.id, ownerId, d.experimentId, JSON.stringify(d), d.createdAt).run(); }
  async draft(ownerId: string, id: string): Promise<Draft | null> { const r = await this.db.prepare("SELECT payload FROM drafts WHERE owner_id = ? AND id = ?").bind(ownerId, id).first<{ payload: string }>(); return r ? JSON.parse(r.payload) : null; }
  async updateDraft(ownerId: string, d: Draft, previousPayload: string) { const r = await this.db.prepare("UPDATE drafts SET payload = ? WHERE id = ? AND owner_id = ? AND payload = ?").bind(JSON.stringify(d), d.id, ownerId, previousPayload).run(); return r.meta.changes > 0; }
  async acquire(ownerId: string, token: string, now: number) { const r = await this.db.prepare("INSERT INTO collector_locks (owner_id, token, expires_at) VALUES (?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at WHERE collector_locks.expires_at <= ?").bind(ownerId, token, now + 180000, now).run(); return r.meta.changes > 0; }
  async release(ownerId: string, token: string, until: number) { await this.db.prepare("UPDATE collector_locks SET expires_at = ? WHERE owner_id = ? AND token = ?").bind(until, ownerId, token).run(); }
  async recordRun(ownerId: string, summary: string) { await this.db.prepare("INSERT INTO collection_runs (id, owner_id, finished_at, summary) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), ownerId, new Date().toISOString(), summary).run(); }
  async lastRun(ownerId: string) { return this.db.prepare("SELECT finished_at AS finishedAt, summary FROM collection_runs WHERE owner_id = ? ORDER BY finished_at DESC LIMIT 1").bind(ownerId).first<{ finishedAt: string; summary: string }>(); }
}
