/** The production editor drafts the single committed appearance recipe.
 * Persistence belongs to the actor transaction after a successful visual commit.
 */
import {creatorControlsForRace as legacyControls} from './contract.js';
import {APPEARANCE_REGISTRY,HUMAN_BUILD_LIMIT,validateAppearance,assertFields,DYEABLE_SLOTS} from '../appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS,findHumanIdentityPreset} from '../appearance/human-identity.js';
export function creatorControlsForRace(race) {
 const {available,unavailable}=legacyControls(race);
 return {available:available.map(c=>c.id==='build'?{...c,kind:'range',min:-HUMAN_BUILD_LIMIT,max:HUMAN_BUILD_LIMIT,default:0,axes:undefined}:c),unavailable:unavailable.map(c=>({...c,reason:`${c.label} customization is not available yet.`}))};
}

/** The actor owns visual commit and storage, just as it does for shape and dyes.
 * Undo stores component identifiers only: a later equipment, dye or shape edit
 * must survive undoing a face choice. No asset URL enters the saved recipe.
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement
 */
export function createProductionIdentitySession({getAppearance,getActorGeneration,applyIdentity,registry=APPEARANCE_REGISTRY}) {
 if(typeof getActorGeneration!=='function')throw Error('Identity editing needs the actor ownership generation');
 const lifetime=new AbortController();
 let undo=[],pending=Promise.resolve(),pendingCount=0,race=getAppearance().race;
 const generation=getActorGeneration();
 const refresh=()=>{
  if(getAppearance().race!==race||getActorGeneration()!==generation){lifetime.abort();undo=[];}
 };
 const assertOwner=()=>{refresh();lifetime.signal.throwIfAborted();};
 const commit=async(components,recordUndo=true)=>{
  refresh();const before=getAppearance();
  if(before.race!=='human')throw Error('This race has no accepted Human identity');
  const desired=validateAppearance({...before,components},registry);
  if(JSON.stringify(before.components)===JSON.stringify(desired.components))return before;
  // The actor transaction checks this signal after staging and before commit.
  // Disposing an old race's editor must not leave a queued choice able to alter
  // a later Human actor after a Human → Orc → Human round trip.
  // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted
  await applyIdentity(desired.components,{signal:lifetime.signal,throwIfStale:assertOwner});
  assertOwner();
  if(recordUndo){undo.push(before.components);if(undo.length>32)undo.shift();}
  return getAppearance();
 };
 const queue=job=>{
  pendingCount++;const run=pending.catch(()=>{}).then(()=>{assertOwner();return job();});
  pending=run.finally(()=>pendingCount--);pending.catch(()=>{});return pending;
 };
 return {
  get state(){return getAppearance();},
  get selected(){return getAppearance().race==='human'?findHumanIdentityPreset(getAppearance().components)?.id??null:null;},
  get canUndo(){refresh();return !lifetime.signal.aborted&&!pendingCount&&undo.length>0;},
  set(id){
   const preset=HUMAN_IDENTITY_PRESETS.find(p=>p.id===id);
   if(!preset)throw Error('Unknown Human identity preset');
   return queue(()=>commit(preset.id==='starter'?{}:preset.components));
  },
  undo(){return queue(async()=>{refresh();const components=undo.pop();if(!components)return getAppearance();try{return await commit(components,false);}catch(error){refresh();if(!lifetime.signal.aborted)undo.push(components);throw error;}});},
  reset(){return this.set('starter');},refresh,settled:()=>pending,
  dispose(){lifetime.abort();undo=[];},
 };
}

/** Equipment colour has its own history; skin/hair colour capabilities remain
 * unavailable. Native selects commit on change, after the player's choice,
 * rather than rebuilding a material on every pointer/preview frame.
 * https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
 */
