/**
 * ⛓ SEEDLING FIDELITY WANDSWINGDRILL (wave 70), the slow half: EVERY committed tape (`fixtures/tapes/*.json` and
 * `fixtures/**\/*.tape.json`) plays byte-identically OFF vs ON — `itemPressHeldBySlash` alone, `drillSightLineGame`
 * alone, both, and both beside the two wand keys (`wandShotTrapBodies`, `wandShotEnemyBodies`). The D3 measurement.
 * A mover is a lone wand/fire press inside a swing or a drill's first-tick line across a tile: explain it or STOP.
 * (The direct census agrees: over every committed tape, no wand, fire or spear press lands while `_slashing` holds,
 * and no drill's first-tick line differs between the full and the object-only list.)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const VANILLA = atlasLevelSource();
const WAND = { wandShotTrapBodies: true, wandShotEnemyBodies: true };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e?.name}: ${e?.message}`; }
});

describe('WANDSWINGDRILL — every committed tape, ON vs OFF', () => {
    for (const [arm, base, on] of [
        ['itemPressHeldBySlash alone', {}, { itemPressHeldBySlash: true }],
        ['drillSightLineGame alone', {}, { drillSightLineGame: true }],
        ['both', {}, { itemPressHeldBySlash: true, drillSightLineGame: true }],
        ['both, beside both wand keys', WAND, { itemPressHeldBySlash: true, drillSightLineGame: true }],
    ]) {
        it(`no tape moves (${arm})`, () => {
            const movers = [];
            let n = 0;
            for (const p of FILES) {
                let tape;
                try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
                if (!tape?.inputs || !tape?.boot) continue;
                n += 1;
                if (play(tape, base) !== play(tape, { ...base, ...on })) movers.push(relative(FIX, p));
            }
            expect(n).toBeGreaterThan(300);
            expect(movers).toEqual([]);
        }, 1800000);
    }
});
