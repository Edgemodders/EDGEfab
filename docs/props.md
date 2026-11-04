---
title: Props, the parallel proposal
---

# Props: the <span class="y">parallel</span> proposal

**Status: kept for reference, not the plan.** A session that ran beside the one that agreed the first build wrote this "Version 1: props" design with the owner, 2026-10-27 to 30, on the branch `claude/dreamy-sagan-606x6l`. When that branch was merged into main on 2026-11-04, its design page was replaced by main's, so its text is kept here unchanged, as written then. **The [build plan](plan.html#asked-in-a-parallel-session-placed-after-f1-2026-10-27-to-30) decides** which parts are in F1, which come later and which are left out. Where the two differ (its own Library and Update the Game, its Desk storage, its game paths, no collision, its steps V0 to V10), the plan wins. Its Tripo facts are from Tripo's v2 docs; recheck them on v3.

**Set by the owner on 2026-10-27.** The first version of EDGEfab makes **game props**: static objects that EDGEbuilder places in the world. A prop comes from a 3D file the modder imports, or from a prompt to a text-to-3D service (Tripo first). It waits on the **Desk** while the modder works on it. Then it goes into the **Library**, where EDGEbuilder finds it in the running game, or into the open REDcode project. Everything else in the [build plan](plan.html) comes after version 1: clothing, characters, animation, Unreal, and EDGEfab's own agent. Version 1 brings the plan's F1 (props) and F3 (generated props) together, with the views below. Choices marked *proposed* are for the owner to confirm. Facts not yet checked are marked unverified; V0 checks them ([build plan](#build-plan-for-version-1)).

## The goal

> A modder who has never opened WolvenKit thinks of a prop they need and describes it: "a battered olive military crate with stencils". Tripo makes it, already in named parts (lid, body, latches, handles), and a planner gives each part a material that works in the game, which the modder checks before it is made. They file the crate in their Library under Props › Crates and place it in a scene with EDGEbuilder in the running game. A GLB file they already have takes the same path.

**Describing a prop is the main way in.** Importing a model is the other. Both end in the same place: named parts, a material per part, the Library.

| In version 1 | Not in version 1 |
|---|---|
| Static props: a mesh, its textures and material, one look, LODs | Clothing, weapons, NPCs, vehicles. They can be found and viewed in Game Assets, not edited |
| Import a GLB or glTF with its textures | FBX, OBJ and `.blend`, which need Blender's background ([Blender layer 1](design.html#two-layers-edgefabs-own-blender-steps-and-a-blender-mcp-server)); next after version 1 |
| Text to 3D through Tripo, in takes; Tripo's own edits on a take | Other services (Meshy, Hunyuan3D, Rodin). Image to 3D: the same task flow with an uploaded image, so it can follow soon after |
| The Desk, the Library, Game Assets with kind filters | |
| Changing a prop or its parts: size and placement on the asset page, by hand in Blender, by an assistant through a Blender MCP server, or by Tripo; each change a version that can be undone ([below](#changing-a-prop-on-the-page-in-blender-by-an-assistant)) | A Blender bundled with EDGEfab. EDGEfab finds the modder's own |
| Add to Project; the Library in the game for EDGEbuilder | Collision: V walks through a version 1 prop, and the asset page says so. Animated props (plan F7a) |
| A prop in named parts (Tripo's segmentation), and a **material planner** that picks a material for each part, made and put on by EDGEmat ([below](#parts-and-materials-the-planner)) | |
| An MCP tool for every action | EDGEfab's own agent and prompt bar (plan F2). Claude Code drives version 1 through EDGEfab's MCP server. The material planner is one AI call, not the agent |

## The views

EDGEfab's activity bar container, top to bottom. The same order and idea as EDGEmat's Desk, Library and Find.

| View | What it holds | Built like |
|---|---|---|
| **Desk** | The props being worked on, not in a project yet | EDGEmat's Desk |
| **Library** | The modder's own finished props, in folders they make. What EDGEbuilder lists in the game | New |
| **Game Assets** | The game's 3D assets, searched by words and narrowed by kind with checkboxes | EDGEwave's own Game Assets view, with REDcode's filter rules |

Two editor tabs go with them: the **asset page** (one per prop, with the 3D view) and the **New Prop** page (a prompt and its takes).

### The Desk

A scratch space: props the modder is trying out, with their edits, before they go anywhere. It lasts across restarts. It works as [EDGEmat's Desk](https://edgemodders.github.io/EDGEmat/design.html#the-desk) does, so a modder who knows one knows the other.

| Part | Behavior |
|---|---|
| Put on the Desk | **Import Model...** in the Desk's title bar, or **Open in EDGEfab** on a `.glb` or `.gltf` in the Explorer. A take picked on the New Prop page. **Open in EDGEfab** on a prop in Game Assets, as the start of a modified copy. The Desk comes forward with the new entry selected and its asset page open |
| Entries | One line per prop, with its name and where it came from: "from crate.glb", "Tripo take 2", "copy of a game prop". A badge shows its state: **raw** (as it came), **game-ready** (converted, checks pass) or **needs a look** (a check failed; the asset page says which). **Rename...** names it. Two entries can come from the same file, so variations sit side by side |
| A click | Opens the entry's asset page ([below](#the-asset-page-and-the-3d-view)) |
| **+** on an entry | **Add to Project**: the open REDcode project, else a recent one, else browse to a `.cpmodproj`, chosen as EDGEmat's `chooseProject` does. The game-ready files are copied into `source\archive\<game path>`, and the model with its named parts into `source\raw\<game path>.glb`, where REDcode's Export would put it. So REDcode's **Edit in Blender** on the project's mesh opens EDGEfab's model with its part names, not a fresh export with `submesh_00` names ([In a project](#in-a-project-edits-merge-back)). The take or import it came from goes into `source\raw\edgefab\<name>\` with its license record. A file already there asks first: Replace or Keep the Project's. Then a confirm: **Add to Project** or **Add and Take It Off the Desk**, and REDcode's Pack and Try is offered |
| **Add to Library...** | Picks a Library folder and a name, then copies the game-ready entry in ([below](#the-library)) |
| Take off, clear | × on an entry, after a confirm. **Clear the Desk** empties it. Nothing in projects or the Library changes |
| Storage | `%LOCALAPPDATA%\EDGEfab\desk\`. `desk.json` lists the entries (id, name, origin, state, license record). `items\<id>\` holds `source\raw\` (the file as it came, with textures and take record) and `source\archive\` (the converted files at their game paths). Project-shaped, as EDGEmat's is, so the code that copies to a project copies an entry the same way |
| Assistant | `fab_desk`: list, add (a file, a take, a game path), rename, remove, clear, to_project. The Desk view follows `desk.json`, so an assistant's changes show at once |

### The Library

The modder's own collection of finished props, in folders they make, kept outside any project. A prop made once is placed in many scenes and added to many projects. **The Library is how EDGEbuilder gets EDGEfab's props in the game.**

| Part | Behavior |
|---|---|
| Folders | **New Folder**, Rename, Move (drag and drop), Remove. The modder makes the tree: `props › crates › MilitaryCrate`. A new Library starts with `props`. Later versions add `clothing`, `weapons` and others beside it |
| Items | A game-ready prop with a thumbnail (a render from the 3D view), its size in metres, triangle count and source. A click opens its asset page. Editing a Library item edits it in the Library; **Copy to Desk** makes a variation to try something |
| Game paths | Each item's files get a game path from its place in the tree. The owner's example, `base\props\crates\militarycrate\militarycrate.mesh`, is the tree as it reads. **Proposed:** under a root the modder picks once, by default `edgefab\<their name>\`, so two modders' crates never share a path (in the game the first archive wins: [What a game asset is made of](design.html#what-a-game-asset-is-made-of)). `base\` may be chosen, and EDGEfab then checks that no game file sits at the path. Moving an item in the tree keeps its game path, so scenes that use it keep working; **Change Game Path...** is explicit |
| **+** on an item | Add to Project, as from the Desk |
| **Update the Game** | The Library title bar button: packs the Library into one archive (`edgefab_library.archive`) through REDbridge `project.pack`, installs it into the game's `archive\pc\mod` (through EDGEdeck when it is there, so `modlist.txt` stays right) and writes the index EDGEbuilder reads. It runs by itself after each change when the setting is on. With the game running, REDnode hot-loads it (`archives.reload`). On game 2.5 that waits for a RED Hot Tools release, so for now a new prop shows after a game restart (REDnode's changelog, 0.38.1) |
| Storage | `%LOCALAPPDATA%\EDGEfab\library\`, or a folder the modder chooses (`edgefab.libraryPath`), so it can live in a synced or version-controlled folder. `library.json` is the index. `source\archive\` and `source\raw\` are project-shaped; `packed\` holds the archive |
| The index | `library.json`, format 1: per item its id, name, folder, kind (`prop`), game paths (mesh, `.ent` when there is one), appearances, bounds, triangles, thumbnail file, source and license, updated. The contract with EDGEbuilder, agreed with its session ([Into the game](#into-the-game-the-library-in-edgebuilder)) |
| Assistant | `fab_library`: list, add from the Desk, move, rename, remove, update the game |

### Game Assets, with kinds

EDGEfab's own Game Assets view, as EDGEwave has its own for sounds, so a modder finds a game prop without leaving the EDGEfab container. It reads the game through REDcode's bridge and filters the way REDcode's Game Assets does: words in any order, `*` and `?`.

| Part | Behavior |
|---|---|
| Kinds | A **Show** row at the top of the view holds one checkbox per kind of 3D asset: **Props**, **Weapons**, **Clothing**, **NPCs**, **Vehicles**. The checked kinds are listed, each as a group, and the filter searches only them. Tree item checkboxes need VS Code 1.80 or later (EDGEmat targets 1.70). The same choice is in a title-bar **Kinds...** button as a multi-select list. The view's description names what is on: "Props, Weapons" |
| What a kind is | Rules on game folder and file type, built once per game version and cached (as EDGEmat's item list is). **Proposed** for V0 to count and correct: Props are `.mesh` and `.ent` under `base\environment`, `ep1\environment` and `base\gameplay\devices` (EDGEbuilder's index prefixes, without items); Weapons under `base\weapons`; Clothing under `base\characters\garment`; NPCs are `.ent` under `base\characters` (`Character` records later); Vehicles under `base\vehicles` (unverified) |
| In version 1 | Every kind is found and viewed (**View in 3D** opens REDcode's view). Only Props take **Open in EDGEfab**: a copy goes on the Desk to change its look (through EDGEmat) and file in the Library at a new path. The others say "Coming in a later version of EDGEfab" |
| Item actions | View in 3D, Open in EDGEfab (props), Copy Game Path |
| Assistant | `fab_find`: words and kinds, returns game paths with kind, bounds and appearances |

Asking REDcode for kind filters in its own Game Assets ([REDcode #15](https://github.com/Edgemodders/REDcode/issues/15), file kinds) would serve every EDGE tool later. Version 1 does not wait for it. Its own view keeps the EDGEfab container whole, as EDGEwave's does.

## The asset page and the 3D view

**Decided: reuse REDcode's 3D viewer, no viewer of EDGEfab's own.** REDcode's viewer (three.js 0.170, `webview/meshViewer.ts`, bundled as `media/mesh/viewer.js`) is already built to be mounted: `window.REDcodeMesh.mount(container, source, title, options)`. It takes a GLB or glTF, shows its own textures, switches looks, asks EDGEmat for materials, and has an `actions` option for **extra toolbar buttons**. (Found 2026-10-27 in REDcode's source; not yet tried from another extension.)

| Part | How |
|---|---|
| Loading the viewer | EDGEfab's asset page is a webview that loads REDcode's bundled `viewer.js` from REDcode's install folder (allowed with `localResourceRoots`) and calls `mount` with EDGEfab's buttons as `actions`. One viewer, one copy of three.js, REDcode's improvements for free. EDGEfab ships no viewer code |
| What it shows | A raw entry: its GLB, with its own textures. A game-ready entry: its `.mesh` exported to GLB through REDbridge (`project.export`), as REDcode does for its own view, with materials from EDGEmat |
| EDGEfab's toolbar buttons | **Make Game-Ready**, **Ask Tripo...** (on a Tripo take), **Open in EDGEmat** (its looks), **Add to Library...**, **Add to Project**, **Try in Game** |
| Beside the view | The prop in plain words: name, size in metres (height, width, depth), triangles and submeshes, textures and their sizes, the material, its source and license, and the checks with what to do about each. Raw values and the files that make it are one click away (they open in REDcode's CR2W editor) |
| Needs from REDcode | A documented way to do the above, so it does not break on a REDcode update ([below](#what-version-1-needs-from-other-repos)) |
| If REDcode is missing | EDGEfab says what it needs and offers to install REDcode. **Proposed:** version 1 needs REDcode (viewer, bridge, projects) and EDGEmat (materials). Each EDGE tool otherwise keeps the others optional, but a prop cannot be made without these two |

A viewer of EDGEfab's own is only for when REDcode's cannot do something version 1 needs and REDcode will not add it. Nothing found so far is like that.

## Import: making a model game-ready

**Make Game-Ready** turns a model into the files the game draws. Most of it runs in EDGEfab's core (Node, no VS Code imports, so the MCP server runs it too). No Blender is needed for a GLB. Each step names its check, and the asset page shows the result in plain words.

| Step | What happens | By |
|---|---|---|
| 1. Read | The GLB or glTF, its textures (embedded or beside it) and its scale | EDGEfab core, with a glTF library (proposed: glTF Transform, MIT) |
| 2. Size and axes | Metres (with a "this is 40 m tall, did you mean 40 cm?" check against the size range of game props), feet on the ground at the origin, facing forward. glTF is Y-up; whether WolvenKit's importer turns it to the game's Z-up is unverified | EDGEfab core |
| 3. Geometry | Triangulated; normals and tangents made where missing (the importer needs both); one node per submesh, since **REDbridge's import uses only the first primitive of each node** (REDbridge's README, Mesh import). Submeshes named by their material | EDGEfab core |
| 4. Triangle budget | Reduced to a budget for the prop's size (proposed: meshoptimizer's simplify, MIT), with LODs made the same way and named `LOD_1`, `LOD_2` for the importer. Budgets come from game props of the same size, measured in V0 (unverified) | EDGEfab core |
| 5. Textures out | Each glTF material's textures written out as image files beside the mesh, with the submeshes that use them, for step 7 | EDGEfab core |
| 6. Import | The mesh over a template prop mesh (`project.import` with `template`, REDbridge 0.9.0); the textures to `.xbm` with presets `color`, `normal`, `grayscale` (`project.import` with `texture`, REDbridge 0.11.0, not yet tried in the game). Which game mesh makes the best template is a V0 check | REDbridge, through REDcode's `importFile` or bridge |
| 7. Materials | **EDGEmat's job.** By default each glTF material becomes a textured `.mi` on the game's `metal_base.remt`, set on the mesh's `default` look: base color, normal, roughness and metalness, each its own map. glTF packs roughness and metalness into one image (green and blue), so EDGEmat splits it; it resizes to a power of two, at most 2048 (proposed), and flips a normal map's green channel if the game wants DirectX normals (unverified). An emissive or alpha texture is noted and left out of version 1. This is EDGEmat's planned "Materials from a textured model" (M4, not built); its core already writes such a `.mi` (`texturedMaterialJson`) and imports a PNG to `.xbm` (`writeTexture`). With parts, the [material planner](#parts-and-materials-the-planner) may choose a game material for a part instead | EDGEmat API and MCP |
| 8. Check | The files agree: the mesh names a look, the look names the material, the material's textures exist, the bounds are sane. Then a thumbnail | EDGEfab core |

EDGEfab hands EDGEmat the textures and the mesh, and EDGEmat makes the material and puts it on: one place knows how the game's materials work, and an assistant gets the same result through EDGEmat's MCP tool. EDGEfab makes no material itself, not even a simple one.

The originals stay in the entry's `source\raw`, so Make Game-Ready can run again after a change (a different budget, a new texture size) and give the same result.

## Text to 3D: takes

The **New Prop** page is the takes pattern from EDGEwave's Generate Sound, made for 3D. A take costs the modder credits and takes a minute or two, so EDGEfab keeps takes on disk (EDGEwave keeps sounds in memory).

| Part | Behavior |
|---|---|
| Open | **New Prop from Words...** on the Desk's title bar |
| The page | A prompt ("a battered olive military crate with stencils", up to 1,024 characters), what to leave out (up to 255), a size in plain words ("hand-held", "furniture", "car-sized", which sets the face limit), **in parts** (on by default), textures on, and how many takes (1 to 4, default 2). It says what the takes cost in Tripo credits and how many the key has left (`GET user/balance`: balance and frozen), and the terms of the key's plan ([Licenses travel with the asset](plan.html#licenses-travel-with-the-asset)). **Generate** |
| The model | **Proposed: Tripo P1** (`P1-20260311`), which Tripo describes as made for low-poly game assets: a face limit of 48 to 20,000, clean topology, about 2 s for the mesh before texturing. `auto_size` asks for real-world size in metres, which feeds the size check. Textures are PBR by default (`pbr`). 40 credits a take with standard textures, 30 without; Tripo's v3.x models cost 20 and 10 (Tripo's pricing page, 2026-10-27). Credits are prepaid and not refunded |
| Takes | One Tripo task per take, run together (P1 runs up to 5 tasks at once per account). Each take's card shows its progress (0 to 100 from polling the task), then Tripo's preview image (`rendered_image`). A click on a card shows it in the 3D view on the page, with its textures. One WebGL view at a time, cards as images, so four takes stay light. **Generate again** adds takes below, so the earlier ones stay to compare. **New textures** on a take keeps its shape (the same `model_seed`) with a new `texture_seed`. **Stop** stops polling and marks the takes still running (whether a running Tripo task can be cancelled is unverified). A take Tripo refuses for its content policy (`banned`) says so in plain words |
| Pick | **Put on the Desk** on a card: the take's GLB, preview and record go into a new Desk entry. With **in parts** on, the entry arrives in its named parts, and the [material plan](#parts-and-materials-the-planner) is made at once (when the modder has set an Anthropic key) and shown for review, so the next click is **Apply**. Nothing is made or paid for beyond the take until then |
| Storage | `%LOCALAPPDATA%\EDGEfab\takes\<date-prompt>\take-<n>\`: `model.glb`, `preview.png`, `take.json` (prompt, options, Tripo task id, model version, seeds, credits used, plan and its terms, time). Downloaded as soon as a take finishes, since Tripo's download links expire after five minutes. The last 20 prompts are kept; **Clear Takes** removes the rest. Unpicked takes are never in a project |
| Edits on an entry | **Ask Tripo...** in the asset page's toolbar. Each edit is a new Tripo task from an earlier one and comes back as new takes to pick from: **new textures** from a new prompt or a style image (`texture_model`), **fewer faces** (`highpoly_to_lowpoly`, 500 to 20,000 faces, 30 credits), and **split into parts** (Tripo's segmentation, [below](#parts-and-materials-the-planner)). An imported entry works too: EDGEfab uploads it first (`import_model`, up to 150 MB), after the modder agrees. Left out of version 1: `refine_model` (Tripo's v1.x drafts only), `stylize_model` (Lego, voxel), `convert_model` (EDGEfab converts locally, at no cost) |
| Key and consent | The modder's own Tripo key, set with **Set Tripo Key** and removed with **Clear Tripo Key**, asked for the first time Generate needs it. **Proposed:** kept in the EDGE tools' shared key store ([REDnode #23](https://github.com/Edgemodders/REDnode/issues/23), `keys.mjs` copied unchanged into `src/core`), as EDGEmat keeps its image keys since 2026-10-30, so a key set in one EDGE tool works in all and the MCP server reads it itself. `TRIPO_API_KEY`, when set, wins. No call to Tripo before the modder presses Generate. A task can only be read back with the key that started it, so a take records which key (by a short fingerprint, never the key) |
| Assistant | `fab_generate` (prompt and options; returns take ids as they finish), `fab_takes` (list, with preview paths), `fab_pick` (a take onto the Desk), `fab_tripo_edit` (an edit on a take or entry) |

**Tripo's API version.** The task names, prices and limits above are from Tripo's **V2** API docs (platform.tripo3d.ai, read 2026-10-27). Tripo's site says **V2 stops taking requests on 31 October 2026** (16:00 UTC) and asks users to move to **V3**. EDGEfab is built on V3 from the start. Its migration guide (developers.tripo3d.ai) could not be read from the session that wrote this, so V0 checks what V3 changes: endpoints, task names, parameters and outputs (unverified).

The service sits behind one interface (generate, poll, download, edit, balance), so Meshy, Hunyuan3D or Rodin join later without changing the page. EDGEwave's ElevenLabs client is a plain class without one; EDGEfab's has one from the start.

## Parts and materials: the planner

**Added by the owner on 2026-10-30.** Tripo's **segmentation v2** splits a model into parts that are named and described by what they are: a bike comes back as handlebars, seat, frame, wheels. **The main use is a new prop from a prompt**: the modder describes it, and it comes back from Tripo in its parts, ready for a material each. Splitting a model the modder imported is the other use. In EDGEfab each part becomes a submesh with its own material slot, and a **material planner** chooses a material for each part, which EDGEmat makes and puts on. "A battered olive military crate" comes back as lid, body, latches and handles: the planner keeps Tripo's painted stencils on the body, gives the latches a worn steel from the game, and the handles a black rubber.

| Step | What happens | By |
|---|---|---|
| 1. Parts | **From a prompt:** "in parts" on the New Prop page, on by default, so the picked take comes back split ([below](#two-routes-from-a-prompt-to-parts)). **From an imported model:** **Split into Parts** on its Desk entry, after its upload to Tripo, which the modder agrees to first. Either way with a level of detail in plain words (few, some or many parts) and optional hints ("lid, latches, handles"). Each part comes back with a name and a description | Tripo |
| 2. Parts to submeshes | One glTF node per part, named after it, so each is a submesh with its own material slot when REDbridge imports it. The names and descriptions are stored with the entry as its **part map**, the plan's ["Words to parts"](plan.html#words-to-parts), here for free. Tiny parts can be merged with their neighbour (a check, with a suggestion) so a prop does not end up with 60 submeshes | EDGEfab core |
| 3. Parts on the asset page | A parts list beside the 3D view: each part's name, description and material. A click lights the part in the view (by submesh, which REDcode's viewer already toggles). Rename a part, merge two | EDGEfab, REDcode's viewer |
| 4. The plan | **Plan Materials**: for each part, the planner chooses one of four sources and says why: **keep Tripo's texture** (converted), **a game surface** with a color and finish (a one-layer setup, which fits any UVs), **a game material** that tiles, or **a new material** made from words when the game has nothing that fits ("polished chrome", "olive drab paint, chipped"). It sees each part's name and description, Tripo's preview, the prompt, and the game's candidates EDGEmat found for the part's words, so it chooses among real materials and does not invent names | The planner, with EDGEmat's search tools |
| 5. The modder decides | The plan is a table: part, material in words, source, why. Each row can be changed (another surface, another color, keep Tripo's) before anything is made. Nothing is written and nothing paid for until **Apply** | The modder |
| 6. Apply | Row by row, EDGEfab sends EDGEmat the mesh, the part's material slot and the material asked for. **EDGEmat makes it and puts it on** in one call: it converts Tripo's texture, builds the one-layer setup, uses the game material, or makes a new one from the planner's words (generating an image only when nothing in the game fits). Each part shows its new material in the 3D view as it lands | EDGEmat API and MCP |
| 7. Then | The entry is game-ready as before: Library, project, EDGEbuilder | EDGEfab |

### Two routes from a prompt to parts

Tripo's API has two ways to give a prompt's model in parts (its V2 docs, read 2026-10-30). V0 tries both on the same prompts and picks the default by the result: whether parts come back named and described, how well they split, the time and the credits.

| Route | How | For | Against |
|---|---|---|---|
| **A. Make, then split** | `text_to_model` with textures (the P1 model), then segmentation v2 on the picked take | P1, Tripo's low-poly model for game assets. Names and descriptions per part (segmentation v2). Only the picked take is split, so takes stay cheap to compare | Whether segmentation keeps the take's textures on each part is unverified. Two tasks, two waits |
| **B. Make in parts** | `text_to_model` with `generate_parts` (Tripo's v3.x models; P1 does not take it), then `texture_model` on the parts that need a texture of their own (`part_names`) | One task gives every take its parts. Untextured parts suit the planner: plain parts go straight to game materials, and only parts with print or stencils are textured by Tripo | `generate_parts` cannot be used with textures (`texture` and `pbr` must be off). Not P1, so heavier meshes to reduce. Whether its parts carry names and descriptions is unverified. 20 credits more per take |

**Proposed:** route A by default, since P1 is made for game props and segmentation v2 names its parts. Route B is the fallback if segmentation drops textures or names nothing.

**Who does what.** EDGEfab knows the parts and owns the plan: which part gets what, in words. EDGEmat knows materials and owns how each is made and put on. So EDGEfab never writes a material, and does not repeat EDGEmat's work: EDGEmat's own planner ([Compose a material](https://edgemodders.github.io/EDGEmat/design.html#compose-a-material-a-planner-chooses-or-makes-the-layers-proposed), proposed 2026-10-29) turns "a shiny but scratched aluminium" into layers. EDGEfab's planner works one level up, deciding per part what to ask EDGEmat for. Giving the part to EDGEmat (rather than EDGEmat handing back a material for EDGEfab to put on) is the shape EDGEmat's tools already have: `mat_apply` and `mat_from_image` take the mesh and the materials to change as `targets`.

**Tripo's textures or the game's.** A model from Tripo comes with its own PBR textures, painted for its UVs (standard, detailed or extreme quality). They show what Tripo meant, but its lighting is often baked in, and they do not tile. Game surfaces look right under the game's lighting and respond to it (EDGEmat's "game surfaces first"). **Proposed default:** keep Tripo's texture where it holds detail of its own (print, stencils, labels, painted wear), and choose a game surface for plain materials (metal, chrome, plastic, rubber, leather, cloth). The planner says which it chose for each part, and the modder can flip any row.

**Where the planner runs:**

| Who plans | How | Key |
|---|---|---|
| A modder in EDGEfab's UI | **Plan Materials** makes one Claude call, only when pressed, with the brief, the parts and the candidates (as EDGEmat's proposed Describe box does) | The modder's own Anthropic key, from the shared key store |
| An assistant (Claude Code with EDGEchat, REDagent) | `fab_parts` lists the parts; the assistant searches with EDGEmat's tools, then writes the plan with `fab_plan` and applies it with `fab_apply_plan`. The brief is in EDGEfab's MCP server instructions | The assistant's own |
| Without AI | The plan table filled by hand: each row picks from EDGEmat's library, or keeps Tripo's texture | None |

**What exists and what does not** (2026-10-30):

| Piece | State |
|---|---|
| Tripo segmentation v2 with names and descriptions | Seen in third parties' wrappers of Tripo's API (ComfyUI's Tripo Smart Segment node: part hints, coarse, medium or fine, names and a description back; Scenario calls v2 a preview). **Not in Tripo's V2 API docs**, which list segmentation v1.0 only (geometry, 40 credits; part completion 50). Its V3 task name, inputs, cost, and how names and descriptions arrive in the GLB are V0 checks (unverified) |
| EDGEmat: a textured `.mi` from a model's textures | Planned (M4 "Materials from a textured model"), not built. Pieces in its core |
| EDGEmat: a one-layer game surface on a new mesh | Proposed ("Game materials on a new mesh"), unverified in the game |
| EDGEmat: a new material from words | `mat_generate` (Generate's first slice, M3) makes a textured material from an image service. The planner that composes layers (Compose) is proposed, not built |
| EDGEmat: apply to a mesh outside a project | Its tools take a `project`. A Desk entry is project-shaped, so its folder may work as one (unverified) |

So version 1's planner works with what EDGEmat has when V8 starts. Tripo's textures converted, and game surfaces, are the minimum. New materials from words come with EDGEmat's Generate and Compose.

## Changing a prop: on the page, in Blender, by an assistant

**Added by the owner on 2026-10-30.** A prop from Tripo or a file is rarely right the first time. It may be the wrong size, have holes or loose bits, or need a design change: "make the lid thinner", "add a handle on each side", "the latches should be round". EDGEfab offers four ways to change a prop or one of its parts. All four keep the parts and their material plan.

| Way | For | How it runs | Needs |
|---|---|---|---|
| **1. On the asset page** | Size and placement: "1.2 m tall", turn by 90°, sit it on the ground, centre it | EDGEfab core, on the model: a uniform scale to a size typed in metres (or "as tall as a door", from game props of that kind), a turn, the origin to the bottom centre. Instant, no Blender | Nothing |
| **2. Fixed Blender steps** | Mesh errors: holes, flipped faces, loose bits, doubled vertices, parts with no UVs | **Fix Mesh** and **Unwrap Part** buttons. EDGEfab runs its own script in Blender's background (`blender --background`): no AI-written code, the same result every time. The checks on the asset page offer the fix they need ("the lid has 3 holes: Fix Mesh") | The modder's Blender, found as REDcode finds it (`redcode.blenderPath`) |
| **3. By hand in Blender** | Anything a modder can do in Blender | **Edit in Blender** on the asset page or a part: Blender opens with the prop, each part an object named after it. Each save comes back as a new version, Make Game-Ready runs again and the materials go back on. On a prop in a project, each save merges into the project, as REDcode's **Edit in Blender** does ([In a project](#in-a-project-edits-merge-back)). EDGEfab uses REDcode's (`editInBlender`, REDcode 0.10.0) rather than a copy ([below](#what-version-1-needs-from-other-repos)) | Blender |
| **4. By an assistant in Blender** | A design change in words: "make it 20% shorter", "fill the hole in the lid", "add a handle on each side", "make the latches round" | An assistant connected to EDGEfab's MCP server and to a **Blender MCP server** (opt-in, [layer 2](design.html#two-layers-edgefabs-own-blender-steps-and-a-blender-mcp-server)) does the work in a visible Blender, so the modder watches. `fab_edit_begin` gives it the prop (or one part) and a short brief; `fab_edit_end` brings the result back as a new version. In version 1 the assistant is Claude Code with EDGEchat (or REDagent): EDGEfab's own agent and prompt bar come after version 1 (plan F2) and get the same tools, so "add a handle" can then be typed on the asset page | Blender, a Blender MCP server set up by **Set Up Blender for AI**, an assistant |

Tripo's own edits (**Ask Tripo...**: new textures, fewer faces, [Text to 3D](#text-to-3d-takes)) are the fifth way, and follow the same rules.

**Versions.** Every change, from any of the five ways, makes a new version of the Desk entry or Library item. The asset page lists them ("v3: Edit in Blender, 14:02", "v4: assistant: handles added") with **Undo** to the one before and **Compare** (before and after, side by side in the 3D view). Before an assistant's Blender work starts, the current version is kept, so a bad edit is one click back. Stored in the entry's folder: `versions\<n>\` holds that version's GLB and a note of what made it. The last 20 are kept (proposed).

**Parts and materials survive a change.** In Blender each part is an object named after it, and EDGEfab reads the names back:

| After the change | EDGEfab |
|---|---|
| A part kept its name | Keeps its row in the material plan and its material |
| A part was renamed | Asks whether it is the same part, then keeps its row |
| A new part (a handle added) | A new row in the plan, marked "needs a material"; the planner can fill it |
| A part removed | Its row goes |
| A part's shape changed | Its material stays. If its UVs no longer cover it, the check says so and offers **Unwrap Part**. A tiling game surface fits any new UVs; Tripo's painted texture does not, so that part is offered a game surface or new textures from Tripo |
| The size changed | Bounds, triangle budget and LODs are worked out again by Make Game-Ready |

### In a project: edits merge back

**The owner's ask, 2026-10-30:** a modder edits a prop that is already in a project by hand in Blender, the way REDcode works, and the changes merge back into the project. EDGEfab keeps REDcode's flow and adds only what parts need.

| Step | What happens | By |
|---|---|---|
| 1. Open | **Edit in Blender** on the prop's `.mesh` in REDcode's Project view, or on the asset page of a prop in the project. Blender opens `source\raw\<game path>.glb`: EDGEfab's model with its named parts (written there by Add to Project). When the mesh is newer than that GLB (changed some other way), REDcode exports it again first, and EDGEfab names its submeshes back to their parts from the part map | REDcode, EDGEfab |
| 2. Edit and save | The modder changes the model and presses Ctrl+S. REDcode's Blender script writes the GLB; the status bar shows Blender is watched until it closes | Blender, REDcode |
| 3. Merge | Each save is imported over the project's `.mesh` (`project.import`), which keeps the mesh's material entries and looks | REDcode, REDbridge |
| 4. Parts and materials put right | The importer makes one submesh per glTF node, **sorted by node name**, and keeps the old list of materials by position (REDbridge's README, Mesh import). So an added or renamed part can move a material onto the wrong part. After each import, EDGEfab reads the new submeshes, matches them to the part map by name, and has EDGEmat put each part's material back from the plan. A new part gets a plan row marked "needs a material", as on the Desk | EDGEfab, EDGEmat |
| 5. Checks | The asset page's checks run again (size, triangle budget, UVs, LODs). Only the project's files change; the Desk entry or Library item it came from stays as it was, and **Update from Project** brings the change back to it when the modder wants | EDGEfab |

The project's own history is its folder (and git, when the modder uses it); EDGEfab's versions are for the Desk and the Library. Pack and Try then shows the change in the game, as REDcode offers today.

**The brief for an assistant** (in EDGEfab's MCP server instructions, and returned by `fab_edit_begin`): the file to open and where to save it; units are metres, and the prop stands on the ground at the origin; keep each part one object and keep its name; a new part gets a plain name ("left handle"); keep UVs where the shape allows; stay within the triangle budget given; save as glTF to the path given, never over the original. EDGEfab's fixed import and export script ships with it, so the assistant runs that script in Blender rather than writing its own import and export.

**Safety.** Ways 1 to 3 run no AI-written code. Way 4 does, inside Blender, through the Blender MCP server the modder chose to set up, with the caveats in [Blender and Blender MCP](design.html#blender-and-blender-mcp) (no guards on that code; mcp-for-blender's telemetry is on unless turned off). Which server **Set Up Blender for AI** installs by default, Blender Lab's (Blender 5.1 or later) or mcp-for-blender, is a V0 choice.

| Tool | Does |
|---|---|
| `fab_change` | Size, turn, ground, centre (way 1) |
| `fab_fix` | Fix Mesh and Unwrap Part, in Blender's background (way 2) |
| `fab_edit_begin`, `fab_edit_end` | Hand the prop or a part to Blender and take the result back as a version (ways 3 and 4) |
| `fab_versions` | List, undo to, compare |

## Into the game: the Library in EDGEbuilder

EDGEbuilder runs in the game as a REDnode app. Its Browse reads only the game's archives today ([EDGEbuilder #1](https://github.com/Edgemodders/EDGEbuilder/issues/1), its B2c). Version 1's last step is the owner's test, so this path decides when version 1 is done.

| Step | Who | What |
|---|---|---|
| 1 | EDGEfab | **Update the Game**: the Library packed into `edgefab_library.archive`, installed into `archive\pc\mod`, and `library.json` written |
| 2 | EDGEbuilder (its Node side) | Reads `library.json` (path from EDGEfab's setting, or the default folder) and lists a **Library** tab in Browse: the modder's folders, thumbnails, names. Node mods in REDnode can read any folder |
| 3 | EDGEbuilder, REDnode | Spawns the prop to place it (`world.spawn` with `mesh`, REDnode 0.40.1), from the installed archive |
| 4 | EDGEbuilder, REDbridge | Bakes the scene. Today `mesh.info` reads only the game's archives, and `sector.build` refuses a resource that is not in them (REDbridge `BridgeApi.cs`, `BridgeApi.Sector.cs`), so both must read mod archives |
| 5 | EDGEbuilder | A mod made from the scene carries the Library props it uses (copied into the scene's project), or names `edgefab_library.archive` as a requirement. **Proposed:** copied, so a released mod stands alone. EDGEbuilder's call |

New paths are not in WolvenKit's hash list, so a mod archive's file list shows them as bare hashes (inferred). `library.json` names them, so EDGEbuilder never needs to guess.

## Decisions for version 1

| Decision | Proposed | Why |
|---|---|---|
| The 3D view | REDcode's viewer, mounted in EDGEfab's page with EDGEfab's buttons | One viewer for the family. It already has toolbar actions, textures and looks |
| REDcode and EDGEmat | Needed by version 1 | The viewer, bridge and projects; the material |
| Game paths of Library items | The modder's tree under a root picked once, `edgefab\<name>\` by default; `base\` allowed with a check | No two modders' props share a path |
| Takes | Kept on disk, last 20 prompts | They cost credits and minutes |
| Text to 3D | Tripo first, on its V3 API, through EDGEfab's own REST client, behind a service interface; the P1 model by default | As the plan says; P1 is Tripo's model for low-poly game assets; others later |
| Collision | Not in version 1, said on the asset page | EDGEbuilder's colliders are its B5; a box from the bounds is the likely first step |
| Parts and materials | Tripo's segmentation into named parts; EDGEfab plans a material per part in words; EDGEmat makes and puts on each one | EDGEfab knows the parts, EDGEmat knows materials; neither repeats the other |
| Tripo's textures or the game's | Keep Tripo's where it holds detail of its own; game surfaces for plain materials; the modder decides per part | Game surfaces respond to the game's lighting; Tripo's prints and stencils have no game equivalent |
| Keys | The EDGE tools' shared key store (REDnode #23), as EDGEmat since 2026-10-30 | One key for every EDGE tool and its MCP server |
| Changing a prop | Four ways (on the page, fixed Blender steps, by hand in Blender, an assistant through a Blender MCP server) plus Tripo's edits; every change a version with undo; parts kept by object name | Sizing needs no Blender; mesh fixes need no AI; design changes can be by hand or in words |
| Agent | **Decided by the owner on 2026-10-30:** not in version 1. Claude Code drives EDGEfab through its MCP server, and drives Blender through a Blender MCP server for design changes | Version 1 is the path into the game; the agent (plan F2) builds on it |
| Manual edits in a project | REDcode's Edit in Blender, merged into the project on each save; EDGEfab puts parts and materials right after each import (owner, 2026-10-30) | One Blender round trip for the family; the importer's name order would otherwise move materials |
| Version number | Previews 0.x during the build; **1.0** when V10 passes | The release gate holds for each |

## Build plan for version 1

Each step ends with a test the owner runs, added to [Tests](testing.html). Steps V3 to V6 make the imported path whole. V7 to V9 add Tripo, parts, the material planner and changes on top of it, so a generated prop takes the same path as an imported one.

| Step | Builds | The test proves |
|---|---|---|
| **V0 Checks** | The unverified facts in this section: REDcode's viewer mounted from another extension's webview; a textured cube GLB through `project.import` with a template, textures and a `.mi`, spawned in the game (axes, scale, normal map direction, template choice); triangle and texture budgets from game props by size; the Game Assets kind rules and their counts; Tripo's V3 API with a test key (what V3 changes from V2; P1's GLB and PBR textures through Make Game-Ready; edits; balance; terms); Tripo's segmentation v2 on V3 (task name, inputs, cost, where part names and descriptions arrive); EDGEmat's tools on a Desk entry's folder; Blender's background running EDGEfab's script, and a GLB with named parts through Blender and back with names and UVs kept; a Blender MCP server with Claude Code editing a part; the Library contract agreed with EDGEbuilder's session; requests filed ([below](#what-version-1-needs-from-other-repos)) | The owner agrees version 1. A hand-made textured cube stands in the game, right way up, at the right size |
| **V1 Skeleton** | `extensions/edgefab` and `packages/edgefab-mcp` in EDGEmat's shape (npm workspaces, esbuild, TypeScript 5.9, `src/core` without VS Code imports), the activity bar container with the three views empty and their welcome text, the MCP server registered, the release workflow and tools copied from EDGEmat | EDGEfab installs beside REDcode and EDGEmat; the views show; Claude Code lists EDGEfab's tools |
| **V2 Game Assets** | The kind index, the Show checkboxes and Kinds list, the filter, View in 3D, `fab_find` | Each kind lists its assets with the V0 counts; "crate" with only Props on finds the game's crates; one opens in 3D |
| **V3 Desk and asset page** | The Desk (storage, entries, rename, take off, clear), Import Model and Open in EDGEfab on a GLB, the asset page with REDcode's viewer and EDGEfab's buttons, the facts and checks beside it, `fab_desk` | A GLB with textures goes on the Desk and shows with its own textures; it is still there after VS Code restarts |
| **V4 Make Game-Ready** | The steps in [Import](#import-making-a-model-game-ready), with EDGEmat's material; the check list; Add to Project; Try in Game (pack, then spawn at V through REDnode when it is connected) | A downloaded textured crate becomes a game-ready entry, goes into a project, packs, and stands in the game at V with its textures right |
| **V5 Library** | Folders, Add to Library, move, rename, remove, thumbnails, game paths, `library.json`, Update the Game, Copy to Desk, Add to Project from the Library, `fab_library` | The crate files under Props › Crates; the archive installs; `library.json` names it; after a game restart it spawns with REDnode's `world.spawn` |
| **V6 Placed with EDGEbuilder** | Nothing new in EDGEfab beyond fixes. EDGEbuilder's Library tab and REDbridge's mod-archive reads, from their sessions | **The goal:** the crate from the Library is placed in a scene with EDGEbuilder in the running game, and the scene saves with it. **First preview release**, if the owner wants one here |
| **V7 Tripo takes** | The Tripo client, the key commands, the New Prop page, takes on disk, Put on the Desk, `fab_generate`, `fab_takes`, `fab_pick`. Whole models, with Tripo's textures; parts come in V8 | "A battered olive military crate with stencils" gives two takes; one goes on the Desk, Make Game-Ready, into the Library, and is placed with EDGEbuilder |
| **V8 Parts and materials** | Split into Parts (Tripo's segmentation), parts to submeshes, the part map, the parts list on the asset page, Plan Materials (one Claude call, the brief, EDGEmat's candidates), the plan table, Apply through EDGEmat, `fab_parts`, `fab_plan`, `fab_apply_plan` | **From a prompt:** "a rusty bicycle with a leather seat" comes back from Tripo as named parts; the plan keeps Tripo's texture on the seat, gives the handlebars a chrome and the tyres a rubber from the game; after Apply it shows that way in the game. **From an import:** a downloaded GLB in one piece is split into parts and planned the same way. Routes A and B compared and the default set |
| **V9 Changes** | Versions with Undo and Compare; size and placement on the asset page; Fix Mesh and Unwrap Part in Blender's background; Edit in Blender (through REDcode's); `fab_edit_begin` and `fab_edit_end` with the brief and the import and export script; Set Up Blender for AI; Ask Tripo (new textures, fewer faces); `fab_change`, `fab_fix`, `fab_versions`, `fab_tripo_edit` | The bicycle from V8 is made 1.1 m tall on the page; a hole is fixed with Fix Mesh; the seat is reshaped by hand in Blender; Claude Code adds a basket through the Blender MCP server, which gets a material from the planner; the materials stay on the other parts; Undo goes back a step; the result shows in the game. **In a project:** the bicycle added to a project gets a bell by hand through Edit in Blender; on Ctrl+S it merges into the project, every part keeps its material, the bell is offered one, and Pack and Try shows it in the game |
| **V10 Ship** | The docs pages for version 1 (a tutorial for each way to make and change a prop); the changelog | A non-coder makes a prop from words and from a file, and changes one, from the docs alone. **EDGEfab 1.0**, after the release gate |

What comes after version 1 is the plan's F2 (the agent and prompt bar, on this asset page), F7a (animated props, on this Desk) and F4 (clothing, in the Library's next folder), in the [build plan](plan.html)'s order.

## What version 1 needs from other repos

Filed as `request` issues in V0, with the shape that would work. EDGEfab does not change those repos.

| Repo | Need | For |
|---|---|---|
| REDcode | `editInBlender` on any `.glb` or `.gltf` on disk, not only the open project's (for the Desk and the Library); an event after each save is imported into a project, with the files written (so EDGEfab puts parts and materials right), and after each save on a file outside a project (so EDGEfab makes a version); and the Blender it found (`blenderPath()` in its API), for EDGEfab's background steps | V9 |
| REDcode | The mesh viewer as a contract for other extensions: where its script and styles are (an API call such as `meshViewer()` returning their URIs and a version), `mount` and `MountOptions` documented with `actions` kept, and a `snapshot()` on the view returning a PNG (Library thumbnails). Optional: a size readout in metres and a person-sized figure for scale | V3, V5 |
| EDGEmat | "Materials from a textured model" (its M4) in its API and MCP: a model's textures (or a GLB's material) in, a textured `.mi` out, set on a mesh's look | V4 |
| EDGEmat | For the planner: an API call (and MCP tool) that takes a mesh, a material slot and a material asked for in words or by name (a game surface with a color and finish, a game `.mi`, or "make this"), and makes and puts it on; a search that returns candidates for a part's words; both on a Desk entry's folder, not only a project. Builds on its Game materials on a new mesh, Generate and Compose | V8 |
| REDbridge | `mesh.info` and `mesh.infoMany` reading mod archives and project folders; `sector.build` taking resources from mod archives | V6 |
| EDGEbuilder | Its B2c with a Library tab that reads EDGEfab's `library.json` ([#1](https://github.com/Edgemodders/EDGEbuilder/issues/1)), and how a scene's mod carries the Library props it uses | V6 |
| EDGEdeck | Installing and updating one archive from another extension (EDGEfab's Library), keeping `modlist.txt` right, if its API does not already | V5 |
| REDnode | Nothing new. `world.spawn` with `mesh` is there (0.40.1); hot load on game 2.5 waits for RED Hot Tools | V4, V5 |
