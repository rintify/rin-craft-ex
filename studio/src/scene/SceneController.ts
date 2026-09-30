import { createWorkGrid } from "./workGrid";
import { StudioStage } from "./StudioStage";
import { SceneMotion } from "./SceneMotion";
import { meshEdges, smoothEdges } from "../core/surfaces";
import { worldVertices } from "../core/geometry";
import { anchorPosition, anchorCenter } from "../state/workspace";
import { cameraPoseAt, CAMERA_DURATION, type CameraPose } from "./cameraMotion";
import { orbitPosition, zoomFactor } from "./navigation";
import type { Primitive, Vec2 } from "../core/types";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  clone,
  geometry,
  edgeKey,
  faceCenter,
  normal,
  v3,
  type CraftObject,
  type Vec3,
} from "../core/model";
import { type EditorStore, type EditorState } from "../state/editor";
interface RenderObject {
  group: THREE.Group;
  mesh: THREE.Mesh;
  source: CraftObject;
}
/** Owns only GPU resources and pointer interactions; document edits go through the store. */
export class SceneController {
  private renderer: THREE.WebGLRenderer;
  private stage: StudioStage;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private transform: TransformControls;
  private grid: THREE.GridHelper;
  private objects = new Map<string, RenderObject>();
  private proxy = new THREE.Object3D();
  private observer: ResizeObserver;
  private frame = 0;
  private previousTime = performance.now();
  private cameraMotion: {
    from: CameraPose;
    to: CameraPose;
    start: number;
    fixed: boolean;
  } | null = null;
  private gridTarget = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    opacity: 1,
  };
  private gridOpacity = 1;
  private unsubscribe: () => void;
  private lastProject: EditorState["project"] | null = null;
  private lastSelection = "";
  private dragSource: CraftObject | null = null;
  private pointerStart = { x: 0, y: 0 };
  private wasDragging = false;
  private disposed = false;
  private pointers = new Set<number>();
  private anchorGroup = new THREE.Group();
  private motion = new SceneMotion();
  constructor(
    private host: HTMLDivElement,
    private readonly editor: EditorStore,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.stage = new StudioStage(this.scene, this.renderer);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "3D モデル作業面");
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 50000);
    this.camera.position.set(0, 80, 200);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 24, 0);
    this.configureOrbit();
    this.orbit.dampingFactor = 0.12;
    this.orbit.minDistance = 5;
    this.orbit.maxDistance = 20000;
    this.grid = createWorkGrid();
    this.grid.position.y = -0.08;
    this.scene.add(this.grid);
    const axes = new THREE.AxesHelper(65);
    axes.position.y = 0.05;
    (axes.material as THREE.LineBasicMaterial).transparent = true;
    (axes.material as THREE.LineBasicMaterial).opacity = 0.42;
    this.grid.add(axes);
    this.scene.add(this.proxy, this.anchorGroup);
    this.transform = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.transform.setSize(0.85);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value;
    });
    this.transform.addEventListener("mouseDown", () => {
      this.wasDragging = true;
      const source = this.editor.selectedObject();
      this.dragSource = source ? clone(source) : null;
    });
    this.transform.addEventListener("objectChange", () =>
      this.previewTransform(),
    );
    this.transform.addEventListener("mouseUp", () => this.commitTransform());
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.cancelCameraMotion,
      true,
    );
    this.renderer.domElement.addEventListener(
      "wheel",
      this.cancelCameraMotion,
      { capture: true, passive: true },
    );
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener(
      "pointercancel",
      this.onPointerCancel,
    );
    this.renderer.domElement.addEventListener(
      "contextmenu",
      this.preventContext,
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.unsubscribe = this.editor.subscribe(() => this.sync());
    this.sync();
    this.resize();
    if (editor.getSnapshot().project.objects.length) this.focus("home", true);
    this.animate();
  }
  private preventContext = (e: Event) => e.preventDefault();
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (this.host.clientWidth && this.host.clientHeight) {
      const now = performance.now(),
        dt = Math.min(0.1, (now - this.previousTime) / 1000);
      this.previousTime = now;
      if (this.cameraMotion) {
        const motion = this.cameraMotion,
          progress = (now - motion.start) / CAMERA_DURATION;
        const pose = cameraPoseAt(
          motion.from,
          motion.to,
          progress,
          motion.fixed,
        );
        this.camera.position.copy(pose.position);
        this.camera.up.copy(pose.up);
        this.orbit.target.copy(pose.target);
        this.camera.lookAt(pose.target);
        if (progress >= 1) {
          this.cameraMotion = null;
          this.resetOrbit();
        }
      } else this.orbit.update();
      const alpha = 1 - Math.exp(-dt / 0.085);
      this.grid.position.lerp(this.gridTarget.position, alpha);
      this.grid.quaternion.slerp(this.gridTarget.quaternion, alpha);
      this.gridOpacity += (this.gridTarget.opacity - this.gridOpacity) * alpha;
      this.grid.visible = this.gridOpacity > 0.002;
      this.grid.traverse((object) => {
        const material = (object as THREE.Line).material;
        if (material)
          (Array.isArray(material) ? material : [material]).forEach((m) => {
            m.transparent = true;
            m.opacity = this.gridOpacity * (object === this.grid ? 0.48 : 0.38);
          });
      });
      this.motion.update(now);
      this.stage.update(dt);
      this.renderer.render(this.scene, this.camera);
    }
  };
  private disposeGroup(group: THREE.Group) {
    group.traverse((obj) => {
      const item = obj as THREE.Mesh;
      if (item.geometry) item.geometry.dispose();
      if (item.material)
        (Array.isArray(item.material)
          ? item.material
          : [item.material]
        ).forEach((m) => m.dispose());
    });
    this.scene.remove(group);
  }
  private rebuild(state: EditorState) {
    this.transform.detach();
    this.motion.begin();
    const previous = new Map(this.objects);
    this.objects.clear();
    const oldAnchors = this.anchorGroup;
    this.anchorGroup = new THREE.Group();
    this.scene.add(this.anchorGroup);
    const anchorGeometry = new THREE.BufferGeometry().setFromPoints(
      state.anchors
        .map((a) => anchorPosition(a, state.project))
        .filter((p): p is Vec3 => !!p)
        .map(v3),
    );
    this.anchorGroup.add(
      new THREE.Points(
        anchorGeometry,
        new THREE.PointsMaterial({
          color: 0xbd3699,
          size: 11,
          sizeAttenuation: false,
          depthTest: false,
        }),
      ),
    );
    this.anchorGroup.renderOrder = 10;
    this.motion.fade(oldAnchors, false, () => this.disposeGroup(oldAnchors));
    this.motion.fade(this.anchorGroup, true);
    for (const source of state.project.objects) {
      if (!source.visible) continue;
      const selected =
          state.selection?.objectId === source.id ||
          state.anchors.some(
            (a) => "objectId" in a && a.objectId === source.id,
          ),
        group = new THREE.Group();
      group.position.fromArray(source.position);
      group.rotation.set(
        ...(source.rotation.map((d) => THREE.MathUtils.degToRad(d)) as Vec3),
      );
      group.scale.fromArray(source.scale);
      const geo = geometry(source),
        material = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          roughness: 0.9,
          metalness: 0,
          side: THREE.DoubleSide,
          flatShading: true,
        });
      const mesh: THREE.Mesh<
        THREE.BufferGeometry,
        THREE.Material | THREE.Material[]
      > = new THREE.Mesh(geo, material);
      mesh.userData.objectId = source.id;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      material.vertexColors = true;
      const colors = (geo.userData.faceMap as number[]).flatMap((fi) => {
        const color = new THREE.Color(
          selected && state.mode === "face" && state.selection?.face === fi
            ? "#f4cbb6"
            : "#ffffff",
        );
        return [...color.toArray(), ...color.toArray(), ...color.toArray()];
      });
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      group.add(mesh);
      this.addEdges(group, source, state, selected);
      if (state.mode === "point" || (selected && state.mode === "vertex")) {
        const positions = source.vertices.flat(),
          colors = source.vertices.flatMap((_, i) =>
            new THREE.Color(
              i === state.selection?.vertex ? "#c94d35" : "#777164",
            ).toArray(),
          );
        const pointGeo = new THREE.BufferGeometry();
        pointGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        pointGeo.setAttribute(
          "color",
          new THREE.Float32BufferAttribute(colors, 3),
        );
        const points = new THREE.Points(
          pointGeo,
          new THREE.PointsMaterial({
            size: state.mode === "point" ? 3 : 7,
            sizeAttenuation: false,
            vertexColors: true,
            depthTest: true,
          }),
        );
        points.renderOrder = 5;
        group.add(points);
      }
      this.scene.add(group);
      const old = previous.get(source.id);
      this.motion.group(group, old?.group);
      if (old) {
        this.disposeGroup(old.group);
        previous.delete(source.id);
      }
      this.objects.set(source.id, { group, mesh, source });
    }
    const stageBounds = new THREE.Box3();
    for (const source of state.project.objects.filter((o) => o.visible))
      for (const vertex of worldVertices(source))
        stageBounds.expandByPoint(v3(vertex));
    this.stage.fit(stageBounds);
    for (const { group } of previous.values())
      this.motion.fade(group, false, () => this.disposeGroup(group));
  }
  private addEdges(
    group: THREE.Group,
    source: CraftObject,
    state: EditorState,
    selected: boolean,
  ) {
    const seen = new Set<string>(),
      regular: number[] = [],
      seams: number[] = [];
    const smooth = smoothEdges(
      worldVertices(source),
      source.faces,
      state.settings.microEdgeLength,
      meshEdges(source.faces),
    );
    const adjacent = new Map<string, number[]>();
    source.faces.forEach((face, fi) =>
      face.forEach((a, i) => {
        const k = edgeKey(a, face[(i + 1) % face.length]);
        adjacent.set(k, [...(adjacent.get(k) ?? []), fi]);
      }),
    );
    for (const f of source.faces)
      f.forEach((a, i) => {
        const b = f[(i + 1) % f.length],
          key = edgeKey(a, b);
        if (seen.has(key)) return;
        seen.add(key);
        const pair = adjacent.get(key)!;
        if (
          pair.length === 2 &&
          (smooth.has(key) ||
            (state.mode !== "seam" &&
              normal(source.vertices, source.faces[pair[0]]).dot(
                normal(source.vertices, source.faces[pair[1]]),
              ) >
                1 - 1e-7)) &&
          !state.project.seams.includes(`${source.id}:${key}`)
        )
          return;
        const target = state.project.seams.includes(`${source.id}:${key}`)
          ? seams
          : regular;
        target.push(...source.vertices[a], ...source.vertices[b]);
      });
    for (const [positions, color] of [
      [regular, selected ? "#b77c63" : "#949084"],
      [seams, "#e48945"],
    ] as [number[], string][]) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const line = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color, depthTest: true }),
      );
      line.renderOrder = 2;
      group.add(line);
    }
  }
  private sync() {
    if (this.transform.dragging) return;
    const state = this.editor.getSnapshot(),
      selectionKey = JSON.stringify([
        state.selection,
        state.mode,
        state.anchors,
      ]);
    if (
      this.lastProject !== state.project ||
      this.lastSelection !== selectionKey
    ) {
      this.rebuild(state);
      this.lastProject = state.project;
      this.lastSelection = selectionKey;
    }
    this.gridTarget.opacity = state.grid ? 1 : 0;
    this.gridTarget.position.fromArray(state.basis.origin);
    this.gridTarget.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        v3(state.basis.x),
        v3(state.basis.z),
        v3(state.basis.y).negate(),
      ),
    );
    this.transform.setTranslationSnap(state.snap ? 5 : null);
    this.transform.setRotationSnap(state.snap ? Math.PI / 12 : null);
    this.transform.setScaleSnap(state.snap ? 0.1 : null);
    const rendered =
      state.selection && this.objects.get(state.selection.objectId);
    this.transform.detach();
    if (
      rendered &&
      state.tool !== "select" &&
      state.mode !== "seam" &&
      state.mode !== "point"
    ) {
      this.transform.setMode(state.tool);
      if (state.mode === "object") this.transform.attach(rendered.group);
      else {
        let local: THREE.Vector3 | undefined;
        if (state.mode === "vertex" && state.selection?.vertex !== undefined)
          local = v3(rendered.source.vertices[state.selection.vertex]);
        if (state.mode === "face" && state.selection?.face !== undefined)
          local = faceCenter(
            rendered.source.vertices,
            rendered.source.faces[state.selection.face],
          );
        if (local) {
          rendered.group.updateMatrixWorld(true);
          this.proxy.position.copy(rendered.group.localToWorld(local));
          this.proxy.rotation.set(0, 0, 0);
          this.proxy.scale.set(1, 1, 1);
          this.transform.setMode("translate");
          this.transform.attach(this.proxy);
        }
      }
    }
  }
  private editedVertices(): Vec3[] | null {
    const state = this.editor.getSnapshot(),
      source = this.dragSource;
    if (!source) return null;
    const rendered = this.objects.get(source.id);
    if (!rendered) return null;
    const selected = state.selection;
    let indices: number[] = [],
      origin: THREE.Vector3;
    if (selected?.vertex !== undefined) {
      indices = [selected.vertex];
      origin = v3(source.vertices[selected.vertex]);
    } else if (selected?.face !== undefined) {
      indices = source.faces[selected.face];
      origin = faceCenter(source.vertices, indices);
    } else return null;
    rendered.group.updateMatrixWorld(true);
    const delta = rendered.group
      .worldToLocal(this.proxy.position.clone())
      .sub(origin);
    return source.vertices.map((p, i) =>
      indices.includes(i) ? (v3(p).add(delta).toArray() as Vec3) : p,
    );
  }
  private previewTransform() {
    const state = this.editor.getSnapshot();
    if (state.mode === "object" || !this.dragSource) return;
    const vertices = this.editedVertices(),
      rendered = this.objects.get(this.dragSource.id);
    if (vertices && rendered) {
      rendered.mesh.geometry.dispose();
      rendered.mesh.geometry = geometry({ ...this.dragSource, vertices });
    }
  }
  private commitTransform() {
    const source = this.dragSource;
    if (!source) return;
    const state = this.editor.getSnapshot(),
      rendered = this.objects.get(source.id);
    this.dragSource = null;
    if (rendered && state.mode === "object") {
      const { position, rotation, scale } = rendered.group;
      this.editor.transform(
        source.id,
        position.toArray() as Vec3,
        [rotation.x, rotation.y, rotation.z].map(
          THREE.MathUtils.radToDeg,
        ) as Vec3,
        scale.toArray() as Vec3,
      );
    } else {
      this.dragSource = source;
      const vertices = this.editedVertices();
      this.dragSource = null;
      if (vertices) this.editor.moveVertices(source.id, vertices);
    }
    // TransformControls emits mouseUp before it resets dragging.
    queueMicrotask(() => {
      this.lastProject = null;
      this.sync();
    });
  }
  private onPointerDown = (e: PointerEvent) => {
    if (!this.pointers.size) {
      this.pointerStart = { x: e.clientX, y: e.clientY };
      this.wasDragging = !!this.transform.axis;
    }
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) this.wasDragging = true;
  };
  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (
      e.button !== 0 ||
      this.wasDragging ||
      Math.hypot(
        e.clientX - this.pointerStart.x,
        e.clientY - this.pointerStart.y,
      ) > 5
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect(),
      pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    const state = this.editor.getSnapshot();
    if (state.mode === "point") {
      let closest: { objectId: string; vertex: number } | undefined,
        distance = 24,
        depth = Infinity;
      for (const { source, group } of this.objects.values()) {
        group.updateMatrixWorld(true);
        source.vertices.forEach((p, vertex) => {
          const world = group.localToWorld(v3(p)),
            projected = world.clone().project(this.camera);
          if (projected.z < -1 || projected.z > 1) return;
          const d = Math.hypot(
            ((projected.x + 1) * rect.width) / 2 + rect.left - e.clientX,
            ((-projected.y + 1) * rect.height) / 2 + rect.top - e.clientY,
          );
          const z = world.distanceTo(this.camera.position);
          if (d < distance - 1 || (d <= distance + 1 && z < depth)) {
            closest = { objectId: source.id, vertex };
            distance = d;
            depth = z;
          }
        });
      }
      if (closest) this.editor.addAnchor(closest);
      else {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          v3(state.basis.z),
          v3(state.basis.origin),
        );
        const point = ray.ray.intersectPlane(plane, new THREE.Vector3());
        if (point) this.editor.addAnchor({ position: point.toArray() as Vec3 });
      }
      return;
    }
    const hit = ray.intersectObjects(
      [...this.objects.values()].map((o) => o.mesh),
    )[0];
    if (!hit) {
      this.editor.select(null);
      return;
    }
    const id = hit.object.userData.objectId,
      rendered = this.objects.get(id)!,
      fi = (rendered.mesh.geometry.userData.faceMap as number[])[
        hit.faceIndex!
      ];
    if (state.mode === "object") {
      this.editor.select({ objectId: id });
      return;
    }
    if (state.mode === "face") {
      this.editor.select({ objectId: id, face: fi });
      return;
    }
    const screen = (i: number) => {
        const p = rendered.group
          .localToWorld(v3(rendered.source.vertices[i]))
          .project(this.camera);
        return new THREE.Vector2(
          ((p.x + 1) * rect.width) / 2 + rect.left,
          ((-p.y + 1) * rect.height) / 2 + rect.top,
        );
      },
      click = new THREE.Vector2(e.clientX, e.clientY);
    if (state.mode === "vertex") {
      let closest = -1,
        distance = 24;
      rendered.source.vertices.forEach((_, i) => {
        const d = screen(i).distanceTo(click);
        if (d < distance) {
          distance = d;
          closest = i;
        }
      });
      this.editor.select(
        closest < 0 ? { objectId: id } : { objectId: id, vertex: closest },
      );
      return;
    }
    const face = rendered.source.faces[fi];
    let closest = "",
      distance = 22;
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length],
        p = screen(a),
        q = screen(b),
        ab = q.clone().sub(p),
        t = THREE.MathUtils.clamp(
          click.clone().sub(p).dot(ab) / ab.lengthSq(),
          0,
          1,
        ),
        d = p.addScaledVector(ab, t).distanceTo(click);
      if (d < distance) {
        distance = d;
        closest = `${id}:${edgeKey(a, b)}`;
      }
    });
    if (closest) this.editor.toggleSeam(closest);
    else this.editor.notify("切り開きたい辺の近くをクリックしてください");
  };
  private onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.wasDragging = true;
  };
  focus(view: "home" | "front" | "top" | "right" = "home", all = false) {
    const desiredUp = new THREE.Vector3(0, 1, 0);
    const selected = this.editor.selectedObject(),
      group = selected && this.objects.get(selected.id)?.group,
      box = new THREE.Box3();
    if (group && !all) box.setFromObject(group);
    else
      for (const { group } of this.objects.values()) box.expandByObject(group);
    const center = box.isEmpty()
        ? new THREE.Vector3()
        : box.getCenter(new THREE.Vector3()),
      size = box.isEmpty()
        ? new THREE.Vector3(50, 50, 50)
        : box.getSize(new THREE.Vector3());
    const directions = {
      home: new THREE.Vector3(0.8, 0.5, 1.65),
      front: new THREE.Vector3(0, 0, 1),
      top: new THREE.Vector3(0, 1, 0.001),
      right: new THREE.Vector3(1, 0, 0),
    };
    const direction = directions[view].normalize();
    const right = new THREE.Vector3()
      .crossVectors(desiredUp, direction)
      .normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)),
      tanH = tanV * this.camera.aspect;
    let distance = 30;
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) {
          const corner = new THREE.Vector3(size.x * x, size.y * y, size.z * z),
            depth = corner.dot(direction);
          distance = Math.max(
            distance,
            Math.abs(corner.dot(right)) / tanH + depth,
            Math.abs(corner.dot(up)) / tanV + depth,
          );
        }
    this.moveCamera({
      target: center,
      position: center.clone().add(direction.multiplyScalar(distance * 1.18)),
      up: desiredUp,
    });
  }
  private configureOrbit() {
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.minDistance = 0.1;
    this.orbit.maxDistance = 20000;
  }
  private resetOrbit() {
    const target = this.orbit.target.clone(),
      position = this.camera.position.clone(),
      orientation = this.camera.quaternion.clone();
    this.orbit.dispose();
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.copy(target);
    this.configureOrbit();
    this.camera.position.copy(position);
    this.camera.quaternion.copy(orientation);
  }
  private moveCamera(to: CameraPose, fixed = false) {
    this.cancelCameraMotion();
    this.cameraMotion = {
      from: {
        position: this.camera.position.clone(),
        target: this.orbit.target.clone(),
        up: this.camera.up.clone(),
      },
      to,
      start: performance.now(),
      fixed,
    };
    this.orbit.enabled = false;
  }
  private cancelCameraMotion = () => {
    if (!this.cameraMotion) return;
    this.cameraMotion = null;
    this.resetOrbit();
  };
  look() {
    const state = this.editor.getSnapshot();
    const target = anchorCenter(
      state.anchors,
      state.project,
      state.basis.origin,
    );
    this.moveCamera(
      {
        position: this.camera.position.clone(),
        target: v3(target),
        up: v3(state.basis.z),
      },
      true,
    );
  }
  orbitStep(direction: Vec2, seconds: number) {
    this.cancelCameraMotion();
    this.camera.position.copy(
      orbitPosition(
        this.camera.position,
        this.orbit.target,
        this.camera.up,
        direction,
        seconds,
      ),
    );
    this.camera.lookAt(this.orbit.target);
    this.orbit.update();
  }
  zoomStep(direction: number, seconds: number) {
    this.zoom(zoomFactor(direction, seconds));
  }
  add(kind: Primitive) {
    const position = this.camera
      .getWorldDirection(new THREE.Vector3())
      .multiplyScalar(100)
      .add(this.camera.position)
      .toArray() as Vec3;
    this.editor.add(kind, position);
  }
  zoom(factor: number) {
    this.cancelCameraMotion();
    this.camera.position
      .sub(this.orbit.target)
      .multiplyScalar(factor)
      .add(this.orbit.target);
    this.orbit.update();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.unsubscribe();
    this.observer.disconnect();
    this.motion.dispose();
    this.transform.dispose();
    this.orbit.dispose();
    for (const { group } of this.objects.values()) this.disposeGroup(group);
    this.disposeGroup(this.anchorGroup);
    this.grid.traverse((object) => {
      const line = object as THREE.Line;
      line.geometry?.dispose();
      if (line.material)
        (Array.isArray(line.material)
          ? line.material
          : [line.material]
        ).forEach((m) => m.dispose());
    });
    this.stage.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
