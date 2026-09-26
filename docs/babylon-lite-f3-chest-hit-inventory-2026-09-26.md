# F3 chest-hit animation asset inventory

This pass starts from `ff91340`. glTF Transform removes only the
`mixamorig:Hips` translation channel in `Hit_Chest` at the candidate-race
preparation boundary. Source `public/characters/base.glb` remains untouched.
Its legacy loader retains a narrowly gated runtime adapter.

| Shipped asset | Clips | Hit_Chest channels before → after | Hit_Head channels | Other curves |
| --- | ---: | ---: | ---: | --- |
| Human candidate | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Orc candidate | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Undead candidate | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Wanderer body | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Wanderer equipment | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Human streamed body | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Orc streamed body | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Undead streamed body | 57 | 53 → 52 | 53 | Exact semantic/keyframe hash match |
| Provisional undead streamed body | 55 | 53 → 52 | 53 | Exact semantic/keyframe hash match |

The exact asset paths and hashes of all retained animation channels and
keyframes are in
[`scripts/character-assets/chest-hit-inventory.json`](../scripts/character-assets/chest-hit-inventory.json).
`Hit_Head` keeps its Hips translation channel. The three authored
`*-animated-v1.glb` bodies have no `Hit_Chest` clip; their supported clips
remain unchanged. `base.glb` still has 53 `Hit_Chest` channels, including Hips
translation, and remains the only source needing the private Lite clip bridge.

Candidate bind scripts now strip the channel before writing their output;
downstream body and equipment preparations inherit the prepared clip. The
one-time `node scripts/character-assets/prepare-chest-hit.mjs` updated already
shipped GLBs and their manifests/provenance hashes. It is safe to rerun after
an output has already been prepared. Original base and source provenance remain
available.

Focused validation: 10/10 chest asset and runtime-gate checks pass; combined
animation/streamed human/orc/undead suites pass 39/39. The metadata integrity
test also checks current file hashes, binder-script hashes, and body manifest
sizes; stale Orc, Undead, and legacy provenance entries found during integration
were corrected before acceptance.

The final live review passed on a fixed 1280×720 Chromium WebGPU/Havok session.
Human, Orc, and Undead each showed distinct idle, chest-hit, and head-hit poses
from a three-quarter camera; the chest reaction bends the torso while the head
clip remains intact. Normal W/S movement, A/D facing turns, jump, moving Fire
Blast, equipment and hand sockets passed with zero recovery teleports and no
runtime, request, or GPU errors. The [reviewed all-race MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/lite1311-f3/2026-09-26-chest-hit-all-races.mp4)
has 1,803 fixed-size timestamped frames, 34.135 seconds, 1280×720 square pixels
and rotation 0. VE returned seekable HTTP 206 `video/mp4`; Chromium loaded and
played it after seeking to 22 seconds. Two earlier diagnostic attempts exercised
incorrect A/D displacement and Escape pause assumptions in the capture harness;
the final report records the corrected controls and passed checks.
