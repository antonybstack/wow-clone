# G06 source review — hall balcony / bridge / native checker

Independent Grok 4.6/high review. Three named risks only. No live acceptance, no source edits, no browser.

**Root evidence:** the nine tests in `scripts/test-region-structures.mjs` (root says they pass; this review did not re-run that file) and the native checker `scripts/ashen-reach/check-wall-walk.mjs` (read, not executed).

**This review’s checks:** full keep/upper-route body in `src/ashen-reach/region-structures.js` (keep `if`, east-keep wall-walk, balcony/bridge, `portal`/`box`), plus one Node collision-occupancy probe on Eastwatch with the same builder and Möller–Trumbore hit as the tests (`groundHeight:()=>2`). Probe results are the `hits` fractions below.

## Risk 1 — bridge slab/guards stop at d16.4; rear turn at d17.6 open; inner-parapet cuts

**Builder (this review, `region-structures.js` 227–256, 267–273):**

`box(u,y,d,w,h,depth)` is a full-extent volume centred at `(u,y,d)` (confirmed by probe floors at fraction 0.5). `walkY=5.2`, `width=2.4`.

| Piece | Call | Occupies |
| --- | --- | --- |
| Rear walk deck | `box(0, walkY-.125, 17.6, 29.6, .25, 2.4)` | d **16.4–19.6**, u ±14.8 |
| Bridge slab | `box(0, walkY-.125, 15.45, 3, .25, 1.9)` | d **14.5–16.4**, u ±1.5 |
| Balcony slab | `box(0, walkY-.125, 11.8, 5, .25, 5.4)` | d 9.1–14.5, u ±2.5 |
| Bridge side guards | `box(±1.5, walkY+.5, 15.45, .22, 1, 1.9)` | d **14.5–16.4**, inner face \|u\|≈1.39 |
| Rear inner parapet | `box(±6.95, walkY+.5, 16.4, 10.9, 1, .22)` | d 16.29–16.51, u **1.5–12.4** and **−12.4–−1.5** |

Bridge slab and its guards **abut d16.4**; they do not continue onto the rear deck. The d17.6 turn sits on the rear walk (centre of 16.4–19.6). Inner parapet cut is **u ∈ (−1.5, 1.5)** (3.0 m), matching the bridge width. Parapet depth 0.22 centred on the joint puts 0.11 m of rail onto each side of d16.4 at \|u\|≥1.5 (continuous jamb at the opening, not a slab overlap).

**Probe (this review):**

| Sample | Hit fraction | Reading |
| --- | --- | --- |
| floor d17.6 / d16.6 / d16.4 / d15.45 | 0.5 | decks present, abut at 16.4 |
| centre y=5.8 d17.6→14 | null | turn + cut open on centreline |
| +u at d17.6, y=5.8, u 0→2 | null | no bridge guard on the rear turn |
| inward at u=0.9 and u=1.2 | null | cut includes capsule offsets used by the balcony test |
| inward at u=1.6 and u=6 | 0.606 → d≈16.51 | parapet face at the cut jamb and along the rear rail |
| +u at d15.45 and d16.3 | 0.695 → u≈1.39 | bridge guards exist up to the joint |
| +u at d16.5 | 0.75 → u=1.5 | rear-parapet jamb (d≤16.51), not a bridge guard past 16.4 |

**Root tests (compatible, do not pin 16.4):** high-floor samples include d17.6; rear inner parapet solid at u∈{−10,6,10}; centreline open at y=5.8 d17.6→14; bridge side guards probed at **d=16** (inside 14.5–16.4). No test names the literal 16.4.

**Verdict:** Risk 1 is not present in the builder or the occupancy probe. Slab/guards terminate at d16.4; d17.6 is an open transverse turn; inner parapet is cut at \|u\|<1.5 in line with the bridge.

## Risk 2 — pointed-door width/headroom at floor 5.2; lower lane under supports

**Builder:** rear lancet `portal(15.5, 3.8, 14, 10, 1, 6.4, 9, 3.2)`. Wall at d 15.0–16.0 (middle of the bridge). Jambs leave a rectangular opening **u ±1.9 (3.8 m)** from sill y=3.2 to spring y=6.4, then `archPoints` to tip y=9. Floor 5.2 is 2.0 m above the sill, still in the straight jambs, so walking-height door width is **3.8 m**. `archPoints` at y=7.15 (1.95 m above the floor): h=2.6, c=(h²−half²)/(2·half)≈0.829, r≈2.729 → half-width ≈ **1.795 m** (full ≈3.59 m). Comment at 247–248 (“>2.6 m at 1.95 m above the new floor”) matches. Published `hallBalcony.clearWidth=2.6`, `headroom=1.95`.

Usable raised *passage* onto the rear walk is tighter than the lancet: bridge/parapet opening **3.0 m** (clear ≈2.78 m between guard inner faces at \|u\|≈1.39). A walker at \|u\|=1.8 clears the door at y=5.8 and then meets the parapet at d≈16.29.

Balcony supports: `box(±2.5, 2.475, 9.6, .35, 4.95, .5)` → \|u\| 2.325–2.675, y 0–4.95, d 9.35–9.85. Corbel prism \|u\| 1.7–2.3, y 4.2–4.95. Slab underside y=4.95. Hall centre lane \|u\|≤1.3 does not meet either.

