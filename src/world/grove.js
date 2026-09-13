/**
 * Duskwell — starting glade on the world tree Vaelithil.
 *
 * Spatial bones from Shadowglen (central great tree, ringed hollow, a well,
 * forest wall, south path) without copying names or assets. Few draw calls:
 * bark / leaf / well / stone / flora / glow are merged meshes.
 */

import { Vector3, Vector4, Color3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { S } from "../core/settings.js";
import { bindMatrixArray } from "../core/gpuUtil.js";

const _hand = new Float32Array(3);
const _tip = new Float32Array(3);
const _base = new Float32Array(3);
const _splits = new Vector4(0, 0, 0, 0);

/** Local tip / butt of the held staff, metres from the right-hand grip. */
const STAFF_TIP_Y = 1.98;
const STAFF_BASE_Y = -0.84;
const STAFF_PITCH = -0.18;

/**
 * @param {import("@babylonjs/core/scene").Scene} scene
 * @param {import("../render/sky.js").Sky} sky
 * @param {{ heightAt(x:number,z:number):number }} terrain
 * @param {import("../render/shadows.js").ShadowSystem} [shadows]
 */
export function buildGrove(scene, sky, terrain, shadows) {
    const mats = [];
    const meshes = [];
    const atlas = makeGroveAtlas(scene);

    const mk = (name, kind, tint) => {
        const mat = new ShaderMaterial(name, scene, { vertex: "grove", fragment: "grove" }, {
            attributes: ["position", "normal"],
            uniforms: [
                "viewProjection", "world", "cameraPos", "sunDir", "sunRadiance",
                "shR", "ambientIntensity", "fogDensity", "fogHeightFalloff",
                "fogStart", "aerialStrength", "groveKind", "tint", "time",
                "cascadeMatrices", "cascadeSplits", "cascadeParams",
                "shadowTexel", "shadowSoftness", "shadowBias",
            ],
            samplers: ["skyLUT", "groveAtlas", "cascade0", "cascade1", "cascade2"],
            shaderLanguage: ShaderLanguage.WGSL,
        });
        mat.backFaceCulling = kind !== 1 && kind !== 3 && kind !== 5;
        mat.setTexture("skyLUT", sky.lut);
        mat.setTexture("groveAtlas", atlas);
        if (shadows) {
            for (let i = 0; i < 3; i++) mat.setTexture("cascade" + i, shadows.maps[i]);
        }
        mat.setFloat("groveKind", kind);
        mat.setColor3("tint", new Color3(tint[0], tint[1], tint[2]));
        mats.push(mat);
        return mat;
    };

    // Moonlit glade. One hue family for the world (cool blue-grey through moss
    // to a dusty rose), so the warm hero is the only saturated warm thing in
    // frame and reads at any distance. The palette this replaces put sky,
    // canopy, flora and hero all inside the same 280-330 degree magenta band,
    // which is why nothing separated from anything else.
    // These were authored while the glade had no key light in it — the moon sat
    // below the tree line and every one of these surfaces was clamped to the
    // shadow floor, so a reflectance of 0.5 came back as a quiet midtone. With
    // the moon over the canopy they are lit for the first time, and at 0.5 the
    // crowns went off like confetti: a rose, an amber and a lime, three
    // unrelated hues at near-maximum chroma, all brighter than the hero.
    //
    // One hue family for the world (cool blue-grey through moss to a dusty
    // rose), a third of the reflectance, and no amber at all — amber is warm,
    // and the hero is supposed to be the only warm thing in frame. The three
    // crown tints now sit within a tenth of a stop of each other in luminance
    // and differ only in hue, so a wood reads as one mass with species variation
    // in it rather than as a bag of sweets.
    const bark = mk("groveBark", 0, [0.235, 0.245, 0.295]);
    const leaf = mk("groveLeaf", 1, [0.215, 0.140, 0.200]);
    const leafGold = mk("groveLeafGold", 1, [0.230, 0.165, 0.155]);
    const leafGreen = mk("groveLeafGreen", 1, [0.130, 0.175, 0.140]);
    const well = mk("groveWell", 2, [0.10, 0.34, 0.42]);
    const wisp = mk("groveWisp", 3, [0.55, 0.92, 1.0]);
    wisp.alphaMode = 1;
    wisp.disableDepthWrite = true;
    // Staff crystal — HDR core so bloom catches it; purple matches the
    // warlock plate (cool key on the figure, warm embers at the butt).
    const crystalMat = mk("groveCrystal", 7, [1.55, 0.28, 2.40]);
    crystalMat.alphaMode = 1;
    crystalMat.disableDepthWrite = true;
    const stone = mk("groveStone", 4, [0.185, 0.185, 0.210]);
    const rim = mk("groveRim", 4, [0.225, 0.225, 0.255]);
    const wood = mk("groveWood", 4, [0.175, 0.130, 0.098]);
    const roof = mk("groveRoof", 4, [0.115, 0.115, 0.140]);
    const plaster = mk("grovePlaster", 6, [0.255, 0.230, 0.195]);
    // Read straight as the cap's upper surface by the flora branch, so this is
    // the colour of a moonlit mushroom top rather than a tint over one. At 0.66
    // — near snow — the caps were the brightest objects in the glade once the
    // key arrived, and a field of them pulled the eye off the hero completely.
    const flora = mk("groveFlora", 5, [0.385, 0.425, 0.505]);
    const npcKind = mk("groveNpc", 0, [0.16, 0.10, 0.07]);
    const npcHost = mk("groveHostile", 0, [0.10, 0.14, 0.08]);

    const barkBuf = new MeshBuf();
    const leafBuf = new MeshBuf();
    const goldBuf = new MeshBuf();
    const greenBuf = new MeshBuf();
    const wellBuf = new MeshBuf();
    const stoneBuf = new MeshBuf();
    const rimBuf = new MeshBuf();
    const woodBuf = new MeshBuf();
    const roofBuf = new MeshBuf();
    const floraBuf = new MeshBuf();
    const glowBuf = new MeshBuf();

    const y0 = terrain.heightAt(0, 0);

    // ----- Aethril: village-scale column, roots, south deck -----
    // Bare mid-trunk on purpose — Aldrassil is a place, not a mushroom.
    barkBuf.lathe(0, y0, 0, 2.55, 1.45, 40, 22, 26, 0.14);
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.18;
        const len = 5.2 + (k % 3) * 1.4;
        barkBuf.root(0, y0 + 0.15, 0, a, len, 0.85);
    }
    woodBuf.box(0, y0 + 8.9, 5.6, 6.4, 0.22, 4.2);
    woodBuf.box(2.4, y0 + 8.2, 3.8, 0.22, 1.5, 0.22);
    woodBuf.box(-2.4, y0 + 8.2, 3.8, 0.22, 1.5, 0.22);
    woodBuf.box(2.4, y0 + 8.2, 7.2, 0.22, 1.5, 0.22);
    woodBuf.box(-2.4, y0 + 8.2, 7.2, 0.22, 1.5, 0.22);

    // High arms + wide shallow umbrellas — Aldrassil is a place, not a mushroom.
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + hash(i) * 0.28;
        const len = 6.4 + hash(i + 2) * 4.8;
        const yb = y0 + 18 + hash(i + 3) * 14;
        const x0 = Math.cos(a) * 1.45;
        const z0 = Math.sin(a) * 1.45;
        const x1 = Math.cos(a) * len;
        const z1 = Math.sin(a) * len;
        barkBuf.cylinder(x0, yb, z0, x1, yb + 3.4, z1, 0.55 + hash(i) * 0.18, 6);
        addCrown(leafBuf, goldBuf, greenBuf, x1, yb + 3.8, z1, 5.2 + hash(i + 5) * 2.4, i + 40, 0);
    }
    // Aethril is one tree, so its twelve crowns are one species — the rose the
    // glade is named for.
    addCrown(leafBuf, goldBuf, greenBuf, 0.3, y0 + 36, 0.2, 10.5, 3, 0);
    addCrown(leafBuf, goldBuf, greenBuf, 2.4, y0 + 31, 2.2, 7.8, 8, 0);
    addCrown(leafBuf, goldBuf, greenBuf, -2.1, y0 + 28, 1.4, 6.4, 13, 0);

    // Mid-glade umbrellas — Shadowglen is not an empty lawn.
    const inner = [
        [8.6, 20.6], [-7.2, 21.2], [11.2, 16.8], [-8.6, 17.4],
        [14.8, 11.2], [-12.8, 10.6], [13.5, 5.5], [-10.2, 11.4],
        [12.2, -9.0], [-15.0, 2.4], [8.8, -13.2], [16.4, 1.2],
        [-13.4, -7.6], [-8.6, -11.2],
    ];
    for (let i = 0; i < inner.length; i++) {
        const x = inner[i][0];
        const z = inner[i][1];
        if (Math.abs(x) < 5.2 && z > 6.0) continue;
        if (Math.hypot(x - 11.2, z - 6.8) < 6.5) continue;
        if (Math.hypot(x + 6.8, z - 15.6) < 5.5) continue;
        const y = terrain.heightAt(x, z);
        const h = 6.5 + hash(i + 21) * 4.5;
        const rad = 0.38 + hash(i + 22) * 0.28;
        addTree(barkBuf, leafBuf, goldBuf, greenBuf, x, y, z, h, rad, i + 70);
    }

    // Hero-flanking trunks — Shadowglen stills always put a near tree in frame.
    const flanks = [
        [-10.2, 13.2, 10.8, 0.82],
        [9.2, 12.8, 9.2, 0.70],
    ];
    for (let i = 0; i < flanks.length; i++) {
        const x = flanks[i][0];
        const z = flanks[i][1];
        const y = terrain.heightAt(x, z);
        addTree(barkBuf, leafBuf, goldBuf, greenBuf, x, y, z, flanks[i][2], flanks[i][3], i + 400);
    }

    const logs = [
        [5.4, 18.2, 1.8],
        [-4.8, 16.6, 2.4],
        [10.2, 13.5, 0.4],
    ];
    for (let i = 0; i < logs.length; i++) {
        const x = logs[i][0];
        const z = logs[i][1];
        const a = logs[i][2];
        const y = terrain.heightAt(x, z) + 0.18;
        const dx = Math.cos(a) * 1.6;
        const dz = Math.sin(a) * 1.6;
        barkBuf.cylinder(x - dx, y, z - dz, x + dx, y + 0.12, z + dz, 0.16, 6);
    }

    const shrooms = [
        [4.2, 15.8, 0.95], [1.1, 17.2, 0.72], [-2.6, 14.4, 0.88],
        [6.8, 12.1, 0.80], [8.4, 10.6, 1.15], [-5.1, 11.8, 0.76],
        [3.6, 9.4, 0.68], [11.2, 7.8, 0.92], [-8.8, 8.2, 0.70],
        [7.1, 16.4, 0.60], [5.5, 14.2, 0.84],
    ];
    for (let i = 0; i < shrooms.length; i++) {
        const x = shrooms[i][0];
        const z = shrooms[i][1];
        const s = shrooms[i][2];
        const y = terrain.heightAt(x, z);
        // Stem on the flora material, not bark: a pale stalk under a pale cap.
        // On bark it came out near black and the cap read as a parasol floating
        // on an invisible pole.
        floraBuf.cylinder(x, y, z, x, y + s * 0.44, z, s * 0.075, 8);
        // Enough segments to stop the cap being a visible hexagon, and domed
        // rather than flat so the gill shading has a rim to fall off across.
        floraBuf.ellipsoid(x, y + s * 0.56, z, s * 0.55, s * 0.30, s * 0.55, 14, 7, 0.12);
    }

    const rocks = [
        [3.8, 13.2, 0.38], [6.2, 11.0, 0.46], [-3.4, 12.6, 0.34],
        [9.8, 9.6, 0.42], [-1.2, 15.5, 0.28], [2.2, 10.4, 0.36],
        [4.8, 17.6, 0.32], [-6.2, 14.8, 0.40], [1.4, 12.2, 0.26],
        [7.6, 14.8, 0.30], [-2.8, 18.2, 0.34], [10.4, 12.4, 0.36],
    ];
    for (let i = 0; i < rocks.length; i++) {
        const x = rocks[i][0];
        const z = rocks[i][1];
        const s = rocks[i][2];
        const y = terrain.heightAt(x, z);
        stoneBuf.ellipsoid(x, y + s * 0.28, z, s, s * 0.42, s * 0.78, 5, 4);
    }

    // Path ferns — low leaf cards that fill the empty lawn without blocking play.
    for (let i = 0; i < 28; i++) {
        const a = hash(i + 900) * Math.PI * 2;
        const r = 3.2 + hash(i + 901) * 11.5;
        const x = Math.cos(a) * r + (hash(i + 902) - 0.5) * 2.4;
        const z = 8.5 + Math.sin(a) * r * 0.55 + hash(i + 903) * 8.0;
        if (Math.hypot(x, z - 14) < 2.2) continue;
        const y = terrain.heightAt(x, z);
        const s = 0.22 + hash(i + 904) * 0.28;
        const buf = hash(i + 905) > 0.55 ? greenBuf : leafBuf;
        buf.card(x, y + 0.12, z, s, a, 1.35 + hash(i + 906) * 0.35);
        if (hash(i + 907) > 0.45) {
            buf.card(
                x + Math.cos(a + 1.1) * 0.18,
                y + 0.10,
                z + Math.sin(a + 1.1) * 0.18,
                s * 0.72,
                a + 1.1,
                1.45
            );
        }
    }

    // Door trees — long limbs over the south path so the first look is a
    // forest room, not a park with a sky hole.
    const doors = [
        [8.2, 16.4, -1],
        [-11.4, 17.2, 1],
        [7.6, 21.0, -1],
        [-6.4, 21.4, 1],
    ];
    for (let i = 0; i < doors.length; i++) {
        const x = doors[i][0];
        const z = doors[i][1];
        const side = doors[i][2];
        const y = terrain.heightAt(x, z);
        const x1 = x + side * 4.8;
        const z1 = z - 2.4;
        barkBuf.cylinder(x, y + 6.4, z, x1, y + 8.8, z1, 0.16, 5);
        const doorSpecies = treeSpecies(i + 200);
        addCrown(leafBuf, goldBuf, greenBuf, x1, y + 9.2, z1, 6.4, i + 200, doorSpecies);
        addCrown(leafBuf, goldBuf, greenBuf, x, y + 7.6, z, 5.2, i + 210, doorSpecies);
    }

    // ----- Forest wall, gap to the south (+Z) -----
    for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        let da = a - Math.PI * 0.5;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 0.58) continue;
        const rnd = hash(i);
        const r = 20 + rnd * 12;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (z > 10 && Math.abs(x) < 14) continue;
        if (Math.hypot(x - 11.2, z - 6.8) < 7.0) continue;
        if (Math.hypot(x + 6.8, z - 15.6) < 5.5) continue;
        const y = terrain.heightAt(x, z);
        const h = 8.5 + hash(i + 3) * 6.5;
        const rad = 0.62 + hash(i + 9) * 0.85;
        addTree(barkBuf, leafBuf, goldBuf, greenBuf, x, y, z, h, rad, i + 90);
    }

    // Camera looking -Z has right = -X. Moonwell on -X lands in the foreground
    // right, which is where gameplay-1 puts the well.
    const wx = -6.8;
    const wz = 15.6;
    const wy = terrain.heightAt(wx, wz);
    wellBuf.disc(wx, wy + 0.10, wz, 2.9, 24);
    // Unlumped: at 0.28 the jitter was a tenth of this ellipsoid's own height,
    // so the water surface undulated through the disc beneath it and left hard
    // angular slivers across the pool.
    wellBuf.ellipsoid(wx, wy + 0.20, wz, 2.75, 0.18, 2.75, 16, 8, 0);
    rimBuf.annulus(wx, wy + 0.04, wz, 2.85, 3.55, 18, 0.28);
    woodBuf.cylinder(wx - 1.45, wy, wz + 1.25, wx - 1.45, wy + 1.55, wz + 1.25, 0.08, 5);
    woodBuf.box(wx - 1.45, wy + 1.62, wz + 1.25, 0.68, 0.09, 0.68);
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.5;
        rimBuf.lathe(
            wx + Math.cos(a) * 3.85,
            wy,
            wz + Math.sin(a) * 3.85,
            0.24, 0.14, 1.05 + (k % 2) * 0.28,
            6, 5, 0.0
        );
    }
    // A dome of light over the water, not a lid on it.
    //
    // Round and unlumped, because at eight jittered segments this was the
    // hard-edged polygon that looked like a moon hanging over the glade. Tall
    // rather than flat, because the glow's falloff comes from the surface
    // normal: at 0.38 high against a 1.35 radius the top faced straight up
    // everywhere at once and the whole thing blew out to a flat white puddle.
    glowBuf.ellipsoid(wx, wy + 0.22, wz, 0.98, 0.46, 0.98, 24, 12, 0);

    // Quiet west pool — the hollow's second water, not a second moonwell.
    const px = -13.2;
    const pz = 6.4;
    const py = terrain.heightAt(px, pz);
    wellBuf.disc(px, py + 0.03, pz, 2.2, 16);
    rimBuf.annulus(px, py + 0.08, pz, 2.05, 2.65, 12, 0.16);

    // Tiny dusk flowers — notes on the carpet, not confetti chips.
    for (let i = 0; i < 90; i++) {
        const a = hash(i + 40) * Math.PI * 2;
        const r = 7.5 + hash(i + 80) * 20;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.hypot(x, z) < 6.2) continue;
        const y = terrain.heightAt(x, z) + 0.03;
        // Smaller and rounder. At five sides and twice this radius they read as
        // pentagon confetti dropped on the lawn rather than as flowers in it.
        floraBuf.disc(x, y, z, 0.055 + hash(i + 11) * 0.045, 7);
    }

    // ----- Wisps -----
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const r = 8.5 + (i % 3) * 2.2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r + 1.5;
        const y = terrain.heightAt(x, z) + 1.5 + (i % 5) * 0.4;
        glowBuf.ellipsoid(x, y, z, 0.18, 0.18, 0.18, 16, 10, 0);
    }

    const add = (buf, name, mat, group) => {
        const mesh = buf.finish(scene, name);
        mesh.material = mat;
        mesh.renderingGroupId = group;
        mesh.freezeWorldMatrix();
        meshes.push(mesh);
        return mesh;
    };

    const plasterBuf = new MeshBuf();
    addHut(plasterBuf, roofBuf, woodBuf, wellBuf, stoneBuf, terrain);
    add(plasterBuf, "groveHutMesh", plaster, 1);
    add(rimBuf, "groveRimMesh", rim, 1);
    add(barkBuf, "groveBarkMesh", bark, 1);
    add(leafBuf, "groveLeafMesh", leaf, 1);
    add(goldBuf, "groveGoldMesh", leafGold, 1);
    add(greenBuf, "groveGreenMesh", leafGreen, 1);
    add(woodBuf, "groveWoodMesh", wood, 1);
    add(roofBuf, "groveRoofMesh", roof, 1);
    add(wellBuf, "groveWellMesh", well, 2);
    add(stoneBuf, "groveStoneMesh", stone, 1);
    add(floraBuf, "groveFloraMesh", flora, 1);
    const glowMesh = add(glowBuf, "groveGlowMesh", wisp, 2);

    /** @type {ShaderMaterial[]} */
    const depthMats = [];
    if (shadows) {
        const casters = [
            "groveBarkMesh", "groveHutMesh", "groveWoodMesh", "groveRoofMesh",
            "groveStoneMesh", "groveRimMesh",
        ];
        for (let i = 0; i < casters.length; i++) {
            const mesh = scene.getMeshByName(casters[i]);
            if (!mesh) continue;
            shadows.registerCaster(mesh, (c) => {
                const mat = new ShaderMaterial(
                    "groveDepth_" + casters[i] + c, scene,
                    { vertex: "groveDepth", fragment: "terrainDepth" },
                    {
                        attributes: ["position"],
                        uniforms: ["lightViewProjection", "world"],
                        shaderLanguage: ShaderLanguage.WGSL,
                    }
                );
                mat.backFaceCulling = casters[i].indexOf("Leaf") < 0
                    && casters[i].indexOf("Gold") < 0
                    && casters[i].indexOf("Green") < 0;
                depthMats.push(mat);
                return mat;
            }, 2);
        }
        shadows.setHeightBounds(-4, 46);
    }

    // Held warlock staff — gnarled shaft + separate glowing crystal tip.
    // Follows the right hand each frame; tip/base drive spell lights + embers.
    // Planted on the ground and taller than the figure. Both matter: a staff
    // held clear of the snow has nothing to cast the warm pool off, and a staff
    // that tops out below the cowl puts the brightest thing in the frame behind
    // the darkest, which is the one place it cannot be.
    const heldBuf = new MeshBuf();
    heldBuf.cylinder(0.010, -0.86, 0.020, 0.022, -0.34, -0.010, 0.032, 6);
    heldBuf.cylinder(0.022, -0.34, -0.010, -0.016, 0.14, 0.014, 0.029, 6);
    heldBuf.cylinder(-0.016, 0.14, 0.014, 0.020, 0.62, -0.012, 0.027, 6);
    heldBuf.cylinder(0.020, 0.62, -0.012, -0.014, 1.10, 0.012, 0.025, 6);
    heldBuf.cylinder(-0.014, 1.10, 0.012, 0.018, 1.52, -0.010, 0.027, 6);
    // The crook. A straight pole reads as a broom handle; the kink under the
    // orb is what makes it a grown thing that was cut and kept.
    heldBuf.cylinder(0.018, 1.52, -0.010, -0.026, 1.74, 0.022, 0.030, 6);
    heldBuf.cylinder(-0.026, 1.74, 0.022, 0.000, 1.86, 0.000, 0.038, 7);
    heldBuf.ellipsoid(0.024, 0.38, 0.020, 0.040, 0.058, 0.040, 5, 4);
    heldBuf.ellipsoid(-0.022, 0.88, -0.018, 0.034, 0.050, 0.034, 5, 4);
    heldBuf.ellipsoid(0.026, 1.34, 0.022, 0.030, 0.044, 0.030, 5, 4);
    const held = heldBuf.finish(scene, "heldStaff");
    held.material = bark;
    held.renderingGroupId = 1;
    meshes.push(held);

    const crystalBuf = new MeshBuf();
    crystalBuf.ellipsoid(0, STAFF_TIP_Y, 0, 0.085, 0.115, 0.085, 12, 8);
    crystalBuf.ellipsoid(0, STAFF_TIP_Y + 0.12, 0, 0.042, 0.055, 0.042, 10, 6);
    crystalBuf.ellipsoid(0, STAFF_TIP_Y - 0.08, 0, 0.055, 0.040, 0.055, 8, 5);
    const crystal = crystalBuf.finish(scene, "heldCrystal");
    crystal.material = crystalMat;
    crystal.renderingGroupId = 2;
    crystal.parent = held;
    meshes.push(crystal);

    // Pendant charms — small HDR beads hanging off the mantle line.
    const beadMat = mk("groveBead", 7, [1.2, 0.35, 2.0]);
    beadMat.alphaMode = 1;
    beadMat.disableDepthWrite = true;
    // A hanging chain rather than a cluster. It runs down the front of the
    // mantle into the dark half of the robe, which is the only thing putting
    // light down there — the value ramp has taken the cloth itself to
    // silhouette by that height, and an unbroken silhouette that tall is a
    // shape, not a figure.
    const beadBuf = new MeshBuf();
    beadBuf.ellipsoid(0, 0, 0, 0.028, 0.028, 0.028, 8, 6);
    beadBuf.ellipsoid(0.058, -0.05, 0.012, 0.019, 0.019, 0.019, 6, 5);
    beadBuf.ellipsoid(-0.050, -0.09, -0.012, 0.016, 0.016, 0.016, 6, 5);
    beadBuf.ellipsoid(0.030, -0.17, 0.020, 0.014, 0.014, 0.014, 5, 4);
    beadBuf.ellipsoid(-0.026, -0.27, 0.014, 0.012, 0.012, 0.012, 5, 4);
    beadBuf.ellipsoid(0.044, -0.36, -0.010, 0.010, 0.010, 0.010, 5, 4);
    beadBuf.ellipsoid(-0.014, -0.46, 0.018, 0.009, 0.009, 0.009, 5, 4);
    const beads = beadBuf.finish(scene, "heldBeads");
    beads.material = beadMat;
    beads.renderingGroupId = 2;
    meshes.push(beads);

    const npcs = placeNpcs(scene, terrain, npcKind, npcHost);
    for (let i = 0; i < npcs.length; i++) meshes.push(npcs[i].mesh);

    return {
        meshes,
        mats,
        depthMats,
        npcs,
        held,
        crystal,
        glowMesh,
        tip: _tip,
        base: _base,
        /**
         * @param {import("@babylonjs/core/Cameras/camera").Camera} camera
         * @param {number} time
         */
        update(camera, time) {
            if (shadows) {
                _splits.set(
                    shadows.splits[0], shadows.splits[1],
                    shadows.splits[2], shadows.splits[3]
                );
            }
            for (let i = 0; i < mats.length; i++) {
                const m = mats[i];
                m.setVector3("cameraPos", camera.position);
                m.setVector3("sunDir", sky.sunDir);
                m.setColor3("sunRadiance", sky.sunRadiance);
                m.setArray4("shR", sky.shForShaders());
                m.setFloat("ambientIntensity", S.ambientIntensity);
                m.setFloat("fogDensity", S.fogDensity);
                m.setFloat("fogHeightFalloff", S.fogHeightFalloff);
                m.setFloat("fogStart", S.fogStart);
                m.setFloat("aerialStrength", S.aerialStrength * 0.62);
                m.setFloat("time", time);
                if (shadows) {
                    bindMatrixArray(m, "cascadeMatrices", shadows.matrixData);
                    m.setVector4("cascadeSplits", _splits);
                    m.setArray4("cascadeParams", shadows.paramData);
                    m.setFloat("shadowTexel", shadows.texelSize);
                    m.setFloat("shadowSoftness", 2.2);
                    m.setFloat("shadowBias", 0.028);
                }
            }
        },
        /**
         * @param {{ figure: { handPosition(which:number, out:Float32Array, od:number):void } }} figure
         * @param {number} facing
         */
        syncHeld(figure, facing) {
            figure.figure.handPosition(1, _hand, 0);
            held.position.set(_hand[0], _hand[1], _hand[2]);
            held.rotation.y = facing;
            held.rotation.x = STAFF_PITCH;
            staffLocalToWorld(STAFF_TIP_Y, facing, _tip);
            staffLocalToWorld(STAFF_BASE_Y, facing, _base);
            // Pendant charms at the chest bone.
            const j = figure.figure.joint;
            const ci = 2 * 3; // B_CHEST
            const sx = Math.sin(facing);
            const cz = Math.cos(facing);
            beads.position.set(
                j[ci] + sx * 0.06,
                j[ci + 1] - 0.08,
                j[ci + 2] + cz * 0.06
            );
            beads.rotation.y = facing;
        },
        /**
         * Purple tip + warm butt — the dual key from the warlock plate.
         * @param {{ add(x:number,y:number,z:number,radius:number,r:number,g:number,b:number,intensity:number):void }} lights
         */
        declareHeldLights(lights) {
            // Cool violet key: tight, intense, lights the cowl and shoulder.
            lights.add(_tip[0], _tip[1], _tip[2], 3.1, 0.72, 0.28, 1.15, 5.6);
            // Warm ember pool where the staff meets the snow. It is the only
            // warm source in the scene and it is at ground level, so it underlits
            // the hem — the counter-key that keeps a floor-length robe from
            // merging with the ground it is standing on.
            lights.add(_base[0], _base[1] + 0.10, _base[2], 2.2, 1.0, 0.48, 0.10, 3.1);
        },
        /**
         * Magic dust off the crystal + warm embers at the butt.
         * @param {{ emit(x:number,y:number,z:number,vx:number,vy:number,vz:number,size:number,life:number,kind:number,drag?:number):void }} spray
         * @param {number} dt
         */
        emitAura(spray, dt) {
            // The plume. In the reference this is the tallest element in the
            // frame after the staff itself — it leaves the orb and keeps going,
            // well past the top of the canvas. Long lives and a real upward
            // velocity, with the lateral spread deliberately narrow so it reads
            // as a column of light rather than a puff around the orb.
            const nDust = Math.min(5, Math.max(1, Math.floor(dt * 70)));
            for (let i = 0; i < nDust; i++) {
                const jx = (Math.random() - 0.5) * 0.14;
                const jy = (Math.random() - 0.5) * 0.14;
                const jz = (Math.random() - 0.5) * 0.14;
                spray.emit(
                    _tip[0] + jx, _tip[1] + jy, _tip[2] + jz,
                    (Math.random() - 0.5) * 0.20,
                    0.75 + Math.random() * 0.95,
                    (Math.random() - 0.5) * 0.20,
                    0.012 + Math.random() * 0.020,
                    1.3 + Math.random() * 1.5,
                    2, // purple magic
                    1.1
                );
            }

            // Motes hanging in the air around the figure. The cloth carries its
            // own (see `char.fragment.wgsl`), but those stop at the silhouette,
            // and the reference's motes are in the *space* around the figure —
            // which is what gives the air between camera and subject something
            // in it and stops the glade reading as a backdrop. Near-zero
            // velocity and a long life: they drift, they do not spray.
            const nHalo = Math.min(3, Math.max(1, Math.floor(dt * 26)));
            for (let i = 0; i < nHalo; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 0.35 + Math.random() * 1.15;
                spray.emit(
                    _base[0] + Math.cos(a) * r,
                    _base[1] + 0.15 + Math.random() * 1.85,
                    _base[2] + Math.sin(a) * r,
                    (Math.random() - 0.5) * 0.09,
                    0.06 + Math.random() * 0.16,
                    (Math.random() - 0.5) * 0.09,
                    0.008 + Math.random() * 0.012,
                    2.2 + Math.random() * 2.4,
                    2, // purple magic
                    0.35
                );
            }
            const nEmber = Math.min(3, Math.max(1, Math.floor(dt * 35)));
            for (let i = 0; i < nEmber; i++) {
                const jx = (Math.random() - 0.5) * 0.22;
                const jz = (Math.random() - 0.5) * 0.22;
                spray.emit(
                    _base[0] + jx, _base[1] + 0.04, _base[2] + jz,
                    (Math.random() - 0.5) * 0.15,
                    0.35 + Math.random() * 0.55,
                    (Math.random() - 0.5) * 0.15,
                    0.010 + Math.random() * 0.014,
                    0.55 + Math.random() * 0.7,
                    3, // warm ember
                    0.9
                );
            }
        },
        get triangles() {
            let n = 0;
            for (let i = 0; i < meshes.length; i++) {
                n += meshes[i].metadata?.triangles || 0;
            }
            return n;
        },
    };
}

