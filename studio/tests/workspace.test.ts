import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { EditorStore } from "../src/state/editor";
import { anchorCenter, initialBasis } from "../src/state/workspace";
import { primitive } from "../src/core/primitives";
import { validateProject, initialProject } from "../src/core/project";
import { zoomFactor, orbitPosition } from "../src/scene/navigation";
import type { Vec3 } from "../src/core/types";
import { defaultSettings } from "../src/core/settings";
const base = () =>
  validateProject({
    ...initialProject(),
    objects: [primitive("box"), primitive("box")],
  });
test("reference continuous controls have frame independent speed", () => {
  assert.equal(zoomFactor(1, 1), 0.5);
  assert.equal(zoomFactor(-1, 1), 2);
  assert.ok(Math.abs(zoomFactor(0.5, 1) - Math.SQRT1_2) < 1e-12);
  for (const fps of [30, 60, 120]) {
    let distance = 100;
    for (let i = 0; i < fps; i++) distance *= zoomFactor(1, 1 / fps);
    assert.ok(Math.abs(distance - 50) < 1e-10);
    let p = new Vector3(0, 0, 100);
    for (let i = 0; i < fps; i++)
      p = orbitPosition(
        p,
        new Vector3(),
        new Vector3(0, 1, 0),
        [1, 0],
        1 / fps,
      );
    assert.ok(Math.abs(Math.atan2(p.x, p.z) - 0.8) < 1e-10);
  }
  const vertical = orbitPosition(
    new Vector3(0, 0, 100),
    new Vector3(),
    new Vector3(0, 1, 0),
    [0, 1],
    10,
  );
  assert.ok(Math.abs(vertical.length() - 100) < 1e-8);
  assert.ok(
    Math.abs(Math.asin(vertical.y / 100) - (Math.PI / 2 - 0.01)) < 1e-8,
  );
});
test("multiple anchors, reference basis cycle and multi-object deletion support Undo", () => {
  const p = base(),
    s = new EditorStore(p);
  assert.equal(s.getSnapshot().view, "model");
  assert.equal(s.getSnapshot().mode, "point");
  s.addAnchor({ objectId: p.objects[0].id, vertex: 0 });
  s.addAnchor({ position: [1, 2, 3] });
  s.addAnchor({ objectId: p.objects[1].id, vertex: 1 });
  s.moveBasis();
  assert.deepEqual(s.getSnapshot().basis.origin, p.objects[0].vertices[0]);
  s.rotateBasis();
  assert.deepEqual(s.getSnapshot().basis.x, initialBasis().z);
  s.rotateBasis();
  s.rotateBasis();
  assert.deepEqual(s.getSnapshot().basis.x, initialBasis().x);
  assert.equal(s.getSnapshot().canUndo, false);
  s.remove();
  assert.equal(s.getSnapshot().project.objects.length, 0);
  s.undo();
  assert.deepEqual(s.getSnapshot().project, p);
  s.redo();
  assert.equal(s.getSnapshot().project.objects.length, 0);
  assert.deepEqual(
    anchorCenter(
      [{ position: [2, 4, 6] }, { position: [4, 6, 8] }],
      p,
      [0, 0, 0],
    ),
    [3, 5, 7],
  );
});
test("two actual short triangle edges are rejected atomically for imports, edits and scaling", () => {
  const p = base(),
    o = p.objects[0];
  o.vertices = [
    [0, 0, 0],
    [0.5, 0, 0],
    [0, 0.5, 0],
  ];
  o.faces = [[0, 1, 2]];
  assert.throws(() => validateProject(p), /2本以上/);
  o.vertices = [
    [0, 0, 0],
    [0.5, 0, 0],
    [0, 20, 0],
  ];
  assert.doesNotThrow(() => validateProject(p));
  const s = new EditorStore(p);
  s.transform(o.id, [0, 0, 0], [0, 0, 0], [0.01, 0.01, 0.01]);
  assert.equal(s.getSnapshot().canUndo, false);
  assert.deepEqual(s.getSnapshot().project.objects[0].scale, [1, 1, 1]);
  s.setSettings({ microEdgeLength: 20 });
  assert.equal(s.getSnapshot().settings.microEdgeLength, 1);
  for (const scale of [5, 500])
    assert.doesNotThrow(() =>
      validateProject({ ...p, settings: { ...defaultSettings, scale } }),
    );
  const enlarged = structuredClone(p);
  enlarged.objects[0].vertices = [
    [0, 0, 0],
    [0.5, 0, 0],
    [0, 0.5, 0],
  ];
  enlarged.objects[0].scale = [10, 10, 10];
  assert.doesNotThrow(() => validateProject(enlarged));
});
