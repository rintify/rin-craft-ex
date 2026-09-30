import { useEffect, useRef, useState } from "react";
import type { Project } from "../core/model";
import type { NetResult, NetSettings } from "../core/unfold";
/** Each request replaces the previous worker so expensive obsolete work is cancelled. */
export function useNet(project: Project, settings: NetSettings) {
  const [state, setState] = useState<{
    project: Project | null;
    settings: NetSettings | null;
    result: NetResult | null;
    busy: boolean;
    error: string;
  }>({ project: null, settings: null, result: null, busy: true, error: "" });
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    setState((p) => ({ ...p, busy: true, error: "" }));
    const worker = new Worker(
      new URL("../workers/net.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }) => {
      if (data.id === sequence.current)
        setState({
          project,
          settings,
          result: data.result ?? null,
          busy: false,
          error: data.error ?? "",
        });
      worker.terminate();
    };
    worker.onerror = () => {
      setState({
        project,
        settings,
        result: null,
        busy: false,
        error: "展開図の計算に失敗しました。面のつながりを確認してください。",
      });
      worker.terminate();
    };
    const timer = setTimeout(
      () => worker.postMessage({ id, project, settings }),
      80,
    );
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [project, settings]);
  const current = state.project === project && state.settings === settings;
  return {
    result: current ? state.result : null,
    preview: state.result,
    busy: !current || state.busy,
    error: current ? state.error : "",
  };
}
