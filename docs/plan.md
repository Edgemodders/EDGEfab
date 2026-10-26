---
title: Build plan
---

# EDGE<span class="y">fab</span> build plan

**Status: proposed, 2026-10-25.** Written from the owner's vision of 2026-10-25 (below), on top of [design draft 0.1](design.html). Nothing is built. F0 agrees this plan with the owner. Until then every phase, name and order here is a proposal. Anything not yet checked is marked unverified.

## The vision

The owner, 2026-10-25:

> EDGEfab will connect to various MCP servers like Blender and UE to do meshwork, and the ultimate goal is to prompt new mesh-based assets. It can connect to an AI service for text to mesh like Tripo. `.mesh` objects still open REDcode's 3D viewer when clicked, but the right-click menu adds **Open in EDGEfab**, where changes to the mesh and its materials are made in one place, by prompts.

| The modder says | EDGEfab sends it to | What comes back |
|---|---|---|
| "Make the jacket green and the sleeves red" | **EDGEmat** (colors, `mat_apply`), on the parts named "jacket" and "sleeves" | A new look on the same mesh |
| "Make an old worn trenchcoat" | **Tripo** (text to 3D), then EDGEfab's Blender steps (clean, fit to V's bodies, weights), then **EDGEmat** (a worn material) | A new garment V can wear |
| "Animate the pinwheel" | **Blender** or **Unreal Engine** (a looping clip on a small rig) | An animated prop |
| "Bring in this Fab prop" | **Unreal Engine** (export, bake), then Blender, then REDbridge | A placeable object ([UE5 assets](ue-assets.html)) |

The long-term goal is to bring free and royalty-free Unreal Engine assets into the game, and in the end to prompt new mesh-based assets from nothing.

## What changes in the design

Draft 0.1 said "EDGEfab does not connect to Blender: the assistant connects to both servers". The vision changes that. **EDGEfab becomes the place where the modder prompts**, so it needs its own agent that connects to the other servers as their client. Its MCP server stays, so Claude Code and REDagent can still drive everything from outside.

```
                       ┌───────────────────────── EDGEfab (VS Code) ─────────────────────────┐
 right-click a .mesh ─►│  Workspace: 3D view · parts · looks · history · prompt bar          │
                       │                    │                                                 │
                       │                 the agent  (Claude Agent SDK, the modder's own key) │
                       └────────┬───────────┬───────────┬───────────┬───────────┬────────────┘
                          MCP client   MCP client   own client   MCP client   MCP client
                                │           │           │           │           │
                             EDGEmat     REDcode      Tripo      Blender     Unreal MCP
                            materials   files, pack  text→mesh   (opt-in)   (opt-in, UE 5.8)
                                │           │                       │           │
                                └── REDbridge (game files) ─────────┴── EDGEfab's own background
                                                                        scripts (blender --background,
                                                                        UnrealEditor-Cmd)
 EDGEfab's own MCP server ◄── Claude Code, REDagent (the same tools, from outside)
```

| Decision for F0 | Recommendation | Why |
|---|---|---|
| The agent inside EDGEfab | **Claude Agent SDK, with the modder's own Anthropic API key**, as REDagent decided | Anthropic doesn't allow claude.ai login in third-party products. The SDK connects to MCP servers over stdio and HTTP. Whether it packages cleanly inside a VS Code extension is unverified |
| Without a key | Everything still works by hand (buttons and fields), and Claude Code can drive it through EDGEfab's MCP server | AI stays optional, as in every EDGE tool |
| Two layers for Blender, and the same for Unreal | **Fixed steps run by EDGEfab's own scripts** in the background (`blender --background`, `UnrealEditor-Cmd -run=pythonscript`). Free-form work goes through the opt-in Blender MCP or Unreal MCP servers | The fixed steps are safe and give the same result every time. Free-form steps are where an AI writes code, so the modder opts in |
| Tripo | **EDGEfab's own client for Tripo's REST API**, with the modder's own key, the same way EDGEmat calls its image services | Tripo has no official MCP server (community ones exist). The REST API covers text and image to 3D, decimation, texturing and rigging. One client is easier to guard than a third-party server |
| Other text-to-mesh services | Later, behind the same interface (Meshy, Hunyuan3D, Rodin) | One service first |
| Open in EDGEfab beside Open in EDGEmat | Both stay: EDGEmat for editing a material by hand, EDGEfab for the prompt workspace that calls EDGEmat | To confirm with the owner |

### Words to parts

"The sleeves" must name something EDGEfab can change. On a game garment, a part is a **submesh** or a **mask layer** in its multilayered material (EDGEmat already maps layers). EDGEfab keeps a **part map** per mesh: names for its submeshes and mask layers. The map is made once by rendering each part highlighted, asking the model to name it, and letting the modder correct the names. It is stored with the project. The agent then resolves "sleeves" through the map, never by guessing. If no part matches, it asks.

### Licenses travel with the asset

