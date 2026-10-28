#!/usr/bin/env node
// inventory-menu-identity — the V inventory menu slice's BYTE-IDENTITY measurement.
//
// Replays every committed tape in `fixtures/tapes/index.json` through `runTape` and prints one md5 per tape over
// what the run produced: the observation stream (`ticks`, `transitions`), every `run.ledger(kind)`, every
// `run.progress(field)` and `run.stateDigest()`. Run it at the base and at the tip and `diff` the outputs; the
// last line is the md5 of every row.
//
// ⚠ The digest is hashed PART BY PART without `globals`: that part hashes the whole `CONTACT_FIDELITY` object, so a
// new switch (this slice's `secondaryUse`) moves it on every tape by construction. It is reported on its own line
// (`globals`: the distinct values over the set) so its move is visible and attributable rather than folded in.
//
// The claim it measures: a tape that never presses C, V or I is untouched by the menu's model (`secondary`,
// `firstUse`, the C press and the conditional digest key). The first line counts the tapes that press one of
// those keys, so a later tape that does is visible rather than silently in the set.
//
// Usage:
//   node scripts/procgen/inventory-menu-identity.mjs                       # the defaults
//   SEEDLING_CONTACT_FIDELITY=all node scripts/procgen/inventory-menu-identity.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { runTape } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';
import { LEDGER_KIND_NAMES, PROGRESS_FIELD_NAMES } from '../../frontend/modules/seedlingDemo/levelRun.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) main();

function main() {
    const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
    const index = JSON.parse(readFileSync(join(REPO_ROOT, 'frontend/modules/seedlingDemo/fixtures/tapes/index.json'), 'utf8'));
    const MENU_KEYS = new Set(['secondary', 'inventory', 'inventory2']);

    const levelSource = atlasLevelSource();
    const md5 = (s) => createHash('md5').update(s).digest('hex');
    const rows = [];
    let pressing = 0;
    let throws = 0;
    const globals = new Set();
    for (const { file } of index.tapes) {
        const raw = JSON.parse(readFileSync(join(REPO_ROOT, index.dir, file), 'utf8'));
        if ((raw.inputs ?? []).some((i) => MENU_KEYS.has(i.key))) pressing += 1;
        let run = null;
        let out;
        try {
            const r = runTape(parseTape(raw), { levelSource, onTick: (_t, _s, _h, rn) => { run = rn; } });
            const ledgers = run ? Object.fromEntries(LEDGER_KIND_NAMES.map((k) => [k, run.ledger(k)])) : null;
            const progress = run ? Object.fromEntries(PROGRESS_FIELD_NAMES.map((k) => [k, run.progress(k)])) : null;
            const parts = run ? { ...run.stateDigest({ parts: true }).parts } : null;
            if (parts) { globals.add(parts.globals); delete parts.globals; }
            const digest = parts;
            out = JSON.stringify({ ticks: r.ticks, transitions: r.transitions, ledgers, progress, digest });
        } catch (err) {
            out = `THROW ${String(err.message).split('\n')[0]}`;
            throws += 1;
        }
        rows.push(`${md5(out)}  ${file}${out.startsWith('THROW') ? `  ${out.slice(0, 160)}` : ''}`);
    }
    console.log(`tapes ${rows.length}; pressing C/V/I: ${pressing}; throwing: ${throws}`);
    for (const r of rows) console.log(r);
    console.log(`globals ${[...globals].join(' ')}`);
    console.log(`ALL ${md5(rows.join('\n'))}`);
}
