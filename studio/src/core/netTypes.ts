import type { Vec2 } from "./types";
export interface NetFace {
  objectId: string;
  faceIndex: number;
  points: Vec2[];
}
export interface NetLine {
  a: Vec2;
  b: Vec2;
  kind: "cut" | "mountain" | "valley";
  edgeId: string;
}
/** Full-size connected geometry, independent of paper layout. */
export interface NetIsland {
  id: number;
  name: string;
  faces: NetFace[];
  lines: NetLine[];
  width: number;
  height: number;
}
export interface RegistrationMark {
  id: string;
  point: Vec2;
  source: Vec2;
  islandId: number;
}
export interface NetSheet {
  faces: NetFace[];
  lines: NetLine[];
  marks: RegistrationMark[];
  joins: { a: Vec2; b: Vec2 }[];
  captions: { point: Vec2; text: string }[];
  tile?: {
    islandId: number;
    column: number;
    row: number;
    columns: number;
    rows: number;
    origin: Vec2;
  };
}
export interface NetResult {
  islands: NetIsland[];
  sheets: NetSheet[];
  pages: number;
  width: number;
  height: number;
  warnings: string[];
  errors: string[];
  faceCount: number;
}
