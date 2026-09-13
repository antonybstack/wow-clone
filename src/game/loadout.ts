/**
 * Gear is the spec. No class lock — equipped tags vote, the bag is the rest
 * of who you are. RuneScape soul, not a talent tree.
 */

export type Slot =
    | "head" | "chest" | "hands" | "legs" | "feet"
    | "main" | "off" | "ranged" | "trinket";

export type Item = {
    id: string;
    name: string;
    slot: Slot;
    /** Tags that vote for the derived stance. */
    tags: string[];
    /** Robe / mantle / leather albedo override (linear). */
    robe?: [number, number, number];
    mantle?: [number, number, number];
    leather?: [number, number, number];
    ability?: string;
};

export const ITEMS: Record<string, Item> = {
    moonleaf_cowl: {
        id: "moonleaf_cowl", name: "Moonleaf Cowl", slot: "head",
        tags: ["seer", "nature"],
        robe: [0.10, 0.16, 0.22],
    },
    rootbound_mail: {
        id: "rootbound_mail", name: "Rootbound Mail", slot: "chest",
        tags: ["warden", "guard"],
        robe: [0.14, 0.18, 0.11],
        mantle: [0.20, 0.24, 0.14],
        leather: [0.12, 0.09, 0.06],
    },
    duskweave_robe: {
        id: "duskweave_robe", name: "Duskweave Robe", slot: "chest",
        tags: ["seer", "moon"],
        // Midnight indigo — warlock plate. Mantle darker than the robe so the
        // shoulders read as a second layer; both stay under the staff's purple
        // key so the glow, not the cloth, carries the frame.
        robe: [0.095, 0.052, 0.135],
        mantle: [0.058, 0.044, 0.078],
    },
    trail_leathers: {
        id: "trail_leathers", name: "Trail Leathers", slot: "chest",
        tags: ["ranger", "hunt"],
        robe: [0.22, 0.14, 0.08],
        mantle: [0.28, 0.18, 0.10],
        leather: [0.16, 0.10, 0.06],
    },
    wellspring_gloves: {
        id: "wellspring_gloves", name: "Wellspring Gloves", slot: "hands",
        tags: ["seer", "nature"],
        // Leather is one slot for belt, boots and hands, so this override paints
        // all three. At the old 0.10/0.18/0.20 it was a mid-value teal, which
        // under a cool beam came back as pale blue-grey plastic and made the
        // belt read as tape across the robe. Keep the wellspring tint, drop it
        // far enough to read as a dyed hide: this is meant to be the darkest
        // thing on the model.
        //
        // Darkest by measurement, not by intention. The boots point up and out,
        // so they take more of a 46-degree beam than any other part of the
        // costume — at 0.042 reflectance they rendered brighter than the robe
        // and level with the lawn, and a hooded figure in ember wool was walking
        // around in pale grey shoes. Orientation is part of the value, and a
        // slot that has to be darkest everywhere has to be authored for the
        // angle that flatters it most.
        leather: [0.022, 0.029, 0.030],
    },
    briar_greaves: {
        id: "briar_greaves", name: "Briar Greaves", slot: "legs",
        tags: ["warden", "guard"],
    },
    silent_treads: {
        id: "silent_treads", name: "Silent Treads", slot: "feet",
        tags: ["ranger", "hunt"],
    },
    thornpike: {
        id: "thornpike", name: "Thornpike", slot: "main",
        tags: ["warden"],
        ability: "Sweep",
    },
    moonwell_orb: {
        id: "moonwell_orb", name: "Moonwell Orb", slot: "off",
        tags: ["seer", "moon"],
        ability: "Bloom",
    },
    yew_longbow: {
        id: "yew_longbow", name: "Yew Longbow", slot: "ranged",
        tags: ["ranger"],
        ability: "Ribbon",
    },
    seed_of_aethril: {
        id: "seed_of_aethril", name: "Seed of Aethril", slot: "trinket",
        tags: ["nature", "seer"],
        ability: "Crystallize",
    },
    hollow_tooth: {
        id: "hollow_tooth", name: "Hollow Tooth", slot: "trinket",
        tags: ["hunt"],
        ability: "Vortex",
    },
};

