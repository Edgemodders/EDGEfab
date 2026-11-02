// EDGEfab's VS Code side: the Desk view and its commands. Making and preparing live in core (no VS Code),
// which the MCP server shares.

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { checkKey, makeModel, readSettings, sharedKeys, tripoBalance, writeSettings, DefaultFaceLimit, type MadeModel, type TripoPlan } from "./core";
import { connectAssistant, installServer, registerWithEditor } from "./mcp";
import { entryOf, DeskView } from "./deskView";

declare const __VERSION__: string;

let output: vscode.OutputChannel;
const log = (line: string) => output.appendLine(`${new Date().toLocaleTimeString()} ${line}`);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function setTripoKey(): Promise<boolean> {
  const k = await vscode.window.showInputBox({
    title: "EDGEfab: Tripo API key",
    prompt: "For Generate with Tripo. Kept encrypted for your Windows account in the EDGE tools' shared key store, so every EDGE tool that needs it uses it too, and sent only to Tripo. Make one at platform.tripo3d.ai, under API Keys.",
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim() ? checkKey("tripo", v) : null),
  });
  if (!k?.trim()) return false;
  await sharedKeys.setKey("tripo", k.trim());
  return true;
}

async function clearTripoKey(): Promise<void> {
  const go = await vscode.window.showWarningMessage("Clear the Tripo API key?", { modal: true, detail: "It is the EDGE tools' shared key: every EDGE tool that uses it asks for it again." }, "Clear It");
  if (!go) return;
  await sharedKeys.removeKey("tripo");
  void vscode.window.showInformationMessage("EDGEfab: the Tripo API key is cleared.");
}

/** Asks once whether the modder's Tripo plan is paid or free, from Tripo's terms (5.2), and keeps the answer. */
async function askTripoPlan(): Promise<TripoPlan | undefined> {
  const current = readSettings().tripoPlan;
  const picked = await vscode.window.showQuickPick(
    [
      { label: "$(pass) Paid plan", description: current === "paid" ? "(now)" : "", detail: "Pro, Advanced, Premium or bought API credits: the models are yours to use, change and release in mods.", plan: "paid" as const },
      { label: "$(warning) Free plan", description: current === "free" ? "(now)" : "", detail: "Tripo keeps all rights to the models, so they can't go in a released mod. EDGEfab marks them so.", plan: "free" as const },
      { label: "$(link-external) Read Tripo's terms", detail: "https://www.tripo3d.ai/terms (section 5.2)", plan: "terms" as const },
    ],
    { title: "EDGEfab: which Tripo plan is your key on?", placeHolder: "Each model records it, and the packed mod's credits will say it", ignoreFocusOut: true },
  );
  if (!picked) return undefined;
  if (picked.plan === "terms") {
    void vscode.env.openExternal(vscode.Uri.parse("https://www.tripo3d.ai/terms"));
    return undefined;
  }
  writeSettings({ tripoPlan: picked.plan });
  return picked.plan;
}

function report(made: MadeModel): void {
  const p = made.prepared;
  log(`Made ${made.name} in ${made.folder}`);
  log(`  ${p.size.height.toFixed(2)} m tall, ${p.size.width.toFixed(2)} × ${p.size.depth.toFixed(2)} m`);
  for (const s of p.submeshes) log(`  ${s.name}: ${s.triangles} triangles, ${s.vertices} vertices`);
  for (const t of p.textures) log(`  ${t.slot}: ${t.file}`);
  for (const n of p.notes) log(`  Note: ${n}`);
}

