/** Deterministic semantic serialization. A resource-cache key must additionally include
 * asset, material and detail revisions; this recipe deliberately contains none of them.
 * JSON serialization is specified by ECMAScript, and we construct fixed property order:
 * https://tc39.es/ecma262/#sec-json.stringify
 */
import {APPEARANCE_REGISTRY, AppearanceError, MAX_APPEARANCE_BYTES, validateAppearance} from './contract.js';

const bytes=text=>new TextEncoder().encode(text).length;
export function encodeAppearance(recipe,registry=APPEARANCE_REGISTRY) {
  const text=JSON.stringify(validateAppearance(recipe,registry));
  if(bytes(text)>MAX_APPEARANCE_BYTES) throw new AppearanceError('TOO_LARGE','$','Encoded appearance exceeds 16 KiB');
  return text;
}
export function decodeAppearance(text,registry=APPEARANCE_REGISTRY) {
  if(typeof text!=='string') throw new AppearanceError('INVALID_TYPE','$','Encoded appearance must be a string');
  // UTF-16 length is a cheap lower bound on UTF-8 bytes; reject before allocating a large buffer.
  if(text.length>MAX_APPEARANCE_BYTES || bytes(text)>MAX_APPEARANCE_BYTES) throw new AppearanceError('TOO_LARGE','$','Encoded appearance exceeds 16 KiB');
  let value;
  try{value=JSON.parse(text);}catch{throw new AppearanceError('INVALID_JSON','$','Malformed appearance JSON');}
  return validateAppearance(value,registry);
}
/** Exact canonical JSON gives collision-free semantic identity within this schema version. */
export function appearanceKey(recipe,registry=APPEARANCE_REGISTRY) {
  return `appearance:${encodeAppearance(recipe,registry)}`;
}
