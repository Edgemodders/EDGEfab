# EDGE<span class="y">fab</span> design

EDGEfab makes new things for Cyberpunk 2077: clothes and objects, from a 3D model to something that works in the game. A modder brings a model from Blender or an AI model service; EDGEfab guides it into a finished asset, with its materials, its looks, the files the game needs to know it exists, and a quick way to try it in the game. Or the modder asks REDagent or Claude: "make this model a jacket V can wear".

**Status: draft 0.1, a starting brief.** Written on 2026-10-16 by the EDGEmat session, from the custom-asset goals the owner set for the EDGE platform ([EDGEmat design, "Custom assets"](https://edgemodders.github.io/EDGEmat/design.html#custom-assets-from-a-model-to-the-game)) and from what EDGEmat's M0 learned against the real game. It is a brief for EDGEfab's own first session, not agreed decisions: everything marked *open* or *unverified* is for that session to settle with the owner. **Extended 2026-10-19** by the EDGEmat session at the owner's request: [clothing fitted to the body](#clothing-fitting-to-the-body), [Blender and Blender MCP](#blender-and-blender-mcp), and materials from EDGEmat's new M4 Make. **Changed 2026-10-25** by the owner's vision: EDGEfab is a full-spectrum fabricator, not a mesh editor. Its goal is the whole game asset (props, clothing, characters and NPCs, with their materials, rigs, animations, voice and records), changed by prompts, with its own agent orchestrating EDGEmat, EDGEwave, Tripo, Blender and Unreal Engine. See the [build plan](plan.html), whose phases replace the ones below, and [UE5 assets](ue-assets.html). **Version 1 set 2026-10-27 by the owner:** game props, imported or made from words through Tripo, with a Desk, a Library that EDGEbuilder reads in the game, and Game Assets with kind filters, on REDcode's 3D viewer ([Version 1](#version-1-props)). Next: V0, its checks.

## Mission

EDGE brings modding to everyone, especially non-coders: easy, fun and fast. A new item today means many small files that must agree with each other: the mesh, materials, appearances, an entity, a factory entry, an ArchiveXL file, a TweakXL record, localized names, an icon. EDGEfab's job is that nobody has to know that list.

| Rule | In practice |
|---|---|
| Start from what the modder has | A model file, or an existing game item to copy. Not a list of file types |
| Plain words first, details one click away | "A jacket for both body types, two looks, called *Neon Shell*" before `entityName`, `.app` and `partsOverrides` |
| Everything the UI does, an assistant can do | Each feature ships in the UI and the MCP server together |
| Try it in seconds | One action packs, deploys and shows the result in the running game |

## Version 1: props

**Set by the owner on 2026-10-27.** The first version of EDGEfab makes **game props**: static objects that EDGEbuilder places in the world. A prop comes from a 3D file the modder imports, or from a prompt to a text-to-3D service (Tripo first). It waits on the **Desk** while the modder works on it. Then it goes into the **Library**, where EDGEbuilder finds it in the running game, or into the open REDcode project. Everything else in the [build plan](plan.html) comes after version 1: clothing, characters, animation, Unreal, and EDGEfab's own agent. Version 1 brings the plan's F1 (props) and F3 (generated props) together, with the views below. Choices marked *proposed* are for the owner to confirm. Facts not yet checked are marked unverified; V0 checks them ([build plan](#build-plan-for-version-1)).

### The goal

> A modder who has never opened WolvenKit makes a military crate, from a GLB file or by typing "a battered olive military crate with stencils". They file it in their Library under Props › Crates, and place it in a scene with EDGEbuilder in the running game.

| In version 1 | Not in version 1 |
|---|---|
| Static props: a mesh, its textures and material, one look, LODs | Clothing, weapons, NPCs, vehicles. They can be found and viewed in Game Assets, not edited |
| Import a GLB or glTF with its textures | FBX, OBJ and `.blend`, which need Blender's background ([Blender layer 1](#two-layers-edgefabs-own-blender-steps-and-a-blender-mcp-server)); next after version 1 |
| Text to 3D through Tripo, in takes; Tripo's own edits on a take | Other services (Meshy, Hunyuan3D, Rodin). Image to 3D: the same task flow with an uploaded image, so it can follow soon after |
| The Desk, the Library, Game Assets with kind filters | |
| Add to Project; the Library in the game for EDGEbuilder | Collision: V walks through a version 1 prop, and the asset page says so. Animated props (plan F7a) |
| An MCP tool for every action | EDGEfab's own agent and prompt bar (plan F2). Claude Code drives version 1 through EDGEfab's MCP server |

### The views

EDGEfab's activity bar container, top to bottom. The same order and idea as EDGEmat's Desk, Library and Find.

| View | What it holds | Built like |
|---|---|---|
| **Desk** | The props being worked on, not in a project yet | EDGEmat's Desk |
| **Library** | The modder's own finished props, in folders they make. What EDGEbuilder lists in the game | New |
| **Game Assets** | The game's 3D assets, searched by words and narrowed by kind with checkboxes | EDGEwave's own Game Assets view, with REDcode's filter rules |

Two editor tabs go with them: the **asset page** (one per prop, with the 3D view) and the **New Prop** page (a prompt and its takes).

#### The Desk

A scratch space: props the modder is trying out, with their edits, before they go anywhere. It lasts across restarts. It works as [EDGEmat's Desk](https://edgemodders.github.io/EDGEmat/design.html#the-desk) does, so a modder who knows one knows the other.

| Part | Behavior |
|---|---|
| Put on the Desk | **Import Model...** in the Desk's title bar, or **Open in EDGEfab** on a `.glb` or `.gltf` in the Explorer. A take picked on the New Prop page. **Open in EDGEfab** on a prop in Game Assets, as the start of a modified copy. The Desk comes forward with the new entry selected and its asset page open |
| Entries | One line per prop, with its name and where it came from: "from crate.glb", "Tripo take 2", "copy of a game prop". A badge shows its state: **raw** (as it came), **game-ready** (converted, checks pass) or **needs a look** (a check failed; the asset page says which). **Rename...** names it. Two entries can come from the same file, so variations sit side by side |
| A click | Opens the entry's asset page ([below](#the-asset-page-and-the-3d-view)) |
| **+** on an entry | **Add to Project**: the open REDcode project, else a recent one, else browse to a `.cpmodproj`, chosen as EDGEmat's `chooseProject` does. The game-ready files are copied into `source\archive\<game path>` and the originals into `source\raw\edgefab\<name>\`. A file already there asks first: Replace or Keep the Project's. Then a confirm: **Add to Project** or **Add and Take It Off the Desk**, and REDcode's Pack and Try is offered |
| **Add to Library...** | Picks a Library folder and a name, then copies the game-ready entry in ([below](#the-library)) |
| Take off, clear | × on an entry, after a confirm. **Clear the Desk** empties it. Nothing in projects or the Library changes |
| Storage | `%LOCALAPPDATA%\EDGEfab\desk\`. `desk.json` lists the entries (id, name, origin, state, license record). `items\<id>\` holds `source\raw\` (the file as it came, with textures and take record) and `source\archive\` (the converted files at their game paths). Project-shaped, as EDGEmat's is, so the code that copies to a project copies an entry the same way |
| Assistant | `fab_desk`: list, add (a file, a take, a game path), rename, remove, clear, to_project. The Desk view follows `desk.json`, so an assistant's changes show at once |

#### The Library

The modder's own collection of finished props, in folders they make, kept outside any project. A prop made once is placed in many scenes and added to many projects. **The Library is how EDGEbuilder gets EDGEfab's props in the game.**

| Part | Behavior |
|---|---|
| Folders | **New Folder**, Rename, Move (drag and drop), Remove. The modder makes the tree: `props › crates › MilitaryCrate`. A new Library starts with `props`. Later versions add `clothing`, `weapons` and others beside it |
| Items | A game-ready prop with a thumbnail (a render from the 3D view), its size in metres, triangle count and source. A click opens its asset page. Editing a Library item edits it in the Library; **Copy to Desk** makes a variation to try something |
| Game paths | Each item's files get a game path from its place in the tree. The owner's example, `base\props\crates\militarycrate\militarycrate.mesh`, is the tree as it reads. **Proposed:** under a root the modder picks once, by default `edgefab\<their name>\`, so two modders' crates never share a path (in the game the first archive wins: [What a game asset is made of](#what-a-game-asset-is-made-of)). `base\` may be chosen, and EDGEfab then checks that no game file sits at the path. Moving an item in the tree keeps its game path, so scenes that use it keep working; **Change Game Path...** is explicit |
| **+** on an item | Add to Project, as from the Desk |
| **Update the Game** | The Library title bar button: packs the Library into one archive (`edgefab_library.archive`) through REDbridge `project.pack`, installs it into the game's `archive\pc\mod` (through EDGEdeck when it is there, so `modlist.txt` stays right) and writes the index EDGEbuilder reads. It runs by itself after each change when the setting is on. With the game running, REDnode hot-loads it (`archives.reload`). On game 2.5 that waits for a RED Hot Tools release, so for now a new prop shows after a game restart (REDnode's changelog, 0.38.1) |
| Storage | `%LOCALAPPDATA%\EDGEfab\library\`, or a folder the modder chooses (`edgefab.libraryPath`), so it can live in a synced or version-controlled folder. `library.json` is the index. `source\archive\` and `source\raw\` are project-shaped; `packed\` holds the archive |
| The index | `library.json`, format 1: per item its id, name, folder, kind (`prop`), game paths (mesh, `.ent` when there is one), appearances, bounds, triangles, thumbnail file, source and license, updated. The contract with EDGEbuilder, agreed with its session ([Into the game](#into-the-game-the-library-in-edgebuilder)) |
| Assistant | `fab_library`: list, add from the Desk, move, rename, remove, update the game |

#### Game Assets, with kinds

EDGEfab's own Game Assets view, as EDGEwave has its own for sounds, so a modder finds a game prop without leaving the EDGEfab container. It reads the game through REDcode's bridge and filters the way REDcode's Game Assets does: words in any order, `*` and `?`.

| Part | Behavior |
|---|---|
| Kinds | A **Show** row at the top of the view holds one checkbox per kind of 3D asset: **Props**, **Weapons**, **Clothing**, **NPCs**, **Vehicles**. The checked kinds are listed, each as a group, and the filter searches only them. Tree item checkboxes need VS Code 1.80 or later (EDGEmat targets 1.70). The same choice is in a title-bar **Kinds...** button as a multi-select list. The view's description names what is on: "Props, Weapons" |
| What a kind is | Rules on game folder and file type, built once per game version and cached (as EDGEmat's item list is). **Proposed** for V0 to count and correct: Props are `.mesh` and `.ent` under `base\environment`, `ep1\environment` and `base\gameplay\devices` (EDGEbuilder's index prefixes, without items); Weapons under `base\weapons`; Clothing under `base\characters\garment`; NPCs are `.ent` under `base\characters` (`Character` records later); Vehicles under `base\vehicles` (unverified) |
| In version 1 | Every kind is found and viewed (**View in 3D** opens REDcode's view). Only Props take **Open in EDGEfab**: a copy goes on the Desk to change its look (through EDGEmat) and file in the Library at a new path. The others say "Coming in a later version of EDGEfab" |
| Item actions | View in 3D, Open in EDGEfab (props), Copy Game Path |
| Assistant | `fab_find`: words and kinds, returns game paths with kind, bounds and appearances |

Asking REDcode for kind filters in its own Game Assets ([REDcode #15](https://github.com/Edgemodders/REDcode/issues/15), file kinds) would serve every EDGE tool later. Version 1 does not wait for it. Its own view keeps the EDGEfab container whole, as EDGEwave's does.

### The asset page and the 3D view

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

### Import: making a model game-ready

**Make Game-Ready** turns a model into the files the game draws. Most of it runs in EDGEfab's core (Node, no VS Code imports, so the MCP server runs it too). No Blender is needed for a GLB. Each step names its check, and the asset page shows the result in plain words.

| Step | What happens | By |
|---|---|---|
| 1. Read | The GLB or glTF, its textures (embedded or beside it) and its scale | EDGEfab core, with a glTF library (proposed: glTF Transform, MIT) |
| 2. Size and axes | Metres (with a "this is 40 m tall, did you mean 40 cm?" check against the size range of game props), feet on the ground at the origin, facing forward. glTF is Y-up; whether WolvenKit's importer turns it to the game's Z-up is unverified | EDGEfab core |
| 3. Geometry | Triangulated; normals and tangents made where missing (the importer needs both); one node per submesh, since **REDbridge's import uses only the first primitive of each node** (REDbridge's README, Mesh import). Submeshes named by their material | EDGEfab core |
| 4. Triangle budget | Reduced to a budget for the prop's size (proposed: meshoptimizer's simplify, MIT), with LODs made the same way and named `LOD_1`, `LOD_2` for the importer. Budgets come from game props of the same size, measured in V0 (unverified) | EDGEfab core |
| 5. Textures to the game's PBR | The material's base color, normal, roughness and metalness, each its own map. glTF packs roughness and metalness into one image (green and blue), so it is split. Resized to a power of two, at most 2048 (proposed). A normal map's green channel flipped if the game wants DirectX normals (unverified). An emissive or alpha texture: noted, left out of version 1 | EDGEfab core |
| 6. Import | The mesh over a template prop mesh (`project.import` with `template`, REDbridge 0.9.0); the textures to `.xbm` with presets `color`, `normal`, `grayscale` (`project.import` with `texture`, REDbridge 0.11.0, not yet tried in the game). Which game mesh makes the best template is a V0 check | REDbridge, through REDcode's `importFile` or bridge |
| 7. Material | A textured `.mi` on the game's `metal_base.remt` from the four maps, set on the mesh's `default` look. **EDGEmat's job:** its planned "Materials from a textured model" (M4); EDGEmat's core already writes such a `.mi` (`texturedMaterialJson`) | EDGEmat API |
| 8. Check | The files agree: the mesh names a look, the look names the material, the material's textures exist, the bounds are sane. Then a thumbnail | EDGEfab core |

The originals stay in the entry's `source\raw`, so Make Game-Ready can run again after a change (a different budget, a new texture size) and give the same result.

### Text to 3D: takes

The **New Prop** page is the takes pattern from EDGEwave's Generate Sound, made for 3D. A take costs the modder credits and takes a minute or two, so EDGEfab keeps takes on disk (EDGEwave keeps sounds in memory).

| Part | Behavior |
|---|---|
| Open | **New Prop from Words...** on the Desk's title bar |
| The page | A prompt ("a battered olive military crate with stencils", up to 1,024 characters), what to leave out (up to 255), a size in plain words ("hand-held", "furniture", "car-sized", which sets the face limit), textures on, and how many takes (1 to 4, default 2). It says what the takes cost in Tripo credits and how many the key has left (`GET user/balance`: balance and frozen), and the terms of the key's plan ([Licenses travel with the asset](plan.html#licenses-travel-with-the-asset)). **Generate** |
| The model | **Proposed: Tripo P1** (`P1-20260311`), which Tripo describes as made for low-poly game assets: a face limit of 48 to 20,000, clean topology, about 2 s for the mesh before texturing. `auto_size` asks for real-world size in metres, which feeds the size check. Textures are PBR by default (`pbr`). 40 credits a take with standard textures, 30 without; Tripo's v3.x models cost 20 and 10 (Tripo's pricing page, 2026-10-27). Credits are prepaid and not refunded |
| Takes | One Tripo task per take, run together (P1 runs up to 5 tasks at once per account). Each take's card shows its progress (0 to 100 from polling the task), then Tripo's preview image (`rendered_image`). A click on a card shows it in the 3D view on the page, with its textures. One WebGL view at a time, cards as images, so four takes stay light. **Generate again** adds takes below, so the earlier ones stay to compare. **New textures** on a take keeps its shape (the same `model_seed`) with a new `texture_seed`. **Stop** stops polling and marks the takes still running (whether a running Tripo task can be cancelled is unverified). A take Tripo refuses for its content policy (`banned`) says so in plain words |
| Pick | **Put on the Desk** on a card: the take's GLB, preview and record go into a new Desk entry, and Make Game-Ready can run straight away (a setting) |
| Storage | `%LOCALAPPDATA%\EDGEfab\takes\<date-prompt>\take-<n>\`: `model.glb`, `preview.png`, `take.json` (prompt, options, Tripo task id, model version, seeds, credits used, plan and its terms, time). Downloaded as soon as a take finishes, since Tripo's download links expire after five minutes. The last 20 prompts are kept; **Clear Takes** removes the rest. Unpicked takes are never in a project |
| Edits on an entry | **Ask Tripo...** in the asset page's toolbar. Each edit is a new Tripo task from an earlier one and comes back as new takes to pick from: **new textures** from a new prompt or a style image (`texture_model`), **fewer faces** (`highpoly_to_lowpoly`, 500 to 20,000 faces, 30 credits), and **split into parts** (`mesh_segmentation`, 40 credits), which also starts the part map the plan needs for "make the lid red". An imported entry works too: EDGEfab uploads it first (`import_model`, up to 150 MB), after the modder agrees. Left out of version 1: `refine_model` (Tripo's v1.x drafts only), `stylize_model` (Lego, voxel), `convert_model` (EDGEfab converts locally, at no cost) |
| Key and consent | The modder's own Tripo key, in VS Code's secret storage (`edgefab.tripo.apiKey`), set with **Set Tripo Key** and removed with **Clear Tripo Key**, asked for the first time Generate needs it. No call to Tripo before the modder presses Generate. The MCP server gets the key in its environment (`TRIPO_API_KEY`) when EDGEfab registers it, as EDGEmat does. A task can only be read back with the key that started it, so a take records which key (by a short fingerprint, never the key) |
| Assistant | `fab_generate` (prompt and options; returns take ids as they finish), `fab_takes` (list, with preview paths), `fab_pick` (a take onto the Desk), `fab_tripo_edit` (an edit on a take or entry) |

**Tripo's API version.** The task names, prices and limits above are from Tripo's **V2** API docs (platform.tripo3d.ai, read 2026-10-27). Tripo's site says **V2 stops taking requests on 31 October 2026** (16:00 UTC) and asks users to move to **V3**. EDGEfab is built on V3 from the start. Its migration guide (developers.tripo3d.ai) could not be read from the session that wrote this, so V0 checks what V3 changes: endpoints, task names, parameters and outputs (unverified).

The service sits behind one interface (generate, poll, download, edit, balance), so Meshy, Hunyuan3D or Rodin join later without changing the page. EDGEwave's ElevenLabs client is a plain class without one; EDGEfab's has one from the start.

### Into the game: the Library in EDGEbuilder

EDGEbuilder runs in the game as a REDnode app. Its Browse reads only the game's archives today ([EDGEbuilder #1](https://github.com/Edgemodders/EDGEbuilder/issues/1), its B2c). Version 1's last step is the owner's test, so this path decides when version 1 is done.

| Step | Who | What |
|---|---|---|
| 1 | EDGEfab | **Update the Game**: the Library packed into `edgefab_library.archive`, installed into `archive\pc\mod`, and `library.json` written |
| 2 | EDGEbuilder (its Node side) | Reads `library.json` (path from EDGEfab's setting, or the default folder) and lists a **Library** tab in Browse: the modder's folders, thumbnails, names. Node mods in REDnode can read any folder |
| 3 | EDGEbuilder, REDnode | Spawns the prop to place it (`world.spawn` with `mesh`, REDnode 0.40.1), from the installed archive |
| 4 | EDGEbuilder, REDbridge | Bakes the scene. Today `mesh.info` reads only the game's archives, and `sector.build` refuses a resource that is not in them (REDbridge `BridgeApi.cs`, `BridgeApi.Sector.cs`), so both must read mod archives |
| 5 | EDGEbuilder | A mod made from the scene carries the Library props it uses (copied into the scene's project), or names `edgefab_library.archive` as a requirement. **Proposed:** copied, so a released mod stands alone. EDGEbuilder's call |

New paths are not in WolvenKit's hash list, so a mod archive's file list shows them as bare hashes (inferred). `library.json` names them, so EDGEbuilder never needs to guess.

### Decisions for version 1

| Decision | Proposed | Why |
|---|---|---|
| The 3D view | REDcode's viewer, mounted in EDGEfab's page with EDGEfab's buttons | One viewer for the family. It already has toolbar actions, textures and looks |
| REDcode and EDGEmat | Needed by version 1 | The viewer, bridge and projects; the material |
| Game paths of Library items | The modder's tree under a root picked once, `edgefab\<name>\` by default; `base\` allowed with a check | No two modders' props share a path |
| Takes | Kept on disk, last 20 prompts | They cost credits and minutes |
| Text to 3D | Tripo first, on its V3 API, through EDGEfab's own REST client, behind a service interface; the P1 model by default | As the plan says; P1 is Tripo's model for low-poly game assets; others later |
| Collision | Not in version 1, said on the asset page | EDGEbuilder's colliders are its B5; a box from the bounds is the likely first step |
| Agent | Not in version 1. Claude Code drives EDGEfab through its MCP server | Version 1 is the path into the game; the agent (plan F2) builds on it |
| Version number | Previews 0.x during the build; **1.0** when V8 passes | The release gate holds for each |

### Build plan for version 1

Each step ends with a test the owner runs, added to [Tests](testing.html). Steps V3 to V6 make the imported path whole. V7 and V8 add Tripo on top of it, so a generated prop takes the same path as an imported one.

| Step | Builds | The test proves |
|---|---|---|
| **V0 Checks** | The unverified facts in this section: REDcode's viewer mounted from another extension's webview; a textured cube GLB through `project.import` with a template, textures and a `.mi`, spawned in the game (axes, scale, normal map direction, template choice); triangle and texture budgets from game props by size; the Game Assets kind rules and their counts; Tripo's V3 API with a test key (what V3 changes from V2; P1's GLB and PBR textures through Make Game-Ready; edits; balance; terms); the Library contract agreed with EDGEbuilder's session; requests filed ([below](#what-version-1-needs-from-other-repos)) | The owner agrees version 1. A hand-made textured cube stands in the game, right way up, at the right size |
| **V1 Skeleton** | `extensions/edgefab` and `packages/edgefab-mcp` in EDGEmat's shape (npm workspaces, esbuild, TypeScript 5.9, `src/core` without VS Code imports), the activity bar container with the three views empty and their welcome text, the MCP server registered, the release workflow and tools copied from EDGEmat | EDGEfab installs beside REDcode and EDGEmat; the views show; Claude Code lists EDGEfab's tools |
| **V2 Game Assets** | The kind index, the Show checkboxes and Kinds list, the filter, View in 3D, `fab_find` | Each kind lists its assets with the V0 counts; "crate" with only Props on finds the game's crates; one opens in 3D |
| **V3 Desk and asset page** | The Desk (storage, entries, rename, take off, clear), Import Model and Open in EDGEfab on a GLB, the asset page with REDcode's viewer and EDGEfab's buttons, the facts and checks beside it, `fab_desk` | A GLB with textures goes on the Desk and shows with its own textures; it is still there after VS Code restarts |
| **V4 Make Game-Ready** | The steps in [Import](#import-making-a-model-game-ready), with EDGEmat's material; the check list; Add to Project; Try in Game (pack, then spawn at V through REDnode when it is connected) | A downloaded textured crate becomes a game-ready entry, goes into a project, packs, and stands in the game at V with its textures right |
| **V5 Library** | Folders, Add to Library, move, rename, remove, thumbnails, game paths, `library.json`, Update the Game, Copy to Desk, Add to Project from the Library, `fab_library` | The crate files under Props › Crates; the archive installs; `library.json` names it; after a game restart it spawns with REDnode's `world.spawn` |
| **V6 Placed with EDGEbuilder** | Nothing new in EDGEfab beyond fixes. EDGEbuilder's Library tab and REDbridge's mod-archive reads, from their sessions | **The goal:** the crate from the Library is placed in a scene with EDGEbuilder in the running game, and the scene saves with it. **First preview release**, if the owner wants one here |
| **V7 Tripo takes** | The Tripo client, the key commands, the New Prop page, takes on disk, Put on the Desk, `fab_generate`, `fab_takes`, `fab_pick` | "A battered olive military crate with stencils" gives two takes; one goes on the Desk, Make Game-Ready, into the Library, and is placed with EDGEbuilder |
| **V8 Tripo edits and ship** | Ask Tripo on a take (new textures, low poly, refine, where the API allows), `fab_tripo_edit`; the docs pages for version 1 (a tutorial for each way to make a prop); the changelog | A take is retextured from a new prompt and replaces the Desk entry's look; a non-coder makes a prop each way from the docs alone. **EDGEfab 1.0**, after the release gate |

What comes after version 1 is the plan's F2 (the agent and prompt bar, on this asset page), F7a (animated props, on this Desk) and F4 (clothing, in the Library's next folder), in the [build plan](plan.html)'s order.

### What version 1 needs from other repos

Filed as `request` issues in V0, with the shape that would work. EDGEfab does not change those repos.

| Repo | Need | For |
|---|---|---|
| REDcode | The mesh viewer as a contract for other extensions: where its script and styles are (an API call such as `meshViewer()` returning their URIs and a version), `mount` and `MountOptions` documented with `actions` kept, and a `snapshot()` on the view returning a PNG (Library thumbnails). Optional: a size readout in metres and a person-sized figure for scale | V3, V5 |
| EDGEmat | "Materials from a textured model" (its M4) in its API and MCP: four maps (or a GLB's material) in, a textured `.mi` out, set on a mesh's look | V4 |
| REDbridge | `mesh.info` and `mesh.infoMany` reading mod archives and project folders; `sector.build` taking resources from mod archives | V6 |
| EDGEbuilder | Its B2c with a Library tab that reads EDGEfab's `library.json` ([#1](https://github.com/Edgemodders/EDGEbuilder/issues/1)), and how a scene's mod carries the Library props it uses | V6 |
| EDGEdeck | Installing and updating one archive from another extension (EDGEfab's Library), keeping `modlist.txt` right, if its API does not already | V5 |
| REDnode | Nothing new. `world.spawn` with `mesh` is there (0.40.1); hot load on game 2.5 waits for RED Hot Tools | V4, V5 |

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

Proposed for F4 (clothing), unverified until tried:

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

**How it fits** (draft 0.1; the 2026-10-25 vision changes it: EDGEfab's own agent connects to a Blender MCP server as its client, see the [build plan](plan.html#what-changes-in-the-design)). EDGEfab does not connect to Blender. The assistant connects to both servers: it models or edits in Blender and exports a GLB, then asks EDGEfab's MCP server to make it a game asset and EDGEmat's for materials. EDGEchat, the Claude Code plugin for the EDGE tools, could list a Blender server as a recommended companion.

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

**Replaced on 2026-10-25 by the [build plan](plan.html)** (F0 to F9), and for the first version by [Version 1](#version-1-props). Kept here as draft 0.1 had them. For the first session to agree with the owner. Objects come before clothing, because clothing needs rigging. F1 and F3 need materials on new meshes from **EDGEmat M4 Make**.

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
| The sibling repos' source, read 2026-10-27 (REDcode, EDGEmat, EDGEwave, EDGEbuilder, REDbridge, REDnode) | For version 1: REDcode's mountable viewer and its `actions`; EDGEmat's Desk and Add to Project; EDGEwave's takes and key handling; EDGEbuilder's Browse index and placing; REDbridge's import and its game-archive-only reads; REDnode's `world.spawn` and hot load on 2.5 |
| Tripo's API docs ([platform.tripo3d.ai/docs](https://platform.tripo3d.ai/docs/introduction)), V2, read 2026-10-27 | Task types and their inputs, polling and expiring download links, the P1 model, pricing, concurrency limits, the V2 retirement notice |
