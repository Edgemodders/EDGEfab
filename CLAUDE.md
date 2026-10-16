# EDGEfab: notes for Claude sessions

EDGEfab is the EDGE asset maker for Cyberpunk 2077: a standalone VS Code extension in the EDGE family (`edgemodders.edgefab`) and an MCP server. It turns a 3D model into a new object or piece of clothing that works in the game, orchestrating the other EDGE tools. Read [docs/design.md](docs/design.md) first.

## Status and next step

- Scaffold created 2026-10-16 by the EDGEmat session: README, license, docs site (HUD layout, dev setup), brand sources and images (icon "EF", activity bar icon), Pages workflow. No code.
- **Design draft 0.1 is a brief, not decisions.** Written from the custom-asset goals the owner set on 2026-10-16 (EDGEmat's design, "Custom assets") and what EDGEmat's M0 learned against the game.
- **Next: F0.** Work through the design with the owner: the boundaries with EDGEmat and REDcode, the open questions, the phases. Study how working custom-item and custom-object mods are built, in our own words.

## The EDGE family, as it touches EDGEfab

| Tool | Role for EDGEfab |
|---|---|
| EDGEmat | Materials and looks (a mesh's appearances). EDGEfab calls its API and MCP tools; it does not edit materials itself |
| REDcode | The project, the 3D viewer, packing. `REDcodeApi` version 1, extension `edgemodders.redcode-cyberpunk` |
| REDbridge | Every game file read and write, as a separate process |
| REDdeck | Deploying to the game; writes `modlist.txt` |
| REDnode | The running game: hot load, spawn, equip. Its MCP server reads the running game (`rednode` in Claude Code) |
| EDGEbuilder | Places objects in the world |

Open requests that affect EDGEfab, filed from EDGEmat on 2026-10-15 and 16 (labelled `request`):

| Repo | Issue | For |
|---|---|---|
| REDcode | #6 | The viewer: EDGEmat's material hook, appearance switching, a GLB's own textures |
| REDcode | #7 | "Pack and try" (hot load) and "Edit in Blender" |
| REDbridge | #5 | Mesh import for a new asset: from a GLB, or over a template mesh |
| REDnode | #12 | Hot-load archives in the running game; refresh what uses them |
| EDGEbuilder | #1 | Index mod archives, so custom objects can be placed |

## Conventions

- Same as the sibling repos (see EDGEmat's and REDcode's CLAUDE.md): commit straight to `main` in small commits and push; plain, short sentences; tables for facts; mark anything unverified.
- **Naming:** EDGEmodders is the community and GitHub organization; EDGE is the platform brand, the set of tools.
- **Git identity:** per repo, `CyberbuildsAI` with the GitHub no-reply email (`340969962+CyberbuildsAI@users.noreply.github.com`). Never change the global identity.
- **Never commit game files**, WolvenKit binaries, or data extracted from the game. Field names, game paths, counts and a few example values in docs are fine.
- **License boundary:** this repo is MIT. Talk to REDbridge (GPL-3.0) only as a separate process; never link it or copy WolvenKit code here. Study other mods for how they are built, never copy their code or data.
- **Do not change other EDGE repos from here**; other sessions work in them. Needs go to them as issues labelled `request`, with the shape that would work.
- **The mission decides UI questions:** modding for everyone, especially non-coders; easy, fun, fast. Plain words first, raw values one click away. Every feature ships in the UI and the MCP server together. AI is optional: no network calls or telemetry until an assistant or an AI service the user chose connects.
- Keep `extensions/edgefab/src/core` free of VS Code imports; the MCP server bundles it.
- **House style** is the HUD look from REDnode's design doc; the REDnode HUD theme in REDcode is the default theme for any VS Code UI.
- **Docs site:** `docs/` is published by GitHub Pages through `.github/workflows/pages.yml`. `docs/index.md` is the landing page (document ledger and roadmap status); add every page to `nav` in `docs/_config.yml`. Brand images come from `tools/brand/render.ps1`. Record every tool install in `docs/dev-setup.md`, with versions and exact commands.
- **In-game tests:** test archives go in a test project's `tests` folder, never its `packed` folder (WolvenKit's Pack clears it).
