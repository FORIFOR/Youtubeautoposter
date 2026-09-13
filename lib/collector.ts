import { CHECKPOINTS, VIEW_DEFINITION, checkpointState, type Observation } from "./growth";
import type { Repository } from "./repository";
import { YouTubeClient, YouTubeError } from "./youtube";
export type CollectorRepository = Pick<Repository, "state" | "observation" | "updateVideo" | "analytics" | "lastAnalyticsAttempt" | "markAnalyticsAttempt" | "acquire" | "release" | "recordRun">;
export async function collect(ownerId: string, repo: CollectorRepository, youtube: YouTubeClient, clock: () => Date = () => new Date()) {
  const started = clock().getTime(), token = crypto.randomUUID();
  if (!await repo.acquire(ownerId, token, started)) return { collected: 0, missed: 0, analyticsDays: 0, errors: [], summary: "収集中、または前回の収集から1分以内です。" };
  let collected = 0, missed = 0, analyticsDays = 0;
  const errors: string[] = [];
  try {
    const data = await repo.state(ownerId);
    const selected = data.videos.filter(v => v.verified && v.channelId === youtube.config.channelId);
    const missing = (videoId: string, checkpoint: string) => !data.observations.some(o => o.videoId === videoId && o.checkpoint === checkpoint);
    async function save(videoId: string, checkpoint: Observation["checkpoint"], status: Observation["status"], views: number | null, likes: number | null, reason: string | null, now: Date) {
      const o: Observation = { id: crypto.randomUUID(), videoId, checkpoint, status, views, likes, reason, observedAt: now.toISOString(), source: "youtube_data", definition: VIEW_DEFINITION };
      if (await repo.observation(ownerId, o)) { data.observations.push(o); if (status === "collected") collected++; else missed++; }
    }
    // Closed windows are irretrievably missing, even when a later view count exists.
    for (const video of selected) for (const c of CHECKPOINTS) {
      if (missing(video.id, c.key) && checkpointState(video.publishedAt, c.key, clock()).state === "missed") await save(video.id, c.key, "missed", null, null, "計測の許容時刻を過ぎました", clock());
    }
    const due = selected.filter(v => CHECKPOINTS.some(c => missing(v.id, c.key) && checkpointState(v.publishedAt, c.key, clock()).state === "due"));
    for (let i = 0; i < due.length && clock().getTime() - started < 45000; i += 50) {
      const batch = due.slice(i, i + 50);
      try {
        const metadata = await youtube.videoMetadata(batch.map(v => v.youtubeId));
        const observedAt = clock();
        for (const v of batch) {
          const actual = metadata.find(m => m.id === v.youtubeId);
          if (!actual) { errors.push(`${v.id}: video_unavailable`); continue; }
          if (actual.privacy !== "public" || actual.channelId !== v.channelId || actual.publishedAt !== v.publishedAt || actual.duration !== v.durationSeconds || actual.live !== "none") {
            await repo.updateVideo(ownerId, { ...v, verified: false });
            errors.push(`${v.id}: publication_changed`); continue;
          }
          if (actual.views === null) { errors.push(`${v.id}: views_unavailable`); continue; }
          for (const c of CHECKPOINTS) {
            if (!missing(v.id, c.key)) continue;
            const state = checkpointState(v.publishedAt, c.key, observedAt).state;
            if (state === "due") await save(v.id, c.key, "collected", actual.views, actual.likes, null, observedAt);
            else if (state === "missed") await save(v.id, c.key, "missed", null, null, "取得の完了時に計測期限を過ぎました", observedAt);
          }
        }
      } catch (e) { errors.push(e instanceof YouTubeError ? e.code : "collection_error"); }
    }
    // Analytics has a separate daily clock. Re-query overlapping days for late revisions.
    if (youtube.config.refreshToken && youtube.config.clientId && youtube.config.clientSecret) {
      const attempts = await Promise.all(selected.map(async v => ({ v, last: await repo.lastAnalyticsAttempt(v.id) })));
      attempts.sort((a, b) => (a.last ?? "").localeCompare(b.last ?? ""));
      for (const { v, last } of attempts) {
        if (clock().getTime() - started >= 45000) break;
        const now = clock(), age = now.getTime() - Date.parse(v.publishedAt);
        if (age < 3 * 86400000 || (last && now.getTime() - Date.parse(last) < 6 * 3600000)) continue;
        // Include one late catch-up for newly registered old videos; finish regular collection at day 14.
        if (age > 14 * 86400000 && last && Date.parse(last) > Date.parse(v.publishedAt) + 14 * 86400000) continue;
        try {
          const rows = await youtube.dailyAnalytics(v.id, v.youtubeId, v.publishedAt, now);
          await repo.analytics(ownerId, rows); analyticsDays += rows.length;
          await repo.markAnalyticsAttempt(v.id, now.toISOString());
        } catch (e) {
          errors.push(`${v.id}: ${e instanceof YouTubeError ? e.code : "analytics_error"}`);
          // Failed reports remain retryable; do not mark them as successfully refreshed.
        }
      }
    }
    const summary = `計測 ${collected}件 / 欠測 ${missed}件 / 日別分析 ${analyticsDays}件${errors.length ? ` / 取得エラー ${errors.length}件（次回再試行）` : ""}`;
    await repo.recordRun(ownerId, summary + (errors.length ? ` [${errors.join(", ")}]` : ""));
    return { collected, missed, analyticsDays, errors, summary };
  } finally { await repo.release(ownerId, token, Math.max(started + 60000, clock().getTime())); }
}
