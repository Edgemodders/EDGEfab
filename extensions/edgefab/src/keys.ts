// EDGEfab's Tripo and OpenAI keys, from REDcode's shared key store (REDcode's Keys, EDGEfab #10, REDcode's
// K4d; EDGEwave #12 was the pilot): one key per service for every EDGE tool, read through REDcode's API, which
// asks the modder once whether EDGEfab may read it ("EDGEfab wants your OpenAI key"). REDbridge decrypts the
// store; EDGEfab carries no key code of its own.
//
// With an older REDcode (no api.keys) or none, EDGEfab keeps its keys in VS Code's own encrypted secret storage
// as before (EDGEfab #4), asked for in a password box. An environment variable wins either way (TRIPO_API_KEY,
// OPENAI_API_KEY). A key EDGEfab kept itself moves into the store once, then EDGEfab's copy is removed.
// Core gets the key passed in. Never print a key, put it on a command line or in a child's environment.

import * as vscode from "vscode";
import { checkKey, envKey, KeyServices, type KeyService } from "./core";
import { Caller, findBridge, KeysBridge } from "./keyStore";

const RedcodeId = "edgemodders.redcode-cyberpunk";
const secretName = (service: KeyService) => `edgefab.${service}.key`;
const Services = Object.keys(KeyServices) as KeyService[];

const Purpose: Record<KeyService, string> = {
  tripo: "For making 3D models with Tripo, with your credits.",
  openai: "For drawing a picture first (GPT Image), before Tripo makes it 3D.",
};

/** REDcode's shared key store (REDcode's API, from the release after 0.10.15). */
interface KeysApi {
  /** The key, or undefined when none is set, it can't be read, or the modder said no. Throws when REDbridge isn't running or is too old. */
  get(service: string, caller: string): Promise<string | undefined>;
  /** REDcode's password box; saves the key for every tool. Undefined when the modder cancels. */
  ask(service: string, caller: string): Promise<string | undefined>;
  readonly onDidChange: vscode.Event<string>;
}

let secrets: vscode.SecretStorage | undefined;
let log: (line: string) => void = () => undefined;

/** REDcode's key store, or undefined with an older REDcode or none. */
async function keyStore(): Promise<KeysApi | undefined> {
  try {
    const ext = vscode.extensions.getExtension<{ apiVersion?: number; keys?: KeysApi }>(RedcodeId);
    if (!ext) return undefined;
    const api = ext.isActive ? ext.exports : await ext.activate();
    const keys = api?.apiVersion === 1 ? api.keys : undefined;
    return typeof keys?.get === "function" && typeof keys.ask === "function" ? keys : undefined;
  } catch {
    return undefined;
  }
}

/** REDbridge.exe as REDcode finds it: redcode.bridgePath, else the one inside REDcode, else on the PATH. */
function bridgeExe(): string | undefined {
  const redcodeDir = vscode.extensions.getExtension(RedcodeId)?.extensionPath;
  return findBridge({
    configured: vscode.workspace.getConfiguration("redcode").get<string>("bridgePath") || undefined,
    redcodeDirs: redcodeDir ? [redcodeDir] : [],
    pathEnv: process.env.PATH,
  });
}

/** Whether REDcode's shared key store is there (a REDcode after 0.10.15). */
export async function hasKeyStore(): Promise<boolean> {
  return !!(await keyStore());
}

/** Where EDGEfab keeps keys now, in words, for its messages. */
export async function keysPlace(): Promise<string> {
  return (await keyStore()) ? "in REDcode's Keys, shared by every EDGE tool" : "in VS Code's secret storage, for EDGEfab only";
}

/**
 * Gives the key code VS Code's secret storage and a log, listens for keys changed elsewhere, and starts the
 * one-time move of EDGEfab's own keys into REDcode's store. Called once at activation.
 */
export async function initKeys(context: vscode.ExtensionContext, logLine: (line: string) => void): Promise<void> {
  secrets = context.secrets;
  log = logLine;
  const keys = await keyStore();
  if (!keys) return;
  context.subscriptions.push(
    keys.onDidChange((service) => {
      if ((Services as string[]).includes(service)) log(`Keys: the ${KeyServices[service as KeyService].name} key changed in REDcode's Keys`);
    }),
  );
  void moveToStore();
}

/** The move, tried once a session; a key read waits for it, so it never finds the store empty mid-move. */
let moving: Promise<void> | undefined;
const moveToStore = () => (moving ??= move());

/**
 * Moves the keys EDGEfab kept in VS Code's secret storage (EDGEfab 0.1.0) into REDcode's store, through
 * REDbridge (REDcode's API saves only a key typed in its box), then removes EDGEfab's copies. When the store
 * already has a key for a service, that one is kept and EDGEfab's copy removed. Says so once. On a failure
 * EDGEfab's copy stays, is used while the store can't be reached, and the move is tried again next session.
 */
