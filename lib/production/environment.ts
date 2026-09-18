import { env } from "cloudflare:workers";
import { AppError } from "../http";
export function productionEnvironment() {
  const bindings=env as unknown as Record<string,unknown>;
  const read=(name:string)=>String(bindings[name]??process.env[name]??"");
  const limit=Number(read("PRODUCTION_DAILY_JOB_LIMIT")||"3");
  return {enabled:read("PRODUCTION_ENABLED")==="true",uploadEnabled:read("PRODUCTION_UPLOAD_ENABLED")==="true",
    ownerId:read("PRODUCTION_OWNER_ID"),token:read("PRODUCTION_WORKER_TOKEN"),
    dailyLimit:Number.isInteger(limit)&&limit>=1&&limit<=20?limit:0,
    assets:bindings.PRODUCTION_ASSETS as R2Bucket|undefined};
}
export function allowOwner(ownerId:string) {
  const cfg=productionEnvironment();
  if (!cfg.enabled||!cfg.ownerId||cfg.ownerId!==ownerId||!cfg.dailyLimit) throw new AppError("制作機能をサーバー側で設定してください。",409);
  return cfg;
}
export async function workerOwner(request:Request) {
  const cfg=productionEnvironment(),value=request.headers.get("authorization")??"";
  if (!cfg.token||cfg.token.length<32||!cfg.ownerId) throw new AppError("ワーカーは未設定です。",503);
  const bytes=async(s:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
  const a=await bytes(value),b=await bytes(`Bearer ${cfg.token}`);
  let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  if (difference) throw new AppError("ワーカー認証に失敗しました。",401);
  return {ownerId:cfg.ownerId,cfg};
}
