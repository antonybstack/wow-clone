import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
    MAX_HEADER_LINE, MAX_HEADER_RULES, appendEarlyHints, htmlStartupLinks, linkValue, parseHeaderRules,
    startupGraph, writeEarlyHints,
} from './ashen-reach/early-hints.mjs';

const chunk = (fileName, imports = [], extra = {}) => ({type: 'chunk', fileName, isEntry: false, imports, dynamicImports: [], ...extra});
const html = (body) => ({type: 'asset', fileName: 'index.html', source: `<!doctype html><head>${body}</head>`});
// Shape of the real build: two module entries sharing a startup chunk, one dynamic optional chunk,
// HTML modulepreloads for the static graph only, plus fetch preloads that must not be hinted.
function bundle(head) {
    return {
        'assets/startupPreload-a.js': chunk('assets/startupPreload-a.js', ['assets/startup-preload-b.js'], {isEntry: true}),
        'assets/ashenReach-c.js': chunk('assets/ashenReach-c.js', ['assets/startup-preload-b.js', 'assets/lite-d.js'],
            {isEntry: true, dynamicImports: ['assets/appearance-storage-e.js'], viteMetadata: {importedCss: new Set(['assets/ashen-reach-f.css'])}}),
        'assets/startup-preload-b.js': chunk('assets/startup-preload-b.js'),
        'assets/lite-d.js': chunk('assets/lite-d.js'),
        'assets/appearance-storage-e.js': chunk('assets/appearance-storage-e.js'),
        'assets/ashen-reach-f.css': {type: 'asset', fileName: 'assets/ashen-reach-f.css', source: ''},
        'index.html': html(head ?? `
<script type="module" async crossorigin src="/assets/startupPreload-a.js"></script>
<script type="module" crossorigin src="/assets/ashenReach-c.js"></script>
<link rel="modulepreload" crossorigin href="/assets/startup-preload-b.js">
<link rel="modulepreload" crossorigin href="/assets/lite-d.js">
<link rel="stylesheet" crossorigin href="/assets/ashen-reach-f.css">
<link rel="preload" href="/HavokPhysics.wasm?v=1" as="fetch" crossorigin fetchpriority="auto">
<link rel="preload" href="/ashen-reach/startup/starter/near-0123456789ab.br" as="fetch" crossorigin fetchpriority="low">
<link rel="preload" href="/meshopt_decoder.js" as="script">`),
    };
}

test('hints are the static module graph and its CSS, in document order, de-duplicated', () => {
    assert.deepEqual(startupGraph(bundle(), 'index.html'), [
        {path: '/assets/startupPreload-a.js', as: 'script'}, {path: '/assets/ashenReach-c.js', as: 'script'},
        {path: '/assets/startup-preload-b.js', as: 'script'}, {path: '/assets/lite-d.js', as: 'script'},
        {path: '/assets/ashen-reach-f.css', as: 'style'},
    ]);
});

test('dynamic optional chunks, fetch preloads and the auto-hinted decoder are excluded', () => {
    const paths = startupGraph(bundle(), 'index.html').map((x) => x.path).join(' ');
    for (const excluded of ['appearance-storage', 'HavokPhysics', 'near-', 'meshopt_decoder']) assert(!paths.includes(excluded), excluded);
});

test('drift between the HTML and its bundle graph fails instead of hinting stale files', () => {
    const missing = bundle(`<script type="module" crossorigin src="/assets/ashenReach-c.js"></script>
<link rel="modulepreload" crossorigin href="/assets/lite-d.js">`);
    assert.throws(() => startupGraph(missing, 'index.html'), /differ from its bundle graph/);
    const stale = bundle();
    stale['index.html'].source += '<link rel="modulepreload" crossorigin href="/assets/old-0.js">';
    assert.throws(() => startupGraph(stale, 'index.html'), /differ from its bundle graph/);
    const noEntry = bundle('<link rel="modulepreload" crossorigin href="/assets/lite-d.js">');
    assert.throws(() => startupGraph(noEntry, 'index.html'), /no module entry/);
    const notEntry = bundle('<script type="module" src="/assets/lite-d.js"></script>');
    assert.throws(() => startupGraph(notEntry, 'index.html'), /not a bundle entry/);
    const noCss = bundle();
    noCss['index.html'].source = noCss['index.html'].source.replace(/<link rel="stylesheet"[^>]*>/, '');
    assert.throws(() => startupGraph(noCss, 'index.html'), /missing graph-imported CSS/);
});

