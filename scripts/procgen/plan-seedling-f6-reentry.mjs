#!/usr/bin/env node
/**
 * plan-seedling-f6-reentry — ⛓⛓⛓ SEEDLING FIDELITY F6: THREE ROOMS RE-ENTERED
 * IN THE GAME'S OWN SAVED STATE (I1's I01 · I02 · I03).
 *
 * The campaign's latched persistence, carried window to window, holds three
 * clears the model refused to BUILD until F6, so once the chain had passed them
 * the rooms could not be entered again in the game's own state:
 *
 *   `{17,29}` (from window 19)  L17  the out-of-band landing of L18's two
 *                                    `tag="-1"` spinners — nothing in L17 reads it
 *   `{2,0}`   (from window 24)  L2   L0's set moonrock wrote it; the MoonrockPile
 *                                    APPEARS (`Scenery/MoonrockPile.as:26-33`)
 *   `{20,4}`  (from window 21)  L20  the ButtonRoom the chain pressed boots
 *                                    PRESSED, so its group (`lock@32,80`) fades
 *                                    from the build (`ButtonRoom.as:40-50`)
 *
 * Each tape boots the chain-end staging — `r9-solve-32`'s boot declarations, its
 * persistence carrying all three — in or beside the room, and walks into what
 * the clear changed. `r9-solve-32` is read from `fixtures/witness-bases/`
 * (byte-identical to the window as F1c's chain committed it), so a later
 * re-record of the chain does not move these witnesses. Only the boot moves;
 * `equips` (the window's own Fire equip), `despawn` and `tick0` (a chain
 * continuation's tick-0 latch, which a fresh-page witness does not have) are
 * dropped.
 *
 *   f6-l17-reentry   boots L17 at the L16 arrival, walks right, up, left (60 t).
 *                    The game boots L17 unchanged; the model now builds it with
 *                    `{17,29}` inert (`world.outOfBandClears`).
 *   f6-l2-reentry    boots L3 under its teleporter to L2, holds `up` (120 t):
 *                    it enters L2 at (48,80) and walks north into the pile,
 *                    which covers `stairsup@48,16` (→ L0). Without the pile the
 *                    same keys reach the stairs and leave for L0.
 *   f6-l20-reentry   boots L13 under its stairs to L20, steps in, holds `down`
 *                    into `lock@32,80` until the latched fade opens it, then
 *                    right along row 6 and up into the room (240 t). Row 7 is
 *                    water; the walk stays out of it.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f6-reentry.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-f6-reentry.mjs --check    # exit 1 on drift
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

/** The three witnesses: name, boot, the keys, the tick count, and what each shows. */
export const F6_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'f6-l17-reentry',
        row: 'I01',
        boot: { level: 17, x: 48, y: 48 },
        inputs: [{ key: 'right', from: 0, to: 24 }, { key: 'up', from: 24, to: 40 }, { key: 'left', from: 40, to: 60 }],
        ticks: 60,
        what: 'L17 booted with `{17,29}` — the out-of-band landing of L18\'s two `tag="-1"` spinners, '
            + 'which nothing in L17 reads — walks right, up and left among its three bobs',
    }),
    Object.freeze({
        name: 'f6-l2-reentry',
        row: 'I02',
        boot: { level: 3, x: 64, y: 32 },
        inputs: [{ key: 'up', from: 0, to: 120 }],
        ticks: 120,
        what: 'boots L3 under `teleporter@64,0` (→ L2 at 48,80) and holds `up`: the walk enters L2 '
            + 'and stops against the MoonrockPile `{2,0}` builds at (40,16), 32x16, over '
            + '`stairsup@48,16` (→ L0)',
    }),
    Object.freeze({
        name: 'f6-l20-reentry',
        row: 'I03',
        boot: { level: 13, x: 96, y: 48 },
        inputs: [{ key: 'up', from: 0, to: 20 }, { key: 'down', from: 20, to: 128 },
            { key: 'right', from: 128, to: 150 }, { key: 'up', from: 150, to: 240 }],
        ticks: 240,
        what: 'boots L13 under `stairsdown@96,32` (→ L20 at 32,48), steps in and holds `down` into '
            + '`lock@32,80`: `{20,4}` boots `buttonroom@192,16` PRESSED, its group 0 is latched from '
            + 'the build, and the lock fades open under the player; then right along row 6 and up',
    }),
]);

/** The chain-end staging every witness carries (`r9-solve-32`, frozen). */
export const F6_BASE = join('fixtures', 'witness-bases', 'r9-solve-32.f6.json');

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

    const base = parseTape(readFileSync(join(MODULE, F6_BASE), 'utf8'));
    const carried = new Set(base.persistence.map((p) => `${p.level},${p.tag}`));
    for (const slot of ['17,29', '2,0', '20,4']) {
        check(`the chain-end staging carries {${slot}}`, carried.has(slot));
    }
    const levelSource = atlasLevelSource();
    for (const w of F6_WITNESSES) {
        const description = `⛓⛓⛓ SEEDLING FIDELITY F6 (${w.row}) — the chain-end staging (\`r9-solve-32\`'s `
            + `declarations, every carried clear) ${w.what}. Authored by `
            + 'scripts/procgen/plan-seedling-f6-reentry.mjs.';
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
