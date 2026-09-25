/** Offline-generated EZ-Tree geometry, baked into the existing bark draw batch. */
export async function loadWoodland() {
  const response=await fetch('/ashen-reach/woodland/trees.json');
  if(!response.ok)throw new Error(`Woodland geometry: ${response.status}`);
  const data=await response.json();
  if(data.variants?.length!==3)throw new Error('Invalid woodland library');
  return data.variants;
}
export function appendWoodlandTree(batch,variants,{x,z,y,height,kind,lean}) {
  const tree=variants[Math.min(2,Math.floor(kind*3))],yaw=kind*Math.PI*8,c=Math.cos(yaw),s=Math.sin(yaw),base=batch.p.length/3;
  const lx=lean[0]*.35,lz=lean[1]*.35;
  for(let i=0;i<tree.p.length;i+=3){
    const px=tree.p[i],py=tree.p[i+1],pz=tree.p[i+2];
    batch.p.push(x+height*(px*c+pz*s+py*lx),y+height*py,z+height*(-px*s+pz*c+py*lz));
    const nx=tree.n[i]*c+tree.n[i+2]*s,nz=-tree.n[i]*s+tree.n[i+2]*c,ny=tree.n[i+1]-lx*nx-lz*nz,d=Math.hypot(nx,ny,nz)||1;
    batch.n.push(nx/d,ny/d,nz/d);batch.c.push(.76,.81,.72,0);
    // Keep bark scale proportional to tree size, rather than stretching one tile.
    batch.u.push(tree.u[i/3*2]*3,tree.u[i/3*2+1]*height*.25);
  }
  for(const index of tree.idx)batch.idx.push(base+index);
}
