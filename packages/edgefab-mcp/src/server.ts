// EDGEfab as an MCP server over stdio, for AI assistants such as Claude Code and REDagent: make a prop from a
// textured GLB, or from words through Tripo with the modder's own key, prepared for the game. Every tool is the
// twin of a part of the extension's UI; both share EDGEfab's Desk (%LOCALAPPDATA%\EDGEfab\desk).
//
//   edgefab-mcp
//
// The Tripo and OpenAI keys: TRIPO_API_KEY and OPENAI_API_KEY when set, else REDcode's shared key store (REDcode's Keys,
// EDGEfab #10), read at each call through this server's own REDbridge started with --keys, so a key set, changed or
// removed in REDcode's Keys counts at once. No key is ever handed to the server by its client's settings.
// stdout is the MCP channel;
// logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { vscodeUserSettings } from "@edgemodders/edgemat-core";
import {
  addToProject, deskItem, drawPicture, envKey, readPrepared, renameItem, glowOff, makeModel, paintedLightsGlow, projectFolders, readPictures, readSettings, setGlowStrength, setSize, startBridge, tripoBalance, tripoCredits, deskDir, writeSettings,
  addFromLibrary, addToLibrary, editOnDesk, gameFolder, libraryFolder, libraryProp, libraryRoot, modderFolder, recordedLibraryRoot, refreshList, safeFolder, setLibraryRoot, setModderFolder, suggestedLibraryRoot,
  DefaultCollision, DefaultFaceLimit, DetailLevels, type Detail, type MadeModel, type TextToModel,
  describeReport, findBlender, needsBlender,
} from "../../../extensions/edgefab/src/core";
import { findBridge, installedRedcodeDirs, KeysBridge, McpCaller } from "../../../extensions/edgefab/src/keyStore";
import { KeyServices, type KeyService } from "../../../extensions/edgefab/src/core/keys";

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
    blender: made.blender ? { version: made.blender.blender, meshes: made.blender.meshes, said: describeReport(made.blender) } : undefined,
  };
}

/** REDbridge for the key store, started on the first call that needs a key and kept while the server runs. */
let keysBridge: KeysBridge | undefined;

function keyStore(): KeysBridge {
  if (!keysBridge) {
    const settings = vscodeUserSettings();
    const exe = process.env.EDGEFAB_REDBRIDGE?.trim() || findBridge({ configured: settings("redcode.bridgePath"), redcodeDirs: installedRedcodeDirs(), pathEnv: process.env.PATH });
    if (!exe) throw new Error("EDGEfab reads keys from REDcode's Keys, through REDbridge, and REDbridge.exe is not installed (in VS Code: REDcode: Install REDbridge).");
    // EDGEFAB_REDBRIDGE may name a stand-in script, for the keys check (scripts/keys-check.mjs).
    keysBridge = new KeysBridge(/\.c?js$/i.test(exe) ? { exe: process.execPath, args: [exe] } : { exe, dotnetRoot: settings("redcode.dotnetRoot") });
  }
  return keysBridge;
}

/** A service's key: its environment variable, else REDcode's Keys. Throws in plain words when there is none. */
async function apiKey(service: KeyService): Promise<string> {
  const env = envKey(service);
  if (env) return env;
  const { name, env: variable } = KeyServices[service];
  let r;
  try {
    r = await keyStore().get(service, McpCaller);
  } catch (e) {
    throw new Error(`No ${name} API key here: REDcode's Keys can't be reached (${e instanceof Error ? e.message : String(e)}). Or set ${variable} for this server.`);
  }
  if (r.key) return r.key;
  throw new Error(
    r.unreadable
      ? `The ${name} key in REDcode's Keys was saved by another Windows user, so it can't be read here. Set it again in VS Code: REDcode's Keys view, Set Key.`
      : `No ${name} API key is set. In VS Code: REDcode's Keys view, Set Key on ${name} (every EDGE tool shares it), or EDGEfab: Set ${name} Key.`,
  );
}

