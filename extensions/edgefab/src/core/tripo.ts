// Tripo's v3 REST API (openapi.tripo3d.ai; v2 shut down on 2026-10-31): text to a textured model.
// Routes and model names from Tripo's MIT Python SDK, checked with a real key in F0 (docs/testing.md).
// The key comes from the EDGE tools' shared key store and goes only into the Authorization header of
// calls to Tripo: never logged, never in a URL, never to a child process. Downloads of the results go to
// Tripo's signed storage URLs without the key.

import * as fs from "node:fs";
import * as path from "node:path";
import { sharedKeys } from "./sharedKeys";

const Base = "https://openapi.tripo3d.ai";
export const TripoModel = "v3.1-20260211";
/** About 20,000 triangles: the same price as no limit, and a model the game can take (F0). */
export const DefaultFaceLimit = 20000;

export class TripoError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: number) {
    super(message);
  }
}

export interface TripoCall {
  key?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

async function tripoKey(call: TripoCall): Promise<string> {
  const key = call.key ?? (await sharedKeys.getKey("tripo", { tool: "EDGEfab" }));
  if (!key) throw new TripoError("No Tripo API key. Set one with EDGEfab: Set Tripo Key (it goes into the EDGE tools' shared key store).");
  return key;
}

async function api<T>(call: TripoCall, method: "GET" | "POST", route: string, body?: unknown): Promise<T> {
  const key = await tripoKey(call);
  const res = await (call.fetch ?? fetch)(Base + route, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: call.signal,
  });
  const text = await res.text();
  let json: { code?: number; message?: string; data?: T } & Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TripoError(`Tripo answered HTTP ${res.status} with something other than JSON.`, res.status);
  }
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    const why = typeof json.message === "string" ? json.message : `code ${json.code ?? "?"}`;
    const hint = res.status === 401 ? " The Tripo key was refused: set it again with EDGEfab: Set Tripo Key." : res.status === 403 && /credit|balance/i.test(why) ? " Not enough credits." : "";
    throw new TripoError(`Tripo: ${why} (HTTP ${res.status}).${hint}`, res.status, json.code);
  }
  return ("data" in json ? json.data : json) as T;
}

export interface TripoBalance {
  balance: number;
  frozen: number;
}

export const tripoBalance = (call: TripoCall = {}) => api<TripoBalance>(call, "GET", "/v3/account/balance");

/** The four sides a picture-first model is made from (core/picture.ts), as PNG files. */
export type ViewName = "front" | "left" | "back" | "right";
export const ViewNames: ViewName[] = ["front", "left", "back", "right"];

/** A model from words (text to model) or from four pictures of its sides (multiview to model). */
export interface TextToModel {
  /** The words; for a model from pictures, what it is (kept in its record). */
  prompt: string;
  /** Pictures of its four sides: Tripo's multiview to model instead of text to model. */
  views?: Record<ViewName, string>;
  /** In parts (generate_parts), textured in a second step, so each part can take its own material. */
  parts?: boolean;
  /** Triangles to ask for; default 20,000. */
  faceLimit?: number;
  /** Real size from Tripo (it puts the scale on the node, which prepare bakes in). Default on. */
  autoSize?: boolean;
  negativePrompt?: string;
  /** "detailed": a sharper texture (Tripo's SDK, docs/API.md); costs more. Default standard. */
  textureQuality?: "standard" | "detailed";
  /** "detailed": finer shapes; costs more. Default standard. */
  geometryQuality?: "standard" | "detailed";
  /** Clean low-poly shapes from the start (flat panels, straight edges), 20,000 triangles at most. */
  smartLowPoly?: boolean;
}

export interface TripoTask {
  task_id: string;
  status: "queued" | "running" | "success" | "failed" | "banned" | "expired" | "cancelled" | "unknown";
  progress?: number;
  output?: { model_url?: string; pbr_model?: string; model?: string; rendered_image_url?: string; generated_image_url?: string };
  credits_consumed?: number;
}

/** Credits a model takes, as Tripo charged on 2026-11-09 (docs/testing.md); the texture step's standard price unverified. */
export function tripoCredits(req: Omit<TextToModel, "prompt">): number {
  const detailedTexture = req.textureQuality === "detailed";
  const shape = (req.geometryQuality === "detailed" ? 20 : 0) + (req.smartLowPoly ? 10 : 0);
  if (req.parts) return (req.views ? 40 : 30) + shape + (detailedTexture ? 20 : 10);
  return (req.views ? 30 : 20) + shape + (detailedTexture ? 10 : 0);
}

/** A PNG or JPEG to Tripo's storage, for a model from pictures: its file token. */
export async function uploadPicture(file: string, call: TripoCall = {}): Promise<string> {
  const format = /\.jpe?g$/i.test(file) ? "jpeg" : "png";
  const { presigned_url, file_token } = await api<{ presigned_url: string; file_token: string }>(call, "POST", "/v3/files/presign", { format });
  const res = await (call.fetch ?? fetch)(presigned_url, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: new Uint8Array(fs.readFileSync(file)), signal: call.signal });
  if (!res.ok) throw new TripoError(`Sending a picture to Tripo failed: HTTP ${res.status}.`, res.status);
  return file_token;
}

