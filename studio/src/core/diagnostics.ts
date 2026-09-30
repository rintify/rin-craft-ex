import type { Project } from "./types";
import type { NetResult, NetSettings } from "./unfold";
import { generateNet } from "./unfold";
import { worldVertices, v3, normal } from "./geometry";
import { edgeKey } from "./shared";
import { overlaps } from "./polygon";
import { faceArea } from "./meshBuilder";

/** Physical and topology checks; this is not a paper-assembly or 3D collision simulation. */
export function inspectProject(
  project: Project,
  settings: NetSettings,
  net: NetResult = generateNet(project, settings),
) {
  const errors = [...net.errors],
    notes = [...net.warnings];
  const visible = project.objects.filter((o) => o.visible);
  const allVertices = visible.flatMap(worldVertices);
  const dimensions = [0, 1, 2].map((axis) =>
    allVertices.length
      ? Math.max(...allVertices.map((v) => v[axis])) -
        Math.min(...allVertices.map((v) => v[axis]))
      : 0,
  );
  let maxEdgeError = 0,
    overlapsCount = 0,
    openEdges = 0,
    inconsistentEdges = 0;
  const parts = visible.map((o) => {
    const vertices = worldVertices(o),
      edges = new Map<string, number[]>();
    for (const f of o.faces)
      f.forEach((a, i) => {
        const b = f[(i + 1) % f.length],
          key = edgeKey(a, b);
        edges.set(key, [...(edges.get(key) ?? []), a < b ? 1 : -1]);
      });
    openEdges += [...edges.values()].filter((e) => e.length === 1).length;
    inconsistentEdges += [...edges.values()].filter(
      (e) => e.length === 2 && e[0] === e[1],
    ).length;
    const islands = net.islands.filter((i) =>
      i.faces.some((f) => f.objectId === o.id),
    );
    for (const face of o.faces) {
      const n = normal(vertices, face),
        origin = v3(vertices[face[0]]);
      if (face.some((i) => Math.abs(v3(vertices[i]).sub(origin).dot(n)) > 1e-5))
        errors.push(`${o.name}: 平面ではない面があります。`);
    }
    return {
      id: o.id,
      name: o.name,
      faces: o.faces.length,
      netParts: islands.length,
      pages: net.sheets.flatMap((s, i) =>
        s.faces.some((f) => f.objectId === o.id) ? [i + 1] : [],
      ),
      areaMm2: o.faces.reduce((n, f) => n + faceArea(vertices, f), 0),
    };
  });
  const seen = new Set<string>();
  for (const island of net.islands) {
    const polygons = island.faces.map((f) => f.points);
    for (let a = 0; a < polygons.length; a++)
      for (let b = a + 1; b < polygons.length; b++)
        if (overlaps(polygons[a], polygons[b])) overlapsCount++;
    for (const f of island.faces) {
      const key = `${f.objectId}:${f.faceIndex}`;
      if (seen.has(key)) errors.push(`${key}: 面が重複しています。`);
      seen.add(key);
      const o = visible.find((o) => o.id === f.objectId)!,
        vertices = worldVertices(o),
        source = o.faces[f.faceIndex];
      source.forEach((a, i) => {
        const j = (i + 1) % source.length;
        const expected =
          (v3(vertices[a]).distanceTo(v3(vertices[source[j]])) *
            settings.scale) /
          100;
        const actual = Math.hypot(
          f.points[i][0] - f.points[j][0],
          f.points[i][1] - f.points[j][1],
        );
        maxEdgeError = Math.max(maxEdgeError, Math.abs(expected - actual));
      });
    }
  }
  for (const [page, sheet] of net.sheets.entries()) {
    for (const f of sheet.faces)
      if (
        f.points.some(
          ([x, y]) =>
            x < settings.margin - 1e-5 ||
            y < settings.margin - 1e-5 ||
            x > net.width - settings.margin + 1e-5 ||
            y > net.height - settings.margin + 1e-5,
        )
      )
        errors.push(`ページ ${page + 1}: 印刷範囲外です。`);
  }
  const marks = new Map<string, { source: number[]; count: number }>();
  for (const sheet of net.sheets)
    for (const m of sheet.marks) {
      const old = marks.get(m.id);
      if (
        old &&
        Math.hypot(old.source[0] - m.source[0], old.source[1] - m.source[1]) >
          1e-6
      )
        errors.push(`目印 ${m.id}: 位置が一致しません。`);
      marks.set(m.id, { source: m.source, count: (old?.count ?? 0) + 1 });
    }
  if ([...marks.values()].some((m) => m.count !== 2))
    errors.push("紙をつなぐ目印の対が一致しません。");
  const expectedFaces = visible.reduce((n, o) => n + o.faces.length, 0);
  if (seen.size !== expectedFaces)
    errors.push("展開されていない面があります。");
  if (overlapsCount) errors.push(`面の重なり: ${overlapsCount}`);
  if (inconsistentEdges)
    errors.push(`隣接する面の向きが不整合: ${inconsistentEdges}`);
  if (maxEdgeError > 1e-5) errors.push(`辺長の誤差: ${maxEdgeError} mm`);
  return {
    valid: !errors.length,
    dimensionsMm: dimensions,
    objects: visible.length,
    faces: expectedFaces,
    pages: net.pages,
    netParts: net.islands.length,
    openEdges,
    inconsistentEdges,
    overlaps: overlapsCount,
    maxEdgeErrorMm: maxEdgeError,
    registrationPairs: marks.size,
    errors,
    notes,
    parts,
  };
}
