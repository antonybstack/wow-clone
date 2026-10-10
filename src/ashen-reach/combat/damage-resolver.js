/** One runtime HP/kill mutation owner. A lethal generation is recorded before
 * callbacks, so reentrant presentation/XP cannot produce a second kill.
 * Timestamps and phase ordering belong to event-timeline, not wall-clock timers.
 */
export function createDamageResolver({getTarget,onHit=()=>{},onKill=()=>{},limit=512}) {
  const seen=new Set(),kills=new WeakMap();let sequence=0;
  return {
    resolve(command) {
      const target=getTarget(command.targetId),generation=command.targetGeneration??0;
      const fail=reason=>({ok:false,reason,target});
      if(!target||target.hp<=0||target.hidden||target.state==='return'||target.state==='evading')return fail('Target is unavailable');
      if((target.generation??0)!==generation||kills.get(target)===generation)return fail('Target has changed');
      if(!Number.isFinite(command.amount)||command.amount<=0)return fail('Invalid damage');
      const eventId=command.eventId??`damage:${++sequence}`;
      if(seen.has(eventId))return fail('Duplicate damage');
      seen.add(eventId);if(seen.size>limit)seen.delete(seen.values().next().value);
      const amount=Math.min(target.hp,command.amount);
      target.hp=Math.max(0,target.hp-amount);target.hits=(target.hits??0)+1;
      const lethal=target.hp===0;if(lethal)kills.set(target,generation);
      const event=Object.freeze({sourceId:'player',abilityId:'unknown',damageType:'fire',flags:[],...command,
        eventId,amount,lethal,targetId:target.id,targetGeneration:generation,
        position:target.position?{...target.position}:null});
      // Gameplay kill handling precedes optional visual observers.
      if(lethal)onKill(target,event);
      onHit(target,event);
      return {ok:true,damage:amount,target,event,lethal};
    },
  };
}
