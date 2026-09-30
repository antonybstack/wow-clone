/** Armory body editor, imported after playable. The recipe owns committed identity;
 * slider values are drafts until body and garments have committed successfully.
 */
import {creatorControlsForRace,createProductionCreatorSession} from '../character/creator/production.js';
import './creator.css';
const text=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;};
export function createCreator({armory,getAppearance,applyBody,warning=null,getWarning=()=>warning}) {
 const session=createProductionCreatorSession({getAppearance,applyBody});
 const race=getAppearance().race,{available,unavailable}=creatorControlsForRace(race);
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
 if(unavailable.length) {
  const d=text('details','creator-pending');d.append(text('summary',null,`Not available yet (${unavailable.length})`));
  for(const c of unavailable){const row=text('div','creator-pending-row');const label=text('span',null,c.label);label.setAttribute('aria-disabled','true');row.append(label,text('small',null,c.reason));d.append(row);}section.append(d);
 }
 const actions=text('div','creator-actions'),undo=text('button',null,'Undo'),reset=text('button',null,'Reset');actions.append(undo,reset);section.append(actions);
 undo.onclick=()=>run(()=>session.undo());reset.onclick=()=>run(()=>session.reset());reset.disabled=!available.length;
 panel.insertBefore(section,panel.querySelector('h2'));
 refresh();
 return {
  open:()=>armory.open(),close:()=>armory.close(),get isOpen(){return armory.isOpen;},
  get state(){return session.state;},get drivable(){return race==='human';},
  set:(id,value)=>run(()=>session.set(id,value)),undo:()=>run(()=>session.undo()),reset:()=>run(()=>session.reset()),clear:()=>run(()=>session.reset()),
  refresh:()=>{session.refresh();refresh();},save:()=>session.save(),session,element:section,
  settled:()=>pending,dispose:()=>section.remove(),
 };
}
