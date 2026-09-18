import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { Repository } from "@/lib/repository";
import { config } from "@/lib/config";
import { runLearning } from "@/lib/learning-runner";
export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request); await jsonBody(request);
  const cfg = config();
  if (!cfg.apiKey || !cfg.channelId) throw new AppError("YouTube APIキーとチャンネルIDを設定してください。", 409);
  return json(await runLearning(ownerId, new Repository().db, cfg, true));
}); }
