# EDGE<span class="y">fab</span> docs

EDGEfab is the EDGE fabricator for Cyberpunk 2077, a VS Code extension with an MCP server. It is not a mesh editor: its goal is the **game asset**, whole. Props, clothing, characters and NPCs, with everything that goes with them: materials, rigs, animations, voice, records. Right-click an asset, **Open in EDGEfab**, and change any part of it by prompts, while EDGEfab orchestrates the other EDGE tools, Blender, Unreal Engine and AI services: "make the jacket green and the sleeves red", "make an old worn trenchcoat", "animate the pinwheel", "give this NPC a deeper voice".

| Document | What it covers |
|---|---|
| [Build plan](plan.html) | The owner's vision (2026-10-25 and 26), what it changes in the design, Blender and Unreal assets alike, animation as a key focus, the decisions for F0, the phases F0 to F9, what other repos are asked for. Proposed |
| [Design](design.html) | **Version 1: props** (the goal, the Desk, the Library, Game Assets with kinds, import, Tripo takes, the steps V0 to V8, what other repos are asked for). The mission, what EDGEfab owns and what the other EDGE tools do, what a game asset is made of, clothing fitted to the body, Blender and Blender MCP, its shape, the MCP server, open questions. Draft 0.1, a brief, extended 2026-10-19 |
| [UE5 assets](ue-assets.html) | Research: Unreal Engine 5 props and characters, with materials, rigs and animations, into the game; driving Unreal headless and through its MCP server; feasibility, effort, tradeoffs |
| [Tests](testing.html) | Every test with its steps and results. None yet |
| [Changelog](changelog.html) | Changes a modder would notice. Nothing yet |
| [Dev setup](dev-setup.html) | What a PC needs to work on EDGEfab |
| [EDGEmat docs](https://edgemodders.github.io/EDGEmat/) | Materials and looks, which EDGEfab builds on |
| [REDcode docs](https://edgemodders.github.io/REDcode/) | The editor extensions and the bridge EDGEfab builds on |

## Roadmap status

As of 2026-10-27. Version 1 is set by the owner ([design](design.html#version-1-props)); its steps are proposals until V0. The later phases are proposals until F0 ([build plan](plan.html)).

| Phase | Status |
|---|---|
| F0 Decisions | For version 1: V0, next |
| **Version 1: props** (F1 and F3, V0 to V8) | Not started |
| F2 Workspace and prompts | Not started |
| F4 Clothing | Not started |
| F5 Characters, whole | Not started |
| F6 Characters, edited | Not started |
| F7a Animated props (a key focus) | Not started |
| F7b Character animation (a key focus) | Not started |
| F8 Unreal assets | Not started |
| F9 Ship | Not started |

Source code and issues: [github.com/Edgemodders/EDGEfab](https://github.com/Edgemodders/EDGEfab)
