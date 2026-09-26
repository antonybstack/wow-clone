const TOTAL = 6;
let slowTimer;
const gameKeys = new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyC','KeyV','KeyR','KeyH','KeyG','KeyF','KeyT','Space','Escape','Digit1','Digit2','Digit3']);
function blockLoadingKeys(event) {
  const root = document.getElementById('loading');
  if (root && !root.contains(event.target) && !event.metaKey && !event.ctrlKey && !event.altKey && gameKeys.has(event.code)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

export function setLoadingStage(completed, message) {
  const root = document.getElementById('loading');
  if (!root) return;
  const value = Math.max(0, Math.min(TOTAL, completed));
  const progress = document.getElementById('loading-progress');
  progress.style.setProperty('--progress', value / TOTAL);
  progress.setAttribute('aria-valuenow', String(value));
  progress.setAttribute('aria-valuetext', `${value} of ${TOTAL} startup stages complete`);
  document.getElementById('loading-count').textContent = `${String(Math.min(value + 1, TOTAL)).padStart(2, '0')} / 06`;
  document.getElementById('loading-line').textContent = message;
}

export function beginLoading() {
  window.addEventListener('keydown', blockLoadingKeys, true);
  slowTimer = setTimeout(() => {
    const note = document.getElementById('loading-note');
    if (note) note.textContent = 'Still preparing your journey. First visits can take longer while the world downloads.';
  }, 20000);
}

export async function finishLoading() {
  clearTimeout(slowTimer);
  const root = document.getElementById('loading');
  if (root) {
    setLoadingStage(TOTAL, 'The gates are open.');
    // Present the ready, clothed player before revealing the canvas. No artificial
    // minimum loading time; only the short exit transition remains.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    root.classList.add('leaving');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(resolve => setTimeout(resolve, 350));
    root.remove();
  }
  document.body.classList.remove('is-loading');
  window.removeEventListener('keydown', blockLoadingKeys, true);
  document.body.removeAttribute('aria-busy');
  document.getElementById('renderCanvas')?.removeAttribute('inert');
}

export function failLoading(error) {
  clearTimeout(slowTimer);
  const root = document.getElementById('loading');
  if (!root) return false;
  root.classList.add('failed');
  root.setAttribute('aria-busy', 'false');
  document.body.removeAttribute('aria-busy');
  document.getElementById('loading-line').textContent = 'The gates could not open.';
  document.getElementById('loading-note').textContent = 'Something interrupted loading. Check your connection, then try again.';
  const details = document.getElementById('loading-error');
  details.hidden = false;
  details.querySelector('pre').textContent = String(error?.message || error);
  const retry = document.getElementById('loading-retry');
  retry.hidden = false;
  retry.onclick = () => location.reload();
  return true;
}

/** Show a terminal graphics failure after the startup loader has been removed. */
export function showDeviceLoss(error) {
  const root = document.getElementById('device-loss');
  if (!root || !root.hidden) return false;
  document.body.classList.remove('is-loading');
  document.body.removeAttribute('aria-busy');
  for (const sibling of document.body.children) {
    if (sibling !== root) sibling.inert = true;
  }
  const rawError = document.getElementById('error');
  if (rawError) rawError.style.display = 'none';
  root.querySelector('pre').textContent = error?.stack || String(error);
  root.hidden = false;
  const retry = root.querySelector('button');
  retry.onclick = () => location.reload();
  retry.focus();
  return true;
}
