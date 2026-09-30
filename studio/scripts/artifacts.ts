import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";
import type { Project } from "../src/core/types";
import { defaultSettings, generateNet } from "../src/core/unfold";
import { validateProject } from "../src/core/project";
import { inspectProject } from "../src/core/diagnostics";
import { netToSVG } from "../src/core/svg";
import { toOBJ } from "../src/core/obj";

export async function writeArtifacts(input: Project, destination: string) {
  const project = validateProject(input),
    settings = project.settings ?? defaultSettings;
  const net = generateNet(project, settings),
    report = inspectProject(project, settings, net);
  const out = resolve(destination);
  await mkdir(out, { recursive: true });
  await writeFile(
    resolve(out, "inspection.json"),
    JSON.stringify(report, null, 2),
  );
  if (!report.valid) throw Error(report.errors.join("\n"));
  const files: Record<string, Uint8Array> = {};
  files["model.fold.json"] = strToU8(JSON.stringify(project, null, 2));
  files["model.obj"] = strToU8(toOBJ(project));
  const pages = Array.from({ length: net.pages }, (_, page) =>
    netToSVG(net, settings, page),
  );
  for (let page = 0; page < pages.length; page++)
    files[`net-${page + 1}.svg`] = strToU8(pages[page]);
  files["print.html"] = strToU8(
    `<!doctype html><html lang="ja"><meta charset="utf-8"><title>FOLD · Print at 100%</title><style>@page{size:${net.width}mm ${net.height}mm;margin:0}body{margin:0;background:#dce2df}svg{display:block;width:${net.width}mm;height:${net.height}mm;break-after:page;background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}svg:last-child{break-after:auto}</style>${pages.join("")}</html>`,
  );
  for (const [name, data] of Object.entries(files))
    await writeFile(resolve(out, name), data);
  await writeFile(resolve(out, "net.json"), JSON.stringify(net));
  await writeFile(resolve(out, "papercraft.zip"), zipSync(files));
  return { out, ...report };
}
