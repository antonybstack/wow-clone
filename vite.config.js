import {verifyProductionHumanShapes} from './scripts/character-assets/verify-production-human-shapes.mjs';
import {verifyStartupAssets} from './scripts/ashen-reach/startup-provenance.mjs';
import { defineConfig } from "vite";
import {readFileSync,createReadStream,statSync} from 'node:fs';

const pages = process.env.ASHEN_PAGES === "1";
const humanShapeManifest=JSON.parse(readFileSync('public/ashen-reach/human-shape-v1/manifest.json','utf8'));
const starterBuild=process.env.VITE_FAST_START!=='0';
const starterWorldManifest=starterBuild?JSON.parse(readFileSync('public/ashen-reach/startup/starter/manifest.json','utf8')):null;
const starterCharacterManifest=starterBuild?JSON.parse(readFileSync('public/ashen-reach/startup/character/manifest.json','utf8')):null;

function humanShapeAsset(req,res,next) {
  const name=/^\/__human_shape__\/(human-shape-family-v1\.glb)$/.exec(req.url?.split('?')[0]||'')?.[1];
  if(!name) return next();
  const file=`.cache/character-mmo/m004/${name}`;
  try {
    const info=statSync(file);
    res.setHeader('Content-Type','model/gltf-binary');
    res.setHeader('Content-Length',String(info.size));
    createReadStream(file).pipe(res);
  } catch {res.statusCode=404;res.end('Run node scripts/character-assets/build-human-shape-family.mjs');}
}

function garmentFitAsset(req,res,next) {
  const name=/^\/__garment_fit__\/([A-Za-z0-9._-]+\.(?:glb|json))$/.exec(req.url?.split('?')[0]||'')?.[1];
  if(!name) return next();
  const file=`.cache/character-mmo/m005/${name}`;
  try {
    const info=statSync(file);
    res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'model/gltf-binary');
    res.setHeader('Content-Length',String(info.size));
    createReadStream(file).pipe(res);
  } catch {res.statusCode=404;res.end('Run node scripts/character-assets/build-garment-shape-family.mjs');}
}

function humanHairAsset(req,res,next) {
  const name=/^\/__human_hair__\/(human-ponytail01-tail-shape-family-candidate\.glb)$/.exec(req.url?.split('?')[0]||'')?.[1];
  if(!name) return next();
  const file=`.cache/character-mmo/m006/${name}`;
  try {
    const info=statSync(file);
    res.setHeader('Content-Type','model/gltf-binary');
    res.setHeader('Content-Length',String(info.size));
    createReadStream(file).pipe(res);
  } catch {res.statusCode=404;res.end('Run node scripts/character-assets/assemble-long-hair-candidate.mjs ponytail01-tail shape-family');}
}

function humanHeadAsset(req,res,next) {
  const name=/^\/__human_head__\/(human-old-bald-[A-Za-z0-9._-]+\.glb)$/.exec(req.url?.split('?')[0]||'')?.[1];
  if(!name) return next();
  const file=`.cache/character-mmo/m006/${name}`;
  try {
    const info=statSync(file);
    res.setHeader('Content-Type','model/gltf-binary');
    res.setHeader('Content-Length',String(info.size));
    createReadStream(file).pipe(res);
  } catch {res.statusCode=404;res.end('Run node scripts/character-assets/match-old-head-atlas.mjs');}
}

function starterBrotliHeaders(req,res,next) {
  if (/^\/ashen-reach\/startup\/starter\/near-[a-f0-9]{12}\.br(?:\?|$)/.test(req.url||'')) {
    res.setHeader('Content-Encoding','br');res.setHeader('Content-Type','application/octet-stream');
  }
  next();
}

function coveragePilotAsset(req,res,next){
  const name=/^\/__coverage_pilot__\/((?:(?:human|undead)|(?:human|orc|undead)-(?:wayfarerTrousers|graveweaverSkirt))\.glb|(?:human|orc|undead)-manifest\.json)$/.exec(req.url?.split('?')[0]||'')?.[1];
  if(!name)return next();
  try{const file=`.cache/character-mmo/coverage-pilot/${name}`,info=statSync(file);res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'model/gltf-binary');res.setHeader('Content-Length',String(info.size));createReadStream(file).pipe(res);}
  catch{res.statusCode=404;res.end('Run node scripts/character-assets/prepare-coverage-pilot.mjs');}
}

