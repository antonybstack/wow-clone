/** Serial preparation bounds in-flight GPU work; only the newest selection commits. */
export function createEquipmentLoader({initial,validate,prepare,commit,maxIdle=2,beforeCommit,isReusable=()=>true}) {
    if(!Number.isSafeInteger(maxIdle)||maxIdle<0)throw RangeError('Invalid equipment idle budget');
    let selected={...initial},desired={...initial},sequence=0,disposed=false,chain=Promise.resolve();
    let status={pending:false,error:null},active=null;
    const cache=new Map(),ids=loadout=>new Set(Object.values(loadout).filter(Boolean));
    function trim(keep=ids(selected)) {
        const idle=[...cache.keys()].filter(id=>!keep.has(id));
        for(const id of idle.slice(0,Math.max(0,idle.length-maxIdle))){cache.get(id).dispose();cache.delete(id);}
    }
    function request(patch,{context}={}){
        if(disposed)return Promise.resolve({status:'disposed'});
        const next={...desired,...patch};
        try{validate(next);}catch(error){return Promise.resolve({status:'failed',error:error.message});}
        active?.abort();desired=next;const serial=++sequence;status={pending:true,error:null};
        const stale=()=>disposed||serial!==sequence;
        const run=async()=>{
            if(stale())return {status:'superseded'};
            const controller=new AbortController();active=controller;
            const replacements=new Map();
            try{
                for(const id of ids(next)){
                    if(!cache.has(id)||!isReusable(cache.get(id),id,context)){
                        const value=await prepare(id,controller.signal,context);
                        if(disposed){value.dispose();return {status:'disposed'};}
                        // A new material for a worn item is a hidden replacement, not an
                        // unequip/re-equip. Keep the committed owner through preparation,
                        // failure and the native pipeline fence, then exchange both at once.
                        // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts
                        if(cache.has(id))replacements.set(id,value);
                        else cache.set(id,value);
                    }
                    if(stale()){trim();return {status:'superseded'};}
                }
                // Optional remote material staging. The ordinary player takes
                // the existing synchronous path without an extra awaited task.
                // Cancellation must be checked after non-interruptible native
                // pipeline work, before the single visibility commit.
                // https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
                const staged=new Map([...cache,...replacements]);
                const fence=beforeCommit?.(next,staged,controller.signal,context);
                if(fence){await fence;if(stale()){trim();return {status:'superseded'};}}
                commit(next,staged,context);
                for(const [id,value]of replacements){const old=cache.get(id);cache.set(id,value);old.dispose();}
                replacements.clear();
                selected={...next};status={pending:false,error:null};trim();
                return {status:'applied'};
            }catch(error){
                trim();
                if(stale())return {status:'superseded'};
                desired={...selected};status={pending:false,error:error.message};
                return {status:'failed',error:error.message};
            }finally{for(const value of replacements.values())value.dispose();if(active===controller)active=null;}
        };
        const result=chain.then(run);chain=result.catch(()=>{});return result;
    }
    /** Explicitly invalidate an idle prepared resource. Worn resources instead
     * use the replacement transaction above and remain visible until commit. */
    function forget(id) {
        if(disposed||ids(selected).has(id)||!cache.has(id))return false;
        cache.get(id).dispose();cache.delete(id);return true;
    }
    // Actor-level body/race barriers serialize commits. A newer equipment intent
    // must still invalidate a held piece fetch before it reaches that barrier.
    // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
    function cancelPending() {
        if(disposed||!status.pending)return;
        sequence++;active?.abort();desired={...selected};status={pending:false,error:null};
    }
    return {request,forget,cancelPending,getState:()=>({...selected}),getStatus:()=>({...status,cached:[...cache.keys()],desired:{...desired}}),drain:()=>chain,
        dispose(){
            if(disposed)return;disposed=true;sequence++;active?.abort();
            const values=[...cache.values()];cache.clear();status={pending:false,error:null};
            // Keep staged mesh owners until their native material build finishes.
            // The remote actor drains this chain before retiring its shared palette.
            if(beforeCommit&&active)chain.then(()=>values.forEach(v=>v.dispose()),()=>values.forEach(v=>v.dispose()));
            else for(const value of values)value.dispose();
        },
    };
}
