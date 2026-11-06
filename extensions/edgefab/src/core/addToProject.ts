// Add to Project: a Desk item becomes a placeable prop in a WolvenKit project (plan.md, "The first build").
//
//   source\raw\<mod>\props\<name>\<name>.glb    the prepared model, kept beside the project's other sources
//   source\archive\<mod>\props\<name>\<name>.mesh  imported over a template (REDbridge), its leftovers replaced
//   ...\<name>_00.mi and its textures            the model's own textures as game materials (EDGEmat's core)
//   ...\<name>.ent                               the prop to place: its mesh, and collision (EDGEfab #2)
//   source\raw\<mod>\props\<name>\<name>.edgefab.json  where it came from and its license
//
// Every REDbridge call goes through one call function (docs/tools-together.md, rule 4), so the extension
// passes REDcode's bridge and the MCP server its own.

import * as fs from "node:fs";
import * as path from "node:path";
import { bridgeOver, materialsFromModel, projectAt, type BridgeCall, type FromModelMaterial, type ModelGlow } from "@edgemodders/edgemat-core";
import { deskDir, slug } from "./config";
import type { AssetRecord } from "./make";
import type { PrepareResult } from "./prepare";

/**
 * How the prop is solid. "physical": one entPhysicalMeshComponent, its box in the mesh's physics data
 * (EDGEbuilder #2's shape; a baked entity with it is solid). "box": an entMeshComponent and an
 * entColliderComponent with a box, as the game's own props do. "none": it only draws.
 * Unverified in the game which of the first two stops V: F0's collision check (Tests) decides the default.
 */
export type Collision = "physical" | "box" | "none";
export const DefaultCollision: Collision = "physical";

/** The mesh a new prop is imported over: a game barrel with LODs and physics data (F0's import check). */
export const DefaultTemplate = "base\\environment\\decoration\\containers\\barrel\\drum\\barrel_drum_a.mesh";

export interface ProjectFolders {
  /** The project folder (holding the .cpmodproj). */
  dir: string;
  /** Its name, the default mod folder. */
  name: string;
  archive: string;
  raw: string;
}

export interface AddRequest {
  /** The Desk item's folder (<name>.prop.asset). */
  item: string;
  project: ProjectFolders;
  call: BridgeCall;
  /** The prop's file name; default the item's. Lowercase, no spaces. */
  name?: string;
  /** The mod's own folder under source\archive; default the project's name. */
  mod?: string;
  collision?: Collision;
  template?: string;
  /** Flip the normal maps' green (glTF's are green up). Which way the game reads them is unverified: for that check. */
  flipNormalGreen?: boolean;
  log?: (line: string) => void;
}

export interface AddResult {
  /** Game paths. */
  mesh: string;
  entity: string;
  /** The prepared model's copy, in source\raw. */
  raw: string;
  /** The record of where it came from. */
  record: string;
  collision: Collision;
  materials: FromModelMaterial[];
  /** Every file written, relative to the project folder. */
  files: string[];
  /** Whether it replaced an earlier Add to Project of the same name. */
  replaced: boolean;
  notes: string[];
}

export class AddError extends Error {}

// ---- WolvenKit JSON helpers --------------------------------------------------------------------------

type Json = any;
const cn = (v: string) => ({ $type: "CName", $storage: "string", $value: v });
const rp = (v: string, flags = "Default") => ({ DepotPath: { $type: "ResourcePath", $storage: "string", $value: v }, Flags: flags });
const q0 = () => ({ $type: "Quaternion", i: 0, j: 0, k: 0, r: 1 });
const v4 = (x: number, y: number, z: number) => ({ $type: "Vector4", W: 0, X: x, Y: y, Z: z });
const v3 = (x: number, y: number, z: number) => ({ $type: "Vector3", X: x, Y: y, Z: z });
const fixed0 = () => ({ $type: "FixedPoint", Bits: 0 });
const worldTransform0 = () => ({ $type: "WorldTransform", Orientation: q0(), Position: { $type: "WorldPosition", x: fixed0(), y: fixed0(), z: fixed0() } });
const value = (v: Json) => (v && typeof v === "object" && "$value" in v ? v.$value : v);

/** A box around the mesh: its centre and half sizes, in the game's axes (Z up). */
interface Box {
  center: [number, number, number];
  half: [number, number, number];
}

