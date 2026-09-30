# FOLD interface

The editor uses warm paper surfaces, graphite text and a vermilion accent. The accent identifies actions and selection; it never becomes a model material or printed face color.

- `src/styles/tokens.css`: shared colors, typography, shadows and motion timing.
- `controls.css`: inputs, buttons, switches, segmented controls and accordions.
- `layout.css` / `responsive.css`: application shell and persistent docks, including narrow and short screens.
- `panels.css` / `viewport.css` / `overlays.css`: inspector, hierarchy, canvas controls, paper preview and custom overlays.
- `components/Brand.tsx` / `ShapeGlyph.tsx`: original vector artwork, without external asset requests.
- `scene/StudioStage.ts` / `workGrid.ts`: presentation-only lighting, shadow catcher and fading grid. These never enter geometry, history, selection or exports.

Keep hierarchy and inspector visible. Portrait layouts put them below the work surface; landscape and desktop layouts put them on either side. Common actions (mode, undo/redo, navigation, export) stay within easy reach; shape insertion and occasional settings use custom dialogs. All view changes, control states and overlays use the existing motion primitives. Preserve `overflow: clip` on the app and workspace so keyboard focus cannot scroll the canvas out of view.

Use component styles and shared tokens instead of appending unrelated overrides. Keep preview selection highlighting separate from actual SVG/PDF output. The line legend imports its colors from the same core constants as the drawing.
