import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync,type SQLInputValue} from "node:sqlite";
import {readFileSync} from "node:fs";
import {ProductionRepository} from "../lib/production/repository";
import {makeJob,type Source} from "../lib/production/domain";
function setup(){
  const sql=new DatabaseSync(":memory:");sql.exec(readFileSync("drizzle/0002_production_bridge.sql","utf8"));
  class S {args:SQLInputValue[]=[];constructor(readonly query:string){}bind(...args:SQLInputValue[]){this.args=args;return this;}async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)},results:[]};}async first(){return sql.prepare(this.query).get(...this.args)??null;}async all(){return {results:sql.prepare(this.query).all(...this.args)};}}
  const repo=new ProductionRepository({prepare:(q:string)=>new S(q)} as unknown as D1Database);
  const job=(title="one",owner="owner",now=new Date())=>makeJob(owner,{title,draftId:"d",draftRevision:1} as Source,now);
  return {sql,repo,job};
}
test("same source is idempotent, including failed jobs",async()=>{const {sql,repo,job}=setup();try{const first=await repo.add(await job());await repo.save(first,{...first,stage:"failed"});const repeat=await repo.add(await job());assert.equal(first.id,repeat.id);assert.equal(repeat.stage,"failed");assert.equal((await repo.jobs("owner")).length,1);}finally{sql.close();}});
test("daily cap includes unknown requests and is scoped by owner",async()=>{const {sql,repo,job}=setup();try{const j=await repo.add(await job(),1);await repo.save(j,{...j,stage:"uncertain"});await assert.rejects(repo.add(await job("two"),1));await repo.add(await job("two","other"),1);assert.equal(await repo.job("other",j.id),null);}finally{sql.close();}});
test("claim requires a matching worker capability and is exclusive",async()=>{const {sql,repo,job}=setup();try{await repo.add(await job());assert.equal(await repo.claim("owner",["upload"]),null);const [one,two]=await Promise.all([repo.claim("owner",["plan"]),repo.claim("owner",["plan"])]);assert.equal([one,two].filter(Boolean).length,1);assert.equal((one??two)!.stage,"planning");}finally{sql.close();}});
test("compare-and-swap rejects stale editors and source is retained",async()=>{const {sql,repo,job}=setup();try{const j=await repo.add(await job());await repo.save(j,{...j,stage:"cancelled"});await assert.rejects(repo.save(j,{...j,stage:"queued_upload"}));assert.equal((await repo.job("owner",j.id))!.sourceHash,j.sourceHash);}finally{sql.close();}});
test("expired active work is uncertain, not retried or published",async()=>{const {sql,repo,job}=setup();try{const j=await repo.add(await job());await repo.save(j,{...j,stage:"uploading",lease:"old",leaseUntil:"2020-01-01T00:00:00Z"});assert.equal(await repo.claim("owner",["upload","plan"]),null);assert.equal((await repo.job("owner",j.id))!.stage,"uncertain");assert.equal(await repo.claim("owner",["upload","plan"]),null);}finally{sql.close();}});
test("five unfinished jobs cap holds across days",async()=>{const {sql,repo,job}=setup();try{for(let i=0;i<5;i++)await repo.add(await job(String(i),"owner",new Date(`2026-09-${10+i}T00:00:00Z`)));await assert.rejects(repo.add(await job("six","owner",new Date("2026-09-19T00:00:00Z"))));}finally{sql.close();}});
