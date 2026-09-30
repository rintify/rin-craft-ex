import { Vector3 } from "three";
import type { CraftObject, Vec2, Vec3 } from "./types";
import { v3 } from "./geometry";

/** A closed prism with a counter-clockwise XY outline and a flat mounting back. */
export function prism(
  id: string,
  name: string,
  outline: Vec2[],
  back: number,
  front: number,
): CraftObject {
  const n = outline.length;
  return {
    id,
    name,
    visible: true,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    vertices: [
      ...outline.map(([x, y]) => [x, y, front] as Vec3),
      ...outline.map(([x, y]) => [x, y, back] as Vec3),
    ],
    faces: [
      outline.map((_, i) => i),
      outline.map((_, i) => 2 * n - 1 - i),
      ...outline.map((_, i) => [(i + 1) % n, i, i + n, ((i + 1) % n) + n]),
    ],
  };
}

export function mirrored(
  object: CraftObject,
  id: string,
  name: string,
): CraftObject {
  const copy = structuredClone(object);
  copy.id = id;
  copy.name = name;
  copy.vertices.forEach((p) => (p[0] *= -1));
  copy.faces.forEach((f) => f.reverse());
  return copy;
}

export function faceArea(vertices: Vec3[], face: number[]) {
  const sum = new Vector3();
  face.forEach((a, i) =>
    sum.add(v3(vertices[a]).cross(v3(vertices[face[(i + 1) % face.length]]))),
  );
  return sum.length() / 2;
}
