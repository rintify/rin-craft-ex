import { batchSchema, projectSchema } from "../core/schema";
import { validateProject } from "../core/project";
import { inspectProject } from "../core/diagnostics";
import type { CraftBatch } from "../core/commands";
import { flushSync } from "react-dom";
import { primitive, type Primitive } from "../core/model";
import { generateNet } from "../core/unfold";
import type { EditorStore } from "./editor";
interface PageTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (
    tool: PageTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}
const shapes: Primitive[] = [
  "box",
  "house",
  "cylinder",
  "cone",
  "sphere",
  "pyramid",
];
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Expected an object.");
  return input as Record<string, unknown>;
}
/** Optional browser integration. It calls the same document commands as the visible UI. */
export function registerEditorTools(store: EditorStore) {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: PageTool[] = [
    {
      name: "apply_craft_edit",
      description:
        "Apply an atomic batch of put (upsert custom mesh), remove, transform, settings, rename, or seams commands. Coordinates are mm; faces have outward winding. Read get_craft_project first. One batch is one Undo step. Mesh schema: id, name, vertices [[x,y,z]], faces [[indices]], position/rotation/scale triples, visible boolean.",
      inputSchema: batchSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        let applied = false;
        flushSync(() => {
          applied = store.applyBatch(input as CraftBatch);
        });
        const s = store.getSnapshot();
        return { applied, inspection: inspectProject(s.project, s.settings) };
      },
    },
    {
      name: "load_craft_project",
      description:
        "Load a complete validated FOLD project as one undoable edit. Use this for generated models. Accepts project JSON or the built-in gundam-head example name, exclusively.",
      inputSchema: {
        type: "object",
        properties: {
          project: projectSchema,
          example: { enum: ["gundam-head"] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const args = record(input);
        if (Boolean(args.project) === Boolean(args.example))
          throw Error("Specify project or example.");
        const project = validateProject(
          args.example === "gundam-head"
            ? await fetch(
                `${import.meta.env.BASE_URL}examples/gundam-head.fold.json`,
              ).then((r) => {
                if (!r.ok) throw Error("Example unavailable");
                return r.json();
              })
            : args.project,
        );
        flushSync(() => {
          store.replace(project);
          store.select(null);
        });
        const s = store.getSnapshot();
        return inspectProject(s.project, s.settings);
      },
    },
    {
      name: "get_craft_project",
      description:
        "Read the current paper-craft model and physical net summary. Model and output dimensions use millimeters.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (Object.keys(record(input)).length)
          throw Error("No arguments are accepted.");
        const state = store.getSnapshot(),
          net = generateNet(state.project, state.settings);
        return {
          project: state.project,
          inspection: inspectProject(state.project, state.settings, net),
          name: state.project.name,
          objects: state.project.objects.map((o) => ({
            id: o.id,
            name: o.name,
            vertices: o.vertices.length,
            faces: o.faces.length,
            position: o.position,
            rotation: o.rotation,
            scale: o.scale,
            visible: o.visible,
          })),
          pages: net.pages,
          parts: net.islands.length,
          warnings: net.warnings,
          errors: net.errors,
          canUndo: state.canUndo,
          canRedo: state.canRedo,
        };
      },
    },
    {
      name: "add_craft_shapes",
      description:
        "Add one to eight basic shapes to the current model as one undoable operation. The visible editor and net update automatically.",
      inputSchema: {
        type: "object",
        properties: {
          shapes: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string", enum: shapes },
          },
        },
        required: ["shapes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const args = record(input);
        if (
          Object.keys(args).some((k) => k !== "shapes") ||
          !Array.isArray(args.shapes) ||
          !args.shapes.length ||
          args.shapes.length > 8 ||
          !args.shapes.every((kind) => shapes.includes(kind as Primitive))
        )
          throw Error("Choose one to eight supported shapes.");
        const count = store.getSnapshot().project.objects.length;
        if (count + args.shapes.length > 40)
          throw Error("The project limit is 40 objects.");
        const added = (args.shapes as Primitive[]).map((kind, i) => {
          const o = primitive(kind);
          o.position[0] = (count + i) * 55;
          return o;
        });
        flushSync(() => {
          if (
            !store.edit("形状をまとめて追加", (p) => p.objects.push(...added))
          )
            throw Error("The project geometry limit was exceeded.");
          store.setMode("object");
          store.select({ objectId: added[added.length - 1].id });
        });
        return { created: added.map((o) => ({ id: o.id, name: o.name })) };
      },
    },
    {
      name: "undo_redo_craft_edit",
      description:
        "Undo or redo one model or paper-setting edit and update the visible editor.",
      inputSchema: {
        type: "object",
        properties: { direction: { type: "string", enum: ["undo", "redo"] } },
        required: ["direction"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const args = record(input);
        if (
          Object.keys(args).some((k) => k !== "direction") ||
          !["undo", "redo"].includes(args.direction as string)
        )
          throw Error("direction must be undo or redo.");
        const state = store.getSnapshot();
        if (
          (args.direction === "undo" && !state.canUndo) ||
          (args.direction === "redo" && !state.canRedo)
        )
          throw Error("There is no edit to restore in that direction.");
        flushSync(() =>
          args.direction === "undo" ? store.undo() : store.redo(),
        );
        const next = store.getSnapshot();
        return {
          objects: next.project.objects.length,
          canUndo: next.canUndo,
          canRedo: next.canRedo,
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Unsupported integration must not affect normal editing. */
    }
  }
  return () => lifecycle.abort();
}
