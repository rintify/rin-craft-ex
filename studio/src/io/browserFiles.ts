import { zipSync, strToU8 } from "fflate";
import { netToSVG } from "../core/svg";
import { toOBJ, type Project } from "../core/model";
import type { NetResult, NetSettings } from "../core/unfold";
export function download(
  name: string,
  data: string | Uint8Array,
  mime: string,
) {
  const blob = new Blob(
      [typeof data === "string" ? data : new Uint8Array(data)],
      { type: mime },
    ),
    url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const filename = (name: string) =>
  name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100) ||
  "fold-project";
export const saveProject = (project: Project) =>
  download(
    `${filename(project.name)}.fold.json`,
    JSON.stringify(project, null, 2),
    "application/json",
  );
export const exportOBJ = (project: Project) =>
  download(`${filename(project.name)}.obj`, toOBJ(project), "text/plain");
export function exportSVG(net: NetResult, settings: NetSettings, name: string) {
  if (net.errors.length || !net.pages)
    throw Error("出力できる展開図がありません。");
  if (net.pages === 1) {
    download(
      `${filename(name)}.svg`,
      netToSVG(net, settings, 0),
      "image/svg+xml",
    );
    return;
  }
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < net.pages; i++)
    files[`${filename(name)}-${i + 1}.svg`] = strToU8(
      netToSVG(net, settings, i),
    );
  download(`${filename(name)}-展開図.zip`, zipSync(files), "application/zip");
}
