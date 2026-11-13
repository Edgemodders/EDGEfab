# @edgemodders/edgefab-core

EDGEfab's core as a library, for other EDGE tools: a textured GLB (or a model made from words) prepared as a Cyberpunk 2077 prop, then put into a WolvenKit project or the EDGE Library. It is the code behind the [EDGEfab](https://edgemodders.github.io/EDGEfab/) extension and its MCP server, with no VS Code imports. The first user is EDGEbuilder's Import a model, which runs it in a REDnode Node mod ([EDGEfab #5](https://github.com/Edgemodders/EDGEfab/issues/5)).

One CommonJS file with `.d.ts` types; `import` works too. Node 20 or later. glTF-Transform, meshoptimizer, mikktspace (its WebAssembly inlined), jpeg-js and pngjs are bundled in, so a tool that bundles this package again needs no plugins; their licenses are in `dist/THIRD-PARTY-NOTICES.txt`. EDGEmat's core (`@edgemodders/edgemat-core`, for the materials) is a dependency.

## Use

```ts
import { addToProject, deskItem, makeModel, projectFolders, readItem, setSize, DefaultCollision } from "@edgemodders/edgefab-core";

// 1. A GLB onto EDGEfab's Desk, prepared: real size, standing on its base, three levels of detail, its textures.
const made = await makeModel({ from: "file", file: "C:\\models\\drum.glb", name: "Rusty drum" }, { version: "EDGEbuilder 0.5.0" });
if (made.prepared.sizeUnknown) await setSize(made.folder, 1.1, { version: "EDGEbuilder 0.5.0" });

// 2. Into a project: the mesh, its materials and the .ent with collision. `call` is any REDbridge's call function.
const project = projectFolders("C:\\mods\\MyMod")!;
const added = await addToProject({ item: made.folder, project, call, collision: DefaultCollision });
console.log(added.entity); // mymod\props\rusty_drum\rusty_drum.ent
```

Every function that reads the game's files takes a REDbridge `call(method, params)` from its caller (REDcode's bridge, REDnode's `kernel.bridge()`, or `startBridge()` here). Nothing here calls an AI service unless asked, with a key passed in (`call.key`) or from the environment (`TRIPO_API_KEY`, `OPENAI_API_KEY`).

| Export | For |
|---|---|
| `makeModel({ from: "file", file, name })` | A GLB prepared into a Desk item. Also from Tripo (`from: "tripo"`) or a drawn picture (`from: "picture"`) |
| `setSize(folder, height, { version })` | A model with no real size (Tripo's in parts) or the wrong one |
| `readItem(folder)`, `deskItem(name)`, `readPrepared(raw)` | A Desk item's record, size, parts and levels of detail |
| `projectFolders(dir)` | A WolvenKit project's folders, from its folder, `.cpmodproj` or `source\archive` |
| `addToProject({ item, project, call, name?, mod?, collision? })`, `DefaultCollision` | The prop in the project: mesh, materials, `.ent` |
| `addToLibrary`, `addFromLibrary`, `libraryRoot`, `libraryFolder`, `refreshList`, ... | The EDGE Library's props ([the shared rules](https://edgemodders.github.io/EDGEbuilder/library.html#shared-rules)) |
| Types: `Collision`, `PrepareResult`, `AddResult`, `MadeModel`, `AssetRecord`, ... | Typing |

## Kept stable

| | |
|---|---|
| The Desk's place | `%LOCALAPPDATA%\EDGEfab\desk` (`deskDir()`), so other tools can list it |
| A Desk item's shape | `<name>.prop.asset\` with `asset.json` (the Library's asset fields: `format`, `id`, `name`, `kind`, `main`, `version`) and `source\raw\<name>\` holding the model, its textures and `prepared.json`. An item's records keep absolute paths of where it was made; read them with `readItem` or `readPrepared`, which find the files in the item itself |
| Versions | The same as EDGEfab's. Before 1.0, a change to an export's request or result raises at least the middle number and is named in [EDGEfab's changelog](https://edgemodders.github.io/EDGEfab/changelog.html) |

MIT license. Part of the [EDGE tools](https://github.com/Edgemodders).
