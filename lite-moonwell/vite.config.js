import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: { ashenReach: 'ashen-reach.html', characterLab: 'character-lab.html', bodyPreview: 'body-preview.html' },
    },
  },
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
        if (file.endsWith(".glb")) {
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
});
