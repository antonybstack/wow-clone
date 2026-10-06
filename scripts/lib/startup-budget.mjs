/** Evaluate the complete declared cohort, including failed/invalid rows.
 * Measurement success and meeting a release budget are different outcomes.
 * Never replace a failed row with a successful retry in the same cohort.
 */
export function startupBudget(rows, expectedRuns, maxMs) {
  if (!Number.isInteger(expectedRuns) || expectedRuns < 1 || !Number.isFinite(maxMs) || maxMs <= 0)
    throw Error('Startup budget requires a positive run count and millisecond limit');
  const valid = rows.filter(row => !row.failed && !row.validationFailure &&
    Number.isFinite(row.playableMs) && row.playableMs >= 0);
  const times = valid.map(row => row.playableMs).sort((a,b) => a-b);
  const complete = rows.length === expectedRuns && valid.length === expectedRuns &&
    new Set(rows.map(row => row.run)).size === expectedRuns &&
    rows.every(row => Number.isInteger(row.run) && row.run >= 1 && row.run <= expectedRuns);
  const misses = times.filter(ms => ms > maxMs).length;
  return {maxMs, expectedRuns, recordedRuns:rows.length, validRuns:valid.length,
    complete, misses, p95Ms:times.length ? times[Math.ceil(times.length*0.95)-1] : null,
    worstMs:times.at(-1) ?? null, passed:complete && misses === 0};
}
