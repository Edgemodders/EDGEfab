# EDGEfab on Nexus Mods

The source of EDGEfab's Nexus Mods page lives here, so updates are edits in the repo, not in Nexus's text box. It follows REDsave's and EDGEmat's (their `nexus/` folders).

| File | What it is |
|---|---|
| `description.bbcode` | The page's description, in Nexus's BBCode |
| `nexus.json` | The page, the main file's upload settings (`upload`), and after a pull the ids found and the hash of the description last pulled |
| `README.md` | This page: the other fields of the Nexus form, the download file, and how to update |
| `video-script.md` | The shot script for the page's video (2026-11-16): what to set up, the shots in order, privacy checks |

## The page

The page is [38605](https://www.nexusmods.com/cyberpunk2077/mods/38605), made by the owner on 2026-11-15 (mod id 14315126036173 in `nexus.json`). It has no files yet. Pulled the same day (`--ids-only`), its description was still Nexus's template for a new page, so `description.bbcode` keeps EDGEfab's own text. The pull's fingerprint of the template is in `nexus.json`, which lets the first release push the description over it.

From the first release on, the Release workflow's **Update Nexus Mods** box uploads each release: the zip as the main file (the first one on a new page, then a new version with the old one archived), the version's changelog, and `description.bbcode`. It stops first if the description was edited on Nexus since the last pull: then `npm run nexus:pull`, merge with `git diff nexus/`, commit, and run it again.

## The Nexus form

| Field | Value |
|---|---|
| Mod name | EDGEfab |
| Version | EDGEfab's version, from `extensions/edgefab/package.json`; the release sets it |
| Category | Modders Resources and Tutorials, as the other EDGE tools |
| Brief overview | Turn a 3D model, or your words, into a prop for Cyberpunk 2077, in VS Code: real size, levels of detail, materials and collision, into your mod project, ready to place. Or ask Claude. A preview, and a VS Code extension, not a game mod. (255 characters at most; this is 235) |
| Author | Edgemodders |
| Language | English |
| Primary image | `docs/assets/brand/nexus.png` (1280 x 640, the props layout with a Desk, and the EDGEmodders header the owner added by hand on 2026-11-15. `tools/brand/render.ps1` draws it without the header: rendering it again means adding the header again). The banner (`docs/assets/brand/banner.png`) is already at the top of the description |
| Requirements | On Nexus: REDcode (35421); EDGEbuilder (36627) to place props, optional. Off-site: VS Code 1.70 or later (or VSCodium, or EDGEkit); optional Tripo and OpenAI API keys, for props from words |
| Permissions | MIT: open source, free to modify and redistribute with the license notice. Bundled packages keep their licenses (`THIRD-PARTY-NOTICES.txt`). REDbridge, which comes with REDcode, is GPL-3.0 |
| Tags | Modders resource, utility, tools |

Tags cannot be set through Nexus's v3 API (only read): set them by hand on the page.

## Pictures and video

The description has no screenshots: their placeholders were taken out on 2026-11-15 (the owner's choice). The owner is recording a video for the page, added on Nexus before the page goes live. A picture added later goes in the same way as EDGEmat's: upload it to the page's Images tab and put its `staticdelivery.nexusmods.com` link in `description.bbcode`, or save it in `images/` here and link it from this repo's `main` branch (`https://raw.githubusercontent.com/Edgemodders/EDGEfab/main/nexus/images/<name>`). An edit made on Nexus's page (a video embedded in the description, say) is pulled back with `npm run nexus:pull` before the next release, or the release stops.

Before publishing a picture, check it for personal data: Windows user names in paths, account names, keys.

## The download

One main file: `EDGEfab-<version>-nexus.zip` (`tools/release/nexus-zip.mjs`), with:

| File | What it is |
|---|---|
| `edgefab-<version>.vsix` | The extension, the same file the Marketplace and Open VSX have. It carries the MCP server too |
| `edgefab-mcp-<version>.cjs` | The MCP server as one file, for MCP clients outside VS Code |
| `README.txt` | How to install it, and how to connect the server to Claude Code by hand |
| `LICENSE.txt`, `THIRD-PARTY-NOTICES.txt` | EDGEfab's license and the bundled packages' |

**Mod Manager Download is off** for this file (`"modManager": false`): it is a VS Code extension, and Vortex would deploy it into the game folder, where it does nothing. `"primary": true` makes each new version the page's Primary file, its default download (the Nexus tool's rule for every main file).

## Commands

| Command | Does |
|---|---|
| `npm run nexus:status` | The page's version, its files and whether the description matches |
| `npm run nexus:pull` | The live description into `description.bbcode`, the ids into `nexus.json`. Then `git diff nexus/` and merge. With `-- --ids-only`, the ids and the live description's hash, keeping the repo's description |
| `node ../EDGErepo/tools/nexus/nexus.mjs check --version <v>` | What a release would do, and whether it may |
| `node tools/check-bbcode.mjs nexus/description.bbcode` | Checks the BBCode's tags before a push |

The Nexus tool is shared, in [EDGErepo](https://github.com/Edgemodders/EDGErepo). These commands need it checked out beside this repo (`../EDGErepo`) and the Nexus key on this PC (`%APPDATA%\Edgemodders\nexus-key.txt`, see EDGErepo's `tools/nexus/api.mjs`). The release workflow clones it at the tag `v1` and uses the organization's `NEXUS_KEY`. Change it there.

## BBCode used

Nexus's BBCode has no tables or Markdown, so the page uses only: `[b]`, `[i]`, `[size=2..5]`, `[color=#hex]`, `[center]`, `[quote]`, `[line]`, `[list]` with `[*]`, `[url=...]` and `[img]`. Square brackets that are not tags confuse the checker. The banner is linked from this repo's `main` branch on GitHub, so it must stay at its path. The colours are the house palette: yellow `#fcee0a` for headings, cyan `#19f3ff` for highlights.
