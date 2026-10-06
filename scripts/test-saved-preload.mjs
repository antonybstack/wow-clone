import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {
    MAX_SAVED_PRELOAD_CODE_BYTES, SAVED_PRELOAD_MARKER, injectHeadScript, savedPreloadModules, savedPreloadScript,
    startupAppearanceContract, injectNeutralPreload,
} from './ashen-reach/saved-preload.mjs';

import {SAVED_APPEARANCE_KEYS,SAVED_APPEARANCE_BLOCKING_PARAMS,permitsSavedAppearance} from '../src/ashen-reach/startup-appearance.js';
const contract = startupAppearanceContract();
const INDEX = '/ashen-reach/human-identity-v1/manifest.json';

test('neutral preload cannot hold saved-module discovery behind a stylesheet', () => {
    const hints = '<link rel="modulepreload" href="/engine.js">';
    const css = '<link crossorigin href="/game.css" rel="stylesheet">';
    const script = '<script>chooseNeutralPack()</script>';
    const html = `<head>${hints}${css}</head><body><!-- saved module --></body>`;
    const out = injectNeutralPreload(html, script);
    assert(out.indexOf(hints) < out.indexOf('data-ashen-neutral-preload'));
    assert(out.indexOf('data-ashen-neutral-preload') < out.indexOf(css));
    assert.equal(out.replace('<script data-ashen-neutral-preload>chooseNeutralPack()</script>', ''), html);
    assert.throws(() => injectNeutralPreload(out, script), /already injected/);
    assert.throws(() => injectNeutralPreload('<body></body>', script), /head end/);
    assert.equal(injectNeutralPreload('<head></head>', script), '<head><script data-ashen-neutral-preload>chooseNeutralPack()</script></head>');
    assert.equal(injectNeutralPreload(html, ''), html);
});

// Run the generated inline script against a minimal page: what links would it add?
function run(script, {storage = {}, search = '', denied = false} = {}) {
    const added = [];
    const body = script.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    vm.runInNewContext(body, {
        URLSearchParams, location: {search},
        localStorage: denied ? new Proxy({}, {get() { throw new Error('SecurityError'); }}) : {getItem: (k) => storage[k] ?? null},
        document: {createElement: () => ({}), head: {appendChild: (link) => added.push({...link})}},
    });
    return added;
}
const script = savedPreloadScript({...contract, modules: ['/assets/human-identity-assets-x.js', '/assets/appearance-storage-y.js'], fetches: [INDEX]});

test('build gate shares the exact runtime exports and agrees with runtime exclusions', async () => {
    assert.deepEqual(contract.keys, ['ashen.appearance.v2', 'ashen.appearance.v1', 'ashen.creator.v1']);
    assert(contract.blockingParams.includes('creator') && contract.blockingParams.includes('humanIdentity'));
    assert.equal(contract.keys, SAVED_APPEARANCE_KEYS);
    assert.equal(contract.blockingParams, SAVED_APPEARANCE_BLOCKING_PARAMS);
    for(const key of contract.blockingParams)assert.equal(permitsSavedAppearance(new URLSearchParams(key)),false);
    assert((await fs.readFile('src/ashen-reach/startup-fetch.js', 'utf8')).includes(`fetch('${INDEX}'`), 'runtime still fetches the fixed index');
});

test('each saved key alone preloads the optional modules and the fixed index', () => {
    for (const key of contract.keys) {
        assert.deepEqual(run(script, {storage: {[key]: '{}'}}), [
            {rel: 'modulepreload', href: '/assets/human-identity-assets-x.js', crossOrigin: 'anonymous'},
            {rel: 'modulepreload', href: '/assets/appearance-storage-y.js', crossOrigin: 'anonymous'},
            {rel: 'preload', href: INDEX, as: 'fetch', crossOrigin: 'anonymous'},
        ], key);
    }
    // A corrupt record is still only "present": the runtime validator decides and falls back.
    assert.equal(run(script, {storage: {'ashen.appearance.v2': 'not json'}}).length, 3);
});

test('empty or denied storage, legacy start and blocking URL params preload nothing', () => {
    const saved = {'ashen.appearance.v2': '{}'};
    assert.deepEqual(run(script), []);
    assert.deepEqual(run(script, {storage: {'unrelated': '1'}}), []);
    assert.deepEqual(run(script, {storage: saved, denied: true}), []);
    assert.deepEqual(run(script, {storage: saved, search: '?legacyStart'}), []);
    for (const param of contract.blockingParams) assert.deepEqual(run(script, {storage: saved, search: `?${param}=1`}), [], param);
});

const chunk = (fileName, imports = [], bytes = 100) => ({type: 'chunk', fileName, imports, code: 'x'.repeat(bytes)});
const bundle = {
    'assets/human-identity-assets-x.js': chunk('assets/human-identity-assets-x.js', ['assets/appearance-common-c.js', 'assets/startup-preload-s.js']),
    'assets/appearance-storage-y.js': chunk('assets/appearance-storage-y.js', ['assets/appearance-common-c.js', 'assets/codec-z.js']),
    'assets/appearance-common-c.js': chunk('assets/appearance-common-c.js'),
    'assets/startup-preload-s.js': chunk('assets/startup-preload-s.js'),
    'assets/codec-z.js': chunk('assets/codec-z.js', [], 300),
};