/**
 * Staff local (0, y, 0) → world, matching held.rotation (pitch X, then yaw Y).
 * @param {number} localY
 * @param {number} facing
 * @param {Float32Array} out
 */
function staffLocalToWorld(localY, facing, out) {
    const cp = Math.cos(STAFF_PITCH);
    const sp = Math.sin(STAFF_PITCH);
    const ly = localY * cp;
    const lz = localY * sp;
    const cy = Math.cos(facing);
    const sy = Math.sin(facing);
    out[0] = _hand[0] + lz * sy;
    out[1] = _hand[1] + ly;
    out[2] = _hand[2] + lz * cy;
}

/**
 * @param {import("@babylonjs/core/scene").Scene} scene
 * @param {{ heightAt(x:number,z:number):number }} terrain
 * @param {ShaderMaterial} kind
 * @param {ShaderMaterial} host
 */
function placeNpcs(scene, terrain, kind, host) {
    const spots = [
        { id: "npc.ilsa", name: "Ilsa Greenhand", x: 6.5, z: -4.2, hostile: false, h: 1.7, r: 0.48 },
        { id: "npc.thorn", name: "Thorn Kit", x: -8.2, z: 9.1, hostile: true, h: 1.05, r: 0.38 },
        { id: "npc.grell1", name: "Hollow Grell", x: 14, z: 11, hostile: true, h: 1.05, r: 0.36 },
        { id: "npc.grell2", name: "Hollow Grell", x: 17, z: 7.4, hostile: true, h: 1.0, r: 0.34 },
        { id: "npc.grell3", name: "Hollow Grell", x: 19.5, z: 13.2, hostile: true, h: 1.1, r: 0.37 },
        { id: "npc.stag", name: "Dusk Stag", x: -11, z: -8, hostile: true, h: 1.55, r: 0.42 },
    ];
    const out = [];
    for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const buf = new MeshBuf();
        buf.capsule(0, 0, 0, s.r, s.h, 8, 8);
        const mesh = buf.finish(scene, s.id);
        mesh.material = s.hostile ? host : kind;
        const y = terrain.heightAt(s.x, s.z);
        mesh.position.set(s.x, y, s.z);
        mesh.renderingGroupId = 1;
        mesh.freezeWorldMatrix();
        out.push({
            id: s.id,
            name: s.name,
            hostile: s.hostile,
            position: mesh.position,
            plateY: s.h + 0.18,
            mesh,
        });
    }
    return out;
}

