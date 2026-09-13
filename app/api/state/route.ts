import { endpoint, json, owner } from "@/lib/http";
import { config } from "@/lib/config";
import { Repository } from "@/lib/repository";
export async function GET(request: Request) { return endpoint(async () => {
  const ownerId = await owner(request), repo = new Repository(), cfg = config();
  const [data, lastRun] = await Promise.all([repo.state(ownerId), repo.lastRun(ownerId)]);
  return json({ data, connection: { dataApi: Boolean(cfg.apiKey && cfg.channelId), analytics: Boolean(cfg.refreshToken && cfg.clientId && cfg.clientSecret && cfg.channelId), channelId: cfg.channelId || null, lastRun } });
}); }
