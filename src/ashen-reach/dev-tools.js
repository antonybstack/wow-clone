/**
 * Developer tools behind ?dev: unlimited health/mana, fly, click-to-teleport.
 */
import {getViewProjectionMatrix, invertMat4} from '@babylonjs/lite';
import {input} from '../input.js';
import {height} from './geometry.js';

export const dev = {
  enabled: false,
  god: false,
  flying: false,
};

function unproject(inv, ndcX, ndcY, depth) {
  const x = inv[0] * ndcX + inv[4] * ndcY + inv[8] * depth + inv[12];
  const y = inv[1] * ndcX + inv[5] * ndcY + inv[9] * depth + inv[13];
  const z = inv[2] * ndcX + inv[6] * ndcY + inv[10] * depth + inv[14];
  const w = inv[3] * ndcX + inv[7] * ndcY + inv[11] * depth + inv[15];
  const invW = 1 / w;
  return [x * invW, y * invW, z * invW];
}

function screenRay(camera, canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.clientWidth;
  const heightPx = rect.height || canvas.clientHeight;
  if (!width || !heightPx) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const vp = getViewProjectionMatrix(camera, width / heightPx);
  const inv = invertMat4(vp);
  if (!inv) return null;
  const ndcX = (2 * x) / width - 1;
  const ndcY = 1 - (2 * y) / heightPx;
  const near = unproject(inv, ndcX, ndcY, 1);
  const far = unproject(inv, ndcX, ndcY, 0);
  const dx = far[0] - near[0];
  const dy = far[1] - near[1];
  const dz = far[2] - near[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-8) return null;
  return {
    origin: near,
    direction: [dx / len, dy / len, dz / len],
    length: len,
  };
}

function pickGround(camera, canvas, clientX, clientY) {
  const ray = screenRay(camera, canvas, clientX, clientY);
  if (!ray) return null;
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.direction;
  const max = Math.min(ray.length, 900);
  const step = 2.4;
  let prevY = oy;
  let prevG = height(ox, oz);
  let prevAbove = prevY >= prevG - 0.02;
  for (let t = step; t <= max; t += step) {
    const px = ox + dx * t;
    const py = oy + dy * t;
    const pz = oz + dz * t;
    const g = height(px, pz);
    const above = py >= g - 0.02;
    if (prevAbove && !above) {
      const span = (prevY - prevG) - (py - g) || 1;
      const u = Math.min(1, Math.max(0, (prevY - prevG) / span));
      const x = px - dx * step * (1 - u);
      const z = pz - dz * step * (1 - u);
      return {x, y: height(x, z), z};
    }
    prevY = py;
    prevG = g;
    prevAbove = above;
  }
  return null;
}

function paintBadge(el) {
  if (!dev.enabled) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent =
    `DEV  ${dev.god ? 'GOD' : 'mortal'}  ${dev.flying ? 'FLY' : 'walk'}  ·  G god  ·  F fly  ·  click teleport`;
}

export function attachDevTools({params, canvas, camera, player, combat, setView}) {
  const enabled = params.has('dev');
  dev.enabled = enabled;
  dev.god = enabled;
  dev.flying = false;
  const badge = document.createElement('div');
  badge.id = 'dev-badge';
  badge.hidden = true;
  Object.assign(badge.style, {
    position: 'fixed',
    top: '44px',
    left: '14px',
    zIndex: '12',
    pointerEvents: 'none',
    color: '#ead1b5',
    background: '#181511cc',
    border: '1px solid #9b7650',
    padding: '4px 8px',
    font: '11px monospace',
    letterSpacing: '0.04em',
    textShadow: '0 1px 3px #000',
  });
  document.body.append(badge);
  paintBadge(badge);
  const help = document.getElementById('help');
  const devHelp = document.createElement('span');
  devHelp.className = 'help-dev';
  devHelp.textContent = 'DEV MODE · G god · F fly · click teleport while flying';
  help?.append(devHelp);
  const setEnabled = (on) => {
    if (!on && dev.flying) player.setFlying?.(false);
    dev.enabled = !!on;
    dev.god = !!on;
    dev.flying = false;
    devHelp.hidden = !on;
    document.body.classList.toggle('dev-mode', !!on);
    paintBadge(badge);
  };
  setEnabled(enabled);
  document.addEventListener('keydown', (event) => {
    if (!dev.enabled || event.repeat || document.body.classList.contains('armory-open')) return;
    if (event.code === 'KeyG') {
      dev.god = !dev.god;
      paintBadge(badge);
      combat.hud?.message?.(dev.god ? 'God mode on' : 'God mode off');
    }
    if (event.code === 'KeyF') {
      setView?.('play');
      player.setFlying?.(!player.isFlying?.());
      dev.flying = !!player.isFlying?.();
      paintBadge(badge);
      combat.hud?.message?.(dev.flying ? 'Fly on — click to teleport' : 'Fly off');
    }
  });
  const tick = () => {
    if (dev.enabled && dev.flying && input.clicked) {
      const x = input.clickX;
      const y = input.clickY;
      input.clicked = false;
      setView?.('play');
      const hit = pickGround(camera, canvas, x, y);
      if (!hit) {
        combat.hud?.message?.('No ground under the cursor');
        return;
      }
      const hover = player.capsuleHeight * 0.5 + (dev.flying ? 1.2 : 0);
      player.setWorldPos(hit.x, hit.y + hover, hit.z);
      combat.hud?.message?.(`Teleported  ${hit.x.toFixed(1)}, ${hit.z.toFixed(1)}`);
    }
  };
  return {dev, tick, setEnabled};
}
