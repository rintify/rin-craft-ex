import { useEffect, useState } from "react";
import { EditorHeader, EditorStatus } from "./components/EditorHeader";
import {
  Layers,
  Download,
  FolderOpen,
  Box,
  FilePlus2,
  FileText,
  HelpCircle,
} from "lucide-react";
import { useEditor } from "./hooks/useEditor";
import { useNet } from "./hooks/useNet";
import { useShortcuts } from "./hooks/useShortcuts";
import { editor } from "./state/store";
import { registerEditorTools } from "./state/webmcp";
import { ModelView } from "./components/ModelView";
import { NetView } from "./components/NetView";
import { Inspector } from "./components/Inspector";
import { ObjectPanel } from "./components/ObjectPanel";
import { HelpContent } from "./components/HelpDialog";
import { ImportContent } from "./components/ImportContent";
import { Accordion, Dialog, Morph, Presence, Segmented } from "./components/ui";
import { validateProject } from "./core/model";
import { saveProject, exportOBJ } from "./io/browserFiles";
import { ExportContent } from "./components/ExportContent";
type Sheet = "menu" | "import" | "export" | "help" | null;
export default function App() {
  const state = useEditor(),
    net = useNet(state.project, state.settings);
  const [sheet, setSheet] = useState<Sheet>(null),
    [inspectorTab, setInspectorTab] = useState("object");
  useEffect(() => registerEditorTools(editor), []);
  useShortcuts(() => setSheet("help"));
  const sample = async () => {
    try {
      const r = await fetch(
        `${import.meta.env.BASE_URL}examples/gundam-head.fold.json`,
      );
      if (!r.ok) throw Error("サンプルを読み込めませんでした");
      editor.replace(validateProject(await r.json()));
      setSheet(null);
      editor.notify(
        "ガンダム頭部を読み込みました。「全体を表示」で確認できます",
      );
    } catch (e) {
      editor.notify(e instanceof Error ? e.message : "読み込みエラー");
    }
  };
  return (
    <>
      <main className="app">
        <EditorHeader
          onMenu={() => setSheet("menu")}
          onExport={() => setSheet("export")}
        />
        <div className="editor-layout">
          <aside className="hierarchy dock-panel" aria-label="ヒエラルキー">
            <header className="panel-heading">
              <Layers size={14} />
              <h2>ヒエラルキー</h2>
              <span className="panel-count">
                {state.project.objects.length}
              </span>
            </header>
            <div className="panel-scroll">
              <ObjectPanel onSelect={() => setInspectorTab("object")} />
            </div>
          </aside>
          <div className="workspace">
            <div
              className="view-layer"
              data-active={state.view === "model"}
              inert={state.view !== "model"}
              aria-hidden={state.view !== "model"}
            >
              <ModelView />
            </div>
            <div
              className="view-layer"
              data-active={state.view === "net"}
              inert={state.view !== "net"}
              aria-hidden={state.view !== "net"}
            >
              <NetView
                net={net.preview}
                busy={net.busy}
                error={net.error}
                onSettings={() => setInspectorTab("paper")}
                onExport={() => setSheet("export")}
              />
            </div>
          </div>
          <aside className="inspector dock-panel" aria-label="インスペクター">
            <header className="panel-heading">
              <h2>インスペクター</h2>
              <div className="inspector-tabs">
                <Segmented
                  label="インスペクターの内容"
                  value={inspectorTab}
                  options={[
                    { value: "object", label: "形状" },
                    { value: "paper", label: "展開" },
                  ]}
                  onChange={setInspectorTab}
                />
              </div>
            </header>
            <div className="panel-scroll">
              <Morph
                motionKey={`${inspectorTab}-${state.selection?.objectId}-${state.mode}-${state.selection?.face}-${state.selection?.vertex}`}
              >
                <Inspector paper={inspectorTab === "paper"} />
              </Morph>
            </div>
          </aside>
        </div>
        <EditorStatus />
      </main>
      <Presence show={!!state.toast} className="toast">
        <span role="status">{state.toast}</span>
      </Presence>
      <Dialog
        open={sheet !== null}
        title={
          {
            menu: "メニュー",
            import: "プロジェクトを開く",
            export: "展開図を書き出す",
            help: "使い方",
          }[sheet ?? "menu"]
        }
        onClose={() => setSheet(null)}
      >
        {sheet === "help" ? (
          <HelpContent />
        ) : sheet === "import" ? (
          <ImportContent onDone={() => setSheet(null)} />
        ) : sheet === "export" ? (
          <ExportContent
            net={net.result}
            settings={state.settings}
            name={state.project.name}
            busy={net.busy}
          />
        ) : (
          <div className="sheet-content menu-list">
            <label className="number-field">
              プロジェクト名
              <input
                aria-label="プロジェクト名"
                key={state.project.name}
                defaultValue={state.project.name}
                onBlur={(e) => {
                  if (
                    e.target.value.trim() &&
                    e.target.value.trim() !== state.project.name
                  )
                    editor.edit("プロジェクト名を変更", (p) => {
                      p.name = e.target.value.trim();
                    });
                }}
              />
            </label>
            <button
              onClick={() => {
                saveProject(state.project);
                setSheet(null);
              }}
            >
              <Download size={19} />
              プロジェクトを保存
            </button>
            <button onClick={() => setSheet("import")}>
              <FolderOpen size={19} />
              ファイル・AI編集を読み込む
            </button>
            <button onClick={() => setSheet("export")}>
              <FileText size={19} />
              展開図をPDF・SVGで保存
            </button>
            <Accordion title="サンプル・その他のファイル操作">
              <button onClick={sample}>
                <Box size={18} />
                サンプル：ガンダム頭部
              </button>
              <button
                onClick={() => {
                  exportOBJ(state.project);
                  setSheet(null);
                }}
              >
                OBJを書き出す
              </button>
              <button
                onClick={() => {
                  editor.newProject();
                  setSheet(null);
                }}
              >
                <FilePlus2 size={18} />
                新しく作る（Undoで戻せます）
              </button>
            </Accordion>
            <button onClick={() => setSheet("help")}>
              <HelpCircle size={19} />
              使い方
            </button>
            <p className="field-note">
              {state.storageAvailable
                ? "この端末に自動保存済み"
                : "自動保存を利用できません。ファイルに保存してください。"}
            </p>
          </div>
        )}
      </Dialog>
    </>
  );
}
