// Make: a model from a GLB on disk or from Tripo, prepared, in a folder shaped like a Library asset item
// (docs/library.md, still a proposal): <name>.prop.asset/ with asset.json and source/raw/<name>/. Add to
// Project and the Library build on this folder.

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { readSettings, slug, deskDir, type TripoPlan } from "./config";
import { prepareModel, type PrepareOptions, type PrepareResult } from "./prepare";
import { NodeIO } from "@gltf-transform/core";
import { quiet } from "./quiet";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { drawViews, readPictures, type PictureCall, type PictureTake } from "./picture";
import { generateModel, type TextToModel, type TripoCall, type TripoTask } from "./tripo";

/** Tripo's settings for a model from an item's pictures (the words and views come from the item). */
export type FromPictureRequest = Omit<TextToModel, "prompt" | "views">;

export type MakeRequest =
  | { from: "file"; file: string; name?: string }
  | { from: "tripo"; request: TextToModel; name?: string; plan?: TripoPlan }
  /** Make 3D: Tripo's multiview model from the last picture of a Desk item drawn with drawPicture. */
  | { from: "picture"; item: string; request?: FromPictureRequest; plan?: TripoPlan };

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
  from:
    | { file: string }
    | { picture: { words: string; model: string; take: number } }
    | {
        tripo: {
          task: string;
          prompt: string;
          model: string;
          credits?: number;
          /** In parts: the texture step's task. */
          textureTask?: string;
          parts?: boolean;
          quality?: { texture?: string; shape?: string };
          /** Made from this picture's four views (picture first). */
          picture?: { words: string; model: string; take: number };
        };
      };
  license: { source: "own" | "tripo" | "openai"; plan?: TripoPlan; terms?: string; note: string };
  history: { tool: string; did: string; date: string }[];
  tools: Record<string, string>;
  /** On the Desk only: where Add to Library put it (under the root, with `/`) and its version there. */
  library?: { path: string; version: number; date: string };
}

const TripoTerms = "https://www.tripo3d.ai/terms";

function freeFolder(base: string, name: string): { folder: string; name: string } {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${name}_${n}`;
    const folder = path.join(base, `${candidate}.prop.asset`);
    if (!fs.existsSync(folder)) return { folder, name: candidate };
  }
}

const PictureNote = "So far a picture, drawn by OpenAI's GPT Image from your words (OpenAI's terms give you what it makes). Make 3D next.";

const itemName = (folder: string) => path.basename(folder).replace(/\.prop\.asset$/, "");

/**
 * Picture first, step 1: the four views drawn from words, into a new Desk item, or another take into `item`
 * (Change the Words). The item waits on the Desk until Make 3D.
 */
export async function drawPicture(
  words: string,
  opts: { version: string; item?: string; name?: string; base?: string; call?: PictureCall },
): Promise<{ folder: string; name: string; take: PictureTake }> {
  let folder: string, name: string;
  if (opts.item) {
    folder = opts.item;
    name = itemName(folder);
    if (!fs.existsSync(path.join(folder, "asset.json"))) throw new Error(`There is no Desk item at ${folder}.`);
  } else {
    ({ folder, name } = freeFolder(opts.base ?? deskDir(), slug(opts.name ?? words)));
  }
  const raw = path.join(folder, "source", "raw", name);
  fs.mkdirSync(raw, { recursive: true });
  try {
    const take = await drawViews(words, raw, opts.call);
    const assetFile = path.join(folder, "asset.json");
    const old: AssetRecord | undefined = fs.existsSync(assetFile) ? JSON.parse(fs.readFileSync(assetFile, "utf8")) : undefined;
    const picture = { words: take.words, model: take.model, take: take.take };
    const did = `Drew picture ${take.take} from "${take.words}"`;
    const asset: AssetRecord = old
      ? { ...old, from: "tripo" in old.from ? old.from : { picture }, history: [...old.history, { tool: `EDGEfab ${opts.version}`, did, date: take.date }] }
      : {
          format: 1,
          id: randomUUID(),
          name: opts.name ?? words.trim(),
          kind: "prop",
          main: null,
          version: 1,
          from: { picture },
          license: { source: "openai", note: PictureNote },
          history: [{ tool: `EDGEfab ${opts.version}`, did, date: take.date }],
          tools: { edgefab: opts.version },
        };
    fs.writeFileSync(assetFile, JSON.stringify(asset, null, 2));
    return { folder, name, take };
  } catch (e) {
    if (!opts.item) fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
}

export async function makeModel(
  req: MakeRequest,
  opts: { version: string; base?: string; prepare?: PrepareOptions; call?: TripoCall; onProgress?: (step: string, task?: TripoTask) => void } = { version: "0.0.0" },
): Promise<MadeModel> {
  const base = opts.base ?? deskDir();
  let folder: string, name: string;
  if (req.from === "picture") {
    folder = req.item;
    name = itemName(folder);
  } else {
    ({ folder, name } = freeFolder(base, slug(req.name ?? (req.from === "file" ? path.basename(req.file, path.extname(req.file)) : req.request.prompt))));
  }
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
      let request: TextToModel;
      let picture: { words: string; model: string; take: number } | undefined;
      if (req.from === "picture") {
        const take = readPictures(raw)?.takes.at(-1);
        if (!take) throw new Error(`${name} has no picture yet: draw one first.`);
        picture = { words: take.words, model: take.model, take: take.take };
        request = { ...req.request, prompt: take.words, views: take.views };
      } else request = req.request;
      progress(request.views ? "Sending the four views to Tripo..." : "Asking Tripo for the model...");
      const made = await generateModel(request, raw, opts.call, (t, step) => progress(`Tripo${step === "texture" ? ", texturing the parts" : ""}: ${t.status}${t.progress !== undefined ? ` ${t.progress}%` : ""}`, t));
      original = path.join(raw, "original.glb");
      fs.renameSync(made.glb, original);
      paidFor = true;
      preview = made.preview;
      const quality = { ...(request.textureQuality ? { texture: request.textureQuality } : {}), ...(request.geometryQuality ? { shape: request.geometryQuality } : {}) };
      from = {
        tripo: {
          task: made.taskId,
          prompt: made.prompt,
          model: made.model,
          credits: made.credits,
          ...(made.textureTask ? { textureTask: made.textureTask } : {}),
          ...(request.parts ? { parts: true } : {}),
          ...(Object.keys(quality).length ? { quality } : {}),
          ...(picture ? { picture } : {}),
        },
      };
      license = plan === "paid"
        ? { source: "tripo", plan, terms: TripoTerms, note: "Made on a paid Tripo plan: the model is yours to use, change and release (Tripo's terms, 5.2.2)." }
        : { source: "tripo", plan, terms: TripoTerms, note: "Made on a free Tripo plan: Tripo keeps all rights to the model (Tripo's terms, 5.2.1). Don't release it in a mod." };
      did = picture ? `Made by Tripo from picture ${picture.take} ("${made.prompt}")` : `Made by Tripo from "${made.prompt}"`;
    }
    progress("Preparing it for the game...");
    const prepared = await prepareModel(original, raw, name, opts.prepare);
    const old: AssetRecord | undefined = req.from === "picture" ? JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8")) : undefined;
    const asset: AssetRecord = {
      format: 1,
      id: old?.id ?? randomUUID(),
      name: old?.name ?? (req.from === "file" ? (req.name ?? path.basename(req.file, path.extname(req.file))) : req.from === "tripo" ? (req.name ?? req.request.prompt.trim()) : name),
      kind: "prop",
      main: old?.main ?? null, // the .ent's game path, once Add to Project has made it
      // A model made again from the same item's pictures is a new version of it.
      version: old && "tripo" in old.from ? old.version + 1 : (old?.version ?? 1),
      from,
      license,
      history: [...(old?.history ?? []), { tool: `EDGEfab ${opts.version}`, did, date: new Date().toISOString() }],
      tools: { edgefab: opts.version },
    };
    fs.writeFileSync(path.join(raw, "prepared.json"), JSON.stringify(prepared, null, 2));
    fs.writeFileSync(path.join(folder, "asset.json"), JSON.stringify(asset, null, 2));
    return { folder, name, asset, prepared, preview };
  } catch (e) {
    // Tripo's model cost credits: keep it, so it can be prepared again once the problem is fixed.
    if (paidFor) throw new Error(`${e instanceof Error ? e.message : String(e)} Tripo's model is kept at ${path.join(raw, "original.glb")}: Import a GLB takes it again.`);
    // A picture item keeps its pictures; anything else made only now goes.
    if (req.from !== "picture") fs.rmSync(folder, { recursive: true, force: true });
    throw e;
  }
}

