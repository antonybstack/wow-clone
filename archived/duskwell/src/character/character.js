/**
 * The character system.
 *
 * Owns the skeleton, the garment simulation, the three meshes and the seven
 * pipelines that draw them, and the single small texture that carries every
 * per-frame transform to the GPU.
 *
 * The transform texture is the spine of the whole thing. Rows 0-3 hold bone
 * skinning matrices, rows 4 and beyond hold simulated cloth nodes, and one
 * `update()` per frame writes both into a pre-allocated staging array and
 * uploads it once. Nothing else crosses to the GPU: no per-frame buffers, no
 * matrix uniforms, no vertex data.
 *
 * Allocation per frame: none.
 */

import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { Vector2, Vector3, Vector4, Color3 } from "@babylonjs/core/Maths/math";

import { Figure, BONE_COUNT } from "./figure.js";
import { makePanels, ClothSolver, BODY_CAPSULES } from "./cloth.js";
import { buildBody, buildFur, buildClothMesh } from "./build.js";
import { S } from "../core/settings.js";
import { whenReady, bindMatrixArray } from "../core/gpuUtil.js";
import { CASCADE_COUNT } from "../render/shadows.js";
import { SPELL_LIGHT_UNIFORMS } from "../spells/spellLights.js";
import { LOCAL_SHADOW_UNIFORMS, LOCAL_SHADOW_SAMPLERS } from "../render/localShadow.js";

/** Transform texture geometry. Width covers the widest of bones or panel cols. */
const TEX_W = 48;
const TEX_H = 64;
/** First texture row available to cloth panels; 0-3 are the bone matrices. */
const CLOTH_ROW0 = 4;

/** How many cascades the figure casts into. See `ShadowSystem.registerCaster`. */
const CHAR_CASCADES = 2;

/**
 * Material palette. Eight slots, uploaded as two vec4 arrays so every value is
 * live-tunable and nothing is baked into the shader.
 *
 * Warm, and alone in being warm. The glade is cool blue-grey through moss to a
 * dusty rose, so an ember hero separates from the grass, from the canopy and
 * from the sky at any distance — where the old violet robe sat in the same hue
 * band as all three and read as a dark smudge.
 *
 * The constraint that actually sets these numbers is *value spread*, not hue.
 * An earlier pass picked six tones that were all handsome and all within a
 * third of a stop of each other, and the figure came back as a single orange
 * silhouette with a seam where the mantle should have been: at night the fill
 * is broad and nearly directionless, so a garment boundary is only visible if
 * the two albedos differ in brightness. Read down the luminances here and they
 * step about half a stop at a time — leather 0.022, scarf 0.033, under-tunic
 * 0.035, robe 0.053, mantle 0.108, skin 0.138 — which is what makes the
 * shoulders sit in front of the chest and the chest in front of the sleeves.
 *
 * Skin is the brightest slot and that is deliberate. It is also carrying the
 * heaviest baked occlusion in the mesh, so what survives is a sliver of lit
 * brow inside a dark cowl: the eye goes to the face because it is the one
 * high-key note on the model, without the face itself ever being bright.
 *
 * The absolute level is set by the tone curve, and getting it wrong is what
 * every previous pass here got wrong. Successive rounds of "the robe looks hot"
 * walked the reflectances down until the robe sat at 0.053 luminance — darker
 * than charcoal, and darker than the lawn it stands on. Measured off a frame
 * with the figure in full key light, the entire costume then spanned 0.016 to
 * 0.037 linear: one and a quarter stops, all of it inside AgX's toe, where the
 * curve's slope is low enough that shading is compressed to nothing on the way
 * to the display. That is what "the character looks flat" was. It was never a
 * shading problem — there was nothing wrong with the BRDF, the light or the
 * shadows. There was simply no reflectance for any of them to act on.
 *
 * So these are stated as reflectances a dyed wool garment actually has, and the
 * ladder is in luminance: leather 0.042, scarf 0.088, under-tunic 0.095, robe
 * 0.115, mantle 0.180, skin 0.289. Darkest to brightest is two and three
 * quarter stops of albedo alone, and with a terminator on top the figure covers
 * a little over four — which is enough for the light side, the turn and the
 * shadow side to be three distinguishable things.
 *
 * The order at the top of that list is composition, not realism. Skin is the
 * brightest slot by two thirds of a stop over the next one down, because the
 * face is what the frame is about and it is also the smallest thing on the
 * model: the mantle is twenty times its area, so at equal value the cape wins
 * on area alone and the eye never arrives at the head. An earlier pass had the
 * mantle at 0.215 and that is precisely what happened — a pale trapezoid across
 * the chest that read as an apron and took the whole silhouette with it.
 *
 * Hue does one job here that value cannot, which is to keep the face off the
 * cape. An earlier version of this ladder had the mantle at a russet so close
 * to skin that the two were within a few percent in every channel, and since
 * the mantle is twenty times the area of the visible face, the face simply
 * joined it — a head-shaped continuation of the shoulders. The mantle is now a
 * greige wool: it is still the second brightest thing on the model, but it is
 * neutral, so the two warm notes on the figure are the ember robe and the face,
 * and nothing competes with them on hue.
 *
 * Slots 0, 1 and 3 are only the unequipped defaults: `Loadout.applyToFigure`
 * writes over robe, mantle and leather from whatever gear is on. Any change to
 * the value hierarchy here has to be made in `ITEMS` as well or it will be
 * overwritten on the first frame.
 */
