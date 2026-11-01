import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeAndRead } from "./http-write-harness.js";

describe("HTTP write decodes only JSON objects and arrays held in strings", () => {
  it("keeps scalar-looking strings as text", { timeout: 10000 }, async (t) => {
    const stored = await writeAndRead(t, [
      ["count", "42"], ["decimal", "4.20"], ["flag", "true"], ["empty", "null"], ["quoted", "\"text\""],
    ]);
    assert.deepEqual(stored, { count: "42", decimal: "4.20", flag: "true", empty: "null", quoted: "\"text\"" });
  });

  it("still stores a stringified object or array as the structure it encodes", { timeout: 10000 }, async (t) => {
    const stored = await writeAndRead(t, [
      ["goals", "{\"learning\":[\"a\"]}"], ["items", "[1, 2]"],
    ]);
    assert.deepEqual(stored, { goals: { learning: ["a"] }, items: [1, 2] });
  });

  it("leaves non-string values untouched", { timeout: 10000 }, async (t) => {
    const stored = await writeAndRead(t, [["n", 7], ["b", false], ["o", { k: "v" }]]);
    assert.deepEqual(stored, { n: 7, b: false, o: { k: "v" } });
  });
});
