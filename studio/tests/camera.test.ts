import test from "node:test";
import assert from "node:assert/strict";
import { Matrix4, Quaternion, Vector3 } from "three";
import { cameraPoseAt, type CameraPose } from "../src/scene/cameraMotion";
import { orbitPosition } from "../src/scene/navigation";
const start: CameraPose = {
  position: new Vector3(0, 0, 200),
  target: new Vector3(),
  up: new Vector3(0, 1, 0),
};
const end: CameraPose = {
  position: new Vector3(100, 60, 0),
  target: new Vector3(0, 60, 0),
  up: new Vector3(0, 1, 0),
};
test("camera presets follow an arc, preserve distance and arrive exactly", () => {
  assert.deepEqual(cameraPoseAt(start, end, 0), start);
  assert.deepEqual(cameraPoseAt(start, end, 1), end);
  let lastDistance = 201;
  for (let i = 0; i <= 100; i++) {
    const p = cameraPoseAt(start, end, i / 100),
      distance = p.position.distanceTo(p.target);
    assert.ok(distance >= 100 - 1e-8 && distance <= lastDistance + 1e-8);
    lastDistance = distance;
    assert.ok(Math.abs(p.up.length() - 1) < 1e-8);
    assert.ok(p.position.toArray().every(Number.isFinite));
  }
  const halfway = cameraPoseAt(start, end, 0.5);
  assert.ok(halfway.position.x > 0 && halfway.position.z > 0);
  const restarted = cameraPoseAt(halfway, start, 0);
  assert.deepEqual(restarted, halfway);
});
test("look rotates without changing the eye position, including opposite up vectors", () => {
  const goal = {
    ...end,
    position: start.position.clone(),
    up: new Vector3(0, -1, 0),
  };
  let previous = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(start.position, start.target, start.up),
  );
  for (let i = 0; i <= 100; i++) {
    const p = cameraPoseAt(start, goal, i / 100, true);
    assert.deepEqual(p.position, start.position);
    const q = new Quaternion().setFromRotationMatrix(
      new Matrix4().lookAt(p.position, p.target, p.up),
    );
    assert.ok(q.angleTo(previous) < 0.1, "no orientation jumps or roll flips");
    previous = q;
  }
  assert.deepEqual(cameraPoseAt(start, goal, 1, true), goal);
});
test("half stick displacement produces half orbit speed and retains the full speed", () => {
  for (const strength of [0.25, 0.5, 1]) {
    const p = orbitPosition(
      start.position,
      start.target,
      start.up,
      [strength, 0],
      1,
    );
    assert.ok(Math.abs(Math.atan2(p.x, p.z) - 0.8 * strength) < 1e-10);
    assert.ok(Math.abs(p.length() - 200) < 1e-10);
  }
});
