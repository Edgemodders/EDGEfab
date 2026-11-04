// EDGEfab as an MCP server over stdio, for AI assistants such as Claude Code and REDagent: make a prop from a
// textured GLB, or from words through Tripo with the modder's own key, prepared for the game. Every tool is the
// twin of a part of the extension's UI; both share EDGEfab's Desk (%LOCALAPPDATA%\EDGEfab\desk).
//
//   edgefab-mcp
//
// The Tripo key comes from the EDGE tools' shared key store, or TRIPO_API_KEY. stdout is the MCP channel;
// logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import {
  addToProject, deskItem, hasKey, makeModel, projectFolders, readSettings, startBridge, tripoBalance, deskDir, writeSettings, DefaultCollision, DefaultFaceLimit, type MadeModel,
} from "../../../extensions/edgefab/src/core";

declare const __VERSION__: string;

const log = (line: string) => process.stderr.write(`[edgefab-mcp] ${line}\n`);
const text = (value: unknown): CallToolResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const failure = (e: unknown): CallToolResult => ({ isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] });

/** A made model in plain terms, with the raw numbers. */
function describe(made: MadeModel) {
  const p = made.prepared;
  const lods = [...new Set(p.submeshes.map((s) => s.lod))].sort((a, b) => a - b).map((lod) => ({
    lod,
    triangles: p.submeshes.filter((s) => s.lod === lod).reduce((n, s) => n + s.triangles, 0),
  }));
  return {
    name: made.name,
    folder: made.folder,
    glb: p.glb,
    sizeMetres: { height: +p.size.height.toFixed(3), width: +p.size.width.toFixed(3), depth: +p.size.depth.toFixed(3) },
    lods,
    submeshes: p.submeshes.length,
    materials: p.materials,
    textures: p.textures.map((t) => ({ material: t.material, slot: t.slot, file: t.file })),
    license: made.asset.license,
    preview: made.preview,
    notes: p.notes.length ? p.notes : undefined,
  };
}

const readJson = (file: string): any => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

const server = new McpServer({ name: "edgefab", version: __VERSION__ });