async function move(): Promise<void> {
  const own: [KeyService, string][] = [];
  for (const s of Services) {
    const k = (await secrets?.get(secretName(s)))?.trim();
    if (k) own.push([s, k]);
  }
  if (!own.length) return;
  const exe = bridgeExe();
  if (!exe) return log("Keys: EDGEfab's own keys stay in VS Code's secret storage: REDbridge.exe was not found");
  const bridge = new KeysBridge({ exe, dotnetRoot: vscode.workspace.getConfiguration("redcode").get<string>("dotnetRoot") || undefined });
  const moved: string[] = [];
  const kept: string[] = [];
  try {
    for (const [s, k] of own) {
      const { name } = KeyServices[s];
      const info = await bridge.info(s);
      const had = info.source === "file" && !info.unreadable;
      if (!had) await bridge.set(s, k);
      await secrets?.delete(secretName(s));
      (had ? kept : moved).push(name);
      log(had ? `Keys: REDcode's Keys had a ${name} key already; EDGEfab's own copy removed` : `Keys: the ${name} key moved from EDGEfab's secret storage to REDcode's Keys`);
    }
  } catch (e) {
    log(`Keys: could not move a key to REDcode's Keys, so EDGEfab keeps its own copy for now: ${(e as Error).message}`);
  } finally {
    bridge.close();
  }
  if (!moved.length && !kept.length) return;
  const and = (names: string[]) => names.join(" and ");
  const text = [
    moved.length ? `your ${and(moved)} ${moved.length > 1 ? "keys are" : "key is"} now in REDcode's Keys, shared by every EDGE tool.` : "",
    kept.length ? `REDcode's Keys already had ${kept.length > 1 ? "keys" : "a key"} for ${and(kept)}, so EDGEfab uses ${kept.length > 1 ? "those" : "it"}.` : "",
  ].filter(Boolean).join(" ");
  // Not awaited: a key read waiting for the move must not wait for the modder to close this.
  void vscode.window.showInformationMessage(`EDGEfab: ${text} EDGEfab no longer keeps copies of its own.`, "Open REDcode's Keys").then((pick) => {
    if (pick) void vscode.commands.executeCommand("redcode.keys.focus");
  });
}

/**
 * The key, or undefined when there is none (or the modder said no to EDGEfab reading it). With REDcode's store:
 * from the store, after the move. With an older REDcode: the environment, else VS Code's secret storage.
 * Throws, with the reason, only when the store can't be reached and EDGEfab has no copy of its own.
 */
export async function getKey(service: KeyService): Promise<string | undefined> {
  const keys = await keyStore();
  if (!keys) return envKey(service) ?? ((await secrets?.get(secretName(service)))?.trim() || undefined);
  await moveToStore();
  try {
    return (await keys.get(service, Caller))?.trim() || undefined;
  } catch (e) {
    // REDbridge not running (yet) or too old: the environment, or a key EDGEfab still keeps itself, else the reason.
    const own = envKey(service) ?? (await secrets?.get(secretName(service)))?.trim();
    if (own) return own;
    throw new Error(`EDGEfab reads the ${KeyServices[service].name} key from REDcode's Keys, which can't be reached: ${(e as Error).message}`);
  }
}

/** Asks for the key: REDcode's password box (saved for every EDGE tool), else EDGEfab's own. Undefined when the modder cancels or it fails. */
export async function setKey(service: KeyService): Promise<string | undefined> {
  const keys = await keyStore();
  if (keys) {
    try {
      return (await keys.ask(service, Caller))?.trim() || undefined;
    } catch (e) {
      void vscode.window.showErrorMessage(`EDGEfab: REDcode's Keys can't be reached, so the key can't be saved: ${(e as Error).message}`);
      return undefined;
    }
  }
  const { name, from } = KeyServices[service];
  const k = await vscode.window.showInputBox({
    title: `EDGEfab: ${name} API key`,
    prompt: `${Purpose[service]} Kept encrypted in VS Code's secret storage, for EDGEfab only, and sent only to ${name}. Make one at ${from}.`,
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? checkKey(service, v) : null),
  });
  if (!k?.trim() || !secrets) return undefined;
  await secrets.store(secretName(service), k.trim());
  return k.trim();
}

/** The key, else asked for; undefined when the modder stops. A store that can't be reached says why, once. */
export async function keyOrAsk(service: KeyService): Promise<string | undefined> {
  try {
    return (await getKey(service)) ?? (await setKey(service));
  } catch (e) {
    void vscode.window.showErrorMessage(`EDGEfab: ${(e as Error).message}`);
    return undefined;
  }
}

export async function clearKey(service: KeyService): Promise<void> {
  const { name, env } = KeyServices[service];
  if (await keyStore()) {
    await secrets?.delete(secretName(service));
    // The key is every EDGE tool's now: REDcode, its keeper, removes it (Remove Key in its Keys view).
    const pick = await vscode.window.showInformationMessage(`EDGEfab: your ${name} key is shared by every EDGE tool, in REDcode's Keys. Remove it there: Remove Key on ${name}.`, "Open REDcode's Keys");
    if (pick) void vscode.commands.executeCommand("redcode.keys.focus");
    return;
  }
  const go = await vscode.window.showWarningMessage(`Clear EDGEfab's ${name} API key?`, { modal: true, detail: `EDGEfab asks for it again when it needs it.${envKey(service) ? ` ${env} is set in the environment, and still wins.` : ""}` }, "Clear It");
  if (go !== "Clear It") return;
  await secrets?.delete(secretName(service));
  void vscode.window.showInformationMessage(`EDGEfab: the ${name} API key is cleared.`);
}
