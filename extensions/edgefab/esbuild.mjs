// Bundles the extension (CommonJS, VS Code's module loader), the core on its own (for the smoke test and other
// Node tools) and the MCP server. Everything is bundled, glTF-Transform and its WebAssembly helpers included, so
// the extension ships with no node_modules. `node esbuild.mjs --watch` rebuilds on change.
import * as esbuild from "esbuild";
import { inlineMikktspace, noSharp } from "../../tools/build/plugins.mjs";
import * as fs from "node:fs";

const watch = process.argv.includes("--watch");
const mcpVersion = JSON.parse(fs.readFileSync("../../packages/edgefab-mcp/package.json", "utf8")).version;
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

const common = { bundle: true, platform: "node", format: "cjs", target: "node20", sourcemap: true, logLevel: "info", plugins: [noSharp, inlineMikktspace] };

const builds = [
  { ...common, entryPoints: ["src/extension.ts"], outfile: "dist/extension.js", external: ["vscode"], define: { __VERSION__: JSON.stringify(version) } },
  { ...common, entryPoints: ["src/core/index.ts"], outfile: "dist/core.js" },
  // The MCP server ships inside the extension (src/mcp.ts copies it to a fixed path and registers it), built as
  // packages/edgefab-mcp builds it, with the MCP SDK bundled in, so any Node 20 runs it.
  { ...common, entryPoints: ["../../packages/edgefab-mcp/src/server.ts"], outfile: "dist/mcp/edgefab-mcp.cjs", define: { __VERSION__: JSON.stringify(mcpVersion) }, banner: { js: "#!/usr/bin/env node" } },
];


if (watch) {
  const contexts = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(contexts.map((c) => c.watch()));
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
}
