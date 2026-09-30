const vector = {
  type: "array",
  items: { type: "number", minimum: -100000, maximum: 100000 },
  minItems: 3,
  maxItems: 3,
};
export const objectSchema = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    name: { type: "string", maxLength: 200 },
    vertices: { type: "array", items: vector, minItems: 3, maxItems: 4000 },
    faces: {
      type: "array",
      items: {
        type: "array",
        items: { type: "integer", minimum: 0 },
        minItems: 3,
        maxItems: 512,
      },
      minItems: 1,
      maxItems: 1200,
    },
    position: vector,
    rotation: vector,
    scale: {
      ...vector,
      items: { type: "number", minimum: 0.01, maximum: 1000 },
    },
    visible: { type: "boolean" },
  },
  required: [
    "id",
    "name",
    "vertices",
    "faces",
    "position",
    "rotation",
    "scale",
    "visible",
  ],
  additionalProperties: false,
};
export const settingsSchema = {
  type: "object",
  properties: {
    paper: { enum: ["A4", "A3", "Letter"] },
    landscape: { type: "boolean" },
    scale: { type: "number", minimum: 5, maximum: 500 },
    microEdgeLength: { type: "number", minimum: 0.01, maximum: 20 },
    margin: { type: "number", minimum: 5, maximum: 30 },
  },
  additionalProperties: false,
};
export const projectSchema = {
  type: "object",
  properties: {
    version: { const: 1 },
    name: { type: "string", maxLength: 200 },
    objects: { type: "array", items: objectSchema, maxItems: 40 },
    seams: { type: "array", items: { type: "string" }, maxItems: 5000 },
    settings: settingsSchema,
  },
  required: ["version", "name", "objects", "seams"],
  additionalProperties: false,
};
const operation = (type: string, properties: object, required: string[]) => ({
  type: "object",
  properties: { type: { const: type }, ...properties },
  required: ["type", ...required],
  additionalProperties: false,
});
export const batchSchema = {
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 100 },
    operations: {
      type: "array",
      minItems: 1,
      maxItems: 80,
      items: {
        oneOf: [
          operation("put", { object: objectSchema }, ["object"]),
          operation("remove", { id: { type: "string" } }, ["id"]),
          operation(
            "transform",
            {
              id: { type: "string" },
              position: vector,
              rotation: vector,
              scale: {
                ...vector,
                items: { type: "number", minimum: 0.01, maximum: 1000 },
              },
            },
            ["id"],
          ),
          operation("settings", { settings: settingsSchema }, ["settings"]),
          operation("rename", { name: { type: "string", maxLength: 200 } }, [
            "name",
          ]),
          operation(
            "seams",
            { seams: { type: "array", items: { type: "string" } } },
            ["seams"],
          ),
        ],
      },
    },
  },
  required: ["label", "operations"],
  additionalProperties: false,
};