export async function startTextToModel(req: TextToModel, call: TripoCall = {}): Promise<string> {
  if (!req.prompt.trim() && !req.views) throw new TripoError("Describe the model first.");
  const texture = !req.parts;
  const body = {
    model: TripoModel,
    texture,
    pbr: texture,
    face_limit: req.faceLimit ?? DefaultFaceLimit,
    auto_size: req.autoSize ?? true,
    ...(req.parts ? { generate_parts: true } : {}),
    ...(req.negativePrompt && !req.views ? { negative_prompt: req.negativePrompt } : {}),
    ...(texture && req.textureQuality && req.textureQuality !== "standard" ? { texture_quality: req.textureQuality } : {}),
    ...(req.geometryQuality && req.geometryQuality !== "standard" ? { geometry_quality: req.geometryQuality } : {}),
    ...(req.smartLowPoly ? { smart_low_poly: true } : {}),
  };
  if (req.views) {
    // Tripo's order: front, left, back, right, each { <side>: token } (checked 2026-11-09).
    const inputs: Record<string, string>[] = [];
    for (const side of ViewNames) inputs.push({ [side]: await uploadPicture(req.views[side], call) });
    return (await api<{ task_id: string }>(call, "POST", "/v3/generation/multiview-to-model", { ...body, inputs })).task_id;
  }
  return (await api<{ task_id: string }>(call, "POST", "/v3/generation/text-to-model", { ...body, prompt: req.prompt.trim() })).task_id;
}

/** Textures a finished untextured model (its parts keep their own textures): the task id. */
export async function startTexture(modelTask: string, req: Pick<TextToModel, "textureQuality">, call: TripoCall = {}): Promise<string> {
  const body = { input: modelTask, texture: true, pbr: true, ...(req.textureQuality && req.textureQuality !== "standard" ? { texture_quality: req.textureQuality } : {}) };
  return (await api<{ task_id: string }>(call, "POST", "/v3/models/texture", body)).task_id;
}

export const tripoTask = (id: string, call: TripoCall = {}) => api<TripoTask>(call, "GET", `/v3/tasks/${encodeURIComponent(id)}`);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new TripoError("Cancelled."))), { once: true });
  });

/** Polls a task until it ends, about 2 minutes for a text-to-model task (F0). */
export async function waitForTask(id: string, call: TripoCall = {}, onProgress?: (task: TripoTask) => void, timeoutMs = 10 * 60_000): Promise<TripoTask> {
  const started = Date.now();
  let wait = 3000;
  for (;;) {
    const task = await tripoTask(id, call);
    onProgress?.(task);
    if (task.status === "success") return task;
    if (task.status !== "queued" && task.status !== "running") throw new TripoError(`Tripo's task ended as ${task.status}.`);
    if (Date.now() - started > timeoutMs) throw new TripoError(`Tripo's task ${id} is still not done after ${Math.round(timeoutMs / 60000)} minutes.`);
    await sleep(wait, call.signal);
    wait = Math.min(wait * 1.5, 15000);
  }
}

export interface Generated {
  taskId: string;
  /** The texture step's task, for a model in parts. */
  textureTask?: string;
  prompt: string;
  model: string;
  credits?: number;
  /** The textured GLB as Tripo made it. */
  glb: string;
  /** Tripo's preview render, when it sent one. */
  preview?: string;
}

/** Words or pictures to a textured GLB in `outDir`: starts the task (and the texture step for parts), waits,
 *  downloads the model and its preview. */
export async function generateModel(req: TextToModel, outDir: string, call: TripoCall = {}, onProgress?: (task: TripoTask, step: "model" | "texture") => void): Promise<Generated> {
  const modelTask = await startTextToModel(req, call);
  let task = await waitForTask(modelTask, call, (t) => onProgress?.(t, "model"));
  let credits = task.credits_consumed ?? 0;
  if (req.parts) {
    task = await waitForTask(await startTexture(modelTask, req, call), call, (t) => onProgress?.(t, "texture"));
    credits += task.credits_consumed ?? 0;
  }
  const url = task.output?.model_url ?? task.output?.pbr_model ?? task.output?.model;
  if (!url) throw new TripoError("Tripo's task ended without a model.");
  fs.mkdirSync(outDir, { recursive: true });
  const download = async (from: string, to: string) => {
    const res = await (call.fetch ?? fetch)(from, { signal: call.signal });
    if (!res.ok) throw new TripoError(`Downloading Tripo's result failed: HTTP ${res.status}.`, res.status);
    fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
    return to;
  };
  const glb = await download(url, path.join(outDir, "tripo.glb"));
  let preview: string | undefined;
  const render = task.output?.rendered_image_url;
  if (render) {
    const ext = /\.(webp|png|jpe?g)(\?|$)/i.exec(render)?.[1] ?? "webp";
    preview = await download(render, path.join(outDir, `preview.${ext}`)).catch(() => undefined);
  }
  return { taskId: modelTask, ...(req.parts ? { textureTask: task.task_id } : {}), prompt: req.prompt.trim(), model: TripoModel, credits: credits || undefined, glb, preview };
}

/** The detail choices (owner, 2026-11-09, docs/testing.md "Tripo's quality settings"): the detailed texture
 *  (4096², the big gain for its cost) by default; High detail adds Tripo's detailed shape and more triangles. */
export type Detail = "standard" | "high";
export const DetailLevels: Record<Detail, { label: string; detail: string; settings: Pick<TextToModel, "textureQuality" | "geometryQuality" | "faceLimit"> }> = {
  standard: { label: "Detailed texture", detail: "A sharp 4096² texture: labels, screws and vents crisp", settings: { textureQuality: "detailed", faceLimit: DefaultFaceLimit } },
  high: { label: "High detail", detail: "The detailed texture and Tripo's detailed shape: crisper bevels and buttons, about 3 times the triangles; flat panels may ripple", settings: { textureQuality: "detailed", geometryQuality: "detailed", faceLimit: 60000 } },
};
