// Picture first (owner, 2026-11-09; docs/testing.md, "picture first"): an image model draws the object from four
// sides as one 2 by 2 picture, in about 30 seconds and for little; the modder changes the words until it looks
// right; then Tripo makes the model from the four views (multiview to model), which follows each side far more
// closely than text to model. The sheet's layout is EDGEmat's Reshape's: front and left above, back and right below.
//
// OpenAI's GPT Image, with the modder's own key (the extension's secret storage, or OPENAI_API_KEY), sent
// only to OpenAI. EDGEmat's core has the same service (imageServices.ts) but draws 1024² only; EDGEfab asks
// 2048² (1024² a view) until EDGEmat's generateImage takes a size (EDGEmat #9).

import * as fs from "node:fs";
import * as path from "node:path";
import { crop, decode, encodePng } from "./pixels";
import { envKey } from "./keys";
import { ViewNames, type ViewName } from "./tripo";

export const PictureModel = "gpt-image-2.5-sunburst";
const OpenAI = "https://api.openai.com/v1/images/generations";
const OpenAIEdit = "https://api.openai.com/v1/images/edits";

export class PictureError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export interface PictureCall {
  key?: string;
  model?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

/** One drawing of the four views. */
export interface PictureTake {
  take: number;
  /** The modder's words for this take: what the object is, or, for a change, what to change. */
  words: string;
  /** For a change: the take it was made from (its picture sent with the words). */
  from?: number;
  /** The object as first described, carried through changes (Tripo's record and the item's name use it). */
  what?: string;
  model: string;
  /** The 2 by 2 picture. */
  sheet: string;
  views: Record<ViewName, string>;
  seconds: number;
  date: string;
  /** OpenAI's image tokens for it, when it said. */
  tokens?: number;
}

/** `picture.json` in an item's raw folder: every take, the last one the one Make 3D uses. */
export interface PictureRecord {
  takes: PictureTake[];
}

/** The words sent: the object, then the views and a brief for a game prop (flat panels, crisp details). */
export function viewsPrompt(words: string): string {
  return [
    `One ${words.trim().replace(/\.$/, "")}, shown from four sides as a 2 by 2 grid of orthographic views: top left from the front, top right from its left side, bottom left from the back, bottom right from its right side.`,
    "The same object at the same scale, height and place in every view, with a straight-on camera, so the four views show one object; what shows only from the front stays only in the front view.",
    "Clean hard-surface design: flat, straight panels and crisp edges, sharp fine details (buttons, labels, vents, screws), realistic materials. Soft, even studio light, plain white background, no ground shadow, no text, labels, borders or other objects.",
  ].join(" ");
}

/** The words sent to change a take: the same sheet back, changed only as the words say (EDGEmat's Reshape's change). */
export function changePrompt(what: string, words: string): string {
  const it = what.trim().replace(/\.$/, "") || "object";
  return [
    `The picture shows one ${it} from four sides, on a plain white background, as a 2 by 2 grid of orthographic views: top left from the front, top right from its left side, bottom left from the back, bottom right from its right side.`,
    `Change it: ${words.trim().replace(/\.$/, "")}.`,
    "A changed part replaces the old one: the old part is gone, not kept inside, under or beside the new one.",
    "Show the changed object in the same four views and the same grid, with the same straight-on camera at the same distance and scale: what the words do not change keeps its shape, size, place, colors and materials.",
    "Change it the same way in every view, so the four views show one object; what shows only from the front stays only in the front view. Clean hard-surface design, crisp details, soft even light, plain white background, no ground shadow, no text, labels or borders.",
  ].join(" ");
}

/** The object a take shows, as first described: its own words for a first drawing, carried through changes. */
export const takeWhat = (t: PictureTake): string => t.what ?? t.words;

export function readPictures(raw: string): PictureRecord | undefined {
  let record: PictureRecord;
  try {
    record = JSON.parse(fs.readFileSync(path.join(raw, "picture", "picture.json"), "utf8")) as PictureRecord;
  } catch {
    return undefined;
  }
  // Each take's files, found in this item: the paths recorded are where it was drawn, and a copied or moved
  // item (Rename, the Library, Edit on the Desk) keeps them.
  const here = (take: number, f: string) => path.join(raw, "picture", String(take), path.basename(f));
  return {
    ...record,
    takes: record.takes.map((t) => ({
      ...t,
      sheet: here(t.take, t.sheet),
      views: Object.fromEntries(Object.entries(t.views).map(([k, f]) => [k, here(t.take, f)])) as PictureTake["views"],
    })),
  };
}

async function openaiKey(call: PictureCall): Promise<string> {
  const key = call.key ?? envKey("openai");
  if (!key) throw new PictureError("No OpenAI API key. In VS Code, set one with EDGEfab: Set OpenAI Key; for the MCP server, set OPENAI_API_KEY in its environment.");
  return key;
}

/**
 * Draws the four views into `<raw>\picture\<take>\`, and adds the take to picture.json. With `from`, a change:
 * that take's picture goes to GPT Image with the words, and comes back changed only as they say.
 */
export async function drawViews(words: string, raw: string, call: PictureCall = {}, opts: { from?: number } = {}): Promise<PictureTake> {
  if (!words.trim()) throw new PictureError(opts.from ? "Say what to change first." : "Describe the object first.");
  const record = readPictures(raw) ?? { takes: [] };
  const base = opts.from !== undefined ? record.takes.find((t) => t.take === opts.from) : undefined;
  if (opts.from !== undefined && !base) throw new PictureError(`There is no picture ${opts.from} to change.`);
  if (base && !fs.existsSync(base.sheet)) throw new PictureError(`Picture ${base.take}'s file is missing: ${base.sheet}`);
  const key = await openaiKey(call);
  const model = call.model ?? PictureModel;
  const prompt = base ? changePrompt(takeWhat(base), words) : viewsPrompt(words);
  const started = Date.now();
  let body: { data?: { b64_json?: string }[]; usage?: { output_tokens?: number }; error?: { message?: string } } = {};
  for (const size of ["2048x2048", "1024x1024"]) {
    let init: RequestInit;
    if (base) {
      // OpenAI's edit: the picture as a file beside the words (multipart; the form sets its own content type).
      const form = new FormData();
      for (const [k, v] of Object.entries({ model, prompt, size, n: "1", quality: "high", output_format: "png" })) form.append(k, v);
      form.append("image[]", new Blob([new Uint8Array(fs.readFileSync(base.sheet))], { type: "image/png" }), "views.png");
      init = { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: call.signal };
    } else {
      init = {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size, n: 1, quality: "high", output_format: "png" }),
        signal: call.signal,
      };
    }
    const res = await (call.fetch ?? fetch)(base ? OpenAIEdit : OpenAI, init);
    body = (await res.json().catch(() => ({}))) as typeof body;
    if (res.ok) break;
    const why = body.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && /size/i.test(why) && size !== "1024x1024") continue; // an older model: smaller
    if (res.status === 401) throw new PictureError("OpenAI refused the key: set it again with EDGEfab: Set OpenAI Key.", 401);
    if (/safety|moderation|policy/i.test(why)) throw new PictureError(`OpenAI won't draw that: ${why} Change the words and try again.`, res.status);
    if (res.status === 429) throw new PictureError(`OpenAI says too many requests or no credit left: ${why}`, 429);
    throw new PictureError(`OpenAI: ${why}`, res.status);
  }
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new PictureError("OpenAI sent no picture.");

  const take = Math.max(0, ...record.takes.map((t) => t.take)) + 1;
  const dir = path.join(raw, "picture", String(take));
  fs.mkdirSync(dir, { recursive: true });
  const sheet = path.join(dir, "views.png");
  const bytes = Buffer.from(b64, "base64");
  fs.writeFileSync(sheet, bytes);
  // The sheet cut into its four views: front and left above, back and right below.
  const img = decode(bytes, "image/png");
  const w = Math.floor(img.width / 2), h = Math.floor(img.height / 2);
  const at: Record<ViewName, [number, number]> = { front: [0, 0], left: [w, 0], back: [0, h], right: [w, h] };
  const views = {} as Record<ViewName, string>;
  for (const side of ViewNames) {
    views[side] = path.join(dir, `${side}.png`);
    fs.writeFileSync(views[side], encodePng(crop(img, at[side][0], at[side][1], w, h)));
  }
  const done: PictureTake = { take, words: words.trim(), ...(base ? { from: base.take, what: takeWhat(base) } : {}), model, sheet, views, seconds: Math.round((Date.now() - started) / 1000), date: new Date().toISOString(), ...(body.usage?.output_tokens ? { tokens: body.usage.output_tokens } : {}) };
  record.takes.push(done);
  fs.writeFileSync(path.join(raw, "picture", "picture.json"), JSON.stringify(record, null, 2));
  return done;
}
