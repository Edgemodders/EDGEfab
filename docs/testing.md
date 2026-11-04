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

1. `npm run build` in `extensions/edgefab` (it needs EDGEmat's checkout beside this repo, [Dev setup](dev-setup.html)).
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

## F1 check: an added prop in the game

With [which collision is solid](#f0-check-which-collision-is-solid-in-the-game), in the same game session. Not run yet.

**Built.** `Projects\EDGEfab_F1\tests\edgefab_f1_test.archive` (16 files, 19 MB), made by Add to Project: test 8's glowing vending machine twice, `edgefab_f1\props\vending_glow\vending_glow.ent` (`physical`) and `edgefab_f1\props\vending_glow_box\vending_glow_box.ent` (`box`).

**Steps** (Test timer: Start, then Mark after each step).

1. Copy the archive into the game's `archive\pc\mod` with the collision test's, start the game and load a save outdoors. Somewhere dim or at night helps the glow.
2. Claude spawns both machines three metres in front of V with REDnode, their fronts toward V.
3. Look at each: its size against V (1.8 m tall), its textures, which way its front (the lit shelves and keypad) faces.
4. Look at the glow: do the shelves, buttons and trim light up, and the body stay dark? Too bright, too dim?
5. Walk into each, jump onto each, shoot each.
6. Walk 25 m away, watching the detail drop.

**Expected.** Both stand on the ground at their size, textured, fronts toward V. The painted lights glow; the body doesn't. The machine whose collision works stops V, holds V on top and takes shots (the same kind as the solid drum). Its detail drops with distance. EDGEmat #6's test is this one: its result goes there.

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

The two ways left open above, side by side, on F0's drum. Not a release test. Built 2026-11-04; **not run yet** (needs the game on the PC).

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
