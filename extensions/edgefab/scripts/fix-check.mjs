// F3b, Fix Mesh (docs/testing.md, "F3b: Fix Mesh"): a test model made here with every fault Fix Mesh fixes, on a
// scratch Desk, fixed, fixed again and undone; with --item, a copy of a real Desk prop (a Tripo model) too.
// The test model: a 1 m plate of 2.5 cm squares with 3 mm ripples, a doubled seam down its middle, a missing square (a hole),
// three squares turned the wrong way and a 1 mm loose speck; beside it a cube and a cylinder that must not change.
// With --library, the fixed test model goes into a scratch Library through REDbridge (needs the game's files).
// Usage (after npm run build): node scripts/fix-check.mjs [--blender <blender.exe>] [--item <a .prop.asset folder>] [--library]
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-fix-check-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");
const { Document, NodeIO } = require("@gltf-transform/core");

let failed = 0;
const check = (what, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed++;
};
const hash = (f) => createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16);
/** Every file of an item's model, by name, with its hash (before_fix/ and the fix's own files apart). */
const snapshot = (raw) => Object.fromEntries(fs.readdirSync(raw, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => [e.name, hash(path.join(raw, e.name))]));

const blender = await core.findBlender(opt("--blender"));
check("Blender found", !!blender, blender ?? "install Blender or pass --blender");
if (!blender) process.exit(1);

// ---- the test model ------------------------------------------------------------------------------------
function mesh(doc, name, positions, uvs, indices, color) {
  const buf = doc.getRoot().listBuffers()[0];
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(positions)).setBuffer(buf))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uvs)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(indices)).setBuffer(buf))
    .setMaterial(doc.createMaterial(name).setBaseColorFactor(color));
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

