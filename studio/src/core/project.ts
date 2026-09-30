import { validateSettings, defaultSettings } from "./settings";
import type { CraftObject, Project } from "./types";
import { clone } from "./shared";
import { normal, projectFace, v3, worldVertices } from "./geometry";
import { forbiddenTriangles } from "./surfaces";
export function initialProject(): Project {
  return { version: 1, name: "名称未設定", objects: [], seams: [] };
}
export function validateProject(data: unknown): Project {
  const p = data as Project;
  if (
    !p ||
    p.version !== 1 ||
    typeof p.name !== "string" ||
    p.name.length > 200 ||
    !Array.isArray(p.objects) ||
    p.objects.length > 40
  )
    throw Error("FOLD のプロジェクトファイルではありません。");
  const settings = p.settings
    ? validateSettings(p.settings)
    : { ...defaultSettings };
  const ids = new Set<string>();
  let totalFaces = 0;
  const vec = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (n) =>
        typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100000,
    );
  const objects = p.objects.map((raw) => {
    if (
      !raw ||
      typeof raw.id !== "string" ||
      !raw.id.length ||
      raw.id.length > 100 ||
      ids.has(raw.id) ||
      typeof raw.name !== "string" ||
      raw.name.length > 200 ||
      typeof raw.visible !== "boolean" ||
      !Array.isArray(raw.vertices) ||
      !Array.isArray(raw.faces) ||
      raw.vertices.length < 3 ||
      raw.vertices.length > 4000 ||
      raw.faces.length < 1
    )
      throw Error("モデルの形式が正しくありません。");
    ids.add(raw.id);
    if (
      !raw.vertices.every(vec) ||
      ![raw.position, raw.rotation, raw.scale].every(vec) ||
      raw.scale.some((n) => n < 0.01 || n > 1000)
    )
      throw Error("座標や倍率が範囲外です。");
    for (const f of raw.faces) {
      if (
        !Array.isArray(f) ||
        f.length < 3 ||
        f.length > 512 ||
        new Set(f).size !== f.length ||
        !f.every(
          (i) => Number.isInteger(i) && i >= 0 && i < raw.vertices.length,
        ) ||
        normal(raw.vertices, f).lengthSq() < 0.5
      )
        throw Error("面に不正な頂点または面積ゼロの面があります。");
      const n = normal(raw.vertices, f),
        origin = v3(raw.vertices[f[0]]);
      if (
        f.some((i) => Math.abs(v3(raw.vertices[i]).sub(origin).dot(n)) > 1e-5)
      )
        throw Error("平面でない面があります。三角形に分割してください。");
      const points = projectFace(raw.vertices, f);
      let positive = false,
        negative = false;
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length],
          c = points[(i + 2) % points.length],
          cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        positive ||= cross > 1e-6;
        negative ||= cross < -1e-6;
      });
      if (positive && negative)
        throw Error("凹面があります。三角形に分割してください。");
    }
    // Explicit projection strips obsolete properties from older local files.
    const object: CraftObject = {
      id: raw.id,
      name: raw.name,
      vertices: clone(raw.vertices),
      faces: clone(raw.faces),
      position: [...raw.position],
      rotation: [...raw.rotation],
      scale: [...raw.scale],
      visible: raw.visible,
    };
    const invalid = forbiddenTriangles(
      worldVertices(object),
      object.faces,
      settings.microEdgeLength,
    );
    if (invalid.length)
      throw Error(
        `${object.name}：面 ${invalid[0] + 1} は ${settings.microEdgeLength}mm以下の辺が2本以上あります。微小三角形を修正してください。`,
      );
    totalFaces += object.faces.length;
    return object;
  });
  if (totalFaces > 1200)
    throw Error("合計1,200面以下のモデルを使用してください。");
  if (
    !Array.isArray(p.seams) ||
    p.seams.length > 5000 ||
    !p.seams.every((s) => typeof s === "string" && s.length < 150)
  )
    throw Error("切り開き線の形式が正しくありません。");
  return { version: 1, name: p.name, objects, seams: [...p.seams], settings };
}
