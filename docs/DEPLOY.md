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

```bash
export CLOUDFLARE_API_TOKEN=…   # already in the Mac Studio shell
npm run deploy
```

Live:

- https://play.sparkify.dev
- https://play.sparkify.dev/ashen-reach.html?play&clean

`CLOUDFLARE_ACCOUNT_ID` defaults to `6ea5db25020bce6cbefd6c1cc999bef3`. Override `PAGES_PROJECT` / `PAGES_BRANCH` only if you are not targeting `fardel` / `main`.
