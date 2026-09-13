import { z } from "zod";
const label = z.string().trim().min(1).max(150);
export const conditionsInput = z.object({ series: label, audience: z.enum(["kids", "general"]), language: z.literal("ja"), voice: label, visualStyle: label, character: label, subtitleStyle: label, durationMin: z.number().int().min(1).max(600), durationMax: z.number().int().min(1).max(600), format: z.enum(["short", "standard"]) }).strict().refine(v => v.durationMax >= v.durationMin, { message: "最長の尺は最短以上にしてください。" });
export const experimentInput = z.object({ title: label, channelId: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/), conditions: conditionsInput, variantA: z.literal("質問から始める"), variantB: z.literal("見せ場を先に出す"), minSamples: z.number().int().min(4).max(100).default(4), threshold: z.number().min(.01).max(1).default(.2) }).strict();
export const videoInput = z.object({ experimentId: z.string().uuid(), youtubeUrl: z.string().trim().min(1).max(300), variant: z.enum(["A", "B"]), episode: label, contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const draftInput = z.object({ experimentId: z.string().uuid(), title: label }).strict();
export const draftUpdateInput = z.union([z.object({ script: z.string().trim().min(1).max(20000), expectedRevision: z.number().int().min(1) }).strict(), z.object({ status: z.literal("reviewed"), expectedRevision: z.number().int().min(1) }).strict()]);
export function youtubeId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (/^\/(shorts|live)\//.test(url.pathname)) id = url.pathname.split("/")[2];
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
