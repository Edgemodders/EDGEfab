// Bundles the MCP server into one CommonJS file, with EDGEfab's core taken from the extension's source
// (it has no VS Code dependency) and the MCP SDK included, so `node dist/server.cjs` needs nothing else.
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, "package.json"), "utf8"));

// glTF-Transform's texture compression uses sharp, a native image library; EDGEfab doesn't compress textures,
// so sharp is left out of the bundle.
const noSharp = { name: "no-sharp", setup(b) {
  b.onResolve({ filter: /^sharp$/ }, () => ({ path: "sharp", namespace: "stub" }));
  b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "module.exports = undefined;" }));
} };
await esbuild.build({
  plugins: [noSharp],
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  define: { __VERSION__: JSON.stringify(pkg.version) },
  banner: { js: "#!/usr/bin/env node" },
});

// mikktspace (tangents) loads its WebAssembly from beside the script that bundles it.
fs.copyFileSync(path.join(here, "../../node_modules/mikktspace/dist/main/mikktspace_main_bg.wasm"), path.join(here, "dist", "mikktspace_main_bg.wasm"));