function addTree(barkBuf, leafBuf, goldBuf, greenBuf, x, y, z, h, rad, seed) {
    const species = treeSpecies(seed);
    barkBuf.lathe(x, y, z, rad, rad * 0.22, h, 10, 12, 0.055);
    barkBuf.ellipsoid(x, y + rad * 0.38, z, rad * 1.45, rad * 0.52, rad * 1.45, 6, 4);
    const forks = hash(seed) > 0.42 ? 3 : 2;
    for (let k = 0; k < forks; k++) {
        const a = (k / forks) * Math.PI * 2 + hash(seed + k) * 0.65;
        const yb = y + h * (0.56 + hash(seed + k + 1) * 0.20);
        const len = rad * 2.6 + 1.8 + hash(seed + k + 2) * 1.8;
        const x1 = x + Math.cos(a) * len;
        const z1 = z + Math.sin(a) * len;
        const y1 = yb + 1.1 + hash(seed + k + 3) * 1.4;
        barkBuf.cylinder(x, yb, z, x1, y1, z1, rad * 0.42, 6);
        addCrown(leafBuf, goldBuf, greenBuf, x1, y1 + 0.15, z1, 2.6 + hash(seed + k + 4) * 1.2, seed + k * 17, species);
    }
    addCrown(leafBuf, goldBuf, greenBuf, x, y + h * 0.94, z, 4.0 + hash(seed + 9) * 1.6, seed + 3, species);

    // Undergrowth at the butt — breaks the trunk-on-lawn contact line.
    const under = species === 2 ? greenBuf : leafBuf;
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + hash(seed + k + 50) * 0.7;
        const r = rad * (1.6 + hash(seed + k + 51) * 1.8);
        under.card(
            x + Math.cos(a) * r,
            y + 0.18 + hash(seed + k + 52) * 0.22,
            z + Math.sin(a) * r,
            0.28 + hash(seed + k + 53) * 0.22,
            a + 0.3,
            1.25 + hash(seed + k + 54) * 0.4
        );
    }
}

