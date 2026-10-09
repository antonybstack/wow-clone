/** Validate the independent near/skyline immutable packets. Kept outside the shared
 * compiler-provenance helper so world verifier changes do not invalidate character assets. */
import {createHash} from "node:crypto";
import {brotliDecompressSync} from "node:zlib";
import {validateRegionCore} from '../../src/ashen-reach/region-stream.js';
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
/** Each packet's attribute ranges must tile its decoded bytes exactly: 4-byte aligned, no
 * gap, no overlap, nothing outside. That proves the required near packet carries only its
 * required blocks/foliage/previews and the background blocks/proxies stay in
 * their declared packets. */
function assertTiled(label, descriptors, rawBytes) {
  const ranges = descriptors.flatMap((d) => Object.entries(d.attributes).map(([name, a]) => ({name: `${d.name ?? 'foliage'}/${name}`, start: a.offset, end: a.offset + a.length * 4})))
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const r of ranges) {
    if (!Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.end) || r.start < 0 || r.start % 4 || r.end % 4 || r.end < r.start || r.end > rawBytes)
      throw Error(`Corrupt ${label} packet layout at ${r.name}`);
    if (r.end === r.start) continue; // an empty pool (count 0) occupies no bytes
    if (r.start !== cursor) throw Error(`Corrupt ${label} packet layout at ${r.name}`);
    cursor = r.end;
  }
  if (cursor !== rawBytes) throw Error(`Corrupt ${label} packet: descriptors cover ${cursor} of ${rawBytes} bytes`);
}
async function verifyPacket(label, prefix, packet, descriptors, read) {
  if (packet?.compression !== "http-br" || !new RegExp(`^${prefix}-[a-f0-9]{12}\\.br$`).test(packet.file ?? ""))
    throw Error(`Corrupt ${label} packet descriptor`);
  const bytes = await read(packet.file), sha = digest(bytes);
  if (bytes.length !== packet.encodedBytes || sha !== packet.sha256 || !sha.startsWith(packet.file.slice(prefix.length + 1, prefix.length + 13)))
    throw Error(`Corrupt prepared ${label} packet ${packet.file}`);
  const raw = brotliDecompressSync(bytes);
  if (raw.length !== packet.rawBytes) throw Error(`Corrupt ${label} packet: ${raw.length} decoded bytes, expected ${packet.rawBytes}`);
  if(descriptors)assertTiled(label, descriptors, packet.rawBytes);
  return raw;
}
/** Required near packet (terrain/landmarks, near foliage and starting previews),
 * plus an optional packet of non-colliding render blocks and distant proxies.
 * Proxy names are unique across packets; legacy single-packet manifests still work. */
