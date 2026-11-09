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

export interface TextToModel {
  prompt: string;
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
  output?: { model_url?: string; rendered_image_url?: string; generated_image_url?: string };
  credits_consumed?: number;
}

export async function startTextToModel(req: TextToModel, call: TripoCall = {}): Promise<string> {
  if (!req.prompt.trim()) throw new TripoError("Describe the model first.");
  const body = {
    prompt: req.prompt.trim(),
    model: TripoModel,
    texture: true,
    pbr: true,
    face_limit: req.faceLimit ?? DefaultFaceLimit,
    auto_size: req.autoSize ?? true,
    ...(req.negativePrompt ? { negative_prompt: req.negativePrompt } : {}),
    ...(req.textureQuality && req.textureQuality !== "standard" ? { texture_quality: req.textureQuality } : {}),
    ...(req.geometryQuality && req.geometryQuality !== "standard" ? { geometry_quality: req.geometryQuality } : {}),
    ...(req.smartLowPoly ? { smart_low_poly: true } : {}),
  };
  const created = await api<{ task_id: string }>(call, "POST", "/v3/generation/text-to-model", body);
  return created.task_id;
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
  prompt: string;
  model: string;
  credits?: number;
  /** The textured GLB as Tripo made it. */
  glb: string;
  /** Tripo's preview render, when it sent one. */
  preview?: string;
}

/** Words to a textured GLB in `outDir`: starts the task, waits, downloads the model and its preview. */
export async function generateModel(req: TextToModel, outDir: string, call: TripoCall = {}, onProgress?: (task: TripoTask) => void): Promise<Generated> {
  const taskId = await startTextToModel(req, call);
  const task = await waitForTask(taskId, call, onProgress);
  const url = task.output?.model_url;
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
  return { taskId, prompt: req.prompt.trim(), model: TripoModel, credits: task.credits_consumed, glb, preview };
}
