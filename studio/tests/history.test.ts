import test from "node:test";
import assert from "node:assert/strict";
import { History } from "../src/core/history";
import { EditorStore } from "../src/state/editor";
import {
  initialProject,
  primitive,
  parseOBJ,
  validateProject,
} from "../src/core/model";
test("undo and redo restore document state and labels", () => {
  const h = new History({ n: 0 });
  h.commit({ n: 1 }, "move");
  h.commit({ n: 2 }, "rotate");
  h.undo();
  assert.deepEqual(h.current, { n: 1 });
  assert.equal(h.redoLabel, "rotate");
  h.redo();
  assert.deepEqual(h.current, { n: 2 });
});
test("a new branch clears redo; no-op commits preserve redo", () => {
  const h = new History(0);
  h.commit(1, "a");
  h.commit(2, "b");
  h.undo();
  assert.equal(h.commit(1, "no-op"), false);
  assert.equal(h.canRedo, true);
  h.commit(3, "branch");
  assert.equal(h.canRedo, false);
});
test("history capacity bounds stored states", () => {
  const h = new History(0, 2);
  for (let i = 1; i < 5; i++) h.commit(i, "step");
  assert.equal(h.undo(), true);
  assert.equal(h.undo(), true);
  assert.equal(h.undo(), false);
  assert.equal(h.current, 2);
});
test("store restores geometry, extrusion, visibility and deletion without history pollution from selection", () => {
  const p = validateProject({
      ...initialProject(),
      objects: [primitive("house")],
    }),
    store = new EditorStore(p),
    o = p.objects[0],
    before = JSON.stringify(p);
  store.setMode("face");
  store.select({ objectId: o.id, face: 1 });
  assert.equal(store.getSnapshot().canUndo, false);
  store.extrude(10);
  assert.equal(store.getSnapshot().project.objects[0].faces.length, 12);
  store.undo();
  assert.equal(JSON.stringify(store.getSnapshot().project), before);
  store.redo();
  assert.equal(store.getSnapshot().project.objects[0].faces.length, 12);
  store.remove();
  assert.equal(store.getSnapshot().project.objects.length, 0);
  store.undo();
  assert.equal(store.getSnapshot().project.objects.length, 1);
});
test("one transform commit is one undo step", () => {
  const p = validateProject({
      ...initialProject(),
      objects: [primitive("house")],
    }),
    store = new EditorStore(p),
    id = p.objects[0].id;
  store.transform(id, [12, 5, 3], [0, 45, 0], [2, 1, 1]);
  store.undo();
  assert.deepEqual(store.getSnapshot().project, p);
  assert.equal(store.getSnapshot().canUndo, false);
});
test("OBJ parser supports negative indices and rejects invalid input", () => {
  const object = parseOBJ("v 0 0 0\nv 20 0 0\nv 0 20 0\nf -3 -2 -1");
  assert.deepEqual(object.faces, [[0, 1, 2]]);
  assert.throws(() => parseOBJ("v 0 0 0\nf 1 2 3"));
  assert.throws(() =>
    validateProject({
      version: 1,
      name: "bad",
      objects: [{ ...object, scale: [0, 1, 1] }],
      seams: [],
    }),
  );
});
test("paper settings are saved in the document and support undo/redo", () => {
  const store = new EditorStore(initialProject());
  store.setSettings({ paper: "A3", scale: 75 });
  assert.equal(store.getSnapshot().project.settings?.paper, "A3");
  store.undo();
  assert.equal(store.getSnapshot().settings.paper, "A4");
  store.redo();
  assert.equal(store.getSnapshot().settings.scale, 75);
});
test("invalid edits never change the document or undo history", () => {
  const p = validateProject({
      ...initialProject(),
      objects: [primitive("house")],
    }),
    store = new EditorStore(p);
  store.updateObject(p.objects[0].id, "invalid", (o) => {
    o.scale = [NaN, 0, 1];
  });
  assert.deepEqual(store.getSnapshot().project, p);
  assert.equal(store.getSnapshot().canUndo, false);
});

test("OBJ import triangulates concave polygons before final validation", () => {
  const o = parseOBJ(
    "v 0 0 0\nv 20 0 0\nv 20 20 0\nv 10 10 0\nv 0 20 0\nf 1 2 3 4 5",
  );
  assert.equal(o.faces.length, 3);
  assert.doesNotThrow(() =>
    validateProject({ version: 1, name: "concave", objects: [o], seams: [] }),
  );
});
