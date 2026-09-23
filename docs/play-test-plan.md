# Play test plan

End-to-end checks for the live Ashen Reach page (`ashen-reach.html` on Vite, `ASHEN.ready`). Run the automated slice with:

```
node scripts/ashen-reach/check-play-matrix.mjs
```

It needs the dev server and the shared Chrome at `CDP_URL`. It does not close that browser. A failure is a thrown list. Screenshots land in `ve-capture/ashen-reach/play-matrix/`.

The rows below are the cases. The script covers the ones marked auto. The rest are looked at in the screenshots from the same run.

## Boot

| Check | Auto |
| --- | --- |
| No `pageerror` through ready | yes |
| `ASHEN.ready`, player grounded, body visible in play view | yes |
| `scene._deferredBuilders` is empty after ready (spell sprites actually joined the frame) | yes |
| Metrics overlay is shown (`#metrics-overlay` not hidden) | yes |
| Combat audio starts muted | yes |
| Foliage instance count is greater than zero | yes |
| Churchyard has 4 shades, town has 3, once `hostilesReady` | yes |
| Loading copy is the night-yard card, not the old one-line string | source |

## Races and outfits

For human, orc, and undead: `switchRace` resolves, Idle_Loop is playing, and each preset returns `applied`.

| Preset | Human | Orc | Undead |
| --- | --- | --- | --- |
| wayfarer | auto | auto | auto |
| pilgrim | auto | auto | auto |
| graveweaver | auto | auto | auto |
| warden (greatstaff, both hands) | auto | auto | auto |
| revenant (hood, vestment, skirt) | auto | auto | auto |

After each apply, the selected slots match the preset and no extra page error appears. Undead must not spawn a mesh named like a Revenant plate or strap. Those were the wooden board and the wooden cross.

Visual, from the saved shots: hood does not cover the undead face, hood is not a pack behind the skull, orc Graveweaver skirt does not leave a naked gap, greatstaff is in both hands rather than a lance out to one side, boots and gloves meet the limbs.

## Animation

| Check | Auto |
| --- | --- |
| Idle_Loop playing after each race swap | yes |
| Holding W moves the player and a walk or jog clip is playing | yes |
| Fire Blast, Lava Ball, and Pyre Burst each have an upper and lower clip on the body | yes |
| Pyre Burst profile keeps `followThrough` and `fadeOut: 0` so the slam stays weighted through the nova, then the clip eases back to idle. `holdWeapon` keeps the sword in the hand | source |

## Spells

Stand on the ground in front of the training dummy, targeted.

| Check | Auto |
| --- | --- |
| Fire Blast (1) increases `spell.casts` and lowers dummy hp | yes |
| Lava Ball (2) enters a cast (`castingShoot`) and does not throw | yes |
| Pyre Burst (3) waits out its cooldown, then increases `pulse.casts`, lowers dummy hp, and scales the `Pyre shock` mesh above 1 | yes |
| Pressing 3 while Pyre is cooling down does not count another cast | yes |
| Spell sprites were flushed (same deferred-builder check as boot) | yes |

Visual: the Pyre frame shows a fire ring during the charge, then a column, sparks, and the orange disc together. A clip that only shows “Pyre Burst is not ready” is not a pass.

## World and hostiles

| Check | Auto |
| --- | --- |
| Town shades use three different `nameColor`s (rust, slate, bone) | yes |
| Churchyard shades share one name color | yes |
| Standing near the gate shows a Watchman world label while the objective is not done | yes |
| Objective snapshot has a watchman position and a phase | yes |

Visual: the three town robes read as different colors at gameplay distance, the Watchman label sits on the gate figure rather than on a shade, and the level-up line is not on top of the objective sentence.

## Out of this run

Server-side progression, Cloudflare deploy, and the `?preloadedEquipment` wanderer path are not in the matrix. The greatstaff still uses the shared two-hand carry, so a horizontal shaft between the hands is the current pose, not a new defect, unless a hand has left the shaft.
