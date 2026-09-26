import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise Lite's public facade with an in-memory GPU device. A production
// frame graph invokes the target's sync hook from its owning task's record().
globalThis.GPUTextureUsage = {RENDER_ATTACHMENT: 16, TEXTURE_BINDING: 4, COPY_SRC: 1, COPY_DST: 2};
const {
  createSurfaceRenderTargetTexture, disposeRenderTargetTexture,
  waitForGpuResourceRetirements,
} = await import('@babylonjs/lite');

test('Lite 1.31.1 surface facade follows resize and releases generations once', async () => {
  const textures = [];
  const device = {
    createTexture(descriptor) {
      const texture = {
        descriptor, destroyed: 0,
        createView() {return {texture};},
        destroy() {this.destroyed++;},
      };
      textures.push(texture);
      return texture;
    },
    createSampler() {return {};},
    queue: {onSubmittedWorkDone: () => Promise.resolve()},
  };
  const engine = {canvas: {width: 1280, height: 720}, _device: device};
  const result = createSurfaceRenderTargetTexture(engine, {
    lbl: 'ashen-contact-composite', format: 'rgba16float', samples: 1, size: engine,
  });
  const facade = result.texture;
  assert.equal(textures.length, 1);
  assert.deepEqual([facade.width, facade.height], [1280, 720]);
  assert.equal(facade.view.texture, textures[0]);

  engine.canvas.width = 913;
  engine.canvas.height = 517;
  result.rt._syncEager(engine);
  assert.equal(result.texture, facade);
  assert.equal(textures.length, 2);
  assert.deepEqual([facade.width, facade.height], [913, 517]);
  assert.equal(facade.view.texture, textures[1]);

  disposeRenderTargetTexture(result);
  disposeRenderTargetTexture(result);
  await waitForGpuResourceRetirements(engine);
  assert.deepEqual(textures.map(texture => texture.destroyed), [1, 1]);
});
