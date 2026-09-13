import { env } from "cloudflare:workers";
export function config() {
  const values = env as unknown as Record<string, string | undefined>;
  const get = (name: string) => values[name] || process.env[name] || "";
  return { apiKey: get("YOUTUBE_API_KEY"), channelId: get("YOUTUBE_CHANNEL_ID"), clientId: get("GOOGLE_CLIENT_ID"), clientSecret: get("GOOGLE_CLIENT_SECRET"), refreshToken: get("GOOGLE_REFRESH_TOKEN") };
}
