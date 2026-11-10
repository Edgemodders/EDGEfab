// EDGEfab as an MCP server over stdio, for AI assistants such as Claude Code and REDagent: make a prop from a
// textured GLB, or from words through Tripo with the modder's own key, prepared for the game. Every tool is the
// twin of a part of the extension's UI; both share EDGEfab's Desk (%LOCALAPPDATA%\EDGEfab\desk).
//
//   edgefab-mcp
//
// The Tripo and OpenAI keys come from the EDGE tools' shared key store, or TRIPO_API_KEY and OPENAI_API_KEY.
// stdout is the MCP channel;
// logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import {
  addToProject, deskItem, drawPicture, glowOff, hasKey, makeModel, paintedLightsGlow, projectFolders, readPictures, readSettings, setGlowStrength, setSize, startBridge, tripoBalance, tripoCredits, deskDir, writeSettings,
  DefaultCollision, DefaultFaceLimit, DetailLevels, type Detail, type MadeModel, type TextToModel,
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
    parts: p.parts,
    sizeUnknown: p.sizeUnknown,
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

// stdout is the protocol: anything a library prints there would break it, so it goes to stderr.
console.log = console.info = console.debug = (...args: unknown[]) => console.error(...args);

const server = new McpServer({ name: "edgefab", version: __VERSION__ });

