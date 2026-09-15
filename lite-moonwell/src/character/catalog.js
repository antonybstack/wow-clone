/**
 * Paper-doll catalog. Source of truth is item GLBs on sockets
 * (https://doc.babylonjs.com/lite/architecture/13-skeleton/) — not a second skeleton.
 * `glb` is loaded with Lite loadGltf; missing/404 falls back to equipment.js build*.
 */
function origin() {
    return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    };
}

/** Flip a +Y lathe so it runs down the Mixamo arm (shoulder → hand), not into the cowl. */
function armDown() {
    return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: Math.PI, y: 0, z: 0 },
    };
}

export const ITEMS = {
    hood: {
        id: "hood",
        slot: "head",
        bone: "head",
        name: "Void Cowl",
        glb: "/characters/items/cowl.glb?v=sleeve1",
        local: origin(),
    },
    staff: {
        id: "staff",
        slot: "mainHand",
        bone: "mainHand",
        name: "Nightstaff",
        glb: "/characters/items/staff.glb?v=sleeve1",
        // Shaft is +Y in the GLB. Mixamo RightHand +Y runs through the fist,
        // so identity local keeps the grip; do not world-up slerp in sockets.
        local: origin(),
    },
    cape: {
        id: "cape",
        slot: "back",
        bone: "back",
        name: "Dusk Cape",
        glb: "/characters/items/cape.glb?v=sleeve1",
        local: origin(),
    },
    tunic: {
        id: "tunic",
        slot: "torso",
        bone: "torso",
        name: "Dusk Robe",
        glb: "/characters/items/robe.glb?v=sleeve1",
        local: origin(),
    },
    sleeveL: {
        id: "sleeveL",
        slot: "leftArm",
        bone: "leftArm",
        name: "Sleeve L",
        glb: "/characters/items/sleeve.glb?v=sleeve1",
        local: armDown(),
    },
    sleeveR: {
        id: "sleeveR",
        slot: "rightArm",
        bone: "rightArm",
        name: "Sleeve R",
        glb: "/characters/items/sleeve.glb?v=sleeve1",
        local: armDown(),
    },
    sleeveForeL: {
        id: "sleeveForeL",
        slot: "leftForeArm",
        bone: "leftForeArm",
        name: "Forearm L",
        glb: "/characters/items/sleeve-fore.glb?v=sleeve1",
        local: origin(),
    },
    sleeveForeR: {
        id: "sleeveForeR",
        slot: "rightForeArm",
        bone: "rightForeArm",
        name: "Forearm R",
        glb: "/characters/items/sleeve-fore.glb?v=sleeve1",
        local: origin(),
    },
    bootL: {
        id: "bootL",
        slot: "leftFoot",
        bone: "leftFoot",
        name: "Boot L",
        glb: "/characters/items/boot.glb?v=sleeve1",
        local: origin(),
    },
    bootR: {
        id: "bootR",
        slot: "rightFoot",
        bone: "rightFoot",
        name: "Boot R",
        glb: "/characters/items/boot.glb?v=sleeve1",
        local: origin(),
    },
    hoodAsh: {
        id: "hoodAsh",
        slot: "head",
        bone: "head",
        name: "Ash Cowl",
        glb: "/characters/items/cowl.glb?v=sleeve1",
        local: origin(),
        tint: [0.62, 0.50, 0.36],
    },
    staffEmber: {
        id: "staffEmber",
        slot: "mainHand",
        bone: "mainHand",
        name: "Emberstaff",
        glb: "/characters/items/staff.glb?v=sleeve1",
        local: origin(),
        tintGem: [0.95, 0.32, 0.08],
    },
};

export const DEFAULT_LOADOUT = [
    ["mainHand", "staff"],
    ["head", "hood"],
    ["back", "cape"],
    ["torso", "tunic"],
    ["leftArm", "sleeveL"],
    ["rightArm", "sleeveR"],
    ["leftFoot", "bootL"],
    ["rightFoot", "bootR"],
];