export default defineConfig({
  define:{
    'import.meta.env.VITE_HUMAN_SHAPE_SOURCE':JSON.stringify(process.env.NODE_ENV==='production'?humanShapeManifest.provenance.sha256:''),
    'import.meta.env.VITE_FAST_START':JSON.stringify(starterBuild?'1':'0'),
    // Immutable bundles reject a newer deployment's mutable manifest instead
    // of mixing old worker generation with new prepared geometry/materials.
    'import.meta.env.VITE_STARTER_WORLD_SOURCE':JSON.stringify(process.env.NODE_ENV==='production'&&starterBuild?starterWorldManifest.provenance.sha256:''),
    'import.meta.env.VITE_STARTER_CHARACTER_SOURCE':JSON.stringify(process.env.NODE_ENV==='production'&&starterBuild?starterCharacterManifest.provenance.sha256:''),
  },
  worker: { format: 'es' },
  publicDir: process.env.ASHEN_PUBLIC_DIR || "public",
  build: {
    sourcemap: !pages,
    rollupOptions: {
      // Measured cold startup otherwise discovers PBR/shadow modules through
      // several serial 40 ms requests. Compare this native bundler grouping with
      // the split build; it changes packaging, not Lite's runtime implementation.
      // https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup
      output: {codeSplitting:{groups:[
        ...(process.env.ASHEN_LITE_BUNDLE!=='0'?[{name:'lite-runtime',test:/node_modules\/@babylonjs\/lite\//,includeDependenciesRecursively:false}]:[]),
        // Vite's shared preload helper otherwise lands inside the Lite chunk,
        // making a pure dynamic storage import wait for the entire renderer.
        {name:'module-preload',test:/vite\/preload-helper/,priority:100,includeDependenciesRecursively:false},
        // Keep the early entry self-contained; otherwise its tiny shared helper
        // requests queue behind Lite and recreate the serial discovery delay.
        {name:'startup-bootstrap',test:/src\/ashen-reach\/startup-(?:preload|fetch|appearance)\.js$/,includeDependenciesRecursively:false},
        {name:'appearance-storage',test:/src\/character\/appearance\//,includeDependenciesRecursively:false},
      ]}},
      input: pages
        ? { index: "index.html", ashenReach: "ashen-reach.html", startupPreload: "src/ashen-reach/startup-preload.js" }
        : { index: "index.html", ashenReach: "ashen-reach.html", startupPreload: "src/ashen-reach/startup-preload.js", characterLab: "character-lab.html", bodyPreview: "body-preview.html", characterCrowdProbe: "character-crowd-probe.html" },
    },
  },
  optimizeDeps: {
    // Lazy networking still needs stable dev prebundles: discovering it during
    // a two-client check otherwise reloads every connected game page.
    // This affects development optimization, not production startup imports.
    // https://vite.dev/config/dep-optimization-options.html#optimizedeps-include
    include: ["@babylonjs/havok", "@colyseus/schema", "@colyseus/sdk"],
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.ASHEN_VITE_PORT) || 5173,
    strictPort: true,
    // Captures and generated baseline HTML are artifacts, not application
    // entries. Watching them can reload every owned live-check client.
    // https://vite.dev/config/server-options.html#server-watch
    watch: {ignored: ['**/.cache/**', '**/ve-capture/**', '**/docs/baselines/**']},
  },
  plugins: [
    // Local audited pilot only; no preview middleware or public asset publication.
    {name:'dev-coverage-pilot',configureServer(server){server.middlewares.use(coveragePilotAsset);}},
    {name: "verify-prepared-startup", async buildStart(){if(starterBuild)await verifyStartupAssets();await verifyProductionHumanShapes();}},
    {
      // Separate bundler entry: Vite merges two ordinary HTML module scripts into
      // one renderer entry, which defeats starting saved-appearance fetches early.
      // https://vite.dev/guide/build.html#multi-page-app
      // https://rolldown.rs/reference/Interface.Plugin#generatebundle
      name: 'early-saved-character',
      transformIndexHtml(html,ctx) {
        return ctx.server ? html.replace('<!-- ASHEN_STARTUP_PRELOAD -->','<script type="module" async src="/src/ashen-reach/startup-preload.js"></script>') : html;
      },
      generateBundle: {order:'post',handler(_options,bundle) {
        const entry=Object.values(bundle).find(item=>item.type==='chunk'&&item.isEntry&&item.facadeModuleId?.endsWith('/src/ashen-reach/startup-preload.js'));
        if(!entry)throw Error('Missing early saved-character entry');
        const pending=[entry],seen=new Set();
        while(pending.length) {
          const chunk=pending.pop();if(seen.has(chunk.fileName))continue;seen.add(chunk.fileName);
          if(Object.keys(chunk.modules).some(id=>id.includes('/node_modules/@babylonjs/lite/')||id.includes('/src/character/appearance/')))throw Error('Early character entry eagerly imports optional renderer/storage code');
          for(const name of chunk.imports){const dependency=bundle[name];if(dependency?.type==='chunk')pending.push(dependency);}
        }
        const chunks=Object.values(bundle).filter(item=>item.type==='chunk');
        for(const file of ['startup-fetch.js','startup-appearance.js','startup-preload.js']) {
          const owners=chunks.filter(chunk=>Object.keys(chunk.modules).some(id=>id.endsWith(`/src/ashen-reach/${file}`)));
          if(owners.length!==1||owners[0]!==entry)throw Error(`Early/main startup must share one ${file} module`);
        }
        if(starterBuild&&(!entry.code.includes(starterCharacterManifest.provenance.sha256)||!entry.code.includes(humanShapeManifest.provenance.sha256)))throw Error('Early shared loader lost its compiled provenance guards');
        const main=chunks.find(chunk=>chunk.isEntry&&chunk.name==='ashenReach');
        if(!main)throw Error('Missing normal game entry');
        const mainPending=[main],mainSeen=new Set();
        while(mainPending.length) {
          const chunk=mainPending.pop();if(mainSeen.has(chunk.fileName))continue;mainSeen.add(chunk.fileName);
          if(Object.keys(chunk.modules).some(id=>id.includes('/src/character/appearance/')))throw Error('Unsaved default startup eagerly imports optional appearance storage');
          if(Object.keys(chunk.modules).some(id=>id.includes('/node_modules/@colyseus/')||id.includes('/src/character/region-crowd/')))
            throw Error('Normal startup eagerly imports optional shared-region dependencies');
          for(const name of chunk.imports){const dependency=bundle[name];if(dependency?.type==='chunk')mainPending.push(dependency);}
        }
        for(const item of Object.values(bundle))if(item.type==='asset'&&item.fileName.endsWith('.html')) {
          item.source=String(item.source).replace('<!-- ASHEN_STARTUP_PRELOAD -->',`<script type="module" async crossorigin src="/${entry.fileName}"></script>`);
        }
      }},
    },
    {
      name: 'dev-only-crowd-probe-assets',
      configureServer(server) {
        server.middlewares.use((req,res,next)=>{
          const match=/^\/__(crowd_probe|region_crowd)__\/(human-(?:wayfarer|warden)\.glb|manifest\.json|prepared\.json|vat-[a-f0-9]{64}\.bin)$/.exec(req.url?.split('?')[0]||'');
          if(!match) return next();
          const name=match[2],folder=match[1]==='region_crowd'?'region-crowd':'m003';
          const file=`.cache/character-mmo/${folder}/${name}`;
          try {
            const info=statSync(file);
            res.setHeader('Content-Type',name.endsWith('.json')?'application/json':'model/gltf-binary');
            res.setHeader('Content-Length',String(info.size));
            createReadStream(file).pipe(res);
          } catch {res.statusCode=404;res.end('Run node scripts/character-assets/prepare-crowd-probe.mjs');}
        });
      },
    },
    {
      // M004 Human shape family candidate. Developer asset under .cache/, deliberately
      // outside public/ so it cannot reach the Pages bundle; the game requests it only
      // when ?humanShape drives a morph target.
      name: 'dev-only-human-shape-assets',
      configureServer(server) { server.middlewares.use(humanShapeAsset); },
      configurePreviewServer(server) { server.middlewares.use(humanShapeAsset); },
    },
    {
      // M005 refitted garment pack: the same eight catalogue items carrying the shape
      // targets that let them follow the body. Developer assets under .cache/, outside
      // public/ so they cannot reach the Pages bundle.
      name: 'dev-only-garment-fit-assets',
      configureServer(server) { server.middlewares.use(garmentFitAsset); },
      configurePreviewServer(server) { server.middlewares.use(garmentFitAsset); },
    },
    {
      // M006 ponytail diagnostic on the M004 shape body. It stays under .cache/
      // and outside the Pages public asset set until visual/fit acceptance.
      name: 'dev-only-human-hair-assets',
      configureServer(server) { server.middlewares.use(humanHairAsset); },
      configurePreviewServer(server) { server.middlewares.use(humanHairAsset); },
    },
    {
      // M006 old/bald head diagnostic on the same shape body. Same rule as the
      // ponytail above: .cache/ only, never in the Pages public asset set.
      name: 'dev-only-human-head-assets',
      configureServer(server) { server.middlewares.use(humanHeadAsset); },
      configurePreviewServer(server) { server.middlewares.use(humanHeadAsset); },
    },
    {
      name: "starter-brotli-http",
      // Mirror Pages _headers when serving the same precompressed artifact locally.
      // https://developers.cloudflare.com/pages/configuration/headers/
      configureServer(server) { server.middlewares.use(starterBrotliHeaders); },
      configurePreviewServer(server) { server.middlewares.use(starterBrotliHeaders); },
    },
    {
      name: "ashen-startup-preload",
      transformIndexHtml: {
        // Let Vite put the entry/module preloads first. Equal-priority fetches
        // otherwise queue several megabytes ahead of engine initialization.
        // https://vite.dev/guide/api-plugin.html#transformindexhtml
        // https://web.dev/articles/fetch-priority
        order: "post",
        handler(html, ctx) {
          if (!String(ctx.filename || "").endsWith("ashen-reach.html")) return html;
          // Required starter resources begin with the HTML. NPCs, full-size
          // textures and alternate race packs remain background downloads.
          const tags = starterBuild ? [
            ['/HavokPhysics.wasm?v=20260923-1','fetch'],
            ['/ashen-reach/startup/starter/manifest.json','fetch'],
            ['/ashen-reach/startup/starter/'+starterWorldManifest.geometry.file,'fetch'],
            // HTML discovery avoids a module + manifest round trip for the
            // 36 KB of first-frame textures; the foliage atlas remains late.
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload
            ...Object.entries(starterWorldManifest.textureURLs)
              .filter(([source])=>!source.endsWith('/foliage-atlas.png'))
              .map(([,url])=>[url,'fetch']),
          ] : [
            ["/ashen-reach/equipment/body.glb", "fetch"],
            ["/tex/forrest_ground_01/diff.jpg", "image"],
            ["/tex/rock_wall_08/diff.jpg", "image"],
          ];
          const links = tags
            .map(([href, as]) =>
              as === "fetch"
                ? `<link rel="preload" href="${href}" as="fetch" crossorigin fetchpriority="${(href.endsWith('.bin')||href.endsWith('.br'))?'low':'auto'}">`
                : `<link rel="preload" href="${href}" as="image">`,
            )
            .join("");
          // Match Lite's classic-script decoder request (no crossorigin). It is
          // required by the first body, so discovering it after GLB parsing wastes
          // a round trip. Lite still owns loading/initialization and promise reuse.
          const decoder=starterBuild?'<link rel="preload" href="/meshopt_decoder.js" as="script">':'';
          // A saved appearance chooses its own compatible compact pack. Do not preload the
          // neutral pack ahead of it. All URLs here are build-owned, never storage data.
          // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload
          const characterPreloads=starterBuild?`<script>(()=>{try{if(['ashen.appearance.v2','ashen.appearance.v1','ashen.creator.v1'].some(k=>localStorage.getItem(k)))return;}catch{}for(const href of ${JSON.stringify(['/ashen-reach/startup/character/manifest.json',...['body','wayfarerTunic','wayfarerTrousers','wayfarerBoots'].map(id=>starterCharacterManifest.items[id].url)])}){const link=document.createElement('link');link.rel='preload';link.as='fetch';link.crossOrigin='anonymous';link.href=href;link.fetchPriority=href.endsWith('.bin')?'low':'auto';document.head.append(link);}})();</script>`:'';
          return html.replace("</head>", `${links}${decoder}${characterPreloads}</head>`);
        },
      },
    },
    {
      // The game page is served at `/` as well as `/ashen-reach.html`.
      //
      // `/` used to be a stub that meta-refreshed and then `location.replace`d to
      // `/ashen-reach.html?play&clean`. That hop cost 181-247 ms of the startup budget
      // before a single byte of the game was requested, and it is pure overhead: the
      // root document's only job was to name another document. Serving the same HTML
      // at both paths removes the hop without giving up the direct URL that every
      // capture script, test and bookmark already uses.
      //
      // Dev does this with a middleware rewrite so `?play&clean` survives; the built
      // output copies ashen-reach.html over index.html (see writeBundle below), which
      // keeps `/` a real static file on Pages rather than a redirect rule.
      name: "ashen-root-is-game",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const [pathname, query] = String(req.url || "/").split("?");
          if (pathname === "/" || pathname === "/index.html") {
            req.url = `/ashen-reach.html${query === undefined ? "" : `?${query}`}`;
          }
          next();
        });
      },
      async writeBundle(options) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const dir = options.dir || "dist";
        await fs.copyFile(path.join(dir, "ashen-reach.html"), path.join(dir, "index.html"));
      },
    },
    {
      name: "reload-on-blender-export",
      handleHotUpdate({ file, server }) {
        if (file.endsWith(".glb")) {
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
});
