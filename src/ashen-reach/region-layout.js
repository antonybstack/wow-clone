/** Authored finite-region destinations. Heights retain the original landmark datum. */
export const REGION_LANDMARKS=[
 {id:'east-keep',name:'Eastwatch',kind:'keep',x:196,z:-38,floorY:45.6881101584,yaw:Math.PI/2,height:39,width:32,depth:40,entrance:[176,45.6881101584,-38]},
 {id:'west-keep',name:'Westwatch',kind:'keep',x:-186,z:112,floorY:49.6553258658,yaw:-Math.PI/2,height:35,width:32,depth:40,entrance:[-166,49.6553258658,112]},
 {id:'south-keep',name:'Southwatch',kind:'keep',x:74,z:-214,floorY:54.1843600643,yaw:Math.PI,height:43,width:32,depth:40,entrance:[74,54.1843600643,-194]},
 {id:'east-tower',name:'Ash Tower',kind:'tower',x:132,z:-55,floorY:19.7922460884,yaw:0,height:24,width:6,depth:6,entrance:[132,19.7922460884,-58]},
 {id:'west-tower',name:'Moor Tower',kind:'tower',x:-125,z:-80,floorY:5.3469415243,yaw:0,height:22,width:6,depth:6,entrance:[-125,5.3469415243,-83]},
 {id:'north-tower',name:'Bell Watch',kind:'tower',x:78,z:168,floorY:13.8864060460,yaw:0,height:26,width:6,depth:6,entrance:[78,13.8864060460,165]},
 {id:'hollowmere-chapel',name:'Hollowmere Chapel',kind:'chapel',x:7.4,z:114,floorY:7.328,yaw:Math.PI,entrance:[4.1,7.328,114]},
 {id:'vaelmark',name:'Vaelmark',kind:'cathedral',x:0,z:330,entrance:[0,44.923,298]},
];
const N=[[0,null,142],[45,null,142],[90,null,142]],W=[[0,null,142],[-45,null,142],[-90,null,142]];
const authored=[
 ['east-keep',[...N,[120,18,105],[145,29,65],[155,40,10],[156,45.6881101584,-38],[176,45.6881101584,-38]]],
 ['west-keep',[...W,[-126,24,200],[-170,34,200],[-135,44,147],[-146,49.6553258658,112],[-166,49.6553258658,112]]],
 ['south-keep',[[0,null,-70],[0,null,-95],[30,3,-110],[105,22,-125],[145,34,-145],[145,46,-185],[105,54.1843600643,-185],[105,54.1843600643,-165],[74,54.1843600643,-165],[74,54.1843600643,-194]]],
 ['east-tower',[...N,[120,18,105],[110,20,40],[112,19.7922460884,-25],[112,19.7922460884,-70],[132,19.7922460884,-70],[132,19.7922460884,-58]]],
 ['west-tower',[...W,[-100,8,50],[-105,6,-30],[-105,5.3469415243,-95],[-125,5.3469415243,-95],[-125,5.3469415243,-83]]],
 ['north-tower',[[0,null,142],[45,null,142],[50,null,145],[60,10,153],[78,13.8864060460,150],[78,13.8864060460,165]]],
 ['hollowmere-chapel',[[0,null,114],[2.3,null,114],[4.1,7.328,114]]],
];
export const REGION_ROUTES=[];
const grid=new Map(),CELL=32,HALF_WIDTH=2.75,FEATHER=9;
const protectedGround=(x,z)=>(x>=-90&&x<=90&&z>=-95&&z<=145)||(Math.abs(x)<=45&&z>=145&&z<=370);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function roundedRoute(nodes,legacyHeight){
 const p=nodes.map(([x,y,z])=>[x,y??legacyHeight(x,z)+.05,z]),out=[p[0]];
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1],l0=Math.hypot(b[0]-a[0],b[2]-a[2]),l1=Math.hypot(c[0]-b[0],c[2]-b[2]),u=[(b[0]-a[0])/l0,(b[2]-a[2])/l0],v=[(c[0]-b[0])/l1,(c[2]-b[2])/l1],angle=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1])));
  if(angle<.01){out.push(b);continue;}
  const trim=Math.min(6*Math.tan(angle/2),l0*.4,l1*.4),radius=trim/Math.tan(angle/2),sign=Math.sign(u[0]*v[1]-u[1]*v[0]),start=[b[0]-u[0]*trim,b[1]-(b[1]-a[1])*trim/l0,b[2]-u[1]*trim],end=[b[0]+v[0]*trim,b[1]+(c[1]-b[1])*trim/l1,b[2]+v[1]*trim],cx=start[0]-u[1]*radius*sign,cz=start[2]+u[0]*radius*sign,theta=Math.atan2(start[2]-cz,start[0]-cx),steps=Math.max(2,Math.ceil(radius*angle/1.5));
  for(let k=0;k<=steps;k++){const t=k/steps,q=theta+sign*angle*t;out.push([cx+Math.cos(q)*radius,start[1]+(end[1]-start[1])*t,cz+Math.sin(q)*radius]);}
 }
 out.push(p.at(-1));return out;
}
export function initializeRegionRoutes(legacyHeight){
 if(REGION_ROUTES.length)return;
 for(const [id,authoredNodes] of authored){
  const nodes=roundedRoute(authoredNodes,legacyHeight);
  const points=[];
  for(let i=0;i<nodes.length-1;i++){
   const a=nodes[i],b=nodes[i+1],steps=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/2),ay=a[1]??legacyHeight(a[0],a[2])+.05,by=b[1]??legacyHeight(b[0],b[2])+.05;
   for(let k=0;k<=steps;k++){if(i&&k===0)continue;const t=k/steps,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
    let y=ay+(by-ay)*t;if(protectedGround(x,z)&&id!=='hollowmere-chapel')y=legacyHeight(x,z)+.05;points.push([x,y,z]);}
  }
  // Keep original protected terrain samples and destination thresholds fixed;
  // distribute any grade correction across the adjacent unprotected roadbed.
  const fixed=points.map((p,i)=>i===0||i===points.length-1||(id!=='hollowmere-chapel'&&protectedGround(p[0],p[2]))),limit=Math.tan(19.5*Math.PI/180);
  for(let pass=0;pass<12;pass++)for(const direction of [1,-1])for(let j=1;j<points.length;j++){
   const i=direction===1?j:points.length-1-j,previous=i-direction;if(fixed[i])continue;const p=points[i],q=points[previous],rise=limit*Math.hypot(p[0]-q[0],p[2]-q[2]);p[1]=Math.max(q[1]-rise,Math.min(q[1]+rise,p[1]));
  }
  const route={id,width:HALF_WIDTH*2,points};REGION_ROUTES.push(route);REGION_LANDMARKS.find(l=>l.id===id).route=points;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],length2=dx*dx+dz*dz,margin=HALF_WIDTH+FEATHER,segment={a,b,dx,dz,length2,id};
   for(let x=Math.floor((Math.min(a[0],b[0])-margin)/CELL);x<=Math.floor((Math.max(a[0],b[0])+margin)/CELL);x++)for(let z=Math.floor((Math.min(a[2],b[2])-margin)/CELL);z<=Math.floor((Math.max(a[2],b[2])+margin)/CELL);z++){
    const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(segment);
   }
  }
 }
}
export function nearestRegionRoute(x,z){
 let nearest=null,distance=Infinity;
 for(const s of grid.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)||[]){
  const t=Math.max(0,Math.min(1,((x-s.a[0])*s.dx+(z-s.a[2])*s.dz)/s.length2)),d=Math.hypot(x-s.a[0]-t*s.dx,z-s.a[2]-t*s.dz);
  if(d<distance){distance=d;nearest={distance,y:s.a[1]+(s.b[1]-s.a[1])*t,id:s.id};}
 }
 return nearest;
}
export function regionSiteDistance(x,z){
 let nearest=Infinity;
 for(const l of REGION_LANDMARKS){if(l.kind!=='keep'&&l.kind!=='tower')continue;
  const dx=x-l.x,dz=z-l.z,u=dx*Math.cos(l.yaw)-dz*Math.sin(l.yaw),d=dx*Math.sin(l.yaw)+dz*Math.cos(l.yaw);
  nearest=Math.min(nearest,Math.hypot(Math.max(0,Math.abs(u)-l.width/2),Math.max(0,Math.abs(d)-l.depth/2)));
 }
 return nearest;
}
export function applyRegionRoutes(x,z,y){
 const route=nearestRegionRoute(x,z);
 // Four-metre terrain cells must stay below the road even across diagonal
 // corners. A wider graded bed supports the metre-deep masonry causeway.
 if(route&&route.id!=='hollowmere-chapel'){const blend=1-smooth((route.distance-HALF_WIDTH-4)/FEATHER);y=y*(1-blend)+(route.y-.75)*blend;}
 for(const l of REGION_LANDMARKS){if(l.kind!=='keep'&&l.kind!=='tower')continue;
  const dx=x-l.x,dz=z-l.z,u=dx*Math.cos(l.yaw)-dz*Math.sin(l.yaw),d=dx*Math.sin(l.yaw)+dz*Math.cos(l.yaw);
  const distance=Math.hypot(Math.max(0,Math.abs(u)-l.width/2-1),Math.max(0,Math.abs(d)-l.depth/2-1));
  if(distance<9){const blend=1-smooth(distance/9);y=y*(1-blend)+(l.floorY-.10)*blend;}
 }
 return y;
}
