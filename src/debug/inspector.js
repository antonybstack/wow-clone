/**
 * Babylon Inspector as a diagnostic, not as a renderer.
 *
 * Lazy-loaded and stripped from production builds. F8 toggles it. The scene
 * explorer, texture viewer, and GPU stats are what we want (cube-shadow
 * maps, post RTTs, draw counts). Do not create a DefaultRenderingPipeline,
 * DirectionalLight, or PBR material from its menus — those fork the custom
 * WGSL path.
 */

/**
 * @param {import("@babylonjs/core/scene").Scene} scene
 */
export function attachInspector(scene) {
    if (!import.meta.env.DEV) return;

    let shown = false;
    /** @type {typeof import("@babylonjs/inspector").Inspector | null} */
    let Inspector = null;

    window.addEventListener("keydown", async (e) => {
        if (e.code !== "F8") return;
        e.preventDefault();
        try {
            if (!Inspector) {
                const mod = await import("@babylonjs/inspector");
                Inspector = mod.Inspector;
            }
            if (shown) {
                Inspector.Hide();
                shown = false;
            } else {
                Inspector.Show(scene, {
                    embedMode: false,
                    enablePopup: true,
                    enableClose: true,
                    handleResize: true,
                });
                shown = true;
            }
        } catch (err) {
            console.error("[inspector]", err);
        }
    });
}
