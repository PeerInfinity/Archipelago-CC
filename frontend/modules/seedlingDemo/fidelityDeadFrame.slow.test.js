/**
 * ⛓ SEEDLING FIDELITY DEADFRAME (wave 66), the slow half: EVERY committed tape (`fixtures/tapes/*.json` and
 * `fixtures/**\/*.tape.json`) plays byte-identically with `deadFrameResponderStep` and `enemyPressesFallRockButton` ON —
 * alone, and with the base's last five OFF keys ON beside them (the D3 measurement, `tape-deadframe.mjs`: 0 movers over
 * every arm). A mover here is a dead span or an enemy press the census did not see: explain it or STOP on it.
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
const OFF = { deadFrameResponderStep: false, enemyPressesFallRockButton: false };
const ON = { deadFrameResponderStep: true, enemyPressesFallRockButton: true };
const LAST_FIVE = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true, publishedButtonRoomSetter: true,
    responderStepAfterReaders: true };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e?.name}: ${e?.message}`; }
});

describe('DEADFRAME — every committed tape, ON vs OFF', () => {
    for (const [arm, base] of [['alone', {}], ['beside the last five', LAST_FIVE]]) {
        it(`no tape moves (${arm})`, () => {
            const movers = [];
            let n = 0;
            for (const p of FILES) {
                let tape;
                try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
                if (!tape?.inputs || !tape?.boot) continue;
                n += 1;
                if (play(tape, { ...base, ...OFF }) !== play(tape, { ...base, ...ON })) movers.push(relative(FIX, p));
            }
            expect(n).toBeGreaterThan(300);
            expect(movers).toEqual([]);
        }, 600000);
    }
});
