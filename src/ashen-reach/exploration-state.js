/** Small local expedition contract. Cosmetic knowledge is separate from XP,
 * equipment entitlements and multiplayer authority. No generic quest graph. */
export const EXPLORATION_PHASES=Object.freeze(['unstarted','inscription-read','bell-rung','relic-claimed','returned']);
export const EPISODE='vaelmark-bell-v1';
export const PHASE_DISCOVERIES=Object.freeze(['vaelmark-inscription','vaelmark-bell','vaelmark-relic','hollowmere-return']);
export const REGIONAL_DISCOVERIES=Object.freeze(['eastwatch-dispatch','eastwatch-view','westwatch-account','southwatch-account','ash-tower-view','moor-tower-view','bell-watch-view']);
export const DISCOVERY_IDS=Object.freeze([...PHASE_DISCOVERIES,...REGIONAL_DISCOVERIES]);
export const emptyExploration=()=>({version:1,episode:EPISODE,phase:'unstarted',discovered:[]});

export function validateExploration(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Error('Invalid journal record');
 const fields=Object.keys(value);
 if(fields.length!==4||fields.some(k=>!['version','episode','phase','discovered'].includes(k)))throw Error('Unknown journal fields');
 if(value.version!==1||value.episode!==EPISODE)throw Error('Unsupported journal version');
 const phase=EXPLORATION_PHASES.indexOf(value.phase);
 if(phase<0||!Array.isArray(value.discovered)||value.discovered.length>DISCOVERY_IDS.length)throw Error('Invalid journal progress');
 const ids=new Set(value.discovered);
 if(ids.size!==value.discovered.length||value.discovered.some(id=>!DISCOVERY_IDS.includes(id)))throw Error('Invalid journal discoveries');
 for(const [i,id]of PHASE_DISCOVERIES.entries())if(ids.has(id)!==(i<phase))throw Error('Journal prerequisites do not match its phase');
 return {version:1,episode:EPISODE,phase:value.phase,discovered:[...ids].sort()};
}

/** Transition is idempotent and independent of ephemeral prop animation. */
export function transitionExploration(record,action){
 const current=validateExploration(record),phase=EXPLORATION_PHASES.indexOf(current.phase);
 const actionPhase=['read-inscription','ring-bell','claim-relic','return-hollowmere'].indexOf(action);
 if(actionPhase>=0){
  if(phase!==actionPhase)return {record:current,changed:false,blocked:phase<actionPhase};
  return {record:validateExploration({...current,phase:EXPLORATION_PHASES[phase+1],discovered:[...current.discovered,PHASE_DISCOVERIES[phase]]}),changed:true,blocked:false};
 }
 if(REGIONAL_DISCOVERIES.includes(action)){
  if(current.discovered.includes(action))return {record:current,changed:false,blocked:false};
  return {record:validateExploration({...current,discovered:[...current.discovered,action]}),changed:true,blocked:false};
 }
 throw Error('Unknown exploration action');
}

export function explorationGoal(phase){
 return {
  unstarted:'Find the memorial beneath Vaelmark. Its descent begins in the west chapel.',
  'inscription-read':'Ring the west bell. Its tower door opens from the front terrace; climb and return by the same stair.',
  'bell-rung':'Return to the undercroft memorial. The bell has answered its inscription.',
  'relic-claimed':'Bring the remembrance to the altar in Hollowmere Chapel.',
  returned:'The Bell of Vaelmark is complete. Your remembrance remains in this journal.',
 }[phase];
}
