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

**Expected.** The smoke test prints `ok`: three LODs, each part with `POSITION`, `NORMAL`, `TEXCOORD_0`, `TANGENT` and at most 65,535 vertices, the base at height 0, three texture files. REDbridge returns `ok: true` with 3 submeshes. The server lists `fab_make`, `fab_made`, `fab_tripo`.

### Run 1, 2026-11-01: passed

| Model | Time | Result |
|---|---|---|
| Tripo, `face_limit` 20000 | 0.2 s | 0.65 m tall; LODs 19,021 / 9,510 / 3,794 triangles (10,980 / 6,307 / 3,151 vertices); color, ORM and normal written out. REDbridge: `ok`, 3 submeshes |
| Tripo, no limit (1,445,348 triangles) | 2.7 s | Simplified to 77,908 triangles (49,850 vertices) to fit, with a note saying so; LODs 77,908 / 38,954 / 15,572 |
| MCP server | | Started; lists `fab_make`, `fab_made`, `fab_tripo` |

Found on the way and fixed before this run: glTF-Transform's `normals()` unwelds every mesh, and `prune()` drops UVs and tangents once the textures are out of the GLB (REDbridge then refused it for missing tangents).

**Not yet tried:** the extension in VS Code (Import a GLB, Generate with Tripo, the Made view), and `fab_make` with Tripo through the MCP server. Both spend nothing new until a Tripo generation (20 credits).

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
