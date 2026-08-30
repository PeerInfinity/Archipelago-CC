#!/usr/bin/env node
/**
 * help — **THE DOOR FOR AN INSTRUMENT WHOSE MODULE SCOPE CANNOT BE
 * PREEMPTED** (R9 slice P4a, ⚖ ruling 47b (4)).
 *
 * ⛔⛔ WHY THIS EXISTS AT ALL. ESM imports are HOISTED, so
 * `argvHelp(import.meta.url)` — placed at the first executable line of an
 * instrument's body — preempts THAT FILE's own module-scope work and nothing
 * else. An instrument whose work happens inside a module it IMPORTS has
 * already done it by the time any guard in the importer runs (trap 584: the
 * campaign producer solves on import). This file answers for those, and for
 * every other instrument too, WITHOUT IMPORTING THE SCRIPT: it reads the
 * source and asks `argvScan` the same questions the generated instruments
 * table asks.
 *
 * ⛓ It is therefore also the answer for an instrument that is BROKEN — a file
 * that throws on import still has a docblock and still declares flags.
 *
 * ── Run: ──────────────────────────────────────────────────────────────
 *
 *   node scripts/procgen/help.mjs                        every instrument, one line each
 *   node scripts/procgen/help.mjs <instrument>           one instrument, in full
 *   node scripts/procgen/help.mjs --json                 the index, as data
 *
 * ⛔ EXIT 0 for a known instrument, 1 for a name this directory does not have
 * — a reader who mistypes gets a refusal BY NAME, not an empty page.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, helpText } from './argvHelp.js';
import { docblockOf, flagsIn, headerOf, inheritedFlagsIn } from './argvScan.js';
import { firstSentence } from './reference/lib.mjs';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

/** ⛓ The roster is the DIRECTORY — the same membership rule the index uses. */
export const instrumentNames = () => readdirSync(HERE).filter((f) => f.endsWith('.mjs')).sort();

const rows = () => instrumentNames().map((file) => {
    const text = readFileSync(join(HERE, file), 'utf8');
    const doc = docblockOf(headerOf(text));
    return {
        file,
        oneLiner: doc ? firstSentence(doc.text) : null,
        flags: flagsIn(text, { file: join(HERE, file) }).map((f) => f.name),
        inheritedFlags: inheritedFlagsIn(text, { file: join(HERE, file) }),
    };
});

const wanted = argv.find((a) => !a.startsWith('-'));
if (argv.includes('--json')) {
    console.log(JSON.stringify(rows(), null, 1));
    process.exit(0);
}
if (wanted) {
    const name = wanted.replace(/^.*\//, '');
    if (!instrumentNames().includes(name)) {
        console.log(`help: scripts/procgen/ has no instrument called ${JSON.stringify(name)}. `
            + 'Run `node scripts/procgen/help.mjs` for the list.');
        process.exit(1);
    }
    console.log(helpText(join(HERE, name)));
    process.exit(0);
}
const all = rows();
console.log(`# ${all.length} instruments in scripts/procgen/ — `
    + '`node scripts/procgen/help.mjs <name>` for one in full\n');
for (const r of all) console.log(`${r.file}\n    ${r.oneLiner ?? '(no docblock)'}`);
process.exit(0);
