// EDGEfab's VS Code side: the Desk view and its commands. Making and preparing live in core (no VS Code),
// which the MCP server shares.

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  addToProject, callOf, drawPicture, glowOff, glowWords, makeModel, paintedLightsGlow, projectFolders, readSettings, setGlowStrength, setSize, startBridge, tripoBalance, tripoCredits, writeSettings,
  DefaultCollision, DefaultGlowStrength, DetailLevels, GlowLevels, ViewNames,
  type Collision, type Detail, type GlowResult, type MadeModel, type ProjectFolders, type TextToModel, type TripoPlan, type ViewName,
} from "./core";
import { connectAssistant, installServer, registerWithEditor } from "./mcp";
import { entryOf, DeskView } from "./deskView";
import { clearKey, getKey, initKeys, setKey } from "./keys";

declare const __VERSION__: string;

const RedcodeId = "edgemodders.redcode-cyberpunk";

/** The parts of REDcode's API (version 1, its docs/api.md) EDGEfab uses; project and packAndTry came after 0.9.0. */
interface REDcodeApi {
  readonly apiVersion: 1;
  bridge(): unknown;
  project?(): { name: string; dir: string; archive: string } | undefined;
  packAndTry?(): Promise<"hot" | "installed" | undefined>;
}

/** REDcode's API, only when REDcode is already active (activating it here could race its own start). */
function redcode(): REDcodeApi | undefined {
  const ext = vscode.extensions.getExtension<REDcodeApi>(RedcodeId);
  const api = ext?.isActive ? ext.exports : undefined;
  return api?.apiVersion === 1 ? api : undefined;
}

let output: vscode.OutputChannel;
const log = (line: string) => output.appendLine(`${new Date().toLocaleTimeString()} ${line}`);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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

/** Opens a model in REDcode's 3D view, which shows its textures, its parts to show or hide, and its levels of detail. */
async function openIn3D(glb: string | undefined, preview?: string): Promise<void> {
  if (!glb || !fs.existsSync(glb)) {
    void vscode.window.showWarningMessage("EDGEfab: this prop has no model to show. Make it again to get one.");
    return;
  }
  if (!vscode.extensions.getExtension(RedcodeId)) {
    const pick = await vscode.window.showInformationMessage(
      "EDGEfab shows models in REDcode's 3D view, with their textures, parts and levels of detail. Install REDcode to see this one.",
      "Install REDcode",
      ...(preview ? ["Open Preview"] : []),
    );
    if (pick === "Install REDcode") void vscode.commands.executeCommand("workbench.extensions.search", RedcodeId);
    if (pick === "Open Preview" && preview) void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(preview));
    return;
  }
  try {
    await vscode.commands.executeCommand("vscode.openWith", vscode.Uri.file(glb), "redcode.mesh");
  } catch (e) {
    log(`Open in 3D: ${message(e)}`);
    void vscode.window.showErrorMessage(`EDGEfab: REDcode's 3D view didn't open: ${message(e)}`);
  }
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
    const parts = made.prepared.parts?.length ? `, in ${made.prepared.parts.length} parts` : "";
    const size = made.prepared.sizeUnknown ? "Its size is unknown: Set Size before adding it to a project." : `${made.prepared.size.height.toFixed(2)} m tall, ready for the game.`;
    const pick = await vscode.window.showInformationMessage(
      `EDGEfab made ${made.name}: ${lods} levels of detail${parts}. ${size}${made.prepared.notes.length ? " See its notes on the Desk." : ""}`,
      ...(made.prepared.sizeUnknown ? ["Set Size"] : []),
      "Open in 3D",
      ...(made.preview ? ["Open Preview"] : []),
      "Reveal",
    );
    if (pick === "Set Size") await askSize(made.folder, made.name, made.prepared.size.height, view);
    if (pick === "Open in 3D") await openIn3D(made.prepared.view, made.preview);
    if (pick === "Open Preview" && made.preview) void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(made.preview));
    if (pick === "Reveal") void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(made.folder));
  } catch (e) {
    log(`Failed: ${message(e)}`);
    const pick = await vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`, "Show Log");
    if (pick) output.show();
  }
}

/** A height in metres from the modder; undefined when they leave it empty or cancel. */
async function askHeight(title: string, prompt: string, current?: number): Promise<number | undefined> {
  const typed = await vscode.window.showInputBox({
    title,
    prompt,
    value: current ? String(+current.toFixed(2)) : "",
    placeHolder: "In metres, such as 1.8 for a vending machine, 0.9 for an oil drum, 0.3 for a lamp",
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() || (Number(v) > 0 && Number(v) <= 100) ? null : "A height in metres, above 0 and up to 100."),
  });
  return typed?.trim() ? Number(typed) : undefined;
}

async function askSize(folder: string, title: string, current: number, view: DeskView): Promise<void> {
  const height = await askHeight(`EDGEfab: how tall is ${title}?`, "Its height in metres. It is scaled evenly to it. If it's in a project already, Add to Project again after.", current);
  if (!height) return;
  try {
    const p = await setSize(folder, height, { version: __VERSION__ });
    view.refresh();
    void vscode.window.showInformationMessage(`EDGEfab: ${title} is ${p.size.height.toFixed(2)} m tall now, ${p.size.width.toFixed(2)} × ${p.size.depth.toFixed(2)} m.`);
  } catch (e) {
    void vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`);
  }
}

