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
| Blender | to record in F0 | Making and rigging models; converting FBX and OBJ to GLB | To record in F0 |

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

**EDGEmat's core, from a checkout, for now.** Add to Project makes its materials with EDGEmat's `materialsFromModel` (EDGEmat #4, #6). Until EDGEmat publishes its core as `@edgemodders/edgemat-core` ([EDGEmat #7](https://github.com/Edgemodders/EDGEmat/issues/7)), the build takes it from EDGEmat's source: a checkout beside this repo (`..\EDGEmat`), or the folder in `EDGEMAT_SRC`, with `npm install` run there (its `pngjs` and `vscode-jsonrpc` resolve from its own `node_modules`). `tools/build/edgemat.mjs` points esbuild at it, and both `tsconfig.json` files map the name with `paths`. Development builds only: no release is built this way (docs/tools-together.md, rule 1).

```powershell
git clone https://github.com/Edgemodders/EDGEmat.git ..\EDGEmat
cd ..\EDGEmat; npm install; cd ..\EDGEfab
```

Used since 2026-11-04 at EDGEmat `a7b66a8`.

F5 in VS Code runs EDGEfab in an extension development host (`.vscode/launch.json`). `npm run mcp:start` runs the MCP server on stdio.

| Package | Version | License | Why |
|---|---|---|---|
| `@gltf-transform/core`, `functions`, `extensions` | 4.5.1 | MIT | Reading, changing and writing glTF in Node: transforms, welding, simplifying, tangents |
| `meshoptimizer` | 1.3.0 | MIT | The simplifier behind the levels of detail (WebAssembly, bundled) |
| `gl-matrix` | 3.4.4 | MIT | Not used directly: glTF-Transform carries a copy of it. Installed so its license goes into the notices |
| `mikktspace` | 1.1.1 | MIT | MikkTSpace tangents, as Blender makes them; WolvenKit needs tangents. Its `.wasm` is copied beside each bundle by the build |
| `@modelcontextprotocol/sdk`, `zod` | 1.32, 3.25 | MIT | The MCP server, as EDGEmat's |
| `esbuild`, `typescript`, `@types/*` | 0.28, 5.9 | MIT, Apache-2.0 | Building and type checks |

All are bundled into the extension and the server, so neither ships `node_modules`. glTF-Transform's texture compression needs `sharp`, a native library EDGEfab doesn't use: the build leaves it out.

Packaging and releasing work as EDGEmat's (copied in F1): `npm run edgefab:package` makes `dist/edgefab-<version>.vsix` (it writes the extension's `CHANGELOG.md` from `docs/changelog.md` and its `THIRD-PARTY-NOTICES.txt` from the bundles' source maps); `node tools/version.mjs <version>` raises the extension's and the server's one version; `.github/workflows/release.yml` builds and, with **Make a release**, publishes. No release until every test since the last one has passed (CLAUDE.md, release gate). `tools/nexus/` is REDnode's, copied unchanged; the Nexus page isn't made yet (`nexus/README.md`). `tools/build/plugins.mjs` holds the build's two esbuild plugins: sharp left out, and mikktspace's WebAssembly put inside each bundle, so the MCP server is one file.

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
