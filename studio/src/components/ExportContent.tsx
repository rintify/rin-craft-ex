import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import type { NetResult, NetSettings } from "../core/unfold";
import { createPDF } from "../io/pdf";
import { exportSVG } from "../io/browserFiles";
import { Morph, Presence } from "./ui";
export function ExportContent({
  net,
  settings,
  name,
  busy,
}: {
  net: NetResult | null;
  settings: NetSettings;
  name: string;
  busy: boolean;
}) {
  const [building, setBuilding] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const request = useRef(0);
  useEffect(() => {
    setFile(null);
    setBuilding(false);
    request.current++;
    return () => {
      request.current++;
    };
  }, [net, settings]);
  const ready = !!net?.pages && !busy && !net.errors.length;
  const build = async () => {
    if (!ready || building) return;
    const id = request.current;
    setBuilding(true);
    setProgress(0);
    setError("");
    try {
      const url = await createPDF(net!, settings, setProgress);
      if (id !== request.current) return;
      setFile({
        url,
        name: `${name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100) || "fold-project"}.pdf`,
      });
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : "PDFを作成できませんでした");
    } finally {
      if (id === request.current) setBuilding(false);
    }
  };
  return (
    <div className="sheet-content menu-list">
      <div className="export-summary">
        <span className="export-sheet" aria-hidden="true">
          <FileText size={26} />
        </span>
        <div>
          <span className="eyebrow">PRINT LAYOUT</span>
          <strong>{name}</strong>
          <span>
            {net?.pages ?? 0} ページ · {settings.paper} · {settings.scale}%
          </span>
        </div>
      </div>
      <Morph motionKey={file ? "ready" : "generate"}>
        {file ? (
          <a className="download-button" href={file.url} download={file.name}>
            <Download size={19} />
            PDFをダウンロード
          </a>
        ) : (
          <button
            className="export-pdf primary"
            disabled={!ready || building}
            onClick={build}
          >
            <FileText size={19} />
            {building
              ? `PDFを作成中 ${Math.round(progress * 100)}%`
              : "PDFを作成"}
          </button>
        )}
        <div
          className="export-progress"
          data-building={building}
          aria-hidden="true"
          style={{ opacity: building ? 1 : 0 }}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </Morph>
      <button
        disabled={!ready || building}
        onClick={() => exportSVG(net!, settings, name)}
      >
        <Download size={19} />
        SVGを保存
      </button>
      <Presence show={!!error} className="import-error">
        <span role="status">{error}</span>
      </Presence>
      <p className="field-note">
        実寸の用紙サイズで保存します。PDFを開いて印刷する場合は「実際のサイズ・100%」を指定し、20mmの確認線を測ってください。
      </p>
    </div>
  );
}
