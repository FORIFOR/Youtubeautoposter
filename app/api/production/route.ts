import { z } from "zod";
import { AppError,endpoint,json,jsonBody,owner } from "@/lib/http";
import { digest,type LearningDraft } from "@/lib/learning";
import { ProductionRepository } from "@/lib/production/repository";
import { assertApproval,approvalFor,identifier,makeJob,metadataSchema,planSchema,publicJob,sourceOf,validatePlan,hash } from "@/lib/production/domain";
import { allowOwner,productionEnvironment } from "@/lib/production/environment";
import { currentSource,requiredJob } from "@/lib/production/service";
const common={id:identifier,version:z.number().int().positive()};
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("generate"),draftId:z.string().min(1).max(100),expectedRevision:z.number().int().positive(),consentExternal:z.literal(true),consentCost:z.literal(true)}).strict(),
  z.object({...common,action:z.literal("edit-plan"),plan:planSchema}).strict(),
  z.object({...common,action:z.literal("render"),planHash:hash,confirmedScript:z.literal(true),consentExternal:z.literal(true),consentCost:z.literal(true)}).strict(),
  z.object({...common,action:z.literal("approve"),videoHash:hash,metadata:metadataSchema,reviewedVideoAndAudio:z.literal(true),rightsConfirmed:z.literal(true)}).strict(),
  z.object({...common,action:z.literal("upload"),approvalHash:hash,confirmed:z.literal(true)}).strict(),
  z.object({...common,action:z.literal("resume-upload"),approvalHash:hash,confirmed:z.literal(true)}).strict(),
  z.object({...common,action:z.literal("check")}).strict(),
  z.object({...common,action:z.literal("cancel")}).strict(),
  z.object({...common,action:z.literal("revoke")}).strict()
]);
export async function GET(request:Request){return endpoint(async()=>{
  const id=await owner(request),repo=new ProductionRepository(),cfg=productionEnvironment();
  const [jobs,data,worker]=await Promise.all([repo.jobs(id),repo.state(id),repo.worker(id)]);
  return json({jobs:jobs.map(publicJob),drafts:data.drafts,enabled:cfg.enabled&&cfg.ownerId===id,
    uploadEnabled:cfg.uploadEnabled&&cfg.ownerId===id,assetsConfigured:Boolean(cfg.assets),dailyJobLimit:cfg.dailyLimit,worker});
});}
export async function POST(request:Request){return endpoint(async()=>{
  const ownerId=await owner(request),value=schema.parse(await jsonBody(request)),repo=new ProductionRepository();
  const cfg=allowOwner(ownerId);
  if(value.action==="generate"){
    const draft=await repo.draft(ownerId,value.draftId) as LearningDraft|null;
    if(!draft||draft.revision!==value.expectedRevision||draft.completedAt)throw new AppError("最新の未完了の台本を指定してください。",409);
    const experiment=await repo.experiment(ownerId,draft.experimentId);
    if(!experiment)throw new AppError("比較計画が見つかりません。",404);
    const source=sourceOf(draft,experiment);
    if(source.conditions.format!=="short"||source.conditions.durationMax>90)throw new AppError("この制作ワーカーは90秒以内の縦型ショートに対応しています。",409);
    if(JSON.stringify(source).length>48000)throw new AppError("制作に渡す根拠を48KB以内に絞ってください。",413);
    return json(publicJob(await repo.add(await makeJob(ownerId,source),cfg.dailyLimit)),201);
  }
  const job=await requiredJob(repo,ownerId,value.id);
  if(job.version!==value.version)throw new AppError("制作状態が更新されています。再表示してください。",409);
  if(value.action==="cancel"){
    if(["uploading","checking","uploaded"].includes(job.stage)||(job.uploadAttempts??0)>0)throw new AppError("送信中・送信済みの動画は取り消せません。状態を確認してください。",409);
    return json(publicJob(await repo.save(job,{...job,stage:"cancelled",approval:undefined,lease:undefined,leaseUntil:undefined})));
  }
  if(value.action==="check"){
    if(!["uploaded","uncertain"].includes(job.stage)||(!job.remote&&!job.uploadAttempts))throw new AppError("アップロードを実行したジョブを指定してください。",409);
    return json(publicJob(await repo.save(job,{...job,stage:"queued_check"})));
  }
  await currentSource(repo,job);
  if(value.action==="edit-plan"){
    if(job.stage!=="planned")throw new AppError("映像制作前の台本だけ編集できます。",409);
    const plan=validatePlan(value.plan,job.source);
    return json(publicJob(await repo.save(job,{...job,plan,planHash:await digest(plan),approval:undefined})));
  }
  if(value.action==="render"){
    if(!cfg.assets)throw new AppError("完成動画のR2保存先を設定してください。",409);
    if(job.stage!=="planned"||!job.plan||job.planHash!==value.planHash)throw new AppError("現在の台本を確認してください。",409);
    return json(publicJob(await repo.save(job,{...job,stage:"queued_render",consentMedia:true})));
  }
  if(value.action==="approve"){
    if(job.stage!=="ready"||job.artifact?.sha256!==value.videoHash)throw new AppError("現在の完成MP4を確認してください。",409);
    const approval=await approvalFor(job,ownerId,value.metadata);
    return json(publicJob(await repo.save(job,{...job,approval,stage:"approved"})));
  }
  if(value.action==="revoke"){
    if(!["approved","queued_upload"].includes(job.stage))throw new AppError("送信前の承認だけ取り消せます。",409);
    return json(publicJob(await repo.save(job,{...job,stage:"ready",approval:undefined})));
  }
  if(value.action==="upload"||value.action==="resume-upload"){
    if(!cfg.uploadEnabled)throw new AppError("アップロードはサーバー側で無効です。",409);
    if(value.action==="upload"&&job.stage!=="approved")throw new AppError("完成動画の承認が必要です。",409);
    if(value.action==="resume-upload"&&(job.stage!=="uncertain"||!job.uploadAttempts))throw new AppError("中断した既存アップロードだけ再開できます。",409);
    await assertApproval(job);
    if(job.approval?.digest!==value.approvalHash)throw new AppError("承認内容が一致しません。",409);
    return json(publicJob(await repo.save(job,{...job,stage:"queued_upload",uploadAttempts:(job.uploadAttempts??0)+1})));
  }
  throw new AppError("操作を確認してください。");
});}
