import { Eye, EyeOff, Box } from "lucide-react";
import { useEditor } from "../hooks/useEditor";
import { editor } from "../state/store";
import { IconButton, Morph } from "./ui";
export function ObjectPanel({ onSelect }: { onSelect: () => void }) {
  const state = useEditor();
  return (
    <Morph
      motionKey={state.project.objects.map((o) => o.id).join(",")}
      className="object-list"
    >
      {!state.project.objects.length && <p>右上の ＋ から形を追加できます。</p>}
      {state.project.objects.map((o) => (
        <div
          key={o.id}
          data-hidden={!o.visible}
          className={`object-row ${state.selection?.objectId === o.id ? "selected" : ""}`}
        >
          <button
            className="object-select"
            aria-pressed={state.selection?.objectId === o.id}
            onClick={() => {
              editor.setMode("object");
              editor.select({ objectId: o.id });
              onSelect();
            }}
          >
            <span className="object-icon">
              <Box size={17} />
            </span>
            <span>
              {o.name}
              <small>
                {o.faces.length} <span>面</span>
              </small>
            </span>
          </button>
          <IconButton
            label={`${o.name}を${o.visible ? "非表示" : "表示"}`}
            onClick={() =>
              editor.updateObject(o.id, "表示を切替", (p) => {
                p.visible = !p.visible;
              })
            }
          >
            {o.visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </IconButton>
        </div>
      ))}
    </Morph>
  );
}