/** The Tripo key and plan, asked for when missing; undefined when the modder stops. */
async function readyForTripo(): Promise<{ key: string; plan: TripoPlan } | undefined> {
  let key = await getKey("tripo");
  if (!key) {
    const go = await vscode.window.showInformationMessage("Making a 3D model needs your own Tripo API key: Tripo makes it, with your credits.", "Set Tripo Key");
    if (go !== "Set Tripo Key" || !(key = await setKey("tripo"))) return undefined;
  }
  const plan = readSettings().tripoPlan ?? (await askTripoPlan());
  return plan ? { key, plan } : undefined;
}

/** How much detail, in parts or not (the setting), how tall; then the cost, confirmed. */
async function askTripoSettings(title: string, fromPicture: boolean, key: string): Promise<{ request: Omit<TextToModel, "prompt">; height?: number } | undefined> {
  const parts = vscode.workspace.getConfiguration("edgefab").get<boolean>("generateInParts") ?? true;
  const views = fromPicture ? (Object.fromEntries(ViewNames.map((v) => [v, ""])) as Record<ViewName, string>) : undefined;
  const credits = (d: Detail) => tripoCredits({ ...DetailLevels[d].settings, views, parts });
  const picked = await vscode.window.showQuickPick(
    (Object.keys(DetailLevels) as Detail[]).map((d) => ({ label: DetailLevels[d].label, description: `about ${credits(d)} credits`, detail: DetailLevels[d].detail, d })),
    { title: `EDGEfab: how much detail for ${title}?`, placeHolder: parts ? "In parts, each with its own material (the edgefab.generateInParts setting)" : "In one piece (the edgefab.generateInParts setting)", ignoreFocusOut: true },
  );
  if (!picked) return undefined;
  let height: number | undefined;
  if (parts) {
    height = await askHeight(`EDGEfab: how tall is ${title}?`, "Tripo gives models in parts no real size. Its height in metres; leave it empty to set it later with Set Size.");
  }
  let balance = "";
  try {
    balance = ` You have ${(await tripoBalance({ key })).balance.toLocaleString("en-US")}.`;
  } catch (e) {
    log(`Tripo balance: ${message(e)}`);
  }
  const how = fromPicture ? "from its four views" : "from your words";
  const go = await vscode.window.showInformationMessage(`Make ${title} in 3D with Tripo, ${how}${parts ? ", in parts" : ""}? About ${credits(picked.d)} credits and 3 to 4 minutes.${balance}`, { modal: true }, "Make 3D");
  if (go !== "Make 3D") return undefined;
  return { request: { ...DetailLevels[picked.d].settings, parts }, height };
}

/** Make 3D: Tripo's model from a Desk item's last picture. */
async function make3d(folder: string, title: string, view: DeskView): Promise<void> {
  const tripo = await readyForTripo();
  if (!tripo) return;
  const settings = await askTripoSettings(title, true, tripo.key);
  if (!settings) return;
  await make(
    (progress, signal) => makeModel({ from: "picture", item: folder, request: settings.request, plan: tripo.plan }, { version: __VERSION__, onProgress: progress, call: { signal, key: tripo.key }, prepare: settings.height ? { height: settings.height } : undefined }),
    view,
  );
}

