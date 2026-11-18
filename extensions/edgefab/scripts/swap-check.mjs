// A part given another material by EDGEmat's own tools keeps it over Add to Project (docs/testing.md,
// "Add to Project again, with EDGEmat's parts"; EDGEmat #12). A copy of a Desk prop goes into a scratch
// project; EDGEmat's core (from its checkout, built) puts a game surface on one part and a game material
// on another, as its buttons and mat_apply do; EDGEfab adds the prop again. Needs the game, for REDbridge.
// Nothing touches the modder's Desk or projects.
// Usage (after npm run build, here and in EDGEmat): node scripts/swap-check.mjs <a Desk prop's folder, in parts> <EDGEmat's checkout>
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const [source, edgemat] = process.argv.slice(2);
const matCore = edgemat && path.join(edgemat, "extensions", "edgemat", "dist", "core.js");
if (!source || !fs.existsSync(path.join(source, "asset.json")) || !matCore || !fs.existsSync(matCore)) {
  console.error("Usage: node scripts/swap-check.mjs <a Desk prop's folder> <EDGEmat's checkout, built>");
  process.exit(2);
}
const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-swap-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");
const mat = require(matCore);
if (typeof mat.useSurface !== "function" || typeof mat.backToModel !== "function") {
  console.error("EDGEmat's core has no useSurface: build EDGEmat's main (c2f2ae7 or later).");
  process.exit(2);
}

let failed = 0;
const check = (what, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failed++;
};
const seconds = (t) => `${((Date.now() - t) / 1000).toFixed(1)} s`;
const low = (s) => String(s ?? "").toLowerCase();

