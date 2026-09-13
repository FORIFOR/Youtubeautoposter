import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { videoInput, youtubeId } from "@/lib/validation";
import { Repository } from "@/lib/repository";
import { config } from "@/lib/config";
import { YouTubeClient, YouTubeError } from "@/lib/youtube";
export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), input = videoInput.parse(await jsonBody(request)), repo = new Repository();
  const experiment = await repo.experiment(ownerId, input.experimentId);
  if (!experiment) throw new AppError("比較計画が見つかりません。", 404);
  const id = youtubeId(input.youtubeUrl);
  if (!id) throw new AppError("正しいYouTube動画のURLまたは動画IDを入力してください。");
  const cfg = config();
  if (!cfg.apiKey || !cfg.channelId) throw new AppError("接続設定にYouTube APIキーとチャンネルIDを設定してください。", 409);
  if (cfg.channelId !== experiment.channelId) throw new AppError("比較計画と接続したチャンネルが一致しません。");
  let actual;
  try { actual = (await new YouTubeClient(cfg).videoMetadata([id]))[0]; }
  catch (e) { throw new AppError(`YouTubeから動画を確認できませんでした（${e instanceof YouTubeError ? e.code : "接続エラー"}）。`, 502); }
  if (!actual || actual.privacy !== "public") throw new AppError("一般公開された動画が見つかりません。公開状態を確認してください。");
  if (actual.channelId !== experiment.channelId) throw new AppError("この動画は比較計画のチャンネルと一致しません。");
  if (actual.live !== "none" || actual.duration <= 0 || Date.parse(actual.publishedAt) > Date.now()) throw new AppError("公開が完了した録画動画を登録してください。");
  if (actual.duration < experiment.conditions.durationMin || actual.duration > experiment.conditions.durationMax) throw new AppError("動画の尺が比較計画の範囲と一致しません。");
  const video = { id: crypto.randomUUID(), youtubeId: id, title: actual.title, channelId: actual.channelId, publishedAt: actual.publishedAt, durationSeconds: actual.duration, contentHash: input.contentHash, experimentId: experiment.id, variant: input.variant, conditions: experiment.conditions, episode: input.episode, createdAt: new Date().toISOString(), verified: true };
  await repo.addVideo(ownerId, video);
  return json(video, 201);
}); }
