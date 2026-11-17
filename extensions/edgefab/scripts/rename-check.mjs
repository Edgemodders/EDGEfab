// Rename, all the way in (docs/testing.md, "Rename, and copied items"): a copy of a Desk prop is renamed in a
// scratch Desk, and its folder, its model, its textures and its materials' names must all take the new name, in
// the files and in the records. The item it was copied from must not change. With --add, the renamed prop also
// goes into a scratch project through REDbridge (needs the game), and the game files' names are checked.
// Usage (after npm run build): node scripts/rename-check.mjs <a Desk item's folder> [--add]
import { createRequire } from "node:module";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
const add = args.includes("--add");
if (!source || !fs.existsSync(path.join(source, "asset.json"))) {
  console.error("Usage: node scripts/rename-check.mjs <a Desk item's folder> [--add]");
  process.exit(2);
}
const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-rename-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");

let failed = 0;
const check = (what, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failed++;
};
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const sums = (dir) => walk(dir).map((f) => `${path.relative(dir, f)} ${crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex")}`).sort().join("\n");
/** A GLB's JSON part. */
const gltf = (file) => {
  const b = fs.readFileSync(file);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
};
const triangles = (file) => {
  const g = gltf(file);
  return g.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + g.accessors[p.indices].count / 3, 0);
};
const itemName = (folder) => path.basename(folder).replace(/\.prop\.asset$/, "");

