/**
 * Developer tools behind ?dev: unlimited health/mana, fly, click-to-teleport.
 */
import {getViewProjectionMatrix, invertMat4} from '@babylonjs/lite';
import {input} from '../input.js';
import {height} from './geometry.js';
import {devDestinations, devDestinationURL} from './dev-destinations.js';

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

export function attachDevTools({params, canvas, camera, player, combat, setView, world, rig, whenRegion, isRegionReady, isAlive = () => true, onChange}) {
  const enabled = new URLSearchParams(location.search).has('dev');
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
  const paint = () => { paintBadge(badge); onChange?.(); };
  const setGod = (on) => {
    if (!dev.enabled || !isAlive()) return false;
    dev.god = !!on;
    paint();
    combat.hud?.message?.(dev.god ? 'God mode on' : 'God mode off');
    return true;
  };
  const setFlying = (on) => {
    if (!dev.enabled || !isAlive()) return false;
    setView?.('play');
    if (!!player.isFlying?.() !== !!on) {
      const p = player.body.position;
      const position = [p.x, p.y, p.z];
      player.setFlying?.(on);
      // Native fly-off grounds at terrain height. Preserve elevated floors and
      // let the existing Havok controller settle against their actual collision.
      if (!on) player.setWorldPos(...position);
    }
    dev.flying = !!player.isFlying?.();
    paint();
    combat.hud?.message?.(dev.flying ? 'Fly on — click to teleport' : 'Fly off');
    return true;
  };
  const destinations = devDestinations(world);
  const jumpTo = (id) => {
    if (!dev.enabled || !isAlive() || !isRegionReady()) return false;
    const destination = destinations.find(d => d.id === id);
    if (!destination) return false;
    if (dev.flying) setFlying(false);
    const [x, floorY, z] = destination.floor;
    // setWorldPos resets the existing controller/velocity; no second movement
    // or camera implementation is introduced for developer navigation.
    player.setWorldPos(x, floorY + player.capsuleHeight * .5 + .12, z);
    player.setFacing(destination.yaw);
    rig.yaw = destination.yaw;
    rig.pitch = .04;
    rig.distance = rig.distanceTarget = 3.5;
    setView?.('play');
    combat.hud?.message?.(`Destination: ${destination.name}`);
    return true;
  };
  const setEnabled = (on) => {
    if (!on && dev.flying) setFlying(false);
    dev.enabled = !!on;
    dev.god = !!on;
    dev.flying = false;
    devHelp.hidden = !on;
    document.body.classList.toggle('dev-mode', !!on);
    paint();
  };
  setEnabled(enabled);
  document.addEventListener('keydown', (event) => {
    if (!dev.enabled || event.repeat || document.body.classList.contains('armory-open') || document.body.classList.contains('game-menu-open') || event.target?.closest?.('input,select,textarea,[contenteditable]')) return;
    if (event.code === 'KeyG') {
      setGod(!dev.god);
    }
    if (event.code === 'KeyF') {
      setFlying(!dev.flying);
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
  // Await collision readiness without extending the first-play fence. An at=
  // link is inert without ?dev, and disabling dev while loading cancels the jump.
  void whenRegion.then(() => {
    if (!isAlive()) return;
    onChange?.();
    if (params.has('dev') && params.has('at') && dev.enabled && !jumpTo(params.get('at')))
      combat.hud?.message?.('Unknown developer destination');
  });
  return {dev, tick, setEnabled, setGod, setFlying, jumpTo, destinations,
    get regionReady() { return isAlive() && isRegionReady(); },
    destinationURL: id => devDestinationURL(location.href, id)};
}
