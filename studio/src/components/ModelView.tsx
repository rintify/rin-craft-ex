import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Focus,
  X,
  Scan,
  MoreHorizontal,
  Move,
  RotateCcw,
  Scaling,
  MousePointer2,
  Trash2,
} from "lucide-react";
import { SceneController } from "../scene/SceneController";
import { editor } from "../state/store";
import { useEditor } from "../hooks/useEditor";
import { Dialog, IconButton, Toggle, Select, Presence, Morph } from "./ui";
import { NavigationStick } from "./NavigationStick";
import { primitiveNames, type EditMode, type Tool } from "../state/editor";
import { ShapeGlyph } from "./ShapeGlyph";
import { FoldMark } from "./Brand";
import type { Primitive } from "../core/types";
const modes: { id: EditMode; label: string }[] = [
  { id: "point", label: "点を選ぶ" },
  { id: "object", label: "形を編集" },
  { id: "vertex", label: "頂点を編集" },
  { id: "face", label: "面を編集" },
  { id: "seam", label: "切り開き線" },
];
export function ModelView() {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<SceneController | null>(null),
    state = useEditor();
  const [error, setError] = useState(""),
    [sheet, setSheet] = useState<"add" | "view" | null>(null);
  useEffect(() => {
    try {
      controller.current = new SceneController(host.current!, editor);
    } catch {
      setError(
        "3D表示を開始できませんでした。ブラウザのハードウェアアクセラレーションを確認してください。",
      );
    }
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  const selected =
    state.mode === "point" ? state.anchors.length > 0 : !!state.selection;
  return (
    <section className="model-pane" aria-label="モデリング">
      <div ref={host} className="scene-canvas" />
      {error && <p className="scene-error">{error}</p>}
      <div className="canvas-top">
        <Select
          label="編集モード"
          value={state.mode}
          options={modes.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(value) => editor.setMode(value as EditMode)}
        />
        <div className="canvas-actions">
          <button
            className="add-shape"
            aria-label="かたちを追加"
            onClick={() => setSheet("add")}
          >
            <Plus size={19} />
            <span>追加</span>
          </button>
          <IconButton
            label="視点・基底・表示設定"
            onClick={() => setSheet("view")}
          >
            <MoreHorizontal size={22} />
          </IconButton>
        </div>
      </div>
      <Presence
        show={state.mode !== "point" && state.mode !== "seam"}
        className="transform-tools"
      >
        {(
          [
            { id: "select", label: "選択", icon: MousePointer2 },
            { id: "translate", label: "移動", icon: Move },
            { id: "rotate", label: "回転", icon: RotateCcw },
            { id: "scale", label: "拡大・縮小", icon: Scaling },
          ] as { id: Tool; label: string; icon: typeof Move }[]
        ).map((t) => (
          <IconButton
            key={t.id}
            disabled={
              state.mode !== "object" &&
              t.id !== "select" &&
              t.id !== "translate"
            }
            label={t.label}
            active={state.tool === t.id}
            onClick={() => editor.setTool(t.id)}
          >
            <t.icon size={20} />
          </IconButton>
        ))}
      </Presence>
      <div className="scene-hint">
        <Morph motionKey={`${state.mode}-${state.anchors.length}`}>
          {state.mode === "point"
            ? state.anchors.length
              ? `${state.anchors.length}点を選択中`
              : "点をタップして選択 · 空白で基底上に点を置く"
            : state.mode === "seam"
              ? "辺をタップして切り開く"
              : "形をタップして選択"}
        </Morph>
      </div>
      <Presence
        show={!state.project.objects.length && !error}
        className="empty-scene"
      >
        <div>
          <FoldMark className="empty-symbol" />
          <h1>かたちから、つくる。</h1>
          <p>右上の ＋ から形を置いてみよう</p>
        </div>
      </Presence>
      <NavigationStick
        enabled={state.view === "model"}
        kind="orbit"
        onFrame={(dir, dt) => controller.current?.orbitStep(dir, dt)}
      />
      <NavigationStick
        enabled={state.view === "model"}
        kind="zoom"
        onFrame={(dir, dt) => controller.current?.zoomStep(dir[1], dt)}
      />
      <div className="context-actions">
        <button onClick={() => controller.current?.look()}>
          <Focus size={18} />
          見る
        </button>
        <button onClick={() => controller.current?.focus("home", true)}>
          <Scan size={18} />
          全体
        </button>
        <IconButton
          label="選択解除"
          disabled={!selected}
          onClick={() => editor.clearSelection()}
        >
          <X size={19} />
        </IconButton>
      </div>
      <Presence
        show={state.mode === "point" && state.anchors.length > 0}
        className="point-actions"
      >
        <button onClick={() => editor.moveBasis()}>基底を移動</button>
        <IconButton
          label="選択した点の形を削除"
          onClick={() => editor.remove()}
        >
          <Trash2 size={17} />
        </IconButton>
      </Presence>
      <Dialog
        open={sheet !== null}
        title={sheet === "add" ? "かたちを追加" : "視点と作業基底"}
        onClose={() => setSheet(null)}
      >
        {sheet === "add" ? (
          <div className="shape-grid">
            {(Object.keys(primitiveNames) as Primitive[]).map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  controller.current?.add(kind);
                  setSheet(null);
                }}
              >
                <ShapeGlyph kind={kind} />
                {primitiveNames[kind]}
              </button>
            ))}
          </div>
        ) : (
          <div className="sheet-content">
            <button
              onClick={() => {
                controller.current?.focus("home", true);
                setSheet(null);
              }}
            >
              全体を表示
            </button>
            <div className="button-row">
              {(["front", "right", "top"] as const).map((v, i) => (
                <button
                  key={v}
                  onClick={() => {
                    controller.current?.focus(v, true);
                    setSheet(null);
                  }}
                >
                  {["正面", "右側", "真上"][i]}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                editor.rotateBasis();
                setSheet(null);
              }}
            >
              基底を回転
            </button>
            <p className="field-note">
              「見る」は選択点の中心を向きます。点がなければ基底の原点を向きます。
            </p>
            <Toggle
              label="グリッド"
              checked={state.grid}
              onChange={(v) => editor.setGrid(v)}
            />
            <Toggle
              label="スナップ 5mm / 15°"
              checked={state.snap}
              onChange={(v) => editor.setSnap(v)}
            />
          </div>
        )}
      </Dialog>
    </section>
  );
}
