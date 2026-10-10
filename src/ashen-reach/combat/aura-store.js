/** Local combat auras; no saved/offline ticks. C05 Brand deliberately has no
 * fractional expiry tick. Same-caster refresh preserves cadence and carries
 * at most 30% of its base duration. All due work runs on the combat timeline.
 */
import {COMBAT_PHASE} from './event-timeline.js';
export const ASHEN_BRAND=Object.freeze({id:'ashen-brand',name:'Ashen Brand',duration:12,interval:2,damage:15,carry:.3});
export function createAuraStore({getTarget,isSourceAlive=()=>true,onTick=()=>{},onChange=()=>{},limit=64}) {
  const active=new Map();let sequence=0;
  const keyOf=a=>`${a.sourceId}\0${a.targetId}\0${a.targetGeneration}\0${a.effectId}`;
  const valid=a=>{const t=getTarget(a.targetId);return t&&t.hp>0&&!t.hidden&&(t.generation??0)===a.targetGeneration&&t.state!=='return'&&t.state!=='evading'&&isSourceAlive(a.sourceId);};
  const remove=(key,reason)=>{const a=active.get(key);if(a){active.delete(key);onChange('aura-remove',a,reason);}};
  return {
    apply({sourceId='player',targetId,targetGeneration,time,multiplier=1,effect=ASHEN_BRAND}) {
      const input={sourceId,targetId,targetGeneration,effectId:effect.id};const key=keyOf(input),existing=active.get(key),old=existing?.expiresAt>=time?existing:null;
      if(!valid(input))return {ok:false,reason:'Target is unavailable'};
      if(!old&&active.size>=limit)return {ok:false,reason:'Too many active burns'};
      const remaining=old?Math.max(0,old.expiresAt-time):0;
      const aura={...input,id:old?.id??`aura:${++sequence}`,appliedAt:time,
        expiresAt:time+effect.duration+Math.min(remaining,effect.duration*effect.carry),
        nextTickAt:old?.nextTickAt??time+effect.interval,interval:effect.interval,
        amount:effect.damage*multiplier,baseDuration:effect.duration,refreshWindow:effect.duration*effect.carry,
        tick:old?.tick??0};
      active.set(key,aura);onChange(old?'aura-refresh':'aura-apply',aura);
      return {ok:true,aura};
    },
    schedule(now,timeline) {
      for(const [key,a] of active){
        if(!valid(a)){remove(key,'Target or source unavailable');continue;}
        // Only the expiry comparison tolerates arithmetic drift. Never enqueue
        // a future deadline then remove its aura before the timeline reaches it.
        // Repeated interval addition can exceed an exact final expiry by one ulp.
        while(a.nextTickAt<=a.expiresAt+1e-8&&Math.min(a.nextTickAt,a.expiresAt)<=now){
          const time=Math.min(a.nextTickAt,a.expiresAt),tick=++a.tick;a.nextTickAt+=a.interval;
          timeline.add(time,COMBAT_PHASE.periodic,()=>{
            if(active.get(key)!==a||!valid(a))return;
            onTick(a,{time,eventId:`${a.id}:tick:${tick}`});
          });
        }
      }
    },
    expire(now){for(const [key,a] of active)if(!valid(a)||a.expiresAt<=now)remove(key,'Expired');},
    clearTarget(id){for(const [key,a] of active)if(a.targetId===id)remove(key,'Target reset');},
    clearSource(id){for(const [key,a] of active)if(a.sourceId===id)remove(key,'Source reset');},
    clear(){for(const key of [...active.keys()])remove(key,'Combat reset');},
    snapshot(now){return [...active.values()].map(a=>({...a,remaining:Math.max(0,a.expiresAt-now),refreshable:a.expiresAt-now<=a.refreshWindow}));},
    hasTarget(id){for(const a of active.values())if(a.targetId===id)return true;return false;},
    get size(){return active.size;},
  };
}
