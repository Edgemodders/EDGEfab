// Builds @edgemodders/edgefab-core (EDGEfab #5, for EDGEbuilder's Import a model): EDGEfab's core, taken from
// the extension's source (it has no VS Code dependency), as one CommonJS file. EDGEmat's core stays outside,
// a dependency (it has its own); everything else is bundled in (glTF-Transform, meshoptimizer, mikktspace with
// its WebAssembly inlined, jpeg-js, pngjs), so a tool that bundles this package again needs no plugins of its
// own. Their licenses go in dist/THIRD-PARTY-NOTICES.txt. The types come from tsc beside it (dist/types).
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { inlineMikktspace, noSharp } from "../../tools/build/plugins.mjs";

fs.rmSync("dist", { recursive: true, force: true });
const result = await esbuild.build({
  entryPoints: ["../../extensions/edgefab/src/core/index.ts"],
  outfile: "dist/index.cjs",
  bundle: true,
  external: ["@edgemodders/edgemat-core"],
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  metafile: true,
  logLevel: "info",
  plugins: [noSharp, inlineMikktspace],
});

// The packages bundled in, from what esbuild read: the innermost node_modules/<name> (or @scope/<name>).
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const parts = input.replace(/\\/g, "/").split("/");
  const at = parts.lastIndexOf("node_modules");
  if (at < 0) continue;
  const name = parts.slice(at + 1, at + (parts[at + 1]?.startsWith("@") ? 3 : 2));
  const dir = path.resolve(...parts.slice(0, at + 1 + name.length));
  if (fs.existsSync(path.join(dir, "package.json"))) packages.set(dir, true);
}
const entries = [...packages.keys()]
  .map((dir) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    const licenseFile = fs.readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f));
    const license = pkg.license ?? "unknown";
    const text = licenseFile ? fs.readFileSync(path.join(dir, licenseFile), "utf8").trim() : `(The package ships no license file; its package.json says ${license}.)`;
    return { name: pkg.name, version: pkg.version, license, text };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const line = "-".repeat(78);
fs.writeFileSync(
  "dist/THIRD-PARTY-NOTICES.txt",
  [
    "@edgemodders/edgefab-core bundles these npm packages. Their notices and licenses follow. EDGEfab itself is MIT (LICENSE).",
    "@edgemodders/edgemat-core is not bundled: it is a dependency, with its own license.",
    "",
    ...entries.map((e) => `- ${e.name} ${e.version} (${e.license})`),
    "",
    ...entries.flatMap((e) => [line, `${e.name} ${e.version}`, line, e.text, ""]),
  ].join("\n"),
);
for (const e of entries) if (!/^(MIT|ISC|BSD-[23]-Clause|Apache-2\.0|0BSD)$/.test(e.license)) throw new Error(`${e.name} is ${e.license}: check it before bundling`);

// The map's sources stay inside the package (as EDGEmat's core does since EDGEfab's report): EDGEfab's own
// files as "../src/core/<file>.ts", the bundled packages' as "../bundled/<package>/<file>"; the text is in the map.
const mapFile = "dist/index.cjs.map";
const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
const core = "extensions/edgefab/src/core/";
map.sources = map.sources.map((s) => {
  const p = s.replace(/\\/g, "/");
  if (p.includes(core)) return `../src/core/${p.slice(p.indexOf(core) + core.length)}`;
  const at = p.lastIndexOf("node_modules/");
  if (at >= 0) return `../bundled/${p.slice(at + "node_modules/".length)}`;
  if (p.startsWith("stub:")) return `../bundled/${p.slice(5)}.stub.js`; // noSharp's empty module
  throw new Error(`A source outside EDGEfab's core and node_modules: ${s}`);
});
if (!map.sourcesContent || map.sourcesContent.length !== map.sources.length) throw new Error("The map has no source text");
fs.writeFileSync(mapFile, JSON.stringify(map));
console.log(`bundled: ${entries.map((e) => e.name).join(", ")}`);
