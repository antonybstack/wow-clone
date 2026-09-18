/** Gameplay rules are independent of rendering; damage is local until backend integration. */
export const FIRE_BLAST = Object.freeze({name:'Fire Blast',key:1,damage:120,range:20,cooldown:3});
export class FireBlast {
 constructor(config=FIRE_BLAST){this.config=config;this.cooldown=0;this.casts=0;this.lastResult='';this.resetIn=0;this.damagedTarget=null;}
 update(dt){
  this.cooldown=Math.max(0,this.cooldown-dt);
  if(this.resetIn>0){this.resetIn=Math.max(0,this.resetIn-dt);if(!this.resetIn&&this.damagedTarget){this.damagedTarget.hp=this.damagedTarget.hpMax;this.damagedTarget=null;}}
 }
 validate({target,position,grounded,hasLineOfSight=()=>true}){
  let reason='';
  if(!target)reason='Select a target · Tab';
  else if(target.hp<=0)reason='Training dummy is recovering';
  else if(!grounded)reason='Land before casting';
  else if(Math.hypot(target.position.x-position.x,target.position.z-position.z)>this.config.range)reason='Out of range · move closer';
  else if(this.cooldown>0)reason=this.config.name+' is not ready';
  else if(!hasLineOfSight())reason='Target is blocked';
  return reason;
 }
 cast(args){
  const reason=this.validate(args),target=args.target;
  this.lastResult=reason||'hit';
  if(reason)return {ok:false,reason};
  this.casts++;this.cooldown=this.config.cooldown;
  return this.hit(target);
 }
 hit(target){
  if(target.hp<=0)return {ok:false,reason:'Training dummy is recovering'};
  const damage=Math.min(target.hp,this.config.damage);
  target.hp-=damage;target.hits=(target.hits||0)+1;
  if(!target.hp){this.damagedTarget=target;this.resetIn=3;}
  return {ok:true,damage,target};
 }
}
