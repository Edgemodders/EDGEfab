// Where EDGEfab keeps its own files, and the few settings the extension and the MCP server share. The MCP
// server cannot read VS Code's settings, so a shared setting lives in a small file in EDGEfab's folder.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** EDGEfab's own folder: %LOCALAPPDATA%\EDGEfab on Windows. */
export function dataDir(): string {
  if (process.env.EDGEFAB_DATA) return process.env.EDGEFAB_DATA; // for tests
  const base = process.platform === "win32" ? (process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local")) : path.join(os.homedir(), ".cache");
  return path.join(base, "EDGEfab");
}

/** The Desk: EDGEfab's own scratch workspace, kept across restarts, where made models wait until they go into
 *  a project or the Library (owner, 2026-11-02). Its items have the Library's asset shape, so moving one is a copy. */
export function deskDir(): string {
  return path.join(dataDir(), "desk");
}

/** Whether the modder's Tripo plan is paid (the models are theirs) or free (they are Tripo's), from Tripo's terms 5.2. */
export type TripoPlan = "paid" | "free";

export interface SharedSettings {
  tripoPlan?: TripoPlan;
  /** The modder's own folder in Library props' game paths: `<modder>\props\<name>\`. */
  modder?: string;
  /** Add to Library's last choices, offered again: a folder under the root with `/`, and Use the game path. */
  libraryFolder?: string;
  useGamePath?: boolean;
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

/**
 * Renames a folder, waiting for Windows: it refuses while anything has a file inside open, and an antivirus
 * or the search indexer opens files just written. Tries for about 13 seconds.
 */
export async function renameFolder(from: string, to: string, waits = [50, 100, 200, 400, 800, 1600, 3200, 6400]): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw e;
      if (i >= waits.length) throw new Error(`Could not move ${from} to ${to}: something has a file in it open, such as an antivirus or the search indexer. Try again in a moment. (${code})`);
      await new Promise((resolve) => setTimeout(resolve, waits[i]));
    }
  }
}
