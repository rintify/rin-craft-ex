import { useSyncExternalStore } from "react";
import { editor } from "../state/store";
export const useEditor = () =>
  useSyncExternalStore(editor.subscribe, editor.getSnapshot);