/** Everything in an item says `name`. Answers the material names. */
function consistent(folder, name, before) {
  const raw = path.join(folder, "source", "raw", name);
  const record = JSON.parse(fs.readFileSync(path.join(raw, "prepared.json"), "utf8"));
  const top = fs.readdirSync(raw, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  check(`${name}: the model is ${name}.glb`, fs.existsSync(path.join(raw, `${name}.glb`)) && path.win32.basename(record.glb) === `${name}.glb`);
  const stale = top.filter((f) => before.inner !== name && (f === `${before.inner}.glb` || f.startsWith(`${before.inner}_`)));
  check(`${name}: no file keeps the old name`, stale.length === 0, stale.join(", "));
  const paths = [record.glb, record.view, ...record.textures.map((t) => t.file), ...(record.glow ?? []).map((g) => g.texture)].filter(Boolean);
  const lost = paths.filter((p) => !fs.existsSync(p) || path.win32.dirname(p).toLowerCase() !== raw.toLowerCase());
  check(`${name}: every file the record names is in the item (${paths.length})`, lost.length === 0, lost.join(", "));
  const textures = record.textures.map((t) => path.win32.basename(t.file));
  check(`${name}: every texture file starts with the name`, textures.every((f) => f.startsWith(`${name}_`)), textures.filter((f) => !f.startsWith(`${name}_`)).join(", "));
  check(`${name}: as many files as before (${before.files})`, top.length === before.files, String(top.length));
  const named = [...record.materials, ...record.submeshes.map((s) => s.material), ...record.textures.map((t) => t.material), ...(record.glow ?? []).map((g) => g.material), ...(record.parts ?? []).map((p) => p.material)];
  const wrong = [...new Set(named.filter((m) => !m.startsWith(`${name}_`)))];
  check(`${name}: every material in the record starts with the name`, wrong.length === 0, wrong.join(", "));
  for (const [what, file] of [["the game's model", record.glb], ["the model to look at", record.view]]) {
    const inside = gltf(file).materials.map((m) => m.name).sort();
    check(`${name}: ${what} has the record's materials (${inside.length})`, JSON.stringify(inside) === JSON.stringify([...record.materials].sort()), inside.filter((m) => !record.materials.includes(m)).join(", "));
    check(`${name}: ${what} keeps its triangles`, triangles(file) === before.triangles[what], `${triangles(file)} was ${before.triangles[what]}`);
  }
  check(`${name}: its pictures are all there (${before.pictures})`, (core.readPictures(raw)?.takes ?? []).filter((t) => fs.existsSync(t.sheet)).length === before.pictures);
  const read = core.readItem(folder);
  check(`${name}: the item reads back`, read.name === name && fs.existsSync(read.prepared.glb));
  return record.materials;
}

try {
  // A copy in the scratch Desk; the original's checksums, to see it untouched at the end.
  const original = sums(source);
  const desk = core.deskDir();
  fs.mkdirSync(desk, { recursive: true });
  let folder = path.join(desk, path.basename(source));
  fs.cpSync(source, folder, { recursive: true });
  const first = itemName(folder);
  const raw0 = path.join(folder, "source", "raw", first);
  const record0 = core.readItem(folder).prepared;
  const before = {
    inner: path.basename(record0.glb, ".glb"),
    files: fs.readdirSync(raw0, { withFileTypes: true }).filter((e) => e.isFile()).length,
    triangles: { "the game's model": triangles(record0.glb), "the model to look at": triangles(record0.view) },
    pictures: (core.readPictures(raw0)?.takes ?? []).length,
  };
  console.log(`${first}: its files are named ${before.inner}${before.inner === first ? "" : " (renamed before, the old way)"}, ${before.files} files, ${record0.materials.length} materials, ${before.pictures} pictures`);

  let r = await core.renameItem(folder, "Corner Shop Machine", { version: "rename-check" });
  check("the folder is corner_shop_machine.prop.asset", path.basename(r.folder) === "corner_shop_machine.prop.asset" && r.renamed && !fs.existsSync(folder));
  folder = r.folder;
  consistent(folder, "corner_shop_machine", before);

  // The same name in files, another title: nothing moves.
  const kept = sums(path.join(folder, "source"));
  r = await core.renameItem(folder, "Corner Shop Machine!", { version: "rename-check" });
  check("a new title with the same file name moves nothing", !r.renamed && sums(path.join(folder, "source")) === kept);
  check("the title follows", JSON.parse(fs.readFileSync(path.join(folder, "asset.json"), "utf8")).name === "Corner Shop Machine!");

  // It still works as an item: Set Size, then a second rename.
  const sized = await core.setSize(folder, 1.9, { version: "rename-check" });
  check("Set Size works on the renamed item", Math.abs(sized.size.height - 1.9) < 1e-6);
  r = await core.renameItem(folder, "Neon Box", { version: "rename-check" });
  folder = r.folder;
  const materials = consistent(folder, "neon_box", { ...before, inner: "corner_shop_machine" });

  if (add) {
    const proj = path.join(data, "proj");
    fs.mkdirSync(path.join(proj, "source", "archive"), { recursive: true });
    fs.mkdirSync(path.join(proj, "source", "raw"), { recursive: true });
    const bridge = await core.startBridge();
    try {
      const added = await core.addToProject({ item: folder, project: core.projectFolders(proj), call: bridge.call });
      check("Add to Project: the mesh and entity are neon_box", /\\neon_box\.mesh$/.test(added.mesh) && /\\neon_box\.ent$/.test(added.entity), `${added.mesh}, ${added.entity}`);
      check(`Add to Project: its materials are the renamed ones (${added.materials.length})`, JSON.stringify(added.materials.map((m) => m.name).sort()) === JSON.stringify([...materials].sort()) && added.materials.every((m) => m.applied));
      const files = walk(path.join(proj, "source")).map((f) => path.basename(f));
      const old = files.filter((f) => [before.inner, first, "corner_shop_machine"].some((n) => n !== "neon_box" && f.startsWith(n)));
      check(`Add to Project: no project file keeps an old name (${files.length} files)`, old.length === 0, old.join(", "));
    } finally {
      bridge.client.stop();
    }
  }

  check("the item it was copied from is unchanged", sums(source) === original);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  fs.rmSync(data, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : "all passed");
process.exit(failed ? 1 : 0);
