---
title: Changelog
---

# Changelog

Every change a modder would notice, newest first. Kept as REDnode's and EDGEmat's are: each such change adds a line under **Unreleased**, in its group (**New**, **Changed**, **Fixed**, **Other**), in the same commit as the change. Before a release, **Unreleased** becomes `## <version> (<date>)` and a new empty **Unreleased** starts above it. Release notes are taken from that section.

## Unreleased

**New**

- **The first EDGEfab, in the works** (F1 of the [build plan](https://edgemodders.github.io/EDGEfab/plan.html)): an **EDGEfab** icon in the activity bar with a **Desk** view: EDGEfab's own scratch workspace, kept between sessions, where what you make waits until it goes into a project or your Library. **Import a GLB...** takes a textured model of your own; **Generate with Tripo...** has Tripo make one from your words, with your own Tripo key (about 20 credits and 2 minutes a model). EDGEfab gets it ready for the game: its real size, standing on its base, three levels of detail (full, half, a fifth), and its textures written out for its materials. A model too detailed for the game (over 65,535 vertices in a part, such as Tripo's 1.4 million triangles without a limit) is simplified to fit, and the Desk says so. Putting it into your REDcode project comes next.
- Your Tripo key goes in the EDGE tools' shared key store (**Set Tripo Key**), and EDGEfab asks once whether your Tripo plan is paid or free: on a free plan Tripo keeps the rights to the models, so EDGEfab marks them as not yours to release.
- **For assistants:** an MCP server inside the extension, with `fab_make` (a prop from a GLB, or from words through Tripo), `fab_desk` (what is on the Desk) and `fab_tripo`. **Connect an Assistant (MCP)...** registers it with Claude Code; agents in VS Code see it on their own.
