import { MathUtils, Quaternion, Vector3 } from "three";
import type { Vec2 } from "../core/types";
export const ORBIT_RADIANS_PER_SECOND = 0.8;
export const zoomFactor = (direction: number, seconds: number) =>
  2 ** (-MathUtils.clamp(direction, -1, 1) * seconds);
/** Analog deflection controls speed; full input retains the reference maximum. */
export function orbitPosition(
  position: Vector3,
  center: Vector3,
  up: Vector3,
  direction: Vec2,
  seconds: number,
) {
  const length = Math.hypot(...direction);
  if (length < 1e-8) return position.clone();
  const offset = position.clone().sub(center);
  offset.applyQuaternion(
    new Quaternion().setFromAxisAngle(
      up,
      (direction[0] / Math.max(1, length)) * ORBIT_RADIANS_PER_SECOND * seconds,
    ),
  );
  const latitude = Math.asin(
    MathUtils.clamp(offset.clone().normalize().dot(up), -1, 1),
  );
  const target = MathUtils.clamp(
    latitude +
      (direction[1] / Math.max(1, length)) * ORBIT_RADIANS_PER_SECOND * seconds,
    -Math.PI / 2 + 0.01,
    Math.PI / 2 - 0.01,
  );
  const axis = new Vector3().crossVectors(offset, up).normalize();
  offset.applyQuaternion(
    new Quaternion().setFromAxisAngle(axis, target - latitude),
  );
  return center.clone().add(offset);
}
