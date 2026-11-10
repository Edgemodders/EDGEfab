// Parts: a model in many pieces (Tripo's generate_parts gives 75 for a vending machine, each with its own
// textures) made into a few parts a modder can give materials to, one by one with EDGEmat (owner, 2026-11-09;
// docs/testing.md, "parts from Tripo"). Each small piece joins the large part it sits in or on; small pieces
// close together and large enough together (the bottles behind the glass) make a part of their own. Each part
// becomes one submesh with one material, its pieces' textures packed into one atlas.
//
// Also: back faces for parts that are open on one side and marked double-sided (glTF draws both sides; the
// game's metal_base draws one), so a thin panel isn't see-through in the game.

import { type Document, type Material, type Primitive, type Texture } from "@gltf-transform/core";
import { blank, blit, decode, encodePng, multiply, resize, type Pixels } from "./pixels";

/** At most this many parts: each is a submesh with three levels of detail and its own material. */
export const MaxParts = 10;
const AtlasMax = 4096;
const Pad = 4;
/** A piece with this share of its kind's surface or more is a part of its own. */
const SeedShare = 0.04;

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

type Box = { min: number[]; max: number[] };

interface Piece {
  prim: Primitive;
  material: Material | null;
  pos: Float32Array;
  nrm?: Float32Array;
  uv?: Float32Array;
  idx: Uint32Array;
  box: Box;
  area: number;
  uvArea: number;
  /** Pieces only group with pieces of the same kind: see-through with see-through. */
  kind: string;
}

function read(prim: Primitive, semantic: string, size: number): Float32Array | undefined {
  const a = prim.getAttribute(semantic);
  if (!a) return undefined;
  const n = a.getCount();
  const out = new Float32Array(n * size);
  const e: number[] = [];
  for (let i = 0; i < n; i++) {
    a.getElement(i, e);
    for (let c = 0; c < size; c++) out[i * size + c] = e[c];
  }
  return out;
}

function indicesOf(prim: Primitive, vertices: number): Uint32Array {
  const ix = prim.getIndices();
  if (!ix) return Uint32Array.from({ length: vertices }, (_, i) => i);
  return Uint32Array.from(ix.getArray()!);
}

function pieceOf(prim: Primitive): Piece {
  const pos = read(prim, "POSITION", 3)!;
  const idx = indicesOf(prim, pos.length / 3);
  const uv = read(prim, "TEXCOORD_0", 2);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let c = 0; c < 3; c++) {
    min[c] = Math.min(min[c], pos[i + c]);
    max[c] = Math.max(max[c], pos[i + c]);
  }
  let area = 0;
  let uvArea = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
    const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    if (uv) uvArea += Math.abs((uv[b * 2] - uv[a * 2]) * (uv[c * 2 + 1] - uv[a * 2 + 1]) - (uv[c * 2] - uv[a * 2]) * (uv[b * 2 + 1] - uv[a * 2 + 1])) / 2;
  }
  const material = prim.getMaterial();
  return { prim, material, pos, nrm: read(prim, "NORMAL", 3), uv, idx, box: { min, max }, area, uvArea, kind: material?.getAlphaMode() ?? "OPAQUE" };
}

const union = (a: Box, b: Box): Box => ({ min: a.min.map((v, i) => Math.min(v, b.min[i])), max: a.max.map((v, i) => Math.max(v, b.max[i])) });
const gap = (a: Box, b: Box) => Math.hypot(...[0, 1, 2].map((i) => Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i])));
const volume = (b: Box) => [0, 1, 2].reduce((v, i) => v * Math.max(1e-6, b.max[i] - b.min[i]), 1);
const boxOf = (pieces: Piece[], members: number[]) => members.map((i) => pieces[i].box).reduce(union);
const areaOf = (pieces: Piece[], members: number[]) => members.reduce((s, i) => s + pieces[i].area, 0);

interface Group {
  members: number[];
  /** Made of small pieces together, not around a large one. */
  cluster: boolean;
  kind: string;
}