function boxOf(root: Json): Box {
  const b = root.boundingBox;
  if (!b?.Min || !b?.Max) throw new AddError("The imported mesh has no bounding box.");
  const lo = [b.Min.X, b.Min.Y, b.Min.Z], hi = [b.Max.X, b.Max.Y, b.Max.Z];
  const center = lo.map((l, i) => (l + hi[i]) / 2) as [number, number, number];
  // A flat side (a sign, a poster) still needs some thickness to stop V: 2 cm at least.
  const half = lo.map((l, i) => Math.max((hi[i] - l) / 2, 0.01)) as [number, number, number];
  return { center, half };
}

/** The game's preset for a solid prop, as its own props have it ("Device solid visible"). */
const solidFilter = (handle: string) => ({
  HandleId: handle,
  Data: {
    $type: "physicsFilterData",
    customFilterData: null,
    preset: cn("Device solid visible"),
    queryFilter: { $type: "physicsQueryFilter", mask1: "0", mask2: "70107400" },
    simulationFilter: { $type: "physicsSimulationFilter", mask1: "114696", mask2: "21579" },
  },
});

const colliderBox = (box: Box, filterData: Json, material: string) => ({
  $type: "physicsColliderBox",
  filterData,
  halfExtents: v3(...box.half),
  isImported: 0,
  isObstacle: 0,
  isQueryShapeOnly: 0,
  localToBody: { $type: "Transform", orientation: q0(), position: v4(...box.center) },
  material: cn(material),
  materialApperanceOverrides: [],
  tag: cn("None"),
  volumeModifier: 1,
});

// ---- the mesh: the template's leftovers replaced ------------------------------------------------------

/**
 * After an import over a template, the mesh still has the template's materials, appearances and physics.
 * Gives it one local material entry per model material (EDGEmat then points each at its .mi), one
 * appearance "default" naming each submesh's material, and the physics the collision needs.
 */
export function fitMesh(json: Json, materials: string[], submeshMaterials: string[], collision: Collision): { box: Box; notes: string[] } {
  const root = json?.Data?.RootChunk;
  if (root?.$type !== "CMesh") throw new AddError("The imported file is not a mesh.");
  const notes: string[] = [];
  const unknown = submeshMaterials.filter((m) => !materials.includes(m));
  if (unknown.length) throw new AddError(`The mesh's parts use materials the model doesn't have: ${[...new Set(unknown)].join(", ")}.`);

  // A material instance shaped as the template's, with no values yet: EDGEmat's applyMaterial gives it its .mi.
  const sample: Json = root.localMaterialBuffer?.materials?.[0] ?? root.preloadLocalMaterialInstances?.[0]?.Data;
  if (!sample) throw new AddError("The template has no local material to start from: use a template whose materials are its own.");
  const instance = () => ({ ...structuredClone(sample), baseMaterial: rp("engine\\materials\\metal_base.remt"), values: [] });
  root.materialEntries = materials.map((name, index) => ({ $type: "CMeshMaterialEntry", index, isLocalInstance: 1, name: cn(name) }));
  if (root.localMaterialBuffer?.materials) root.localMaterialBuffer.materials = materials.map(instance);
  else root.preloadLocalMaterialInstances = materials.map((_, i) => ({ HandleId: String(9000 + i), Data: instance() }));
  root.externalMaterials = [];
  root.preloadExternalMaterials = [];
  root.localMaterialInstances = [];

  const first = root.appearances?.[0];
  root.appearances = [
    {
      HandleId: first?.HandleId ?? "0",
      Data: { $type: "meshMeshAppearance", chunkMaterials: submeshMaterials.map(cn), name: cn("default"), tags: [] },
    },
  ];

  const box = boxOf(root);
  const params: Json[] = root.parameters ?? [];
  const physicsAt = params.findIndex((p) => p?.Data?.$type === "meshMeshParamPhysics");
  if (collision === "physical") {
    const body = params[physicsAt]?.Data?.physicsData?.Data?.bodies?.[0]?.Data;
    const shape = body?.collisionShapes?.[0];
    if (!body || !shape?.Data) throw new AddError("The template has no physics data to put the box in: use the default template, or the box collision.");
    // The template's own shape is a cooked convex hull of the barrel; a box of the new mesh's size replaces it.
    body.collisionShapes = [{ HandleId: shape.HandleId, Data: colliderBox(box, shape.Data.filterData, String(value(shape.Data.material) ?? "None")) }];
    if (body.params) body.params.comOffset = { $type: "Transform", orientation: q0(), position: v4(...box.center) };
    body.name = cn("edgefab box");
  } else if (physicsAt >= 0) {
    params.splice(physicsAt, 1);
  }
  return { box, notes };
}

