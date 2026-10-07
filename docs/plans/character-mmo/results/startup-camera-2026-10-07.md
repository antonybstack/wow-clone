# Close-camera correction — 2026-10-07

The maximum-outfit clip from Telegram 876 exposed a real camera intrusion into
the hood and shoulder. Native Havok diagnosis reaches an arm radius of **0.0908 m**
with the requested distance still 3.5 m. The hit point is at **z20.5**, normal
`(0, 0, -1)`: the front of the actual temporary north loading fence. Its box is
centred at z21 and one metre deep. The camera's 0.22 m sphere sweep correctly
avoids that obstacle and excludes the player capsule. This evidence does not
demonstrate an incorrect pivot, a bad sweep filter, or a tree-specific failure.
The observed KeyA operation turns without RMB; earlier captions calling it a
strafe were inaccurate.

The correction preserves native ArcRotate positioning, zoom and Havok collision.
When collision pushes the lens within **1.25 m**, gameplay hides the local dressed
actor; it restores the actor above **1.55 m**. Both thresholds scale with the same
height as the follow pivot. The gap avoids repeated visibility changes at the
boundary. Requested zoom remains 2.2–42 m; collision can still retract below that
requested minimum. There is no camera clamp that puts the lens through a wall.

The existing body owner retains its visibility intent through source promotion,
restoration and rollback. The existing equipment owner reapplies coverage masks
after a body visibility change. One cached synchronizer handles changed visibility,
body roots and equipment owners before shadow updates. Ordinary frames do not
walk the hierarchy. Armory inspection shows the actor using its own camera;
closing it returns to the gameplay visibility policy. Native mixers, materials,
source curves, palettes, physics and controls remain in use.

**Tradeoff:** this is a discrete visibility change, without a material fade. Native
visibility also removes the hidden local actor from the dynamic shadow membership
and restores it on return. Other actors and world casters remain present. It does
not preserve an invisible actor's shadow. Transition timing and reviewed live
motion are required alongside the settled route benchmark.

## Checks

Both default and opt-in lazy/prime builds pass 41 focused checks. Six native cases
pass across the two builds: default keyboard, maximum-outfit transactions and
portrait touch. Each uses the actual loading fence and actual Havok movement.
For repeatable transactions the diagnostic holds only the native region worker's
start message, then releases it; this is not a startup or traversal benchmark.
The corrected fixture walks to z>20.05 before turning, reaching camera radii
0.44–0.47 m on keyboard and 0.167–0.175 m on touch.

The checks require all identified local visual meshes hidden, a clear native lens
sweep, active Havok, no recoveries and no runtime/GPU errors. They cover equipment
arrival, actual Human identity replacement, real compatible-source rollback,
Orc/Undead/Human promotion, inspection, reference/play switches, normal clearance,
full-region readiness, disposal and later input. The existing full-region native
camera checks also pass for ground, nave wall, tower orbit, capsule exclusion,
mouse controls and query disposal. All three entry aliases pass in each build.
Built checks read the public active camera transform rather than importing a
second Lite graph.

Independent Grok 4.6/high source review reports no consequential findings. Its
live evidence was supplied by the parent; it did not run the game. The review
retains an undemonstrated non-wait-committed replacement race as a limitation.
Its fixture description retains an old z>19.5 read; the actual corrected script
and six passing reports use z>20.05.

## Performance and delivery

Fifteen separate settled route windows (three × twelve seconds on meadow, town,
bridge, cathedral and forest) observe **202.5–239.9 FPS**, maximum full-window
p95 **5.9 ms**, p99 **6.2 ms**, worst **12.8 ms**, and **zero intervals >16.67 ms**
across 40,205 samples. Conditions: M1 Max, native 1280×720/DPR1, seven enemies,
saved maximum outfit, Chromium WebGPU with uncapped flags and GPU timing enabled,
no recording or competing game renderer. Bridge/cathedral have 240 Hz pacing
hints; retain those observations without claiming an uncapped hardware limit.

The separate eighteen-second turn at the real loading fence retains the native
region-worker diagnostic hold. It exposes frequent queue waits in both the prior
audio build and this correction: **198.2/198.7 FPS**, p99 **21.1/21.0 ms**, worst
**21.5/21.7 ms**. The candidate has fifteen actual hide/show changes. All long
observer intervals coincide with a previously full queue or a new scheduler wait.
Its ±three observer-frame transition windows reach **17.8 ms**; they use a
different sampling clock from the native render intervals. This bounded comparison
does not show a material throughput regression or isolate GPU work/transition cost.
Keep close-fence queue pacing as a follow-up; do not replace the settled route
result with this held-region diagnostic or claim every transition is free.

The baseline operation collected complete native/queue/physics samples, then failed
while summarizing its empty visibility-event list. Root validated the retained
raw samples and corrected that reporting assumption. Only the remaining candidate
ran afterwards; the baseline was not repeated to obtain a passing distribution.
Grok turn caps ended some wrappers before prose completion; actual child exits,
reports and browser cleanup establish the completed operations.

Root played the actual **28.370771-second** MP4, reviewing the hide, inspection,
return and full-region movement. Telegram **877** and the
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-camera-2026-10-07/ff6d3d9bcd20-camera.mp4)
are delivered once. SHA-256 is
`ff6d3d9bcd20edf6ccef2715cc522e8f53c2f6b559d9e9f4b49bd8a071fe61af`;
1280×720, square pixels, rotation zero, H.264, 16,451,410 bytes. The timestamp
manifest retains 1,685 same-size frames and elapsed capture time without reordering.
The silent clip labels its held native worker; recording is separate from timing.
Telegram returns matching 1280×720 dimensions. Public full GET matches the exact
hash/MIME/length, and seeking returns Range206. Root reviews actual inline,
expanded and direct VE playback with correct proportions. Telegram's fullscreen
button does not enter fullscreen; fullscreen/current phone remain unverified.

All owned game browsers and previews, review tab 1147995838 and wrapper PID 982:7081
are closed. Ports 10037/7074/7081 are clear. Edge retains twelve nongame user tabs;
Orca has zero embedded tabs. Reference-media guards are removed and prior connected
playback restored; Telegram auto-pauses its restored original media, and one old
node is detached. The new clip is paused. No owned game renderer remains.

[Compact receipt](../../../baselines/character-mmo/startup-camera-2026-10-07/receipt.json).
This correction does not qualify public one-second startup. Production and the
default-off prime/lazy flags remain behind the existing release gates.

The failed diagnostic attempts remain local: unsupported Playwright process
inspection, and a fixture that stopped short of the fence and therefore never
reached its required arm radius. Correcting the fixture did not change product
source or relax the native lens/visibility assertions.

Raw evidence: `.cache/character-mmo/startup-camera-2026-10-07/`. Pinned native
references: [Lite camera ownership](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/02-camera.md),
[native visibility](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-node.ts).
