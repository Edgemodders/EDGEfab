// A small driver for the scratch VS Code window over its debugging port (Chrome DevTools Protocol).
const fs = require("node:fs");
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(match = (t) => t.type === "page" && !/^devtools/.test(t.url)) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const target = targets.find(match);
  if (!target) throw new Error("no window: " + targets.map((t) => `${t.type} ${t.title}`).join("; "));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { const { res, rej } = waiting.get(d.id); waiting.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  const evalJS = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const KEYS = { Enter: 13, Escape: 27, F1: 112, ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37, Tab: 9, Backspace: 8, Delete: 46, Home: 36, End: 35, " ": 32 };
  const press = async (key, mods = 0) => {
    const code = KEYS[key] ?? key.toUpperCase().charCodeAt(0);
    const base = { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers: mods };
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
    await send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
    await sleep(150);
  };
  const type = async (text) => { await send("Input.insertText", { text }); await sleep(250); };
  const mouse = async (x, y, button = "left") => {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1 });
    await sleep(300);
  };
  const hover = async (x, y) => { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); await sleep(300); };
  /** The centre of the first element matching a CSS selector whose text contains `text`. */
  const find = (selector, text) => evalJS(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => ${text === undefined ? "true" : `(x.getAttribute("aria-label") ?? x.textContent ?? "").includes(${JSON.stringify(text)})`}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, left: r.x, top: r.y, w: r.width, h: r.height }; })()`);
  const clickOn = async (selector, text, button) => { const p = await find(selector, text); if (!p) throw new Error(`not found: ${selector} ${text ?? ""}`); await mouse(p.x, p.y, button); return p; };
  const shot = async (file, clip) => {
    const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
    return file;
  };
  const palette = async (command) => { await press("F1"); await sleep(400); await type(command); await sleep(500); await press("Enter"); await sleep(900); };
  return { send, evalJS, press, type, mouse, hover, find, clickOn, shot, palette, sleep, close: () => ws.close(), target };
}
module.exports = { connect, sleep, PORT };
