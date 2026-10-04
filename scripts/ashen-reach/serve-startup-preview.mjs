/** Static built-bundle preview with precomputed HTTP compression.
 * Vite dev modules and uncompressed WASM are not representative of Pages.
 * This measures local transport/CPU only; production CDN checks remain required.
 * Compressed responses are a startup snapshot. Restart after EVERY rebuild;
 * otherwise a browser can receive old compressed HTML while curl sees new bytes.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants } from "node:zlib";
const root = path.resolve(process.argv[2] || "dist"),
  port = Number(process.env.ASHEN_PREVIEW_PORT || 7074);
const encoded = new Map();
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(js|css|html|json|wasm)$/.test(file))
      encoded.set(
        file,
        brotliCompressSync(await fs.readFile(file), {
          params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
        }),
      );
  }
}
await walk(root);
const mime = {
  ".js": "application/javascript",
  ".html": "text/html",
  ".json": "application/json",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/" || pathname === "/index.html")
        pathname = "/ashen-reach.html";
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const compressed =
        req.headers["accept-encoding"]?.includes("br") && encoded.has(file);
      const bytes = compressed ? encoded.get(file) : await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "public, max-age=3600",
        Vary: "Accept-Encoding",
        ...((compressed || file.endsWith(".br")) ? { "Content-Encoding": "br" } : {}),
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500).end();
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Serving ${root} at http://127.0.0.1:${port}`),
  );
