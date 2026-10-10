/** Same-frame combat deadlines. Timestamp precedes class/acceptance sequence.
 * Small bounded local encounter queue, not a second simulation or timer loop.
 * Contract: docs/plans/combat-overhaul/plan-2026-10-10.md#timing-and-action-contract
 */
export const COMBAT_PHASE = Object.freeze({interrupt:0,periodic:1,release:2,contact:3,impact:4,expiry:5});
export function createEventTimeline(limit=256) {
  const events=[];let sequence=0;
  return {
    add(time,phase,run) {
      if(!Number.isFinite(time)||typeof run!=='function')throw new TypeError('Invalid combat deadline');
      if(events.length>=limit)throw new Error('Combat event budget exceeded');
      events.push({time,phase,run,sequence:++sequence});
    },
    drain(until=Infinity) {
      let processed=0;
      while(events.length){
        if(events.length>1)events.sort((a,b)=>a.time-b.time||a.phase-b.phase||a.sequence-b.sequence);
        if(events[0].time>until)break;
        if(++processed>limit)throw new Error('Recursive combat event budget exceeded');
        events.shift().run();
      }
    },
    clear(){events.length=0;},
    get size(){return events.length;},
  };
}
