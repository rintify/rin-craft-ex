import { initialProject, validateProject, type Project } from "../core/model";
const STORAGE_KEY = "fold-studio:project:v1";
/** The only persistence adapter. Model data never leaves this browser. */
export const projectStorage = {
  load(): Project {
    try {
      if (typeof window !== "undefined") {
        const text = window.localStorage.getItem(STORAGE_KEY);
        if (text) return validateProject(JSON.parse(text));
      }
    } catch {
      /* Invalid cached data falls back to a usable starter document. */
    }
    return initialProject();
  },
  save(project: Project): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      return true;
    } catch {
      return false;
    }
  },
};
