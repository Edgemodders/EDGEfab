// Make: a model from a GLB on disk or from Tripo, prepared, in a folder shaped like a Library asset item
// (docs/library.md, still a proposal): <name>.prop.asset/ with asset.json and source/raw/<name>/. Add to
// Project and the Library build on this folder.

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { readSettings, slug, deskDir, type TripoPlan } from "./config";
import { prepareModel, type PrepareOptions, type PrepareResult } from "./prepare";
import { generateModel, type TextToModel, type TripoCall, type TripoTask } from "./tripo";

export type MakeRequest =
  | { from: "file"; file: string; name?: string }
  | { from: "tripo"; request: TextToModel; name?: string; plan?: TripoPlan };

export interface MadeModel {
  /** The asset folder. */
  folder: string;
  name: string;
  /** The asset's record, as written to asset.json. */
  asset: AssetRecord;
  prepared: PrepareResult;
  /** Tripo's preview render, for a generated model. */
  preview?: string;
}

/** asset.json, the fields docs/library.md proposes, filled as far as a made model knows them. */
export interface AssetRecord {
  format: 1;
  id: string;
  name: string;
  kind: "prop";
  main: string | null;
  version: number;
  from: { file: string } | { tripo: { task: string; prompt: string; model: string; credits?: number } };
  license: { source: "own" | "tripo"; plan?: TripoPlan; terms?: string; note: string };
  history: { tool: string; did: string; date: string }[];
  tools: Record<string, string>;
}

const TripoTerms = "https://www.tripo3d.ai/terms";

function freeFolder(base: string, name: string): { folder: string; name: string } {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${name}_${n}`;
    const folder = path.join(base, `${candidate}.prop.asset`);
    if (!fs.existsSync(folder)) return { folder, name: candidate };
  }
}

export async function makeModel(
  req: MakeRequest,
  opts: { version: string; base?: string; prepare?: PrepareOptions; call?: TripoCall; onProgress?: (step: string, task?: TripoTask) => void } = { version: "0.0.0" },
): Promise<MadeModel> {
  const base = opts.base ?? deskDir();
  const wanted = slug(req.name ?? (req.from === "file" ? path.basename(req.file, path.extname(req.file)) : req.request.prompt));
  const { folder, name } = freeFolder(base, wanted);
  const raw = path.join(folder, "source", "raw", name);
  fs.mkdirSync(raw, { recursive: true });
  const progress = opts.onProgress ?? (() => undefined);

  let original: string;
  let from: AssetRecord["from"];
  let license: AssetRecord["license"];
  let preview: string | undefined;
  let did: string;
  let paidFor = false;
  try {
    if (req.from === "file") {
      if (!fs.existsSync(req.file)) throw new Error(`There is no file at ${req.file}.`);
      original = path.join(raw, `original${path.extname(req.file).toLowerCase()}`);
      fs.copyFileSync(req.file, original);
      from = { file: req.file };
      license = { source: "own", note: "From a file on disk: record its source and terms (a store listing, your own work) before releasing it." };
      did = `Made from ${path.basename(req.file)}`;
    } else {
      const plan = req.plan ?? readSettings().tripoPlan;
      if (!plan) throw new Error("Say first whether your Tripo plan is paid or free: on a free plan Tripo keeps the rights to the model (Tripo's terms, 5.2).");
      progress("Asking Tripo for the model...");
      const made = await generateModel(req.request, raw, opts.call, (t) => progress(`Tripo: ${t.status}${t.progress !== undefined ? ` ${t.progress}%` : ""}`, t));
      original = path.join(raw, "original.glb");
      fs.renameSync(made.glb, original);
      paidFor = true;
      preview = made.preview;
      from = { tripo: { task: made.taskId, prompt: made.prompt, model: made.model, credits: made.credits } };
      license = plan === "paid"
        ? { source: "tripo", plan, terms: TripoTerms, note: "Made on a paid Tripo plan: the model is yours to use, change and release (Tripo's terms, 5.2.2)." }
        : { source: "tripo", plan, terms: TripoTerms, note: "Made on a free Tripo plan: Tripo keeps all rights to the model (Tripo's terms, 5.2.1). Don't release it in a mod." };
      did = `Made by Tripo from "${made.prompt}"`;
    }
    progress("Preparing it for the game...");
    const prepared = await prepareModel(original, raw, name, opts.prepare);
    const asset: AssetRecord = {
      format: 1,
      id: randomUUID(),
      name: req.name ?? (req.from === "file" ? path.basename(req.file, path.extname(req.file)) : req.request.prompt.trim()),
      kind: "prop",
      main: null, // the .ent's game path, once Add to Project has made it
      version: 1,
      from,
      license,
      history: [{ tool: `EDGEfab ${opts.version}`, did, date: new Date().toISOString() }],
      tools: { edgefab: opts.version },
    };
    fs.writeFileSync(path.join(raw, "prepared.json"), JSON.stringify(prepared, null, 2));
    fs.writeFileSync(path.join(folder, "asset.json"), JSON.stringify(asset, null, 2));
    return { folder, name, asset, prepared, preview };
  } catch (e) {
    // Tripo's model cost credits: keep it, so it can be prepared again once the problem is fixed.
    if (paidFor) throw new Error(`${e instanceof Error ? e.message : String(e)} Tripo's model is kept at ${path.join(raw, "original.glb")}: Import a GLB takes it again.`);
    fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
}
