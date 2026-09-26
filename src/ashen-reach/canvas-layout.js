/** CSS viewport dimensions without layout reads between HUD DOM writes. */
export function observeCanvasLayout(canvas, Observer = ResizeObserver) {
  const rect = canvas.getBoundingClientRect?.();
  const size = {width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight),
    left: rect?.left ?? 0, top: rect?.top ?? 0};
  const observer = new Observer(entries => {
    for (const {target, contentRect} of entries) {
      if (target !== canvas || contentRect.width <= 0 || contentRect.height <= 0) continue;
      size.width = contentRect.width;
      size.height = contentRect.height;
      const nextRect = canvas.getBoundingClientRect?.();
      size.left = nextRect?.left ?? 0;
      size.top = nextRect?.top ?? 0;
    }
  });
  observer.observe(canvas);
  return {size, dispose: () => observer.disconnect()};
}
