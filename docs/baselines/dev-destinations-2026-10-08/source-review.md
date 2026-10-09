# Dev destinations UI — Grok review (2026-10-08)

Source-only review of `src/ashen-reach/dev-destinations.js`, `dev-tools.js`, `menu.js`, the owned `main.js` / `ashen-reach.html` diff, `player.js` `setWorldPos` / `setFlying`, and cathedral metadata used by destination ids. No source edits, browser, builds, or agents.

Intent checked: every new helper is in `?dev` UI; nave/undercroft spawn and `at=` links wait for region collision.

## Verdict

No confirmed defects.

Dev stays behind `?dev` / menu `setEnabled`. `at=` is ignored without boot `?dev` and is cancelled if dev is off when `whenRegion` settles. Jump and the share-link waiter both require `isRegionReady()` after `ashen.regionReady` is set, so they do not extend the first-play fence. Placement uses existing `setWorldPos` / `setFacing` on authored floors (`capsuleHeight * 0.5 + 0.12`). Fly-off restores the pre-ground pose so native `setFlying(false)` does not snap elevated floors to terrain. Menu disables jump until ready, keeps the copy field in the dialog tab loop, and swallows game keys while open. Undercroft id resolves to the first in-bounds chamber-floor route point (`[-7, crypt.floorY, 337]`).

## Unverified limits

This pass did not re-run the native 18-floor UI check (already reported passing: Havok walking, nave fly on/off, God, copy-field focus/Tab, undercroft spawn link, `at=` without `?dev`). Failure, death, device-loss, and disable-during-load races were not executed; existing tests are not proof of those paths.