/** The pieces in at most MaxParts groups. */
function groupPieces(pieces: Piece[]): Group[] {
  const all = pieces.map((p) => p.box).reduce(union);
  const tolerance = 0.02 * Math.hypot(...[0, 1, 2].map((i) => all.max[i] - all.min[i]));
  const kinds = new Map<string, number[]>();
  pieces.forEach((p, i) => kinds.set(p.kind, [...(kinds.get(p.kind) ?? []), i]));
  const groups: Group[] = [];
  for (const [kind, members] of kinds) {
    const total = areaOf(pieces, members);
    const order = [...members].sort((a, b) => pieces[b].area - pieces[a].area);
    let seeds = order.filter((i) => pieces[i].area >= SeedShare * total).slice(0, MaxParts);
    if (!seeds.length) seeds = [order[0]];
    const mine: Group[] = seeds.map((s) => ({ members: [s], cluster: false, kind }));
    const seedBoxes = seeds.map((s) => pieces[s].box);
    // A small piece inside a large one's box joins the tightest such (the shelves inside the display), unless only
    // the outer shell, whose box is most of the model's, holds it: those are free to make parts of their own.
    const kindBox = boxOf(pieces, members);
    const shell = (b: Box) => volume(b) >= 0.5 * volume(kindBox);
    const inside = (p: Box, s: Box) => [0, 1, 2].every((k) => (p.min[k] + p.max[k]) / 2 >= s.min[k] - tolerance && (p.min[k] + p.max[k]) / 2 <= s.max[k] + tolerance);
    const rest: number[] = [];
    for (const i of order) {
      if (seeds.includes(i)) continue;
      let best = -1;
      seedBoxes.forEach((s, k) => {
        if (!shell(s) && inside(pieces[i].box, s) && (best < 0 || volume(s) < volume(seedBoxes[best]))) best = k;
      });
      if (best >= 0) mine[best].members.push(i);
      else rest.push(i);
    }
    // The free small pieces close to each other, as clusters.
    const parent = new Map(rest.map((i) => [i, i]));
    const find = (i: number): number => {
      let r = i;
      while (parent.get(r) !== r) r = parent.get(r)!;
      parent.set(i, r);
      return r;
    };
    for (let a = 0; a < rest.length; a++) {
      for (let b = a + 1; b < rest.length; b++) {
        if (gap(pieces[rest[a]].box, pieces[rest[b]].box) <= tolerance) parent.set(find(rest[a]), find(rest[b]));
      }
    }
    const clusters = new Map<number, number[]>();
    for (const i of rest) clusters.set(find(i), [...(clusters.get(find(i)) ?? []), i]);
    for (const cluster of clusters.values()) {
      if (cluster.length >= 3 && areaOf(pieces, cluster) >= SeedShare * total) {
        mine.push({ members: cluster, cluster: true, kind });
        continue;
      }
      // It joins the large part it sits in or on: the nearest, then the tightest round it.
      const box = boxOf(pieces, cluster);
      let best = 0;
      let bestKey = [Infinity, Infinity];
      seedBoxes.forEach((s, i) => {
        const g = gap(box, s);
        const key = [g <= tolerance ? 0 : g, volume(s)];
        if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) [best, bestKey] = [i, key];
      });
      mine[best].members.push(...cluster);
    }
    groups.push(...mine);
  }
  // Too many: the smallest joins its nearest, of its own kind when there is one.
  while (groups.length > MaxParts) {
    const areas = groups.map((g) => areaOf(pieces, g.members));
    const small = areas.indexOf(Math.min(...areas));
    const box = boxOf(pieces, groups[small].members);
    let best = -1;
    let bestKey = [Infinity, Infinity];
    groups.forEach((g, i) => {
      if (i === small) return;
      const key = [g.kind === groups[small].kind ? 0 : 1, gap(box, boxOf(pieces, g.members))];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) [best, bestKey] = [i, key];
    });
    groups[best].members.push(...groups[small].members);
    groups[best].cluster &&= groups[small].cluster;
    groups.splice(small, 1);
  }
  return groups;
}

/** Plain names: the largest is the body; see-through parts are glass; small pieces together inside the body are
 *  "inside"; the rest by where they are (glTF's axes after the turn: front -Z, up +Y, the prop's right +X). */
