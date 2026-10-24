# EDGE<span class="y">fab</span> design

EDGEfab makes new things for Cyberpunk 2077: clothes and objects, from a 3D model to something that works in the game. A modder brings a model from Blender or an AI model service; EDGEfab guides it into a finished asset, with its materials, its looks, the files the game needs to know it exists, and a quick way to try it in the game. Or the modder asks REDagent or Claude: "make this model a jacket V can wear".

**Status: draft 0.1, a starting brief.** Written on 2026-10-16 by the EDGEmat session, from the custom-asset goals the owner set for the EDGE platform ([EDGEmat design, "Custom assets"](https://edgemodders.github.io/EDGEmat/design.html#custom-assets-from-a-model-to-the-game)) and from what EDGEmat's M0 learned against the real game. It is a brief for EDGEfab's own first session, not agreed decisions: everything marked *open* or *unverified* is for that session to settle with the owner. **Extended 2026-10-19** by the EDGEmat session at the owner's request: [clothing fitted to the body](#clothing-fitting-to-the-body), [Blender and Blender MCP](#blender-and-blender-mcp), and materials from EDGEmat's new M4 Make. Next: F0.

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
| Making the 3D model | Blender, or an AI model service (opt-in, as EDGEwave does for voice). EDGE does not build a 3D modeler. An assistant can model in Blender through a Blender MCP server ([below](#blender-and-blender-mcp)) | Takes the result |
| Importing a model: geometry to `.mesh`, images to `.xbm` | REDbridge (`project.import`), through REDcode | Calls it |
| Rigging and fitting clothing to the player | Blender with the community WolvenKit Blender add-on, which carries body dummies and refitters | Guides it, and gives the body to fit to ([below](#clothing-fitting-to-the-body)). "Edit in Blender" is in REDcode 0.10.0 |
| Materials: from the model's textures, generated from words, or picked from the game; recolors, layered materials | **EDGEmat** | Calls EDGEmat's API and MCP tools ([below](#materials-from-edgemat)) |
| A mesh's appearances (its **looks**: which material each submesh uses) | **EDGEmat** (Looks editor) | Calls it |
| **The game asset**: entity, item appearances (`.app`), factory and `.xl`, TweakXL item record, localized text, inventory icon, garment layering; checked against each other | **EDGEfab** | Its core |
| Viewing a mesh and switching its looks | REDcode's viewer, with materials from EDGEmat | Embeds or opens it |
| Placing an object in the world | EDGEbuilder | Hands the object over |
| Packing, deploying, hot loading, trying in game | REDcode (pack), EDGEdeck (deploy), REDnode (hot load, spawn, equip) | One "Try it" action that calls them |
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
| Load order | `archive\pc\mod\modlist.txt`, written by EDGEdeck, lists archives first in its order; the earlier archive wins | Confirmed behavior with the fix in EDGEdeck (then REDdeck), 2026-10-15 |

## Clothing: fitting to the body

**A key goal** (owner, 2026-10-19): model clothes and fit them to the character's body, for each body type, then give them materials, so a modder who is not a 3D artist can make a garment V wears. Fitting needs a body to fit to: a "dummy" of each body type.

### The bodies in the game

Seen in the game files on 2026-10-19, through REDbridge on the dev PC (game 2.31):

| Body | Code in mesh names | Base mesh | Notes |
|---|---|---|---|
| V, masculine | `pma` | `base\characters\common\player_base_bodies\player_man_average\t0_000_pma_base__full.mesh` | |
| V, feminine | `pwa` | `base\characters\common\player_base_bodies\player_female_average\t0_000_pwa_base__full.mesh` | Also `t0_000_pwa_base__full_breast_big.mesh` and `_breast_small.mesh`, likely the character creator's choice (unverified) |
| NPC bodies | `ma`, `wa`, `mb` and `mba`, `mf`, `ws`, `mm` | Folders under `base\characters\common\base_bodies\`: `man_average`, `woman_average`, `man_big`, `man_fat`, `woman_small`, `man_massive` | For NPC clothing only |

Garment meshes in the game's `garment` folders, by body code: `ma` 504, `wa` 389, `pwa` 166, `pma` 163, `mb` 117, others under 30 each (1,522 meshes). So a garment V wears is at least two meshes, one per body. Both player bodies also have `fpp` folders (first-person meshes); whether new garments need first-person variants is unverified.

### The body dummies

**Decided with the owner on 2026-10-19:** the game's own bodies come first, pulled straight into EDGEfab; modded bodies are supported too, since many players use one.

| Order | Source | How EDGEfab gets it |
|---|---|---|
| 1 | **The game's own bodies**, V's `pma` and `pwa` (the table above) | Exported to GLB from the game through REDbridge, as the modding wiki's refit guide does with WolvenKit. Exactly V's body, and no add-on needed. Whether the export keeps the rig is unverified |
| 2 | **Modded bodies** (Hyst, Lush, Solo, VTK and others) | Read from the body mod's own `.archive` in the game's mod folder through REDbridge (`archive.openMod`, `archive.extractFromMod`, which EDGEmat already uses), then exported the same way. Which game files each body mod replaces, and how EDGEfab spots an installed one, is for F0 to find (unverified) |
| 3 | The add-on's rigs | A fallback, inside Blender ([below](#wolvenkits-blender-add-on)) |

A garment fitted to one body reaches the others in two ways: fitted again to that body's own mesh (exact, more work), or moved by the add-on's refitters (quick, for the bodies it knows). Which is the default, and how body-mod variants ship (community practice uses ArchiveXL, unverified), is open.

### WolvenKit's Blender add-on

The owner's lead: the dummies used in Blender come from the community tools. Confirmed in **WolvenKit's Blender add-on**, the Cyberpunk 2077 IO Suite ([github.com/WolvenKit/Cyberpunk-Blender-add-on](https://github.com/WolvenKit/Cyberpunk-Blender-add-on), version 2.0.0, 2026-06-07):

| It carries | Use for EDGEfab |
|---|---|
| Rigged bodies in `resources/rigs`: `man_base_full.glb`, `woman_base_full.glb`, `man_big_full.glb`, `man_fat_full.glb`, and named characters (Judy, Panam, Jackie and others) | Dummies to model and fit around. Whether `man_base` and `woman_base` match V's `pma` and `pwa` exactly is unverified |
| Lattice refitters in `resources/refitters`, chosen in its Mesh Tools panel (the "AKL autofitter", from AllKnowingLion's work) | Moves a fitted garment to another body: `VanillaFemToMasc` and `VanillaMascToFem` between V's bodies, the feminine body's big and small chest, and popular body mods (Hyst EBB and RB, Lush, Solo Ultimate, Adonis, Gymfiend, Fryja, Elegy, Flat Chest) |
| Garment support on import and export | Layering: how a garment squashes under the one worn over it. The modding wiki calls it experimental |

The add-on's license is unverified (Blender add-ons are usually GPL). EDGEfab uses it inside Blender, as a tool the modder installs, and never copies its code or data.

### Fitting, step by step

Proposed for F3, unverified until tried:

| Step | How | Who |
|---|---|---|
| 1. A body to fit to | V's `pma` or `pwa` body from the game as a GLB, or an installed body mod's body | EDGEfab (`fab_body`) |
| 2. The garment | Modeled around the body in Blender: by hand, by an assistant through a Blender MCP server, or from an AI model service | Blender |
| 3. Fit | Sits on the body without poking through | EDGEfab's Blender steps (`fab_fit`), or by hand in Blender |
| 4. Weights | Copied from the body to the garment (Blender's Data Transfer), so it moves with V's rig | EDGEfab's Blender steps (`fab_fit`) |
| 5. The other body | Fitted again to that body, or the add-on's `VanillaFemToMasc` or `VanillaMascToFem` refitter, then checked | EDGEfab's Blender steps (`fab_refit`) |
| 6. Body mods | Variants: fitted to the body mod's own mesh, or moved by the add-on's refitters | Blender; EDGEfab gives the body |
| 7. Layering | Garment support | Blender, with the add-on |
| 8. Materials | Generated or picked from the game, one submesh per part ([below](#materials-from-edgemat)) | EDGEmat |
| 9. Into the game | A mesh per body, entity, `.app`, item record, name, icon; then Try it | EDGEfab |

### Materials from EDGEmat

EDGEfab never makes materials itself. EDGEmat's **M4 Make** (moved ahead of its preview on 2026-10-19 for this) gives two routes, in EDGEmat's UI, through its API, and through its MCP tools ([EDGEmat design, "Generate a material"](https://edgemodders.github.io/EDGEmat/design.html#generate-a-material)):

| Route | What EDGEmat does | MCP |
|---|---|---|
| A new material | From words ("brown leather") through an AI image service the modder chose, with their own key, or from a photo. EDGEmat makes it seamless, derives bumps and shine, and writes a textured `.mi` | `mat_generate`, `mat_from_image` |
| A game material | A surface and color from the game's library (a one-layer setup, which fits any UVs), or a game `.mi` that tiles | `mat_find`, `mat_templates`, `mat_colors` |
| Either, onto the mesh | Puts it on the mesh's submeshes in a look; several looks make variants | `mat_apply` |

So "make a red leather jacket" is: model and fit in Blender, then `mat_colors` for the nearest red on a leather surface (or `mat_generate` for something no surface has), then `mat_apply`, then `fab_try`.

## Blender and Blender MCP

An assistant can drive Blender through an MCP server, so "model a cropped jacket around V's body" can happen in Blender without the modder touching it. Found on 2026-10-19; neither server is tried yet.

| Server | Who | What it offers | Notes |
|---|---|---|---|
| [Blender Lab's MCP server](https://www.blender.org/lab/mcp-server/) | Blender's own developers | A plain-language interface to Blender's Python API | Add-on 1.0.3, Blender 5.1 or later. Installs as an `.mcpb` bundle or from source |
| [mcp-for-blender](https://github.com/ahujasid/blender-mcp) (was `blender-mcp`) | Community, MIT, the most used | Runs Python in Blender, renders views (`look`), scene info, `generate_3d` (Tripo, Hunyuan3D, Hyper3D Rodin, Meshy), assets from Poly Haven, Sketchfab and Poly Pizza | `uvx mcp-for-blender`. Sends telemetry unless turned off with its own tool |

**Both run on the modder's PC**, not on the internet: an add-on inside Blender, and a small server that the assistant's app (such as Claude Code) starts, talking to each other on the PC. What leaves the PC: the conversation with the AI model, including scene details and the code it writes (unless a local model is used, which Blender Lab mentions); the online tools of mcp-for-blender (`generate_3d`, Poly Haven, Sketchfab, Poly Pizza), only when called; and its telemetry, unless turned off.

**How it fits.** EDGEfab does not connect to Blender. The assistant connects to both servers: it models or edits in Blender and exports a GLB, then asks EDGEfab's MCP server to make it a game asset and EDGEmat's for materials. EDGEchat, the Claude Code plugin for the EDGE tools, could list a Blender server as a recommended companion.

| Caveat | What it means |
|---|---|
| Safety | Both run Python that the AI writes inside Blender, without guards. Blender Lab suggests a virtual machine or a PC without sensitive data. EDGE's docs say so plainly |
| Telemetry | mcp-for-blender sends it unless turned off; EDGE's docs say how |
| Repeatable steps | Freshly written code each time is hard to trust. Answered by EDGEfab's own Blender steps ([below](#two-layers-edgefabs-own-blender-steps-and-a-blender-mcp-server)) |
| Model quality | AI-made models are often heavy, with messy geometry and lighting baked into the textures; they need cleaning before the game (general experience, untested here) |
| Clothing | The add-on's refitters and garment support are Blender operators, so an assistant could run them through a Blender MCP server (unverified) |

### Two layers: EDGEfab's own Blender steps, and a Blender MCP server

**Agreed with the owner on 2026-10-19** as the proposed approach, for F0 to confirm.

**Can the servers be bundled?** Not as they are, for three reasons. An MCP server is started by the assistant's app from its server list, not by EDGEfab; EDGEfab or EDGEchat can only put it on that list. The server only relays to an add-on inside a running Blender, and EDGE does not bundle Blender (large, GPL, and the modder's own). And mcp-for-blender is Python, while EDGEfab is Node. So EDGEfab installs and registers instead of bundling.

| Layer | What | How it runs | Why |
|---|---|---|---|
| **1. EDGEfab's own Blender steps** | The fixed steps of clothing: load a body, fit, copy weights, refit to another body, garment support, export GLB | EDGEfab starts Blender in the background (`blender --background`) with its own script, as REDcode's Edit in Blender starts Blender. No AI-written code runs. Exposed as named MCP tools (`fab_body`, `fab_fit`, `fab_refit`) and as buttons | Safe, repeatable (the same steps give the same result), and no third-party server needed. Most modders only need this layer |
| **2. A Blender MCP server** | Free-form modeling by an assistant: "model a cropped jacket around V's body" | Opt-in. A **Set Up Blender for AI** command finds Blender, installs the add-ons (WolvenKit's IO Suite, the MCP add-on), and registers the server with Claude Code (or EDGEchat lists it). A visible Blender, so the modder watches the work | The AI writes code there, so it stays a choice, with the safety and telemetry notes above |

| Part | Bundled with EDGEfab? |
|---|---|
| EDGEfab's Blender script (layer 1) | Yes, its own MIT code. It calls WolvenKit's add-on operators when the add-on is installed, never copies them |
| WolvenKit's Blender add-on | No. Installed into the modder's Blender on request, from its own release (license unverified, likely GPL) |
| mcp-for-blender | No. Installed on request with `uvx mcp-for-blender`, a one-time download the modder agrees to. MIT, so bundling stays possible later |
| Blender Lab's server | No. Installed on request (license unverified) |
| Blender | No. EDGEfab finds an installed Blender, or points the modder to blender.org |

Unverified until F0 and F3: whether Blender in the background runs WolvenKit's add-on operators; whether EDGEfab can reuse the Blender that REDcode's Edit in Blender finds (through `REDcodeApi`, or its own search); and which Blender versions the add-ons need (Blender Lab's needs 5.1 or later).

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
| EDGEmat | Through EDGEmat's API and its MCP tools. Planned in EDGEmat **M4 Make**: materials from a textured model, Generate a material, game materials on a new mesh, the Looks editor; and **M5 Preview**: `renderMaterials` (EDGEmat's roadmap, revised 2026-10-19) |
| EDGEdeck, REDnode, EDGEbuilder | Through their APIs and MCP servers; requests as issues |
| EDGEkit, EDGEchat (the Claude Code plugin) | Bundled, and taught to the assistant, once released |

## The MCP server

Intent, not plumbing. Proposed names, settled in F0:

| Tool | Does |
|---|---|
| `fab_new` | Starts a new asset from a model or from a game item to copy: an object, or clothing for a slot and body types |
| `fab_describe` | An asset in plain words: what it is, its looks, what is missing |
| `fab_check` | Checks the asset's files against each other and names what is wrong in plain words |
| `fab_try` | Packs, deploys, hot-loads, and spawns the object or puts the clothing on V |
| `fab_body` | Exports a body as a GLB, to model and fit a garment around: V's masculine or feminine body from the game, or the body of an installed body mod |
| `fab_fit` | Fits a garment to a body in Blender, run in the background by EDGEfab's own script: fit, copy the body's weights, garment support |
| `fab_refit` | Moves a fitted garment to another body: fitted again to that body's mesh, or through WolvenKit's add-on refitters |

## Phases (proposed)

For the first session to agree with the owner. Objects come before clothing, because clothing needs rigging. F1 and F3 need materials on new meshes from **EDGEmat M4 Make**.

| Phase | Builds | The test proves |
|---|---|---|
| **F0 Decisions** | Study how working custom-item and custom-object mods are built (their file sets, not their code), check REDbridge's mesh import for a new asset, agree the boundaries with EDGEmat and REDcode, the phases | The owner agrees the design |
| **F1 Object** | Extension and MCP skeletons, the activity bar container. A GLB becomes a placeable object with its textures, or with a material from EDGEmat | A model from Blender or an AI service shows in the game, placed with EDGEbuilder. A simple prop that Claude makes in Blender through a Blender MCP server, with a material Claude asks EDGEmat for, gets there too |
| **F2 Try it** | Pack, deploy, hot load, spawn | A change to the object shows in the running game without a restart |
| **F3 Clothing** | An item for a slot and both body types, its looks, name and icon. [Fitting to the body](#clothing-fitting-to-the-body): V's bodies and modded bodies as dummies (`fab_body`); fitting, weights and refitting by EDGEfab's own Blender steps (`fab_fit`, `fab_refit`); free-form modeling through a Blender MCP server, set up by Set Up Blender for AI. Materials from EDGEmat | A new jacket V can wear, with two looks, from the inventory, on both bodies. One of them modeled and fitted by Claude in Blender, with a generated material and a game material |
| **F4 Ship** | Docs, the MCP package, Open VSX and Marketplace, the EDGEkit bundle | A non-coder makes an object and a garment from the docs alone |

## Open questions

| Question | Notes |
|---|---|
| Mesh import for a new asset | WolvenKit's importer appears to import over an existing `.mesh` ("keeps the replaced file's settings"). A new asset may need a template mesh. Requested from REDbridge (#5), and shipped in REDbridge 0.9.0 (2026-10-16): `project.import` takes a `template` (a game path or a `.mesh` on disk) and imports the GLB over it. Whether the game loads such meshes as expected is untested |
| The modern recipe for a new item | ArchiveXL dynamic appearances and TweakXL records are community practice; F0 studies working mods and writes the recipe in its own words |
| Rigging | Clothing must be weighted to the player rig and fit both body types. Blender with WolvenKit's add-on today (its refitters, garment support); what EDGE can automate, and whether through named Blender operations, is open ([Fitting](#fitting-step-by-step)) |
| The body dummies | **Decided 2026-10-19:** the game's own bodies first, exported through REDbridge. Open: whether the export keeps the rig, and whether V's breast-size variants and first-person meshes need their own garment variants |
| Body mods | **Decided 2026-10-19:** supported. Open: which files each body mod replaces, how EDGEfab spots the installed ones, fitting to the mod's own mesh or refitting, and how variants are packaged |
| A Blender MCP server | Blender Lab's or mcp-for-blender, or both, for layer 2; tried in F1 |
| AI model services | Opt-in, with the modder's own account, as EDGEwave does for voice. Which services, and whether textures come back usable. mcp-for-blender's `generate_3d` already reaches Tripo, Hunyuan3D, Hyper3D Rodin and Meshy |
| Hot loading | Settled in REDnode (its issue #12, still open for refreshing world objects): `archives.reload` and the MCP tool `archives_reload` swap a changed archive into the running game through RED Hot Tools (REDnode 0.26.0 on), and refresh the clothing V wears (0.26.20 on). The Edgemodders build of RED Hot Tools (`v1.3.0+edgemodders.1`, fork CyberbuildsAI/cp2077-red-hot-tools) fixes swaps of archives with capitals in their names. Objects already in the world are not refreshed yet: that is REDnode's H2c, planned. See EDGEmat's design, "Hot-loading archives" |
| The shared viewer and bridge client | Shared packages for the EDGE tools later; EDGEfab copies or depends on REDcode's until then |

## Sources

| Source | What it gave |
|---|---|
| [EDGEmat design](https://edgemodders.github.io/EDGEmat/design.html) and [behavior spec](https://edgemodders.github.io/EDGEmat/design/behavior.html) | The custom-asset goals, the ownership split, everything confirmed against the game in EDGEmat's M0 |
| [EDGEbuilder design](https://edgemodders.github.io/EDGEbuilder/design.html) | World objects, sectors, runtime appearance switching |
| [REDcode API](https://edgemodders.github.io/REDcode/api.html) | `REDcodeApi` version 1 |
| [WolvenKit's Blender add-on](https://github.com/WolvenKit/Cyberpunk-Blender-add-on) (2.0.0) | The body rigs, the refitters and their targets, garment support. Read: its file list and its list of refitter names; nothing copied |
| The modding wiki's [refitting guide](https://wiki.redmodding.org/cyberpunk-2077-modding/modding-guides/items-equipment/recolours-and-refits/r-and-r-refitting-step-by-step) | Fitting to a base body exported from the game; the add-on's autofitter; garment support marked experimental |
| [Blender Lab's MCP server](https://www.blender.org/lab/mcp-server/), [mcp-for-blender](https://github.com/ahujasid/blender-mcp) | What each Blender MCP server offers, and their safety notes |
| The game, through REDbridge (2026-10-19) | The body codes, base mesh paths and garment counts above |
