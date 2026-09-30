import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Euler,
  Vector2,
  Vector3,
  ShapeUtils,
} from "three";
import type { CraftObject, Vec2, Vec3 } from "./types";
export const v3 = (v: Vec3) => new Vector3(...v);
export function normal(vertices: Vec3[], face: number[]): Vector3 {
  const n = new Vector3();
  for (let i = 0; i < face.length; i++) {
    const a = vertices[face[i]],
      b = vertices[face[(i + 1) % face.length]];
    n.x += (a[1] - b[1]) * (a[2] + b[2]);
    n.y += (a[2] - b[2]) * (a[0] + b[0]);
    n.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n.normalize();
}
export function faceCenter(vertices: Vec3[], face: number[]) {
  return face
    .reduce((p, i) => p.add(v3(vertices[i])), new Vector3())
    .divideScalar(face.length);
}
export function projectFace(
  vertices: Vec3[],
  face: number[],
  a = face[0],
  b = face[1],
): Vec2[] {
  const origin = v3(vertices[a]),
    u = v3(vertices[b]).sub(origin).normalize(),
    n = normal(vertices, face),
    w = n.clone().cross(u);
  return face.map((i) => {
    const d = v3(vertices[i]).sub(origin);
    return [d.dot(u), d.dot(w)];
  });
}
export function triangles(vertices: Vec3[], face: number[]): number[][] {
  if (face.length === 3) return [face];
  return ShapeUtils.triangulateShape(
    projectFace(vertices, face).map((p) => new Vector2(...p)),
    [],
  ).map((t) => t.map((i) => face[i]));
}
export function geometry(o: CraftObject) {
  const positions: number[] = [],
    faceMap: number[] = [];
  o.faces.forEach((face, fi) =>
    triangles(o.vertices, face).forEach((tri) => {
      for (const i of tri) positions.push(...o.vertices[i]);
      faceMap.push(fi);
    }),
  );
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  g.userData.faceMap = faceMap;
  return g;
}
export function transformMatrix(o: CraftObject) {
  return new Matrix4().compose(
    v3(o.position),
    new Quaternion().setFromEuler(
      new Euler(...(o.rotation.map((v) => (v * Math.PI) / 180) as Vec3)),
    ),
    v3(o.scale),
  );
}
export function worldVertices(o: CraftObject): Vec3[] {
  const m = transformMatrix(o);
  return o.vertices.map((p) => v3(p).applyMatrix4(m).toArray() as Vec3);
}
export function dimensions(o: CraftObject): Vec3 {
  return [0, 1, 2].map((axis) => {
    const vs = o.vertices.map((v) => v[axis]);
    return (Math.max(...vs) - Math.min(...vs)) * o.scale[axis];
  }) as Vec3;
}
