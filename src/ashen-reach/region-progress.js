/** Counts describe decoded ranges processed, including retry duplicates. They
 * are not compressed network bytes and do not change navigation readiness. */
export function regionProgressLabel(p) {
  switch(p?.phase){
    case 'index':return 'Reading the region index…';
    case 'surfaces':return `Preparing solid regional surfaces (${(p.encodedBytes/1e6).toFixed(1)} MB packet)…`;
    case 'supports':return 'Installing final wall and tree supports…';
    case 'detail':return 'Adding full tree detail; routes are open…';
    case 'foliage':return 'Adding grass and plants; routes are open…';
    default:return 'Finishing region details; routes are open…';
  }
}

/** Piggyback on the existing asynchronous install loop, without a timer or frame
 * hook. Always publish phase boundaries/final counts; bound intermediate DOM work. */
export function createRegionProgressReporter(publish,clock=()=>performance.now()) {
  let phase=null,last=-Infinity,completed=false;
  return value=>{
    const now=clock(),final=value.total>0&&value.processed===value.total;
    if(value.phase===phase&&((final&&completed)||(!final&&now-last<500)))return;
    phase=value.phase;last=now;completed=final;publish({...value});
  };
}
