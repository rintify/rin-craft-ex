import type { CraftObject, Vec3 } from "./types";
import { v3, normal, faceCenter, triangles, projectFace } from "./geometry";
export function extrudeFace(o: CraftObject, fi: number, distance: number) {
  const face = o.faces[fi],
    n = normal(o.vertices, face).multiplyScalar(distance);
  const ids = face.map((i) => {
    o.vertices.push(v3(o.vertices[i]).add(n).toArray() as Vec3);
    return o.vertices.length - 1;
  });
  o.faces[fi] = ids;
  for (let i = 0; i < face.length; i++) {
    const j = (i + 1) % face.length;
    o.faces.push([face[i], face[j], ids[j], ids[i]]);
  }
}
export function insetFace(o: CraftObject, fi: number, amount: number) {
  const face = o.faces[fi],
    center = faceCenter(o.vertices, face);
  const ids = face.map((i) => {
    o.vertices.push(v3(o.vertices[i]).lerp(center, amount).toArray() as Vec3);
    return o.vertices.length - 1;
  });
  o.faces[fi] = ids;
  face.forEach((a, i) => {
    const j = (i + 1) % face.length;
    o.faces.push([a, face[j], ids[j], ids[i]]);
  });
}
/** Polygon collision tests assume convex, planar faces; preserve that invariant after edits. */
export function triangulateNonPlanar(o: CraftObject) {
  o.faces = o.faces.flatMap((face) => {
    const n = normal(o.vertices, face),
      origin = v3(o.vertices[face[0]]);
    const warped = face.some(
      (i) => Math.abs(v3(o.vertices[i]).sub(origin).dot(n)) > 1e-5,
    );
    const points = projectFace(o.vertices, face);
    let positive = false,
      negative = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[(i + 2) % points.length];
      const cross =
        (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      positive ||= cross > 1e-6;
      negative ||= cross < -1e-6;
    }
    const faces =
      warped || (positive && negative) ? triangles(o.vertices, face) : [face];
    return faces;
  });
}
