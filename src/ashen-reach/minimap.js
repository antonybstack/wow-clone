/**
 * Overlay minimap drawn from world XZ on the combat afterAnimation tick.
 * One CSS frame around a title bar and a canvas; the canvas does not stroke
 * its own border (that was the alignment miss).
 */
import { buildingPads, pathX } from "./geometry.js";

export const WORLD_BOUNDS = Object.freeze({
  minX: -88,
  maxX: 88,
  minZ: -93,
  maxZ: 143,
});

/** Backing store equals CSS pixels so the map is 1:1 inside the frame. */
const WIDTH = 128;
const HEIGHT = 148;

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
  for (let z = WORLD_BOUNDS.minZ, first = true; z <= WORLD_BOUNDS.maxZ; z += 2) {
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

  const [sx, sy] = worldToMap(0, 0);
  ctx.fillStyle = "#c4b48a";
  ctx.fillRect(sx - 1, sy - 1, 3, 3);
}

export function createMinimap({ player, enemies }) {
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

  const update = () => {
    const ctx = canvas.getContext("2d");
    ctx.drawImage(staticLayer, 0, 0);
    for (const enemy of enemies) {
      if (enemy.hidden || enemy.state === "dead" || enemy.hp <= 0) continue;
      const [u, v] = worldToMap(enemy.position.x, enemy.position.z);
      ctx.fillStyle = "#c45a38";
      ctx.beginPath();
      ctx.arc(u, v, 3, 0, Math.PI * 2);
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
