/**
 * Four pooled point lights for spell VFX. Modest range/intensity so the robe
 * does not wash purple — chroma lives on the emissive meshes.
 */
import { addToScene, createPointLight } from "@babylonjs/lite";

export const MAX_SPELL_LIGHTS = 4;

export function createLightPool(scene) {
    const lights = [];
    for (let i = 0; i < MAX_SPELL_LIGHTS; i++) {
        const light = createPointLight([0, -40, 0], 0);
        light.name = `SpellLight${i}`;
        light.diffuse = [0.38, 0.16, 0.62];
        light.specular = [0.18, 0.08, 0.28];
        light.range = 0.05;
        addToScene(scene, light);
        lights.push(light);
    }

    let count = 0;

    return {
        lights,
        get count() {
            return count;
        },
        begin() {
            count = 0;
        },
        /**
         * @param {number} x @param {number} y @param {number} z
         * @param {number} radius
         * @param {number} r @param {number} g @param {number} b
         * @param {number} intensity
         */
        add(x, y, z, radius, r, g, b, intensity) {
            if (count >= MAX_SPELL_LIGHTS || intensity <= 0 || radius <= 0) {
                return;
            }
            const light = lights[count++];
            light.position.x = x;
            light.position.y = y;
            light.position.z = z;
            light.range = radius;
            light.intensity = intensity;
            light.diffuse[0] = r;
            light.diffuse[1] = g;
            light.diffuse[2] = b;
            light.specular[0] = r * 0.45;
            light.specular[1] = g * 0.45;
            light.specular[2] = b * 0.45;
        },
        end() {
            for (let i = count; i < MAX_SPELL_LIGHTS; i++) {
                const light = lights[i];
                light.intensity = 0;
                light.range = 0.05;
                light.position.x = 0;
                light.position.y = -40;
                light.position.z = 0;
            }
        },
    };
}
