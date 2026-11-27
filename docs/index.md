# EDGE<span class="y">fab</span> docs

EDGEfab is the EDGE fabricator for Cyberpunk 2077, a VS Code extension with an MCP server. It is not a mesh editor: its goal is the **game asset**, whole. Props, clothing, characters and NPCs, with everything that goes with them: materials, rigs, animations, voice, records. Right-click an asset, **Open in EDGEfab**, and change any part of it by prompts, while EDGEfab orchestrates the other EDGE tools, Blender, Unreal Engine and AI services: "make the jacket green and the sleeves red", "make an old worn trenchcoat", "animate the pinwheel", "give this NPC a deeper voice".

| Document | What it covers |
|---|---|
| [Build plan](plan.html) | The owner's vision (2026-10-25 and 26), what it changes in the design, Blender and Unreal assets alike, animation as a key focus, the decisions for F0, the phases F0 to F9, what other repos are asked for. Proposed |
| [Design](design.html) | The mission, what EDGEfab owns and what the other EDGE tools do, what a game asset is made of, clothing fitted to the body, Blender and Blender MCP, its shape, the MCP server, open questions. Draft 0.1, a brief, extended 2026-10-19 |
| [Library assets](library.html) | Assets in the EDGE Library, shared across tools and projects: found in REDcode, made and changed in EDGEfab, pulled into any project. In F1 (decided 2026-10-31); EDGEfab's part built 2026-11-13 |
| [Tools working together](tools-together.html) | How EDGE tools share code (packages), move between tabs (extension APIs), talk to assistants (MCP) and share REDbridge. For every tool's builders. A proposal (2026-11-04); its home is asked of EDGEweb ([#6](https://github.com/Edgemodders/EDGEweb/issues/6)) |
| [Props, the parallel proposal](props.html) | A first version of props written with the owner in a parallel session (2026-10-27 to 30): takes, parts and a material planner, changes in Blender, edits merged back. Kept for reference; the build plan places each part (reviewed 2026-11-04) |
| [UE5 assets](ue-assets.html) | Research: Unreal Engine 5 props and characters, with materials, rigs and animations, into the game; driving Unreal headless and through its MCP server; feasibility, effort, tradeoffs |
| [Tests](testing.html) | Every test with its steps and results. None yet |
| [Changelog](changelog.html) | Changes a modder would notice. Nothing yet |
| [Dev setup](dev-setup.html) | What a PC needs to work on EDGEfab |
| [EDGEmat docs](https://edgemodders.github.io/EDGEmat/) | Materials and looks, which EDGEfab builds on |
| [REDcode docs](https://edgemodders.github.io/REDcode/) | The editor extensions and the bridge EDGEfab builds on |

## Roadmap status

As of 2026-11-26. The first build (F1) is released (0.1.0 on 2026-11-18, 0.2.0 on 2026-11-22, 0.2.1 on 2026-11-25); the other phases are proposals ([build plan](plan.html)). EDGEfab covers **props, clothing, bodies and NPC looks** (the owner, 2026-11-22 and 2026-11-26); animation editing is REDcode's (2026-11-24). The order, agreed with the owner 2026-11-26: F0, F1, F3, F4a, F4b, F2, FN, FB, F7a, FA, F8, F9. 1.0 is props, clothing and NPC looks (F1, F3, F4a, F4b, F2, FN).

| Phase | Status |
|---|---|
| F0 Decisions | Done: Tripo and the GLB import over a game prop checked (2026-10-31 and 11-01); both collisions solid in the game (2026-11-09) |
| F1 Props: a textured GLB, imported or from Tripo, added to the project and placed with EDGEbuilder | Started 2026-11-01: the extension and MCP server, Tripo, the prepare step (smoke tested), Open in 3D, glow kept. **Add to Project** built 2026-11-04 (passed without the game; its in-game check is built). Make the Painted Lights Glow and Glow Strength built 2026-11-05. In the game 2026-11-09: both collisions solid, the facing right. Generate from Words (picture first, in parts) and Set Size built 2026-11-10; keys in VS Code's secret storage 2026-11-11; **the Library** (Add to Library, the Library view, Add to Project from it, Refresh) and Make a Prop in the Explorer built 2026-11-13. Rename built the same day. The owner's VS Code pass and **F1's phase test in the game with EDGEbuilder passed** 2026-11-14 and 15; the normal maps' green flipped by default, confirmed in the game. **Released** as 0.1.0 (2026-11-18) and 0.2.0 (keys in REDcode's Keys, 2026-11-22) |
| F3 Blender sources (FBX, `.blend`) | Not started |
| F2 Workspace and prompts | Not started |
| F4a Reshape a game garment (from EDGEmat's Reshape, EDGEfab #3) | Not started. Proposed right after F3 |
| F4b New clothing, fitted to both bodies | Not started. Proposed right after F4a |
| FN NPC looks (an NPC assembled, its parts swapped, a new look that spawns) | Not started. Proposed 2026-11-26 right after F2 |
| FB Bodies (a body for V or an NPC, with its own refitter for clothing) | Not started. Proposed 2026-11-26; after FN (the owner, the same day). After 1.0, which is props, clothing and NPC looks |
| F5a Characters, seen | Left EDGEfab 2026-11-22 (props and clothing only) |
| F5b Characters, heard and read | Left EDGEfab 2026-11-22 (props and clothing only) |
| FA The agent (moved out of F2, 2026-11-04) | Not started |
| F6 Characters, edited | Left EDGEfab 2026-11-22 (props and clothing only) |
| F7a Animated props (a skeleton made in EDGEfab, the entity that plays its clip; the clip made in REDcode's Animation Editor or Blender) | Not started. Kept by the owner 2026-11-26, after FB |
| F7b-1 Small animation edits (a key focus) | Left EDGEfab 2026-11-22 (props and clothing only) |
| F7b-2 Character animation (a key focus) | Left EDGEfab 2026-11-22 (props and clothing only) |
| F8 Unreal assets | Not started |
| F9 Ship | Not started |

Source code and issues: [github.com/Edgemodders/EDGEfab](https://github.com/Edgemodders/EDGEfab)
