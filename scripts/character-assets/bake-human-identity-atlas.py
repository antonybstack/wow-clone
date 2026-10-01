"""Bake source colour onto one atlas AFTER the continuous grey geometry proof.

Native Cycles colour-only bake; no lighting painted into skin. The welded neck
samples the original torso's UV at its boundary and blends to the CC0 head over
9 cm. Both colour sources use Blender's image colour conversion. Native island
packing preserves their source UVs in a separate map during the bake.
https://docs.blender.org/manual/en/latest/render/cycles/baking.html
https://docs.blender.org/manual/en/latest/modeling/meshes/editing/uv.html
"""
from pathlib import Path
import sys
import json
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
import mh_studio

LABEL=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'old'
AGE=LABEL.split('-')[0]
assert AGE in ('young','old')
DIR=ROOT/'.cache/character-mmo/identity-v1'
bpy.ops.wm.open_mainfile(filepath=str(DIR/f'human-{LABEL}-source.blend'))
body=bpy.data.objects['HumanIdentityBody']
armature=body.parent
armature.data.pose_position='REST'
mesh=body.data
area=mesh.attributes.get('identity.head')
if not area:raise ValueError('Source lacks explicit anatomical face provenance')
head_faces={i for i,x in enumerate(area.data) if x.value}
source_uv=mesh.uv_layers.active
source_uv.name='SourceUV'
torso=bpy.data.materials['IdentityOriginalTorsoSource']
texture=next(n for n in torso.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
body_image=texture.image
body_uv_node=torso.node_tree.nodes.new('ShaderNodeUVMap')
body_uv_node.uv_map='SourceUV'
torso.node_tree.links.new(body_uv_node.outputs['UV'],texture.inputs['Vector'])

source_record=next(x for x in json.loads((ROOT/'blender/characters/candidates/identity-v1/provenance.json').read_text())['files'] if x['path'].endswith(f'/{AGE}-skin-source.png'))
import hashlib
source_skin=DIR/f'{AGE}-skin-source.png'
if hashlib.sha256(source_skin.read_bytes()).hexdigest()!=source_record['sha256']:
    raise ValueError('CC0 skin source changed')
head=mh_studio.mat_pbr('IdentityHeadColourSource',albedo_path=source_skin,
                       rough=.7,specular=.2)
mesh.materials.clear();mesh.materials.append(torso);mesh.materials.append(head)
for polygon in mesh.polygons:polygon.material_index=int(polygon.index in head_faces)

# Welded seam edges have one source face on each side. Their body UV is the
# actual adjacent torso corner, not a guessed neck-average colour.
body_corners={}
head_vertices=set()
for face in mesh.polygons:
    if face.index in head_faces:head_vertices.update(face.vertices)
    else:
        for loop_index in face.loop_indices:
            vertex=mesh.loops[loop_index].vertex_index
            body_corners.setdefault(vertex,[]).append((source_uv.data[loop_index].uv.copy(),face.index))
seam=sorted(head_vertices & set(body_corners))
if len(seam)<20:raise ValueError('Continuous source seam lost')
sample_uv=mesh.uv_layers.new(name='BodySampleUV')
fade=mesh.attributes.new(name='NeckSourceBlend',type='FLOAT',domain='POINT')
for vertex in mesh.vertices:
    t=max(0,min(1,(vertex.co.z-150)/9))
    fade.data[vertex.index].value=t*t*(3-2*t)
for face in mesh.polygons:
    for loop_index in face.loop_indices:
        vertex=mesh.loops[loop_index].vertex_index
        if face.index not in head_faces:
            sample_uv.data[loop_index].uv=source_uv.data[loop_index].uv
        else:
            nearest=min(seam,key=lambda v:(mesh.vertices[v].co-mesh.vertices[vertex].co).length_squared)
            # Pick the incident torso face next to this head face. A shared
            # anatomical vertex may have several UV islands; list order is not
            # a surface correspondence and can sample the back from the front.
            candidates=body_corners[nearest]
            uv,_=min(candidates,key=lambda corner:(mesh.polygons[corner[1]].center-face.center).length_squared)
            sample_uv.data[loop_index].uv=uv
nodes=head.node_tree.nodes;links=head.node_tree.links
shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
head_texture=next(n for n in nodes if n.type=='TEX_IMAGE')
head_uv=nodes.new('ShaderNodeUVMap');head_uv.uv_map='SourceUV'
links.new(head_uv.outputs['UV'],head_texture.inputs['Vector'])
# One source-derived colour adaptation: compare the two actual neck boundaries
# in linear space, then preserve the head's detailed luminance variations.
# This changes colour after the geometry proof; it never hides a normal seam.
def linear_channel(v):
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4

def sample_mean(image,uvs):
    width,height=image.size
    pixels=list(image.pixels)
    sums=[0,0,0]
    for uv in uvs:
        x=max(0,min(width-1,int(uv.x*width)))
        y=max(0,min(height-1,int(uv.y*height)))
        at=(y*width+x)*4
        for channel in range(3):sums[channel]+=linear_channel(pixels[at+channel])
    return [value/len(uvs) for value in sums]
body_boundary=[uv for v in seam for uv,_ in body_corners[v]]
head_boundary=[source_uv.data[loop].uv.copy() for face in mesh.polygons if face.index in head_faces for loop in face.loop_indices if mesh.loops[loop].vertex_index in seam]
reference=sample_mean(body_image,body_boundary)
original=sample_mean(head_texture.image,head_boundary)
gain=[a/max(.001,b) for a,b in zip(reference,original)]
if any(not .15<g<4 for g in gain):raise ValueError(f'Unreasonable source colour gain {gain}')
correct=nodes.new('ShaderNodeMixRGB');correct.blend_type='MULTIPLY';correct.inputs[0].default_value=1
correct.inputs[2].default_value=(*gain,1)
links.new(head_texture.outputs['Color'],correct.inputs[1])
(DIR/f'{LABEL}-colour-adaptation.json').write_text(json.dumps({'bodyBoundaryLinear':reference,'headBoundaryLinear':original,'gain':gain},indent=2))

sample_texture=nodes.new('ShaderNodeTexImage');sample_texture.image=body_image
sample_node=nodes.new('ShaderNodeUVMap');sample_node.uv_map='BodySampleUV'
links.new(sample_node.outputs['UV'],sample_texture.inputs['Vector'])
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX'
attribute=nodes.new('ShaderNodeAttribute');attribute.attribute_name='NeckSourceBlend'
links.new(attribute.outputs['Fac'],mix.inputs[0])
links.new(sample_texture.outputs['Color'],mix.inputs[1])
links.new(correct.outputs['Color'],mix.inputs[2])
links.new(mix.outputs['Color'],shader.inputs['Base Color'])
# The licensed old diffuse includes painted short-hair follicles. A bald source
# must remove that pigment as well as owning a complete scalp. Bake a bounded
# anatomical correction; shading still comes from the actual continuous mesh.
scalp=mesh.attributes.new(name='BaldScalpPigment',type='FLOAT',domain='POINT')
neck_fix=mesh.attributes.new(name='RearNeckPigment',type='FLOAT',domain='POINT')
clamp=lambda x:max(0,min(1,x))
for vertex in mesh.vertices:
    x,y,z=vertex.co
    scalp.data[vertex.index].value=max(clamp((z-168)/4),clamp((y-4)/3)*clamp((z-151)/4),clamp((abs(x)-5)/2)*clamp((z-164)/4))
    neck_fix.data[vertex.index].value=clamp((y-3)/3)*clamp((2.6-abs(x))/1.2)*clamp((z-146)/2)*clamp((157-z)/3)
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=180
noise.inputs['Detail'].default_value=1
links.new(head_uv.outputs['UV'],noise.inputs['Vector'])
variation=nodes.new('ShaderNodeMapRange');variation.inputs['From Min'].default_value=0
variation.inputs['From Max'].default_value=1;variation.inputs['To Min'].default_value=.92
variation.inputs['To Max'].default_value=1.06
links.new(noise.outputs['Fac'],variation.inputs['Value'])
pigment=nodes.new('ShaderNodeMixRGB');pigment.blend_type='MULTIPLY';pigment.inputs[0].default_value=1
pigment.inputs[1].default_value=(*reference,1)
links.new(variation.outputs['Result'],pigment.inputs[2])
scalp_attr=nodes.new('ShaderNodeAttribute');scalp_attr.attribute_name='BaldScalpPigment'
scalp_mix=nodes.new('ShaderNodeMixRGB')
links.new(scalp_attr.outputs['Fac'],scalp_mix.inputs[0])
links.new(mix.outputs['Color'],scalp_mix.inputs[1])
links.new(pigment.outputs['Color'],scalp_mix.inputs[2])
links.new(scalp_mix.outputs['Color'],shader.inputs['Base Color'])
# The inherited torso atlas also paints a short-hair tip at the old nape. Use
# the same source colour only within that small correction on BOTH surfaces.
for material,colour in ((head,scalp_mix.outputs['Color']),(torso,None)):
    ns=material.node_tree.nodes;ls=material.node_tree.links
    bs=next(n for n in ns if n.type=='BSDF_PRINCIPLED')
    existing=colour if colour is not None else bs.inputs['Base Color'].links[0].from_socket
    attr=ns.new('ShaderNodeAttribute');attr.attribute_name='RearNeckPigment'
    correction=ns.new('ShaderNodeMixRGB');correction.inputs[2].default_value=(*reference,1)
    ls.new(attr.outputs['Fac'],correction.inputs[0]);ls.new(existing,correction.inputs[1])
    ls.new(correction.outputs['Color'],bs.inputs['Base Color'])


atlas_uv=mesh.uv_layers.new(name='IdentityAtlas')
for face in mesh.polygons:
    scale=3 if face.index in head_faces else 1
    for loop in face.loop_indices:atlas_uv.data[loop].uv=source_uv.data[loop].uv*scale
mesh.uv_layers.active=atlas_uv
atlas_uv.active_render=True
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True,margin=.012,scale=True)
bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('IdentitySkinAtlas',width=1024,height=1024,alpha=False)
for material in (torso,head):
    node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    material.node_tree.nodes.active=node;node.select=True
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
scene.cycles.samples=1
scene.render.bake.margin=8
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'})
image.filepath_raw=str(DIR/f'{LABEL}-skin-atlas.png');image.file_format='PNG';image.save()
final=mh_studio.mat_pbr('IdentitySkin',albedo_path=DIR/f'{LABEL}-skin-atlas.png',rough=.7,specular=.2)
mesh.materials.clear();mesh.materials.append(final)
for face in mesh.polygons:face.material_index=0
for name in [uv.name for uv in mesh.uv_layers if uv.name!='IdentityAtlas']:
    mesh.uv_layers.remove(mesh.uv_layers[name])