const PALETTE = [
    // rgb, roughness. Authored cooler than they render: the sky fill is
    // blue-heavy, so B is kept from racing ahead of R/G into lavender candy.
    //
    // The split between slots 0 and 1 is the whole design. Every earlier pass
    // here spent its value budget *within* the costume — half a stop between
    // six garments — and the figure came back as one dark mass with seams in
    // it. This spends it between two layers instead: the mantle at 0.18
    // luminance against a robe at 0.05, nearly two stops, so from across the
    // glade the read is a pale wedge of shoulder standing over a silhouette.
    // Two shapes, and the eye resolves a tall figure out of them. Six shapes
    // half a stop apart resolve into none.
    //
    // The robe can afford to be this dark because the shader's value ramp only
    // takes it *further* down toward the hem — the number here is the brightest
    // the robe ever gets, at the waist, where the mantle is about to cover it
    // anyway.
    // 0.185 on the mantle was chosen as "the brightest a garment gets before it
    // reads as an apron", which was the right rule for a short cape on a lit
    // figure and the wrong one here. At night, keyed by a violet point light
    // with no fill to speak of, a 0.185 wool lands in the same few percent of
    // the display range as the robe and the two-stop ladder collapses back into
    // one purple mass. This is a pale wool — concrete, near enough — and it has
    // to be, because the only thing establishing that the figure has a light
    // half is this panel's own value.
    [0.062, 0.040, 0.098, 0.84], // 0 robe, near-black indigo
    [0.300, 0.290, 0.380, 0.86], // 1 mantle, pale grey-lavender wool
    [0.070, 0.062, 0.078, 0.80], // 2 under-tunic, shadowed linen
    [0.028, 0.022, 0.020, 0.48], // 3 leather, near-black hide
    // Face is a void under the cowl — keep skin dark enough that the opening
    // reads as shadow, not a mannequin. Staff light paints the rim, not the face.
    [0.095, 0.062, 0.052, 0.68], // 4 skin (dim)
    [0.052, 0.032, 0.068, 0.76], // 5 trim / scarf, dark violet wool
    [0.130, 0.132, 0.165, 0.85], // 6 fur
    [0.100, 0.100, 0.100, 0.80], // 7 spare
];

