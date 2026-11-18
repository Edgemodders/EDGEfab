// What a second Add to Project keeps (EDGEfab #6, and the kept parts of EDGEmat #12).
//
// Materials: each material's record says what it was made from. On the next add, a material made from the
// same things keeps its .mi and textures in the project, and only the changed ones are made again. "The same"
// is the same file bytes, or, when the bytes differ (another program wrote the same picture out again), the
// same pixels.
//
// Parts: a part whose material entry in the project's mesh is no longer EDGEfab's own .mi was given another
// look since (EDGEmat's applyMaterial: a game .mi, a layered setup). Its entry is carried over to the new mesh
// as it is. The mesh's material entry is the only record of a swap.

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { decode } from "./pixels";
import type { PrepareResult } from "./prepare";
import { quiet } from "./quiet";

/**
 * Raise it when the same source would make a different material: a change here to what Add to Project asks
 * of EDGEmat's core, or a newer @edgemodders/edgemat-core that writes textures or the .mi differently. Every
 * material is then made again once.
 */
export const MaterialRecipe = 1;

type Json = any;

export interface ImageSource {
  /** sha1 of the file. */
  bytes: string;
  /** sha1 of its size and decoded pixels; filled when the material is made, and when the bytes differ. */
  pixels?: string;
}

/** What one material was made from. */
export interface MaterialSource {
  /** MaterialRecipe, and the options that change the result (the normal maps' green). */
  recipe: string;
  /** The glTF material's own values (factors, alpha, double-sided), without its texture indices. */
  def: string;
  /** By slot: baseColor, orm, normal, glow. */
  images: Record<string, ImageSource>;
  glow?: { color: [number, number, number]; strength: number };
}

const sha1 = (data: crypto.BinaryLike) => crypto.createHash("sha1").update(data).digest("hex");

/** A GLB's JSON part. */
function glbJson(file: string): Json | undefined {
  try {
    const b = fs.readFileSync(file);
    if (b.readUInt32LE(0) !== 0x46546c67) return undefined;
    return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
  } catch {
    return undefined;
  }
}

/** Sorted keys, and no texture indices: they change with the order the images were written in. */
function stable(v: Json, key?: string): Json {
  if (Array.isArray(v)) return v.map((x) => stable(x));
  if (v && typeof v === "object") {
    const out: Record<string, Json> = {};
    for (const k of Object.keys(v).sort()) {
      if (k === "index" && /Texture$/i.test(key ?? "")) continue;
      if (k === "name") continue;
      out[k] = stable(v[k], k);
    }
    return out;
  }
  return v;
}

export interface Sources {
  /** By material name. */
  sources: Record<string, MaterialSource>;
  /** The image files behind each source, by material name and slot. */
  files: Record<string, Record<string, string>>;
}

/** What each of a prepared model's materials would be made from now. Reads file bytes only: fast. */
export function materialSources(prepared: PrepareResult, opts: { flipNormalGreen: boolean }): Sources {
  const defs = new Map<string, string>();
  const gltf = prepared.view ? glbJson(prepared.view) : undefined;
  for (const m of gltf?.materials ?? []) defs.set(String(m.name), JSON.stringify(stable(m)));
  const sources: Sources["sources"] = {};
  const files: Sources["files"] = {};
  const slotOf: Record<string, string> = { baseColor: "baseColor", metallicRoughness: "orm", normal: "normal" };
  for (const name of prepared.materials) {
    const f: Record<string, string> = {};
    for (const t of prepared.textures) if (t.material === name && slotOf[t.slot]) f[slotOf[t.slot]] = t.file;
    const glow = prepared.glow.find((g) => g.material === name);
    if (glow?.texture) f.glow = glow.texture;
    const images: Record<string, ImageSource> = {};
    for (const [slot, file] of Object.entries(f)) images[slot] = { bytes: fs.existsSync(file) ? sha1(fs.readFileSync(file)) : "missing" };
    sources[name] = {
      recipe: `${MaterialRecipe}/${opts.flipNormalGreen ? "green down" : "green up"}`,
      def: defs.get(name) ?? "",
      images,
      ...(glow ? { glow: { color: glow.color, strength: glow.strength } } : {}),
    };
    files[name] = f;
  }
  return { sources, files };
}

/** A picture's pixels, whatever wrote the file. */
function pixelsOf(file: string): string {
  try {
    const img = decode(fs.readFileSync(file), "");
    return sha1(Buffer.concat([Buffer.from(`${img.width}x${img.height}:`), Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length)]));
  } catch {
    return "unreadable";
  }
}

/** Fills in the pixels of a source's images (for the record), keeping the ones already known. */
export function withPixels(source: MaterialSource, files: Record<string, string>): MaterialSource {
  for (const [slot, img] of Object.entries(source.images)) if (!img.pixels && files[slot] && img.bytes !== "missing") img.pixels = pixelsOf(files[slot]);
  return source;
}

