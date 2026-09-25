import test from 'node:test';
import assert from 'node:assert/strict';
import {Batch,height} from '../src/ashen-reach/geometry.js';
import {buildGothicCathedral} from '../src/ashen-reach/gothic-cathedral.js';

const batches=Object.fromEntries(['stone','roof','glow','rock'].map(name=>[name,new Batch(name)]));
batches.stone.tri([0,0,0],[1,0,0],[0,1,0]);
const sentinel={p:[...batches.stone.p],n:[...batches.stone.n],idx:[...batches.stone.idx]};
const colliders=[{id:'existing-world'}];
const cathedral=buildGothicCathedral({...batches,groundHeight:height,colliders});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vertices=(batch,i)=>batch.idx.slice(i,i+3).map(v=>batch.p.slice(v*3,v*3+3));
const triangles=[];
for(let i=0;i<cathedral.collisionBatch.idx.length;i+=3){
  const [a,b,c]=vertices(cathedral.collisionBatch,i),ab=sub(b,a),ac=sub(c,a);
  triangles.push({a,ab,ac,normal:cross(ab,ac)});
}

// CPU segment/triangle check on the actual returned collision mesh, not source strings.
function hit(from,to){
  const direction=sub(to,from);let closest=null;
  for(const triangle of triangles){
    const {a,ab,ac}=triangle,p=cross(direction,ac),det=dot(ab,p);
    if(Math.abs(det)<1e-9)continue;
    const t=sub(from,a),u=dot(t,p)/det;
    if(u<0||u>1)continue;
    const q=cross(t,ab),v=dot(direction,q)/det;
    if(v<0||u+v>1)continue;
    const fraction=dot(ac,q)/det;
    if(fraction>=0&&fraction<=1&&(!closest||fraction<closest.fraction))closest={fraction,normal:triangle.normal};
  }
  return closest;
}

test('metadata matches the authored site and all material work stays within budget',()=>{
  assert.equal(cathedral.floorY,height(0,310)+12);
  assert.deepEqual(cathedral.entry,[0,cathedral.floorY,304]);
  assert.deepEqual(cathedral.altar,[0,cathedral.floorY,345]);
  assert.deepEqual(cathedral.route.start,[0,height(0,145)+.05,145]);
  assert.equal(cathedral.route.width,8);
  assert.equal(cathedral.route.heightAt(270),cathedral.floorY);
  assert.equal(cathedral.route.heightAt(345),cathedral.floorY);
  assert(cathedral.triangles>10000&&cathedral.triangles<40000);
  assert(cathedral.collisionTriangles>0&&cathedral.collisionTriangles<10000);
  let highest=-Infinity;
  for(let i=1;i<batches.roof.p.length;i+=3)highest=Math.max(highest,batches.roof.p[i]);
  assert.equal(highest,cathedral.floorY+56);
});

test('appending geometry preserves existing batches and leaves registration to parent',()=>{
  for(const key of ['p','n','idx'])assert.deepEqual(batches.stone[key].slice(0,sentinel[key].length),sentinel[key]);
  assert.deepEqual(colliders,[{id:'existing-world'}]);
});

test('all triangles have finite attributes, valid indices and matching winding/normals',()=>{
  for(const batch of [...Object.values(batches),cathedral.collisionBatch]){
    for(const key of ['p','n','u','c'])assert(batch[key].every(Number.isFinite),`${batch.name}.${key}`);
    const count=batch.p.length/3;
    assert.equal(batch.n.length,count*3);assert.equal(batch.u.length,count*2);assert.equal(batch.c.length,count*4);
    assert(batch.idx.every(i=>Number.isInteger(i)&&i>=0&&i<count));
    for(let i=0;i<batch.idx.length;i+=3){
      const [a,b,c]=vertices(batch,i),normal=cross(sub(b,a),sub(c,a));
      assert(Math.hypot(...normal)>1e-8,`${batch.name}: degenerate triangle ${i/3}`);
      for(const index of batch.idx.slice(i,i+3)){
        const n=batch.n.slice(index*3,index*3+3);
        assert(Math.abs(Math.hypot(...n)-1)<1e-6,`${batch.name}: unit normal`);
        assert(dot(normal,n)>0,`${batch.name}: winding ${i/3}`);
      }
    }
  }
});

test('600 route samples have upward floor support and a clear human-height walk line',()=>{
  for(let z=145.25;z<345;z+=1){
    const y=cathedral.route.heightAt(z),nextY=cathedral.route.heightAt(z+.5);
    for(const x of [-.38,0,.38]){
      const floor=hit([x,y+.5,z],[x,y-.5,z]);
      assert(floor&&Math.abs(floor.fraction-.5)<1e-6,`continuous floor ${x},${z}`);
      assert(floor.normal[1]>0,`upward floor ${x},${z}`);
      for(const offset of [.2,1.8])assert.equal(hit([x,y+offset,z],[x,nextY+offset,z+.5]),null,`clear lane ${x},${z},${offset}`);
    }
  }
});

test('front portals are open, altar approach is clear, walls and roofs are solid',()=>{
  const y=cathedral.floorY;
  for(const x of [-3,0,3])assert.equal(hit([x,y+1,299],[x,y+1,308]),null,'main portal');
  for(const x of [-17,17])assert.equal(hit([x,y+1,297],[x,y+1,309]),null,'tower portal');
  assert.equal(hit([0,y+1,340],[0,y+1,345.5]),null,'z344/345 altar approach');
  assert(hit([0,y+1,345],[0,y+1,354]),'altar/back wall');
  assert(hit([0,y+5,320],[15,y+5,320]),'nave side wall');
  assert(hit([6,y+1,299],[6,y+1,308]),'portal jamb');
  const roof=hit([6,y+40,330],[6,y+25,330]);assert(roof&&roof.normal[1]>0,'walkable roof shell');
});

test('nonfinite primary terrain heights fail before geometry is appended',()=>{
  const empty=Object.fromEntries(['stone','roof','glow','rock'].map(name=>[name,new Batch(name)]));
  assert.throws(()=>buildGothicCathedral({...empty,groundHeight:()=>NaN,colliders:[]}),/finite/);
  assert(Object.values(empty).every(b=>b.idx.length===0));
});

test('altar window is genuinely open with solid sill, pointed head and recessed tracery',()=>{
  const y=cathedral.floorY;
  const through=(x,h)=>hit([x,y+h,352],[x,y+h,356]);
  for(const [x,h] of [[.7,8],[.7,12],[-.7,12],[0,19.2],[0,21.2]]){
    // The top center contains a short stone stem; sample beside it there.
    const xx=h===21.2?.45:x;
    assert.equal(through(xx,h),null,`open aperture ${xx},${h}`);
  }
  assert(through(0,3.8),'raised solid sill');
  assert(through(0,23),'solid wall above pointed head');
  assert(through(4.1,21),'solid pointed spandrel');
  assert(through(1.5,12),'recessed vertical mullion');
  assert(through(.7,10.5),'stone transom');
  assert(through(0,20.65),'upper rose tracery');
  for(let i=2;i<batches.glow.p.length;i+=3)assert(batches.glow.p[i]<352,'apse uses stone and daylight, no added emissive geometry');
});
