import {test} from "node:test";
import assert from "node:assert/strict";
import {makeDemo} from "../lib/demo";
import {compare} from "../lib/growth";
import {digest,makeLearningDraft} from "../lib/learning";
import {makeJob,sourceOf,validatePlan,approvalFor,assertApproval,assertLease,publicJob,videoRange,DISCLOSURE,type Job} from "../lib/production/domain";

async function fixture(){
  const data=makeDemo(),exp=data.experiments[0],draft=makeLearningDraft(exp,data,compare(exp,data,"demo"),"New story");
  const job=await makeJob("owner",sourceOf(draft,exp));
  const plan=validatePlan({title:"A small discovery",description:"Story",scenes:[{narration:"Look at the light.",caption:"A small discovery",imagePrompt:"Sunrise"}],rationale:"Unverified exploration",evidenceRefs:[],caveats:["Not a success claim"]},job.source);
  job.plan=plan;job.planHash=await digest(plan);job.stage="ready";
  job.artifact={key:"safe-key",sha256:"a".repeat(64),size:1024,duration:35,width:1080,height:1920,planHash:job.planHash,profile:"test/v1",createdAt:new Date().toISOString()};
  const metadata={title:plan.title,description:"Description",privacy:"private" as const,madeForKids:exp.conditions.audience==="kids",containsSyntheticMedia:true};
  return {data,exp,draft,job,metadata};
}
test("model plan cannot invent observation references",async()=>{const {job}=await fixture();assert.throws(()=>validatePlan({...job.plan,evidenceRefs:["invented"]},job.source));});
test("plan rejects placeholders and unexpected fields",async()=>{const {job}=await fixture();assert.throws(()=>validatePlan({...job.plan,publish:true},job.source));assert.throws(()=>validatePlan({...job.plan,scenes:[{...job.plan!.scenes[0],narration:"［ここに本文］"}]},job.source));});
test("reviewed metadata is normalized before approval; defaults are not publication authority",async()=>{const {job,metadata}=await fixture();job.approval=await approvalFor(job,"owner",metadata);assert.ok(job.approval.metadata.description.includes(DISCLOSURE));assert.equal(job.approval.metadata.privacy,"private");await assertApproval(job);});
test("completed MP4 and plan are mandatory for approval",async()=>{const {job,metadata}=await fixture();await assert.rejects(approvalFor({...job,stage:"rendering"},"owner",metadata));await assert.rejects(approvalFor({...job,artifact:undefined},"owner",metadata));});
test("audience cannot silently change during upload approval",async()=>{const {job,metadata}=await fixture();await assert.rejects(approvalFor(job,"owner",{...metadata,madeForKids:!metadata.madeForKids}));});
test("approval binds exact video, plan, source and destination",async()=>{const {job,metadata}=await fixture();job.approval=await approvalFor(job,"owner",metadata);for(const mutate of [(j:Job)=>{j.artifact!.sha256="b".repeat(64)},(j:Job)=>{j.planHash="c".repeat(64)},(j:Job)=>{j.sourceHash="d".repeat(64)},(j:Job)=>{j.source.channelId="different"}]){const changed=structuredClone(job);mutate(changed);await assert.rejects(assertApproval(changed));}});
test("approval cannot be changed from private to public or retitled",async()=>{const {job,metadata}=await fixture();job.approval=await approvalFor(job,"owner",metadata);const changed=structuredClone(job);changed.approval!.metadata.privacy="public";await assert.rejects(assertApproval(changed));job.approval.metadata.title="different";await assert.rejects(assertApproval(job));});
test("approval expires exactly at 24 hours",async()=>{const {job,metadata}=await fixture();const now=new Date("2026-09-19T00:00:00Z");job.approval=await approvalFor(job,"owner",metadata,now);await assertApproval(job,new Date(now.getTime()+86400000-1));await assert.rejects(assertApproval(job,new Date(now.getTime()+86400000)));});
test("stale worker cannot finish a cancelled or expired job",async()=>{const {job}=await fixture();job.stage="rendering";job.lease="secret";job.leaseUntil=new Date(Date.now()+60000).toISOString();assertLease(job,"secret");assert.throws(()=>assertLease(job,"other"));assert.throws(()=>assertLease({...job,stage:"cancelled"},"secret"));assert.throws(()=>assertLease({...job,leaseUntil:"2020-01-01T00:00:00Z"},"secret"));assert.equal("lease" in publicJob(job),false);});
test("editing the source changes the immutable source identity",async()=>{const {draft,exp}=await fixture();assert.notEqual(await digest(sourceOf(draft,exp)),await digest(sourceOf({...draft,script:"changed",revision:draft.revision+1},exp)));assert.throws(()=>sourceOf({...draft,completedAt:"2026-09-19"},exp));});
test("preview range supports start, bounded end and suffix; bad ranges fail",()=>{assert.equal(videoRange(null,100),null);assert.deepEqual(videoRange("bytes=0-",100),{offset:0,length:100});assert.deepEqual(videoRange("bytes=10-19",100),{offset:10,length:10});assert.deepEqual(videoRange("bytes=-10",100),{offset:90,length:10});for(const value of ["bytes=100-","bytes=20-10","bytes=-0","bytes=0-1,2-3","bad"]){assert.throws(()=>videoRange(value,100));}});
test("different production voices and render profiles are not pooled",()=>{const data=makeDemo();data.observations.forEach(o=>o.source="youtube_data");const e=data.experiments[0];data.videos[4].productionProfile="different-voice-v1";const r=compare(e,data,"youtube_data");assert.ok(r.excluded.some(x=>x.videoId===data.videos[4].id&&x.reason.includes("制作")));});

test("description limit counts UTF-8 bytes after the mandatory disclosure",async()=>{const {job,metadata}=await fixture();await assert.rejects(approvalFor(job,"owner",{...metadata,description:"猫".repeat(1700)}));await assert.rejects(approvalFor(job,"owner",{...metadata,description:"<invalid>"}));const a=await approvalFor(job,"owner",{...metadata,description:"猫".repeat(1500)});assert.ok(new TextEncoder().encode(a.metadata.description).byteLength<=5000);});
