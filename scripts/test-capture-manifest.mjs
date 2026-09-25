import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFrame, writeCaptureManifest} from './lib/capture-manifest.mjs';
function jpeg(width, height) {
  const bytes = Buffer.from([0xff,0xd8,0xff,0xc0,0,17,8,0,0,0,0,3,1,0x11,0,2,0x11,0,3,0x11,0]);
  bytes.writeUInt16BE(height,7); bytes.writeUInt16BE(width,9); return bytes;
}
test('landscape and portrait retain native frame proportions', () => {
  for (const [width,height] of [[1280,720],[390,844]]) {
    const manifest={viewport:{width,height},frames:[]};
    appendFrame(manifest,{name:'frame-00000.jpg',timestamp:1,bytes:jpeg(width,height)});
    appendFrame(manifest,{name:'frame-00001.jpg',timestamp:1.1,bytes:jpeg(width,height)});
    assert.equal(manifest.frames[0].width,width); assert.equal(manifest.frames[0].height,height);
  }
});
test('reject resize, wrong ratio, missing timestamps', () => {
  const manifest={viewport:{width:1280,height:720},frames:[]};
  appendFrame(manifest,{name:'frame-00000.jpg',timestamp:1,bytes:jpeg(1280,720)});
  assert.throws(()=>appendFrame(manifest,{name:'frame-00001.jpg',timestamp:2,bytes:jpeg(640,360)}),/dimensions changed/);
  assert.throws(()=>appendFrame({viewport:manifest.viewport,frames:[]},{name:'frame-00000.jpg',timestamp:1,bytes:jpeg(720,1280)}),/aspect ratio/);
  for(const timestamp of [undefined,NaN])
    assert.throws(()=>appendFrame(manifest,{name:'frame-00001.jpg',timestamp,bytes:jpeg(1280,720)}),/timestamp/i);
});

test('asynchronous CDP frames are ordered by capture time and duplicates retain provenance', async () => {
  const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ashen-capture-'));
  try {
    const viewport={width:1280,height:720},canvas={width:960,height:540};
    const manifest={viewport,canvas,frames:[]};
    for(const [i,timestamp] of [2,1.9,2,2.1].entries())
      appendFrame(manifest,{name:`frame-${String(i).padStart(5,'0')}.jpg`,timestamp,bytes:jpeg(1280,720)});
    await writeCaptureManifest(dir,manifest,{viewport,canvas});
    assert.deepEqual(manifest.frames.map(f=>f.timestamp),[1.9,2,2.1]);
    assert.deepEqual(manifest.frames.map(f=>f.arrivalIndex),[1,0,3]);
    assert.equal(manifest.skippedFrames.length,1); assert.equal(manifest.skippedFrames[0].arrivalIndex,2);
    assert.equal(manifest.receivedFrames,4); assert.ok(Math.abs(manifest.elapsedSeconds-.2)<1e-10);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
