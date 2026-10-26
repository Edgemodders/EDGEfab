---
title: Build plan
---

# EDGE<span class="y">fab</span> build plan

**Status: proposed, 2026-10-25.** Written from the owner's vision of 2026-10-25 (below), on top of [design draft 0.1](design.html). Nothing is built. F0 agrees this plan with the owner. Until then every phase, name and order here is a proposal. Anything not yet checked is marked unverified.

## The vision

The owner, 2026-10-25:

> EDGEfab is not a mesh editor the way Blender is. It is a **full-spectrum fabricator**: it can load a mesh and do things with it, but its goal is the **game asset**. So clothing, props, characters, NPCs and everything that goes with them. It connects to MCP servers like Blender's and Unreal's for meshwork, and to AI services like Tripo for text to mesh; the ultimate goal is to prompt new assets. `.mesh` files still open REDcode's 3D viewer when clicked, and the right-click menu adds **Open in EDGEfab**, where an asset is changed in one place, by prompts.

| The unit of work | What it includes | |
|---|---|---|
| A **prop** | Mesh, materials and looks, entity, collision, LODs; placed in a scene by EDGEbuilder | First |
| A piece of **clothing** | A mesh per body, looks, item record, name, icon, layering | |
| A **character or NPC** | Body, head, hair, clothes (its appearances), rig and animations, voice, its records (who it is, how it behaves), where it stands | The big one |

Blender, Unreal, Tripo and EDGEmat are tools EDGEfab orchestrates. EDGEfab itself owns the asset: what it is made of, that its files agree, and getting it into the game.

| The modder says | EDGEfab sends it to | What comes back |
|---|---|---|
| "Make the jacket green and the sleeves red" | **EDGEmat** (colors, `mat_apply`), on the parts named "jacket" and "sleeves" | A new look on the same garment |
| "Make an old worn trenchcoat" | **Tripo** (text to 3D), then EDGEfab's Blender steps (clean, fit to V's bodies, weights), then **EDGEmat** (a worn material) | A new garment V can wear |
| "Animate the pinwheel" | **Blender** or **Unreal Engine** (a looping clip on a small rig) | An animated prop |
| "Give this NPC a deeper voice and a leather coat" | **EDGEwave** for the voice, EDGEfab's clothing for the coat | The same NPC, changed |
| "Bring in this Fab prop" | **Unreal Engine** (export, bake), then Blender, then REDbridge | A placeable prop ([UE5 assets](ue-assets.html)) |

The long-term goals: bring free and royalty-free Unreal Engine assets into the game, and prompt new assets from nothing.

## What changes in the design

Draft 0.1 said "EDGEfab does not connect to Blender: the assistant connects to both servers". The vision changes that. **EDGEfab becomes the place where the modder works on an asset by prompts**, so it needs its own agent that connects to the other servers as their client. Its MCP server stays, so Claude Code and REDagent can still drive everything from outside.

```
                         ┌──────────────────────────── EDGEfab (VS Code) ─────────────────────────────┐
 Open in EDGEfab on a ──►│  The asset: 3D view (body, clothes, animation) · parts · looks · voice ·   │
 .mesh, .ent, .app or    │  records · files that make it · checks · history · prompt bar              │
 a Character/Item record │                          │                                                 │
                         │                       the agent  (Claude Agent SDK, the modder's own key)  │
                         └──┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────────┘
                         EDGEmat   EDGEwave   REDcode    Tripo    Blender   Unreal    REDnode, EDGEbuilder
                        materials   voice   files, pack text→mesh (opt-in) (opt-in)  try it, place it
                            │                   │                    │        │
                            └──── REDbridge (game files) ────────────┴────────┴── EDGEfab's own background
                                                                                   scripts (blender --background,
                                                                                   UnrealEditor-Cmd)
 EDGEfab's own MCP server ◄── Claude Code, REDagent (the same tools, from outside)
```