export async function verifyStarterGeometry(manifest, read) {
  const g = manifest.geometry, foliage = Object.values(manifest.foliage ?? {});
  const proxyNames = [...(g.proxies ?? []), ...(g.skyline?.proxies ?? [])].map(p => p.name);
  if (new Set(proxyNames).size !== proxyNames.length) throw Error("Corrupt starter geometry: duplicate proxies");
  const near = await verifyPacket("near", "near", g, [...g.blocks, ...foliage, ...(g.proxies ?? [])], read);
  const backgroundBlocks = g.skyline?.blocks ?? [];
  const keys = new Set(g.blocks.map(b => `${b.meshId}:${b.indexOffset}`));
  for (const b of backgroundBlocks) {
    const mesh = manifest.meshes[b.meshId], key = `${b.meshId}:${b.indexOffset}`;
    if (!mesh?.world || mesh.collision || keys.has(key))
      throw Error('Invalid non-colliding background block');
    keys.add(key);
  }
  for(const proxy of g.proxies??[]) {
    if(proxy.requiresBlocks && (!proxy.requiresBlocks.length || proxy.requiresBlocks.some(k=>!keys.has(k))))
      throw Error('Corrupt starting preview dependencies');
  }
  const skyline = g.skyline ? await verifyPacket("skyline", "skyline", g.skyline, [...backgroundBlocks, ...g.skyline.proxies], read) : null;
  let region=null,regionFoliage=null;
  if(g.region){
    const indexBytes=await verifyPacket('region index','region-index',g.region,null,read);
    const index=JSON.parse(indexBytes.toString('utf8'));
    if(index.schema!==1||JSON.stringify(index.meshes)!==JSON.stringify(manifest.meshes))throw Error('Prepared region header differs from starting world');
    const experimental=index.experimentalCore;
    if(!!g.region.experimentalCore!==!!experimental)throw Error('Experimental region declaration differs from its index');
    if(experimental)validateRegionCore(index);
    const dependencies=[index.geometry.file,index.foliage.file,...(experimental?[experimental.core.file,experimental.detail.file]:[])];
    if(JSON.stringify(g.region.files)!==JSON.stringify(dependencies))throw Error('Prepared region dependency list differs from its index');
    region=await verifyPacket('region','region',index.geometry,index.geometry.blocks,read);
    if(experimental){
      const original=new Map(index.geometry.blocks.map(b=>[`${b.meshId}:${b.indexOffset}`,b]));
      for(const [kind,packet]of [['core',experimental.core],['detail',experimental.detail]]){
        const raw=await verifyPacket('region '+kind,'region-'+kind,packet,packet.blocks,read);
        for(const b of packet.blocks)for(const [name,a]of Object.entries(b.attributes)){
          const expected=original.get(`${b.meshId}:${b.indexOffset}`).attributes[name];
          if(!raw.subarray(a.offset,a.offset+a.length*4).equals(region.subarray(expected.offset,expected.offset+expected.length*4)))
            throw Error('Experimental region bytes differ from the existing stream');
        }
      }
    }
    const blocks=new Map(),records=new Map();
    for(const b of [...g.blocks,...index.geometry.blocks]){
      const mesh=manifest.meshes[b.meshId],key=`${b.meshId}:${b.indexOffset}`,a=b.attributes;
      if(!mesh||blocks.has(key)||!Number.isSafeInteger(b.indexOffset)||b.indexOffset<0||b.indexOffset%3||!Number.isSafeInteger(b.vertexOffset)||b.vertexOffset<0)
        throw Error('Invalid prepared region geometry block');
      const vertices=a.positions?.length/3,indices=a.indices?.length;
      if(!Number.isSafeInteger(vertices)||vertices<=0||!Number.isSafeInteger(indices)||indices<=0||indices%3||a.normals?.length!==vertices*3||a.uvs?.length!==vertices*2||a.uv2?.length!==vertices*2||a.colors?.length!==vertices*4)
        throw Error('Invalid prepared region attribute lengths');
      blocks.set(key,b);
      const list=records.get(b.meshId)??[];list.push(b);records.set(b.meshId,list);
    }
    // Prove every final storage range is covered once. This includes initial tree
    // ranges duplicated only in the independent optional skyline packet.
    for(const [id,mesh]of manifest.meshes.entries()){
      let indices=0,vertices=0;
      for(const b of (records.get(id)??[]).sort((a,b)=>a.indexOffset-b.indexOffset)){
        if(b.indexOffset!==indices||b.vertexOffset!==vertices)throw Error('Prepared region has a geometry gap or overlap');
        indices+=b.attributes.indices.length;vertices+=b.attributes.positions.length/3;
      }
      if(indices!==mesh.indices||vertices!==mesh.vertices)throw Error('Prepared region does not cover the complete world');
    }
    for(const b of index.geometry.blocks){
      const a=b.attributes,values=new Uint32Array(region.buffer,region.byteOffset+a.indices.offset,a.indices.length);
      if(values.some(i=>i>=a.positions.length/3))throw Error('Prepared region indices exceed local vertex range');
      for(const [name,v]of Object.entries(a))if(name!=='indices'&&new Float32Array(region.buffer,region.byteOffset+v.offset,v.length).some(n=>!Number.isFinite(n)))throw Error('Prepared region contains nonfinite attributes');
    }
    for(const b of backgroundBlocks){
      const same=blocks.get(`${b.meshId}:${b.indexOffset}`);
      if(!same)throw Error('Prepared region omits an optional near-tree range');
      for(const [name,a]of Object.entries(b.attributes)){
        const other=same.attributes[name];
        if(a.length!==other?.length||!skyline.subarray(a.offset,a.offset+a.length*4).equals(region.subarray(other.offset,other.offset+other.length*4)))throw Error('Prepared region and skyline duplicate range differs');
      }
    }
    if(JSON.stringify(Object.keys(index.foliage.pools).sort())!==JSON.stringify(Object.keys(manifest.foliage).sort()))throw Error('Prepared region foliage species differ');
    const tiles=Object.values(index.foliage.pools).flatMap(pool=>pool.tiles);
    regionFoliage=await verifyPacket('region foliage','foliage',index.foliage,tiles,read);
    for(const pool of Object.values(index.foliage.pools)){
      if(!Number.isSafeInteger(pool.count)||pool.count<0||pool.tiles.reduce((n,t)=>n+t.count,0)!==pool.count)throw Error('Invalid prepared region foliage count');
      for(const tile of pool.tiles)if(!Number.isSafeInteger(tile.count)||tile.count<0||!Number.isFinite(tile.cx)||!Number.isFinite(tile.cz)||tile.attributes.matrices?.length!==tile.count*16||tile.attributes.colors?.length!==tile.count*4)throw Error('Invalid prepared region foliage tile');
    }
  }
  return { near: near.length, skyline: skyline?.length ?? 0, proxies: proxyNames.length,region:region?.length??0,regionFoliage:regionFoliage?.length??0 };
}