/**
 * (sheen, anisotropy, transmission, weave depth) per slot.
 *
 * Transmission is the number to be careful with. Moonlight through a *warm*
 * robe, multiplied by a *cool* beam, comes back grey — so a generous
 * transmission term does not make the garment glow, it desaturates it to the
 * point where the albedo stops mattering. Heavy wool is close to opaque; only
 * the thin under-layer gets a real value.
 *
 * Weave depth is zero on skin and near zero on leather. Running the fabric
 * weave over both was most of why the face read as a cloth panel: the same
 * thread ridges that sell wool turn a cheek into upholstery.
 *
 * Anisotropy is the other one. It stretches the GGX lobe along the weave's warp
 * direction, which is correct and which at 0.55 drew a hard bright stripe down
 * every thread row on a lit sleeve — a metre of arm came back as corduroy. The
 * weave is 210 threads to the metre, so in a close shot each of those stripes
 * is several pixels wide and there is nothing to break them up.
 */
const PARAMS = [
    [0.26, 0.36, 0.05, 0.85],
    // The mantle is the one garment held a stop above the robe, so it is also
    // the one where a white sheen veil does the most damage: at 0.34 it lifted
    // an already-light russet into a pale dusty pink and took the shoulders
    // with it. Sheen is fibre scatter and it belongs at the edge, not over the
    // whole panel.
    //
    // It is now held nearly two stops above the robe, which makes every gloss
    // term on it twice as visible as it was — a broad soft highlight across a
    // pale panel is the read that says vinyl. Rougher, and the anisotropy down
    // with it: heavy wool, seen from across a glade.
    [0.14, 0.18, 0.06, 0.86],
    // The under-tunic is the deepest weave on the model and it shows as a narrow
    // band in the mantle's shadow, where the display curve is steepest — so a
    // thread pattern that is invisible on a lit sleeve came out as visible net
    // across the one part of the costume that is nearly black. Depth has to be
    // read against what the fabric is lit by, not against how thin it is.
    [0.30, 0.22, 0.20, 0.62],
    [0.05, 0.18, 0.01, 0.22],
    [0.04, 0.00, 0.10, 0.00],
    [0.28, 0.40, 0.14, 0.90],
    [1.00, 0.00, 0.90, 0.00],
    [0.20, 0.00, 0.00, 0.50],
];

// ------------------------------------------------------- module-scope scratch
const _droop = new Vector3();
const _screen = new Vector2();
// Wolf-grey, not white. An albedo of 0.74 is snow, and with a wrapped diffuse,
// a back-scatter lobe and the sky fill all stacked on it the trim came out of
// AgX pinned at the top of the curve — a blown white band that drew the eye off
// the face and away from the one warm accent the model has.
//
// It has to be read against the rest of the costume, not on its own. Measured
// on a frame, the trim was the single brightest thing on the figure — above the
// mantle and well above the robe — which put the eye on the cuffs and, worse,
// ringed the face in the one thing brighter than it. A pelt is not the subject;
// the face is. This is a slate grey that sits under the mantle it borders.
//
// It borders the cowl now rather than the mantle. The instinct is to bring it
// up, since the cowl is dark and a light edge around the opening would frame
// the void — but the band's strands point inward as much as outward, so at any
// real brightness what it frames the void with is a pale dome sitting inside
// the hood where the head is. Dimmer than the cowl's own rim, and it does its
// only remaining job: keeping the silhouette's edge off a hard geometric line.
const _furCol = new Color3(0.062, 0.064, 0.082);

