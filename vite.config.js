import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5173,
        strictPort: true,
        host: "127.0.0.1",
    },
    build: {
        target: "esnext",
        sourcemap: true,
    },
    // .wgsl imported via ?raw
    assetsInclude: ["**/*.hdr", "**/*.env"],
});
