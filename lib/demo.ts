import { CHECKPOINTS, DEFAULT_CONDITIONS, VIEW_DEFINITION, type StudioData } from "./growth";

export function makeDemo(): StudioData {
  const experiment = { id: "demo-opening", title: "冒頭の見せ方を比べる", channelId: "demo-channel", conditions: DEFAULT_CONDITIONS, factor: "opening" as const, variantA: "質問から始める", variantB: "見せ場を先に出す", minSamples: 4, threshold: 0.2, createdAt: "2026-08-01T00:00:00.000Z" };
  const titles = ["あかいりんご、どこかな？", "ポコと、あおいボール", "まあるいものをさがそう", "きいろいおはなのひみつ", "みつけた！ まっかなりんご", "おはなのとなりのボール", "ポコがみつけた、まあるいもの", "かごいっぱいの、きいろ"];
  const counts = [1120, 1480, 1320, 1280, 1880, 2240, 1960, 2040];
  const videos = titles.map((title, i) => ({ id: `demo-video-${i}`, youtubeId: `demo${String(i).padStart(7, "0")}`, title, channelId: experiment.channelId, publishedAt: new Date(Date.UTC(2026, 7, 10 + i)).toISOString(), contentHash: String(i + 1).repeat(64), durationSeconds: 38, experimentId: experiment.id, variant: i < 4 ? "A" as const : "B" as const, conditions: DEFAULT_CONDITIONS, episode: title, createdAt: experiment.createdAt, verified: true }));
  const observations = videos.flatMap((video, i) => CHECKPOINTS.map((checkpoint, index) => ({ id: `demo-observation-${i}-${checkpoint.key}`, videoId: video.id, checkpoint: checkpoint.key, observedAt: new Date(Date.parse(video.publishedAt) + checkpoint.seconds * 1000).toISOString(), status: "collected" as const, source: "demo" as const, definition: VIEW_DEFINITION, views: Math.round(counts[i] * [0.015, 0.12, 0.65, 1, 1.2][index]), likes: Math.round(counts[i] * .027), reason: null })));
  const analytics = videos.map((v, i) => ({ videoId: v.id, day: v.publishedAt.slice(0, 10), fetchedAt: "2026-09-01T00:00:00.000Z", views: counts[i], engagedViews: Math.round(counts[i] * .64), averageViewDuration: 27 + i % 4, averageViewPercentage: (27 + i % 4) / 38 * 100, shares: 4 + i, subscribersGained: 2 + i % 3 }));
  return { experiments: [experiment], videos, observations, analytics, drafts: [] };
}
