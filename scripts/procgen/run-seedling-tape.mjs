#!/usr/bin/env node
/**
 * run-seedling-tape — replay one Seedling tape through the JS model and print its observation stream's md5 and the live profile stamp (engine-prep A3).
 *
 * The worked example of a node entry that takes a physics profile override:
 * `installProfileFromEnv()` (`seedlingProfileLoader.mjs`) runs FIRST, and the
 * model is imported dynamically after it, because the profile is read once,
 * at load (⚖ Q2). With no `--profile=` and no `SEEDLING_PROFILE` the run is
 * the compiled-in default, byte for byte.
 *
 * `<tape>` is a committed fixture name (`collide-up-rock`) or a path to a
 * tape file. The run uses the real level geometry (`atlasLevelSource()`), as
 * `tapeRunner.test.js` does. The stream md5 is over
 * `JSON.stringify(runTapeToStream(tape))` — `{ticks, transitions}`. With
 * `--expect`, it also diffs the stream against the fixture's committed
 * expectation (`diffObservationStreams`) and prints `same` or `moved`.
 *
 * Run:
 *   node scripts/procgen/run-seedling-tape.mjs collide-up-rock
 *   node scripts/procgen/run-seedling-tape.mjs collide-up-rock --profile=my-profile.json --expect
 *   SEEDLING_PROFILE=my-profile.json node scripts/procgen/run-seedling-tape.mjs path/to/tape.json
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { installProfileFromEnv } from './seedlingProfileLoader.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEMO = join(REPO, 'frontend/modules/seedlingDemo');
const load = (f) => import(pathToFileURL(join(DEMO, f)).href);

async function main() {
    const tapeArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
    if (!tapeArg) {
        console.error('usage: run-seedling-tape.mjs <fixture name | tape path> [--profile=<path>] [--expect]');
        process.exit(2);
    }
    let installed;
    try {
        installed = await installProfileFromEnv();
    } catch (e) {
        console.error(`REFUSED: ${e.message}`);
        process.exit(1);
    }
    const { profile } = installed;
    // ⛔ the model is imported only NOW, after the profile is installed
    const [{ parseTape, diffObservationStreams }, { runTapeToStream }, { atlasLevelSource }, fixtures] = await Promise.all([
        load('tapeFormat.js'), load('tapeRunner.js'), load('levelSource.js'), load('fixtures/index.js'),
    ]);
    const isPath = existsSync(tapeArg) && !fixtures.fixtureNames().includes(tapeArg);
    const tape = isPath ? parseTape(readFileSync(tapeArg, 'utf8')) : fixtures.loadTape(tapeArg);
    const stream = runTapeToStream(tape, { levelSource: atlasLevelSource() });
    for (const line of profile.profileAnnouncements()) console.log(line);
    const stamp = profile.profileStamp();
    console.log(`profile stamp: ${stamp.id} ${stamp.md5}`);
    console.log(`stream md5: ${createHash('md5').update(JSON.stringify(stream)).digest('hex')} `
        + `(${stream.ticks.length} observations, ${stream.transitions.length} transitions)`);
    if (process.argv.includes('--expect')) {
        if (isPath) {
            console.error('--expect needs a fixture name: a tape path has no committed expectation');
            process.exit(2);
        }
        const d = diffObservationStreams(fixtures.loadExpectation(tapeArg).stream, stream);
        console.log(d === null ? 'expectation: same' : `expectation: moved (${String(d).split('\n')[0].slice(0, 160)})`);
    }
}

argvHelp(import.meta.url);
if (isEntryPoint(import.meta.url)) await main();
