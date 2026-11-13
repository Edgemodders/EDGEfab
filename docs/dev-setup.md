# Dev setup

What a Windows PC needs to work on EDGEfab. The shared tools are the same as in [REDcode's setup guide](https://edgemodders.github.io/REDcode/dev-setup.html) and [EDGEmat's](https://edgemodders.github.io/EDGEmat/dev-setup.html). There is no code yet: F0 decides the details, and this page then gains its build steps with exact versions.

## 1. Base tools

| Tool | Version used | Why | Install |
|---|---|---|---|
| Git for Windows | as REDcode | Source control | `winget install --id Git.Git -e` |
| nvm for Windows and Node.js | as REDcode (Node 24) | The tool will be TypeScript, as the rest of the ecosystem | `winget install --id CoreyButler.NVMforWindows -e`, then `nvm install 24` and `nvm use 24` |
| Python | 3.10 or later | Brand tooling | |
| Chrome or Edge | any | Renders the brand images | Already present on Windows |
| REDbridge | 0.8.0 or later | Reads and writes game files (0.8.0 adds TweakDB reading) | See [REDbridge's setup guide](https://edgemodders.github.io/REDbridge/dev-setup.html) |
| Blender | 5.2.3 LTS (on the PC, Steam, `D:\SteamLibrary\steamapps\common\Blender`, found through REDcode's `redcode.blenderPath`) | The shape cleanup tried in F1, run in the background; F3's sources and Fix Mesh. EDGEfab doesn't ship it | Steam, or blender.org |

## 2. Repository and GitHub

```powershell
git clone https://github.com/Edgemodders/EDGEfab.git
cd EDGEfab
git config user.name  "CyberbuildsAI"
git config user.email "340969962+CyberbuildsAI@users.noreply.github.com"
git config credential.https://github.com.username CyberbuildsAI
```

## 3. Build and run

The extension is in `extensions/edgefab`, its MCP server in `packages/edgefab-mcp`, one npm workspace. The server bundles the extension's `src/core`, which has no VS Code imports.

```powershell
npm install
npm run build        # the extension (dist/extension.js), the core alone (dist/core.js) and the MCP server, both copies
npm run typecheck
npm run smoke -- "<a textured model>.glb"   # makes a prop from it with the bundled core, into a temporary folder
```

**EDGEmat's core, from npm.** Add to Project makes its materials with EDGEmat's `materialsFromModel` (EDGEmat #4, #6), from the package `@edgemodders/edgemat-core` ([EDGEmat #7](https://github.com/Edgemodders/EDGEmat/issues/7), published with EDGEmat 0.3.2 on 2026-11-13): a devDependency of the extension and the MCP server, bundled into both, so `npm install` is all it needs. Pinned `~0.3.2`: before 1.0, EDGEmat raises at least the middle number when an export's request or result changes (EDGEfab relies on `materialsFromModel`, `bridgeOver` and `BridgeCall`). Until 2026-11-13 the build took EDGEmat's source from a checkout beside this repo (`tools/build/edgemat.mjs`, removed).

F5 in VS Code runs EDGEfab in an extension development host (`.vscode/launch.json`). `npm run mcp:start` runs the MCP server on stdio.

| Package | Version | License | Why |
|---|---|---|---|
| `@gltf-transform/core`, `functions`, `extensions` | 4.5.1 | MIT | Reading, changing and writing glTF in Node: transforms, welding, simplifying, tangents |
| `meshoptimizer` | 1.3.0 | MIT | The simplifier behind the levels of detail (WebAssembly, bundled) |
| `gl-matrix` | 3.4.4 | MIT | Not used directly: glTF-Transform carries a copy of it. Installed so its license goes into the notices |
| `mikktspace` | 1.1.1 | MIT | MikkTSpace tangents, as Blender makes them; WolvenKit needs tangents. Its `.wasm` is copied beside each bundle by the build |
| `jpeg-js` | 0.4.4 | BSD-3-Clause | Reads a JPEG color texture in plain JavaScript for Make the Painted Lights Glow, so it works with no game and no REDbridge (Tripo's color textures are JPEG). `npm install -D jpeg-js@0.4.4 -w extensions/edgefab` |
| `pngjs` | 7.0.0 | MIT | Reads and writes PNG in plain JavaScript: Tripo's normal maps when parts are packed into one picture, and the four views cut from the picture-first sheet. The version EDGEmat uses. `npm install -D pngjs@7.0.0 @types/pngjs@6.0.5 -w extensions/edgefab` |
| `@edgemodders/edgemat-core` | 0.3.2 | MIT | EDGEmat's core: the materials Add to Project makes (above). `npm install -D "@edgemodders/edgemat-core@~0.3.2" -w extensions/edgefab -w packages/edgefab-mcp` (then `~` in both package.json files) |
| `@modelcontextprotocol/sdk`, `zod` | 1.32, 3.25 | MIT | The MCP server, as EDGEmat's |
| `esbuild`, `typescript`, `@types/*` | 0.28, 5.9 | MIT, Apache-2.0 | Building and type checks |

All are bundled into the extension and the server, so neither ships `node_modules`. glTF-Transform's texture compression needs `sharp`, a native library EDGEfab doesn't use: the build leaves it out.

Packaging and releasing work as EDGEmat's (copied in F1): `npm run edgefab:package` makes `dist/edgefab-<version>.vsix` (it writes the extension's `CHANGELOG.md` from `docs/changelog.md` and its `THIRD-PARTY-NOTICES.txt` from the bundles' source maps); `node tools/version.mjs <version>` raises the extension's and the server's one version; `.github/workflows/release.yml` builds and, with **Make a release**, publishes. No release until every test since the last one has passed (CLAUDE.md, release gate). The Nexus tool is in [EDGErepo](https://github.com/Edgemodders/EDGErepo): check it out beside this repo to run `npm run nexus:status` or `nexus:pull`; the release workflow clones it by itself. The Nexus page isn't made yet (`nexus/README.md`). `tools/build/plugins.mjs` holds the build's two esbuild plugins: sharp left out, and mikktspace's WebAssembly put inside each bundle, so the MCP server is one file.

## 4. Game access for checks

Through REDcode's MCP server, as in [EDGEmat's dev setup](https://edgemodders.github.io/EDGEmat/dev-setup.html#3-game-access-for-spec-checks): `redcode-mcp` for the game's files, and REDnode's MCP server (`rednode` in Claude Code) for the running game.

```powershell
claude mcp add redcode -- node "E:\Modding\Cyberpunk 2077\REDcode\packages\redcode-mcp\dist\server.cjs"
```

Or install [EDGEchat](https://github.com/Edgemodders/EDGEchat), the EDGE plugin for Claude Code, which sets up `redcode`, `rednode`, `edgedeck` and `edgemat` together. In Claude Code: `/plugin marketplace add Edgemodders/EDGEchat`, then `/plugin install edge@edgemodders`, then `/edge:setup` to check each connection. Do not also add by hand a server the plugin already has: it would show twice.

## 5. Docs site and brand images

The site at https://edgemodders.github.io/EDGEfab/ is built by `.github/workflows/pages.yml` on every push to `main`. **Settings > Pages > Source** must be **GitHub Actions**.

```powershell
.\tools\brand\render.ps1   # banner, social preview, icon, badges
```

| Output | Used by |
|---|---|
| `docs/assets/brand/banner.png` | README header |
| `docs/assets/brand/social.png` | Upload by hand in Settings > General > Social preview |
| `docs/assets/brand/icon.png` | Site icon, and the extension's Marketplace icon later |
| `docs/assets/brand/badges/*.svg` | README badges. Edit the list in `tools/brand/badges.py` |
| `tools/brand/activity.svg` | The activity bar icon. Drawn by hand, not rendered: 24 × 24, stroke 2, `currentColor`, the family's HUD brackets around a cube. F1 copies it to `extensions/edgefab/images/activity.svg` |
