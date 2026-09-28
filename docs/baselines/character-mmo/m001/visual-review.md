# M001 live character-motion review — 2026-09-27

Reviewed final [36.367-second MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m001-motion-v2-2026-09-27.mp4), delivered as Telegram message **788** (returned and file-probed 1280×720). Message 787 was an earlier, shorter review and is superseded. This is live Chromium/WebGPU capture of the current Vite game, not an offline render. Raw JPEG frames, nine view stills per pass, the frame timestamp manifest and the local MP4 remain under ignored `ve-capture/character-mmo/m001-final-valid/`. Source viewport, canvas and CDP frames were all 1280×720; encoded H.264 is 1280×720, 1:1 pixel aspect and has no rotation tag. The capture used the existing invulnerability toggle to avoid enemy damage. Recording was separate from performance sampling.

| Time | Race/outfit/action | Observed result | Classification |
| --- | --- | --- | --- |
| 0–5.9 s | Human Wayfarer, front/side/back, idle/walk/run/jump/cast previews | Stable silhouette and visible clothing; source motion plays in the armory. | Current baseline |
| 5.9–8.0 s | Human Warden two-handed greatstaff, front/side | Both hands approach the shaft; robe and hood remain visible. | Current baseline |
| 8.0–12.0 s | Human live movement, jump and casts | Gameplay resumes with Havok; Fire Blast visibly hits the dummy. | Current baseline |
| 12.0–18.3 s | Orc Wayfarer and Warden, three views and motion previews | Wider torso/arms fit their separate garment pack; mitten-like hands remain apparent close up. | Inherited art limitation |
| 20.4–24.4 s | Orc live movement, jump and cast attempts | Movement/animation continue, but a cast reports **Target is blocked** when another hostile intersects the dummy line of sight. No successful Orc spell impact is claimed. | Scene-dependent review limit |
| 24.4–30.5 s | Undead Wayfarer and Warden, three views and motion previews | Skull/hands are distinct; robe and hood display. The active garment bind disagrees with the body bind numerically; live silhouette alone cannot clear that structural failure. | Inherited incompatibility |
| 32.6–36.4 s | Undead live movement, jump and cast attempts | Movement/animation continue; casts are blocked by the live scene. No successful Undead spell impact is claimed. | Scene-dependent review limit |

The clip gives live views of every current race and the supported Wayfarer/Warden outfits. It does **not** establish that all frame-by-frame cloth/body intersections are clean, nor that the active Undead pack is deformation compatible. The latter is a concrete M001 audit finding. An isolated combat review with an unobstructed target is still needed before accepting Orc and Undead cast impact in a future visual milestone. No new visual defect was introduced by M001, which changes no runtime art or rendering path.
