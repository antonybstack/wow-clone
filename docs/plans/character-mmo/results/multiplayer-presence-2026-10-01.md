# Authoritative presence — implementation and local verification

2026-10-01. Milestone 4 has a bounded local implementation. Public multiplayer
acceptance remains pending the hosting account gate; milestone 4 is not marked
released. Subsequent source-art/factory work may proceed independently.

## Implemented slice

Two to eight actual Colyseus clients share the existing region. Pinned versions
are core 0.18.18, SDK 0.18.4, schema 5.0.35 and WebSocket transport 0.18.4.
The native SDK owns input sequencing, prediction history, interpolated snapshots,
clock synchronization and reconnect credentials. The room owns IDs, accepted
appearance revisions and movement. No caller-provided position or asset URL is
accepted. Combat and encounters remain solo.

The existing Lite/Havok player driver is reused at 30 network steps / 60 physics
substeps per second; patches are 50 ms, eight seats, reconnect grace 30 seconds.
Headless collision is exported reproducibly from the actual finite region:
717 mesh chunks and 678 authored boxes, 17,518,656 binary bytes. The server
verifies the metadata/binary hash and cooks the same geometry; browsers compare
the release ID without downloading duplicate collision. No coordinate clamp or
recovery teleport is introduced. Havok contact caches are not rewindable;
correction distances are measured rather than claiming bitwise determinism.

Published Wayfarer/Warden Human fits retain height 0.90–1.15 and build ±0.95.
Non-neutral remote bodies use the existing exact morph tier. Neutral actors use
native VAT; inspection selects exact detail. Compatible immutable bytes, staging,
queue and disposal reuse milestones 2–3. Remote transforms do not re-evaluate
all animations. Local physics changes only when authoritative height is adopted.
Late appearance commits converge after a local timeout. Leaving cancels pending
join/listener/confirmation work; departure removes pending and live actors.

Evidence: [sanitized reports](../../../baselines/character-mmo/multiplayer-presence-2026-10-01/README.md).

## Local evidence

- Two real rendering clients: distinct identity, actual keyboard movement,
  synchronized exact outfit/body, source cast phase, automatic same-ID reconnect,
  departure and zero runtime/GPU errors.
- Native collision fixtures: five representative routes at three heights,
  cathedral entry/return, jump/restoration and walls; 16 rows pass. These are
  diagnostic fixture placements, separate from normal-input acceptance.
- Normal-input traversal: assigned spawn through churchyard, town and bridge into
  cathedral and back, with Warden at tall/stout endpoints; protocol peer agrees,
  revision 2, Havok active and zero recovery teleports. An overly strict center
  assertion and an insufficient return duration were corrected in the harness;
  failed rows remain retained.
- Eight native protocol peers: server-assigned identities, ninth-seat rejection,
  caller-ID/position/world/race/extra-room rejection, finite bounded movement,
  idempotent appearance receipt, stale/foreign/mismatched-request rejection and
  final actor count zero. Sustained-load/device-cost measurements are reported
  separately below.
- Actual TCP shaping through checksum-pinned Toxiproxy 2.12.0: 40/100/200 ms
  roundtrip and 100 ms ±25 ms per direction, moving jump and shape edit, mid-air
  1.7-second outages. All eight cases plus a delayed-command uncertainty case
  pass. Correction maxima are about 0.30–0.58 m; final smoothed drift is about
  0.001–0.013 m. Reconnect retains one identity and gravity continues. A separate
  semantic command delayed 6.5 seconds outlives the six-second client deadline
  and converges to server revision 2. This is not an additional TCP profile.
- Toxiproxy packet-loss toxic drops TCP byte chunks; that would corrupt the byte
  stream rather than represent TCP retransmission. Real packet-loss acceptance
  remains pending an appropriate network shaper. Failed head-of-line-delay
  experiment is retained and not treated as acceptance.
- Focused checks: 30 region actor/streaming/lifecycle tests, two presence contract
  tests, eight capsule/physics lifetime tests, 141 character and 71 equipment
  tests pass. Developer and Pages builds pass; a build guard rejects eager
  Colyseus/crowd dependencies in normal startup.

An independent Grok 4.6/high read-only review identified four valid defects:
missing idle gravity, redundant animation evaluation, optimistic capsule changes
and ignored late receipts. All four were fixed; the follow-up confirms closure.
Its bounded review reached the CLI turn limit; it is useful independent evidence,
not an exhaustive certification.

## Offline regression gates

An initial isolated five-route developer measurement, before the final optional
entry/input polish, is 15/15: **197.7–236.1 mean FPS**, p99 <=11.3 ms,
maximum 12.9 ms and zero intervals >16.67 ms. Final compiled staged Pages build: all 15 prescribed runs pass at
**197.5–236.1 mean FPS**, p99 <=11.2 ms, maximum **13.5 ms**, zero intervals
>16.67 ms and no cap flags/runtime/GPU errors. The owned presence service,
proxy and Grok reviewer were stopped; only the intended game page rendered.

Twenty fresh processes at 50 Mbit/s / 40 ms on that compressed staged build:
default p95 **833.8 ms**, maximum **836.7**, **20/20 <=1 second**. The
largest saved-character p95 **942.5 ms**, maximum **945.2**, **20/20 <=1 second**. These local
cohorts do not repair or erase the deferred public/first-use GPU tail.

## Measured local capacity and cost

