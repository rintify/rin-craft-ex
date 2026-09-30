import type { Vec2 } from "./types";
export interface ClipBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** Convex polygon clipping. The source polygon stays unchanged. */
export function clipPolygon(points: Vec2[], box: ClipBox): Vec2[] {
  let output = points;
  for (const [axis, limit, sign] of [
    [0, box.x, 1],
    [0, box.x + box.width, -1],
    [1, box.y, 1],
    [1, box.y + box.height, -1],
  ]) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i],
        b = input[(i + 1) % input.length],
        insideA = (a[axis] - limit) * sign >= -1e-8,
        insideB = (b[axis] - limit) * sign >= -1e-8;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  return output;
}
export function clipLine(a: Vec2, b: Vec2, box: ClipBox): [Vec2, Vec2] | null {
  let low = 0,
    high = 1;
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  for (const [p, q] of [
    [-dx, a[0] - box.x],
    [dx, box.x + box.width - a[0]],
    [-dy, a[1] - box.y],
    [dy, box.y + box.height - a[1]],
  ]) {
    if (Math.abs(p) < 1e-10) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) low = Math.max(low, t);
    else high = Math.min(high, t);
    if (low > high) return null;
  }
  if ((high - low) * Math.hypot(dx, dy) < 1e-7) return null;
  return [
    [a[0] + low * dx, a[1] + low * dy],
    [a[0] + high * dx, a[1] + high * dy],
  ];
}
