import { defineConfig } from "vite";

const pages = process.env.ASHEN_PAGES === "1";

export default defineConfig({
  publicDir: process.env.ASHEN_PUBLIC_DIR || "public",
  build: {
    sourcemap: !pages,
    rollupOptions: {
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
    {
      name: "ashen-startup-preload",
      transformIndexHtml: {
        order: "pre",
        handler(html, ctx) {
          if (!String(ctx.filename || "").endsWith("ashen-reach.html")) return html;
          // Only the player body and the two textures the first churchyard
          // frame actually needs. Shades, the dummy, clothes, grass and the
          // other race packs load after that frame.
          const tags = [
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
          return html.replace("</head>", `${links}</head>`);
        },
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
