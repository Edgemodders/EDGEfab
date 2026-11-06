// Glow on a Desk item (plan.md, "Glow (emissive)"; EDGEmat #6): Make the Painted Lights Glow makes a glow map
// from a model's bright, saturated painted areas (Tripo's lights are painted in, it sends no emissive), and each
// material's strength is the modder's choice. It works on the item's files alone, with no game and no REDbridge:
// prepared.json holds the glow for Add to Project, view.glb shows it in REDcode's 3D view.
//
// Strength in the game (EDGEmat's glow check, 2026-11-05): EmissiveEV = 1 + log2(strength), never below 1, the
// color dimming under strength 1. 0.25 is a saturated glow, 1 a soft one, 8 white-hot; about 0.125 is the limit
// of what shows. How much suits a prop depends on the use, where it appears and how much of it glows.

import * as fs from "node:fs";
import * as path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { readPng, writePng, type Image } from "@edgemodders/edgemat-core";
import * as jpeg from "jpeg-js";
import type { AssetRecord } from "./make";
import type { PreparedGlow, PrepareResult } from "./prepare";

export class GlowError extends Error {}

/** The strengths to offer, in plain words. */
export const GlowLevels = [
  { strength: 0.25, label: "Deep color", detail: "A saturated glow that keeps its color: small lights, buttons, screens" },
  { strength: 1, label: "Soft glow", detail: "Lit in the dark and visible by day, with no wide halo" },
  { strength: 3, label: "Bright", detail: "A strong glow with a halo: signs, big lit panels" },
  { strength: 8, label: "White-hot", detail: "Washes out to white with a wide halo: lamps, a light you look away from" },
] as const;

/** A strength in plain words. */
export function glowWords(strength: number): string {
  if (strength <= 0.5) return "deep color";
  if (strength <= 1.5) return "soft glow";
  if (strength <= 4.5) return "bright";
  return "white-hot";
}

export const DefaultGlowStrength = 1;
export const DefaultLightsAmount = 0.5;

// ---- the item's files -------------------------------------------------------------------------------

interface Item {
  raw: string;
  file: string;
  prepared: PrepareResult;
  folder: string;
}

function readGlowItem(folder: string): Item {
  const base = path.basename(folder);
  if (!base.endsWith(".prop.asset")) throw new GlowError(`${folder} is not a Desk item (a <name>.prop.asset folder).`);
  const raw = path.join(folder, "source", "raw", base.slice(0, -".prop.asset".length));
  const file = path.join(raw, "prepared.json");
  let prepared: PrepareResult;
  try {
    prepared = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new GlowError(`${base} isn't prepared yet: it has no prepared.json.`);
  }
  // Files are found beside prepared.json, so an item that was moved still works.
  const here = (f: string) => path.join(raw, path.basename(f));
  return {
    raw,
    file,
    folder,
    prepared: {
      ...prepared,
      view: prepared.view ? here(prepared.view) : undefined,
      textures: prepared.textures.map((t) => ({ ...t, file: here(t.file) })),
      glow: (prepared.glow ?? []).map((g) => ({ ...g, texture: g.texture ? here(g.texture) : undefined })),
    },
  };
}

/** Draws the glow into view.glb, so REDcode's 3D view shows what the game material will have. */
async function drawInView(item: Item): Promise<void> {
  const view = item.prepared.view;
  if (!view || !fs.existsSync(view)) return;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(view);
  const ext = doc.createExtension(KHRMaterialsEmissiveStrength);
  for (const m of doc.getRoot().listMaterials()) {
    const glow = item.prepared.glow.find((g) => g.material === m.getName());
    const old = m.getEmissiveTexture();
    m.setEmissiveTexture(null);
    if (old && old.listParents().every((p) => p === doc.getRoot())) old.dispose();
    if (!glow) {
      m.setEmissiveFactor([0, 0, 0]);
      m.setExtension("KHR_materials_emissive_strength", null);
      continue;
    }
    m.setEmissiveFactor(glow.color);
    m.setExtension("KHR_materials_emissive_strength", ext.createEmissiveStrength().setEmissiveStrength(glow.strength));
    if (glow.texture && fs.existsSync(glow.texture)) {
      const mime = /\.png$/i.test(glow.texture) ? "image/png" : "image/jpeg";
      m.setEmissiveTexture(doc.createTexture(`${m.getName()}_emissive`).setImage(fs.readFileSync(glow.texture)).setMimeType(mime));
    }
  }
  const temp = `${view}.${process.pid}.tmp.glb`;
  await io.write(temp, doc);
  fs.renameSync(temp, view);
}

