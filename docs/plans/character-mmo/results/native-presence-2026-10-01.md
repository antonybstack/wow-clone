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

## Open

Eight seats under load, delayed and failed assets, latency and reconnect matrices; the
prescribed cold/solo/cathedral/touch-fallback/WebKit gates; deployment with production
verification and rollback. Production remains unreleased.