atlas_uv=mesh.uv_layers['IdentityAtlas']
atlas_uv.name='UVMap';mesh.uv_layers.active=atlas_uv;atlas_uv.active_render=True
assert len(mesh.uv_layers)==1
eyes=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('HumanIdentityEyes'))
eye_image=DIR/'eye-albedo.png'
mh_studio.write_eye_albedo(ROOT/'blender/characters/sources/brown_eye.png',eye_image)
eyes.data.materials.clear()
eyes.data.materials.append(mh_studio.mat_pbr('IdentityEyes',albedo_path=eye_image,rough=.15,specular=.7,double_sided=True))
# Restore source action export; the frozen rest pose was only for baking.
armature.data.pose_position='POSE'
bpy.ops.wm.save_as_mainfile(filepath=str(DIR/f'human-{LABEL}-painted.blend'))
objects=[armature,body]+[o for o in bpy.data.objects if o.type=='MESH' and o!=body]
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=armature
bpy.ops.export_scene.gltf(filepath=str(DIR/f'human-{LABEL}-painted-raw.glb'),
 use_selection=True,export_format='GLB',export_yup=True,export_animations=True,
 export_animation_mode='ACTIONS',export_skins=True,export_all_influences=False,
 export_materials='EXPORT',export_cameras=False,export_lights=False,
 export_texcoords=True,export_normals=True)
print('IDENTITY_ATLAS',LABEL,len(seam),len(head_faces))
