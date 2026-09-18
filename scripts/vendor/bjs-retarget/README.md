# BJS offline retargeter

Unmodified `js/core/merge_api.mjs` and `js/core/rig_topology.mjs` from
https://github.com/crazyramirez/BJS_Character_Controller_V2 at commit
`869170ff94380b44b6f76753feee77c17c468819`. MIT license included beside the files.

Used only by `scripts/ashen-reach/append-directions.mjs`, with pinned glTF Transform
4.4.2 and draco3dgltf 1.5.7 dev dependencies. No Babylon Classic dependency enters
the browser. The adapter preserves our mesh/bind and existing clips, imports only
five retargeted animations, and removes source root-motion channels.

SHA-256:

- merge_api.mjs: `076a022d6e8836d1181a875d9d35a6a41fab7eebd9e09e5412d980e24c12fdb0`
- rig_topology.mjs: `c963ba3231f7ab19e07ac957d4103d8cc5ce52fc0df8f4e66eb0b1e459be6bbe`
