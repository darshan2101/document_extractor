import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { hashFile } from "../../src/utils/hashFile.ts";

test("hashFile returns a 64-character hex string", () => {
  const buf = Buffer.from("hello world");
  const result = hashFile(buf);

  assert.equal(typeof result, "string");
  assert.equal(result.length, 64);
  assert.ok(/^[0-9a-f]+$/.test(result), "must be lowercase hex");
});

test("hashFile is deterministic for the same buffer", () => {
  const buf = Buffer.from("seafarer-document");
  assert.equal(hashFile(buf), hashFile(buf));
});

test("hashFile differs for different buffers", () => {
  const h1 = hashFile(Buffer.from("document-a"));
  const h2 = hashFile(Buffer.from("document-b"));
  assert.notEqual(h1, h2);
});

test("hashFile matches manual SHA-256 calculation", () => {
  const buf = Buffer.from("peme-cert-2025");
  const expected = createHash("sha256").update(buf).digest("hex");
  assert.equal(hashFile(buf), expected);
});

test("hashFile handles empty buffer", () => {
  const result = hashFile(Buffer.alloc(0));
  assert.equal(result.length, 64);
});

test("identical content in different buffers produces the same hash", () => {
  const content = "same-content";
  const buf1 = Buffer.from(content, "utf8");
  const buf2 = Buffer.from(content, "utf8");
  assert.equal(hashFile(buf1), hashFile(buf2));
});