server.registerTool(
  "fab_picture",
  {
    description:
      "Picture first, step 1 of making a prop from words (the extension's Generate from Words): OpenAI's GPT Image draws the object from four sides (front, left, back, right) as one 2 by 2 picture, " +
      "with the modder's own OpenAI key from the EDGE tools' shared key store. About 30 seconds and a few cents of OpenAI credit. Show the user the sheet (it's a PNG) and let them change the words: " +
      "pass prop to draw another take into the same Desk item. When they like it, fab_make with from 'picture' makes the 3D model from the four views with Tripo, which follows each side closely. " +
      "Returns the Desk item, the picture files, and what Make 3D would cost.",
    inputSchema: {
      words: z.string().describe("One object, such as 'a cyberpunk vending machine with a glowing screen on the front'. A brief for game props (flat panels, crisp details, plain background) is added."),
      prop: z.string().optional().describe("A Desk item (its name or folder) to draw another take into, for changed words. Default: a new item."),
      name: z.string().optional().describe("For a new item: its name; default from the words."),
    },
  },
  async ({ words, prop, name }) => {
    try {
      const drawn = await drawPicture(words, { version: __VERSION__, item: prop ? deskItem(prop) : undefined, name });
      return text({
        prop: drawn.name,
        folder: drawn.folder,
        take: drawn.take.take,
        sheet: drawn.take.sheet,
        views: drawn.take.views,
        seconds: drawn.take.seconds,
        make3d: { from: "picture", credits: { standard: tripoCredits({ ...DetailLevels.standard.settings, views: drawn.take.views, parts: true }), high: tripoCredits({ ...DetailLevels.high.settings, views: drawn.take.views, parts: true }) } },
      });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_make",
  {
    description:
      "Makes a prop for Cyberpunk 2077 from a textured 3D model and prepares it for the game: real size, standing on its base, three levels of detail (full, half, a fifth), MikkTSpace tangents, " +
      "parts under the game's 65,535 vertices, and its textures written out for its materials. from 'file' takes a .glb or .gltf on disk. " +
      "from 'picture' (Make 3D) asks Tripo for the model from a Desk item's last four-view picture (fab_picture): the usual way from words. from 'tripo' asks Tripo straight from words, without a picture. " +
      "With Tripo: the modder's own key; by default in parts (each part its own material, so EDGEmat can change one), with the detailed texture. Credits as of 2026-11-09: from a picture in parts 60 (High detail 80), " +
      "from words in parts 50 (70); about 3 to 4 minutes. Confirm the cost with the user first. Models in parts come without a real size: pass height in metres (ask the user), or set it after with fab_size. " +
      "Tripo needs to know whether the modder's plan is paid or free (on a free plan Tripo keeps the rights to the model): pass plan, or set it once with fab_tripo. " +
      "Puts it on the Desk (fab_desk) and returns its folder, size, LODs, parts, textures and license. fab_add then puts it into a project.",
    inputSchema: {
      from: z.enum(["file", "picture", "tripo"]),
      file: z.string().optional().describe("For from 'file': the .glb or .gltf."),
      prop: z.string().optional().describe("For from 'picture': the Desk item fab_picture made (its name or folder)."),
      prompt: z.string().optional().describe("For from 'tripo': one object, such as 'a rusty oil drum'."),
      name: z.string().optional().describe("For 'file' and 'tripo': a name for it; default from the file name or the words."),
      detail: z.enum(["standard", "high"]).default("standard").describe("For Tripo: 'standard' is the detailed 4096² texture; 'high' adds Tripo's detailed shape and about 3 times the triangles (+20 credits)."),
      parts: z.boolean().default(true).describe("For Tripo: in parts, each with its own material (+20 to 30 credits, no real size from Tripo)."),
      height: z.number().positive().max(100).optional().describe("Its height in metres, such as 1.8 for a vending machine. Needed for models in parts."),
      plan: z.enum(["paid", "free"]).optional().describe("For Tripo: the modder's plan, if not set with fab_tripo."),
    },
  },
  async ({ from, file, prop, prompt, name, detail, parts, height, plan }) => {
    try {
      const version = __VERSION__;
      const progress = (step: string) => log(step);
      const prepare = height ? { height } : undefined;
      if (from === "file") {
        if (!file) throw new Error("Pass file: the .glb or .gltf to make the prop from.");
        return text(describe(await makeModel({ from: "file", file, name }, { version, onProgress: progress, prepare })));
      }
      const p = plan ?? readSettings().tripoPlan;
      if (!p) throw new Error("Ask the user whether their Tripo plan is paid or free (on a free plan Tripo keeps all rights to the model, Tripo's terms 5.2.1), then pass plan or call fab_tripo with action 'set_plan'.");
      const settings: Omit<TextToModel, "prompt"> = { ...DetailLevels[detail as Detail].settings, parts };
      if (from === "picture") {
        if (!prop) throw new Error("Pass prop: the Desk item with the picture (fab_picture made it).");
        return text(describe(await makeModel({ from: "picture", item: deskItem(prop), request: settings, plan: p }, { version, onProgress: progress, prepare })));
      }
      if (!prompt?.trim()) throw new Error("Pass prompt: the object for Tripo to make.");
      return text(describe(await makeModel({ from: "tripo", request: { ...settings, prompt }, name, plan: p }, { version, onProgress: progress, prepare })));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_size",
  {
    description: "Sets a Desk prop's height in metres (the extension's Set Size), scaling it evenly: for a model that came without a real size (Tripo's in parts) or the wrong one. Free and offline. A prop already added to a project needs fab_add again.",
    inputSchema: {
      prop: z.string().describe("The Desk prop: its name (fab_desk lists them) or its folder."),
      height: z.number().positive().max(100).describe("Its height in metres."),
    },
  },
  async ({ prop, height }) => {
    try {
      const p = await setSize(deskItem(prop), height, { version: __VERSION__ });
      return text({ size: p.size, notes: p.notes });
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
          const raw = path.join(folder, "source", "raw", name);
          const prepared = readJson(path.join(raw, "prepared.json"));
          const picture = readPictures(raw)?.takes.at(-1);
          return {
            name, folder, title: asset?.name,
            state: prepared ? "model" : picture ? "picture: Make 3D next (fab_make from 'picture')" : "unfinished",
            from: asset?.from, license: asset?.license,
            picture: picture ? { take: picture.take, words: picture.words, sheet: picture.sheet } : undefined,
            size: prepared?.size, sizeUnknown: prepared?.sizeUnknown, parts: prepared?.parts?.map((x: { name: string; material: string }) => ({ name: x.name, material: x.material })),
            submeshes: prepared?.submeshes?.length, view: prepared?.view, glow: prepared?.glow?.length ? prepared.glow : undefined, notes: prepared?.notes,
          };
        }),
      });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_glow",
  {
    description:
      "Glow on a Desk prop (the extension's Make the Painted Lights Glow, Glow Strength and Stop the Glow). Tripo's models send no glow: their lights are only painted into the color texture. " +
      "action 'paint' makes a glow map from the bright, strongly colored painted areas: amount 0 to 1 is how much counts as a light (0.5 by default), and it returns the share of the texture that lights up. A material with a glow of its own keeps it. Painting again replaces the last try. " +
      "action 'strength' sets how strongly it glows: one material, or all. action 'off' stops it. " +
      `strength: 0.25 is a saturated deep color for small lights, 1 a soft glow, 3 bright (the default for painted lights, which are thin strips: 1 barely shows at night), 8 white-hot; about 0.125 is the limit of what shows in the game. It depends on the use and how much of it glows, so it is the modder's choice. ` +
      "Changes the Desk item only, free and offline: `view` is the GLB to open in REDcode's 3D view to see it. fab_add then carries it into the game material; a prop already added needs fab_add again.",
    inputSchema: {
      prop: z.string().describe("The Desk prop: its name (fab_desk lists them) or its folder."),
      action: z.enum(["paint", "strength", "off"]),
      amount: z.number().min(0).max(1).optional().describe("For 'paint': how much counts as a light, 0 to 1. Default 0.5."),
      strength: z.number().positive().max(64).optional().describe("For 'paint' and 'strength'."),
      material: z.string().optional().describe("For 'strength' and 'off': one material; default all that glow."),
    },
  },
  async ({ prop, action, amount, strength, material }) => {
    try {
      const item = deskItem(prop);
      const version = __VERSION__;
      if (action === "paint") return text(await paintedLightsGlow(item, { amount, strength, version }));
      if (action === "off") return text(await glowOff(item, { material, version }));
      if (strength === undefined) throw new Error("Pass strength: 0.25 is a deep color, 1 a soft glow, 8 white-hot.");
      return text(await setGlowStrength(item, strength, { material, version }));
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
      "Tripo, EDGEfab's 3D model service. action 'status': whether a Tripo key is set (in the EDGE tools' shared key store; the key itself is never shown), the plan recorded, and the credit balance. " +
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
      const openai = await hasKey("openai");
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
        perModel: {
          fromPicture: { standard: tripoCredits({ ...DetailLevels.standard.settings, views: {} as never, parts: true }), high: tripoCredits({ ...DetailLevels.high.settings, views: {} as never, parts: true }) },
          fromWords: { standard: tripoCredits({ ...DetailLevels.standard.settings, parts: true }), high: tripoCredits({ ...DetailLevels.high.settings, parts: true }) },
          note: "in parts with the detailed texture, as Tripo charged on 2026-11-09",
        },
        pictures: openai ? "OpenAI key set: fab_picture draws four views first" : "no OpenAI key: the user sets it in VS Code with EDGEfab: Set OpenAI Key (shared with EDGEmat), or with OPENAI_API_KEY; fab_make from 'tripo' works without it",
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
