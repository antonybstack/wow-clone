# Character lab asset provenance — verified 2026-09-17

The lab loads `public/characters/base.glb`. SHA256:
`2f9e45d0f7d9faeae4c20e18585173d62953df1a8f0272f270bedb200927604c`.
It contains the X-Bot mannequin, a 65-joint Mixamo rig, and 45 animation clips.
The lab's diagnostic garment shells, materials and fullness morph are local
fixture-composer additions, not features of the raw base GLB.

## Verified lineage evidence

- Both mannequin mesh POSITION arrays (`Alpha_Joints`, `Alpha_Surface`) exactly
  match `/Users/antbly/dev/ThirdPersonTemplate/src/assets/character.glb`:
  37,419 and 68,883 float values respectively, maximum difference zero.
  That template asset contains five clips; the local base contains 45.
- All 45 clip names and all 2,385 channel input/time arrays match
  `/Users/antbly/dev/BJS_Character_Controller_V2/assets/animations.glb` exactly.
  Channel matching used joint name/path with the Mixamo prefix normalized.
  Output values differ, consistent with conversion/retargeting; the files are
  not byte-identical. The original merge command/history has not been located.
- That reference repository's README credits a customized Mixamo skeletal rig
  and **Quaternius Universal Animation Library** animations:
  https://quaternius.com/packs/universalanimationlibrary.html
- Therefore earlier blanket descriptions of the entire animation set as
  "Mixamo animations" were imprecise: distinguish mannequin/rig origin from
  animation-library attribution.

## Why the project diverged

The original gameplay and M1 lab did build on the imported base. The M2b source
handoff then preferred MakeHuman/MPFB for a credible anatomical Human with a
face, fingers and reusable body assets. The resulting 163-joint MakeHuman body
required a separate retargeting stage. See [Human source provenance](character-human-source.md).
Later mage passes added procedural pose/stride replacements on top of that
retarget. User review prefers the original lab motion; preserve it as the
fidelity baseline before further replacement work.

One additional comparison to investigate: source idle/walk/sprint durations are
2.5 / 1.333333 / .666667 seconds; the Human retarget's idle/walk/run durations
are 3.166667 / 1.7 / .866667 seconds. Do not assume the retarget preserved timing.
This records the difference, not a proven explanation of how it arose.

The lab plays clips directly and has no physics controller. Gameplay Havok
support/jump fixes can remain independent of the chosen visual skeleton.
