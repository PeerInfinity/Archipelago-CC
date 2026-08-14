#!/usr/bin/env node
/**
 * Stamp the extracted vanilla fixture with its content-hash identity.
 *
 * ⛔ WHY THIS EXISTS AS A SCRIPT. `extract-seedling-vanilla-set.py` emits the
 * set UNSTAMPED (`set_id: "seedling-vanilla"`, no `provenance.content_hash`),
 * because the hash is FNV-1a over a canonical stringification and
 * `levelSetValidator.js` is its ONE authority — re-implementing that in Python
 * would be a second implementation of an identity function, which is the one
 * place a divergence is invisible (both halves would still "produce a hash").
 * Until phase 4 the committed fixture was stamped by hand, so re-running the
 * extractor silently UNSTAMPED it and the only thing standing between that and
 * a committed fixture was someone remembering. Now the pipeline is:
 *
 *     python3 scripts/procgen/extract-seedling-vanilla-set.py
 *     node    scripts/procgen/stamp-seedling-vanilla-set.mjs
 *
 * ⚠ The printed hash is load-bearing OUTSIDE this repo: `VanillaSet.SET_ID` in
 * ~/CC/seedling must carry the same string, or the built-in manifest and its
 * twin disagree about which set the game is running — which is exactly what the
 * save stamp keys on.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampLevelSetIdentity, validateLevelSet } from
    '../../frontend/modules/seedlingDemo/levelSetValidator.js';

const REPO = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const PATH = join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');

const set = JSON.parse(readFileSync(PATH, 'utf8'));
const before = set.set_id;
stampLevelSetIdentity(set, 'seedling-vanilla');
writeFileSync(PATH, `${JSON.stringify(set, null, 1)}\n`);

console.log(`stamped ${PATH}`);
console.log(`  ${before}  ->  ${set.set_id}`);
console.log(`  content_hash: ${set.provenance.content_hash}`);

// The fixture is the corpus this arc's rules are measured against, so it is
// validated HERE too rather than only in vitest: a stamp written onto a set the
// validator refuses would be a valid stamp on an invalid document.
const verdict = validateLevelSet(set);
console.log(`  validates: ${verdict.ok ? 'OK' : 'REFUSED'}`
    + ` (${verdict.errors.length} errors, ${verdict.warnings.length} warnings)`);
for (const e of verdict.errors) console.log(`    ERROR: ${e}`);
for (const w of verdict.warnings) console.log(`    warn:  ${w}`);
if (!verdict.ok) process.exit(1);
console.log('\n⚠ Put this id in ~/CC/seedling/src/VanillaSet.as SET_ID:');
console.log(`    public static const SET_ID:String = "${set.set_id}";`);
