import type { NetSettings } from "./settings";
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
export interface CraftObject {
  id: string;
  name: string;
  vertices: Vec3[];
  faces: number[][];
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  visible: boolean;
}
export type Primitive =
  "box" | "house" | "cylinder" | "cone" | "sphere" | "pyramid";
export interface Project {
  version: 1;
  name: string;
  objects: CraftObject[];
  seams: string[];
  settings?: NetSettings;
}