async function make(run: (progress: (step: string) => void, signal: AbortSignal) => Promise<MadeModel>, view: DeskView): Promise<void> {
  try {
    const made = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "EDGEfab", cancellable: true }, (progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      return run((step) => progress.report({ message: step }), abort.signal);
    });
    report(made);
    view.refresh();
    const lods = new Set(made.prepared.submeshes.map((s) => s.lod)).size;
    const pick = await vscode.window.showInformationMessage(
      `EDGEfab made ${made.name}: ${made.prepared.size.height.toFixed(2)} m tall, ${lods} levels of detail, ready for the game.${made.prepared.notes.length ? " See its notes on the Desk." : ""}`,
      ...(made.preview ? ["Open Preview"] : []),
      "Reveal",
    );
    if (pick === "Open Preview" && made.preview) void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(made.preview));
    if (pick === "Reveal") void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(made.folder));
  } catch (e) {
    log(`Failed: ${message(e)}`);
    const pick = await vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`, "Show Log");
    if (pick) output.show();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("EDGEfab");
  const version = __VERSION__;
  log(`EDGEfab ${version}`);
  const view = new DeskView();

  installServer(context.extensionPath, log);
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider("edgefab.desk", view),
    ...registerWithEditor(version, log),

    vscode.commands.registerCommand("edgefab.importGlb", async () => {
      const picked = await vscode.window.showOpenDialog({ title: "Import a textured 3D model", openLabel: "Import", filters: { "glTF models": ["glb", "gltf"] }, canSelectMany: false });
      if (!picked?.[0]) return;
      await make((progress) => makeModel({ from: "file", file: picked[0].fsPath }, { version, onProgress: progress }), view);
    }),

    vscode.commands.registerCommand("edgefab.generate", async () => {
      if (!(await sharedKeys.hasKey("tripo"))) {
        const go = await vscode.window.showInformationMessage("Generate with Tripo needs your own Tripo API key. Each model costs about 20 Tripo credits.", "Set Tripo Key");
        if (go !== "Set Tripo Key" || !(await setTripoKey())) return;
      }
      const plan = readSettings().tripoPlan ?? (await askTripoPlan());
      if (!plan) return;
      const prompt = await vscode.window.showInputBox({
        title: "EDGEfab: Generate with Tripo",
        prompt: "Describe one object, such as a rusty oil drum or a neon street sign. Tripo makes it textured, in about 2 minutes.",
        ignoreFocusOut: true,
      });
      if (!prompt?.trim()) return;
      let balance = "";
      try {
        balance = ` You have ${(await tripoBalance()).balance.toLocaleString("en-US")}.`;
      } catch (e) {
        log(`Tripo balance: ${message(e)}`);
      }
      const go = await vscode.window.showInformationMessage(`Make "${prompt.trim()}" with Tripo? It costs about 20 credits.${balance}`, { modal: true }, "Generate");
      if (go !== "Generate") return;
      await make((progress, signal) => makeModel({ from: "tripo", request: { prompt, faceLimit: DefaultFaceLimit }, plan }, { version, onProgress: progress, call: { signal } }), view);
    }),

    vscode.commands.registerCommand("edgefab.setTripoKey", async () => {
      if (await setTripoKey()) void vscode.window.showInformationMessage("EDGEfab: the Tripo key is set, in the EDGE tools' shared key store.");
    }),
    vscode.commands.registerCommand("edgefab.clearTripoKey", clearTripoKey),
    vscode.commands.registerCommand("edgefab.tripoPlan", askTripoPlan),
    vscode.commands.registerCommand("edgefab.connectAssistant", () => connectAssistant(context, log)),
    vscode.commands.registerCommand("edgefab.showLog", () => output.show()),
    vscode.commands.registerCommand("edgefab.refresh", () => view.refresh()),
    vscode.commands.registerCommand("edgefab.reveal", (item: unknown) => {
      const entry = entryOf(item);
      if (entry) void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(entry.folder));
    }),
    vscode.commands.registerCommand("edgefab.openPreview", (item: unknown) => {
      const entry = entryOf(item);
      if (entry?.preview) void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(entry.preview));
    }),
    vscode.commands.registerCommand("edgefab.delete", async (item: unknown) => {
      const entry = entryOf(item);
      if (!entry) return;
      const go = await vscode.window.showWarningMessage(`Delete ${entry.title}?`, { modal: true, detail: `Its folder goes, with the model and its textures: ${entry.folder}` }, "Delete");
      if (go !== "Delete") return;
      fs.rmSync(entry.folder, { recursive: true, force: true });
      log(`Deleted ${path.basename(entry.folder)}`);
      view.refresh();
    }),
  );
}

export function deactivate(): void {}
