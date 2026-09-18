import { test } from "node:test";
import assert from "node:assert/strict";
import type { Experiment, Recommendation, StudioData } from "../lib/growth";
import { canonical, digest, evidenceKey, makeLearningDraft, diagnoseExperiment, productionPackage } from "../lib/learning";
const now = new Date("2026-09-19T00:00:00Z");
const conditions = { series:"test", audience:"general" as const, language:"ja", voice:"voice", visualStyle:"style", character:"character", subtitleStyle:"subtitles", durationMin:30, durationMax:45, format:"short" as const };
const experiment: Experiment = { id:"e", title:"test", channelId:"channel", conditions, factor:"opening", variantA:"question", variantB:"result", minSamples:4, threshold:.2, createdAt:"2026-09-01T00:00:00Z" };
function fixture() {
  const data: StudioData = { experiments:[experiment], videos:[], observations:[], analytics:[], drafts:[] };
  const evidence: Recommendation = { schemaVersion:"1.0", experimentId:"e", generatedAt:now.toISOString(), status:"insufficient_data", checkpoint:"72h", source:"youtube_data", definition:"youtube_data_v3:viewCount:2025-03-31", groups:[{variant:"A",label:"question",count:0,median:null,videoIds:[],observationIds:[]},{variant:"B",label:"result",count:0,median:null,videoIds:[],observationIds:[]}], excluded:[], candidate:null, relativeLift:null, facts:[], uncertainties:["unknown"], nextChange:"change the opening", fixedConditions:conditions, permissions:{publish:false,paidGeneration:false} };
  return { data, evidence };
}
function measured(views: number | null) {
  const {data,evidence}=fixture();
  data.videos.push({id:"v",youtubeId:"yt",title:"video",channelId:"channel",publishedAt:"2026-09-15T00:00:00Z",contentHash:"a".repeat(64),durationSeconds:35,experimentId:"e",variant:"A",conditions,episode:"episode",createdAt:"2026-09-15T00:00:00Z",verified:true});
  data.observations.push({id:"o",videoId:"v",checkpoint:"72h",observedAt:"2026-09-18T00:00:00Z",status:"collected",source:"youtube_data",definition:evidence.definition,views,likes:0,reason:null});
  return {data,evidence};
}
test("canonical hashing ignores key insertion order", async()=>{assert.equal(canonical({b:2,a:1}),canonical({a:1,b:2}));assert.equal(await digest({b:2,a:1}),await digest({a:1,b:2}));});
test("zero-data exploration never invents a winning candidate",()=>{const {data,evidence}=fixture();const d=makeLearningDraft(experiment,data,evidence,"first",now);assert.equal(d.mode,"exploration");assert.equal(d.status,"draft");assert.equal(d.evidence.candidate,null);assert.equal(d.evidence.permissions.publish,false);assert.match(d.script,/未検証/);});
test("inconclusive results still create an observation draft",()=>{const {data,evidence}=fixture();evidence.status="inconclusive";assert.equal(makeLearningDraft(experiment,data,evidence,"next",now).mode,"observation");});
test("explicit variant does not mutate the measured recommendation",()=>{const {data,evidence}=fixture();evidence.status="retest_candidate";evidence.candidate="B";const d=makeLearningDraft(experiment,data,evidence,"next",now,"A");assert.equal(d.plannedVariant,"A");assert.equal(d.evidence.candidate,"B");});
test("unpublished plans balance exploratory variants",()=>{const {data,evidence}=fixture();data.drafts.push(makeLearningDraft(experiment,data,evidence,"one",now,"A"));assert.equal(makeLearningDraft(experiment,data,evidence,"two",now).plannedVariant,"B");});
test("synthetic and empty evidence never triggers autonomous drafts",async()=>{const {evidence}=fixture();assert.equal(await evidenceKey(experiment,evidence),null);evidence.groups[0].observationIds=["o"];evidence.source="demo";assert.equal(await evidenceKey(experiment,evidence),null);});
test("regenerating a report timestamp is not new evidence",async()=>{const {evidence}=fixture();evidence.groups[0].observationIds=["o"];const hash=await evidenceKey(experiment,evidence);evidence.generatedAt="2027-01-01T00:00:00Z";assert.equal(await evidenceKey(experiment,evidence),hash);evidence.groups[0].median=10;assert.notEqual(await evidenceKey(experiment,evidence),hash);});
test("changing decision thresholds changes evidence identity",async()=>{const {evidence}=fixture();evidence.groups[0].observationIds=["o"];assert.notEqual(await evidenceKey(experiment,evidence),await evidenceKey({...experiment,threshold:.5},evidence));});
test("measured zero is not missing or proof of insufficient exposure",()=>{const {data}=measured(0);const d=diagnoseExperiment(experiment,data,now);assert.equal(d.state,"observed_zero");assert.equal(d.latestViews,0);assert.equal(d.exposureKnown,false);assert.equal(d.causalEffectKnown,false);});
test("missing views remain unknown",()=>{const {data}=measured(null);const d=diagnoseExperiment(experiment,data,now);assert.equal(d.state,"awaiting_measurement");assert.equal(d.latestViews,null);});
test("wrong metric definitions and future observations are excluded",()=>{for(const mutation of [(data:StudioData)=>{data.observations[0].definition="other";},(data:StudioData)=>{data.observations[0].observedAt="2030-01-01T00:00:00Z";}]){const {data}=measured(10);mutation(data);assert.equal(diagnoseExperiment(experiment,data,now).latestViews,null);}});
test("unverified videos do not support diagnosis",()=>{const {data}=measured(10);data.videos[0].verified=false;assert.equal(diagnoseExperiment(experiment,data,now).state,"needs_verification");});
test("draft review is required for a production package",async()=>{const {data,evidence}=fixture();await assert.rejects(productionPackage(makeLearningDraft(experiment,data,evidence,"first",now)));});
test("a reviewed script is still not approval to render or publish",async()=>{const {data,evidence}=fixture();const d=makeLearningDraft(experiment,data,evidence,"first",now);d.status="reviewed";const p=await productionPackage(d);assert.equal(p.publishAllowed,false);assert.equal(p.renderReady,false);const changed=await productionPackage({...d,script:"different"});assert.notEqual(changed.scriptHash,p.scriptHash);});
