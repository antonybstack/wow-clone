/** Cloudflare Pages Early Hints (HTTP 103) for the generic startup module graph.
 *
 * Pages turns `<link rel=preload|preconnect|modulepreload>` into Early Hints automatically, but
 * skips any element that also carries `crossorigin` or `fetchpriority`, which every built module
 * link here does. So only /meshopt_decoder.js was hinted and the startup scripts waited for the
 * HTML. This writes explicit `Link` headers into the built `_headers` instead.
 * https://developers.cloudflare.com/pages/configuration/early-hints/
 * Chrome acts on `rel=preload` and `rel=preconnect` in a 103 (not `modulepreload`). Module
 * scripts are therefore hinted as `preload; as=script; crossorigin=anonymous`, matching the CORS
 * mode of the existing `<script type=module crossorigin>`; the HTML itself is unchanged.
 * https://developer.chrome.com/docs/web-platform/early-hints
 * `_headers` limits: 100 rules, 2,000 characters per line; repeated headers join with commas.
 * https://developers.cloudflare.com/pages/configuration/headers/
 *
 * Only the static import graph of each HTML module entry (and its imported CSS) is hinted:
 * dynamic imports (optional appearance/identity/shared-region code) and fetch preloads (world
 * geometry, textures, Havok, character data) are deliberately not.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** The root-copy plugin serves this game HTML at all four routes. Use its graph,
 * not index.html's fallback-only source, which has no module entry. */
export const EARLY_HINT_ROUTES = Object.freeze({
    'ashen-reach.html': Object.freeze(['/', '/index.html', '/ashen-reach', '/ashen-reach.html']),
});
export const MAX_HEADER_LINE = 2000;
export const MAX_HEADER_RULES = 100;
// Keep the 103 small: it is sent before the HTML on every navigation.
export const MAX_LINK_BYTES = 4000;