/**
 * Which of the three foliage buffers a whole tree belongs to.
 *
 * Chosen once per trunk rather than per crown, so a tree is one species from
 * root to tip. 0 rose, 1 amber, 2 moss.
 *
 * @param {number} seed
 * @returns {number}
 */
function treeSpecies(seed) {
    const h = hash(seed + 7);
    if (h > 0.74) return 1;
    if (h < 0.30) return 2;
    return 0;
}

function addCrown(leafBuf, goldBuf, greenBuf, x, y, z, scale, seed, species) {
    // One species per tree, with the occasional off-colour puff.
    //
    // Picking per puff — as this did — put rose, amber and moss inside every
    // single crown in the glade. At canopy scale that reads as confetti, and it
    // also erases the larger rhythm of a wood: whole trees turning while their
    // neighbours have not.
    const primary = species === 1 ? goldBuf : (species === 2 ? greenBuf : leafBuf);
    const accent = species === 1 ? leafBuf : goldBuf;
    const pick = (k) => (hash(seed + k + 19) > 0.86 ? accent : primary);

    // Soft volumetric core so distant crowns stay opaque (cards alone go
    // lacey past ~30 m). Flattened umbrellas, not candy spheres.
    primary.umbrella(x, y + scale * 0.02, z, scale * 0.92, scale * 0.20, seed);
    primary.umbrella(x, y - scale * 0.14, z, scale * 0.58, scale * 0.12, seed + 5);

    // Layered leaf cards — the silhouette that kills the "ball cluster" read.
    const shells = 3;
    for (let shell = 0; shell < shells; shell++) {
        const t = (shell + 0.35) / shells;
        const n = 9 + shell * 7;
        const shellR = scale * (0.32 + t * 0.62);
        const shellY = y + (0.42 - t) * scale * 0.55;
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + hash(seed + shell * 47 + k) * 0.85;
            const elev = (hash(seed + k * 3 + shell * 13) - 0.45) * 1.15;
            const r = shellR * (0.62 + hash(seed + k + 3) * 0.55);
            const px = x + Math.cos(a) * r;
            const py = shellY + elev * scale * 0.28 + (hash(seed + k + 8) - 0.5) * scale * 0.12;
            const pz = z + Math.sin(a) * r;
            const s = scale * (0.11 + hash(seed + k + 11) * 0.13);
            const yaw = a + (hash(seed + k + 14) - 0.5) * 1.6;
            const tilt = 0.45 + hash(seed + k + 17) * 1.05;
            pick(k).card(px, py, pz, s, yaw, tilt);
        }
    }

    // Drip fringe under the umbrella — breaks the hard lower rim.
    const drips = 5 + ((seed * 3) | 0) % 3;
    for (let k = 0; k < drips; k++) {
        const a = hash(seed + k + 30) * Math.PI * 2;
        const r = scale * (0.25 + hash(seed + k + 31) * 0.45);
        pick(k + 40).card(
            x + Math.cos(a) * r,
            y - scale * (0.22 + hash(seed + k + 32) * 0.18),
            z + Math.sin(a) * r,
            scale * (0.10 + hash(seed + k + 33) * 0.08),
            a + 0.4,
            1.15 + hash(seed + k + 34) * 0.55
        );
    }
}

