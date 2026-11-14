// Prepare: a textured GLB made ready for WolvenKit's mesh importer (through REDbridge), in Node, without
// Blender. What the importer needs was found in F0 (docs/testing.md, "a GLB imported over a game prop"):
// - tangents on every mesh (it refuses a GLB without them): MikkTSpace, as Blender makes them;
// - one primitive per mesh, each mesh one submesh, its node named the same;
// - at most 65,535 vertices per submesh;
// - node transforms baked in (it reads vertex positions as they are, and only turns Y up into Z up);
// - LODs named in the mesh: submesh_00_LOD_1 (full), _LOD_2, _LOD_4.
// And for a prop: its base at height 0, centred across, as the game's props stand, and its front toward the
// game's forward: glTF's -Z, which the importer makes the game's +Y. Tripo's models face +X (checked on text to
// model and multiview, docs/testing.md "Tripo's model and its front"), so they are turned a quarter.
// The textures are written out as image files, for the materials (EDGEmat), and left out of the GLB.

import * as fs from "node:fs";
import * as path from "node:path";
import { Document, NodeIO, type Mesh, type Node, type Primitive, type Texture } from "@gltf-transform/core";
import { quiet } from "./quiet";
import { ALL_EXTENSIONS, type EmissiveStrength } from "@gltf-transform/extensions";
import { clearNodeTransform, cloneDocument, compactPrimitive, flatten, getBounds, normals, prune, simplifyPrimitive, tangents, unweld, weld } from "@gltf-transform/functions";
// meshoptimizer is an ES module and this package is CommonJS: esbuild bundles it either way, and TypeScript
// only objects to the module kind.
// @ts-expect-error TS1479
import { MeshoptSimplifier } from "meshoptimizer";
import { generateTangents } from "mikktspace";
import { addBackFaces, groupParts } from "./parts";

/** WolvenKit's limit: a submesh's indices are 16-bit. */
/** At most this many parts: each is one submesh, material and texture set (parts.ts groups them). */
export const MaxParts = 10;

export interface PreparedPart {
  /** The part's name in plain words ("body", "glass", "inside", "front"...), before prepare puts the model's name in front. */
  name: string;
  /** Its material, as prepare names it. */
  material: string;
  /** How many of the model's pieces it holds. */
  pieces: number;
  triangles: number;
  /** Its share of the model's surface, 0 to 1. */
  share: number;
}

export const MaxSubmeshVertices = 65535;

export interface LodLevel {
  /** The LOD bit WolvenKit reads from the name: 1 (full detail), 2, 4 or 8. */
  lod: 1 | 2 | 4 | 8;
  /** The share of triangles kept. */
  ratio: number;
  /** How far the simplified surface may stray, as a share of the part's size; the level stops there even above its ratio. 0.01 if not given. */
  error?: number;
}

/** Full detail, half, a fifth: with the template's switch distances (8 m and 20 m for the barrel in F0). The last
 *  strays further, so it drops more on a model already low in triangles. */
export const DefaultLods: LodLevel[] = [
  { lod: 1, ratio: 1 },
  { lod: 2, ratio: 0.5, error: 0.01 },
  { lod: 4, ratio: 0.2, error: 0.02 },
];

export interface PrepareOptions {
  lods?: LodLevel[];
  /** Stand the model on its base, centred across (props). Default on. */
  ground?: boolean;
  /**
   * Which way the model's front faces, in glTF's axes, so it is turned to face the game's forward (-Z).
   * "auto" (the default): +X for a model Tripo made (its asset generator names Tripo), else left as it is.
   */
  front?: Facing | "auto";
  /** Its height in metres: the model is scaled to it. For a model with no real size (Tripo's in parts). */
  height?: number;
  /** A model of more than MaxParts pieces grouped into named parts, each with one material. Default on. */
  parts?: boolean;
  /** Back faces for parts open on one side and marked double-sided. Default on. */
  backFaces?: boolean;
}

export type Facing = "+X" | "-X" | "+Z" | "-Z";

/** The turn about the up axis (Y) that brings each facing to -Z, in degrees. */
const TurnToForward: Record<Facing, number> = { "+X": 90, "-X": -90, "+Z": 180, "-Z": 0 };

export interface PreparedTexture {
  material: string;
  /** glTF's slot: baseColor, metallicRoughness (glTF's ORM packing when occlusion shares it), normal, occlusion, emissive. */
  slot: "baseColor" | "metallicRoughness" | "normal" | "occlusion" | "emissive";
  file: string;
  mimeType: string;
}

