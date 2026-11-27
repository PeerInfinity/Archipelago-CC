/**
 * ⛓ SEEDLING FIDELITY WANDENEMYBODIES (wave 68), the slow half:
 *   - EVERY committed tape (`fixtures/tapes/*.json` and `fixtures/**\/*.tape.json`) plays byte-identically with
 *     `wandShotEnemyBodies` ON — alone, beside `wandShotTrapBodies` alone, and beside the base's last eight OFF keys
 *     (the D3 measurement). A mover here is a shot that met one of the six classes: explain it or STOP on it;
 *   - the captured entry-37 request S1 37:8 (re-measure-10, a 2560 solve) with BOTH wand keys ON: L63 holds none of the
 *     six classes, so the answer is wave 67's ON answer — the solver's axe-dodge refusal on `spinningaxe@128,80`
 *     (`8c781b9832a7`, the hammer's hand-over), unchanged by this key.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { replayOnce } from '../../../scripts/procgen/replay-seedling-solve-request.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
const EVIDENCE = join(HERE, '..', '..', '..', 'CC', 'docs', 'cloud-reports', 'seedling-whole-game-wasm-remeasure-10-evidence');
const VANILLA = atlasLevelSource();
const KEY = 'wandShotEnemyBodies';
const LAST_EIGHT = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true,
    publishedButtonRoomSetter: true, responderStepAfterReaders: true, deadFrameResponderStep: true,
    enemyPressesFallRockButton: true, wandShotTrapBodies: true };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e?.name}: ${e?.message}`; }
});

describe('WANDENEMYBODIES — every committed tape, ON vs OFF', () => {
    for (const [arm, base] of [['alone', {}], ['beside wandShotTrapBodies alone', { wandShotTrapBodies: true }],
        ['beside the last eight', LAST_EIGHT]]) {
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
        }, 900000);
    }
});

describe('WANDENEMYBODIES — the captured entry-37 request S1 37:8 (re-measure-10), both wand keys ON', () => {
    const load = (file, id, i) => {
        const legs = gunzipSync(readFileSync(join(EVIDENCE, file))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
        return legs.find((l) => l.id === id).requests.find((r) => r.i === i).request;
    };

    it('is wave 67\'s ON answer: the solver\'s axe-dodge refusal in L63 (no class of the six there)', async () => {
        const req = load('S1.stop-requests-32-33-37.jsonl.gz', 37, 8);
        const on = await withContactFidelity({ [KEY]: true, wandShotTrapBodies: true }, () => replayOnce(req));
        expect(on.kind).toBe('refusal');
        expect(on.message).toContain('hazard:spinningaxe@128,80');
        expect(on.answer).toBe('8c781b9832a7');
    }, 600000);
});
