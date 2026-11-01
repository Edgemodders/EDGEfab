// Smoke test of the bundled core, without VS Code: makes a prop from a GLB on disk and prints what came out.
// Usage (after npm run build): npm run smoke -- <model.glb> [outFolder]
// The output goes to outFolder, or a temporary folder, never EDGEfab's own work folder.
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const core = require("../dist/core.js");

const [file, out] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run smoke -- <model.glb> [outFolder]");
  process.exit(2);
}
const base = out ?? fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-smoke-"));
const started = Date.now();
const made = await core.makeModel({ from: "file", file }, { version: "smoke", base, onProgress: (s) => console.log(s) });
const p = made.prepared;
console.log(`made ${made.name} in ${made.folder} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
console.log(`size: ${p.size.height.toFixed(3)} m tall, ${p.size.width.toFixed(3)} x ${p.size.depth.toFixed(3)} m`);
for (const s of p.submeshes) console.log(`${s.name}: ${s.triangles} triangles, ${s.vertices} vertices, material ${s.material}, ${s.attributes.join(",")}`);
for (const t of p.textures) console.log(`${t.slot}: ${path.basename(t.file)}`);
for (const n of p.notes) console.log(`note: ${n}`);
const bad = p.submeshes.filter((s) => s.vertices > core.MaxSubmeshVertices || !s.attributes.includes("TANGENT") || !s.attributes.includes("TEXCOORD_0"));
if (!p.submeshes.some((s) => s.lod === 1) || bad.length) {
  console.error("FAILED: no LOD 1, or a submesh over the vertex limit or without UVs and tangents");
  process.exit(1);
}
console.log("ok");
