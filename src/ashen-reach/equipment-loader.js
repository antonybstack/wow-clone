/** Serial preparation bounds in-flight GPU work; only the newest selection commits. */
export function createEquipmentLoader({initial,validate,prepare,commit,maxIdle=2}) {
    let selected={...initial},desired={...initial},sequence=0,disposed=false,chain=Promise.resolve();
    let status={pending:false,error:null},active=null;
    const cache=new Map(),ids=loadout=>new Set(Object.values(loadout).filter(Boolean));
    function trim(keep=ids(selected)) {
        const idle=[...cache.keys()].filter(id=>!keep.has(id));
        for(const id of idle.slice(0,Math.max(0,idle.length-maxIdle))){cache.get(id).dispose();cache.delete(id);}
    }
    function request(patch){
        if(disposed)return Promise.resolve({status:'disposed'});
        const next={...desired,...patch};
        try{validate(next);}catch(error){return Promise.resolve({status:'failed',error:error.message});}
        active?.abort();desired=next;const serial=++sequence;status={pending:true,error:null};
        const stale=()=>disposed||serial!==sequence;
        const run=async()=>{
            if(stale())return {status:'superseded'};
            const controller=new AbortController();active=controller;
            try{
                for(const id of ids(next)){
                    if(!cache.has(id)){
                        const value=await prepare(id,controller.signal);
                        if(disposed){value.dispose();return {status:'disposed'};}
                        cache.set(id,value);
                    }
                    if(stale()){trim();return {status:'superseded'};}
                }
                commit(next,cache);
                selected={...next};status={pending:false,error:null};trim();
                return {status:'applied'};
            }catch(error){
                trim();
                if(stale())return {status:'superseded'};
                desired={...selected};status={pending:false,error:error.message};
                return {status:'failed',error:error.message};
            }finally{if(active===controller)active=null;}
        };
        const result=chain.then(run);chain=result.catch(()=>{});return result;
    }
    return {request,getState:()=>({...selected}),getStatus:()=>({...status,cached:[...cache.keys()],desired:{...desired}}),
        dispose(){if(disposed)return;disposed=true;sequence++;active?.abort();for(const value of cache.values())value.dispose();cache.clear();status={pending:false,error:null};},
    };
}
