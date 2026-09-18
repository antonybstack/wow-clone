/** Small, strict GLB utilities for offline fixtures and the assembly proof. */
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const types = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
export function parseGlb(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== view.byteLength) throw new Error('Invalid GLB 2.0 container');
  let json, binary;
  for (let offset = 12; offset < view.byteLength;) {
    if (offset + 8 > view.byteLength) throw new Error('Truncated GLB chunk');
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    offset += 8;
    if (offset + length > view.byteLength) throw new Error('Truncated GLB payload');
    const bytes = new Uint8Array(buffer, offset, length);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes));
    if (type === 0x004e4942) binary = bytes;
    offset += length;
  }
  if (!json || !binary || json.buffers?.length !== 1 || json.buffers[0].uri) throw new Error('Expected an embedded, single-buffer GLB');
  return { json, binary };
}
export function readAccessor(json, binary, index) {
  const a = json.accessors?.[index], bv = json.bufferViews?.[a?.bufferView];
  const Type = types[a?.componentType], components = sizes[a?.type];
  if (!a || !bv || !Type || !components || a.sparse || bv.buffer !== 0) throw new Error(`Unsupported accessor ${index}`);
  const step = Type.BYTES_PER_ELEMENT, stride = bv.byteStride || components * step;
  const offset = (bv.byteOffset || 0) + (a.byteOffset || 0);
  if (offset + (a.count - 1) * stride + components * step > binary.byteLength) throw new Error(`Accessor ${index} exceeds binary`);
  const result = new Type(a.count * components);
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const read = a.componentType === 5126 ? 'getFloat32' : a.componentType === 5125 ? 'getUint32' : a.componentType === 5123 ? 'getUint16' : 'getUint8';
  for (let i = 0; i < a.count; i++) for (let k = 0; k < components; k++) result[i * components + k] = view[read](offset + i * stride + k * step, true);
  return result;
}
/** Empty single-buffer glTF JSON for standalone extracts. No generator timestamp. */
export function emptyGlbJson() {
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    skins: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  };
}

export function glbWriter(json, originalBinary) {
  const chunks = [originalBinary]; let length = originalBinary.byteLength;
  const append = (values, type, bounds = false) => {
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(new Uint8Array(padding)); length += padding; }
    const data = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
    const bufferView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.byteLength });
    chunks.push(data); length += data.byteLength;
    const componentType = Object.entries(types).find(([, ctor]) => values instanceof ctor)?.[0];
    if (!componentType) throw new Error('Unsupported typed array');
    const a = { bufferView, componentType: Number(componentType), count: values.length / sizes[type], type };
    if (bounds) {
      a.min = new Array(sizes[type]).fill(Infinity); a.max = new Array(sizes[type]).fill(-Infinity);
      for (let i = 0; i < values.length; i++) { const k = i % sizes[type]; a.min[k] = Math.min(a.min[k], values[i]); a.max[k] = Math.max(a.max[k], values[i]); }
    }
    json.accessors.push(a); return json.accessors.length - 1;
  };
  return { append, finish() {
    json.buffers = [{ byteLength: length }];
    const text = new TextEncoder().encode(JSON.stringify(json));
    const jsonLength = Math.ceil(text.length / 4) * 4, binaryLength = Math.ceil(length / 4) * 4;
    const buffer = new ArrayBuffer(28 + jsonLength + binaryLength), view = new DataView(buffer), bytes = new Uint8Array(buffer);
    view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
    view.setUint32(12, jsonLength, true); view.setUint32(16, 0x4e4f534a, true);
    bytes.fill(32, 20, 20 + jsonLength); bytes.set(text, 20);
    view.setUint32(20 + jsonLength, binaryLength, true); view.setUint32(24 + jsonLength, 0x004e4942, true);
    let offset = 28 + jsonLength;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return buffer;
  } };
}
