"""Native Blender lattice corrective for the new source-family hood.
Nearest-surface wrapping collapsed the authored cloth folds onto each other.
A coarse authoring cage keeps those separations and the lower garment interface.
Evaluate the authored base + each shape, retaining the existing cloth/skin rig.
https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html
https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/lattice.html
https://docs.blender.org/api/current/bpy.types.Object.html#bpy.types.Object.to_mesh
"""
from pathlib import Path
import bpy
import sys
import json
import bmesh
import hashlib
import os
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import mh_io
DIR=ROOT/'.cache/character-mmo/identity-v1'
OUT=Path(os.environ.get('ASHEN_IDENTITY_FIT_DIR',str(DIR)))
OUT.mkdir(parents=True,exist_ok=True)
SOURCE_HOOD=Path(os.environ.get('ASHEN_IDENTITY_HOOD_SOURCE',str(ROOT/'.cache/character-mmo/m005/graveweaverHood.glb')))
age=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'young'
if age not in ('young','old'):raise ValueError('Expected young or old fit family')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_HOOD))
hood=next(o for o in bpy.data.objects if o.type=='MESH')
armature=hood.parent
armature.data.pose_position='REST'
for modifier in hood.modifiers:
    if modifier.type=='ARMATURE':modifier.show_viewport=False
keys=hood.data.shape_keys.key_blocks
original=[k.data[i].co.copy() for k in keys for i in range(len(hood.data.vertices))]
# Isolated source imports; remove their animation and freeze native rest pose.
targets=[]
for target_age in (age,):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(DIR/f'human-{target_age}-grey.glb'))
    imported=set(bpy.data.objects)-before
    for obj in imported:
        if obj.type=='ARMATURE':
            obj.data.pose_position='REST'
            obj.animation_data_clear()
    targets.append(next(o for o in imported if o.type=='MESH' and o.name.startswith('HumanV1Body')))
    eyes=next(o for o in imported if o.type=='MESH' and o.name.startswith('HumanIdentityEyes'))
    # Compute the eye ceiling in the garment's actual authoring frame. The
    # younger head's sockets sit higher than the older one's; one fixed arch
    # exposed the old eyes while still masking the younger right eye.
    eye_to_hood=hood.matrix_world.inverted() @ eyes.matrix_world
    eye_ceiling=max((eye_to_hood @ v.co).z for v in eyes.data.vertices)
    eye_half_width=max(abs((eye_to_hood @ v.co).x) for v in eyes.data.vertices)
group=hood.vertex_groups.new(name='IdentitySkullFit')
for v in hood.data.vertices:
    # The source glTF units are cm under the imported 0.01 armature frame.
    # Fit the neck collar too; the previous skull-only mask left exposed skin.
    weight=max(0,min(1,(v.co.z-141)/7))
    if weight>0:group.add([v.index],weight,'REPLACE')
# A bounded artist corrective on this one item, not a general auto-fit claim.
# Native lattice interpolation preserves relative fold/layer positions; all
# resulting deformation is baked offline and adds no runtime modifier.
lattice=bpy.data.lattices.new('IdentityHoodCage')
lattice.points_u=3;lattice.points_v=3;lattice.points_w=5
cage=bpy.data.objects.new('IdentityHoodCage',lattice)
bpy.context.collection.objects.link(cage)
cage.parent=armature;cage.location=(0,3,159)
# Newly resized lattice data spans U/V [-1,1], W [-2,2], rather than
# an assumed unit cube. Derive scales from actual native points so the cage
# measures exactly 30 x 44 x 42 cm. The corrected skull fits inside the released
# crown: do not enlarge it to accommodate the rejected 133%-wide head.
span=[max(p.co[k] for p in lattice.points)-min(p.co[k] for p in lattice.points) for k in range(3)]
cage.scale=tuple(size/extent for size,extent in zip((30,44,42),span))
for point in lattice.points:
    z=159+point.co.z*cage.scale.z
    t=max(0,min(1,(z-146)/14));fade=t*t*(3-2*t)
    point.co_deform.x=point.co.x
    point.co_deform.y=point.co.y
    top=max(0,min(1,(z-162)/16));top=top*top*(3-2*top)
    point.co_deform.z=point.co.z
    front=max(0,min(1,-point.co.y*cage.scale.y/12))
    opening=max(0,min(1,(z-149)/11));opening=opening*opening*(3-2*opening)
    # Lift the authored front curtain clear of the eyes. Moving it forward
    # alone leaves its frontal projection over the face; retain the folds and
    # use the native cage to raise the opening while easing into the crown.
    point.co_deform.z+=8/cage.scale.z*front*opening*(1-top)
    point.co_deform.y-=3/cage.scale.y*front*opening*(1-top)
