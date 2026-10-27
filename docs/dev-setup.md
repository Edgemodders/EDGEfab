# Dev setup

What a Windows PC needs to work on EDGEfab. The shared tools are the same as in [REDcode's setup guide](https://edgemodders.github.io/REDcode/dev-setup.html) and [EDGEmat's](https://edgemodders.github.io/EDGEmat/dev-setup.html). There is no code yet: F0 decides the details, and this page then gains its build steps with exact versions.

## 1. Base tools

| Tool | Version used | Why | Install |
|---|---|---|---|
| Git for Windows | as REDcode | Source control | `winget install --id Git.Git -e` |
| nvm for Windows and Node.js | as REDcode (Node 24) | The tool will be TypeScript, as the rest of the ecosystem | `winget install --id CoreyButler.NVMforWindows -e`, then `nvm install 24` and `nvm use 24` |
| Python | 3.10 or later | Brand tooling | |
| Chrome or Edge | any | Renders the brand images | Already present on Windows |
| REDbridge | 0.11.0 or later | Reads and writes game files (0.9.0 adds mesh import over a template, 0.11.0 texture import presets) | See [REDbridge's setup guide](https://edgemodders.github.io/REDbridge/dev-setup.html) |
| Blender | to record in F0 | Making and rigging models; converting FBX and OBJ to GLB | To record in F0 |

## 2. Repository and GitHub

```powershell
git clone https://github.com/Edgemodders/EDGEfab.git
cd EDGEfab
git config user.name  "CyberbuildsAI"
git config user.email "340969962+CyberbuildsAI@users.noreply.github.com"
git config credential.https://github.com.username CyberbuildsAI
```

## 3. Game access for checks

Through REDcode's MCP server, as in [EDGEmat's dev setup](https://edgemodders.github.io/EDGEmat/dev-setup.html#3-game-access-for-spec-checks): `redcode-mcp` for the game's files, and REDnode's MCP server (`rednode` in Claude Code) for the running game.

```powershell
claude mcp add redcode -- node "E:\Modding\Cyberpunk 2077\REDcode\packages\redcode-mcp\dist\server.cjs"
```

Or install [EDGEchat](https://github.com/Edgemodders/EDGEchat), the EDGE plugin for Claude Code, which sets up `redcode`, `rednode`, `edgedeck` and `edgemat` together. In Claude Code: `/plugin marketplace add Edgemodders/EDGEchat`, then `/plugin install edge@edgemodders`, then `/edge:setup` to check each connection. Do not also add by hand a server the plugin already has: it would show twice.

## 4. Docs site and brand images

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
