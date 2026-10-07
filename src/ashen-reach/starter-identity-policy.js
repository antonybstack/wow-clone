import {EQUIPMENT_ITEMS} from './equipment-catalog.js';
import {resolveCoverage} from './coverage-contract.js';
import {manifestBodyCoverage} from './coverage-manifest.js';

// Only this decoded/proved pair may omit the hidden hair at first play. New
// authored bodies fall back to the complete selected identity until re-proved.
// All remaining geometry, morphs, binds, scene roots, material pixels/samplers
// and 22 source curves match; texture authoring names are metadata.
// See docs/plans/character-mmo/results/startup-covered-hair-2026-10-07.md.
// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes
const PROVED_PONYTAIL='272526ffaf7c177105325b49844dff5bf84551593f6f3e1eb2632936c05b4a1a';
const PROVED_BALD='cca5feaedec0db51f4c751454ad6cd792df6fa63cebdb3f64790a3188d06bc2d';

/** Keep the saved identity intact while choosing only currently visible bytes.
 * The existing semantic coverage resolver owns the decision. The selected
 * compact body is restored through the native source transaction after play,
 * and equipment/race changes wait for that restoration before exposing hair.
 */
export function compactStarterIdentity(full, bald, loadout, deferCoveredHair) {
 const selected={...full,items:full.compactItems,fullManifest:full};
 if(!deferCoveredHair||full.identity?.preset!=='prime-ponytail'
  ||bald?.identity?.preset!=='prime-bald'
  ||full.compactItems?.body?.sha256!==PROVED_PONYTAIL
  ||bald.compactItems?.body?.sha256!==PROVED_BALD)return selected;
 const coverage=manifestBodyCoverage(full,'human');
 if(!resolveCoverage(loadout,EQUIPMENT_ITEMS,'human',coverage.bodySegments).hiddenMeshes.includes('HumanPonytail01'))return selected;
 manifestBodyCoverage({...bald,items:bald.compactItems},'human');
 return {...selected,items:{...full.compactItems,body:bald.compactItems.body},
  coverage:bald.coverage,startup:bald.startup,deferredIdentityBody:full.compactItems.body};
}