function nameGroups(pieces: Piece[], groups: Group[]): string[] {
  const all = pieces.map((p) => p.box).reduce(union);
  const centre = [0, 1, 2].map((i) => (all.min[i] + all.max[i]) / 2);
  const half = [0, 1, 2].map((i) => Math.max(1e-6, (all.max[i] - all.min[i]) / 2));
  // The body: the part with the largest single piece (the outer shell), see-through parts aside.
  const biggest = groups.map((g) => (g.kind === "BLEND" ? -1 : Math.max(...g.members.map((i) => pieces[i].area))));
  const body = biggest.indexOf(Math.max(...biggest));
  const bodyBox = body >= 0 ? boxOf(pieces, groups[body].members) : all;
  const names = groups.map((g, i) => {
    if (i === body) return "body";
    if (g.kind === "BLEND") return "glass";
    const box = boxOf(pieces, g.members);
    const c = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
    // Inside: well within the body, touching none of its outer faces (the bottles behind the glass).
    const margin = [0, 1, 2].map((k) => 0.1 * (bodyBox.max[k] - bodyBox.min[k]));
    if (g.cluster && [0, 1, 2].every((k) => box.min[k] > bodyBox.min[k] + margin[k] && box.max[k] < bodyBox.max[k] - margin[k])) return "inside";
    // Small pieces spread over much of the body (trims, panels, feet on several sides): its details.
    if (g.cluster && [0, 1, 2].filter((k) => box.max[k] - box.min[k] > 0.5 * (bodyBox.max[k] - bodyBox.min[k])).length >= 2) return "details";
    const d = c.map((v, k) => (v - centre[k]) / half[k]);
    const axis = [0, 1, 2].reduce((a, k) => (Math.abs(d[k]) > Math.abs(d[a]) ? k : a), 0);
    if (Math.abs(d[axis]) < 0.25) return "middle";
    return axis === 1 ? (d[1] > 0 ? "top" : "base") : axis === 2 ? (d[2] < 0 ? "front" : "back") : d[0] > 0 ? "right" : "left";
  });
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = (seen.get(n) ?? 0) + 1;
    seen.set(n, k);
    return k === 1 ? n : `${n}_${k}`;
  });
}

// ---------- atlases ----------

interface Sources {
  material: Material | null;
  /** The size the material's pictures are packed at, before the atlas's own scale. */
  width: number;
  height: number;
  rect?: { x: number; y: number; w: number; h: number };
}

function texturePixels(tex: Texture | null): Pixels | undefined {
  const image = tex?.getImage();
  return image ? decode(image, tex!.getMimeType()) : undefined;
}

/** Shelf packing, tallest first; the rectangles' places, or undefined when they don't fit in size x size. */
function pack(items: { w: number; h: number }[], size: number): { x: number; y: number }[] | undefined {
  const order = items.map((_, i) => i).sort((a, b) => items[b].h - items[a].h);
  const at: { x: number; y: number }[] = new Array(items.length);
  let x = 0, y = 0, row = 0;
  for (const i of order) {
    const w = items[i].w + 2 * Pad, h = items[i].h + 2 * Pad;
    if (w > size) return undefined;
    if (x + w > size) {
      x = 0;
      y += row;
      row = 0;
    }
    if (y + h > size) return undefined;
    at[i] = { x: x + Pad, y: y + Pad };
    x += w;
    row = Math.max(row, h);
  }
  return at;
}

/** One material for a group of pieces with different materials: their pictures in one atlas each (color,
 *  roughness and metal, normal, glow), the pieces' UVs moved onto their place in it. */