function addHut(wallBuf, roofBuf, woodBuf, wellBuf, stoneBuf, terrain) {
    const hx = 11.2;
    const hz = 6.8;
    const hy = terrain.heightAt(hx, hz);
    wallBuf.box(hx, hy + 1.55, hz, 6.4, 3.1, 4.6);
    roofBuf.box(hx, hy + 3.14, hz, 7.4, 0.18, 5.4);
    roofBuf.prismRoof(hx, hy + 3.24, hz, 7.6, 1.35, 5.6);
    woodBuf.box(hx, hy + 0.16, hz, 6.6, 0.32, 4.8);
    woodBuf.box(hx, hy + 0.24, hz + 2.75, 4.2, 0.18, 1.7);
    woodBuf.box(hx, hy + 1.15, hz + 2.32, 1.15, 2.15, 0.16);
    woodBuf.box(hx - 1.55, hy + 1.55, hz + 2.28, 0.12, 2.9, 0.12);
    woodBuf.box(hx + 1.55, hy + 1.55, hz + 2.28, 0.12, 2.9, 0.12);
    woodBuf.box(hx, hy + 1.85, hz + 2.28, 6.0, 0.12, 0.12);
    wellBuf.box(hx - 1.85, hy + 1.85, hz + 2.32, 0.92, 0.78, 0.12);
    woodBuf.box(hx + 2.65, hy + 1.25, hz + 2.95, 0.15, 2.55, 0.15);
    woodBuf.box(hx - 2.65, hy + 1.25, hz + 2.95, 0.15, 2.55, 0.15);
    woodBuf.box(hx - 3.15, hy + 1.55, hz + 2.25, 0.14, 3.0, 0.14);
    woodBuf.box(hx + 3.15, hy + 1.55, hz + 2.25, 0.14, 3.0, 0.14);
    woodBuf.box(hx, hy + 2.55, hz + 2.28, 6.2, 0.14, 0.12);
    woodBuf.box(hx - 3.15, hy + 2.55, hz, 0.12, 0.14, 4.4);
    stoneBuf.box(hx + 2.15, hy + 3.95, hz - 1.15, 0.55, 1.45, 0.55);
    wallBuf.box(hx + 3.65, hy + 1.05, hz - 0.25, 2.1, 2.05, 2.3);
}

