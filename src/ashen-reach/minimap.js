/**
 * Overlay minimap drawn from world XZ on the combat afterAnimation tick.
 * No second camera, no second render loop, no requestAnimationFrame of its own.
 */
import { buildingPads, pathX } from "./geometry.js";

export const WORLD_BOUNDS = Object.freeze({
  minX: -88,
  maxX: 88,
  minZ: -93,
  maxZ: 143,
});

const WIDTH = 168;
const HEIGHT = 196;

function worldToMap(x, z) {
  const u =
    ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * WIDTH;
  const v =
    (1 - (z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) *
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

  ctx.fillStyle = "#3d382c";
  for (const pad of buildingPads) {
    const [u0, vNorth] = worldToMap(pad.x - pad.w / 2, pad.z + pad.d / 2);
    const [u1, vSouth] = worldToMap(pad.x + pad.w / 2, pad.z - pad.d / 2);
    ctx.fillRect(u0, vNorth, Math.max(2, u1 - u0), Math.max(2, vSouth - vNorth));
  }

  ctx.strokeStyle = "#6a6250";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let z = WORLD_BOUNDS.minZ, first = true; z <= WORLD_BOUNDS.maxZ; z += 2) {
    const [u, v] = worldToMap(pathX(z), z);
    if (first) {
      ctx.moveTo(u, v);
      first = false;
    } else ctx.lineTo(u, v);
  }
  ctx.stroke();

  ctx.strokeStyle = "#8a7a58";
  ctx.lineWidth = 1.4;
  const gateAt = (z, half) => {
    const [u0, v] = worldToMap(-half, z);
    const [u1] = worldToMap(half, z);
    ctx.beginPath();
    ctx.moveTo(u0, v);
    ctx.lineTo(u1, v);
    ctx.stroke();
  };
  gateAt(44, 8);
  gateAt(75, 14);

  const [sx, sy] = worldToMap(0, 0);
  ctx.fillStyle = "#c4b48a";
  ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);

  ctx.strokeStyle = "#3a3428";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
}

export function createMinimap({ player, enemies }) {
  const root = document.getElementById("combat");
  const wrap = document.createElement("div");
  wrap.className = "minimap";
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute("aria-label", "Minimap");
  const caption = document.createElement("span");
  caption.textContent = "MAP";
  wrap.append(canvas, caption);
  const style = document.createElement("style");
  style.textContent =
    ".minimap{position:absolute;top:16px;right:16px;z-index:9;width:168px;background:#100e0cee;border:1px solid #3a3428;box-shadow:0 2px 10px #000000a0;padding:6px 6px 4px;pointer-events:none}" +
    ".minimap canvas{display:block;width:168px;height:196px;image-rendering:pixelated;background:#10140f}" +
    ".minimap span{display:block;margin-top:4px;font:10px monospace;letter-spacing:.16em;color:#c1c0ab;text-align:center}";
  root.append(style, wrap);

  const staticLayer = document.createElement("canvas");
  staticLayer.width = WIDTH;
  staticLayer.height = HEIGHT;
  paintStatic(staticLayer.getContext("2d"));

  const update = () => {
    const ctx = canvas.getContext("2d");
    ctx.drawImage(staticLayer, 0, 0);
    for (const enemy of enemies) {
      if (enemy.hidden || enemy.state === "dead" || enemy.hp <= 0) continue;
      const [u, v] = worldToMap(enemy.position.x, enemy.position.z);
      ctx.fillStyle = "#c45a38";
      ctx.beginPath();
      ctx.arc(u, v, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a1810";
      ctx.lineWidth = 1;
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
