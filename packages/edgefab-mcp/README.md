# edgefab-mcp

EDGEfab for AI assistants over MCP (stdio): make a Cyberpunk 2077 prop from a textured 3D model, or from words through Tripo with the modder's own key, prepared for the game. It ships inside the EDGEfab extension, which registers it; this package is the same server on its own.

| Tool | Does |
|---|---|
| `fab_make` | A prop from a `.glb` or `.gltf` (`from: "file"`), or from words through Tripo (`from: "tripo"`, about 20 credits): real size, standing on its base, three levels of detail, tangents, textures written out |
| `fab_desk` | What is on the Desk: the props made so far, waiting to go into a project or the Library |
| `fab_tripo` | Whether a Tripo key is set (never the key itself), the plan recorded (paid or free), the credit balance; `set_plan` records the plan |

The Tripo key comes from the EDGE tools' shared key store (`%APPDATA%\Edgemodders\keys`), or `TRIPO_API_KEY`. Made props go on EDGEfab's Desk, `%LOCALAPPDATA%\EDGEfab\desk`.

Docs: [edgemodders.github.io/EDGEfab](https://edgemodders.github.io/EDGEfab/). MIT license.
