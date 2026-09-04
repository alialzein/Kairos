export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  return (sorted[lo] ?? 0) * (1 - w) + (sorted[hi] ?? 0) * w;
}

/** Rolling window of frame times in milliseconds. */
export class FrameStats {
  private readonly buf: number[] = [];
  constructor(private readonly size = 240) {}
  push(ms: number): void {
    this.buf.push(ms);
    if (this.buf.length > this.size) this.buf.shift();
  }
  get count(): number {
    return this.buf.length;
  }
  private sorted(): number[] {
    return [...this.buf].sort((a, b) => a - b);
  }
  get p50(): number {
    return percentile(this.sorted(), 0.5);
  }
  get p95(): number {
    return percentile(this.sorted(), 0.95);
  }
  reset(): void {
    this.buf.length = 0;
  }
}
