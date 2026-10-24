#!/usr/bin/env node
/**
 * plan-seedling-f7-reentry — ⛓⛓⛓ SEEDLING FIDELITY F7 (D-A): L16 RE-ENTERED
 * WITH ITS ROPE ALREADY PULLED.
 *
 * The forward leg pulls `rope@32,16` (tset 0, tag 0). `hit()` clears `{16,0}`
 * and `set activate` publishes group 0, so L16's three `shoot = 1` arrow traps
 * (x 96/112/128, y 32) stop firing (`ArrowTrap.as:71-81`). On the way BACK the
 * room is a new `Game`, and `RopeStart.check()` (`:31-38`) sees the cleared tag
 * and calls `hit()` again on the first frame, so the group is published again
 * and the lanes stay silent. L17's `stairsup@32,48` lands the player at
 * (112,48), inside the lane of `arrowtrap@112,32`, which is why the model's
 * missing re-publish refused the return leg.
 *
 * Both tapes boot the chain-end staging (`r9-solve-32`'s declarations, which
 * carry `{16,0}`), read from F6's frozen witness base so a later re-record of
 * the chain does not move them. Only the boot moves; `equips`, `despawn` and
 * `tick0` are dropped (F6's rule).
 *
 *   f7-l16-reentry  boots L16 at (112,48), the L17 return arrival, stands 30 t
 *                   in the lane of `arrowtrap@112,32`, then walks left 30 t
 *                   under the other two (60 t).
 *   f7-l16-walkin   boots L17 at (48,48) and steps left onto `stairsup@32,48`:
 *                   it enters L16 at (112,48) on t7 and stands in the lane
 *                   (60 t). ⚠ THE ORDER QUESTION: a walk-in's arrival frame is
 *                   the new world's first update, so a group published one
 *                   update late would let each trap fire ONE volley onto the
 *                   arrival tile. The game's `check()` pass runs above every
 *                   `update()` (`Game.as:869-879`), and this tape measures it.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f7-reentry.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-f7-reentry.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** The two witnesses: name, boot, the keys, the tick count, and what each shows. */
export const F7_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'f7-l16-reentry',
        boot: { level: 16, x: 112, y: 48 },
        inputs: [{ key: 'left', from: 30, to: 60 }],
        ticks: 60,
        what: 'L16 booted at (112,48), the L17 return arrival, with `{16,0}` cleared: `RopeStart.check()` '
            + 're-pulls `rope@32,16` and re-publishes group 0, so the three `shoot = 1` arrow traps stay '
            + 'silent while the player stands 30 t in the lane of `arrowtrap@112,32` and walks left 30 t',
    }),
    Object.freeze({
        name: 'f7-l16-walkin',
        boot: { level: 17, x: 48, y: 48 },
        inputs: [{ key: 'left', from: 0, to: 10 }],
        ticks: 60,
        what: 'boots L17 at (48,48) and steps left onto `stairsup@32,48` (→ L16 at 112,48): the walk '
            + 'enters L16 on t7 and stands in the lane of `arrowtrap@112,32`. The arrival frame is the new '
            + 'world\'s first update, so a group published one update late would fire one volley onto it',
    }),
]);

/** The chain-end staging every witness carries (`r9-solve-32`, frozen by F6). */
export const F7_BASE = join('fixtures', 'witness-bases', 'r9-solve-32.f6.json');

/** The clear the controls remove (`probe-seedling-f7-reentry.mjs`). */
export const F7_ROPE_CLEAR = Object.freeze({ level: 16, tag: 0 });

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    const base = parseTape(readFileSync(join(MODULE, F7_BASE), 'utf8'));
    check('the chain-end staging carries {16,0}',
        base.persistence.some((p) => p.level === F7_ROPE_CLEAR.level && p.tag === F7_ROPE_CLEAR.tag));
    const levelSource = atlasLevelSource();
    for (const w of F7_WITNESSES) {
        const description = `⛓⛓⛓ SEEDLING FIDELITY F7 (D-A) — the chain-end staging (\`r9-solve-32\`'s `
            + `declarations, every carried clear) ${w.what}. Authored by `
            + 'scripts/procgen/plan-seedling-f7-reentry.mjs.';
        const tape = parseTape({
            ...base,
            name: w.name,
            boot: { ...w.boot },
            equips: [],
            despawn: [],
            tick0: null,
            tick_count: w.ticks,
            inputs: w.inputs.map((i) => ({ ...i })),
            description,
        });
        const out = runTape(tape, { levelSource });
        check(`${w.name}: the model replays it (${w.ticks + 1} observations)`, out.ticks.length === w.ticks + 1,
            `${out.ticks.length} observations, transitions ${JSON.stringify(out.transitions)}`);
        check(`${w.name}: the model ends in L16`, out.ticks.at(-1)?.level === 16, JSON.stringify(out.ticks.at(-1)));
        const json = `${JSON.stringify({ ...tape, description, note: '' }, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
