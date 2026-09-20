# Undead head form source

`scripts/character-assets/undead_from_skull.py` reads `skull-obj/skull-Low4K.obj`
from this directory as the **form** source for the Undead revenant head:
the cranium, orbits, nasal aperture, zygomatic arches and the retained jaw of
`docs/references/undead-approved-concept.png`.

The skull is a real skull, not a human head pushed through a lattice. That is the
whole point: the retired `undead-v1` asset was a MakeHuman head with a green tint,
and no amount of warping turns those forms into orbits and a nasal aperture.

Fetch (CC0, no attribution required, credited anyway in `license.txt`):

```sh
curl -sSL -o skull-obj.zip https://opengameart.org/sites/default/files/skull-obj.zip
unzip -o skull-obj.zip
```
