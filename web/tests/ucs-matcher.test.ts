import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { matchUcs, parseUcsCsv } from "../app/ucs.ts";

const catalogPath = fileURLToPath(
  new URL("../../src/ucs_tools/data/ucs_v8.2.1.csv", import.meta.url),
);
const catalog = parseUcsCsv(readFileSync(catalogPath, "utf8"));

test("parses the complete UCS 8.2.1 public catalog", () => {
  assert.equal(catalog.length, 753);
  assert.equal(new Set(catalog.map((entry) => entry.category)).size, 82);
});

test("finds representative public UCS categories from plain language", () => {
  const cases = [
    ["crowd applauding in a theater", "CRWDApls"],
    ["automatic uzi machine gun firing", "GUNAuto"],
    ["vacuum sucking air through a hose", "AIRSuck"],
    ["sci-fi machine powering down", "SCIMach"],
  ] as const;

  for (const [query, expected] of cases) {
    const results = matchUcs(query, catalog);
    assert.equal(results[0]?.entry.catid, expected, query);
  }
});

test("returns alternatives and transparent match reasons", () => {
  const results = matchUcs("wooden front door opens", catalog);
  assert.ok(results.length >= 3);
  assert.equal(results[0]?.entry.catid, "DOORWood");
  assert.ok(results[0]?.reasons.length);
});
