# Current state and immediate focus — Ashen Reach

Updated 2026-09-27. Read this file first. Follow the latest user request; historical milestone documents are not an active task queue.

## Immediate focus: customizable characters and scalable crowds

The user selected a long-term direction of customizable Human characters, existing Undead/Orc and future Elf support, 30 mixable armor sets, recurring quarterly PvP tiers, and crowded MMO hubs. The recommended architecture is authored/generated source art converted into compatible templates, procedural fitting/assembly, and progressively cheaper crowd representations.

**M001 and M002 are complete; M003 is next.** The [M001 result](plans/character-mmo/results/m001.md) records the active asset census, fresh baseline and live motion. The [M002 result](plans/character-mmo/results/m002.md) records the pure versioned appearance recipe, seeded fixtures and live committed-state probe; the Pages play output is byte-identical. All eight active Undead garments have a different rest/inverse bind from their body even though their fit labels match; the existing Undead equipment suite tests the older provisional pack. Treat that as a compatibility blocker for exact shared-pose crowd grouping. Do not resume old graphics or world-expansion milestone queues.

Fresh local M001 measurements on M1 Max, uncapped headless Chromium WebGPU at 1280×720 with seven enemies: five-route mean FPS **190.5–219.5**, with intermittent bridge/cathedral/forest pacing tails and a **14.1 ms** worst sampled interval. Twenty fresh-process 50 Mbit/s / 40 ms starts had p95 **802.1 ms**, **19/20 <=1 second**, and a first-run GPU completion outlier of **9,149.4 ms**. These are local built-preview measurements, distinct from the released production figures below. Reviewed live Human/Orc/Undead motion is [VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m001-motion-v2-2026-09-27.mp4), Telegram **788**.

- [100 milestones in ten categories](plans/character-mmo/vision-roadmap.md)
- [Next ten: scope, dependencies and exits](plans/character-mmo/next-ten.md)
- [Shared execution and performance contract](plans/character-mmo/execution-contract.md)
- [M001: completed asset census and fresh baseline](plans/character-mmo/results/m001.md)
- [M002: versioned appearance recipe](plans/character-mmo/m002-appearance-contract.md)
- [M002: implementation and verification result](plans/character-mmo/results/m002.md)
- [M003: native crowd feasibility](plans/character-mmo/m003-crowd-feasibility.md)
- [Architecture decisions and sources](plans/character-mmo/architecture.md)

The first three are bounded evidence/contract/prototype work, with no production art replacement or deployment. No count of fully detailed simultaneous players, quarterly delivery date, or arbitrary slider capability has been established. Backend selection and broader multiplayer gameplay are future gated work.

## Shipped game and latest release

The active game is root `index.html` / `ashen-reach.html`, Vite **5173**, debug global **ASHEN**. Babylon Lite **1.31.1** / WebGPU and Havok **1.3.14** remain pinned. The current region is finite; source-compatible animation, equipment, spells, terrain and cathedral traversal remain the playable foundation.

Production: [play.sparkify.dev](https://play.sparkify.dev), game source **`76e3c41bf24956b85d3ea0776d571eebea6c7e91`**, Cloudflare Pages **`72fd1e3d-7d8d-4108-8f0f-d8eb9a42cbfe`**. Rollback **`279d43aa-65e8-43ca-a454-e1bccff1d4c8`**. Subsequent documentation-only work does not imply a new game deployment. The [release report](complete/2026-09/one-second-startup-implementation-2026-09-27.md) records all 218 checked release resources and verification.

On M1 Max, uncapped Chromium WebGPU, **1280×720, seven enemies**, three separate 12-second runs per route, isolated and without recording: **194–231 mean FPS**, worst sampled settled frame **12.3 ms** across meadow/town/bridge/cathedral/forest. This is not a hundreds-of-characters benchmark or a per-frame 144 FPS guarantee. Removing abandoned GPU harness pages and fixing prototype shadow stride resolved the reported regression.

Progressive startup reaches a dressed, grounded, controllable starting area while the remaining region loads behind a physical frontier. Twenty fresh-browser production runs at **50 Mbit/s / 40 ms** gave **p95 979.4 ms**, **19/20 <=1 second**, maximum **1,054.5 ms**. Unthrottled p95 **597.1 ms**; three 10 Mbit/s / 80 ms trials approximately **3 seconds**. Network/OS/driver qualifications and background-loading frame tails are in the release report. Physical iPhone startup, memory and crowd capacity are unmeasured; the user previously reported about 60 FPS on iPhone 14 Pro Max.

Reviewed [production motion](https://ve.sparkify.dev/wow-clone/ashen-reach/startup-2026-09-27/production-walk.mp4) is Telegram **786**, matching 1280×720 metadata. Movement, mobile input/depth fallback and desktop WebKit passed the reported release checks.

## Current character boundary and unresolved risks

- The [M001 parsed census](baselines/character-mmo/m001/asset-census.json) identifies active Human/Orc/Undead and startup Human geometry, bind and animation. Human and Orc garments match their bodies; all eight active Undead garments have a different rest/inverse bind. The older MakeHuman diagnostic profile and provisional Undead pack are not active defaults.
- Existing equipment has explicit fit identities, coverage/slot occupancy, on-demand loading, shared pose and evaluated sockets. It is a limited fitted catalogue, not a general parametric wardrobe. Arbitrary body sliders, production Elf, robust semantic coverage across all races and crowd rendering remain unproven.
- Anatomy/clothing quality, extreme motion clipping, two-handed/Orc grip polish and terrain-aware feet need measured review. Old plans sometimes contain later superseded fixes; use live evidence to identify what remains.
- Static sun-shadow caching and asynchronous shader trials were negative/neutral for the measured workload; they remain disabled. See the [investigation](archive/plans/rendering-performance-investigation-2026-09-26.md). Do not re-enable them based on feature availability alone.
- No current seven-enemy test establishes MMO capacity. Preserve load time, animation correctness and memory ownership while designing future representations.

## Operating references

Use [the docs map](README.md), [browser ownership/capture](debug-view.md), [deployment](DEPLOY.md), [character contracts](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md), [Orc source pipeline](orc-sculpt-pipeline.md) and [current startup](startup-load.md). Older authoring sections describe their dates; inspect current code before executing rebuild commands.

Track every owned browser/game instance and stop it after checks. The worktree retirement audit left only the root checkout; that is a dated result, not permission to assume no other session has since created a process or worktree. Preserve unrelated live edits, including AGENTS.md. Commit/push completed task changes. Visual work requires reviewed live MP4/GIF delivery under the existing Telegram procedure.

## Historical records

[Completed scoped reports](complete/README.md), [archived plans and prior state](archive/README.md), and [baselines](baselines/) preserve evidence and open limitations without competing with this initiative. The [previous full CURRENT document](archive/state/CURRENT-before-character-vision-2026-09-27.md) retains the earlier chronology. The [relocation audit](complete/documentation-reorganization-2026-09-27.md) explains this reorganization.
