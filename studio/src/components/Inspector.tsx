import { useState } from "react";
import { Box, Copy, Trash2 } from "lucide-react";
import { useEditor } from "../hooks/useEditor";
import { editor } from "../state/store";
import { dimensions } from "../core/model";
import { NumberField, Toggle, Select, Accordion } from "./ui";
const axes = ["x", "y", "z"];
export function Inspector({ paper = false }: { paper?: boolean }) {
  const state = useEditor(),
    object = editor.selectedObject();
  const [extrude, setExtrude] = useState(10),
    [inset, setInset] = useState(20);
  if (paper)
    return (
      <div className="sheet-content">
        <label className="select-field">
          用紙
          <Select
            label="用紙サイズ"
            value={state.settings.paper}
            options={["A4", "A3", "Letter"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(paper) =>
              editor.setSettings({ paper: paper as "A4" | "A3" | "Letter" })
            }
          />
        </label>
        <Toggle
          label="横向き"
          checked={state.settings.landscape}
          onChange={(landscape) => editor.setSettings({ landscape })}
        />
        <NumberField
          label="印刷倍率"
          value={state.settings.scale}
          min={5}
          max={500}
          unit="%"
          onChange={(scale) => editor.setSettings({ scale })}
        />
        <NumberField
          label="余白"
          value={state.settings.margin}
          min={5}
          max={30}
          unit="mm"
          onChange={(margin) => editor.setSettings({ margin })}
        />
        <NumberField
          label="微小な辺の上限（実寸）"
          value={state.settings.microEdgeLength}
          min={0.01}
          max={20}
          step={0.1}
          unit="mm"
          onChange={(microEdgeLength) =>
            editor.setSettings({ microEdgeLength })
          }
        />
        <p className="field-note">
          短辺が1本の三角形が連続する部分は曲面として展開します。短辺が2本以上の三角形は作成できません。判定は印刷倍率に左右されません。
        </p>
        <p className="field-note">
          用紙を超える形は10mm重ねて分割。紫の同じ目印を合わせ、重ねた部分で紙をつなぎます。
        </p>
      </div>
    );
  if (!object)
    return (
      <p className="empty-properties">
        形・頂点・面を選ぶと、ここで数値や形状を編集できます。
      </p>
    );
  const update = (
    key: "position" | "rotation" | "scale",
    axis: number,
    value: number,
  ) =>
    editor.updateObject(object.id, "変形値を変更", (o) => {
      o[key][axis] = value;
    });
  return (
    <div className="sheet-content">
      <div className="object-identity">
        <span className="object-badge">
          <Box size={20} />
        </span>
        <div>
          <input
            className="object-name"
            aria-label="オブジェクト名"
            key={object.id + object.name}
            defaultValue={object.name}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name)
                editor.updateObject(object.id, "名前を変更", (o) => {
                  o.name = name;
                });
            }}
          />
          <p className="field-note object-summary">
            {object.vertices.length} 頂点 · {object.faces.length} 面
          </p>
        </div>
      </div>
      {state.selection?.vertex !== undefined && state.mode === "vertex" && (
        <section>
          <h3>頂点の座標（mm）</h3>
          <div className="vector-fields">
            {axes.map((axis, i) => (
              <NumberField
                key={axis}
                label={`頂点 ${axis}`}
                axis={axis}
                value={object.vertices[state.selection!.vertex!][i]}
                onChange={(v) => {
                  const vertices = structuredClone(object.vertices);
                  vertices[state.selection!.vertex!][i] = v;
                  editor.moveVertices(object.id, vertices);
                }}
              />
            ))}
          </div>
        </section>
      )}
      {state.selection?.face !== undefined && state.mode === "face" && (
        <section>
          <h3>面を編集</h3>
          <div className="operation-row">
            <NumberField
              label="押し出す距離"
              value={extrude}
              min={0.1}
              max={1000}
              unit="mm"
              onChange={setExtrude}
            />
            <button onClick={() => editor.extrude(extrude)}>押し出す</button>
          </div>
          <div className="operation-row">
            <NumberField
              label="内側に縮める"
              value={inset}
              min={1}
              max={95}
              unit="%"
              onChange={setInset}
            />
            <button onClick={() => editor.inset(inset / 100)}>差し込む</button>
          </div>
          <button onClick={() => editor.triangulate()}>面を三角分割</button>
        </section>
      )}
      {(["position", "rotation", "scale"] as const).map((key, k) => (
        <section key={key}>
          <h3>
            {["位置", "回転", "倍率"][k]}
            <span className="section-unit">{["mm", "deg", "×"][k]}</span>
          </h3>
          <div className="vector-fields">
            {axes.map((axis, i) => (
              <NumberField
                key={axis}
                axis={axis}
                label={`${["位置", "回転", "スケール"][k]} ${axis}`}
                value={object[key][i]}
                min={key === "scale" ? 0.01 : -100000}
                max={key === "scale" ? 1000 : 100000}
                step={key === "scale" ? 0.1 : 1}
                onChange={(v) => update(key, i, v)}
              />
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>
          サイズ<span className="section-unit">mm · 回転前</span>
        </h3>
        <div className="vector-fields">
          {dimensions(object).map((d, i) => (
            <NumberField
              key={i}
              label={`サイズ ${axes[i]}`}
              axis={axes[i]}
              value={d}
              min={0.1}
              onChange={(v) => {
                if (d > 0) update("scale", i, (object.scale[i] * v) / d);
              }}
            />
          ))}
        </div>
      </section>
      <Accordion title="反転・リセット">
        <div className="button-row">
          {axes.map((a, i) => (
            <button key={a} onClick={() => editor.mirror(i)}>
              {a.toUpperCase()}反転
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            editor.transform(object.id, [0, 0, 0], [0, 0, 0], [1, 1, 1])
          }
        >
          変形をリセット
        </button>
      </Accordion>
      <div className="button-row">
        <button onClick={() => editor.duplicate()}>
          <Copy size={14} />
          複製
        </button>
        <button
          className="danger"
          onClick={() => {
            editor.setMode("object");
            editor.remove();
          }}
        >
          <Trash2 size={14} />
          削除
        </button>
      </div>
    </div>
  );
}
