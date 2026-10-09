# Experimental physical-core region loading — 2026-10-09

Implemented as an optional developer experiment. Existing single-region packet
remains default. No paired load-time or settled FPS acceptance is claimed; current
rendering status of an unrelated user Shadowglass page is unresolved. This is a
functional candidate, not a production release or a proven load-time improvement.

Use `?dev` → Menu → Developer tools → select a destination → **Reload with physical
surfaces first (experimental)**. Reload preserves the selected `at=` destination
and adds `regionCore=1`. Its spawn links retain that mode. The flag is inert without
`?dev`. The same panel can reload with standard region loading.

## Actual implementation and checks

- Core:842 unchanged blocks /107,836,840 decoded bytes /14,389,733 encoded bytes.
  Detail:195 full-tree blocks /50,307,160 decoded /10,640,787 encoded. Combined
  transfer rises11.7%; candidate core is35.8% smaller than the default22.4 MB packet.
  Required near/skyline/default-region/foliage bytes and all74 mesh records remain
  exact against G06. Build verifier compares every split attribute with the
  original stream, checks hashes, partition, byte layout and aggregate storage
  coverage. Experimental package schema1 extends the existing schema1 index;
  the independent optional index grows80,795→98,685 encoded bytes.
- Navigation waits for validated core EOF, every non-full-tree record's complete
  index/vertex ranges and all remaining box colliders. Native Havok/mesh installation,
  one-ms yielding, native HTTP-Brotli and existing scene cancellation are reused.
  Required first-play assets are unchanged; no new first-play timing qualification.
- Desired detail retains100/140 m hysteresis. A completed reduced representation
  stays visible until all full ranges arrive. Ordinary/shadow visibility share
  that choice; native transform invalidation/revision updates cached shadows,
  including menu-paused arrivals. Partial full allocation does not hide trees.
- **70 CPU checks pass** across region streaming/completion, baked woodland,
  prepared packet equivalence/corruption, structures/cathedral/terrain, developer
  picking, region layout and startup assets. Four-flag startup build passes2.62s.
- Five native functional cases pass: default loader/native reload toggle preserves
  selected spawn; truncated detail after two installed ranges retains all27 reduced
  tiles and safe navigation, UI jump/ordinary movement, then retries detail only
  (core requested once/detail twice); core503 keeps navigation/jumps closed and retry
  succeeds; flag inert without dev; disposal aborts held detail without resurrection.
  Deliberate core503 console responses are retained separately. All other tested
  page/GPU error collections are empty. No recovery teleports or Fly during successful
  ordinary movement. Partial failure before retry has44 allocated records; completion
  has71, without duplicate block/collision ownership.
- Twenty native UI landings/spawn-link gate/God/Fly/focus/walking pass; six native
  solid-surface picks pass. Ordinary Eastwatch ascent, balcony/upper circuit,
  lower hall and return pass,55 samples/six guard contacts, Havok/no Fly/zero
  recoveries or runtime/GPU errors. These local compiled correctness checks are
  not timed benchmarks. G05's unchanged full-region route proof remains retained.
- A separate native capture holds detail while navigating normally and using
  existing public UI overlooks at Vaelmark and returns to the bridge, then releases full detail.
  All27 reduced tiles persist before release; completed full representations arrive
  without blank tiles. Capture retains fixed1280×720/DPR1, source timestamps,
  square pixels and rotation0. HUD throughput is not an accepted FPS measurement.

## Independent review and parent adjudication

Grok4.6/high inspected source in session01a1208c-885f-7491-93aa-83cd00bbcb26;
first-read checkpoint was observed. It reached eight turns (`cancelled`, exit1)
with the partial [source report](source-review.md). Its unread-file questions are
not verified defects. Root inspected the verifier/woodland/UI: collision in detail
is rejected at bake and runtime, exact aggregate coverage is proved, incomplete
full allocation stays hidden, and mode is gated by dev. Root additionally requires
all physical records complete before opening navigation and prevents later detail
from overwriting the first geometry-block timing mark. Default ordered-stream
completion remains unchanged; out-of-order completion tracking applies to candidate.
The report's claim that generated packets are stale describes its earlier read,
not the subsequent completed preparation/build. No report-only probe was repeated.

## Qualification still required

Three isolated cold local50Mbit/s pairs, ≥20% median safe-navigation improvement,
first-play/tail accounting and fifteen settled FPS windows remain deferred. The
current unknown external renderer prevents qualifying those measurements. G06's
separate FPS gate and production's separate required-texture startup hold remain.
Physical iPhone acceptance/mobile device-loss investigation remain backlogged.
No promotion of the experimental mode to default follows from these green tests.

## Delivery and ownership

Sealed desktop preview, served artifact counts, public native checks and root-reviewed
VE/Telegram motion are recorded below after delivery. Root owns Chrome74078/CDP10037,
Vite74043+74067/5873 and compiled88134/7074 during checks; one game context at a time.
User Edge2931/fifteen tabs, Chrome13883/New Tab, Orca and unrelated Vite4000 are preserved.
Final ownership teardown is recorded before handoff. MP4/capture frames are local
`.cache/region-core-candidate-2026-10-09`, public MP4 is durable after upload.
