/** A bounded latest-request queue, separate from actor identity. Native glTF
 * decode cannot be interrupted midway; cancellation prevents its late commit.
 * Between preparations we use the game's RAF yield so GPU completion tasks run.
 * https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 */
export function createRequestQueue({limit=32,between=()=>Promise.resolve()}={}) {
 if(!Number.isInteger(limit)||limit<1)throw RangeError('Invalid queue limit');
 const queued=new Map(),idle=new Set();let active=null,closed=false,sequence=0,scheduled=false;
 const stats={submitted:0,superseded:0,rejected:0,peakPending:0,completed:0};
 function settleIdle(){if(!active&&!queued.size){for(const resolve of idle)resolve();idle.clear();}}
 async function pump(){
  scheduled=false;if(active||closed)return;
  const next=[...queued.values()].sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];
  if(!next){settleIdle();return;}
  queued.delete(next.id);active=next;
  try {next.resolve(await next.run(()=>!next.cancelled&&!closed));}
  catch(error){next.reject(error);}
  finally {stats.completed++;active=null;}
  if(!closed&&queued.size){try{await between();}catch(error){close(error);}schedule();}else settleIdle();
 }
 function schedule(){if(!scheduled&&!active&&!closed){scheduled=true;queueMicrotask(pump);}}
 function cancel(id){
  const pending=queued.get(id);if(pending){queued.delete(id);stats.superseded++;pending.resolve({status:'superseded'});}
  if(active?.id===id)active.cancelled=true;
  settleIdle();return Boolean(pending||active?.id===id);
 }
 function close(){closed=true;for(const id of queued.keys())cancel(id);if(active)active.cancelled=true;settleIdle();return drain();}
 function drain(){return !active&&!queued.size?Promise.resolve():new Promise(resolve=>idle.add(resolve));}
 return {
  submit(id,priority,run){
   if(closed)return Promise.resolve({status:'disposed'});
   if(!Number.isInteger(priority)||priority<0||priority>4)throw RangeError('Priority must be 0–4');
   // Reserve a slot by logical ID, including the in-flight preparation. Its
   // latest replacement can occupy that same slot while the native decode
   // drains, without rejecting the actor's newest revision or growing the map.
   const unique=queued.size+(active&&!queued.has(active.id)?1:0);
   if(!queued.has(id)&&active?.id!==id&&unique>=limit){stats.rejected++;throw RangeError('Appearance queue is full');}
   cancel(id);stats.submitted++;
   const promise=new Promise((resolve,reject)=>queued.set(id,{id,priority,run,resolve,reject,sequence:sequence++,cancelled:false}));
   stats.peakPending=Math.max(stats.peakPending,queued.size);schedule();return promise;
  },cancel,close,drain,
  reprioritize(id,priority){const request=queued.get(id);if(request)request.priority=priority;},
  snapshot(){return {...stats,pending:queued.size,active:active?1:0,uniqueIds:queued.size+(active&&!queued.has(active.id)?1:0),limit,closed};},
 };
}
