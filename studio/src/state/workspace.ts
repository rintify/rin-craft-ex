import type { Project, Vec3 } from "../core/types";
import { worldVertices } from "../core/geometry";
export type Anchor = { objectId: string; vertex: number } | { position: Vec3 };
export interface Basis {
  origin: Vec3;
  x: Vec3;
  y: Vec3;
  z: Vec3;
}
export const initialBasis = (): Basis => ({
  origin: [0, 0, 0],
  x: [0, 0, 1],
  y: [1, 0, 0],
  z: [0, 1, 0],
});
export function anchorPosition(anchor: Anchor, project: Project): Vec3 | null {
  if ("position" in anchor) return anchor.position;
  const object = project.objects.find((o) => o.id === anchor.objectId);
  return object ? (worldVertices(object)[anchor.vertex] ?? null) : null;
}
export function anchorCenter(
  anchors: Anchor[],
  project: Project,
  fallback: Vec3,
): Vec3 {
  const points = anchors
    .map((a) => anchorPosition(a, project))
    .filter((p): p is Vec3 => !!p);
  return points.length
    ? ([0, 1, 2].map(
        (i) => points.reduce((n, p) => n + p[i], 0) / points.length,
      ) as Vec3)
    : fallback;
}
