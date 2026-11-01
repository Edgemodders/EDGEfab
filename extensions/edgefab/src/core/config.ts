// Where EDGEfab keeps its own files, and the few settings the extension and the MCP server share. The MCP
// server cannot read VS Code's settings, so a shared setting lives in a small file in EDGEfab's folder.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** EDGEfab's own folder: %LOCALAPPDATA%\EDGEfab on Windows. */
export function dataDir(): string {
  const base = process.platform === "win32" ? (process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")) : path.join(os.homedir(), ".cache");
  return path.join(base, "EDGEfab");
}

/** Where a made model is prepared until it goes into a project or the Library. */
export function workDir(): string {
  return path.join(dataDir(), "work");
}

/** Whether the modder's Tripo plan is paid (the models are theirs) or free (they are Tripo's), from Tripo's terms 5.2. */
export type TripoPlan = "paid" | "free";

export interface SharedSettings {
  tripoPlan?: TripoPlan;
}

const settingsFile = () => path.join(dataDir(), "settings.json");

export function readSettings(): SharedSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8")) as SharedSettings;
  } catch {
    return {};
  }
}

export function writeSettings(change: Partial<SharedSettings>): SharedSettings {
  const next = { ...readSettings(), ...change };
  fs.mkdirSync(dataDir(), { recursive: true });
  const temp = `${settingsFile()}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(next, null, 2));
  fs.renameSync(temp, settingsFile());
  return next;
}

/** A lowercase name with no spaces, for files and game paths: "Rusty oil drum!" becomes "rusty_oil_drum". */
export function slug(words: string, fallback = "model"): string {
  const s = words.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40).replace(/_+$/, "");
  return s || fallback;
}
