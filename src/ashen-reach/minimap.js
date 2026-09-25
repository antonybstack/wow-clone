/**
 * Overlay minimap drawn from world XZ on the combat afterAnimation tick.
 * One CSS frame around a title bar and a canvas; the canvas does not stroke
 * its own border (that was the alignment miss).
 */
import { buildingPads, pathX } from "./geometry.js";

import {REGION_BOUNDS} from './regional-terrain.js';
import {REGION_LANDMARKS,REGION_ROUTES} from './region-layout.js';
export const WORLD_BOUNDS=REGION_BOUNDS;
let viewBounds={minX:-300,maxX:300,minZ:-280,maxZ:400};

/** Backing store equals CSS pixels so the map is 1:1 inside the frame. */
const WIDTH = 128;
const HEIGHT = 148;

function worldToMap(x, z) {
  const u =
    ((x - viewBounds.minX) / (viewBounds.maxX - viewBounds.minX)) * WIDTH;
  const v =
    (1 - (z - viewBounds.minZ) / (viewBounds.maxZ - viewBounds.minZ)) *
    HEIGHT;
  return [u, v];
}

function paintStatic(ctx) {
  ctx.fillStyle = "#10140f";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const band = (z0, z1, color) => {
    const [, yNorth] = worldToMap(0, z1);
    const [, ySouth] = worldToMap(0, z0);
    ctx.fillStyle = color;
    ctx.fillRect(0, yNorth, WIDTH, Math.max(1, ySouth - yNorth));
  };
  band(-93, 0, "#0c100c");
  band(0, 40, "#161a14");
  band(40, 75, "#141812");
  band(75, 143, "#1c2016");

  ctx.fillStyle = "#5a5040";
  for (const pad of buildingPads) {
    const [u0, vNorth] = worldToMap(pad.x - pad.w / 2, pad.z + pad.d / 2);
    const [u1, vSouth] = worldToMap(pad.x + pad.w / 2, pad.z - pad.d / 2);
    ctx.fillRect(
      u0,
      vNorth,
      Math.max(5, u1 - u0),
      Math.max(5, vSouth - vNorth),
    );
  }

  ctx.strokeStyle = "#6a6250";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let z = -95, first = true; z <= 145; z += 2) {
    const [u, v] = worldToMap(pathX(z), z);
    if (first) {
      ctx.moveTo(u, v);
      first = false;
    } else ctx.lineTo(u, v);
  }
  ctx.stroke();

  ctx.strokeStyle = "#8a7a58";
  ctx.lineWidth = 1;
  const gateAt = (z, half) => {
    const [u0, v] = worldToMap(-half, z);
    const [u1] = worldToMap(half, z);
    ctx.beginPath();
    ctx.moveTo(u0 + 0.5, v + 0.5);
    ctx.lineTo(u1 + 0.5, v + 0.5);
    ctx.stroke();
  };
  gateAt(44, 8);
  gateAt(75, 14);

  ctx.strokeStyle='#8b8069';ctx.lineWidth=1;
  for(const route of REGION_ROUTES){ctx.beginPath();route.points.forEach((p,i)=>{const [x,y]=worldToMap(p[0],p[2]);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}
  const bridgeStart=worldToMap(0,145),bridgeEnd=worldToMap(0,298);ctx.beginPath();ctx.moveTo(...bridgeStart);ctx.lineTo(...bridgeEnd);ctx.stroke();
  for(const site of REGION_LANDMARKS){const [x,y]=worldToMap(site.x,site.z);ctx.fillStyle=site.kind==='cathedral'?'#eee0be':'#c4ad7c';ctx.fillRect(x-2,y-2,4,4);ctx.font='8px monospace';ctx.fillText(site.kind==='keep'?site.name[0]:site.kind==='chapel'?'+':site.kind==='cathedral'?'V':'T',x+4,y+3);}
  const [sx, sy] = worldToMap(0, 0);
  ctx.fillStyle = "#c4b48a";
  ctx.fillRect(sx - 1, sy - 1, 3, 3);
}

export function createMinimap({ player, enemies, marker }) {
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
  paintStatic(staticLayer.getContext("2d"));

  let mapCell='';
  const update = () => {
    const position=player.body.position,cx=Math.round(position.x/64)*64,cz=Math.round(position.z/64)*64,key=`${cx},${cz}`;
    if(key!==mapCell){mapCell=key;viewBounds={minX:cx-300,maxX:cx+300,minZ:cz-280,maxZ:cz+400};paintStatic(staticLayer.getContext('2d'));}

    const ctx = canvas.getContext("2d");
    ctx.drawImage(staticLayer, 0, 0);
    for (const enemy of enemies) {
      if (enemy.hidden || enemy.state === "dead" || enemy.hp <= 0) continue;
      const [u, v] = worldToMap(enemy.position.x, enemy.position.z);
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
      const [mx, my] = worldToMap(pin.x, pin.z);
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
    const pos = player.body.position;
    const [u, v] = worldToMap(pos.x, pos.z);
    ctx.save();
    ctx.translate(u, v);
    ctx.rotate(-player.getFacing());
    ctx.fillStyle = "#ead1b5";
    ctx.strokeStyle = "#100e0c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.6, 5.5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.6, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  return {
    update,
    setVisible(v) {
      wrap.hidden = !v;
    },
    canvas,
    wrap,
  };
}
