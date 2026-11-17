// The Pictures tab (owner, 2026-11-17): one Desk item's four-view pictures, the one viewed large, and every take
// beside it with the words that made it and when. A take is changed by words (GPT Image's edit: that picture
// sent with the words, the rest kept), or drawn new from words alone; Make 3D takes the picture viewed.
// It redraws when picture.json or asset.json changes, so a take an assistant makes (MCP fab_picture) shows too.

import * as vscode from "vscode";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { drawPicture, isInside, readPictures, type PictureTake } from "./core";

declare const __VERSION__: string;

export interface PictureTabHooks {
  /** The OpenAI key, asked for when missing. */
  openaiKey(): Promise<string | undefined>;
  /** Make 3D from a take: asks the detail, height and cost, then makes it. */
  make3d(folder: string, title: string, take: number): Promise<void>;
  /** Something on the Desk changed. */
  changed(): void;
  log(line: string): void;
  /** The tab's icon (EDGEfab's). */
  icon?: vscode.Uri;
}

/** What the page shows. */
interface PageTake {
  take: number;
  words: string;
  from?: number;
  date: string;
  seconds: number;
  sheet: string;
  front: string;
}

interface PageState {
  title: string;
  takes: PageTake[];
  /** The take the Desk's 3D model was made from, if any. */
  made?: number;
  busy?: string;
  error?: string;
  select?: number;
  focusPrompt?: boolean;
}

type FromPage =
  | { type: "ready" }
  | { type: "change"; take: number; words: string }
  | { type: "draw"; words: string }
  | { type: "make3d"; take: number }
  | { type: "cancel" };

const tabs = new Map<string, PictureTab>();
const keyOf = (folder: string) => path.resolve(folder).toLowerCase();

/** Opens (or shows) the Pictures tab of a Desk item. */
export function openPictures(folder: string, hooks: PictureTabHooks, opts: { select?: number; focusPrompt?: boolean } = {}): void {
  const open = tabs.get(keyOf(folder));
  if (open) {
    open.show(opts);
    return;
  }
  tabs.set(keyOf(folder), new PictureTab(folder, hooks, opts));
}

/** Closes the Pictures tabs of items inside `folder`, before it moves or goes (their watches would hold it). Answers whether any were open. */
export function closePicturesUnder(folder: string): boolean {
  let any = false;
  for (const tab of [...tabs.values()]) {
    if (isInside(tab.folder, folder) || keyOf(tab.folder) === keyOf(folder)) {
      tab.dispose();
      any = true;
    }
  }
  return any;
}

const itemName = (folder: string) => path.basename(folder).replace(/\.prop\.asset$/, "");

class PictureTab {
  private readonly panel: vscode.WebviewPanel;
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly raw: string;
  private busy?: { what: string; abort: AbortController };
  private error?: string;
  private disposed = false;