/** Where a service's key comes from, never the key: "environment", "REDcode's Keys", or why there is none. */
async function keySource(service: KeyService): Promise<{ set: boolean; from: string }> {
  if (envKey(service)) return { set: true, from: `${KeyServices[service].env} in this server's environment` };
  try {
    const info = await keyStore().info(service);
    if (info.set && !info.unreadable) return { set: true, from: "REDcode's Keys (shared by every EDGE tool)" };
    return { set: false, from: info.unreadable ? "REDcode's Keys has one saved by another Windows user: set it again in REDcode's Keys view" : "not set: the user sets it in VS Code, REDcode's Keys view, Set Key" };
  } catch (e) {
    return { set: false, from: `REDcode's Keys can't be reached: ${e instanceof Error ? e.message : String(e)}` };
  }
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
      "with the modder's own OpenAI key (from REDcode's Keys, shared by every EDGE tool, or OPENAI_API_KEY). About 30 seconds and a few cents of OpenAI credit. Show the user the sheet (it's a PNG). " +
      "To change a picture (the extension's Pictures tab, Edit Picture): pass prop and from (a take number) with words saying only what to change, such as 'make the cabinet red and the glow blue': " +
      "that picture goes to GPT Image with the words and comes back changed only as they say. To draw afresh into the same item, pass prop without from, with words describing the whole object. Every take is kept (fab_desk lists them). " +
      "When they like one, fab_make with from 'picture' (and take, default the last) makes the 3D model from its four views with Tripo, which follows each side closely. " +
      "Returns the Desk item, the picture files, and what Generate 3D Model would cost.",
    inputSchema: {
      words: z.string().describe("One object, such as 'a cyberpunk vending machine with a glowing screen on the front'. A brief for game props (flat panels, crisp details, plain background) is added. With from: only what to change."),
      prop: z.string().optional().describe("A Desk item (its name or folder) to draw another take into. Default: a new item."),
      from: z.number().int().positive().optional().describe("With prop: the take to change (its picture is sent with the words). Without it, the words are drawn afresh."),
      name: z.string().optional().describe("For a new item: its name; default from the words."),
    },
  },
  async ({ words, prop, from, name }) => {
    try {
      if (from !== undefined && !prop) throw new Error("Pass prop with from: the Desk item whose picture to change.");
      const key = await apiKey("openai");
      const drawn = await drawPicture(words, { version: __VERSION__, item: prop ? deskItem(prop) : undefined, from, name, call: { key } });
      return text({
        prop: drawn.name,
        folder: drawn.folder,
        take: drawn.take.take,
        ...(drawn.take.from !== undefined ? { changedFrom: drawn.take.from } : {}),
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
      "parts under the game's 65,535 vertices, and its textures written out for its materials. from 'file' takes a .glb or .gltf on disk, or a .blend, .fbx or .obj, which Blender opens in the background " +
      "(its factory settings, the file's own scripts off) and exports as one GLB: the visible meshes with modifiers applied, object names as part names; armatures, animation, shape keys, cameras and lights are left aside, and the answer's blender.said says what was left and which materials have no picture. " +
      "from 'picture' (the extension's Generate 3D Model) asks Tripo for the model from a Desk item's last four-view picture (fab_picture): the usual way from words. from 'tripo' asks Tripo straight from words, without a picture. " +
      "With Tripo: the modder's own key; by default in parts (each part its own material, so EDGEmat can change one), with the detailed texture. Credits as of 2026-11-09: from a picture in parts 60 (High detail 80), " +
      "from words in parts 50 (70); about 3 to 4 minutes. Confirm the cost with the user first. Models in parts come without a real size: pass height in metres (ask the user), or set it after with fab_size. " +
      "Tripo needs to know whether the modder's plan is paid or free (on a free plan Tripo keeps the rights to the model): pass plan, or set it once with fab_tripo. " +
      "Puts it on the Desk (fab_desk) and returns its folder, size, LODs, parts, textures and license. fab_add then puts it into a project.",
    inputSchema: {
      from: z.enum(["file", "picture", "tripo"]),
      file: z.string().optional().describe("For from 'file': a .glb or .gltf, or a .blend, .fbx or .obj (through Blender)."),
      prop: z.string().optional().describe("For from 'picture': the Desk item fab_picture made (its name or folder)."),
      take: z.number().int().positive().optional().describe("For from 'picture': which of its pictures (fab_desk lists them). Default: the last."),
      prompt: z.string().optional().describe("For from 'tripo': one object, such as 'a rusty oil drum'."),
      name: z.string().optional().describe("For 'file' and 'tripo': a name for it; default from the file name or the words."),
      detail: z.enum(["standard", "high"]).default("standard").describe("For Tripo: 'standard' is the detailed 4096² texture; 'high' adds Tripo's detailed shape and about 3 times the triangles (+20 credits)."),
      parts: z.boolean().default(true).describe("For Tripo: in parts, each with its own material (+20 to 30 credits, no real size from Tripo)."),
      height: z.number().positive().max(100).optional().describe("Its height in metres, such as 1.8 for a vending machine. Needed for models in parts."),
      plan: z.enum(["paid", "free"]).optional().describe("For Tripo: the modder's plan, if not set with fab_tripo."),
    },
  },
  async ({ from, file, prop, take, prompt, name, detail, parts, height, plan }) => {
    try {
      const version = __VERSION__;
      const progress = (step: string) => log(step);
      const prepare = height ? { height } : undefined;
      if (from === "file") {
        if (!file) throw new Error("Pass file: the .glb, .gltf, .blend, .fbx or .obj to make the prop from.");
        // Blender: EDGEFAB_BLENDER, else the one the extension last found (its setting or REDcode's), else the search.
        const blender = needsBlender(file) ? await findBlender(process.env.EDGEFAB_BLENDER || readSettings().blender) : undefined;
        if (needsBlender(file) && !blender) throw new Error("Blender isn't found, and EDGEfab opens .blend, .fbx and .obj files with it. Ask the user to install Blender (blender.org or Steam), or set EDGEFAB_BLENDER to blender.exe.");
        return text(describe(await makeModel({ from: "file", file, name }, { version, onProgress: progress, prepare, blender })));
      }
      const p = plan ?? readSettings().tripoPlan;
      if (!p) throw new Error("Ask the user whether their Tripo plan is paid or free (on a free plan Tripo keeps all rights to the model, Tripo's terms 5.2.1), then pass plan or call fab_tripo with action 'set_plan'.");
      const settings: Omit<TextToModel, "prompt"> = { ...DetailLevels[detail as Detail].settings, parts };
      if (from === "picture") {
        if (!prop) throw new Error("Pass prop: the Desk item with the picture (fab_picture made it).");
        return text(describe(await makeModel({ from: "picture", item: deskItem(prop), take, request: settings, plan: p }, { version, onProgress: progress, prepare, call: { key: await apiKey("tripo") } })));
      }
      if (!prompt?.trim()) throw new Error("Pass prompt: the object for Tripo to make.");
      return text(describe(await makeModel({ from: "tripo", request: { ...settings, prompt }, name, plan: p }, { version, onProgress: progress, prepare, call: { key: await apiKey("tripo") } })));
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
          const prepared = readPrepared(raw);
          const takes = readPictures(raw)?.takes ?? [];
          const picture = takes.at(-1);
          return {
            name, folder, title: asset?.name,
            state: prepared ? "model" : picture ? "picture: Generate 3D Model next (fab_make from 'picture')" : "unfinished",
            from: asset?.from, license: asset?.license,
            picture: picture ? { take: picture.take, words: picture.words, sheet: picture.sheet } : undefined,
            pictures: takes.length > 1 ? takes.map((t) => ({ take: t.take, words: t.words, ...(t.from !== undefined ? { from: t.from } : {}), date: t.date, sheet: t.sheet })) : undefined,
            madeFromPicture: asset?.from?.tripo?.picture?.take,
            size: prepared?.size, sizeUnknown: prepared?.sizeUnknown, parts: prepared?.parts?.map((x: { name: string; material: string }) => ({ name: x.name, material: x.material })),
            submeshes: prepared?.submeshes?.length, view: prepared?.view, glow: prepared?.glow?.length ? prepared.glow : undefined, notes: prepared?.notes,
            library: asset?.library ? { path: asset.library.path, version: asset.library.version, note: "In the Library: fab_library_add again updates it there" } : undefined,
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
      "Add to Project: puts a prop into a WolvenKit project (the extension's Add to Project), ready to place with EDGEbuilder or spawn. " +
      "from 'desk' (default): a prop from EDGEfab's Desk is built into the project under source\\archive\\<mod>\\props\\<name>\\: the .mesh (imported over a game barrel template with its levels of detail, " +
      "the template's materials and appearances replaced), the model's own textures as game textures and a .mi on metal_base (through EDGEmat's core, glow included), and the .ent to place, with collision; " +
      "also the prepared model as source\\raw\\...\\<name>.glb and a record of its source and license. Adding the same name again replaces it, and keeps what didn't change: a material made from the same pictures as last time keeps its .mi and textures (a second add with only a new size or shape takes seconds), and a part given another material since (EDGEmat's mat_apply or mat_edit on one of its materials) keeps it. The answer's kept lists the kept .mi files and swapped the parts on another material. textures 'remake' makes every texture again; parts 'model' puts every part back on the model's own textures (ask the user first: it undoes their material choices). Needs REDbridge and the game folder (from VS Code's redcode settings); " +
      "about 15 seconds for one material, 3 minutes for a prop in 6 parts. collision 'physical' (default): one entPhysicalMeshComponent with a box the prop's size in the mesh's physics data. " +
      "'box': an entMeshComponent and an entColliderComponent with that box. 'none': it only draws. Both solid kinds stop V in the game (tested 2026-11-09). " +
      "from 'library': a prop from the EDGE Library (fab_library lists them) is copied in as it was built there, at its own game paths (<modder>\\props\\<name>\\), with its collision; " +
      "no REDbridge, a few seconds. The project's source\\library.json notes it, so fab_refresh finds newer versions later. name, mod and collision don't apply.",
    inputSchema: {
      prop: z.string().describe("from 'desk': the Desk prop's name (fab_desk lists them) or its folder. from 'library': the Library prop's path under the Library (as fab_library gives it), its folder, or its id."),
      project: z.string().describe("The WolvenKit project: its folder, its .cpmodproj, or its source\\archive."),
      from: z.enum(["desk", "library"]).default("desk"),
      name: z.string().optional().describe("from 'desk': the file name in the project; default the prop's. Made lowercase, with no spaces."),
      mod: z.string().optional().describe("from 'desk': the mod's own folder under source\\archive; default the project's name."),
      collision: z.enum(["physical", "box", "none"]).default(DefaultCollision),
      textures: z.enum(["keep-unchanged", "remake"]).default("keep-unchanged").describe("from 'desk', adding it again: keep the materials whose pictures didn't change (default), or make them all again."),
      parts: z.enum(["keep", "model"]).default("keep").describe("from 'desk', adding it again: keep the parts given another material since the last add (default), or put every part back on the model's own textures."),
    },
  },
  async ({ prop, project, from, name, mod, collision, textures, parts }) => {
    try {
      const folders = projectFolders(project);
      if (!folders) throw new Error(`${project} is not a WolvenKit project: it has no .cpmodproj and no source\\archive folder.`);
      if (from === "library") {
        const root = needRoot();
        const r = addFromLibrary(libraryProp(root, prop), folders, root);
        return text({ ...r, next: `Pack the project (REDcode: Pack and Play), then place ${r.entity} with EDGEbuilder, or spawn it with REDnode.` });
      }
      const { call } = await getBridge();
      const r = await addToProject({ item: deskItem(prop), project: folders, call, name, mod, collision, textures, parts, log });
      return text({
        ...r,
        next: `Pack the project (REDcode: Pack and Play), then place ${r.entity} with EDGEbuilder, or spawn it with REDnode. The entity is the one to place; the mesh alone has no collision.`,
      });
    } catch (e) {
      return failure(e);
    }
  },
);

/** The Library's root, or an error saying how to set one. */
function needRoot(): string {
  const root = libraryRoot();
  if (root) return root;
  const recorded = recordedLibraryRoot();
  throw new Error(
    recorded
      ? `The Library's folder is missing: ${recorded}. A drive may be unplugged; or set another with fab_library's root.`
      : `No EDGE Library is set up yet. Ask the user where to keep it (suggest ${suggestedLibraryRoot()}), then set it with fab_library's root.`,
  );
}

server.registerTool(
  "fab_library",
  {
    description:
      "The EDGE Library: one folder every EDGE tool shares (in %APPDATA%\\EDGE\\library.json), outside any project, where the modder keeps reusable things in folders of their own. " +
      "EDGEfab's items are props (<name>.prop.asset folders, with their game files built in); other tools' items (mesh, sound, quickhack assets, scenes) and model files (GLB, FBX, .blend) show too. " +
      "Lists one folder: its sub-folders, asset items (kind, name, version) and model files. Also sets things up when the user asks: 'root' sets the Library's folder for every EDGE tool " +
      "(ask the user; suggest Documents\\EDGE Library; never inside the game's folder); 'modder' sets the modder's own folder in Library props' game paths (<modder>\\props\\<name>\\), lowercase, " +
      "such as their modder name: ask the user, it shows in the game's paths.",
    inputSchema: {
      folder: z.string().optional().describe("A folder under the Library, with /; default its top."),
      root: z.string().optional().describe("Set the Library's folder (only when the user says where)."),
      modder: z.string().optional().describe("Set the modder's own folder for game paths (only when the user says)."),
    },
  },
  async ({ folder, root, modder }) => {
    try {
      const set: Record<string, string> = {};
      if (root) set.root = setLibraryRoot(root, { gameDir: await gameFolder() });
      if (modder) set.modder = setModderFolder(modder);
      const r = libraryRoot();
      if (!r) return text({ ...set, library: needRootMessage(), modder: modderFolder() ?? "not set" });
      const here = libraryFolder(r, folder);
      return text({
        ...set,
        root: r,
        modder: modderFolder() ?? "not set: ask the user before the first fab_library_add",
        folder: here.rel || "(top)",
        folders: here.folders.map((f) => f.rel),
        assets: here.assets.map((a) => ({ path: a.rel, kind: a.kind, name: a.title, version: a.version, id: a.id, main: a.main ?? undefined, ours: a.kind === "prop" })),
        modelFiles: here.files.map((f) => f.file),
      });
    } catch (e) {
      return failure(e);
    }
  },
);

function needRootMessage(): string {
  try {
    needRoot();
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

server.registerTool(
  "fab_library_add",
  {
    description:
      "Add to Library: a prop on EDGEfab's Desk goes into the EDGE Library with its game files built in (mesh, materials, entity with collision; REDbridge, as fab_add), under the modder's own " +
      "game folder <modder>\\props\\<name>\\, so it is the same in every project. The same prop again (it keeps its id) updates the Library's item where it is, one version up; projects that took it see the newer " +
      "version with fab_refresh. folder: the modder's own folder under the Library (ask, or use the last one). useGamePath: put it in folders matching its game path under that folder, made if missing " +
      "(the modder's choice, so the Library browses like the game's files). The prop needs its size known (fab_size). About as long as fab_add from the Desk.",
    inputSchema: {
      prop: z.string().describe("The Desk prop: its name (fab_desk lists them) or its folder."),
      folder: z.string().optional().describe("A folder under the Library, with /, such as Production/Meshes; default the last one used, else the top. Made if missing. Ignored when updating."),
      useGamePath: z.boolean().optional().describe("Folders matching its game path under the folder; default the last choice."),
      collision: z.enum(["physical", "box", "none"]).default(DefaultCollision),
    },
  },
  async ({ prop, folder, useGamePath, collision }) => {
    try {
      const root = needRoot();
      const modder = modderFolder();
      if (!modder) throw new Error("The modder's own folder for game paths isn't set: ask the user (such as their modder name, lowercase), then fab_library with modder.");
      const settings = readSettings();
      const place = safeFolder(folder ?? settings.libraryFolder ?? "");
      const byPath = useGamePath ?? settings.useGamePath ?? false;
      const { call } = await getBridge();
      const r = await addToLibrary({ item: deskItem(prop), root, folder: place, useGamePath: byPath, modder, call, collision, tool: `EDGEfab ${__VERSION__}`, gameDir: await gameFolder(), log });
      writeSettings({ libraryFolder: place, useGamePath: byPath });
      return text({ ...r, next: `fab_add with from 'library' and prop '${r.rel}' puts it in a project.` });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_library_edit",
  {
    description:
      "Edit on the Desk: a prop from the EDGE Library copied back onto EDGEfab's Desk, keeping its id, to change (fab_glow, fab_size, fab_make again from its picture). fab_library_add then updates " +
      "the Library's item, one version up. A Desk prop with the same id is replaced only with replace: true (it may hold changes not yet in the Library).",
    inputSchema: {
      prop: z.string().describe("The Library prop: its path under the Library, its folder, or its id."),
      replace: z.boolean().default(false),
    },
  },
  async ({ prop, replace }) => {
    try {
      const root = needRoot();
      const r = editOnDesk(libraryProp(root, prop), root, { replace, tool: `EDGEfab ${__VERSION__}` });
      return text({ ...r, next: "Change it on the Desk, then fab_library_add to update the Library." });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_refresh",
  {
    description:
      "Refresh from Library: EDGEfab's props in a WolvenKit project that came from the EDGE Library (its source\\library.json), each 'newer' (the Library has a later version), 'same' or 'missing' " +
      "(not found in the Library). update: true copies the newer versions in, as fab_add from 'library' does. Other tools' items in the note are left alone.",
    inputSchema: {
      project: z.string().describe("The WolvenKit project: its folder, its .cpmodproj, or its source\\archive."),
      update: z.boolean().default(false),
    },
  },
  async ({ project, update }) => {
    try {
      const folders = projectFolders(project);
      if (!folders) throw new Error(`${project} is not a WolvenKit project.`);
      const root = needRoot();
      const lines = refreshList(folders.dir, root);
      const updated = update ? lines.filter((l) => l.state === "newer" && l.prop).map((l) => addFromLibrary(l.prop!, folders, root)) : [];
      return text({
        props: lines.map((l) => ({ path: l.prop?.rel ?? l.entry.path, name: l.prop?.title, state: l.state, inProject: l.entry.version, inLibrary: l.prop?.version })),
        updated: update ? updated.map((u) => ({ entity: u.entity, version: u.version })) : undefined,
      });
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_rename",
  {
    description:
      "Rename: a prop on EDGEfab's Desk gets a new name, and its folder, model, textures and materials take it too (lowercase, no spaces; _2 when taken), so Add to Project names every game file after it. It keeps its id, so the Library still knows it. " +
      "A project it was added to keeps the old name until fab_add again.",
    inputSchema: {
      prop: z.string().describe("The Desk prop: its name (fab_desk lists them) or its folder."),
      name: z.string().describe("The new name, in words, such as Rusty oil drum."),
    },
  },
  async ({ prop, name }) => {
    try {
      return text(await renameItem(deskItem(prop), name, { version: __VERSION__ }));
    } catch (e) {
      return failure(e);
    }
  },
);

server.registerTool(
  "fab_tripo",
  {
    description:
      "Tripo, EDGEfab's 3D model service. action 'status': whether a Tripo key is set and where it comes from (REDcode's Keys, shared by every EDGE tool, or TRIPO_API_KEY; the key itself is never shown), the plan recorded, and the credit balance. " +
      "action 'set_plan' records whether the modder's Tripo plan is 'paid' (the models are theirs to release) or 'free' (Tripo keeps all rights): ask the user, don't guess.",
    inputSchema: { action: z.enum(["status", "set_plan"]).default("status"), plan: z.enum(["paid", "free"]).optional() },
  },
  async ({ action, plan }) => {
    try {
      if (action === "set_plan") {
        if (!plan) throw new Error("Pass plan: 'paid' or 'free', as the user says.");
        return text({ plan: writeSettings({ tripoPlan: plan }).tripoPlan });
      }
      const tripo = await keySource("tripo");
      const openai = await keySource("openai");
      let balance: number | string | undefined;
      if (tripo.set) {
        try {
          balance = (await tripoBalance({ key: await apiKey("tripo") })).balance;
        } catch (e) {
          balance = e instanceof Error ? e.message : String(e);
        }
      }
      return text({
        key: tripo.set ? `set, from ${tripo.from}` : tripo.from,
        plan: readSettings().tripoPlan ?? "not recorded",
        credits: balance,
        perModel: {
          fromPicture: { standard: tripoCredits({ ...DetailLevels.standard.settings, views: {} as never, parts: true }), high: tripoCredits({ ...DetailLevels.high.settings, views: {} as never, parts: true }) },
          fromWords: { standard: tripoCredits({ ...DetailLevels.standard.settings, parts: true }), high: tripoCredits({ ...DetailLevels.high.settings, parts: true }) },
          note: "in parts with the detailed texture, as Tripo charged on 2026-11-09",
        },
        pictures: openai.set ? `OpenAI key set, from ${openai.from}: fab_picture draws four views first` : `no OpenAI key (${openai.from}); fab_make from 'tripo' works without it`,
      });
    } catch (e) {
      return failure(e);
    }
  },
);

// The bridge goes with the server: when the assistant closes the channel, or the process ends.
const stopBridge = () => {
  keysBridge?.close();
  void bridge?.then((b) => b.client.stop(), () => undefined);
};
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
