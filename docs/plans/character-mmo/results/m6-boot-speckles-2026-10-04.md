# The boot speckles are aliasing, not a defect in the boot

**2026-10-04.** Reported as "the shoes have artifacts". They are not in the mesh, the texture, any
material, or any pass. Everything below was ruled out with a control, and the answer came from
the one measurement that distinguishes content from sampling.

## The answer

**Bright texels per megapixel, same world region, same pose, same camera:**

| render resolution | bright texels in the crop | per megapixel |
| --- | --- | --- |
| 1280 × 720 | 2 | **116** |
| 2560 × 1440 | 5 | **72** |
| 3840 × 2160 | 2 | **13** |

Content scales with resolution: a texel of texture or a strip of geometry covers four times the
pixels at twice the resolution, so its density per megapixel stays flat. These collapse **9× from
720p to 4K**. That is the signature of a sub-pixel feature aliasing — the thin, high-contrast
edges of the boot's strap and sole welt lighting individual pixels — and it resolves away as
sample density rises.

So the fix is anti-aliasing or supersampling, a **rendering** change. It is not an asset change
and does not belong in the republish batch.

## What was ruled out, and how

Each of these was a live A/B against the same build, and the ones that load a candidate asset
assert the route was actually taken, because a candidate that is never served looks exactly like
a fix that does not work.

| Hypothesis | Test | Result |
| --- | --- | --- |
| The boot's own albedo | dye the piece and watch the specks | ankle specks tint, toe specks do not |
| The body's foot poking through | push the shell out 10 mm along its normals, re-measure | exposure 38 → 15 vertices, **specks unchanged** |
| Back faces | `doubleSided: false` at material build | unchanged |
| Normal-map aliasing | drop `normalTexture` | unchanged |
| Roughness / occlusion | drop `ormTexture` | unchanged |
| Emissive texels | drop `emissiveTexture` | unchanged |
| Local-light specular | drop both material plugins | unchanged |
| Specular AA | `enableSpecularAA: false` | unchanged |
| Contact occlusion / grounding | disable the grounding pass | unchanged |
| The whole post pipeline | `?noPost` | unchanged |
| White UV padding bleeding | dilate the atlas, serve the candidate | background 25.7% → 0%, **specks unchanged** |

Two of those deserve recording as findings in their own right, because both are real and neither
is this bug.

## Two true things found on the way that are not the cause

**The foot is genuinely outside the boot at 38 of 490 vertices**, all below 30 mm — the sole and
toe — with the closest at 0.01 mm. The surfaces are coincident rather than interpenetrating.
Pushing the shell out 2.5 mm clears 4 of them and 10 mm clears 23, which is enough to say the
remainder are outside the shell's reach rather than merely touching it.
[Measurement](../../../../scripts/character-assets/measure-boot-fit.mjs) ·
[corrective](../../../../scripts/character-assets/build-boot-clearance.mjs). **Not shipped**: it
changes nothing visible, and 10 mm of standoff would make the silhouette heavier, which is the
opposite of the other complaint about these boots.

**Two atlases have an undilated pure-white background** — 25.7% of the boot's and 30.7% of the
tunic's, shared by six pieces. Seven other garments are already dilated, and `pilgrimTunic`, the
one design with no white background, is also the one that reads cleanest. So the pipeline does
dilate, and these two were missed.
[Tool](../../../../scripts/character-assets/build-texture-dilation.mjs) takes them to 0% for
about 15 KB each. **Not shipped either**, because serving the dilated candidate changed nothing
on screen — the white is latent, not currently sampled. It is worth fixing when those atlases are
next rebuilt, on its own merits.

## Still open on the boots

The sole oversails the upper and shows its underside. That is a shape judgement about authored
geometry, not a bug with a measurement behind it, and it is untouched here.
