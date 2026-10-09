# Gothic production source review — 2026-10-09

Status: **final partial review.** Independent, read-only, no browser/game/build/benchmark/network/commit/deploy/Telegram. This is **not** independent source acceptance and **not** a production go.

HEAD verified: `0b88344abbbea1411f8b5b6e90e8188954427108` (`Document region wait and verify core woodland live transitions`). Ancestor of the claimed `0b88344`.

Turn cap closed the remaining checklist. Findings below are only from files already opened. Unchecked items stay unchecked. Highest-impact outcome: **no demonstrated causal source defect that explains 514fe898 run 1, and no supported permanent release prohibition; current HEAD remains unqualified for production.**

Questions in scope:

1. Any demonstrated source race / ownership / lifecycle / request mismatch that can explain the historical Moss/burial-earth texture failure and deserves a narrowly reproducible control.
2. What evidence remains necessary versus an unsupported permanent release prohibition.
3. Risks of shipping the latest standard-mode Gothic build while keeping the region-core experiment optional.

---

## Verdict on the three questions

### 1. Demonstrated mismatch vs control

**No demonstrated causal race, ownership, lifecycle, or request mismatch.** The failed visit still has an unresolved application body. A parser-preload HTTP 200 is not a successful `fetch().blob()`. Clean later visits are not a cause.

One **hypothesis** (not a finding) is worth a **narrow new control on a newly declared candidate**, if root chooses to instrument it: HTML starter preloads textures as `as=fetch crossorigin`, Lite application load is bare `fetch(url).blob()`, and the qualification collector recorded only the parser request. That is a destination/credentials matching question plus a collector-coverage question. It is **not** proved on run 1. It does **not** justify repeating the exhausted 514fe898 campaign, adding retries, or changing the loader from this review.

Product attribution/header work on later commits is a reporting correction. It is not causal resolution of the failed row.

### 2. Evidence still necessary vs permanent prohibition

**Permanent prohibition of a later Gothic production is unsupported.** The open row rejects **514fe898 / 4ad2637** and forbids treating later clean reruns as proof. It does not freeze every future sealed HEAD.

**Still necessary before production of `0b88344` or any successor:**

- A newly declared sealed candidate with its own request/body-complete cold cohort (application `fetch`/blob stage retained, not parser-preload 200 alone).
- G06–G08 isolated FPS/load gates once renderer isolation is resolved.
- Ordinary served-byte/entry verification of that seal on the actual player URLs.

**Not necessary, and already forbidden by CURRENT/DEPLOY:** another unchanged 514fe898 cold campaign; speculative retries; promotion from desktop preview gates; a causal claim from the six wrapped or twenty native clean diagnostics.

Open items that this review does not close: original 14/60 failures, 362 ms input outlier, physical iPhone acceptance, G06–G08 FPS.

### 3. Standard-mode Gothic with region-core optional

From source already read, default play does not turn the experiment on:

- `main.js:198` — `regionCore: params.has('dev') && params.get('regionCore')==='1'`
- `starter-world.js:77` — `coreLoading = regionCore && manifest.geometry.region?.experimentalCore === true`
- Prepared-region consume uses `index.experimentalCore.core` only when `coreLoading`; otherwise `index.geometry`

The experiment is still compiled into `starter-world.js`. Flag-off execution uses the standard packet. CURRENT already holds production on the unresolved boot row **and** on G06–G08 FPS. Shipping latest standard-mode Gothic as **play.sparkify.dev** would still be a new production qualification that this HEAD does not have.

Residual ship risks that **are** in evidence: G01–G08 geometry is the default world, so a standard-mode production would include hall balcony, wall walk, map, guide, and progress UI; those slices have functional previews and **open isolated FPS gates**. Opt-in core is documented as 14.4 MB first payload / 11.7% extra combined transfer, with no runtime speedup claim. Flag-off does not fetch the experimental packets in the consume path that was read.

---

## Verified from retained docs and the original receipt

Production remains **7d00c56 / 5723a4ab**. Rollback **60048408 / e39117b8**. Last qualified release: 80/80 declared cold starts, worst first play 878.2 ms.

Sealed preview **514fe898** (source **4ad2637**): 570 files / 310,982,964 bytes; integrity 571/571; three entry aliases. `qualified: false`. Production was not mutated. Default appearance 20/20. Maximum uncovered 19/20.

Failed sample, `receipt.json` `allAttemptedSamples` maximum-uncovered run 1, browserPid **95182**:

```
Startup resource /ashen-reach/startup/starter/texture-6dc86c298450.webp: surface Moss and burial earth preparation failed: Failed to fetch
```

Stack: `xe` / `M` in `store-DhAEhUFt.js`, `async Promise.all (index 0)`, `Ga` in `ashen-boot-iC9h3i3_.js`, `Nt` in `ashen-reach-BLJPRsjQ.js`. Native cause: `TypeError: Failed to fetch` at the same `xe`/`M` frames.

Only recorded texture request on that visit:

- URL: `https://514fe898.fardel.pages.dev/ashen-reach/startup/starter/texture-6dc86c298450.webp`
- initiator: **parser**
- HTTP **200**, `image/webp`, HTTP/2, 5294 encoded bytes
- `fromDiskCache: false`, `fromPrefetchCache: false`, `fromEarlyHints: false`, `cfCacheStatus: null`
- `qualificationCollectorRecordedLoadingFailed: false`
- `requestVsBodyStage`: **Unresolved. HTTP 200 for parser preload does not prove successful application consumption.**

Six wrapped diagnostics: 200 + 4838-byte blob observed; `bodyUsedAtObserver: false`; `causalityProved: false`. Twenty later native visits: all CLI 0; cause unproved; campaign exhausted.

---

## Verified from source already opened (HEAD and 4ad2637)

**4ad2637 `createStarterWorld`** wrapped each surface with the **primary albedo URL**:

```js
manifest.surfaces.map((s) => withStartupResource(manifest.textureURLs[s.url]??s.url,
  `surface ${s.name} preparation`,()=>surface(engine, s.name, s.url, s.options)))
```

That string matches the failed row exactly. Inside `surface()`, albedo, optional `stoneDetail`, and optional `paving` all call `loadTexture2D`. A later sampler rejection would still name `texture-6dc86c298450.webp`. Parser 200s on albedo/detail/paving therefore do not identify the failing application read.

**HEAD `starter-world.js:85-91`** keeps `Promise.all` over surfaces and adds an outer `Surface ${s.name} preparation failed` wrapper. **HEAD `materials.js:20-22`** attributes each `loadTexture2D` as `material ${name} sampler ${slot} preparation` on the remapped URL. That is the 2026-10-08 reporting correction. Lite still owns fetch/blob/upload and the per-device promise cache. No extra request or retry.

**Installed Lite 1.31.1 `loadTexture2D`** (`node_modules/@babylonjs/lite/lib/texture/texture-2d.js`):

- Cache key: device + URL + mipMaps/address/filter/invertY/srgb/premultiplyAlpha
- Miss: `loadTexture2DImpl` → `const blob = await (await fetch(url)).blob()` → `createImageBitmap` → GPU upload → `acquireTexture`
- `p.catch(() => map.delete(key))` so a failed promise is not reused

**`preloadStarterWorld`** (HEAD and 4ad2637) does not fetch textures. Comment: HTML preloads the required maps; a discard-fetch would consume those responses before Lite, forcing duplicate downloads with HTTP caching disabled.

**HEAD `vite.config.js` `ashen-startup-preload`:** starter-build texture URLs are `<link rel="preload" … as="fetch" crossorigin …>`. Lite’s `fetch(url)` passes no `credentials`/`mode`. Whether Chrome matches that preload to the application fetch was **not** checked in a browser in this review.

**Region-core default-off** is as in question 3. Menu/dev-tools expose a reload toggle only when `regionCoreAvailable`. `upgradeTextures` (post-play JPEG enhancements) is a separate path from required startup `loadTexture2D`.

**`startup-assets.js` acquire/release** is the starter-body texture upgrade, a different URL set from Moss/burial earth.

---

## Hypotheses (not findings)

- **H1.** Old wrapper misnamed a successful albedo after shared detail/paving rejection. Compatible with the later controlled counterexample. **Not proved** for run 1.
- **H2.** Application `fetch().blob()` failed while the parser preload completed 200; the collector kept only the tracked parser request ID. Compatible with the receipt’s “only recorded” parser row and documented collector limit. **Not shown** as a second request on run 1.
- **H3.** `as=fetch crossorigin` preload and bare `fetch(url)` did not share one network body under `Network.setCacheDisabled(true)`. **Unchecked** against Chrome matching rules and against the actual 514fe898 HTML bytes.
- **H4.** NetLog cache-doom −2 / HTTP2 teardown −3 caused the TypeError. Those codes also appear on successful required-texture requests in the twenty-visit campaign. **Not a captured URL_REQUEST failure.**
- **H5.** Scene dispose / abort dropped a world texture on first play. Character upgrade has acquire/abort guards; the failed stack is `Promise.all` surface preparation before play. **No supporting stack evidence.**

---

## Unchecked (turn cap)

- Independent reviews `independent-review.md` / `grok-review.md` beyond the result markdown.
- Actual 514fe898 HTML preload tags (sealed `dist`, not only current `vite.config.js`).
- Chrome preload-vs-`fetch` credentials/mode matching; any second request ID on run 1.
- `main.js` after world-end (playable-boundary abort/dispose).
- Whether G06–G08 added required **pre-play** textures (region packets/foliage/progress are post-play in the paths read).
- Byte identity of starter textures HEAD vs 4ad2637 vs production 7d00c56.
- `startup-fetch.js` pending-map vs Lite texture cache interaction on world maps.
- Production 7d00c56 wrapper text versus 4ad2637.

---

## What this review does not authorize

- Production promotion of `0b88344` or of 514fe898.
- Weakening G06–G08 FPS gates or the boot request/body gate.
- Repeating the exhausted 514fe898 cold campaign.
- Speculative loader retries or preload removal from this partial review.
- A claim that HEAD’s attribution leaf, header policy, or later clean diagnostics fixed run 1.

Root owns implementation, a newly declared seal, measurements, and acceptance.
