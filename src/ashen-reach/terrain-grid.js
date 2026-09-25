// Shared vertices and diagonal for the rendered heightfield and floor sampling.
const offsets=[];
for(let d=4;d<=520;d+=4)offsets.push(d);
for(let d=536;d<=640;d+=16)offsets.push(d);
for(let d=768;d<=1536;d+=128)offsets.push(d);
const axis=(min,max)=>[...offsets.map(d=>min-d).reverse(),...Array.from({length:(max-min)/2+1},(_,i)=>min+i*2),...offsets.map(d=>max+d)];
export const TERRAIN_X=axis(-90,90),TERRAIN_Z=axis(-95,145);
function cell(axis,value){let lo=0,hi=axis.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(axis[m]<=value)lo=m;else hi=m;}return [axis[lo],axis[hi]];}
export function sampleTerrainSurface(x,z,height){
 const corridor=x>=-16&&x<16&&z>=41&&z<143;
 const [x0,x1]=corridor?[Math.floor(x*2)/2,Math.floor(x*2)/2+.5]:cell(TERRAIN_X,x);
 const [z0,z1]=corridor?[Math.floor(z*2)/2,Math.floor(z*2)/2+.5]:cell(TERRAIN_Z,z),u=(x-x0)/(x1-x0),v=(z-z0)/(z1-z0);
 const a=height(x0,z0),c=height(x1,z1);
 return u>=v?a*(1-u)+height(x1,z0)*(u-v)+c*v:a*(1-v)+c*u+height(x0,z1)*(v-u);
}
