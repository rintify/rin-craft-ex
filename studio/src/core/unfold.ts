import { edgeKey } from "./shared";
import { normal, projectFace, worldVertices, v3 } from "./geometry";
import type { Project, Vec2, Vec3 } from "./types";
import { alignFace, bounds, center2, overlaps } from "./polygon";
import {
  meshEdges,
  smoothEdges,
  forbiddenTriangles,
  type MeshEdge,
} from "./surfaces";
import { paginate } from "./pagination";
import type { NetSettings } from "./settings";
import type { NetIsland, NetResult } from "./netTypes";
export * from "./netTypes";
export { defaultSettings, type NetSettings } from "./settings";
export const paperDimensions = (s: NetSettings): Vec2 => {
  const d: Vec2 =
    s.paper === "A3"
      ? [297, 420]
      : s.paper === "Letter"
        ? [215.9, 279.4]
        : [210, 297];
  return s.landscape ? [d[1], d[0]] : d;
};
interface UnfoldedGroup {
  placements: Map<number, Vec2[]>;
  joins: Set<string>;
}
/** Grow a spanning forest. Each insertion preserves edge lengths and is collision checked. */
function unfoldObject(
  vertices: Vec3[],
  faces: number[][],
  edges: Map<string, MeshEdge>,
  seams: Set<string>,
  objectId: string,
  smooth: Set<string>,
): UnfoldedGroup[] {
  const remaining = new Set(faces.map((_, i) => i)),
    groups: UnfoldedGroup[] = [];
  const neighbors = faces.map((f) =>
    f
      .map((a, i) => edges.get(edgeKey(a, f[(i + 1) % f.length]))!)
      .filter(
        (e) => e.faces.length === 2 && !seams.has(`${objectId}:${e.key}`),
      ),
  );
  while (remaining.size) {
    const root = [...remaining].sort(
      (a, b) =>
        neighbors[b].filter((e) => smooth.has(e.key)).length -
        neighbors[a].filter((e) => smooth.has(e.key)).length,
    )[0];
    const rootFace = faces[root];
    const rootEdge = rootFace.reduce(
      (best, a, i) =>
        v3(vertices[a]).distanceTo(
          v3(vertices[rootFace[(i + 1) % rootFace.length]]),
        ) >
        v3(vertices[rootFace[best]]).distanceTo(
          v3(vertices[rootFace[(best + 1) % rootFace.length]]),
        )
          ? i
          : best,
      0,
    );
    const placements = new Map<number, Vec2[]>([
        [
          root,
          projectFace(
            vertices,
            rootFace,
            rootFace[rootEdge],
            rootFace[(rootEdge + 1) % rootFace.length],
          ),
        ],
      ]),
      joins = new Set<string>();
    remaining.delete(root);
    const frontier = [root];
    while (frontier.length) {
      const parent = frontier.shift()!,
        parentPoly = faces[parent],
        parentPoints = placements.get(parent)!;
      const candidates = neighbors[parent]
        .map((e) => ({ e, child: e.faces.find((i) => i !== parent)! }))
        .filter((c) => remaining.has(c.child));
      candidates.sort((a, b) => {
        const parentNormal = normal(vertices, faces[parent]);
        const flatA = Number(
          parentNormal.dot(normal(vertices, faces[a.child])) > 1 - 1e-7,
        );
        const flatB = Number(
          parentNormal.dot(normal(vertices, faces[b.child])) > 1 - 1e-7,
        );
        return (
          Number(smooth.has(b.e.key)) - Number(smooth.has(a.e.key)) ||
          flatB - flatA ||
          v3(vertices[b.e.a]).distanceTo(v3(vertices[b.e.b])) -
            v3(vertices[a.e.a]).distanceTo(v3(vertices[a.e.b]))
        );
      });
      for (const { e, child } of candidates) {
        if (!remaining.has(child)) continue;
        const face = faces[child],
          a = parentPoints[parentPoly.indexOf(e.a)],
          b = parentPoints[parentPoly.indexOf(e.b)];
        const points = alignFace(
          projectFace(vertices, face),
          face.indexOf(e.a),
          face.indexOf(e.b),
          a,
          b,
          center2(parentPoints),
        );
        const occupied = [...placements.values()];
        if (occupied.some((p) => overlaps(points, p))) continue;
        placements.set(child, points);
        joins.add(e.key);
        remaining.delete(child);
        if (
          smooth.has(e.key) ||
          normal(vertices, faces[parent]).dot(normal(vertices, face)) > 1 - 1e-7
        )
          frontier.unshift(child);
        else frontier.push(child);
      }
    }
    for (const e of edges.values()) {
      if (e.faces.length !== 2 || seams.has(`${objectId}:${e.key}`)) continue;
      const [a, b] = e.faces;
      const pa = placements.get(a),
        pb = placements.get(b);
      if (
        !pa ||
        !pb ||
        normal(vertices, faces[a]).dot(normal(vertices, faces[b])) < 1 - 1e-7
      )
        continue;
      if (
        [e.a, e.b].every((v) => {
          const x = pa[faces[a].indexOf(v)],
            y = pb[faces[b].indexOf(v)];
          return Math.hypot(x[0] - y[0], x[1] - y[1]) < 1e-5;
        })
      )
        joins.add(e.key);
    }
    groups.push({ placements, joins });
  }
  return groups;
}

