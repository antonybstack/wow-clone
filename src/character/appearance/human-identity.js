/** Authored combinations, not independent age/hair sliders. Prime and Weathered
 * are distinct CC0 head presets, not a continuous ageing transform of one face.
 * The starter retains the released source's existing sculpt and fused short hair.
 * Geometry, skin and morph data will remain owned by the selected native pack:
 * https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
 * Source pins and visual review: docs/plans/character-mmo/results/m5-face-refactor-2026-10-04.md
 */
export const IDENTITY_CATALOG_VERSION='appearance-catalog-v6';
const preset=(id,label,head,hair,sourceLabel)=>Object.freeze({
 id,label,components:Object.freeze({head,hair}),sourceLabel,
});
export const HUMAN_IDENTITY_PRESETS=Object.freeze([
 preset('starter','Original adventurer','human-starter-v1','human-starter-hair-v1',null),
 preset('prime-bald','Prime · bald','human-prime-v1','human-bald-v1','young'),
 preset('prime-ponytail','Prime · ponytail','human-prime-v1','human-ponytail01-v1','young-hair'),
 preset('weathered-bald','Weathered · bald','human-weathered-v1','human-bald-v1','old'),
]);
/** Caller validates the plain record/fields first. An empty canonical component
 * record is the released starter, so migrations never silently replace its face.
 */
export function findHumanIdentityPreset(components) {
 if(Object.keys(components).length===0)return HUMAN_IDENTITY_PRESETS[0];
 return HUMAN_IDENTITY_PRESETS.find(p=>p.components.head===components.head&&p.components.hair===components.hair)??null;
}
