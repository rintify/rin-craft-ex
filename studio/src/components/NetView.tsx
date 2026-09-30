import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Scan,
  Settings2,
  Download,
} from "lucide-react";
import { netToSVG, LINE_COLORS } from "../core/svg";
import type { NetResult } from "../core/unfold";
import { useEditor } from "../hooks/useEditor";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { editor } from "../state/store";
import { IconButton, Morph, Presence, Select } from "./ui";
import { NavigationStick } from "./NavigationStick";
export function NetView({
  net,
  busy,
  error,
  onSettings,
  onExport,
}: {
  net: NetResult | null;
  busy: boolean;
  error: string;
  onSettings: () => void;
  onExport: () => void;
}) {
  const state = useEditor(),
    scroll = useRef<HTMLDivElement>(null);
  const [fitWidth, setFitWidth] = useState(300),
    [pageIndex, setPage] = useState(0),
    [zoomTarget, setZoom] = useState(1);
  const zoom = useAnimatedNumber(zoomTarget),
    width = useAnimatedNumber(fitWidth);
  const page = Math.min(pageIndex, Math.max(0, (net?.pages ?? 1) - 1));
  const revision = useRef({ net, count: 0 });
  if (revision.current.net !== net)
    revision.current = { net, count: revision.current.count + 1 };
  // Keep the last valid drawing visible while its replacement is being computed.
  const settings = useRef(state.settings);
  if (!busy) settings.current = state.settings;
  useEffect(() => {
    const host = scroll.current;
    if (!host || !net) return;
    const update = () =>
      setFitWidth(
        Math.max(
          70,
          Math.min(
            host.clientWidth - 24,
            ((host.clientHeight - 24) * net.width) / net.height,
          ),
        ),
      );
    const observer = new ResizeObserver(update);
    observer.observe(host);
    update();
    return () => observer.disconnect();
  }, [net?.width, net?.height]);
  const selectFace = (target: Element) => {
    if (busy) return;
    const f = target.closest("[data-face]");
    if (f) {
      editor.setMode("face");
      editor.select({
        objectId: f.getAttribute("data-object")!,
        face: Number(f.getAttribute("data-face")),
      });
    }
  };
  return (
    <section className="net-pane" aria-label="展開図">
      <div className="net-toolbar">
        <span>
          {state.settings.paper} · {state.settings.scale}%
        </span>
        <Select
          label="展開図の部品へ移動"
          value=""
          disabled={busy}
          options={[
            { value: "", label: "部品へ移動" },
            ...state.project.objects
              .filter((o) => o.visible)
              .map((o) => ({ value: o.id, label: o.name })),
          ]}
          onChange={(id) => {
            const next =
              net?.sheets.findIndex((s) =>
                s.faces.some((f) => f.objectId === id),
              ) ?? -1;
            if (next >= 0) {
              setPage(next);
              editor.select({ objectId: id });
            }
          }}
        />
        <div>
          <IconButton label="展開設定" onClick={onSettings}>
            <Settings2 size={18} />
          </IconButton>
          <IconButton label="展開図の保存" onClick={onExport}>
            <Download size={18} />
          </IconButton>
        </div>
      </div>
      <div
        className="net-progress"
        data-busy={busy}
        role="status"
        aria-label={busy ? "展開図を計算中" : "展開図の計算完了"}
      />
      <div className="paper-scroll" ref={scroll} aria-busy={busy}>
        <Morph motionKey={`${revision.current.count}-${page}`}>
          {net?.pages ? (
            <div
              className="paper"
              style={{ width: zoom * width }}
              onClick={(e) => selectFace(e.target as Element)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectFace(e.target as Element);
                }
              }}
              dangerouslySetInnerHTML={{
                __html: netToSVG(
                  net,
                  settings.current,
                  page,
                  state.selection,
                  true,
                ),
              }}
            />
          ) : (
            <p className="empty-net">
              {error ||
                (busy ? "展開図を計算中…" : "形を追加すると展開図を作れます")}
            </p>
          )}
        </Morph>
      </div>
      <Presence show={!!error || !!net?.errors.length} className="net-alert">
        <span role="alert">{error || net?.errors[0]}</span>
      </Presence>
      <Presence show={!!net?.sheets[page]?.tile} className="tile-hint">
        同じ紫の目印を重ねて、分割した紙をつないでください。
      </Presence>
      <NavigationStick
        kind="zoom"
        enabled={state.view === "net"}
        onFrame={(dir, dt) =>
          setZoom((z) => Math.min(8, Math.max(0.25, z * 2 ** (dir[1] * dt))))
        }
      />
      <div className="net-legend" aria-label="線の種類">
        <span>
          <i style={{ background: LINE_COLORS.cut }} />
          切断
        </span>
        <span>
          <i style={{ background: LINE_COLORS.mountain }} />
          山折り
        </span>
        <span>
          <i style={{ background: LINE_COLORS.valley }} />
          谷折り
        </span>
      </div>
      <div className="net-bottom">
        <div className="page-navigation">
          <IconButton
            label="前のページ"
            disabled={!page || busy}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={20} />
          </IconButton>
          <Select
            label="展開図のページ"
            value={String(page)}
            disabled={busy}
            options={Array.from(
              { length: Math.max(1, net?.pages ?? 0) },
              (_, i) => ({
                value: String(i),
                label: `${i + 1} / ${net?.pages ?? 0}`,
              }),
            )}
            onChange={(v) => setPage(Number(v))}
          />
          <IconButton
            label="次のページ"
            disabled={!net || page >= net.pages - 1 || busy}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={20} />
          </IconButton>
        </div>
        <IconButton
          label="展開図を全体表示"
          onClick={() => {
            setZoom(1);
            scroll.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
          }}
        >
          <Scan size={20} />
        </IconButton>
      </div>
    </section>
  );
}
