# Shared-region presence

This is a bounded eight-seat Colyseus 0.18 room, using the game's existing
Babylon Lite 1.31.1 / Havok movement driver and exported region collision.
Combat, accounts, inventory and durable rewards are outside this presence slice.

## Local use

From the repository root, run `npm ci`,
`node scripts/multiplayer/prepare-collision.mjs`, then
`node server/presence/main.js`. The default endpoint is
`http://127.0.0.1:2577`; `ASHEN_PRESENCE_HOST` and `ASHEN_PRESENCE_PORT` configure
the listener. Start the normal game with `npm run dev`. Its **Shared region**
panel becomes available after the full region loads. Wayfarer and Warden Human
characters are supported, including the accepted height/build range. Leave
returns the client to solo play.

Colyseus owns session IDs, input sequencing, prediction history, interpolation,
clock synchronization and expiring reconnection credentials. The room consumes
one bounded command at 30 Hz and performs two 60 Hz native Havok substeps.
Disconnected actors release controls and continue falling; their seat survives
for 30 seconds. Appearance changes have revisions and a bounded idempotency
window. A client confirmation timeout does not overturn a later server commit.

The physics export is collision-only server data, about 17 MB. Its hashed
manifest is verified before cooking. Clients compare the release identifier;
they do not download this duplicate collision dataset. The browser continues
using the actual region collision already loaded by the game.

## Production boundary

The normal production build exposes no join panel without a verified
`VITE_PRESENCE_URL` HTTPS endpoint. SDK, remote assets and room connections are
lazy. Pages remains independently deployable. Server-only collision is omitted
from the Pages publishing stage.

`server/presence-host` supplies a separate Cloudflare Containers deployment,
with one basic instance and one fixed Durable Object name. On 2026-10-01 the
account refused Containers access because its Workers Paid plan is unavailable.
No public backend has been deployed, and this local proof is not public
multiplayer acceptance. Do not enable the client panel until public discovery,
WebSockets, region/version agreement, reconnect and rollback have passed.

The container limits and idle sleep bound instance count, not total billing.
Its filesystem is not durable storage. Authentication, entitlements and durable
character/reward data must be supplied before cooperative gameplay is released.

## Verification

The scripts in `scripts/multiplayer` cover native headless collision, eight
protocol clients and authority rejection, two real rendering clients, normal
cathedral traversal, TCP latency/jitter/outage and live recording. All browser
scripts require an audited owned CDP harness through `ASHEN_CDP_PORT` and
`ASHEN_TEST_URL`. Never run functional clients alongside solo FPS measurement.
Toxiproxy byte loss is not TCP packet-loss/retransmission testing; that external
network gate remains separate.

Primary references: [server input](https://docs.colyseus.io/netcode/server-input),
[prediction](https://docs.colyseus.io/netcode/client-prediction),
[reconnection](https://docs.colyseus.io/room/reconnection),
[deployment](https://docs.colyseus.io/deployment),
[Containers WebSockets](https://developers.cloudflare.com/containers/examples/websocket/).
