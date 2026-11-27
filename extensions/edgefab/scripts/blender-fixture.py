# Test sources for scripts/blender-check.mjs, made by Blender itself:
#   blender --background --factory-startup --python blender-fixture.py -- <out folder>
# Writes crate.blend, crate.fbx and crate.obj with: a textured body (a picture beside the file), a plain-colored
# lid, a part made from nodes with no picture, a part pointing at a texture that isn't there, a front marker on
# Blender's front (-Y), a hidden object, a camera, a light, an armature and a cube with a bevel modifier.
import bpy, os, sys

out = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name, color=None, image=None, nodes_only=False, missing=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    bsdf = [n for n in t.nodes if n.type == "BSDF_PRINCIPLED"][0]
    if color:
        bsdf.inputs["Base Color"].default_value = color
    if image:
        tex = t.nodes.new("ShaderNodeTexImage")
        tex.image = image
        t.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if nodes_only:
        noise = t.nodes.new("ShaderNodeTexNoise")
        t.links.new(noise.outputs["Color"], bsdf.inputs["Base Color"])
    if missing:
        img = bpy.data.images.new("gone", 4, 4)
        img.source = "FILE"
        img.filepath = os.path.join(out, missing)
        tex = t.nodes.new("ShaderNodeTexImage")
        tex.image = img
        t.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m

# A 64x64 checker picture, saved beside the files.
pic = bpy.data.images.new("crate_color", 64, 64)
px = []
for y in range(64):
    for x in range(64):
        on = ((x // 8) + (y // 8)) % 2
        px += [0.8, 0.5, 0.1, 1.0] if on else [0.2, 0.1, 0.05, 1.0]
pic.pixels = px
pic.filepath_raw = os.path.join(out, "crate_color.png")
pic.file_format = "PNG"
pic.save()

def add(kind, name, location, scale, mat=None, **kw):
    getattr(bpy.ops.mesh, "primitive_" + kind + "_add")(location=location, **kw)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    if mat:
        o.data.materials.append(mat)
    return o

body = add("cube", "body", (0, 0, 0.4), (0.4, 0.3, 0.4), material("crate_wood", image=pic))
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.uv.smart_project()
bpy.ops.object.mode_set(mode="OBJECT")
bevel = body.modifiers.new("bevel", "BEVEL")
bevel.width = 0.02
bevel.segments = 2
add("cube", "lid", (0, 0, 0.84), (0.42, 0.32, 0.04), material("lid_paint", color=(0.1, 0.3, 0.8, 1)))
add("cylinder", "pipe", (0.45, 0, 0.4), (0.05, 0.05, 0.3), material("pipe_noise", nodes_only=True))
add("cube", "label", (-0.41, 0, 0.5), (0.01, 0.1, 0.06), material("label_missing", missing="label_gone.png"))
# Blender's front view looks along +Y, so the side a modeller calls the front faces -Y.
add("cube", "front_marker", (0, -0.35, 0.4), (0.05, 0.05, 0.05), material("marker_red", color=(1, 0, 0, 1)))
hidden = add("cube", "hidden_box", (0, 0, 2), (0.1, 0.1, 0.1))
hidden.hide_render = True
hidden.hide_set(True)
bpy.ops.object.camera_add(location=(2, -2, 1))
bpy.ops.object.light_add(type="POINT", location=(1, 1, 2))
bpy.ops.object.armature_add(location=(0, 0, 0))

# A script inside the .blend that would run on load if Blender allowed it: EDGEfab must never let it.
boom = bpy.data.texts.new("boom.py")
boom.write("open(" + repr(os.path.join(out, "autoexec_ran.txt")) + ", 'w').write('ran')\n")
boom.use_module = True

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "crate.blend"))
for o in bpy.context.scene.objects:
    o.select_set(False)
# Visible objects only, as a modeller's FBX export would be (FBX keeps no hidden flag: the box would come back shown).
bpy.ops.export_scene.fbx(filepath=os.path.join(out, "crate.fbx"), use_selection=False, use_visible=True, path_mode="COPY", embed_textures=True)
bpy.ops.wm.obj_export(filepath=os.path.join(out, "crate.obj"), export_selected_objects=False, path_mode="COPY")
print("fixture written to", out)
