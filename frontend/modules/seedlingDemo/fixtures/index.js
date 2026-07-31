/**
 * seedlingDemo/fixtures — the committed tapes and their expected
 * observation streams.
 *
 * ✅ **Every expectation in `expectations/` is an ORACLE RECORDING** —
 * an observation stream drained from the recompiled Seedling wasm build,
 * written only by `verify-seedling-bot-differential.mjs --record`. That is
 * what makes the fixture differential a genuine independent stratum: the
 * expected values came from the GAME, not from the module under test.
 *
 * The bootstrap path still exists for a fixture that has not been recorded
 * yet: `regenerate.mjs` writes `<name>.provisional.json` from this repo's
 * own engine, which is a CHANGE DETECTOR and nothing more — a verifier
 * sharing the generator's assumptions verifies nothing about whether the
 * physics is right. `loadExpectation` prefers the oracle file and reports
 * which regime it used; `tapeRunner.test.js` pins that no current fixture
 * is riding the bootstrap, so a new one cannot quietly weaken the suite's
 * claim. The distinct suffix keeps the substitution visible in a diff.
 *
 * The other independent stratum is the hand-computed physics in
 * `playerPhysicsV1.test.js` / `playerPhysicsV2.test.js` — values derived
 * from reading the AS3, not from running this port.
 *
 * This file uses `fs` and is node-only, as is `../levelSource.js`. The core
 * modules (`tapeFormat`, `playerPhysicsV1`, `playerPhysicsV2`,
 * `levelWorld`, `tapeRunner`, `botDriverV1`) are deliberately
 * dependency-free so they stay usable in a browser when a later rung gives
 * this module a panel.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseObservationStream, parseTape } from '../tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export const TAPES_DIR = join(HERE, 'tapes');
export const EXPECTATIONS_DIR = join(HERE, 'expectations');

/** Suffix marking an expectation as JS-generated rather than oracle-recorded. */
export const PROVISIONAL_SUFFIX = '.provisional.json';

/** Fixture names, sorted, derived from what is on disk. */
export function fixtureNames() {
    return readdirSync(TAPES_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length))
        .sort();
}

/** Load and validate one tape by fixture name. */
export function loadTape(name) {
    return parseTape(readFileSync(join(TAPES_DIR, `${name}.json`), 'utf8'));
}

/**
 * Load one expectation. Prefers an oracle recording (`<name>.json`) over a
 * provisional one (`<name>.provisional.json`) so slice 3 can land oracle
 * files incrementally, per fixture, without touching this loader.
 *
 * Returns `{stream, provisional}` — callers that make correctness claims
 * must branch on `provisional` rather than assume.
 */
export function loadExpectation(name) {
    const oraclePath = join(EXPECTATIONS_DIR, `${name}.json`);
    const provisionalPath = join(EXPECTATIONS_DIR, `${name}${PROVISIONAL_SUFFIX}`);
    let raw;
    let provisional;
    try {
        raw = readFileSync(oraclePath, 'utf8');
        provisional = false;
    } catch {
        raw = readFileSync(provisionalPath, 'utf8');
        provisional = true;
    }
    return { stream: parseObservationStream(raw), provisional };
}
