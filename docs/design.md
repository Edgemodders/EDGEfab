# EDGE<span class="y">fab</span> design

EDGEfab makes new things for Cyberpunk 2077: clothes and objects, from a 3D model to something that works in the game. A modder brings a model from Blender or an AI model service; EDGEfab guides it into a finished asset, with its materials, its looks, the files the game needs to know it exists, and a quick way to try it in the game. Or the modder asks REDagent or Claude: "make this model a jacket V can wear".

**Status: draft 0.1, a starting brief.** Written on 2026-10-16 by the EDGEmat session, from the custom-asset goals the owner set for the EDGE platform ([EDGEmat design, "Custom assets"](https://edgemodders.github.io/EDGEmat/design.html#custom-assets-from-a-model-to-the-game)) and from what EDGEmat's M0 learned against the real game. It is a brief for EDGEfab's own first session, not agreed decisions: everything marked *open* or *unverified* is for that session to settle with the owner. Next: F0.

## Mission

EDGE brings modding to everyone, especially non-coders: easy, fun and fast. A new item today means many small files that must agree with each other: the mesh, materials, appearances, an entity, a factory entry, an ArchiveXL file, a TweakXL record, localized names, an icon. EDGEfab's job is that nobody has to know that list.

| Rule | In practice |
|---|---|
| Start from what the modder has | A model file, or an existing game item to copy. Not a list of file types |
| Plain words first, details one click away | "A jacket for both body types, two looks, called *Neon Shell*" before `entityName`, `.app` and `partsOverrides` |
| Everything the UI does, an assistant can do | Each feature ships in the UI and the MCP server together |
| Try it in seconds | One action packs, deploys and shows the result in the running game |

## What EDGEfab owns, and what it does not

EDGEfab is the orchestrator of asset creation. It owns the step no other EDGE tool owns, "make it a game thing", and calls the others for the rest. Agreed direction (owner, 2026-10-16); the boundaries are for F0 to confirm with the sibling designs.

| Job | Owner | EDGEfab's part |
|---|---|---|
| Making the 3D model | Blender, or an AI model service (opt-in, as EDGEwave does for voice). EDGE does not build a 3D modeler | Takes the result |
| Importing a model: geometry to `.mesh`, images to `.xbm` | REDbridge (`project.import`), through REDcode | Calls it |
| Rigging and fitting clothing to the player | Blender with the community WolvenKit Blender add-on today | Guides it; an "Edit in Blender" round trip is a REDcode candidate |
| Materials from the model's textures, recolors, layered materials | **EDGEmat** | Calls EDGEmat's API and MCP tools |
| A mesh's appearances (its **looks**: which material each submesh uses) | **EDGEmat** (Looks editor) | Calls it |
| **The game asset**: entity, item appearances (`.app`), factory and `.xl`, TweakXL item record, localized text, inventory icon, garment layering; checked against each other | **EDGEfab** | Its core |
| Viewing a mesh and switching its looks | REDcode's viewer, with materials from EDGEmat | Embeds or opens it |
| Placing an object in the world | EDGEbuilder | Hands the object over |
| Packing, deploying, hot loading, trying in game | REDcode (pack), REDdeck (deploy), REDnode (hot load, spawn, equip) | One "Try it" action that calls them |
| Generic editing of any file | REDcode's CR2W editor | Opens files there for raw edits |

## What a game asset is made of

From EDGEmat's M0 check against the game (confirmed rows) and community practice (unverified rows). F0 checks the unverified ones against working mods and the game.

| Piece | What it is | Check |
|---|---|---|
| The chain for the game's own clothing | Item record (TweakDB: `entityName`, `appearanceName`, `displayName`) → factory row (`base\gameplay\factories\items\clothing.csv`) → a slot's root entity → its `appearances` row named `appearanceName` + `&Male` or `&Female` → a per-item `.app` appearance → parts `.ent` and `partsOverrides` setting the mesh appearance → `.mesh` appearance → materials → setup | Confirmed 2026-10-15, EDGEmat spec section 1 |
| Body types | Separate meshes per body type (`_pma_`, `_pwa_`); an item can even use a different garment per body type | Confirmed (EDGEmat M0) |
| A new item, the modern way | An ArchiveXL `.xl` file that registers a factory CSV and localization, and a TweakXL record that creates the item | Community practice; unverified here. The `.xl` format seen in an installed mod: `factories`, `localization`, `overrides: tags` |
| A world object | A mesh with an appearance placed by a streaming sector (`worldMeshNode`), or an entity; EDGEbuilder bakes sectors | From EDGEbuilder's design |
| Replacing a game `.mlsetup` in place | Has no effect without the Material Texture Override mod. New assets use their own paths, so they are not affected | Confirmed 2026-10-15 (EDGEmat spec section 6) |
| Load order | `archive\pc\mod\modlist.txt`, written by REDdeck, lists archives first in its order; the earlier archive wins | Confirmed behavior with REDdeck's fix, 2026-10-15 |

## Shape

The same shape as EDGEmat, so the family stays one pattern.

| Part | What it is |
|---|---|
| `extensions/edgefab` | The VS Code extension, id `edgemodders.edgefab`, a first-class EDGE extension with its own **activity bar container** (icon: [`tools/brand/activity.svg`](https://github.com/Edgemodders/EDGEfab/blob/main/tools/brand/activity.svg), the family's HUD brackets around a cube, one color, painted by the REDnode HUD theme). Views: the assets in the open project, "new asset" guides, checks |
| `extensions/edgefab/src/core` | Everything that is not UI. **No VS Code imports**, so the MCP server bundles it |
| `packages/edgefab-mcp` | The MCP server over stdio |
| REDbridge | Every game file read and write, as a separate process. Needs from it go to REDbridge as `request` issues |

| Relationship | How |
|---|---|
| REDcode | Optional but expected. Through `REDcodeApi` version 1 (`edgemodders.redcode-cyberpunk`): game folder, bridge, open project, pack. Never imports its code |
| EDGEmat | Through EDGEmat's API (planned in EDGEmat M4 and M5: `renderMaterials`, materials from a textured model, looks) and its MCP tools |
| REDdeck, REDnode, EDGEbuilder | Through their APIs and MCP servers; requests as issues |
| EDGEkit, EDGEplugin | Bundled, and taught to the assistant, once released |

## The MCP server

Intent, not plumbing. Proposed names, settled in F0:

| Tool | Does |
|---|---|
| `fab_new` | Starts a new asset from a model or from a game item to copy: an object, or clothing for a slot and body types |
| `fab_describe` | An asset in plain words: what it is, its looks, what is missing |
| `fab_check` | Checks the asset's files against each other and names what is wrong in plain words |
| `fab_try` | Packs, deploys, hot-loads, and spawns the object or puts the clothing on V |

## Phases (proposed)

For the first session to agree with the owner. Objects come before clothing, because clothing needs rigging.

| Phase | Builds | The test proves |
|---|---|---|
| **F0 Decisions** | Study how working custom-item and custom-object mods are built (their file sets, not their code), check REDbridge's mesh import for a new asset, agree the boundaries with EDGEmat and REDcode, the phases | The owner agrees the design |
| **F1 Object** | Extension and MCP skeletons, the activity bar container. A GLB becomes a placeable object with its textures | A model from Blender or an AI service shows in the game, placed with EDGEbuilder |
| **F2 Try it** | Pack, deploy, hot load, spawn | A change to the object shows in the running game without a restart |
| **F3 Clothing** | An item for a slot and both body types, its looks, name and icon; rigging through Blender | A new jacket V can wear, with two looks, from the inventory |
| **F4 Ship** | Docs, the MCP package, Open VSX and Marketplace, the EDGEkit bundle | A non-coder makes an object and a garment from the docs alone |

## Open questions

| Question | Notes |
|---|---|
| Mesh import for a new asset | WolvenKit's importer appears to import over an existing `.mesh` ("keeps the replaced file's settings"). A new asset may need a template mesh. Requested from REDbridge |
| The modern recipe for a new item | ArchiveXL dynamic appearances and TweakXL records are community practice; F0 studies working mods and writes the recipe in its own words |
| Rigging | Clothing must be weighted to the player rig and fit both body types. Blender today; what EDGE can automate is open |
| AI model services | Opt-in, with the modder's own account, as EDGEwave does for voice. Which services, and whether textures come back usable |
| Hot loading | RED Hot Tools first (unverified on the dev PC), else an EDGE hot loader in REDnode. See EDGEmat's design, "Hot-loading archives" |
| The shared viewer and bridge client | Shared packages for the EDGE tools later; EDGEfab copies or depends on REDcode's until then |

## Sources

| Source | What it gave |
|---|---|
| [EDGEmat design](https://edgemodders.github.io/EDGEmat/design.html) and [behavior spec](https://edgemodders.github.io/EDGEmat/design/behavior.html) | The custom-asset goals, the ownership split, everything confirmed against the game in EDGEmat's M0 |
| [EDGEbuilder design](https://edgemodders.github.io/EDGEbuilder/design.html) | World objects, sectors, runtime appearance switching |
| [REDcode API](https://edgemodders.github.io/REDcode/api.html) | `REDcodeApi` version 1 |
