import packageInfo from "../package.json" with { type: "json" };
import { REVISION_PATTERN } from "./twin-store.js";

export const SERVER_VERSION = packageInfo.version;
const expectedRevision = {
  type: "string", pattern: REVISION_PATTERN,
  description: "Optional content revision from a read with include_revision=true. A conflict rejects the write; re-read before retrying. Without it, writes preserve concurrent unrelated paths; the last write to the same path wins.",
};

export const CORE_TOOLS = [
  {
    name: "describe_by_path",
    description: "Describe the digital twin metamodel: categories, groups and indicators. Empty path or '/' lists categories.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Metamodel path in dot or slash notation" } },
    },
  },
  {
    name: "read_digital_twin",
    description: "Read the current user's digital twin by path. All four categories are readable. Empty path or '/' reads the root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Data path in dot or slash notation" },
        include_revision: { type: "boolean", description: "If true, return {data, revision}; otherwise preserve the legacy value-only response" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_digital_twin",
    description: "Write a path under 1_declarative. Other categories are system-only. Compatibility: a string holding a JSON object or array is decoded into that structure, except at metamodel indicators whose format is not structured (text, number, date, time, enum), where it is stored as text; any other string (\"42\", \"true\", \"null\") is stored as text.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Writable data path under 1_declarative" },
        data: { type: ["object", "array", "string", "number", "boolean", "null"], description: "Data to write" },
        expected_revision: expectedRevision,
      },
      required: ["path", "data"],
    },
  },
];
