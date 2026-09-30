import type { Vec3 } from "./types";
import { normal, v3 } from "./geometry";
import { edgeKey } from "./shared";
export interface MeshEdge {
  key: string;
  a: number;
  b: number;
  faces: number[];
}
export function meshEdges(faces: number[][]) {
  const edges = new Map<string, MeshEdge>();
  faces.forEach((face, fi) =>
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length],
        key = edgeKey(a, b);
      const edge = edges.get(key) ?? { key, a, b, faces: [] };
      edge.faces.push(fi);
      edges.set(key, edge);
    }),
  );
  return edges;
}
export function faceEdgeLengths(vertices: Vec3[], face: number[]) {
  return face.map((a, i) =>
    v3(vertices[a]).distanceTo(v3(vertices[face[(i + 1) % face.length]])),
  );
}
/** A triangle with two short sides cannot be used as a developable strip. */
export function forbiddenTriangles(
  vertices: Vec3[],
  faces: number[][],
  threshold: number,
) {
  return faces.flatMap((face, index) =>
    face.length === 3 &&
    faceEdgeLengths(vertices, face).filter((l) => l <= threshold + 1e-8)
      .length >= 2
      ? [index]
      : [],
  );
}
/** Smooth strips have one short triangle edge, or two opposite short quad edges. */
export function smoothEdges(
  vertices: Vec3[],
  faces: number[][],
  threshold: number,
  edges = meshEdges(faces),
) {
  const strips = faces.map((face) => {
    const lengths = faceEdgeLengths(vertices, face),
      short = lengths.flatMap((n, i) => (n <= threshold + 1e-8 ? [i] : []));
    return (
      (face.length === 3 && short.length === 1) ||
      (face.length === 4 &&
        short.length === 2 &&
        Math.abs(short[0] - short[1]) === 2)
    );
  });
  const result = new Set<string>();
  for (const edge of edges.values()) {
    if (
      edge.faces.length !== 2 ||
      v3(vertices[edge.a]).distanceTo(v3(vertices[edge.b])) <= threshold + 1e-8
    )
      continue;
    const [a, b] = edge.faces;
    if (
      strips[a] &&
      strips[b] &&
      normal(vertices, faces[a]).dot(normal(vertices, faces[b])) > -0.99
    )
      result.add(edge.key);
  }
  return result;
}
