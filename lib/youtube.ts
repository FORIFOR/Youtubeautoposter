import type { AnalyticsRow } from "./growth";
export type YouTubeConfig = { apiKey: string; channelId: string; clientId: string; clientSecret: string; refreshToken: string };
export class YouTubeError extends Error { retryable: boolean; constructor(public code: string, retryable = false) { super(code); this.retryable = retryable; } }
export function counter(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export function durationSeconds(value: string): number | null {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match) return null;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}
export function pacificDay(value: Date): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
export function addDays(day: string, days: number) { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export type VideoMetadata = { id: string; channelId: string; title: string; publishedAt: string; duration: number; privacy: string; live: string; views: number | null; likes: number | null };
export class YouTubeClient {
  private token: { value: string; until: number } | null = null;
  constructor(readonly config: YouTubeConfig, readonly fetcher: typeof fetch = fetch) {}
  private async call(url: string, init: RequestInit = {}) {
    let response: Response;
    try { response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(12000) }); } catch { throw new YouTubeError("network_error", true); }
    if (!response.ok) {
      let reason = "";
      try { const body = await response.json() as { error?: { errors?: { reason?: string }[] } | string }; reason = typeof body.error === "object" ? body.error.errors?.[0]?.reason ?? "" : body.error ?? ""; } catch { /* HTTP code still identifies the failure. */ }
      throw new YouTubeError(reason === "quotaExceeded" ? "quota_exceeded" : response.status === 401 || reason === "invalid_grant" ? "authorization_required" : `http_${response.status}`, response.status === 429 || response.status >= 500);
    }
    try { return await response.json(); } catch { throw new YouTubeError("invalid_response"); }
  }
  async videoMetadata(ids: string[]): Promise<VideoMetadata[]> {
    if (!this.config.apiKey) throw new YouTubeError("api_key_missing");
    if (!ids.length) return [];
    if (ids.length > 50) throw new YouTubeError("too_many_ids");
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.search = new URLSearchParams({ part: "snippet,contentDetails,status,statistics", id: ids.join(",") }).toString();
    const body = await this.call(url.toString(), { headers: { "X-Goog-Api-Key": this.config.apiKey } }) as { items?: Array<{ id: string; snippet?: { channelId?: string; title?: string; publishedAt?: string; liveBroadcastContent?: string }; contentDetails?: { duration?: string }; status?: { privacyStatus?: string }; statistics?: { viewCount?: string; likeCount?: string } }> };
    if (!Array.isArray(body.items)) throw new YouTubeError("invalid_response");
    return body.items.map(item => {
      const duration = durationSeconds(item.contentDetails?.duration ?? "");
      if (!item.id || !item.snippet?.channelId || !item.snippet?.title || !item.snippet?.publishedAt || !Number.isFinite(Date.parse(item.snippet.publishedAt)) || duration === null || !item.status?.privacyStatus) throw new YouTubeError("invalid_response");
      return { id: item.id, channelId: item.snippet.channelId, title: item.snippet.title, publishedAt: new Date(item.snippet.publishedAt).toISOString(), duration, privacy: item.status.privacyStatus, live: item.snippet.liveBroadcastContent ?? "none", views: counter(item.statistics?.viewCount), likes: counter(item.statistics?.likeCount) };
    });
  }
  private async accessToken() {
    if (this.token && this.token.until > Date.now() + 60000) return this.token.value;
    if (!this.config.clientId || !this.config.clientSecret || !this.config.refreshToken) throw new YouTubeError("authorization_required");
    const body = await this.call("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, refresh_token: this.config.refreshToken, grant_type: "refresh_token" }) }) as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new YouTubeError("invalid_token_response");
    this.token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }
  async dailyAnalytics(videoId: string, youtubeId: string, publishedAt: string, now: Date): Promise<AnalyticsRow[]> {
    const start = pacificDay(new Date(publishedAt));
    const end = [addDays(pacificDay(now), -3), addDays(start, 7)].sort()[0];
    if (end < start) return [];
    const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
    url.search = new URLSearchParams({ ids: `channel==${this.config.channelId}`, startDate: start, endDate: end, dimensions: "day", filters: `video==${youtubeId}`, metrics: "views,engagedViews,averageViewDuration,averageViewPercentage,shares,subscribersGained", sort: "day" }).toString();
    const body = await this.call(url.toString(), { headers: { Authorization: `Bearer ${await this.accessToken()}` } }) as { columnHeaders?: { name: string }[]; rows?: unknown[][] };
    if (!Array.isArray(body.columnHeaders)) throw new YouTubeError("invalid_analytics_response");
    const columns = body.columnHeaders.map(c => c.name);
    if (!columns.includes("day")) throw new YouTubeError("invalid_analytics_response");
    return (body.rows ?? []).map(row => {
      const get = (name: string) => row[columns.indexOf(name)];
      const float = (name: string) => { const v = get(name); return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null; };
      const day = get("day");
      if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < start || day > end) throw new YouTubeError("invalid_analytics_day");
      return { videoId, day, fetchedAt: now.toISOString(), views: counter(get("views")), engagedViews: counter(get("engagedViews")), averageViewDuration: float("averageViewDuration"), averageViewPercentage: float("averageViewPercentage"), shares: counter(get("shares")), subscribersGained: counter(get("subscribersGained")) };
    });
  }
}
