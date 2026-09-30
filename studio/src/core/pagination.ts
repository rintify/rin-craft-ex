import type { Vec2 } from "./types";
import type { NetIsland, NetSheet } from "./netTypes";
import { packRectangles } from "./packing";
import { clipPolygon, clipLine } from "./clipping";
import { signedArea } from "./polygon";
export const TILE_OVERLAP = 10;
export const printableSize = (
  width: number,
  height: number,
  margin: number,
): Vec2 => [width - 2 * margin, height - margin - Math.max(margin, 12)];
const emptySheet = (): NetSheet => ({
  faces: [],
  lines: [],
  marks: [],
  joins: [],
  captions: [],
});
/** Pack ordinary pieces; tile oversized pieces in overlapping windows at unchanged scale. */
export function paginate(
  islands: NetIsland[],
  width: number,
  height: number,
  margin: number,
): NetSheet[] {
  const [w, h] = printableSize(width, height, margin);
  const fits = (i: NetIsland) =>
    (i.width <= w + 1e-7 && i.height <= h + 1e-7) ||
    (i.height <= w + 1e-7 && i.width <= h + 1e-7);
  const small = islands
    .filter(fits)
    .sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  const packed = packRectangles(small, w, h, 5, 0),
    sheets: NetSheet[] = [];
  small.forEach((island, i) => {
    const p = packed[i];
    while (sheets.length <= p.page) sheets.push(emptySheet());
    const map = ([x, y]: Vec2): Vec2 => [
      margin + p.x + (p.rotated ? island.height - y : x),
      margin + p.y + (p.rotated ? x : y),
    ];
    const sheet = sheets[p.page];
    sheet.faces.push(
      ...island.faces.map((f) => ({ ...f, points: f.points.map(map) })),
    );
    sheet.lines.push(
      ...island.lines.map((l) => ({ ...l, a: map(l.a), b: map(l.b) })),
    );
  });
  for (const island of islands.filter((i) => !fits(i))) {
    const columns = Math.max(
        1,
        Math.ceil((island.width - TILE_OVERLAP) / (w - TILE_OVERLAP)),
      ),
      rows = Math.max(
        1,
        Math.ceil((island.height - TILE_OVERLAP) / (h - TILE_OVERLAP)),
      );
    if (columns * rows + sheets.length > 200)
      throw Error(
        "展開図が200ページを超えます。モデルの実寸または印刷倍率を確認してください。",
      );
    const tiles = new Map<string, NetSheet>();
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++) {
        const origin: Vec2 = [
            column * (w - TILE_OVERLAP),
            row * (h - TILE_OVERLAP),
          ],
          box = { x: origin[0], y: origin[1], width: w, height: h };
        const map = ([x, y]: Vec2): Vec2 => [
          x - origin[0] + margin,
          y - origin[1] + margin,
        ];
        const sheet = emptySheet();
        sheet.tile = {
          islandId: island.id,
          column,
          row,
          columns,
          rows,
          origin,
        };
        for (const f of island.faces) {
          const points = clipPolygon(f.points, box);
          if (points.length >= 3 && Math.abs(signedArea(points)) > 1e-7)
            sheet.faces.push({ ...f, points: points.map(map) });
        }
        if (!sheet.faces.length) continue;
        for (const l of island.lines) {
          const clipped = clipLine(l.a, l.b, box);
          if (clipped)
            sheet.lines.push({ ...l, a: map(clipped[0]), b: map(clipped[1]) });
        }
        sheet.captions.push({
          point: [margin, height - 10],
          text: `分割 ${island.id} · ${row + 1}行 ${column + 1}列 / ${rows}×${columns} · 重ね幅 ${TILE_OVERLAP}mm`,
        });
        tiles.set(`${column},${row}`, sheet);
        sheets.push(sheet);
      }
    for (const sheet of tiles.values()) {
      const t = sheet.tile!;
      for (const [dc, dr, direction] of [
        [1, 0, "H"],
        [0, 1, "V"],
      ] as const) {
        const next = tiles.get(`${t.column + dc},${t.row + dr}`);
        if (!next) continue;
        const x = next.tile!.origin[0] + (dc ? TILE_OVERLAP / 2 : 0),
          y = next.tile!.origin[1] + (dr ? TILE_OVERLAP / 2 : 0);
        const points: Vec2[] = dc
          ? [
              [x, y + 12],
              [x, y + h - 12],
            ]
          : [
              [x + 12, y],
              [x + w - 12, y],
            ];
        for (const target of [sheet, next]) {
          const map = ([px, py]: Vec2): Vec2 => [
            px - target.tile!.origin[0] + margin,
            py - target.tile!.origin[1] + margin,
          ];
          points.forEach((source, index) =>
            target.marks.push({
              id: `${island.id}${direction}${t.row + 1}.${t.column + 1}${index ? "B" : "A"}`,
              islandId: island.id,
              source,
              point: map(source),
            }),
          );
          target.joins.push({ a: map(points[0]), b: map(points[1]) });
        }
      }
    }
  }
  return sheets;
}
