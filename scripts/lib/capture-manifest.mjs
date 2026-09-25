import fs from 'node:fs/promises';

export function jpegDimensions(bytes) {
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error('Capture frame is not JPEG');
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
      return {width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3)};
    if (length < 2) break;
    offset += length;
  }
  throw new Error('JPEG frame dimensions missing');
}

export function appendFrame(manifest, {name, timestamp, bytes}) {
  if (!Number.isFinite(timestamp)) throw new Error('Capture timestamp missing');
  const dimensions = jpegDimensions(bytes), previous = manifest.frames.at(-1);
  if (previous && (previous.width !== dimensions.width || previous.height !== dimensions.height))
    throw new Error('Capture frame dimensions changed during recording');
  if (dimensions.width * manifest.viewport.height !== dimensions.height * manifest.viewport.width)
    throw new Error('Source frame aspect ratio differs from the capture viewport');
  manifest.frames.push({name, timestamp, arrivalIndex: manifest.frames.length, ...dimensions});
  return true;
}

export async function captureSurface(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas'), rect = canvas.getBoundingClientRect();
    return {viewport: {width: innerWidth, height: innerHeight}, devicePixelRatio,
      canvas: {width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height}};
  });
}

export async function writeCaptureManifest(dir, manifest, endSurface) {
  if (manifest.frames.length < 2) throw new Error('At least two timestamped capture frames required');
  if (JSON.stringify(manifest.viewport) !== JSON.stringify(endSurface.viewport) ||
      JSON.stringify(manifest.canvas) !== JSON.stringify(endSurface.canvas))
    throw new Error('Capture viewport or canvas changed during recording');
  // JPEG compression completes asynchronously: CDP arrival order can differ from
  // capture order, especially on uncapped renderers. Preserve both in the manifest.
  const received = manifest.frames.length;
  manifest.frames.sort((a, b) => a.timestamp - b.timestamp || a.arrivalIndex - b.arrivalIndex);
  manifest.reorderedFrames = manifest.frames.filter((frame, i) => frame.arrivalIndex !== i).length;
  const ordered = [];
  for (const frame of manifest.frames) {
    if (ordered.at(-1)?.timestamp === frame.timestamp) {
      (manifest.skippedFrames ||= []).push({name: frame.name, timestamp: frame.timestamp, arrivalIndex: frame.arrivalIndex, reason: 'duplicate'});
    } else ordered.push(frame);
  }
  manifest.frames.splice(0, manifest.frames.length, ...ordered);
  manifest.receivedFrames = received;
  const frames = manifest.frames, lines = ['ffconcat version 1.0'];
  frames.forEach((frame, i) => {
    if (!/^frame-\d+\.jpg$/.test(frame.name)) throw new Error('Unsafe capture frame name');
    lines.push(`file 'frames/${frame.name}'`, 'option framerate 1000');
    if (frames[i + 1]) lines.push(`duration ${frames[i + 1].timestamp - frame.timestamp}`);
  });
  manifest.elapsedSeconds = frames.at(-1).timestamp - frames[0].timestamp;
  manifest.sourceFrame = {width: frames[0].width, height: frames[0].height};
  manifest.encoded = null;
  await fs.writeFile(`${dir}/frames.ffconcat`, lines.join('\n') + '\n');
  await fs.writeFile(`${dir}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
}
