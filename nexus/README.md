# EDGEfab on Nexus Mods

The source of EDGEfab's Nexus Mods page will live here, so updates are edits in the repo, not in Nexus's text box, as EDGEmat's and REDnode's are.

**Not created yet.** The owner creates the page by hand and puts its number in `nexus.json` (`"page"`); then `npm run nexus:pull` fills `nexus.json` (the page's ids) and `description.bbcode`. Until then the release workflow's **Update Nexus Mods** box must stay off.

| File | What it is |
|---|---|
| `nexus.json` | The page (none yet) and how a release uploads: the main file, **Mod Manager Download off** (a VS Code extension, not a game mod) and the page's Primary file, the old version archived |
| `description.bbcode` | The page's description, once the page exists |

The Nexus tool is shared, in [EDGErepo](https://github.com/Edgemodders/EDGErepo). The npm scripts (`nexus:pull`, `nexus:status`) need it checked out beside this repo (`../EDGErepo`). The release workflow clones it at the tag `v1`. Change it there.
