import {FireBlast} from './fire-blast.js';
export const LAVA_BALL=Object.freeze({name:'Lava Ball',key:2,castTime:1.5,damage:240,range:24,cooldown:6,speed:12});
const vec=p=>({x:p.x,y:p.y,z:p.z});
/** Fixed launch trajectory, swept every frame through the existing physics world. */
export class LavaBall extends FireBlast {
 constructor(){super(LAVA_BALL);this.flight=null;}
 release(args,origin){
  const reason=this.validate(args);
  if(reason){this.lastResult=reason;return {ok:false,reason};}
  const target=args.target,end={x:target.position.x,y:target.position.y+1.1,z:target.position.z};
  const length=Math.hypot(end.x-origin.x,end.y-origin.y,end.z-origin.z)||.001;
  this.flight={position:vec(origin),end,target,age:0,direction:{x:(end.x-origin.x)/length,y:(end.y-origin.y)/length,z:(end.z-origin.z)/length}};
  this.cooldown=this.config.cooldown;this.casts++;this.lastResult='released';return {ok:true};
 }
 advance(dt,raycast){
  const f=this.flight;if(!f)return null;
  f.age+=dt;const remaining=Math.hypot(f.end.x-f.position.x,f.end.y-f.position.y,f.end.z-f.position.z),step=Math.min(remaining,this.config.speed*Math.max(0,dt));
  const next={x:f.position.x+f.direction.x*step,y:f.position.y+f.direction.y*step,z:f.position.z+f.direction.z*step};
  const collision=raycast(f.position,next);
  // Missing collision data fails closed. Never tunnel through an unknown world.
  if(!collision){this.flight=null;this.lastResult='Collision world unavailable';return {ok:false,position:vec(f.position),reason:this.lastResult};}
  const own=collision.body?.node?.metadata?.colliderId===f.target.id;
  const arrived=remaining<=step+.001;
  f.position=next;
  if(collision.hasHit||arrived||f.age>4){
   this.flight=null;
   const point=collision.hasHit&&collision.hitPoint?vec(collision.hitPoint):next;
   const stillAtAim=Math.hypot(f.target.position.x-f.end.x,f.target.position.z-f.end.z)<.8;
   const hit=(collision.hasHit?own:arrived&&stillAtAim)?this.hit(f.target):{ok:false,reason:'Lava Ball struck an obstacle'};
   this.lastResult=hit.ok?'hit':hit.reason;return {...hit,position:point};
  }
  return null;
 }
}
