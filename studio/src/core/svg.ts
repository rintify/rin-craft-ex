import type { NetResult, NetSettings } from "./unfold";
import type { Vec2 } from "./types";
export const LINE_COLORS = {
  cut: "#232b32",
  mountain: "#d53932",
  valley: "#226bcb",
  join: "#8c40ab",
} as const;
const escapeXML = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const round = (n: number) => Number(n.toFixed(4));
const point = (p: Vec2) => p.map(round).join(",");
const line = (a: Vec2, b: Vec2, color: string, width = 0.25) =>
  `<line x1="${round(a[0])}" y1="${round(a[1])}" x2="${round(b[0])}" y2="${round(b[1])}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" pointer-events="none"/>`;
const text = (
  p: Vec2,
  s: string,
  color = "#54606a",
  size = 2.2,
  anchor = "start",
) =>
  `<text x="${round(p[0])}" y="${round(p[1])}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" text-anchor="${anchor}">${escapeXML(s)}</text>`;
/** Shared by preview, SVG download and printing. All coordinates are physical mm. */
export function netToSVG(
  net: NetResult,
  settings: NetSettings,
  page: number,
  selection?: { objectId: string; face?: number } | null,
  interactive = false,
) {
  const sheet = net.sheets[page],
    elements: string[] = [];
  if (sheet) {
    for (const face of sheet.faces) {
      const selected =
        selection?.objectId === face.objectId &&
        selection.face === face.faceIndex;
      elements.push(
        `<polygon ${interactive ? 'role="button" tabindex="0"' : ""} aria-label="面 ${face.faceIndex + 1}" data-object="${escapeXML(face.objectId)}" data-face="${face.faceIndex}" points="${face.points.map(point).join(" ")}" fill="${selected ? "#f7eae3" : "white"}"/>`,
      );
    }
    for (const l of sheet.lines)
      elements.push(line(l.a, l.b, LINE_COLORS[l.kind]));
    for (const l of sheet.joins)
      elements.push(line(l.a, l.b, LINE_COLORS.join, 0.15));
    for (const mark of sheet.marks) {
      const [x, y] = mark.point;
      elements.push(
        line([x - 2, y], [x + 2, y], LINE_COLORS.join, 0.3),
        line([x, y - 2], [x, y + 2], LINE_COLORS.join, 0.3),
      );
      const right = x < net.width / 2;
      elements.push(
        text(
          [x + (right ? 3 : -3), y - 2.5],
          mark.id,
          LINE_COLORS.join,
          2,
          right ? "start" : "end",
        ),
      );
    }
    for (const c of sheet.captions) elements.push(text(c.point, c.text));
  }
  const y = net.height - 5;
  elements.push(
    text(
      [settings.margin, y],
      `${settings.scale}% · ${page + 1} / ${net.pages}`,
    ),
  );
  for (const [i, kind, label] of [
    [0, "cut", "切断"],
    [1, "mountain", "山折り"],
    [2, "valley", "谷折り"],
  ] as const) {
    const x = net.width / 2 - 35 + i * 23;
    elements.push(
      line([x, y - 1], [x + 5, y - 1], LINE_COLORS[kind]),
      text([x + 7, y], label),
    );
  }
  elements.push(
    line(
      [net.width - settings.margin - 20, net.height - 8],
      [net.width - settings.margin, net.height - 8],
      "#54606a",
    ),
    text(
      [net.width - settings.margin - 10, net.height - 9],
      "20 mm",
      "#54606a",
      2,
      "middle",
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${net.width}mm" height="${net.height}mm" viewBox="0 0 ${net.width} ${net.height}" role="${interactive ? "group" : "img"}" aria-label="展開図 ${page + 1}ページ"><rect width="100%" height="100%" fill="white"/>${elements.join("")}</svg>`;
}
