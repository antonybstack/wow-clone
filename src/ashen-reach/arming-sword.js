import {createPbrMaterial,createTransformNode,setParent} from '@babylonjs/lite';
import {Batch} from './geometry.js';

/** Original low-poly prop. Grip origin and +Y axis match the evaluated hand socket; the item owns its grip rotation. */
export function createArmingSword(engine,scene,socket,gripRotation){
    // Lite setParent preserves world space: explicitly restore authored local TRS.
    const root=createTransformNode('IronArmingSword');setParent(root,socket);root.position.set(0,0,0);root.rotationQuaternion.set(...gripRotation);root.scaling.set(1,1,1);
    const steel=new Batch('SwordSteel'),leather=new Batch('SwordGrip'),white=[1,1,1,1];
    const ring=(y,w,t)=>[[-w,y,0],[0,y,-t],[w,y,0],[0,y,t]];
    const rings=[ring(.11,.046,.014),ring(.57,.033,.009),ring(.72,0,.001)];
    for(let k=0;k<2;k++)for(let i=0;i<4;i++)steel.quad(rings[k][i],rings[k][(i+1)%4],rings[k+1][(i+1)%4],rings[k+1][i],undefined,white);
    steel.box([0,.095,0],[.23,.03,.035],white);
    steel.box([-.105,.08,0],[.025,.05,.035],white);steel.box([.105,.08,0],[.025,.05,.035],white);
    steel.tube([0,-.14,0],[0,-.105,0],.039,.031,white,6);steel.box([0,-.139,0],[.04,.012,.04],white);
    leather.tube([0,-.11,0],[0,.075,0],.022,.023,white,6);
    for(let i=0;i<7;i++)leather.tube([0,-.10+i*.025,0],[0,-.092+i*.025,0],.025,.025,white,6);
    const meshes=[steel.commit(engine,scene,createPbrMaterial({baseColorFactor:[.50,.49,.43,1],metallicFactor:.25,roughnessFactor:.63,doubleSided:true})),leather.commit(engine,scene,createPbrMaterial({baseColorFactor:[.11,.065,.035,1],metallicFactor:0,roughnessFactor:1,doubleSided:true}))];
    for(const mesh of meshes){setParent(mesh,root);mesh.position.set(0,0,0);mesh.rotationQuaternion.set(0,0,0,1);mesh.scaling.set(1,1,1);}
    return {root,meshes};
}
