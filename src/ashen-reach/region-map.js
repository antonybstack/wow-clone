/** Ordinary-play region chart, loaded with combat rather than the early menu. */
import {buildingPads, pathX} from './geometry.js';
import {createMapTransform, paintMapStatic, strokeMapRoute, paintDestinationPin, paintPlayerPin} from './map-drawing.js';

const WIDTH = 560, HEIGHT = 560;
const CORE_BOUNDS = {minX:-260, maxX:260, minZ:-250, maxZ:380};

export function createRegionMap({player, world, signal}) {
  let selectedId = null, content, canvas, ctx, staticLayer, status, clearButton;
  const transform = createMapTransform(CORE_BOUNDS, WIDTH, HEIGHT, 28);
  const selected = () => world.landmarks.find(site => site.id === selectedId) || null;

  function paint() {
    if (!canvas || signal.aborted) return;
    ctx.drawImage(staticLayer, 0, 0);
    const site = selected();
    if (site) {
      ctx.strokeStyle = '#9bdddf'; ctx.lineWidth = 3;
      strokeMapRoute(ctx, transform, site.route);
      paintDestinationPin(ctx, transform, site, WIDTH, HEIGHT);
    }
    paintPlayerPin(ctx, transform, player);
    canvas.setAttribute('aria-label', `Region map. North is up. ${site ? `${site.name} route selected.` : 'No destination selected.'} Your position is the cream arrow.`);
    const description = site ? `${site.name} selected. Follow the blue route from the central street; the diamond marks its entrance.` : 'Choose a destination to highlight its route and keep an entrance pin on the minimap.';
    if (status.textContent !== description) status.textContent = description;
    clearButton.disabled = !site;
    for (const button of content.querySelectorAll('[data-map-destination]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mapDestination === selectedId));
    }
  }

  function mount(container) {
    if (content) return;
    content = document.createElement('div'); content.className = 'region-map-content';
    canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    canvas.setAttribute('role', 'img');
    const aside = document.createElement('div'); aside.className = 'region-map-destinations';
    const list = document.createElement('div'); list.className = 'game-menu-buttons';
    list.setAttribute('role', 'group'); list.setAttribute('aria-label', 'Region destinations');
    for (const site of world.landmarks) {
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.mapDestination = site.id; button.textContent = site.name;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {selectedId = site.id; paint();}, {signal});
      list.append(button);
    }
    clearButton = document.createElement('button'); clearButton.type = 'button'; clearButton.textContent = 'Clear destination';
    clearButton.addEventListener('click', () => {selectedId = null; paint();}, {signal});
    status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'region-map-status';
    const legend = document.createElement('p'); legend.className = 'region-map-legend';
    legend.textContent = 'Cream arrow: you · Blue diamond: destination · Gold chevron on minimap: watchman';
    aside.append(list, clearButton, status, legend); content.append(canvas, aside); container.replaceChildren(content);
    // Cache static roads, buildings and labels once, and repaint only on open or
    // selection. The existing menu pauses player simulation, so no extra tick.
    // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
    staticLayer = document.createElement('canvas'); staticLayer.width = WIDTH; staticLayer.height = HEIGHT;
    paintMapStatic(staticLayer.getContext('2d', {alpha:false}), {width:WIDTH, height:HEIGHT, transform,
      pads:buildingPads, pathX, routes:world.routes, landmarks:world.landmarks, labels:true});
    ctx = canvas.getContext('2d', {alpha:false});
  }

  signal.addEventListener('abort', () => {content?.remove(); selectedId = null; content = canvas = ctx = staticLayer = status = clearButton = null;}, {once:true});
  return {
    open(container) {if (signal.aborted) return false; mount(container); paint(); return true;},
    get selected() {return selected();},
  };
}
