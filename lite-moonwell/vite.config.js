import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: ["@babylonjs/havok"],
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  plugins: [
    {
      name: "reload-on-blender-export",
      handleHotUpdate({ file, server }) {
        if (file.endsWith(".glb") || file.endsWith("moonwell-runtime.json") || file.endsWith("glb-meta.js") || file.endsWith("hero.js")) {
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
});
