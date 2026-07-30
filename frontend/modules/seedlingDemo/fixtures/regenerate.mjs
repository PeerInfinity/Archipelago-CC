#!/usr/bin/env node
/**
 * Regenerate the PROVISIONAL expectation streams for the committed tapes,
 * by running them through this repo's own v1 physics.
 *
 * ⚠ These are NOT oracle recordings. See `fixtures/index.js` for why the
 * test comparing against them is a change detector rather than a
 * correctness proof, and what replaces them at slice 3.
 *
 * Run:  node frontend/modules/seedlingDemo/fixtures/regenerate.mjs
 *
 * Regenerating is how you accept a deliberate physics change: the diff it
 * produces is the review surface. If a change you did NOT intend shows up
 * here, that is the point — investigate before committing it.
 *
 * This script never writes a non-provisional `<name>.json`; only the
 * slice-4 verify script's `--record` mode may write oracle recordings.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { serializeObservationStream } from '../tapeFormat.js';
import { runTapeToStream } from '../tapeRunner.js';
import { EXPECTATIONS_DIR, fixtureNames, loadTape, PROVISIONAL_SUFFIX } from './index.js';

let wrote = 0;
for (const name of fixtureNames()) {
    const tape = loadTape(name);
    const stream = runTapeToStream(tape);
    const path = join(EXPECTATIONS_DIR, `${name}${PROVISIONAL_SUFFIX}`);
    writeFileSync(path, serializeObservationStream(stream));
    console.log(`wrote ${name}${PROVISIONAL_SUFFIX} (${stream.ticks.length} observations)`);
    wrote++;
}
console.log(`\n${wrote} provisional expectation(s) regenerated.`);
