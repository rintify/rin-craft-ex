import { BufferAttribute, Color, Group, Material, Mesh } from "three";
import { smoothStep } from "./cameraMotion";

/** Short GPU transitions are separate from document geometry and Undo history. */
export class SceneMotion {
  private tracks: ((t: number) => void)[] = [];
  private cleanup: (() => void)[] = [];
  private started = 0;
  begin() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.tracks = [];
    this.started = performance.now();
  }
  update(now: number) {
    const t = smoothStep((now - this.started) / 220);
    this.tracks.forEach((f) => f(t));
    if (t === 1) {
      this.tracks = [];
      this.cleanup.forEach((f) => f());
      this.cleanup = [];
    }
  }
  dispose() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.tracks = [];
  }
  attribute(next: BufferAttribute, previous?: BufferAttribute) {
    if (!previous || previous.count !== next.count) return;
    const from = Array.from(previous.array),
      to = Array.from(next.array);
    if (to.every((n, i) => n === from[i])) return;
    const step = (t: number) => {
      for (let i = 0; i < to.length; i++)
        next.array[i] = from[i] + (to[i] - from[i]) * t;
      next.needsUpdate = true;
    };
    step(0);
    this.tracks.push(step);
  }
  group(next: Group, previous?: Group) {
    if (!previous) {
      this.fade(next, true);
      return;
    }
    const position = next.position.clone(),
      rotation = next.quaternion.clone(),
      scale = next.scale.clone();
    const start = {
      position: previous.position.clone(),
      rotation: previous.quaternion.clone(),
      scale: previous.scale.clone(),
    };
    const step = (t: number) => {
      next.position.lerpVectors(start.position, position, t);
      next.quaternion.slerpQuaternions(start.rotation, rotation, t);
      next.scale.lerpVectors(start.scale, scale, t);
    };
    step(0);
    this.tracks.push(step);
    next.children.forEach((item, i) => {
      const a = item as Mesh,
        b = previous.children[i] as Mesh | undefined;
      if (b?.type !== a.type) return;
      if (a.geometry && b.geometry) {
        for (const key of ["position", "color"]) {
          const attr = a.geometry.getAttribute(key),
            old = b.geometry.getAttribute(key);
          if (attr && old)
            this.attribute(attr as BufferAttribute, old as BufferAttribute);
        }
      }
      const material = a.material as Material & { color?: Color },
        old = b.material as Material & { color?: Color };
      if (material?.color && old?.color) {
        const from = old.color.clone(),
          to = material.color.clone();
        material.color.copy(from);
        this.tracks.push((t) => material.color!.lerpColors(from, to, t));
      }
    });
  }
  fade(group: Group, entering: boolean, done?: () => void) {
    group.traverse((item) => {
      const material = (item as Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        const opacity = m.opacity,
          transparent = m.transparent,
          depthWrite = m.depthWrite;
        m.transparent = true;
        m.depthWrite = false;
        const step = (t: number) => {
          m.opacity = opacity * (entering ? t : 1 - t);
        };
        step(0);
        this.tracks.push(step);
        this.cleanup.push(() => {
          m.opacity = opacity;
          m.transparent = transparent;
          m.depthWrite = depthWrite;
        });
      }
    });
    if (done) this.cleanup.push(done);
  }
}
