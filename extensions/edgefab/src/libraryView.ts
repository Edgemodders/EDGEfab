// The Library view: the EDGE Library's folders, the modder's own, with the asset items in them (EDGEfab's props,
// and other tools' items, shown but not EDGEfab's to change) and model files kept to convert later (GLB, FBX,
// .blend). Each prop shows its version, game path, size and license in plain words.

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { libraryFolder, libraryRoot, recordedLibraryRoot, type LibraryAsset, type PrepareResult } from "./core";

export type LibraryNode =
  | { kind: "folder"; rel: string; name: string }
  | { kind: "asset"; asset: LibraryAsset }
  | { kind: "file"; file: string; name: string }
  | { kind: "line"; label: string; detail?: string; icon: string; tooltip?: string };

const metres = (n: number) => (n >= 1 ? `${n.toFixed(2)} m` : `${Math.round(n * 100)} cm`);

const KindWords: Record<string, string> = {
  mesh: "a game mesh",
  ent: "a game entity",
  app: "a game appearance",
  mi: "a game material",
  mlsetup: "a game material setup",
  xbm: "a game texture",
  sound: "a sound (EDGEwave)",
  quickhack: "a quickhack (EDGEhack)",
};

/** A Library prop's prepared model, from its own sources. */
export function preparedOf(a: LibraryAsset): PrepareResult | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(a.folder, "source", "raw", a.name, "prepared.json"), "utf8")) as PrepareResult;
  } catch {
    return undefined;
  }
}

/** The GLB REDcode's 3D view opens for a Library prop: its view.glb, with textures. */
export function viewOf(a: LibraryAsset): string | undefined {
  const raw = path.join(a.folder, "source", "raw", a.name);
  return [path.join(raw, "view.glb"), path.join(raw, "original.glb")].find((f) => fs.existsSync(f));
}

