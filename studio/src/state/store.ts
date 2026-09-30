import { EditorStore } from "./editor";
import { projectStorage } from "./storage";
export const editor = new EditorStore(
  projectStorage.load(),
  projectStorage.save,
);
