import { useEffect } from "react";
import { editor } from "../state/store";
import { saveProject } from "../io/browserFiles";
export function useShortcuts(onHelp: () => void) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.defaultPrevented) return;
      if (
        target.closest(
          'input,textarea,[contenteditable="true"],[role="dialog"],[role="combobox"],[role="listbox"]',
        )
      )
        return;
      const cmd = e.metaKey || e.ctrlKey,
        key = e.key.toLowerCase();
      if (cmd && key === "z") {
        e.preventDefault();
        e.shiftKey ? editor.redo() : editor.undo();
        return;
      }
      if (cmd && key === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (cmd && key === "s") {
        e.preventDefault();
        saveProject(editor.getSnapshot().project);
        return;
      }
      if (cmd && key === "d") {
        e.preventDefault();
        editor.duplicate();
        return;
      }
      if (cmd) return;
      const tools = {
        v: "select",
        g: "translate",
        r: "rotate",
        s: "scale",
      } as const;
      if (key in tools) {
        e.preventDefault();
        editor.setTool(tools[key as keyof typeof tools]);
      }
      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        editor.remove();
      }
      if (key === "escape") editor.clearSelection();
      if (key === "?") onHelp();
      if (key === "1") editor.setMode("object");
      if (key === "2") editor.setMode("vertex");
      if (key === "3") editor.setMode("face");
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onHelp]);
}
