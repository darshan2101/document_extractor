import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { signPayload } from "../../src/utils/webhook.ts";

test("signPayload returns sha256= prefixed hex digest", () => {
  const payload = '{"jobId":"abc","status":"COMPLETE"}';
  const secret = "test-secret";

  const result = signPayload(payload, secret);

  assert.ok(result.startsWith("sha256="), "signature must start with sha256=");
  assert.equal(result.length, 71, "sha256= (7) + 64 hex chars");
});

test("signPayload is deterministic for the same inputs", () => {
  const payload = '{"jobId":"abc"}';
  const secret = "my-secret";

  assert.equal(signPayload(payload, secret), signPayload(payload, secret));
});

test("signPayload differs when payload changes", () => {
  const secret = "my-secret";

  const sig1 = signPayload('{"status":"COMPLETE"}', secret);
  const sig2 = signPayload('{"status":"FAILED"}', secret);

  assert.notEqual(sig1, sig2);
});

test("signPayload differs when secret changes", () => {
  const payload = '{"jobId":"abc"}';

  const sig1 = signPayload(payload, "secret-a");
  const sig2 = signPayload(payload, "secret-b");

  assert.notEqual(sig1, sig2);
});

test("signPayload matches manual HMAC-SHA256 calculation", () => {
  const payload = '{"jobId":"xyz","status":"COMPLETE"}';
  const secret = "production-secret";

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  assert.equal(signPayload(payload, secret), expected);
});

test("signPayload handles empty string payload", () => {
  const result = signPayload("", "secret");
  assert.ok(result.startsWith("sha256="));
  assert.equal(result.length, 71);
});