test('only the static graph of the optional modules, minus what the page already loads', () => {
    const roots = ['assets/human-identity-assets-x.js', 'assets/appearance-storage-y.js'];
    const loaded = new Set(['assets/appearance-common-c.js', 'assets/startup-preload-s.js']);
    assert.deepEqual(savedPreloadModules(bundle, roots, loaded),
        {files: ['assets/human-identity-assets-x.js', 'assets/appearance-storage-y.js', 'assets/codec-z.js'], bytes: 500});
    const dynamicOnly = {...bundle, 'assets/appearance-storage-y.js': {...bundle['assets/appearance-storage-y.js'], dynamicImports: ['assets/lite-runtime.js']}};
    assert(!savedPreloadModules(dynamicOnly, roots, loaded).files.includes('assets/lite-runtime.js'), 'dynamic imports are not followed');
    assert.throws(() => savedPreloadModules({}, roots, loaded), /missing chunk/);
    const huge = {...bundle, 'assets/codec-z.js': chunk('assets/codec-z.js', [], MAX_SAVED_PRELOAD_CODE_BYTES)};
    assert.throws(() => savedPreloadModules(huge, roots, loaded), /exceeds/);
});

test('generated URLs are validated and the script is injected once before any external resource', () => {
    assert.throws(() => savedPreloadScript({...contract, modules: ['/a.js"><script>'], fetches: []}), /unsafe/);
    assert.throws(() => savedPreloadScript({keys: [], blockingParams: [], modules: [], fetches: []}), /no storage keys/);
    const html = '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="x"><link rel="icon" href="/f.png"><script type="module" src="/assets/a.js"></script></head></html>';
    const out = injectHeadScript(html, script);
    assert(out.indexOf(SAVED_PRELOAD_MARKER) > out.indexOf('<meta charset') && out.indexOf(SAVED_PRELOAD_MARKER) < out.indexOf('rel="icon"'));
    assert.equal(out.replace(script, ''), html, 'nothing else changes');
    assert.throws(() => injectHeadScript(out, script), /already injected/);
    assert.throws(() => injectHeadScript('<html><body></body></html>', script), /no <head>/);
    assert.throws(() => injectHeadScript('<html><head><script src="/x.js"></script><meta charset="UTF-8"></head></html>', script), /precedes/);
});

test('embedded catalogue preserves exact data and cannot close its inert HTML block',async()=>{
    const {identityCatalogueBlock}=await import('./ashen-reach/saved-preload.mjs');
    const fixture=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
    for(const input of [fixture,{label:'</script><script>alert(1)</script>',unicode:'\u2028\u2029'}]){
        const block=identityCatalogueBlock(input);
        assert.equal((block.match(/<\/script>/g)||[]).length,1);
        assert(block.startsWith('<script type="application/json"'));
        assert.deepEqual(JSON.parse(block.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'')),input);
    }
    assert.throws(()=>identityCatalogueBlock({large:'x'.repeat(96*1024)}),/exceeds/);
});

test('production catalogue precedes async execution and follows resource discovery',async()=>{
    const {injectIdentityCatalogue}=await import('./ashen-reach/saved-preload.mjs');
    const early='<script type="module" async crossorigin src="/early.js"></script>';
    const html=`<head><meta charset="utf-8"><link rel="modulepreload" href="/main.js">${early}<link rel="preload" as="fetch" href="/world.bin"></head>`;
    const input={schema:1,presets:{},provenance:{sha256:'exact'}};
    const out=injectIdentityCatalogue(html,input,early);
    assert(out.indexOf('/world.bin')<out.indexOf('id="ashen-human-identity-catalogue"'));
    assert(out.indexOf('id="ashen-human-identity-catalogue"')<out.indexOf(early));
    assert.deepEqual(JSON.parse(out.match(/type="application\/json"[^>]*>(.*?)<\/script>/)[1]),input);
    assert.throws(()=>injectIdentityCatalogue(out,input,early),/already injected/);
    assert.throws(()=>injectIdentityCatalogue(html.replace('</head>',''),input,early),/head end/);
    assert.throws(()=>injectIdentityCatalogue(html+early,input,early),/one early module/);
    assert.equal(run(savedPreloadScript({...contract,modules:['/early.js'],fetches:[]}),{storage:{'ashen.appearance.v2':'{}'}}).filter(l=>l.as==='fetch').length,0);
});

test('runtime catalogue omits only the verified source audit list',async()=>{
    const {runtimeIdentityCatalogue}=await import('./ashen-reach/saved-preload.mjs');
    const fixture=JSON.parse(await fs.readFile('public/ashen-reach/human-identity-v1/manifest.json','utf8'));
    const original=structuredClone(fixture),runtime=runtimeIdentityCatalogue(fixture),expected=structuredClone(fixture);
    delete expected.provenance.inputs;
    assert.deepEqual(runtime,expected);assert.deepEqual(fixture,original);
    assert.equal(runtime.provenance.sha256,fixture.provenance.sha256);
    assert.deepEqual(runtime.presets,fixture.presets);
});