/**
 * Painted bark (left) + leaf splotches (right). World-space sampled so we
 * don't need mesh UVs. This is what makes trunks stop reading as clay poles.
 */
function makeGroveAtlas(scene) {
    const w = 512;
    const h = 512;
    const data = new Uint8Array(w * h * 4);
    const n2 = (x, y) => {
        const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return s - Math.floor(s);
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const v = y / h;
            const i = (y * w + x) * 4;
            let r, g, b;
            if (x < w * 0.5) {
                const uu = u * 2.0;
                // Broad bands so bark still reads at 20 m after bilinear.
                const fiber = Math.abs(Math.sin(uu * 14.0 + Math.sin(v * 5.0) * 1.6 + n2(uu * 3, v * 2) * 1.4));
                const pit = n2(uu * 6.0, v * 8.0);
                const moss = n2(uu * 2.4 + 3.0, v * 2.2);
                r = 0.36 + fiber * 0.16 + pit * 0.05;
                g = 0.32 + fiber * 0.12 + moss * 0.08;
                b = 0.36 + fiber * 0.14;
                if (moss > 0.68) {
                    r = r * 0.62 + 0.10;
                    g = g * 0.62 + 0.18;
                    b = b * 0.62 + 0.08;
                }
            } else {
                const uu = (u - 0.5) * 2.0;
                const a = n2(uu * 3.6, v * 3.6);
                const c = n2(uu * 8.0 + 4.0, v * 7.5);
                const edge = n2(uu * 14.0, v * 13.0);
                if (a > 0.58) {
                    r = 0.68 + c * 0.16;
                    g = 0.16 + c * 0.08;
                    b = 0.42 + c * 0.14;
                } else if (a > 0.30) {
                    r = 0.16 + c * 0.08;
                    g = 0.46 + c * 0.16;
                    b = 0.10 + c * 0.06;
                } else {
                    r = 0.54 + c * 0.16;
                    g = 0.42 + c * 0.12;
                    b = 0.10 + c * 0.06;
                }
                const shade = 0.48 + 0.52 * edge;
                r *= shade;
                g *= shade;
                b *= shade;
            }
            data[i] = Math.min(255, r * 255) | 0;
            data[i + 1] = Math.min(255, g * 255) | 0;
            data[i + 2] = Math.min(255, b * 255) | 0;
            data[i + 3] = 255;
        }
    }
    const tex = RawTexture.CreateRGBATexture(
        data, w, h, scene,
        false, false,
        Constants.TEXTURE_BILINEAR_SAMPLINGMODE
    );
    tex.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
    tex.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    return tex;
}

