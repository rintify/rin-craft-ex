import type { Primitive } from "../core/types";
const paths: Record<Primitive, string[]> = {
  box: ["M32 8 53 20v25L32 57 11 45V20L32 8Z", "m11 20 21 12 21-12M32 32v25"],
  house: [
    "M10 30 23 12 41 6 54 24v20L36 54 10 42V30Z",
    "m23 12 13 20 18-8M36 32v22M10 30l26 2",
  ],
  cylinder: [
    "M12 18c0-13 40-13 40 0v30c0 13-40 13-40 0V18Z",
    "M12 18c0 13 40 13 40 0",
    "M12 48c0-13 40-13 40 0",
  ],
  cone: ["M32 7 9 48c0 13 46 13 46 0L32 7Z", "M9 48c0-13 46-13 46 0"],
  sphere: [
    "M32 6 50 16l8 21-14 18H20L6 37l8-21L32 6Z",
    "m32 6 12 23 6-13M44 29l14 8-14 18V29L20 29 6 37m14-8-6-13m6 13v26m0-26L32 6",
  ],
  pyramid: ["m32 7 24 36-24 15L8 43 32 7Z", "M32 7v51M8 43l24-12 24 12"],
};
export function ShapeGlyph({ kind }: { kind: Primitive }) {
  return (
    <svg
      className="shape-glyph"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind].map((d, i) => (
        <path key={d} d={d} opacity={i ? 0.6 : 1} />
      ))}
    </svg>
  );
}