/** Whether a material would be made from the same things as last time. */
export function sameSource(now: MaterialSource, before: MaterialSource | undefined, files: Record<string, string>): boolean {
  if (!before || now.recipe !== before.recipe || now.def !== before.def) return false;
  if (JSON.stringify(now.glow ?? null) !== JSON.stringify(before.glow ?? null)) return false;
  const slots = Object.keys(now.images).sort();
  if (slots.join() !== Object.keys(before.images ?? {}).sort().join()) return false;
  for (const slot of slots) {
    const a = now.images[slot], b = before.images[slot];
    if (a.bytes === "missing") return false;
    if (a.bytes === b.bytes) {
      a.pixels ??= b.pixels;
      continue;
    }
    // Other bytes: the same picture written out again counts as the same.
    if (!b.pixels) return false;
    a.pixels ??= pixelsOf(files[slot]);
    if (a.pixels !== b.pixels) return false;
  }
  return true;
}

/**
 * The model to look at, with only some of its materials, for EDGEmat's core to make just those. A temporary
 * file named as the model, so EDGEmat's own record keeps its name. The caller removes the folder.
 */
export async function modelWithOnly(view: string, materials: string[], tempDir: string): Promise<string> {
  const io = new NodeIO().setLogger(quiet).registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(view);
  const keep = new Set(materials);
  for (const m of doc.getRoot().listMaterials()) if (!keep.has(m.getName())) m.dispose();
  await doc.transform(prune({ keepAttributes: true, keepLeaves: true }));
  fs.mkdirSync(tempDir, { recursive: true });
  const out = path.join(tempDir, path.basename(view));
  await io.write(out, doc);
  return out;
}

// ---- a mesh's material entries -------------------------------------------------------------------------

const valueOf = (v: Json) => (v && typeof v === "object" && "$value" in v ? v.$value : v);
const samePath = (a: string, b: string) => a.replace(/\//g, "\\").toLowerCase() === b.replace(/\//g, "\\").toLowerCase();

/** A mesh's local material instances, in the list its entries index. */
function localList(root: Json): Json[] | undefined {
  if (root.localMaterialBuffer?.materials?.length) return root.localMaterialBuffer.materials;
  if (root.preloadLocalMaterialInstances?.length) return root.preloadLocalMaterialInstances.map((x: Json) => x.Data);
  return undefined;
}

/** What a mesh entry looks like now: its local instance, or the external material it points at. */
export interface EntryLook {
  /** The base material's path (the .mi or .mt), when there is one. */
  base?: string;
  /** The local instance as it is, to carry over. Undefined for an external material. */
  instance?: Json;
}

/** Each material entry of a mesh (WolvenKit JSON), by name. */
export function entryLooks(json: Json): Map<string, EntryLook> {
  const root = json?.Data?.RootChunk;
  const out = new Map<string, EntryLook>();
  const local = localList(root ?? {});
  const external: Json[] = root?.externalMaterials?.length ? root.externalMaterials : (root?.preloadExternalMaterials ?? []);
  for (const e of root?.materialEntries ?? []) {
    const name = String(valueOf(e.name));
    if (e.isLocalInstance) {
      const instance = local?.[e.index];
      if (instance) out.set(name, { base: valueOf(instance.baseMaterial?.DepotPath), instance });
    } else {
      const x = external[e.index];
      const base = valueOf(x?.DepotPath) ?? valueOf(x?.Data?.DepotPath);
      if (base) out.set(name, { base: String(base) });
    }
  }
  return out;
}

/** Whether an entry no longer wears EDGEfab's own material for it: someone gave the part another look. */
export function isSwapped(look: EntryLook, ownMi: string): boolean {
  if (!look.base) return false;
  if (!samePath(look.base, ownMi)) return true;
  return !!look.instance?.values?.length;
}

/**
 * Sets entries of a freshly fitted mesh (every entry a local instance): `own` take their .mi as their base
 * with no values, `carried` take an earlier mesh's entry as it was. Answers the names it couldn't place.
 */
export function setEntries(json: Json, own: Map<string, string>, carried: Map<string, EntryLook>): string[] {
  const root = json?.Data?.RootChunk;
  const local = localList(root ?? {});
  const missed: string[] = [];
  const rp = (v: string) => ({ DepotPath: { $type: "ResourcePath", $storage: "string", $value: v }, Flags: "Default" });
  const put = (name: string, make: (now: Json) => Json) => {
    const e = (root?.materialEntries ?? []).find((x: Json) => String(valueOf(x.name)) === name);
    if (!e?.isLocalInstance || !local?.[e.index]) return void missed.push(name);
    const next = make(local[e.index]);
    if (root.localMaterialBuffer?.materials?.length) root.localMaterialBuffer.materials[e.index] = next;
    else root.preloadLocalMaterialInstances[e.index].Data = next;
  };
  for (const [name, mi] of own) put(name, (now) => ({ ...now, baseMaterial: rp(mi), values: [] }));
  for (const [name, look] of carried) put(name, (now) => (look.instance ? structuredClone(look.instance) : { ...now, baseMaterial: rp(look.base!), values: [] }));
  return missed;
}