function hash(i) {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/** Accumulates procedural parts, then uploads once. */
function MeshBuf() {
    this.p = [];
    this.n = [];
    this.i = [];
}

/**
 * Flat wavy umbrella — Teldrassil canopies at mid-range are wide pancakes,
 * not clay spheres.
 */
MeshBuf.prototype.umbrella = function (cx, cy, cz, radius, thick, seed) {
    const segs = 12;
    const rings = 3;
    const base = this.p.length / 3;
    this.p.push(cx, cy + thick * 0.92, cz);
    this.n.push(0, 1, 0);
    for (let i = 1; i <= rings; i++) {
        const t = i / rings;
        for (let j = 0; j < segs; j++) {
            const wobble = 0.58 + 0.62 * hash(seed * 13 + j * 5 + i * 19);
            const r = radius * t * wobble;
            const lift = (1 - t * t) * thick + (hash(seed + j * 7 + i) - 0.5) * thick * 0.35;
            const a = (j / segs) * Math.PI * 2;
            this.p.push(cx + Math.cos(a) * r, cy + lift, cz + Math.sin(a) * r);
            this.n.push(Math.cos(a) * 0.28, 0.9, Math.sin(a) * 0.28);
        }
    }
    for (let j = 0; j < segs; j++) {
        this.i.push(base, base + 1 + j, base + 1 + ((j + 1) % segs));
    }
    for (let i = 0; i < rings - 1; i++) {
        const r0 = base + 1 + i * segs;
        const r1 = base + 1 + (i + 1) * segs;
        for (let j = 0; j < segs; j++) {
            const j2 = (j + 1) % segs;
            this.i.push(r0 + j, r1 + j, r0 + j2, r0 + j2, r1 + j, r1 + j2);
        }
    }
};

/** Leaf card — a disc in a tilted plane, so canopies read as foliage not clay. */
MeshBuf.prototype.card = function (cx, cy, cz, s, yaw, tilt) {
    const cy_ = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    // Local axes: right, up (tilted), out
    const rx = cy_;
    const ry = 0;
    const rz = -sy;
    const ux = sy * st;
    const uy = ct;
    const uz = cy_ * st;
    const nx = sy * ct;
    const ny = -st;
    const nz = cy_ * ct;
    const segs = 5;
    const base = this.p.length / 3;
    this.p.push(cx, cy, cz);
    this.n.push(nx, ny, nz);
    for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const c = Math.cos(a);
        const si = Math.sin(a);
        this.p.push(cx + (rx * c + ux * si) * s, cy + (ry * c + uy * si) * s, cz + (rz * c + uz * si) * s);
        this.n.push(nx, ny, nz);
    }
    for (let j = 0; j < segs; j++) {
        this.i.push(base, base + 1 + j, base + 1 + ((j + 1) % segs));
    }
};

/**
 * @param {number} [lumpAmt] Radial jitter, default 0.28. Positions only — the
 *   normals stay truly spherical, so this reads as an organic surface on a leaf
 *   puff or a rock but as a ragged silhouette on anything whose outline matters.
 *   Pass 0 for a clean round shape.
 */
MeshBuf.prototype.ellipsoid = function (cx, cy, cz, rx, ry, rz, su, sv, lumpAmt) {
    const amt = lumpAmt === undefined ? 0.28 : lumpAmt;
    const base = this.p.length / 3;
    for (let v = 0; v <= sv; v++) {
        const phi = (v / sv) * Math.PI;
        const sp = Math.sin(phi);
        const cp = Math.cos(phi);
        for (let u = 0; u <= su; u++) {
            const a = (u / su) * Math.PI * 2;
            const nx = Math.cos(a) * sp;
            const ny = cp;
            const nz = Math.sin(a) * sp;
            const lump = 0.96 - amt * 0.5 + amt * hash((u + 3) * 17 + (v + 5) * 31 + (cx + 11) * 9);
            this.p.push(cx + nx * rx * lump, cy + ny * ry * lump, cz + nz * rz * lump);
            this.n.push(nx, ny, nz);
        }
    }
    const stride = su + 1;
    for (let v = 0; v < sv; v++) {
        for (let u = 0; u < su; u++) {
            const a = base + v * stride + u;
            const b = a + stride;
            this.i.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
};

MeshBuf.prototype.lathe = function (cx, cy, cz, r0, r1, height, segs, rings, wobble) {
    const base = this.p.length / 3;
    for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        const flare = Math.pow(1 - t, 2.2);
        const rBase = r0 * flare + r1 * (1 - flare);
        const y = cy + t * height;
        for (let j = 0; j < segs; j++) {
            const r = rBase * (1 + wobble * Math.sin(t * 11 + cx) + wobble * 0.65 * Math.sin(j * 2.3 + t * 9));
            const a = (j / segs) * Math.PI * 2;
            const x = cx + Math.cos(a) * r;
            const z = cz + Math.sin(a) * r;
            this.p.push(x, y, z);
            this.n.push(Math.cos(a), 0.18, Math.sin(a));
        }
    }
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
            const a = base + i * segs + j;
            const b = base + i * segs + (j + 1) % segs;
            const c = base + (i + 1) * segs + j;
            const d = base + (i + 1) * segs + (j + 1) % segs;
            this.i.push(a, c, b, b, c, d);
        }
    }
};

MeshBuf.prototype.root = function (cx, cy, cz, angle, len, rad) {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    for (let s = 0; s < 4; s++) {
        const t = (s + 1) / 4;
        const x = cx + dx * len * t;
        const z = cz + dz * len * t;
        const y = cy - t * 0.35;
        const r = rad * (1.05 - t * 0.7);
        this.ellipsoid(x, y, z, r * 1.35, r * 0.55, r * 1.35, 6, 4);
    }
};

MeshBuf.prototype.cylinder = function (x0, y0, z0, x1, y1, z1, r, segs) {
    const base = this.p.length / 3;
    const vx = x1 - x0;
    const vy = y1 - y0;
    const vz = z1 - z0;
    const len = Math.hypot(vx, vy, vz) || 1;
    let ax = 0;
    let ay = 1;
    let az = 0;
    if (Math.abs(vy / len) > 0.95) {
        ax = 1;
        ay = 0;
    }
    let px = ay * vz - az * vy;
    let py = az * vx - ax * vz;
    let pz = ax * vy - ay * vx;
    const pl = Math.hypot(px, py, pz) || 1;
    px /= pl;
    py /= pl;
    pz /= pl;
    let qx = vy * pz - vz * py;
    let qy = vz * px - vx * pz;
    let qz = vx * py - vy * px;
    const ql = Math.hypot(qx, qy, qz) || 1;
    qx /= ql;
    qy /= ql;
    qz /= ql;
    for (let end = 0; end < 2; end++) {
        const x = end ? x1 : x0;
        const y = end ? y1 : y0;
        const z = end ? z1 : z0;
        for (let j = 0; j < segs; j++) {
            const a = (j / segs) * Math.PI * 2;
            const c = Math.cos(a);
            const s = Math.sin(a);
            this.p.push(x + (px * c + qx * s) * r, y + (py * c + qy * s) * r, z + (pz * c + qz * s) * r);
            this.n.push(px * c + qx * s, py * c + qy * s, pz * c + qz * s);
        }
    }
    for (let j = 0; j < segs; j++) {
        const a = base + j;
        const b = base + (j + 1) % segs;
        const c = base + segs + j;
        const d = base + segs + (j + 1) % segs;
        this.i.push(a, c, b, b, c, d);
    }
};

