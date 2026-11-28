// F3b, Fix Mesh (plan.md, "F3 Blender sources, in stages"): a Desk prop's shape cleaned up by Blender in the
// background, then prepared again, so its levels of detail, parts, textures and glow come through. The cleanup
// tried in F1 (docs/testing.md, "F1 check: shape cleanup in Blender"), written again here, and more:
// - doubled vertices merged (closer than a ten-thousandth of the model's size);
// - faces turned against the rest of their surface turned back, only where the surface is one sheet;
// - small holes filled (a few edges, small beside the surface around them), their UVs from their edges;
// - loose bits dropped: tiny islands of a few faces, far smaller than the model;
// - near-flat ripples pressed flat: regions of faces within `angle` of their first face, nearly flat as a whole,
//   their inner vertices put on the region's plane, so the edges between regions and the creases stay; then the
//   flattened regions' faces dissolved at 1° and triangulated.
// It always starts from the item's source model (Tripo's original.glb, or Blender's from_blender.glb), so fixing
// again doesn't stack. The model as it was before the first fix is kept in before_fix/, for Undo Fix. No VS Code.

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BlenderError, findBlender } from "./blender";
import { keepPaintedGlow } from "./glow";
import { renameInside, type AssetRecord } from "./make";
import { prepareModel, readPrepared, whoMade, type PrepareResult } from "./prepare";

/** The ripple angle F1's check settled on: the back panel's ripple bands gone, real shapes kept. */
export const DefaultFixAngle = 15;

/** What Blender changed, in counts. */
export interface FixReport {
  blender: string;
  /** Doubled vertices merged. */
  merged: number;
  /** Faces turned the other way from the surface around them, turned back. */
  flipped: number;
  /** Small holes filled. */
  holes: number;
  /** Loose bits dropped, and their faces. */
  loose: number;
  looseFaces: number;
  /** Near-flat regions pressed flat, the vertices moved and the largest move, in metres. */
  flattened: number;
  moved: number;
  largestMove: number;
  trianglesBefore: number;
  trianglesAfter: number;
}

export interface FixResult {
  folder: string;
  name: string;
  report: FixReport;
  /** The report in plain sentences. */
  said: string[];
  prepared: PrepareResult;
  /** Notes beyond prepare's: a glow that couldn't be kept. */
  notes: string[];
}

/** fix.json, beside the model: what the last Fix Mesh did. */
export interface FixRecord {
  date: string;
  angle: number;
  /** The source it started from, in the item. */
  source: string;
  report: FixReport;
}

export class FixError extends Error {}

const BeforeFix = "before_fix";

