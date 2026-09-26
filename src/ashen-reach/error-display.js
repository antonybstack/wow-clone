/** Preserve the original error and cause chain while decoding Lite codes on demand. */
export async function formatGameError(error, loadDecoder = () => import('./lite-error-decoder.js')) {
  const chain = [];
  const seen = new Set();
  for (let current = error; current !== undefined && current !== null && !seen.has(current); current = current?.cause) {
    chain.push(current);
    seen.add(current);
    if (!(current instanceof Error)) break;
  }

  let decodeError;
  if (chain.some(item => item instanceof Error && /^#\d+$/.test(item.message) && Array.isArray(item.lite))) {
    // Lite 1.31.1 keeps verbose strings out of the initial bundle; decodeError
    // reconstructs one caught error without enabling global eager decoding.
    // https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/49-error-handling.md
    try { ({decodeError} = await loadDecoder()); } catch { /* Retain raw code, stack and cause. */ }
  }

  return chain.map((item, index) => {
    const raw = item instanceof Error ? item.stack || `${item.name}: ${item.message}` : String(item);
    let decoded;
    try { decoded = decodeError?.(item); } catch { /* Keep the original error. */ }
    const detail = typeof decoded === 'string' && decoded !== item?.message && decoded !== String(item)
      ? `\nLite: ${decoded}` : '';
    return `${index ? 'Caused by: ' : ''}${raw}${detail}`;
  }).join('\n');
}