function atlas(doc: Document, name: string, pieces: Piece[], notes: string[]): Material {
  const byMaterial = new Map<Material | null, Piece[]>();
  for (const p of pieces) byMaterial.set(p.material, [...(byMaterial.get(p.material) ?? []), p]);
  const sources: Sources[] = [];
  for (const [material, ps] of byMaterial) {
    const tex = material && (material.getBaseColorTexture() ?? material.getMetallicRoughnessTexture() ?? material.getNormalTexture() ?? material.getEmissiveTexture());
    const [w, h] = tex?.getSize() ?? [16, 16];
    sources.push({ material, width: w, height: h });
    void ps;
  }
  // Texel density, so a tiny button doesn't keep a picture as big as the body's: each material at most as
  // dense as the group's largest.
  const density = (s: Sources) => {
    const ps = byMaterial.get(s.material)!;
    const area = ps.reduce((a, p) => a + p.area, 0);
    const uv = Math.min(1, ps.reduce((a, p) => a + p.uvArea, 0));
    return area > 0 && uv > 0 ? Math.sqrt((s.width * s.height * uv) / area) : 0;
  };
  const largest = sources.reduce((a, s) => (byMaterial.get(s.material)!.reduce((x, p) => x + p.area, 0) > byMaterial.get(a.material)!.reduce((x, p) => x + p.area, 0) ? s : a));
  const ref = density(largest);
  for (const s of sources) {
    const d = density(s);
    const k = ref > 0 && d > ref ? ref / d : 1;
    s.width = Math.max(8, Math.round(s.width * k));
    s.height = Math.max(8, Math.round(s.height * k));
  }
  let size = 256;
  let scale = 1;
  let places: { x: number; y: number }[] | undefined;
  const sized = (k: number) => sources.map((s) => ({ w: Math.max(4, Math.floor(s.width * k)), h: Math.max(4, Math.floor(s.height * k)) }));
  for (; size <= AtlasMax && !(places = pack(sized(1), size)); size *= 2);
  if (!places) {
    size = AtlasMax;
    let lo = 0, hi = 1;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (pack(sized(mid), size)) lo = mid;
      else hi = mid;
    }
    scale = lo;
    places = pack(sized(scale), size)!;
    notes.push(`The ${name}'s textures were packed at ${Math.round(scale * 100)}% to fit one ${size}² picture.`);
  }
  const dims = sized(scale);
  sources.forEach((s, i) => (s.rect = { ...places![i], w: dims[i].w, h: dims[i].h }));

  // The UVs onto each piece's place.
  for (const s of sources) {
    for (const p of byMaterial.get(s.material)!) {
      if (!p.uv) continue;
      const { x, y, w, h } = s.rect!;
      for (let i = 0; i < p.uv.length; i += 2) {
        p.uv[i] = (x + Math.min(1, Math.max(0, p.uv[i])) * w) / size;
        p.uv[i + 1] = (y + Math.min(1, Math.max(0, p.uv[i + 1])) * h) / size;
      }
    }
  }

  const make = (what: string, fill: [number, number, number, number], picture: (m: Material) => Pixels | undefined): Texture => {
    const out = blank(size, size, fill);
    for (const s of sources) {
      const own = s.material ? picture(s.material) : undefined;
      const img = own ? resize(own, s.rect!.w, s.rect!.h) : blank(s.rect!.w, s.rect!.h, fill);
      blit(out, img, s.rect!.x, s.rect!.y, Pad);
    }
    return doc.createTexture(`${name}_${what}`).setImage(encodePng(out)).setMimeType("image/png");
  };
  const color = make("color", [255, 255, 255, 255], (m) => {
    const f = m.getBaseColorFactor() as [number, number, number, number];
    const img = texturePixels(m.getBaseColorTexture());
    return img ? multiply(img, f) : blank(8, 8, f.map((v) => Math.round(v * 255)) as [number, number, number, number]);
  });
  const hasOcclusion = sources.some((s) => s.material?.getOcclusionTexture());
  const orm = make("orm", [255, 255, 0, 255], (m) => {
    const mr = texturePixels(m.getMetallicRoughnessTexture());
    const occTex = m.getOcclusionTexture();
    const occ = occTex && occTex !== m.getMetallicRoughnessTexture() ? texturePixels(occTex) : undefined;
    const rough = m.getRoughnessFactor(), metal = m.getMetallicFactor();
    if (!mr && !occ) return blank(8, 8, [255, Math.round(rough * 255), Math.round(metal * 255), 255]);
    const base = mr ?? blank(occ!.width, occ!.height, [255, 255, 255, 255]);
    const o = occ ? resize(occ, base.width, base.height) : undefined;
    const data = new Uint8Array(base.data.length);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = o ? o.data[i] : base.data[i];
      data[i + 1] = Math.min(255, (mr ? base.data[i + 1] : 255) * rough);
      data[i + 2] = Math.min(255, (mr ? base.data[i + 2] : 255) * metal);
      data[i + 3] = 255;
    }
    return { width: base.width, height: base.height, data };
  });
  const normal = sources.some((s) => s.material?.getNormalTexture()) ? make("normal", [128, 128, 255, 255], (m) => texturePixels(m.getNormalTexture())) : undefined;
  const glowing = sources.filter((s) => s.material && Math.max(...s.material.getEmissiveFactor()) > 0);
  const emissive = glowing.length
    ? make("emissive", [0, 0, 0, 255], (m) => {
        const f = m.getEmissiveFactor();
        if (Math.max(...f) <= 0) return undefined;
        const img = texturePixels(m.getEmissiveTexture());
        return img ? multiply(img, [f[0], f[1], f[2], 1]) : blank(8, 8, [Math.round(f[0] * 255), Math.round(f[1] * 255), Math.round(f[2] * 255), 255]);
      })
    : undefined;

  const first = sources.find((s) => s.material)?.material;
  const m = doc.createMaterial(name)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(1)
    .setRoughnessFactor(1)
    .setBaseColorTexture(color)
    .setMetallicRoughnessTexture(orm)
    .setAlphaMode(first?.getAlphaMode() ?? "OPAQUE")
    .setAlphaCutoff(first?.getAlphaCutoff() ?? 0.5)
    .setDoubleSided(sources.some((s) => s.material?.getDoubleSided()));
  if (hasOcclusion) m.setOcclusionTexture(orm);
  if (normal) m.setNormalTexture(normal);
  if (emissive) m.setEmissiveTexture(emissive).setEmissiveFactor([1, 1, 1]);
  return m;
}

