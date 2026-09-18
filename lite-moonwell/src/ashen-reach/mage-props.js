import {createPbrMaterial,createTransformNode,setParent} from '@babylonjs/lite';
import {Batch} from './geometry.js';

/** Original low-poly props; each origin is its authored hand grip. */
export function createMageProp(engine,scene,kind){
 const root=createTransformNode(kind),wood=new Batch(kind+'Wood'),metal=new Batch(kind+'Metal'),accent=new Batch(kind+'Accent'),white=[1,1,1,1];
 if(kind==='staff'){
  const shaft=[[0,-.72,0],[.025,-.35,.015],[0,.12,0],[-.025,.54,.01],[0,.86,0]];
  for(let i=0;i<shaft.length-1;i++)wood.tube(shaft[i],shaft[i+1],.026,.021,white,6);
  for(const side of [-1,1]){
   const fork=[[0,.79,0],[side*.08,.92,.01],[side*.075,1.08,.015],[side*.028,1.18,0]];
   for(let i=0;i<3;i++)wood.tube(fork[i],fork[i+1],.027-i*.006,.020-i*.006,white,5);
  }
  for(const y of [-.67,-.09,.08,.75])metal.tube([0,y-.018,0],[0,y+.018,0],.033,.033,white,6);
  const a=[0,1.09,0],b=[0,.88,0],r=[[.047,.985,0],[0,.985,.038],[-.047,.985,0],[0,.985,-.038]];
  for(let i=0;i<4;i++){accent.tri(a,r[i],r[(i+1)%4],undefined,white);accent.tri(b,r[(i+1)%4],r[i],undefined,white);}
 }else{
  wood.box([.105,-.13,-.038],[.25,.32,.024],white);wood.box([.105,-.13,.038],[.25,.32,.024],white);wood.box([-.013,-.13,0],[.028,.32,.065],white);
  accent.box([.11,-.13,0],[.225,.282,.058],white);
  for(const x of [.012,.208])for(const y of [.002,-.262])metal.box([x,y,.054],[.034,.034,.009],white);
  metal.box([.105,-.13,.055],[.06,.085,.013],white,0);metal.box([.105,-.13,-.055],[.026,.29,.009],white);
  for(const y of [-.045,-.105,-.165,-.225])wood.box([.23,y,0],[.003,.004,.045],white);
 }
 const materials=kind==='staff'?[
  {baseColorFactor:[.085,.075,.063,1],roughnessFactor:.9},
  {baseColorFactor:[.40,.36,.24,1],metallicFactor:.55,roughnessFactor:.67},
  {baseColorFactor:[.40,.30,.53,1],emissiveFactor:[.14,.065,.22],roughnessFactor:.35},
 ]:[
  {baseColorFactor:[.12,.095,.15,1],roughnessFactor:.9},
  {baseColorFactor:[.47,.40,.25,1],metallicFactor:.45,roughnessFactor:.6},
  {baseColorFactor:[.58,.53,.39,1],roughnessFactor:1},
 ];
 const meshes=[wood,metal,accent].map((batch,i)=>batch.commit(engine,scene,createPbrMaterial({metallicFactor:0,doubleSided:true,...materials[i]})));
 for(const mesh of meshes){setParent(mesh,root);mesh.position.set(0,0,0);mesh.rotationQuaternion.set(0,0,0,1);mesh.scaling.set(1,1,1);}
 return{root,meshes};
}