| Decision for F0 | Recommendation | Why |
|---|---|---|
| What EDGEfab opens | **A game asset**, reached from any of its files: a `.mesh`, `.ent` or `.app`, or a TweakDB `Character` or `Items` record. EDGEfab finds the rest of the asset from there | The asset is the unit, not the file |
| The agent inside EDGEfab | **Claude Agent SDK, with the modder's own Anthropic API key**, as REDagent decided | Anthropic doesn't allow claude.ai login in third-party products. The SDK connects to MCP servers over stdio and HTTP. Whether it packages cleanly inside a VS Code extension is unverified |
| Without a key | Everything still works by hand (buttons and fields), and Claude Code can drive it through EDGEfab's MCP server | AI stays optional, as in every EDGE tool |
| Two layers for Blender, and the same for Unreal | **Fixed steps run by EDGEfab's own scripts** in the background (`blender --background`, `UnrealEditor-Cmd -run=pythonscript`). Free-form work goes through the opt-in Blender MCP or Unreal MCP servers | The fixed steps are safe and give the same result every time. Free-form steps are where an AI writes code, so the modder opts in |
| Tripo | **EDGEfab's own client for Tripo's REST API**, with the modder's own key, the same way EDGEmat calls its image services | Tripo has no official MCP server (community ones exist). The REST API covers text and image to 3D, decimation, texturing and rigging. One client is easier to guard than a third-party server |
| Other text-to-mesh services | Later, behind the same interface (Meshy, Hunyuan3D, Rodin) | One service first |
| Open in EDGEfab beside Open in EDGEmat | Both stay: EDGEmat for editing a material by hand, EDGEfab for the whole asset, which calls EDGEmat | To confirm with the owner |

### Words to parts

"The sleeves" must name something EDGEfab can change. On a game asset a part is a **submesh**, a **mask layer** in a multilayered material (EDGEmat already maps layers), or, on a character, an **appearance part** (head, torso, legs, a garment). EDGEfab keeps a **part map** per asset: plain names for those parts. The map is made once by rendering each part highlighted, asking the model to name it, and letting the modder correct the names. It is stored with the project. The agent then resolves "sleeves" through the map, never by guessing. If no part matches, it asks.

### Licenses travel with the asset

Every asset EDGEfab brings in records where it came from and under what terms: a Fab listing and its license, a Tripo task and the modder's plan, a UE project of the modder's own. The record goes into the project's manifest and into a credits file in the packed mod. Tripo's terms for free-plan outputs are contested between its own help pages and third-party summaries: paid plans grant commercial rights, while the free plan may keep rights with Tripo or require credit. EDGEfab shows the modder the terms of the plan they use and never decides for them.

## Phases

Each phase ends with a test the owner runs, recorded in [Tests](testing.html). After it come the release gate and, from the first preview on, a release. The order goes from small assets to large ones. **Simple textured props come first**, because they are useful alone and every later asset reuses their path into the game. **Characters and NPCs are the big effort**, split into viewing them whole, then editing them.