// blender --background --factory-startup --disable-autoexec --python <this> -- <in.glb> <out.glb> <report> <angle>
const Script = String.raw`
import bpy, bmesh, json, math, sys
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
src, out, report_path, angle = args[0], args[1], args[2], float(args[3])
report = {"blender": bpy.app.version_string.split(" ")[0], "merged": 0, "flipped": 0, "holes": 0, "loose": 0, "looseFaces": 0,
          "flattened": 0, "moved": 0, "largestMove": 0.0, "trianglesBefore": 0, "trianglesAfter": 0}

def fail(message):
    report["error"] = message
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f)
    sys.exit(0)

bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    bpy.ops.import_scene.gltf(filepath=src)
except Exception as e:
    fail("Blender could not open the model: " + (str(e).strip().splitlines() or ["?"])[-1])

objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not objects:
    fail("The model has no mesh.")

corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
lo = Vector((min(p.x for p in corners), min(p.y for p in corners), min(p.z for p in corners)))
hi = Vector((max(p.x for p in corners), max(p.y for p in corners), max(p.z for p in corners)))
diag = (hi - lo).length or 1.0
cos_limit = math.cos(math.radians(angle))

def tris(bm):
    return sum(len(f.verts) - 2 for f in bm.faces)

def islands(bm):
    bm.faces.ensure_lookup_table()
    seen = [False] * len(bm.faces)
    out = []
    for f in bm.faces:
        if seen[f.index]:
            continue
        seen[f.index] = True
        group, stack = [], [f]
        while stack:
            g = stack.pop()
            group.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if not seen[h.index]:
                        seen[h.index] = True
                        stack.append(h)
        out.append(group)
    return out

def box_diag(verts, s):
    if not verts:
        return 0.0
    xs = [v.co.x for v in verts]; ys = [v.co.y for v in verts]; zs = [v.co.z for v in verts]
    return Vector((max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))).length * s

def narrow_width(verts, centre, normal):
    # The region's extent across its main direction in its plane (2D principal axes).
    u = normal.orthogonal().normalized()
    w = normal.cross(u)
    pts = [((v.co - centre).dot(u), (v.co - centre).dot(w)) for v in verts]
    mx = sum(p[0] for p in pts) / len(pts)
    my = sum(p[1] for p in pts) / len(pts)
    cxx = sum((p[0] - mx) ** 2 for p in pts)
    cyy = sum((p[1] - my) ** 2 for p in pts)
    cxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
    t = 0.5 * math.atan2(2 * cxy, cxx - cyy) + math.pi / 2
    a, b = math.cos(t), math.sin(t)
    across = [p[0] * a + p[1] * b for p in pts]
    return max(across) - min(across)

def solve(a, b):
    # Gaussian elimination with pivoting; None when singular.
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        if abs(m[p][c]) < 1e-12:
            return None
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c:
                k = m[r][c] / m[c][c]
                for j in range(c, n + 1):
                    m[r][j] -= k * m[c][j]
    return [m[i][n] / m[i][i] for i in range(n)]

def curved(verts, centre, normal):
    # Whether one smooth bend explains the region's heights: a quadric h = a u2 + b uv + c v2 + d u + e v + f
    # fitted by least squares takes most of their spread. Ripples go up and down and don't fit one.
    u = normal.orthogonal().normalized()
    w = normal.cross(u)
    rows, hs = [], []
    for v in verts:
        d = v.co - centre
        x, y = d.dot(u), d.dot(w)
        rows.append([x * x, x * y, y * y, x, y, 1.0])
        hs.append(d.dot(normal))
    if len(rows) < 8:
        return True  # too few to tell: leave it
    ata = [[sum(r[i] * r[j] for r in rows) for j in range(6)] for i in range(6)]
    atb = [sum(r[i] * h for r, h in zip(rows, hs)) for i in range(6)]
    k = solve(ata, atb)
    if k is None:
        return True
    mean = sum(hs) / len(hs)
    total = sum((h - mean) ** 2 for h in hs)
    rest = sum((h - sum(c * x for c, x in zip(k, r))) ** 2 for r, h in zip(rows, hs))
    return total <= 0 or rest / total < 0.2

# Each object's mesh as it came, its normals kept: the fixed mesh takes them back (Data Transfer below), except
# where a ripple was pressed flat. Made again from the shape, Tripo's models look faceted (seen 2026-11-28).
FLAT = "edgefab_flattened"
sources = {}
for o in objects:
    if o.data.name not in sources:
        sources[o.data.name] = o.data.copy()
    src = bpy.data.objects.new(o.name + "_edgefab_source", sources[o.data.name])
    bpy.context.scene.collection.objects.link(src)
    src.matrix_world = o.matrix_world.copy()
    src.hide_render = True
    if FLAT not in o.vertex_groups:
        o.vertex_groups.new(name=FLAT)
    o["edgefab_source"] = src.name

done = set()
for o in objects:
    me = o.data
    if me.name in done:
        continue  # a mesh shared by several objects is fixed once
    done.add(me.name)
    s = max(abs(c) for c in o.matrix_world.to_scale()) or 1.0
    bm = bmesh.new()
    bm.from_mesh(me)
    deform = bm.verts.layers.deform.verify()
    flat_group = o.vertex_groups[FLAT].index
    report["trianglesBefore"] += tris(bm)
    uv_layers = list(bm.loops.layers.uv.values())

    # Doubled vertices.
    n = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=diag * 1e-4 / s)
    report["merged"] += n - len(bm.verts)
    bmesh.ops.dissolve_degenerate(bm, dist=diag * 1e-6 / s, edges=bm.edges[:])
    bm.faces.index_update()

    # Loose bits: tiny islands of a few faces, never the whole mesh.
    groups = islands(bm)
    if len(groups) > 1:
        gone = []
        for g in groups:
            verts = {v for f in g for v in f.verts}
            if len(g) <= 8 and box_diag(verts, s) < diag * 0.003:
                gone.append(g)
        if len(gone) < len(groups):
            for g in gone:
                report["loose"] += 1
                report["looseFaces"] += len(g)
                bmesh.ops.delete(bm, geom=g, context="FACES")
        bm.faces.index_update()

    # Flipped faces: per one-sheet island, the faces turned against most of it.
    for g in islands(bm):
        if any(len(e.link_faces) > 2 for f in g for e in f.edges):
            continue  # not one sheet: leave it
        before = [f.normal.copy() for f in g]
        bmesh.ops.recalc_face_normals(bm, faces=g)
        for f in g:
            f.normal_update()
        turned = [f for f, n0 in zip(g, before) if f.normal.dot(n0) < 0]
        if len(turned) * 2 > len(g):
            # Its whole side was chosen the other way: keep the island's own side, turn only the few.
            bmesh.ops.reverse_faces(bm, faces=g)
            was = set(turned)
            turned = [f for f in g if f not in was]
        report["flipped"] += len(turned)
    bm.faces.index_update()

    # Small holes: boundary loops of a few edges, small beside their island.
    boundary = [e for e in bm.edges if len(e.link_faces) == 1]
    used = set()
    face_island = {}
    for i, g in enumerate(islands(bm)):
        for f in g:
            face_island[f.index] = (i, g)
    for e0 in boundary:
        if e0 in used:
            continue
        loop, v, e, ok = [e0], e0.verts[1], e0, True
        used.add(e0)
        while v != e0.verts[0]:
            nxt = [x for x in v.link_edges if x is not e and len(x.link_faces) == 1]
            if len(nxt) != 1 or len(loop) > 64:
                ok = False
                break
            e = nxt[0]
            used.add(e)
            loop.append(e)
            v = e.other_vert(v)
        if not ok or len(loop) < 3 or len(loop) > 12:
            continue
        verts = {x for ed in loop for x in ed.verts}
        _, g = face_island[loop[0].link_faces[0].index]
        around = {x for f in g for x in f.verts}
        if box_diag(verts, s) > diag * 0.02 or box_diag(verts, s) > box_diag(around, s) * 0.2:
            continue  # big, or the rim of a small open piece: left open
        made = bmesh.ops.holes_fill(bm, edges=loop, sides=len(loop))["faces"]
        neighbour = loop[0].link_faces[0]
        for f in made:
            f.material_index = neighbour.material_index
            f.smooth = neighbour.smooth
            for l in f.loops:
                others = [x for x in l.vert.link_loops if x.face not in made]
                for uv in uv_layers:
                    if others:
                        l[uv].uv = others[0][uv].uv
        report["holes"] += 1
    bm.faces.index_update()
    bm.normal_update()

    # Ripples: near-flat regions pressed onto their plane.
    bm.faces.ensure_lookup_table()
    region = [-1] * len(bm.faces)
    flat_faces = set()
    order = sorted(bm.faces, key=lambda f: -f.calc_area())
    rid = 0
    for seed in order:
        if region[seed.index] >= 0:
            continue
        n0 = seed.normal.copy()
        group, stack = [seed], [seed]
        region[seed.index] = rid
        while stack:
            f = stack.pop()
            for e in f.edges:
                if len(e.link_faces) != 2:
                    continue
                for h in e.link_faces:
                    if region[h.index] < 0 and h.material_index == seed.material_index and h.normal.dot(n0) >= cos_limit:
                        region[h.index] = rid
                        group.append(h)
                        stack.append(h)
        rid += 1
        if len(group) < 6:
            continue
        area = sum(f.calc_area() for f in group)
        if area * s * s < (diag * 0.02) ** 2:
            continue
        normal = Vector((0, 0, 0))
        centre = Vector((0, 0, 0))
        for f in group:
            a = f.calc_area()
            normal += f.normal * a
            centre += f.calc_center_median() * a
        if normal.length == 0:
            continue
        normal.normalize()
        centre /= area
        verts = {v for f in group for v in f.verts}
        deviation = max(abs((v.co - centre).dot(normal)) for v in verts) * s
        # Against its narrow width: a strip of a cylinder is nearly flat along its length, not across it.
        if deviation <= 1e-7 or deviation > narrow_width(verts, centre, normal) * s * 0.03:
            continue  # flat already, or a real curve
        if curved(verts, centre, normal):
            continue  # one smooth bend (a strip of a cylinder, a dome), not ripples
        members = set(group)
        inner = [v for v in verts if all(f in members for f in v.link_faces) and all(len(e.link_faces) == 2 for e in v.link_edges)]
        if not inner:
            continue
        for v in inner:
            d = (v.co - centre).dot(normal)
            v.co -= normal * d
            v[deform][flat_group] = 1.0
            report["largestMove"] = max(report["largestMove"], abs(d) * s)
        report["moved"] += len(inner)
        report["flattened"] += 1
        flat_faces.update(group)
    if flat_faces:
        inside = [e for e in bm.edges if len(e.link_faces) == 2 and all(f in flat_faces for f in e.link_faces)]
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), use_dissolve_boundaries=False, verts=[], edges=inside, delimit={"MATERIAL", "UV"})
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    report["trianglesAfter"] += tris(bm)
    bm.to_mesh(me)
    bm.free()
    # Normals: made from the shape (smooth, creases over 30° kept), for the flattened vertices; every other
    # vertex takes back the normal it came with.
    try:
        me.normals_split_custom_set([(0.0, 0.0, 0.0)] * len(me.loops))
    except Exception:
        pass
    for p in me.polygons:
        p.use_smooth = True
    if hasattr(me, "set_sharp_from_angle"):
        me.set_sharp_from_angle(angle=math.radians(30))
    if hasattr(me, "use_auto_smooth"):
        me.use_auto_smooth = True  # Blender before 4.1: custom normals need it
    me.update()

for o in objects:
    m = o.modifiers.new("edgefab_normals", "DATA_TRANSFER")
    m.object = bpy.data.objects[o["edgefab_source"]]
    m.use_loop_data = True
    m.data_types_loops = {"CUSTOM_NORMAL"}
    m.loop_mapping = "POLYINTERP_NEAREST"
    m.vertex_group = FLAT
    m.invert_vertex_group = True
    del o["edgefab_source"]

# Only the fixed objects are written (export_apply takes in the normals' modifier).
for o in bpy.context.scene.objects:
    try:
        o.select_set(o in objects)
    except RuntimeError:
        pass

wanted = {
    "filepath": out, "export_format": "GLB", "use_selection": True, "use_active_scene": True,
    "export_apply": True, "export_yup": True, "export_texcoords": True, "export_normals": True,
    "export_tangents": True, "export_materials": "EXPORT", "export_image_format": "AUTO",
    "export_animations": False, "export_skins": False, "export_morph": False,
    "export_cameras": False, "export_lights": False, "export_extras": False,
}
known = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
try:
    bpy.ops.export_scene.gltf(**dict((k, v) for k, v in wanted.items() if k in known))
except Exception as e:
    fail("Blender could not write the fixed model: " + (str(e).strip().splitlines() or ["?"])[-1])

with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f)
`;