// EDGEmat's own bridge and library, as its parts check starts them.
const settings = mat.vscodeUserSettings();
const game = await mat.resolveGame(settings, {}, true);
const choice = mat.resolveBridge(settings);
const lib = mat.loadLibrary(mat.defaultCacheDir());
if (!game || !choice || !lib) {
  console.error(`EDGEmat can't start: ${!game ? "no game folder" : !choice ? "no REDbridge" : "no Game Materials library (open EDGEmat once)"}`);
  process.exit(2);
}
const matBridge = new mat.BridgeClient({ exe: choice.exe, gamePath: game.path, dotnetRoot: choice.dotnetRoot });
matBridge.start();
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
  const archive = project.archive;
  const disk = (gamePath) => path.join(archive, ...gamePath.split("\\"));
  const add = async (opts = {}) => {
    const t = Date.now();
    const r = await core.addToProject({ item, project, call: bridge.call, ...opts });
    return { r, took: seconds(t) };
  };
  const looks = async (mesh) => core.entryLooks(JSON.parse((await bridge.call("cr2w.fileToJson", { file: disk(mesh) })).json));
  const wears = async (mesh) => Object.fromEntries((await mat.partsOf(matBridge, lib, archive, mesh)).parts.map((p) => [p.name, p.wears.kind]));

  // 1. The first add.
  let { r, took } = await add();
  const all = r.materials.map((m) => m.name);
  const own = (name) => r.materials.find((m) => m.name === name).mi;
  console.log(`first add: ${all.length} parts, ${took}`);
  check("the prop is in parts", all.length >= 3, `${all.length} parts`);
  const prepared = core.readItem(item).prepared;
  // The surface goes on a part that glows, if any: its own material is made again later, under the swap.
  const sPart = prepared.glow[0]?.material ?? all[0];
  const gPart = all.find((m) => m !== sPart);
  const others = all.filter((m) => m !== sPart && m !== gPart);
  const first = await wears(r.mesh);
  check("EDGEmat finds EDGEfab's record and sees every part on the model's texture", all.every((m) => first[m] === "model"), JSON.stringify(first));

  // 2. EDGEmat: a game surface on one part, a game material on another.
  const s = await mat.useSurface(matBridge, lib, archive, r.mesh, sPart, { surface: "car paint metallic", color: "red" });
  console.log(`EDGEmat: ${sPart} wears ${s.surface?.title} in ${s.color}: ${s.mi}`);
  const list = await mat.gameMaterials(matBridge, mat.defaultCacheDir(), () => undefined);
  const glass = mat.searchGameMaterials(list, "glass", 1)[0]?.path;
  if (!glass) throw new Error("EDGEmat found no game material for \"glass\"");
  await mat.useGameMaterial(matBridge, archive, r.mesh, gPart, glass);
  console.log(`EDGEmat: ${gPart} wears ${glass}`);
  check("EDGEmat's surface files are not EDGEfab's own material files", !r.materials.some((m) => low(m.mi) === low(s.mi)) && !r.files.some((f) => low(f).endsWith(low(s.mi))));

  // 3. EDGEfab adds it again: both parts keep what EDGEmat gave them.
  ({ r, took } = await add());
  console.log(`second add, two parts swapped by EDGEmat: ${took}`);
  let now = await looks(r.mesh);
  const swappedNames = () => r.swapped.map((x) => x.material).sort().join(",");
  check("EDGEfab names both parts as swapped", swappedNames() === [sPart, gPart].sort().join(","), JSON.stringify(r.swapped));
  check(`${sPart} still wears EDGEmat's surface`, low(now.get(sPart)?.base) === low(s.mi) && !now.get(sPart).instance.values.length, now.get(sPart)?.base);
  check(`${gPart} still wears the game material`, low(now.get(gPart)?.base) === low(glass), now.get(gPart)?.base);
  check("the surface's .mi and .mlsetup are still in the project", fs.existsSync(disk(s.mi)) && fs.existsSync(disk(s.setup)));
  check("the other parts wear their own", others.every((m) => low(now.get(m)?.base) === low(own(m))));
  check("no material was made again", r.kept.length === all.length, `${r.kept.length} of ${all.length} kept`);
  check("both parts' own materials are still in the project, to go back to", [sPart, gPart].every((m) => fs.existsSync(disk(own(m)))));
  let seen = await wears(r.mesh);
  check("EDGEmat reads the new mesh the same: a surface, a game material, the model's", seen[sPart] === "surface" && seen[gPart] === "game" && others.every((m) => seen[m] === "model"), JSON.stringify(seen));

  // 4. The swapped part's own material changes (its glow, else the size): made again under the swap, the swap stays.
  if (prepared.glow.length) await core.setGlowStrength(item, prepared.glow[0].strength === 8 ? 3 : 8, { material: sPart, version: "swap-check" });
  else await core.setSize(item, 1.5, { version: "swap-check" });
  ({ r, took } = await add());
  console.log(`third add, ${prepared.glow.length ? `${sPart}'s glow changed` : "a new size"}: ${took}`);
  now = await looks(r.mesh);
  check("the swaps stay when the part's own material is made again", swappedNames() === [sPart, gPart].sort().join(",") && low(now.get(sPart)?.base) === low(s.mi) && low(now.get(gPart)?.base) === low(glass));
  if (prepared.glow.length) check(`${sPart}'s own material was made again, for going back`, !r.kept.map(low).includes(low(own(sPart))) && fs.existsSync(disk(own(sPart))));

  // 5. EDGEmat: Back to the Model's Texture on one part. EDGEfab's next add sees it as its own again.
  const b = await mat.backToModel(matBridge, archive, r.mesh, sPart);
  check("EDGEmat's Back to the Model's Texture finds the part's own .mi in EDGEfab's record", low(b.mi) === low(own(sPart)), b.mi);
  ({ r, took } = await add());
  console.log(`fourth add, ${sPart} back on the model's texture: ${took}`);
  now = await looks(r.mesh);
  check(`${sPart} is EDGEfab's own again, ${gPart} still swapped`, swappedNames() === gPart && low(now.get(sPart)?.base) === low(own(sPart)) && low(now.get(gPart)?.base) === low(glass), JSON.stringify(r.swapped));
  seen = await wears(r.mesh);
  check("EDGEmat agrees", seen[sPart] === "model" && seen[gPart] === "game", JSON.stringify(seen));

  // 6. It packs.
  const packed = path.join(proj, "packed");
  fs.mkdirSync(packed, { recursive: true });
  const p = await matBridge.pack(archive, packed, "swapcheck");
  check(`the project packs (${p.files} files)`, p.files > 0 && fs.existsSync(p.archive));
} catch (e) {
  console.error(e);
  failed++;
} finally {
  bridge.client.stop();
  matBridge.stop();
  fs.rmSync(data, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