function save(item: Item, did: string, version: string): void {
  fs.writeFileSync(item.file, JSON.stringify(item.prepared, null, 2));
  try {
    const f = path.join(item.folder, "asset.json");
    const asset = JSON.parse(fs.readFileSync(f, "utf8")) as AssetRecord;
    asset.history = [...(asset.history ?? []), { tool: `EDGEfab ${version}`, did, date: new Date().toISOString() }];
    fs.writeFileSync(f, JSON.stringify(asset, null, 2));
  } catch {
    // an item with no record still glows
  }
}

const checkStrength = (s: number) => {
  if (!(s > 0) || s > 64) throw new GlowError("A glow's strength is above 0, up to 64: 0.25 is a deep color, 1 a soft glow, 8 white-hot.");
};

const dimNote = (s: number) => (s < 0.125 ? [`A strength of ${s} is likely too dim to see in the game: about 0.125 is the limit.`] : []);

// ---- Make the Painted Lights Glow -------------------------------------------------------------------

function decode(file: string): Image {
  const bytes = fs.readFileSync(file);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return readPng(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const d = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 2048, maxResolutionInMP: 200 });
    return { width: d.width, height: d.height, data: d.data };
  }
  throw new GlowError(`${path.basename(file)} is not a PNG or JPEG, so EDGEfab can't look for lights in it.`);
}

const smooth = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/**
 * A glow map from a color texture: what is both bright and strongly colored keeps its color, the rest is black.
 * amount 0 to 1: how much counts as a light (0.5: brighter than 0.55 and more saturated than 0.4, tried on a
 * vending machine in test 8). The edges are soft, so a light has no jagged rim.
 */
export function lightsMap(color: Image, amount: number): { map: Image; lit: number } {
  const bright = 0.85 - 0.6 * amount;
  const vivid = 0.6 - 0.4 * amount;
  const data = new Uint8Array(color.width * color.height * 4);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = color.data[i], g = color.data[i + 1], b = color.data[i + 2];
    const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
    const sat = max ? (max - min) / max : 0;
    const w = smooth(bright - 0.05, bright + 0.05, max) * smooth(vivid - 0.05, vivid + 0.05, sat);
    data[i] = r * w;
    data[i + 1] = g * w;
    data[i + 2] = b * w;
    data[i + 3] = 255;
    if (w > 0.5) lit++;
  }
  return { map: { width: color.width, height: color.height, data }, lit: lit / (color.width * color.height) };
}

export interface GlowResult {
  glow: PreparedGlow[];
  /** Per material painted: the share of its texture that lights up, 0 to 1. */
  lit?: { material: string; share: number }[];
  /** The GLB that shows it in REDcode's 3D view. */
  view?: string;
  notes: string[];
}

/**
 * Makes the painted lights of a Desk item glow: each material's color texture gives a glow map. A material with a
 * glow of its own keeps it. Doing it again replaces what it painted before. Spends nothing, and changes the item only.
 */
