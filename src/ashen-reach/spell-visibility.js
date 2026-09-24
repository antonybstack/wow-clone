/** Use Havok's actual terrain and authored solid proxies, not aggregate mesh AABBs. */
export function spellLineOfSight(player,target){
 if(!target)return {clear:false,obstacle:null};
 const p=player.body.position,from={x:p.x,y:p.y+.35,z:p.z},to={x:target.position.x,y:target.position.y+1.1,z:target.position.z};
 const hit=player.raycast(from,to);
 // Fail closed if collision queries are unavailable. Cosmetic foliage has no collider.
 if(!hit)return {clear:false,obstacle:'Collision world unavailable'};
 const clear=h=>!h.hasHit||h.body?.node?.metadata?.colliderId===target.id;
 if(clear(hit))return {clear:true,obstacle:null};
 // A nearby grave can graze the low ray even while the caster can see the
 // target's upper body. Check that direct upper-body path before rejecting.
 const upper=player.raycast(
  {x:p.x,y:p.y+.55,z:p.z},
  {x:target.position.x,y:target.position.y+1.45,z:target.position.z},
 );
 if(upper&&clear(upper))return {clear:true,obstacle:null};
 return {clear:false,obstacle:upper?.body?.node?.name||hit.body?.node?.name||'Solid obstacle'};
}
