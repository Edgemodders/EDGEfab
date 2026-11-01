---
title: Library assets
---

# Assets in the EDGE <span class="y">Library</span>

**Status: the Library is in F1, decided by the owner on 2026-10-31. The asset item below is a proposal**, to agree with EDGEbuilder (which keeps the Library's shared rules), REDcode and EDGEmat. Anything not yet checked is marked unverified.

## Why

The owner, 2026-10-31:

> Include the Library now: it will be a key shared resource for working across the tools, between projects. Something is found in REDcode's game assets and put in the Library. EDGEfab modifies it, and it stays in the Library. Several projects can pull that resource in from the Library, for different reasons, since the Library lives outside projects. It's optional, but useful for some workflows.

The Library itself is [EDGEbuilder's Library](https://edgemodders.github.io/EDGEbuilder/library.html), agreed there on 2026-10-29. It's one root folder for the EDGE platform, kept in `%APPDATA%\EDGE\library.json` (`{ "root": ... }`), with the modder's own folders. Its items describe themselves, and anything copied into a project records where it came from. EDGEbuilder keeps scenes and bakes there. This page adds **assets**: meshes, props and later garments and characters, which several tools find, make and change.

## Desk and Library

The owner, 2026-10-31: a Desk is one tool's own scratch workspace. The Library is the long-term store of reusable objects, shared across tools and projects.

| | A Desk | The Library |
|---|---|---|
| What it is | One tool's scratch workspace for the work in hand | The modder's long-term store of reusable objects |
| Shared | No: each tool's own (EDGEmat has one; other tools may get one, not decided) | Yes: one root for every EDGE tool |
| Lasts | Across restarts, but not organised or kept for good | For good, in the modder's own folders |
| Feeds | A project, or the Library | Any number of projects |

So an asset item only borrows the Desk's folder layout (below); it is not a Desk entry. Whether EDGEfab gets a Desk of its own is open, as for the other tools.

## Folders and what goes in them

The owner, 2026-10-31: the modder makes the Library's folders, and they need not follow game paths. For example, `Production/Meshes` and `Development/Meshes`, holding reusable meshes: game assets, or third-party meshes to convert later.

And, the same day: when adding an asset to the Library (any tool's Library), the modder can choose to **use the asset's game path as its folder**, created if it is missing, so the Library can be browsed in the computer's file system the same way as the game's files.

| Rule | In practice |
|---|---|
| The folders are the modder's | EDGE tools never create `meshes/` or game-path folders in the Library on their own. They offer the folder the modder last used |
| **Use the game path**, the modder's choice | Every Add to Library (REDcode, EDGEfab, and any other tool that adds items with game paths) offers it beside the folder picker. The item goes in the folders of its main file's game path, under the folder picked (the root unless another is picked), each folder made if missing: `base\gameplay\...\comfy_rocker.mesh` becomes `<folder>\base\gameplay\...\comfy_rocker.mesh.asset\`. The tool remembers the choice for next time. Items without a game path (plain model files, scenes, bakes) don't offer it |
| Game paths inside an asset item | An item's `source/archive` holds its files at their game paths, whichever folder it sits in. The Library view shows the item as one object with its name |
| Plain files are items too | A GLB, FBX, `.blend` or images that the modder keeps to convert later sit in any folder as they are, known by their extension, as the Library's rules allow |
| An asset item is what EDGE tools make | A game asset with the files it needs, or a converted prop, is a `<name>.<kind>.asset` folder (below), because one game object is several files |

| Kept in the Library | Becomes |
|---|---|
| A third-party `model.glb` in `Development/Meshes` | EDGEfab's **Make a prop** on it writes `model.prop.asset` next to it, or in a folder the modder picks (`Production/Meshes`). The GLB stays, and the asset records it as its source |
| A game mesh added from REDcode | `comfy_rocker.mesh.asset`, with the mesh, its materials and textures, in the folder the modder picks |
| The same, with **Use the game path** | The same item, in `base\...\` folders matching the mesh's game path, under the folder picked |
| A made prop, with **Use the game path** | Its new game path (`<modder>\<asset>\...`, below) gives the folders. If the item's game path changes later (a game asset made new), the tool offers to move the item to match |

## The flow

| Step | Where | What happens |
|---|---|---|
| **Find** | REDcode's Game Assets (or a project's files) | **Add to Library** copies a game file, with the files it needs (a mesh's materials and textures), into a new asset in a Library folder the modder picks |
| **Make** | EDGEfab | A GLB (from disk, from a Library folder, or generated by Tripo) becomes a new asset (F1) |
| **Change** | EDGEfab, and later EDGEmat | Open the asset, change it (make it a prop with collision and LODs, give it new materials), and it stays in the Library, one version up |
| **Use** | Any project | **Add to Project** copies the asset's game files into the project, with a note of the asset and version they came from. Several projects can take the same asset |
| **Refresh** | A project | Shows the assets that changed in the Library since they were added, and copies the new version on request |
| **Place** | EDGEbuilder | As today: pack and install the project, then place the asset from the project or its archive (B2c). An asset in no deployed archive is "not in the game yet", a flag the Library page already names |

**Optional throughout.** Without a Library root, EDGEfab builds straight into the open project, as before.

## The asset item (proposed)

A folder that describes itself, laid out like a small project:

```
<name>.<kind>.asset/      for example rusty_oil_drum.prop.asset, comfy_rocker.mesh.asset
  asset.json
  source/archive/...   the game files, at their game paths
  source/raw/...       what they were made from: the GLB, images, exports
```

- **The same layout as a REDcode project's**, and as EDGEmat's Desk entries (`desk\items\<id>\source\archive`), though the Desk is scratch and the Library is the long-term store. So each tool's project code works on an asset as it is.
- **REDbridge works on it as it is.** Its `project.import` takes any `rawDir` and `archiveDir`. That was read from REDbridge's code, not yet tried.
- **The name carries the kind** (owner, 2026-10-31): `<name>.<kind>.asset`. A search or filter for `mesh` finds every mesh asset, in any folder, as `.glb` finds the model files. The `.asset` ending marks an item, as `.bake` does for EDGEbuilder's bakes, since the modder's folders are free.
- **Kinds:** a game asset takes its main file's type (`mesh`, `ent`, `app`, `mi`, `mlsetup`, `xbm`). EDGEfab's own kinds are `prop`, later `garment`, `character`. Lowercase, one word.
- **When the kind changes** (a game mesh made into a prop), the tool renames the folder (`comfy_rocker.mesh.asset` to `comfy_rocker.prop.asset`) and sets `kind` to match. Projects find it again by its `id`, not its folder.

### `asset.json`

| Field | Holds |
|---|---|
| `format` | 1 |
| `id` | A random id, made once and never changed, so projects and other assets find the item after it is renamed or moved |
| `name` | The modder's name for it, such as "Rusty oil drum" |
| `kind` | The same as in the folder name. If the two differ, the folder name wins and the tool fixes the file |
| `main` | The game path of the file a tool opens or places (a prop's `.ent`, a mesh's `.mesh`) |
| `version` | A whole number, raised by each change |
| `from` | Where it started: a game path and game version, a file, a Tripo task (id, prompt, plan), another asset |
| `license` | The terms it carries: the game's (for modding), Tripo's (paid plan: the modder's own; free plan: Tripo's), the modder's own work, a Fab listing |
| `history` | One line per change: the tool, what it did, the date |
| `tools` | The game, REDbridge and tool versions of the last build |

A project's note of what it took, in its own folder (proposed): `source/library.json`, with each asset's `id`, its path relative to the Library root (a hint, for speed), its version, and the files copied. The Library page's rule that "came from" notes are relative to the root keeps them working after a Relocate.

### Game paths

| Case | Proposed |
|---|---|
| An asset from the game, not yet changed | Keeps the game's paths. Added to a project as it is, it replaces the game's file, which is sometimes the point (a retexture) |
| The first change by EDGEfab | EDGEfab offers to **make it a new asset**: its files move under a folder of the modder's own (`<modder>\<asset>\...`, lowercase, no spaces) and the references inside them are changed to match. How the references are rewritten is unverified (REDbridge's `cr2w.patch` on resource paths is the likely way) |
| A made asset (GLB, Tripo) | New paths from the start, under the same folder |
| The same asset in two deployed mods | The same files twice: the earlier archive wins (EDGEdeck's `modlist.txt`), harmless while both carry the same version. Different versions are flagged when the projects are packed (unverified how) |

## Who does what

| Tool | Its part | How |
|---|---|---|
| **EDGEfab** | Asset items: make, change, its Library view (the modder's folders with their assets and model files, open, Make a prop, Add to Project, Refresh). The first tool to need the Library may ask where to put it, offering `Documents\EDGE Library` | F1 |
| **REDcode** | **Add to Library** on a file in Game Assets or a project, with the files it needs, and the **Use the game path** choice | [REDcode #19](https://github.com/Edgemodders/REDcode/issues/19), filed 2026-10-31. Doesn't block F1: F1's assets come from GLBs |
| **EDGEbuilder** | Keeps the Library's shared rules (its Library page says they move to the platform's wiki once a second tool uses the Library; EDGEfab is the second). Its scenes and bakes; later its Browse and sector view may list Library assets | [EDGEbuilder #4](https://github.com/Edgemodders/EDGEbuilder/issues/4), filed 2026-10-31: assets in the shared rules, one came-from note per project; the **Use the game path** choice added there on 2026-10-31 |
| **EDGEmat** | Later: a Desk entry saved to the Library, and new materials and looks on a Library asset | When EDGEmat gets there |

## Open

| Question | Notes |
|---|---|
| Variations | EDGEmat's Desk keeps variations of one mesh. In the Library, a variation could be a copy of the asset made by the modder, or a field. Proposed: a copy, so each stays simple |
| Rewriting references when an asset becomes new | Unverified; F0 checks it with REDbridge |
| What Add to Library takes along from the game | A mesh's materials and textures, yes. Game-wide shared files (base materials, templates) stay in the game and are referred to, not copied (proposed) |
