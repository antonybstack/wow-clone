/** Nearest-rank tails for preserved requestAnimationFrame intervals.
 * Definition: https://www.itl.nist.gov/div898/handbook/prc/section2/prc262.htm
 */
export function summarizeFrameIntervals(values) {
  if (!values?.length || values.some(v=>!Number.isFinite(v) || v<=0)) throw Error('positive finite intervals required');
  const sorted=[...values].sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
  const meanMs=values.reduce((n,v)=>n+v,0)/values.length;
  return {samples:values.length,meanMs,meanFps:1000/meanMs,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:sorted.at(-1),above6_94:values.filter(v=>v>1000/144).length,above8_33:values.filter(v=>v>1000/120).length,above16_67:values.filter(v=>v>1000/60).length,above33_33:values.filter(v=>v>1000/30).length};
}
