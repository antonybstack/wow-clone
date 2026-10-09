import { buildChurchyard } from "./scene.js";
import { partitionWorld } from "./world-partition.js";
import { generateFoliagePlacements, bucketFoliagePlacements } from "./foliage.js";
import { createFoliageDensity } from "./foliage-density.js";

// Bound transferred-but-not-installed data. Native postMessage transfers buffer
// ownership; eight credits avoid queueing the full region on the main thread.
// https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
let credits = 8,
  resume = null,
  started = false;
self.onmessage = ({ data }) => {
  if (data.ack) {
    credits++;
    resume?.();
    resume = null;
    return;
  }
  if (data.start && !started) {
    started = true;
    void generate(data);
  }
};
async function generate({foliageOnly=false,metadata}={}) {
  try {
    let data;
    if(foliageOnly){
      // Optional grass retry must not rebuild geometry or re-close safe routes.
      data={metadata,batches:[]};
    }else{
    data = partitionWorld(
      await buildChurchyard(null, null, { dataOnly: true }),
    );
    const { batches, ...header } = data;
    self.postMessage({ header });
    for (const batch of batches) {
      if (batch.initial) continue;
      while (credits === 0)
        await new Promise((resolve) => {
          resume = resolve;
        });
      credits--;
      self.postMessage(
        { batch },
        Object.values(batch.buffers).map((a) => a.buffer),
      );
    }
    // Messages from this worker retain order. Geometry readiness can therefore
    // drain every previously transferred chunk before opening physical routes,
    // while the worker continues its independent grass-placement job.
    // https://html.spec.whatwg.org/multipage/web-messaging.html#message-ports
    self.postMessage({ geometryDone: true });
    }
    const placements = await generateFoliagePlacements({
      lights: data.metadata.lights,
      density: createFoliageDensity(data.metadata.extraFootprints),
      landmarks: [
        [-3.1, -2, 1.45],
        [3.1, -2.1, 1.5],
        [-3, 4, 1.3],
        [4, 9, 1.15],
        [-4, 12, 1.55],
      ].map(([x, z, scale]) => ({ x, z, scale })),
    });
    const foliage=bucketFoliagePlacements(placements);
    self.postMessage(
      { foliage },
      Object.values(foliage).flatMap(p=>p.tiles.flatMap(tile=>[tile.matrices.buffer,tile.colors.buffer])),
    );
    self.postMessage({ done: true });
  } catch (error) {
    self.postMessage({ error: error?.stack || String(error) });
  }
}