/** Picture first, step 1: draws the four views, shows them, and offers Make 3D or other words. */
async function drawAndOffer(words: string, item: string | undefined, view: DeskView): Promise<void> {
  const key = (await getKey("openai")) ?? (await setKey("openai"));
  if (!key) return;
  let drawn: Awaited<ReturnType<typeof drawPicture>>;
  try {
    drawn = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "EDGEfab", cancellable: true }, (progress, token) => {
      const abort = new AbortController();
      token.onCancellationRequested(() => abort.abort());
      progress.report({ message: "Drawing it from four sides (about 30 seconds)..." });
      return drawPicture(words, { version: __VERSION__, item, call: { signal: abort.signal, key } });
    });
  } catch (e) {
    log(`Picture: ${message(e)}`);
    void vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`);
    return;
  }
  log(`Drew ${drawn.name}, picture ${drawn.take.take}, in ${drawn.take.seconds} s: ${drawn.take.sheet}`);
  view.refresh();
  void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(drawn.take.sheet), { preview: true });
  const pick = await vscode.window.showInformationMessage(
    `EDGEfab drew ${drawn.name} from four sides. Make it 3D, or change the words? It waits on the Desk either way.`,
    "Make 3D",
    "Change the Words",
  );
  if (pick === "Make 3D") await make3d(drawn.folder, drawn.name, view);
  if (pick === "Change the Words") await redraw(drawn.folder, drawn.take.words, view);
}

async function redraw(folder: string, words: string, view: DeskView): Promise<void> {
  const changed = await vscode.window.showInputBox({ title: "EDGEfab: Change the Words", prompt: "Change what it is or how it looks; it's drawn again from four sides. The earlier pictures are kept.", value: words, ignoreFocusOut: true });
  if (changed?.trim()) await drawAndOffer(changed.trim(), folder, view);
}

/** How strongly to glow, in plain words, with a number one click away. */
async function askStrength(title: string, current?: number): Promise<number | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      ...GlowLevels.map((l) => ({ label: l.label, description: `strength ${l.strength}${l.strength === current ? " (now)" : ""}`, detail: l.detail, strength: l.strength as number | undefined })),
      { label: "A number...", description: current !== undefined ? `now ${current}` : "", detail: "0.125 is about the limit of what shows in the game; 8 is white-hot", strength: undefined },
    ],
    { title, placeHolder: "It depends on how much of it glows and where it stands: try one, look at it in the game, change it", ignoreFocusOut: true },
  );
  if (!picked) return undefined;
  if (picked.strength !== undefined) return picked.strength;
  const typed = await vscode.window.showInputBox({
    title,
    prompt: "A glow strength, above 0 and up to 64.",
    value: current !== undefined ? String(current) : "1",
    ignoreFocusOut: true,
    validateInput: (v) => (Number(v) > 0 && Number(v) <= 64 ? null : "A number above 0, up to 64."),
  });
  return typed ? Number(typed) : undefined;
}

/** Runs a change to an item's glow, then says what happened and offers the 3D view. */
async function changeGlow(view: DeskView, entry: { model?: string; preview?: string }, run: () => Promise<GlowResult>, said: (r: GlowResult) => string): Promise<void> {
  try {
    const r = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "EDGEfab: the glow" }, run);
    view.refresh();
    for (const n of r.notes) log(`Note: ${n}`);
    const pick = await vscode.window.showInformationMessage(`EDGEfab: ${said(r)}${r.notes.length ? ` ${r.notes.join(" ")}` : ""} If it's in a project already, Add to Project again to carry it over.`, "Open in 3D");
    if (pick) await openIn3D(r.view ?? entry.model, entry.preview);
  } catch (e) {
    log(`Glow: ${message(e)}`);
    void vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`);
  }
}

/** The project to add to: REDcode's open one, else one the modder picks. */
async function pickProject(): Promise<ProjectFolders | undefined> {
  const open = redcode()?.project?.();
  const fromRedcode = open ? projectFolders(open.dir) : undefined;
  if (fromRedcode) return fromRedcode;
  const picked = await vscode.window.showOpenDialog({
    title: "Add to which WolvenKit project?",
    openLabel: "Add to This Project",
    filters: { "WolvenKit projects": ["cpmodproj"] },
    canSelectMany: false,
  });
  if (!picked?.[0]) return undefined;
  const p = projectFolders(picked[0].fsPath);
  if (!p) void vscode.window.showErrorMessage(`EDGEfab: ${picked[0].fsPath} is not a WolvenKit project.`);
  return p;
}

async function addItemToProject(folder: string, title: string): Promise<void> {
  const project = await pickProject();
  if (!project) return;
  const collision = vscode.workspace.getConfiguration("edgefab").get<Collision>("collision") ?? DefaultCollision;
  // REDcode's REDbridge when REDcode runs; else one of our own for this call.
  const shared = redcode()?.bridge();
  let own: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `EDGEfab: adding ${title} to ${project.name}` }, async (progress) => {
      const step = (m: string) => {
        log(m);
        progress.report({ message: m.trim() });
      };
      let call;
      if (shared) call = callOf(shared);
      else {
        step("Starting REDbridge");
        own = await startBridge(log);
        call = own.call;
      }
      return addToProject({ item: folder, project, call, collision, log: step });
    });
    log(`Added ${title} to ${project.name}${result.replaced ? " (replacing the earlier one)" : ""}: ${result.entity}`);
    for (const f of result.files) log(`  ${f}`);
    for (const n of result.notes) log(`  Note: ${n}`);
    const how = collision === "physical" ? "solid (a physical mesh with a box)" : collision === "box" ? "solid (a box collider)" : "with no collision";
    const actions = [...(redcode()?.packAndTry ? ["Pack and Try"] : []), "Reveal Entity", "Show Log"];
    const pick = await vscode.window.showInformationMessage(
      `EDGEfab added ${title} to ${project.name}, ${how}. Place ${path.win32.basename(result.entity)} with EDGEbuilder, or spawn it.`,
      ...actions,
    );
    if (pick === "Pack and Try") await redcode()?.packAndTry?.();
    if (pick === "Reveal Entity") void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(path.join(project.archive, ...result.entity.split("\\"))));
    if (pick === "Show Log") output.show();
  } catch (e) {
    log(`Add to Project failed: ${message(e)}`);
    const pick = await vscode.window.showErrorMessage(`EDGEfab: ${message(e)}`, "Show Log");
    if (pick) output.show();
  } finally {
    own?.client.stop();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("EDGEfab");
  initKeys(context);
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
      const words = (await vscode.window.showInputBox({
        title: "EDGEfab: Generate from Words",
        prompt: "Describe one object, such as a rusty oil drum or a cyberpunk vending machine with a glowing screen. It's drawn from four sides first, then made 3D.",
        ignoreFocusOut: true,
      }))?.trim();
      if (!words) return;
      let how: "picture" | "words" = "picture";
      if (!(await getKey("openai"))) {
        const picked = await vscode.window.showQuickPick(
          [
            { label: "$(file-media) Draw it first", description: "(recommended)", detail: "OpenAI's GPT Image draws it from four sides in about 30 seconds, for a few cents of your OpenAI credit: change the words until it's right, then make it 3D. Needs your own OpenAI key (the one EDGEmat uses).", how: "picture" as const },
            { label: "$(sparkle) Straight to 3D", detail: "Tripo makes it from the words alone: less true to them, and its back and sides are Tripo's guesses.", how: "words" as const },
          ],
          { title: `EDGEfab: how to make "${words}"?`, ignoreFocusOut: true },
        );
        if (!picked) return;
        how = picked.how;
        if (how === "picture" && !(await setKey("openai"))) return;
      }
      if (how === "picture") return drawAndOffer(words, undefined, view);
      const tripo = await readyForTripo();
      if (!tripo) return;
      const settings = await askTripoSettings(`"${words}"`, false, tripo.key);
      if (!settings) return;
      await make(
        (progress, signal) => makeModel({ from: "tripo", request: { ...settings.request, prompt: words }, plan: tripo.plan }, { version, onProgress: progress, call: { signal, key: tripo.key }, prepare: settings.height ? { height: settings.height } : undefined }),
        view,
      );
    }),
    vscode.commands.registerCommand("edgefab.make3d", async (item: unknown) => {
      const entry = entryOf(item);
      if (entry?.picture) await make3d(entry.folder, entry.title, view);
    }),
    vscode.commands.registerCommand("edgefab.redraw", async (item: unknown) => {
      const entry = entryOf(item);
      if (entry?.picture) await redraw(entry.folder, entry.picture.words, view);
    }),
    vscode.commands.registerCommand("edgefab.openPicture", (item: unknown) => {
      const entry = entryOf(item);
      if (entry?.picture) void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(entry.picture.sheet));
    }),
    vscode.commands.registerCommand("edgefab.setSize", async (item: unknown) => {
      const entry = entryOf(item);
      if (entry?.prepared) await askSize(entry.folder, entry.title, entry.prepared.size.height, view);
    }),
    vscode.commands.registerCommand("edgefab.setOpenAIKey", async () => {
      if (await setKey("openai")) void vscode.window.showInformationMessage("EDGEfab: the OpenAI key is set, in VS Code's secret storage.");
    }),
    vscode.commands.registerCommand("edgefab.clearOpenAIKey", () => clearKey("openai")),

    vscode.commands.registerCommand("edgefab.setTripoKey", async () => {
      if (await setKey("tripo")) void vscode.window.showInformationMessage("EDGEfab: the Tripo key is set, in VS Code's secret storage.");
    }),
    vscode.commands.registerCommand("edgefab.clearTripoKey", () => clearKey("tripo")),
    vscode.commands.registerCommand("edgefab.tripoPlan", askTripoPlan),
    vscode.commands.registerCommand("edgefab.connectAssistant", () => connectAssistant(context, log)),
    vscode.commands.registerCommand("edgefab.showLog", () => output.show()),
    vscode.commands.registerCommand("edgefab.refresh", () => view.refresh()),
    vscode.commands.registerCommand("edgefab.reveal", (item: unknown) => {
      const entry = entryOf(item);
      if (entry) void vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(entry.folder));
    }),
    vscode.commands.registerCommand("edgefab.view", (item: unknown) => {
      const entry = entryOf(item);
      if (entry) void openIn3D(entry.model, entry.preview);
    }),
    vscode.commands.registerCommand("edgefab.addToProject", async (item: unknown) => {
      const entry = entryOf(item);
      if (entry) await addItemToProject(entry.folder, entry.title);
    }),
    vscode.commands.registerCommand("edgefab.paintGlow", async (item: unknown) => {
      const entry = entryOf(item);
      if (!entry) return;
      const amount = await vscode.window.showQuickPick(
        [
          { label: "A few lights", detail: "Only the brightest, most colorful painted spots", amount: 0.25 },
          { label: "The lights", description: "(usual)", detail: "What is both bright and strongly colored", amount: 0.5 },
          { label: "Many lights", detail: "Dimmer and paler painted areas too; may catch colored paint that isn't a light", amount: 0.75 },
        ],
        { title: `EDGEfab: which painted areas of ${entry.title} should glow?`, placeHolder: "Tripo's lights are only painted on. Look at it in 3D after, and try again if it caught too much", ignoreFocusOut: true },
      );
      if (!amount) return;
      const strength = await askStrength("EDGEfab: how strongly should they glow?", DefaultGlowStrength);
      if (strength === undefined) return;
      await changeGlow(view, entry, () => paintedLightsGlow(entry.folder, { amount: amount.amount, strength, version }), (r) => {
        const share = r.lit?.map((l) => `${Math.round(l.share * 100)}%`).join(", ");
        return `${entry.title}'s painted lights glow, ${glowWords(strength)}: ${share} of its texture.`;
      });
    }),
    vscode.commands.registerCommand("edgefab.glowStrength", async (item: unknown) => {
      const entry = entryOf(item);
      const glow = entry?.prepared?.glow;
      if (!entry || !glow?.length) return;
      let material: string | undefined;
      if (glow.length > 1) {
        const picked = await vscode.window.showQuickPick(
          [{ label: "All of them", material: undefined as string | undefined }, ...glow.map((g) => ({ label: g.material, description: `${glowWords(g.strength)}, strength ${g.strength}`, material: g.material as string | undefined }))],
          { title: `EDGEfab: which part of ${entry.title}?`, ignoreFocusOut: true },
        );
        if (!picked) return;
        material = picked.material;
      }
      const strength = await askStrength(`EDGEfab: how strongly should ${material ?? entry.title} glow?`, (glow.find((g) => g.material === material) ?? glow[0]).strength);
      if (strength === undefined) return;
      await changeGlow(view, entry, () => setGlowStrength(entry.folder, strength, { material, version }), () => `${material ?? entry.title} glows ${glowWords(strength)} now (strength ${strength}).`);
    }),
    vscode.commands.registerCommand("edgefab.glowOff", async (item: unknown) => {
      const entry = entryOf(item);
      if (entry) await changeGlow(view, entry, () => glowOff(entry.folder, { version }), () => `${entry.title} doesn't glow now.`);
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
