import { z } from "zod";
import { AppError,endpoint,json,jsonBody } from "@/lib/http";
import { digest } from "@/lib/learning";
import { assertApproval,assertLease,identifier,validatePlan,type Task } from "@/lib/production/domain";
import { ProductionRepository } from "@/lib/production/repository";
import { workerOwner } from "@/lib/production/environment";
import { currentSource,requiredJob,registerPublicVideo } from "@/lib/production/service";
const caps=z.object({text:z.boolean(),media:z.boolean(),upload:z.boolean(),profile:z.string().max(500)}).strict();
const remote=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{11}$/),channelId:z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),title:z.string().max(200),privacy:z.enum(["private","unlisted","public"]),processed:z.boolean(),duration:z.number().positive().max(91).nullable(),publishedAt:z.string().datetime(),checkedAt:z.string().datetime()}).strict();
const identity={id:identifier,lease:identifier};
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("hello"),capabilities:caps}).strict(),
  z.object({action:z.literal("claim"),capabilities:caps}).strict(),
  z.object({...identity,action:z.literal("heartbeat")}).strict(),
  z.object({...identity,action:z.literal("finish-plan"),plan:z.unknown(),model:z.string().min(1).max(100)}).strict(),
  z.object({...identity,action:z.literal("finish-upload"),remote}).strict(),
  z.object({...identity,action:z.literal("fail"),code:z.enum(["provider_or_validation_failed","render_failed","upload_uncertain","worker_interrupted"])}).strict()
]);
export async function POST(request:Request){return endpoint(async()=>{
  const {ownerId,cfg}=await workerOwner(request),input=schema.parse(await jsonBody(request)),repo=new ProductionRepository();
  if(input.action==="hello"||input.action==="claim"){
    await repo.heartbeat(ownerId,input.capabilities);
    if(input.action==="hello")return json({enabled:cfg.enabled,ownerId});
    if(!cfg.enabled)return json({job:null});
    const allowed:Task[]=[];
    if(input.capabilities.text)allowed.push("plan");
    if(input.capabilities.media&&cfg.assets)allowed.push("render");
    if(input.capabilities.upload){allowed.push("check");if(cfg.uploadEnabled)allowed.push("upload");}
    const job=await repo.claim(ownerId,allowed);
    return json({job});
  }
  const job=await requiredJob(repo,ownerId,input.id);assertLease(job,input.lease);
  if(input.action==="fail"){
    return json(await repo.save(job,{...job,stage:job.task==="upload"||job.task==="check"?"uncertain":"failed",error:input.code,lease:undefined,leaseUntil:undefined}));
  }
  if(!cfg.enabled)throw new AppError("制作を停止しています。",409);
  if(job.task!=="check")await currentSource(repo,job);
  if(job.task==="upload"){
    if(!cfg.uploadEnabled)throw new AppError("アップロードを停止しています。",409);
    await assertApproval(job);
  }
  if(input.action==="heartbeat")return json(await repo.save(job,{...job,leaseUntil:new Date(Date.now()+15*60000).toISOString()}));
  if(input.action==="finish-plan"){
    if(job.stage!=="planning")throw new AppError("台本生成のジョブではありません。",409);
    const plan=validatePlan(input.plan,job.source);
    return json(await repo.save(job,{...job,stage:"planned",plan,planHash:await digest(plan),planModel:input.model,lease:undefined,leaseUntil:undefined}));
  }
  if(input.action==="finish-upload"){
    if(!["uploading","checking"].includes(job.stage)||input.remote.channelId!==job.source.channelId)throw new AppError("アップロード結果を照合できません。",409);
    if(job.remote&&job.remote.id!==input.remote.id)throw new AppError("既存のアップロードIDと一致しません。",409);
    const completed=await repo.save(job,{...job,stage:"uploaded",remote:input.remote,error:undefined,lease:undefined,leaseUntil:undefined});
    return json(await registerPublicVideo(repo,completed,input.remote));
  }
  throw new AppError("操作を確認してください。");
});}
