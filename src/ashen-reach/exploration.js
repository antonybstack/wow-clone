import {isInputEnabled,onInputReset} from '../input.js';
import {sceneLifetime} from './scene-lifetime.js';
import {emptyExploration,transitionExploration,explorationGoal} from './exploration-state.js';
import {loadExploration,saveExploration} from './exploration-store.js';
import {JOURNAL_ENTRIES} from './exploration-content.js';

/** Called only by late createCombat. Candidate work uses its existing simulation
 * dt; activation rechecks Havok instead of trusting a cached proximity prompt.
 * https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md */
export function interactionReachable(player,anchor){
 if(!anchor||!player.getDebugState().usingPhysics)return false;
 const p=player.body.position,feet=p.y-player.capsuleHeight/2,target=anchor.interact;
 if(Math.abs(feet-anchor.standingSurfaceY)>1.2||Math.hypot(p.x-target[0],p.z-target[2])>2.5)return false;
 const hit=player.raycast({x:p.x,y:feet+player.capsuleHeight*.75,z:p.z},{x:target[0],y:target[1],z:target[2]},{ignorePlayer:true});
 return !!hit&&!hit.hasHit;
}

export function createExploration({scene,player,world,input,canvas,isNavigationReady,onOpenJournal}){
 const signal=sceneLifetime(scene),loaded=loadExploration();
 let record=loaded.record,warning=loaded.warning,sessionOnly=false,visible=true,scan=0,candidate=null,paintKey='',journalContent=null;
 const prompt=document.createElement('div');prompt.id='exploration-prompt';prompt.hidden=true;prompt.setAttribute('data-world-interaction','');
 const label=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='Read · X';
 prompt.append(label,button);document.body.append(prompt);
 const style=document.createElement('style');style.textContent=`
  #exploration-prompt{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:16px;max-width:90vw;padding:12px 18px;background:#151b17ee;border:1px solid #9b8958;color:#eadbb8;font:16px Georgia,serif}
  #exploration-prompt[hidden]{display:none}#exploration-prompt button{padding:8px 14px;color:#eadbb8;background:#383325;border:1px solid #9b8958;cursor:pointer;white-space:nowrap}
  [data-exploration-journal] h2{font:24px Georgia,serif;color:#eadbb8;margin:12px 0}[data-exploration-journal] p{line-height:1.6}[data-exploration-journal] article{border-top:1px solid #716345;padding-top:12px;margin-top:16px}[data-exploration-journal] article h3{font:19px Georgia,serif;color:#eadbb8;margin:0 0 8px}[data-exploration-journal] .journal-warning{color:#e6c182}[data-exploration-journal] .journal-goal{padding:12px;border:1px solid #716345;background:#202820}
 `;document.head.append(style);
 const clear=()=>{input.interactPressed=false;candidate=null;paintKey='';prompt.hidden=true;scan=.2;};
 const offReset=onInputReset(clear);
 const allowed=dead=>!signal.aborted&&visible&&!dead&&isInputEnabled()&&isNavigationReady()&&!document.body.classList.contains('armory-open');
 const memorial=()=>world.cathedral?.exploration?.undercroft?.memorial;
 function pick(){const anchor=memorial();return interactionReachable(player,anchor)?{id:'vaelmark-inscription',action:'read-inscription',anchor,label:'Undercroft memorial'}:null;}
 function paint(){
  const key=candidate?.id??'';if(key===paintKey)return;paintKey=key;prompt.hidden=!candidate;
  if(candidate)label.textContent=candidate.label;
 }
 function activate(dead){
  if(!allowed(dead))return false;
  candidate=pick();if(!candidate)return false;
  const next=transitionExploration(record,candidate.action);record=next.record;
  if(next.changed&&!sessionOnly){warning=saveExploration(record)?null:'Your discovery is available this session, but could not be saved. Reloading may lose it.';}
  onOpenJournal?.();return true;
 }
 button.addEventListener('click',()=>{if(allowed(false)){input.interactPressed=true;canvas.focus();}},{signal});
 function paintJournal(){
  if(!journalContent)return;
  const title=document.createElement('h2');title.textContent='The Bell of Vaelmark';
  const goal=document.createElement('p');goal.className='journal-goal';goal.textContent=explorationGoal(record.phase);
  const notice=document.createElement('p');notice.className='journal-warning';notice.hidden=!warning;notice.textContent=warning??'';notice.setAttribute('role','status');
  const articles=record.discovered.map(id=>{const item=JOURNAL_ENTRIES[id],article=document.createElement('article'),heading=document.createElement('h3'),text=document.createElement('p');heading.textContent=item.title;text.textContent=item.text;article.dataset.discovery=id;article.append(heading,text);return article;});
  journalContent.replaceChildren(title,goal,notice,...articles);
 }
 const journal={open(container){if(signal.aborted)return false;if(!journalContent){journalContent=document.createElement('div');journalContent.setAttribute('data-exploration-journal','');container.replaceChildren(journalContent);}paintJournal();return true;}};
 signal.addEventListener('abort',()=>{offReset();clear();prompt.remove();style.remove();journalContent?.remove();journalContent=null;},{once:true});
 return {
  journal,
  tick(dt,{dead=false}={}){if(!allowed(dead)){clear();return;}scan+=dt;if(scan>=.2){scan=0;candidate=pick();paint();}if(input.interactPressed){input.interactPressed=false;activate(dead);}},
  setVisible(on){visible=!!on;if(!visible)clear();},
  snapshot(){return {record:structuredClone(record),warning,sessionOnly,candidate:candidate?.id??null};},
  resetSession(){if(signal.aborted||!new URLSearchParams(location.search).has('dev'))return false;sessionOnly=true;record=emptyExploration();warning='Developer rehearsal: discoveries last until reload. Your saved journal is unchanged.';clear();paintJournal();return true;},
 };
}
