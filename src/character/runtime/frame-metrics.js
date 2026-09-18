/** Frame intervals are evidence: never discard slow frames or clamp them to simulation dt. */
export class FrameMetrics {
  constructor(capacity = 30000) {
    this.samples = new Float64Array(capacity); this.rolling = new Float64Array(600);
    this.count = 0; this.total = 0; this.active = false; this.truncated = false;
    this.frameMs = 0; this.fps = 0; this.gpuMs = null; this.drawCalls = 0; this.context = {};
  }
  start(context = {}) { this.count = 0; this.active = true; this.truncated = false; this.context = { ...context }; }
  stop() { this.active = false; return this.summary(true); }
  record(deltaMs, drawCalls = 0, gpuMs = 0) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.frameMs = deltaMs; this.fps = 1000 / deltaMs; this.drawCalls = drawCalls; this.gpuMs = gpuMs > 0 ? gpuMs : null;
    this.rolling[this.total++ % this.rolling.length] = deltaMs;
    if (this.active) {
      if (this.count < this.samples.length) this.samples[this.count++] = deltaMs;
      else this.truncated = true;
    }
  }
  summary(recorded = this.active || this.count > 0) {
    const values = Array.from((recorded ? this.samples : this.rolling).subarray(0, recorded ? this.count : Math.min(this.total, this.rolling.length))).sort((a, b) => a - b);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const percentile = p => values.length ? values[Math.max(0, Math.ceil(p * values.length) - 1)] : null;
    return { ...this.context, samples: values.length, fps: mean ? 1000 / mean : null, meanMs: mean,
      medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), worstMs: percentile(1),
      above8_333: values.filter(x => x > 8.333).length, above16_667: values.filter(x => x > 16.667).length,
      above50: values.filter(x => x > 50).length, gpuMs: this.gpuMs, drawCalls: this.drawCalls, truncated: this.truncated };
  }
}
