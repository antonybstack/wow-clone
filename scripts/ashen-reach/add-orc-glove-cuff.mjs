/** Add the Orc Graveweaver wrist bridge to the fitted glove primitive.
 *
 * The shipped glove and sleeve have separate open cuffs. Their mismatched edges
 * expose an irregular strip of the Orc forearm during walking. A short bracer
 * overlaps both hems and follows the existing glove skin. It is appended to the
 * same glTF primitive/material, so this repair does not add a draw submission.
 *
 * The added vertices keep glTF's JOINTS_0/WEIGHTS_0 skin contract; their weights
 * come from the nearest angular cuff sample on the source glove:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skinned-mesh-attributes
 *
 * Usage: node scripts/ashen-reach/add-orc-glove-cuff.mjs --input=<packed.glb> --output=<candidate.glb>
 */
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function addOrcGloveCuff(doc){
const node=doc.getRoot().listNodes().find(n=>n.getName()==='GraveweaverGloves'&&n.getMesh());
if(!node||!node.getSkin())throw Error('Expected a skinned GraveweaverGloves node');
const mesh=node.getMesh();
if(mesh.getExtras()?.orcWristCuff===1)throw Error('Orc cuff already added');
if(mesh.listPrimitives().length!==1)throw Error('Expected one fitted glove primitive');
const prim=mesh.listPrimitives()[0];
const required=['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'];
if(JSON.stringify(prim.listSemantics().toSorted())!==JSON.stringify(required.toSorted()))
    throw Error(`Unexpected glove attributes: ${prim.listSemantics()}`);
const attrs=Object.fromEntries(required.map(s=>[s,prim.getAttribute(s)]));
const P=attrs.POSITION.getArray(),T=attrs.TEXCOORD_0.getArray(),J=attrs.JOINTS_0.getArray(),W=attrs.WEIGHTS_0.getArray();
const segments=24;
const added={POSITION:[],NORMAL:[],TEXCOORD_0:[],JOINTS_0:[],WEIGHTS_0:[]};
const addedIndices=[];
for(const sign of [1,-1]){
    // The source glove's open boundary is near |x|=.95 in its T-pose. Derive its
    // centre and skin weights from the actual packed mesh rather than assuming a
    // forearm bone or reusing the Orc body's different vertex order.
    const cuff=[];
    for(let i=0;i<P.length/3;i++)if(Math.sign(P[i*3])===sign&&Math.abs(P[i*3])>=.925&&Math.abs(P[i*3])<=.992)cuff.push(i);
    if(cuff.length<80)throw Error(`Missing ${sign>0?'right':'left'} Orc glove cuff samples`);
    const cy=cuff.reduce((sum,i)=>sum+P[i*3+1],0)/cuff.length;
    const cz=cuff.reduce((sum,i)=>sum+P[i*3+2],0)/cuff.length;
    const base=P.length/3+added.POSITION.length/3;
    for(let row=0;row<3;row++)for(let a=0;a<segments;a++){
        const angle=a*2*Math.PI/segments,c=Math.cos(angle),s=Math.sin(angle);
        const radius=[.095,.112,.100][row];
        added.POSITION.push(sign*[.86,.94,1.035][row],cy+radius*c,cz+radius*s);
        added.NORMAL.push(0,c,s);
        let nearest=cuff[0],best=Infinity;
        for(const i of cuff){
            const dy=P[i*3+1]-cy,dz=P[i*3+2]-cz;
            const error=(dy-radius*c)**2+(dz-radius*s)**2;
            if(error<best){best=error;nearest=i;}
        }
        added.TEXCOORD_0.push(T[nearest*2],T[nearest*2+1]);
        for(let k=0;k<4;k++){
            added.JOINTS_0.push(J[nearest*4+k]);
            added.WEIGHTS_0.push(W[nearest*4+k]);
        }
    }
    for(let row=0;row<2;row++)for(let a=0;a<segments;a++){
        const a0=base+row*segments+a,a1=base+row*segments+(a+1)%segments;
        const b0=base+(row+1)*segments+a,b1=base+(row+1)*segments+(a+1)%segments;
        if(sign>0)addedIndices.push(a0,a1,b1,a0,b1,b0);
        else addedIndices.push(a0,b1,a1,a0,b0,b1);
    }
}
for(const semantic of required){
    const attr=attrs[semantic],old=attr.getArray(),next=new old.constructor(old.length+added[semantic].length);
    next.set(old);next.set(added[semantic],old.length);attr.setArray(next);
}
const oldIndices=prim.getIndices().getArray();
if(oldIndices instanceof Uint16Array&&P.length/3+added.POSITION.length/3>65535)throw Error('Glove vertex count exceeds 16-bit indices');
const indices=new oldIndices.constructor(oldIndices.length+addedIndices.length);
indices.set(oldIndices);indices.set(addedIndices,oldIndices.length);prim.getIndices().setArray(indices);
mesh.setExtras({...mesh.getExtras(),orcWristCuff:1});
return {addedVertices:added.POSITION.length/3,addedTriangles:addedIndices.length/3};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const fs=await import('node:fs/promises');
const {NodeIO}=await import('@gltf-transform/core');
const {ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
const {MeshoptDecoder,MeshoptEncoder}=await import('meshoptimizer');
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const input=process.argv.find(s=>s.startsWith('--input='))?.slice(8)
    || 'public/ashen-reach/equipment-orc/graveweaverGloves.glb';
const output=process.argv.find(s=>s.startsWith('--output='))?.slice(9);
if(!output)throw Error('Use --output=<candidate.glb>; choose the public path only after live review');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder,
});
const doc=await io.read(input);
const result=addOrcGloveCuff(doc);
await fs.mkdir(path.dirname(output),{recursive:true});
const bytes=await io.writeBinary(doc);
await fs.writeFile(output,bytes);
console.log(JSON.stringify({input,output,...result,bytes:bytes.length}));
}
