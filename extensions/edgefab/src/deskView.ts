// The Desk view: EDGEfab's own scratch workspace, where models it made and prepared wait, each an asset
// folder (core/make.ts), until they go into a project or the Library. Each shows its size, levels of detail,
// textures and license in plain words.

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { deskDir, type PrepareResult } from "./core";

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
      let prepared: PrepareResult | undefined;
      try {
        prepared = JSON.parse(fs.readFileSync(path.join(raw, "prepared.json"), "utf8"));
      } catch {
        prepared = undefined;
      }
      const preview = ["preview.webp", "preview.png", "preview.jpg", "preview.jpeg"].map((f) => path.join(raw, f)).find((f) => fs.existsSync(f));
      const model = [prepared?.view, path.join(raw, "view.glb"), path.join(raw, "original.glb")].find((f): f is string => !!f && fs.existsSync(f));
      entries.push({ folder, name, title: asset.name ?? name, license: asset.license, from: asset.from, prepared, preview, model, at: fs.statSync(folder).mtimeMs });
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
    if (p) {
      lines.push({ kind: "line", label: `${metres(p.size.height)} tall`, detail: `${metres(p.size.width)} × ${metres(p.size.depth)}`, icon: "symbol-ruler" });
      const byLod = new Map<number, number>();
      for (const s of p.submeshes) byLod.set(s.lod, (byLod.get(s.lod) ?? 0) + s.triangles);
      const lods = [...byLod.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t.toLocaleString("en-US"));
      lines.push({ kind: "line", label: `${byLod.size} levels of detail`, detail: `${lods.join(" / ")} triangles`, icon: "layers" });
      const slots = [...new Set(p.textures.map((t) => (t.slot === "baseColor" ? "color" : t.slot === "metallicRoughness" ? "roughness and metal" : t.slot)))];
      lines.push({ kind: "line", label: p.textures.length ? `Textures: ${slots.join(", ")}` : "No textures", icon: "symbol-color" });
      for (const note of p.notes) lines.push({ kind: "line", label: note, icon: "info", tooltip: note });
    }
    if (entry.license) {
      const label = entry.license.source === "tripo" ? (entry.license.plan === "free" ? "Tripo, free plan: not yours to release" : "Tripo, paid plan: yours") : "From a file: record its source";
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
    t.iconPath = new vscode.ThemeIcon(entry.license?.source === "tripo" ? "sparkle" : "package");
    t.tooltip = new vscode.MarkdownString(`**${entry.title}**\n\n${entry.folder}`);
    t.contextValue = entry.preview ? "desk.preview" : "desk";
    t.resourceUri = vscode.Uri.file(entry.folder);
    if (entry.model) t.command = { command: "edgefab.view", title: "Open in 3D", arguments: [item] };
    return t;
  }
}

export const entryOf = (item: unknown): DeskEntry | undefined => (item && typeof item === "object" && (item as Item).kind === "desk" ? (item as { entry: DeskEntry }).entry : undefined);
