// Original architectural additions use the cathedral's existing masonry helpers.
const STONE=[.67,.71,.76,0],TRIM=[.82,.83,.85,0],SHADE=[.44,.49,.55,0],ROCK=[.50,.48,.53,0];
export function buildCathedralFoundation({stone,rock,collisionBatch,floorY,groundHeight,solid,wall,beam,box}){
 const outline=[[-7,270],[7,270],[29,277],[35,294],[32,317],[36,338],[27,365],[-26,365],[-35,344],[-31,320],[-35,294],[-27,277]],n=outline.length;
 const ring=outline.map(([x,z])=>[x,floorY-.65,z]);
 const vertices=[...ring.map(([x,y,z])=>[x,y+.65,z]),...ring];
 const faces=[Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>n+i),...Array.from({length:n},(_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])];
 for(const batch of [stone,collisionBatch])solid(batch,vertices,faces,STONE);
 const rings=[ring,outline.map(([x,z],i)=>[x*(.94+.05*Math.sin(i*2)),floorY-6-(i%3),317+(z-317)*(.93+.04*Math.cos(i))]),outline.map(([x,z])=>[x*1.12,Math.min(floorY-10,groundHeight(x*1.12,317+(z-317)*1.08)-2),317+(z-317)*1.08])];
 for(let j=0;j<2;j++)for(let i=0;i<n;i++){
  const k=(i+1)%n,p=[rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],center=[0,Math.min(...p.map(v=>v[1]))-1,317];
  for(const batch of [rock,collisionBatch])solid(batch,[...p,center],[[0,1,2,3],[0,4,1],[1,4,2],[2,4,3],[3,4,0]],ROCK);
 }
 // Masonry supports follow selected rock facets, leaving the rock mass legible.
 for(let i=2;i<n;i+=2){const [x,z]=outline[i],bottom=groundHeight(x,z)-.6,top=floorY-.5;if(top>bottom)wall([x*.94,(bottom+top)/2,317+(z-317)*.94],[2.1,top-bottom,2.4],SHADE);}
 const rail=(a,b)=>{for(const batch of [stone,collisionBatch])beam(batch,[a[0],floorY+.68,a[1]],[b[0],floorY+.68,b[1]],1.1,SHADE);};
 for(let i=0;i<n;i++){
  const a=outline[i],b=outline[(i+1)%n];if(i===0){rail(a,[-4.4,270]);rail([4.4,270],b);}else rail(a,b);
  box(stone,[a[0],floorY+1,a[1]],[1.6,2,1.6],TRIM);
 }
 return {outline};
}

