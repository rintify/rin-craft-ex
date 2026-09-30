import { test } from "node:test";
import assert from "node:assert/strict";
import { gundamHead } from "../examples/gundam-head";
import { generateNet } from "../src/core/unfold";
import { inspectProject } from "../src/core/diagnostics";
import { applyCommands } from "../src/core/commands";
import { EditorStore } from "../src/state/editor";
import {
  extrudeFace,
  insetFace,
  triangulateNonPlanar,
} from "../src/core/meshOperations";
import { normal, worldVertices, v3 } from "../src/core/geometry";
import { edgeKey } from "../src/core/shared";
import { validateProject } from "../src/core/project";
import { faceArea } from "../src/core/meshBuilder";
import { netToSVG } from "../src/core/svg";

test("Gundam head: closed outward meshes, complete nonoverlapping nets, actual A4 bounds", () => {
  const p = gundamHead(),
    n = generateNet(p, p.settings!),
    r = inspectProject(p, p.settings!, n);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.deepEqual(r.dimensionsMm, [130, 126, 72]);
  assert.equal(r.openEdges, 0);
  assert.equal(r.inconsistentEdges, 0);
  assert.equal(r.overlaps, 0);
  assert.equal(r.pages, 3);
  assert.equal(r.netParts, 14);
  assert.ok(r.maxEdgeErrorMm < 1e-8);
  for (const o of p.objects) {
    const vertices = worldVertices(o);
    const volume = o.faces.reduce(
      (sum, face) =>
        sum +
        (faceArea(vertices, face) *
          normal(vertices, face).dot(v3(vertices[face[0]]))) /
          3,
      0,
    );
    assert.ok(volume > 0, o.id + " must have outward normals");
    const edges = new Map<string, number[]>();
    o.faces.forEach((f, fi) =>
      f.forEach((a, i) => {
        const key = edgeKey(a, f[(i + 1) % f.length]);
        edges.set(key, [...(edges.get(key) ?? []), fi]);
      }),
    );
    for (const line of n.islands
      .flatMap((i) => i.lines)
      .filter((l) => l.kind === "cut" && l.edgeId.startsWith(o.id + ":"))) {
      const pair = edges.get(line.edgeId.split(":")[1])!;
      assert.ok(
        normal(vertices, o.faces[pair[0]]).dot(
          normal(vertices, o.faces[pair[1]]),
        ) <
          1 - 1e-7,
        "Printed planar panels must remain uncut",
      );
    }
  }
});
test("atomic AI batches use one Undo step, preserve redo on failure and do not mutate input", () => {
  const p = gundamHead(),
    before = JSON.stringify(p),
    store = new EditorStore(p);
  store.applyBatch({
    label: "Adjust head",
    operations: [
      { type: "rename", name: "Adjusted" },
      { type: "transform", id: "P03", position: [0, 2, 0] },
      { type: "settings", settings: { scale: 80 } },
    ],
  });
  assert.equal(store.getSnapshot().project.name, "Adjusted");
  store.undo();
  assert.deepEqual(store.getSnapshot().project, p);
  assert.throws(() =>
    store.applyBatch({
      label: "Invalid",
      operations: [
        { type: "rename", name: "should not persist" },
        { type: "transform", id: "missing", scale: [1, 1, 1] },
      ],
    }),
  );
  assert.equal(store.getSnapshot().canRedo, true);
  assert.equal(JSON.stringify(p), before);
  store.redo();
  assert.equal(store.getSnapshot().settings.scale, 80);
  assert.throws(() =>
    applyCommands(p, {
      label: "bad mesh",
      operations: [
        { type: "put", object: { ...p.objects[0], faces: [[999, 0, 1]] } },
      ],
    }),
  );
});
test("removed material fields and old printing options are discarded on import", () => {
  const p = gundamHead();
  const legacy = {
    ...p,
    objects: p.objects.map((o) => ({
      ...o,
      color: "#123456",
      faceColors: o.faces.map(() => "#654321"),
    })),
    settings: {
      ...p.settings,
      tabs: true,
      tabWidth: 5,
      colors: true,
      labels: true,
      faceNumbers: true,
    },
  };
  const clean = validateProject(legacy);
  assert.deepEqual(clean, p);
  const store = new EditorStore(clean);
  store.edit("old generator", (draft) => Object.assign(draft, legacy));
  assert.deepEqual(store.getSnapshot().project, p);
  const net = generateNet(clean, clean.settings!);
  const svg = netToSVG(net, clean.settings!, 0);
  assert.ok(!svg.includes("#123456"));
  assert.ok(!svg.includes("stroke-dasharray"));
  assert.ok(svg.includes("20 mm"));
});

test("unsafe custom polygon data is rejected before an AI edit reaches history", () => {
  const p = gundamHead();
  const warped = structuredClone(p);
  warped.objects[2].vertices[0][2] += 1;
  assert.throws(() => validateProject(warped), /平面/);
  const concave = structuredClone(p);
  concave.objects[2].vertices[0] = [0, 38, 44];
  assert.throws(() => validateProject(concave));
  const store = new EditorStore(p);
  assert.throws(() =>
    store.applyBatch({
      label: "invalid mesh",
      operations: [{ type: "put", object: warped.objects[2] }],
    }),
  );
  assert.equal(store.getSnapshot().canUndo, false);
  assert.deepEqual(store.getSnapshot().project, p);
});