const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([a-zA-Z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .slice(1).map(([, name, a, b, c]) => [name.toLowerCase(), a ?? b ?? c ?? '']));

/** Module entries, module preloads and stylesheets of one built HTML page, in document order. */
export function htmlStartupLinks(html) {
    const links = [];
    for (const [tag] of String(html).matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const a = attributes(tag), isScript = /^<script/i.test(tag);
        if (isScript && a.type === 'module' && a.src) links.push({kind: 'entry', path: a.src});
        else if (!isScript && a.rel === 'modulepreload' && a.href) links.push({kind: 'modulepreload', path: a.href});
        else if (!isScript && a.rel === 'stylesheet' && a.href) links.push({kind: 'stylesheet', path: a.href});
    }
    return links;
}

const fileOf = (url) => url.replace(/^\//, '').split(/[?#]/)[0];

/**
 * Ordered, de-duplicated critical startup resources for one HTML asset in a Vite/Rolldown
 * bundle. The static graph of its module entries must equal the page's entry+modulepreload
 * set, so a drift between the bundle and its HTML fails the build instead of hinting stale files.
 */
export function startupGraph(bundle, htmlFileName) {
    const asset = bundle[htmlFileName];
    if (!asset || asset.type !== 'asset') throw Error(`Early Hints: missing built ${htmlFileName}`);
    const links = htmlStartupLinks(asset.source);
    const entries = links.filter((l) => l.kind === 'entry');
    if (!entries.length) throw Error(`Early Hints: ${htmlFileName} has no module entry`);
    const seen = new Set(), css = new Set(), pending = [];
    for (const entry of entries) {
        const chunk = bundle[fileOf(entry.path)];
        if (chunk?.type !== 'chunk' || !chunk.isEntry) throw Error(`Early Hints: ${entry.path} is not a bundle entry`);
        pending.push(chunk);
    }
    while (pending.length) {
        const chunk = pending.pop();
        if (seen.has(chunk.fileName)) continue;
        seen.add(chunk.fileName);
        for (const name of chunk.viteMetadata?.importedCss || []) css.add(name);
        // Static imports only: dynamic imports are optional, deferred code.
        for (const name of chunk.imports || []) {
            const dependency = bundle[name];
            if (dependency?.type !== 'chunk') throw Error(`Early Hints: unresolved static import ${name}`);
            pending.push(dependency);
        }
    }
    const scripts = links.filter((l) => l.kind !== 'stylesheet').map((l) => fileOf(l.path));
    const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    if (!sameSet(new Set(scripts), seen)) throw Error(`Early Hints: ${htmlFileName} module links differ from its bundle graph`);
    // Stylesheets: only built CSS assets of this bundle, and every graph-imported CSS file must be one.
    const styles = new Set(links.filter((l) => l.kind === 'stylesheet' && bundle[fileOf(l.path)]?.type === 'asset'
        && fileOf(l.path).endsWith('.css')).map((l) => fileOf(l.path)));
    for (const name of css) if (!styles.has(name)) throw Error(`Early Hints: ${htmlFileName} is missing graph-imported CSS ${name}`);
    const out = [], added = new Set();
    for (const link of links) {
        const file = fileOf(link.path);
        if (added.has(file) || (link.kind === 'stylesheet' && !styles.has(file))) continue;
        added.add(file);
        out.push({path: `/${file}`, as: link.kind === 'stylesheet' ? 'style' : 'script'});
    }
    return out;
}

/** One `Link` value per resource; crossorigin matches the built tags' anonymous CORS mode. */
export function linkValue({path: url, as}) {
    if (!/^\/[A-Za-z0-9._~\/-]+$/.test(url)) throw Error(`Early Hints: unsafe path ${url}`);
    return `<${url}>; rel=preload; as=${as}; crossorigin=anonymous`;
}

/** Existing rules as {route, headers[]} (comment and blank lines ignored). */
export function parseHeaderRules(text) {
    const rules = [];
    for (const line of String(text).split(/\r?\n/)) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue;
        if (/^\s/.test(line)) {
            if (!rules.length) throw Error('_headers: header line before any path');
            rules.at(-1).headers.push(line.trim());
        } else rules.push({route: line.trim(), headers: []});
    }
    return rules;
}

/**
 * Add Early Hints to the existing rule for each route, preserving its policies. Refuses a
 * route that already declares `Link`, a line over the Pages limit, too many rules or an
 * oversized hint set rather than truncating silently.
 */
export function appendEarlyHints(existing, routeItems) {
    const rules = parseHeaderRules(existing);
    // Cloudflare constructHeaders keys its output by path: a later identical
    // path REPLACES the earlier rule, unlike distinct matching URL patterns.
    // https://github.com/cloudflare/workers-sdk/blob/main/packages/workers-shared/utils/configuration/constructConfiguration.ts
    if (new Set(rules.map(r => r.route)).size !== rules.length)
        throw Error('_headers contains duplicate route rules');
    const blocks = [];
    const insertions = new Map();
    let added = 0;
    for (const [route, items] of Object.entries(routeItems)) {
        if (!items.length) continue;
        if (rules.some((r) => r.route === route && r.headers.some((h) => /^link\s*:/i.test(h))))
            throw Error(`_headers already declares Link for ${route}`);
        const values = items.map(linkValue);
        if (Buffer.byteLength(values.join(', ')) > MAX_LINK_BYTES) throw Error(`Early Hints for ${route} exceed ${MAX_LINK_BYTES} bytes`);
        const lines = [];
        for (const value of values) {
            const last = lines.at(-1);
            if (last && `${last}, ${value}`.length <= MAX_HEADER_LINE) lines[lines.length - 1] = `${last}, ${value}`;
            else {
                const line = `  Link: ${value}`;
                if (line.length > MAX_HEADER_LINE) throw Error('Early Hints value exceeds the _headers line limit');
                lines.push(line);
            }
        }
        if (rules.some(r => r.route === route)) insertions.set(route, lines);
        else {blocks.push([route, ...lines].join('\n')); added++;}
    }
    if (rules.length + added > MAX_HEADER_RULES) throw Error(`_headers would exceed ${MAX_HEADER_RULES} rules`);
    if (!blocks.length && !insertions.size) return existing;
    const merged = String(existing).split(/\r?\n/).map(line => {
        const lines = !/^\s/.test(line) && insertions.get(line.trim());
        return lines ? [line, ...lines].join('\n') : line;
    }).join('\n');
    if (!blocks.length) return merged;
    const base = merged.endsWith('\n') ? merged : `${merged}\n`;
    return `${base}\n# Early Hints: generated at build from the startup module graph (scripts/ashen-reach/early-hints.mjs)\n${blocks.join('\n\n')}\n`;
}

/** Vite `writeBundle` step: hint every routed HTML page present in this build. */
export async function writeEarlyHints(outDir, bundle) {
    const file = path.join(outDir, '_headers');
    const existing = await fs.readFile(file, 'utf8').catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing === null) return null;
    const routeItems = {};
    for (const [html, routes] of Object.entries(EARLY_HINT_ROUTES)) {
        if (!bundle[html]) continue;
        const items = startupGraph(bundle, html);
        for (const route of routes) routeItems[route] = items;
    }
    await fs.writeFile(file, appendEarlyHints(existing, routeItems));
    return routeItems;
}
