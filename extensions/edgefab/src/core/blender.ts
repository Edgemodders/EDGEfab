// F3a, Blender files onto the Desk: a .blend, .fbx or .obj opened by Blender in the background and exported as
// one GLB, which F1's prepare then takes as any GLB. Blender is found as REDcode finds it. No VS Code imports.
//
// Blender runs with --factory-startup and --disable-autoexec, so neither the modder's add-ons nor a .blend's own
// Python run. The script writes a report (JSON) beside the GLB: what came, what was left aside, and materials the
// game can't take as they are.

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** The model files Blender turns into a GLB for EDGEfab. */
export const BlenderExtensions = [".blend", ".fbx", ".obj"] as const;
/** Every model file Import a Model and Make a Prop take. */
export const ModelExtensions = [".glb", ".gltf", ...BlenderExtensions] as const;

export const needsBlender = (file: string) => (BlenderExtensions as readonly string[]).includes(path.extname(file).toLowerCase());

/** Steam's install folder from the registry (Windows), for Blender bought on Steam. */
function steamFolder(): Promise<string | undefined> {
  if (process.platform !== "win32") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    execFile("reg", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      const m = !err && stdout.match(/SteamPath\s+REG_\w+\s+(.+?)\s*$/im);
      resolve(m ? path.normalize(m[1]) : undefined);
    });
  });
}

function steamLibraries(steam: string): string[] {
  const libraries = [path.resolve(steam)];
  try {
    const vdf = fs.readFileSync(path.join(steam, "steamapps", "libraryfolders.vdf"), "utf8");
    for (const m of vdf.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) libraries.push(path.resolve(m[1].replace(/\\\\/g, "\\")));
  } catch {
    // no library list: the install folder alone
  }
  return [...new Map(libraries.map((l) => [l.toLowerCase(), l])).values()];
}

const exeOf = (p: string) => (/\.exe$/i.test(p) || (process.platform !== "win32" && path.basename(p) === "blender") ? p : path.join(p, process.platform === "win32" ? "blender.exe" : "blender"));

/**
 * blender.exe: the configured path (the exe or its folder; EDGEfab's setting, else REDcode's), else
 * EDGEFAB_BLENDER, else the newest under Blender Foundation, else a Steam install. Undefined when none is found.
 */
