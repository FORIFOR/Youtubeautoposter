import { setTimeout as delay } from "node:timers/promises";
// Local Sites auth is intentionally restricted to loopback by the dev server.
const base = new URL(process.env.STUDIO_URL || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) || base.protocol !== "http:" || base.username || base.password) throw new Error("この収集ツールはローカル版専用です。STUDIO_URLにループバックのURLを指定してください。");
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => controller.abort());
console.log("ローカルの定期収集を開始します。終了は Ctrl+C。画面を閉じても、このプロセスと開発サーバーは起動したままにしてください。");
while (!controller.signal.aborted) {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/api/collect", base), { method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin, Cookie: "__sites_local_auth=1" }, body: "{}", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]) });
    const data = await response.json();
    if (!response.ok) {
      console.error(`収集できませんでした (${response.status}): ${data.error ?? "接続設定を確認してください。"}`);
      if ([401, 403, 409].includes(response.status)) { process.exitCode = 1; break; }
    } else console.log(new Date().toISOString(), data.summary);
  } catch (error) { if (!controller.signal.aborted) console.error("収集先に接続できません。次の周期で再試行します。", error.name); }
  if (process.argv.includes("--once")) break;
  try { await delay(Math.max(1000, 60000 - (Date.now() - started)), undefined, { signal: controller.signal }); } catch { break; }
}
