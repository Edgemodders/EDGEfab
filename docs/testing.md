---
title: Tests
---

# Tests

Every test of EDGEfab, with the steps to run it again, what should happen, and each run's result. Add a test here when it is first run. **Release gate (the owner's rule):** no release until every test of the builds since the last release has passed. Untested or failed stops it.

In-game steps start with the Test timer: switch on REDnode's **Test timer** app, press **Start**, and press **Mark** after each numbered step, so log lines can be tied to steps.

F1's tests come first, then F0's checks.

## F1: prepare a model (smoke test, without VS Code)

The bundled core makes a prop from a GLB on disk, and REDbridge takes the result. Run after every change to `src/core`.

**Steps.**

1. `npm run build`, then `npm run smoke -- "<model>.glb" "<out folder>"` on two Tripo models: one made with `face_limit` 20000, one without a limit (1.4 million triangles). F0's runs gave both.
2. Import the prepared GLB (`<out>\<name>.prop.asset\source\raw\<name>\<name>.glb`) with REDbridge's `project.import` over `base\environment\decoration\containers\barrel\drum\barrel_drum_a.mesh`.
3. The MCP server: `npm run mcp:start`, send `initialize` and `tools/list`.

**Expected.** The smoke test prints `ok`: three LODs, each part with `POSITION`, `NORMAL`, `TEXCOORD_0`, `TANGENT` and at most 65,535 vertices, the base at height 0, three texture files, and a `view.glb` beside the game GLB with the same parts and levels and the textures inside (added 2026-11-04, for Open in 3D). REDbridge returns `ok: true` with 3 submeshes. The server lists `fab_make`, `fab_desk`, `fab_tripo`.

### Run 1, 2026-11-01: passed

| Model | Time | Result |
|---|---|---|
| Tripo, `face_limit` 20000 | 0.2 s | 0.65 m tall; LODs 19,021 / 9,510 / 3,794 triangles (10,980 / 6,307 / 3,151 vertices); color, ORM and normal written out. REDbridge: `ok`, 3 submeshes |
| Tripo, no limit (1,445,348 triangles) | 2.7 s | Simplified to 77,908 triangles (49,850 vertices) to fit, with a note saying so; LODs 77,908 / 38,954 / 15,572 |
| MCP server | | Started; lists `fab_make`, `fab_made`, `fab_tripo` (`fab_made` renamed `fab_desk` on 2026-11-02; it answers with an empty Desk) |

Found on the way and fixed before this run: glTF-Transform's `normals()` unwelds every mesh, and `prune()` drops UVs and tangents once the textures are out of the GLB (REDbridge then refused it for missing tangents).

### Run 2, 2026-11-04: passed

F0's drum again, after `view.glb` was added: the same three levels (19,021 / 9,510 / 3,794 triangles) and textures; `view.glb` (4.3 MB) has the nodes `submesh_00_LOD_1`, `_2`, `_4` and one material with its color, ORM and normal textures.

### Run 3, 2026-11-04: passed

After the turn to the game's forward: test 8's v3.1 vending machine is turned a quarter (note "Turned a quarter to face forward"), 0.85 m wide by 0.82 m deep (was 0.82 by 0.85), and drawn from four sides its front faces −Z in glTF. F0's drum, also from Tripo, is turned the same way. **Unverified in the game:** that −Z in the GLB becomes the way a spawned or placed prop faces (to see with test 7's run).

### Run 4, 2026-11-04: passed

Glow: test 8's vending machine with a glow map made from its bright, saturated painted areas (15.8% of its texture), `emissiveFactor` 1 and `KHR_materials_emissive_strength` 3. Prepare writes the map out (`vending_glow_00_emissive.png`) and lists `glow` with its colour, strength 3 and map; `view.glb` keeps `emissiveTexture` and the strength extension. Drawn from four sides with the map alone: the shelves, buttons, trim lights and a side panel glow, the body stays dark. The model's file was written by glTF-Transform, yet it is still known as Tripo's by its node names and turned.

