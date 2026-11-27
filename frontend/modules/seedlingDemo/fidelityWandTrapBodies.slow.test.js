/**
 * ⛓ SEEDLING FIDELITY WANDTRAPBODIES (wave 67), the slow half:
 *   - EVERY committed tape (`fixtures/tapes/*.json` and `fixtures/**\/*.tape.json`) plays byte-identically with
 *     `wandShotTrapBodies` ON — alone, and with the base's last seven OFF keys ON beside it (the D3 measurement: 0 movers
 *     over both arms; no committed tape fires a wand in a darktrap or grenade room). A mover here is a shot that met a
 *     trap body: explain it or STOP on it;
 *   - the captured entry-37 request S1 37:8 (re-measure-10, a 2560 solve): OFF refuses with the shipped text
 *     (`9c5ba5c37277`); ON gets past it, to the solver's axe-dodge refusal on `spinningaxe@128,80` (`8c781b9832a7`, the
 *     hammer's hand-over).
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
const KEY = 'wandShotTrapBodies';
const LAST_SEVEN = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true,
    publishedButtonRoomSetter: true, responderStepAfterReaders: true, deadFrameResponderStep: true, enemyPressesFallRockButton: true };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const FILES = [...readdirSync(join(FIX, 'tapes')).filter((f) => f.endsWith('.json')).map((f) => join(FIX, 'tapes', f)),
    ...walk(FIX).filter((p) => p.endsWith('.tape.json'))].sort();
const play = (tape, over) => withContactFidelity(over, () => {
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e?.name}: ${e?.message}`; }
});

describe('WANDTRAPBODIES — every committed tape, ON vs OFF', () => {
    for (const [arm, base] of [['alone', {}], ['beside the last seven', LAST_SEVEN]]) {
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

describe('WANDTRAPBODIES — the captured entry-37 request S1 37:8 (re-measure-10)', () => {
    const load = (file, id, i) => {
        const legs = gunzipSync(readFileSync(join(EVIDENCE, file))).toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
        return legs.find((l) => l.id === id).requests.find((r) => r.i === i).request;
    };

    it('OFF refuses with the shipped text; ON gets past it to the solver\'s axe-dodge refusal', async () => {
        const req = load('S1.stop-requests-32-33-37.jsonl.gz', 37, 8);
        const off = await withContactFidelity({ [KEY]: false }, () => replayOnce(req));
        expect(off.answer).toBe('9c5ba5c37277');
        expect(off.message).toContain('levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot '
            + 'place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272.');
        const on = await withContactFidelity({ [KEY]: true }, () => replayOnce(req));
        expect(on.kind).toBe('refusal');
        expect(on.message).not.toContain('WandShot');
        expect(on.message).toMatch(/^solverBot\(wasm-exit-63\) reach-exit \(128,304\)->L65: the combat ladder is EXHAUSTED/);
        expect(on.message).toContain('hazard:spinningaxe@128,80');
        expect(on.answer).toBe('8c781b9832a7');
    }, 600000);
});
