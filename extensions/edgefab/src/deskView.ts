// The Desk view: EDGEfab's own scratch workspace, where models it made and prepared wait, each an asset
// folder (core/make.ts), until they go into a project or the Library. Each shows its size, levels of detail,
// textures and license in plain words.

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { deskDir, glowWords, readPictures, readPrepared, type PictureTake, type PrepareResult } from "./core";

export interface DeskEntry {
  folder: string;
  name: string;
  title: string;
  license?: { source: string; plan?: string; note: string };
  from?: Record<string, unknown>;
  prepared?: PrepareResult;
  preview?: string;
  /** The GLB REDcode's 3D view opens: prepare's view.glb (with textures), or the model as it came for older items. */
  model?: string;
  /** Its last four-view picture (picture first), when it has one. */
  picture?: PictureTake;
  /** Where Add to Library put it, under the Library's root, and its version there. */
  library?: { path: string; version: number };
}

/** Reads the asset folders on the Desk, newest first. */
export function listDesk(base = deskDir()): DeskEntry[] {
  if (!fs.existsSync(base)) return [];
  const entries: (DeskEntry & { at: number })[] = [];
  for (const dir of fs.readdirSync(base)) {
    if (!dir.endsWith(".prop.asset")) continue;
    const folder = path.join(base, dir);
    const name = dir.slice(0, -".prop.asset".length);
    try {
      const asset = JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8"));
      const raw = path.join(folder, "source", "raw", name);
      const prepared = readPrepared(raw);
      const preview = ["preview.webp", "preview.png", "preview.jpg", "preview.jpeg"].map((f) => path.join(raw, f)).find((f) => fs.existsSync(f));
      const model = [prepared?.view, path.join(raw, "view.glb"), path.join(raw, "original.glb")].find((f): f is string => !!f && fs.existsSync(f));
      const picture = readPictures(raw)?.takes.at(-1);
      entries.push({ folder, name, title: asset.name ?? name, license: asset.license, from: asset.from, prepared, preview, model, picture, library: asset.library, at: fs.statSync(folder).mtimeMs });
    } catch {
      // not one of ours, or half written
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

type Item = { kind: "desk"; entry: DeskEntry } | { kind: "line"; label: string; detail?: string; icon: string; tooltip?: string };

const metres = (n: number) => (n >= 1 ? `${n.toFixed(2)} m` : `${Math.round(n * 100)} cm`);

export class DeskView implements vscode.TreeDataProvider<Item> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void {
    this.changed.fire();
  }

  getChildren(item?: Item): Item[] {
    if (!item) return listDesk().map((entry) => ({ kind: "desk", entry }));
    if (item.kind !== "desk") return [];
    const { entry } = item;
    const lines: Item[] = [];
    const p = entry.prepared;
    if (entry.picture) {
      const t = entry.picture;
      lines.push({ kind: "line", label: p ? `From picture ${t.take}` : `Picture ${t.take}: four views`, detail: t.words, icon: "file-media", tooltip: [`"${t.words}"`, `${t.model}, ${t.seconds} s`, t.sheet].join("\n") });
      if (!p) lines.push({ kind: "line", label: "Next: Make 3D, or Change the Words", icon: "arrow-right" });
    }
    if (p) {
      // With no real size, the model's own height (1 m) isn't one: say so on the same line, so the two don't disagree.
      if (p.sizeUnknown) lines.push({ kind: "line", label: "Size unknown: Set Size before adding it", detail: `${metres(p.size.height)} tall for now, a stand-in. Tripo gives no size for models in parts`, icon: "warning" });
      else lines.push({ kind: "line", label: `${metres(p.size.height)} tall`, detail: `${metres(p.size.width)} × ${metres(p.size.depth)}`, icon: "symbol-ruler" });
      const byLod = new Map<number, number>();
      for (const s of p.submeshes) byLod.set(s.lod, (byLod.get(s.lod) ?? 0) + s.triangles);
      const lods = [...byLod.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t.toLocaleString("en-US"));
      lines.push({ kind: "line", label: `${byLod.size} levels of detail`, detail: `${lods.join(" / ")} triangles`, icon: "layers" });
      const slots = [...new Set(p.textures.map((t) => (t.slot === "baseColor" ? "color" : t.slot === "metallicRoughness" ? "roughness and metal" : t.slot)))];
      lines.push({ kind: "line", label: p.textures.length ? `Textures: ${slots.join(", ")}` : "No textures", icon: "symbol-color" });
      if (p.parts?.length) {
        lines.push({
          kind: "line",
          label: `${p.parts.length} parts, a material each`,
          detail: p.parts.map((x) => x.name).join(", "),
          icon: "symbol-structure",
          tooltip: p.parts.map((x) => `${x.name}: ${x.material}, ${x.pieces} piece${x.pieces > 1 ? "s" : ""}, ${Math.round(x.share * 100)}% of its surface`).join("\n"),
        });
      }
      if (p.glow?.length) {
        const how = p.glow.some((g) => g.texture) ? "in places, from its glow map" : "all over its glowing parts";
        const levels = [...new Set(p.glow.map((g) => glowWords(g.strength)))].join(", ");
        lines.push({ kind: "line", label: `Glows ${how}`, detail: levels, icon: "lightbulb", tooltip: p.glow.map((g) => `${g.material}: colour ${g.color.map((c) => c.toFixed(2)).join(", ")}, strength ${g.strength}${g.painted ? ", from its painted lights" : ""}`).join("\n") });
      }
      for (const note of p.notes) lines.push({ kind: "line", label: note, icon: "info", tooltip: note });
    }
    if (entry.library) lines.push({ kind: "line", label: `In the Library, version ${entry.library.version}`, detail: entry.library.path, icon: "library", tooltip: `${entry.library.path}
Add to Library again updates it there, one version up.` });
    if (entry.license) {
      const label =
        entry.license.source === "tripo" ? (entry.license.plan === "free" ? "Tripo, free plan: not yours to release" : "Tripo, paid plan: yours")
        : entry.license.source === "openai" ? "A picture by OpenAI: yours"
        : "From a file: record its source";
      lines.push({ kind: "line", label, icon: entry.license.plan === "free" ? "warning" : "law", tooltip: entry.license.note });
    }
    return lines;
  }

  getTreeItem(item: Item): vscode.TreeItem {
    if (item.kind === "line") {
      const t = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.None);
      t.description = item.detail;
      t.iconPath = new vscode.ThemeIcon(item.icon);
      t.tooltip = item.tooltip;
      return t;
    }
    const { entry } = item;
    const t = new vscode.TreeItem(entry.title, vscode.TreeItemCollapsibleState.Collapsed);
    t.description = entry.name;
    t.iconPath = new vscode.ThemeIcon(!entry.prepared && entry.picture ? "file-media" : entry.license?.source === "tripo" ? "sparkle" : "package");
    t.tooltip = new vscode.MarkdownString(`**${entry.title}**\n\n${entry.folder}`);
    // "picture" for a picture waiting for Make 3D; "desk" for a model, with what it has: .preview for Tripo's
    // picture, .glow when it glows, .views when it has four views to make again from (package.json's menus match these).
    t.contextValue = !entry.prepared && entry.picture ? "picture" : `desk${entry.preview ? ".preview" : ""}${entry.prepared?.glow?.length ? ".glow" : ""}${entry.picture ? ".views" : ""}`;
    t.resourceUri = vscode.Uri.file(entry.folder);
    if (entry.model) t.command = { command: "edgefab.view", title: "Open in 3D", arguments: [item] };
    else if (entry.picture) t.command = { command: "edgefab.openPicture", title: "Open the Picture", arguments: [item] };
    return t;
  }
}

export const entryOf = (item: unknown): DeskEntry | undefined => (item && typeof item === "object" && (item as Item).kind === "desk" ? (item as { entry: DeskEntry }).entry : undefined);