export class Character {
    /**
     * @param {import("@babylonjs/core/scene").Scene} scene
     * @param {import("../terrain/terrain.js").Terrain} terrain
     * @param {import("../render/sky.js").Sky} sky
     * @param {import("../render/shadows.js").ShadowSystem} shadows
     * @param {import("./controller.js").CharacterController} controller
     * @param {import("../render/localShadow.js").LocalShadow} [localShadow]
     */
    constructor(scene, terrain, sky, shadows, controller, localShadow) {
        this.scene = scene;
        this.terrain = terrain;
        this.sky = sky;
        this.shadows = shadows;
        this.controller = controller;
        this.localShadow = localShadow || null;

        this.figure = new Figure(terrain);
        this.panels = makePanels();
        this.solver = new ClothSolver(this.panels, terrain);

        // ---- transform texture -------------------------------------------
        this._texData = new Float32Array(TEX_W * TEX_H * 4);
        let row = CLOTH_ROW0;
        /** Flat (rowBase, cols, rows, 0) per panel, for the vertex shaders. */
        this._panelParams = new Float32Array(6 * 4);
        for (let i = 0; i < this.panels.length; i++) {
            const p = this.panels[i];
            if (p.cols > TEX_W) throw new Error("panel wider than the transform texture");
            p.nodeRow = row;
            this._panelParams[i * 4] = row;
            this._panelParams[i * 4 + 1] = p.cols;
            this._panelParams[i * 4 + 2] = p.rows;
            row += p.rows;
        }
        if (row > TEX_H) throw new Error("transform texture too short for the panels");

        this.charTex = RawTexture.CreateRGBATexture(
            this._texData, TEX_W, TEX_H, scene,
            false, false,
            Constants.TEXTURE_NEAREST_SAMPLINGMODE,
            Constants.TEXTURETYPE_FLOAT
        );
        this.charTex.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
        this.charTex.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;

        // ---- palette ------------------------------------------------------
        this._matAlbedo = new Float32Array(32);
        this._matParams = new Float32Array(32);
        for (let i = 0; i < 8; i++) {
            for (let k = 0; k < 4; k++) {
                this._matAlbedo[i * 4 + k] = PALETTE[i][k];
                this._matParams[i * 4 + k] = PARAMS[i][k];
            }
        }

        // ---- meshes and materials -----------------------------------------
        this.bodyMesh = buildBody(scene);
        this.clothMesh = buildClothMesh(scene, this.panels);
        this.furMesh = buildFur(scene);

        this.bodyMat = this._makeSurfaceMaterial("charBody", "char", "char", false);
        this.clothMat = this._makeSurfaceMaterial("charCloth", "cloth", "char", true);
        this.furMat = this._makeFurMaterial();

        this.bodyMesh.material = this.bodyMat;
        this.clothMesh.material = this.clothMat;
        this.furMesh.material = this.furMat;

        for (const m of [this.bodyMesh, this.clothMesh, this.furMesh]) {
            m.renderingGroupId = 1;
        }

        /** @type {ShaderMaterial[]} */
        this._depthMats = [];
        shadows.registerCaster(
            this.bodyMesh, (c) => this._makeDepthMaterial("charDepth", c, false), CHAR_CASCADES
        );
        shadows.registerCaster(
            this.clothMesh, (c) => this._makeDepthMaterial("clothDepth", c, true), CHAR_CASCADES
        );
        if (this.localShadow) {
            this.localShadow.registerCaster(
                this.bodyMesh, (f) => this._makeDepthMaterial("charDepth", "l" + f, false)
            );
            this.localShadow.registerCaster(
                this.clothMesh, (f) => this._makeDepthMaterial("clothDepth", "l" + f, true)
            );
        }
        this._capA = new Float32Array(BODY_CAPSULES.length * 4);
        this._capB = new Float32Array(BODY_CAPSULES.length * 4);
        // Fur is not registered as a caster. Its shadow lands inside the hood's
        // own, an alpha-tested 22-shell depth pass is not cheap, and what it
        // would contribute is a slightly fuzzier edge on a shadow already an
        // order of magnitude softer than that.

        this.triangles =
            this.bodyMesh.metadata.triangles +
            this.clothMesh.metadata.triangles +
            this.furMesh.metadata.triangles;

        this._cameraPos = new Vector3();
        this._splits = new Vector4(0, 0, 0, 0);
        this._needSettle = true;
        /** Seconds since load, for the garment motes' pulse. */
        this._time = 0;

        this._visible = true;
        this.setVisible(S.showCharacter !== false);
    }

