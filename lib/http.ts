import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ZodError } from "zod";
export class AppError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export async function owner(request: Request) {
  const user = await getChatGPTUser();
  if (!user) throw new AppError("保存・計測にはサインインが必要です。", 401);
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new AppError("このサイトから操作してください。", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("JSON形式で送信してください。", 415);
  }
  return user.userId;
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 65536) throw new AppError("入力が大きすぎます。", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("入力がありません。");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 65536) { await reader.cancel(); throw new AppError("入力が大きすぎます。", 413); } chunks.push(value); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new AppError("入力のJSONを確認してください。"); }
}
export const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
export async function endpoint(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: `入力内容を確認してください：${error.issues.map(i => `${i.path.join(".")} ${i.message}`).join("、")}` }, 400);
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) return json({ error: "この動画または記録はすでに登録されています。" }, 409);
    // Never return upstream URLs, credentials or raw storage diagnostics to the browser.
    console.error("growth_request_failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "保存先または接続先でエラーが発生しました。入力を残したまま再試行してください。" }, 503);
  }
}