| Phase | Builds | The test proves |
|---|---|---|
| **F0 Decisions** | The decisions above. A study of how working custom-prop, custom-item and custom-NPC mods are built (their file sets, not their code). Checks: REDbridge's import over a template (#5), the Claude Agent SDK inside an extension host, Tripo's API with a test key, Blender and Unreal background runs, and what REDbridge can export of a whole character (entity, appearance parts, rig, animations) | The owner agrees this plan |
| **F1 Props** | The extension and MCP skeletons, the activity bar container. A model (GLB or FBX, with its textures) becomes a **placeable prop**: mesh imported over a template, textures, a material from EDGEmat (the model's own textures, or a game material), an entity, simple collision, LODs. The asset view: the prop and the files that make it, in plain words, with checks. The release workflow copied from EDGEmat. Needs EDGEbuilder's **B2c** (its #1: mod archives and the open project in Browse) | **A simple textured prop is placed in a scene with EDGEbuilder** and stays after a restart. **First preview**, if the owner wants a release here |
| **F2 Workspace and prompts** | **Open in EDGEfab** on a `.mesh`, `.ent` or `.app` (REDcode's Game Assets and Project views, the Explorer, the editor's title menu, as EDGEmat's Open in EDGEmat is). The 3D view, parts and the part map, looks, history with undo. The agent and the prompt bar, with EDGEmat's tools. **Try it**: pack, hot load (REDnode), put it on V or spawn it | "Make the jacket green and the sleeves red" shows on V in the running game |
| **F3 Generated props** | The Tripo client (text or image to 3D, decimation), clean-up in Blender's background (scale, triangles under 65,535 per mesh, submeshes), then F1's path | "Make a rusty oil drum" ends up in an EDGEbuilder scene |
| **F4 Clothing** | Fitting to V's bodies and body mods ([design, "Clothing: fitting to the body"](design.html#clothing-fitting-to-the-body)): `fab_body`, `fab_fit`, `fab_refit`. The item record, name, icon, both bodies | "Make an old worn trenchcoat" can be worn by V from the inventory, on both bodies |
| **F5 Characters, whole** | Open in EDGEfab on an NPC: from its `Character` record, entity or appearance, EDGEfab assembles **the full character**: body, head, hair and clothes from its appearance parts, on its rig, playing its animations (idle and others from its animation sets), its **voice** lines listed and playable (through EDGEwave), its records in plain words (name, affiliation, behaviour). Read-only | Click an NPC asset and see the whole character move and hear it speak, in EDGEfab |
| **F6 Characters, edited** | Every aspect changed by orchestrating the EDGE tools: looks (EDGEmat), clothes swapped or made (F4), hair and head from the game's parts, animations (Blender, Unreal), voice (EDGEwave), records (TweakDB through TweakXL). A new NPC made from an existing one. Placed through EDGEbuilder's `npc` scene kind (its B3c, on REDnode's `world.load`) | "Make a new fixer from this one, in a leather coat, with a deeper voice" stands in a scene in the game |
| **F7 Animation** | Animated props through Blender or Unreal ("animate the pinwheel"): a small rig, a looping `.anims`, the entity that plays it. Humanoid animations retargeted in Unreal (U4 of [UE5 assets](ue-assets.html)), played through workspots | The pinwheel turns in the game. An Unreal idle plays on an NPC |
| **F8 Unreal assets** | U1 to U3 of [UE5 assets](ue-assets.html): the headless export script, material mapping and baking, Nanite reduction, the license record (props, through F1's path), then characters moved onto the game's body rigs (through F5 and F6's path) | A free Fab prop stands in a scene in minutes. A Mannequin- or MetaHuman-based character walks and idles as an NPC |
| **F9 Ship** | Docs and tutorials, the Nexus page (an extension: Mod Manager Download off), the EDGEkit and EDGEchat bundles | A non-coder makes a prop, a garment and an NPC from the docs alone |

Talking faces for Unreal characters (U5) stay research. F8's props can move up right after F1 if the owner wants Unreal sooner, since they reuse F1's path.

### What EDGEfab needs from other repos

Filed as `request` issues when its phase starts, with the shape that would work:

| Repo | Need | For |
|---|---|---|
| EDGEbuilder | Its B2c: Browse indexes mod archives and the open project, so EDGEfab's props can be placed (its #1, open since 2026-10-16) | F1 |
| EDGEmat | Its API and MCP tools on an asset EDGEfab has open: list parts and layers, apply colors or a material per part, save a look; a render per part for the part map | F1, F2 |
| REDcode | The 3D view embeddable in another extension's webview (or a shared viewer package), with several meshes on one rig and animation playback; stable context values for `.mesh`, `.ent` and `.app` in its views | F2, F5 |
| REDbridge | Export of a whole character: an entity's or appearance's parts, with the rig and animation sets, to GLB. Anything F0's checks find missing (collision, LODs, `.anims` import) | F1, F5, F7 |
| EDGEwave | A character's voice lines: list them, play them, and replace them in a voice the modder chooses | F5, F6 |
| REDnode | `world.spawn` and `world.load` of a project's prop or NPC after a hot load (H2c), equip on V | F2, F6 |
| EDGEbuilder | Its B3c: the `npc` scene kind | F6 |

## How it is built and released

The same conventions as EDGEmat, so the family stays one pattern: a changelog ([Changelog](changelog.html)), every test in [Tests](testing.html), the release gate, releases started only when the owner asks, and the release workflow with Marketplace, Open VSX, npm and Nexus (copied from EDGEmat's in F1; the Nexus box once the page exists). Details in [Dev setup](dev-setup.html) once the code exists.

## Sources

- [Tripo API introduction](https://developers.tripo3d.com/en/docs/introduction): endpoints for generation, decimation, texturing, rigging; API key auth.
- Tripo on commercial use: [its guide](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) and [its help page](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially), which differ on the free plan.
- Community Tripo MCP servers: [tripo-ai-mcp-server](https://glama.ai/mcp/servers/@pasie15/tripo-ai-mcp-server), [trident-mcp](https://glama.ai/mcp/servers/mordor-forge/trident-mcp).
- [Unreal MCP in Unreal Editor](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor?lang=en-US) (Epic, UE 5.8).
- [EDGEbuilder design](https://edgemodders.github.io/EDGEbuilder/design.html): B2c Mod assets, B3c NPCs and scenes.
