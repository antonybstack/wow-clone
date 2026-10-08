/** Resource context shared by native texture loading and startup transfers.
 * Keep this independent of character catalogues and renderer modules: the world
 * authoring graph also imports material definitions when baking scene geometry.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
 */
export function resourceFailure(url,operation,cause){
 return new Error(`Startup resource ${url}: ${operation} failed: ${cause?.message??String(cause)}`,{cause});
}

/** Preserve the exact native cause; reporting must not start another request. */
export async function withStartupResource(url,operation,task){
 try{return await task();}
 catch(cause){throw resourceFailure(url,operation,cause);}
}