    /**
     * One surface material. The body and the garments differ only in their
     * vertex program — the fabric shading, the shadow lookup and the aerial
     * perspective are literally the same code.
     */
    _makeSurfaceMaterial(name, vertex, fragment, isCloth) {
        const uniforms = [
            "viewProjection", "cameraPos",
            "sunDir", "sunRadiance", "shR",
            "cascadeMatrices", "cascadeSplits", "cascadeParams",
            "shadowTexel", "shadowSoftness", "shadowBias",
            "matAlbedo", "matParams",
            "fogDensity", "fogHeightFalloff", "fogStart", "aerialStrength",
            "ambientIntensity", "sssStrength", "weaveDensity",
            "screenSize", "time", "charAmbientScale",
            "capsuleA", "capsuleB", "capsuleCount",
            ...SPELL_LIGHT_UNIFORMS,
            ...LOCAL_SHADOW_UNIFORMS,
        ];
        const attributes = isCloth
            ? ["position", "uv", "aux"]
            : ["position", "normal", "uv", "aux", "boneIdx", "boneWt"];
        if (isCloth) uniforms.push("panelParams");

        const mat = new ShaderMaterial(
            name, this.scene, { vertex, fragment },
            {
                attributes,
                uniforms,
                samplers: [
                    "charTex", "skyLUT", "cascade0", "cascade1", "cascade2",
                    ...LOCAL_SHADOW_SAMPLERS,
                ],
                shaderLanguage: ShaderLanguage.WGSL,
            }
        );
        // Every garment is an open sheet and the cowl is a shell, so both faces
        // are visible. The fragment shader turns the normal toward the viewer
        // rather than trusting winding — see the note there.
        mat.backFaceCulling = false;
        mat.setTexture("charTex", this.charTex);
        mat.setTexture("skyLUT", this.sky.lut);
        for (let i = 0; i < CASCADE_COUNT; i++) {
            mat.setTexture("cascade" + i, this.shadows.maps[i]);
        }
        if (this.localShadow) {
            for (let i = 0; i < 6; i++) {
                mat.setTexture("local" + i, this.localShadow.maps[i]);
            }
        }
        return mat;
    }

    _makeFurMaterial() {
        const mat = new ShaderMaterial(
            "charFur", this.scene, { vertex: "fur", fragment: "fur" },
            {
                attributes: ["position", "normal", "uv", "aux", "boneIdx", "boneWt"],
                uniforms: [
                    "viewProjection", "cameraPos", "furDroop",
                    "sunDir", "sunRadiance", "shR",
                    "cascadeMatrices", "cascadeSplits", "cascadeParams",
                    "shadowTexel", "shadowSoftness", "shadowBias",
                    "fogDensity", "fogHeightFalloff", "fogStart", "aerialStrength",
                    "ambientIntensity", "furDensity", "furColor",
                ],
                samplers: ["charTex", "skyLUT", "cascade0", "cascade1", "cascade2"],
                shaderLanguage: ShaderLanguage.WGSL,
            }
        );
        mat.backFaceCulling = false;
        mat.setTexture("charTex", this.charTex);
        mat.setTexture("skyLUT", this.sky.lut);
        for (let i = 0; i < CASCADE_COUNT; i++) {
            mat.setTexture("cascade" + i, this.shadows.maps[i]);
        }
        return mat;
    }

