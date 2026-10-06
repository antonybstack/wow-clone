/** Build-owned conditional preload for returning (saved-appearance) players.
 *
 * A saved player's first play waits on a serial chain: the early entry reads storage, then
 * dynamically imports the pure appearance-storage and selected-identity modules, then fetches the
 * fixed identity catalogue, and only then requests the selected body. This emits a tiny inline
 * head script that, only when one of the existing saved-appearance keys is present, adds native
 * `<link rel=modulepreload>` for those two optional modules' static graph (built Rolldown chunk
 * names, minus anything the page already preloads). Production embeds the fixed
 * catalogue as inert JSON before the early async module; other hosts retain fetch
 * fallback. Nothing comes from storage except presence; no recipe is decoded here,
 * and no body, geometry or item URL is requested. The runtime keeps its own migration,
 * validation, provenance checks and shared fetch promises.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/modulepreload
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload
 * https://vite.dev/guide/api-plugin.html#transformindexhtml
 */

import {EMBEDDED_IDENTITY_CATALOGUE_ID} from '../../src/ashen-reach/startup-fetch.js';
import {SAVED_APPEARANCE_KEYS,SAVED_APPEARANCE_BLOCKING_PARAMS} from '../../src/ashen-reach/startup-appearance.js';

export const SAVED_PRELOAD_MARKER = 'data-ashen-saved-preload';
// Raw code bytes of the extra modules; the catalogue index is a fixed small JSON.
export const MAX_SAVED_PRELOAD_CODE_BYTES = 24 * 1024;

/** Import the runtime's pure gate constants rather than parsing its source or decoding saves. */
export function startupAppearanceContract() {
    return {keys: SAVED_APPEARANCE_KEYS, blockingParams: SAVED_APPEARANCE_BLOCKING_PARAMS};
}

/** Static-import closure of the given chunks, excluding files the page already loads/preloads. */
export function savedPreloadModules(bundle, roots, alreadyLoaded) {
    const out = [], seen = new Set(), pending = [...roots].reverse();
    while (pending.length) {
        const name = pending.pop();
        if (seen.has(name)) continue;
        seen.add(name);
        const chunk = bundle[name];
        if (chunk?.type !== 'chunk') throw Error(`Saved preload: missing chunk ${name}`);
        if (!alreadyLoaded.has(name)) out.push(name);
        for (const dependency of [...(chunk.imports || [])].reverse()) pending.push(dependency);
    }
    const bytes = out.reduce((sum, name) => sum + Buffer.byteLength(bundle[name].code || ''), 0);
    if (bytes > MAX_SAVED_PRELOAD_CODE_BYTES) throw Error(`Saved preload: ${bytes} bytes exceeds ${MAX_SAVED_PRELOAD_CODE_BYTES}`);
    return {files: out, bytes};
}

const safeUrl = (url) => {
    if (!/^\/[A-Za-z0-9._~\/-]+$/.test(url)) throw Error(`Saved preload: unsafe URL ${url}`);
    return url;
};

/** Inline, self-contained gate. Storage denial or any error simply preloads nothing. */
export function savedPreloadScript({keys, blockingParams, modules, fetches}) {
    if (!keys.length) throw Error('Saved preload: no storage keys');
    const links = [...modules.map((url) => ['modulepreload', safeUrl(url), '']), ...fetches.map((url) => ['preload', safeUrl(url), 'fetch'])];
    return `<script ${SAVED_PRELOAD_MARKER}>(()=>{try{const p=new URLSearchParams(location.search);`
        + `if(p.has('legacyStart')||${JSON.stringify(blockingParams)}.some(k=>p.has(k))||!${JSON.stringify(keys)}.some(k=>localStorage.getItem(k)))return;`
        + `for(const [r,h,a] of ${JSON.stringify(links)}){const l=document.createElement('link');l.rel=r;l.href=h;if(a)l.as=a;l.crossOrigin='anonymous';document.head.appendChild(l);}`
        + `}catch{}})()</script>`;
}

/** Insert once, right after `<meta charset>` (or `<head>`), before stylesheet/module discovery. */
export function injectHeadScript(html, script) {
    if (html.includes(SAVED_PRELOAD_MARKER)) throw Error('Saved preload: already injected');
    const charset = /<meta\s+charset=[^>]*>/i.exec(html);
    const head = charset || /<head[^>]*>/i.exec(html);
    if (!head) throw Error('Saved preload: built HTML has no <head>');
    const at = head.index + head[0].length;
    const firstAsset = html.search(/<(?:script|link)\b[^>]*(?:src|href)=/i);
    if (firstAsset !== -1 && firstAsset < at) throw Error('Saved preload: an external resource precedes the insertion point');
    return html.slice(0, at) + script + html.slice(at);
}

/** Serialize sealed build data, never storage. Escaping '<' prevents HTML raw-text
 * termination even if a future catalogue label contains '</script>'. Place the
 * block after resource discovery links so its bytes do not hold up those requests.
 * https://html.spec.whatwg.org/multipage/scripting.html#the-script-element
 */
export function runtimeIdentityCatalogue(catalogue){
    // The build verifies these source-file audit hashes before generating HTML.
    // Runtime checks the aggregate SHA; the full inputs receipt remains published
    // at the standalone manifest URL. All preset/asset/coverage data stays exact.
    const {inputs,...provenance}=catalogue.provenance;
    return {...catalogue,provenance};
}
export function identityCatalogueBlock(catalogue){
    const json=JSON.stringify(catalogue).replaceAll('<','\\u003c');
    if(Buffer.byteLength(json)>96*1024)throw Error('Embedded identity catalogue exceeds 96 KiB');
    return `<script type="application/json" id="${EMBEDDED_IDENTITY_CATALOGUE_ID}">${json}</script>`;
}

/** An async module may execute before the HTML parser finishes. Move its tag
 * after the complete data block, retaining resource hints ahead of both. Fail
 * the build on a missing/duplicate tag rather than silently restoring a fetch.
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script#async
 */
export function injectIdentityCatalogue(html,catalogue,earlyScript){
    if(!earlyScript||html.split(earlyScript).length!==2)throw Error('Identity catalogue: expected one early module tag');
    if(html.split('</head>').length!==2)throw Error('Identity catalogue: expected one head end');
    if(html.includes(`id="${EMBEDDED_IDENTITY_CATALOGUE_ID}"`))throw Error('Identity catalogue: already injected');
    return html.replace(earlyScript,'').replace('</head>',`${identityCatalogueBlock(catalogue)}${earlyScript}</head>`);
}
