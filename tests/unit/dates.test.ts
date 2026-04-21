import assert from "node:assert/strict";
import test from "node:test";

import { parseDateToUtc, daysUntilExpiry } from "../../src/utils/dates.ts";

// parseDateToUtc
test("parseDateToUtc returns null for null input", () => {
  assert.equal(parseDateToUtc(null), null);
});

test("parseDateToUtc returns null for 'No Expiry'", () => {
  assert.equal(parseDateToUtc("No Expiry"), null);
});

test("parseDateToUtc returns null for 'Lifetime'", () => {
  assert.equal(parseDateToUtc("Lifetime"), null);
});

test("parseDateToUtc parses DD/MM/YYYY format correctly", () => {
  const result = parseDateToUtc("01/06/2027");
  assert.ok(result instanceof Date);
  assert.equal(result.getUTCFullYear(), 2027);
  assert.equal(result.getUTCMonth(), 5); // 0-indexed
  assert.equal(result.getUTCDate(), 1);
});

test("parseDateToUtc parses ISO 8601 date string", () => {
  const result = parseDateToUtc("2026-12-31");
  assert.ok(result instanceof Date);
  assert.equal(result.getUTCFullYear(), 2026);
  assert.equal(result.getUTCMonth(), 11);
  assert.equal(result.getUTCDate(), 31);
});

test("parseDateToUtc returns null for completely invalid string", () => {
  assert.equal(parseDateToUtc("not-a-date"), null);
});

test("parseDateToUtc normalises time to midnight UTC (no time drift)", () => {
  const result = parseDateToUtc("15/03/2025");
  assert.ok(result instanceof Date);
  assert.equal(result.getUTCHours(), 0);
  assert.equal(result.getUTCMinutes(), 0);
  assert.equal(result.getUTCSeconds(), 0);
});

// daysUntilExpiry
test("daysUntilExpiry returns 0 when expiry equals today", () => {
  const today = new Date(Date.UTC(2026, 3, 21)); // 21 Apr 2026
  const expiry = new Date(Date.UTC(2026, 3, 21));
  assert.equal(daysUntilExpiry(expiry, today), 0);
});

test("daysUntilExpiry returns positive number for future date", () => {
  const today = new Date(Date.UTC(2026, 3, 21));
  const expiry = new Date(Date.UTC(2026, 3, 31)); // 10 days later
  assert.equal(daysUntilExpiry(expiry, today), 10);
});

test("daysUntilExpiry returns negative number for past date", () => {
  const today = new Date(Date.UTC(2026, 3, 21));
  const expiry = new Date(Date.UTC(2026, 3, 11)); // 10 days ago
  assert.equal(daysUntilExpiry(expiry, today), -10);
});

test("daysUntilExpiry rounds up partial days (ceiling)", () => {
  // 1.5 days in ms
  const today = new Date(Date.UTC(2026, 3, 21, 0, 0, 0));
  const expiry = new Date(today.getTime() + 36 * 60 * 60 * 1000); // +36h
  assert.equal(daysUntilExpiry(expiry, today), 2);
});
