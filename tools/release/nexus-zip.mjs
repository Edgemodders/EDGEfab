// Builds the Nexus Mods file: dist/EDGEfab-<version>-nexus.zip with the .vsix, the MCP server, how to
// install them, and the licenses. Run after the VSIX is packaged and the MCP server built (the release
// workflow's Package step, or npm run edgefab:package and npm run mcp:build). The workflow attaches the
// zip to the GitHub release; it is uploaded to Nexus by hand (nexus/README.md). The same way as REDcode's.
//   node tools/release/nexus-zip.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = path.join(root, "dist");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "extensions", "edgefab", "package.json"), "utf8"));
const vsix = path.join(dist, `edgefab-${version}.vsix`);
const mcp = [path.join(dist, `edgefab-mcp-${version}.cjs`), path.join(root, "packages", "edgefab-mcp", "dist", "server.cjs")].find((p) => fs.existsSync(p));
const stage = path.join(dist, "nexus");
const zip = path.join(dist, `EDGEfab-${version}-nexus.zip`);

if (!fs.existsSync(vsix)) throw new Error(`${vsix} is missing: package the extension first (npm run edgefab:package)`);
if (!mcp) throw new Error("The MCP server is missing: build it first (npm run mcp:build)");
spawnSync(process.execPath, [path.join(root, "tools", "release", "notices.mjs")], { stdio: "inherit" });
fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zip, { force: true });
fs.mkdirSync(stage, { recursive: true });

fs.copyFileSync(vsix, path.join(stage, path.basename(vsix)));
fs.copyFileSync(mcp, path.join(stage, `edgefab-mcp-${version}.cjs`));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(stage, "LICENSE.txt"));
fs.copyFileSync(path.join(dist, "THIRD-PARTY-NOTICES.txt"), path.join(stage, "THIRD-PARTY-NOTICES.txt"));
fs.writeFileSync(
  path.join(stage, "README.txt"),
  [
    `EDGEfab ${version}: the EDGE asset maker for Cyberpunk 2077, a VS Code extension.`,
    "A preview: it turns a textured 3D model, your own or made by Tripo from your words, into a prop for the game.",
    "",
    "This is a VS Code extension, not a game mod. Do not install it with Vortex.",
    "",
    "The easy way: search for EDGEfab in VS Code's Extensions view (Ctrl+Shift+X) and click",
    "Install. It updates itself from then on. Or install the file in this folder:",
    "",
    "Install:",
    "  1. In VS Code (or VSCodium, or EDGEkit), open the Extensions view (Ctrl+Shift+X).",
    "  2. Click ... at its top, choose Install from VSIX..., and pick",
    `     edgefab-${version}.vsix from this folder.`,
    "  3. Click the EDGEfab icon in the activity bar, then Import a GLB... or Generate with Tripo...",
    "",
    "Or from a terminal:",
    `  code --install-extension edgefab-${version}.vsix`,
    "",
    "Needs Windows 10 or 11, 64-bit, and VS Code 1.70 or later.",
    "Generate with Tripo needs your own Tripo API key (platform.tripo3d.ai); each model costs about 20 credits.",
    "Add to Project needs REDcode (https://github.com/Edgemodders/REDcode).",
    "",
    `For AI assistants: edgefab-mcp-${version}.cjs is EDGEfab's MCP server (Node.js 20 or later).`,
    "Keep it somewhere stable, then for Claude Code run once:",
    `  claude mcp add --scope user edgefab -- node "<that folder>\\edgefab-mcp-${version}.cjs"`,
    "",
    "Docs: https://edgemodders.github.io/EDGEfab/",
    "Source and issues: https://github.com/Edgemodders/EDGEfab",
    "",
  ].join("\r\n"),
);

// Windows' own tar writes zip files (-a picks the format from the name); Git's tar does not.
const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
const packed = spawnSync(tar, ["-a", "-c", "-f", zip, ...fs.readdirSync(stage)], { cwd: stage, stdio: "inherit" });
if (packed.status !== 0) throw new Error("Zipping failed");
fs.rmSync(stage, { recursive: true, force: true });
console.log(`${zip}: ${(fs.statSync(zip).size / 1048576).toFixed(1)} MB`);
