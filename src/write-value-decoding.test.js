import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeAndRead, writeThenRead } from "./http-write-harness.js";

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

  it("keeps JSON-looking text at metamodel indicators with a non-structured format (F3)", { timeout: 10000 }, async (t) => {
    // 02_Имя is string, 09_Цели обучения structured_text, 19_Недельный бюджет времени float.
    const { stored, read } = await writeThenRead(t, [
      ["1_1_profile.02_Имя", "[1, 2]"],
      ["1_2_goals.09_Цели обучения", "{\"draft\": true}"],
      ["1_3_selfeval.19_Недельный бюджет времени", "[5]"],
    ], ["1_1_profile.02_Имя", "1_2_goals", "1_3_selfeval"]);
    assert.deepEqual(stored["1_1_profile"], { "02_Имя": "[1, 2]" });
    assert.equal(stored["1_2_goals"]["09_Цели обучения"], "{\"draft\": true}");
    assert.equal(stored["1_3_selfeval"]["19_Недельный бюджет времени"], "[5]");
    assert.equal(read["1_1_profile.02_Имя"], "[1, 2]");
    assert.equal(JSON.parse(read["1_2_goals"])["09_Цели обучения"], "{\"draft\": true}");
    assert.equal(JSON.parse(read["1_3_selfeval"])["19_Недельный бюджет времени"], "[5]");
  });

  it("still decodes a stringified structure at structured-format indicators", { timeout: 10000 }, async (t) => {
    // 05_Интересующие области is list[string], 12_Текущие роли structured_object.
    const { stored, read } = await writeThenRead(t, [
      ["1_2_goals.05_Интересующие области", "[\"a\", \"b\"]"],
      ["1_3_selfeval.12_Текущие роли", "{\"Learner\": {\"stage\": \"x\"}}"],
    ], ["1_2_goals.05_Интересующие области"]);
    assert.deepEqual(stored["1_2_goals"]["05_Интересующие области"], ["a", "b"]);
    assert.deepEqual(stored["1_3_selfeval"]["12_Текущие роли"], { Learner: { stage: "x" } });
    assert.deepEqual(JSON.parse(read["1_2_goals.05_Интересующие области"]), ["a", "b"]);
  });
});
