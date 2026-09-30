import type { CraftObject, Project, Vec3 } from "./types";
import type { NetSettings } from "./settings";
import { defaultSettings } from "./settings";
import { validateProject } from "./project";
export type CraftCommand =
  | { type: "put"; object: CraftObject }
  | { type: "remove"; id: string }
  | {
      type: "transform";
      id: string;
      position?: Vec3;
      rotation?: Vec3;
      scale?: Vec3;
    }
  | { type: "settings"; settings: Partial<NetSettings> }
  | { type: "rename"; name: string }
  | { type: "seams"; seams: string[] };
export interface CraftBatch {
  label: string;
  operations: CraftCommand[];
}

/** Pure atomic transaction, shared by browser automation and the offline CLI. */
export function applyCommands(project: Project, input: unknown): Project {
  const batch = input as CraftBatch;
  if (
    !batch ||
    typeof batch.label !== "string" ||
    !batch.label.trim() ||
    batch.label.length > 100 ||
    !Array.isArray(batch.operations) ||
    !batch.operations.length ||
    batch.operations.length > 80
  )
    throw Error("編集名と1〜80個の操作を指定してください。");
  const keys: Record<CraftCommand["type"], string[]> = {
    put: ["type", "object"],
    remove: ["type", "id"],
    transform: ["type", "id", "position", "rotation", "scale"],
    settings: ["type", "settings"],
    rename: ["type", "name"],
    seams: ["type", "seams"],
  };
  const next = structuredClone(project);
  for (const command of batch.operations) {
    if (!command || typeof command !== "object")
      throw Error("編集コマンドが不正です。");
    if (
      !keys[command.type] ||
      Object.keys(command).some((key) => !keys[command.type].includes(key))
    )
      throw Error("未対応の編集フィールドがあります。");
    if (
      command.type === "settings" &&
      (!command.settings ||
        typeof command.settings !== "object" ||
        Array.isArray(command.settings))
    )
      throw Error("設定はオブジェクトで指定してください。");
    switch (command.type) {
      case "put": {
        if (!command.object || typeof command.object.id !== "string")
          throw Error("オブジェクトを指定してください。");
        const index = next.objects.findIndex((o) => o.id === command.object.id);
        if (index < 0) next.objects.push(structuredClone(command.object));
        else {
          next.objects[index] = structuredClone(command.object);
          next.seams = next.seams.filter(
            (s) => !s.startsWith(command.object.id + ":"),
          );
        }
        break;
      }
      case "remove": {
        if (!next.objects.some((o) => o.id === command.id))
          throw Error(`部品 ${command.id} がありません。`);
        next.objects = next.objects.filter((o) => o.id !== command.id);
        next.seams = next.seams.filter((s) => !s.startsWith(command.id + ":"));
        break;
      }
      case "transform": {
        const object = next.objects.find((o) => o.id === command.id);
        if (!object) throw Error(`部品 ${command.id} がありません。`);
        for (const key of ["position", "rotation", "scale"] as const)
          if (command[key] !== undefined)
            object[key] = structuredClone(command[key]);
        break;
      }
      case "settings":
        next.settings = {
          ...(next.settings ?? defaultSettings),
          ...command.settings,
        };
        break;
      case "rename":
        next.name = command.name;
        break;
      case "seams":
        next.seams = structuredClone(command.seams);
        break;
      default:
        throw Error("未対応の編集コマンドです。");
    }
  }
  return validateProject(next);
}
