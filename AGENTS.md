# FOLD Studio development

The application is in `studio/`. It is a static Vite/React/TypeScript application: no account, server, or cloud storage is required.

- Read `studio/README.md` for setup and `studio/docs/AI_WORKFLOW.md` for model automation.
- Keep document geometry and pure algorithms in `src/core/`, history in `src/state/editor.ts`, GPU/pointer behavior in `src/scene/`, and browser UI in `src/components/`. Browser download/print adapters belong in `src/io/`, Worker entrypoints in `src/workers/`, and Node filesystem adapters in `scripts/`.
- Coordinates are millimeters, Y is up, and +Z is the front. Faces must have outward winding and be convex and planar. Shared edges use the same vertex indices.
- Apply edits through the store as one transaction per user action. Selection and camera changes do not belong in Undo history.
- AI modeling: start from the current project, use `core/meshBuilder.ts` helpers or validated JSON, then `npm run craft -- inspect FILE`. For browser edits use the exposed WebMCP tools; for environments without WebMCP use project or edit JSON import. Do not require undocumented global browser state.
- Reproduce the sample with `npm run example:gundam`. Export arbitrary projects with `npm run craft -- export FILE OUTPUT_DIRECTORY`. Review warnings, inspect SVG/PDF visually, and verify the resulting shape in the editor.
- Run `npm test` and `npm run build` after behavior changes. Test invariants such as edge lengths, winding, manifold edges, nonoverlapping parts, page boundaries, tiling area coverage, paired registration marks, continuous smooth strips, short-edge rejection, reference navigation speeds, complete face coverage, and atomic Undo/Redo. Tests cannot prove real paper assembly or compensate for material thickness.

- Keep touch navigation, hierarchy and inspector visible. Portrait phones place both docks below the work area; wide screens place them at its sides. Shape creation and infrequent commands belong in custom dialogs. Full stick input retains 0.8 rad/s orbit and 2^-dt zoom; smaller orbit deflections give proportionally slower movement.
- UI surfaces must animate on both entry and exit. Camera presets/look, basis changes, selection and document preview transitions interpolate independently of the store; direct user input can interrupt camera animation. Reuse custom dialog, select, accordion, switch and motion primitives. Native file access is only an explicit device-file-picker action; also support local drop and paste. PDF export must not open a native print dialog.
- Surfaces have no colors or textures. Do not restore glue tabs or assembly numbers. Cut/mountain/valley lines are solid and use distinct colors.
- The short-edge threshold is physical millimeters (default 1), after object transforms and before print scale. Reject triangles with two or more short edges atomically. Unfold independent of paper size, then paginate with registration marks.
