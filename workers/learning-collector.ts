import { runLearning } from "../lib/learning-runner";
interface Env {
  DB: D1Database;
  LEARNING_ENABLED?: string;
  LEARNING_OWNER_ID?: string;
  YOUTUBE_API_KEY?: string;
  YOUTUBE_CHANNEL_ID?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
}
export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Both deployment and per-experiment opt-in are required. No public trigger.
    if (env.LEARNING_ENABLED !== "true" || !env.LEARNING_OWNER_ID) return;
    const cfg = { apiKey: env.YOUTUBE_API_KEY ?? "", channelId: env.YOUTUBE_CHANNEL_ID ?? "",
      clientId: env.GOOGLE_CLIENT_ID ?? "", clientSecret: env.GOOGLE_CLIENT_SECRET ?? "", refreshToken: env.GOOGLE_REFRESH_TOKEN ?? "" };
    ctx.waitUntil(runLearning(env.LEARNING_OWNER_ID, env.DB, cfg).catch(() => { console.error("learning_worker_failed"); }));
  },
  async fetch() { return new Response("Not found", { status: 404 }); }
};
