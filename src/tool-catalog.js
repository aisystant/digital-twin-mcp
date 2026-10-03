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
    description: "Write a path under 1_declarative. Other categories are system-only. Compatibility: HTTP parses JSON-encoded strings in data; stdio stores string values literally.",
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

// These trusted local capabilities are deliberately not exposed over HTTP.
export const STDIO_EXTRA_TOOLS = [
  {
    name: "dt_get_profile_rcs",
    description: "Get the learner's seven-slot RCS profile; returns null when no profile exists.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dt_update_profile_rcs",
    description: "Merge a partial RCS profile update after diagnosis or profiling. Local system capability.",
    inputSchema: {
      type: "object",
      properties: {
        worldview: { type: "number", description: "Worldview score 1-5" },
        m1_focus: { type: "number", description: "Self-development methods score 1-5" },
        m2_iwe: { type: "number", description: "IWE/ORZ score 1-5" },
        m3_domain: { type: "number", description: "Domain knowledge score 1-5" },
        m4_systems: { type: "number", description: "Systems thinking score 1-5" },
        it_level: { type: "number", description: "IT tools score 1-5" },
        agency: { type: "number", description: "Agency score 1-5" },
        bottleneck: { type: "string" },
        stage_derived: { type: "number" },
        source: { type: "string" },
        expected_revision: expectedRevision,
      },
    },
  },
  {
    name: "dt_snapshot_rcs",
    description: "Append the current RCS profile to history, keeping the latest 52 snapshots. Local system capability.",
    inputSchema: { type: "object", properties: { expected_revision: expectedRevision } },
  },
  {
    name: "dt_get_cp_profile",
    description: "Get the latest cp-profile from learning.cp_assessments. Returns null when absent or expired (six-month TTL).",
    inputSchema: {
      type: "object",
      properties: { only_valid: { type: "boolean", description: "Defaults to true; false also returns expired assessments" } },
    },
  },
];

export const STDIO_TOOLS = [...CORE_TOOLS, ...STDIO_EXTRA_TOOLS];
