// A second Add to Project keeps what didn't change (docs/testing.md, "Add to Project again"; EDGEfab #6 and the
// kept parts of EDGEmat #12). A copy of a Desk prop goes into a scratch project several times, with REDbridge
// (needs the game). Nothing touches the modder's Desk or projects.
// Usage (after npm run build): node scripts/keep-check.mjs <a Desk prop's folder, in parts>
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const source = process.argv[2];
if (!source || !fs.existsSync(path.join(source, "asset.json"))) {
  console.error("Usage: node scripts/keep-check.mjs <a Desk prop's folder>");
  process.exit(2);
}
const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-keep-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");
const { PNG } = require("pngjs");

let failed = 0;
const check = (what, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failed++;
};
const stamp = (file) => `${fs.statSync(file).mtimeMs}:${crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex")}`;
const seconds = (t) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const sums = (dir) => walk(dir).map((f) => `${path.relative(dir, f)} ${crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex")}`).sort().join("|");
const original = sums(source);

const bridge = await core.startBridge();
try {
  const desk = core.deskDir();
  fs.mkdirSync(desk, { recursive: true });
  const item = path.join(desk, path.basename(source));
  fs.cpSync(source, item, { recursive: true });
  const proj = path.join(data, "proj");
  fs.mkdirSync(path.join(proj, "source", "archive"), { recursive: true });
  fs.mkdirSync(path.join(proj, "source", "raw"), { recursive: true });
  const project = core.projectFolders(proj);
  const archive = (game) => path.join(project.archive, ...game.split("\\"));
  const add = async (opts = {}) => {
    const t = Date.now();
    const r = await core.addToProject({ item, project, call: bridge.call, ...opts });
    return { r, took: seconds(t) };
  };
  const looks = async (mesh) => core.entryLooks(JSON.parse((await bridge.call("cr2w.fileToJson", { file: archive(mesh) })).json));
  const stamps = (r) => Object.fromEntries(r.materials.map((m) => [m.name, [m.mi, ...m.textures].map((f) => stamp(archive(f))).join("|")]));

  // 1. The first add makes everything.
  let { r, took } = await add();
  const all = r.materials.map((m) => m.name);
  console.log(`first add: ${all.length} materials, ${took}`);
  check("a first add keeps nothing", r.kept.length === 0 && r.swapped.length === 0);
  const record = () => JSON.parse(fs.readFileSync(r.record, "utf8"));
  check("the record says what each material was made from", record().materials.every((m) => m.source?.images && Object.values(m.source.images).every((i) => i.bytes && i.pixels) && m.textures?.length));
  const first = stamps(r);

  // 2. Again, nothing changed: everything kept, no file written again, every entry on its own .mi.
  ({ r, took } = await add());
  console.log(`second add, nothing changed: ${took}`);
  check(`every material is kept (${r.kept.length} of ${all.length})`, r.kept.length === all.length, r.notes.join(" | "));
  check("no material file was written again", JSON.stringify(stamps(r)) === JSON.stringify(first));
  let now = await looks(r.mesh);
  check("each mesh entry wears its own .mi", r.materials.every((m) => now.get(m.name)?.base?.toLowerCase() === m.mi.toLowerCase() && !now.get(m.name).instance.values.length));
  check("the record still lists every file", record().files.length >= all.length * 2 && record().files.every((f) => fs.existsSync(path.join(proj, f))));

  // 3. Only the shape changes (Set Size): still everything kept.
  await core.setSize(item, 1.5, { version: "keep-check" });
  ({ r, took } = await add());
  console.log(`third add, after Set Size: ${took}`);
  check("a new size keeps every material", r.kept.length === all.length, r.notes.join(" | "));

  // 4. One picture written out again with the same pixels: kept. Then with other pixels: that one made again.
  const prepared = core.readItem(item).prepared;
  const part = all[1];
  const colour = prepared.textures.find((t) => t.material === part && t.slot === "baseColor").file;
  if (/\.png$/i.test(colour)) {
    const img = PNG.sync.read(fs.readFileSync(colour));
    fs.writeFileSync(colour, PNG.sync.write(img, { deflateLevel: 1 }));
    ({ r, took } = await add());
    console.log(`fourth add, ${part}'s color written out again: ${took}`);
    check("the same pixels in other bytes are kept", r.kept.length === all.length, r.notes.join(" | "));
    for (let i = 0; i < 4000; i += 4) img.data[i] = 255 - img.data[i];
    fs.writeFileSync(colour, PNG.sync.write(img));
    // The model to look at carries its own copy of the picture: EDGEmat reads that one, so it changes too.
  } else console.log(`(${part}'s color is not a PNG: the pixel checks are skipped)`);

  // 5. One part's glow changes: only that material is made again.
  const before5 = stamps(r);
  const glowing = prepared.glow[0]?.material ?? part;
  if (prepared.glow.length) await core.setGlowStrength(item, prepared.glow[0].strength === 8 ? 3 : 8, { material: glowing, version: "keep-check" });
  else await core.paintedLightsGlow(item, { amount: 0.5, strength: 3, version: "keep-check" });
  ({ r, took } = await add());
  console.log(`fifth add, a glow changed: ${took}`);
  const remade = all.filter((m) => !r.kept.includes(r.materials.find((x) => x.name === m).mi));
  check(`only what changed is made again (${remade.join(", ") || "nothing"})`, remade.length >= 1 && remade.length < all.length && remade.includes(glowing), r.notes.join(" | "));
  const after5 = stamps(r);
  check("the kept materials' files are untouched", all.filter((m) => !remade.includes(m)).every((m) => after5[m] === before5[m]));
  now = await looks(r.mesh);
  check("each mesh entry still wears its own .mi", r.materials.every((m) => now.get(m.name)?.base?.toLowerCase() === m.mi.toLowerCase()));

  // 6. A part given another material (as EDGEmat's applyMaterial does): it keeps it over an add.
  const swap = all[0], other = "base\\environment\\decoration\\test\\another_look.mi";
  const file = archive(r.mesh);
  const json = JSON.parse((await bridge.call("cr2w.fileToJson", { file })).json);
  const root = json.Data.RootChunk;
  const entry = root.materialEntries.find((e) => e.name.$value === swap);
  root.localMaterialBuffer.materials[entry.index].baseMaterial.DepotPath.$value = other;
  await bridge.call("cr2w.fromJson", { outFile: file, json: JSON.stringify(json) });
  ({ r, took } = await add());
  console.log(`sixth add, ${swap} given another material: ${took}`);
  now = await looks(r.mesh);
  check(`${swap} keeps the material it was given`, r.swapped.length === 1 && r.swapped[0].material === swap && now.get(swap)?.base === other, JSON.stringify(r.swapped));
  check("the other parts wear their own", r.materials.filter((m) => m.name !== swap).every((m) => now.get(m.name)?.base?.toLowerCase() === m.mi.toLowerCase()));
  check("its own material is still in the project, to go back to", fs.existsSync(archive(r.materials.find((m) => m.name === swap).mi)));
  check("the record names the part", record().swapped?.[0]?.material === swap);
  ({ r } = await add());
  now = await looks(r.mesh);
  check("and keeps it over another add", r.swapped.length === 1 && now.get(swap)?.base === other);

  // 7. Start over: every part back on the model's textures, every texture made again.
  const before7 = stamps(r);
  ({ r, took } = await add({ parts: "model", textures: "remake" }));
  console.log(`eighth add, parts "model" and textures "remake": ${took}`);
  now = await looks(r.mesh);
  check("parts \"model\" puts the part back on its own material", r.swapped.length === 0 && now.get(swap)?.base?.toLowerCase() === r.materials.find((m) => m.name === swap).mi.toLowerCase());
  const after7 = stamps(r);
  check("textures \"remake\" makes every material again", r.kept.length === 0 && all.every((m) => after7[m] !== before7[m]));
  check("the item it was copied from is unchanged", sums(source) === original);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  bridge.client.stop();
  fs.rmSync(data, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