export async function paintedLightsGlow(folder: string, opts: { amount?: number; strength?: number; version?: string } = {}): Promise<GlowResult> {
  const amount = Math.min(1, Math.max(0, opts.amount ?? DefaultLightsAmount));
  const strength = opts.strength ?? DefaultGlowStrength;
  checkStrength(strength);
  const item = readGlowItem(folder);
  const p = item.prepared;
  const notes = [...dimNote(strength)];
  const lit: { material: string; share: number }[] = [];
  const painted: PreparedGlow[] = [];
  for (const material of p.materials) {
    const own = p.glow.find((g) => g.material === material && !g.painted);
    if (own) {
      notes.push(`${material} has a glow of its own, so it keeps it.`);
      continue;
    }
    const color = p.textures.find((t) => t.material === material && t.slot === "baseColor");
    if (!color) {
      notes.push(`${material} has no color texture to find lights in.`);
      continue;
    }
    const { map, lit: share } = lightsMap(decode(color.file), amount);
    lit.push({ material, share });
    if (share <= 0) {
      notes.push(`${material}: nothing in its color texture looks like a light, so it doesn't glow. Try more lights.`);
      continue;
    }
    const file = path.join(item.raw, `${material}_emissive.png`);
    fs.writeFileSync(file, writePng(map));
    p.textures = [...p.textures.filter((t) => !(t.material === material && t.slot === "emissive")), { material, slot: "emissive", file, mimeType: "image/png" }];
    painted.push({ material, color: [1, 1, 1], strength, texture: file, painted: true });
  }
  if (!painted.length && !p.glow.some((g) => !g.painted)) {
    if (!lit.length) throw new GlowError("This model has no color texture to find lights in.");
    throw new GlowError("Nothing in this model's color texture looks like a light. Try more lights.");
  }
  // A material painted before and dark now loses its old map.
  for (const g of p.glow) {
    if (g.painted && g.texture && lit.some((l) => l.material === g.material) && painted.every((n) => n.material !== g.material)) {
      fs.rmSync(g.texture, { force: true });
      p.textures = p.textures.filter((t) => !(t.material === g.material && t.slot === "emissive"));
    }
  }
  p.glow = [...p.glow.filter((g) => !g.painted || !lit.some((l) => l.material === g.material)), ...painted];
  await drawInView(item);
  const share = lit.map((l) => `${l.material} ${Math.round(l.share * 100)}%`).join(", ");
  save(item, `Painted lights made to glow: ${share}, ${glowWords(strength)} (strength ${strength})`, opts.version ?? "");
  return { glow: p.glow, lit, view: p.view, notes };
}

/** Sets how strongly an item glows: one material, or all that glow. */
export async function setGlowStrength(folder: string, strength: number, opts: { material?: string; version?: string } = {}): Promise<GlowResult> {
  checkStrength(strength);
  const item = readGlowItem(folder);
  const p = item.prepared;
  const targets = p.glow.filter((g) => !opts.material || g.material === opts.material);
  if (!targets.length) throw new GlowError(opts.material ? `${opts.material} doesn't glow.` : "This prop doesn't glow yet: make its painted lights glow first.");
  for (const g of targets) g.strength = strength;
  await drawInView(item);
  save(item, `Glow set to ${glowWords(strength)} (strength ${strength})${opts.material ? ` on ${opts.material}` : ""}`, opts.version ?? "");
  return { glow: p.glow, view: p.view, notes: dimNote(strength) };
}

/** Stops an item glowing: one material, or all. Its glow map's file goes too. */
export async function glowOff(folder: string, opts: { material?: string; version?: string } = {}): Promise<GlowResult> {
  const item = readGlowItem(folder);
  const p = item.prepared;
  const off = p.glow.filter((g) => !opts.material || g.material === opts.material);
  if (!off.length) throw new GlowError(opts.material ? `${opts.material} doesn't glow.` : "This prop doesn't glow.");
  for (const g of off) {
    if (g.texture) fs.rmSync(g.texture, { force: true });
    p.textures = p.textures.filter((t) => !(t.material === g.material && t.slot === "emissive"));
  }
  p.glow = p.glow.filter((g) => !off.includes(g));
  await drawInView(item);
  save(item, `Glow off${opts.material ? ` on ${opts.material}` : ""}`, opts.version ?? "");
  return { glow: p.glow, view: p.view, notes: [] };
}
