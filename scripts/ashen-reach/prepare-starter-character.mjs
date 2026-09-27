/** Preserve every joint, vertex and animation; defer only the full body texture.
 * https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression
 * Skinned accessors must not be reordered or quantized (see compress-startup-glbs.mjs).
 */
import {
  startupProvenance,
  pruneStartupAssets,
} from "./startup-provenance.mjs";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const root = "public/ashen-reach/startup/character";
await fs.mkdir(root, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await fs.readFile("public/ashen-reach/equipment/manifest.json", "utf8"),
);
const input = await fs.readFile("public/ashen-reach/equipment/body.glb"),
  doc = await io.readBinary(input);
const textures = [];
for (const texture of doc.getRoot().listTextures()) {
  const original = Buffer.from(texture.getImage()),
    name = `body-texture-${hash(original).slice(0, 12)}.png`;
  if (texture.getMimeType() !== "image/png")
    throw Error("Update texture export for the new source format");
  await fs.writeFile(`${root}/${name}`, original);
  const materials = doc
    .getRoot()
    .listMaterials()
    .filter((m) => m.getBaseColorTexture() === texture)
    .map((m) => m.getName());
  if (!materials.length)
    throw Error("Starter texture upgrade only supports source base color maps");
  textures.push({ materials, url: `/ashen-reach/startup/character/${name}` });
  texture
    .setImage(
      await sharp(original)
        .resize(256, 256, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer(),
    )
    .setMimeType("image/webp");
}
doc.createExtension(EXTMeshoptCompression).setRequired(true);
const body = await io.writeBinary(doc);
const encode = async (id, bytes) => {
  const compressed = gzipSync(bytes, { level: 9 }),
    name = `${id}-${hash(compressed).slice(0, 12)}.bin`;
  await fs.writeFile(`${root}/${name}`, compressed);
  return {
    ...manifest.items[id],
    url: `/ashen-reach/startup/character/${name}`,
    bytes: bytes.length,
    encodedBytes: compressed.length,
    sha256: hash(bytes),
    compression: "gzip",
  };
};
manifest.items.body = await encode("body", body);
for (const id of ["wayfarerTunic", "wayfarerTrousers", "wayfarerBoots"])
  manifest.items[id] = await encode(
    id,
    await fs.readFile(`public/ashen-reach/equipment/${id}.glb`),
  );
manifest.startup = {
  sourceSha256: hash(input),
  textures,
  animations: doc
    .getRoot()
    .listAnimations()
    .map((a) => a.getName()),
};
manifest.provenance = await startupProvenance(
  ["scripts/ashen-reach/prepare-starter-character.mjs"],
  [
    "public/ashen-reach/equipment/manifest.json",
    ...["body", "wayfarerTunic", "wayfarerTrousers", "wayfarerBoots"].map(
      (id) => `public/ashen-reach/equipment/${id}.glb`,
    ),
  ],
);
await fs.writeFile(`${root}/manifest.json`, JSON.stringify(manifest));
console.log(
  JSON.stringify(
    Object.fromEntries(
      ["body", "wayfarerTunic", "wayfarerTrousers", "wayfarerBoots"].map(
        (id) => [id, manifest.items[id].encodedBytes],
      ),
    ),
  ),
);

await pruneStartupAssets("character");