/** One primitive from several pieces, with one material. */
function merge(doc: Document, pieces: Piece[], material: Material | null): Primitive {
  const vertices = pieces.reduce((n, p) => n + p.pos.length / 3, 0);
  const pos = new Float32Array(vertices * 3);
  const nrm = pieces.every((p) => p.nrm) ? new Float32Array(vertices * 3) : undefined;
  const uv = pieces.every((p) => p.uv) ? new Float32Array(vertices * 2) : undefined;
  const idx = new Uint32Array(pieces.reduce((n, p) => n + p.idx.length, 0));
  let v = 0, t = 0;
  for (const p of pieces) {
    pos.set(p.pos, v * 3);
    if (nrm) nrm.set(p.nrm!, v * 3);
    if (uv) uv.set(p.uv!, v * 2);
    for (let i = 0; i < p.idx.length; i++) idx[t + i] = p.idx[i] + v;
    v += p.pos.length / 3;
    t += p.idx.length;
  }
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer))
    .setMaterial(material);
  if (nrm) prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nrm).setBuffer(buffer));
  if (uv) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(buffer));
  return prim;
}

/**
 * Groups a model of more than MaxParts pieces into named parts, each one mesh and one material. The model's
 * nodes must have no transforms left (prepare bakes them first). Each part's material is named as the part.
 * Answers the parts, largest first, or undefined when the model has few enough pieces to keep as they are.
 */
