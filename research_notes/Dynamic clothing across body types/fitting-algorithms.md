# Fitting algorithms: wrap, cage, RBF, MHCLO, shrinkwrap, and volume vs surface push

Scope: geometry algorithms used to fit a garment authored on one body onto another. Emphasis on why nearest-surface shrinkwrap leaves Human-sized boots on an Orc foot, what MakeClothes actually stores, how wrap/surface/cage deformers differ, topology-mismatch transfer, volume-preserving alternatives, and what a WebGPU LBS mesh can actually evaluate at runtime.

Matching-topology callout (read first): **clothes topology need not match body topology** for shrinkwrap, wrap, surface deform, mesh-deform cages, MHCLO, RBF, or nearest-face weight transfer. **Clothes topology must match** for per-vertex morph-target / blendshape transfer by index, Laplacian Deform / Delta Mush on that garment, and Blender Data Transfer mapping mode `Topology`. **Body vertex indices must be stable** for MHCLO (the mapping stores basemesh vertex IDs). A print-sculpt Orc is therefore out of MHCLO’s native contract unless a correspondence/proxy mesh with hm08 (or other declared) indices exists.

## Why nearest-surface shrinkwrap fails for boots/gloves on a much larger body

### Takeaway
Shrinkwrap independently snaps each garment vertex to the closest point (or ray hit) on the *current* body surface and then applies a scalar offset. It never stretches the garment along the body, never grows shaft/cuff length, and never preserves “this boot vertex covers the toe tip.” On a much larger foot or forearm the Human-sized boot/glove therefore collapses onto the nearest patch of the Orc surface: toes poke out, calf stays uncovered, glove cuffs sit on the wrist.

