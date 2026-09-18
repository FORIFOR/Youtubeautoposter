"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { StudioData, Video } from "@/lib/growth";
import { DEFAULT_POLICY, type LearningDraft, type Policy, type diagnoseExperiment } from "@/lib/learning";

type State = { ownerId: string; data: StudioData; policies: Record<string, Policy>;
  runtime: { summary?: string; finishedAt?: string; lastSuccessfulObservation?: string; blocked?: boolean } | null;
  dataApiConfigured: boolean; experiments: { id: string; diagnosis: ReturnType<typeof diagnoseExperiment> }[] };
async function call<T>(body?: unknown, path = "/api/learning", method = "POST"): Promise<T> {
  const r = await fetch(path, { method: body === undefined ? "GET" : method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || `処理に失敗しました (${r.status})`);
  return value as T;
}
function download(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workflow() {
  const [state, setState] = useState<State | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [selected, setSelected] = useState(""), [notice, setNotice] = useState("");
  const refresh = useCallback(async () => { const data = await call<State>(); setState(data); }, []);
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [refresh]);
  const perform = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await fn(); await refresh(); setNotice("保存しました。実際の公開操作は行っていません。"); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const experiment = state?.data.experiments.find(e => e.id === selected) ?? state?.data.experiments[0];
  const policy = (experiment && state?.policies[experiment.id]) || DEFAULT_POLICY;
  const diagnosis = state?.experiments.find(e => e.id === experiment?.id)?.diagnosis;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    await perform(() => call({ action: "draft", experimentId: experiment?.id, title: values.get("title"), variant: values.get("variant") }));
  }
  return <div className="flow-shell"><header><a href="/">Growth Studio</a><a href="/">動画登録・比較計画・従来の分析画面へ</a></header><main>
    <p className="flow-eyebrow">CREATE → OBSERVE → NEXT EPISODE</p><h1>次の一本まで、根拠をつなぐ。</h1>
    <p>初期下書きから、計測、次の検証案へ。データがなくても企画を始められます。</p>
    <div className="flow-toolbar"><button disabled={busy} onClick={() => void perform(refresh)}>表示を更新</button><a href="/signin-with-chatgpt?return_to=/workflow" target="_top">サインイン</a></div>
    {error && <p role="alert" className="flow-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!state ? <p>サインイン状態と保存先を確認しています。接続できない場合は、表示されたエラーを確認してください。</p> : <>
      <section className="flow-panel"><h2>01 企画と観測の設定</h2>
        {!experiment ? <p>最初に<a href="/">比較計画を作成</a>してください。実測0件でも下書きを作成できます。</p> : <>
          <label>比較計画<select aria-label="比較計画" value={experiment.id} onChange={e => setSelected(e.target.value)}>{state.data.experiments.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
          <p>{diagnosis?.action}</p><div className="flow-toolbar">
            <button disabled={busy} onClick={() => void perform(() => call({ action: "policy", experimentId: experiment.id, ...policy, enabled: !policy.enabled }))}>{policy.enabled ? "定期計測を停止" : "定期計測を許可"}</button>
            <button disabled={busy} onClick={() => void perform(() => call({ action: "policy", experimentId: experiment.id, ...policy, autoDraft: !policy.autoDraft }))}>{policy.autoDraft ? "次案の自動作成を停止" : "実測から次案を自動作成"}</button>
            <button disabled={busy || !state.dataApiConfigured} onClick={() => void perform(() => call({ action: "run" }))}>今すぐ計測・改善</button>
          </div><p className="flow-muted">定期計測：{policy.enabled ? "許可済み" : "停止"} ／ 次案自動作成：{policy.autoDraft ? "許可済み" : "停止"}。稼働には同じDBへ接続する常時ワーカーの設定が必要です。許可だけでは起動しません。</p>
          <form onSubmit={create} className="flow-form"><label>次のエピソード<input name="title" required maxLength={150} placeholder="今回、視聴者に届ける一つのテーマ" /></label><label>検証する冒頭<select name="variant"><option value="A">A · {experiment.variantA}</option><option value="B">B · {experiment.variantB}</option></select></label><button className="flow-primary" disabled={busy}>探索用の下書きを作成</button></form>
        </>}
      </section>
      <section className="flow-panel"><h2>02 計測の稼働状態</h2><p>{state.runtime?.summary ?? "計測実行の記録はまだありません。設定済みと接続成功は別です。"}</p><p>最後に成功した実測：{state.runtime?.lastSuccessfulObservation ?? diagnosis?.lastSuccessfulObservation ?? "まだありません"}</p>
        <p>API設定：{state.dataApiConfigured ? "設定済み（成功未確認を含む）" : "未設定"} ／ 認証・課金等で停止：{state.runtime?.blocked ? "はい。設定を修正して手動再試行してください" : "いいえ"}</p>
        {diagnosis?.analyticsAvailable && <details><summary>日別の視聴時間・共有・登録の実測</summary><pre>{JSON.stringify(diagnosis.analytics, null, 2)}</pre></details>}
        <details><summary>常時ワーカー用の利用者ID</summary><code>{state.ownerId}</code><p>ワーカーのLEARNING_OWNER_IDに設定する値です。秘密の認証情報ではありません。</p></details>
      </section>
      <section><h2>03 台本 → 制作 → 公開動画との関連付け</h2><p className="flow-muted">自動作成は1計画あたり24時間に1件、未完了は2件まで。公開や有料生成は自動実行しません。</p>
        {(state.data.drafts as LearningDraft[]).filter(d => !experiment || d.experimentId === experiment.id).map(d => <DraftPanel key={`${d.id}:${d.revision}`} draft={d} videos={state.data.videos} busy={busy} perform={perform} />)}
        {!state.data.drafts.length && <p>下書きはまだありません。上のフォームから最初の一本を始められます。</p>}
      </section>
    </>}
    <aside className="flow-panel"><h2>観測と公開判断は分けます</h2><p>数値不足は成功を断定しない理由であって、企画を止める理由ではありません。下書きはテンプレートで、LLM執筆・画像生成・映像合成を実行した結果ではありません。制作パッケージを書き出した後、完成MP4を別途確認してYouTube Studioから公開します。</p></aside>
  </main></div>;
}
function DraftPanel({ draft: d, videos, busy, perform }: { draft: LearningDraft; videos: Video[]; busy: boolean; perform: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [script, setScript] = useState(d.script), [videoId, setVideoId] = useState(""), [confirmed, setConfirmed] = useState(false);
  const changed = script !== d.script;
  const options = videos.filter(v => v.verified && v.experimentId === d.experimentId && (!d.plannedVariant || v.variant === d.plannedVariant));
  return <article className="flow-panel"><span className="flow-tag">{d.completedAt ? "公開動画と関連付け済み" : d.mode === "retest" ? "再検証用" : "未検証の探索・観察案"}</span><h3>{d.title}</h3><p>冒頭案 {d.plannedVariant || "未指定"} ／ 台本 {d.status === "reviewed" ? "確認済み" : "確認前"} ／ 第{d.revision}版</p>
    <label>台本<textarea aria-label={`${d.title}の台本`} value={script} rows={9} disabled={busy || Boolean(d.completedAt)} onChange={e => setScript(e.target.value)} /></label>
    <div className="flow-toolbar"><button disabled={busy || !changed || Boolean(d.completedAt)} onClick={() => void perform(() => call({ script, expectedRevision: d.revision }, `/api/drafts/${d.id}`, "PATCH"))}>台本を保存</button>
      <button disabled={busy || changed || d.status === "reviewed" || Boolean(d.completedAt)} onClick={() => void perform(() => call({ status: "reviewed", expectedRevision: d.revision }, `/api/drafts/${d.id}`, "PATCH"))}>保存した台本を確認済みにする</button>
      <button disabled={busy || changed || d.status !== "reviewed"} onClick={() => void perform(async () => download(await call({ action: "package", draftId: d.id, expectedRevision: d.revision }), `production-${d.id}.json`))}>制作パッケージを書き出す</button>
    </div>
    {!d.completedAt && d.status === "reviewed" && <details><summary>制作・公開後、この下書きと動画を結び付ける</summary><p><a href="/">公開動画を登録</a>してから、同じ比較計画・冒頭案の動画を選択してください。素材の一致はあなたの確認として記録され、機械的な一致証明とは扱いません。</p>
      <label>登録済みの公開動画<select value={videoId} onChange={e => {setVideoId(e.target.value);setConfirmed(false);}}><option value="">動画を選択</option>{options.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
      <label className="flow-checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />この台本から制作した動画であることを確認しました</label>
      <button disabled={busy || changed || !videoId || !confirmed} onClick={() => void perform(() => call({ action: "complete", draftId: d.id, videoId, expectedRevision: d.revision, confirmed: true }))}>関連付けを保存し、次の計測へ</button>
    </details>}
    <details><summary>この台本に引き継いだ根拠</summary><pre>{JSON.stringify(d.evidence, null, 2)}</pre></details>
  </article>;
}
