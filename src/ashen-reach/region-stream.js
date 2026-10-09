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
