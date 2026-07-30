/**
 * seedlingDemo/fixtures — the committed tapes and their expected
 * observation streams.
 *
 * ⚠ **The expectations in `expectations/` are PROVISIONAL at slice 1.**
 * They are produced by this repo's own JS engine (`regenerate.mjs`), so
 * the test that compares JS output against them is a CHANGE DETECTOR, not
 * a correctness proof — a verifier that shares the generator's
 * assumptions verifies nothing about whether the physics is right. It
 * catches an unintended physics edit, which is worth having, and nothing
 * more.
 *
 * The real correctness gate arrives at slice 3, when these files are
 * replaced by ORACLE RECORDINGS drained from the recompiled Seedling wasm
 * build. At that point the same test becomes a genuine independent
 * stratum, because the expected values will have come from the game
 * rather than from us. The `.provisional.json` suffix exists so that
 * substitution is visible in a diff and cannot happen by accident.
 *
 * The genuinely independent checks that DO exist at slice 1 are the
 * hand-computed physics cases in `playerPhysicsV1.test.js` — values
 * derived from reading the AS3, not from running this port.
 *
 * This file uses `fs` and is node-only. The core modules
 * (`tapeFormat`, `playerPhysicsV1`, `tapeRunner`, `botDriverV1`) are
 * deliberately dependency-free so they stay usable in a browser when a
 * later rung gives this module a panel.
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
