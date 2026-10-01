/** Independent read-back gate for an assembled equipment artifact.
 * Native skinning uses inverse(meshWorld) * jointWorld * inverseBind. Validate
 * every part against the body's actual palette, not only the isolated new plate.
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 */
import {mat4} from 'gl-matrix';
export function verifyFactoryEquipmentBind(root,base,bodyMeshName){
 const skin=root.listSkins()[0],expected=base.listSkins()[0];
 if(!root.listMeshes().length||!skin||root.listSkins().length!==1||skin.listJoints().length!==65||expected.listJoints().length!==65||root.listAnimations().length)throw Error('Invalid factory palette/animation ownership');
 const names=skin.listJoints().map(n=>n.getName());
 if(JSON.stringify(names)!==JSON.stringify(expected.listJoints().map(n=>n.getName())))throw Error('Factory joint order differs');
 const bind=skin.getInverseBindMatrices().getArray(),baseBind=expected.getInverseBindMatrices().getArray();
 if(bind.some((v,i)=>v!==baseBind[i]))throw Error('Factory inverse bind is not exact');
 const body=base.listNodes().find(n=>n.getMesh()?.getName()===bodyMeshName),frame=body.getWorldMatrix();
 const inverse=mat4.invert(mat4.create(),frame);if(!inverse)throw Error('Singular accepted body frame');
 const reference=expected.listJoints().map((j,i)=>mat4.multiply(mat4.create(),
  mat4.multiply(mat4.create(),inverse,j.getWorldMatrix()),baseBind.subarray(i*16,i*16+16)));
 // Bounds are measured in the accepted mesh frame; catch unit/authoring explosions
 // independently of the palette check, which alone cannot detect 100x geometry.
 const bodyPositions=body.getMesh().listPrimitives().flatMap(p=>Array.from(p.getAttribute('POSITION').getArray()));
 const bodyLo=[Infinity,Infinity,Infinity],bodyHi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<bodyPositions.length;i++) {const k=i%3;bodyLo[k]=Math.min(bodyLo[k],bodyPositions[i]);bodyHi[k]=Math.max(bodyHi[k],bodyPositions[i]);}
 const bodySpan=Math.max(...bodyHi.map((v,i)=>v-bodyLo[i]));
 const boundsLo=[Infinity,Infinity,Infinity],boundsHi=[-Infinity,-Infinity,-Infinity];
 let worstPaletteDelta=0,vertices=0,primitives=0;
 for(const node of root.listNodes().filter(n=>n.getMesh())){
  if(node.getSkin()!==skin||node.getWorldMatrix().some((v,i)=>Math.abs(v-frame[i])>1e-7))throw Error(`Different factory mesh frame: ${node.getName()}`);
  const inverseMesh=mat4.invert(mat4.create(),node.getWorldMatrix());
  for(const [i,joint]of skin.listJoints().entries()){
   const palette=mat4.multiply(mat4.create(),mat4.multiply(mat4.create(),inverseMesh,joint.getWorldMatrix()),bind.subarray(i*16,i*16+16));
   for(let k=0;k<16;k++){const delta=Math.abs(palette[k]-reference[i][k]);if(!Number.isFinite(delta)||delta>1e-6)throw Error(`Factory rest palette changed: ${node.getName()}/${names[i]}[${k}]`);worstPaletteDelta=Math.max(worstPaletteDelta,delta);}
  }
  for(const primitive of node.getMesh().listPrimitives()){
   if(primitive.listTargets().length)throw Error('Neutral factory artifact contains morphs');
   const deformation=primitive.getExtras().deformation;
   if(!['soft-skin','rigid-bone'].includes(deformation))throw Error('Missing explicit factory deformation');
   const weights=primitive.getAttribute('WEIGHTS_0')?.getArray(),joints=primitive.getAttribute('JOINTS_0')?.getArray(),positions=primitive.getAttribute('POSITION')?.getArray();
   const normals=primitive.getAttribute('NORMAL')?.getArray(),indices=primitive.getIndices()?.getArray();
   if(!weights||!joints||!positions||!normals||!indices||primitive.getMode()!==4||indices.length%3||
      positions.length%3||normals.length!==positions.length||weights.length!==positions.length/3*4||joints.length!==weights.length||
      positions.some(v=>!Number.isFinite(v))||normals.some(v=>!Number.isFinite(v))||
      indices.some(v=>!Number.isInteger(v)||v<0||v>=positions.length/3))throw Error('Invalid factory geometry');
   for(let i=0;i<positions.length;i++){const k=i%3,v=positions[i];if(v<bodyLo[k]-bodySpan*.5||v>bodyHi[k]+bodySpan*.5)throw Error('Factory geometry lies outside accepted body bounds');boundsLo[k]=Math.min(boundsLo[k],v);boundsHi[k]=Math.max(boundsHi[k],v);}
   for(let i=0;i<weights.length;i+=4){let sum=0;for(let k=0;k<4;k++){if(!Number.isFinite(weights[i+k])||weights[i+k]<0||!Number.isInteger(joints[i+k])||joints[i+k]<0||joints[i+k]>=65)throw Error('Invalid factory weights');sum+=weights[i+k];}if(Math.abs(sum-1)>2e-6)throw Error('Unnormalized factory weights');if(deformation==='rigid-bone'&&(weights[i]!==1||weights[i+1]!==0||weights[i+2]!==0||weights[i+3]!==0))throw Error('Factory plate bends');}
   vertices+=positions.length/3;primitives++;
  }
 }
 return {joints:65,meshes:root.listMeshes().length,primitives,vertices,worstPaletteDelta,inverseBindExact:true,bounds:{min:boundsLo,max:boundsHi,frame:'accepted body mesh'}};
}
