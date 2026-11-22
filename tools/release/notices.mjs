// Third-party notices for the npm packages EDGEfab's builds bundle, found from the builds' source maps:
// each package with its version, license and license text. MIT and similar licenses ask for the
// notice to travel with the code, so the VSIX, the MCP server and the Nexus zip carry this file.
//
//   node tools/release/notices.mjs               dist/THIRD-PARTY-NOTICES.txt: the extension and the MCP server
//   node tools/release/notices.mjs --extension   extensions/edgefab/THIRD-PARTY-NOTICES.txt: the extension's bundle
//                                                only (vscode:prepublish runs it, after the build)
//
// Build first: it reads dist/*.map. Generated, never committed.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const extension = process.argv.includes("--extension");
const maps = [join(root, "extensions/edgefab/dist/extension.js.map"), join(root, "extensions/edgefab/dist/mcp/edgefab-mcp.cjs.map")];
if (!extension) maps.push(join(root, "packages/edgefab-mcp/dist/server.cjs.map"));
const out = extension ? join(root, "extensions/edgefab/THIRD-PARTY-NOTICES.txt") : join(root, "dist/THIRD-PARTY-NOTICES.txt");

// Each bundled package's folder: the source path up to node_modules/<name> or node_modules/@scope/<name>.
const packages = new Map();
const hiddenPackages = { "@edgemodders/edgemat-core": /node_modules[\\/]extensions[\\/]edgemat[\\/]/ };
for (const map of maps) {
  if (!existsSync(map)) throw new Error(`${map} is missing: build first (npm run build)`);
  for (const source of JSON.parse(readFileSync(map, "utf8")).sources) {
    const file = resolve(dirname(map), source);
    const parts = file.split(sep);
    // The innermost node_modules with a package in it: a package's own source map can name paths from its
    // build machine (gl-matrix's name node_modules/.deno/...), which exist nowhere here.
    // Failing that, the package by its name in the workspace's own node_modules.
    let found = false;
    // A package whose own source map names its repo's paths above the package, so they land outside it
    // (node_modules/extensions/edgemat/... for @edgemodders/edgemat-core 0.3.2): known by that path. Fixed in
    // EDGEmat's main (0432330, sources "../src/core/..."), on npm from 0.3.3: drop this once EDGEfab takes it.
    for (const [name, pattern] of Object.entries(hiddenPackages)) {
      const dir = join(root, "node_modules", ...name.split("/"));
      if (pattern.test(file) && existsSync(join(dir, "package.json"))) {
        packages.set(dir, true);
        found = true;
      }
    }
    for (let at = parts.lastIndexOf("node_modules"); at >= 0 && !found; at = parts.lastIndexOf("node_modules", at - 1)) {
      const name = parts.slice(at + 1, at + (parts[at + 1]?.startsWith("@") ? 3 : 2));
      for (const dir of [parts.slice(0, at + 1 + name.length).join(sep), join(root, "node_modules", ...name)]) {
        if (name.length && !name[0].startsWith(".") && existsSync(join(dir, "package.json"))) {
          packages.set(dir, true);
          found = true;
          break;
        }
      }
    }
  }
}

const entries = [...packages.keys()]
  .map((dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const licenseFile = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f));
    const license = pkg.license ?? pkg.licenses?.map((l) => l.type).join(" OR ") ?? "unknown";
    const text = licenseFile ? readFileSync(join(dir, licenseFile), "utf8").trim() : `(The package ships no license file; its package.json says ${license}.)`;
    return { name: pkg.name, version: pkg.version, license, url: typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url, text };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const line = "-".repeat(78);
const body = [
  `EDGEfab${extension ? " (the VS Code extension, with its MCP server inside)" : ", the VS Code extension and its MCP server,"} bundles these npm packages.`,
  "Their notices and licenses follow. EDGEfab itself is MIT (LICENSE).",
  "",
  ...entries.map((e) => `- ${e.name} ${e.version} (${e.license})`),
  "",
  ...entries.flatMap((e) => [line, `${e.name} ${e.version}`, `License: ${e.license}${e.url ? `\nSource: ${e.url.replace(/^git\+/, "")}` : ""}`, "", e.text, ""]),
].join("\n");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, body.replace(/\r\n/g, "\n"), "utf8");
console.log(`${out.slice(root.length + 1)}: ${entries.length} packages (${entries.map((e) => e.name).join(", ")})`);