export function generateNet(
  project: Project,
  settings: NetSettings,
): NetResult {
  const [width, height] = paperDimensions(settings);
  const result: NetResult = {
    islands: [],
    sheets: [],
    pages: 0,
    width,
    height,
    warnings: [],
    errors: [],
    faceCount: 0,
  };
  const seams = new Set(project.seams),
    scale = settings.scale / 100;
  for (const o of project.objects.filter((o) => o.visible)) {
    const physical = worldVertices(o),
      vertices = physical.map((p) => p.map((c) => c * scale) as Vec3),
      edges = meshEdges(o.faces);
    if ([...edges.values()].some((e) => e.faces.length > 2)) {
      result.errors.push(`${o.name}：3面以上が接する辺があります。`);
      continue;
    }
    if (
      forbiddenTriangles(physical, o.faces, settings.microEdgeLength).length
    ) {
      result.errors.push(
        `${o.name}：${settings.microEdgeLength}mm以下の辺を2本以上持つ三角形は作成できません。`,
      );
      continue;
    }
    if (
      o.faces.some(
        (f) =>
          normal(vertices, f).lengthSq() < 0.5 ||
          f.some(
            (a, i) =>
              v3(vertices[a]).distanceTo(v3(vertices[f[(i + 1) % f.length]])) <
              1e-6,
          ),
      )
    ) {
      result.errors.push(`${o.name}：長さや面積がゼロの箇所があります。`);
      continue;
    }
    const smooth = smoothEdges(
      physical,
      o.faces,
      settings.microEdgeLength,
      edges,
    );
    const groups = unfoldObject(vertices, o.faces, edges, seams, o.id, smooth);
    const lookup = new Map<number, NetIsland>(),
      joined = new Set(groups.flatMap((g) => [...g.joins]));
    for (const group of groups) {
      const island: NetIsland = {
        id: result.islands.length + 1,
        name: o.name,
        faces: [],
        lines: [],
        width: 0,
        height: 0,
      };
      group.placements.forEach((points, fi) => {
        island.faces.push({ objectId: o.id, faceIndex: fi, points });
        lookup.set(fi, island);
        result.faceCount++;
      });
      result.islands.push(island);
    }
    for (const e of edges.values()) {
      const edgeId = `${o.id}:${e.key}`;
      if (joined.has(e.key)) {
        if (smooth.has(e.key)) continue;
        const fi = e.faces[0],
          island = lookup.get(fi)!,
          poly = island.faces.find((f) => f.faceIndex === fi)!.points,
          f = o.faces[fi];
        const i = f.findIndex(
            (a, i) => edgeKey(a, f[(i + 1) % f.length]) === e.key,
          ),
          u = f[i],
          v = f[(i + 1) % f.length];
        const n1 = normal(vertices, f),
          n2 = normal(vertices, o.faces[e.faces[1]]);
        if (n1.dot(n2) < 1 - 1e-7)
          island.lines.push({
            a: poly[f.indexOf(e.a)],
            b: poly[f.indexOf(e.b)],
            kind:
              n1
                .clone()
                .cross(n2)
                .dot(v3(vertices[v]).sub(v3(vertices[u]))) > 0
                ? "mountain"
                : "valley",
            edgeId,
          });
      } else
        for (const fi of e.faces) {
          const island = lookup.get(fi)!,
            face = island.faces.find((f) => f.faceIndex === fi)!,
            indices = o.faces[fi];
          island.lines.push({
            a: face.points[indices.indexOf(e.a)],
            b: face.points[indices.indexOf(e.b)],
            kind: "cut",
            edgeId,
          });
        }
    }
  }
  for (const island of result.islands) {
    const box = bounds(island.faces.map((f) => f.points));
    const map = ([x, y]: Vec2): Vec2 => [x - box.minX, y - box.minY];
    island.faces.forEach((f) => (f.points = f.points.map(map)));
    island.lines.forEach((l) => {
      l.a = map(l.a);
      l.b = map(l.b);
    });
    island.width = box.width;
    island.height = box.height;
  }
  try {
    result.sheets = paginate(result.islands, width, height, settings.margin);
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "用紙の分割に失敗しました",
    );
  }
  result.pages = result.sheets.length;
  return result;
}
