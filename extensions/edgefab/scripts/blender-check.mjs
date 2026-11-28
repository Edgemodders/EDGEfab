// F3a, Blender files onto the Desk (docs/testing.md, "F3a: Blender files onto the Desk"): Blender makes a test
// crate as .blend, FBX and OBJ (scripts/blender-fixture.py), and each goes onto a scratch Desk through makeModel.
// Checks the parts, what was left aside, materials with no picture, a missing texture, the size, the record, that
// a .blend's own script never runs, and where Blender's front lands. With --add, the .blend and FBX props also go
// into scratch projects through REDbridge (needs the game).
// Usage (after npm run build): node scripts/blender-check.mjs [--blender <blender.exe>] [--add]
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const data = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-blender-check-"));
process.env.EDGEFAB_DATA = data; // never the modder's Desk
const core = require("../dist/core.js");

let failed = 0;
const check = (what, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failed++;
};
const gltf = (file) => {
  const b = fs.readFileSync(file);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
};

const blender = await core.findBlender(opt("--blender"));
check("Blender found", !!blender, "install Blender or pass --blender");
if (!blender) process.exit(1);
console.log(`     ${blender}`);

const src = path.join(data, "sources");
execFileSync(blender, ["--background", "--factory-startup", "--python", path.join(here, "blender-fixture.py"), "--", src], { stdio: "ignore", windowsHide: true });
for (const f of ["crate.blend", "crate.fbx", "crate.obj", "crate_color.png"]) check(`fixture ${f}`, fs.existsSync(path.join(src, f)));

const made = {};
for (const ext of [".blend", ".fbx", ".obj"]) {
  const file = path.join(src, `crate${ext}`);
  console.log(`\n${path.basename(file)}`);
  const t0 = Date.now();
  let m;
  try {
    m = await core.makeModel({ from: "file", file, name: `crate_${ext.slice(1)}` }, { version: "check", blender });
  } catch (e) {
    check(`made from ${ext}`, false, e.message);
    continue;
  }
  made[ext] = m;
  console.log(`     ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const line of core.describeReport(m.blender)) console.log(`     ${line}`);
  const names = m.blender.meshes.map((x) => x.name).sort();
  check(`${ext}: the five visible parts, by name`, ["body", "front_marker", "label", "lid", "pipe"].every((n) => names.some((x) => x === n || x.startsWith(`${n}.`) || x.startsWith(n))), names.join(", "));
  check(`${ext}: the hidden box left out`, !names.some((n) => n.startsWith("hidden")), names.join(", "));
  // The Desk item's own parts keep those names, and its materials take them (found by EDGEweb's VS Code run, 2026-11-27).
  const parts = (m.prepared.parts ?? []).map((p) => p.name).sort();
  check(`${ext}: the Desk's parts keep Blender's names`, parts.join(",") === "body,front_marker,label,lid,pipe", parts.join(", ") || "no parts");
  const mats = gltf(path.join(m.folder, "source", "raw", m.name, "view.glb")).materials.map((x) => x.name).sort();
  check(`${ext}: its materials named by part`, mats.join(",") === ["body", "front_marker", "label", "lid", "pipe"].map((n) => `${m.name}_${n}`).join(","), mats.join(", "));
  const h = m.prepared.size.height;
  check(`${ext}: about 0.88 m tall`, h > 0.84 && h < 0.92, `${h.toFixed(3)} m`);
  check(`${ext}: a color texture for the body`, m.prepared.textures.some((t) => /color|base/i.test(t.slot)), JSON.stringify(m.prepared.textures.map((t) => t.slot)));
  check(`${ext}: the record names Blender`, m.asset.from.blender === m.blender.blender && fs.existsSync(path.join(m.folder, "source", "raw", m.name, "blender.json")));
  check(`${ext}: the source kept`, fs.existsSync(path.join(m.folder, "source", "raw", m.name, `original${ext}`)));
  // Blender's front (-Y) in the exported GLB, before prepare: glTF's +Z if the exporter maps -Y to +Z.
  const g = gltf(path.join(m.folder, "source", "raw", m.name, "from_blender.glb"));
  const marker = g.nodes.find((n) => n.name?.startsWith("front_marker"));
  if (marker) console.log(`     Blender's front marker in the GLB at ${JSON.stringify(marker.translation ?? "its vertices")}`);
}

const b = made[".blend"];
if (b) {
  console.log("\n.blend, what only a .blend has");
  check(".blend: camera, light and armature left aside", ["camera", "light", "armature"].every((w) => b.blender.leftAside.some((l) => l.startsWith(w))), b.blender.leftAside.join("; "));
  check(".blend: the hidden object named", b.blender.leftAside.some((l) => l.startsWith("hidden object")), b.blender.leftAside.join("; "));
  check(".blend: the node material with no picture named", b.blender.noPicture.includes("pipe_noise"), b.blender.noPicture.join(", "));
  check(".blend: the missing texture named", b.blender.missingTextures.includes("label_gone.png"), b.blender.missingTextures.join(", "));
  check(".blend: its own script never ran", !fs.existsSync(path.join(src, "autoexec_ran.txt")));
}

// A file Blender can't open, and a file EDGEfab doesn't take.
const bad = path.join(src, "broken.fbx");
fs.writeFileSync(bad, "not an fbx");
try {
  await core.makeModel({ from: "file", file: bad }, { version: "check", blender });
  check("a broken FBX fails", false, "it was made");
} catch (e) {
  check("a broken FBX fails in plain words", /Blender/.test(e.message), e.message);
  console.log(`     ${e.message}`);
}
check("the broken FBX left no Desk item", !fs.readdirSync(core.deskDir()).some((d) => d.startsWith("broken")));
try {
  await core.makeModel({ from: "file", file: path.join(src, "crate_color.png") }, { version: "check" });
  check("a PNG is refused", false, "it was made");
} catch (e) {
  check("a PNG is refused", /makes props from/.test(e.message), e.message);
}

if (args.includes("--add")) {
  for (const [ext, m] of Object.entries(made).filter(([e]) => e !== ".obj")) {
    const proj = path.join(data, `proj_${ext.slice(1)}`);
    fs.mkdirSync(path.join(proj, "source", "archive"), { recursive: true });
    fs.mkdirSync(path.join(proj, "source", "raw"), { recursive: true });
    console.log(`\nAdd to Project, ${ext}: ${proj}`);
    const bridge = await core.startBridge();
    try {
      const added = await core.addToProject({ item: m.folder, project: core.projectFolders(proj), call: bridge.call });
      const inArchive = (gamePath) => fs.existsSync(path.join(proj, "source", "archive", gamePath));
      check(`${ext}: the mesh and entity in the project`, inArchive(added.mesh) && inArchive(added.entity), `${added.mesh}, ${added.entity}`);
      check(`${ext}: its materials applied (${added.materials.length})`, added.materials.length > 0 && added.materials.every((x) => x.applied));
      console.log(`     ${added.entity}`);
    } catch (e) {
      check(`${ext}: added to the project`, false, e.message);
    } finally {
      bridge.client.stop();
    }
  }
}

console.log(`\n${failed ? `${failed} failed` : "all passed"} (scratch: ${data})`);
process.exit(failed ? 1 : 0);
