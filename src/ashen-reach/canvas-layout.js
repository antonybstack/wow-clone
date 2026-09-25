/** CSS viewport dimensions without layout reads between HUD DOM writes. */
export function observeCanvasLayout(canvas, Observer = ResizeObserver) {
  const size = {width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight)};
  const observer = new Observer(entries => {
    for (const {target, contentRect} of entries) {
      if (target !== canvas || contentRect.width <= 0 || contentRect.height <= 0) continue;
      size.width = contentRect.width;
      size.height = contentRect.height;
    }
  });
  observer.observe(canvas);
  return {size, dispose: () => observer.disconnect()};
}
