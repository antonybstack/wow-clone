import { createArcRotateCamera, createDirectionalLight, createPointLight } from "@babylonjs/lite";

/** Artist-tuned Lite intensities keyed by Blender light object name. */
export const LIGHT_INTENSITY = {
    WellGlow: 2.4,
    CrystalKey: 1.4,
    LanternA_L: 0.35,
    LanternB_L: 0.35,
    LanternC_L: 0.28,
    LanternD_L: 0.28,
    LanternE_L: 0.25,
    LanternF_L: 0.22,
    Fill: 0.85,
    Rim: 1.05,
    MoonSun: 2.55,
};

const POINT_ENERGY_SCALE = 0.08;

export async function fetchRuntime(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.json();
}

export function createLightsFromRuntime(runtime) {
    const created = [];
    for (const light of runtime.lights ?? []) {
        const color = light.color || [1, 1, 1];
        if (light.type === "SUN") {
            const dir = light.directionGltf || [-0.35, -0.75, 0.2];
            const sun = createDirectionalLight(dir, LIGHT_INTENSITY[light.name] ?? 1.15);
            sun.diffuse = color;
            sun.specular = color;
            created.push(sun);
            continue;
        }
        if (light.type === "POINT" || light.type === "SPOT" || light.type === "AREA") {
            const intensity = LIGHT_INTENSITY[light.name]
                ?? Math.min(8, (light.energy || 10) * POINT_ENERGY_SCALE);
            const point = createPointLight(light.locationGltf, intensity);
            point.diffuse = color;
            point.specular = color;
            point.range = light.type === "AREA" ? 12 : 8;
            created.push(point);
        }
    }
    return created;
}

export function createCameraFromRuntime(runtime) {
    const cam = runtime.camera;
    if (!cam?.locationGltf || !cam?.targetGltf) {
        return createArcRotateCamera(0.82, 1.22, 10.2, { x: 0, y: 0.55, z: 0 });
    }
    const [ex, ey, ez] = cam.locationGltf;
    const [tx, ty, tz] = cam.targetGltf;
    const dx = ex - tx;
    const dy = ey - ty;
    const dz = ez - tz;
    const radius = Math.hypot(dx, dy, dz) || 10;
    const beta = Math.acos(Math.min(1, Math.max(-1, dy / radius)));
    const alpha = Math.atan2(dz, dx);
    return createArcRotateCamera(alpha, beta, radius, { x: tx, y: ty, z: tz });
}
