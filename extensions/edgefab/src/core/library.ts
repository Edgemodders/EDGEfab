// The EDGE Library, EDGEfab's part (plan.md, "The Library"; docs/library.md). The rules are EDGEbuilder's,
// shared by every EDGE tool: https://edgemodders.github.io/EDGEbuilder/library.html#shared-rules
//
// One root for every EDGE tool, in %APPDATA%\EDGE\library.json; the folders under it are the modder's.
// EDGEfab's items are props, <name>.prop.asset, laid out like a small project:
//
//   asset.json                                         id, name, kind "prop", main (the .ent), version, ...
//   source\raw\<name>\                                 the Desk item's own sources: the model, its textures, pictures
//   source\raw\<modder>\props\<name>\                  the prepared GLB and <name>.edgefab.json, as in a project
//   source\archive\<modder>\props\<name>\              the game files: mesh, materials, textures, the .ent
//
// Add to Library builds the game files into the item itself (Add to Project with the item as the project),
// under the modder's own folder, so a Library prop has the same game paths in every project and Add to
// Project from the Library is a copy. A project notes what it took in source\library.json, the came-from
// note every tool writes the same way. No VS Code imports: the MCP server uses this too.

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { BridgeCall } from "@edgemodders/edgemat-core";
import { addToProject, readItem, type Collision, type ProjectFolders } from "./addToProject";
import { deskDir, readSettings, slug, writeSettings } from "./config";
import type { AssetRecord } from "./make";

export class LibraryError extends Error {}

// ---- the root -------------------------------------------------------------------------------------------

/** Where the EDGE tools keep the Library's root: `%APPDATA%\EDGE\library.json`, `{ "root": ... }`. EDGE_LIBRARY_CONFIG for tests. */
export function libraryConfigFile(): string {
  if (process.env.EDGE_LIBRARY_CONFIG) return process.env.EDGE_LIBRARY_CONFIG;
  return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "EDGE", "library.json");
}

