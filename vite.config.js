import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: { index: 'index.html', ashenReach: 'ashen-reach.html', characterLab: 'character-lab.html', bodyPreview: 'body-preview.html' },
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
      name: "reload-on-blender-export",
      handleHotUpdate({ file, server }) {
        if (file.endsWith(".glb")) {
          server.ws.send({ type: "full-reload" });
        }
      },
    },
  ],
});
