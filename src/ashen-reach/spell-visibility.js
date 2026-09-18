/** Use Havok's actual terrain and authored solid proxies, not aggregate mesh AABBs. */
export function spellLineOfSight(player,target){
 if(!target)return {clear:false,obstacle:null};
 const p=player.body.position,from={x:p.x,y:p.y+.35,z:p.z},to={x:target.position.x,y:target.position.y+1.1,z:target.position.z};
 const hit=player.raycast(from,to);
 // Fail closed if collision queries are unavailable. Cosmetic foliage has no collider.
 if(!hit)return {clear:false,obstacle:'Collision world unavailable'};
 const ownTarget=hit.body?.node?.metadata?.colliderId===target.id;
 return {clear:!hit.hasHit||ownTarget,obstacle:hit.hasHit&&!ownTarget?hit.body?.node?.name||'Solid obstacle':null};
}