export class LibraryView implements vscode.TreeDataProvider<LibraryNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  refresh(): void {
    void vscode.commands.executeCommand("setContext", "edgefab.hasLibrary", !!libraryRoot());
    this.changed.fire();
  }

  getChildren(node?: LibraryNode): LibraryNode[] {
    const root = libraryRoot();
    if (!root) {
      const recorded = recordedLibraryRoot();
      return recorded ? [{ kind: "line", label: "The Library's folder is missing", detail: recorded, icon: "warning", tooltip: `${recorded}\nA drive may be unplugged. Set the Library Folder to choose another.` }] : [];
    }
    if (!node || node.kind === "folder") {
      const here = libraryFolder(root, node?.kind === "folder" ? node.rel : "");
      const out: LibraryNode[] = [
        ...here.folders.map((f) => ({ kind: "folder" as const, rel: f.rel, name: f.name })),
        ...here.assets.map((asset) => ({ kind: "asset" as const, asset })),
        ...here.files.map((f) => ({ kind: "file" as const, file: f.file, name: f.name })),
      ];
      if (!node && !out.length) out.push({ kind: "line", label: "Empty so far", detail: "Add to Library from the Desk", icon: "info", tooltip: root });
      return out;
    }
    if (node.kind !== "asset") return [];
    const a = node.asset;
    const lines: LibraryNode[] = [];
    if (a.kind !== "prop" || !a.asset) {
      lines.push({ kind: "line", label: `${KindWords[a.kind] ?? `a ${a.kind} item`}, from another EDGE tool`, icon: "info", tooltip: "EDGEfab shows it; the tool that made it changes it." });
      if (a.main) lines.push({ kind: "line", label: a.main, icon: "file", tooltip: "Its main file's game path" });
      return lines;
    }
    lines.push({ kind: "line", label: `Version ${a.version ?? 1}`, detail: a.asset.history.at(-1)?.date.slice(0, 10), icon: "versions", tooltip: a.asset.history.map((h) => `${h.date.slice(0, 10)} ${h.did}`).join("\n") });
    if (a.main) lines.push({ kind: "line", label: path.win32.basename(a.main), detail: path.win32.dirname(a.main), icon: "symbol-file", tooltip: `${a.main}\nThe entity to place: the same game path in every project` });
    const p = preparedOf(a);
    if (p) {
      lines.push({ kind: "line", label: `${metres(p.size.height)} tall`, detail: `${metres(p.size.width)} × ${metres(p.size.depth)}`, icon: "symbol-ruler" });
      if (p.parts?.length) lines.push({ kind: "line", label: `${p.parts.length} parts, a material each`, detail: p.parts.map((x) => x.name).join(", "), icon: "symbol-structure" });
      if (p.glow?.length) lines.push({ kind: "line", label: "Glows", icon: "lightbulb" });
    }
    const l = a.asset.license;
    if (l) {
      const label = l.source === "tripo" ? (l.plan === "free" ? "Tripo, free plan: not yours to release" : "Tripo, paid plan: yours") : l.source === "openai" ? "A picture by OpenAI: yours" : "From a file: record its source";
      lines.push({ kind: "line", label, icon: l.plan === "free" ? "warning" : "law", tooltip: l.note });
    }
    return lines;
  }

  getTreeItem(node: LibraryNode): vscode.TreeItem {
    if (node.kind === "line") {
      const t = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      t.description = node.detail;
      t.iconPath = new vscode.ThemeIcon(node.icon);
      t.tooltip = node.tooltip;
      return t;
    }
    if (node.kind === "folder") {
      const t = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.Collapsed);
      t.iconPath = vscode.ThemeIcon.Folder;
      t.resourceUri = vscode.Uri.file(path.join(libraryRoot() ?? "", ...node.rel.split("/")));
      t.contextValue = "libfolder";
      return t;
    }
    if (node.kind === "file") {
      const t = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
      t.resourceUri = vscode.Uri.file(node.file);
      t.iconPath = new vscode.ThemeIcon("file-binary");
      t.tooltip = `${node.file}\nA model kept to convert later`;
      // GLB and glTF become props now; FBX and .blend come with Blender (F3).
      t.contextValue = /\.(glb|gltf)$/i.test(node.name) ? "libmodel.glb" : "libmodel";
      if (/\.(glb|gltf)$/i.test(node.name)) t.command = { command: "vscode.openWith", title: "Open in 3D", arguments: [vscode.Uri.file(node.file), "redcode.mesh"] };
      return t;
    }
    const a = node.asset;
    const t = new vscode.TreeItem(a.title, vscode.TreeItemCollapsibleState.Collapsed);
    t.description = a.kind === "prop" ? `v${a.version ?? 1}` : a.kind;
    t.iconPath = new vscode.ThemeIcon(a.kind === "prop" ? "package" : "archive");
    t.tooltip = new vscode.MarkdownString(`**${a.title}**, ${a.kind}${a.version ? `, version ${a.version}` : ""}\n\n${a.folder}`);
    t.resourceUri = vscode.Uri.file(a.folder);
    t.contextValue = a.kind === "prop" && a.asset ? "libprop" : "libasset";
    if (a.kind === "prop" && a.asset && viewOf(a)) t.command = { command: "edgefab.library.view", title: "Open in 3D", arguments: [node] };
    return t;
  }
}

export const libraryAssetOf = (node: unknown): LibraryAsset | undefined => (node && typeof node === "object" && (node as LibraryNode).kind === "asset" ? (node as { asset: LibraryAsset }).asset : undefined);
export const libraryPathOf = (node: unknown): string | undefined => {
  if (!node || typeof node !== "object") return undefined;
  const n = node as LibraryNode;
  if (n.kind === "asset") return n.asset.folder;
  if (n.kind === "file") return n.file;
  if (n.kind === "folder") return path.join(libraryRoot() ?? "", ...n.rel.split("/"));
  return undefined;
};
