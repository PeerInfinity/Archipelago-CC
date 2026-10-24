#!/usr/bin/env node
/**
 * plan-seedling-return-l15 — ⛓⛓⛓ SEEDLING FIDELITY RETURN (D1): L15 RE-ENTERED
 * FROM L16 ON THE WAY BACK, WITH AND WITHOUT THE FORWARD TRIP'S CLEARS.
 *
 * The forward leg (L14 → L15 → L16) shoves `pushableblock@64,64` onto
 * `button@112,32`, which opens `lock@128,48` (tset 0, tag 0), and breaks both
 * rocks. `Lock.turnOff()` writes `{15,0}` (`Lock.as:90-98`), each rock writes
 * its own tag, so a run past L15 carries `{15,0}`, `{15,2}`, `{15,3}`.
 *
 * On the way BACK the room is a new `Game`:
 *   - `Lock.check()` removes the lock only when `tag >= 0 && tSet < 0`
 *     (`Lock.as:39-46`). This lock has `tSet = 0`, so its cleared tag does
 *     NOTHING and it is built `type = "Solid"`, closed.
 *   - `PushableBlock` reads no persistence (`PushableBlock.as:23-33`); it is
 *     rebuilt at (64,64), so nothing holds the button.
 *   - `Button.update()` publishes `activate = false` on group 0 every tick
 *     (`Button.as:27-40`), so the lock stays closed.
 * L16's `stairsup@16,64` lands the player at (144,32): the column x 144..159,
 * rows y 16..63, whose only ways out are `stairsdown@144,16` (back to L16),
 * the closed lock to the west, and Water to the south (`Player.as:1456`:
 * water without `canSwim` drowns, and the drown puts the player back).
 *
 *   return-l15-reentry           boots L15 at (144,32) with the chain-end clears
 *                                (`{15,0}`, `{15,2}`, `{15,3}` among them), walks
 *                                down 12 t, presses left into the lock 28 t, then
 *                                walks down into the water 60 t (it drowns and is
 *                                put back at the arrival).
 *   return-l15-walkin            boots L16 at (32,64) and steps left onto
 *                                `stairsup@16,64` (→ L15 at 144,32, t7), then down
 *                                and left into the lock: the re-entry by the door.
 *   return-l15-reentry-unclear   the first tape WITHOUT the three L15 clears (the
 *                                either-state control): the lock is built from the
 *                                same `tSet`, so the game's stream is the same.
 *
 * Every tape boots the chain-end staging (`r9-solve-32`'s declarations), read
 * from F6's frozen witness base, which holds the Sword and the Shield and NOT
 * the Conch. Only the boot moves; `equips`, `despawn` and `tick0` are dropped
 * (F6's rule).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-return-l15.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-return-l15.mjs --check    # exit 1 on drift
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

/** The forward trip's clears in L15: the lock's tag 0 and both rocks. */
export const RETURN_L15_CLEARS = Object.freeze([
    Object.freeze({ level: 15, tag: 0 }),
    Object.freeze({ level: 15, tag: 2 }),
    Object.freeze({ level: 15, tag: 3 }),
]);

const REENTRY_INPUTS = Object.freeze([
    { key: 'down', from: 0, to: 12 },
    { key: 'left', from: 12, to: 60 },
]);

/** The three witnesses: name, boot, the keys, the tick count, whether the L15 clears are dropped. */
export const RETURN_L15_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'return-l15-reentry',
        boot: { level: 15, x: 144, y: 32 },
        inputs: REENTRY_INPUTS,
        ticks: 60,
        dropClears: false,
        what: 'boots L15 at (144,32), the L16 return arrival, with the forward clears `{15,0}` `{15,2}` '
            + '`{15,3}`: `lock@128,48` (tset 0) ignores its cleared tag and is built CLOSED, so a left press '
            + 'stops at the lock and holds there for 48 t',
    }),
    Object.freeze({
        name: 'return-l15-walkin',
        boot: { level: 16, x: 32, y: 64 },
        inputs: Object.freeze([
            { key: 'left', from: 0, to: 10 },
            { key: 'down', from: 14, to: 26 },
            { key: 'left', from: 26, to: 60 },
        ]),
        ticks: 60,
        dropClears: false,
        what: 'boots L16 at (32,64) and steps left onto `stairsup@16,64` (→ L15 at 144,32, t7), then walks '
            + 'down and presses left into `lock@128,48`: the re-entry by the door, the lock closed on arrival',
    }),
    Object.freeze({
        name: 'return-l15-reentry-unclear',
        boot: { level: 15, x: 144, y: 32 },
        inputs: REENTRY_INPUTS,
        ticks: 60,
        dropClears: true,
        what: 'the either-state control: `return-l15-reentry` WITHOUT `{15,0}` `{15,2}` `{15,3}`. The lock '
            + 'is built from its tSet, not its tag, so the stream is the cleared arm\'s',
    }),
]);

/** The chain-end staging every witness carries (`r9-solve-32`, frozen by F6). */
export const RETURN_L15_BASE = join('fixtures', 'witness-bases', 'r9-solve-32.f6.json');

const isL15Clear = (p) => RETURN_L15_CLEARS.some((c) => c.level === p.level && c.tag === p.tag);

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

    const base = parseTape(readFileSync(join(MODULE, RETURN_L15_BASE), 'utf8'));
    check('the chain-end staging carries {15,0} {15,2} {15,3}',
        RETURN_L15_CLEARS.every((c) => base.persistence.some((p) => p.level === c.level && p.tag === c.tag)));
    check('the chain-end staging does not hold the Conch', base.seam?.items?.canSwim === false);
    const levelSource = atlasLevelSource();
    for (const w of RETURN_L15_WITNESSES) {
        const description = `⛓⛓⛓ SEEDLING FIDELITY RETURN (D1) — the chain-end staging (\`r9-solve-32\`'s `
            + `declarations${w.dropClears ? ', minus the three L15 clears' : ', every carried clear'}) `
            + `${w.what}. Authored by scripts/procgen/plan-seedling-return-l15.mjs.`;
        const tape = parseTape({
            ...base,
            name: w.name,
            boot: { ...w.boot },
            persistence: w.dropClears ? base.persistence.filter((p) => !isL15Clear(p)) : base.persistence,
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
        const inL15 = out.ticks.filter((t) => t.level === 15);
        check(`${w.name}: the model never passes the lock (x stays ≥ 144 in L15)`,
            inL15.length > 0 && inL15.every((t) => t.x >= 144), `min x ${Math.min(...inL15.map((t) => t.x))}`);
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
