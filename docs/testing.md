---
title: Tests
---

# Tests

Every test of EDGEfab, with the steps to run it again, what should happen, and each run's result. Add a test here when it is first run. **Release gate (the owner's rule):** no release until every test of the builds since the last release has passed. Untested or failed stops it.

In-game steps start with the Test timer: switch on REDnode's **Test timer** app, press **Start**, and press **Mark** after each numbered step, so log lines can be tied to steps.

No tests of EDGEfab's own code yet: it comes with F1 ([build plan](plan.html)). F0's checks are below.

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

**Also found:** Tripo's v2 API shuts down on 2026-10-31. Only v3 (`openapi.tripo3d.ai`, `/v3/...`) is used. Its model names for text to model: `v3.1-20260211`, `v3.0-20250812`, `v2.5-20250123`, `P1-20260311`, `P2-20260801` (from Tripo's MIT Python SDK, `docs/API.md`). **Still open:** Tripo's terms for the owner's plan, and the price of a task with `texture_quality` `detailed`.
