// New-stack in-UI dataset import/export — the PURE half (synthetic-data
// rider D-b, jta-synthetic-post-v1-design.md §4.4). The wrapper panel's
// toolbar is thin DOM glue over these two functions, so the round-trip
// gate (import → export → import fixed point) runs headless in
// scripts/procgen/verify-jta-dataset-transfer.mjs.
//
// Import semantics: parse → restamp the content-hash identity if the
// document was hand-edited (or never stamped) → authoritative validation.
// Restamping BEFORE validation mirrors the datasetValidator CLI's --restamp:
// an edited document is welcome, but it must re-enter under a fresh
// dataset_id or it would poison the (seed, dataset_id) solve cache and the
// dataset-keyed save slot.
//
// Export semantics: the DOCUMENT, not the mutated live state — task cost
// patches etc. are applied to live definitions, never written back to the
// doc, so export(import(text)) is byte-identical by construction. The
// serialization matches export-vanilla-dataset.mjs (2-space indent,
// trailing newline), so exporting an unedited committed fixture reproduces
// the committed bytes.
//
// Headless-safe: no DOM, no fs.

import {
  validateJtaDataset,
  computeDatasetContentHash,
  stampDatasetIdentity,
} from "./datasetValidator.js";

/**
 * Parse and admit a dataset document from JSON text.
 * @returns {{ok: true, doc: object, restamped: boolean, warnings: string[]}
 *   | {ok: false, errors: string[]}}
 */
export function importDatasetText(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`not valid JSON: ${e.message}`] };
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: false, errors: ["not a dataset document (expected a JSON object)"] };
  }
  let restamped = false;
  const stamped = doc.provenance?.content_hash;
  if (stamped === undefined || stamped !== computeDatasetContentHash(doc)) {
    try {
      stampDatasetIdentity(doc);
    } catch (e) {
      return { ok: false, errors: [`could not restamp edited document: ${e.message}`] };
    }
    restamped = true;
  }
  const result = validateJtaDataset(doc);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }
  return { ok: true, doc, restamped, warnings: result.warnings ?? [] };
}

/** Serialize a dataset document exactly as export-vanilla-dataset.mjs does. */
export function exportDatasetText(doc) {
  return JSON.stringify(doc, null, 2) + "\n";
}
