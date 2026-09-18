import { AppError,endpoint,owner } from "@/lib/http";
import { productionEnvironment } from "@/lib/production/environment";
import { ProductionRepository } from "@/lib/production/repository";
import { videoRange } from "@/lib/production/domain";
import { requiredJob } from "@/lib/production/service";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){return endpoint(async()=>{
  const ownerId=await owner(request),{id}=await context.params,job=await requiredJob(new ProductionRepository(),ownerId,id),cfg=productionEnvironment();
  if(!cfg.assets||!job.artifact)throw new AppError("完成動画がまだありません。",404);
  let range: ReturnType<typeof videoRange>;
  try { range=videoRange(request.headers.get("range"),job.artifact.size); }
  catch { return new Response(null,{status:416,headers:{"Content-Range":`bytes */${job.artifact.size}`}}); }
  const object=await cfg.assets.get(job.artifact.key,range?{range}:undefined);
  if(!object)throw new AppError("動画を読み込めません。",404);
  const headers=new Headers({"Content-Type":"video/mp4","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes","ETag":`"${job.artifact.sha256}"`});
  const selected=object.range as {offset?:number;length?:number}|undefined;
  if(range&&selected?.offset!==undefined&&selected.length!==undefined){
    headers.set("Content-Range",`bytes ${selected.offset}-${selected.offset+selected.length-1}/${object.size}`);
    headers.set("Content-Length",String(selected.length));return new Response(object.body,{status:206,headers});
  }
  headers.set("Content-Length",String(object.size));return new Response(object.body,{headers});
});}