const SLOT_ORDER: Slot[] = [
    "head", "chest", "hands", "legs", "feet", "main", "off", "ranged", "trinket",
];

export class Loadout {
    equipped: Record<Slot, string | null> = {
        head: "moonleaf_cowl",
        chest: "duskweave_robe",
        hands: "wellspring_gloves",
        legs: null,
        feet: "silent_treads",
        main: "thornpike",
        off: "moonwell_orb",
        ranged: null,
        trinket: "seed_of_aethril",
    };

    bag: string[] = [
        "rootbound_mail", "trail_leathers", "briar_greaves",
        "yew_longbow", "hollow_tooth",
    ];

    stance(): string {
        const votes: Record<string, number> = Object.create(null);
        for (const slot of SLOT_ORDER) {
            const id = this.equipped[slot];
            if (!id) continue;
            const it = ITEMS[id];
            if (!it) continue;
            for (const tag of it.tags) votes[tag] = (votes[tag] || 0) + 1;
        }
        let best = "Wanderer";
        let n = 0;
        for (const k in votes) {
            if (votes[k] > n) {
                n = votes[k];
                best = k;
            }
        }
        if (best === "seer") return "Seer";
        if (best === "warden") return "Warden";
        if (best === "ranger") return "Ranger";
        if (best === "nature") return "Greenward";
        if (best === "moon") return "Moon-sworn";
        if (best === "hunt") return "Trailhand";
        if (best === "guard") return "Rootguard";
        return "Wanderer";
    }

    bar(): string[] {
        const names = ["—", "—", "—", "—", "—"];
        const map: Record<string, number> = {
            Sweep: 0, Ribbon: 1, Bloom: 2, Crystallize: 3, Vortex: 4,
        };
        for (const slot of SLOT_ORDER) {
            const id = this.equipped[slot];
            if (!id) continue;
            const ab = ITEMS[id]?.ability;
            if (ab && map[ab] !== undefined) names[map[ab]] = ab;
        }
        return names;
    }

    equip(itemId: string): boolean {
        const it = ITEMS[itemId];
        if (!it) return false;
        const bagI = this.bag.indexOf(itemId);
        if (bagI < 0) return false;
        const prev = this.equipped[it.slot];
        this.bag.splice(bagI, 1);
        if (prev) this.bag.push(prev);
        this.equipped[it.slot] = itemId;
        return true;
    }

    unequip(slot: Slot): boolean {
        const id = this.equipped[slot];
        if (!id) return false;
        this.equipped[slot] = null;
        this.bag.push(id);
        return true;
    }

    /**
     * Write gear colours onto the figure palette.
     * @param {{ _matAlbedo: Float32Array }} figure
     */
    applyToFigure(figure: { _matAlbedo: Float32Array }): void {
        let robe: [number, number, number] | undefined;
        let mantle: [number, number, number] | undefined;
        let leather: [number, number, number] | undefined;
        for (const slot of SLOT_ORDER) {
            const id = this.equipped[slot];
            if (!id) continue;
            const it = ITEMS[id];
            if (it.robe) robe = it.robe;
            if (it.mantle) mantle = it.mantle;
            if (it.leather) leather = it.leather;
        }
        const a = figure._matAlbedo;
        if (robe) {
            a[0] = robe[0]; a[1] = robe[1]; a[2] = robe[2];
        }
        if (mantle) {
            a[4] = mantle[0]; a[5] = mantle[1]; a[6] = mantle[2];
        }
        if (leather) {
            a[12] = leather[0]; a[13] = leather[1]; a[14] = leather[2];
        }
    }
}
