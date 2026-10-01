# Deploy

Ashen Reach is the playable game. It replaces the Fardel Babylon client on **play.sparkify.dev**.

## How Fardel shipped

Fardel’s browser client was a Vite `web/dist` upload to Cloudflare Pages project **`fardel`**, custom domain `play.sparkify.dev` (CNAME → `fardel.pages.dev`). Command:

```bash
npx wrangler@4 pages deploy dist --project-name=fardel --branch main
```

SpacetimeDB (`db` / `dev-db`) is unrelated to this static client. Visual evidence still uses R2 `fardel-ve` → `ve.sparkify.dev`.

## Ashen Reach

Same Pages project and hostname. The deploy script builds only the playable routes (`index.html` → `ashen-reach.html?play&clean`) and copies the textures, bodies, and equipment the game actually loads. Unused `public/models` tree bins (over the 25 MB Pages file limit) stay off the upload.

The staged root must include `HavokPhysics.wasm`. Without it, Cloudflare Pages can return the app HTML at that URL, leaving the game without a collision world and making spells report every target as blocked. The deploy script compares the built WebAssembly file with the source before publishing. An older deployment cached that HTML fallback for a year, so the client now requests a versioned WebAssembly URL and `.wasm` responses revalidate after 60 seconds. After deployment, verify that the versioned `HavokPhysics.wasm` response begins with WebAssembly bytes `00 61 73 6d` and that the game reports `ASHEN.player.getDebugState().usingPhysics === true`.

```bash
export CLOUDFLARE_API_TOKEN=…   # already in the Mac Studio shell
npm run deploy
```

Live:

- https://play.sparkify.dev
- https://play.sparkify.dev/ashen-reach.html?play&clean

`CLOUDFLARE_ACCOUNT_ID` defaults to `6ea5db25020bce6cbefd6c1cc999bef3`. Override `PAGES_PROJECT` / `PAGES_BRANCH` only if you are not targeting `fardel` / `main`.

## Build and verify before publishing

`ASHEN_BUILD_ONLY=1 npm run deploy` runs the same staged Pages build and Havok
comparison without publishing. Use its `dist` with the compressed startup
preview for cold-load/performance gates, then commit/push and deploy through the
normal command. Server-only `ashen-reach/presence-v1` collision is omitted from
Pages; the browser compares the compiled world release identifier.

Shared-region controls are published as an optional lazy client surface. They
remain unavailable on the public URL unless `VITE_PRESENCE_URL` selects a
verified compatible HTTPS backend. The separate Colyseus/Cloudflare Containers
host and its account gate are documented in [the presence result](plans/character-mmo/results/multiplayer-presence-2026-10-01.md).
Static client deployment does not establish a public multiplayer release.
