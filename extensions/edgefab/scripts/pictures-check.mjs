// The Pictures tab's core, offline (docs/testing.md, "the Pictures tab"): a stand-in answers for OpenAI and Tripo,
// so no key or credit is used. Draws, changes any picture, draws new, refuses mistakes, and Make 3D from an older
// picture, in a scratch Desk (never the modder's).
// Usage (after npm run build): node scripts/pictures-check.mjs
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as zlib from "node:zlib";

const require = createRequire(import.meta.url);
const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-pictures-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");

// A 64x64 PNG, its four quarters in four colours, so the cut into views can be checked.
function png(colours) {
  const w = 64, h = 64;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    for (let x = 0; x < w; x++) {
      const c = colours[(y < 32 ? 0 : 2) + (x < 32 ? 0 : 1)];
      row.set([...c, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type), body]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb)); return Buffer.concat([len, tb, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

const calls = [];
const fakeFetch = async (url, init) => {
  const call = { url, form: init.body instanceof FormData, headers: init.headers };
  if (call.form) {
    call.fields = Object.fromEntries([...init.body.entries()].filter(([, v]) => typeof v === "string"));
    const image = init.body.get("image[]");
    call.image = image ? Buffer.from(await image.arrayBuffer()) : undefined;
  } else call.json = JSON.parse(init.body);
  calls.push(call);
  const n = calls.length;
  const colours = [[n * 40, 0, 0], [0, n * 40, 0], [0, 0, n * 40], [n * 40, n * 40, 0]];
  return new Response(JSON.stringify({ data: [{ b64_json: png(colours).toString("base64") }], usage: { output_tokens: 100 + n } }), { status: 200 });
};
const call = { key: "test-key", fetch: fakeFetch };

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

// 1. A first picture, from words: the generations endpoint, JSON.
const first = await core.drawPicture("a battered cyberpunk vending machine", { version: "test", call });
check(calls[0].url.endsWith("/v1/images/generations") && !calls[0].form, "a first picture asks for a new image (generations, JSON)");
check(first.take.take === 1 && first.take.from === undefined && first.take.what === undefined, "picture 1 has no from and no what");

// 2. A change of picture 1: the edits endpoint, multipart, picture 1's sheet sent.
const changed = await core.drawPicture("make the cabinet red and the glow blue", { version: "test", item: first.folder, from: 1, call });
const c2 = calls[1];
check(c2.url.endsWith("/v1/images/edits") && c2.form, "a change asks for an edit (edits, multipart)");
check(c2.image?.equals(fs.readFileSync(first.take.sheet)), "the edit sends picture 1's sheet as image[]");
check(/Change it: make the cabinet red and the glow blue\./.test(c2.fields.prompt) && /one a battered cyberpunk vending machine from four sides/.test(c2.fields.prompt), "the edit's prompt names the object and the change");
check(c2.fields.size === "2048x2048" && c2.fields.quality === "high" && c2.fields.model === core.PictureModel, "the edit asks 2048², high quality, the same model");
check(!("Content-Type" in c2.headers), "the edit leaves the content type to the form (its boundary)");
check(changed.take.take === 2 && changed.take.from === 1 && changed.take.what === "a battered cyberpunk vending machine" && changed.take.words === "make the cabinet red and the glow blue", "picture 2 records from 1, the object, and the user's words");
check(fs.existsSync(changed.take.views.front) && fs.existsSync(changed.take.sheet), "picture 2's sheet and views are written");

// 3. A change of a change carries the object through; a change of an older picture sends that one.
const again = await core.drawPicture("add a dented side panel", { version: "test", item: first.folder, from: 2, call });
check(again.take.what === "a battered cyberpunk vending machine" && again.take.from === 2, "picture 3, changed from 2, keeps the object's words");
const older = await core.drawPicture("make it green", { version: "test", item: first.folder, from: 1, call });
check(calls[3].image?.equals(fs.readFileSync(first.take.sheet)) && older.take.take === 4 && older.take.from === 1, "picture 4 changes picture 1 (an older one), and sends picture 1");

// 4. Drawing afresh into the same item, no from: generations again, and the words are the object.
const fresh = await core.drawPicture("a neon noodle stand sign", { version: "test", item: first.folder, call });
check(calls[4].url.endsWith("/v1/images/generations") && fresh.take.take === 5 && fresh.take.from === undefined, "Draw New in the same item asks for a new image, picture 5");

// 5. The record: every take, in order, with its date; asset.json's history says each.
const raw = path.join(first.folder, "source", "raw", first.name);
const record = core.readPictures(raw);
check(record.takes.map((t) => t.take).join() === "1,2,3,4,5" && record.takes.every((t) => !isNaN(Date.parse(t.date))), "picture.json keeps all five, each with its date");
const asset = JSON.parse(fs.readFileSync(path.join(first.folder, "asset.json"), "utf8"));
check(asset.history.some((h) => h.did === 'Changed picture 1 into picture 2: "make the cabinet red and the glow blue"'), "asset.json's history says picture 2 was changed from 1");

// 6. Errors in plain words, and nothing paid for a mistake.
const before = calls.length;
for (const [args, want] of [
  [["make it blue", { version: "test", item: first.folder, from: 9, call }], /no picture 9/],
  [["make it blue", { version: "test", from: 1, call }], /needs the Desk item/],
  [["  ", { version: "test", item: first.folder, from: 1, call }], /Say what to change/],
]) {
  try {
    await core.drawPicture(...args);
    check(false, `refused: ${want}`);
  } catch (e) {
    check(want.test(e.message), `refused in plain words: ${e.message}`);
  }
}
check(calls.length === before, "a refused change calls OpenAI for nothing");

// 7. Make 3D from a picture other than the last: it asks Tripo with that picture's views (stopped before paying).
const tripoCalls = [];
const tripoFetch = async (url, init) => {
  url = String(url);
  tripoCalls.push({ url, body: init?.body });
  if (url.includes("/files/presign")) return new Response(JSON.stringify({ code: 0, data: { presigned_url: `https://upload.test/${tripoCalls.length}`, file_token: `t${tripoCalls.length}` } }), { status: 200 });
  if (url.startsWith("https://upload.test/")) return new Response("", { status: 200 });
  return new Response(JSON.stringify({ code: 2010, message: "stop here (test)" }), { status: 400 });
};
fs.writeFileSync(path.join(data, "settings.json"), JSON.stringify({ tripoPlan: "paid" }));
try {
  await core.makeModel({ from: "picture", item: first.folder, take: 2, request: { parts: true }, plan: "paid" }, { version: "test", call: { key: "test", fetch: tripoFetch } });
} catch (e) {
  console.log(`     (Tripo stand-in stopped it: ${e.message.slice(0, 80)})`);
}
const uploads = tripoCalls.filter((c) => c.url.startsWith("https://upload.test/")).map((c) => Buffer.from(c.body));
const two = core.readPictures(raw).takes[1].views;
check(uploads.length === 4 && ["front", "left", "back", "right"].every((v, i) => uploads[i].equals(fs.readFileSync(two[v]))), "Make 3D from picture 2 sends picture 2's four views, in Tripo's order");
const task = tripoCalls.find((c) => c.url.includes("/multiview-to-model"));
check(!!task, "then asks Tripo's multiview model (stopped there by the stand-in)");
try {
  await core.makeModel({ from: "picture", item: first.folder, take: 9, plan: "paid" }, { version: "test", call: { key: "test", fetch: tripoFetch } });
  check(false, "Make 3D from a missing picture is refused");
} catch (e) {
  check(/has no picture 9/.test(e.message), `Make 3D from a missing picture is refused: ${e.message}`);
}
check(fs.existsSync(path.join(first.folder, "asset.json")) && core.readPictures(raw).takes.length === 5, "a failed Make 3D keeps the item and its five pictures");

// 8. Renaming the item keeps the pictures and their links (readPictures finds them in the item).
const renamed = await core.renameItem(first.folder, "Red vending machine", { version: "test" });
const after = core.readPictures(path.join(renamed.folder, "source", "raw", path.basename(renamed.folder).replace(/\.prop\.asset$/, "")));
check(after?.takes.length === 5 && after.takes.every((t) => fs.existsSync(t.sheet) && fs.existsSync(t.views.front)) && after.takes[1].from === 1, "after Rename, all five pictures and their froms are there");

console.log(failed ? `${failed} FAILED` : "all passed");
fs.rmSync(data, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
