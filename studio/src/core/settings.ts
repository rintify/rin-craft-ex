export interface NetSettings {
  paper: "A4" | "A3" | "Letter";
  landscape: boolean;
  scale: number;
  margin: number;
  microEdgeLength: number;
}
export const defaultSettings: NetSettings = {
  paper: "A4",
  landscape: false,
  scale: 100,
  margin: 10,
  microEdgeLength: 1,
};
/** Keep only supported settings when opening older documents. */
export function validateSettings(value: unknown): NetSettings {
  if (!value || typeof value !== "object")
    throw Error("用紙設定の形式が正しくありません。");
  const input = value as Partial<NetSettings>;
  const s: NetSettings = {
    paper: input.paper!,
    landscape: input.landscape!,
    scale: input.scale!,
    margin: input.margin!,
    microEdgeLength: input.microEdgeLength ?? 1,
  };
  const range = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (
    !["A4", "A3", "Letter"].includes(s.paper) ||
    typeof s.landscape !== "boolean" ||
    !range(s.scale, 5, 500) ||
    !range(s.margin, 5, 30) ||
    !range(s.microEdgeLength, 0.01, 20)
  )
    throw Error("用紙設定または微小辺の基準が範囲外です。");
  return s;
}
