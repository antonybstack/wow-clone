# G06 — Eastwatch hall balcony: functional preview, FPS gate pending

Product **1b35554** is committed/pushed. [Desktop verification preview](https://2fd14837.fardel.pages.dev/?dev&play&at=east-keep-hall-balcony).
This is a functional/visual preview, **not a completed performance qualification or production release**.
[Implementation plan and documentation references](../../plans/gothic-exploration/g06-hall-balcony-2026-10-09.md).

## Playable result

G05's visible courtyard stair and rear wall walk connect through a widened pointed
doorway to a supported interior balcony. The guarded bridge ends at the rear
walk's inner edge, leaving its transverse turn open. The balcony has side/front
guards, masonry piers/corbels and two wall-side seats. The existing ground-floor
hall lane remains clear underneath. No new camera, input, physics subsystem,
textures, materials, lamps or runtime geometry generation were added.

Live review revealed inherited open triangular hall gables from the raised
viewpoint. Eastwatch's two gable ends now share visible/collision prisms beneath
the retained roof outline. The other keeps/towers remain unchanged. The existing
Developer tools UI includes **Eastwatch — hall balcony**, its Jump control and
shareable `?dev&at=east-keep-hall-balcony` spawn link; no hidden test-only placement.

## Verification

- **48 focused CPU checks pass**, including **10 structure tests**: floors,
  doorway capsule-width offsets/headroom, lower lane, guards, gables, G05's
  stairs/ramp/winding/budget, region layout/stream/ranges and prepared inputs.
- The accepted Pages profile passes with saved bootstrap, prime starter world,
  lazy world buffers and deferred covered hair enabled; build observed 2.21 s.
- Final local/public native ascent, full U route, balcony entry/return, lower
  hall/under-balcony walk and gate return pass: **55 samples and six guard
  contacts each**, Havok active, Fly off, zero recovery teleports and runtime/GPU
  errors. God mode only prevents combat damage; motion and contact remain normal.
- **20 developer destinations** plus shareable-link gate, God/Fly controls,
  keyboard focus and resumed walking pass locally/publicly. Ordinary map's eight
  selections, selection clearing, independent objective marker, pause/focus,
  disposal and resumed Havok walking also pass locally/publicly.
- The focused local/public Eastwatch ground circuit enters/returns on ordinary
  keys: public61 samples,54 in the site's route,two connecting legs and final
  cathedral bridge return pass without Fly,recovery teleports or errors.
  G05's unchanged-road eight-site
  circuit remains retained separately; this slice does not claim a new full tour.
- **649 served checks pass** against the sealed files, with **323 classified
  cache policies checked**. An initial verifier command used the wrong script
  directory and never ran; the corrected existing verifier passed. This was an
  operator path error, not a product or network failure.

The final generator reports **11,456 render / 11,072 collision triangles**.
Their 384-triangle difference remains G05's visible stair treads versus smooth
collision ramp. Required near packet is still exactly **149,963 encoded bytes**;
foliage remains exactly **4,413,215**. Optional region is **22,401,010 encoded /
158,144,000 raw bytes**, +10,867 encoded/+102,240 raw against G05. Geometry receipt
retains actual hashes/ranges; no full arrays or guessed packet schemas are needed.

Grok 4.6/high completed its bounded source review in eight CLI turns with an
observed first-read checkpoint and no report-only resume. Three assessed risks
had no consequential finding. Root corrected the report's rear-deck arithmetic
(16.4..18.8, not16.4..19.6); final native contacts qualify actual joins. The review
predates the gable correction and provides no live/performance acceptance.

## Performance remains pending

**No new FPS benchmark was run or accepted.** Fresh user Chrome audit showed New
Tab and Edge retained its fifteen user tabs, including Shadowglass previously
observed suspended. The browser tool rejected the internal status page, so its
current renderer status could not be freshly qualified. The owned blank tab left
by that rejected navigation was discovered and closed. Root asked the user for
its current closed/suspended/running state; no reply had arrived during this pass.
Do not bypass that browser restriction or close unrelated user tabs.

Once isolation is established, the remaining gate is three 12-second windows on
each of the existing five routes: M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1,
seven enemies, all raw intervals/tails/pacing flags retained, >120 FPS floor and
144 FPS target. Recording HUD values are not that gate. G05's separately measured
189.9–229.0 FPS does not substitute for G06 qualification. Keep the milestone open
and preserve sequential acceptance before starting another visual implementation.

## Motion and release state

Root reviewed the actual **63.055399-second MP4**, including replay, plus raised
and lower hall views, and played [the direct VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/hall-balcony.mp4)
to its end without a playback error. **Telegram message 898** returned matching
1280×720 dimensions/duration. Application inline/fullscreen remains unverified.
The capture has **1,557 timestamped frames**, square pixels, rotation0; remote
31,834,657 bytes exactly match local SHA256
`d61b65b532fec8c8dbf7b4f2cf9a3730bc51ebae88c01b33a120b213a7f8a242`.
HTTP200 `video/mp4` and an exact 1,024-byte HTTP206 range pass.

Preview **2fd14837**, alias `g06-hall-balcony-2026-10-09`, seal
`829015afe8296c21f4be31a2286267758afa529cdeb241471dba5ea82bf4da68`,
646 files/374,135,629 bytes. Fresh Cloudflare project metadata at
2026-10-09T11:28:48.952Z confirms production unchanged:
**5723a4ab-5dfd-4902-959b-7496948ea51f / 7d00c56c06f02899e2319ffdddea97728013c0b1**.
Independent startup release hold and physical mobile remain deferred.

Owned Chrome38823/CDP10037, Vite38794+38818/5873, compiled68298/7074 and
media74125/7077 are stopped; final process/listener audit finds none remaining.
All native contexts and review tabs1147996166/1147996170 are closed;
source Grok25975 is done. User Chrome remains New Tab and Edge's fifteen user
tabs remain unchanged. No owned renderer/harness remains. The unrelated
Shadowglass status question remains pending.
