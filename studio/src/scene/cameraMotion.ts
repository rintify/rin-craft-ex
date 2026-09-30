import { MathUtils, Matrix4, Quaternion, Vector3 } from "three";
export interface CameraPose {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}
export const CAMERA_DURATION = 560;
export const smoothStep = (t: number) => {
  const x = MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** Rotate the viewing frame along an arc; never fly through the model's center.
 * At every intermediate frame the target and up agree with OrbitControls, so
 * interruption can transfer control without a jump (including pole views).
 */
export function cameraPoseAt(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  fixedPosition = false,
): CameraPose {
  const t = smoothStep(progress);
  if (t === 0)
    return {
      position: from.position.clone(),
      target: from.target.clone(),
      up: from.up.clone(),
    };
  if (t === 1)
    return {
      position: to.position.clone(),
      target: to.target.clone(),
      up: to.up.clone(),
    };
  const a = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(from.position, from.target, from.up),
  );
  const b = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(to.position, to.target, to.up),
  );
  const orientation = a.slerp(b, t);
  const up = new Vector3(0, 1, 0).applyQuaternion(orientation);
  const distance = Math.exp(
    MathUtils.lerp(
      Math.log(Math.max(0.1, from.position.distanceTo(from.target))),
      Math.log(Math.max(0.1, to.position.distanceTo(to.target))),
      t,
    ),
  );
  const offset = new Vector3(0, 0, distance).applyQuaternion(orientation);
  const target = from.target.clone().lerp(to.target, t);
  const position = fixedPosition
    ? from.position.clone()
    : target.clone().add(offset);
  // For "look", preserve the eye position and rotate the target along the same arc.
  if (fixedPosition) target.copy(position).sub(offset);
  return { position, target, up };
}
