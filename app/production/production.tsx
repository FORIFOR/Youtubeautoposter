"use client";
import { useCallback,useEffect,useState } from "react";
import type { Draft } from "@/lib/growth";
import { DISCLOSURE,type Job,type Metadata } from "@/lib/production/domain";
import "./production.css";
type State={jobs:Job[];drafts:Draft[];enabled:boolean;uploadEnabled:boolean;assetsConfigured:boolean;dailyJobLimit:number;
  worker:{lastSeen?:string;text?:boolean;media?:boolean;upload?:boolean;profile?:string}|null};
const labels:Record<string,string>={queued_plan:"台本生成の待機中",planning:"台本を生成中",planned:"台本を確認",queued_render:"動画制作の待機中",rendering:"素材生成・映像合成中",ready:"完成動画を確認",approved:"アップロードの承認済み",queued_upload:"アップロード待機中",uploading:"YouTubeへ送信中",uploaded:"アップロード済み",queued_check:"状態確認の待機中",checking:"YouTubeの状態を確認中",uncertain:"中断・結果を要確認",failed:"失敗・自動再試行なし",cancelled:"取り消し済み"};
async function api(body?:unknown):Promise<State>{
  const r=await fetch("/api/production",{method:body===undefined?"GET":"POST",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  const v=await r.json() as State&{error?:string};if(!r.ok)throw new Error(v.error||"処理に失敗しました");return v;
}
export default function Production(){
  const [state,setState]=useState<State|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[selected,setSelected]=useState(""),[consent,setConsent]=useState(false);
  const refresh=useCallback(async()=>{try{setState(await api());}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[refresh]);
  async function act(body:unknown){if(busy)return;setBusy(true);setError("");try{await api(body);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const draft=state?.drafts.find(d=>d.id===selected)??state?.drafts[0];
  const online=Boolean(state?.worker?.lastSeen&&Date.now()-Date.parse(state.worker.lastSeen)<120000);
  return <main className="production"><header><a href="/workflow">← 制作・改善フロー</a><span>Growth Studio / PRODUCTION</span></header>
    <h1>原稿から、確認できる一本へ。</h1><p>生成、完成動画の確認、アップロードを分けて進めます。AI生成音声の開示文は説明欄に付きます。</p>
    {error&&<div role="alert" className="production-error">{error} <button onClick={()=>void refresh()}>再読み込み</button></div>}
    {!state?<p>読み込み中… 保存には<a href="/signin-with-chatgpt?return_to=/production">サインイン</a>が必要です。</p>:<>
      <section className="production-status"><strong>{online?"動画を作る準備ができています":"動画制作の準備を確認してください"}</strong><p>{online?"下書きを選んで、そのまま作成を始められます。":"初回だけ接続設定が必要です。設定済みの場合は少し待ってから再読み込みしてください。"}</p><details><summary>詳細設定・接続状況</summary><p>台本 {state.worker?.text?"設定あり":"未設定"} / 画像・音声 {state.worker?.media?"設定あり":"未設定"} / 動画保存 {state.assetsConfigured?"設定あり":"未設定"} / アップロード {state.uploadEnabled?"許可あり":"停止中"}</p><small>新規制作は1日{state.dailyJobLimit}件まで（UTC）。設定済み表示は実API接続の成功を意味しません。</small></details></section>
      <section><h2>01　根拠から台本を書く</h2><label>元の下書き<select value={draft?.id??""} onChange={e=>setSelected(e.target.value)}><option value="" disabled>下書きを選択</option>{state.drafts.map(d=><option value={d.id} key={d.id}>{d.title}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>AIで台本を作る（外部AIを利用するため料金が発生する場合があります）</label>
        <button disabled={busy||!draft||!consent||!state.enabled} onClick={()=>draft&&void act({action:"generate",draftId:draft.id,expectedRevision:draft.revision,consentExternal:true,consentCost:true})}>この内容で台本を作る</button>
        <details><summary>詳しい動作</summary><small>同じ版からの重複要求は再生成しません。作り直す場合は元の下書きを編集してください。</small></details></section>
      {state.jobs.map(job=><JobCard key={job.id} job={job} busy={busy} uploadEnabled={state.uploadEnabled} act={act}/>)}
    </>}
  </main>;
}
function JobCard({job,busy,uploadEnabled,act}:{job:Job;busy:boolean;uploadEnabled:boolean;act:(body:unknown)=>Promise<void>}){
  const [media,setMedia]=useState(false),[review,setReview]=useState(false),[rights,setRights]=useState(false),[upload,setUpload]=useState(false),[editing,setEditing]=useState(false),[editedPlan,setEditedPlan]=useState(job.plan),[localError,setLocalError]=useState("");
  const [metadata,setMetadata]=useState<Metadata>({title:job.plan?.title??job.source.title,description:(job.plan?.description??"")+"\n\n"+DISCLOSURE,privacy:"private",madeForKids:job.source.conditions.audience==="kids",containsSyntheticMedia:true});
  useEffect(()=>{setReview(false);setRights(false);setUpload(false);},[job.artifact?.sha256,job.planHash,job.approval?.digest]);
  useEffect(()=>{if(job.plan){setMetadata(m=>({...m,title:job.plan!.title,description:job.plan!.description+"\n\n"+DISCLOSURE}));setEditedPlan(job.plan);setEditing(false);}},[job.planHash]);
  const send=(action:string,extra:Record<string,unknown>={})=>act({action,id:job.id,version:job.version,...extra});
  return <section className="production-job"><div className="production-job-heading"><h2>{job.plan?.title??job.source.title}</h2><strong>{labels[job.stage]}</strong></div><small>元の下書き 第{job.source.draftRevision}版</small><details className="technical"><summary>技術情報</summary><small>投稿先：{job.source.channelId}</small></details>
    {job.error&&<p role="alert">{job.error} — 元の内容や送信結果を確認してください。自動再生成・再投稿はしていません。</p>}
    {job.plan&&<details open={job.stage==="planned"}><summary>02　台本・場面・変更理由</summary><p>{job.plan.rationale}</p>{job.plan.scenes.map((s,i)=><div key={i} className="scene"><strong>場面 {i+1}</strong><p>{s.narration}</p><small>字幕：{s.caption}</small><p className="muted">画像指示：{s.imagePrompt}</p></div>)}{job.plan.caveats.map((c,i)=><p className="muted" key={i}>{c}</p>)}</details>}
    {job.stage==="planned"&&<><button disabled={busy} onClick={()=>setEditing(!editing)}>{editing?"編集を閉じる":"台本を編集"}</button>{editing&&editedPlan&&<div className="scene-editor"><label>動画タイトル<input value={editedPlan.title} maxLength={100} onChange={e=>setEditedPlan({...editedPlan,title:e.target.value})}/></label><label>動画の説明<textarea rows={3} value={editedPlan.description} onChange={e=>setEditedPlan({...editedPlan,description:e.target.value})}/></label>{editedPlan.scenes.map((scene,i)=><div className="scene-card" key={i}><div className="scene-number">シーン {i+1}</div><label>ナレーション<textarea rows={3} value={scene.narration} onChange={e=>setEditedPlan({...editedPlan,scenes:editedPlan.scenes.map((s,n)=>n===i?{...s,narration:e.target.value}:s)})}/></label><label>画面の字幕<input value={scene.caption} maxLength={70} onChange={e=>setEditedPlan({...editedPlan,scenes:editedPlan.scenes.map((s,n)=>n===i?{...s,caption:e.target.value}:s)})}/></label><details><summary>画像の雰囲気も調整する</summary><textarea rows={3} aria-label={`シーン${i+1}の画像指示`} value={scene.imagePrompt} onChange={e=>setEditedPlan({...editedPlan,scenes:editedPlan.scenes.map((s,n)=>n===i?{...s,imagePrompt:e.target.value}:s)})}/></details></div>)}<button disabled={busy} onClick={()=>{setLocalError("");void send("edit-plan",{plan:editedPlan});}}>変更を保存</button></div>}{localError&&<p role="alert">{localError}</p>}
      <label className="check"><input type="checkbox" checked={media} onChange={e=>setMedia(e.target.checked)}/>台本を確認し、最大6画像と6音声の外部生成費用・映像合成を許可する</label><button disabled={busy||!media||editing} onClick={()=>void send("render",{planHash:job.planHash,confirmedScript:true,consentExternal:true,consentCost:true})}>画像・音声・字幕から動画を制作</button></>}
    {job.artifact&&<><h3>03　完成した映像と音声を確認</h3><video controls preload="metadata" src={`/api/production/${job.id}/video`} aria-label="完成MP4の確認"/><small>{job.artifact.duration.toFixed(1)}秒の縦動画</small><details className="technical"><summary>動画の技術情報</summary><small>SHA-256：{job.artifact.sha256}<br/>{job.artifact.width}×{job.artifact.height} · {job.artifact.profile}</small></details></>}
    {job.stage==="ready"&&<div className="metadata"><label>タイトル<input value={metadata.title} maxLength={100} onChange={e=>setMetadata({...metadata,title:e.target.value})}/></label><label>説明<textarea rows={5} value={metadata.description} onChange={e=>setMetadata({...metadata,description:e.target.value})}/></label>
      <label>公開範囲<select value={metadata.privacy} onChange={e=>setMetadata({...metadata,privacy:e.target.value as Metadata["privacy"]})}><option value="private">非公開</option><option value="unlisted">限定公開</option><option value="public">一般公開</option></select></label><p>子ども向け：{metadata.madeForKids?"はい（比較計画と一致）":"いいえ（比較計画と一致）"}</p>
      <label className="check"><input type="checkbox" checked={metadata.containsSyntheticMedia} onChange={e=>setMetadata({...metadata,containsSyntheticMedia:e.target.checked})}/>YouTubeの「改変・合成コンテンツ」として申告する</label>
      <label className="check"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/>完成MP4を再生し、映像・音声・字幕を確認した</label><label className="check"><input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/>素材の権利、事実関係、対象年齢、公開範囲を確認した</label>
      <button disabled={busy||!review||!rights} onClick={()=>void send("approve",{videoHash:job.artifact?.sha256,metadata,reviewedVideoAndAudio:true,rightsConfirmed:true})}>この動画でOK</button></div>}
    {job.approval&&<div><h3>04　YouTubeに公開</h3><p>{job.approval.metadata.title} / {job.approval.metadata.privacy}</p><small>承認期限：{new Date(job.approval.expiresAt).toLocaleString("ja-JP")}</small>
      {(job.stage==="approved"||job.stage==="uncertain")&&<><label className="check"><input type="checkbox" checked={upload} onChange={e=>setUpload(e.target.checked)}/>上記の投稿先・公開範囲でYouTubeへ送信する</label><button disabled={busy||!upload||!uploadEnabled||Date.parse(job.approval.expiresAt)<=Date.now()} onClick={()=>void send(job.stage==="uncertain"?"resume-upload":"upload",{approvalHash:job.approval?.digest,confirmed:true})}>{job.stage==="uncertain"?"前回の送信を確認して再開":"YouTubeに公開"}</button></>}
      {["approved","queued_upload"].includes(job.stage)&&<button disabled={busy} onClick={()=>void send("revoke")}>送信前の承認を取り消す</button>}</div>}
    {job.remote&&<p><a href={`https://www.youtube.com/watch?v=${job.remote.id}`} target="_blank" rel="noreferrer">アップロード動画を開く</a> · 実際の公開範囲：{job.remote.privacy} · {job.remote.processed?"処理完了":"YouTubeで処理中"} {job.registeredVideoId?"/ 計測対象へ登録済み":"/ 一般公開・処理完了後に計測へ登録"}</p>}
    {["uploaded","uncertain"].includes(job.stage)&&Boolean(job.remote||job.uploadAttempts)&&<button disabled={busy} onClick={()=>void send("check")}>新規投稿せずに送信結果を照合</button>}
    {!["uploaded","uploading","checking","cancelled"].includes(job.stage)&&!(job.uploadAttempts??0)&&<button className="quiet" disabled={busy} onClick={()=>void send("cancel")}>この制作を取り消す</button>}
  </section>;
}
