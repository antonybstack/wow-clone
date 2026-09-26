import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

/** Decode optimized assets for the legacy, deliberately single-buffer fixture tools. */
export async function fixtureGlbInput(bytes) {
  const input = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (input.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== input.byteLength) {
    return input.slice().buffer;
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > input.byteLength) {
    return input.slice().buffer;
  }
  let json;
  try { json = JSON.parse(new TextDecoder().decode(input.subarray(20, 20 + jsonLength))); }
  catch { return input.slice().buffer; }
  if (!json.extensionsUsed?.includes('EXT_meshopt_compression')) return input.slice().buffer;

  // glTF Transform's meshopt reader decodes the live asset; disposing the extension
  // writes an ordinary embedded GLB for the fixture parser without re-encoding it.
  // https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const document = await io.readBinary(input);
  document.getRoot().listExtensionsUsed()
    .find((extension) => extension.extensionName === 'EXT_meshopt_compression')?.dispose();
  const normalized = await io.writeBinary(document);
  return normalized.buffer.slice(normalized.byteOffset, normalized.byteOffset + normalized.byteLength);
}
