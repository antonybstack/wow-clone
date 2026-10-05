/** Validate the independent near/skyline immutable packets. Kept outside the shared
 * compiler-provenance helper so world verifier changes do not invalidate character assets. */
import {createHash} from "node:crypto";
import {brotliDecompressSync} from "node:zlib";
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
/** Each packet's attribute ranges must tile its decoded bytes exactly: 4-byte aligned, no
 * gap, no overlap, nothing outside. That proves the required near packet carries only its
 * blocks/foliage and the skyline packet only its proxies. */
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
  assertTiled(label, descriptors, packet.rawBytes);
  return raw;
}
/** Required near packet (initial blocks + near foliage) and, when present, the separate
 * background skyline packet (distant non-colliding proxies). A legacy single packet that
 * still embeds `geometry.proxies` is accepted only without a skyline packet. */
export async function verifyStarterGeometry(manifest, read) {
  const g = manifest.geometry, foliage = Object.values(manifest.foliage ?? {});
  if (g.proxies && g.skyline) throw Error("Starter geometry declares proxies in both packets");
  const near = await verifyPacket("near", "near", g, [...g.blocks, ...foliage, ...(g.proxies ?? [])], read);
  const skyline = g.skyline ? await verifyPacket("skyline", "skyline", g.skyline, g.skyline.proxies, read) : null;
  return { near: near.length, skyline: skyline?.length ?? 0, proxies: (g.skyline?.proxies ?? g.proxies ?? []).length };
}
