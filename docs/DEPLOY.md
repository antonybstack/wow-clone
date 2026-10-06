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

The staged root must include `HavokPhysics.wasm`. Without it, Cloudflare Pages can return the app HTML at that URL, leaving the game without a collision world and making spells report every target as blocked. The deploy script compares the built WebAssembly file with the source before publishing. An older deployment cached that HTML fallback for a year, so the client now requests a versioned WebAssembly URL and `.wasm` responses revalidate after 60 seconds. Production builds now use a content-addressed, build-time Brotli copy with native HTTP decoding; the versioned endpoint remains available for legacy/development consumers. Verify that the generated `/physics/HavokPhysics-<hash>.wasm.br` response decodes to the exact original binary, has `application/wasm` / `Content-Encoding: br`, and that the game reports `ASHEN.player.getDebugState().usingPhysics === true`. The full release verifier enforces these checks. See [Havok delivery](startup-load.md#havok-delivery) for the local Pages emulator limitation.

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
comparison without publishing. Run the cold-load and performance gates against
that `dist`, using the compressed startup preview. Once they pass, seal it and
upload **those exact bytes** without a rebuild:

```bash
node scripts/character-assets/pages-seal.mjs seal --dist dist --out .cache/<release>/pages-seal.json --scope "<what was gated>"
# commit/push the product inputs (a seal taken before the commit is fine)
ASHEN_PAGES_SEAL=.cache/<release>/pages-seal.json npm run deploy
```

The seal records the SHA-256 of every `dist` file, including `_headers` and
`_redirects`, plus the source HEAD. It also records a fingerprint of the product
inputs: git blob IDs for `src`, `public`, `scripts`, the root HTML, the Vite
config and the package files, covering uncommitted and untracked files as well.
The seal file must live outside `dist` and is never overwritten.

Sealed upload skips staging and the build. It refuses in these cases:
- a changed, missing or extra file, a symlink, or an unsafe path
- a tampered seal
- a Havok binary that differs from `public/HavokPhysics.wasm`
- uncommitted product inputs (unrelated docs, `.cache` and `__pycache__` files are ignored)
- committed inputs whose fingerprint differs from the sealed one

A later documentation-only commit is accepted, and Pages attributes the upload
to that HEAD, which verifiably contains the same product bytes. Changed product
inputs need a new build, new gates and a new seal. Plain `npm run deploy` still
rebuilds and uploads unsealed; use it only when no gate evidence depends on the
bytes. Server-only `ashen-reach/presence-v1` collision is omitted from Pages;
the browser compares the compiled world release identifier.

Shared-region controls are published as an optional lazy client surface. They
remain unavailable on the public URL unless `VITE_PRESENCE_URL` selects a
verified compatible HTTPS backend. The separate Colyseus/Cloudflare Containers
host and its account gate are documented in [the presence result](plans/character-mmo/results/multiplayer-presence-2026-10-01.md).
Static client deployment does not establish a public multiplayer release.