export async function findBlender(configured?: string): Promise<string | undefined> {
  const given = configured?.trim() || process.env.EDGEFAB_BLENDER?.trim();
  if (given) return fs.existsSync(exeOf(given)) ? exeOf(given) : undefined;
  const foundation = path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Blender Foundation");
  try {
    const versions = fs.readdirSync(foundation).filter((d) => fs.existsSync(path.join(foundation, d, "blender.exe")));
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })); // "Blender 5.2" before "Blender 4.2"
    if (versions[0]) return path.join(foundation, versions[0], "blender.exe");
  } catch {
    // no Blender Foundation folder
  }
  const steam = (await steamFolder()) ?? path.join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Steam");
  for (const library of steamLibraries(steam)) {
    const p = path.join(library, "steamapps", "common", "Blender", "blender.exe");
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/** What Blender found in the file and did with it. */
export interface BlenderReport {
  /** Blender's version, such as "5.2.3". */
  blender: string;
  /** The meshes exported, by object name (the part names), with their triangles before prepare. */
  meshes: { name: string; triangles: number; materials: string[] }[];
  /** Left aside, in plain words: armatures, animation, shape keys, cameras, lights, hidden objects, curves and text. */
  leftAside: string[];
  /** Materials whose color comes from nodes with no picture: the game gets their plain color. */
  noPicture: string[];
  /** Texture files the file points at that aren't on disk. */
  missingTextures: string[];
}

export class BlenderError extends Error {}

// The script Blender runs: blender --background --factory-startup --disable-autoexec --python <this> -- <in> <glb> <report>.
// Plain Python, no f-strings with braces that TypeScript would read; keywords this Blender's exporter lacks are dropped.
const Script = String.raw`
import bpy, json, os, sys

args = sys.argv[sys.argv.index("--") + 1:]
src, out, report_path = args[0], args[1], args[2]
ext = os.path.splitext(src)[1].lower()
report = {"blender": bpy.app.version_string.split(" ")[0], "meshes": [], "leftAside": [], "noPicture": [], "missingTextures": []}

def fail(message):
    report["error"] = message
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f)
    sys.exit(0)

try:
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=src)
        elif ext == ".obj":
            if hasattr(bpy.ops.wm, "obj_import"):
                bpy.ops.wm.obj_import(filepath=src)
            else:
                bpy.ops.import_scene.obj(filepath=src)
except Exception as e:
    fail("Blender could not open the file: " + str(e).strip().splitlines()[-1] if str(e).strip() else "Blender could not open the file.")

scene = bpy.context.scene
layer = bpy.context.view_layer
def shown(o):
    try:
        return o.visible_get(view_layer=layer) and not o.hide_render
    except Exception:
        return not o.hide_render

counts = {}
def aside(what):
    counts[what] = counts.get(what, 0) + 1

meshes = []
for o in scene.objects:
    if o.type == "MESH":
        if not shown(o):
            aside("hidden object")
            continue
        meshes.append(o)
        if o.data.shape_keys and len(o.data.shape_keys.key_blocks) > 1:
            aside("shape keys")
        if o.animation_data and o.animation_data.action:
            aside("animation")
    elif o.type == "ARMATURE":
        aside("armature")
    elif o.type in ("CURVE", "SURFACE", "FONT", "META"):
        if shown(o):
            aside("curve or text (convert it to a mesh in Blender to keep it)")
    elif o.type == "CAMERA":
        aside("camera")
    elif o.type == "LIGHT":
        aside("light")
    elif o.type in ("GPENCIL", "GREASEPENCIL"):
        aside("grease pencil drawing")

if not meshes:
    fail("The file has no visible mesh to make a prop from.")

depsgraph = bpy.context.evaluated_depsgraph_get()
used = {}
for o in meshes:
    ev = o.evaluated_get(depsgraph)
    tris = 0
    try:
        m = ev.to_mesh()
        m.calc_loop_triangles()
        tris = len(m.loop_triangles)
        ev.to_mesh_clear()
    except Exception:
        pass
    names = []
    for slot in o.material_slots:
        if slot.material:
            names.append(slot.material.name)
            used[slot.material.name] = slot.material
    report["meshes"].append({"name": o.name, "triangles": tris, "materials": names})

def color_has_picture(mat):
    if not mat.use_nodes or not mat.node_tree:
        return False
    bsdf = [n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"]
    if not bsdf:
        return False
    sock = bsdf[0].inputs.get("Base Color")
    if sock is None or not sock.is_linked:
        return True  # a plain color: the glTF exporter keeps it
    seen, todo = set(), [sock.links[0].from_node]
    while todo:
        n = todo.pop()
        if n.name in seen:
            continue
        seen.add(n.name)
        if n.type == "TEX_IMAGE" and n.image:
            return True
        for i in n.inputs:
            for l in i.links:
                todo.append(l.from_node)
    return False

for name, mat in used.items():
    if not color_has_picture(mat):
        report["noPicture"].append(name)

for img in bpy.data.images:
    if img.source == "FILE" and not img.packed_file and img.users:
        p = bpy.path.abspath(img.filepath, library=img.library)
        if p and not os.path.exists(p):
            report["missingTextures"].append(os.path.basename(p) or img.name)

for what, n in sorted(counts.items()):
    report["leftAside"].append(what if n == 1 else what + " (" + str(n) + ")")

for o in scene.objects:
    try:
        o.select_set(o in meshes)
    except RuntimeError:
        pass  # not in the view layer: not exported

wanted = {
    "filepath": out, "export_format": "GLB", "use_selection": True, "use_active_scene": True,
    "export_apply": True, "export_yup": True, "export_texcoords": True, "export_normals": True,
    "export_tangents": True, "export_materials": "EXPORT", "export_image_format": "AUTO",
    "export_animations": False, "export_skins": False, "export_morph": False,
    "export_cameras": False, "export_lights": False, "export_extras": False,
}
known = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
kwargs = dict((k, v) for k, v in wanted.items() if k in known)
try:
    bpy.ops.export_scene.gltf(**kwargs)
except Exception as e:
    fail("Blender could not export the GLB: " + str(e).strip().splitlines()[-1])
if not os.path.exists(out):
    fail("Blender wrote no GLB.")

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f)
`;

/**
 * The file as one GLB at `glb`, by Blender in the background. `file` stays where it is, so a .blend's or FBX's
 * textures beside it are found. Throws BlenderError in plain words.
 */
export async function blenderToGlb(file: string, glb: string, opts: { blender?: string; timeoutMs?: number } = {}): Promise<BlenderReport> {
  const blender = opts.blender ?? (await findBlender());
  if (!blender) throw new BlenderError("Blender isn't found: install it (blender.org or Steam), or set EDGEfab's Blender Path (edgefab.blenderPath) to blender.exe.");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-blender-"));
  const script = path.join(work, "to_glb.py");
  const reportFile = path.join(work, "report.json");
  fs.writeFileSync(script, Script);
  try {
    fs.rmSync(glb, { force: true });
    const output = await new Promise<string>((resolve, reject) => {
      execFile(
        blender,
        ["--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python", script, "--", path.resolve(file), path.resolve(glb), reportFile],
        { windowsHide: true, timeout: opts.timeoutMs ?? 5 * 60_000, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const said = `${stdout}\n${stderr}`;
          if (err && !fs.existsSync(reportFile)) {
            const timedOut = (err as NodeJS.ErrnoException & { killed?: boolean }).killed;
            const last = said.trim().split(/\r?\n/).filter((l) => /error/i.test(l)).at(-1);
            reject(new BlenderError(timedOut ? "Blender took more than 5 minutes and was stopped." : `Blender stopped without a model${last ? `: ${last.trim()}` : ""}.`));
          } else resolve(said);
        },
      );
    });
    if (!fs.existsSync(reportFile)) {
      const last = output.trim().split(/\r?\n/).filter((l) => /error/i.test(l)).at(-1);
      throw new BlenderError(`Blender stopped without a model${last ? `: ${last.trim()}` : ""}.`);
    }
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as BlenderReport & { error?: string };
    if (report.error) throw new BlenderError(report.error);
    if (!fs.existsSync(glb)) throw new BlenderError("Blender wrote no GLB.");
    delete report.error;
    return report;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/** The report in a few plain sentences, for the Desk's message and fab_make. */
export function describeReport(r: BlenderReport): string[] {
  const lines: string[] = [];
  const parts = r.meshes.length;
  lines.push(`Blender ${r.blender} exported ${parts} part${parts === 1 ? "" : "s"}${parts <= 6 ? `: ${r.meshes.map((m) => m.name).join(", ")}` : ""}.`);
  if (r.leftAside.length) lines.push(`Left aside: ${r.leftAside.join(", ")}.`);
  if (r.noPicture.length) lines.push(`Made from nodes with no picture, so the game gets a plain color: ${r.noPicture.join(", ")}. Bake them to a texture in Blender to keep the look.`);
  if (r.missingTextures.length) lines.push(`Texture files not found: ${r.missingTextures.join(", ")}. Put them back beside the file, or pack them in Blender (File, External Data, Pack Resources).`);
  return lines;
}