export interface PreparedSubmesh {
  name: string;
  lod: number;
  material: string;
  vertices: number;
  triangles: number;
  /** The vertex attributes written, such as POSITION, NORMAL, TEXCOORD_0, TANGENT. */
  attributes: string[];
}

/**
 * A material's glow (glTF's emissive): what EDGEmat needs to make the game material glow (metal_base's
 * Emissive texture, EmissiveColor and EmissiveEV). glTF's light is color x strength x texture.
 */
export interface PreparedGlow {
  material: string;
  /** glTF's emissiveFactor, linear RGB 0 to 1. */
  color: [number, number, number];
  /** KHR_materials_emissive_strength (how much brighter than 1), 1 without it. */
  strength: number;
  /** The emissive texture written out, when the glow follows a map (screens, signs) rather than the whole part. */
  texture?: string;
  /** EDGEfab made this glow from the painted lights (core/glow.ts), rather than the model having it. */
  painted?: boolean;
}

export interface PrepareResult {
  glb: string;
  submeshes: PreparedSubmesh[];
  /** Height, width and depth in metres, after the node transforms. */
  size: { height: number; width: number; depth: number };
  materials: string[];
  textures: PreparedTexture[];
  /** The materials that glow; empty when none does. Tripo's models never glow: their lights are painted in. */
  glow: PreparedGlow[];
  /** A GLB to look at in REDcode's 3D view: the same parts and levels, with their textures (the game's GLB has none). */
  view?: string;
  /** Its parts, when its pieces were grouped (core/parts.ts): each one submesh with its own material. */
  parts?: PreparedPart[];
  /** Tripo gave no real size and none was asked for: its height is a guess until Set Size. */
  sizeUnknown?: boolean;
  /** Things changed or left out that the modder should know. */
  notes: string[];
}

export class PrepareError extends Error {}

const two = (n: number) => String(n).padStart(2, "0");

function cloneDeep(doc: Document, prim: Primitive): Primitive {
  // Primitive.clone() shares its accessors; a LOD needs its own data to simplify.
  const copy = prim.clone();
  for (const semantic of copy.listSemantics()) {
    const a = copy.getAttribute(semantic)!;
    copy.setAttribute(semantic, a.clone().setArray(a.getArray()!.slice()));
  }
  const indices = copy.getIndices();
  if (indices) copy.setIndices(indices.clone().setArray(indices.getArray()!.slice()));
  return copy;
}

/**
 * A lower level of detail. The normals count as well as the positions: simplified by positions alone, a box-like
 * model's lower levels kept vertex normals that no longer matched their triangles, which the game and the 3D view
 * drew as dark shards across flat panels (the owner's pass, 2026-11-14: about 1% of the surface at LOD 2 and 4,
 * against 0.2% at LOD 1). With the normals weighed in, it stays near LOD 1's.
 */
function simplifyLevel(prim: Primitive, level: LodLevel): void {
  const error = level.error ?? 0.01;
  const normal = prim.getAttribute("NORMAL")?.getArray();
  if (!(normal instanceof Float32Array)) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: level.ratio, error });
    return;
  }
  const indices = prim.getIndices()!;
  const idx = Uint32Array.from(indices.getArray()!);
  const target = Math.floor((level.ratio * idx.length) / 3) * 3;
  const [out] = MeshoptSimplifier.simplifyWithAttributes(idx, Float32Array.from(prim.getAttribute("POSITION")!.getArray()!), 3, Float32Array.from(normal), 3, [0.5, 0.5, 0.5], null, target, error, []);
  indices.setArray(new Uint32Array(out));
  compactPrimitive(prim);
}

/** Whether Tripo made the file: its asset generator, read from the file itself (glTF-Transform replaces it on
 *  reading), or Tripo's node names (tripo_node_<task>). */
function madeByTripo(input: string, doc: Document): boolean {
  try {
    const b = fs.readFileSync(input);
    const json = b.readUInt32LE(0) === 0x46546c67 ? b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8") : b.toString("utf8");
    if (/tripo/i.test(JSON.parse(json).asset?.generator ?? "")) return true;
  } catch {
    // fall back on the node names
  }
  return doc.getRoot().listNodes().some((n) => /^tripo_node_/i.test(n.getName()));
}

const vertexCount = (prim: Primitive) => prim.getAttribute("POSITION")?.getCount() ?? 0;
const triangleCount = (prim: Primitive) => (prim.getIndices()?.getCount() ?? vertexCount(prim)) / 3;

