# EDGEfab

The EDGE asset maker for Cyberpunk 2077. **A preview, in the works.**

Turn a textured 3D model into a prop the game can use: one of your own (GLB), or one Tripo makes from your words with your own Tripo key.

- **Import a GLB...** or **Generate with Tripo...** in the EDGEfab view.
- EDGEfab gets the model ready for the game: real size, standing on its base, three levels of detail, and its textures taken out for its materials. A model too detailed for the game is simplified to fit, and EDGEfab says so.
- Your Tripo key is kept in the EDGE tools' shared key store, encrypted for your Windows account, and sent only to Tripo. EDGEfab asks once whether your Tripo plan is paid or free: on a free plan Tripo keeps the rights to the models.
- Assistants (Claude Code, agents in VS Code) get the same through EDGEfab's MCP server: **Connect an Assistant (MCP)...**.

Next: **Add to Project** puts the prop into your REDcode project with collision and its materials, and EDGEbuilder places it in the game.

Docs: [edgemodders.github.io/EDGEfab](https://edgemodders.github.io/EDGEfab/). Part of the [EDGE tools](https://github.com/Edgemodders). MIT license.
