import {verifyStartupAssets} from './scripts/ashen-reach/startup-provenance.mjs';
import { defineConfig } from "vite";
import {readFileSync} from 'node:fs';

const pages = process.env.ASHEN_PAGES === "1";
const starterBuild=process.env.VITE_FAST_START!=='0';

export default defineConfig({
  define:{
    'import.meta.env.VITE_FAST_START':JSON.stringify(starterBuild?'1':'0'),
    // Immutable bundles reject a newer deployment's mutable manifest instead
    // of mixing old worker generation with new prepared geometry/materials.
    'import.meta.env.VITE_STARTER_WORLD_SOURCE':JSON.stringify(process.env.NODE_ENV==='production'&&starterBuild?JSON.parse(readFileSync('public/ashen-reach/startup/starter/manifest.json','utf8')).provenance.sha256:''),
    'import.meta.env.VITE_STARTER_CHARACTER_SOURCE':JSON.stringify(process.env.NODE_ENV==='production'&&starterBuild?JSON.parse(readFileSync('public/ashen-reach/startup/character/manifest.json','utf8')).provenance.sha256:''),
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
      output: process.env.ASHEN_LITE_BUNDLE!=='0'?{codeSplitting:{groups:[{name:'lite-runtime',test:/node_modules\/@babylonjs\/lite\//}]}}:undefined,
      input: pages
        ? { index: "index.html", ashenReach: "ashen-reach.html" }
        : { index: "index.html", ashenReach: "ashen-reach.html", characterLab: "character-lab.html", bodyPreview: "body-preview.html" },
    },
  },
  optimizeDeps: {
    include: ["@babylonjs/havok"],
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.ASHEN_VITE_PORT) || 5173,
    strictPort: true,
  },
  plugins: [
    {name: "verify-prepared-startup", async buildStart(){if(starterBuild)await verifyStartupAssets();}},
    {
      name: "ashen-startup-preload",
      transformIndexHtml: {
        order: "pre",
        handler(html, ctx) {
          if (!String(ctx.filename || "").endsWith("ashen-reach.html")) return html;
          // Only the player body and the two textures the first churchyard
          // frame actually needs. Shades, the dummy, clothes, grass and the
          // other race packs load after that frame.
          const tags = starterBuild ? [
            ['/HavokPhysics.wasm?v=20260923-1','fetch'],
            ['/ashen-reach/startup/starter/manifest.json','fetch'],
            ['/ashen-reach/startup/character/manifest.json','fetch'],
            [JSON.parse(readFileSync('public/ashen-reach/startup/character/manifest.json','utf8')).items.body.url,'fetch'],
            ['/ashen-reach/startup/starter/'+JSON.parse(readFileSync('public/ashen-reach/startup/starter/manifest.json','utf8')).geometry.file,'fetch'],
          ] : [
            ["/ashen-reach/equipment/body.glb", "fetch"],
            ["/tex/forrest_ground_01/diff.jpg", "image"],
            ["/tex/rock_wall_08/diff.jpg", "image"],
          ];
          const links = tags
            .map(([href, as]) =>
              as === "fetch"
                ? `<link rel="preload" href="${href}" as="fetch" crossorigin>`
                : `<link rel="preload" href="${href}" as="image">`,
            )
            .join("");
          // Match Lite's classic-script decoder request (no crossorigin). It is
          // required by the first body, so discovering it after GLB parsing wastes
          // a round trip. Lite still owns loading/initialization and promise reuse.
          const decoder=starterBuild?'<link rel="preload" href="/meshopt_decoder.js" as="script">':'';
          return html.replace("</head>", `${links}${decoder}</head>`);
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