export function buildCathedralExploration(ctx){
 const {stone,roof,glow,collisionBatch,floorY,wall,box,beam,prism,arch,faceMap}=ctx;
 const fy=floorY,metadata={chapels:[],towers:[],gallery:[],parapet:[],lamps:[]};
 const rail=(a,b)=>{
  // A full-height narrow collision rail prevents slipping beneath a visual handrail.
  const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  const map=(u,y,d)=>[a[0]+dx*u/len+nx*d,y,a[2]+dz*u/len+nz*d];
  prism(collisionBatch,[[0,a[1]],[len,b[1]],[len,b[1]+1.1],[0,a[1]+1.1]],.14,map,STONE);
  beam(stone,[a[0],a[1]+1.05,a[2]],[b[0],b[1]+1.05,b[2]],.14,TRIM);
  const count=Math.ceil(len/1.3);for(let i=0;i<=count;i++){const t=i/count;box(stone,[a[0]+dx*t,a[1]+(b[1]-a[1])*t+.52,a[2]+dz*t],[.09,1.04,.09],SHADE);}
 };
 const platform=(x,y,z,w,d)=>wall([x,fy+y-.14,z],[w,.28,d],STONE);
 function flight(a,b,width=1.8,innerSide=0){
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length,steps=Math.ceil((b[1]-a[1])/.16);
  const map=(u,y,d)=>[a[0]+dx*u/length+nx*d,fy+y,a[2]+dz*u/length+nz*d];
  prism(collisionBatch,[[0,a[1]-.25],[length,b[1]-.25],[length,b[1]],[0,a[1]]],width,map,STONE);
  for(let i=0;i<steps;i++){
   const s0=length*i/steps,s1=length*(i+1)/steps,y0=a[1]+(b[1]-a[1])*i/steps,y1=a[1]+(b[1]-a[1])*(i+1)/steps;
   // Visible treads sit within 16 cm of the continuous Havok ramp.
   prism(stone,[[s0,y0-.25],[s1,y0-.25],[s1,y1],[s0,y1]],width,map,i%4===0?TRIM:STONE);
  }
  for(const side of innerSide?[innerSide]:[-1,1])rail([a[0]+nx*width*.5*side,fy+a[1],a[2]+nz*width*.5*side],[b[0]+nx*width*.5*side,fy+b[1],b[2]+nz*width*.5*side]);
 }
 for(const side of [-1,1]){
  const x=side*18,outer=side*24,name=side<0?'West chapel':'East chapel';
  // Tall side chapel accommodates its gallery stair beneath a separate steep roof.
  wall([x,fy+6.5,320.5],[12,13,1]);wall([x,fy+6.5,351.5],[12,13,1]);
  wall([outer,fy+4.25,336],[1,8.5,31]);
  // Upper exit at z=347 opens onto the exterior parapet.
  wall([outer,fy+10.75,332.75],[1,4.5,24.5]);wall([outer,fy+10.75,350.25],[1,4.5,2.5]);
  wall([outer,fy+12.6,347],[1,.8,4.5]);
  const roofMap=(u,y,d)=>[x+u,fy+y,336+d];
  for(const s of [-1,1])for(const batch of [roof,collisionBatch])prism(batch,[[0,18],[s*6.6,13],[s*6.6,12.65],[0,17.65]],33,roofMap,batch===roof?[.30,.35,.43,0]:STONE);
  for(const z of [320.5,351.5])for(const batch of [stone,collisionBatch])prism(batch,[[-6,13],[6,13],[0,18]],1,(u,y,d)=>[x+u,fy+y,z+d],STONE);
  for(const z of [321,336,351])beam(roof,[x,fy+18.08,z],[x+side*6.6,fy+13.08,z],.15,TRIM);
  // Stair starts on the chapel floor, reaches a broad landing, then crosses into gallery.
  const start=[x,0,324],end=[x,8.5,345];flight(start,end,2.4);
  platform(x,8.5,347,4,4);platform(side*10.75,8.5,347,10.5,1.8);
  platform(side*23,8.5,347,8,1.8);
  for(const edge of [x-2,x+2])for(const [a,b] of [[345,346.1],[347.9,349]])rail([edge,fy+8.5,a],[edge,fy+8.5,b]);
  rail([x-2,fy+8.5,349],[x+2,fy+8.5,349]);
  for(const [a,b] of [[x-2,x-1.2],[x+1.2,x+2]])rail([a,fy+8.5,345],[b,fy+8.5,345]);
  for(const z of [346.1,347.9]){
   rail([side*8.5,fy+8.5,z],[side*16,fy+8.5,z]);rail([side*20,fy+8.5,z],[side*25.8,fy+8.5,z]);
  }
  // A long gallery aisle on either side, linked across both ends of the nave.
  platform(side*7,8.5,328,3,42);
  rail([side*5.5,fy+8.5,308],[side*5.5,fy+8.5,348]);
  for(const [z0,z1] of [[307,346.1],[347.9,349]])rail([side*8.5,fy+8.5,z0],[side*8.5,fy+8.5,z1]);
  for(const z of [312,320,336,344]){wall([side*7,fy+3.65,z],[.6,7.3,.6],SHADE);box(stone,[side*7,fy+7.6,z],[1.8,.5,1.1],TRIM);}
  // Exterior walk stays outside the chapel walls and is guarded on both sides.
  platform(side*27,8.5,336,2.4,44);
  rail([side*28.2,fy+8.5,314],[side*28.2,fy+8.5,359.2]);
  for(const [a,b] of [[314,346.1],[347.9,356.8]])rail([side*25.8,fy+8.5,a],[side*25.8,fy+8.5,b]);
  rail([side*25.8,fy+8.5,314],[side*28.2,fy+8.5,314]);
  for(const z of [318,334,352])wall([side*27,fy+4.1,z],[1.4,8.2,1.4],SHADE);
  // Chapel furnishings stay beside the approach and clear of stair travel.
  for(const z of [327,333,339]){wall([side*22,fy+.42,z],[1.4,.84,2],SHADE);box(stone,[side*22,fy+.88,z],[1.6,.12,2.2],TRIM);}
  wall([side*14.5,fy+.6,343],[2.3,1.2,1.8],SHADE);
  const lamp=[side*14.4,fy+3.2,335];box(glow,lamp,[.28,.65,.28],[.52,.25,.065,0]);beam(stone,[side*12.8,fy+3,335],lamp,.13,SHADE);
  metadata.lamps.push({id:`cathedral-chapel-${side}`,position:lamp,strength:4});
  metadata.chapels.push({name,entry:[side*12,fy,328],interior:[side*15.5,fy,328],stairs:[[side*15.5,fy,322.5],[x,fy,322.5],[x,fy,324],[x,fy+8.5,345],[x,fy+8.5,347]],gallery:[side*7,fy+8.5,347],parapet:[side*27,fy+8.5,347]});
 }
 for(const z of [307,349]){platform(0,8.5,z,17,2);for(const edge of [z-1,z+1]){const width=edge===306||edge===350?8.5:5.5;rail([-width,fy+8.5,edge],[width,fy+8.5,edge]);}for(const x of [-8.5,8.5])rail([x,fy+8.5,z-1],[x,fy+8.5,z+1]);}
 platform(0,8.5,358,56.4,2.4);for(const z of [356.8,359.2]){const width=z===359.2?28.2:25.8;rail([-width,fy+8.5,z],[width,fy+8.5,z]);}
 metadata.gallery=[[-7,fy+8.5,347],[-7,fy+8.5,307],[7,fy+8.5,307],[7,fy+8.5,347]];
 metadata.parapet=[[-27,fy+8.5,347],[-27,fy+8.5,358],[27,fy+8.5,358],[27,fy+8.5,347]];
 // A square stair winds inside each existing hollow tower. Four flights per lap
 // leave over four metres between repeated plan positions for human headroom.
 for(const [x,bell,flights] of [[-17,25,24],[17,35,32]]){
  const corners=[[-2.2,-3.2],[-2.2,3.2],[2.2,3.2],[2.2,-3.2]],rise=bell/flights,route=[];
  for(let i=0;i<=flights;i++){
   const [u,d]=corners[i%4],y=i*rise;platform(x+u,y,306+d,1.8,1.8);route.push([x+u,fy+y,306+d]);
   if(i===flights)break;
   const next=corners[(i+1)%4],dx=next[0]-u,dz=next[1]-d,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
   flight([x+u+ux*.9,y,306+d+uz*.9],[x+next[0]-ux*.9,y+rise,306+next[1]-uz*.9],1.8,-1);
  }
  // Floor leaves both final flights open, including the landing below its level.
  platform(x-2.35,bell,307.05,2.1,6.7);
  rail([x-1.3,fy+bell,303.7],[x-1.3,fy+bell,310.4]);
  for(const xx of [x-3.35,x+3.35])rail([xx,fy+bell,301.6],[xx,fy+bell,310.4]);
  for(const zz of [301.6,310.4])rail([x-3.35,fy+bell,zz],[x+3.35,fy+bell,zz]);
  beam(stone,[x-2.8,fy+bell+4.3,306],[x+2.8,fy+bell+4.3,306],.28,SHADE);
  const bronze=[.47,.34,.15,0],sides=10,bellVertices=[];
  for(const [r,y] of [[.78,3.05],[.48,3.4],[.31,4.1]])for(let i=0;i<sides;i++){const angle=i/sides*Math.PI*2;bellVertices.push([x+Math.cos(angle)*r,fy+bell+y,306+Math.sin(angle)*r]);}
  const faces=[];for(let ring=0;ring<2;ring++)for(let i=0;i<sides;i++)faces.push([ring*sides+i,ring*sides+(i+1)%sides,(ring+1)*sides+(i+1)%sides,(ring+1)*sides+i]);faces.push(Array.from({length:sides},(_,i)=>2*sides+i));
  ctx.solid(stone,bellVertices,faces,bronze);beam(stone,[x,fy+bell+2.92,306],[x,fy+bell+4.3,306],.12,bronze);
  metadata.towers.push({id:x<0?'west-bell':'east-bell',entrance:[x,fy,299],base:[x-2.2,fy,302.8],route,landing:[x-2.2,fy+bell,306]});
 }
 return metadata;
}
