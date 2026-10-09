/** Consume native HTTP-decoded geometry one existing block at a time. Network
 * download overlaps the bounded Lite/Havok install loop; no JS Brotli decoder,
 * second geometry format or whole-region backing allocation is needed.
 * https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
 */
export async function* readRegionBlocks(response, packet) {
  let expected = 0;
  const layouts = packet.blocks.map(block => {
    const start = expected, attributes = {};
    for (const [name, attribute] of Object.entries(block.attributes)) {
      if (!Number.isSafeInteger(attribute.offset) || attribute.offset !== expected
          || !Number.isSafeInteger(attribute.length) || attribute.length < 0)
        throw Error('Invalid prepared region attribute range');
      attributes[name] = {...attribute, offset: expected - start};
      expected += attribute.length * 4;
      if (!Number.isSafeInteger(expected) || expected > packet.rawBytes)
        throw Error('Prepared region attribute exceeds packet');
    }
    return {block: {...block, attributes}, length: expected - start};
  });
  if (!Number.isSafeInteger(packet.rawBytes) || expected !== packet.rawBytes)
    throw Error('Prepared region ranges do not cover packet');
  if (!response.body) throw Error('Prepared region has no response stream');
  const reader = response.body.getReader();
  let pending = new Uint8Array(0), offset = 0, complete = false;
  try {
    for (const {block, length} of layouts) {
      const bytes = new Uint8Array(length);
      let written = 0;
      while (written < length) {
        if (offset === pending.length) {
          const next = await reader.read();
          if (next.done) throw Error('Prepared region packet is truncated');
          pending = next.value; offset = 0;
        }
        const count = Math.min(length - written, pending.length - offset);
        bytes.set(pending.subarray(offset, offset + count), written);
        written += count; offset += count;
      }
      const buffers = Object.fromEntries(Object.entries(block.attributes).map(([name, a]) => [
        name, name === 'indices'
          ? new Uint32Array(bytes.buffer, a.offset, a.length)
          : new Float32Array(bytes.buffer, a.offset, a.length),
      ]));
      yield {...block, buffers, sharedPacket: true};
    }
    // Completion, including trailing data, is checked before opening navigation.
    if (offset !== pending.length) throw Error('Prepared region has trailing bytes');
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      if (next.value.length) throw Error('Prepared region has trailing bytes');
    }
    complete = true;
  } finally {
    // Breaking installation or aborting the scene must release the native stream.
    // https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader/cancel
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Track completed storage ranges, not arrival of the last range. Optional
 * detail packets can arrive out of order; incomplete native meshes must not
 * retire their fallback. Only metadata is retained, never the streamed arrays.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-from-storage.ts
 */
export function createBlockCompletion(records) {
  const states=records.map(record=>({record,ranges:new Map(),indices:0,vertices:0}));
  function check(block) {
    const state=states[block.meshId],indices=block.buffers.indices.length,
      vertices=block.buffers.positions.length/3,start=block.indexOffset,vstart=block.vertexOffset;
    if(!state||!Number.isSafeInteger(start)||start<0||start%3||!Number.isSafeInteger(indices)||indices<=0||indices%3
      ||!Number.isSafeInteger(vstart)||vstart<0||!Number.isSafeInteger(vertices)||vertices<=0
      ||start+indices>state.record.indices||vstart+vertices>state.record.vertices)
      throw Error('Invalid streamed storage range');
    const same=state.ranges.get(start);
    if(same){
      if(same.indices!==indices||same.vertices!==vertices||same.vstart!==vstart)throw Error('Conflicting streamed storage range');
      return false;
    }
    for(const [other,r]of state.ranges)
      if((start<other+r.indices&&start+indices>other)||(vstart<r.vstart+r.vertices&&vstart+vertices>r.vstart))
        throw Error('Overlapping streamed storage range');
    return true;
  }
  return {
    check,
    mark(block){
      if(!check(block))return false;
      const s=states[block.meshId],indices=block.buffers.indices.length,vertices=block.buffers.positions.length/3;
      s.ranges.set(block.indexOffset,{indices,vertices,vstart:block.vertexOffset});s.indices+=indices;s.vertices+=vertices;
      return s.indices===s.record.indices&&s.vertices===s.record.vertices;
    },
    complete(id){const s=states[id];return !!s&&s.indices===s.record.indices&&s.vertices===s.record.vertices;},
  };
}

/** A candidate may defer only non-colliding full woodland. Prove its metadata
 * partitions the existing stream exactly before any optional mutation/readiness.
 * Byte equality remains the bake/served verifier's responsibility.
 */
export function validateRegionCore(index) {
  const e=index.experimentalCore;
  if(e?.schema!==1||!e.core?.blocks||!e.detail?.blocks)throw Error('Unsupported experimental region packets');
  const key=b=>`${b.meshId}:${b.indexOffset}`;
  const shape=b=>JSON.stringify([b.meshId,b.indexOffset,b.vertexOffset,Object.keys(b.attributes).sort().map(k=>[k,b.attributes[k].length])]);
  const expected=new Map(index.geometry.blocks.map(b=>[key(b),shape(b)]));
  if(expected.size!==index.geometry.blocks.length)throw Error('Duplicate default region range');
  for(const [detail,packet]of [[false,e.core],[true,e.detail]])for(const b of packet.blocks){
    const mesh=index.meshes[b.meshId],full=mesh?.name.startsWith('Woodland ')&&mesh.name.endsWith(' full');
    if(!mesh||detail!==!!full||(detail&&(!mesh.world||mesh.collision))||expected.get(key(b))!==shape(b))
      throw Error('Experimental region changes or misclassifies a storage range');
    expected.delete(key(b));
  }
  if(expected.size)throw Error('Experimental region omits a storage range');
  return e;
}
