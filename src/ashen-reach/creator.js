/** Armory body editor, imported after playable. The recipe owns committed identity;
 * slider values are drafts until body and garments have committed successfully.
 */
import {creatorControlsForRace,createProductionCreatorSession,createProductionDyeSession,createProductionIdentitySession} from '../character/creator/production.js';
import {APPEARANCE_REGISTRY} from '../character/appearance/contract.js';
import {HUMAN_IDENTITY_PRESETS} from '../character/appearance/human-identity.js';
import {DYE_IDS,DYE_PALETTE} from './dye-palette.js';
import './creator.css';
const text=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
export function createCreator({armory,getAppearance,getActorGeneration,applyIdentity,applyBody,applyDyes,warning=null,getWarning=()=>warning}) {
 const session=createProductionCreatorSession({getAppearance,applyBody});
 const race=getAppearance().race,{available,unavailable}=creatorControlsForRace(race);
 const identitySession=race==='human'&&applyIdentity?createProductionIdentitySession({getAppearance,getActorGeneration,applyIdentity}):null;
 const panel=document.querySelector('#armory .armory-panel');
 if(!panel)throw Error('Body editing needs the Armory panel');
 const section=text('section','creator-section');section.append(text('h2',null,'Body'));
 const status=text('p','armory-note',getWarning());status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=!getWarning();section.append(status);
 const fields=text('div','creator-fields');section.append(fields);
 const inputs=new Map();let pending=Promise.resolve(),serial=0;
 const setStatus=s=>{status.textContent=s||'';status.hidden=!s;};
 const refresh=()=>{
  for(const [id,{input,output}] of inputs){const n=session.state.controls[id];input.value=String(n);output.textContent=` ${Number(n).toFixed(2)}`;}
  undo.disabled=!session.canUndo;
 };
 const run=op=>{
  const version=++serial;setStatus('Preparing your character…');
  try {pending=Promise.resolve(op()).then(()=>{if(version===serial){refresh();setStatus(getWarning());}},e=>{if(version===serial){refresh();setStatus(`Could not apply that change. Your character is unchanged. ${e.message}`);}throw e;});}
  catch(e){pending=Promise.reject(e);setStatus(`Could not apply that change. ${e.message}`);refresh();}
  pending.catch(()=>{});return pending;
 };
 for(const c of available) {
  const field=text('label','creator-field'),label=text('span',null,c.id==='build'?'Build · slender to stout':c.label),output=text('output',null,'');label.append(output);
  const input=document.createElement('input');input.type='range';input.min=c.min;input.max=c.max;input.step=c.step;input.setAttribute('aria-label',c.label);
  input.oninput=()=>run(()=>session.set(c.id,Number(input.value)));
  field.append(label,input);fields.append(field);inputs.set(c.id,{input,output});
 }
 if(!available.length)fields.append(text('p','armory-note',`Body adjustment is not available for ${race} yet.`));
 const pendingControls=identitySession?unavailable.filter(c=>!['age','hair'].includes(c.id)):unavailable;
 if(pendingControls.length) {
  const d=text('details','creator-pending');d.append(text('summary',null,`Not available yet (${pendingControls.length})`));
  for(const c of pendingControls){const row=text('div','creator-pending-row');const label=text('span',null,c.label);label.setAttribute('aria-disabled','true');row.append(label,text('small',null,c.reason));d.append(row);}section.append(d);
 }
 const actions=text('div','creator-actions'),undo=text('button',null,'Undo'),reset=text('button',null,'Reset');actions.append(undo,reset);section.append(actions);
 undo.onclick=()=>run(()=>session.undo());reset.onclick=()=>run(()=>session.reset());reset.disabled=!available.length;
 panel.insertBefore(section,panel.querySelector('h2'));
 let identitySection=null,refreshIdentity=()=>{};
 if(identitySession){
  identitySection=text('section','creator-section creator-identity');identitySection.append(text('h2',null,'Identity'));
  identitySection.append(text('p','armory-note','Prime and Weathered are distinct faces with authored hairstyles.'));
  const label=text('label','creator-field');label.append(text('span',null,'Face and hair'));
  const select=document.createElement('select');select.setAttribute('aria-label','Face and hair');
  for(const preset of HUMAN_IDENTITY_PRESETS){const option=text('option',null,preset.label);option.value=preset.id;select.append(option);}label.append(select);identitySection.append(label);
  const message=text('p','armory-note');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.hidden=true;identitySection.append(message);
  const actions=text('div','creator-actions'),undoIdentity=text('button',null,'Undo identity'),resetIdentity=text('button',null,'Original face');actions.append(undoIdentity,resetIdentity);identitySection.append(actions);
  refreshIdentity=()=>{select.value=identitySession.selected;undoIdentity.disabled=!identitySession.canUndo;resetIdentity.disabled=select.value==='starter';};
  const runIdentity=async job=>{
   message.textContent='Preparing identity…';message.hidden=false;select.disabled=undoIdentity.disabled=resetIdentity.disabled=true;
   try{await job();message.textContent=getWarning()||'';message.hidden=!message.textContent;}
   catch(error){message.textContent=`Your identity is unchanged. ${error.message}`;}
   finally{select.disabled=false;refreshIdentity();refresh();refreshDyes();}
  };
  select.onchange=()=>runIdentity(()=>identitySession.set(select.value));undoIdentity.onclick=()=>runIdentity(()=>identitySession.undo());resetIdentity.onclick=()=>runIdentity(()=>identitySession.reset());
  section.before(identitySection);refreshIdentity();
 }
 const dyeSession=applyDyes?createProductionDyeSession({getAppearance,applyDyes}):null;
 let dyeSection=null,refreshDyes=()=>{};
 if(dyeSession){
  dyeSection=text('section','creator-section creator-dyes');dyeSection.append(text('h2',null,'Equipment colours'));
  dyeSection.append(text('p','armory-note','Choose a tint for a worn piece. Undyed restores its original colour.'));
  const dyeStatus=text('p','armory-note');dyeStatus.setAttribute('role','status');dyeStatus.setAttribute('aria-live','polite');dyeStatus.hidden=true;dyeSection.append(dyeStatus);
  const fields=text('div','creator-fields');dyeSection.append(fields);
  const dyeInputs=new Map(),labels={helmet:'Head',torso:'Torso',legs:'Legs',boots:'Boots',gloves:'Gloves',shoulders:'Shoulders'};
  const controls=text('div','creator-actions'),undoDye=text('button',null,'Undo colour'),resetDye=text('button',null,'Reset colours');controls.append(undoDye,resetDye);
  const runDye=async job=>{
   dyeStatus.textContent='Preparing colour…';dyeStatus.hidden=false;
   for(const select of dyeInputs.values())select.disabled=true;
   undoDye.disabled=resetDye.disabled=true;
   try{await job();dyeStatus.textContent=getWarning()||'';dyeStatus.hidden=!dyeStatus.textContent;}
   catch(error){dyeStatus.textContent=`Your colour is unchanged. ${error.message}`;}
   finally{refreshDyes();}
  };
  for(const slot of APPEARANCE_REGISTRY.profiles[race].capabilities.dyes){
   const field=text('label','creator-field');field.append(text('span',null,labels[slot]));
   const select=document.createElement('select');select.dataset.dye=slot;select.setAttribute('aria-label',`${labels[slot]} colour`);
   for(const id of DYE_IDS){const option=text('option',null,DYE_PALETTE[id].name);option.value=id;select.append(option);}
   select.onchange=()=>runDye(()=>dyeSession.set(slot,select.value));
   field.append(select);fields.append(field);dyeInputs.set(slot,select);
  }
  refreshDyes=()=>{
   dyeSession.refresh();const a=getAppearance();
   for(const [slot,select]of dyeInputs){select.value=a.dyes[slot]||'undyed';select.disabled=!a.equipment[slot];select.parentElement.hidden=!a.equipment[slot];}
   undoDye.disabled=!dyeSession.canUndo;resetDye.disabled=!Object.keys(a.dyes).length;
  };
  undoDye.onclick=()=>runDye(()=>dyeSession.undo());resetDye.onclick=()=>runDye(()=>dyeSession.reset());
  dyeSection.append(controls);section.after(dyeSection);refreshDyes();
 }
 refresh();
 return {
  open:()=>armory.open(),close:()=>armory.close(),get isOpen(){return armory.isOpen;},
  get state(){return session.state;},get drivable(){return race==='human';},
  set:(id,value)=>run(()=>session.set(id,value)),undo:()=>run(()=>session.undo()),reset:()=>run(()=>session.reset()),clear:()=>run(()=>session.reset()),
  refresh:()=>{session.refresh();refresh();},save:()=>session.save(),session,element:section,
  refreshEquipment:()=>{refreshDyes();refreshIdentity();},dyes:dyeSession,identity:identitySession,
  settled:async()=>{await pending;await dyeSession?.settled();await identitySession?.settled();},dispose:()=>{identitySession?.dispose();section.remove();identitySection?.remove();dyeSection?.remove();},
 };
}
