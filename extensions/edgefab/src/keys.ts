// EDGEfab's keys in VS Code's own encrypted secret storage (SecretStorage, kept by VS Code in the operating
// system's credential store), for EDGEfab only, asked for in a password box when missing. The environment
// variable wins (TRIPO_API_KEY, OPENAI_API_KEY), for modders who keep keys there.
//
// Each EDGE extension keeps its own keys and asks for them itself (the owner's decision of 2026-11-11, EDGEfab #4):
// the EDGE tools' shared key store, which decrypted key files through PowerShell, is shelved, since the VS Code
// Marketplace refused EDGEhack for "suspicious content" with it inside. Core gets the key passed in.

import * as vscode from "vscode";
import { checkKey, envKey, KeyServices, type KeyService } from "./core";

const secretName = (service: KeyService) => `edgefab.${service}.key`;

const Purpose: Record<KeyService, string> = {
  tripo: "For making 3D models with Tripo, with your credits.",
  openai: "For drawing a picture first (GPT Image), before Tripo makes it 3D.",
};

let secrets: vscode.SecretStorage | undefined;

/** Gives the key code VS Code's secret storage; called once at activation. */
export function initKeys(context: vscode.ExtensionContext): void {
  secrets = context.secrets;
}

/** The key: from the environment, else VS Code's secret storage. Undefined when there is none. */
export async function getKey(service: KeyService): Promise<string | undefined> {
  return envKey(service) ?? ((await secrets?.get(secretName(service)))?.trim() || undefined);
}

export async function hasKey(service: KeyService): Promise<boolean> {
  return !!(await getKey(service));
}

/** Asks for the key in a password box and keeps it. Answers it, or undefined when the modder cancels. */
export async function setKey(service: KeyService): Promise<string | undefined> {
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

export async function clearKey(service: KeyService): Promise<void> {
  const { name, env } = KeyServices[service];
  const go = await vscode.window.showWarningMessage(`Clear EDGEfab's ${name} API key?`, { modal: true, detail: `EDGEfab asks for it again when it needs it.${envKey(service) ? ` ${env} is set in the environment, and still wins.` : ""}` }, "Clear It");
  if (go !== "Clear It") return;
  await secrets?.delete(secretName(service));
  void vscode.window.showInformationMessage(`EDGEfab: the ${name} API key is cleared.`);
}
