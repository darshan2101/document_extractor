import assert from "node:assert/strict";
import test from "node:test";

import { extractJson, repairJson } from "../../src/utils/jsonRepair.ts";

test("clean JSON string returns parsed object", () => {
  const raw = '{"status":"ok","count":2}';

  assert.deepEqual(repairJson(raw), {
    status: "ok",
    count: 2
  });
});

test("JSON wrapped in fenced code block returns parsed object", () => {
  const raw = '```json\n{"status":"ok","items":["a","b"]}\n```';

  assert.deepEqual(repairJson(raw), {
    status: "ok",
    items: ["a", "b"]
  });
});

test("JSON with preamble text returns parsed object", () => {
  const raw = 'Here is the result: {"documentType":"passport","confidence":"high"}';

  assert.deepEqual(repairJson(raw), {
    documentType: "passport",
    confidence: "high"
  });
});

test("JSON with postamble text returns parsed object", () => {
  const raw = '{"holderName":"Jane Doe","rank":"Captain"} Thanks for waiting.';

  assert.deepEqual(repairJson(raw), {
    holderName: "Jane Doe",
    rank: "Captain"
  });
});

test("completely invalid string returns null", () => {
  assert.equal(repairJson("this is not json"), null);
});

test("empty string returns null", () => {
  assert.equal(repairJson(""), null);
  assert.equal(extractJson(""), null);
});

test("nested objects use outermost braces", () => {
  const raw =
    'LLM response: {"document":{"holder":{"name":"Jane Doe"}},"status":"ok"} trailing note';

  assert.equal(
    extractJson(raw),
    '{"document":{"holder":{"name":"Jane Doe"}},"status":"ok"}'
  );

  assert.deepEqual(repairJson(raw), {
    document: {
      holder: {
        name: "Jane Doe"
      }
    },
    status: "ok"
  });
});