**Probe:**

| Sample | Hit | Reading |
| --- | --- | --- |
| door y=5.8 and 7.15, u=0, d14→16.5 | null | opening through the wall |
| door y=7.15 u=1.2 | null | capsule-width at pointed height |
| door y=7.15 u=1.8 | 0.256 → d≈14.64 | archivolt; arch has narrowed (half≈1.795) |
| door y=5.8 u=1.8 | 0.916 → d≈16.29 | passed the 3.8 m door, hit parapet jamb |
| jamb y=5.8 u=2.2 | 0.256 → d≈14.64 | solid jamb/trim outside ±1.9 |
| vertical 5.24→7.15 at d=15.5, u=0 and 1.2 | null | 1.91 m headroom in the opening |
| lower lane h=1.95, u=0 and 1.3, d8→13 | null | hall under balcony open |
| +u through (2.5, 1.0, 9.6) | 0.406 | support is real |
| vertical 2.0→5.1 at d=11.8 | 0.952 → y=4.95 | slab underside; ~4.95 m hall headroom |
| ground h=1 through door d14→16.5 | 0.4 | 3.2 m sill; ground cannot leave by the raised door |

**Root tests:** `clearWidth>=1.8`, `headroom>=1.9`; balcony floor/headroom on u∈{−.9,0,.9}; raised-door rays at y=7.15 u∈{−1.2,0,1.2}; lower lane d8→13, u∈{−1.3,0,1.3}, h∈{.2,1,1.95}; `rearWindow` locked to `{bottom:3.2,spring:6.4,tip:9,width:3.8}`.

**Verdict:** Risk 2 is not present at the raised floor. Pointed door at y=5.2 is the full 3.8 m; 1.95 m capsule headroom is clear on centre and at u=±1.2; lower lane under the balcony/supports is clear. Ground-floor passage through the rear lancet is blocked by the sill (stated design). Limiting raised width is the 3.0 m parapet/bridge cut, not the lancet.

## Risk 3 — native checker: safe turns, public spawn/WASD/menu, new guards, no hidden placement

**Checker (`check-wall-walk.mjs`, this review’s read):**

- URL sets `dev`, `play`, `clean`, `at=east-keep`, `pixelRatio=1`. Report: `initialPlacement: 'public developer spawn link only'`.
- Menu: Escape → `Developer tools` → `God mode: off` if present → Escape.
- Motion: `a`/`d` to face, `w` to walk. `finally` releases w/a/d. No `evaluate` that writes player position after load. `evaluate` only reads `ASHEN.player` / destinations.
- Validity: physics on, not flying, recoveries frozen (start recoveries asserted 0).

**Published route (builder 267–269), walked outbound then reversed:**

`[0,0,-10] → … → [13.6,5.2,6] → [13.6,5.2,17.6] → [0,5.2,17.6] → [0,5.2,14] → [0,5.2,10.6] → [0,5.2,14] → [0,5.2,17.6] → [-13.6,5.2,17.6] → [-13.6,5.2,-8.8]`

Index 4 is the stair landing, 6 the rear-turn window, 8 the balcony (screenshot gated on `hallBalcony`). The checker therefore follows the d17.6 turns and the parapet opening on the public route.

**New contacts** (after capture stop; still `go`/`face`/`w` only), gated on `hallBalcony`: `bridge-right` at (0,5.2,15) expect u∈[.85,1.2]; `balcony-front` at (0,5.2,11.4) expect d∈[9.45,10]; `balcony-right` at (0,5.2,13.5) expect u∈[1.85,2.2]; then centre 13.5 and return to (0,5.2,17.6). Those windows match a ~0.3 capsule on the probe’s guard faces (bridge inner u≈1.39, front inner d≈9.21, balcony inner u≈2.39). Pre-existing `rear-inner` at u=6 still meets the uncut parapet (probe face d≈16.51). Contacts-return is `route.slice(0,6).reverse()` then `site.entrance` (right-hand descent after the balcony return to d17.6).

Hardcoded contact coordinates duplicate the builder locals; they do not teleport. Ownership purpose string still says `G05 native stair…` (label only).

**Verdict:** Risk 3 is not present in the checker source. Initial placement is the public `at=` spawn; all later motion is WASD plus the developer-tools god-mode-off click; the published route includes the safe turns and balcony; new bridge/balcony guards are contacted and the path returns to d17.6 then the gate. This review did not run the checker.

## Root nine CPU checks

Named in `scripts/test-region-structures.mjs`. Root reports they pass. This review did not execute that file. The occupancy probe used the same `buildRegionStructures` + triangle hit path and agrees with the balcony/guard/door assertions it overlaps.

## Not checked

- Live native tour, Havok vs CPU rays, FPS, GPU, capture, Telegram.
- Non-Eastwatch keeps/towers beyond shared tests.
- Lighting, materials, animation.
- Rest of `region-structures.js` (courtyard, stair tread/ramp split, batch policy).
- Whether `masonryBox` edge sharing at d16.4 produces a double-faced seam (occupancy is still a single floor).

Stop. Three risks assessed.