server.registerTool(
  "fab_make",
  {
    description:
      "Makes a prop for Cyberpunk 2077 from a textured 3D model and prepares it for the game: real size, standing on its base, three levels of detail (full, half, a fifth), MikkTSpace tangents, " +
      "parts under the game's 65,535 vertices, and its textures written out for its materials. from 'file' takes a .glb or .gltf on disk. from 'tripo' asks Tripo to make the model from words, " +
      "with the modder's own Tripo key: it costs about 20 Tripo credits and takes about 2 minutes, so confirm with the user first. Tripo needs to know whether the modder's plan is paid or free " +
      "(on a free plan Tripo keeps the rights to the model): pass plan, or set it once with fab_tripo. Puts it on the Desk (fab_desk) and returns its folder, size, LODs, textures and license. fab_add then puts it into a project.",
    inputSchema: {
      from: z.enum(["file", "tripo"]),
      file: z.string().optional().describe("For from 'file': the .glb or .gltf."),
      prompt: z.string().optional().describe("For from 'tripo': one object, such as 'a rusty oil drum'."),
      name: z.string().optional().describe("A name for it; default from the file name or the words."),
      faceLimit: z.number().int().min(500).max(100000).default(DefaultFaceLimit).describe("For Tripo: triangles to ask for. 20,000 costs the same as no limit."),
      plan: z.enum(["paid", "free"]).optional().describe("For Tripo: the modder's plan, if not set with fab_tripo."),
    },
  },
  async ({ from, file, prompt, name, faceLimit, plan }) => {
    try {
      const version = __VERSION__;
      const progress = (step: string) => log(step);
      if (from === "file") {
        if (!file) throw new Error("Pass file: the .glb or .gltf to make the prop from.");
        return text(describe(await makeModel({ from: "file", file, name }, { version, onProgress: progress })));
      }
      if (!prompt?.trim()) throw new Error("Pass prompt: the object for Tripo to make.");
      const p = plan ?? readSettings().tripoPlan;
      if (!p) throw new Error("Ask the user whether their Tripo plan is paid or free (on a free plan Tripo keeps all rights to the model, Tripo's terms 5.2.1), then pass plan or call fab_tripo with action 'set_plan'.");
      return text(describe(await makeModel({ from: "tripo", request: { prompt, faceLimit }, name, plan: p }, { version, onProgress: progress })));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_desk",
  {
    description: "Lists what is on EDGEfab's Desk (the extension's Desk view), its own scratch workspace kept between sessions: each prop's folder, name, size, levels of detail, textures and license, and `view`: a GLB with its textures, parts and levels of detail to open in REDcode's 3D view (the game's GLB has no textures). Props wait there until they go into a project or the Library.",
    inputSchema: {},
  },
  async () => {
    try {
      const base = deskDir();
      const items = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.endsWith(".prop.asset")) : [];
      return text({
        folder: base,
        props: items.map((dir) => {
          const folder = path.join(base, dir);
          const name = dir.slice(0, -".prop.asset".length);
          const asset = readJson(path.join(folder, "asset.json"));
          const prepared = readJson(path.join(folder, "source", "raw", name, "prepared.json"));
          return { name, folder, title: asset?.name, from: asset?.from, license: asset?.license, size: prepared?.size, submeshes: prepared?.submeshes?.length, view: prepared?.view, notes: prepared?.notes };
        }),
      });
    } catch (e) {
      return failure(e);
    }
  },
);

// REDbridge, started the first time a tool needs the game's files, and kept for the next.
let bridge: Promise<Awaited<ReturnType<typeof startBridge>>> | undefined;
const getBridge = () => {
  bridge ??= startBridge(log).catch((e) => {
    bridge = undefined;
    throw e;
  });
  return bridge;
};

server.registerTool(
  "fab_add",
  {
    description:
      "Add to Project: puts a prop from EDGEfab's Desk into a WolvenKit project (the extension's Add to Project), ready to place with EDGEbuilder or spawn. Writes under source\\archive\\<mod>\\props\\<name>\\: " +
      "the .mesh (imported over a game barrel template with its levels of detail, the template's materials and appearances replaced), the model's own textures as game textures and a .mi on metal_base " +
      "(through EDGEmat's core, glow included), and the .ent to place, with collision. Also the prepared model as source\\raw\\...\\<name>.glb and a record of its source and license. " +
      "collision 'physical' (default): one entPhysicalMeshComponent with a box the prop's size in the mesh's physics data. 'box': an entMeshComponent and an entColliderComponent with that box. 'none': it only draws. " +
      "Which of the first two stops V in the game is not yet tested. Adding the same name again replaces it. Needs REDbridge and the game folder (from VS Code's redcode settings). Takes about 15 seconds.",
    inputSchema: {
      prop: z.string().describe("The Desk prop: its name (fab_desk lists them) or its folder."),
      project: z.string().describe("The WolvenKit project: its folder, its .cpmodproj, or its source\\archive."),
      name: z.string().optional().describe("The file name in the project; default the prop's. Made lowercase, with no spaces."),
      mod: z.string().optional().describe("The mod's own folder under source\\archive; default the project's name."),
      collision: z.enum(["physical", "box", "none"]).default(DefaultCollision),
    },
  },
  async ({ prop, project, name, mod, collision }) => {
    try {
      const folders = projectFolders(project);
      if (!folders) throw new Error(`${project} is not a WolvenKit project: it has no .cpmodproj and no source\\archive folder.`);
      const { call } = await getBridge();
      const r = await addToProject({ item: deskItem(prop), project: folders, call, name, mod, collision, log });
      return text({
        ...r,
        next: `Pack the project (REDcode: Pack and Try), then place ${r.entity} with EDGEbuilder, or spawn it with REDnode. The entity is the one to place; the mesh alone has no collision.`,
      });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_tripo",
  {
    description:
      "Tripo, EDGEfab's text-to-model service. action 'status': whether a Tripo key is set (in the EDGE tools' shared key store; the key itself is never shown), the plan recorded, and the credit balance. " +
      "action 'set_plan' records whether the modder's Tripo plan is 'paid' (the models are theirs to release) or 'free' (Tripo keeps all rights): ask the user, don't guess.",
    inputSchema: { action: z.enum(["status", "set_plan"]).default("status"), plan: z.enum(["paid", "free"]).optional() },
  },
  async ({ action, plan }) => {
    try {
      if (action === "set_plan") {
        if (!plan) throw new Error("Pass plan: 'paid' or 'free', as the user says.");
        return text({ plan: writeSettings({ tripoPlan: plan }).tripoPlan });
      }
      const key = await hasKey("tripo");
      let balance: number | string | undefined;
      if (key) {
        try {
          balance = (await tripoBalance()).balance;
        } catch (e) {
          balance = e instanceof Error ? e.message : String(e);
        }
      }
      return text({
        key: key ? "set" : "not set: the user sets it in VS Code with EDGEfab: Set Tripo Key, or with TRIPO_API_KEY",
        plan: readSettings().tripoPlan ?? "not recorded",
        credits: balance,
        perModel: "about 20 credits",
      });
    } catch (e) {
      return failure(e);
    }
  },
);

// The bridge goes with the server: when the assistant closes the channel, or the process ends.
const stopBridge = () => void bridge?.then((b) => b.client.stop(), () => undefined);
process.stdin.on("close", () => {
  stopBridge();
  setTimeout(() => process.exit(0), 500);
});
process.on("exit", stopBridge);

server.connect(new StdioServerTransport()).then(
  () => log(`ready; Desk ${deskDir()}`),
  (e) => {
    log(`could not start: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
