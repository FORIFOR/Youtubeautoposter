import { Repository } from "../repository";
import { ACTIVE, type Job, type Task } from "./domain";
export class ProductionRepository extends Repository {
  async jobs(ownerId: string): Promise<Job[]> {
    const rows = await this.db.prepare("SELECT payload FROM production_jobs WHERE owner_id=? ORDER BY created_at DESC LIMIT 100").bind(ownerId).all<{payload:string}>();
    return rows.results.map(r => JSON.parse(r.payload));
  }
  async job(ownerId: string, id: string): Promise<Job | null> {
    const row = await this.db.prepare("SELECT payload FROM production_jobs WHERE owner_id=? AND id=?").bind(ownerId,id).first<{payload:string}>();
    return row ? JSON.parse(row.payload) : null;
  }
  async add(job: Job, dailyLimit = 3): Promise<Job> {
    // One immutable source creates at most one paid plan, including after failure.
    const result = await this.db.prepare(`INSERT OR IGNORE INTO production_jobs(id,owner_id,source_hash,created_at,payload)
      SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM production_jobs WHERE owner_id=? AND substr(created_at,1,10)=?) < ?
      AND (SELECT count(*) FROM production_jobs WHERE owner_id=? AND json_extract(payload,'$.stage') NOT IN ('uploaded','failed','uncertain','cancelled')) < 5`)
      .bind(job.id,job.ownerId,job.sourceHash,job.createdAt,JSON.stringify(job),job.ownerId,job.createdAt.slice(0,10),dailyLimit,job.ownerId).run();
    if (result.meta.changes) return job;
    const row = await this.db.prepare("SELECT payload FROM production_jobs WHERE owner_id=? AND source_hash=?").bind(job.ownerId,job.sourceHash).first<{payload:string}>();
    if (row) return JSON.parse(row.payload);
    throw new Error("制作の当日上限、または未完了5件の上限です");
  }
  async save(previous: Job, value: Job): Promise<Job> {
    const next = {...value, version: previous.version+1, updatedAt:new Date().toISOString()};
    const result = await this.db.prepare("UPDATE production_jobs SET payload=? WHERE owner_id=? AND id=? AND payload=?")
      .bind(JSON.stringify(next),previous.ownerId,previous.id,JSON.stringify(previous)).run();
    if (!result.meta.changes) throw new Error("別の操作で更新されました。再表示してください");
    return next;
  }
  async worker(ownerId: string): Promise<Record<string,unknown> | null> {
    const row=await this.db.prepare("SELECT payload FROM production_worker_state WHERE owner_id=?").bind(ownerId).first<{payload:string}>();
    return row?JSON.parse(row.payload):null;
  }
  async heartbeat(ownerId: string, capabilities: {text:boolean;media:boolean;upload:boolean;profile:string}) {
    const value={...capabilities,lastSeen:new Date().toISOString(),connectionVerified:false};
    await this.db.prepare("INSERT INTO production_worker_state(owner_id,payload) VALUES(?,?) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload").bind(ownerId,JSON.stringify(value)).run();
    return value;
  }
  async claim(ownerId: string, allowed: Task[]): Promise<Job | null> {
    const now = new Date();
    const queued = {queued_plan:"plan",queued_render:"render",queued_upload:"upload",queued_check:"check"} as const;
    for (const job of (await this.jobs(ownerId)).reverse()) {
      if (ACTIVE.includes(job.stage) && job.leaseUntil && Date.parse(job.leaseUntil)<=now.getTime()) {
        // A crashed paid request or upload is uncertain, never automatically replayed.
        try { await this.save(job,{...job,stage:"uncertain",error:"ワーカーが中断しました。自動再生成・再投稿はしません",lease:undefined,leaseUntil:undefined}); } catch { /* another worker owns it */ }
        continue;
      }
      const task=queued[job.stage as keyof typeof queued];
      if (!task || !allowed.includes(task)) continue;
      const stage = {plan:"planning",render:"rendering",upload:"uploading",check:"checking"} as const;
      try { return await this.save(job,{...job,task,stage:stage[task],lease:crypto.randomUUID(),leaseUntil:new Date(now.getTime()+15*60000).toISOString(),error:undefined}); }
      catch { /* CAS lost; do not claim the same job twice */ }
    }
    return null;
  }
}
