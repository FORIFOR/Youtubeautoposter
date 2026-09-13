import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, chmod, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
try { process.loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error(".envにデスクトップアプリのGOOGLE_CLIENT_IDとGOOGLE_CLIENT_SECRETを設定してください。");
const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url"), challenge = createHash("sha256").update(verifier).digest("base64url");
let redirectUri = "", processing = false;
const timer = setTimeout(() => { console.error("認可がタイムアウトしました。もう一度実行してください。"); server.close(); process.exitCode = 1; }, 300000);
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", redirectUri);
  if (url.pathname !== "/oauth/youtube") { res.writeHead(404).end(); return; }
  res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
  const incoming = url.searchParams.get("state") ?? "";
  if (Buffer.byteLength(incoming) !== Buffer.byteLength(state) || !timingSafeEqual(Buffer.from(incoming), Buffer.from(state))) { res.writeHead(400).end("認可の状態を確認できませんでした。"); return; }
  if (processing) { res.writeHead(409).end("認可を処理中です。"); return; }
  processing = true;
  try {
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) throw new Error("読み取りの認可が完了しませんでした。");
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: "authorization_code" }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("認可トークンを交換できませんでした。Googleのクライアント設定を確認してください。");
    const token = await response.json();
    if (!token.refresh_token) throw new Error("更新トークンが返りませんでした。Googleアカウントのアプリ認可を確認し、再実行してください。");
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000) });
    if (!channelResponse.ok) throw new Error("自分のYouTubeチャンネルを確認できませんでした。");
    const channels = await channelResponse.json();
    const channelId = channels.items?.[0]?.id;
    if (!channelId || !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error("YouTubeチャンネルが見つかりません。");
    if (process.env.YOUTUBE_CHANNEL_ID && channelId !== process.env.YOUTUBE_CHANNEL_ID) throw new Error("設定したチャンネルと認可したチャンネルが異なります。正しいアカウントでやり直してください。");
    let existing = ""; try { existing = await readFile(".env", "utf8"); } catch (e) { if (e.code !== "ENOENT") throw e; }
    const updates = { GOOGLE_REFRESH_TOKEN: token.refresh_token, YOUTUBE_CHANNEL_ID: channelId };
    for (const [key, value] of Object.entries(updates)) { const line = `${key}=${JSON.stringify(value)}`; const pattern = new RegExp(`^${key}=.*$`, "m"); existing = pattern.test(existing) ? existing.replace(pattern, () => line) : `${existing.trimEnd()}\n${line}\n`; }
    await writeFile(".env.oauth-tmp", existing, { mode: 0o600 }); await chmod(".env.oauth-tmp", 0o600); await rename(".env.oauth-tmp", ".env");
    console.log("認可が完了しました。更新トークンを.envに保存しました。開発サーバーを再起動してください。");
    res.end("認可が完了しました。この画面を閉じ、Growth Studioへ戻ってください。");
  } catch (error) { console.error(error.message); res.writeHead(400).end(error.message); process.exitCode = 1; }
  finally { clearTimeout(timer); server.close(); }
});
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}/oauth/youtube`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly", access_type: "offline", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  console.log("ブラウザーで自分のチャンネルの読み取りを許可してください。開かない場合の認可URL:\n" + url);
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? null : "xdg-open";
  if (command) { const child = spawn(command, [url.toString()], { stdio: "ignore" }); child.on("error", () => {}); }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { clearTimeout(timer); server.close(); });
