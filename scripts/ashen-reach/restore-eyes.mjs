/**
 * Seats a globe in each Human and Orc socket and covers it with lids, so the
 * opening is an almond instead of a flat slit or a sphere stuck on the brow.
 *
 * The player root scale.x is -1, which flips winding. Globe and lid triangles
 * are stored clockwise; after the mirror the outside faces the camera.
 * Body coverage meshes are left alone (the human partition test requires them).
 * Re-running scripts/character-assets/orc_from_sculpt.py add_eyes() puts the
 * 3 mm skull speck back.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import { crc32, deflateSync } from 'node:zlib';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const HUMAN_SOURCE = 'public/characters/candidates/human-source-v1.glb';
const HUMAN_TARGETS = [
  'public/ashen-reach/equipment/body.glb',
  'public/ashen-reach/wanderer-equipment.glb',
];
const ORC_BODY = 'public/ashen-reach/equipment-orc/body.glb';

const SPECS = {
  human: {
    mesh: 'HumanEyes',
    centers: [
      { x: -0.043, y: 1.694 },
      { x: 0.043, y: 1.694 },
    ],
    radius: 0.02,
    openX: 0.009,
    openY: 0.004,
    outer: 1.38,
    hood: 0.00115,
    proud: 0.0022,
    tilt: 0.12,
    base: [0.07, 0.025, 0.012, 1],
    emit: [0.12, 0.03, 0.01],
    strength: 0.35,
  },
  orc: {
    mesh: 'OrcV1Eyes',
    centers: [
      { x: -0.037, y: 1.988 },
      { x: 0.035, y: 1.984 },
    ],
    radius: 0.02,
    openX: 0.01,
    openY: 0.0042,
    outer: 1.42,
    hood: 0.00145,
    proud: 0.0022,
    tilt: 0.08,
    base: [0.05, 0.02, 0.01, 1],
    emit: [0.16, 0.04, 0.012],
    strength: 0.45,
  },
};

function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function srgbToLinear(byte) {
  const x = byte / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function paintEye(size, iris, irisPixels, irisInfo) {
  const rgba = Buffer.alloc(size * size * 4);
  const rough = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const irisR = size * 0.46;
  const pupilR = size * (iris === 'amber' ? 0.2 : 0.18);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cx;
      const d = Math.hypot(dx, dy);
      const i = (y * size + x) * 4;
      const n = hash(x, y);
      const vein = hash(x >> 2, y) * hash(y >> 1, x >> 3);
      let r = iris === 'amber' ? 0.15 : 0.2;
      let g = iris === 'amber' ? 0.055 : 0.08;
      let b = iris === 'amber' ? 0.028 : 0.035;
      if (vein > 0.72 && d > irisR * 0.9) {
        r = r * 0.88 + 0.06;
        g *= 0.9;
        b *= 0.9;
      }
      let roughness = 0.78;
      if (iris === 'amber') {
        r = 0.15;
        g = 0.055;
        b = 0.028;
      }
      if (irisPixels && d < irisR * 1.08) {
        const u = 0.5 + (dx / (irisR * 2.15));
        const v = 0.5 + (dy / (irisR * 2.15));
        const ix = Math.min(irisInfo.width - 1, Math.max(0, Math.round(u * (irisInfo.width - 1))));
        const iy = Math.min(irisInfo.height - 1, Math.max(0, Math.round(v * (irisInfo.height - 1))));
        const p = (iy * irisInfo.width + ix) * 4;
        const pr = irisPixels[p] / 255;
        const pg = irisPixels[p + 1] / 255;
        const pb = irisPixels[p + 2] / 255;
        const luma = (pr + pg + pb) / 3;
        const sat = Math.max(pr, pg, pb) - Math.min(pr, pg, pb);
        const photo = luma < 0.86 || sat > 0.08;
        if (photo) {
          const edge = Math.min(1, Math.max(0, (irisR * 1.02 - d) / (irisR * 0.08)));
          r = r * (1 - edge) + Math.min(1, pr * 1.35) * edge;
          g = g * (1 - edge) + Math.min(1, pg * 1.35) * edge;
          b = b * (1 - edge) + Math.min(1, pb * 1.35) * edge;
        }
      } else if (iris === 'amber' && d < irisR) {
        const t = d / irisR;
        const fiber = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 21 + n * 5);
        const streak = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 8 + 1.4);
        const collar = Math.exp(-((t - 0.46) ** 2) / 0.01);
        r = 0.1 + t * 0.26 + fiber * 0.11 + streak * 0.05 + collar * 0.14;
        g = 0.045 + t * 0.11 + fiber * 0.04 + collar * 0.05;
        b = 0.018 + t * 0.03 + streak * 0.012;
      }
      if (d < pupilR) {
        const k = Math.min(1, (pupilR - d) / Math.max(1, size * 0.012));
        r = r * (1 - k) + 0.012 * k;
        g = g * (1 - k) + 0.008 * k;
        b = b * (1 - k) + 0.006 * k;
        roughness = 0.4;
      } else if (d < irisR) {
        const limb = Math.min(1, Math.max(0, (d - irisR * 0.86) / (irisR * 0.14)));
        r *= 1 - limb * 0.72;
        g *= 1 - limb * 0.72;
        b *= 1 - limb * 0.65;
        roughness = 0.5 + limb * 0.15;
      }
      const up = (cx - y) / size;
      if (up > 0.08) {
        const shade = Math.min(0.22, (up - 0.08) * 0.55);
        r *= 1 - shade;
        g *= 1 - shade;
        b *= 1 - shade;
      }
      rgba[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      rgba[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
      rgba[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
      rgba[i + 3] = 255;
      rough[i] = 255;
      rough[i + 1] = Math.round(Math.min(1, Math.max(0, roughness)) * 255);
      rough[i + 2] = 0;
      rough[i + 3] = 255;
    }
  }
  return { color: png(size, rgba), rough: png(size, rough), rgba };
}

async function extractIris(pngOrJpeg) {
  const { data, info } = await sharp(Buffer.from(pngOrJpeg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const dark = [];
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < 36 && data[i + 1] < 36 && data[i + 2] < 36) dark.push([x, y]);
    }
  }
  if (dark.length < 20) return null;
  const used = new Uint8Array(dark.length);
  const clusters = [];
  for (let i = 0; i < dark.length; i++) {
    if (used[i]) continue;
    const stack = [i];
    used[i] = 1;
    const pts = [];
    while (stack.length) {
      const at = stack.pop();
      pts.push(dark[at]);
      for (let j = 0; j < dark.length; j++) {
        if (used[j]) continue;
        if (Math.abs(dark[j][0] - dark[at][0]) < 18 && Math.abs(dark[j][1] - dark[at][1]) < 18) {
          used[j] = 1;
          stack.push(j);
        }
      }
    }
    if (pts.length > 8) clusters.push(pts);
  }
  clusters.sort((a, b) => b.length - a.length);
  const pupil = clusters[0];
  if (!pupil) return null;
  const cx = pupil.reduce((s, p) => s + p[0], 0) / pupil.length;
  const cy = pupil.reduce((s, p) => s + p[1], 0) / pupil.length;
  let radius = 12;
  for (let r = 14; r < Math.min(width, height) * 0.45; r += 2) {
    let luma = 0;
    const steps = 28;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = (y * width + x) * 4;
      luma += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    radius = r;
    if (luma / steps > 168 && r > 24) break;
  }
  const side = Math.round(radius * 2.3);
  const left = Math.round(cx - side / 2);
  const top = Math.round(cy - side / 2);
  const crop = Buffer.alloc(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const sx = Math.min(width - 1, Math.max(0, left + x));
      const sy = Math.min(height - 1, Math.max(0, top + y));
      const s = (sy * width + sx) * 4;
      const d = (y * side + x) * 4;
      crop[d] = data[s];
      crop[d + 1] = data[s + 1];
      crop[d + 2] = data[s + 2];
      crop[d + 3] = 255;
    }
  }
  return { pixels: crop, info: { width: side, height: side }, radius };
}

function frontVerts(doc) {
  const node = doc.getRoot().listNodes().find((item) => item.getName() === 'BodyExposed' && item.getMesh());
  const out = [];
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const nrm = prim.getAttribute('NORMAL').getArray();
    const joints = prim.getAttribute('JOINTS_0').getArray();
    const weights = prim.getAttribute('WEIGHTS_0').getArray();
    for (let i = 0; i < pos.length; i += 3) {
      if (nrm[i + 2] < 0.2 || pos[i + 1] < 1.35 || Math.abs(pos[i]) > 0.16) continue;
      const vi = i / 3;
      out.push({
        p: [pos[i], pos[i + 1], pos[i + 2]],
        n: [nrm[i], nrm[i + 1], nrm[i + 2]],
        j: [joints[vi * 4], joints[vi * 4 + 1], joints[vi * 4 + 2], joints[vi * 4 + 3]],
        w: [weights[vi * 4], weights[vi * 4 + 1], weights[vi * 4 + 2], weights[vi * 4 + 3]],
      });
    }
  }
  return out;
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sampleFace(front, x, y) {
  const near = [];
  for (const v of front) {
    if (v.n[2] < 0.25) continue;
    const d = (v.p[0] - x) ** 2 + (v.p[1] - y) ** 2;
    if (d < 0.012 ** 2) near.push(v);
  }
  if (!near.length) return null;
  const proud = Math.max(...near.map((v) => v.p[2]));
  const floor = near.filter((v) => v.p[2] > proud - 0.01).sort((a, b) => a.p[2] - b.p[2])[0];
  return { p: floor.p, n: normalize(floor.n), j: floor.j, w: floor.w };
}

function resolveEyes(front, spec) {
  return spec.centers.map((center) => {
    const face = sampleFace(front, center.x, center.y);
    if (!face) throw Error(`No face surface at ${center.x}, ${center.y}`);
    const above = sampleFace(front, center.x, center.y + 0.018);
    return { ...center, faceZ: face.p[2], skin: face, browZ: above ? above.p[2] : face.p[2] };
  });
}

function bead(eye, spec, positions, normals, indices, skins) {
  const radius = 0.006;
  const n = eye.skin.n;
  const sink = radius - 0.001;
  const center = eye.skin.p.map((value, axis) => value - n[axis] * sink);
  const stacks = 7;
  const sectors = 10;
  const base = positions.length / 3;
  for (let i = 0; i <= stacks; i++) {
    const phi = (i / stacks) * Math.PI;
    const ring = Math.sin(phi);
    const y = Math.cos(phi);
    for (let j = 0; j <= sectors; j++) {
      const theta = (j / sectors) * Math.PI * 2;
      const x = ring * Math.cos(theta);
      const z = ring * Math.sin(theta);
      positions.push(center[0] + x * radius, center[1] + y * radius, center[2] + z * radius);
      normals.push(x, y, z);
      skins.push(eye.skin);
    }
  }
  const row = sectors + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < sectors; j++) {
      const a = base + i * row + j;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
}

function lid(eye, spec, front, positions, normals, uvs, indices, skins) {
  const segs = 40;
  const rings = 4;
  const base = positions.length / 3;
  const openY = eye.y - spec.hood;
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    for (let j = 0; j < segs; j++) {
      const angle = (j / segs) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const span = 1 + t * (spec.outer - 1);
      let x = eye.x + c * spec.openX * span;
      let y = openY + s * spec.openY * span;
      y += (x - eye.x) * -Math.sign(eye.x) * spec.tilt * (0.35 + 0.65 * (1 - t));
      if (s > 0) y -= spec.hood * s * (1 - t) * 0.85;
      if (s < 0 && t < 0.4) y -= s * spec.openY * 0.12 * (1 - t);
      const towardNose = c * (eye.x < 0 ? 1 : -1);
      if (towardNose > 0 && t < 0.35) y += towardNose * spec.openY * 0.08;
      const face = sampleFace(front, x, y) || eye.skin;
      const crease = Math.exp(-((t - 0.55) ** 2) / 0.03) * (s > 0 ? 1 : 0.35);
      const lift = 0.0003 + (1 - t) ** 2 * 0.0009 - crease * 0.00035 + (s > 0 ? (1 - t) * s * 0.00035 : 0);
      const n = normalize([
        face.n[0] * 0.45 + c * 0.18,
        face.n[1] * 0.35 + (s > 0 ? -0.62 : 0.28),
        face.n[2] * 0.55 + 0.85,
      ]);
      positions.push(face.p[0] + n[0] * lift, face.p[1] + n[1] * lift, face.p[2] + n[2] * lift);
      normals.push(n[0], n[1], n[2]);
      uvs.push(0.5, 0.5);
      skins.push(face.j ? face : eye.skin);
    }
  }
  for (let r = 0; r < rings - 1; r++) {
    for (let j = 0; j < segs; j++) {
      const a = base + r * segs + j;
      const a1 = base + r * segs + ((j + 1) % segs);
      const b = base + (r + 1) * segs + j;
      const b1 = base + (r + 1) * segs + ((j + 1) % segs);
      indices.push(a, a1, b, b, a1, b1);
    }
  }
}

function accessor(doc, buffer, name, type, array) {
  return doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
}

function packSkin(doc, buffer, name, skins, jointCtor) {
  const joints = new jointCtor(skins.length * 4);
  const weights = new Float32Array(skins.length * 4);
  for (let i = 0; i < skins.length; i++) {
    const skin = skins[i];
    for (let k = 0; k < 4; k++) {
      joints[i * 4 + k] = skin.j[k];
      weights[i * 4 + k] = skin.w[k];
    }
  }
  return {
    joints: accessor(doc, buffer, `${name} joints`, 'VEC4', joints),
    weights: accessor(doc, buffer, `${name} weights`, 'VEC4', weights),
  };
}

async function seat(doc, spec, images) {
  const root = doc.getRoot();
  const node = root.listNodes().find((item) => item.getName() === spec.mesh && item.getMesh());
  if (!node) throw Error(`Missing ${spec.mesh}`);
  const skin = node.getSkin() || root.listSkins()[0];
  const buffer = root.listBuffers()[0];
  const body = root.listNodes().find((item) => item.getName() === 'BodyExposed' && item.getMesh());
  const jointCtor = body.getMesh().listPrimitives()[0].getAttribute('JOINTS_0').getArray().constructor;
  const front = frontVerts(doc);
  const eyes = resolveEyes(front, spec);
  for (const eye of eyes) {
    console.log(
      spec.mesh,
      eye.x.toFixed(3),
      'faceZ', eye.faceZ.toFixed(4),
      'browZ', eye.browZ.toFixed(4),
      'sink', (eye.faceZ - (eye.faceZ + spec.proud - spec.radius)).toFixed(4),
    );
  }
  const positions = [];
  const normals = [];
  const indices = [];
  const skins = [];
  for (const eye of eyes) bead(eye, spec, positions, normals, indices, skins);
  const glow = doc.createExtension(KHRMaterialsEmissiveStrength).createEmissiveStrength().setEmissiveStrength(spec.strength);
  const eyeMat = doc.createMaterial(spec.mesh)
    .setBaseColorFactor(spec.base)
    .setRoughnessFactor(0.28)
    .setMetallicFactor(0)
    .setEmissiveFactor(spec.emit)
    .setDoubleSided(true)
    .setAlphaMode('OPAQUE')
    .setExtension(KHRMaterialsEmissiveStrength.EXTENSION_NAME, glow);
  const mesh = node.getMesh();
  for (const prim of [...mesh.listPrimitives()]) {
    const mat = prim.getMaterial();
    prim.dispose();
    if (mat && mat.listParents().length === 0) {
      const textures = [mat.getBaseColorTexture(), mat.getMetallicRoughnessTexture(), mat.getNormalTexture()].filter(Boolean);
      mat.dispose();
      for (const tex of textures) {
        if (tex.listParents().length === 0) tex.dispose();
      }
    }
  }
  const eyeSkin = packSkin(doc, buffer, spec.mesh, skins, jointCtor);
  mesh.addPrimitive(doc.createPrimitive()
    .setMaterial(eyeMat)
    .setIndices(accessor(doc, buffer, `${spec.mesh} indices`, 'SCALAR', new Uint16Array(indices)))
    .setAttribute('POSITION', accessor(doc, buffer, `${spec.mesh} pos`, 'VEC3', new Float32Array(positions)))
    .setAttribute('NORMAL', accessor(doc, buffer, `${spec.mesh} nrm`, 'VEC3', new Float32Array(normals)))
    .setAttribute('JOINTS_0', eyeSkin.joints)
    .setAttribute('WEIGHTS_0', eyeSkin.weights));
  node.setSkin(skin);
  console.log(spec.mesh, 'globe tris', indices.length / 3, 'socket', eyes.map((eye) => eye.skin.p.map((n) => n.toFixed(3)).join(',')));
}

async function lidTone(doc, point) {
  const node = doc.getRoot().listNodes().find((item) => item.getName() === 'BodyExposed' && item.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION').getArray();
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const tex = prim.getMaterial().getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = 1e9;
  let u = 0.5;
  let v = 0.5;
  for (let i = 0; i < pos.length; i += 3) {
    const d = (pos[i] - point[0]) ** 2 + (pos[i + 1] - point[1]) ** 2;
    if (d < best) {
      best = d;
      u = uv[(i / 3) * 2];
      v = uv[(i / 3) * 2 + 1];
    }
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x0 = Math.round(u * (info.width - 1));
  const y0 = Math.round((1 - v) * (info.height - 1));
  for (let y = y0 - 2; y <= y0 + 2; y++) {
    for (let x = x0 - 2; x <= x0 + 2; x++) {
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue;
      const i = (y * info.width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return [srgbToLinear(r / n), srgbToLinear(g / n), srgbToLinear(b / n)];
}

async function io() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

async function stampManifest(path, addEye) {
  const manifest = JSON.parse(await fs.readFile(path, 'utf8'));
  const body = manifest.items.body;
  if (addEye && !body.meshes.includes('HumanEyes')) body.meshes.push('HumanEyes');
  const bytes = await fs.readFile(`public${body.url}`);
  body.bytes = bytes.length;
  body.sha256 = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const reader = await io();
  const source = await reader.read(HUMAN_SOURCE);
  const eyes = source.getRoot().listNodes().find((node) => node.getName() === 'HumanEyes' && node.getMesh());
  if (!eyes) {
    throw Error('restore-eyes.mjs fits the split MakeHuman face. The playable Human is HumanV1Body; this script would write the old eye meshes onto the wrong body.');
  }
  const srcMat = eyes.getMesh().listPrimitives()[0].getMaterial();
  const iris = await extractIris(srcMat.getBaseColorTexture().getImage());
  if (!iris) console.log('photo iris missing, human falls back to a painted iris');
  const humanDoc = await reader.read(HUMAN_TARGETS[0]);
  const orcDoc = await reader.read(ORC_BODY);
  const humanTone = await lidTone(humanDoc, [-0.03, 1.65, 0.14]);
  const orcTone = await lidTone(orcDoc, [-0.049, 1.99, 0.13]);
  const humanBody = humanDoc.getRoot().listNodes().find((node) => node.getName() === 'BodyExposed').getMesh().listPrimitives()[0].getMaterial();
  const orcRough = orcDoc.getRoot().listNodes().find((node) => node.getName() === 'BodyExposed').getMesh().listPrimitives()[0].getMaterial().getRoughnessFactor();
  console.log('lid linear', humanTone.map((n) => n.toFixed(3)), orcTone.map((n) => n.toFixed(3)));
  const humanImg = paintEye(256, 'human', null, null);
  const orcImg = paintEye(256, 'amber', null, null);
  await fs.mkdir('/tmp/orc-shots', { recursive: true });
  await fs.writeFile('/tmp/orc-shots/eye-tex-human.png', humanImg.color);
  await fs.writeFile('/tmp/orc-shots/eye-tex-orc.png', orcImg.color);
  const humanPack = { ...humanImg, lid: humanTone, lidRough: humanBody.getRoughnessFactor() || 0.92 };
  const orcPack = { ...orcImg, lid: orcTone, lidRough: orcRough || 0.88 };
  for (const target of HUMAN_TARGETS) {
    const doc = target === HUMAN_TARGETS[0] ? humanDoc : await reader.read(target);
    await seat(doc, SPECS.human, humanPack);
    await fs.writeFile(target, await reader.writeBinary(doc));
  }
  await seat(orcDoc, SPECS.orc, orcPack);
  await fs.writeFile(ORC_BODY, await reader.writeBinary(orcDoc));
  await stampManifest('public/ashen-reach/equipment/manifest.json', true);
  await stampManifest('public/ashen-reach/equipment-orc/manifest.json', false);
  console.log('eyes seated');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