MeshBuf.prototype.annulus = function (cx, cy, cz, r0, r1, segs, thick) {
    const y0 = cy;
    const y1 = cy + thick;
    for (let ring = 0; ring < 2; ring++) {
        const y = ring ? y1 : y0;
        this._ring(cx, y, cz, r0, segs, 0, ring ? 1 : -1);
        this._ring(cx, y, cz, r1, segs, 0, ring ? 1 : -1);
    }
    // Sides
    const n = segs;
    // This helper already pushed 4 rings × segs verts. Index the last 4*n.
    const base = this.p.length / 3 - 4 * n;
    const inner0 = base;
    const outer0 = base + n;
    const inner1 = base + 2 * n;
    const outer1 = base + 3 * n;
    for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n;
        this.i.push(inner0 + j, inner1 + j, inner0 + j2, inner0 + j2, inner1 + j, inner1 + j2);
        this.i.push(outer0 + j, outer0 + j2, outer1 + j, outer0 + j2, outer1 + j2, outer1 + j);
        this.i.push(inner0 + j, inner0 + j2, outer0 + j, inner0 + j2, outer0 + j2, outer0 + j);
        this.i.push(inner1 + j, outer1 + j, inner1 + j2, inner1 + j2, outer1 + j, outer1 + j2);
    }
};

MeshBuf.prototype._ring = function (cx, cy, cz, r, segs, nySign) {
    for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        this.p.push(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r);
        this.n.push(0, nySign || 1, 0);
    }
};

MeshBuf.prototype.disc = function (cx, cy, cz, radius, segs) {
    const base = this.p.length / 3;
    this.p.push(cx, cy, cz);
    this.n.push(0, 1, 0);
    for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        this.p.push(cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius);
        this.n.push(0, 1, 0);
    }
    for (let j = 0; j < segs; j++) {
        this.i.push(base, base + 1 + j, base + 1 + ((j + 1) % segs));
    }
};

MeshBuf.prototype.capsule = function (cx, cy, cz, r, h, rings, segs) {
    const base = this.p.length / 3;
    for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        const y = cy + t * h;
        const rr = r * (0.55 + 0.45 * Math.sin(t * Math.PI));
        for (let j = 0; j < segs; j++) {
            const a = (j / segs) * Math.PI * 2;
            this.p.push(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr);
            this.n.push(Math.cos(a), 0.2, Math.sin(a));
        }
    }
    for (let i = 0; i < rings; i++) {
        for (let j = 0; j < segs; j++) {
            const a = base + i * segs + j;
            const b = base + i * segs + (j + 1) % segs;
            const c = base + (i + 1) * segs + j;
            const d = base + (i + 1) * segs + (j + 1) % segs;
            this.i.push(a, c, b, b, c, d);
        }
    }
};

MeshBuf.prototype.box = function (cx, cy, cz, sx, sy, sz) {
    const hx = sx * 0.5;
    const hy = sy * 0.5;
    const hz = sz * 0.5;
    const faces = [
        [0, 1, 0, 0, hy, 0],
        [0, -1, 0, 0, -hy, 0],
        [1, 0, 0, hx, 0, 0],
        [-1, 0, 0, -hx, 0, 0],
        [0, 0, 1, 0, 0, hz],
        [0, 0, -1, 0, 0, -hz],
    ];
    for (let f = 0; f < 6; f++) {
        const nx = faces[f][0];
        const ny = faces[f][1];
        const nz = faces[f][2];
        const ox = faces[f][3];
        const oy = faces[f][4];
        const oz = faces[f][5];
        let ux, uy, uz, vx, vy, vz;
        if (Math.abs(ny) > 0.5) {
            ux = hx;
            uy = 0;
            uz = 0;
            vx = 0;
            vy = 0;
            vz = hz;
        } else if (Math.abs(nx) > 0.5) {
            ux = 0;
            uy = hy;
            uz = 0;
            vx = 0;
            vy = 0;
            vz = hz;
        } else {
            ux = hx;
            uy = 0;
            uz = 0;
            vx = 0;
            vy = hy;
            vz = 0;
        }
        const base = this.p.length / 3;
        const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let i = 0; i < 4; i++) {
            const su = signs[i][0];
            const sv = signs[i][1];
            this.p.push(cx + ox + ux * su + vx * sv, cy + oy + uy * su + vy * sv, cz + oz + uz * su + vz * sv);
            this.n.push(nx, ny, nz);
        }
        this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
};

MeshBuf.prototype.prismRoof = function (cx, cy, cz, sx, h, sz) {
    const hx = sx * 0.5;
    const hz = sz * 0.5;
    const ridge = [
        [cx, cy + h, cz - hz],
        [cx, cy + h, cz + hz],
    ];
    const eave = [
        [cx - hx, cy, cz - hz],
        [cx + hx, cy, cz - hz],
        [cx + hx, cy, cz + hz],
        [cx - hx, cy, cz + hz],
    ];
    // Two slopes
    this._quad(
        eave[0][0], eave[0][1], eave[0][2],
        ridge[0][0], ridge[0][1], ridge[0][2],
        ridge[1][0], ridge[1][1], ridge[1][2],
        eave[3][0], eave[3][1], eave[3][2]
    );
    this._quad(
        eave[1][0], eave[1][1], eave[1][2],
        eave[2][0], eave[2][1], eave[2][2],
        ridge[1][0], ridge[1][1], ridge[1][2],
        ridge[0][0], ridge[0][1], ridge[0][2]
    );
    // Gables
    this._tri(eave[0][0], eave[0][1], eave[0][2], eave[1][0], eave[1][1], eave[1][2], ridge[0][0], ridge[0][1], ridge[0][2]);
    this._tri(eave[3][0], eave[3][1], eave[3][2], ridge[1][0], ridge[1][1], ridge[1][2], eave[2][0], eave[2][1], eave[2][2]);
};

MeshBuf.prototype._tri = function (ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const i = this.p.length / 3;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.i.push(i, i + 1, i + 2);
};

MeshBuf.prototype._quad = function (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
    this._tri(ax, ay, az, bx, by, bz, cx, cy, cz);
    this._tri(ax, ay, az, cx, cy, cz, dx, dy, dz);
};

MeshBuf.prototype.finish = function (scene, name) {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.p;
    vd.normals = this.n;
    vd.indices = this.i;
    vd.applyToMesh(mesh);
    mesh.metadata = { triangles: (this.i.length / 3) | 0 };
    return mesh;
};
