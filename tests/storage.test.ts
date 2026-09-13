import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { Repository } from "../lib/repository";
import { makeDemo } from "../lib/demo";
import { compare, draftScript, type Draft } from "../lib/growth";
function storage() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON"); sqlite.exec(readFileSync("drizzle/0000_kind_speed_demon.sql", "utf8"));
  function prepare(sql: string) {
    let bindings: (string | number | null)[] = [];
    const statement = { bind(...values: (string | number | null)[]) { bindings = values; return statement; }, async first() { return sqlite.prepare(sql).get(...bindings) ?? null; }, async run() { const r = sqlite.prepare(sql).run(...bindings); return { meta: { changes: Number(r.changes) }, results: [] }; }, execute() { return { results: sqlite.prepare(sql).all(...bindings), meta: {} }; } };
    return statement;
  }
  const binding = { prepare, async batch(statements: ReturnType<typeof prepare>[]) { sqlite.exec("BEGIN"); try { const results = statements.map(s => s.execute()); sqlite.exec("COMMIT"); return results; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } } } as unknown as D1Database;
  return { repo: new Repository(binding), sqlite };
}
test("database scopes state by owner and enforces unique publication registration", async () => { const { repo, sqlite } = storage(); try { const d = makeDemo(), e = d.experiments[0], v = d.videos[0]; await repo.addExperiment("alice", e); await repo.addVideo("alice", v); assert.equal((await repo.state("alice")).videos.length, 1); assert.equal((await repo.state("bob")).videos.length, 0); assert.equal(await repo.experiment("bob", e.id), null); await assert.rejects(repo.addVideo("alice", { ...v, id: "duplicate" }), /UNIQUE/); } finally { sqlite.close(); } });
test("checkpoint storage is immutable even if a later observation is larger", async () => { const { repo, sqlite } = storage(); try { const d = makeDemo(); await repo.addExperiment("a", d.experiments[0]); await repo.addVideo("a", d.videos[0]); const o = d.observations[0]; assert.equal(await repo.observation("a", o), true); assert.equal(await repo.observation("a", { ...o, id: "later", views: 999999 }), false); assert.equal((await repo.state("a")).observations[0].views, o.views); } finally { sqlite.close(); } });
test("collector lease is exclusive and a stale process cannot release a newer lease", async () => { const { repo, sqlite } = storage(); try { assert.equal(await repo.acquire("a", "first", 1000), true); assert.equal(await repo.acquire("a", "second", 1001), false); assert.equal(await repo.acquire("a", "second", 181001), true); await repo.release("a", "first", 0); assert.equal(await repo.acquire("a", "third", 181002), false); } finally { sqlite.close(); } });
test("daily Analytics updates late revisions without adding duplicate days", async () => { const { repo, sqlite } = storage(); try { const d = makeDemo(); await repo.addExperiment("a", d.experiments[0]); await repo.addVideo("a", d.videos[0]); const row = d.analytics[0]; await repo.analytics("a", [row]); await repo.analytics("a", [{ ...row, engagedViews: 12345 }]); const s = await repo.state("a"); assert.equal(s.analytics.length, 1); assert.equal(s.analytics[0].engagedViews, 12345); assert.equal((await repo.state("b")).analytics.length, 0); } finally { sqlite.close(); } });
test("draft edits are atomic, scoped, and preserve the original evidence", async () => { const { repo, sqlite } = storage(); try { const d = makeDemo(), e = d.experiments[0], evidence = compare(e, d, "demo"), draft: Draft = { id: "draft", experimentId: e.id, title: "new", status: "draft", script: draftScript(e, evidence, "はっぱ"), evidence, createdAt: new Date().toISOString(), revision: 1 }; await repo.addExperiment("a", e); await repo.addDraft("a", draft); const previous = JSON.stringify(draft); assert.equal(await repo.updateDraft("b", { ...draft, script: "wrong" }, previous), false); assert.equal(await repo.updateDraft("a", { ...draft, script: "new", revision: 2 }, previous), true); assert.equal(await repo.updateDraft("a", { ...draft, status: "reviewed" }, previous), false); assert.deepEqual((await repo.draft("a", "draft"))!.evidence, evidence); } finally { sqlite.close(); } });
