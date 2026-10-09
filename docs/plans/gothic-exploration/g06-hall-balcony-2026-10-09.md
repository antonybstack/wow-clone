# G06 — Connect Eastwatch's wall walk to its upper hall

**Implementation active after G05's public circuit/delivery/cleanup.** Baseline
805fac1 (G05 product c3419d4). Use the delivered
Eastwatch courtyard, raised-window and hall captures as the baseline, together with
the retained fortified-entrance reference. Reuse existing masonry batching,
pointed portals, guards, Havok, exploration metadata and developer destinations.

## Playable outcome

An ordinary player climbs G05's existing stair, follows the rear wall, crosses a
guarded bridge through the pointed raised opening and enters a supported hall
balcony. The player can look back toward the gateway, return to the rear walk,
finish its left branch and descend normally. The ground hall remains accessible
underneath. Preserve the other keeps/towers, terrain/routes, roof/skyline, existing
motifs and starting area's exact prepared geometry. This adds one connected space;
there is no new camera, input, physics or runtime geometry subsystem.

## Authored geometry — Eastwatch local frame only

Use `region-structures.js`'s existing `map(u,y,d)`; y is relative to the keep floor.
Reuse the wall walk's y5.2 top. Verify these placements against the actual source
before writing them; the pointy opening is at d15.5 and the hall spans u±6.5.

- Balcony: a .25 m slab, u−2.5..2.5, d9.1..14.5, top y5.2. This stays clear of
  hall wall buttresses (u≈±7.15), existing lower furnishings and upper keep body
  (bottom y10.2). It leaves 4.95 m beneath its slab in the ground centre lane.
- Bridge: .25 m slab, u±1.5, d14.5..16.4, top y5.2. Its joints meet the balcony and
  rear walk directly. Replace the centre u±1.5 section of the d16.4 inner parapet
  with a protected connection. Keep the remaining sections u−12.4..−1.5 and
  u1.5..12.4 and their trim; do not leave overlapping collision across the bridge.
- The existing 3 m lancet tapers to about 1.81 m at y7.15. Since it becomes a door,
  widen Eastwatch only to 3.8 m, spring y6.4, tip y9.0, bottom y3.2. This remains
  under the roof's y9.7 lower edge and gives >2.6 m width at 1.95 m above the new
  floor. Keep the existing pointed profile, wall thickness, portal batching and
  other keeps' window dimensions. Store actual opening dimensions in metadata.
- Solid guards: 1.1 m above floor with trim, bridge edges u±1.5/d14.5..16.4, balcony sides
  u±2.5, balcony front d9.1. Open only the bridge/back junction. Preserve at least
  1.8 m clear travel and 1.9 m headroom throughout, including the pointed door.
  Stop bridge guards at d16.4, before the rear walk's d17.6 turn centre; extending
  them to that centre would block the transverse wall-walk route. The rear slab
  already supports d16.4..18.8, so a longer bridge would duplicate its top faces.
- Visible masonry support: paired narrow piers near u±2.5/d9.6 plus restrained
  corbels/beam beneath the balcony. Keep their inner faces outside the existing
  3 m ground hall lane; do not introduce a broad solid foundation underneath.
  Inspect lower-camera clearance as well as player headroom.
- At most two restrained wall-side stone seats on the balcony; leave the centre
  route clear. No new textures, lights, materials or external assets are needed.
- Live balcony review exposed the existing hall's open triangular gables above
  its y10 portal walls. Close Eastwatch's two ends with the existing shared prism
  path, from u±7/y10 to u0/y15.1, beneath the roof. Preserve the silhouette and
  raised opening. Check these visible/collision faces with rays at y11/u5.2.

All new solids go through the existing shared visible/collision box/prism paths.
Keep G05's intentional tread/ramp difference unchanged and the 13,000 render
triangle guard. Compute/report actual separate totals and packet deltas. Explain
the raised-door clearance and existing Lite mesh pattern in source comments with
the pinned documentation link already used in G05.

## Metadata and reproducible controls

Publish `wallWalk.hallBalcony` containing floorY, landing, inward yaw and route
waypoints. Extend the existing full wall-walk route with a rear-centre→door→balcony
visit and return before its left branch. Add **Eastwatch — hall balcony** through
the existing ?dev menu/spawn-link handler; teach the expected-floor checker to
read this metadata. Do not add a hidden placement shortcut or duplicate coordinates
in minimap/ordinary registry. Its parent landmark remains Eastwatch.

## Focused implementation and verification sequence

1. Inspect G05's actual rear opening/hall captures and source; confirm slabs,
   guards, support, furnishing and roof bounds in the keep local frame.
2. Implement Eastwatch-only geometry and plain exploration metadata. Reuse all
   existing helpers and timers; append the developer destination and adapt the
   existing native climb checker rather than writing another controller.
3. Extend CPU floor/headroom/guard/ground-lane/portal checks for the new bridge and
   balcony, including capsule-width offsets and the widened opening. Keep all
   G05 stairs/turns/guard/winding/budget checks and other structure fixtures.
4. Prepare packets before the accepted four-flag Pages build. Confirm required
   near and foliage bytes remain exact and validate all optional block ranges.
5. Native local keyboard tour: gate→courtyard→stairs→rear→balcony→rear→left branch→
   stairs→ground hall→gate. No Fly/recovery teleports; test balcony front/side
   guard contacts, real portal clearance and the lower hall route. Check all
   developer destinations, including the new landing and spawn link.
6. Capture that ordinary-camera movement with the existing timestamp manifest.
   Root reviews actual MP4 and useful views above/below; correct specific faults.
7. Measure separately with one owned renderer: M1 Max, uncapped Chromium WebGPU,
   1280×720/DPR1, seven enemies, three 12-second windows on each existing five-route
   benchmark. Retain all raw intervals/pacing flags and the >120/144 FPS gates.
8. Commit/push, seal and publish the exact bytes as a new desktop preview. Verify
   served assets and repeat the modified native climb, all developer landings,
   ordinary map and Eastwatch ground entry/return. Preserve G05's unchanged-road
   eight-landmark evidence; broaden traversal only for a specific new concern.
9. Publish root-reviewed motion to VE, verify exact bytes/MIME/range/playback and
   deliver it via `tg file`. Record actual results/limitations, fresh production
   metadata, and close all owned contexts/servers/review tabs. Commit/push closeout
   and re-record the delivery ledger against that final documentation commit.

One bounded Grok source review may assess at most three concrete risks: pointed-door
clearance, guard cuts/joins and lower-lane support. Require an observed checkpoint
after the first batched read; permit only one report-only resume. Root owns acceptance.
Production's independent startup qualification, physical mobile, combat and
character changes remain outside this slice.
