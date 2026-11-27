/**
 * ⛓ SEEDLING FIDELITY WANDKILL (wave 71), the slow half: EVERY committed tape (`fixtures/tapes/*.json` and
 * `fixtures/**\/*.tape.json`) plays byte-identically with `wandShotKill` ON —
 *   · alone (it requires `wandShotEnemyBodies`: alone it reaches nothing);
 *   · beside both wand-body keys (`wandShotEnemyBodies`, `wandShotTrapBodies`), the arm the kill needs;
 *   · beside both and the base's last OFF keys before them.
 * A mover here is a committed tape that lands a plain wand's sixth hit on a Turret, SandTrap, LavaTrap, WallFlyer or
 * Drill: explain it or STOP on it (wave 68 measured that no committed tape fires a wand in a room of the six classes).
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
const KEY = 'wandShotKill';
const BOTH = { wandShotEnemyBodies: true, wandShotTrapBodies: true };
const LAST = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true,
    publishedButtonRoomSetter: true, responderStepAfterReaders: true, deadFrameResponderStep: true,
    enemyPressesFallRockButton: true, ...BOTH };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e?.name}: ${e?.message}`; }
});

describe('WANDKILL — every committed tape, ON vs OFF', () => {
    for (const [arm, base] of [['alone', {}], ['beside both wand-body keys', BOTH], ['beside both and the last OFF keys', LAST]]) {
        it(`no tape moves (${arm})`, () => {
            const movers = [];
            let n = 0;
            for (const p of FILES) {
                let tape;
                try { tape = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
                if (!tape?.inputs || !tape?.boot) continue;
                n += 1;
                if (play(tape, { ...base, [KEY]: false }) !== play(tape, { ...base, [KEY]: true })) movers.push(relative(FIX, p));
            }
            expect(n).toBeGreaterThan(300);
            expect(movers).toEqual([]);
        }, 1800000);
    }
});
