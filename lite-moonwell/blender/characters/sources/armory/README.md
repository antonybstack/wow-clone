# Wayfarer source assets

Viking tunic, trousers and boots by **Rehman Polanski**, plus Monk robe/hood by **Donitz**, distributed as **CC0-1.0** in the MakeHuman suits02 CC0 pack. The original `.mhclo` headers retain the author/license declarations. Source page: https://static.makehumancommunity.org/assets/assetpacks/suits02.html . `provenance.json` records the exact archive and extracted file SHA-256 values.

`python3 scripts/ashen-reach/fetch-equipment-assets.py` verifies the archive before extracting the selected garments. The downloaded archive is a local cache, not a runtime dependency. Trousers are shipped as separate main/cuff panels. The robe is shortened into the Pilgrim tunic and separated/eased into the Graveweaver skirt; original sources remain unchanged.

Derivation: authored MakeClothes fitting against the existing Human's MakeHuman targets; interpolated source weights including helper vertices; existing A-rest/source-rig conversion; 256×256 diffuse textures; remapped weights to the original 65-joint source skin. Original garment UVs and geometric design are retained. Human/rig/animation licensing remains governed by their separate existing provenance; the CC0 garment license does not relicense the actor or motion. The arming sword is original procedural geometry in `src/ashen-reach/arming-sword.js`.


Short gloves by **Margaret Toigo** (original MHCLO author `MRT`) are from the separate **CC0-1.0** gloves01 pack: https://static.makehumancommunity.org/assets/assetpacks/gloves01.html . Archive SHA-256: `ecdaee1d02749d17352791d415cb622a883350cc8a4b90eda3725aef35d9afb2`. `gloves-provenance.json` retains extracted-file hashes.

Graveweaver's cropped mail top, long skirt, hood and gloves reuse these CC0 authored sources. The chest pendant, staff and closed grimoire are project-original low-poly geometry. OSRS Ahrim is visual inspiration only; no Jagex geometry or textures are distributed. See `docs/ashen-equipment-authoring.md` for exact fitting, coverage and known limits.
