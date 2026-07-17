#!/usr/bin/env node
// Verify the new-stack dataset import/export logic (synthetic-data rider
// D-b, jta-synthetic-post-v1-design.md §4.4) — the pure datasetTransfer.js
// half the wrapper panel's toolbar wraps.
//
//   1. Round-trip fixed point on the committed vanilla fixture:
//      import(text) -> export -> import -> export is byte-stable, nothing
//      restamps, and the first export reproduces the committed bytes.
//   2. Same fixed point on a GENERATED synthetic document.
//   3. A hand-edited document restamps deterministically to a NEW id
//      (same edit twice -> same id) and validates.
//   4. Broken inputs are refused with errors (bad JSON, non-object,
//      behavior-slot violation).
//
// Usage: node scripts/procgen/verify-jta-dataset-transfer.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const wrapDir = path.join(repoRoot, "frontend/modules/jtaSubstrateWrapper");

const { importDatasetText, exportDatasetText } = await import(pathToFileURL(path.join(wrapDir, "datasetTransfer.js")));
const { generateJtaDataset } = await import(pathToFileURL(path.join(wrapDir, "generateDataset.js")));

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${msg}`);
  if (!cond) failures++;
};

function roundTrip(label, text, { expectCommittedBytes = false } = {}) {
  const r1 = importDatasetText(text);
  ok(r1.ok === true, `${label}: import ok${r1.ok ? "" : ` (${r1.errors.join("; ")})`}`);
  if (!r1.ok) return;
  ok(r1.restamped === false, `${label}: clean document does not restamp`);
  const e1 = exportDatasetText(r1.doc);
  if (expectCommittedBytes) {
    ok(e1 === text, `${label}: export reproduces the committed bytes`);
  }
  const r2 = importDatasetText(e1);
  ok(r2.ok === true && r2.restamped === false, `${label}: re-import ok, no restamp`);
  const e2 = exportDatasetText(r2.doc);
  ok(e1 === e2, `${label}: import -> export -> import is a byte-stable fixed point`);
  ok(r2.doc.dataset_id === r1.doc.dataset_id, `${label}: dataset_id stable (${r1.doc.dataset_id})`);
}

// 1 — committed vanilla fixture (and its raw twin).
const vanillaText = fs.readFileSync(path.join(wrapDir, "datasets/vanilla.json"), "utf8");
roundTrip("vanilla fixture", vanillaText, { expectCommittedBytes: true });
roundTrip("raw twin", fs.readFileSync(path.join(wrapDir, "datasets/vanilla-raw.json"), "utf8"), { expectCommittedBytes: true });

// 2 — generated synthetic document.
const profile = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "CC/scripts/jta-stats/results/vanilla-profile.json"), "utf8")).static;
const { dataset: synthetic } = generateJtaDataset({
  seed: 1, profile, vanilla: JSON.parse(vanillaText), params: {},
});
roundTrip("synthetic doc", exportDatasetText(synthetic));

// 3 — hand-edited document restamps deterministically.
{
  const edit = (t) => {
    const doc = JSON.parse(t);
    doc.zones[0].tasks[1].cost_multiplier *= 2;
    return JSON.stringify(doc);
  };
  const a = importDatasetText(edit(vanillaText));
  const b = importDatasetText(edit(vanillaText));
  ok(a.ok === true && a.restamped === true, `edited doc: restamped on import`);
  if (a.ok && b.ok) {
    const origId = JSON.parse(vanillaText).dataset_id;
    ok(a.doc.dataset_id !== origId, `edited doc: new id (${a.doc.dataset_id})`);
    ok(a.doc.dataset_id === b.doc.dataset_id, `edited doc: restamp is deterministic`);
    ok(a.doc.dataset_id.endsWith(`-${a.doc.provenance.content_hash}`), `edited doc: id carries the fresh content hash`);
  }
}

// 4 — broken inputs are refused.
{
  ok(importDatasetText("{not json").ok === false, "broken: invalid JSON refused");
  ok(importDatasetText("[1,2,3]").ok === false, "broken: non-object refused");
  const doc = JSON.parse(vanillaText);
  // A live entry occupying a behavior slot must declare it — clear one.
  const slotted = doc.perks.findIndex((p) => p && p.behavior);
  doc.perks[slotted].behavior = null;
  const r = importDatasetText(JSON.stringify(doc));
  ok(r.ok === false, `broken: behavior-slot violation refused (${r.ok ? "accepted!" : r.errors[0]})`);
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll dataset-transfer assertions passed.");