    _makeDepthMaterial(vertex, cascade, isCloth) {
        const uniforms = ["lightViewProjection"];
        if (isCloth) uniforms.push("panelParams");
        const mat = new ShaderMaterial(
            vertex + cascade, this.scene,
            { vertex, fragment: "terrainDepth" },
            {
                attributes: isCloth ? ["position"] : ["position", "boneIdx", "boneWt"],
                uniforms,
                samplers: ["charTex"],
                shaderLanguage: ShaderLanguage.WGSL,
                // Forces a distinct Effect per cascade, so each can hold its own
                // matrix without any mid-frame uniform juggling.
                defines: ["CHAR_CASCADE " + cascade],
            }
        );
        mat.backFaceCulling = false;
        mat.setTexture("charTex", this.charTex);
        if (isCloth) mat.setArray4("panelParams", this._panelParams);
        this._depthMats.push(mat);
        return mat;
    }

    /**
     * Depth-prepass materials for the body and the garments.
     *
     * The fur is left out on the same grounds it is left out of the shadow
     * cascades: it is an alpha-tested twenty-two-shell pass, and what it would
     * contribute is a fractionally fuzzier occlusion edge on a hood rim that is
     * already inside its own baked cavity.
     *
     * @param {import("../render/depthPass.js").DepthPass} depth
     */
    registerPrepass(depth) {
        this._prepassMats = [];
        for (const spec of [
            { mesh: this.bodyMesh, vertex: "charPrepass", cloth: false },
            { mesh: this.clothMesh, vertex: "clothPrepass", cloth: true },
        ]) {
            const uniforms = ["viewProjection"];
            if (spec.cloth) uniforms.push("panelParams");
            const mat = new ShaderMaterial(
                spec.vertex, this.scene,
                { vertex: spec.vertex, fragment: "prepass" },
                {
                    attributes: spec.cloth
                        ? ["position"]
                        : ["position", "boneIdx", "boneWt"],
                    uniforms,
                    samplers: ["charTex"],
                    shaderLanguage: ShaderLanguage.WGSL,
                }
            );
            mat.backFaceCulling = false;
            mat.setTexture("charTex", this.charTex);
            if (spec.cloth) mat.setArray4("panelParams", this._panelParams);
            this._prepassMats.push(mat);
            depth.registerCaster(spec.mesh, mat);
        }
    }

    setVisible(v) {
        this._visible = !!v;
        this.bodyMesh.isVisible = this._visible;
        this.clothMesh.isVisible = this._visible;
        this.furMesh.isVisible = this._visible;
    }

    /**
     * Advance the figure and the garments, then push one texture upload and one
     * set of uniforms.
     *
     * Order matters: the skeleton has to be posed before the cloth can find its
     * kinematic targets, and both have to be written before the texture goes up,
     * or the garments render one frame behind the body they hang from.
     *
     * @param {number} dt
     */
    update(dt) {
        const ch = this.controller;
        this._time += dt;
        this.figure.update(dt, ch);
        if (this._needSettle) {
            this._settleCloth();
            this._needSettle = false;
        }
        this.solver.update(dt, this.figure, ch);
        this._uploadTransforms();
    }

    /**
     * Push this frame's uniforms. Split from `update` because the garments have
     * to be solved before the contact system reads the feet, while the uniforms
     * cannot be written until the camera has moved and the cascades have been
     * refitted. Doing both at one point in the frame means one of them is a
     * frame stale, and the visible symptom — a shadow that lags the figure by a
     * frame during a fast carve — is exactly the sort of thing that reads as
     * "cheap" without being identifiable.
     *
     * @param {Vector3} cameraPos
     */
    sync(cameraPos) {
        this._cameraPos.copyFrom(cameraPos);
        this._pushUniforms();
    }

