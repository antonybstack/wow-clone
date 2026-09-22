/** Compress first-play GLBs without remapping shared skinned accessors.
 *
 * Vertex reorder on a GLB whose primitives share POSITION/JOINTS accessors
 * (player body, Wayfarer trousers) collapsed those meshes in-engine. Do not
 * call reorder() or quantize() on those files. Body size is the embedded
 * maps; compressBodyTextures resamples those and leaves the bind and clips
 * alone. Hair stays WebP with alpha. See docs/startup-load.md.
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup, prune, reorder, resample} from '@gltf-transform/functions';
import {MeshoptDecoder, MeshoptEncoder} from 'meshoptimizer';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});

function verts(doc) {
  return doc.getRoot().listMeshes().flatMap((mesh) =>
    mesh.listPrimitives().map((prim) => prim.getAttribute('POSITION')?.getCount() ?? 0),
  );
}

function sharedVertexAccessors(doc) {
  const used = new Map();
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const sem of prim.listSemantics()) {
        const acc = prim.getAttribute(sem);
        if (acc) used.set(acc, (used.get(acc) || 0) + 1);
      }
    }
  }
  return [...used.values()].some((n) => n > 1);
}

function sips(args) {
  const result = spawnSync('sips', args, {encoding: 'utf8'});
  if (result.status) throw new Error(result.stderr || `sips ${args.join(' ')}`);
  return result;
}

function pngHasAlpha(bytes) {
  if (!bytes || bytes.byteLength < 26) return false;
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] !== 0x89 || b[1] !== 0x50) return false;
  const colorType = b[25];
  return colorType === 4 || colorType === 6;
}

async function transcodeTexture(texture, {format, max, quality}) {
  const img = texture.getImage();
  if (!img) return false;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ashen-tex-'));
  const src = path.join(tmp, 'src.bin');
  const dest = path.join(tmp, format === 'jpeg' ? 'out.jpg' : 'out.png');
  await fs.writeFile(src, img);
  const args = [];
  if (max) args.push('-Z', String(max));
  if (format === 'jpeg') args.push('-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality ?? 80));
  else args.push('-s', 'format', 'png');
  args.push(src, '--out', dest);
  sips(args);
  const out = await fs.readFile(dest);
  await fs.rm(tmp, {recursive: true, force: true});
  if (out.byteLength >= img.byteLength && !max) return false;
  texture.setImage(out);
  texture.setMimeType(format === 'jpeg' ? 'image/jpeg' : 'image/png');
  return true;
}

async function putImage(texture, bytes, mime) {
  const img = texture.getImage();
  if (!img || bytes.byteLength >= img.byteLength) return false;
  texture.setImage(bytes);
  texture.setMimeType(mime);
  console.log(`  ${texture.getName() || mime} ${(img.byteLength / 1024).toFixed(0)}KB → ${(bytes.byteLength / 1024).toFixed(0)}KB ${mime}`);
  return true;
}

async function compressBodyTextures(doc) {
  for (const texture of doc.getRoot().listTextures()) {
    const name = (texture.getName() || '').toLowerCase();
    const img = texture.getImage();
    if (!img) continue;
    const input = Buffer.from(img);
    // Hair keeps its alpha. JPEG, and sips' resize, both composite that
    // surround and the hairline UVs read it as a silver forehead band.
    // WebP keeps the alpha and the browser decodes it without a transcoder.
    if (/hair/.test(name) && !/normal/.test(name)) {
      const out = await sharp(input).resize(1024, 1024, {fit: 'fill'}).webp({quality: 75, alphaQuality: 90}).toBuffer();
      await putImage(texture, out, 'image/webp');
      continue;
    }
    if (/normal/.test(name)) {
      const out = await sharp(input).resize(512, 512, {fit: 'fill'}).png({compressionLevel: 9}).toBuffer();
      await putImage(texture, out, 'image/png');
      continue;
    }
    // ORM / roughness stays PNG: JPEG chroma smear writes fake metallic into B.
    if (name === 'roughness' || /metal|orm/.test(name)) {
      const out = await sharp(input).resize(512, 512, {fit: 'fill'}).png({compressionLevel: 9}).toBuffer();
      await putImage(texture, out, 'image/png');
      continue;
    }
    const out = await sharp(input).resize(1024, 1024, {fit: 'fill'}).jpeg({quality: 72, mozjpeg: true}).toBuffer();
    await putImage(texture, out, 'image/jpeg');
  }
}

async function compress(file, options = {}) {
  const before = (await fs.stat(file)).size;
  const doc = await io.read(file);
  const beforeVerts = verts(doc);
  const beforeSkins = doc.getRoot().listSkins().length;
  const beforeAnims = doc.getRoot().listAnimations().length;
  const shared = sharedVertexAccessors(doc);

  if (options.bodyTextures) await compressBodyTextures(doc);

  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  const steps = [];
  if (options.resample) steps.push(resample());
  steps.push(dedup());
  if (options.stripUnused) steps.push(prune({keepLeaves: true, keepAttributes: true}));
  const canReorder = options.reorder && !shared;
  if (canReorder) steps.push(reorder({encoder: MeshoptEncoder, target: 'size'}));
  if (steps.length) await doc.transform(...steps);

  const afterVerts = verts(doc);
  if (JSON.stringify(afterVerts) !== JSON.stringify(beforeVerts)) {
    throw new Error(`${file} vertex counts changed ${beforeVerts} → ${afterVerts}`);
  }
  const out = await io.writeBinary(doc);
  await fs.writeFile(file, out);
  const afterSkins = doc.getRoot().listSkins().length;
  const afterAnims = doc.getRoot().listAnimations().length;
  console.log(
    `${(before / 1e6).toFixed(2)} → ${(out.byteLength / 1e6).toFixed(2)} MB` +
      `  skins=${afterSkins} (was ${beforeSkins})` +
      `  anims=${afterAnims} (was ${beforeAnims})` +
      `  shared=${shared} reorder=${canReorder}  ${file}`,
  );
  return {path: file, before, after: out.byteLength, sha256: createHash('sha256').update(out).digest('hex')};
}

const jobs = [
  {file: 'public/ashen-reach/equipment/body.glb', bodyTextures: true, resample: false, stripUnused: false, reorder: false},
  {file: 'public/ashen-reach/equipment/wayfarerTunic.glb', resample: true, stripUnused: true, reorder: false},
  {file: 'public/ashen-reach/equipment/wayfarerTrousers.glb', resample: true, stripUnused: true, reorder: false},
  {file: 'public/ashen-reach/equipment/wayfarerBoots.glb', resample: true, stripUnused: true, reorder: false},
  {file: 'public/ashen-reach/training-dummy.glb', resample: true, stripUnused: true, reorder: true},
  {file: 'public/characters/base.glb', resample: false, stripUnused: true, reorder: true},
];

const only = process.argv.slice(2);
const selected = only.length ? jobs.filter((job) => only.some((token) => job.file.endsWith(token))) : jobs;
if (!selected.length) throw new Error(`no compress jobs matched ${only.join(' ')}`);
const results = [];
for (const job of selected) results.push(await compress(job.file, job));

const manifestPath = 'public/ashen-reach/equipment/manifest.json';
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const byName = Object.fromEntries(results.map((r) => [r.path.split('/').pop(), r]));
for (const item of Object.values(manifest.items || {})) {
  const hit = byName[item.url?.split('/').pop()];
  if (!hit) continue;
  item.bytes = hit.after;
  item.sha256 = hit.sha256;
}
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated', manifestPath);