/** The Library's root, when one is set and its folder is there. */
export function libraryRoot(file = libraryConfigFile()): string | undefined {
  try {
    const root = (JSON.parse(fs.readFileSync(file, "utf8")) as { root?: unknown }).root;
    return typeof root === "string" && root.trim() && fs.existsSync(root.trim()) ? root.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** The root as recorded, even when its folder is missing (a drive unplugged): for saying so. */
export function recordedLibraryRoot(file = libraryConfigFile()): string | undefined {
  try {
    const root = (JSON.parse(fs.readFileSync(file, "utf8")) as { root?: unknown }).root;
    return typeof root === "string" && root.trim() ? root.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Makes the root folder and records it for every EDGE tool, keeping any other fields the file has. */
export function setLibraryRoot(root: string, opts: { gameDir?: string; file?: string } = {}): string {
  root = path.resolve(root);
  if (opts.gameDir && (isInside(root, opts.gameDir) || isInside(opts.gameDir, root))) throw new LibraryError(`The Library must not be inside the game's folder, or hold it: ${root}`);
  const file = opts.file ?? libraryConfigFile();
  fs.mkdirSync(root, { recursive: true });
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    // The first tool to set it.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...data, root }, null, 2));
  return root;
}

/** The modder's Documents folder, wherever Windows keeps it (OneDrive or another drive), else the usual place. */
function documentsFolder(): string {
  const fallback = path.join(os.homedir(), "Documents");
  if (process.platform !== "win32") return fallback;
  try {
    const out = execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders", "/v", "Personal"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    const m = /Personal\s+REG_(?:EXPAND_)?SZ\s+(.+)/.exec(out);
    return m ? m[1].trim().replace(/%([^%]+)%/g, (all, name: string) => process.env[name] ?? all) : fallback;
  } catch {
    return fallback;
  }
}

/** The Library folder offered the first time: `Documents\EDGE Library`. */
export function suggestedLibraryRoot(): string {
  return path.join(documentsFolder(), "EDGE Library");
}

export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const ItemEnding = /\.(asset|bake)$/i;
const toRel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

/** A folder under the root as the modder typed it, with `/`; throws on what could leave the root. "" is the root. */
export function safeFolder(folder: string | undefined): string {
  const parts = (folder ?? "").split(/[\\/]+/).filter((p) => p !== "");
  for (const p of parts) {
    if (p === "." || p === "..") throw new LibraryError(`A Library folder cannot go through "${p}": ${folder}`);
    if (/[<>:"|?*\u0000-\u001f]/.test(p) || /[. ]$/.test(p)) throw new LibraryError(`Not a folder name: "${p}"`);
    if (ItemEnding.test(p)) throw new LibraryError(`"${p}" is a Library item, not a folder.`);
  }
  return parts.join("/");
}

/** The modder's folders under the root, with `/`, leaving out items and hidden folders. */
export function libraryFolders(root: string, cap = 2000): string[] {
  const found: string[] = [];
  const walk = (dir: string, rel: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= cap) return;
      if (!e.isDirectory() || e.name.startsWith(".") || ItemEnding.test(e.name)) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      found.push(child);
      if (depth < 16) walk(path.join(dir, e.name), child, depth + 1);
    }
  };
  walk(root, "", 0);
  return found.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

// ---- what is in a folder ----------------------------------------------------------------------------

/** Plain files EDGEfab knows: models kept to convert later. */
export const ModelFiles = /\.(glb|gltf|fbx|blend)$/i;

export interface LibraryAsset {
  /** The item's folder. */
  folder: string;
  /** The same, under the root with `/`. */
  rel: string;
  /** The name in its folder name, before `.<kind>.asset`. */
  name: string;
  /** From the folder name, which wins over asset.json. */
  kind: string;
  /** asset.json's name, else the folder's. */
  title: string;
  id?: string;
  version?: number;
  main?: string | null;
  /** asset.json as it is, for EDGEfab's own props. */
  asset?: AssetRecord;
}

export interface LibraryFolder {
  /** This folder, under the root with `/`; "" for the root. */
  rel: string;
  folders: { name: string; rel: string }[];
  assets: LibraryAsset[];
  /** Model files (GLB, FBX, .blend) in this folder. */
  files: { name: string; file: string }[];
}

const AssetName = /^(.+)\.([a-z0-9_]+)\.asset$/i;

export function readAsset(root: string, folder: string): LibraryAsset | undefined {
  const m = AssetName.exec(path.basename(folder));
  if (!m) return undefined;
  let asset: Partial<AssetRecord> & Record<string, unknown> = {};
  try {
    asset = JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8"));
  } catch {
    // An item with no readable asset.json still shows, by its folder name.
  }
  const kind = m[2].toLowerCase();
  return {
    folder,
    rel: toRel(root, folder),
    name: m[1],
    kind,
    title: typeof asset.name === "string" && asset.name.trim() ? asset.name : m[1],
    id: typeof asset.id === "string" ? asset.id : undefined,
    version: typeof asset.version === "number" ? asset.version : undefined,
    main: typeof asset.main === "string" ? asset.main : null,
    asset: kind === "prop" && typeof asset.id === "string" ? (asset as AssetRecord) : undefined,
  };
}

/** One folder of the Library: its sub-folders, its asset items (every tool's), and its model files. */
export function libraryFolder(root: string, rel = ""): LibraryFolder {
  const dir = path.join(root, ...safeFolder(rel).split("/").filter(Boolean));
  const out: LibraryFolder = { rel: safeFolder(rel), folders: [], assets: [], files: [] };
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  const by = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  for (const e of entries.sort((a, b) => by(a.name, b.name))) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (AssetName.test(e.name)) {
        const a = readAsset(root, full);
        if (a) out.assets.push(a);
      } else if (!ItemEnding.test(e.name)) out.folders.push({ name: e.name, rel: out.rel ? `${out.rel}/${e.name}` : e.name });
    } else if (ModelFiles.test(e.name)) out.files.push({ name: e.name, file: full });
  }
  return out;
}

/** Every asset item in the Library of one kind (all kinds when none is given). */
export function libraryAssets(root: string, kind?: string, cap = 5000): LibraryAsset[] {
  const out: LibraryAsset[] = [];
  const walk = (dir: string, depth: number): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= cap || !e.isDirectory() || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (AssetName.test(e.name)) {
        const a = readAsset(root, full);
        if (a && (!kind || a.kind === kind)) out.push(a);
      } else if (!ItemEnding.test(e.name) && depth < 16) walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

export function assetById(root: string, id: string): LibraryAsset | undefined {
  return libraryAssets(root).find((a) => a.id === id);
}

/** A Library prop by its folder, its path under the root, or its id. */
export function libraryProp(root: string, which: string): LibraryAsset {
  const candidates = [which, path.join(root, ...which.split(/[\\/]+/))];
  for (const c of candidates) {
    if (AssetName.test(path.basename(c)) && fs.existsSync(path.join(c, "asset.json")) && isInside(c, root)) {
      const a = readAsset(root, path.resolve(c));
      if (a?.kind === "prop" && a.asset) return a;
    }
  }
  const byId = assetById(root, which);
  if (byId?.kind === "prop" && byId.asset) return byId;
  throw new LibraryError(`No prop in the Library called ${which}: give its folder, its path under the Library, or its id.`);
}

// ---- the modder's folder ----------------------------------------------------------------------------

/** The modder's own folder for Library props' game paths, once set (shared with the MCP server). */
export function modderFolder(): string | undefined {
  return readSettings().modder;
}

export function setModderFolder(name: string): string {
  const s = slug(name, "");
  if (!s) throw new LibraryError("A folder name of letters and digits, such as your modder name.");
  writeSettings({ modder: s });
  return s;
}

/** The game folder a Library prop's files go in: `<modder>\props\<name>`. */
export const propGameFolder = (modder: string, name: string) => `${modder}\\props\\${name}`;

// ---- Add to Library -----------------------------------------------------------------------------------

export interface LibraryAddRequest {
  /** The Desk item's folder (<name>.prop.asset). */
  item: string;
  root: string;
  /** A folder under the root, with `/`; "" is the root. Ignored when the item is in the Library already (it is updated where it is). */
  folder?: string;
  /** Use the game path: the item goes in its game path's folders under `folder`. */
  useGamePath?: boolean;
  /** The modder's own folder in game paths. */
  modder: string;
  call: BridgeCall;
  collision?: Collision;
  /** "EDGEfab 0.1.0", for the item's history. */
  tool: string;
  /** The game's folder, so a Library inside it is refused. */
  gameDir?: string;
  log?: (line: string) => void;
}

export interface LibraryAddResult {
  /** The Library item's folder, and the same under the root with `/`. */
  folder: string;
  rel: string;
  id: string;
  version: number;
  /** The .ent's game path. */
  main: string;
  /** Whether an earlier version of it in the Library was updated. */
  updated: boolean;
  /** Game files in the item. */
  files: number;
  notes: string[];
}

/**
 * Renames a folder, waiting for Windows: it refuses while anything has a file inside open, and an antivirus
 * or the search indexer opens files just written. Tries for about 13 seconds.
 */
async function renameFolder(from: string, to: string, waits = [50, 100, 200, 400, 800, 1600, 3200, 6400]): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e;
      if (i >= waits.length) throw new LibraryError(`Could not move ${from} to ${to}: something has a file in it open, such as an antivirus or the search indexer. Try again in a moment. (${code})`);
      await new Promise((resolve) => setTimeout(resolve, waits[i]));
    }
  }
}

/** A Desk item's own files: everything but what an earlier build put in it. */
function copyOwnFiles(from: string, to: string, name: string): void {
  fs.mkdirSync(to, { recursive: true });
  fs.copyFileSync(path.join(from, "asset.json"), path.join(to, "asset.json"));
  fs.cpSync(path.join(from, "source", "raw", name), path.join(to, "source", "raw", name), { recursive: true });
}

const filesUnder = (dir: string): string[] =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)])) : [];