const N = 40; // plate cells a side, 2.5 cm each
const ripple = (x, z) => 0.003 * Math.sin(x * 31) * Math.cos(z * 23);
function plate() {
  const p = [], uv = [], idx = [];
  const at = new Map();
  // The right half's vertices are its own (a doubled seam down the middle, as glTF splits at a seam).
  const vert = (i, j, half) => {
    const key = `${i},${j},${i === N / 2 ? half : 0}`;
    if (!at.has(key)) {
      const x = i / N - 0.5, z = j / N - 0.5;
      at.set(key, p.length / 3);
      p.push(x, 0.5 + ripple(x, z), z);
      uv.push(i / N, j / N);
    }
    return at.get(key);
  };
  const flipped = new Set(["3,3", "4,3", "15,12"]);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === 10 && j === 5) continue; // the hole
      const half = i >= N / 2 ? 1 : 0;
      const a = vert(i, j, half), b = vert(i + 1, j, half), c = vert(i + 1, j + 1, half), d = vert(i, j + 1, half);
      const tri = flipped.has(`${i},${j}`) ? [a, b, c, a, c, d] : [a, c, b, a, d, c]; // up (+Y), or turned down
      idx.push(...tri);
    }
  }
  // A loose speck, 1 mm across, under the plate (inside the model's bounds, so its size doesn't hang on it).
  const s = p.length / 3;
  p.push(0.2, 0.3, 0.2, 0.201, 0.3, 0.2, 0.2, 0.3, 0.201);
  uv.push(0, 0, 0, 0, 0, 0);
  idx.push(s, s + 2, s + 1);
  return { p, uv, idx };
}
function cube(cx, cy, cz, h) {
  const p = [], uv = [], idx = [];
  const faces = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
  for (const [axis, sign] of faces) {
    const o = p.length / 3;
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const q = [0, 0, 0];
      q[axis] = sign * h; q[u] = a * h; q[v] = b * h;
      p.push(cx + q[0], cy + q[1], cz + q[2]);
      uv.push((a + 1) / 2, (b + 1) / 2);
    }
    idx.push(...(sign > 0 ? [o, o + 1, o + 2, o, o + 2, o + 3] : [o, o + 2, o + 1, o, o + 3, o + 2]));
  }
  return { p, uv, idx };
}
const R = 0.15, CX = 0.8, CZ = 0;
function cylinder() {
  const p = [], uv = [], idx = [];
  const S = 32, H = 4;
  for (let r = 0; r <= H; r++) for (let k = 0; k <= S; k++) {
    const t = (k / S) * Math.PI * 2;
    p.push(CX + R * Math.cos(t), 0.1 * r, CZ + R * Math.sin(t));
    uv.push(k / S, r / H);
  }
  for (let r = 0; r < H; r++) for (let k = 0; k < S; k++) {
    const a = r * (S + 1) + k, b = a + 1, c = a + S + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return { p, uv, idx };
}
const doc = new Document();
doc.createBuffer();
const scene = doc.createScene();
const pl = plate(), cu = cube(-0.8, 0.15, 0, 0.15), cy = cylinder();
scene.addChild(mesh(doc, "plate", pl.p, pl.uv, pl.idx, [0.6, 0.6, 0.6, 1]));
// Named block and pipe: "cube" and "cylinder" are names Blender makes up, which don't name parts.
scene.addChild(mesh(doc, "block", cu.p, cu.uv, cu.idx, [0.2, 0.4, 0.9, 1]));
scene.addChild(mesh(doc, "pipe", cy.p, cy.uv, cy.idx, [0.9, 0.3, 0.2, 1]));
const fixture = path.join(data, "faulty_panel.glb");
await new NodeIO().write(fixture, doc);

// ---- made, fixed, fixed again, undone ------------------------------------------------------------------
const made = await core.makeModel({ from: "file", file: fixture }, { version: "check" });
const raw = path.join(made.folder, "source", "raw", made.name);
const before = snapshot(raw);
const partsBefore = (made.prepared.parts ?? []).map((p) => p.name).sort().join(",");
check("the test model on the Desk, in 3 parts", partsBefore === "block,pipe,plate", partsBefore);
check("Undo with nothing fixed is refused", await core.undoFix(made.folder, { version: "check" }).then(() => false, (e) => /nothing to undo/.test(e.message)));

let t0 = Date.now();
const fixed = await core.fixMesh(made.folder, { version: "check", blender });
console.log(`     ${((Date.now() - t0) / 1000).toFixed(1)} s. ${fixed.said.join(" ")}`);
const r = fixed.report;
check("the doubled seam merged (41 vertices at least)", r.merged >= 41, `${r.merged}`);
check("the 3 turned squares (6 triangles) turned back, and no more", r.flipped === 6, `${r.flipped}`);
check("the hole filled, and only it", r.holes === 1, `${r.holes}`);
check("the speck dropped, and only it", r.loose === 1 && r.looseFaces === 1, `${r.loose} (${r.looseFaces} faces)`);
check("the ripples flattened, by at most their 3 mm", r.flattened >= 1 && r.largestMove > 0.0015 && r.largestMove <= 0.0035, `${r.flattened} areas, ${r.moved} vertices, largest ${(r.largestMove * 1000).toFixed(2)} mm`);

const g = await new NodeIO().read(path.join(raw, "fixed.glb"));
const positions = (name) => {
  const node = g.getRoot().listNodes().find((n) => n.getName() === name);
  const a = node?.getMesh()?.listPrimitives()[0].getAttribute("POSITION");
  const out = [];
  for (let i = 0; i < (a?.getCount() ?? 0); i++) out.push(a.getElement(i, []));
  return out;
};
const plateV = positions("plate");
const inner = plateV.filter(([x, , z]) => Math.abs(x) < 0.45 && Math.abs(z) < 0.45);
const flat = inner.filter(([, y]) => Math.abs(y - 0.5) < 0.0005).length;
check("the plate's inner vertices on its plane (within 0.5 mm)", inner.length > 0 && flat / inner.length > 0.95, `${flat} of ${inner.length}`);
const cylV = positions("pipe");
const off = Math.max(...cylV.map(([x, , z]) => Math.abs(Math.hypot(x - CX, z - CZ) - R)));
check("the cylinder still round (within 0.1 mm)", cylV.length > 0 && off < 0.0001, `${(off * 1000).toFixed(3)} mm off, ${cylV.length} vertices`);
const cubeV = positions("block");
const cubeOff = Math.max(...cubeV.map((v) => Math.max(...v.map((c, i) => Math.abs(Math.abs(c - [-0.8, 0.15, 0][i]) - 0.15)))));
check("the cube untouched (its corners where they were)", cubeV.length > 0 && cubeOff < 1e-5, `${cubeV.length} vertices`);

const partsAfter = (fixed.prepared.parts ?? []).map((p) => p.name).sort().join(",");
check("its parts kept", partsAfter === partsBefore, partsAfter);
// Within the ripples' 3 mm: the plate's crests, its top, are pressed flat.
check("its size kept", Math.abs(fixed.prepared.size.height - made.prepared.size.height) < 0.004, `${made.prepared.size.height.toFixed(3)} m → ${fixed.prepared.size.height.toFixed(3)} m`);
check("the facing kept (turned half round, as before)", fixed.prepared.notes.some((n) => /half round/.test(n)), fixed.prepared.notes.join(" | "));
check("the note says it was fixed", fixed.prepared.notes.some((n) => /^Mesh fixed: /.test(n)));
check("the model before kept for Undo", fs.existsSync(path.join(raw, "before_fix", "prepared.json")) && core.fixState(made.folder)?.report.flipped === 6);
const asset = JSON.parse(fs.readFileSync(path.join(made.folder, "asset.json"), "utf8"));
check("the history says so", /^Fixed its mesh in Blender/.test(asset.history.at(-1).did), asset.history.at(-1).did);

const kept = snapshot(path.join(raw, "before_fix"));
const again = await core.fixMesh(made.folder, { version: "check", blender });
check("fixing again starts from the original (the same report)", JSON.stringify(again.report) === JSON.stringify(r), again.said.join(" "));
check("fixing again keeps the first model before", JSON.stringify(snapshot(path.join(raw, "before_fix"))) === JSON.stringify(kept));

await core.undoFix(made.folder, { version: "check" });
const undone = snapshot(raw);
const differ = Object.keys({ ...before, ...undone }).filter((f) => before[f] !== undone[f] && f !== "prepared.json");
check("Undo puts every file back as it was", !differ.length, differ.join(", "));
check("Undo leaves no fixed model or before_fix", !fs.existsSync(path.join(raw, "fixed.glb")) && !fs.existsSync(path.join(raw, "before_fix")) && !core.fixState(made.folder));
check("Undo's prepared.json the same", JSON.stringify(core.readPrepared(raw).submeshes) === JSON.stringify(made.prepared.submeshes));

// Renamed after a fix, then undone: the files put back take the new name.
await core.fixMesh(made.folder, { version: "check", blender });
const renamed = await core.renameItem(made.folder, "Panel renamed", { version: "check" });
await core.undoFix(renamed.folder, { version: "check" });
const rraw = path.join(renamed.folder, "source", "raw", renamed.name);
const rp = core.readPrepared(rraw);
check("renamed, then undone: the model under the new name", path.basename(rp.glb) === `${renamed.name}.glb` && fs.existsSync(rp.glb) && rp.materials.every((m) => m.startsWith(`${renamed.name}_`)), `${path.basename(rp.glb)}; ${rp.materials.join(", ")}`);

// Add to Library takes the fixed model, and leaves the model kept for Undo on the Desk (needs the game's files).
if (args.includes("--library")) {
  await core.fixMesh(renamed.folder, { version: "check", blender });
  const root = path.join(data, "library");
  fs.mkdirSync(root, { recursive: true });
  const bridge = await core.startBridge();
  try {
    const added = await core.addToLibrary({ item: renamed.folder, root, modder: "fix_check", call: bridge.call, tool: "EDGEfab check" });
    const lraw = path.join(added.folder, "source", "raw", path.basename(added.folder, ".prop.asset"));
    check("Add to Library: the fixed model in the Library, without before_fix", fs.existsSync(path.join(lraw, "fixed.glb")) && !fs.existsSync(path.join(lraw, "before_fix")), lraw);
    check("Add to Library: Undo still works on the Desk", await core.undoFix(renamed.folder, { version: "check" }).then(() => true, (e) => e.message));
  } catch (e) {
    check("Add to Library", false, e.message);
  } finally {
    bridge.client.stop();
  }
}

// A picture with no model, and no Blender.
check("a prop with no model is refused", await core.fixMesh(path.join(data, "desk", "nothing.prop.asset"), { version: "check", blender }).then(() => false, (e) => /not a Desk prop|isn't a model/.test(e.message)));
check("no Blender: refused in plain words", await core.blenderFix(fixture, path.join(data, "x.glb"), { blender: path.join(data, "no", "blender.exe") }).then(() => false, (e) => /Blender/.test(e.message)));

// ---- a real Desk prop ----------------------------------------------------------------------------------
const real = opt("--item");
if (real) {
  console.log(`\n${path.basename(real)} (a copy)`);
  const copy = path.join(core.deskDir(), path.basename(real));
  fs.cpSync(real, copy, { recursive: true });
  const name = path.basename(copy, ".prop.asset");
  const craw = path.join(copy, "source", "raw", name);
  const was = core.readPrepared(craw);
  const textures = Object.fromEntries(was.textures.map((t) => [path.basename(t.file), hash(t.file)]));
  const snap = snapshot(craw);
  t0 = Date.now();
  const f = await core.fixMesh(copy, { version: "check", blender, onProgress: (s) => console.log(`     ${s}`) });
  console.log(`     ${((Date.now() - t0) / 1000).toFixed(1)} s. ${f.said.join(" ")}`);
  for (const n of f.notes) console.log(`     note: ${n}`);
  const p = f.prepared;
  check("its parts kept", (p.parts ?? []).map((x) => x.name).join(",") === (was.parts ?? []).map((x) => x.name).join(","), (p.parts ?? []).map((x) => x.name).join(", "));
  check("its size kept (within 1%)", Math.abs(p.size.height / was.size.height - 1) < 0.01, `${was.size.height.toFixed(3)} m → ${p.size.height.toFixed(3)} m`);
  check("its facing kept", was.notes.filter((n) => /^Turned/.test(n)).join() === p.notes.filter((n) => /^Turned/.test(n)).join(), p.notes.filter((n) => /^Turned/.test(n)).join(" "));
  const same = Object.entries(textures).filter(([file, h]) => fs.existsSync(path.join(craw, file)) && hash(path.join(craw, file)) === h).length;
  check("its textures the same files", same === Object.keys(textures).length, `${same} of ${Object.keys(textures).length} byte for byte`);
  const painted = was.glow.filter((g) => g.painted).map((g) => `${g.material}:${g.strength}`).sort().join(",");
  check("its painted glow kept", p.glow.filter((g) => g.painted).map((g) => `${g.material}:${g.strength}`).sort().join(",") === painted, painted || "none");
  check("still under the game's vertex limit, with tangents", p.submeshes.every((s) => s.vertices <= core.MaxSubmeshVertices && s.attributes.includes("TANGENT")));
  const tris = (q) => q.submeshes.filter((s) => s.lod === 1).reduce((a, s) => a + s.triangles, 0);
  console.log(`     LOD 1: ${tris(was).toLocaleString("en-US")} → ${tris(p).toLocaleString("en-US")} triangles`);
  await core.undoFix(copy, { version: "check" });
  const back = snapshot(craw);
  const diff = Object.keys({ ...snap, ...back }).filter((k) => snap[k] !== back[k] && k !== "prepared.json");
  check("Undo puts it back", !diff.length, diff.join(", "));
  console.log(`     the fixed copy stays for a look: run it again without Undo, or open ${copy}`);
}

console.log(`\n${failed ? `${failed} failed` : "all passed"} (scratch: ${data})`);
process.exit(failed ? 1 : 0);