/**
 * Set Size: the prepared model scaled to `height` metres (the game's GLB and the one to look at), for a model that
 * came with no real size (Tripo's in parts) or the wrong one. Add to Project again carries it over.
 */
export async function setSize(folder: string, height: number, opts: { version: string }): Promise<PrepareResult> {
  if (!(height > 0 && height <= 100)) throw new Error("A height in metres, above 0 and up to 100.");
  const name = itemName(folder);
  const raw = path.join(folder, "source", "raw", name);
  const preparedFile = path.join(raw, "prepared.json");
  if (!fs.existsSync(preparedFile)) throw new Error(`${name} isn't a model yet: make it first.`);
  const prepared = JSON.parse(fs.readFileSync(preparedFile, "utf8")) as PrepareResult;
  const k = height / prepared.size.height;
  const io = new NodeIO().setLogger(quiet).registerExtensions(ALL_EXTENSIONS);
  for (const file of [prepared.glb, prepared.view].filter((f): f is string => !!f && fs.existsSync(f))) {
    const doc = await io.read(file);
    for (const a of new Set(doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives().map((p) => p.getAttribute("POSITION")!)))) {
      const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        a.setElement(i, [v[0] * k, v[1] * k, v[2] * k]);
      }
    }
    await io.write(file, doc);
  }
  prepared.size = { height: prepared.size.height * k, width: prepared.size.width * k, depth: prepared.size.depth * k };
  delete prepared.sizeUnknown;
  prepared.notes = [...prepared.notes.filter((n) => !/^Tripo gave no real size|^Scaled to .* tall/.test(n)), `Scaled to ${+height.toFixed(3)} m tall.`];
  fs.writeFileSync(preparedFile, JSON.stringify(prepared, null, 2));
  const assetFile = path.join(folder, "asset.json");
  const asset = JSON.parse(fs.readFileSync(assetFile, "utf8")) as AssetRecord;
  asset.history.push({ tool: `EDGEfab ${opts.version}`, did: `Set its size to ${+height.toFixed(3)} m tall`, date: new Date().toISOString() });
  fs.writeFileSync(assetFile, JSON.stringify(asset, null, 2));
  return prepared;
}