test('HTML parsing reads module entries, modulepreloads and stylesheets only', () => {
    assert.deepEqual(htmlStartupLinks(`<script src="/classic.js"></script><script type="module" src='/m.js'></script>
<link rel=modulepreload href=/p.js><link rel="preload" href="/x" as="fetch"><link rel="icon" href="/f.png">`),
    [{kind: 'entry', path: '/m.js'}, {kind: 'modulepreload', path: '/p.js'}]);
});

test('Link values match the CORS mode of the built tags and reject unsafe paths', () => {
    assert.equal(linkValue({path: '/assets/a-1.js', as: 'script'}), '</assets/a-1.js>; rel=preload; as=script; crossorigin=anonymous');
    for (const bad of ['assets/a.js', '/a.js>; rel=x', '/a b.js', '/a.js\nX: y']) assert.throws(() => linkValue({path: bad, as: 'script'}), /unsafe/);
});

const existing = `/*
  X-Content-Type-Options: nosniff

/
  Cache-Control: public, max-age=60, must-revalidate

# comment
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

test('existing header policies are preserved byte-for-byte and new rules are appended', () => {
    const items = startupGraph(bundle(), 'index.html');
    const out = appendEarlyHints(existing, {'/': items, '/index.html': items});
    assert(out.startsWith(existing));
    const rules = parseHeaderRules(out);
    assert.deepEqual(rules.slice(0, 3), parseHeaderRules(existing));
    const root = rules.filter((r) => r.route === '/');
    assert.equal(root.length, 2, 'Pages joins the cache rule and the Link rule for /');
    assert.equal(root[1].headers.join(', '), `Link: ${items.map(linkValue).join(', ')}`);
    assert.equal(appendEarlyHints(existing, {'/': []}), existing, 'nothing to hint leaves headers untouched');
});

test('header constraints: existing Link refused, lines bounded, rule and size limits enforced', () => {
    const items = startupGraph(bundle(), 'index.html');
    assert.throws(() => appendEarlyHints(`/\n  link: </x.js>; rel=preload; as=script\n`, {'/': items}), /already declares Link/);
    const many = Array.from({length: 40}, (_, i) => ({path: `/assets/chunk-${i}-0123456789abcdef.js`, as: 'script'}));
    const lines = appendEarlyHints('', {'/': many}).split('\n').filter((l) => l.startsWith('  Link:'));
    assert(lines.length > 1 && lines.every((l) => l.length <= MAX_HEADER_LINE), 'split across repeated Link lines');
    const huge = Array.from({length: 120}, (_, i) => ({path: `/assets/chunk-${i}-0123456789abcdef.js`, as: 'script'}));
    assert.throws(() => appendEarlyHints('', {'/': huge}), /exceed 4000 bytes/);
    const full = Array.from({length: MAX_HEADER_RULES}, (_, i) => `/r${i}\n  X: y`).join('\n');
    assert.throws(() => appendEarlyHints(full, {'/': items}), /exceed 100 rules/);
});

test('writeEarlyHints rewrites only the copied _headers in its own output directory', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ashen-early-hints-'));
    try {
        assert.equal(await writeEarlyHints(dir, bundle()), null, 'no _headers: nothing written');
        await fs.writeFile(path.join(dir, '_headers'), existing);
        const b = bundle();
        b['ashen-reach.html'] = {...b['index.html'], fileName: 'ashen-reach.html'};
        // The native root-copy plugin overwrites the built fallback index on disk.
        // Header generation must use the actual game graph at every alias.
        b['index.html'] = html('<script>location.replace("/ashen-reach.html")</script>');
        const routes = await writeEarlyHints(dir, b);
        assert.deepEqual(Object.keys(routes), ['/', '/index.html', '/ashen-reach', '/ashen-reach.html']);
        const text = await fs.readFile(path.join(dir, '_headers'), 'utf8');
        assert(text.startsWith(existing) && (text.match(/^ {2}Link: /gm) || []).length === 4);
    } finally { await fs.rm(dir, {recursive: true, force: true}); }
});
