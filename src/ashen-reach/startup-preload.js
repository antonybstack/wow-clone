/** Async HTML module: start validated saved-character fetches before the renderer
 * graph finishes. The game reuses these exact promises and still owns all GPU work.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#async
 */
import {loadStartupAppearance,usesHumanShapeStarter,permitsSavedAppearance} from './startup-appearance.js';
import {preloadHumanShapePack,preloadStarterCharacter} from './startup-fetch.js';
const params=new URLSearchParams(location.search);
if(import.meta.env.VITE_FAST_START==='1' && !params.has('legacyStart') && permitsSavedAppearance(params)) {
  void loadStartupAppearance(params).then(result=>{
    const appearance=result?.loaded.restored ? result.loaded.appearance : null;
    if(usesHumanShapeStarter(appearance))return preloadHumanShapePack(appearance.equipment,{compact:true});
    if(result)return preloadStarterCharacter(); // Saved neutral/race/fallback paths use this same starter in main.
  }).catch(()=>{}); // Main awaits the same task and reports an actual startup failure.
}
