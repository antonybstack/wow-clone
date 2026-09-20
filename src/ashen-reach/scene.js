import {setShaderUniform} from '@babylonjs/lite';
import {Batch,rng,height,pathX,add,mul,sub,norm,cross} from './geometry.js';
import {surface,sky} from './materials.js';

/** A new scene layout. No Moonwell world builders, architecture or vegetation placement. */
export async function buildChurchyard(engine,scene){
 const random=rng(83861),r=(a,b)=>a+random()*(b-a);
 // Static lamps are baked per-vertex (see Batch.commit) instead of hardcoded in the shader, so the
 // town's street lamps and the two original churchyard lamps share one scalable list. These two
 // entries reproduce materials.js's former hardcoded lamp1/lamp2 exactly (same position, strength,
 // falloff) so the churchyard's illumination is unchanged.
 const lights=[{position:[-3.4,2.5,12.0],strength:.45,falloff:.5},{position:[3.6,2.7,14.0],strength:.4,falloff:.5}];
 const mats=await Promise.all([
  surface(engine,'Moss and burial earth','/tex/forrest_ground_01/diff.jpg',{tint:[.81,.83,.62],light:.62,pixels:128,ground:true}),
  surface(engine,'Timeworn limestone','/tex/rock_wall_08/diff.jpg',{tint:[1.12,1.10,.94],light:.85,pixels:512,uvScale:.20}),
  surface(engine,'Rotten oak','/tex/wood_planks_grey/diff.jpg',{tint:[.57,.43,.31],light:.62,pixels:64}),
  surface(engine,'Dead bark','/tex/bark_brown_02/diff.jpg',{tint:[.28,.29,.23],light:.40,pixels:64}),
  surface(engine,'Bracken','/ashen-reach/foliage-atlas.png',{tint:[.79,.90,.59],light:1.04,alpha:true,wind:true,pixels:512}),
  surface(engine,'Dry seed grass','/ashen-reach/foliage-atlas.png',{tint:[.80,.83,.66],light:.91,alpha:true,wind:true,pixels:512}),
  surface(engine,'Distant black stone','/tex/rock_wall_08/diff.jpg',{tint:[.095,.115,.10],light:.35,pixels:64}),
  surface(engine,'Candlelight','/tex/rock_wall_08/diff.jpg',{tint:[.95,1.10,.32],light:1,emission:1.4,pixels:16}),
  surface(engine,'Weathered memorial face','/ashen-reach/grave-face.png',{tint:[1,.98,.88],light:.8,pixels:160}),
 ]);
 const names=['Earth','Grave stonework','Rotten fence','Bare woodland','Fern beds','Seed grass','Bell towers','Lantern glass','Carved epitaphs'];
 const B=names.map(n=>new Batch(n));const [earth,stone,wood,bark,fern,grass,distant,glow,carve]=B;
 const colliders=[];
 // A continuous uneven floor, not a tiled slab floating on a flat plane.
 for(let z=-95;z<145;z+=2)for(let x=-90;x<90;x+=2){const v=[[x,z],[x+2,z],[x+2,z+2],[x,z+2]].map(([a,b])=>[a,height(a,b),b]);const c=.83+random()*.24;earth.quad(...v,v.map(p=>[p[0]/3,p[2]/3]),[c,c,c,0]);}

 // Path albedo is blended directly into the terrain material to avoid coplanar decals.

 function tomb(x,z,w,h,yaw=0,lean=0,kind=0){const gy=height(x,z),c=[r(.72,1),r(.73,.90),r(.66,.79),0];
  const P=(a,b,d=0)=>[x+a*Math.cos(yaw)+d*Math.sin(yaw)+b*lean,gy+b,z-a*Math.sin(yaw)+d*Math.cos(yaw)];
  const profile=kind%3===0?[[-.5,0],[.5,0],[.46,.70],[.25,.82],[0,1],[-.25,.82],[-.46,.70]]:kind%3===1?[[-.5,0],[.5,0],[.48,.86],[.30,.96],[-.22,1],[-.52,.84]]:[[-.5,0],[.5,0],[.5,.89],[.28,.89],[.22,1],[-.25,1],[-.31,.89],[-.5,.89]];
  for(let i=1;i<profile.length-1;i++)for(const d of [-.14,.14])(d<0?carve:stone).tri(P(profile[0][0]*w,profile[0][1]*h,d),P(profile[i][0]*w,profile[i][1]*h,d),P(profile[i+1][0]*w,profile[i+1][1]*h,d),[[profile[0][0]+.5,1-profile[0][1]],[profile[i][0]+.5,1-profile[i][1]],[profile[i+1][0]+.5,1-profile[i+1][1]]],c);
  for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length];stone.quad(P(a[0]*w,a[1]*h,-.14),P(b[0]*w,b[1]*h,-.14),P(b[0]*w,b[1]*h,.14),P(a[0]*w,a[1]*h,.14),undefined,mul(c,.7).map((v,i)=>i===3?0:v));}
  stone.box([x,gy+.08,z],[w*1.22,.16,.52],c,yaw);
  colliders.push({type:'box',position:{x,y:gy+h/2,z},size:{x:w,y:h,z:.35},rotation:{y:yaw}});
 }
 // Deliberately asymmetric hero graves frame the path.
 tomb(3.2,1.3,1.1,1.45,-.28,-.13,0);tomb(4.8,2.8,.78,1.07,.12,.17,1);tomb(2.9,5.0,.80,1.32,.25,-.22,0);tomb(-3.8,7,.76,.9,-.3,.11,2);
 for(let i=0;i<42;i++){const z=r(4,36),x=(random()<.5?-1:1)*r(2.8,15);tomb(x,z,r(.48,.9),r(.65,1.37),r(-.8,.8),r(-.20,.20),i);}
 // Left foreground stone chest tomb, layered plinth, inset and eroded lid.
 const tx=-4.1,tz=-.8,ty=height(tx,tz);
 wood.box([tx,ty+.40,tz],[2.8,.55,1.65],[1,1,1,0],-.10);stone.box([tx,ty+.72,tz],[3.1,.18,1.82],[.49,.48,.36,0],-.10);stone.box([tx,ty+.08,tz],[3.25,.16,1.95],[.40,.39,.30,0],-.10);
 tomb(tx-.20,tz+.65,1.35,2.55,-.10,-.04,2);
 colliders.push({type:'box',position:{x:tx,y:ty+.5,z:tz},size:{x:3.1,y:1,z:1.8},rotation:{y:-.1}});

 // Broken wheel memorial: independently displaced stone voussoirs and angled arms.
 const center=[-.3,height(0,23)+4.10,23],R=1.95;
 for(let k=0;k<22;k++){if(k===4||k===15)continue;const a=k*Math.PI*2/22+.11,b=a+.25;const p=(rad,t,depth)=>[center[0]+Math.sin(t)*rad,center[1]+Math.cos(t)*rad,center[2]+depth];const col=[r(.85,1.16),r(.9,1.14),r(.75,.99),0];const a0=p(R-.16,a,-.23),b0=p(R+.16,a,-.23),c0=p(R+.16,b,-.23),d0=p(R-.16,b,-.23);stone.quad(a0,b0,c0,d0,undefined,col);stone.quad(p(R+.16,a,.23),p(R+.16,b,.23),c0,b0,undefined,col);stone.quad(p(R-.16,a,.23),p(R-.16,b,.23),d0,a0,undefined,col);}
 stone.tube(add(center,[-.35,-3.45,0]),add(center,[.40,2.55,0]),.15,.23,[1,1,.83,0],4);stone.tube(add(center,[-2.5,.37,0]),add(center,[2.5,-.37,0]),.18,.18,[1,1,.83,0],4);
 stone.box([center[0],height(0,23)+.35,23],[1.8,.65,1.35],[.66,.70,.57,0]);stone.box([center[0],height(0,23)+.05,23],[2.7,.17,2],[.56,.59,.47,0]);

 function tree(x,z,H,seed,back=false){const rand=rng(seed),g=height(x,z),base=[x,g,z];const color=back?[.56,.63,.55,0]:[.70,.74,.63,0];
  let p=base,dir=[rand()*.14-.07,1,rand()*.10-.05];const nodes=[base];
  for(let k=0;k<6;k++){dir=norm(add(dir,[rand()*.34-.17,.05,rand()*.25-.125]));const q=add(p,mul(dir,H/6));bark.tube(p,q,H*.044*(1-k/6)+.025,H*.044*(1-(k+1)/6)+.025,color,6);p=q;nodes.push(p);}
  const branch=(p,dir,len,rad,depth)=>{const q=add(p,mul(dir,len));bark.tube(p,q,rad,Math.max(.005,rad*.55),color,depth>1?4:3);if(depth<=0)return;const t=norm(add(dir,[rand()*.6-.3,.15,rand()*.6-.3]));branch(q,t,len*.7,rad*.56,depth-1);if(depth>1||rand()>.32){const yaw=rand()*6.28;branch(add(p,mul(sub(q,p),.73)),norm(add(dir,[Math.cos(yaw)*.8,.35,Math.sin(yaw)*.8])),len*.55,rad*.45,depth-1);}};
  for(let k=2;k<7;k++)for(let j=0;j<2;j++){const a=k*2.4+j*3.1+rand()*.7;branch(nodes[k],norm([Math.cos(a),.35+rand()*.5,Math.sin(a)]),H*(.23+rand()*.11)*(1-(k-2)*.075),H*.012*(1-(k-2)*.1),back?3:4);}
  for(let k=0;k<5;k++){const a=k*1.256;const q=[x+Math.cos(a)*H*.095,g+.04,z+Math.sin(a)*H*.095];bark.tube([x,g+.65,z],q,H*.048,.025,color,5);}
 }
 tree(-6,16,12,1983);tree(4.5,24,17,293);tree(-10,15,12,25);tree(14,19,13,181);
 for(let i=0;i<38;i++){const x=r(-48,48),z=r(32,95);if(Math.abs(x)<4&&z<40)continue;tree(x,z,r(8,17),i*101+58,true);}

 function tower(x,z,H,w){const g=height(x,z);distant.box([x,g+H*.40,z],[w,H*.80,w],[1,1,1,0]);
  for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;distant.tube([x+Math.sin(a)*w*.69,g,z+Math.cos(a)*w*.69],[x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],w*.16,w*.10,[.7,.75,.7,0],5);distant.tube([x+Math.sin(a)*w*.63,g+H*.87,z+Math.cos(a)*w*.63],[x+Math.sin(a)*w*.63,g+H*1.13,z+Math.cos(a)*w*.63],w*.27,0,[.5,.6,.5,0],5);}
  distant.box([x,g+H*.74,z],[w*1.13,.65,w*1.13],[.7,.8,.7,0]);distant.tube([x,g+H*.82,z],[x-.5,g+H*1.30,z],w*.90,.03,[.7,.8,.7,0],6);
  for(let j=0;j<2;j++)glow.box([x-w*.10,g+H*(.68+j*.085),z-w*.502],[w*.07,H*.03,.03],[1,1,1,0]);
 }
 tower(23,37,28,5.5);tower(-41,92,30,5);tower(46,99,53,8);
 for(let side of [-1,1])for(let z=4;z<39;z+=3.2){const x=side*(12+Math.sin(z*.12)*1.5),y=height(x,z);wood.tube([x,y,z],[x+r(-.15,.15),y+1.18,z+.12],.085,.055,[.7,.65,.55,0],4);if(random()<.82){for(const h of [.42,.86])wood.tube([x,y+h,z],[side*(12+Math.sin((z+3.2)*.12)*1.5),height(x,z+3.2)+h,z+3.2],.06,.05,[.7,.65,.55,0],4);}}
 // Leaning wooden lantern posts around the monument approach.
 for(const [x,z] of [[-3.4,12],[3.6,14],[-2.8,25]]){const y=height(x,z);wood.tube([x,y,z],[x-.18,y+2.8,z],.085,.045,[.8,.8,.7,0],5);const p=[x-.18,y+2.52,z];glow.box(p,[.22,.31,.22],[1,1,1,0]);for(let j=0;j<4;j++){const dx=j<2?-.14:.14,dz=j%2?-.14:.14;wood.box([p[0]+dx,p[1],p[2]+dz],[.034,.46,.034],[.3,.3,.3,0]);}wood.box([p[0],p[1]-.22,p[2]],[.35,.055,.35],[.3,.3,.3,0]);wood.tube([p[0],p[1]+.18,p[2]],[p[0],p[1]+.42,p[2]],.25,0,[.3,.3,.3,0],4);}

 // Each fern is a radiating set of bent alpha-textured fronds.
 function bracken(x,z,size,seed){const rand=rng(seed),y=height(x,z)-.02;for(let f=0;f<8;f++){const a=f*.785+rand()*.45,L=size*(.65+rand()*.5),point=t=>[x+Math.cos(a)*L*t,y+L*(1.85*t-1.40*t*t)+.05,z+Math.sin(a)*L*t],side=[-Math.sin(a)*L*.24,0,Math.cos(a)*L*.24],u0=rand()<.85?0:.5;
  for(let k=0;k<5;k++){const t=k/5,t1=(k+1)/5,p=point(t),q=point(t1),c=.82+rand()*.25;fern.quad(sub(p,side),add(p,side),add(q,side),sub(q,side),[[u0+.008,.99-t*.49],[u0+.492,.99-t*.49],[u0+.492,.99-t1*.49],[u0+.008,.99-t1*.49]],[[c,c,c,t],[c,c,c,t],[c,c,c,t1],[c,c,c,t1]],[0,1,0]);}
 }}
 for(let i=0;i<420;i++){const x=r(-22,22),z=r(-10,48);if(Math.abs(x-pathX(z))<2.0&&random()<.97)continue;bracken(x,z,r(.45,1.18),i+490);}
 for(const [x,z,s] of [[-2,-2,1.4],[2.8,-2.1,1.5],[-2.5,4,1.3],[2.7,9,1.1],[-4,12,1.6]])bracken(x,z,s,Math.floor(s*900));
 const rects=[[.008,.006,.492,.498],[.508,.006,.992,.498],[.008,.006,.492,.498],[.508,.006,.992,.498]];
 for(let i=0;i<11000;i++){const x=r(-40,40),z=r(-16,84);if(Math.hypot(x,z)>38&&random()<.72)continue;const path=Math.abs(x-pathX(z));if(path<1.2&&z<26)continue;if(path<1.8&&random()<.7)continue;const y=height(x,z)-.02,sz=r(.52,1.23),w=r(.55,1.12),a=r(0,Math.PI),kind=random()<.6?3:random()<.5?2:0,[u0,v0,u1,v1]=rects[kind];for(let k=0;k<2;k++){const dx=Math.cos(a+k*1.571)*w/2,dz=Math.sin(a+k*1.571)*w/2,c=r(.66,1.10);grass.quad([x-dx,y,z-dz],[x+dx,y,z+dz],[x+dx,y+sz,z+dz],[x-dx,y+sz,z-dz],[[u0,v1],[u1,v1],[u1,v0],[u0,v0]],[[c,c,c,0],[c,c,c,0],[c,c,c,1],[c,c,c,1]],[0,1,0]);}}
 const meshes=B.map((b,i)=>b.commit(engine,scene,mats[i],lights));colliders.unshift({type:'mesh',mesh:meshes[0]});const clouds=await sky(engine,scene);
 return {meshes,colliders,groundHeight:height,spawn:{x:0,z:0},stats:{triangles:B.reduce((a,b)=>a+b.idx.length/3,0),drawBatches:B.length},update(t){for(const i of [4,5])setShaderUniform(mats[i],'time',t);clouds.update(t);}};
}
