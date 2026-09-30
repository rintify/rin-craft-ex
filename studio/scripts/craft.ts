import { readFile, writeFile } from "node:fs/promises";
import { validateProject } from "../src/core/project";
import { inspectProject } from "../src/core/diagnostics";
import { defaultSettings } from "../src/core/settings";
import { applyCommands } from "../src/core/commands";
import { writeArtifacts } from "./artifacts";
const [command, source, arg, destination] = process.argv.slice(2);
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
try {
  if (!source || !["inspect", "export", "apply"].includes(command))
    throw Error(
      "Usage: npm run craft -- inspect model.fold.json | export model.fold.json output-dir | apply model.fold.json edits.json result.fold.json",
    );
  const project = validateProject(await json(source));
  if (command === "inspect") {
    const report = inspectProject(project, project.settings ?? defaultSettings);
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  }
  if (command === "export") {
    if (!arg) throw Error("Output directory required.");
    console.log(JSON.stringify(await writeArtifacts(project, arg), null, 2));
  }
  if (command === "apply") {
    if (!arg || !destination) throw Error("Batch and destination required.");
    const next = applyCommands(project, await json(arg));
    await writeFile(destination, JSON.stringify(next, null, 2));
    console.log(
      JSON.stringify({ output: destination, objects: next.objects.length }),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
