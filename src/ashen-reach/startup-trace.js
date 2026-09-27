/**
 * One timeline for startup, recorded unconditionally.
 *
 * The marks used to be gated behind `?startupMarks`, which made every
 * measurement conditional on the measurer remembering a query parameter. The
 * failure is silent: `measure-startup.mjs` asserts the stage spans are finite,
 * but a probe that forgets the flag just reports the coarse numbers and looks
 * fine. Forty `performance.mark` calls cost microseconds in total against a
 * startup measured in seconds, so there is nothing to gate.
 *
 * Marks are also kept in a plain array. `performance.getEntriesByType('mark')`
 * is the usual way to read them, but the buffer is shared with anything else on
 * the page and its ordering guarantees are weaker than "the order I recorded
 * them in", which is exactly what a startup timeline is.
 *
 * Existing mark names are contract. `docs/baselines/` holds committed JSON keyed
 * by `begin`, `world-start`, `first-gpu-completed` and the rest, and
 * `measure-startup.mjs` computes its stage table from those names; renaming one
 * silently turns a stage into `null`. Add names, do not rename them.
 */
const PREFIX = 'ashen-startup-';
const marks = [];

/** Record one instant. Returns its time so callers can do their own arithmetic. */
export function startupMark(name) {
  const at = performance.now();
  marks.push({name, at});
  // performance.mark throws on a duplicate name only for the legacy two-argument
  // form; the one-argument form appends. A startup that somehow marks twice
  // should still produce a timeline rather than an exception.
  try { performance.mark(`${PREFIX}${name}`); } catch { /* timeline only */ }
  return at;
}

/**
 * Bracket an awaited phase with `<name>-start` / `<name>-end`.
 *
 * The end mark is in a `finally` so a phase that throws still leaves a closing
 * boundary: a startup failure at 4.2 s is far easier to read against the stage
 * that was open at the time than against a timeline that simply stops.
 */
export async function startupSpan(name, work) {
  startupMark(`${name}-start`);
  try {
    return await work();
  } finally {
    startupMark(`${name}-end`);
  }
}

/** The timeline in record order. A copy, so a caller cannot corrupt it. */
export function startupMarks() {
  return marks.map(entry => ({...entry}));
}

/** `{name: milliseconds}` for the whole timeline. */
export function startupTimings() {
  return Object.fromEntries(marks.map(entry => [entry.name, entry.at]));
}

/**
 * Elapsed time between two marks, or null when either is missing.
 *
 * Null rather than 0 or NaN on purpose: "this stage did not run" and "this stage
 * took no time" are different claims, and a stage table full of zeros reads as
 * the second when it means the first.
 */
export function startupSpanMs(start, end) {
  const from = marks.find(entry => entry.name === start);
  const to = marks.findLast(entry => entry.name === end);
  return from && to ? to.at - from.at : null;
}
