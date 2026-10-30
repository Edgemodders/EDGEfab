# EDGEfab: notes for Claude sessions

EDGEfab is the EDGE asset maker for Cyberpunk 2077: a standalone VS Code extension in the EDGE family (`edgemodders.edgefab`) and an MCP server. It turns a 3D model into a new object or piece of clothing that works in the game, orchestrating the other EDGE tools. Read [docs/plan.md](docs/plan.md) (the owner's vision and the proposed phases) and [docs/design.md](docs/design.md) first.

## Requests from other repos

Open issues labelled `request` at https://github.com/Edgemodders/EDGEfab/issues?q=is%3Aissue+is%3Aopen+label%3Arequest are needs from other EDGE tools. Read them at the start of a session and pick them up when the current phase is done; close each with a note on what shipped.

## Status and next step

- Scaffold created 2026-10-16 by the EDGEmat session: README, license, docs site (HUD layout, dev setup), brand sources and images (icon "EF", activity bar icon), Pages workflow. No code.
- **Design draft 0.1 is a brief, not decisions.** Written from the custom-asset goals the owner set on 2026-10-16 (EDGEmat's design, "Custom assets") and what EDGEmat's M0 learned against the game.
- **Extended 2026-10-19** by the EDGEmat session at the owner's request: clothing fitted to the body (the game's body types, the body dummies and refitters in WolvenKit's Blender add-on, fitting steps), Blender MCP servers, and materials from EDGEmat's new **M4 Make** (generated from words through an AI image service, or picked from the game). EDGEmat moved M4 Make ahead of its preview for EDGEfab.
- **The owner's vision, 2026-10-25** (given in a REDnode session, written up there into [docs/plan.md](docs/plan.md)): EDGEfab is **a full-spectrum fabricator, not a mesh editor like Blender**: its goal is the game asset, whole (props, clothing, characters, NPCs and everything that goes with them: materials, rigs, animations, voice, records), changed by prompts, and in the end prompted new. **Open in EDGEfab** on an asset's file (REDcode's viewer stays the default on click) opens it. Early build: simple textured props that EDGEbuilder places in a scene (F1). Big effort: click an NPC asset and see the full character in EDGEfab, with clothes, animation and voice (F5), then edit every aspect by orchestrating the EDGE tools and MCP servers (F6). Its own agent connects as a client to EDGEmat ("make the jacket green and the sleeves red"), Tripo for text to mesh ("make an old worn trenchcoat"), and Blender or Unreal Engine through their MCP servers ("animate the pinwheel"). The long-term goal is to bring free and royalty-free Unreal Engine assets into the game: research in [docs/ue-assets.md](docs/ue-assets.md) (moved from REDnode). This changes draft 0.1's "EDGEfab does not connect to Blender". The plan's phases (F0 to F9) replace draft 0.1's and are proposals until F0.
- **Added by the owner, 2026-10-26** (plan.md, "Blender and Unreal, the same kinds of asset" and "Animation: a key focus"): import the same kinds of asset from Blender as from Unreal, only what the RED engine accepts natively (meshes, materials, rigs, animations, shape keys); exotic features of either (geometry nodes, simulations, Blueprints, Niagara, Control Rig, ...) are left aside for now. Animation, imported or generated, is a key focus, since the community wants easy tooling for it; the subject (prop, NPC, V) always opens first so the modder sees what is animated. Proposed: F7 split into F7a animated props (after F2) and F7b character animation (after F5).
- **Version 1 set by the owner, 2026-10-27** ([docs/design.md](docs/design.md), "Version 1: props"): game props, mainly described in words and made by Tripo in takes (or imported from a GLB); a **Desk** (as EDGEmat's), a **Library** of the modder's own folders that EDGEbuilder reads in the game (`library.json` plus one packed archive), and EDGEfab's own **Game Assets** with kind checkboxes; REDcode's 3D viewer reused (mounted with EDGEfab's toolbar `actions`), no viewer of its own. **Added 2026-10-30:** a prompt's model comes back from Tripo in named, described parts (the main use; splitting an imported model is the other), by segmentation v2 or `generate_parts`, compared in V0; a material planner picks a material per part in words (keep Tripo's texture, a game surface, a game material, or a new one) and EDGEmat makes and puts on each one (EDGEfab never writes materials; EDGEmat's own Compose planner is proposed, not built). A prop or a part is changed four ways (size on the asset page, fixed Blender background steps, by hand through REDcode's Edit in Blender, an assistant through a Blender MCP server) plus Tripo's edits; each change a version with undo; parts kept by Blender object name. On a prop in a project, hand edits merge into the project on each save as REDcode's Edit in Blender does, and EDGEfab puts materials back by part name (the importer sorts submeshes by node name). **Owner, 2026-10-30:** EDGEfab's agent stays out of version 1; Claude Code drives it. Steps V0 to V10; it covers plan F1 and F3. Tripo's V2 API retires 2026-10-31: build on V3.
- **Next: V0**, version 1's checks, and the requests it lists (REDcode viewer contract, EDGEmat materials from textures and per-part apply, REDbridge mod-archive reads, EDGEbuilder's Library tab). For the later phases, agree [docs/plan.md](docs/plan.md) with the owner: the agent (recommended: Claude Agent SDK with the modder's own key, as REDagent), Tripo through its REST API, the two layers for Blender and Unreal, Open in EDGEfab beside EDGEmat's Open in EDGEmat, the phases. Then the checks F0 lists, and the study of how working custom-item and custom-object mods are built, in our own words.

## The EDGE family, as it touches EDGEfab

| Tool | Role for EDGEfab |
|---|---|
| EDGEmat | Materials and looks (a mesh's appearances): generated, from a model's textures, or picked from the game (its M4 Make). EDGEfab calls its API and MCP tools; it does not edit materials itself |
| Blender (not EDGE) | Modeling, fitting and weights, with WolvenKit's Blender add-on (body dummies, refitters). An assistant can drive it through a Blender MCP server |
| REDcode | The project, the 3D viewer, packing. `REDcodeApi` version 1, extension `edgemodders.redcode-cyberpunk` |
| REDbridge | Every game file read and write, as a separate process |
| EDGEdeck | Deploying to the game; writes `modlist.txt`. Renamed from REDdeck on 2026-10-17 (`edgemodders.edgedeck`) |
| REDnode | The running game: hot load, spawn, equip. Its MCP server reads the running game (`rednode` in Claude Code) |
| EDGEbuilder | Places objects in the world |

Requests that affect EDGEfab, filed from EDGEmat on 2026-10-15 and 16 (labelled `request`; state checked 2026-10-24):

| Repo | Issue | For | State |
|---|---|---|---|
| REDcode | #6 | The viewer: EDGEmat's material hook, appearance switching, a GLB's own textures | Closed: shipped in REDcode 0.10.0 (the EDGEmat hook untested against EDGEmat) |
| REDcode | #7 | "Pack and try" (hot load) and "Edit in Blender" | Closed: shipped in REDcode 0.10.0 |
| REDbridge | #5 | Mesh import for a new asset: from a GLB, or over a template mesh | Closed: `project.import` with a `template`, REDbridge 0.9.0 |
| REDnode | #12 | Hot-load archives in the running game; refresh what uses them | Open. `archives.reload` (REDnode 0.26.0) and worn clothing refresh (0.26.20) shipped; world objects wait for H2c |
| EDGEbuilder | #1 | Index mod archives, so custom objects can be placed | Open |

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
- **In-game tests:** test archives go in a test project's `tests` folder, never its `packed` folder (WolvenKit's Pack clears it). Steps start with REDnode's Test timer (Start, then one Mark per numbered step).
- **Tests:** `docs/testing.md` lists every test with steps to rerun it, expected results and each run's result. Add a test there when it is first run. Stop after each phase for the owner's test.
- **Changelog:** `docs/changelog.md` is the one changelog, kept as REDnode's and EDGEmat's are: each change a modder would notice gets a line under **Unreleased** (**New**, **Changed**, **Fixed**, **Other**) in the same commit. Release notes come from it (`tools/release/notes.mjs`, copied from EDGEmat with the release workflow in F1).
- **Release gate (the owner's rule):** no release (Make a release, a Marketplace, Open VSX, npm or Nexus upload) until every test in `docs/testing.md` for the builds since the last release has passed. Untested or failed stops it: say what is still open, even when asked to release.
- **Starting a release:** Claude starts a release run only when the owner asks in chat (`gh workflow run release.yml --ref main -f release=true -f nexus=true` once the workflow exists); the owner may also start it by hand.
- **Release workflow and Nexus Mods:** copy EDGEmat's `.github/workflows/release.yml`, `tools/release/` and `tools/nexus/` (the Nexus scripts are REDnode's; keep the copies the same) when the first code lands. EDGEfab is a VS Code extension, so its Nexus upload has **Mod Manager Download off** (`"modManager": false`, `"primary": false` in `nexus/nexus.json`). The page is created by the owner by hand; then `npm run nexus:pull`. Never print the Nexus key or put it on a command line. No credit to the owner's own account (Cyberbuilds) in the page's credits.
- **AI services and keys:** every AI service (Anthropic for the agent, Tripo, others) uses the modder's own key, stored in VS Code's secret storage, and is called only after the modder sets it up. Record each asset's source and license (Fab listing, Tripo plan, own work) in the project and the packed mod's credits.
