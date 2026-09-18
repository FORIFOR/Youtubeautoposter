import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { LearningRepository } from "../lib/learning-repository";
import type { LearningDraft } from "../lib/learning";
import { readFileSync } from "node:fs";

function setup() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON; CREATE TABLE experiments(id TEXT PRIMARY KEY); INSERT INTO experiments VALUES('e'); CREATE TABLE drafts(id TEXT PRIMARY KEY,owner_id TEXT,experiment_id TEXT,payload TEXT,created_at TEXT);");
  sql.exec(readFileSync("drizzle/0001_learning_loop.sql","utf8"));
  class Statement {
    args: SQLInputValue[]=[];
    constructor(readonly query:string) {}
    bind(...args: SQLInputValue[]) {this.args=args;return this;}
    async run() {const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)},results:[]};}
    async first() {return sql.prepare(this.query).get(...this.args)??null;}
    async all() {return {results:sql.prepare(this.query).all(...this.args)};}
  }
  const db={prepare:(q:string)=>new Statement(q),batch:async(statements:Statement[])=>{sql.exec("BEGIN IMMEDIATE");try{const results=[];for(const s of statements)results.push(await s.run());sql.exec("COMMIT");return results;}catch(e){sql.exec("ROLLBACK");throw e;}}} as unknown as D1Database;
  const repo=new LearningRepository(db);
  const draft=(id="auto-a",when="2026-09-19T00:00:00Z")=>({id,experimentId:"e",createdAt:when,revision:1,status:"draft"} as LearningDraft);
  return {sql,repo,draft};
}
test("automatic drafting requires current opt-in inside the transaction",async()=>{const {sql,repo,draft}=setup();try{assert.equal(await repo.addAutomaticDraft("u","a",draft()),false);await repo.setPolicy("u","e",{enabled:true,autoDraft:false,version:0});assert.equal(await repo.addAutomaticDraft("u","a",draft()),false);}finally{sql.close();}});
test("policy rejects stale writers",async()=>{const {sql,repo}=setup();try{assert.equal(await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0}),true);assert.equal(await repo.setPolicy("u","e",{enabled:false,autoDraft:false,version:0}),false);assert.equal((await repo.policy("u","e")).enabled,true);}finally{sql.close();}});
test("replayed evidence and next-day retry do not create duplicates",async()=>{const {sql,repo,draft}=setup();try{await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0});assert.equal(await repo.addAutomaticDraft("u","a",draft()),true);assert.equal(await repo.addAutomaticDraft("u","a",draft()),false);assert.equal(await repo.addAutomaticDraft("u","a",draft("auto-a","2026-09-21T00:00:00Z")),false);assert.equal(sql.prepare("SELECT count(*) n FROM drafts").get()?.n,1);}finally{sql.close();}});
test("twenty-four-hour cooldown applies across different evidence",async()=>{const {sql,repo,draft}=setup();try{await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0});await repo.addAutomaticDraft("u","a",draft());assert.equal(await repo.addAutomaticDraft("u","b",draft("auto-b","2026-09-19T01:00:00Z")),false);}finally{sql.close();}});
test("two pending drafts cap; completion releases capacity",async()=>{const {sql,repo,draft}=setup();try{await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0});await repo.addAutomaticDraft("u","a",draft());await repo.addAutomaticDraft("u","b",draft("auto-b","2026-09-21T00:00:00Z"));assert.equal(await repo.addAutomaticDraft("u","c",draft("auto-c","2026-09-23T00:00:00Z")),false);sql.exec("UPDATE drafts SET payload=json_set(payload,'$.completedAt','2026-09-22') WHERE id='auto-a'");assert.equal(await repo.addAutomaticDraft("u","c",draft("auto-c","2026-09-23T00:00:00Z")),true);}finally{sql.close();}});
test("owner policies cannot authorize another owner's draft",async()=>{const {sql,repo,draft}=setup();try{await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0});assert.equal(await repo.addAutomaticDraft("someone-else","a",draft()),false);}finally{sql.close();}});
test("decision failure rolls back the new draft",async()=>{const {sql,repo,draft}=setup();try{await repo.setPolicy("u","e",{enabled:true,autoDraft:true,version:0});sql.exec("CREATE TRIGGER reject_decision BEFORE INSERT ON learning_decisions BEGIN SELECT RAISE(ABORT,'injected failure'); END;");await assert.rejects(repo.addAutomaticDraft("u","a",draft()));assert.equal(sql.prepare("SELECT count(*) n FROM drafts").get()?.n,0);}finally{sql.close();}});