/** Runs the cleanup on `input` into `output`. Throws BlenderError in plain words. */
export async function blenderFix(input: string, output: string, opts: { blender?: string; angle?: number; timeoutMs?: number } = {}): Promise<FixReport> {
  const blender = opts.blender ?? (await findBlender());
  if (!blender) throw new BlenderError("Blender isn't found: install it (blender.org or Steam), or set EDGEfab's Blender Path (edgefab.blenderPath) to blender.exe.");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "edgefab-fix-"));
  const script = path.join(work, "fix.py");
  const reportFile = path.join(work, "report.json");
  fs.writeFileSync(script, Script);
  try {
    fs.rmSync(output, { force: true });
    const said = await new Promise<string>((resolve, reject) => {
      execFile(
        blender,
        ["--background", "--factory-startup", "--disable-autoexec", "--python-exit-code", "1", "--python", script, "--", path.resolve(input), path.resolve(output), reportFile, String(opts.angle ?? DefaultFixAngle)],
        { windowsHide: true, timeout: opts.timeoutMs ?? 10 * 60_000, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const all = `${stdout}\n${stderr}`;
          if (err && !fs.existsSync(reportFile)) {
            const timedOut = (err as NodeJS.ErrnoException & { killed?: boolean }).killed;
            const last = all.trim().split(/\r?\n/).filter((l) => /error/i.test(l)).at(-1);
            reject(new BlenderError(timedOut ? "Blender took more than 10 minutes fixing the mesh and was stopped." : `Blender stopped without fixing the mesh${last ? `: ${last.trim()}` : ""}.`));
          } else resolve(all);
        },
      );
    });
    if (!fs.existsSync(reportFile)) {
      const last = said.trim().split(/\r?\n/).filter((l) => /error/i.test(l)).at(-1);
      throw new BlenderError(`Blender stopped without fixing the mesh${last ? `: ${last.trim()}` : ""}.`);
    }
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8")) as FixReport & { error?: string };
    if (report.error) throw new BlenderError(report.error);
    if (!fs.existsSync(output)) throw new BlenderError("Blender wrote no fixed model.");
    delete report.error;
    return report;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const length = (m: number) => (m >= 0.01 ? `${Math.round(m * 1000) / 10} cm` : `${Math.max(0.1, Math.round(m * 10000) / 10)} mm`);

/** The report in plain sentences, for the Desk's message and fab_fix. */
export function describeFix(r: FixReport): string[] {
  const did: string[] = [];
  if (r.merged) did.push(`merged ${count(r.merged, "doubled vertex", "doubled vertices")}`);
  if (r.flattened) did.push(`flattened ${count(r.flattened, "rippled area")} (${count(r.moved, "vertex", "vertices")} moved, at most ${length(r.largestMove)})`);
  if (r.flipped) did.push(`turned ${count(r.flipped, "flipped face")} back`);
  if (r.holes) did.push(`filled ${count(r.holes, "small hole")}`);
  if (r.loose) did.push(`dropped ${count(r.loose, "loose bit")} (${count(r.looseFaces, "face")})`);
  const lines = [did.length ? `${did.join(", ").replace(/^./, (c) => c.toUpperCase())}.` : "Its mesh was clean: nothing to fix."];
  if (r.trianglesBefore !== r.trianglesAfter) lines.push(`${r.trianglesBefore.toLocaleString("en-US")} triangles became ${r.trianglesAfter.toLocaleString("en-US")}.`);
  return lines;
}

interface Item {
  folder: string;
  name: string;
  raw: string;
}

function itemOf(folder: string): Item {
  const base = path.basename(folder);
  if (!base.endsWith(".prop.asset") || !fs.existsSync(path.join(folder, "asset.json"))) throw new FixError(`${folder} is not a Desk prop (a <name>.prop.asset folder).`);
  const name = base.slice(0, -".prop.asset".length);
  return { folder, name, raw: path.join(folder, "source", "raw", name) };
}

/** The model a Desk prop was made from, before prepare: Blender's export for a .blend, .fbx or .obj, else the original. */
function sourceOf(raw: string): string | undefined {
  return ["from_blender.glb", "original.glb", "original.gltf"].map((f) => path.join(raw, f)).find((f) => fs.existsSync(f));
}

/** The files of a prepared model in the item: its game GLB, view.glb, textures and glow maps, and prepared.json. */
function preparedFiles(raw: string, p: PrepareResult): string[] {
  const here = (f: string) => path.join(raw, path.basename(f));
  const files = [p.glb, p.view, ...p.textures.map((t) => t.file), ...p.glow.map((g) => g.texture)].filter((f): f is string => !!f).map(here);
  return [...new Set([...files, path.join(raw, "prepared.json")])].filter((f) => fs.existsSync(f));
}

function addHistory(folder: string, did: string, version: string): void {
  const f = path.join(folder, "asset.json");
  const asset = JSON.parse(fs.readFileSync(f, "utf8")) as AssetRecord;
  asset.history = [...(asset.history ?? []), { tool: `EDGEfab ${version}`, did, date: new Date().toISOString() }];
  fs.writeFileSync(f, JSON.stringify(asset, null, 2));
}

/** Whether a Desk prop's mesh was fixed, and how: its fix.json, while Undo Fix can still put it back. */
export function fixState(folder: string): FixRecord | undefined {
  const { raw } = itemOf(folder);
  if (!fs.existsSync(path.join(raw, BeforeFix, "prepared.json"))) return undefined;
  try {
    return JSON.parse(fs.readFileSync(path.join(raw, "fix.json"), "utf8")) as FixRecord;
  } catch {
    return undefined;
  }
}

/**
 * Fix Mesh on a Desk prop: its source model cleaned up by Blender, then prepared again with the same size, facing
 * and maker; a painted glow is kept. The model before the first fix goes to before_fix/ for undoFix. Changes the
 * item only: a prop in a project needs Add to Project again.
 */
export async function fixMesh(folder: string, opts: { version: string; blender?: string; angle?: number; onProgress?: (step: string) => void }): Promise<FixResult> {
  const item = itemOf(folder);
  const { raw, name } = item;
  const old = readPrepared(raw);
  const source = sourceOf(raw);
  if (!old || !source) throw new FixError(`${name} isn't a model yet: make it first.`);
  const angle = opts.angle ?? DefaultFixAngle;
  if (!(angle > 0 && angle <= 45)) throw new FixError("The ripple angle is above 0°, up to 45° (15° is the default).");
  const progress = opts.onProgress ?? (() => undefined);

  // Who made it, from the source itself: Blender writes its own generator.
  const by = await whoMade(source);
  const fixed = path.join(raw, "fixed.glb");
  progress("Fixing the mesh in Blender...");
  const temp = path.join(raw, `fixed.${process.pid}.tmp.glb`);
  let report: FixReport;
  try {
    report = await blenderFix(source, temp, { blender: opts.blender, angle });
  } catch (e) {
    fs.rmSync(temp, { force: true });
    throw e;
  }

  // Keep the model as it is now, the first time: Undo Fix puts it back.
  const before = path.join(raw, BeforeFix);
  const firstFix = !fs.existsSync(path.join(before, "prepared.json"));
  const nowFiles = preparedFiles(raw, old);
  if (firstFix) {
    fs.rmSync(before, { recursive: true, force: true });
    fs.mkdirSync(before, { recursive: true });
    for (const f of nowFiles) fs.copyFileSync(f, path.join(before, path.basename(f)));
  }

  progress("Preparing it for the game again...");
  // The same size: a height asked or set (Set Size) is kept; a size Tripo didn't give stays unknown.
  const scaled = old.notes.some((n) => /^Scaled to /.test(n));
  let prepared: PrepareResult;
  try {
    fs.renameSync(temp, fixed);
    prepared = await prepareModel(fixed, raw, name, { by, ...(scaled && !old.sizeUnknown ? { height: +old.size.height.toFixed(4) } : {}) });
  } catch (e) {
    // The item as it was: the copies back, the fixed model gone.
    if (firstFix) {
      for (const f of fs.readdirSync(before)) fs.copyFileSync(path.join(before, f), path.join(raw, f));
      fs.rmSync(before, { recursive: true, force: true });
    }
    fs.rmSync(fixed, { force: true });
    throw e;
  }
  // Its size notes as they were (prepare's own says "as asked").
  if (scaled && !old.sizeUnknown) prepared.notes = [...prepared.notes.filter((n) => !/^Scaled to /.test(n)), ...old.notes.filter((n) => /^Scaled to /.test(n))];
  const said = describeFix(report);
  prepared.notes = [...prepared.notes, `Mesh fixed: ${said.join(" ")}`];
  fs.writeFileSync(path.join(raw, "prepared.json"), JSON.stringify(prepared, null, 2));
  const notes = await keepPaintedGlow(folder, old.glow.filter((g) => g.painted));
  const result = readPrepared(raw)!;

  // Files of the model before that this one doesn't use (a part's textures under an old name).
  const keep = new Set(preparedFiles(raw, result).map((f) => f.toLowerCase()));
  for (const f of nowFiles) if (!keep.has(f.toLowerCase())) fs.rmSync(f, { force: true });

  const record: FixRecord = { date: new Date().toISOString(), angle, source: path.basename(source), report };
  fs.writeFileSync(path.join(raw, "fix.json"), JSON.stringify(record, null, 2));
  addHistory(folder, `Fixed its mesh in Blender ${report.blender} (ripples at ${angle}°): ${said.join(" ")}`, opts.version);
  return { folder, name, report, said, prepared: result, notes };
}

/** Undo Fix: the model as it was before the first Fix Mesh, back in place; the fixed one goes. */
export async function undoFix(folder: string, opts: { version: string }): Promise<PrepareResult> {
  const { raw, name } = itemOf(folder);
  const before = path.join(raw, BeforeFix);
  if (!fs.existsSync(path.join(before, "prepared.json"))) throw new FixError(`${name}'s mesh hasn't been fixed, so there is nothing to undo.`);
  const now = readPrepared(raw);
  for (const f of now ? preparedFiles(raw, now) : []) fs.rmSync(f, { force: true });
  for (const f of ["fixed.glb", "fix.json"]) fs.rmSync(path.join(raw, f), { force: true });
  for (const f of fs.readdirSync(before)) fs.renameSync(path.join(before, f), path.join(raw, f));
  fs.rmSync(before, { recursive: true, force: true });
  // Renamed since the fix: the files put back take the item's name.
  await renameInside(raw, name);
  addHistory(folder, "Undid Fix Mesh: the mesh as it was before", opts.version);
  return readPrepared(raw)!;
}
