/**
 * Developer tools behind ?dev: unlimited health/mana, fly, click-to-teleport.
 */
import {input} from '../input.js';
import {pickTeleportSurface, teleportSurfacePosition} from './dev-surface-pick.js';
import {devDestinations, devDestinationURL} from './dev-destinations.js';

export const dev = {
  enabled: false,
  god: false,
  flying: false,
};

function paintBadge(el) {
  if (!dev.enabled) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent =
    `DEV  ${dev.god ? 'GOD' : 'mortal'}  ${dev.flying ? 'FLY' : 'walk'}  ·  G god  ·  F fly  ·  click teleport`;
}

export function attachDevTools({params, canvas, camera, player, getCombat, setView, world, rig, whenNavigation, isNavigationReady, whenRegion, isRegionReady, isAlive = () => true, onChange}) {
  // Tools bind to the existing player after first play, before the optional combat
  // imports. Read the current HUD when available rather than capturing a null one.
  const message = text => getCombat()?.hud?.message?.(text);
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
  devHelp.textContent = 'DEV MODE · G god · F fly · click a solid surface to teleport while flying';
  help?.append(devHelp);
  const paint = () => { paintBadge(badge); onChange?.(); };
  const setGod = (on) => {
    if (!dev.enabled || !isAlive()) return false;
    dev.god = !!on;
    paint();
    message(dev.god ? 'God mode on' : 'God mode off');
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
    message(dev.flying ? 'Fly on — click a solid surface to teleport' : 'Fly off');
    return true;
  };
  const destinations = devDestinations(world);
  const jumpTo = (id) => {
    if (!dev.enabled || !isAlive() || !isNavigationReady()) return false;
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
    message(`Destination: ${destination.name}`);
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
    if (isAlive() && dev.enabled && dev.flying && input.clicked) {
      const x = input.clickX;
      const y = input.clickY;
      input.clicked = false;
      if (!isNavigationReady()) {
        message('Waiting for route geometry and collision before teleporting');
        return;
      }
      setView?.('play');
      const hit = pickTeleportSurface(camera, canvas, player, x, y);
      if (!hit) {
        message('No solid surface under the cursor');
        return;
      }
      const position = teleportSurfacePosition(hit, player.capsuleHeight, player.capsuleRadius);
      if (!position) {
        message('Unable to place the player at this surface');
        return;
      }
      player.setWorldPos(position.x, position.y, position.z);
      message(`Teleported onto solid surface  ${hit.hitPoint.x.toFixed(1)}, ${hit.hitPoint.y.toFixed(1)}, ${hit.hitPoint.z.toFixed(1)}`);
    }
  };
  // Await collision readiness without extending the first-play fence. An at=
  // link is inert without ?dev, and disabling dev while loading cancels the jump.
  void whenNavigation.then(() => {
    if (!isAlive()) return;
    onChange?.();
    if (params.has('dev') && params.has('at') && dev.enabled && !jumpTo(params.get('at')))
      message('Unknown developer destination');
  }, () => { onChange?.(); });
  // Full-region readiness still owns optional foliage, texture and NPC completion.
  // Its UI refresh must not delay navigation or leak an unhandled rejection.
  void whenRegion.then(() => { onChange?.(); }, () => { onChange?.(); });
  return {dev, tick, setEnabled, setGod, setFlying, jumpTo, destinations,
    get regionCoreAvailable(){return !!world.regionCoreAvailable;},
    get regionCoreLoading(){return !!world.regionCoreLoading;},
    regionLoadingURL:id=>{
      const url=new URL(devDestinationURL(location.href,id));
      // Explicit opt-out survives reloads and shareable destination links.
      // https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/set
      url.searchParams.set('regionCore',world.regionCoreLoading?'0':'1');
      return url.href;
    },
    get navigationReady() { return isAlive() && isNavigationReady(); },
    get regionReady() { return isAlive() && isRegionReady(); },
    get regionProgress() { return world.streaming?.progress??null; },
    destinationURL: id => devDestinationURL(location.href, id)};
}
