# Ashen Reach — Babylon Lite

A reference-led, low-poly textured third-person MMORPG starter scene. Active route: **ashen-reach.html**.

```sh
cd /Users/antbly/dev/wow-clone/lite-moonwell
npm install
npm run dev -- --host 127.0.0.1 --port 5180
```

Open `http://127.0.0.1:5180/ashen-reach.html?play&clean`.

- W/S move; A/D turn; Q/E strafe; RMB look; Shift walk; Space jump.
- Tab targets the training dummy; Escape clears targeting after pointer-lock handling.
- **1 — Fire Blast:** short wind-up, 120 damage, moving casts supported.
- **2 — Lava Ball:** 1.5s charge, 240 impact damage; movement/jump interrupts charging.
- **C — Armory:** opens the developer armory; Escape or Return to the churchyard closes it.

Read **[current direction](docs/CURRENT.md)** to resume work, **[the workflow](docs/reference-led-workflow-2026-09-17.md)** for the method, and **[the docs map](docs/README.md)** for implementation references.

The character lab and body preview remain available as development tools. They are not playable game routes or the current art target. Babylon Lite/WebGPU and the >120 FPS goal remain; reported ~144 FPS evidence is local 960×540 rendering, not a native-resolution or MMO-scale guarantee.

Open the developer armory with **C** or the **Armory** button for close-up orbit, animation preview, pause/scrub and independent seven-slot equipment selection. The Wayfarer, Pilgrim and Graveweaver presets are available; Graveweaver includes the hood, magic vestment, robe skirt, gloves, staff and grimoire. Held props stow during casting. Human is currently the only fitted race; Orc and Undead remain planned. Equipment and race fitting progress is tracked in [the living plan](docs/armory-and-equipment-plan.md).
