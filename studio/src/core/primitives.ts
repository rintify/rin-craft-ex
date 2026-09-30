import { Vector3 } from "three";
import type { CraftObject, Primitive, Vec3 } from "./types";
import { v3, normal, faceCenter } from "./geometry";
import { uid } from "./shared";
export function primitive(kind: Primitive, index = 1): CraftObject {
  let vertices: Vec3[] = [],
    faces: number[][] = [];
  const names = {
    box: "立方体",
    house: "小さな家",
    cylinder: "円柱",
    cone: "円すい",
    sphere: "多面球",
    pyramid: "四角すい",
  };
  if (kind === "box") {
    vertices = [
      [-20, 0, -20],
      [20, 0, -20],
      [20, 40, -20],
      [-20, 40, -20],
      [-20, 0, 20],
      [20, 0, 20],
      [20, 40, 20],
      [-20, 40, 20],
    ];
    faces = [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ];
  } else if (kind === "house") {
    vertices = [
      [-22, 0, -20],
      [22, 0, -20],
      [22, 32, -20],
      [0, 52, -20],
      [-22, 32, -20],
      [-22, 0, 20],
      [22, 0, 20],
      [22, 32, 20],
      [0, 52, 20],
      [-22, 32, 20],
    ];
    faces = [
      [4, 3, 2, 1, 0],
      [5, 6, 7, 8, 9],
      [0, 1, 6, 5],
      [1, 2, 7, 6],
      [2, 3, 8, 7],
      [3, 4, 9, 8],
      [4, 0, 5, 9],
    ];
  } else if (kind === "sphere") {
    const t = (1 + Math.sqrt(5)) / 2;
    vertices = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map(
      (p) =>
        v3(p as Vec3)
          .normalize()
          .multiplyScalar(28)
          .add(new Vector3(0, 28, 0))
          .toArray() as Vec3,
    );
    faces = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
  } else {
    const n = kind === "pyramid" ? 4 : 192;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
      vertices.push([Math.cos(a) * 24, 0, Math.sin(a) * 24]);
    }
    faces.push(Array.from({ length: n }, (_, i) => i));
    if (kind === "cylinder") {
      vertices.push(...vertices.map((p) => [p[0], 44, p[2]] as Vec3));
      faces.push(Array.from({ length: n }, (_, i) => n * 2 - 1 - i));
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        faces.push([i, i + n, j + n, j]);
      }
    } else {
      vertices.push([0, 48, 0]);
      for (let i = 0; i < n; i++) faces.push([i, n, (i + 1) % n]);
    }
  }
  const center = vertices
    .reduce((a, p) => a.add(v3(p)), new Vector3())
    .divideScalar(vertices.length);
  faces = faces.map((f) =>
    normal(vertices, f).dot(faceCenter(vertices, f).sub(center)) < 0
      ? [...f].reverse()
      : f,
  );
  return {
    id: uid(),
    name: `${names[kind]}${index > 1 ? " " + index : ""}`,
    vertices,
    faces,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    visible: true,
  };
}
