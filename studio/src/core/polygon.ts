import type { Vec2 } from "./types";
export const cross2 = (a: Vec2, b: Vec2, c: Vec2) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const signedArea = (p: Vec2[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
export const center2 = (p: Vec2[]): Vec2 =>
  p.reduce((s, a) => [s[0] + a[0] / p.length, s[1] + a[1] / p.length] as Vec2, [
    0, 0,
  ] as Vec2);
export function bounds(polygons: Vec2[][]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polygons)
    for (const [x, y] of p) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
/** Separating-axis test for convex polygons. Touching edges are not overlap. */
export function overlaps(a: Vec2[], b: Vec2[], epsilon = 1e-6): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length];
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (length < epsilon) continue;
      const nx = -(q[1] - p[1]) / length,
        ny = (q[0] - p[0]) / length;
      const aa = a.map((v) => v[0] * nx + v[1] * ny),
        bb = b.map((v) => v[0] * nx + v[1] * ny);
      if (
        Math.min(Math.max(...aa), Math.max(...bb)) -
          Math.max(Math.min(...aa), Math.min(...bb)) <=
        epsilon
      )
        return false;
    }
  return true;
}
export function alignFace(
  points: Vec2[],
  ai: number,
  bi: number,
  a: Vec2,
  b: Vec2,
  parentCenter: Vec2,
): Vec2[] {
  const origin = points[ai],
    source = points[bi],
    angle =
      Math.atan2(b[1] - a[1], b[0] - a[0]) -
      Math.atan2(source[1] - origin[1], source[0] - origin[0]);
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  let mapped = points.map((p) => {
    const x = p[0] - origin[0],
      y = p[1] - origin[1];
    return [a[0] + x * cos - y * sin, a[1] + x * sin + y * cos] as Vec2;
  });
  if (cross2(a, b, center2(mapped)) * cross2(a, b, parentCenter) > 0) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      ll = dx * dx + dy * dy;
    mapped = mapped.map((p) => {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ll;
      return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
    });
  }
  return mapped;
}
