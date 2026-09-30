export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PackedRectangle extends Rectangle {
  page: number;
  rotated: boolean;
}
const contains = (a: Rectangle, b: Rectangle) =>
  a.x <= b.x + 1e-6 &&
  a.y <= b.y + 1e-6 &&
  a.x + a.width >= b.x + b.width - 1e-6 &&
  a.y + a.height >= b.y + b.height - 1e-6;
/** MaxRects packing; placement changes orientation and position, never physical scale. */
export function packRectangles(
  sizes: { width: number; height: number }[],
  width: number,
  height: number,
  gap = 5,
  caption = 5,
) {
  const pages: Rectangle[][] = [];
  const placements: PackedRectangle[] = [];
  for (const size of sizes) {
    let best:
      | {
          page: number;
          rect: Rectangle;
          rotated: boolean;
          score: number;
          width: number;
          height: number;
        }
      | undefined;
    const options = [
      {
        width: size.width,
        height: size.height + caption,
        rotated: false,
      },
      {
        width: size.height,
        height: size.width + caption,
        rotated: true,
      },
    ];
    const search = (page: number) => {
      for (const rect of pages[page])
        for (const option of options) {
          if (
            option.width > rect.width + 1e-6 ||
            option.height > rect.height + 1e-6
          )
            continue;
          const score =
            Math.min(rect.width - option.width, rect.height - option.height) *
              10000 +
            rect.width * rect.height -
            option.width * option.height;
          if (!best || score < best.score)
            best = { page, rect, score, ...option };
        }
    };
    pages.forEach((_, page) => search(page));
    if (!best) {
      pages.push([{ x: 0, y: 0, width, height }]);
      search(pages.length - 1);
    }
    if (!best) {
      placements.push({ x: 0, y: 0, ...options[0], page: pages.length - 1 });
      continue;
    }
    const chosen = best as NonNullable<typeof best>;
    const placed = {
      x: chosen.rect.x,
      y: chosen.rect.y,
      width: chosen.width,
      height: chosen.height,
      page: chosen.page,
      rotated: chosen.rotated,
    };
    placements.push(placed);
    const used = {
      ...placed,
      width: placed.width + gap,
      height: placed.height + gap,
    };
    const free = pages[chosen.page].flatMap((rect) => {
      if (
        used.x >= rect.x + rect.width ||
        used.x + used.width <= rect.x ||
        used.y >= rect.y + rect.height ||
        used.y + used.height <= rect.y
      )
        return [rect];
      const parts: Rectangle[] = [];
      if (used.x > rect.x) parts.push({ ...rect, width: used.x - rect.x });
      if (used.y > rect.y) parts.push({ ...rect, height: used.y - rect.y });
      if (used.x + used.width < rect.x + rect.width)
        parts.push({
          ...rect,
          x: used.x + used.width,
          width: rect.x + rect.width - used.x - used.width,
        });
      if (used.y + used.height < rect.y + rect.height)
        parts.push({
          ...rect,
          y: used.y + used.height,
          height: rect.y + rect.height - used.y - used.height,
        });
      return parts;
    });
    pages[chosen.page] = free.filter(
      (rect, i) =>
        !free.some(
          (other, j) =>
            i !== j &&
            contains(other, rect) &&
            (!contains(rect, other) || j < i),
        ),
    );
  }
  return placements;
}