// ---- the entity -------------------------------------------------------------------------------------

const meshComponent = (type: string, mesh: string, name: string, id: string, extra: Json) => ({
  $type: type,
  LODMode: "AlwaysVisible",
  autoHideDistance: 0,
  castLocalShadows: "Always",
  castRayTracedGlobalShadows: "Always",
  castRayTracedLocalShadows: "Default",
  castShadows: "Always",
  chunkMask: "18446744073709551615",
  forceLODLevel: -1,
  forcedLodDistance: "Default",
  id,
  isEnabled: 1,
  isReplicable: 0,
  localTransform: worldTransform0(),
  mesh: rp(mesh),
  meshAppearance: cn("default"),
  motionBlurScale: 1,
  name: cn(name),
  navigationImpact: { $type: "NavGenNavigationSetting", navmeshImpact: "Ignored" },
  numInstances: 0,
  objectTypeID: "ROT_Static",
  order: 0,
  overrideMeshNavigationImpact: 1,
  parentTransform: null,
  renderSceneLayerMask: "Default",
  renderingPlane: "RPl_Scene",
  version: 0,
  visualScale: v3(1, 1, 1),
  ...extra,
});

/** The prop's .ent, as WolvenKit JSON: its mesh, and its collision. Static (Kinematic): it doesn't fall or get pushed. */
export function entityJson(mesh: string, name: string, collision: Collision, box: Box): Json {
  const components: Json[] = [];
  if (collision === "physical") {
    components.push(
      meshComponent("entPhysicalMeshComponent", mesh, name, "1", {
        filterData: solidFilter("1"),
        filterDataSource: "Parent",
        simulationType: "Kinematic",
        startInactive: 0,
        useResourceSimulationType: 0,
        visibilityAnimationParam: cn("None"),
      }),
    );
  } else {
    components.push(meshComponent("entMeshComponent", mesh, name, "1", {}));
    if (collision === "box") {
      components.push({
        $type: "entColliderComponent",
        colliders: [{ HandleId: "2", Data: colliderBox(box, null, "None") }],
        comOffset: { $type: "Transform", orientation: q0(), position: v4(...box.center) },
        dynamicTrafficSetting: { $type: "TrafficGenDynamicTrafficSetting", impact: "Ignored" },
        filterData: solidFilter("3"),
        id: "2",
        inertia: v3(1, 1, 1),
        isEnabled: 1,
        isReplicable: 0,
        localTransform: worldTransform0(),
        mass: 20,
        massOverride: -1,
        name: cn("collider"),
        parentTransform: null,
        simulationType: "Kinematic",
        startInactive: 0,
        useCCD: 0,
        volume: 0,
      });
    }
  }
  return {
    Header: { WolvenKitVersion: "10.0.0-beta.1", WKitJsonVersion: "0.0.9", GameVersion: 2500, ExportedDateTime: new Date().toISOString(), DataType: "CR2W" },
    Data: {
      Version: 195,
      BuildVersion: 0,
      RootChunk: {
        $type: "entEntityTemplate",
        appearances: [],
        backendDataOverrides: [],
        bindingOverrides: [],
        compiledEntityLODFlags: 0,
        componentResolveSettings: [],
        components,
        cookingPlatform: "PLATFORM_PC",
        defaultAppearance: cn("None"),
        entity: { HandleId: "0", Data: { $type: "entEntity", customCameraTarget: "ECCTV_All", renderSceneLayerMask: "Default" } },
        includeInstanceBuffer: null,
        includes: [],
        inplaceResources: [],
        localData: null,
        resolvedDependencies: [rp(mesh, "Soft")],
        visualTagsSchema: null,
      },
      EmbeddedFiles: [],
    },
  };
}

// ---- Add to Project ---------------------------------------------------------------------------------