    /**
     * Drop every garment straight onto its kinematic target.
     *
     * Done once, on the first update. The panels are authored in bind space at
     * the world origin, and letting them fall from there to wherever the player
     * actually spawned takes a second of visible flapping — behind the loading
     * screen if we are lucky, in shot if we are not.
     */
    _settleCloth() {
        const skin = this.figure.skin;
        for (let pi = 0; pi < this.panels.length; pi++) {
            const p = this.panels[pi];
            for (let k = 0; k < p.count; k++) {
                const b = p.bone[k] * 16;
                const o = k * 3;
                const x = p.bindPos[o], y = p.bindPos[o + 1], z = p.bindPos[o + 2];
                p.pos[o] = skin[b] * x + skin[b + 4] * y + skin[b + 8] * z + skin[b + 12];
                p.pos[o + 1] = skin[b + 1] * x + skin[b + 5] * y + skin[b + 9] * z + skin[b + 13];
                p.pos[o + 2] = skin[b + 2] * x + skin[b + 6] * y + skin[b + 10] * z + skin[b + 14];
            }
            p.prev.set(p.pos);
        }
    }

    _uploadTransforms() {
        const d = this._texData;
        const skin = this.figure.skin;

        // Rows 0-3: bone matrices, one column per bone, one row per matrix
        // column. Written as four separate row writes rather than one blit,
        // because the texture is column-major in bones and row-major in memory.
        for (let b = 0; b < BONE_COUNT; b++) {
            const s = b * 16;
            for (let c = 0; c < 4; c++) {
                const o = (c * TEX_W + b) * 4;
                d[o] = skin[s + c * 4];
                d[o + 1] = skin[s + c * 4 + 1];
                d[o + 2] = skin[s + c * 4 + 2];
                d[o + 3] = skin[s + c * 4 + 3];
            }
        }

        for (let pi = 0; pi < this.panels.length; pi++) {
            const p = this.panels[pi];
            const pos = p.pos;
            for (let j = 0; j < p.rows; j++) {
                const rowO = ((p.nodeRow + j) * TEX_W) * 4;
                for (let i = 0; i < p.cols; i++) {
                    const s = (j * p.cols + i) * 3;
                    const o = rowO + i * 4;
                    d[o] = pos[s];
                    d[o + 1] = pos[s + 1];
                    d[o + 2] = pos[s + 2];
                    d[o + 3] = 1;
                }
            }
        }

        this.charTex.update(d);
    }