export function groupParts(doc: Document, notes: string[]): PreparedPart[] | undefined {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodes = root.listNodes().filter((n) => n.getMesh());
  const prims = nodes.flatMap((n) => n.getMesh()!.listPrimitives());
  if (prims.length <= MaxParts) return undefined;
  const pieces = prims.map(pieceOf);
  const groups = groupPieces(pieces);
  const names = nameGroups(pieces, groups);
  const total = pieces.reduce((s, p) => s + p.area, 0);
  const order = groups.map((_, i) => i).sort((a, b) => areaOf(pieces, groups[b].members) - areaOf(pieces, groups[a].members));
  const parts: PreparedPart[] = [];
  const oldMaterials = new Set(root.listMaterials());
  for (const g of order) {
    const ps = groups[g].members.map((i) => pieces[i]);
    const materials = new Set(ps.map((p) => p.material));
    const material = materials.size > 1 ? atlas(doc, names[g], ps, notes) : ps[0].material ? ps[0].material.clone().setName(names[g]) : null;
    const prim = merge(doc, ps, material);
    scene.addChild(doc.createNode(names[g]).setMesh(doc.createMesh(names[g]).addPrimitive(prim)));
    parts.push({ name: names[g], material: names[g], pieces: ps.length, triangles: ps.reduce((n, p) => n + p.idx.length / 3, 0), share: areaOf(pieces, groups[g].members) / total });
  }
  for (const n of nodes) {
    n.getMesh()?.dispose();
    n.dispose();
  }
  for (const m of oldMaterials) m.dispose();
  for (const t of root.listTextures()) if (!root.listMaterials().some((m) => [m.getBaseColorTexture(), m.getMetallicRoughnessTexture(), m.getNormalTexture(), m.getOcclusionTexture(), m.getEmissiveTexture()].includes(t))) t.dispose();
  notes.push(`Its ${pieces.length} pieces were grouped into ${parts.length} parts, each with its own material: ${parts.map((p) => p.name).join(", ")}.`);
  return parts;
}

/** Whether a part is open: more than 1% of its edges border one triangle only (vertices at the same place taken
 *  as one, since UV seams split them). */
function isOpen(prim: Primitive): boolean {
  const pos = read(prim, "POSITION", 3)!;
  const n = pos.length / 3;
  const idx = indicesOf(prim, n);
  const at = new Map<string, number>();
  const id = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
    if (!at.has(k)) at.set(k, at.size);
    id[i] = at.get(k)!;
  }
  const edges = new Map<number, number>();
  const key = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (let t = 0; t < idx.length; t += 3) {
    for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      const k = key(id[a], id[b]);
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const c of edges.values()) if (c === 1) open++;
  return open > edges.size * 0.01;
}

/**
 * Back faces for parts marked double-sided that are open (a thin panel, an open shell): glTF draws both sides of
 * such a part, the game's material one. Closed parts are left alone, since their back faces are never seen.
 * Meshes named alike but for their level (submesh_00_LOD_1, _LOD_2...) are decided together, on the first level.
 * Answers the names of the meshes that got them.
 */
export function addBackFaces(doc: Document): string[] {
  const added: string[] = [];
  const family = (name: string) => name.replace(/_LOD_\d+$/, "");
  const meshes = doc.getRoot().listMeshes();
  const decided = new Map<string, boolean>();
  const byLevel = [...meshes].sort((a, b) => a.getName().localeCompare(b.getName()));
  for (const mesh of byLevel) {
    if (!decided.has(family(mesh.getName()))) decided.set(family(mesh.getName()), mesh.listPrimitives().some((p) => p.getMaterial()?.getDoubleSided() && isOpen(p)));
  }
  for (const mesh of meshes) {
    if (!decided.get(family(mesh.getName()))) continue;
    for (const prim of mesh.listPrimitives()) {
      const n = prim.getAttribute("POSITION")!.getCount();
      const idx = indicesOf(prim, n);
      // Every vertex again, its normal turned round, and every triangle wound the other way.
      for (const semantic of prim.listSemantics()) {
        const a = prim.getAttribute(semantic)!;
        if (semantic === "TANGENT") {
          prim.setAttribute(semantic, null);
          continue;
        }
        const size = a.getElementSize();
        const src = a.getArray()!;
        const out = new (src.constructor as new (n: number) => typeof src)(src.length * 2);
        out.set(src as never, 0);
        out.set(src as never, src.length);
        if (semantic === "NORMAL") for (let i = src.length; i < out.length; i++) (out as Float32Array)[i] = -(out as Float32Array)[i];
        a.setArray(out);
        void size;
      }
      const both = new Uint32Array(idx.length * 2);
      both.set(idx, 0);
      for (let t = 0; t < idx.length; t += 3) {
        both[idx.length + t] = idx[t] + n;
        both[idx.length + t + 1] = idx[t + 2] + n;
        both[idx.length + t + 2] = idx[t + 1] + n;
      }
      const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
      prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(both).setBuffer(buffer));
      added.push(mesh.getName());
    }
  }
  return added;
}

/** For checks only. */
export const partsInternals = { pieceOf, groupPieces, nameGroups };