/**
 * Add to Library: a Desk prop, with its game files built into it, as an item in the Library. The same prop
 * again (by its id) updates the item where it is, one version up. The item is built beside its place and
 * moved there whole, so a failure leaves nothing half made.
 */
export async function addToLibrary(req: LibraryAddRequest): Promise<LibraryAddResult> {
  const log = req.log ?? (() => undefined);
  const root = path.resolve(req.root);
  if (!fs.existsSync(root)) throw new LibraryError(`The Library's folder is missing: ${root}`);
  if (req.gameDir && isInside(root, req.gameDir)) throw new LibraryError(`The Library must not be inside the game's folder: ${root}`);
  if (isInside(req.item, root)) throw new LibraryError("That prop is in the Library already. Edit on the Desk first, then Add to Library again to update it.");
  const { name, asset, prepared } = readItem(req.item);
  if (prepared.sizeUnknown) throw new LibraryError(`${name}'s size is unknown: Set Size first, so it goes in the Library at its real size.`);
  const props = libraryAssets(root, "prop");
  const existing = props.find((p) => p.id === asset.id) ?? assetById(root, asset.id);
  if (existing && existing.kind !== "prop") throw new LibraryError(`The Library has another kind of item with this prop's id: ${existing.rel}`);
  // An update keeps its game paths, so projects that took it get the same files again.
  const modder = existing?.main ? existing.main.split("\\")[0] : slug(req.modder, "");
  if (!modder) throw new LibraryError("Say the modder's own folder for its game paths first.");
  // Its game name: kept when updating; else the Desk's, made unique among the Library's props, since two
  // props at one game path would replace each other in the game.
  const mainOf = (n: string) => `${propGameFolder(modder, n)}\\${n}.ent`;
  let gameName = existing?.main ? path.win32.basename(existing.main, ".ent") : name;
  if (!existing) for (let n = 2; props.some((p) => p.main?.toLowerCase() === mainOf(gameName).toLowerCase()); n++) gameName = `${name}_${n}`;
  const main = mainOf(gameName);

  let target: string;
  if (existing) target = existing.folder;
  else {
    const gameFolders = req.useGamePath ? propGameFolder(modder, gameName).split("\\") : [];
    const parent = path.join(root, ...safeFolder(req.folder).split("/").filter(Boolean), ...gameFolders);
    target = path.join(parent, `${gameName}.prop.asset`);
    for (let n = 2; fs.existsSync(target); n++) target = path.join(parent, `${gameName}_${n}.prop.asset`);
  }
  const itemName = path.basename(target).replace(/\.prop\.asset$/, "");
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  // Built in a hidden folder beside its place, then moved there whole.
  const work = path.join(parent, `.edgefab-add-${randomUUID().slice(0, 8)}`);
  const building = path.join(work, `${itemName}.prop.asset`);
  try {
    // The Desk item's own files, under the item's name in the Library.
    copyOwnFiles(req.item, building, name);
    if (itemName !== name) fs.renameSync(path.join(building, "source", "raw", name), path.join(building, "source", "raw", itemName));
    const project: ProjectFolders = { dir: building, name: modder, archive: path.join(building, "source", "archive"), raw: path.join(building, "source", "raw") };
    fs.mkdirSync(project.archive, { recursive: true });
    log(`Building ${gameName}'s game files into the Library item`);
    const built = await addToProject({ item: building, project, call: req.call, name: gameName, mod: modder, collision: req.collision, log });

    const version = existing ? (existing.version ?? 0) + 1 : asset.version;
    const { library: _onDesk, ...kept } = asset;
    // The same line goes in the Desk item's history (below), so the next update carries it.
    const entry = { tool: req.tool, did: existing ? `Updated in the Library, version ${version}` : "Added to the Library", date: new Date().toISOString() };
    const record: AssetRecord = {
      ...kept,
      main: built.entity,
      version,
      history: [...asset.history, entry],
      tools: { ...asset.tools, edgefab: req.tool.replace(/^EDGEfab /, "") },
    };
    fs.writeFileSync(path.join(building, "asset.json"), JSON.stringify(record, null, 2));
    const files = filesUnder(project.archive).length;

    if (existing) {
      const old = path.join(work, "old");
      await renameFolder(target, old);
      try {
        await renameFolder(building, target);
      } catch (e) {
        await renameFolder(old, target);
        throw e;
      }
    } else await renameFolder(building, target);

    // The Desk item remembers where it went, so Add to Library again updates it there.
    const rel = toRel(root, target);
    const desk = JSON.parse(fs.readFileSync(path.join(req.item, "asset.json"), "utf8")) as AssetRecord;
    fs.writeFileSync(path.join(req.item, "asset.json"), JSON.stringify({ ...desk, main: built.entity, version, history: [...desk.history, entry], library: { path: rel, version, date: entry.date } }, null, 2));
    return { folder: target, rel, id: asset.id, version, main, updated: !!existing, files, notes: built.notes };
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

// ---- Edit on the Desk ---------------------------------------------------------------------------------

/**
 * A Library prop back on the Desk, with its id, to change: Add to Library from there updates the Library's
 * item, one version up. A Desk item with the same id is replaced only with `replace`.
 */
export function editOnDesk(prop: LibraryAsset, root: string, opts: { replace?: boolean; desk?: string; tool: string }): { folder: string; replaced: boolean } {
  if (!prop.asset) throw new LibraryError(`${prop.title} isn't one of EDGEfab's props.`);
  const desk = opts.desk ?? deskDir();
  fs.mkdirSync(desk, { recursive: true });
  const onDesk = fs.readdirSync(desk).filter((d) => d.endsWith(".prop.asset")).map((d) => path.join(desk, d)).find((d) => {
    try {
      return (JSON.parse(fs.readFileSync(path.join(d, "asset.json"), "utf8")) as AssetRecord).id === prop.id;
    } catch {
      return false;
    }
  });
  if (onDesk && !opts.replace) throw new LibraryError(`${prop.title} is on the Desk already: ${onDesk}`);
  if (onDesk) fs.rmSync(onDesk, { recursive: true, force: true });
  let target = path.join(desk, `${prop.name}.prop.asset`);
  for (let n = 2; fs.existsSync(target); n++) target = path.join(desk, `${prop.name}_${n}.prop.asset`);
  const deskName = path.basename(target).replace(/\.prop\.asset$/, "");
  fs.mkdirSync(path.join(target, "source", "raw"), { recursive: true });
  fs.cpSync(path.join(prop.folder, "source", "raw", prop.name), path.join(target, "source", "raw", deskName), { recursive: true });
  const asset: AssetRecord = {
    ...prop.asset,
    library: { path: prop.rel, version: prop.asset.version, date: new Date().toISOString() },
    history: [...prop.asset.history, { tool: opts.tool, did: `Copied from the Library (version ${prop.asset.version}) to change`, date: new Date().toISOString() }],
  };
  fs.writeFileSync(path.join(target, "asset.json"), JSON.stringify(asset, null, 2));
  return { folder: target, replaced: !!onDesk };
}

// ---- the came-from note -------------------------------------------------------------------------------

/** One item of a project's `source/library.json`. Other tools' items are kept as they are. */
export interface NoteItem {
  id?: string;
  kind: string;
  path: string;
  version?: number;
  hash?: string;
  added: string;
  by: string;
  files: string[];
  [more: string]: unknown;
}

export interface Note {
  format: 1;
  items: NoteItem[];
}

const noteFile = (projectDir: string) => path.join(projectDir, "source", "library.json");

export function readNote(projectDir: string): Note {
  try {
    const data = JSON.parse(fs.readFileSync(noteFile(projectDir), "utf8"));
    if (Array.isArray(data?.items)) return { ...data, format: 1, items: data.items };
  } catch {
    // none yet, or not readable: a new one is written
  }
  return { format: 1, items: [] };
}

function writeNote(projectDir: string, note: Note): void {
  fs.mkdirSync(path.dirname(noteFile(projectDir)), { recursive: true });
  fs.writeFileSync(noteFile(projectDir), JSON.stringify(note, null, 2));
}

// ---- Add to Project from the Library ------------------------------------------------------------------

export interface FromLibraryResult {
  /** The .ent's game path. */
  entity: string;
  version: number;
  /** Files copied, relative to the project folder with `/`. */
  files: string[];
  /** Whether the project had this prop already (an earlier version, or the same). */
  replaced: boolean;
  /** The project's came-from entry for it. */
  entry: NoteItem;
}

/** The files a Library prop puts in a project: its game files, the prepared GLB and its record, relative to the item. */
export function propFiles(prop: LibraryAsset): string[] {
  const main = prop.asset?.main ?? prop.main;
  if (!main) throw new LibraryError(`${prop.title} has no game files yet: Add to Library again from the Desk.`);
  const gameFolder = path.win32.dirname(main);
  const recordFile = path.join(prop.folder, "source", "raw", ...gameFolder.split("\\"), `${path.win32.basename(main, ".ent")}.edgefab.json`);
  let listed: string[] | undefined;
  try {
    listed = (JSON.parse(fs.readFileSync(recordFile, "utf8")) as { files?: string[] }).files;
  } catch {
    listed = undefined;
  }
  // The record lists them as Add to Project wrote them, relative to the item; else every game file and the record.
  const files = listed?.length
    ? listed.map((f) => f.split(/[\\/]+/).join("/"))
    : [...filesUnder(path.join(prop.folder, "source", "archive")), recordFile].map((f) => toRel(prop.folder, f));
  for (const f of files) {
    if (!f.startsWith("source/") || f.split("/").includes("..")) throw new LibraryError(`${prop.title}'s record names a file outside its item: ${f}`);
    if (!fs.existsSync(path.join(prop.folder, ...f.split("/")))) throw new LibraryError(`${prop.title} is missing ${f}: Add to Library again from the Desk.`);
  }
  return files;
}

/**
 * Add to Project from the Library: the prop's files copied into the project at the same game paths, and the
 * project's came-from note. Files the project took from an earlier version, or from an earlier Add to
 * Project of the same prop, go first, so nothing stale is packed.
 */
export function addFromLibrary(prop: LibraryAsset, project: ProjectFolders, root: string): FromLibraryResult {
  if (!prop.asset || !prop.id) throw new LibraryError(`${prop.title} isn't one of EDGEfab's props.`);
  const files = propFiles(prop);
  const projectDir = path.resolve(project.dir);
  const note = readNote(projectDir);
  const earlier = note.items.find((i) => i.by === "edgefab" && i.id === prop.id);
  const recordRel = files.find((f) => f.endsWith(".edgefab.json"));
  const old = new Set<string>(earlier?.files ?? []);
  if (recordRel) {
    try {
      for (const f of (JSON.parse(fs.readFileSync(path.join(projectDir, ...recordRel.split("/")), "utf8")) as { files?: string[] }).files ?? []) old.add(f.split(/[\\/]+/).join("/"));
    } catch {
      // not added before
    }
  }
  for (const f of old) {
    const file = path.resolve(projectDir, ...f.split("/"));
    if (isInside(file, projectDir) && file !== projectDir) fs.rmSync(file, { force: true });
  }
  for (const f of files) {
    const to = path.join(projectDir, ...f.split("/"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(prop.folder, ...f.split("/")), to);
  }
  const entry: NoteItem = { id: prop.id, kind: "prop", path: prop.rel, version: prop.version ?? 1, added: new Date().toISOString(), by: "edgefab", files };
  note.items = [...note.items.filter((i) => !(i.by === "edgefab" && i.id === prop.id)), entry];
  writeNote(projectDir, note);
  return { entity: prop.asset.main ?? prop.main!, version: entry.version!, files, replaced: old.size > 0, entry };
}

// ---- Refresh from Library -----------------------------------------------------------------------------

export interface RefreshLine {
  entry: NoteItem;
  /** The Library's item now, when it is found (by id, else by path). */
  prop?: LibraryAsset;
  /** "newer": the Library has a later version; "same": up to date; "missing": not found in the Library. */
  state: "newer" | "same" | "missing";
}

/** EDGEfab's props in a project, from its came-from note, against the Library. */
export function refreshList(projectDir: string, root: string): RefreshLine[] {
  const ours = readNote(projectDir).items.filter((i) => i.by === "edgefab" && i.kind === "prop");
  if (!ours.length) return [];
  const props = libraryAssets(root, "prop");
  return ours.map((entry) => {
    const prop = props.find((p) => entry.id && p.id === entry.id) ?? props.find((p) => p.rel === entry.path);
    if (!prop) return { entry, state: "missing" as const };
    return { entry, prop, state: (prop.version ?? 0) > (entry.version ?? 0) ? ("newer" as const) : ("same" as const) };
  });
}
