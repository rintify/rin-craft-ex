import { writeFile } from "node:fs/promises";
import { projectSchema, batchSchema } from "../src/core/schema";
for (const [name, schema] of [
  ["project", projectSchema],
  ["edit", batchSchema],
] as const)
  await writeFile(
    `public/${name}.schema.json`,
    JSON.stringify(
      { $schema: "https://json-schema.org/draft/2020-12/schema", ...schema },
      null,
      2,
    ),
  );
