import { writeFile } from "node:fs/promises";
import { gundamHead } from "../examples/gundam-head";
import { writeArtifacts } from "./artifacts";
const project = gundamHead();
const report = await writeArtifacts(
  project,
  process.argv[2] ?? "../outputs/gundam-head",
);
await writeFile(
  "public/examples/gundam-head.fold.json",
  JSON.stringify(project),
);
console.log(JSON.stringify(report, null, 2));
