#!/usr/bin/env node
/**
 * plan-seedling-r7-attribution — the batch's predicted per-fixture
 * classification, DERIVED, and committed BEFORE the batch runs.
 *
 * Region-atlas Phase 8, rung R7, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §3.4.
 *
 * ── WHY A SCRIPT AND NOT A LIST ───────────────────────────────────────
 *
 * §3.4's gate is INVERTED: the attribution is planned before the batch, so
 * that "the roster moved" cannot be the shape a silent regression takes
 * while re-recording is licensed. A list typed by hand is not a
 * prediction, it is a hope — so the classification is derived from the
 * model's own reading of each tape (`runTape` → `collected`) plus the
 * tape's declared version, and `--check` asserts the derivation still
 * produces what `R7_BATCH.predictedValueChanges` records.
 *
 * ── ⛔ AND THE PREDICTION OVERTURNS THE BATCH'S PREMISE ────────────────
 *
 * §3.4 (carrying R6 debt 1) schedules the batch around `saw_auto_advance`
 * being "the one wanted change that is NOT byte-inert", citing "~8 frozen
 * R3 collection fixtures whose committed expectations say
 * `saw_auto_advance: 0`". Measured at slice 0: **no committed expectation
 * carries the field.** All 118 expectation files are exactly
 * `{ticks: [{t,x,y,level}], transitions: [{t,from_level,to_level}]}`. What
 * asserts the field is the SWEEP, which re-derives it per run.
 *
 * And `Bot.autoAdvance`'s `dispatchKey` presses are UNCONDITIONAL on all
 * three version arms (`Bot.as:2198-2212`) — only the COUNTER is scoped. A
 * press schedule that does not change cannot move an observation, so the
 * change is byte-inert on the corpus by construction rather than by luck.
 *
 * ⇒ predicted re-records: **ZERO**. The gate is therefore two-sided in a
 * sharper way than §3.4 anticipated:
 *   (a) 118/118 fixtures byte-identical after the batch;
 *   (b) exactly the named tapes change their REPORTED VALUE, and the
 *       sweep's own `wantAutoAdvance` derivation must move with them.
 *
 * ⚠ ONE STANDING CONSTRAINT FOR SLICE 1, as a refusal: unify the COUNTER,
 * never the PRESSER. Any change touching `AUTO_ADVANCE_CADENCE`'s presses
 * shifts every frozen frame after it and voids this whole prediction.
 *
 * Run: node scripts/procgen/plan-seedling-r7-attribution.mjs
 *      node scripts/procgen/plan-seedling-r7-attribution.mjs --check
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

const { fixtureNames, loadTape, EXPECTATIONS_DIR } =
    await import(join(MODULE, 'fixtures', 'index.js'));
const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { R7_BATCH, predictedAttribution } = await import(join(MODULE, 'r7Acceptance.js'));

const check = process.argv.includes('--check');
const source = atlasLevelSource();

// ── The premise, re-measured rather than quoted ───────────────────────
//
// ⛔ THIS IS THE LOAD-BEARING MEASUREMENT AND IT RUNS EVERY TIME. If a
// later rung starts committing readout fields into expectations, the whole
// "zero re-records" prediction stops holding and this line is what says so.
const expKeys = new Set();
let expFiles = 0;
for (const f of readdirSync(EXPECTATIONS_DIR)) {
    if (!f.endsWith('.json')) continue;
    expFiles += 1;
    for (const k of Object.keys(JSON.parse(readFileSync(join(EXPECTATIONS_DIR, f), 'utf8')))) {
        expKeys.add(k);
    }
}
const expectationsCarryReadouts = [...expKeys].some((k) => !['ticks', 'transitions'].includes(k));

const tapes = [];
const failures = [];
for (const name of fixtureNames()) {
    const tape = loadTape(name);
    let swordPickups = 0;
    try {
        swordPickups = (runTape(tape, { levelSource: source }).collected ?? [])
            .filter((c) => c.item === 'sword').length;
    } catch (e) {
        failures.push(`${name}: ${e.message}`);
    }
    tapes.push({ name, tape_version: tape.tape_version ?? 1, swordPickups });
}

const rows = predictedAttribution(tapes);
const valueChanges = rows.filter((r) => r.value !== 'unchanged');

console.log('## R7 batch — predicted attribution, committed BEFORE the batch\n');
console.log(`roster ${tapes.length} tapes; expectation files ${expFiles}, `
    + `top-level keys {${[...expKeys].sort().join(', ')}}`);
console.log(`expectations carry a readout field: ${expectationsCarryReadouts ? '⛔ YES '
    + '— the zero-re-record prediction NO LONGER HOLDS' : 'no'}`);
if (failures.length) console.log(`⚠ runTape failures (${failures.length}): ${failures.join(' | ')}`);
console.log(`\npredicted stream changes (re-records): `
    + `${rows.filter((r) => r.stream !== 'IDENTICAL').length}`);
console.log(`predicted VALUE changes: ${valueChanges.length}`);
for (const r of valueChanges) console.log(`   ${r.name.padEnd(24)} ${r.value}`);

console.log('\nby version:');
const byV = {};
for (const t of tapes) byV[t.tape_version] = (byV[t.tape_version] ?? 0) + 1;
for (const [v, n] of Object.entries(byV).sort()) console.log(`   v${v}: ${n}`);

if (check) {
    const got = valueChanges.map((r) => r.name).sort();
    const want = [...R7_BATCH.predictedValueChanges].sort();
    const same = got.length === want.length && got.every((n, i) => n === want[i]);
    const zero = rows.every((r) => r.stream === 'IDENTICAL')
        && R7_BATCH.predictedReRecords === 0 && !expectationsCarryReadouts;
    console.log(`\n--check: value-change set ${same ? 'MATCHES' : `DRIFTED — got ${got.join(', ')}`
        + `, recorded ${want.join(', ')}`}`);
    console.log(`--check: zero-re-record premise ${zero ? 'HOLDS' : '⛔ BROKEN'}`);
    process.exitCode = same && zero ? 0 : 1;
}
