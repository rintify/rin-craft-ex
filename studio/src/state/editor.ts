import {
  initialBasis,
  anchorPosition,
  type Anchor,
  type Basis,
} from "./workspace";
import { applyCommands, type CraftBatch } from "../core/commands";
import { History } from "../core/history";
import {
  clone,
  initialProject,
  primitive,
  validateProject,
  extrudeFace,
  insetFace,
  triangulateNonPlanar,
  triangles,
  uid,
  type CraftObject,
  type Primitive,
  type Project,
  type Vec3,
} from "../core/model";
import { defaultSettings, type NetSettings } from "../core/unfold";
export type Selection = {
  objectId: string;
  vertex?: number;
  face?: number;
} | null;
export type EditMode = "point" | "object" | "vertex" | "face" | "seam";
export type Tool = "select" | "translate" | "rotate" | "scale";
export interface EditorState {
  project: Project;
  selection: Selection;
  mode: EditMode;
  tool: Tool;
  view: "model" | "net";
  anchors: Anchor[];
  basis: Basis;
  grid: boolean;
  snap: boolean;
  settings: NetSettings;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string;
  redoLabel: string;
  revision: number;
  toast: string;
  storageAvailable: boolean;
}
export class EditorStore {
  private history: History<Project>;
  private listeners = new Set<() => void>();
  private state: EditorState;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    project = initialProject(),
    private readonly save: (project: Project) => boolean = () => true,
  ) {
    project = validateProject(project);
    this.history = new History(project);
    this.state = {
      project,
      selection: project.objects[0]
        ? { objectId: project.objects[0].id }
        : null,
      mode: "point",
      tool: "select",
      view: "model",
      anchors: [],
      basis: initialBasis(),
      grid: true,
      snap: false,
      settings: project.settings ?? defaultSettings,
      canUndo: false,
      canRedo: false,
      undoLabel: "",
      redoLabel: "",
      revision: 0,
      toast: "",
      storageAvailable: this.save(project),
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<EditorState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  private syncHistory() {
    const project = this.history.current;
    let selection = this.state.selection;
    const o = project.objects.find((o) => o.id === selection?.objectId);
    if (!o) selection = null;
    else if (
      (selection?.vertex ?? 0) >= o.vertices.length ||
      (selection?.face ?? 0) >= o.faces.length
    )
      selection = { objectId: o.id };
    this.emit({
      project,
      anchors: this.state.anchors.filter((a) => !!anchorPosition(a, project)),
      selection,
      settings: project.settings ?? defaultSettings,
      storageAvailable: this.save(project),
      revision: this.state.revision + 1,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      undoLabel: this.history.undoLabel,
      redoLabel: this.history.redoLabel,
    });
  }
  edit(label: string, update: (draft: Project) => void) {
    let draft = clone(this.history.current);
    try {
      update(draft);
      draft = validateProject(draft);
    } catch (error) {
      this.notify(
        error instanceof Error ? error.message : "編集を適用できませんでした",
      );
      return false;
    }
    if (this.history.commit(draft, label)) {
      this.syncHistory();
      return true;
    }
    return false;
  }
  applyBatch(batch: CraftBatch) {
    const next = applyCommands(this.state.project, batch);
    return this.edit(batch.label, (p) => Object.assign(p, next));
  }
  addAnchor(anchor: Anchor) {
    if (!anchorPosition(anchor, this.state.project)) return;
    this.emit({
      anchors: [...this.state.anchors, anchor],
      selection:
        "objectId" in anchor
          ? { objectId: anchor.objectId, vertex: anchor.vertex }
          : this.state.selection,
    });
  }
  clearSelection() {
    this.emit({ anchors: [], selection: null });
  }
  moveBasis() {
    const first = this.state.anchors[0];
    const origin = first && anchorPosition(first, this.state.project);
    if (origin) this.emit({ basis: { ...this.state.basis, origin } });
  }
  rotateBasis() {
    const { x, y, z } = this.state.basis;
    this.emit({ basis: { ...this.state.basis, x: z, y: x, z: y } });
  }
  select(selection: Selection) {
    this.emit({ selection });
  }
  setMode(mode: EditMode) {
    this.emit({
      mode,
      tool: "select",
      selection: this.state.selection
        ? { objectId: this.state.selection.objectId }
        : null,
    });
  }
  setTool(tool: Tool) {
    this.emit({
      tool:
        this.state.mode === "vertex" || this.state.mode === "face"
          ? tool === "select"
            ? "select"
            : "translate"
          : tool,
    });
  }
  setView(view: EditorState["view"]) {
    this.emit({ view });
  }
  setGrid(grid: boolean) {
    this.emit({ grid });
  }
  setSnap(snap: boolean) {
    this.emit({ snap });
  }
  setSettings(patch: Partial<NetSettings>) {
    this.edit("展開設定を変更", (p) => {
      p.settings = { ...this.state.settings, ...patch };
    });
  }
  undo() {
    if (this.history.undo()) {
      this.syncHistory();
      this.notify("操作を元に戻しました");
    }
  }
  redo() {
    if (this.history.redo()) {
      this.syncHistory();
      this.notify("操作をやり直しました");
    }
  }
  notify(toast: string) {
    clearTimeout(this.toastTimer);
    this.emit({ toast });
    this.toastTimer = setTimeout(() => this.emit({ toast: "" }), 3500);
  }
  add(kind: Primitive, position: Vec3 = this.state.basis.origin) {
    if (this.state.project.objects.length >= 40) {
      this.notify("オブジェクトは40個まで追加できます");
      return;
    }
    const object = primitive(
      kind,
      this.state.project.objects.filter((o) =>
        o.name.startsWith(primitiveNames[kind]),
      ).length + 1,
    );
    object.position = [...position];
    if (!this.edit("形状を追加", (p) => p.objects.push(object))) return;
    this.emit({
      selection: { objectId: object.id },
      tool: "select",
    });
  }
  updateObject(
    id: string,
    label: string,
    update: (object: CraftObject) => void,
  ) {
    this.edit(label, (p) => {
      const o = p.objects.find((o) => o.id === id);
      if (o) update(o);
    });
  }
  duplicate() {
    const selected = this.selectedObject();
    if (!selected) return;
    const object = clone(selected);
    object.id = uid();
    object.name += " コピー";
    object.position[0] += 55;
    if (!this.edit("オブジェクトを複製", (p) => p.objects.push(object))) return;
    this.select({ objectId: object.id });
  }
  remove() {
    const ids = new Set(
      this.state.mode === "point"
        ? this.state.anchors.flatMap((a) =>
            "objectId" in a ? [a.objectId] : [],
          )
        : this.state.selection
          ? [this.state.selection.objectId]
          : [],
    );
    if (!ids.size) return;
    this.edit("オブジェクトを削除", (p) => {
      p.objects = p.objects.filter((o) => !ids.has(o.id));
      p.seams = p.seams.filter(
        (s) => ![...ids].some((id) => s.startsWith(id + ":")),
      );
    });
    this.clearSelection();
  }

  selectedObject() {
    return this.state.project.objects.find(
      (o) => o.id === this.state.selection?.objectId,
    );
  }
  transform(id: string, position: Vec3, rotation: Vec3, scale: Vec3) {
    this.updateObject(id, "オブジェクトを変形", (o) => {
      o.position = position;
      o.rotation = rotation;
      o.scale = scale.map((v) =>
        Math.max(0.01, Math.min(1000, Math.abs(v))),
      ) as Vec3;
    });
  }
  moveVertices(id: string, vertices: Vec3[]) {
    this.updateObject(id, "頂点を移動", (o) => {
      o.vertices = vertices;
      triangulateNonPlanar(o);
    });
  }
  extrude(distance: number) {
    const { selection } = this.state;
    if (selection?.face === undefined) return;
    this.updateObject(selection.objectId, "面を押し出し", (o) =>
      extrudeFace(o, selection.face!, distance),
    );
  }
  inset(amount: number) {
    const { selection } = this.state;
    if (selection?.face === undefined) return;
    this.updateObject(selection.objectId, "面を差し込み", (o) =>
      insetFace(o, selection.face!, amount),
    );
  }
  triangulate() {
    const { selection } = this.state;
    if (selection?.face === undefined) return;
    this.updateObject(selection.objectId, "面を三角分割", (o) => {
      const fi = selection.face!,
        parts = triangles(o.vertices, o.faces[fi]);
      o.faces.splice(fi, 1, ...parts);
    });
    this.select({ objectId: selection.objectId });
  }
  mirror(axis: number) {
    const o = this.selectedObject();
    if (!o) return;
    this.updateObject(o.id, "オブジェクトを反転", (o) => {
      o.vertices.forEach((p) => {
        p[axis] *= -1;
      });
      o.faces.forEach((f) => f.reverse());
    });
  }
  toggleSeam(key: string) {
    this.edit("切り開き線を変更", (p) => {
      p.seams = p.seams.includes(key)
        ? p.seams.filter((s) => s !== key)
        : [...p.seams, key];
    });
  }
  replace(project: Project) {
    this.edit("プロジェクトを読み込み", (p) =>
      Object.assign(p, validateProject(project)),
    );
    this.emit({
      selection: project.objects[0]
        ? { objectId: project.objects[0].id }
        : null,
      tool: "select",
      mode: "point",
      anchors: [],
      basis: initialBasis(),
    });
  }
  newProject() {
    this.replace({ version: 1, name: "名称未設定", objects: [], seams: [] });
    this.notify("新しいプロジェクトを作成しました。Undoで戻せます");
  }
}
export const primitiveNames: Record<Primitive, string> = {
  box: "立方体",
  house: "小さな家",
  cylinder: "円柱",
  cone: "円すい",
  sphere: "多面球",
  pyramid: "四角すい",
};
