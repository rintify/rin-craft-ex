import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { editor } from "../state/store";
import { parseOBJ, validateProject } from "../core/model";
import { Select } from "./ui";
export function ImportContent({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState(""),
    [format, setFormat] = useState("json"),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const load = (source: string, type: string, name = "読み込んだ形") => {
    try {
      if (new Blob([source]).size > 5000000)
        throw Error("5MB以下のデータを使用してください。");
      if (type === "obj") {
        const object = parseOBJ(source);
        object.name = name;
        if (!editor.edit("OBJを読み込み", (p) => p.objects.push(object)))
          return;
        editor.setMode("object");
        editor.select({ objectId: object.id });
      } else {
        const value = JSON.parse(source);
        if (Array.isArray(value.operations)) {
          if (!editor.applyBatch(value)) return;
        } else editor.replace(validateProject(value));
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込めませんでした");
    }
  };
  const loadFile = async (f: File) => {
    if (f.size > 5000000) {
      setError("5MB以下のファイルを使用してください。");
      return;
    }
    try {
      load(
        await f.text(),
        f.name.toLowerCase().endsWith(".obj") ? "obj" : "json",
        f.name.replace(/\.obj$/i, ""),
      );
    } catch {
      setError("ファイルを読み込めませんでした。");
    }
  };
  return (
    <div className="sheet-content">
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void loadFile(f);
        }}
      >
        <FileUp size={26} />
        <p>JSON・OBJをここにドロップ</p>
        <button onClick={() => file.current?.click()}>
          端末のファイルを選ぶ
        </button>
        <input
          ref={file}
          type="file"
          hidden
          accept=".json,.obj"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="select-field">
        <span>またはデータを貼り付け</span>
        <Select
          label="読み込み形式"
          value={format}
          options={[
            { value: "json", label: "JSON / AI編集" },
            { value: "obj", label: "OBJ" },
          ]}
          onChange={setFormat}
        />
      </div>
      <textarea
        aria-label="読み込むデータ"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="プロジェクトやAIが作ったJSONを貼り付け"
        rows={5}
        spellCheck={false}
      />
      <button disabled={!text.trim()} onClick={() => load(text, format)}>
        読み込む
      </button>
      <p className="import-error" role="status">
        {error}
      </p>
      <p className="field-note">
        読み込みもUndoで戻せます。データはこの端末の中で処理します。
      </p>
    </div>
  );
}
