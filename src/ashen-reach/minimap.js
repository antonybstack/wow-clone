/**
 * Overlay minimap drawn from world XZ on the combat afterAnimation tick.
 * One CSS frame around a title bar and a canvas; the canvas does not stroke
 * its own border (that was the alignment miss).
 */
import { buildingPads, pathX } from "./geometry.js";

import {REGION_BOUNDS} from './regional-terrain.js';
import {REGION_LANDMARKS,REGION_ROUTES} from './region-layout.js';
export const WORLD_BOUNDS=REGION_BOUNDS;
import {createMapTransform, paintMapStatic, paintDestinationPin, paintPlayerPin} from './map-drawing.js';
const WIDTH = 128, HEIGHT = 148;

export function createMinimap({ player, enemies, marker, destination, world, signal }) {
  const root = document.getElementById("combat");
  const wrap = document.createElement("div");
  wrap.className = "minimap";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", "Minimap");
  const title = document.createElement("div");
  title.className = "minimap-title";
  title.textContent = "MAP";
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  wrap.append(title, canvas);
  const style = document.createElement("style");
  style.textContent =
    ".minimap{position:absolute;top:14px;right:14px;z-index:9;width:130px;box-sizing:border-box;border:1px solid #3a3428;background:#100e0c;box-shadow:0 2px 10px #000000a0;padding:0;pointer-events:none}" +
    ".minimap-title{height:16px;line-height:16px;font:9px/16px monospace;letter-spacing:.14em;color:#c1c0ab;text-align:center;border-bottom:1px solid #3a3428;background:#100e0c}" +
    ".minimap canvas{display:block;width:128px;height:148px;image-rendering:pixelated;background:#10140f;vertical-align:top}";
  root.append(style, wrap);

  const staticLayer = document.createElement("canvas");
  staticLayer.width = WIDTH;
  staticLayer.height = HEIGHT;
  const staticContext = staticLayer.getContext('2d', {alpha:false});
  const ctx = canvas.getContext('2d', {alpha:false});
  let transform;
  const paintStatic = bounds => {
    transform = createMapTransform(bounds, WIDTH, HEIGHT);
    paintMapStatic(staticContext, {width:WIDTH, height:HEIGHT, transform,
      pads:buildingPads, pathX, routes:world.routes || REGION_ROUTES,
      landmarks:world.landmarks || REGION_LANDMARKS});
  };

  let mapCell='';
  const update = () => {
    const position=player.body.position,cx=Math.round(position.x/64)*64,cz=Math.round(position.z/64)*64,key=`${cx},${cz}`;
    if(key!==mapCell){mapCell=key;paintStatic({minX:cx-300,maxX:cx+300,minZ:cz-280,maxZ:cz+400});}

    ctx.drawImage(staticLayer, 0, 0);
    for (const enemy of enemies) {
      if (enemy.hidden || enemy.state === "dead" || enemy.hp <= 0) continue;
      const [u, v] = transform(enemy.position.x, enemy.position.z);
      ctx.fillStyle = enemy.nameColor || "#c45a38";
      ctx.beginPath();
      ctx.arc(u, v, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a1810";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const pin = marker?.();
    if (pin) {
      const [mx, my] = transform(pin.x, pin.z);
      ctx.fillStyle = "#ffe1a8";
      ctx.strokeStyle = "#3a2a10";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, my - 5);
      ctx.lineTo(mx + 4, my + 3);
      ctx.lineTo(mx, my + 1);
      ctx.lineTo(mx - 4, my + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    paintDestinationPin(ctx, transform, destination?.(), WIDTH, HEIGHT);
    paintPlayerPin(ctx, transform, player);
  };

  signal?.addEventListener('abort', () => {wrap.remove(); style.remove();}, {once:true});
  return {
    update,
    setVisible(v) {
      wrap.hidden = !v;
    },
    canvas,
    wrap,
  };
}
