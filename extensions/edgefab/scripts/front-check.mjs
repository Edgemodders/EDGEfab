// Which way prepare turns a GLB by default (docs/testing.md, "F3a: Blender files onto the Desk", part A): a box
// with a front marker at glTF +Z (glTF's and Blender's front), written three ways, through prepareModel. A GLB
// from anywhere is turned half round; a game mesh exported by WolvenKit (its node names, or SharpGLTF as the
// generator) is left as it is. Tripo's quarter turn is the smoke test's.
// Usage (after npm run build): node scripts/front-check.mjs
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const { Document, NodeIO } = require("@gltf-transform/core");
const core = require("../dist/core.js");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-front-check-"));

function box(doc, name, at, size, color) {
  const [x, y, z] = at, [w, h, d] = size;
  const p = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) p.push(x + (sx * w) / 2, y + (sy * h) / 2, z + (sz * d) / 2);
  const uv = Array.from({ length: 8 }, (_, i) => [(i >> 2) & 1, (i >> 1) & 1]).flat();
  const idx = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  const buf = doc.getRoot().listBuffers()[0];
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(p)).setBuffer(buf))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(idx)).setBuffer(buf))
    .setMaterial(doc.createMaterial(`${name}_mat`).setBaseColorFactor(color));
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

/** A GLB with the asset generator given (glTF-Transform writes its own on writing). */
function withGenerator(glb, generator) {
  const len = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + len).toString("utf8"));
  json.asset.generator = generator;
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += " ";
  const jb = Buffer.from(text);
  const rest = glb.subarray(20 + len);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + rest.length, 8);
  head.writeUInt32LE(jb.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, jb, rest]);
}

const cases = [
  { label: "a GLB from anywhere (front at +Z) is turned half round", dir: "plain", names: ["body", "front_marker"], generator: "Khronos glTF Blender I/O", turn: true },
  { label: "WolvenKit's node names are left", dir: "wolvenkit", names: ["submesh_00_LOD_1", "submesh_01_LOD_1"], generator: "Khronos glTF Blender I/O", turn: false },
  { label: "SharpGLTF as the generator is left", dir: "sharpgltf", names: ["body", "front_marker"], generator: "SharpGLTF 1.0.0", turn: false },
];
let failed = 0;
for (const c of cases) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene();
  scene.addChild(box(doc, c.names[0], [0, 0.5, 0], [1, 1, 1], [0.5, 0.5, 0.5, 1]));
  scene.addChild(box(doc, c.names[1], [0, 0.5, 0.55], [0.1, 0.1, 0.1], [1, 0, 0, 1]));
  const dir = path.join(out, c.dir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "in.glb");
  fs.writeFileSync(file, withGenerator(Buffer.from(await new NodeIO().writeBinary(doc)), c.generator));
  const r = await core.prepareModel(file, path.join(dir, "out"), "t", { parts: false });
  const turned = r.notes.filter((n) => /^Turned/.test(n));
  // The marker's side after prepare: the second submesh's middle in z (glTF -Z is the game's forward).
  const v = await new NodeIO().read(path.join(dir, "out", "t.glb"));
  const marker = v.getRoot().listMeshes().map((m) => m.listPrimitives()[0].getAttribute("POSITION")).find((a) => a.getMax([])[0] - a.getMin([])[0] < 0.2);
  const z = marker ? (marker.getMin([])[2] + marker.getMax([])[2]) / 2 : NaN;
  const ok = (turned.length > 0) === c.turn && (c.turn ? z < -0.3 : z > 0.3);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.label}: the marker at z ${z.toFixed(2)}${turned.length ? ` (${turned.join(" ")})` : ""}`);
}
console.log(`\n${failed ? `${failed} failed` : "all passed"} (scratch: ${out})`);
process.exit(failed ? 1 : 0);