M1 Max, uncapped Chromium WebGPU, actual 1280×720, seven enemies, no recording,
one rendering client plus seven native protocol peers and the local authority:
three 12-second group-view runs were **157.2–157.3 mean FPS** for seven neutral
VAT remotes and **169.4–169.5** for seven shaped exact remotes. VAT p99 was
7.1–13.5 ms, maximum 14.1; exact p99 7.2–8.0, maximum 10.7. All six runs have
zero intervals >16.67 ms and no cap flags or runtime/GPU errors. The fixed
spring-arm group camera is diagnostic; actors occupy their assigned spawn
positions and partially occlude one another. This reports eight occupied seats
and seven rendered remote representations, not eight fully unobstructed figures
or a milestone 8 crowd target. Different GPU work and settling mean exact/VAT
order is descriptive, not an isolated engine comparison.

A separate fresh server process, eight protocol clients, blank game browser,
no build/reviewer/recording: **901 server ticks in 30 seconds**. Its 1,002 eight-seat
samples (the initial moving/sanitization phase plus sustained mostly idle phase)
have mean **2.210 ms**, p95 **4.438**, p99 **6.348**, maximum **10.856**; zero
CPU ticks >16.67 ms. The metrics helper's `fps` is inverse CPU duration and must
not be read as server tick rate: the actual rate is 30 Hz / 60 Hz Havok.
Mostly unchanged-input traffic is **29–30 received B/s and 555 sent B/s per
client** over the sustained window. More varied motion/action/device runs retain
separate traffic counters. These are application WebSocket bytes, not TCP/TLS
or handshake overhead. Server RSS at the sample end is **175,226,880 bytes**.
A local M1 Max does not establish the remote basic-container CPU budget.

The selected host currently requires **$5/month Workers Paid**. Basic provisions
1/4 vCPU, 1 GiB and 4 GB disk; included monthly usage is 25 GiB-hours,
375 vCPU-minutes and 200 GB-hours. Excess rates are $0.0000025/GiB-second,
$0.000020/vCPU-second and $0.00000007/GB-second. At 720 continuously active
hours, provisioned memory plus disk would be about **$6.93** after those
allowances, before actual CPU, Workers/Durable Objects and other service costs.
Idle sleep changes that estimate. This is a planning estimate from the linked
current pricing, not a measured bill or a spending cap.

## Final integration checks

Keyboard and native HUD/touch controls share the existing input intent boundary;
no second key-map is maintained. Jump edges respect form focus and input resets.
Touch spell/attack replication, actual entry controls, accepted appearance
agreement, invalid-height preservation and leaving during local preparation all
pass on a 390×844 desktop touch context. Cancellation returns the surface to
Solo. This is not a physical phone result.

The real shared-region surface stays available in the normal clean game view.
An actual HTTP 503 on its optional late entry chunk leaves playable/ready/region true, the full background promise resolved and zero GPU errors. Solo region loading is preserved.
New server/networking files are formatted for review; non-obvious engine and
network boundaries carry primary documentation links.

## Motion delivery

Reviewed live capture uses two rendering clients, actual 1280×720 viewport,
canvas and source frames. Ordinary gameplay precedes a diagnostic spring-arm
spectator view of the actual remote actor. Source walking/actions, tall/slender
Wayfarer, short/stout Warden, native reconnect and disposal are visible.
Both clients in the final take join through the actual entry controls. The original far-camera/reduced-canvas take was rejected and not delivered.
The accepted MP4 is 1280×720, 15.109 seconds, SAR 1:1, rotation 0.

[VE motion](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/presence-ui-2026-10-01.mp4)
is Telegram **824**, with matching returned width/height. Public `video/mp4`,
HTTP 206 range, direct browser playback, seek and fullscreen pass. Telegram's
native inline/fullscreen presentation is not independently inspected.
The first delivered take (Telegram 823) has complete frame timestamps but lacks action-label timestamps. The final take (824) includes complete wall-time action labels and frame/viewport/canvas metadata.

## Hosting and remaining release gates

A separate one-instance Cloudflare Containers host is prepared in
`server/presence-host`, with a non-root Node image, fixed Durable Object name,
basic instance and 90-second idle sleep. The Linux image build succeeds. The
account's Containers API returned HTTP 401: deploying Containers requires the
Workers Paid plan. No paid-plan change or public backend deployment was made.
Existing production services were not altered.

The client panel is absent on production unless a verified `VITE_PRESENCE_URL`
is supplied. Public discovery/WebSockets/reconnect, container CPU capacity,
server/client compatibility and rollback still need verification. One instance
is an admission limit, not a hard billing cap. Container disk is not durable
character/reward storage. Authentication/entitlements/persistence belong to the
cooperative slice. Physical phone resource/input acceptance remains distinct
from desktop emulation and prior user device reports.

The deferred GPU first-use tail remains open. A final functional run timed out
on its second client's engine startup; another run was invalidated by a parent
source edit causing Vite reload. Both are retained. Controlled owned-browser
restarts are harness recovery, not proof of a startup-tail fix.

Primary references: [server input](https://docs.colyseus.io/netcode/server-input),
[prediction](https://docs.colyseus.io/netcode/client-prediction),
[reconnection](https://docs.colyseus.io/room/reconnection),
[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).

## Offline client release

Source **8ae4c2da698c900af4d6dff2aacc5ad4f50c3433** is deployed as
Pages **0c2f92c1-a4f8-43ab-838f-45c0f622df4b**. Rollback is
**1f745d0b-49d3-47bf-a0b5-b103a026b932** / source `32d2b01`.
All **372** staged artifacts match the public URL and five region cache-policy
checks pass. Production movement/cathedral entry-return at body endpoints,
transactional customization, touch/depth fallback and desktop WebKit pass.
The production presence panel remains gated off: this releases the compatible
offline client foundation, not a publicly hosted multiplayer service. Telegram
824's ledger is updated to the finished source commit.