  constructor(readonly folder: string, private readonly hooks: PictureTabHooks, opts: { select?: number; focusPrompt?: boolean }) {
    this.raw = path.join(folder, "source", "raw", itemName(folder));
    this.panel = vscode.window.createWebviewPanel("edgefab.pictures", `Pictures: ${this.title()}`, vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(folder)],
    });
    if (hooks.icon) this.panel.iconPath = hooks.icon;
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((m: FromPage) => void this.onMessage(m));
    this.panel.onDidDispose(() => this.dispose());
    this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(folder), "**/{picture.json,asset.json}"));
    const redraw = () => this.post();
    this.watcher.onDidChange(redraw);
    this.watcher.onDidCreate(redraw);
    this.watcher.onDidDelete(redraw);
    this.pending = opts;
  }

  /** Asked of the page before it said it's ready. */
  private pending: { select?: number; focusPrompt?: boolean } = {};

  show(opts: { select?: number; focusPrompt?: boolean }): void {
    this.panel.reveal();
    this.post(opts);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.busy?.abort.abort();
    this.watcher.dispose();
    tabs.delete(keyOf(this.folder));
    this.panel.dispose();
  }

  private title(): string {
    try {
      return JSON.parse(fs.readFileSync(path.join(this.folder, "asset.json"), "utf8")).name ?? itemName(this.folder);
    } catch {
      return itemName(this.folder);
    }
  }

  private madeFrom(): number | undefined {
    try {
      const from = JSON.parse(fs.readFileSync(path.join(this.folder, "asset.json"), "utf8")).from;
      return from?.tripo?.picture?.take;
    } catch {
      return undefined;
    }
  }

  private state(): PageState {
    const uri = (f: string) => this.panel.webview.asWebviewUri(vscode.Uri.file(f)).toString();
    const takes = (readPictures(this.raw)?.takes ?? []).map((t: PictureTake) => ({
      take: t.take, words: t.words, from: t.from, date: t.date, seconds: t.seconds,
      sheet: uri(t.sheet), front: uri(fs.existsSync(t.views.front) ? t.views.front : t.sheet),
    }));
    return { title: this.title(), takes, made: this.madeFrom(), busy: this.busy?.what, error: this.error };
  }

  private post(extra: { select?: number; focusPrompt?: boolean } = {}): void {
    if (this.disposed) return;
    this.panel.title = `Pictures: ${this.title()}`;
    void this.panel.webview.postMessage({ type: "state", state: { ...this.state(), ...extra } });
  }

  private async onMessage(m: FromPage): Promise<void> {
    if (m.type === "ready") {
      this.post(this.pending);
      this.pending = {};
      return;
    }
    if (m.type === "cancel") {
      this.busy?.abort.abort();
      return;
    }
    if (m.type === "make3d") {
      await this.hooks.make3d(this.folder, this.title(), m.take);
      this.post({ select: m.take });
      return;
    }
    if (this.busy) return;
    const words = m.words.trim();
    if (!words) return;
    const key = await this.hooks.openaiKey();
    if (!key) return;
    const abort = new AbortController();
    this.busy = { what: m.type === "change" ? `Changing picture ${m.take}...` : "Drawing a new picture from your words...", abort };
    this.error = undefined;
    this.post();
    try {
      const drawn = await drawPicture(words, { version: __VERSION__, item: this.folder, from: m.type === "change" ? m.take : undefined, call: { signal: abort.signal, key } });
      this.hooks.log(`${drawn.take.from !== undefined ? `Changed picture ${drawn.take.from} of ${drawn.name} into picture ${drawn.take.take}` : `Drew ${drawn.name}, picture ${drawn.take.take}`} in ${drawn.take.seconds} s: ${drawn.take.sheet}`);
      this.busy = undefined;
      this.hooks.changed();
      this.post({ select: drawn.take.take });
    } catch (e) {
      const why = abort.signal.aborted ? "Cancelled." : e instanceof Error ? e.message : String(e);
      this.hooks.log(`Picture: ${why}`);
      this.busy = undefined;
      this.error = abort.signal.aborted ? undefined : why;
      this.post();
    }
  }

  private html(): string {
    const nonce = crypto.randomBytes(16).toString("base64");
    const csp = `default-src 'none'; img-src ${this.panel.webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style nonce="${nonce}">
  :root { --gap: 14px; --accent: var(--vscode-focusBorder); --muted: var(--vscode-descriptionForeground); --line: var(--vscode-panel-border, rgba(128,128,128,.35)); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px 22px 28px; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: var(--vscode-font-size) / 1.45 var(--vscode-font-family); }
  .wrap { max-width: calc(60vh + 322px); }
  @media (max-width: 860px) { .wrap { max-width: none; } }
  header { display: flex; align-items: center; gap: var(--gap); flex-wrap: wrap; margin-bottom: var(--gap); }
  h1 { font-size: 1.25em; font-weight: 600; margin: 0; letter-spacing: .02em; }
  h1 small { color: var(--muted); font-weight: 400; margin-left: 6px; }
  .spacer { flex: 1; }
  button { font: inherit; border: 1px solid transparent; padding: 6px 14px; cursor: pointer; border-radius: 2px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
  button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button.secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
  button:disabled { opacity: .5; cursor: default; }
  button:focus-visible, textarea:focus-visible, .card:focus-visible { outline: 1px solid var(--accent); outline-offset: 2px; }
  .layout { display: grid; grid-template-columns: minmax(0, 60vh) 300px; justify-content: start; gap: 22px; align-items: start; }
  @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
  .viewer { min-width: 0; }
  .sheet { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; background: #fff; border: 1px solid var(--line); }
  .meta { margin: 10px 0 4px; display: flex; gap: 8px 14px; flex-wrap: wrap; align-items: baseline; color: var(--muted); }
  .meta b { color: var(--vscode-foreground); font-weight: 600; }
  .badge { font-size: .85em; padding: 1px 7px; border: 1px solid var(--accent); color: var(--vscode-foreground); border-radius: 2px; }
  .words { margin: 0 0 16px; white-space: pre-wrap; }
  .words q { quotes: "\\201C" "\\201D"; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  textarea { width: 100%; min-height: 74px; resize: vertical; padding: 8px; font: inherit; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--line)); border-radius: 2px; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  .hint { color: var(--muted); font-size: .92em; margin-top: 6px; }
  .status { display: flex; align-items: center; gap: 10px; margin-top: 12px; min-height: 1.6em; }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
  aside h2 { font-size: 1em; font-weight: 600; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .history { display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 110px); overflow-y: auto; padding-right: 4px; }
  .card { display: grid; grid-template-columns: 84px 1fr; gap: 10px; padding: 8px; cursor: pointer; border: 1px solid var(--line); background: var(--vscode-sideBar-background, transparent); border-radius: 2px; text-align: left; color: inherit; font: inherit; }
  button.card:hover:not(:disabled) { border-color: var(--muted); background: var(--vscode-list-hoverBackground, var(--vscode-sideBar-background, transparent)); }
  .card[aria-current="true"] { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); }
  .card img { width: 84px; height: 84px; object-fit: contain; background: #fff; }
  .card .t { font-weight: 600; }
  .card .d { color: var(--muted); font-size: .88em; }
  .card .w { font-size: .92em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-top: 2px; }
  .empty { color: var(--muted); }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1 id="title">Pictures</h1>
  <span class="spacer"></span>
  <button id="make3d" title="Tripo makes the 3D model from this picture's four views. You pick the detail and see the cost before anything is paid.">Generate 3D Model</button>
</header>
<div class="layout">
  <main class="viewer">
    <img id="sheet" class="sheet" alt="">
    <div class="meta" id="meta"></div>
    <p class="words" id="words"></p>
    <label for="prompt">Change this picture</label>
    <textarea id="prompt" placeholder="What to change, such as: make the cabinet red and the glow blue"></textarea>
    <div class="actions">
      <button id="change" title="Sends this picture to GPT Image with your words: it changes what they say and keeps the rest. (Ctrl+Enter)">Change This Picture</button>
      <button id="draw" class="secondary" title="Draws a new picture from these words alone, as a full description of the object, not from this picture.">Draw New from Words</button>
    </div>
    <div class="hint">Each new picture costs a few cents of your OpenAI credit and takes about 30 seconds to a minute. Every picture is kept here.</div>
    <div class="status" id="status" role="status" aria-live="polite"></div>
  </main>
  <aside>
    <h2>History</h2>
    <div class="history" id="history" role="list"></div>
  </aside>
</div>
</div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  let state = { takes: [] };
  let viewed;
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function render() {
    const takes = state.takes;
    $("title").textContent = "";
    $("title").append("Pictures", el("small", "", state.title || ""));
    if (!takes.find((t) => t.take === viewed)) viewed = takes.length ? takes[takes.length - 1].take : undefined;
    const t = takes.find((x) => x.take === viewed);
    const busy = !!state.busy;
    $("sheet").hidden = !t;
    if (t) {
      if ($("sheet").getAttribute("src") !== t.sheet) $("sheet").src = t.sheet;
      $("sheet").alt = "Picture " + t.take + ": the object from the front, left, back and right";
    }
    const meta = $("meta");
    meta.textContent = "";
    if (t) {
      meta.append(el("b", "", "Picture " + t.take));
      if (t.from !== undefined) meta.append(el("span", "", "changed from picture " + t.from));
      meta.append(el("span", "", when(t.date)));
      if (state.made === t.take) meta.append(el("span", "badge", "The 3D model on the Desk is made from this"));
    } else meta.append(el("span", "empty", "No pictures yet."));
    $("words").textContent = "";
    if (t) $("words").append(el("q", "", t.words));
    $("change").disabled = busy || !t;
    $("draw").disabled = busy;
    $("make3d").disabled = busy || !t;
    $("prompt").disabled = busy;
    const status = $("status");
    status.textContent = "";
    if (busy) {
      const stop = el("button", "secondary", "Cancel");
      stop.onclick = () => vscode.postMessage({ type: "cancel" });
      status.append(el("span", "spinner"), el("span", "", state.busy), stop);
    } else if (state.error) status.append(el("span", "error", state.error));

    const list = $("history");
    list.textContent = "";
    if (!takes.length) list.append(el("div", "empty", "Pictures you make show here."));
    for (const x of [...takes].reverse()) {
      const card = el("button", "card");
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-current", String(x.take === viewed));
      const img = el("img");
      img.src = x.front;
      img.alt = "";
      const text = el("div");
      text.append(el("div", "t", "Picture " + x.take + (state.made === x.take ? "  \\u00b7 3D" : "")), el("div", "d", when(x.date) + (x.from !== undefined ? " \\u00b7 from " + x.from : "")), el("div", "w", x.words));
      card.title = x.words;
      card.append(img, text);
      card.onclick = () => { viewed = x.take; render(); };
      list.append(card);
    }
  }

  const submit = (type) => {
    const words = $("prompt").value.trim();
    if (!words) { $("prompt").focus(); return; }
    vscode.postMessage(type === "change" ? { type, take: viewed, words } : { type, words });
  };
  $("change").onclick = () => submit("change");
  $("draw").onclick = () => submit("draw");
  $("make3d").onclick = () => viewed !== undefined && vscode.postMessage({ type: "make3d", take: viewed });
  $("prompt").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!$("change").disabled) submit("change"); } });

  window.addEventListener("message", (e) => {
    const m = e.data;
    if (m.type !== "state") return;
    const wasBusy = !!state.busy;
    state = m.state;
    if (m.state.select !== undefined) viewed = m.state.select;
    // A new picture arrived from these words: clear them for the next change.
    if (wasBusy && !state.busy && !state.error && m.state.select !== undefined) $("prompt").value = "";
    render();
    if (m.state.focusPrompt) $("prompt").focus();
  });
  vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}
