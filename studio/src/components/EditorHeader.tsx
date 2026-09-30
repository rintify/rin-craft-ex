import {
  Box,
  ChevronDown,
  Download,
  Redo2,
  Scissors,
  Undo2,
} from "lucide-react";
import { useEditor } from "../hooks/useEditor";
import { editor } from "../state/store";
import { IconButton, Segmented } from "./ui";
import { FoldMark } from "./Brand";

export function EditorHeader({
  onMenu,
  onExport,
}: {
  onMenu: () => void;
  onExport: () => void;
}) {
  const state = useEditor();
  return (
    <header className="topbar">
      <button className="brand" aria-label="メニュー" onClick={onMenu}>
        <FoldMark />
        <span>
          <strong>FOLD</strong>
          <small>CRAFT STUDIO</small>
        </span>
      </button>
      <button
        className="project-title"
        onClick={onMenu}
        aria-label={`プロジェクト：${state.project.name}`}
      >
        <span className="eyebrow">PROJECT</span>
        <span className="project-name">
          {state.project.name}
          <ChevronDown size={13} />
        </span>
      </button>
      <div className="workspace-switch">
        <Segmented
          label="作業画面"
          value={state.view}
          options={[
            {
              value: "model",
              label: (
                <>
                  <Box size={16} />
                  <span>
                    3D<span className="mode-long"> モデル</span>
                  </span>
                </>
              ),
            },
            {
              value: "net",
              label: (
                <>
                  <Scissors size={16} />
                  <span>展開図</span>
                </>
              ),
            },
          ]}
          onChange={(v) => editor.setView(v as "model" | "net")}
        />
      </div>
      <div className="header-actions">
        <div className="history-actions">
          <IconButton
            label={`元に戻す${state.undoLabel ? "：" + state.undoLabel : ""}`}
            disabled={!state.canUndo}
            onClick={() => editor.undo()}
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            label={`やり直す${state.redoLabel ? "：" + state.redoLabel : ""}`}
            disabled={!state.canRedo}
            onClick={() => editor.redo()}
          >
            <Redo2 size={18} />
          </IconButton>
        </div>
        <button
          className="primary export-action"
          onClick={onExport}
          aria-label="展開図を書き出す"
        >
          <Download size={16} />
          <span>書き出す</span>
        </button>
      </div>
    </header>
  );
}

export function EditorStatus() {
  const { project, storageAvailable, grid, snap, settings } = useEditor();
  return (
    <footer className="editor-status">
      <span className="save-state" data-saved={storageAvailable}>
        <i />
        {storageAvailable
          ? "この端末に自動保存済み"
          : "ファイルに保存してください"}
      </span>
      <span className="document-stats">
        <b>{project.objects.length}</b> 部品<span>·</span>
        <b>{project.objects.reduce((n, o) => n + o.faces.length, 0)}</b> 面
      </span>
      <span className="status-settings">
        <span>
          単位 <b>mm</b>
        </span>
        <span>
          グリッド <b>{grid ? "ON" : "OFF"}</b>
        </span>
        <span>
          スナップ <b>{snap ? "ON" : "OFF"}</b>
        </span>
        <span>
          実寸短辺 <b>{settings.microEdgeLength} mm</b>
        </span>
      </span>
    </footer>
  );
}
