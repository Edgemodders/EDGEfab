# EDGEfab

The EDGE asset maker for Cyberpunk 2077. **A preview, in the works.**

Turn a textured 3D model into a prop the game can use: one of your own (GLB), or one made from your words with your own OpenAI and Tripo keys.

- **Import a GLB...**, or **Generate from Words...** in the EDGEfab view: OpenAI's GPT Image draws it from four sides, then Tripo makes it 3D, in named parts. **Make a Prop** on a `.glb` in the Explorer does the same as Import.
- EDGEfab gets the model ready for the game: real size, standing on its base, three levels of detail, and its textures taken out for its materials. It waits on your **Desk** until you use it.
- **Add to Project** puts it in your REDcode project with collision and its materials, ready to place with EDGEbuilder or spawn.
- **Add to Library** keeps it in the EDGE Library, the folder every EDGE tool shares, ready for any project. **Refresh Project from Library** brings newer versions in.
- Your Tripo and OpenAI keys are kept encrypted in VS Code's secret storage, for EDGEfab only, and sent only to Tripo and OpenAI. EDGEfab asks once whether your Tripo plan is paid or free: on a free plan Tripo keeps the rights to the models.
- Assistants (Claude Code, agents in VS Code) get the same through EDGEfab's MCP server: **Connect an Assistant (MCP)...**.

Docs: [edgemodders.github.io/EDGEfab](https://edgemodders.github.io/EDGEfab/). Part of the [EDGE tools](https://github.com/Edgemodders). MIT license.
