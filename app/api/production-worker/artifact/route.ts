import { z } from "zod";
import { AppError,endpoint,json } from "@/lib/http";
import { digest } from "@/lib/learning";
import { assertLease,identifier } from "@/lib/production/domain";
import { ProductionRepository } from "@/lib/production/repository";
import { workerOwner } from "@/lib/production/environment";
import { currentSource,requiredJob } from "@/lib/production/service";
const MAX=48*1024*1024;
const infoSchema=z.object({duration:z.number().min(1).max(90),width:z.literal(1080),height:z.literal(1920),profile:z.string().min(1).max(500)}).strict();
export async function PUT(request:Request){return endpoint(async()=>{
  const {ownerId,cfg}=await workerOwner(request);
  if(!cfg.enabled||!cfg.assets)throw new AppError("動画保存先が未設定または停止中です。",409);
  const id=identifier.parse(new URL(request.url).searchParams.get("id")),lease=identifier.parse(request.headers.get("x-job-lease"));
  const repo=new ProductionRepository(),job=await requiredJob(repo,ownerId,id);
  assertLease(job,lease);await currentSource(repo,job);
  if(job.stage!=="rendering"||!job.consentMedia||!job.planHash)throw new AppError("動画制作の実行権限がありません。",409);
  const header=request.headers.get("x-artifact-info")??"";
  if(header.length>2000)throw new AppError("動画情報が大きすぎます。",413);
  const info=infoSchema.parse(JSON.parse(header));
  if(info.duration<job.source.conditions.durationMin||info.duration>job.source.conditions.durationMax)throw new AppError("完成動画の尺が比較条件と一致しません。",409);
  if(request.headers.get("content-type")!=="video/mp4"||Number(request.headers.get("content-length")??0)>MAX)throw new AppError("MP4は48MB以内にしてください。",413);
  const reader=request.body?.getReader();if(!reader)throw new AppError("MP4がありません。");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX){await reader.cancel();throw new AppError("MP4は48MB以内にしてください。",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(size<12||new TextDecoder().decode(bytes.slice(4,8))!=="ftyp")throw new AppError("MP4の形式を確認できませんでした。");
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
  const key=`production/${await digest(ownerId)}/${id}/${sha256}.mp4`;
  await cfg.assets.put(key,bytes,{httpMetadata:{contentType:"video/mp4"},customMetadata:{sha256,planHash:job.planHash}});
  const latest=await requiredJob(repo,ownerId,id);assertLease(latest,lease);await currentSource(repo,latest);
  return json(await repo.save(latest,{...latest,stage:"ready",lease:undefined,leaseUntil:undefined,
    artifact:{key,sha256,size,...info,planHash:job.planHash,createdAt:new Date().toISOString()}}));
});}
export async function GET(request:Request){return endpoint(async()=>{
  const {ownerId,cfg}=await workerOwner(request),id=identifier.parse(new URL(request.url).searchParams.get("id")),lease=identifier.parse(request.headers.get("x-job-lease"));
  const job=await requiredJob(new ProductionRepository(),ownerId,id);assertLease(job,lease);
  if(!["uploading","checking"].includes(job.stage)||!cfg.assets||!job.artifact)throw new AppError("このジョブの完成動画を取得できません。",409);
  const object=await cfg.assets.get(job.artifact.key);if(!object)throw new AppError("完成動画がありません。",404);
  return new Response(object.body,{headers:{"Content-Type":"video/mp4","Content-Length":String(object.size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
});}