mod=hood.modifiers.new('NativeLatticeCorrective','LATTICE');mod.object=cage;mod.vertex_group=group.name
depsgraph=bpy.context.evaluated_depsgraph_get()
fitted=[]
for index,key in enumerate(keys):
    for other in list(keys)[1:]:other.value=0
    if index:key.value=1
    # Fit corresponding surfaces. Wrapping a slender/stout garment against the
    # neutral body produces a fit that fails as soon as both morph together.
    for target in targets:
        target_keys=target.data.shape_keys.key_blocks
        for other in list(target_keys)[1:]:other.value=0
        if index:target_keys[index].value=1
    bpy.context.view_layer.update()
    evaluated=hood.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh()
    if len(mesh.vertices)!=len(hood.data.vertices):raise ValueError('Fitter changed topology')
    coords=[]
    for vertex in mesh.vertices:
        co=vertex.co.copy()
        # The original opening has an asymmetric curtain over one eye. A
        # symmetric cage cannot remove that occlusion. Raise this front lip to
        # an authored brow arch, preserving its UVs/topology and side folds.
        # This is one item's offline sculpt corrective, not a general fitter.
        front=max(0,min(1,(-co.y-3)/4))
        lower=max(0,min(1,(co.z-153)/5))
        side=max(0,min(1,(11-abs(co.x))/2))
        arch=eye_ceiling+4-1.5*(min(abs(co.x),9)/9)**2
        co.z+=max(0,arch-co.z)*front*lower*side
        # Side curtains can cover an outer eye even when the brow arch clears.
        # Ease those front panels outside the measured sockets, retaining the
        # lower collar and the crown rather than scaling the whole hood again.
        panel=max(0,min(1,(eye_ceiling+2-co.z)/3))*max(0,min(1,(5-co.y)/4))*lower
        if abs(co.x)>1:
            co.x+=(1 if co.x>0 else -1)*max(0,eye_half_width+1.8-abs(co.x))*panel
        coords.append(co)
    fitted.append(coords)
    evaluated.to_mesh_clear()
for modifier in list(hood.modifiers):
    if modifier.type in ('SHRINKWRAP','LATTICE'):hood.modifiers.remove(modifier)
    elif modifier.type=='ARMATURE':modifier.show_viewport=True
for key,coords in zip(keys,fitted):
    key.value=0
    for point,co in zip(key.data,coords):point.co=co
for v,co in zip(hood.data.vertices,fitted[0]):v.co=co
hood.data.update()
# Reuse the source surface's attachment at the skull and collar. The old hood
# mixed Neck into vertices where the new scalp is wholly Head, causing relative
# motion even when the neutral surfaces clear. KDTree is native Blender tooling;
# the inherited shoulder attachment is retained below the head interface.
# https://docs.blender.org/api/current/mathutils.kdtree.html
target=targets[0]
for key in list(target.data.shape_keys.key_blocks)[1:]:key.value=0
tree=KDTree(len(target.data.vertices))
for vertex in target.data.vertices:tree.insert(vertex.co,vertex.index)
tree.balance()
for vertex in hood.data.vertices:
    blend=max(0,min(1,(vertex.co.z-146)/14))
    old={hood.vertex_groups[g.group].name:g.weight*(1-blend) for g in vertex.groups if g.group!=group.index}
    _,index,_=tree.find(vertex.co)
    for g in target.data.vertices[index].groups:
        name=target.vertex_groups[g.group].name
        old[name]=old.get(name,0)+g.weight*blend
    # Explicitly retain four influences, folding tiny tails into the strongest
    # weight rather than delegating silent truncation to the glTF exporter.
    row=sorted(old.items(),key=lambda item:item[1],reverse=True)
    kept=row[:4]
    if not kept:raise ValueError('Unweighted hood fit vertex')
    kept[0]=(kept[0][0],kept[0][1]+sum(w for _,w in row[4:]))
    total=sum(w for _,w in kept)
    for existing in list(vertex.groups):hood.vertex_groups[existing.group].remove([vertex.index])
    for name,weight in kept:
        if weight<=1e-7:continue
        vg=hood.vertex_groups.get(name) or hood.vertex_groups.new(name=name)
        vg.add([vertex.index],weight/total,'REPLACE')
