import type { Project } from "../src/core/types";
import { prism, mirrored } from "../src/core/meshBuilder";
import { defaultSettings } from "../src/core/settings";
import { validateProject } from "../src/core/project";

/** RX-78-2-inspired fan model. X right, Y up, Z front; all dimensions in millimeters. */
export function gundamHead(): Project {
  const helmet = prism(
    "P01",
    "P01 ヘルメット",
    [
      [-32, 25],
      [32, 25],
      [43, 44],
      [43, 80],
      [27, 103],
      [-27, 103],
      [-43, 80],
      [-43, 44],
    ],
    -28,
    18,
  );
  // Rear taper keeps all side panels planar (uniform scaling about the outline center).
  helmet.vertices.slice(8).forEach((p) => {
    p[0] *= 0.86;
    p[1] = 64 + (p[1] - 64) * 0.86;
  });

  const mask = prism(
    "P02",
    "P02 フェイスマスク",
    [
      [-17, 36],
      [17, 36],
      [27, 59],
      [14, 66],
      [-14, 66],
      [-27, 59],
    ],
    18,
    35,
  );

  const chin = prism(
    "P03",
    "P03 あご",
    [
      [-8, 25],
      [8, 25],
      [11, 39],
      [-11, 39],
    ],
    35,
    44,
  );
  const crest = prism(
    "P04",
    "P04 センサー",
    [
      [-9, 88],
      [9, 88],
      [8, 110],
      [-8, 110],
    ],
    18,
    27,
  );

  const fin = prism(
    "P05",
    "P05 Vアンテナ 右",
    [
      [7, 84],
      [16, 85],
      [65, 126],
      [46, 118],
    ],
    18,
    27,
  );
  const finL = mirrored(fin, "P06", "P06 Vアンテナ 左");
  const badge = prism(
    "P07",
    "P07 額の装甲",
    [
      [-7, 80],
      [7, 80],
      [9, 93],
      [-9, 93],
    ],
    27,
    35,
  );
  const cheek = prism(
    "P08",
    "P08 頬の装甲 右",
    [
      [24, 34],
      [37, 30],
      [47, 43],
      [42, 66],
      [32, 64],
    ],
    18,
    29,
  );
  const cheekL = mirrored(cheek, "P09", "P09 頬の装甲 左");
  const ear = prism(
    "P10",
    "P10 耳の装甲 右",
    [
      [42, 52],
      [54, 52],
      [54, 77],
      [42, 77],
    ],
    -12,
    10,
  );
  ear.vertices.slice(4).forEach((p) => (p[0] -= 22 * (6.02 / 46)));

  const earL = mirrored(ear, "P11", "P11 耳の装甲 左");
  const neck = prism(
    "P12",
    "P12 台座・首",
    [
      [-19, 0],
      [19, 0],
      [19, 25],
      [-19, 25],
    ],
    -15,
    10,
  );
  neck.vertices
    .filter((p) => p[1] === 25)
    .forEach((p) => (p[1] = 25 + ((18 - p[2]) * 5.46) / 46));
  const eye = prism(
    "P13",
    "目 右",
    [
      [5, 72],
      [24, 75],
      [20, 69],
      [7, 67],
    ].reverse() as [number, number][],
    18,
    21,
  );
  const eyeL = mirrored(eye, "P14", "目 左");
  const objects = [
    eye,
    eyeL,
    helmet,
    mask,
    chin,
    crest,
    fin,
    finL,
    badge,
    cheek,
    cheekL,
    ear,
    earL,
    neck,
  ];
  return validateProject({
    version: 1,
    name: "RX-78-2 ガンダム・ヘッド",
    objects,
    seams: ["P01:11-12", "P05:2-3", "P06:2-3"],
    settings: { ...defaultSettings },
  });
}
