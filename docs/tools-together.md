---
title: Tools working together
---

# How EDGE tools work together

**Status: proposal, 2026-11-04.** Written in EDGEfab at the owner's request, for everyone who builds an EDGE tool: the Claude sessions in each repo, and the owner. It writes down habits the tools already have, so the next need between two tools follows them instead of being improvised. Its home, once agreed, is the platform's own pages (asked of EDGEweb); this page stays until then.

Why now: EDGEfab is the first tool that orchestrates most of the others (EDGEmat for materials, REDcode for the view, REDbridge for game files, REDnode for the running game, EDGEquest for scenes). Its first cross-tool call, EDGEmat's `materialsFromModel`, showed a gap: the function existed, but no other tool could ship with it ([EDGEmat #7](https://github.com/Edgemodders/EDGEmat/issues/7)).

## Three ways, three jobs

| Way | Use it for | Not for |
|---|---|---|
| **Code packages** (rule 1) | A step that must work the same every time: a tool's own feature that needs another tool's function | Moving between tabs |
| **Extension APIs and commands** (rule 2) | Moving between tools in VS Code: opening another tool's tab on the same asset, asking for the open project or the game folder | Anything an MCP server must also do (an extension API exists only inside VS Code) |
| **MCP servers** (rule 3) | Assistants: Claude Code, EDGEchat, a tool's own agent | One tool's code calling another tool's server |

One rule sits under all three: **REDbridge is passed in, not started, wherever a caller has one** (rule 4).

## Rule 1: share code as a package

- **A tool's core has no VS Code imports** (EDGEmat, EDGEfab and EDGEquest already work this way): the extension and the MCP server both use it.
- **When another tool needs a function from that core, the core is published as `@edgemodders/<tool>-core`** on npm: JavaScript and `.d.ts`, released with the tool under the same version number. A change to a function another tool uses is at least a minor version bump, named in the changelog. The caller pins a range.
- **Small, stable files are copied unchanged** from one canonical repo instead. Today: `tools/keys/keys.mjs` and `tools/nexus/` (REDnode's), `tools/release/readme-check.mjs` (REDnode's), the REDbridge client (REDcode's `bridgeClient.ts`, copied into EDGEmat, EDGEquest and EDGEdeck). The copy says where it came from; a change is made in the canonical repo first, then copied again.
- **Never build a release from another repo's working copy.** A development build may use a local checkout until the package exists; the release waits for it.

## Rule 2: in VS Code, an API and commands

- **An extension's API is what `activate()` returns**: an object with `apiVersion` (an integer) and `version` (the tool's version), as `REDcodeApi` and EDGEmat's API have. New members may be added within a version; a change that breaks callers raises `apiVersion`.
- **Callers copy the interface**, only the members they use, rather than importing the other tool's code (REDcode's `src/edgedeck.ts`, EDGEmat's `REDcodeApi`). They find it with `vscode.extensions.getExtension(id)`, check `apiVersion`, and check each newer member with `typeof api.x === "function"` before calling it.
- **Activation:** list the other extension in `extensionDependencies` only when the tool can't work without it. Otherwise use it only when already active (EDGEmat's `activeApi`), so one tool's reload never races another's.
- **A tool that isn't installed is offered, not required:** say what it adds and offer Install, with a plain fallback where there is one (EDGEfab's Open in 3D falls back to its preview picture without REDcode).
- **Moving between tabs:**
  - Each tool's tabs open from a command or a custom editor that takes a file: `vscode.openWith(uri, "redcode.mesh")`, Open in EDGEmat, Open in EDGEfab.
  - The asset is a file on disk (a project file, a Desk or Library item), never state hidden inside one tool. Every tab on it watches the file and redraws when another tool changes it. That is what lets a recolor in EDGEmat show at once in EDGEfab's character tab.
- **Context values** (`.mesh`, `.ent`, `.app`, ...) in a tool's tree views are part of its API, so other tools can add menu items there. Keep them stable, and list them in the API docs.

## Rule 3: MCP is for assistants

- **One server per tool**, named for the tool (`rednode`, `redcode`, `edgedeck`, `edgemat`, `edgefab`, `edgequest`), its tools prefixed (`mat_`, `fab_`, ...), published as `@edgemodders/<tool>-mcp`. The EDGE plugin for Claude Code (EDGEchat) lists them, so an assistant sees every tool at once and does the orchestrating itself.
- **Every feature ships in a tool's UI and its MCP server together.** The server bundles the tool's core (rule 1), so both do the same thing.
- **Servers don't call each other.** When a tool's own feature needs another tool's function, it calls that tool's core package. A chain of servers fails whenever one is missing, outdated or stuck, and the modder can't see which.
- **The exception is an agent** (REDagent; EDGEfab's own agent in its phase FA): it is an assistant, so it connects to other tools' servers as an MCP client, the same way Claude Code does. It finds them from the EDGE plugin's list or its own settings; no discovery service is needed.
- **Tool descriptions are the contract for assistants:** what a tool does, in plain words, with the shapes it takes and returns.

## Rule 4: REDbridge is passed in

- **A core function takes a bridge from its caller** instead of starting its own: EDGEmat's `materialsFromModel(bridge, ...)`, with `bridgeOver(call)` turning any `(method, params)` call into a client.
- **Inside VS Code, extensions share REDcode's bridge** through `REDcodeApi.bridge()` when REDcode runs, and start their own only when it doesn't.
- **Inside the game, packages share REDnode's** (`kernel.bridge()`; EDGEmat's server uses it when it runs inside REDnode).
- **Each MCP server starts its own for now.** Measured 2026-11-04 on the owner's PC: an idle REDbridge takes about 50 MB, and one that has loaded the game's archive index 600 to 800 MB. A typical modder with one or two editors runs 3 to 6, so at worst about 1 GB is spent twice. One shared bridge per machine is left for later, revisited if a tool's work makes it costly (EDGEfab's whole characters, F5a) or modders report memory trouble.

## Shared places on disk

The tools already share state through fixed places. A new shared place is added here, not invented by one tool:

| Place | Holds | Rule's home |
|---|---|---|
| `%APPDATA%\Edgemodders\keys\<service>.txt` | AI service keys, DPAPI, one per service; an environment variable wins | REDnode's `tools/keys/keys.mjs` |
| `%APPDATA%\EDGE\library.json` | The EDGE Library's root | EDGEbuilder's library page, the wiki's [The EDGE Library](https://edgemodders.ai/wiki/library.html) |
| `%LOCALAPPDATA%\<tool>\desk\` | Each tool's Desk (its own scratch workspace) | Each tool's docs |

## Open

- Where this page lives for good: a "For tool makers" page on the platform's site, asked of EDGEweb.
- Whether the copied REDbridge client becomes a package too (`@edgemodders/redbridge-client`), since three tools carry a copy.
