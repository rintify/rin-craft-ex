import type { CraftObject, Vec3, Project } from "./types";
import { primitive } from "./primitives";
import { projectFace, triangles, worldVertices } from "./geometry";
import { validateProject } from "./project";
import { triangulateNonPlanar } from "./meshOperations";
export function parseOBJ(text: string): CraftObject {
  if (text.length > 5_000_000) throw Error("OBJ は5MB以下にしてください。");
  const vertices: Vec3[] = [],
    faces: number[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const [type, ...parts] = line.trim().split(/\s+/);
    if (type === "v") {
      if (parts.length < 3) throw Error("OBJ の頂点座標が不足しています。");
      vertices.push(parts.slice(0, 3).map(Number) as Vec3);
    }
    if (type === "f") {
      faces.push(
        parts.map((p) => {
          const i = Number(p.split("/")[0]);
          return i < 0 ? vertices.length + i : i - 1;
        }),
      );
    }
  }
  const o = { ...primitive("box"), name: "読み込んだモデル", vertices, faces };
  if (
    vertices.length < 3 ||
    vertices.length > 4000 ||
    faces.length > 1200 ||
    vertices.some((v) =>
      v.some((n) => !Number.isFinite(n) || Math.abs(n) > 100000),
    ) ||
    faces.some(
      (f) =>
        f.length < 3 ||
        f.length > 512 ||
        f.some((i) => !Number.isInteger(i) || i < 0 || i >= vertices.length),
    )
  )
    throw Error("OBJ の頂点または面の形式が正しくありません。");

  // Weld only exactly coincident OBJ position records; topology stays indexed.
  const map = new Map<string, number>(),
    welded: Vec3[] = [],
    indices: number[] = [];
  vertices.forEach((p) => {
    const key = p.join(",");
    let index = map.get(key);
    if (index === undefined) {
      index = welded.length;
      welded.push(p);
      map.set(key, index);
    }
    indices.push(index);
  });
  o.vertices = welded;
  o.faces = faces.map((f) => f.map((i) => indices[i]));
  // Keep convex planar polygons; triangulate concave and warped faces.
  o.faces = o.faces.flatMap((f) => {
    const pp = projectFace(o.vertices, f);
    let positive = false,
      negative = false;
    for (let i = 0; i < pp.length; i++) {
      const a = pp[i],
        b = pp[(i + 1) % pp.length],
        c = pp[(i + 2) % pp.length],
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      positive ||= cross > 1e-6;
      negative ||= cross < -1e-6;
    }
    return positive && negative ? triangles(o.vertices, f) : [f];
  });
  triangulateNonPlanar(o);
  validateProject({ version: 1, name: "OBJ", objects: [o], seams: [] });
  return o;
}
export function toOBJ(project: Project) {
  let offset = 1;
  const lines = ["# FOLD Studio — millimeters"];
  for (const o of project.objects) {
    if (!o.visible) continue;
    lines.push(
      `o ${o.name.replace(/\s+/g, "_")}`,
      ...worldVertices(o).map((v) => `v ${v.join(" ")}`),
      ...o.faces.map((f) => `f ${f.map((i) => i + offset).join(" ")}`),
    );
    offset += o.vertices.length;
  }
  return lines.join("\n");
}