export function createProductionDyeSession({getAppearance,applyDyes}) {
 let undo=[],pending=Promise.resolve(),pendingCount=0;
 const signature=a=>JSON.stringify([a.race,a.equipment]);
 let scope=signature(getAppearance());
 const refresh=()=>{const next=signature(getAppearance());if(next!==scope){scope=next;undo=[];}};
 const commit=async(next,recordUndo=true)=>{
  refresh();const before=getAppearance(),desired=validateAppearance({...before,dyes:next});
  if(JSON.stringify(before.dyes)===JSON.stringify(desired.dyes))return before;
  await applyDyes(desired.dyes);
  if(recordUndo){undo.push(before.dyes);if(undo.length>32)undo.shift();}
  return getAppearance();
 };
 const queue=job=>{
  pendingCount++;const run=pending.catch(()=>{}).then(job);
  pending=run.finally(()=>pendingCount--);pending.catch(()=>{});return pending;
 };
 return {
  get state(){return getAppearance();},
  get canUndo(){refresh();return pendingCount===0&&undo.length>0;},
  set(slot,id){
   if(!DYEABLE_SLOTS.includes(slot))throw Error(`No dye channel for ${slot}`);
   return queue(()=>{
    const before=getAppearance();if(!before.equipment[slot])throw Error(`No worn item in ${slot}`);
    const next={...before.dyes};if(id===null||id==='undyed')delete next[slot];else next[slot]=id;
    return commit(next);
   });
  },
  undo(){return queue(async()=>{refresh();const dyes=undo.pop();if(!dyes)return getAppearance();try{return await commit(dyes,false);}catch(e){undo.push(dyes);throw e;}});},
  reset:()=>queue(()=>commit({})),refresh,settled:()=>pending,
 };
}
export function createProductionCreatorSession({getAppearance,applyBody}) {
 let draft=getAppearance(),undo=[],pending=Promise.resolve(),pendingCount=0,error=null;
 const bodyState=a=>({schemaVersion:2,race:a.race,controls:a.race==='human'?{height:a.shape.height,build:a.shape.build}:{}});
 const commit=async(controls,recordUndo=true)=>{
  const before=getAppearance();
  if(before.race!=='human')throw Error('This race has no accepted body controls');
  const desired=validateAppearance({...before,shape:{...before.shape,...controls}});
  await applyBody(desired.shape);
  if(recordUndo){undo.push(before.shape);if(undo.length>32)undo.shift();}error=null;
  return bodyState(getAppearance());
 };
 const queue=job=>{
  pendingCount++;
  const run=pending.catch(()=>{}).then(job);
  pending=run.catch(e=>{error=e;throw e;}).finally(()=>{pendingCount--;if(!pendingCount)draft=getAppearance();});
  pending.catch(()=>{});return pending;
 };
 return {
  get state(){return bodyState(getAppearance());},get draft(){return bodyState(draft);},
  get canUndo(){return !pendingCount&&undo.length>0;},get error(){return error;},
  set(id,value){
   if(!['height','build'].includes(id))throw Error(`Unavailable body control ${id}`);
   // Exact compatibility for older capture callers. Storage migration is separately strict.
   if(id==='build'&&value&&typeof value==='object') {
    assertFields(value,['slender','stout'],'$.build',{complete:false});
    const s=value.slender??0,t=value.stout??0;
    if([s,t].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>HUMAN_BUILD_LIMIT))throw Error('Invalid legacy build axis');
    if(s>0&&t>0)throw Error('Two-axis blends are unavailable');value=t||-s||0;
   }
   const controls={...bodyState(draft).controls,[id]:value};
   draft=validateAppearance({...getAppearance(),shape:{...getAppearance().shape,...controls}});
   return queue(()=>commit(controls));
  },
  undo(){return queue(async()=>{const shape=undo.pop();if(!shape)return bodyState(getAppearance());try{return await commit({height:shape.height,build:shape.build},false);}catch(e){undo.push(shape);throw e;}});},
  reset(){draft=validateAppearance({...getAppearance(),shape:{...getAppearance().shape,height:1,build:0}});return queue(()=>commit({height:1,build:0}));},
  async save(){await pending;return getAppearance();},clear(){return this.reset();},
  settled:()=>pending,
  refresh(){draft=getAppearance();undo=[];},
 };
}