Every asset EDGEfab brings in records where it came from and under what terms: a Fab listing and its license, a Tripo task and the modder's plan, a UE project of the modder's own. The record goes into the project's manifest and into a credits file in the packed mod. Tripo's terms for free-plan outputs are contested between its own help pages and third-party summaries: paid plans grant commercial rights, while the free plan may keep rights with Tripo or require credit. EDGEfab shows the modder the terms of the plan they use and never decides for them.

## Phases

Each phase ends with a test the owner runs, recorded in [Tests](testing.html). After it come the release gate and, from the first preview on, a release. **Objects come before clothing, and both before Unreal**, because each builds on the one before it.

| Phase | Builds | The test proves |
|---|---|---|
| **F0 Decisions** | The decisions above. A study of how working custom-item and custom-object mods are built (their file sets, not their code). Checks of REDbridge's import over a template (#5), the Claude Agent SDK inside an extension host, Tripo's API with a test key, and the Blender and Unreal background runs | The owner agrees this plan |
| **F1 Workspace** | The extension and MCP skeletons, the activity bar container, **Open in EDGEfab** on `.mesh` (REDcode's Game Assets and Project views, the Explorer, the editor's title menu, as EDGEmat's Open in EDGEmat is). The workspace: REDcode's 3D view, parts and looks, the part map, history with undo. The release workflow copied from EDGEmat (test builds as artifacts) | A game jacket opens in EDGEfab with its parts named, and stays openable from REDcode's viewer as before |
| **F2 Prompted looks** | The agent (own key) with EDGEmat's tools. The prompt bar. A new look saved to the project. **Try it**: pack, hot load (REDnode), put it on V | "Make the jacket green and the sleeves red" shows on V in the running game. **First preview release** |
| **F3 New objects** | A GLB to a placeable object (REDbridge import over a template, collision shapes, LODs). The Tripo client (text or image to 3D, decimation). Clean-up in Blender's background (scale, triangles under 65,535 per mesh, submeshes). Materials from EDGEmat. Spawn through REDnode, place with EDGEbuilder | "Make a rusty oil drum" stands in the game |
| **F4 Clothing** | Fitting to V's bodies and body mods ([design, "Clothing: fitting to the body"](design.html#clothing-fitting-to-the-body)): `fab_body`, `fab_fit`, `fab_refit`. The item record, name, icon, both bodies | "Make an old worn trenchcoat" can be worn by V from the inventory, on both bodies |
| **F5 Unreal props** | U0 to U2 of [UE5 assets](ue-assets.html): the headless export script, material mapping and baking, Nanite reduction, LODs, the license record | A free Fab prop stands in the game in minutes |
| **F6 Animation** | Simple prop animation through Blender or Unreal ("animate the pinwheel"): a small rig, a looping `.anims`, the entity that plays it. Then U4: humanoid animations retargeted in Unreal | The pinwheel turns in the game. An Unreal idle plays on an NPC through a workspot |
| **F7 Unreal characters** | U3 of [UE5 assets](ue-assets.html): characters moved onto the game's body rigs, as NPCs through REDnode's `world` and EDGEbuilder's `npc` scenes | A Mannequin- or MetaHuman-based character walks and idles as an NPC |
| **F8 Ship** | Docs and tutorials, the Nexus page (an extension: Mod Manager Download off), the EDGEkit and EDGEchat bundles | A non-coder makes an object and a garment from the docs alone |

Talking faces for Unreal characters (U5) stay research after F7.

### What EDGEfab needs from other repos

Filed as `request` issues when its phase starts, with the shape that would work:

| Repo | Need | For |
|---|---|---|
| EDGEmat | Its API and MCP tools on a mesh EDGEfab has open: list parts and layers, apply colors or a material per part, save a look; a render per part for the part map | F1, F2 |
| REDcode | The 3D view embeddable in another extension's webview (or a shared viewer package), and stable context values for `.mesh` in its views | F1 |
| REDnode | `world.spawn` of a project's object after a hot load (H2c), equip on V | F2, F3 |
| EDGEbuilder | Place an object from a project (its #1, mod archives indexed) | F3 |
| REDbridge | Anything F0's import checks find missing (collision, LODs, `.anims` import) | F3, F6 |

## How it is built and released

The same conventions as EDGEmat, so the family stays one pattern: a changelog ([Changelog](changelog.html)), every test in [Tests](testing.html), the release gate, releases started only when the owner asks, and the release workflow with Marketplace, Open VSX, npm and Nexus (copied from EDGEmat's in F1; the Nexus box once the page exists). Details in [Dev setup](dev-setup.html) once the code exists.

## Sources

- [Tripo API introduction](https://developers.tripo3d.com/en/docs/introduction): endpoints for generation, decimation, texturing, rigging; API key auth.
- Tripo on commercial use: [its guide](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) and [its help page](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially), which differ on the free plan.
- Community Tripo MCP servers: [tripo-ai-mcp-server](https://glama.ai/mcp/servers/@pasie15/tripo-ai-mcp-server), [trident-mcp](https://glama.ai/mcp/servers/mordor-forge/trident-mcp).
- [Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US) (Epic, UE 5.8).