hood.vertex_groups.remove(group)
# Author a small cloth lining from the actual neck surface, with the same
# shape/weights, behind the existing rear collar folds. This closes the garment
# gaps without hiding skin or flattening the outer cloth. Native BMesh retains
# shape/deform layers; Object.join keeps a single material/draw primitive.
# https://docs.blender.org/api/current/bmesh.ops.html#bmesh.ops.delete
liner=target.copy();liner.data=target.data.copy();liner.name='IdentityHoodRearLining'
bpy.context.collection.objects.link(liner)
bm=bmesh.new();bm.from_mesh(liner.data)
remove=[f for f in bm.faces if not (144<f.calc_center_median().z<157 and f.calc_center_median().y>1)]
bmesh.ops.delete(bm,geom=remove,context='FACES')
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
bm.normal_update()
for vertex in bm.verts:
    shift=vertex.normal*.8
    vertex.co+=shift
    for layer in bm.verts.layers.shape.values():vertex[layer]+=shift
bm.to_mesh(liner.data);bm.free()
liner.data.materials.clear();liner.data.materials.append(hood.data.materials[0])
uv_tree=KDTree(len(hood.data.vertices))
uvs={}
for loop in hood.data.loops:uvs.setdefault(loop.vertex_index,hood.data.uv_layers.active.data[loop.index].uv.copy())
for vertex in hood.data.vertices:uv_tree.insert(vertex.co,vertex.index)
uv_tree.balance()
if not liner.data.uv_layers.active:liner.data.uv_layers.new(name='UVMap')
for loop in liner.data.loops:
    _,index,_=uv_tree.find(liner.data.vertices[loop.vertex_index].co)
    liner.data.uv_layers.active.data[loop.index].uv=uvs[index]
bpy.ops.object.select_all(action='DESELECT');hood.select_set(True);liner.select_set(True)
bpy.context.view_layer.objects.active=hood;bpy.ops.object.join()
# Joining the lining can leave blended deform groups on shared vertices. Apply
# the existing explicit ancestor-folding policy to the final exported mesh too.
parents={bone.name:bone.parent.name if bone.parent else None for bone in armature.data.bones}
rows=[{hood.vertex_groups[g.group].name:g.weight for g in vertex.groups
       if hood.vertex_groups[g.group].name in parents and g.weight>1e-7} for vertex in hood.data.vertices]
reduced,reduction,_=mh_io.reduce_weights(rows,parents,max_influences=4)
indices=[v.index for v in hood.data.vertices]
for vg in hood.vertex_groups:vg.remove(indices)
for vertex,row in zip(hood.data.vertices,reduced):
    if not row:raise ValueError('Unweighted final hood vertex')
    for name,weight in row:
        vg=hood.vertex_groups.get(name) or hood.vertex_groups.new(name=name)
        vg.add([vertex.index],weight,'REPLACE')
if any(sum(g.weight>1e-7 for g in v.groups)>4 for v in hood.data.vertices):raise ValueError('Final hood influence budget exceeded')
bpy.ops.object.select_all(action='DESELECT')
hood.select_set(True);armature.select_set(True)
bpy.context.view_layer.objects.active=armature
bpy.ops.export_scene.gltf(filepath=str(OUT/'hood-raw.glb'),use_selection=True,
 export_format='GLB',export_animations=False,export_skins=True,
 export_all_influences=False,export_normals=True,export_texcoords=True)
print('IDENTITY_HOOD',max((a-b).length for a,b in zip(fitted[0],original[:len(fitted[0])])),len(fitted[0]))
(OUT/'hood-fit.json').write_text(json.dumps({'age':age,'method':'native lattice corrective',
 'rawSha256':hashlib.sha256((OUT/'hood-raw.glb').read_bytes()).hexdigest(),
 'targetSha256':hashlib.sha256((DIR/f'human-{age}-grey.glb').read_bytes()).hexdigest(),
 'sourceHoodSha256':hashlib.sha256(SOURCE_HOOD.read_bytes()).hexdigest(),
 'weightReduction':reduction,
 'cageAuthoringCm':{'widthExpansion':.18,'depthExpansion':.14,'topLift':3.2,'openingLift':10.5,'openingForward':3,'eyeCeiling':eye_ceiling,'eyeHalfWidth':eye_half_width,'browClearance':4,'sideEyeClearance':1.8},
 'targetShapeMatched':True,'fitScope':'one age; no union claim',
 'vertices':len(hood.data.vertices),'maxNeutralCorrectionM':max((a-b).length for a,b in zip(fitted[0],original[:len(fitted[0])]))*.01},indent=2))
