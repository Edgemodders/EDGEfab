# edgefab-mcp

EDGEfab for AI assistants over MCP (stdio): make a Cyberpunk 2077 prop from a textured 3D model, or from words through Tripo with the modder's own key, prepared for the game. It ships inside the EDGEfab extension, which registers it; this package is the same server on its own.

| Tool | Does |
|---|---|
| `fab_picture` | Draws an object from four sides with OpenAI's GPT Image, about 30 seconds and a few cents. With `prop` and `from` (a picture's number), it changes that picture by words ("make the cabinet red and the glow blue") and keeps the rest. Every picture is kept |
| `fab_make` | A prop from a `.glb` or `.gltf` (`from: "file"`), from a picture made with `fab_picture` (`from: "picture"`, any of its pictures with `take`, about 60 credits), or from words through Tripo (`from: "tripo"`, about 50 credits): real size, standing on its base, three levels of detail, tangents, textures written out |
| `fab_size` | A Desk prop's height in metres |
| `fab_glow` | Makes a prop's painted lights glow, sets how strongly, or stops it |
| `fab_desk` | What is on the Desk: the props and pictures made so far, waiting to go into a project or the Library |
| `fab_rename` | Renames a prop on the Desk, its files too |
| `fab_add` | Puts a prop into a WolvenKit project: mesh, materials, an entity with collision |
| `fab_library`, `fab_library_add`, `fab_library_edit`, `fab_refresh` | The EDGE Library: list it, add a prop, bring one back to the Desk to change, refresh a project's props from it |
| `fab_tripo` | Whether a Tripo key is set (never the key itself), the plan recorded (paid or free), the credit balance; `set_plan` records the plan |

The keys come from the server's environment only: `TRIPO_API_KEY` for Tripo, `OPENAI_API_KEY` for pictures. Made props go on EDGEfab's Desk, `%LOCALAPPDATA%\EDGEfab\desk`.

Docs: [edgemodders.github.io/EDGEfab](https://edgemodders.github.io/EDGEfab/). MIT license.