/** Prepares `input` (a .glb or .gltf) into `outDir`: `<name>.glb` and the textures beside it. */
export async function prepareModel(input: string, outDir: string, name: string, options: PrepareOptions = {}): Promise<PrepareResult> {
  const lods = options.lods ?? DefaultLods;
  if (!lods.some((l) => l.lod === 1)) throw new PrepareError("The LODs must include LOD 1, the full model.");
  const notes: string[] = [];
  const io = new NodeIO().setLogger(quiet).registerExtensions(ALL_EXTENSIONS);
  let doc: Document;
  try {
    doc = await io.read(input);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new PrepareError(/draco|meshopt/i.test(why) ? "This GLB is compressed (Draco or meshopt); EDGEfab can't read compressed GLBs yet. Export it without compression." : `This file could not be read as glTF: ${why}`);
  }
  const root = doc.getRoot();
  if (root.listSkins().length) throw new PrepareError("This model is rigged (it has a skin). Rigged and animated models come in a later EDGEfab; props are still models.");
  if (root.listAnimations().length) {
    for (const a of root.listAnimations()) a.dispose();
    notes.push("Its animations were left out: a prop is still.");
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new PrepareError("This GLB has no scene.");

  // Tripo puts the real size on the node (auto_size); its models in parts come without one.
  const byTripo = madeByTripo(input, doc);
  const sized = root.listNodes().some((n) => n.getScale().some((v) => Math.abs(v - 1) > 1e-6));
  // Turn its front to the game's forward, under one parent node, which the baking below takes in.
  const front = (options.front ?? "auto") === "auto" ? (byTripo ? "+X" : "-Z") : (options.front as Facing);
  const turn = TurnToForward[front];
  if (turn) {
    const half = (turn * Math.PI) / 360;
    const parent = doc.createNode("edgefab_turn").setRotation([0, Math.sin(half), 0, Math.cos(half)]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      parent.addChild(child);
    }
    scene.addChild(parent);
    notes.push(front === "+X" ? "Turned a quarter to face forward: Tripo's models face sideways." : `Turned ${Math.abs(turn)}° to face forward (its front was ${front}).`);
  }

  // Bake every node's transform into its mesh. A mesh used by several nodes is copied first, since each
  // submesh needs its own vertices.
  await doc.transform(flatten());
  for (const n of root.listNodes()) if (n.getName() === "edgefab_turn" && !n.listChildren().length) n.dispose();
  const used = new Set<Mesh>();
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (used.has(mesh)) {
      const copy = doc.createMesh(mesh.getName());
      for (const p of mesh.listPrimitives()) copy.addPrimitive(cloneDeep(doc, p));
      node.setMesh(copy);
    } else used.add(mesh);
    clearNodeTransform(node);
  }

  // Only triangles: points and lines have no surface.
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) {
        mesh.removePrimitive(prim);
        notes.push(`A part made of ${prim.getMode() < 4 ? "points or lines" : "triangle strips or fans"} was left out.`);
      }
    }
  }
  const prims = root.listMeshes().flatMap((m) => m.listPrimitives());
  if (!prims.length) throw new PrepareError("This model has no triangles.");
  if (prims.some((p) => !p.getAttribute("TEXCOORD_0"))) throw new PrepareError("This model has a part without UVs (texture coordinates), so it can't be textured. Unwrap it in a 3D tool first.");

  // Stand it on its base, centred across. glTF is Y up.
  const bounds = getBounds(scene);
  if (options.ground ?? true) {
    const offset = [-(bounds.min[0] + bounds.max[0]) / 2, -bounds.min[1], -(bounds.min[2] + bounds.max[2]) / 2];
    for (const prim of prims) {
      const pos = prim.getAttribute("POSITION")!;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        pos.setElement(i, [v[0] + offset[0], v[1] + offset[1], v[2] + offset[2]]);
      }
    }
  }
  const size = { height: bounds.max[1] - bounds.min[1], width: bounds.max[0] - bounds.min[0], depth: bounds.max[2] - bounds.min[2] };
  let sizeUnknown = false;
  if (options.height && options.height > 0 && size.height > 0) {
    const k = options.height / size.height;
    for (const prim of prims) {
      const pos = prim.getAttribute("POSITION")!;
      const v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        pos.setElement(i, [v[0] * k, v[1] * k, v[2] * k]);
      }
    }
    size.height *= k;
    size.width *= k;
    size.depth *= k;
    notes.push(`Scaled to ${options.height} m tall, as asked.`);
  } else if (byTripo && !sized) {
    sizeUnknown = true;
    notes.push(`Tripo gave no real size (it doesn't for models in parts): it is ${size.height.toFixed(2)} m tall for now. Set its size before adding it to a project.`);
  }
  if (size.height > 50 || size.width > 50 || size.depth > 50) notes.push(`It is ${Math.round(Math.max(size.height, size.width, size.depth))} m across: check its scale (glTF is in metres).`);
  if (Math.max(size.height, size.width, size.depth) < 0.02) notes.push("It is under 2 cm across: check its scale (glTF is in metres).");

  // normals() unwelds every mesh, even ones that have normals, so it runs only when a part lacks them.
  if (prims.some((p) => !p.getAttribute("NORMAL"))) {
    await doc.transform(normals({ overwrite: false }));
    notes.push("Normals were missing and were made.");
  }
  // Many pieces into a few named parts (Tripo's generate_parts).
  const parts = options.parts === false ? undefined : groupParts(doc, notes);
  await doc.transform(weld());
  await MeshoptSimplifier.ready;

  // Name the materials plainly and take their textures out.
  fs.mkdirSync(outDir, { recursive: true });
  const textures: PreparedTexture[] = [];
  const written = new Map<Texture, string>();
  const materials = root.listMaterials();
  materials.forEach((m, i) => m.setName(parts ? `${name}_${m.getName()}` : `${name}_${two(i)}`));
  for (const part of parts ?? []) part.material = `${name}_${part.name}`;
  for (const m of materials) {
    const slots: [PreparedTexture["slot"], Texture | null][] = [
      ["baseColor", m.getBaseColorTexture()],
      ["metallicRoughness", m.getMetallicRoughnessTexture()],
      ["normal", m.getNormalTexture()],
      ["occlusion", m.getOcclusionTexture()],
      ["emissive", m.getEmissiveTexture()],
    ];
    for (const [slot, tex] of slots) {
      if (!tex) continue;
      if (slot === "occlusion" && tex === m.getMetallicRoughnessTexture()) continue; // glTF's ORM packing: one image
      const image = tex.getImage();
      if (!image) continue;
      const mimeType = tex.getMimeType() || "image/png";
      const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : mimeType === "image/ktx2" ? "ktx2" : "png";
      let file = written.get(tex);
      if (!file) {
        file = path.join(outDir, `${m.getName()}_${slot === "metallicRoughness" ? "orm" : slot.toLowerCase()}.${ext}`);
        fs.writeFileSync(file, image);
        written.set(tex, file);
      }
      textures.push({ material: m.getName(), slot, file, mimeType });
    }
  }
  if (!textures.length) notes.push("It has no textures: it will need a material of its own.");

  // Glow: kept for the game material. glTF's emissive is black unless the factor says otherwise.
  const glow: PreparedGlow[] = [];
  for (const m of materials) {
    const [r, g, b] = m.getEmissiveFactor();
    if (Math.max(r, g, b) <= 0) continue;
    const strength = m.getExtension<EmissiveStrength>("KHR_materials_emissive_strength")?.getEmissiveStrength() ?? 1;
    const texture = textures.find((x) => x.material === m.getName() && x.slot === "emissive")?.file;
    glow.push({ material: m.getName(), color: [r, g, b], strength, ...(texture ? { texture } : {}) });
  }

  // One mesh per primitive, each with its LODs.
  const submeshes: PreparedSubmesh[] = [];
  const sources: { prim: Primitive; material: string }[] = [];
  for (const node of [...root.listNodes()]) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) sources.push({ prim, material: prim.getMaterial()?.getName() ?? "" });
  }
  const meshNodes: Node[] = [];
  for (const node of root.listNodes()) if (node.getMesh()) meshNodes.push(node);

  for (const [index, { prim, material }] of sources.entries()) {
    if (vertexCount(prim) > Math.floor(MaxSubmeshVertices * 0.75)) {
      const before = triangleCount(prim);
      // The budget must be met, so no error bound; the ratio is of triangles, so step down until the vertices fit,
      // with room for the vertices tangents split along seams.
      const budget = Math.floor(MaxSubmeshVertices * 0.75);
      for (let i = 0; i < 6 && vertexCount(prim) > budget; i++) {
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: (budget * 0.95) / vertexCount(prim), error: 1 });
      }
      if (vertexCount(prim) > budget) throw new PrepareError(`Part ${index + 1} has too many vertices for the game (over ${MaxSubmeshVertices}) even simplified. Reduce it in a 3D tool, or ask Tripo for fewer faces.`);
      notes.push(`Part ${index + 1} was simplified from ${before} to ${triangleCount(prim)} triangles to stay under the game's ${MaxSubmeshVertices} vertices per part.`);
    }
    for (const level of [...lods].sort((a, b) => a.lod - b.lod)) {
      const { lod, ratio } = level;
      const meshName = `submesh_${two(index)}_LOD_${lod}`;
      const copy = cloneDeep(doc, prim);
      if (ratio < 1) simplifyLevel(copy, level);
      const mesh = doc.createMesh(meshName).addPrimitive(copy);
      scene.addChild(doc.createNode(meshName).setMesh(mesh));
      submeshes.push({ name: meshName, lod, material, vertices: 0, triangles: 0, attributes: [] });
    }
  }
  // The originals go; the submeshes stay.
  for (const node of meshNodes) node.dispose();
  for (const m of root.listMeshes()) if (!/^submesh_\d\d_LOD_\d$/.test(m.getName())) m.dispose();
  // Back faces for open double-sided parts, on each level after simplifying (doubled faces lock the simplifier).
  if (options.backFaces !== false) {
    const backed = addBackFaces(doc).filter((m) => /_LOD_1$/.test(m)).length;
    if (backed) notes.push(`${backed} part${backed > 1 ? "s are" : " is"} open on one side and marked double-sided: back faces were added, so ${backed > 1 ? "they aren't" : "it isn't"} see-through in the game.`);
  }

  await doc.transform(unweld(), tangents({ generateTangents, overwrite: true }), weld());

  // A copy to look at, before the textures go. REDcode's 3D view reads the submesh_NN_LOD_N names: a level picker
  // and a list of parts to show or hide, as for a game mesh.
  const look = cloneDocument(doc);
  await look.transform(prune({ keepAttributes: true }));
  const lookBuffer = look.getRoot().listBuffers()[0] ?? look.createBuffer();
  for (const a of look.getRoot().listAccessors()) if (!a.getBuffer()) a.setBuffer(lookBuffer);
  const view = path.join(outDir, "view.glb");
  await io.write(view, look);

  for (const t of root.listTextures()) t.dispose();
  // keepAttributes: with the textures taken out, prune would drop the UVs and tangents as unused.
  await doc.transform(prune({ keepAttributes: true }));
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  for (const a of root.listAccessors()) if (!a.getBuffer()) a.setBuffer(buffer);

  for (const s of submeshes) {
    const p = root.listMeshes().find((m) => m.getName() === s.name)!.listPrimitives()[0];
    s.vertices = vertexCount(p);
    s.triangles = triangleCount(p);
    const missing = ["POSITION", "NORMAL", "TEXCOORD_0", "TANGENT"].filter((a) => !p.getAttribute(a));
    if (missing.length) throw new PrepareError(`${s.name} lacks ${missing.join(", ")} after preparing (an EDGEfab bug: please report it).`);
    s.attributes = p.listSemantics();
    if (s.vertices > MaxSubmeshVertices) throw new PrepareError(`${s.name} has ${s.vertices} vertices after tangents; the game takes ${MaxSubmeshVertices}.`);
  }
  const glb = path.join(outDir, `${name}.glb`);
  await io.write(glb, doc);
  return { glb, submeshes, size, materials: materials.map((m) => m.getName()), textures, glow, view, ...(parts ? { parts } : {}), ...(sizeUnknown ? { sizeUnknown } : {}), notes };
}

/**
 * An item's prepared.json, its files found beside it: the paths it records are where the model was made, and
 * an item copied or moved since (Rename, the Library, Edit on the Desk) keeps them. Undefined when there is none.
 */
export function readPrepared(raw: string): PrepareResult | undefined {
  let prepared: PrepareResult;
  try {
    prepared = JSON.parse(fs.readFileSync(path.join(raw, "prepared.json"), "utf8")) as PrepareResult;
  } catch {
    return undefined;
  }
  const here = (f: string) => path.join(raw, path.basename(f));
  return {
    ...prepared,
    glb: here(prepared.glb),
    view: prepared.view ? here(prepared.view) : undefined,
    textures: prepared.textures.map((t) => ({ ...t, file: here(t.file) })),
    glow: (prepared.glow ?? []).map((g) => ({ ...g, texture: g.texture ? here(g.texture) : undefined })),
  };
}