**Not yet tried:** the extension in VS Code (Import a GLB, Generate with Tripo, the Desk view, Open in 3D in REDcode's view), and `fab_make` with Tripo through the MCP server. Both spend nothing new until a Tripo generation (20 credits).

## F1: Add to Project (without the game)

A Desk item becomes a prop in a WolvenKit project, through the bundled core, the MCP server's `fab_add` and (not yet tried) the extension's Add to Project. Run after every change to `addToProject.ts`.

**Steps.**

1. `npm run build` in `extensions/edgefab` (EDGEmat's core from the npm package `@edgemodders/edgemat-core` since 2026-11-13; before, a checkout beside this repo).
2. With the core (`dist/core.js`): `startBridge`, then `addToProject` on test 8's glowing vending machine (`vending_glow.prop.asset`) into an empty scratch project, once with each `collision`: `physical`, `box`, `none`.
3. Read the mesh and entity back (`cr2w.read`): material entries, the appearance, the physics data, the entity's components and `compiledData`.
4. The MCP server: `tools/list`, then `tools/call` `fab_add` with the prop's folder and the project.

**Expected.** Under `source\archive\<project>\props\<name>\`: the `.mesh`, the textures, a `.mi` and the `.ent`; under `source\raw\...`, the prepared GLB and `<name>.edgefab.json`. The mesh has one material entry per model material, pointing at its `.mi`, one appearance `default`, and none of the template's materials. `physical`: the mesh's physics data holds one box the prop's size; the entity has one `entPhysicalMeshComponent`. `box`: no physics data in the mesh; the entity has an `entMeshComponent` and an `entColliderComponent` with the box. `none`: the mesh component alone. Adding again replaces it. `fab_add` answers the same, and its REDbridge stops with the server.

### Run 1, 2026-11-04: passed

Bridge 0.11.0, EDGEmat's core at `a7b66a8`.

| Check | Result |
|---|---|
| `physical`, first add | 15.3 s. 10 files: the GLB, the mesh, 5 textures (color, roughness, metal, normal, glow), the `.mi`, the `.ent`, the record. The glow: EV 5.585, white, by its map |
| The mesh | One entry `vending_glow_00` (local) with `vending_glow_00.mi` as its base; appearance `default` with the material on all 3 levels; the barrel's two materials and second appearance gone; LOD distances 0, 8, 20 m. Physics: one `physicsColliderBox`, half sizes 0.426 × 0.407 × 0.9 m, centred 0.9 m up (the machine is 0.85 × 0.81 × 1.8 m), the template's `metal_hollow.physmat` |
| The entity | One `entPhysicalMeshComponent`, "Device solid visible", Kinematic; `compiledData` built (2 chunks) |
| `box`, then `none` | 15.6 s and 15.4 s, both `replaced`; the mesh's physics data removed |
| `fab_add` | Listed with `fab_make`, `fab_desk`, `fab_tripo`; 20.0 s including REDbridge's start; the same files; no REDbridge left running |

Found on the way: EDGEmat's copy of the REDbridge client is older than REDcode's (its import has no `template`), so EDGEfab calls REDbridge's methods by name through one call function.

### Run 2, 2026-11-13: passed (EDGEmat's core from npm)

After the switch to `@edgemodders/edgemat-core` 0.3.2 from npm (EDGEmat #7), in place of EDGEmat's checkout. Step 4 only, with the picture-first prop in parts: `fab_add` with `vending_e2e` (6 parts, glow 3) into an empty scratch project, `physical`, then `box`.

| Check | Result |
|---|---|
| Typecheck, build | Clean; no source from EDGEmat's checkout in either bundle (source maps) |
| `physical` | 191.5 s including REDbridge's start: 6 materials, one per part, each a `.mi` with its color, roughness, metal and normal textures, glow where the part glows (front: EV 2.585, white, by its map) |
| `box` | 185.4 s, the prop replaced |
| Afterwards | No REDbridge left running from this run; no stray output on the MCP channel |

Much slower than Run 1 (15 s) because 6 parts each convert 4 or 5 textures at up to 4096², against one material at 2048². Steps 2 and 3 (reading the mesh and entity back) not rerun: `addToProject.ts` is unchanged.

## F1 check: an added prop in the game

With [which collision is solid](#f0-check-which-collision-is-solid-in-the-game), in the same game session. **Run 1 passed, 2026-11-09**, except the normal maps' green (below).

**Built 2026-11-05** (rebuilt on EDGEmat's settled glow rule, `3086e03`). `Projects\EDGEfab_F1\tests\edgefab_f1_test.archive` (40 files, 49 MB), made by Add to Project from test 8's plain v3.1 vending machine with its painted lights made to glow (the usual amount), five times, under `edgefab_f1\props\<name>\<name>.ent`:

| Name | Collision | Glow | For |
|---|---|---|---|
| `vending_glow` | `physical` | Soft glow, strength 1 (EV 1) | The baseline |
| `vending_glow_box` | `box` | Soft glow | Which collision stops V |
| `vending_deep` | `physical` | Deep color, strength 0.25 (EV 1, color at 137) | Which strength suits painted lights |
| `vending_bright` | `physical` | Bright, strength 3 (EV 2.585) | The same |
| `vending_flipped` | `physical` | Soft glow, normal maps' green flipped | Which way the game reads normal maps, beside `vending_glow` |

**Steps** (Test timer: Start, then Mark after each step).

1. Copy the archive into the game's `archive\pc\mod` with the collision test's, start the game and load a save outdoors. Somewhere dim or at night helps the glow.
2. Claude spawns the machines in a row in front of V with REDnode, their fronts toward V.
3. Look at one: its size against V (1.8 m tall), its textures, which way its front (the lit shelves and keypad) faces.
4. Look at the glow on `vending_deep`, `vending_glow` and `vending_bright`: do the shelves, buttons and trim light up, and the body stay dark? Which looks right for painted lights, by night and by day?
5. Up close, with a light moving across them, compare `vending_glow` and `vending_flipped`: on one the panels' dents and edges look raised the right way, on the other inside out.
6. Walk into `vending_glow` and `vending_glow_box`, jump onto each, shoot each.
7. Walk 25 m away, watching the detail drop.

**Expected.** All stand on the ground at their size, textured, fronts toward V. The painted lights glow; the body doesn't. The machine whose collision works stops V, holds V on top and takes shots (the same kind as the solid drum). Its detail drops with distance. EDGEmat #6's test is this one, the normal maps' green too: their results go there.

### Run 1, 2026-11-09: passed, the normal maps' green open

Game 2.5, REDnode 0.58.0, at night, then by day; outside Embers' area (about -1940, -2800). The owner played; Claude spawned through REDnode, read V's and each entity's position and forward with `api_read`, and took screenshots with `game_image`.

| Check | Result |
|---|---|
| Size | All stand on the ground, 1.8 m tall against V |
| Facing | **Passed after a rebuild.** The first archive was built by mistake from a scratch copy of the model made before the turn was fixed (no "Turned" note, 0.81 × 0.85 m): its front pointed at the entity's +X (north for an entity spawned facing west). That is what glTF's +X maps to, so the axes are as expected. Rebuilt from the turned copy and swapped in live (`archives_reload`, 77 ms): an entity spawned facing V shows its front to V; one spawned at a position (forward +Y, north) faces north |
| Glow | Visible. At night only the orange shelf strips and keypad light, the body stays dark. **The owner: strength 3 (Bright, EV 2.585) is the most appropriate**; 0.25 and 1 are faint at night on thin painted strips |
| Collision | **Both pass:** `vending_glow` (`physical`) and `vending_glow_box` (`box`) each stop V, hold V standing on top and spark under fire. The drums (test 7) test the same two components on another mesh and were skipped |
| Levels of detail | **Passed:** walking 25 m away, the owner: "the LOD transitions look to be pretty smooth" |
| Normal maps' green | **Open.** `vending_glow` and `vending_flipped` look the same in low side light. Flipping green only changes up-and-down shading, which side light doesn't test. WolvenKit's importer doesn't touch the green channel, so the game reads it as written; which convention the game uses is to settle offline (a test normal map of a known dome, or a game texture on a known shape). On Tripo's models the difference didn't show |
| Up close | The owner: the textures look low resolution, with jaggies and rough corners. Tripo's standard 2048² texture over the whole machine, and 20,000 triangles. See [Tripo's quality settings](#f1-check-tripos-quality-settings-in-the-game) |

Also found: with nine or more similar objects spawned, the owner couldn't tell them apart or find them; neither the game's debug text (`DrawText3D`, not drawn in the release game) nor a map pin (`RegisterMappin`, minimap only) labels them in the world. Asked of REDnode as world pins ([REDnode #43](https://github.com/Edgemodders/REDnode/issues/43)). Spawning one object at a time in front of V worked for the collision checks.

## F1 check: Tripo's quality settings in the game

Which of Tripo's quality settings a prop should use, by the same prompt made several ways and seen up close in the game. Not a release test.

**Steps.** `scratchpad\quality\run.cjs` (outside the repo) makes "a cyberpunk vending machine with a glowing screen on the front" with EDGEfab's core (`makeModel` with the new `textureQuality`, `geometryQuality`, `smartLowPoly`), the key from the shared key store, never printed. Each gets its painted lights made to glow at strength 3, Add to Project (`physical`), the archive swapped into the running game, and spawned in a line with A.

### Run 1, 2026-11-09

| | Texture | Shape | Credits | Time | Triangles | In the game |
|---|---|---|---|---|---|---|
| A `vending_bright` (test 8) | 2048², standard | standard, `face_limit` 20000 | 20 | 2 min | 16,791 | Soft, painterly texture; wobbly edges, smeared vent; rough corners |
| B `vending_tex` | **4096², detailed** | standard, 20000 | **30** | 3.3 min | 17,015 | **Much sharper:** bottle labels, screws, coin unit and vent slats crisp; straight outer edges. Shelf edges still a little soft |
| C `vending_detail` | 4096², detailed | **detailed**, `face_limit` 60000 | **50** | 3.3 min | 50,927 | The most detailed: crisp bevels and buttons. The owner: still "lots of mesh imperfections and wrinkles" on flat panels; garbled AI lettering on the price strips |
| D `vending_lowpoly` | 4096², detailed | **`smart_low_poly`**, 20000 | **40** | **9 min** | 25,687 | **Broken:** see-through panels and the wrong size. Its front is the cleanest (flat panels), but the sides and back are open shells: Tripo marks the material double-sided, the game draws one side. `auto_size` is ignored: no scale on the node, about a metre tall |

Balance 1,430 before, 1,310 after (120 credits for B, C and D). `texture_quality: "detailed"` costs +10 and gives 4096² textures; `geometry_quality: "detailed"` +20; `smart_low_poly` +10. Add to Project took about 110 s with 4096² textures (15 s at 2048²); the archive grows to about 25 MB a prop.

**What it decides (proposed to the owner):** the detailed texture is the biggest gain for its cost: **B's settings as the default** (30 credits). C's as a "High detail" choice (50). D's not offered. **For prepare:** add back faces to double-sided materials, so a GLB marked double-sided (store assets, leaves, signs, D) isn't see-through in the game; and the size check catches a model with no real size.

## F1 check: parts from Tripo

How a generated prop can come back in parts, so a modder gives one part a new material with EDGEmat (owner, 2026-11-09). Not a release test. Without the game.

**Steps.** `scratchpad\parts\run.cjs` (outside the repo; the key from the shared key store, never printed), the vending machine prompt, two routes at the same time: (1) text to model v3.1 with `generate_parts` (untextured: Tripo doesn't texture parts in the same step), then `POST /v3/models/texture` on it with `texture_quality` detailed; (2) `POST /v3/mesh/segment` (model `v2.0-20260430`, granularity balanced) on B from the quality check. Each drawn textured and with each part in its own flat color.

### Run 1, 2026-11-09

| | Route 1: parts at generation, then texture | Route 2: B split afterwards |
|---|---|---|
| Credits, time | 30 + 20 = **50**, 3.2 min | **40** (on top of B's 30), 1.2 min |
| Parts | **75**, named `tripo_part_0` to `_74`, one mesh and one material each, 17,305 triangles. Front shell, back and sides, glass, keypad pieces, slot, feet, and every bottle on its own | **42**, the same naming, 17,015 triangles (B's). Front frame, sides, top vent, window frame, bottles by shelf, chute, keypad, feet |
| Texture | Its own set per part, sized to it: the body 4096², the rest 64² to 1024² (225 images) | B's 4096² cut into sets of at most 1024² (126 images): detail lost |
| Size | No real size: `auto_size` ignored with parts | B's, kept |
| Looks | Clean, the bottles lit behind the glass | Fine, a little softer than B |

**What it decides (proposed):** route 1. A game mesh can't carry 75 submeshes with three levels each and 225 textures, so EDGEfab **groups the parts** (about 6 to 10: each small part joins the large part it sits in or on, so the bottles become one group behind the glass) and **packs each group's textures into one atlas**. Each group becomes its own submesh with its own material slot, named by place and size for now ("front", "glass", "contents"...), editable. Proper names from a picture of each part come with F2's part map. The size check sets the height.

## F1 check: shape cleanup in Blender

Whether a cleanup pass takes the ripples out of Tripo's flat panels without hurting the texture (owner, 2026-11-09). Not a release test. Offline done; the game part is open.

**Steps.** `scratchpad\cleanup\cleanup.py`, run with Blender 5.2.3 (REDcode's `redcode.blenderPath`, `D:\SteamLibrary\steamapps\common\Blender`) as `blender --background --factory-startup --python cleanup.py -- <in.glb> <out.glb> <angle> <min area>`, on C (`vending_detail`, 50,927 triangles): merge vertices closer than 0.2 mm; grow regions of faces within the angle of the region's first face; for regions over the minimum area, press the inner vertices (those whose faces are all in the region) onto the region's best-fit plane, so the edges between regions and the creases stay; Limited Dissolve at 1° delimited by UV seams and materials; triangulate. Drawn lit and untextured from four sides.

### Run 1, 2026-11-09 (offline)

| Angle | Regions flattened | Vertices moved | Largest move | Triangles |
|---|---|---|---|---|
| 6° | 170 | 1,904 | 2.8 mm | 48,897 |
| **15°** | 207 | 3,532 | 19.1 mm | 48,235 |
| 25° | 213 | 4,678 | 64.2 mm (pulls real shapes flat) | 48,201 |

Under 3 seconds a run. 9,030 doubled vertices merged. At 15° **the back panel's ripple bands are gone**; some new facets show along the sides' diagonal panel lines in a drawing without smooth shading (the game smooths, so it needs the game). Only about 5% fewer triangles: the pass flattens, it barely reduces. The texture and its size came through, and prepare still knew it as Tripo's (Blender keeps the node names).

**In the game:** `vending_clean` (15°, glow 3, `physical`) is in `Projects\EDGEfab_F1` (archive 72 files, 175 MB), to swap in and compare with `vending_detail` next session.

## F1 check: picture first

Whether a picture made first by a better image model, then turned into 3D by Tripo, gives finer details than Tripo's text to model (owner, 2026-11-09, after EDGEmat's Reshape, which makes four views with GPT Image and sends them to Tripo's multiview). Not a release test. Offline done; the game part is open.

**Steps.** `scratchpad\picture\images.mjs` and `tripo.cjs` (outside the repo; the OpenAI and Tripo keys from the shared key store, never printed). GPT Image (`gpt-image-2.5-sunburst`, EDGEmat's Reshape default, quality high) draws the vending machine prompt with a hard-surface brief (flat straight panels, crisp edges, sharp fine details, soft even light, plain white background, no text): (1) one three-quarter front view, 1024 × 1536; (2) four views as one 2 by 2 sheet (front, left, back, right, orthographic, Reshape's layout), 2048 × 2048, cut into four 1024² views. Then Tripo v3.1 with `texture_quality` detailed, `face_limit` 20000, `auto_size`: (1) `image-to-model`, (2) `multiview-to-model`.

### Run 1, 2026-11-09 (offline)

| | Picture | Tripo | Result |
|---|---|---|---|
| One picture | 27 s; very crisp: cans and bottles with symbols, keypad, a city on the screen, screws, vents, flat panels | `image-to-model`, 140 s, **40 credits**, 16,222 triangles | The front follows the picture closely. The back is a blank slab and the two sides are mirror copies: Tripo guesses what it can't see |
| Four views | 33 s; the four sides consistent (the same side panel and vents from left and right, grilles and an access panel on the back) | `multiview-to-model`, 161 s, **40 credits**, 17,043 triangles | **Every side follows its view**: a consistent object all round, far closer to a designed prop than text to model's |

Both 1.8 m (`auto_size` kept), facing +X like text to model (prepare's turn applies), 4096² textures. **Shape:** the silhouette and panel layout are right, but large flat panels are faceted (big, slightly tilted triangles), the back most. The Blender cleanup at 15° helps the sides, not the back's facets: a box-like prop would need its main planes found and vertices near them pressed onto them, a stronger pass to try. The pictures' cost: GPT Image's usage was 1,372 and 3,568 output image tokens (the price per token unverified).

**In the game:** `vending_picture`, `vending_views` and `vending_views_clean` (glow 3, `physical`) are in `Projects\EDGEfab_F1` (archive 96 files, 266 MB), to compare with B and C next session.

**What it suggests (proposed):** Generate becomes picture first, then 3D: the modder sees the four views in seconds and for little, changes the words, and only then pays Tripo for the model. Four views over one picture.

## F1: keys in VS Code's secret storage (EDGEfab #4)

The extension keeps its Tripo and OpenAI keys in VS Code's secret storage, the MCP server reads its environment only, and nothing in the package decrypts key files through PowerShell (the likely reason the Marketplace refused EDGEhack). A release test: rerun before each release.

**Steps.**

1. `npm run build`, then `npm run edgefab:package`. Unzip `dist/edgefab-<version>.vsix` and search every file for `ConvertTo-SecureString`, `SecureStringToBSTR` and `powershell` (any case), and for files named like `keys`.
2. Start `packages/edgefab-mcp/dist/server.cjs` with `TRIPO_API_KEY` and `OPENAI_API_KEY` unset, and call `fab_tripo` (status) and `fab_picture`.
3. In VS Code (F5, or the installed `.vsix`): **Set Tripo Key** and **Set OpenAI Key** (password boxes; a key without `tsk_` or `sk-` is refused in words). Generate from Words: no key asked again; the picture and Make 3D work. **Clear OpenAI Key**: Generate asks for it again. Restart VS Code: the keys are still there.

**Expected:** no match in step 1. In step 2, both keys "not set", saying how to set the server's environment, and `fab_picture` refused in plain words. In step 3, the keys kept across restarts, cleared on Clear.

### Run 1, 2026-11-11: steps 1 and 2 passed; step 3 open

| Step | Result |
|---|---|
| 1 | `edgefab-0.1.0.vsix`, 11 files: **no match**, no key files. Built against EDGEmat's working copy, which was mid-way through the same change (its `keys.mjs` deleted, not yet committed). Built against EDGEmat's last commit instead, the bundles still had a `powershell.exe` path from EDGEmat's `keys.mjs` (the decryption strings themselves tree-shaken out): rerun once EDGEmat commits |
| 2 | `fab_tripo`: "not set: the user sets TRIPO_API_KEY in this server's environment...", the same for OpenAI; `fab_picture` refused: "No OpenAI API key. In VS Code, set one with EDGEfab: Set OpenAI Key; for the MCP server, set OPENAI_API_KEY in its environment." |
| 3 | Not run: needs VS Code (the owner's test on the laptop, with the other Desk commands) |

### Run 2, 2026-11-12: step 1 passed

Step 1 again, after EDGEmat committed its keys change (`aeda9c1`, EDGEmat #10; its working copy clean, so the build is its HEAD): `edgefab-0.1.0.vsix`, 11 files, **no match**, no key files. Steps 2 and 3 not rerun (2 unchanged since Run 1; 3 is still the owner's).

## F1: picture first and parts (without the game)

Generate from Words as built (core `picture.ts`, `parts.ts`, Tripo's multiview with `generate_parts` and the texture step, Set Size), through the MCP server as an assistant uses it. A release test: rerun before F1's release.

**Steps.**

1. Build (`npm run build`). In `scratchpad\e2e\mcp.cjs` (outside the repo), start `packages/edgefab-mcp/dist/server.cjs` on stdio and call `fab_tripo` (status), then `fab_picture` with "a cyberpunk vending machine with a glowing screen on the front" (the OpenAI key from the shared key store, never printed). Look at the sheet: four views of one object.
2. `fab_make` with `from: "picture"`, the item, `detail: "standard"`, `parts: true`, `height: 1.8`, `plan` as the modder's. About 60 credits and 4 minutes.
3. `fab_glow` paint at strength 3; `fab_size` to 1.85 and back to 1.8.
4. Draw the prepared `view.glb` textured and with each part a flat color (`scratchpad\parts\colorize.cjs`, `t8\views.cjs`).
5. Add to Project (`scratchpad\add\run.cjs`) into `Projects\EDGEfab_F1`, then pack into its `tests` folder.

**Expected:** a 2048² sheet in under a minute; the model true to the four views, standing 1.8 m tall, in at most 10 named parts, each with one material and one set of textures; no stray output on the server's stdout; one `.mi` per part in the project.

**Checks on the way, 2026-11-09 and 10** (`scratchpad\mvparts`): multiview to model takes `generate_parts` (40 credits, 107 s, 79 pieces, untextured, no real size: `auto_size` ignored as with text), then `/v3/models/texture` with the detailed texture (20 credits, 101 s, one texture set per piece: 237 images). Prepare grouped the 79 pieces into 5 parts in 13 s: the shell, the back panel, the display (its back wall, shelves and cans), the base with the back grill, and small trims; Tripo's text-to-model parts (75 pieces) into 3. The atlases keep the texture as sharp as Tripo's. Found on the way: single-linkage clusters chained the whole front together (fixed: a small piece joins the tightest large piece whose box holds it, unless that is the outer shell); "body" named by the largest group rather than the largest piece (fixed); back faces added before simplifying locked the simplifier, so the levels of detail didn't shrink (fixed: added per level after simplifying, decided once per part on level 1). All Tripo's parts are marked double-sided, so back faces go only to parts open on one side.

### Run 1, 2026-11-10: passed after a fix

| Step | Result |
|---|---|
| 1 | `fab_tripo`: key set, 1,080 credits, plan not recorded on this PC (the run passed `plan: "paid"`, the owner's Pro plan). `fab_picture`: 39 s, a consistent four-view sheet (cans behind lit glass, keypad, a screen, the side door and vents on both sides, back panels and grilles) |
| 2 | First try: `fab_make` refused without a plan, as it should. Second: Tripo 60 credits (balance 1,080 to 1,020), then **failed in prepare**: glTF-Transform's `prune` printed "prune: Removed types..." to stdout, the MCP channel, and the client broke. **Fixed:** every `NodeIO` gets a quiet logger (warnings to stderr only, core `quiet.ts`), and the server sends `console.log` to stderr. The kept `original.glb` then went through the fixed server (`fab_make` from `file`): clean |
| 2, finished | Prepared in place (`scratchpad\e2e\finish.cjs`, the record marking the task ids as not kept): 70 pieces into **6 parts**: front (the display, 40 pieces, 31% of the surface), body (the sides), back, middle (the front frame), base (the back grill), details (chute, keypad column, trim); 1.8 m; back faces on 5 open parts; 54,063 triangles over three levels |
| 3 | Glow painted at 3 (the display 2%, the frame 6% of their textures). `fab_size` through the server: 1.85 m (0.99 x 0.78), then 1.8 m again, its width and depth back to the same |
| 4 | The model follows the four views on every side; the parts as listed |
| 5 | One `.mi` and its textures per part. Archive 133 files, 317 MB |

**In the game: open.** `vending_e2e` joins `vending_picture`, `vending_views`, `vending_views_clean` and `vending_clean`, to compare with B and C. Each one gets a world pin from the `edgefab-pins` test package (REDnode 0.59.0's `world.pin`).

## F1: the glow on a Desk item (without the game)

Make the Painted Lights Glow, Glow Strength and Stop the Glow, through the core and MCP's `fab_glow`. No game, no REDbridge, no credits.

**Steps.** On a copy of test 8's plain vending machine: paint at each amount (0.25, 0.5, 0.75), set strength 0.25 and 0.1, turn it off, set a strength with no glow, paint again. Read `prepared.json` and `view.glb`. Then Add to Project with each strength, and add one prop twice with its material name changed.

**Expected.** More amount lights more. A strength under 0.125 gets a note. Off removes the map and the glow; a strength with no glow says so. `view.glb` has the map, factor and strength. The project's material follows EDGEmat's rule. Adding again leaves only the new files.

### Run 1, 2026-11-05: passed

| Check | Result |
|---|---|
| Paint | 0.4 s each on a 2048² JPEG. 5.3%, 15.8% and 29.4% of the texture; the usual amount matches the prototype's 15.8% (test 8) |
| Strength, off | As expected, with the note at 0.1. `glowOff` removed `_emissive.png` |
| `view.glb` | `emissiveFactor` 1, an `emissiveTexture`, `KHR_materials_emissive_strength`, 4 images |
| In the project | Strength 1: EV 1, color 255. Strength 0.25: EV 1, color 137. Strength 3: EV 2.585, color 255 |
| Adding again | 8 archive files per prop, none left from an earlier material name (a record lists what each Add wrote, and only those files go) |
| `fab_glow` | Listed; paint, strength, off, and a plain error for a strength with none given |

**Not yet tried:** the three commands in VS Code; the glow in REDcode's 3D view; the glow in the game.

## F1 check: Tripo's model and its front

Which Tripo model F1 asks for, and which way Tripo's models face, on a prop with a front. Not a release test.

**Steps.** Scripts in a session's scratchpad, outside the repo: `run.cjs` reads the `tripo` key from the shared key store (never printed) and makes "a cyberpunk vending machine with a glowing screen on the front" three ways: (A) `v3.1-20260211` with `face_limit` 20000, (B) `P1-20260311` with `face_limit` 20000, both with `texture`, `pbr` and `auto_size`, at the same time; (C) `POST /v3/mesh/decimate` on A's task (`model` "v2.0", `face_limit` 20000, `bake` true). `views.cjs` draws each GLB from four sides (from +X, −X, +Z, −Z of glTF's axes, textured, orthographic). Then `npm run smoke` on each.

**Expected.** Three textured models at real size; the front on the same side in each; each passes the smoke test.

### Run 1, 2026-11-04: passed

| | A: v3.1, `face_limit` | B: P1 | C: A, retopology with bake |
|---|---|---|---|
| Time, credits | 127 s, 20 | 95 s, 40 | 313 s, 30 (on top of A's 20) |
| Size (`auto_size`) | 1.80 m tall, 0.82 × 0.85 m | 1.80 m, 0.81 × 1.08 m | 1.80 m, 0.81 × 0.84 m |
| Triangles, vertices | 16,791, 12,455 | 17,909, 29,512 (many UV seams) | 20,356, 20,662 |
| Front | **+X** | **+X** | **+X** |
| Looks | Clean: glowing shelves, keypad, slot; plain sides and back | Bottles on shelves, but the screen on a side, a blurred smudge baked on the back, a brown body | A's shape, but smeared texture patches on the sides from the bake |
| Smoke test | ok, 3 LODs | ok | ok |

Balance 1,520 before, 1,430 after (110 credits, which matches the three).

**What it decides for F1:** **v3.1 with `face_limit` stays the default**: the cheapest and the cleanest. P1 and retopology aren't used for now. **Text to model faces +X** as multiview does, so prepare turns every Tripo model to the game's forward. The front's side can't be told from an imported GLB, so imported models keep their facing and the modder turns them (F2's size and placement on the page).

**Also found:** a task made with one Tripo key answers 404 to another key, even on the same account (the laptop's vending machine could not be read from the PC). So a take or an edit records which key made it (a short fingerprint, never the key).

## F0 check: Tripo text to model

What Tripo returns for a prop, so F1's prepare step and EDGEmat #4 are built for it. Not a release test.

**Steps.** Two scripts, kept outside the repo (a session's scratchpad): `tripo-check.mjs` reads the `tripo` key from the shared key store through REDnode's `tools/keys/keys.mjs` and never prints it. It creates one task with `POST https://openapi.tripo3d.ai/v3/generation/text-to-model`, polls `GET /v3/tasks/<id>`, and downloads the output URLs. `glb-inspect.mjs` lists a GLB's nodes, meshes, triangles, materials and images.

1. `node tripo-check.mjs <outDir> "a rusty oil drum"` (model `v3.1-20260211`, `texture` and `pbr` on, no other options).
2. `node glb-inspect.mjs <outDir>/model_url.glb`.
3. Again with `'{"face_limit":20000,"auto_size":true}'` as a third argument.

**Expected.** A textured GLB within a few minutes, its credits shown, and a balance lower by that amount.

### Run 1, 2026-10-31: passed

| | Without options | `face_limit` 20000, `auto_size` |
|---|---|---|
| Time, credits | 133 s, 20 credits | 117 s, 20 credits (the limit costs nothing extra) |
| Download | 45.1 MB GLB, a WebP preview, the JPEG image Tripo made first from the words | 3.7 MB GLB, the same two images |
| Geometry | 1 node, 1 mesh, 1 primitive: **1,445,348 triangles**, 736,445 vertices; `POSITION`, `NORMAL`, `TEXCOORD_0`; 32-bit indices | **19,021 triangles**, 10,980 vertices |
| Size | 0.70 × 1.00 × 0.70, Y up, centered: scaled to 1 unit tall | The same mesh bounds, with a node `matrix` scaling by 0.65: `auto_size` sets real size (0.65 m tall) on the node, not in the vertices |
| Material | 1: `baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`; factors 1 | The same |
| Images, all 2048 × 2048 | `Color` JPEG, `ORM` JPEG (glTF's packing: occlusion, roughness, metal), `NormalGL` PNG (green up) | The same |
| Extensions | None | None |
| Looks | A good rusty drum (preview) | As good at 19,021 triangles |

**What it decides for F1:**
- Ask Tripo for a `face_limit` (20,000 or so) rather than reducing 1.4 million triangles at home. EDGEfab's prepare step still makes the LODs and checks the 65,535 limit for imported GLBs.
- Apply the node transforms when preparing, since `auto_size` puts the real size on the node.
- The textures are the set EDGEmat #4 asks for. The normal map is OpenGL (green up), as Tripo's name for it says.

**Also found:** Tripo's v2 API shuts down on 2026-10-31. Only v3 (`openapi.tripo3d.ai`, `/v3/...`) is used. Its model names for text to model: `v3.1-20260211`, `v3.0-20250812`, `v2.5-20250123`, `P1-20260311`, `P2-20260801` (from Tripo's MIT Python SDK, `docs/API.md`). **Terms:** the owner is on Tripo's Pro plan, a paid plan, so the models are the owner's ([plan](plan.html#licenses-travel-with-the-asset), read 2026-11-01). **Still open:** the price of a task with `texture_quality` `detailed`.

## F0 check: a GLB imported over a game prop

Whether WolvenKit's importer (through REDbridge) makes a game mesh from a Tripo GLB, with LODs, over a game prop's mesh; and how game props get their collision. Not a release test. Done without the game; the in-game part is still open.

**Steps.** Scripts in a session's scratchpad, outside the repo:

1. `prep.mjs` (glTF-Transform 4.5.1, mikktspace 1.1.1, meshoptimizer 1.3.0, all MIT) on run 2's GLB (19,021 triangles): bake the node transform, put the base at height 0 and centre it, make LODs by simplifying (`submesh_00_LOD_1` full, `LOD_2` 50 %, `LOD_4` 20 %), generate MikkTSpace tangents.
2. REDbridge 0.11.0 (WolvenKit 10.0.0, game 2.5) `project.import` of the GLB into a scratch project, with `template` `base\environment\decoration\containers\barrel\drum\barrel_drum_a.mesh`. `bridge-call.mjs` runs REDbridge directly, so its log shows (the MCP tool shows only `ok`).
3. Read the new `.mesh` with `cr2w_read`; read three game props' `.ent` files and the barrel's `.mesh`.

**Expected.** A `.mesh` with three LOD submeshes at the GLB's size, standing on its base.

### Run 1, 2026-11-01: passed (without the game)

| Found | Detail |
|---|---|
| **Tangents are required** | Tripo's GLB as it comes is refused: "One or more geometry entries in GLTF do not contain Tangents data" (the MCP tool returned `ok: false` and the template copied, nothing more). The prepare step must make tangents |
| **Node transforms are ignored** | The importer reads vertex positions as they are and only turns Y up into Z up. `auto_size`'s scale on the node is lost unless the prepare step bakes it |
| **One primitive per mesh**, and the limit is **65,535 vertices per submesh** (not triangles) | Read from WolvenKit's importer. Each GLB mesh becomes one submesh; a mesh's name and its node's name should match |
| **LODs come from the names** | A mesh named with `LOD_1`, `LOD_2`, `LOD_4` or `LOD_8` (one bit per level; `LOD_1` required). Result: 3 submeshes, LOD masks 1, 2, 4 (10,980, 6,307, 3,151 vertices). The template's LOD distances are kept (0, 8, 20 m), cut or extended to the number of levels |
| **The pivot** | Tripo's model is centred. Moved so its base is at 0: bounding box Z 0 to 0.65 m, X and Y ±0.21 m |
| **The template's leftovers** | The barrel's two material entries (multilayered, `ml_barrel_drum_a_masksset` and a clean one), its two appearances and its collision stay. Every submesh uses the barrel's material, which would draw wrongly on Tripo's UVs, so Add to Project must replace the materials (EDGEmat #4) and remove the collision parameter |
| **Garment support** | On by default in WolvenKit's import arguments and not exposed by REDbridge; with no garment data it only warns. Harmless for props |
| **How game props are solid** | Three game prop entities (`sq021_barrels.ent`, `mq034_barrel.ent`, `q105_fluff_barrels.ent`) use an `entMeshComponent` and an **`entColliderComponent` with a `physicsColliderBox`** (preset "Device solid visible" or "World Dynamic", `Kinematic`). One (`q301__barrel_drum_destroyed.ent`) uses an `entPhysicalMeshComponent`, which takes its shape from the mesh's `meshMeshParamPhysics`: there, a `physicsColliderConvex` held only as cooked PhysX data (`compiledGeometryBuffer`, 692 bytes, no plain vertices) |

**What it decides for F1:** the prepare step does tangents, transforms, pivot, LOD names and the vertex limit. EDGEfab cannot cook PhysX shapes, so collision is made of shapes that need no cooking (box, capsule, sphere), fitted to the model. **Still open, in the game:** which of two ways is solid when spawned and when baked by EDGEbuilder: (A) an `entColliderComponent` with a fitted box, as the game's props do, or (B) an `entPhysicalMeshComponent` whose mesh's physics data holds a fitted box instead of the template's cooked shape (EDGEfab #2's shape). And whether the mesh looks right and switches LODs.

## F0 check: which collision is solid in the game

The two ways left open above, side by side, on F0's drum. Not a release test. Built 2026-11-04. **Settled 2026-11-09 by the vending machines instead** ([an added prop in the game](#f1-check-an-added-prop-in-the-game)): the same two components, `entPhysicalMeshComponent` with a box in the mesh and `entColliderComponent` with a box, made by Add to Project; **both are solid** (they stop V, hold V on top, stop bullets). The drums were spawned but not walked into.

**Built.** A test project `Projects\EDGEfab_Collision` (outside this repo). Its archive `tests\edgefab_collision_test.archive` (4 files) holds, under `edgefab_test\collision\`:

| | Entity | Mesh |
|---|---|---|
| **A** | `drum_a.ent`: an `entMeshComponent` and an `entColliderComponent` with a `physicsColliderBox` (half extents 0.214, 0.214, 0.325 m, raised 0.325 m), preset "Device solid visible", `Kinematic`, as `sq021_barrels.ent` has | `drum_a.mesh`: F0's imported drum with its physics data taken out |
| **B** | `drum_b.ent`: one `entPhysicalMeshComponent`, filter from the component ("Device solid visible", `Parent`), `Kinematic`, as `crate_red.ent` has | `drum_b.mesh`: the same drum, its `meshMeshParamPhysics` holding the same box instead of the template's cooked convex shape |

Both meshes keep the game barrel's material, so the drums may draw wrongly: this test is about collision and LODs only. Made from WolvenKit JSON with REDbridge's `cr2w.fromJson`, then `project.pack`.

**Steps** (Test timer: Start, then Mark after each step).

1. Copy the archive into the game's `archive\pc\mod` (or add it with EDGEdeck), start the game and load a save outdoors.
2. Spawn A and B two metres apart in front of V (REDnode `world.spawn` with each `.ent`, from Claude Code).
3. Walk into each, then jump onto each.
4. Shoot each.
5. Walk 25 m away, watching each drum's detail (LODs at 0, 8 and 20 m).
6. Later, in EDGEbuilder: place each in a scene and bake it, then walk into each again.

**Expected.** Each drum stands on the ground at its size. One or both stop V; the one that does is F1's collision (EDGEfab #2 asks for B). Its detail drops as V walks away.

## F5a check: a game animation through REDbridge

What REDbridge does with a game `.anims` today, before asking it for the rest ([REDbridge #14](https://github.com/Edgemodders/REDbridge/issues/14)). Not a release test. Without the game.

**Steps.**

1. Extract `base\animations\quest\main_quests\prologue\q001\q001_00c_rescuing_girl\anim\synced\synced__q001_00c__trauma_pack.anims` into a scratch project's `source\archive` (`archive_extract`).
2. `project.export` it to `source\raw`.
3. Read the GLB's JSON: nodes, skins, animations and their lengths.
4. `project.import` the GLB back.

**Expected.** Step 2 writes `<name>.anims.glb` with the rig and every clip. Step 4 writes the `.anims` again.

### Run 1, 2026-11-04: export passed, import refused

Bridge 0.11.0 through the `redcode` MCP server, game 2.5.

| Step | Result |
|---|---|
| 2. Export | `synced__q001_00c__trauma_pack.anims.glb`, 43 KB: 6 nodes (`Armature`, `Root`, `base`, `Trajectory`, `open`, `handle`), 1 skin, no mesh |
| 3. Clips | `synced__q001_00c_trauma_arrives_med_2__trauma_pack` 7.83 s and `synced__q001_00c_trauma_leaves__trauma_pack` 27.33 s, 10 channels each (translation, rotation), the lengths EDGEquest found. Each has WolvenKit's `wkit.cp2077.gltf.anims` v5 extras: `animationType` Normal, `rootMotionType`, `animEvents`, track keys |
| 4. Import | Refused: "There is no mesh at ... `.anims.mesh` to import over". REDbridge takes every GLB as a mesh; WolvenKit's `ImportAnims` is not reached. Asked in REDbridge #14 |

`project.export` needs the file as a full path on disk (a game path under `archiveDir` gave "File not found").
