import { AppError, endpoint, json, jsonBody, owner } from "@/lib/http";
import { experimentInput } from "@/lib/validation";
import { Repository } from "@/lib/repository";
import { config } from "@/lib/config";
export async function POST(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), input = experimentInput.parse(await jsonBody(request)), repo = new Repository();
  if (config().channelId && config().channelId !== input.channelId) throw new AppError("設定したYouTubeチャンネルと一致しません。");
  const experiment = { ...input, factor: "opening" as const, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await repo.addExperiment(ownerId, experiment);
  return json(experiment, 201);
}); }
