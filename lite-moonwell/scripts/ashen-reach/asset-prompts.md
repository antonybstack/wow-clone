# Generated art inputs — Ashen Reach

Both assets were generated with the built-in image generation tool, copied into the project, inspected locally and used in the actual runtime. They are not generated substitutes for the browser screenshots. The original generated files remain under `/Users/antbly/.codex/generated_images/01a0b03c-081b-7571-b353-fb87a0857dbe/`.

## `public/ashen-reach/foliage-atlas.png`

Original: `exec-04f8f220-437e-4878-8f16-8536ff4a123d.png`. Returned size 1254×1254 RGBA. Runtime uses quadrant UVs and alpha testing; output had small saturated red edge artifacts rejected by the shader.

Prompt:

> Create a production game foliage texture atlas, PNG with genuine transparent background. 1024x1024 square divided into four invisible equal square cells, with generous transparent padding around each cell. No text no borders no labels no ground no shadows behind plants. Upper left: single natural clump of tall thin dead ochre grass, with dozens of arching narrow blades and a few slender seed stalks, all roots meet near the bottom center of its cell. Upper right: a different slightly sparse tall olive green meadow grass clump, roots at bottom center. Bottom left: single broad wild bracken fern frond viewed flat front-on, tip at top center, stem reaches bottom center, natural pairs of finely serrated narrow leaflets extending on either side. Bottom right: a dry brown wild bracken fern frond similarly front-on. Style: realistic botanical albedo texture for a gritty late 1990s/early 2000s dark fantasy 3D game like Gothic 2, naturally mottled baked surface color, muted olive drab and old straw palette. Fine shapes with clear silhouettes, absolutely NO black outlines, NO cartoon look, NO tufts shaped like hedge balls. Foliage fills most of each cell and never crosses between cells. Flat diffuse lighting for alpha-cutout planes, visible shaded leaf veins and differentiated overlapping grass blades. Exact transparent pixels between blades. This is an asset sheet, not a finished scene.

## `public/ashen-reach/grave-face.png`

Original: `exec-965bc277-a1a9-4f91-945d-2ed88f7527d6.png`. Used only on the front faces of the authored grave silhouettes, with separate edge/back stone materials.

Prompt:

> Generate an original front-face albedo texture for a weathered medieval grave marker in a gritty low-resolution dark fantasy 3D game. This is a flat orthographic material texture filling the entire rectangular image edge to edge, NOT a rendered object or scene. Portrait 2:3 aspect. Pale grey buff limestone, centuries of irregular weather erosion, delicate hairline fractures, subtly mottled rough rock, dark green moss and brown soil staining strongest in lower quarter and very outer edges. In upper third is an extremely worn and barely legible sun-wheel carving, small central circle with four faint radial spokes surrounded by a faded incised ring; below this, three short uneven lines of very old shallow illegible carved marks. The carving is shallow, weathered, low contrast grey, NOT a black cross, NOT dark modern text or a logo. Most of the face is natural stone with subtle baked ambient shading. Gritty early 2000s hand-authored game texture aesthetic, believable material rather than cartoon or painting. Soft flat lighting, no perspective, no drop shadow, no outline, no border, no visible ground or background, the entire image is the stone surface. Avoid square block patterns, masonry bricks, checkerboards and polished plastic. Keep detail at a scale which reads when reduced to 128x192 pixels.
