# Native per-piece presence in the shared region

Status: **integrated and proved with two real clients.** Eight seats, the normal cold/solo/
cathedral/touch/WebKit gates and deployment remain open.

Reviewed motion: Telegram **840**,
[VE](https://ve.sparkify.dev/wow-clone/ashen-reach/multiplayer/native-presence-2026-10-01.mp4)
(1280×720, 15.07 s).

## Published pieces

`scripts/character-assets/publish-remote-pieces.mjs` emits 45 content-addressed pieces across
three races, 19,418,944 bytes, to `public/ashen-reach/remote-pieces/v1` with a descriptor and
an index. It refuses rather than repairs: a prepared set whose `compilerSha256` is not the
hash of the current `prepare-remote-pieces.mjs` is stale by definition, and a mismatched
schema, Lite version, catalogue version, any bound escape, or any file whose bytes or SHA-256
disagree with the manifest all abort the publish. Output is content-addressed, so an
unchanged republish is idempotent and a changed piece lands beside the old one.

The runtime previously required `candidateOnly === true`, so this is a contract change. It now
accepts exactly two descriptors — the DEV candidate set, or a published set carrying version 1,
the compiler hash and matching versions — and refuses anything between them. Verified live:
all three races commit from the published root, and a descriptor with its `published` block
stripped is rejected.

Each piece is hash-sealed and re-verified on fetch. The descriptor itself is trusted by origin;
it carries provenance and a version, not a self-seal, which would be circular.

## Seat validation follows what is published

`validatePresenceAppearance` accepted Human only, plus two hand-listed outfits. It now checks
every equipped piece against `PRESENCE_PIECE_CATALOGUE`, which the publisher generates from
the pieces it just published. Authority cannot outrun the assets: a race or item that was
never published is refused at the seat rather than accepted and then failing on every other
client. Widening it means publishing pieces, not editing a list, and races with no published
body stay refused by construction. Mixing published pieces across designs is now legitimate.

**A real bug this exposed.** Only the Human has a verified shape family, so by the appearance
contract the Orc and the Undead carry an empty `shape`. Both `server/presence/room.js` and
`src/multiplayer/client.js` read `recipe.shape.height` directly and would have fed `undefined`
into the physics capsule and the remote capsule offset for two of the three published races.
`presenceHeightScale` centralises that, returning 1 for the authored default and rejecting a
non-finite or non-positive value.

## The renderer swap

Remote seats went through the region-crowd renderer with an exact/vat tier choice. The room
seats eight and the native exact capacity is eight, so every seat is now an exact native owner
and there is no tier to pick; larger populations stay M8's problem. The renderer is imported
only once a shared region is joined, so neither it nor its published asset graph is referenced
by normal startup.

### A vocabulary gap, left visible

The server emits `Spell_Simple_Enter` and `Sword_Attack` for its two actions. The native path
maps source clips to *composed player poses* — idle, walk, run, jump, land, air, fire, lava,
pulse, carry — not to raw clips.

* `Spell_Simple_Enter` is the simple cast, which **is** the fire composition, so it maps
  faithfully.
* `Sword_Attack` has no composed pose at all. Rejecting the actor would freeze a remote player
  for the length of a swing; inventing a pose would claim a capability the player composition
  does not have. It falls back to locomotion and increments `streaming().stats.uncomposedMotions`,
  so the gap sits in telemetry rather than hidden. A real composed sword pose is M8's matching
  bake/pose work.

## Two clients

`check-two-clients.mjs`, five cases, zero page errors:

| case | evidence |
|---|---|
| real input, shared movement | remote peer is an exact native owner (`owned` 1, `activeExact` 1, `bodyLoads` 1) |
| remote exact appearance change | restages over the network: `owned` 2, `bodyLoads` 2 |
| source action | spell composes; `uncomposedMotions` 0 |
| automatic reconnect | same identity retained |
| departure | `activeExact` 0, no ghost |

The check exercises the spell action, so **the sword fallback is in place but not exercised.**

## Two things found while cleaning up

**The publisher was not idempotent, despite the commit message saying so.** All 45
content-addressed pieces were byte-identical on a republish, but the descriptor carried a
fresh `publishedAt` each run, so every republish dirtied the working tree. It now reuses the
previous timestamp when nothing else about the publication changed, and preserves key order,
so two consecutive republishes of an unchanged set now produce byte-identical files. Verified
by running it twice against a clean tree.

**The committed collision release is stale against the current toolchain.** Running
`scripts/multiplayer/prepare-collision.mjs` to start the presence server regenerated
`collision-release.js` with hash `eec51748…` where the committed value is `3623939d…`. The
regeneration is deterministic — two runs agree — and `sourceHash` is **unchanged**, so the
world source is identical and only the serialisation moved, by 4 metadata bytes. That points
at generator or lock drift rather than a world change.

This was reverted rather than committed. The collision hash gates client/server seat
compatibility through `matchesPresenceVersion`, both states are internally consistent, and
regenerating a published compatibility artefact was a side effect of running a setup script,
not part of this work. Anyone running `prepare-collision.mjs` will reproduce it; it should be
regenerated deliberately, with the clients it gates, rather than incidentally.

## Eight seats

`measure-presence.mjs` — one rendering client plus seven non-rendering native SDK peers, no
recording, 1280×720, seven enemies, three 12-second runs per phase. It previously measured the
crowd renderer's vat and exact tiers; with every seat an exact native owner there is no tier to
pick, so the two phases are now the seven peers as they joined and the same seven after each
has changed appearance, which is seven restages.

| phase | mean FPS | mean ms | p95 ms | max ms | >16.67 ms | cap flag |
|---|---|---|---|---|---|---|
| joined | 170.7–170.9 | 5.854 | 6.6–6.7 | 11.2 | **0** | none |
| after appearance change | 169.8–170.5 | 5.875 | 6.5–6.6 | 16.1 | **0** | none |

All seven are committed exact owners (`owned` 7, `activeExact` 7); `bodyLoads` goes 7 → 14
across the appearance phase, which is exactly the seven restages and no more.
`uncomposedMotions` stays 0, no GPU or presence errors, no cap heuristic tripped.

Eight seats therefore sustain about **170 FPS** with not one frame over 16.67 ms, above the
>144 route requirement and the >120 crowd target. This is the shared-region spawn area with
its own camera, **not** the open-meadow diagnostic that measured 160.5 FPS for eight owners;
the two numbers describe different scenes and should not be differenced.

## Authority and traversal

* `check-authority.mjs` — 11 network-only protocol cases pass, with no renderer and no
  client-side authoritative positions.
* `check-region-traversal.mjs` — all six routes pass (assigned spawn, churchyard→town,
  town→bridge, bridge approach, cathedral entry and return) with **zero recovery teleports**,
  so shared authority never had to correct the client back onto the region.

## Solo five-route gate, after publication and the renderer swap

Isolated, uncapped, 1280×720, seven enemies, three 12-second runs per route, presence server
stopped and nothing else rendering.

| route | mean FPS | p95 ms | worst ms | >16.67 ms | cap flag |
|---|---|---|---|---|---|
| meadow | 208.7–210.7 | 5.5–9.7 | 11.3 | 0 | none |
| town | 227.0–227.8 | 5.4 | 8.1 | 0 | none |
| bridge | 254.3–256.4 | 4.9–7.7 | 9.6 | 0 | none |
| cathedral | 262.1–270.5 | 4.7–7.3 | 9.4 | 0 | none |
| forest | 241.6–243.6 | 5.2–6.9 | 10.4 | 0 | none |

Every route clears the **>144 mean FPS** preservation gate with margin and no route put a
frame over 16.67 ms. Publishing 19.4 MB into `public/` and swapping the presence renderer did
not disturb solo throughput, which is expected — the published pieces are fetched only on
joining a shared region, and the renderer is imported only then.

This run is **neutral**, not equipped. The open equipped-forest 240 Hz cap qualification is a
separate measurement and is not retired by it; this neutral forest run read 241.6–243.6 FPS
without tripping the heuristic, which is an observation, not that qualification.

## Cold startup, after publication

Twenty fresh Chrome processes, 50 Mbit/s / 40 ms, `ASHEN_PAGES=1` production build on the
compressed preview server, nothing else rendering: **p50 1,089.5 ms, p95 1,095.0 ms, max
1,106.9 ms, 0/20 under a second.**

That is the same figure this machine produced last session for both the current HEAD and the
pre-session commit, and it remains an environmental result, not a code one: `595438c`, which
recorded p95 843 ms with 20/20 under a second, re-measured at 1,125 ms here. Publishing and
the renderer swap did not move it.

The payload confirms publication stayed out of the startup path. Bytes transferred at the
playable boundary are **4,766,645**, about 12.6 KB above last session's 4,754,054 — the size
of the client, protocol and generated-catalogue changes, not of 19.4 MB of pieces. The Pages
bundle itself grew from 770 MB to 802 MB, which is the published set plus its compressed
variants; none of it is fetched before the game is playable.

## Open

Eight seats under load, delayed and failed assets, latency and reconnect matrices; the
prescribed cold/solo/cathedral/touch-fallback/WebKit gates; deployment with production
verification and rollback. Production remains unreleased.
