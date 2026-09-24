/** Probe operations, not browser names. WebKit 319980 rejected vertex-only
 * depth render bundles. An explicit empty fragment stage avoids that path.
 * https://github.com/WebKit/WebKit/commit/eefdc13c0e17cb0f37b0b272b482ed598f0b8c61
 */
const VERTEX = '@vertex fn main(@builtin(vertex_index) i:u32)->@builtin(position) vec4f { var p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3)); return vec4f(p[i],0.5,1.0); }';
const FRAGMENT = '@fragment fn main() {}';

export function withDepthFragment(descriptor, fragmentModule) {
  if (descriptor.fragment || !descriptor.depthStencil) return descriptor;
  return {...descriptor, fragment: {module: fragmentModule, entryPoint: 'main', targets: []}};
}

async function probeDepthBundle(device, fragmentModule) {
  device.pushErrorScope('validation');
  let thrown;
  try {
    let descriptor = {
      label: 'ashen-depth-bundle-probe', layout: 'auto',
      vertex: {module: device.createShaderModule({code: VERTEX}), entryPoint: 'main'},
      depthStencil: {format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less'},
    };
    if (fragmentModule) descriptor = withDepthFragment(descriptor, fragmentModule);
    const pipeline = device.createRenderPipeline(descriptor);
    const bundle = device.createRenderBundleEncoder({colorFormats: [], depthStencilFormat: 'depth32float'});
    bundle.setPipeline(pipeline);
    bundle.draw(3);
    bundle.finish();
  } catch (error) { thrown = error; }
  const validation = await device.popErrorScope();
  return validation?.message || thrown?.message || null;
}

export async function configureGpuCompatibility(device) {
  const state = {depthBundle: 'testing', probeError: null, fallbackError: null, errors: [], frames: 0};
  const remember = message => { if (state.errors.length < 20) state.errors.push(String(message)); };
  device.addEventListener('uncapturederror', e => remember(e.error.message));
  device.lost.then(info => remember(`Device lost (${info.reason}): ${info.message}`));
  state.probeError = await probeDepthBundle(device);
  if (!state.probeError) {
    state.depthBundle = 'native';
    return state;
  }
  const fragment = device.createShaderModule({label: 'ashen-empty-depth-fragment', code: FRAGMENT});
  state.fallbackError = await probeDepthBundle(device, fragment);
  if (state.fallbackError) {
    state.depthBundle = 'unsupported';
    remember(`Depth bundle probe: ${state.probeError}; fallback: ${state.fallbackError}`);
    return state;
  }
  // The caller selects Lite's public depthOnlyFragment material option.
  // Native PBR/standard no-color views already retain their fragment stage.
  state.depthBundle = 'empty-fragment';
  return state;
}

/** Opt-in, copyable device evidence; no remote telemetry or per-frame readbacks. */
export function showGpuDiagnostics(state) {
  const root = document.createElement('details');
  root.id = 'gpu-diagnostics'; root.open = true;
  root.style.cssText = 'position:fixed;top:190px;left:8px;right:8px;z-index:50;max-height:40vh;overflow:auto;background:#101820f2;color:#fff;padding:8px;font:11px monospace;user-select:text;touch-action:pan-y';
  const summary = document.createElement('summary'); summary.textContent = 'GPU diagnostics (tap to collapse)';
  const copy = document.createElement('button'); copy.textContent = 'Copy report';
  const output = document.createElement('pre'); output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
  const report = () => {
    const a = globalThis.ASHEN;
    return JSON.stringify({build: 'iphone-depth-probe-1', ua: navigator.userAgent, ...state,
      worldCasterFragment: a?.shadows?.state.depthOnlyFragment,
      canvas: a ? [a.engine.canvas.width, a.engine.canvas.height] : null,
      player: a?.player ? {x: a.player.body.position.x, z: a.player.body.position.z} : null}, null, 2);
  };
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(report()); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Select the report below to copy'; }
  });
  root.append(summary, copy, output); document.body.append(root);
  const timer = setInterval(() => { if (root.open) output.textContent = report(); }, 500);
  output.textContent = report();
  window.addEventListener('pagehide', () => clearInterval(timer), {once: true});
}