/** A Desk item's record and prepared model. Files are found beside prepared.json, so a moved item still works. */
export function readItem(item: string): { name: string; asset: AssetRecord; prepared: PrepareResult; raw: string } {
  const base = path.basename(item);
  if (!base.endsWith(".prop.asset")) throw new AddError(`${item} is not a Desk item (a <name>.prop.asset folder).`);
  const name = base.slice(0, -".prop.asset".length);
  const raw = path.join(item, "source", "raw", name);
  let asset: AssetRecord, prepared: PrepareResult;
  try {
    asset = JSON.parse(fs.readFileSync(path.join(item, "asset.json"), "utf8"));
    prepared = JSON.parse(fs.readFileSync(path.join(raw, "prepared.json"), "utf8"));
  } catch {
    throw new AddError(`${name} isn't prepared yet: it has no asset.json or prepared.json.`);
  }
  const here = (f: string | undefined) => (f ? path.join(raw, path.basename(f)) : undefined);
  prepared = {
    ...prepared,
    glb: here(prepared.glb)!,
    view: prepared.view ? here(prepared.view) : undefined,
    textures: prepared.textures.map((t) => ({ ...t, file: here(t.file)! })),
    glow: (prepared.glow ?? []).map((g) => ({ ...g, texture: here(g.texture) })),
  };
  if (!fs.existsSync(prepared.glb)) throw new AddError(`${name}'s prepared model is missing: ${prepared.glb}`);
  return { name, asset, prepared, raw };
}

/** A WolvenKit project's folders, from its folder, its .cpmodproj or its source\archive. */
export function projectFolders(p: string): ProjectFolders | undefined {
  const found = projectAt(p);
  return found ? { dir: found.dir, name: found.name, archive: found.archive, raw: path.join(found.dir, "source", "raw") } : undefined;
}

/** A Desk item by its folder or its name on the Desk. */
export function deskItem(nameOrFolder: string, desk = deskDir()): string {
  if (fs.existsSync(path.join(nameOrFolder, "asset.json"))) return nameOrFolder;
  const folder = path.join(desk, nameOrFolder.endsWith(".prop.asset") ? nameOrFolder : `${nameOrFolder}.prop.asset`);
  if (!fs.existsSync(folder)) throw new AddError(`Nothing called ${nameOrFolder} on the Desk.`);
  return folder;
}

const toGame = (...parts: string[]) => parts.join("\\");
const onDisk = (root: string, gamePath: string) => path.join(root, ...gamePath.split("\\"));

