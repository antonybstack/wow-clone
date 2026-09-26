import {
  getEffectiveAspectRatio,
  getViewMatrix,
  getViewProjectionMatrix,
  projectWorldToScreenToRef,
  resolveCameraViewport,
} from '@babylonjs/lite';

// Babylon Lite's projection handles viewport, CSS/backing scale and clip status.
// https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/54-world-screen-projection.md
export function createHudProjection(canvas, layout) {
  const point = {x: 0, y: 0, z: 0};
  const result = {x: 0, y: 0, z: 0, cssX: 0, cssY: 0, clipW: 0,
    behindCamera: false, clipped: false, offscreen: false};
  const options = {viewport: {x: 0, y: 0, width: 1, height: 1},
    backingWidth: 1, backingHeight: 1, cssWidth: 1, cssHeight: 1};
  let view, viewProjection;

  return {
    begin(camera) {
      const width = Math.max(1, canvas.width), height = Math.max(1, canvas.height);
      options.backingWidth = width;
      options.backingHeight = height;
      options.cssWidth = layout.size.width;
      options.cssHeight = layout.size.height;
      options.viewport = resolveCameraViewport(camera, width, height);
      view = getViewMatrix(camera);
      viewProjection = getViewProjectionMatrix(camera, getEffectiveAspectRatio(camera, width, height));
    },
    project(position, y) {
      point.x = position.x;
      point.y = y;
      point.z = position.z;
      projectWorldToScreenToRef(point, view, viewProjection, options, result);
      return result.clipped ? null : result;
    },
  };
}
