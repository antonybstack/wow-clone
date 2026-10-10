/** A small shared binding table for native keys, action-bar labels and settings.
 * Uses physical KeyboardEvent.code, matching existing movement controls:
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 * Reserved movement/menu/developer keys cannot become conflicting combat binds.
 */
export const ACTION_BINDING_DEFAULTS = Object.freeze({1:'Digit1',2:'Digit2',3:'Digit3',4:'Digit4',5:'Digit5',attack:'KeyT'});
export const ACTION_BINDING_KEYS = Object.freeze([...Array.from({length:10},(_,n)=>`Digit${n}`),'KeyT','KeyJ','KeyK','KeyL','KeyY','KeyZ']);
export const bindingLabel = code => code?.replace(/^Digit|^Key/, '') || '—';
const STORAGE_KEY = 'ashen-action-bindings-v1';
export function createActionBindings(storage) {
  let values = {...ACTION_BINDING_DEFAULTS};
  const listeners = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    const candidate = {...values, ...saved};
    if (Object.keys(candidate).length === Object.keys(values).length &&
        Object.values(candidate).every(code=>ACTION_BINDING_KEYS.includes(code)) &&
        new Set(Object.values(candidate)).size === Object.keys(values).length) values=candidate;
  } catch {} // A broken or unavailable preference must not block starting play.
  const changed = () => {
    let saved = !!storage?.setItem;
    try { storage?.setItem(STORAGE_KEY,JSON.stringify(values)); } catch { saved=false; }
    for (const notify of listeners) notify();
    return {ok:true,saved};
  };
  return {
    key: action => values[action],
    action(code) {
      // Numpad aliases follow the same digit, including after a rebind.
      code = code.replace(/^Numpad([0-9])$/, 'Digit$1');
      return Object.keys(values).find(action=>values[action]===code) ?? null;
    },
    set(action, code) {
      if (!Object.hasOwn(ACTION_BINDING_DEFAULTS,action) || !ACTION_BINDING_KEYS.includes(code)) return {ok:false,reason:'Choose an available combat key'};
      const conflict = Object.keys(values).find(id=>id!==String(action)&&values[id]===code);
      if (conflict) return {ok:false,reason:`${bindingLabel(code)} is already assigned to ${conflict==='attack'?'Attack':`spell ${conflict}`}`};
      values[action]=code; return changed();
    },
    reset() { values={...ACTION_BINDING_DEFAULTS}; return changed(); },
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); },
  };
}
let storage;
try { storage=globalThis.localStorage; } catch {}
export const actionBindings = createActionBindings(storage);