export async function addToProject(req: AddRequest): Promise<AddResult> {
  const log = req.log ?? (() => undefined);
  const collision = req.collision ?? DefaultCollision;
  const { name: itemName, asset, prepared } = readItem(req.item);
  const name = slug(req.name ?? itemName, "prop");
  const mod = slug(req.mod ?? req.project.name, "mod");
  const folder = toGame(mod, "props", name);
  const mesh = toGame(folder, `${name}.mesh`);
  const entity = toGame(folder, `${name}.ent`);
  const notes: string[] = [];
  const written = new Set<string>();
  const rel = (f: string) => path.relative(req.project.dir, f);
  const replaced = fs.existsSync(onDisk(req.project.archive, mesh));
  const record = onDisk(req.project.raw, toGame(folder, `${name}.edgefab.json`));

  // Adding again: what the last Add wrote goes first, and only that, so old textures aren't packed into the mod.
  if (replaced && fs.existsSync(record)) {
    try {
      const before = JSON.parse(fs.readFileSync(record, "utf8")) as { files?: string[] };
      for (const f of before.files ?? []) {
        const file = path.resolve(req.project.dir, f);
        if (file.startsWith(path.resolve(req.project.dir) + path.sep)) fs.rmSync(file, { force: true });
      }
    } catch {
      notes.push("Couldn't read the last Add's record, so its old files stay in the project.");
    }
  }

  // 1. The prepared model, at the mesh's path in source\raw, where WolvenKit's import looks for it.
  const rawGlb = onDisk(req.project.raw, toGame(folder, `${name}.glb`));
  fs.mkdirSync(path.dirname(rawGlb), { recursive: true });
  fs.copyFileSync(prepared.glb, rawGlb);
  written.add(rel(rawGlb));

  // 2. The mesh, imported over the template (REDbridge 0.9.0). Over an earlier Add, the template again, so
  //    its physics data is there to fill.
  const meshFile = onDisk(req.project.archive, mesh);
  fs.rmSync(meshFile, { force: true });
  log(`Importing the mesh over ${path.win32.basename(req.template ?? DefaultTemplate)}`);
  const imported = (await req.call("project.import", { file: rawGlb, rawDir: req.project.raw, archiveDir: req.project.archive, keep: false, template: req.template ?? DefaultTemplate })) as {
    ok: boolean;
    written?: string[];
    mesh?: { submeshes?: number; glbMaterials?: string[] };
  };
  if (!imported?.ok || !fs.existsSync(meshFile)) throw new AddError("REDbridge did not import the mesh. Run the import in REDcode to see its message.");
  written.add(rel(meshFile));

  // 3. The template's leftovers replaced: materials, appearances, physics.
  const read = (await req.call("cr2w.fileToJson", { file: meshFile })) as { json: string | null };
  if (!read?.json) throw new AddError("REDbridge could not read the imported mesh.");
  const json = JSON.parse(read.json);
  const submeshMaterials = [...prepared.submeshes].map((s) => s.material);
  const glbMaterials = imported.mesh?.glbMaterials;
  const fitted = fitMesh(json, prepared.materials, glbMaterials?.length === submeshMaterials.length ? glbMaterials : submeshMaterials, collision);
  notes.push(...fitted.notes);
  await req.call("cr2w.fromJson", { outFile: meshFile, json: JSON.stringify(json) });

  // 4. Materials from the model's own textures (EDGEmat's core): view.glb has the textures and factors.
  log("Making the materials");
  const glow: ModelGlow[] = prepared.glow.map((g) => ({ material: g.material, color: g.color, strength: g.strength, texture: g.texture }));
  const made = { from: asset.from, license: asset.license, id: asset.id, by: "EDGEfab" };
  const byMaterial = new Map<string, { baseColor?: string; orm?: string; normal?: string }>();
  for (const t of prepared.textures) {
    const m = byMaterial.get(t.material) ?? {};
    if (t.slot === "baseColor") m.baseColor = t.file;
    if (t.slot === "metallicRoughness") m.orm = t.file;
    if (t.slot === "normal") m.normal = t.file;
    byMaterial.set(t.material, m);
  }
  const useView = !!prepared.view && fs.existsSync(prepared.view);
  const materials = await materialsFromModel(bridgeOver(req.call), {
    project: { archive: req.project.archive, raw: req.project.raw },
    model: useView ? prepared.view : undefined,
    materials: useView ? undefined : prepared.materials.map((m) => ({ name: m, ...byMaterial.get(m) })),
    mesh,
    folder,
    glow: glow.length ? glow : undefined,
    made,
    flipNormalGreen: req.flipNormalGreen,
    log,
  });
  for (const f of materials.files) written.add(rel(onDisk(req.project.archive, f)));
  const missing = materials.materials.filter((m) => !m.applied).map((m) => m.name);
  if (missing.length) throw new AddError(`The mesh didn't take the material${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`);
  for (const m of materials.materials) for (const a of m.approximated) notes.push(`${m.name}: ${a}`);
  notes.push(...materials.notes);

  // 5. The entity: the prop to place.
  const entityFile = onDisk(req.project.archive, entity);
  await req.call("cr2w.fromJson", { outFile: entityFile, json: JSON.stringify(entityJson(mesh, name, collision, fitted.box)) });
  written.add(rel(entityFile));
  if (collision === "none") notes.push("It has no collision: V walks through it.");

  // 6. Where it came from and its license, beside the model in source\raw.
  written.add(rel(record));
  const out = {
    name,
    asset: { id: asset.id, name: asset.name, from: asset.from, license: asset.license },
    mesh,
    entity,
    collision,
    template: req.template ?? DefaultTemplate,
    materials: materials.materials.map((m) => ({ name: m.name, mi: m.mi, glow: m.glow })),
    added: new Date().toISOString(),
    files: [...written],
  };
  fs.writeFileSync(record, JSON.stringify(out, null, 2));
  if (asset.license?.source === "tripo" && asset.license.plan === "free") notes.push("Made on Tripo's free plan: the model is Tripo's, so it can't go in a released mod.");

  return { mesh, entity, raw: rawGlb, record, collision, materials: materials.materials, files: [...written], replaced, notes };
}
