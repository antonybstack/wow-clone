# G07 cathedral-guide source review

2026-10-09. Independent source-only review of
`src/ashen-reach/cathedral-guide-data.js`, `cathedral-guide.js`, and
`region-map.js` (one pass). No metadata, menu owner, `map-drawing.js`,
tests, browser, or live check. No approval. No FPS claim.

Two risks only: (1) authored-route schematic / floor / tower altitude /
projection / player marker; (2) existing region-menu hidden / focus /
selection / abort, with no first-play import or frame hook.

## Risk 1 — schematic, altitude, marker

**Tower marker is wrong on flats and above the landing.**
`cathedralGuideLocation` keeps a tower id while
`stair[0].y + 0.6 < feet.y <= landing.y + 0.8`
(`cathedral-guide-data.js:52`). The overlay then parameterizes the
profile only by height (`cathedral-guide.js:46-47`):

- `findIndex(p => p.height >= height)` is `-1` once the player is above
  the last stair sample (the `+ 0.8` band). `Math.max(0, i)` / `i-1`
  both collapse to `data[0]`, so the cream dot jumps to the terrace
  door while `y = 490 - height/last.height*380` continues past the
  drawn landing.
- When a sample pair shares a height, `t` is forced to `0`, so the dot
  cannot travel a switchback landing even though distance along the
  authored stair is the axis the diagram claims to plot
  (`cathedral-guide.js:21`, `cathedral-guide-data.js:57-59`).

Bell landing is the tower view’s only marker. Both cases are in the
altitude window that view uses.

No other consequential defect is proven from these three files. Ground /
undercroft / gallery polylines are `floorRouteSegments` of existing
`waypoints` / `crypt.route` / `gallery` / `parapet` / chapel `stairs`
(`cathedral-guide-data.js:17-18, 28, 34`). Tower levels plot `t.route`
as distance vs height and label that it is not a floor plan (`:41-45`).
The code does not add Havok surfaces or new walkable geometry.

## Risk 2 — region-menu lifecycle

**No defect proven in this file set.** `cathedral-guide.js` is imported
only by `region-map.js` (`region-map.js:4`). Construction, paint, and
`refresh` are open / click / change / abort — no `requestAnimationFrame`,
render-loop, or player tick (`cathedral-guide.js:4-7, 70-73`;
`region-map.js:57-58, 66-70`). Guide and map share the menu `signal`;
guide registers abort first and removes its own nodes
(`cathedral-guide.js:70`, `region-map.js:66`). Back hides the guide,
unhides the region chart, repaints, and focuses `guideButton`
(`cathedral-guide.js:66`, `region-map.js:11`). Destination `selectedId`
stays on the map instance while the guide is up.

Whether `region-map.js` itself is a first-play import, and whether the
menu abort/hide/focus path matches this, is not in these files.

## Unchecked

- `public/ashen-reach/startup/starter/manifest.json` `metadata.cathedral`
  numbers: floor Δy vs the `0.8` band, terrace vs nave vs gallery AABB
  overlap, `p[1] === crypt.floorY` doorway (`cathedral-guide-data.js:29`),
  chapel `stairs` / `gallery` / `parapet` identity of the two extra
  gallery segments (`:35`), tower `last.distance` / `last.height` ≠ 0.
- Region-menu owner: overlay hide vs abort, container replace, focus on
  reopen. `open()` refreshes the guide when `guide.isOpen`
  (`region-map.js:68`); that is only a defect if close leaves the guide
  unhidden and the next open is supposed to be the region chart.
- `createMapTransform` / `paintPlayerPin` / `strokeMapRoute` contract
  (`map-drawing.js` unread). Floor `project` is `(x,z) → [u, v+64]`
  (`cathedral-guide.js:29-30`); assumed compatible.
- `e.chapels` is unguarded after the undercroft/gallery/towers check
  (`cathedral-guide-data.js:11-17`). Throw vs empty chapels not shown.