    _pushUniforms() {
        const sky = this.sky;
        const sh = this.shadows;
        const ch = this.controller;

        // Fur droop: gravity, plus the apparent wind, plus the character's own
        // acceleration thrown the other way. Scaled to metres of tip travel.
        const a = (S.windDirection * Math.PI) / 180;
        const ws = 0.6 * S.windStrength;
        _droop.set(
            Math.sin(a) * ws * 0.006 - ch.velocity.x * 0.0016 - ch.acceleration.x * 0.00018,
            -0.018,
            Math.cos(a) * ws * 0.006 - ch.velocity.z * 0.0016 - ch.acceleration.z * 0.00018
        );

        this._splits.set(sh.splits[0], sh.splits[1], sh.splits[2], sh.splits[3]);

        const mats = [this.bodyMat, this.clothMat, this.furMat];
        for (let i = 0; i < mats.length; i++) {
            const m = mats[i];
            m.setVector3("cameraPos", this._cameraPos);
            m.setVector3("sunDir", sky.sunDir);
            m.setColor3("sunRadiance", sky.sunRadiance);
            m.setArray4("shR", sky.shForShaders());

            bindMatrixArray(m, "cascadeMatrices", sh.matrixData);
            m.setVector4("cascadeSplits", this._splits);
            m.setArray4("cascadeParams", sh.paramData);
            m.setFloat("shadowTexel", sh.texelSize);
            m.setFloat("shadowSoftness", 1.4);
            // Tighter than the terrain's: the figure is small, its cascade is
            // the near one, and a large bias here detaches the contact shadow
            // between the boots and the snow — which is the shadow that tells
            // you the character is standing on the ground rather than in it.
            m.setFloat("shadowBias", 0.012);

            m.setFloat("fogDensity", S.fogDensity);
            m.setFloat("fogHeightFalloff", S.fogHeightFalloff);
            m.setFloat("fogStart", S.fogStart);
            m.setFloat("aerialStrength", S.aerialStrength);
            m.setFloat("ambientIntensity", S.ambientIntensity);
        }

        if (this.localShadow) {
            const on = S.localShadow !== false;
            this.localShadow.bindReceiver(this.bodyMat, on);
            this.localShadow.bindReceiver(this.clothMat, on);
        }

        const j = this.figure.joint;
        for (let i = 0; i < BODY_CAPSULES.length; i++) {
            const cap = BODY_CAPSULES[i];
            const ao = cap[0] * 3, bo = cap[1] * 3, o = i * 4;
            this._capA[o] = j[ao];
            this._capA[o + 1] = j[ao + 1];
            this._capA[o + 2] = j[ao + 2];
            this._capA[o + 3] = cap[2];
            this._capB[o] = j[bo];
            this._capB[o + 1] = j[bo + 1];
            this._capB[o + 2] = j[bo + 2];
            this._capB[o + 3] = 0;
        }

        const eng = this.scene.getEngine();
        _screen.set(eng.getRenderWidth(), eng.getRenderHeight());

        for (const m of [this.bodyMat, this.clothMat]) {
            m.setArray4("matAlbedo", this._matAlbedo);
            m.setArray4("matParams", this._matParams);
            m.setFloat("sssStrength", S.sssStrength);
            m.setVector2("screenSize", _screen);
            m.setFloat("time", this._time);
            // Threads per metre. 210 is a 4.8 mm thread, which is not wool, it
            // is hessian — and in a close-up it read as one: a regular open grid
            // over the cape and sleeves that looked like screen door rather than
            // cloth. Coarse homespun is nearer 2 mm, which is fine enough that
            // the pixel-footprint fade takes the weave out over the first metre
            // and a half and leaves the slub to carry the cloth beyond that.
            m.setFloat("weaveDensity", 520);
            m.setFloat("charAmbientScale", S.charAmbientScale);
            m.setArray4("capsuleA", this._capA);
            m.setArray4("capsuleB", this._capB);
            m.setFloat("capsuleCount", BODY_CAPSULES.length);
        }
        this.clothMat.setArray4("panelParams", this._panelParams);

        this.furMat.setVector3("furDroop", _droop);
        // Strand cells per metre. Shorter pile needs a finer pitch to stay
        // dense: at 250 (4 mm) the shorter strands left visible gaps between
        // them, and gaps in fur read as noise.
        this.furMat.setFloat("furDensity", 360);
        this.furMat.setColor3("furColor", _furCol);
    }

    /** Compile every pipeline behind the loading screen. */
    async warmUp() {
        await whenReady(this.bodyMat, "character body material", [this.bodyMesh, false]);
        await whenReady(this.clothMat, "character cloth material", [this.clothMesh, false]);
        await whenReady(this.furMat, "character fur material", [this.furMesh, false]);
        for (let i = 0; i < this._depthMats.length; i++) {
            const m = this._depthMats[i];
            const mesh = m.name.indexOf("cloth") === 0 ? this.clothMesh : this.bodyMesh;
            await whenReady(m, m.name, [mesh, false]);
        }
        if (this._prepassMats) {
            for (let i = 0; i < this._prepassMats.length; i++) {
                const m = this._prepassMats[i];
                const mesh = m.name.indexOf("cloth") === 0 ? this.clothMesh : this.bodyMesh;
                await whenReady(m, m.name, [mesh, false]);
            }
        }
        if (this.localShadow) await this.localShadow.warmUp();
    }

    /**
     * Live palette write from equipped gear.
     * @param {{ applyToFigure(fig:{_matAlbedo:Float32Array}): void }} loadout
     */
    applyLoadout(loadout) {
        loadout.applyToFigure(this);
    }

    dispose() {
        this.bodyMesh.dispose();
        this.clothMesh.dispose();
        this.furMesh.dispose();
        this.bodyMat.dispose();
        this.clothMat.dispose();
        this.furMat.dispose();
        this.charTex.dispose();
    }
}