### Cited Findings
- Blender’s Shrinkwrap modifier “moves each vertex of the object being modified to the closest position on the surface of the given mesh (using one of the four methods available).” — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- Wrap method **Nearest Surface Point** “will select the nearest point over the surface of the shrunk target.” There is no correspondence, no along-surface geodesic, and no per-region scale. — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- **Project** shoots each vertex along a chosen axis (or the vertex normal if no axis is selected) until it hits the target; “Vertices that never touch the shrink target are left in their original position.” — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- **Nearest Vertex** snaps to the closest *vertex* of the target, not a surface point, and does not support Snap Mode. — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- **Target Normal Project** searches for the nearest surface point whose interpolated smooth normal points toward or away from the original vertex; slower, smoother, still a snap-to-surface operator. — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- Offset is “the distance that must be kept from the calculated target position.” Snap Mode **On Surface** applies that offset along the projection line back toward the original position; **Above Surface** applies it along the target’s smooth normal; **Outside Surface** always offsets toward the outside. None of these grow the garment’s surface area. — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- Inside/Outside snap modes are documented as “very crude collision detection”; inside vs outside is determined from the target normal and “is not always stable near 90 degree and sharper angles.” — [Blender 5.2 Shrinkwrap Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- The Shrinkwrap *constraint* (object origin, not per-vertex) uses the same nearest-surface / project / nearest-vertex / target-normal-project family; Distance is likewise a stay-off-surface offset, not a coverage scale. — [Blender 5.2 Shrinkwrap Constraint](https://docs.blender.org/manual/en/latest/animation/constraints/relationship/shrinkwrap.html)
- MakeClothes authors explicitly warn that proximity matching without region groups mis-binds: trumpet sleeves “will stay near the torso, because the torso vertices are nearer to the sleeves than the arm”; a skirt vertex can lock onto “one vertex on one leg … and two on the other leg.” — [MakeClothes Vertex-Groups (wiki, search capture)](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Vertex-Groups); [MakeClothes Delete-Groups](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Delete-Groups)
- MakeClothes also states that each cloth vertex needs three reference vertices, and that distances `d1,d2` between cloth and skin are intended to stay in *ratio* after the skin stretches — a property shrinkwrap’s constant Offset does not provide. — [MakeClothes Delete-Groups](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Delete-Groups)
- Blender Solidify (the usual “give the snapped shell thickness” follow-up) extrudes along normals by a scalar Thickness; “the modifier thickness is calculated using local vertex coordinates” and “Even Thickness … is an approximation … the final wall thickness is not guaranteed.” Solidify does not extend coverage along a limb. — [Blender 5.2 Solidify Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html)

### Inferences
- Independent nearest-point assignment is a *projection onto a 2-manifold*, not a *map of a 3D garment volume*. A Human boot’s toe-cap vertices sit a few centimetres in front of a Human toe. On an Orc whose toes extend much farther, those same vertices’ nearest surface points are typically the instep or the *side* of the big toe, not the new toe tips. The Orc toes have no garment vertices assigned to them because assignment is “closest from current garment rest,” not “cover this body region.”
- A constant Offset (leather thickness) cannot manufacture missing shaft height. Calf-uncovered is the expected result when the boot shaft’s rest vertices already lie near the Human ankle: they snap to the Orc ankle, leaving the Orc calf bare.
- Gloves fail the same way: cuff vertices nearest-snap to the Orc wrist/hand surface. Forearm coverage would require either (a) extra vertices already placed along the Human forearm, or (b) an along-surface / pattern-space scale of the cuff, which shrinkwrap does not do.
- Project-along-normal can be *worse* on a larger body: rays from a small boot miss the bulky Orc foot entirely and “are left in their original position,” leaving floating Human-sized geometry.
- Shrinkwrap + Solidify is a *surface-push then local thickness* pipeline. It can keep a shirt from intersecting a slightly bulkier chest; it cannot turn a size-9 boot into a size-14 boot.

### Gaps
- Blender’s manual does not publish the exact nearest-triangle algorithm (AABB tree vs BVH, barycentric clamp vs vertex/edge feature). Implementation details live in Blender source, not the user manual.
- No first-party paper frames shrinkwrap as a garment grader; the failure mode above is geometric deduction from the documented operator, not a Blender bug report.

## What MakeClothes actually does (barycentric face mapping — not matching clothes topology)

### Takeaway
MakeClothes does **not** require the garment to share topology with the human. It maps **each clothes vertex** to a **triangle of basemesh vertices** (barycentric weights) plus a **3D offset that is later scaled by a body-part length**. The MHCLO file is that mapping. The *basemesh* must keep stable vertex indices (typically `hm08`); the *clothes* mesh can be any topology (quads-only in MakeHuman I).

### Cited Findings
- “With one human and one piece of clothing selected, create an association between clothes vertices and human triangles, i.e. triplets of human vertices. Both meshes must have vertex groups with identical names, and each clothing vertex must belong to exactly one vertex group.” — [MakeClothes wiki (Documentation:MHBlenderTools:MakeClothes, search capture)](http://www.makehumancommunity.org/wiki/Documentation:MHBlenderTools:MakeClothes); [Documentation:Scratch oldid=687](http://www.makehumancommunity.org/w/index.php?title=Documentation:Scratch&oldid=687)
- VertexMatch tries four strategies in order: **EXACT** (KDTree hit within 0.001 Blender units → weights `(1,0,0)`, offsets `(0,0,0)`); **RIGID_GROUP** (the matching vertex group on the body has exactly three vertices — used for buttons/buckles that should scale as a rigid triangle); **SIMPLE_FACE** (closest face by median, all its verts in the same group); **EXTENDED_FACE** (20 nearest faces in the group, first whose normal is within 30° of the clothes-vertex direction). Failure raises `ValueError`. — [mpfb2 VertexMatch](https://github.com/makehumancommunity/mpfb2/blob/master/docs/entities/clothes/vertexmatch.md)
- MHCLO weighted line: `<vert1> <vert2> <vert3> <w1> <w2> <w3> <ox> <oy> <oz>`. Exact match is a single basemesh index. — [mpfb2 MHCLO format](https://github.com/makehumancommunity/mpfb2/blob/master/docs/fileformats/mhclo.md)
- Runtime placement formula, from the MakeHuman file-format notes: if the n-th line is `v1 v2 v3 w1 w2 w3 d1 d2 d3`, then clothing vertex n is
  `w1*r1 + w2*r2 + w3*r3 + (s1*d1, s2*d2, s3*d3)`
  where `r1,r2,r3` are current human vertex positions and `s1,s2,s3` are scale factors from the header. — [MakeHuman file formats and extensions](https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html)
- Header scale lines: `x_scale v1 v2 dist` (and y/z). `dist` is the distance between those two basemesh vertices *on the character the clothes were made for*. At fit time, `xscale = abs(coord(v1).x - coord(v2).x) / den`, analogously for y/z, forming a diagonal scale matrix applied to **offsets only**, not to the barycentric surface point. — [MakeHuman file formats — Offset and bounds](https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html)
- MakeClothes UI: “The location of a clothing vertex depends on two data: a point on a body triangle, described in barycentric coordinates, and the offset from that point. The offset is scaled in the X, Y and Z directions depending on the size of a certain body part.” Body Part choices: Custom, Body, Genital, Head, Torso, Arm, Hand, Leg, **Foot**. Boundary vertices X1/X2, Y1/Y2, Z1/Z2 define those three lengths. — [MakeClothes wiki Show Offset scaling](http://www.makehumancommunity.org/wiki/Documentation:MHBlenderTools:MakeClothes)
- Vertex groups are the region constraint: boots use a `boots` group on the **helper** (not the raw skin) plus the same name on the boot mesh; a `DeleteBoots` group on the human hides the feet. Dress sleeves need separate arm groups or the proximity matcher binds sleeve verts to the torso. Clothes vertices may belong to only one group. — [MakeClothes Vertex-Groups](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Vertex-Groups); [community-plugins-makeclothes README](https://github.com/makehumancommunity/community-plugins-makeclothes)
- “Especially if you design a skirt, always use the helper-mesh. Otherwise the algorithm will e.g. find one vertex on one leg to follow and two on the other leg.” — [MakeClothes Delete-Groups](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Delete-Groups)
- MakeHuman I clothes: triangles *or* quads, no mix; “maximum number of vertices per face is 4.” MakeHuman II “deals with each kind of geometry.” — [Introduction to MakeClothes](https://static.makehumancommunity.org/assets/creatingassets/makeclothes/introduction.html)
- `basemesh hm08` is stored in the MHCLO header; older MakeClothes supported `hm07` and `alpha6`. The mapping is index-based against that declared basemesh. — [MakeHuman file formats](https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html)
- Optional `delete_verts` run-length list hides basemesh vertices under opaque clothes (poke-through prevention, not a deformer). — [mpfb2 MHCLO format](https://github.com/makehumancommunity/mpfb2/blob/master/docs/fileformats/mhclo.md)
- Offsets are stored in MakeHuman Y-up; MPFB converts Blender `D` to `(D[0]/scale, D[2]/scale, -D[1]/scale)` on write. — [mpfb2 VertexMatch](https://github.com/makehumancommunity/mpfb2/blob/master/docs/entities/clothes/vertexmatch.md)

### Inferences
- MHCLO is a **rest-pose fit operator** that *does* grow offsets with body-part size. If a boot was authored with a 1.5 cm normal offset from the Foot helper, and the Orc foot is 1.3× longer on the Foot X1–X2 pair, that offset becomes ~1.95 cm — the boot gets thicker *and* the barycentric surface point rides the larger foot triangle. That is the mechanism that can cover a huge foot **if and only if** the three reference vertices actually lie on that foot.
- It is **not** “matching topology barycentric transfer” in the morph-target sense. Clothes and body topologies are independent. What must match is (1) vertex-group names, (2) the basemesh vertex index space the MHCLO was cooked against.
- A print-sculpt Orc with different vertex count/order **cannot** consume a Human MHCLO. You would need a same-index proxy (MakeHuman “proxy mesh”) or a retargeted MHCLO cooked against an Orc-shaped but hm08-indexed mesh.
- Helper meshes exist specifically because nearest-triangle on raw skin fails for skirts, coats, and anything that stands off the body — the same failure class as shrinkwrap, but MakeClothes lets the author *constrain the search* with groups and then *scale the leftover offset*.

### Gaps
- The exact barycentric routine (clamped vs unclamped, which three verts of a quad) is in `vertexmatch.py`; the public doc says “barycentric calculation” without the linear-algebra listing.
- No published measurement of how well Foot-part scaling covers a non-hm08 Orc foot; MHCLO’s contract is “same basemesh, different slider state,” not “arbitrary sculpt.”

## Wrap deformers vs Surface Deform vs cage deformers (and RBF / Laplacian / Delta Mush)

### Takeaway
These are all **deformation transfer** tools, not “snap to surface.” Wrap and Surface Deform bind a garment (or high-res mesh) to a *driver surface* and replay the driver’s motion while trying to keep the rest-pose offset. Cage deformers bind to a *volumetric cage* via generalized barycentric / harmonic / Green coordinates, so enclosed volume can grow when the cage grows. Shrinkwrap is the odd one out: it discards the rest offset every evaluation and reprojects.

### Cited Findings
**Maya Wrap**
- “Wrap deformers let you deform objects with NURBS surfaces, NURBS curves, or polygonal surfaces.” Maya copies the influence object as a **base shape**; “Any difference in position, orientation, or shape between the base shape and the wrap influence object results in a deformation.” — [Maya Wrap deformer](https://help.autodesk.com/view/MAYACRE/ENU/?guid=GUID-B98E74F5-6965-41B1-BBF8-471FB2FAD7EC)
- Influence of a driver component on a bound point “is a function of the distance of the component from the point.” `dropoff` default 4.0; `maxDistance` 0 = infinite. — [Maya wrap node](https://help.autodesk.com/cloudhelp/2023/JPN/Maya-Tech-Docs/Nodes/wrap.html)
- **Exclusive bind**: target behaves like rigid-bind skin; “Each surface point on the wrap deformer’s target surface will only be affected by a single wrap influence object point.” Polygon meshes only. — [Maya Wrap options](https://help.autodesk.com/view/MAYAUL/2026/ENU/?guid=GUID-291D9A2D-2DD1-4B1C-B4FA-1DC78F72B535)
- **Falloff Mode Volume** uses Euclidean distance; **Surface** uses distance across the deforming surface (lips that move independently). Surface mode “can have a negative impact on performance” on dense meshes. — [Maya Wrap options](https://help.autodesk.com/view/MAYAUL/2026/ENU/?guid=GUID-291D9A2D-2DD1-4B1C-B4FA-1DC78F72B535)
- Auto Weight Threshold computes “the smallest Max Distance value that will ensure every point on the mesh is affected.” — [Maya Wrap options](https://help.autodesk.com/view/MAYAUL/2026/ENU/?guid=GUID-291D9A2D-2DD1-4B1C-B4FA-1DC78F72B535)

**Maya Proximity Wrap**
- Target binds to Drivers “based on proximity.” Distances below Falloff Start have full influence; above Falloff End, none. Bind requires Target and Driver to “line up without any transformations.” — [Maya Proximity Wrap deformer](https://help.autodesk.com/view/MAYAUL/2024/ENU/?guid=GUID-0D7E6B72-6021-4C66-9262-089D10246C3F)
- Wrap modes: **Surface** “Moves everything while considering surface normals”; **Offset** “Applies the number of vertices moved by the driver to the target vertices, according to the weighted influences. It ignores surface orientation so it may create artifacts when severe rotations are involved.” — [Maya Proximity Wrap options](https://help.autodesk.com/view/MAYAUL/2023/ENU?guid=GUID-A5B4553F-8135-4BF5-B2F1-14CAD47A8D31)
- Max Drivers commonly 3–4; set to 1 plus Delta Mush is a documented speed/quality trade. Can replace a skinCluster (`Deformer Node = Proximity Wrap`). — [Maya Proximity Wrap options](https://help.autodesk.com/view/MAYAUL/2023/ENU?guid=GUID-A5B4553F-8135-4BF5-B2F1-14CAD47A8D31)

**Blender Surface Deform**
- “Allows an arbitrary mesh surface to control the deformation of another, essentially transferring its motion/deformation.” Canonical use: cloth-sim proxy driving a render mesh. — [Blender 5.2 Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)
- Bind is mandatory; unbound modifier does nothing. Binding is in global coordinates; later object transforms of either mesh are ignored — only target *mesh* changes matter. — [Blender 5.2 Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)
- Target constraints (else bind fails): no edges with more than two faces; no concave faces; no overlapping vertices; no faces with collinear edges. — [Blender 5.2 Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)
- Interpolation Falloff controls how much a vertex bound to one face is affected by surrounding faces (“smooth the deformations”). — [Blender 5.2 Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)
- Explicit warning: “The further a mesh deviates from the target mesh surface, the more likely it is to get undesirable artifacts. This is an inherent characteristic of surface binding in general, so it is recommended to have reasonably well matching meshes.” — [Blender 5.2 Surface Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/surface_deform.html)

**Blender Mesh Deform (cage) / Harmonic coordinates**
- “Allows an arbitrary mesh (of any closed shape) to act as a deformation cage around another mesh.” Unbound has no effect. Precision 2–10 (default 5) trades bind time vs accuracy. Cage normals must point outward (inside/outside test). Interior sub-cages (e.g. eye spheres) are allowed. — [Blender 5.2 Mesh Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/mesh_deform.html)
- Blender documents the original paper as Pixar Harmonic Coordinates. — [Blender 5.2 Mesh Deform “Original paper”](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/mesh_deform.html)
- Joshi, Meyer, DeRose, Green, Sanocki, SIGGRAPH 2007: harmonic coordinates are generalized barycentric coordinates on a closed cage; “the first system of generalized barycentric coordinates that are non-negative even in strongly concave situations, and their magnitude falls off with distance as measured within the cage.” Optional interior vertices/faces for finer interior control. — [Harmonic coordinates for character articulation (ACM)](https://dl.acm.org/doi/10.1145/1276377.1276466)
- Cage-based deformation STAR: a cage is “a manifold polygonal mesh encasing the geometry”; enclosed points are reconstructed from cage handles. — [A Survey on Cage-based Deformation of 3D Models, CGF 2024](https://onlinelibrary.wiley.com/doi/10.1111/cgf.15060)

**Mean Value Coordinates (MVC)**
- Ju, Schaefer, Warren, SIGGRAPH 2005: generalize Floater’s 2D mean-value coordinates to closed triangular meshes; continuous everywhere, smooth in the interior; used for volumetric textures and surface deformation. Closed-form. — [Mean value coordinates for closed triangular meshes (Semantic Scholar / SIGGRAPH 2005)](https://www.semanticscholar.org/paper/Mean-value-coordinates-for-closed-triangular-meshes-Ju-Schaefer/9f8f5b70570d97c9334eeed475bcd262d0e8a683)
- Lipman et al. note MVC (and HC) operators are **affine-invariant**: a sheared cage shears the interior, which “violate[s] the shape-preserving property.” MVC can go negative in concave cages; HC stay non-negative but have no closed form. — [Green Coordinates technical report](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc_techrep.pdf)

**Green Coordinates**
- Lipman, Levin, Cohen-Or, SIGGRAPH 2008: coordinates depend on **cage vertices and cage face normals**:
  `η = Σ φi(η) vi + Σ ψj(η) n(tj)`
  After cage deformation, `η' = Σ φi vi' + Σ ψj sj n(tj')` with 2D scale `sj = |t'j|/|tj|`. 2D maps are conformal; 3D maps are quasi-conformal. Closed-form. Extend analytically **outside** the cage (partial cages). Comparison figure: MVC shears an Ogre head; GC preserves it. — [Green Coordinates tech report](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc_techrep.pdf); [project page](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc.htm)

**RBF**
- Green Coordinates paper groups RBF with FFD as treating each axis independently, so “shape preservation is generally not possible.” — [Green Coordinates tech report](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc_techrep.pdf)
- Production write-up: RBF interpolation takes source points, target points, and query points and “smoothly maps the query points based on the source-to-target transformations”; used in Houdini to morph an outfit from a male morphotype to a female morphotype. Also listed for weight transfer and auto-rig. — [RBF Interpolation, Sergi Carrion](https://sergicarrion.com/articles/rbf-interpolation/)
- Unity blendshape-transfer tools advertise RBF as transferring body blendshapes onto clothing without matching topology. — [Blendshape Transfer Tool (BOOTH listing)](https://booth.pm/ja/items/8046339)

**Laplacian Deform**
- “Pose a mesh while preserving geometric details.” User moves *anchor* vertices; the rest is solved from **differential coordinates** (vertex minus weighted neighbour average). Based on Sorkine et al., Laplacian Surface Editing, 2004. Requires an Anchors vertex group; Bind captures rest details. Same mesh topology throughout. — [Blender 5.2 Laplacian Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/laplacian_deform.html); [Laplacian Surface Editing PDF](https://igl.ethz.ch/projects/Laplacian-mesh-processing/Laplacian-mesh-editing/laplacian-mesh-editing.pdf)

**Delta Mush**
- Mancewicz, Derksen, Wilson, SIGGRAPH 2014: Laplacian-smooth the rest mesh, store per-vertex rest-space delta; at runtime smooth the *deformed* mesh and re-apply the cached delta in the current tangent frame. Restores detail and volume lost to smoothing. Not a transfer: it filters an already-deformed mesh of **identical topology**. — [Delta Mush (ACM PDF)](https://dl.acm.org/doi/pdf/10.1145/2614106.2614144); [Maya Delta Mush deformer](https://help.autodesk.com/view/MAYAUL/2022/ENU?guid=GUID-139B703C-28E7-4787-8FD4-C2991BD6C990)
- Direct Delta Mush (Le et al., 2019): DQS-like direct skinning approximation of DM; “the deformation of the deltas applies locally rigid transformation, thus the mesh details do not lose volume. On the other hand, the mush deformation is linear, and so volume loss can result.” High smoothness shrinks the mush toward a rod so volume cannot collapse further. Too expensive as iterative Laplacian for games; DDM is the GPU-friendly form. — [Direct Delta Mush (ResearchGate excerpt)](https://www.researchgate.net/publication/334433596_Direct_delta_mush_skinning_and_variants)

**FFD / lattice (for contrast)**
- Sederberg & Parry 1986 lattice FFD is the historical cage ancestor; Joshi et al. argue the regular lattice is “less flexible,” motivating a fitted cage. — [Green Coordinates tech report, Background](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc_techrep.pdf)

### Inferences
- **Shrinkwrap** = reproject every evaluation. Rest offset is not a first-class bound quantity (Offset is a constant).
- **Wrap / Proximity Wrap / Surface Deform** = bind rest correspondence, then apply driver delta. If you bind Human clothes to a Human body and then *morph that same-topology body toward an Orc*, clothes ride along. If you bind Human clothes to an already-Orc mesh, you are back to a proximity assignment and the Human rest offset is measured against the Orc, which is the shrinkwrap failure again.
- **Cage (HC / MVC / GC)** = volumetric. Enlarging the foot region of a cage enlarges the enclosed boot *including its interior thickness*. GC additionally resists shear (better boot/armor plate shape). HC/MVC will squash/stretch with the cage (good for “make the boot bigger,” bad if the cage shears).
- **RBF** = landmark interpolant in R³. Good when you have a handful of corresponding markers (heel, toe, ankle, knee) on two different topologies. No manifold required. Can overshoot; no guaranteed non-intersection.
- **Laplacian Deform** = detail-preserving *edit* of one mesh given moved anchors. Useful as a post-pass after a crude wrap (“anchors = boot opening + sole, solve the rest”). Not a body-to-body transfer by itself.
- **Delta Mush** = post-skinning smoother. Helps candy-wrapper and wrap artifacts; does not create missing calf coverage.

### Gaps
- Autodesk does not publish the Wrap weight kernel formula (exact power of dropoff, face vs point influence `inflType`) in the user manual; the node docs list attributes but not the shader-style equation.
- Blender Surface Deform’s bind data layout (weights per face, barycentric vs mean-value on the driver face) is not in the user manual.
- I did not obtain the full Joshi 2007 PDF body (Pixar library URL now redirects to a generic technology page). Claims above use the ACM abstract plus Blender’s citation and Lipman’s comparison.

## How games and DCC tools transfer clothing when topology does not match

### Takeaway
When topologies differ, production tools do **not** snap vertices onto the new body and call it done. They either (1) transfer **skin weights** from the body by nearest-face interpolation and keep a separately fitted rest mesh, (2) reverse a body morph so clothes authored on a fat/Orc shape still rig to a canonical base, (3) retarget **patterns** (Marvelous fitting suits) and re-simulate, or (4) store **multiple fitted sizes** and interpolate (MetaHuman outfits). Mixamo-class auto-riggers solve **weights on one mesh**, not garment retargeting.

### Cited Findings
**Weight transfer (topology-free)**
- Blender Data Transfer, interpolated vertex mapping **Nearest Face Interpolated**: “Find the nearest point on the nearest source face, then use that point to interpolate between the values of the face’s vertices.” **Projected Face Interpolated** projects the destination vertex along its normal onto a source face, then interpolates. **Topology** mapping requires identical topology. — [Blender 5.2 Data Transfer](https://docs.blender.org/manual/en/latest/modeling/modifiers/modify/data_transfer.html)
- Japanese production write-up: for clothes vs body with different topology, set mapping to 最近接面の補間 (Nearest Face Interpolated); Topology mapping “cannot be used if topology differs.” Apply the modifier in rest pose. — [CGbox: transfer weights onto clothes](https://cgbox.jp/2023/06/11/blender-weight-transfer/)
- Data Transfer nearest-face sampling can pull from the wrong body part when meshes are close (fingers, overlapping panels); Max Distance and projected-face are the documented mitigations. — [3DSkillUp on Data Transfer](https://3dskillup.art/blender-data-transfer-modifier/)

**Daz Transfer Utility (morph reversal + weight projection)**
- Transfer Utility “allows the user to transfer a source figure’s rigging over to an un-rigged target item.” Options include UV, morphs, weight maps, selection maps. — [Daz Transfer Utility action docs](http://docs.daz3d.com/doku.php/public/software/dazstudio/4/referenceguide/interface/action/index/dztransferutilityaction/start?do=export_xhtml)
- **Reverse Source Shape from Target**: “If using a different shape for projection other than the default shape, this option will reverse the Source Shape from the Target Item, resulting in the clothing fitting back to the default Source Shape.” — [Daz Transfer Utility action docs](http://docs.daz3d.com/doku.php/public/software/dazstudio/4/referenceguide/interface/action/index/dztransferutilityaction/start?do=export_xhtml)
- Staff explanation: if clothes were modelled on a morphed figure, Daz otherwise “treats it as being made for the base, so it will fit it to that and then project the morph into the fitted item (which, if the shape is smaller than the default, will shrink it inside the figure).” Workaround: Source Shape = Current/Morph + Reverse Source Shape from Target. Greater deviation from base “the more it may struggle”; rigid items distort. — [Daz forum, Richard Haseltine](https://www.daz3d.com/forums/discussion/636641/rigging-clothing-with-transfer-utility-makes-item-disappear); [Daz forum, transfer on Ogre HD](https://www.daz3d.com/forums/discussion/677506/transfer-utility-problem)

**Marvelous Designer / CLO (pattern space, not mesh snap)**
- Auto Fitting “Automatically adjust the size of your garment to your custom avatar and simulate the garment.” Requires a **Fitting Suit** on both avatar and garment. Re-Target Draping / Re-Drape “maintains its original size.” — [Marvelous Auto Fitting](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649-Auto-Fitting)
- Fitting Suit is created by drawing reference/circumference lines on the avatar and draping a canonical suit; saved inside the `.avt`. Auto-create at OBJ/FBX import for bipedal A/T-pose avatars. — [Marvelous Auto Fitting](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649-Auto-Fitting); [Automatically Create Fitting Suit at Import](https://support.marvelousdesigner.com/hc/en-us/articles/47358401201433-Automatically-Create-Fitting-Suit-at-Import)
- Auto Fitting options: Maintain Pattern Curvature (%), Maintain Graphic Size, Maintain Texture Size, **Maintain Topology** (2025.1+: keep garment topology vs remesh). Higher curvature-maintain “will deform only the size of the pattern while preserving the existing curvature.” — [Marvelous Auto Fitting](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649-Auto-Fitting)
- Official video: donor avatar’s fitting suit is copied onto garments simulated on it; destination avatar needs its own fitting suit; then Auto Fitting grades the 2D patterns and re-simulates. — [Marvelous Designer 12.1 Autofitting Tools](https://www.youtube.com/watch?v=GsOFUIH2P3g)

**MetaHuman / Unreal Chaos Outfit (multi-size interpolate, then copy weights)**
- “The outfit asset resizes clothing by associating a garment with a body that the garment fits on. It then compares that body to a target body … and applies the differences between those bodies to the garment.” Multiple sizes = multiple (garment, body) pairs; MHC “automatically selects the body it thinks is closest.” — [Unreal Fest Chicago 2026, MetaHumans x Clo transcript](https://www.youtube.com/watch?v=A9CtqkjEa94)
- “Currently parametric or resizable outfit assets resize the clothing mesh and then **copy the skin weights from the body onto the garment**.” — [same Unreal Fest talk](https://www.youtube.com/watch?v=A9CtqkjEa94)
- `SizedOutfitSource` takes a Cloth Asset + corresponding Skeletal Mesh body + interpolation points; more pre-generated sizes improve conform, especially on complicated outfits. — [Chaos Cloth Outfit Asset Resizing Addendum](https://dev.epicgames.com/community/learning/tutorials/9Xjd/unreal-engine-chaos-cloth-outfit-asset-resizing-addendum)
- A resizable Chaos Outfit “has multiple source assets which automatically selects the size that fits the best in accordance with the target body’s measurements.” Non-parametric outfits are fixed-size skeletal meshes. — [MetaHuman: Tailoring Your Own Wardrobe Items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items?lang=en-US)
- After resize, creators are told to export body types that fit badly and author a new source size; hidden-face maps remove always-covered body faces. — [Testing and Configuring your Parametric Outfit Asset](https://dev.epicgames.com/documentation/metahuman/testing-and-configuring-your-parametric-outfit-asset?lang=en-US)

**Mixamo / Pinocchio (weights, not clothes)**
- Pinocchio (Baran & Popović, SIGGRAPH 2007): embed a generic skeleton in a character volume, then “solves the diffusion equilibrium equation on the character surface to compute the bone weights for skeleton subspace deformation.” Heat-style skinning on **one** mesh. Requires roughly the same orientation/pose as the skeleton. — [Pinocchio abstract (MIT)](https://dspace.mit.edu/handle/1721.1/100396); [SIGGRAPH History / method transcript](https://history.siggraph.org/learning/automatic-rigging-and-animation-of-3d-characters-by-baran-and-popovic/)
- Mixamo-related US patent 8797328B2 describes skinning weights via heat diffusion: “each body segment is modeled as a heat emitting body … surrounding segments are considered as heat absorbing bodies. This formulation leads to a set of independent Poisson problems.” Also mentions proximity maps and template matching. — [US8797328B2](https://patents.google.com/patent/US8797328B2/en)
- Voxel Heat Diffuse Skinning (Blender addon documenting the same family): voxelize the character to a solid, bones emit heat, iterate diffusion; designed to skin **overlapping clothes + body** as one solid (clothes get body-like weights because heat travels through the voxel volume). Known failure: fuses mouth/fingers. — [Voxel Heat Diffuse Skinning (Superhive)](https://blendermarket.com/products/voxel-heat-diffuse-skinning?ref=46)
- Mixamo auto-rig is not a garment grader. Academic comparison treats Mixamo as producing blend weights + a standard skeleton on T/A-pose meshes; it “often raise[s] errors when faced with complex [poses]” and can mirror L/R. — [Make-It-Animatable, arXiv](https://arxiv.org/html/2411.18197v2)

**Research garment transfer (design-preserving, not snap)**
- Brouet, Sheffer, Boissieux, Cani, SIGGRAPH 2012 *Design Preserving Garment Transfer*: “fully automatic method for design-preserving transfer of garments between characters with different body shapes”; “automatically generate design-preserving versions of existing garments for target characters whose proportions and body shape significantly differ”; handles multi-layer; “automatically graded patterns.” Constrained optimization, iterative quadratic minimization. Example: woman → young girl with graded 2D patterns. — [Design Preserving Garment Transfer (HAL record / SciSpace)](https://scispace.com/pdf/design-preserving-garment-transfer-4g2bqeqcac.pdf)
- Pixar *Garment Refitting for Digital Characters* (de Goes, Fong, O’Malley; used on *Soul*): iterate **relaxation** (affine-invariant coordinates adapting the 3D garment while minimizing mesh distortion) and **rebinding** (reset spacing to the body from user tightness). Supports multi-layer, seams, fold-overs. — [GarmentRefit, Pixar library](https://graphics.pixar.com/library/GarmentRefit/)
- Narita et al., EG 2016 *Garment Transfer for Quadruped Characters*: scale-measurement between characters inspired by tailor measurements; pose-independent transfer even human→horse; then transform clothing and preserve texture via a spring-mass system. — [EG 2016 short paper](https://diglib.eg.org/bitstreams/4da252a3-98d5-428d-8a6c-037182513d07/download)

### Inferences
- Print-sculpt Orc vs MakeHuman Human is the **non-matching topology, non-matching index space** case. MHCLO is the wrong tool unless an hm08-index proxy is inserted. Practical DCC paths:
  1. Fit rest mesh with a **volumetric** method (cage, RBF landmarks, pattern re-sim, or per-region scale + inflate), **then** transfer Mixamo/body weights with Nearest Face Interpolated.
  2. Or author the garment twice (Human rest, Orc rest) as MetaHuman-style size sources.
- Weight transfer alone never covers an Orc toe. It only makes the too-small boot *deform* with the Orc skeleton — the classic “Human-sized boots on an Orc foot” once animated.
- Marvelous Auto Fitting is the only mainstream tool in this list that grades in **2D pattern space** and then uses cloth collision to recover volume. That is why boots/gloves can actually cover a larger avatar there — the pattern is enlarged, not the 3D vertices projected.
- Voxel-heat skinning of clothes+body together is a *weight* trick for overlapping meshes, not a fit trick.

### Gaps
- Mixamo has no public algorithm paper equivalent to Pinocchio; the patent is the closest primary source and may not match the current web service.
- MetaHuman’s exact body-difference operator (cage? RBF? per-bone scale?) is not specified in the public Unreal Fest / docs language (“applies the differences”).
- I did not find a shipped AAA engine doc that says “we run Green Coordinates at runtime on outfits.” Public game pipelines describe baked rest meshes + LBS.

## Volume-preserving inflate, per-region scale, correspondence meshes

### Takeaway
Coverage of a huge foot is a **scale-of-the-garment-surface** problem. Methods that preserve or grade *volume/area* (MHCLO body-part offset scale, Green/harmonic cages, pattern grading, per-region landmark scale, tightness-rebind) can enlarge a boot. Methods that only offset along a normal (shrinkwrap Offset, Solidify Thickness, sculpt Inflate) add local leather thickness and will not cover a longer toe. Correspondence meshes (MakeHuman helpers, Marvelous fitting suits, MetaHuman source bodies, explicit cages) are how region scale is *targeted* at feet/hands/chest independently.

### Cited Findings
**Per-region scale (MakeHuman)**
- Offset scaling body parts include **Foot, Hand, Leg, Arm, Torso, Head, Genital, Body, Custom**, each defined by six landmark vertex indices (X1/X2, Y1/Y2, Z1/Z2). Only offsets, not the barycentric surface point, are multiplied by the three axis scales. — [MakeClothes Show Offset scaling](http://www.makehumancommunity.org/wiki/Documentation:MHBlenderTools:MakeClothes); [file formats, scale matrix](https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html)
- Proxy files also allow `shear_*` / `l_shear_*` / `r_shear_*` via `affine_matrix_from_points`; “scale overrides shear”; only one family is used. Documented as rarely used. — [MakeHuman file formats — Offset and bounds](https://static.makehumancommunity.org/oldsite/documentation/file_formats_and_extensions.html)

**Normal inflate / thickness (does not grade coverage)**
- Shrinkwrap Offset / Above Surface: constant distance along projection line or smooth normal. — [Blender Shrinkwrap](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/shrinkwrap.html)
- Solidify Thickness: extrude a shell; Even Thickness is an approximation; vertices with >3 adjacent faces are the failure case. — [Blender Solidify](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html)
- Cloth “inflate” in Blender is pressure / negative shrink factor on a cloth sim (“adds fabric”); it needs enough rest area or the mesh cones/collapses. That is a simulation of extra material, not a nearest-surface snap. — [Blender cloth inflate tutorial (method description)](https://www.youtube.com/watch?v=12CNhnE8-f4)

**Joint volume (animation, not rest coverage)**
- Blender Armature **Preserve Volume**: “Use quaternions for preserving volume of object during deformation.” Without it, joint rotations “scale down the neighboring geometry, up to nearly zero at 180 degrees.” With it, a discontinuity appears at 180°. Implemented as dual-quaternion skinning with a separate scale term. — [Blender 5.2 Armature Modifier](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/armature.html); [Blender DualQuaternionBase source comment](https://github.com/blender/blender/blob/main/source/blender/blenlib/BLI_math_quaternion_types.hh)
- This is the candy-wrapper fix. It does not enlarge a boot in rest pose. Babylon.js maintainers stated dual-quaternion skinning is not supported. — [Babylon.js forum, Deltakosh](https://forum.babylonjs.com/t/dual-quaternion-skinning/10595)

**Cage volume / shape**
- Harmonic coordinates: non-negative, interior falloff by cage-intrinsic distance — enlarging a foot lobe of the cage enlarges enclosed boot vertices smoothly, including those not on the body surface (sole thickness, heel block). — [Joshi et al. 2007 abstract](https://dl.acm.org/doi/10.1145/1276377.1276466)
- Green coordinates: quasi-conformal in 3D, resist shear so a boot’s raked shaft does not parallelogram-smear when the cage is scaled anisotropically. Affine-invariant MVC/HC *will* shear. — [Green Coordinates tech report](https://www.wisdom.weizmann.ac.il/~ylipman/GC/gc_techrep.pdf)
- Patent US20250104353A1 describes generating an outer **clothing cage** from an SDF approximant built of RBFs on a body mesh — i.e. an automated correspondence cage for clothing. — [US20250104353A1](https://patents.google.com/patent/US20250104353A1/en)

**Correspondence / helper meshes**
- MakeHuman helpers are a second mesh with the same index contract as the body but inflated in clothing-relevant regions (hair, skirt, shoes). Clothes bind to the helper so skirts do not attach to both legs. — [MakeClothes Delete-Groups](http://www.makehumancommunity.org/wiki/Documentation:MakeClothes_Delete-Groups)
- Marvelous Fitting Suit is a draped correspondence garment whose panel layout defines body regions for Auto Fitting. — [Marvelous Auto Fitting](https://support.marvelousdesigner.com/hc/en-us/articles/47358335130649-Auto-Fitting)
- MetaHuman multiple source bodies are discrete correspondence samples in shape space. — [Unreal Fest 2026 transcript](https://www.youtube.com/watch?v=A9CtqkjEa94)
- Pixar GarmentRefit “reset[s] the spacing between the refitted garment and the character body controlled by user-prescribed tightness values” after an affine-invariant relaxation — explicit rest-gap restoration, the opposite of shrinkwrap’s collapse-to-surface. — [GarmentRefit](https://graphics.pixar.com/library/GarmentRefit/)

**Design-preserving / pattern grading**
- Brouet 2012 treats transfer as preserving garment *design* (proportions of panels) rather than sticking cloth to skin; outputs graded patterns. — [Design Preserving Garment Transfer](https://scispace.com/pdf/design-preserving-garment-transfer-4g2bqeqcac.pdf)

### Inferences
Classification for the Orc-boot question:

| Method | Topology need | What it preserves | Covers huge Orc foot? |
| --- | --- | --- | --- |
| Shrinkwrap nearest surface | none | nothing but closest-point contact + constant offset | **No** — surface push |
| Shrinkwrap + Solidify/Inflate | none | local thickness | **No** — thicker Human boot |
| MHCLO barycentric + Foot scale | stable body indices; clothes free | rest offset scaled by Foot/Hand/… landmarks | **Yes, on hm08-family bodies** |
| Surface Deform / Maya Wrap | none; bind in rest | rest offset relative to *driver* | Yes **if** driver morphs from Human→Orc with same driver topology |
| Mesh Deform / HC / MVC cage | none | volumetric interpolation of cage | **Yes** if cage is scaled in the foot region |
| Green Coordinates cage | none | angles / local shape + volume-ish | **Yes**, less shear than MVC |
| RBF landmarks | none | interpolated landmark motion | **Yes** if toe/heel/ankle markers exist |
| Laplacian Deform | same garment topology | local differential detail | Post-pass only |
| Delta Mush / DQS | same topology | joint volume during animation | Not a rest-fit |
| Marvelous Auto Fitting | pattern, not mesh | 2D design + sim collision | **Yes** (re-sim) |
| MetaHuman sized sources | per-size meshes free | interpolated rest + copied weights | **Yes** if an Orc-like source exists |
| Weight transfer NFI | none | bone weights only | **No** |

Per-region independence: MHCLO’s Foot vs Hand vs Chest scale is the cheap, authored version of “do not let a big chest scale the boots.” Cages need either separate foot/hand cages (Blender Mesh Deform explicitly allows overlapping interior cages) or painted cage weights. RBF needs per-region landmarks. Shrinkwrap has no region scale at all.

### Gaps
- No public closed-form “inflate that preserves garment volume while covering a target SDF” used in DCC defaults; cvELD ShellFitBrush and similar addons are commercial and undocumented algorithmically.
- Bone-length scaling of a shared Mixamo skeleton will scale skinned clothes with the bones, but only if the rest garment already covers the rest foot. I found no Mixamo doc that grades clothing by bone length.

## Runtime vs offline bake for a WebGPU skinned mesh

### Takeaway
A glTF/WebGPU character is Linear Blend Skinning of a **rest POSITION buffer** by **JOINTS/WEIGHTS** and **inverseBindMatrices**. Cage coordinates, MHCLO barycentric maps, shrinkwrap, Surface Deform, and cloth sim are DCC operators. They must be **collapsed into rest positions** (and optionally morph targets) before export. Runtime can additionally evaluate morph targets and, if you write it, a tiny extra deformer — but Babylon Lite / glTF 2.0 will not evaluate a wrap or harmonic cage for you.

### Cited Findings
- glTF 2.0 “meshes support Linear Blend Skinning via skin objects, joint hierarchies, and designated vertex attributes.” Skinning is defined as computing “a per-vertex transformation matrix as a linear weighted sum of transformation matrices of the designated nodes.” — [glTF 2.0 spec, terminology + §3.7.3](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)
- Required skinning attributes: `JOINTS_n` (indices into `skin.joints`) and `WEIGHTS_n`. Inverse bind matrices are optional MAT4s; if present they “MUST be applied before the base node transforms.” “The matrix defining how to pose the skin’s geometry for use with the joints (also known as Bind Shape Matrix) should be premultiplied to mesh data or to Inverse Bind Matrices.” — [glTF 2.0 §3.7.3](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)
- “Only the joint transforms are applied to the skinned mesh; the transform of the skinned mesh node MUST be ignored.” — [glTF 2.0 §3.7.3.2](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins)
- Morph targets are “an altered state of a mesh primitive defined as a set of difference values for its vertex attributes.” Clients SHOULD support at least eight morphed attributes. — [glTF 2.0 morph targets](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- glTF is “not an authoring format” and “deliberately does not retain 3D authoring information, in order to preserve runtime efficiency.” — [glTF 2.0 Motivation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- Blender Armature Preserve Volume (dual quaternion) is a *runtime-in-Blender* flag; it does not survive as a glTF extension. Babylon.js: dual quaternion skinning “is not supported and we do not have plan for it at the moment.” — [Babylon.js forum](https://forum.babylonjs.com/t/dual-quaternion-skinning/10595)
- Direct Delta Mush paper: original DM’s iterative Laplacian “is expensive for interactive applications such as games.” — [Direct Delta Mush](https://www.researchgate.net/publication/334433596_Direct_delta_mush_skinning_and_variants)
- MetaHuman parametric outfits resize **offline / in MHC**, then assemble a skeletal mesh; runtime wears the assembled mesh. Skin weights are copied from the body after resize. — [Unreal Fest 2026](https://www.youtube.com/watch?v=A9CtqkjEa94); [Tailoring wardrobe items](https://dev.epicgames.com/documentation/metahuman/tailoring-your-own-wardrobe-items?lang=en-US)
- Surface Deform / Mesh Deform must be **Bound** then typically **Applied** before export; Blender warns Mesh Deform bind “can take a long time” and may OOM. — [Mesh Deform](https://docs.blender.org/manual/en/latest/modeling/modifiers/deform/mesh_deform.html)
- Data Transfer of weights “must be applied”; applying in a posed state bakes the posed weights. Rest-pose apply is required. — [CGbox weight transfer](https://cgbox.jp/2023/06/11/blender-weight-transfer/)

### Inferences
What **must** be baked into each Orc garment GLB:

1. **Rest `POSITION` (and NORMAL/TANGENT)** — the fitted boot that actually covers the print-sculpt foot. This is the only place volume/coverage can live unless you add morphs.
2. **`JOINTS_0` / `WEIGHTS_0`** — usually copied from the Orc body (or Mixamo bind) via nearest-face interpolated transfer, then cleaned. Max four influences per set (`JOINTS_0`); `JOINTS_1` is allowed but many WebGPU shaders only read set 0.
3. **`inverseBindMatrices`** — from the shared 65-joint bind. Same skeleton as the body, or the clothes will not follow the clips.
4. **Optional morph targets** — e.g. a “calf-loosen” or “tusk-hood” delta if you want cheap runtime fit sliders. These are rest-space deltas, same topology as that garment.
5. **Optional extra skinned shells** (boot tongue, glove cuff) as separate primitives if they need different weights.

What **must not** be expected at runtime in a Lite/WebGPU LBS path:

- Shrinkwrap, Surface Deform, Mesh Deform, Maya Wrap, MHCLO barycentric eval, Green/harmonic cage eval, cloth sim, Delta Mush iterations, dual-quaternion volume preserve.

Authoring recipe that matches the math:

1. Offline: build a **correspondence** (helper / cage / fitting-suit / landmark set / hm08 proxy).  
2. Offline: **grade** the garment with a volumetric or pattern method (not shrinkwrap).  
3. Offline: **bind** weights from the Orc Mixamo skin.  
4. Offline: apply modifiers; export GLB rest + skin.  
5. Runtime: LBS only. Coverage is already in the rest mesh.

If a single Human garment mesh must serve many bodies at runtime, the cheap WebGPU-legal options are (a) several pre-fitted rest meshes swapped by race, (b) morph targets toward an Orc rest (same garment topology), (c) a custom WGSL deformer you write (cage/RBF) — not stock glTF.

### Gaps
- glTF 2.0 does not specify a maximum number of joints per vertex beyond the attribute sets; engines often cap at 4. Confirm the Lite skinning shader’s cap before authoring dense weights.
- No Khronos extension for cage coordinates or MHCLO on the GPU. A custom `extras` payload would be non-portable.
- Exact Babylon Lite skinning implementation (texture-based vs uniform joints, morph budget) was not pulled from engine source in this pass; the portable contract is glTF LBS.

## Method map (for the report writer)

Surface-push (will leave Human-sized boots on an Orc foot unless the rest mesh was already large):

- Blender Shrinkwrap (all four wrap methods)
- Shrinkwrap Offset / Solidify / sculpt Inflate as the only “volume” step
- Weight transfer without a rest-fit pass

Volume / coverage-preserving (can cover a huge foot if correspondence is right):

- MHCLO barycentric + per-part offset scale (needs hm08-index body or proxy)
- Maya Wrap / Proximity Wrap / Blender Surface Deform bound to a body that **morphs** Human→Orc
- Harmonic / MVC / Green cage scaled in the foot/hand region
- RBF on toe/heel/ankle/knee landmarks
- Marvelous Auto Fitting (pattern grade + collide)
- Pixar GarmentRefit (affine-invariant relax + tightness rebind)
- Brouet 2012 design-preserving transfer
- MetaHuman multi-size outfit interpolation
- Explicit per-region rest-scale (Foot/Hand/Chest) then re-skin

Topology:

- Independent: shrinkwrap, wrap, surface deform, cages, RBF, NFI weight transfer, MHCLO clothes side
- Must match: morph-target copy by index, Laplacian Deform, Delta Mush, Data Transfer `Topology`
- Must match **body index space**: MHCLO, MakeHuman targets, Daz projected morphs on Genesis
)
</invoke>