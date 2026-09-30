import test from "node:test";
import assert from "node:assert/strict";
import {
  primitive,
  worldVertices,
  extrudeFace,
  insetFace,
  edgeKey,
  type Primitive,
  type Project,
} from "../src/core/model";
import { defaultSettings, generateNet } from "../src/core/unfold";
import { overlaps, signedArea } from "../src/core/polygon";
import { netToSVG, LINE_COLORS } from "../src/core/svg";
import { inspectProject } from "../src/core/diagnostics";
import { clipPolygon } from "../src/core/clipping";
import { TILE_OVERLAP, printableSize } from "../src/core/pagination";
import { meshEdges, smoothEdges } from "../src/core/surfaces";
const project = (kind: Primitive): Project => ({
  version: 1,
  name: kind,
  objects: [primitive(kind)],
  seams: [],
  settings: { ...defaultSettings },
});
for (const kind of [
  "box",
  "house",
  "cylinder",
  "cone",
  "sphere",
  "pyramid",
] as Primitive[]) {
  test(`${kind}: complete nonoverlapping net preserves every physical edge`, () => {
    const p = project(kind),
      n = generateNet(p, defaultSettings),
      report = inspectProject(p, defaultSettings, n);
    assert.equal(report.valid, true, JSON.stringify(report.errors));
    assert.equal(n.faceCount, p.objects[0].faces.length);
    assert.ok(report.maxEdgeErrorMm < 1e-6);
    for (const sheet of n.sheets)
      for (let i = 0; i < sheet.faces.length; i++)
        for (let j = i + 1; j < sheet.faces.length; j++)
          assert.equal(
            overlaps(sheet.faces[i].points, sheet.faces[j].points),
            false,
          );
  });
}
test("explicit seams separate all cube faces", () => {
  const p = project("box"),
    o = p.objects[0];
  p.seams = [...meshEdges(o.faces).keys()].map((k) => `${o.id}:${k}`);
  assert.equal(generateNet(p, defaultSettings).islands.length, 6);
});
test("transforms and output scale preserve physical dimensions", () => {
  const p = project("box"),
    o = p.objects[0];
  o.position = [400, -30, 7];
  o.rotation = [17, 32, 71];
  o.scale = [1, 1.3, 0.7];
  const settings = { ...defaultSettings, scale: 50 };
  assert.equal(inspectProject(p, settings).valid, true);
});
test("a single oversize face is tiled without shrinkage or missing area, with matching registration pairs", () => {
  const p = project("box"),
    o = p.objects[0];
  o.vertices = [
    [0, 0, 0],
    [420, 0, 0],
    [420, 330, 0],
    [0, 330, 0],
  ];
  o.faces = [[0, 1, 2, 3]];
  const n = generateNet(p, defaultSettings);
  assert.deepEqual(n.errors, []);
  assert.equal(n.faceCount, 1);
  assert.equal(n.pages, 6);
  assert.ok(Math.abs(n.islands[0].width - 420) < 1e-6);
  assert.ok(Math.abs(n.islands[0].height - 330) < 1e-6);
  let uniqueArea = 0;
  const marks = new Map<string, number[][]>();
  for (const s of n.sheets) {
    const t = s.tile!,
      [w, h] = printableSize(n.width, n.height, 10);
    const source = s.faces[0].points.map(
      ([x, y]) =>
        [x - 10 + t.origin[0], y - 10 + t.origin[1]] as [number, number],
    );
    const owned = clipPolygon(source, {
      x: t.origin[0],
      y: t.origin[1],
      width: t.column === t.columns - 1 ? w : w - TILE_OVERLAP,
      height: t.row === t.rows - 1 ? h : h - TILE_OVERLAP,
    });
    uniqueArea += Math.abs(signedArea(owned));
    for (const m of s.marks) {
      const inverse = [
        m.point[0] - 10 + t.origin[0],
        m.point[1] - 10 + t.origin[1],
      ];
      assert.deepEqual(inverse, m.source);
      marks.set(m.id, [...(marks.get(m.id) ?? []), inverse]);
    }
  }
  assert.ok(Math.abs(uniqueArea - 420 * 330) < 1e-5);
  assert.ok(marks.size >= 8);
  for (const pair of marks.values()) {
    assert.equal(pair.length, 2);
    assert.deepEqual(pair[0], pair[1]);
  }
  assert.equal(inspectProject(p, defaultSettings, n).valid, true);
});
for (const kind of ["cone", "cylinder"] as const)
  test(`${kind}: smooth strip stays connected and has no internal fold lines`, () => {
    const p = project(kind),
      o = p.objects[0],
      edges = meshEdges(o.faces),
      smooth = smoothEdges(worldVertices(o), o.faces, 1, edges),
      n = generateNet(p, defaultSettings);
    assert.equal(smooth.size, 192);
    assert.equal(n.islands.length, 1);
    const internal = n.islands
      .flatMap((i) => i.lines)
      .filter((l) => smooth.has(l.edgeId.split(":")[1]));
    assert.equal(internal.length, 2, "one opening seam, printed on both sides");
    assert.ok(internal.every((l) => l.kind === "cut"));
    const scaled = generateNet(p, { ...defaultSettings, scale: 300 });
    assert.equal(scaled.islands.length, n.islands.length);
    assert.equal(scaled.islands[0].lines.length, n.islands[0].lines.length);
    assert.ok(scaled.pages > 1);
  });
test("extrusion and inset keep closed topology and can unfold", () => {
  const p = project("box");
  insetFace(p.objects[0], 3, 0.25);
  extrudeFace(p.objects[0], 3, 10);
  const r = inspectProject(p, defaultSettings);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.openEdges, 0);
});
test("many objects pack with no overlap across pages", () => {
  const p = project("box");
  for (let i = 0; i < 7; i++) p.objects.push(primitive("house"));
  const n = generateNet(p, defaultSettings);
  assert.ok(n.pages > 1);
  assert.equal(n.faceCount, 55);
  for (const s of n.sheets)
    for (let i = 0; i < s.faces.length; i++)
      for (let j = i + 1; j < s.faces.length; j++)
        assert.equal(overlaps(s.faces[i].points, s.faces[j].points), false);
});
test("SVG uses solid distinct cut, mountain and valley lines with physical paper dimensions", () => {
  const n = generateNet(project("box"), defaultSettings),
    svg = netToSVG(n, defaultSettings, 0);
  assert.match(svg, /width="210mm" height="297mm"/);
  assert.ok(!svg.includes("stroke-dasharray"));
  assert.ok(!svg.includes("NaN"));
  for (const color of [
    LINE_COLORS.cut,
    LINE_COLORS.mountain,
    LINE_COLORS.valley,
  ])
    assert.ok(svg.includes(color));
});
test("nonmanifold input is diagnosed", () => {
  const p = project("box");
  p.objects[0].faces.push(p.objects[0].faces[0]);
  assert.ok(
    generateNet(p, defaultSettings).errors.some((e) => e.includes("3面以上")),
  );
});

test("recessed extrusions classify convex and concave folds separately", () => {
  const p = project("box");
  insetFace(p.objects[0], 3, 0.3);
  extrudeFace(p.objects[0], 3, 10);
  const lines = generateNet(p, defaultSettings).islands.flatMap((i) => i.lines);
  assert.ok(lines.some((l) => l.kind === "mountain"));
  assert.ok(lines.some((l) => l.kind === "valley"));
});
