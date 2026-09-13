/** Pure domain rules, shared by the API, demo and tests. */
export const CHECKPOINTS = [
  { key: "15m", label: "15分", seconds: 900, tolerance: 300 },
  { key: "1h", label: "1時間", seconds: 3600, tolerance: 600 },
  { key: "24h", label: "24時間", seconds: 86400, tolerance: 3600 },
  { key: "72h", label: "72時間", seconds: 259200, tolerance: 7200 },
  { key: "7d", label: "7日", seconds: 604800, tolerance: 21600 },
] as const;
export type Checkpoint = typeof CHECKPOINTS[number]["key"];
export type Conditions = {
  series: string; audience: "kids" | "general"; language: string;
  voice: string; visualStyle: string; character: string; subtitleStyle: string;
  durationMin: number; durationMax: number; format: "short" | "standard";
};
export type Experiment = {
  id: string; title: string; channelId: string; conditions: Conditions;
  factor: "opening"; variantA: string; variantB: string;
  minSamples: number; threshold: number; createdAt: string;
};
export type Video = {
  id: string; youtubeId: string; title: string; channelId: string;
  publishedAt: string; contentHash: string; durationSeconds: number;
  experimentId: string; variant: "A" | "B"; conditions: Conditions;
  episode: string; createdAt: string; verified: boolean;
};
export type Observation = {
  id: string; videoId: string; checkpoint: Checkpoint; observedAt: string;
  status: "collected" | "missed"; source: "youtube_data" | "demo";
  definition: string; views: number | null; likes: number | null;
  reason: string | null;
};
export type AnalyticsRow = {
  videoId: string; day: string; fetchedAt: string; views: number | null;
  engagedViews: number | null; averageViewDuration: number | null;
  averageViewPercentage: number | null; shares: number | null;
  subscribersGained: number | null;
};
export type Draft = {
  id: string; title: string; experimentId: string; status: "draft" | "reviewed";
  script: string; evidence: Recommendation; createdAt: string; revision: number;
};
export type StudioData = {
  experiments: Experiment[]; videos: Video[]; observations: Observation[];
  analytics: AnalyticsRow[]; drafts: Draft[];
};
export const VIEW_DEFINITION = "youtube_data_v3:viewCount:2025-03-31";
export const EMPTY_DATA: StudioData = { experiments: [], videos: [], observations: [], analytics: [], drafts: [] };
export const DEFAULT_CONDITIONS: Conditions = {
  series: "ポコのいろさがし", audience: "kids", language: "ja", voice: "日本語・やさしい語り",
  subtitleStyle: "ひらがな中心・画面下部・短い字幕", visualStyle: "柔らかい絵本風", character: "茶色いこぐま・黄色いスカーフ", durationMin: 30, durationMax: 45, format: "short",
};
export const conditionKeys = Object.keys(DEFAULT_CONDITIONS) as (keyof Conditions)[];
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}
export function checkpointState(publishedAt: string, key: Checkpoint, now: Date) {
  const checkpoint = CHECKPOINTS.find(c => c.key === key)!;
  const due = Date.parse(publishedAt) + checkpoint.seconds * 1000;
  return { due: new Date(due).toISOString(), state: now.getTime() < due ? "waiting" : now.getTime() <= due + checkpoint.tolerance * 1000 ? "due" : "missed" } as const;
}
export type Recommendation = {
  schemaVersion: "1.0"; experimentId: string; generatedAt: string;
  status: "insufficient_data" | "inconclusive" | "retest_candidate";
  checkpoint: "72h"; source: "youtube_data" | "demo"; definition: string;
  groups: { variant: "A" | "B"; label: string; count: number; median: number | null; videoIds: string[]; observationIds: string[] }[];
  excluded: { videoId: string; reason: string }[];
  candidate: "A" | "B" | null; relativeLift: number | null;
  facts: string[]; uncertainties: string[]; nextChange: string;
  fixedConditions: Conditions; permissions: { publish: false; paidGeneration: false };
};
export function compare(experiment: Experiment, data: StudioData, source: "youtube_data" | "demo" = "youtube_data", now = new Date()): Recommendation {
  const groups: Recommendation["groups"] = [
    { variant: "A", label: experiment.variantA, count: 0, median: null, videoIds: [], observationIds: [] },
    { variant: "B", label: experiment.variantB, count: 0, median: null, videoIds: [], observationIds: [] },
  ];
  const values: Record<"A" | "B", number[]> = { A: [], B: [] };
  const excluded: Recommendation["excluded"] = [];
  const hashes = new Set<string>();
  const videos = [...data.videos].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  for (const video of videos) {
    const duplicate = Boolean(video.contentHash && hashes.has(video.contentHash));
    if (video.contentHash) hashes.add(video.contentHash);
    if (video.experimentId !== experiment.id) continue;
    let reason = "";
    if (duplicate) reason = "同じ完成素材の再投稿";
    else if (!/^[a-f0-9]{64}$/.test(video.contentHash)) reason = "完成素材のハッシュが未確認";
    else if (!video.verified) reason = "公開状態が未確認";
    else if (video.channelId !== experiment.channelId || conditionKeys.some(key => video.conditions[key] !== experiment.conditions[key]) || video.durationSeconds < experiment.conditions.durationMin || video.durationSeconds > experiment.conditions.durationMax) reason = "比較条件が一致していません";
    else if (Date.parse(video.publishedAt) < Date.parse(experiment.createdAt)) reason = "比較計画の作成より前の投稿";
    // Choose the first observation, never the maximum or latest count.
    const observation = data.observations.filter(o => o.videoId === video.id && o.checkpoint === "72h").sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id))[0];
    if (!reason) {
      if (!observation || observation.status === "missed" || observation.views === null) reason = "72時間の計測がありません";
      else if (observation.source !== source || observation.definition !== VIEW_DEFINITION) reason = "指標の出典・定義が一致していません";
      else if (!Number.isSafeInteger(observation.views) || observation.views < 0) reason = "無効な再生数";
      else if (checkpointState(video.publishedAt, "72h", new Date(observation.observedAt)).state !== "due" || Date.parse(observation.observedAt) > now.getTime()) reason = "72時間の計測許容範囲外";
    }
    if (reason) { excluded.push({ videoId: video.id, reason }); continue; }
    const group = groups.find(g => g.variant === video.variant)!;
    group.videoIds.push(video.id); group.observationIds.push(observation.id);
    values[video.variant].push(observation.views!);
  }
  for (const group of groups) { group.count = values[group.variant].length; group.median = median(values[group.variant]); }
  const [a, b] = groups;
  const enough = a.count >= experiment.minSamples && b.count >= experiment.minSamples;
  const candidate = enough && a.median !== b.median ? (a.median! > b.median! ? "A" : "B") : null;
  const low = Math.min(a.median ?? 0, b.median ?? 0), high = Math.max(a.median ?? 0, b.median ?? 0);
  const relativeLift = enough && low > 0 ? (high - low) / low : null;
  const status = !enough ? "insufficient_data" : candidate && relativeLift !== null && relativeLift >= experiment.threshold ? "retest_candidate" : "inconclusive";
  const facts = groups.map(g => `${g.variant}「${g.label}」: ${g.count}本、公開72時間後の再生数中央値 ${g.median === null ? "未計測" : g.median.toLocaleString("ja-JP") + "回"}。`);
  if (relativeLift !== null) facts.push(`中央値の相対差は ${(relativeLift * 100).toFixed(1)}% です。`);
  if (enough && low === 0) facts.push("低い側の中央値が0のため、増加率は算出できません。");
  return {
    schemaVersion: "1.0", experimentId: experiment.id, generatedAt: now.toISOString(), status, checkpoint: "72h", source, definition: VIEW_DEFINITION,
    groups, excluded, candidate: status === "retest_candidate" ? candidate : null, relativeLift, facts,
    uncertainties: ["異なる動画の観察比較です。話題・公開時刻・配信相手の影響は分離できません。", `${experiment.minSamples}本・${experiment.threshold * 100}%は試験設定であり、統計的有意差を示す基準ではありません。`, "再生数は視聴の質を表しません。日別の平均視聴時間・平均視聴率も確認してください。"],
    nextChange: status === "retest_candidate" ? `別のエピソードで、冒頭を${candidate}「${candidate === "A" ? experiment.variantA : experiment.variantB}」にした下書きを作り、A/Bを各2本追加して再検証する。声・尺・画風・字幕・キャラクターは維持する。` : status === "insufficient_data" ? `条件を維持してA/Bそれぞれ${experiment.minSamples}本の有効な72時間計測を集める。まだ優劣を決めない。` : "冒頭以外の条件を維持し、別エピソードでA/Bを追加する。現時点では採用案を決めない。",
    fixedConditions: experiment.conditions, permissions: { publish: false, paidGeneration: false },
  };
}
export function draftScript(experiment: Experiment, evidence: Recommendation, episode: string) {
  if (experiment.conditions.audience !== "kids" || !experiment.conditions.series.includes("ポコ")) {
    const hook = evidence.candidate === "B" ? `［冒頭：${episode}の見せ場・結果を先に提示］` : `「${episode}、どうなるでしょう？」`;
    return `${hook}\n\n［本編：${episode}について、別の具体例を一つ扱う］\n［場面ごとのナレーションと字幕を記入］\n\n［結び：本編で示した結果を一文で振り返る］\n\n制作条件：${experiment.conditions.series} / ${experiment.conditions.voice} / ${experiment.conditions.durationMin}〜${experiment.conditions.durationMax}秒 / ${experiment.conditions.visualStyle} / ${experiment.conditions.character} / ${experiment.conditions.subtitleStyle}。\n変更するのは冒頭だけ。話題・声・字幕などを同時に変えない。`;
  }
  const opening = evidence.candidate === "B" ? `ポコがみつけたのは、${episode}！` : `${episode}は、どこかな？`;
  return `${opening}\n\nこぐまのポコと、いっしょにさがしてみよう。\n［場面：今回の答えと選択肢を、色や形が分かるように配置］\n\nどっちかな？\n［2秒の間・読み上げない］\n\nそう！ みつけたね！\n［場面：ポコが今回の答えを手に取る］\n\nいっしょにさがしてくれて、ありがとう！\n\n制作メモ：${experiment.conditions.durationMin}〜${experiment.conditions.durationMax}秒。${experiment.conditions.voice}。${experiment.conditions.visualStyle}。冒頭は${evidence.candidate ?? "A（暫定）"}案。場面指示は音声に含めず、答えと絵の一致を確認する。`;
}
