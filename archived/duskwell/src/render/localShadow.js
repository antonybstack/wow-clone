/**
 * Point-light cube shadow from the staff tip.
 *
 * Six small R32F depth maps, same idea as the sun cascades: custom casters
 * (skinned body + simulated cloth) because a stock depth pass would miss the
 * vertex displacement. Sampled so the orb's illumination occludes in the cowl
 * and folds instead of wrapping the whole costume.
 */

import { Vector3, Vector4, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { whenReady, bindMatrixArray } from "../core/gpuUtil.js";
import { S } from "../core/settings.js";

export const LOCAL_FACE_COUNT = 6;
const RESOLUTION = 256;
const NEAR = 0.07;
const FAR = 3.6;

/** Look direction and up per cubemap face. Degenerate-up avoided on ±Y. */
const FACES = [
    { d: [1, 0, 0], u: [0, 1, 0] },
    { d: [-1, 0, 0], u: [0, 1, 0] },
    { d: [0, 1, 0], u: [0, 0, -1] },
    { d: [0, -1, 0], u: [0, 0, 1] },
    { d: [0, 0, 1], u: [0, 1, 0] },
    { d: [0, 0, -1], u: [0, 1, 0] },
];

const _eye = new Vector3();
const _target = new Vector3();
const _up = new Vector3();
const _view = new Matrix();
const _proj = new Matrix();

export const LOCAL_SHADOW_UNIFORMS = [
    "localShadowPos", "localShadowBias", "localShadowEnabled", "localShadowMatrices",
];
export const LOCAL_SHADOW_SAMPLERS = [
    "local0", "local1", "local2", "local3", "local4", "local5",
];

export class LocalShadow {
    /**
     * @param {import("@babylonjs/core/scene").Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        this.engine = scene.getEngine();
        this.resolution = RESOLUTION;
        this.far = FAR;
        this.enabled = true;

        /** @type {RenderTargetTexture[]} */
        this.maps = [];
        /** @type {Matrix[]} */
        this.matrices = [];
        this.matrixData = new Float32Array(16 * LOCAL_FACE_COUNT);
        /** @type {import("@babylonjs/core/Materials/shaderMaterial").ShaderMaterial[][]} */
        this._perFace = [];
        /** @type {import("@babylonjs/core/Materials/shaderMaterial").ShaderMaterial[]} */
        this.materials = [];

        this.pos = new Vector3();
        this._pos4 = new Vector4();

        for (let i = 0; i < LOCAL_FACE_COUNT; i++) {
            const rtt = new RenderTargetTexture(
                "localShadow" + i,
                { width: RESOLUTION, height: RESOLUTION },
                scene,
                {
                    generateMipMaps: false,
                    generateDepthBuffer: true,
                    type: Constants.TEXTURETYPE_FLOAT,
                    format: Constants.TEXTUREFORMAT_RED,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                }
            );
            rtt.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
            rtt.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
            rtt.clearColor = new Color4(1, 1, 1, 1);
            rtt.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
            rtt.renderList = [];
            rtt.skipInitialClear = false;
            scene.customRenderTargets.push(rtt);
            this.maps.push(rtt);
            this.matrices.push(new Matrix());
            this._perFace.push([]);
        }

        Matrix.PerspectiveFovLHToRef(
            Math.PI / 2, 1, NEAR, FAR, _proj, true, true
        );
    }

    /**
     * @param {import("@babylonjs/core/Meshes/mesh").Mesh} mesh
     * @param {(face: number) => import("@babylonjs/core/Materials/shaderMaterial").ShaderMaterial} makeMaterial
     */
    registerCaster(mesh, makeMaterial) {
        for (let i = 0; i < LOCAL_FACE_COUNT; i++) {
            const mat = makeMaterial(i);
            this.maps[i].renderList.push(mesh);
            this.maps[i].setMaterialForRendering(mesh, mat);
            this.materials.push(mat);
            this._perFace[i].push(mat);
        }
    }

    /**
     * Refit the six frusta to the current tip position and push matrices into
     * the depth materials. Call after the held staff has been synced, before
     * `figure.sync` / `scene.render`.
     * @param {number} x @param {number} y @param {number} z
     */
    update(x, y, z) {
        this.enabled = S.localShadow !== false;
        const rate = this.enabled
            ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME
            : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        for (let i = 0; i < LOCAL_FACE_COUNT; i++) this.maps[i].refreshRate = rate;
        if (!this.enabled) return;

        this.pos.set(x, y, z);
        this._pos4.set(x, y, z, FAR);
        _eye.copyFrom(this.pos);

        for (let i = 0; i < LOCAL_FACE_COUNT; i++) {
            const f = FACES[i];
            _target.set(_eye.x + f.d[0], _eye.y + f.d[1], _eye.z + f.d[2]);
            _up.set(f.u[0], f.u[1], f.u[2]);
            Matrix.LookAtLHToRef(_eye, _target, _up, _view);
            _view.multiplyToRef(_proj, this.matrices[i]);
            this.matrices[i].copyToArray(this.matrixData, i * 16);
            const mats = this._perFace[i];
            for (let k = 0; k < mats.length; k++) {
                mats[k].setMatrix("lightViewProjection", this.matrices[i]);
            }
        }
    }

    /**
     * Bind receiver uniforms/samplers on a beauty material.
     * @param {import("@babylonjs/core/Materials/shaderMaterial").ShaderMaterial} m
     * @param {boolean} on
     */
    bindReceiver(m, on) {
        bindMatrixArray(m, "localShadowMatrices", this.matrixData);
        m.setFloat("localShadowEnabled", on && this.enabled ? 1 : 0);
        m.setFloat("localShadowBias", 0.0045);
        m.setVector4("localShadowPos", this._pos4);
        for (let i = 0; i < LOCAL_FACE_COUNT; i++) {
            m.setTexture("local" + i, this.maps[i]);
        }
    }

    async warmUp() {
        for (let i = 0; i < this.materials.length; i++) {
            const mat = this.materials[i];
            const list = this.maps[0].renderList;
            const mesh = mat.name.indexOf("cloth") === 0
                ? (list[1] || list[0])
                : list[0];
            if (mesh) await whenReady(mat, mat.name, [mesh, false]);
        }
    }

    dispose() {
        for (const m of this.maps) m.dispose();
        for (const m of this.materials) m.dispose();
    }
}
