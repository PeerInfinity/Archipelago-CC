/**
 * ⛓ SEEDLING FIDELITY SPINNERPULSE (wave 72) — `spinner@224,112`'s death by `pulser@64,96`'s pulses on the committed
 * tape `r5-shaft-control`, pinned against the GAME's per-tick spinner stream on BOTH level sets.
 *
 * Wave 69 recorded the game's kill at t1643 and the model's at t1397 OFF / t1207 with `pulserDeadFrameUpdate` ON, and
 * handed over "the spinner's pulse-kill path" as 246 ticks off. Measured here (p4g, a fresh page per run,
 * `CC/docs/cloud-reports/seedling-fidelity-spinnerpulse-evidence/`): **the pulse-kill path has no gap.** The 246
 * ticks are a SET mismatch:
 * - the game witness mounts `l25Sets().vanilla`, whose records carry `SEEDLING_SET_PATCHES` — edit 6,
 *   `l39-fallrock-removed`: L39 has NO `fallrock@144,624`, so the rope pull drops no rock and freezes nothing;
 * - `runTape` replays the committed tape on the atlas, where the rock IS placed: the pull drops it, a 197-frame span,
 *   and `publishRopeGroup` steps the group's Pulsers through it (197 mod 51 = 44 frames of phase).
 * On the same set the model OFF is exact at every tick (position, `hits`, `hitsTimer`), in both sets
 * (`d1/game-rockless-set.json.gz`, `d1/game-rock-set.json.gz`; `set-with-rock.mjs` puts the one patched entity back).
 *
 * ⛔ NAMED, NOT FIXED (a STOP: it is an existing key's ON branch): with `pulserDeadFrameUpdate` ON the rope rock's
 * span is stepped TWICE — `publishRopeGroup`'s own pre-step (both arms) and `dropRock`'s
 * `queueDeadPulserFramesNow(frames, 'a rope\'s rock')` (ON). 2 x 197 mod 51 = 37, so ON is 7 ticks late on every
 * pulse after the pull, and the kill lands at 1207 against the game's 1396. Rows below pin the current values, so a
 * licensed fix of that branch turns them red on purpose.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { l25Sets } from './fidelityL25ApItem.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const W72 = 'CC/docs/cloud-reports/seedling-fidelity-spinnerpulse-evidence';
const PULSE = 'pulserDeadFrameUpdate';
const ID = 'spinner@224,112';
const TAPE = JSON.parse(readFileSync(join(HERE, 'fixtures/tapes/r5-shaft-control.json'), 'utf8'));
const game = (f) => JSON.parse(gunzipSync(readFileSync(join(ROOT, W72, 'd1', f))).toString('utf8')).whole.samples;
const GAME = { rockless: game('game-rockless-set.json.gz'), rock: game('game-rock-set.json.gz') };
const SOURCES = { rock: atlasLevelSource(), rockless: l25Sets(ROOT).vanillaSource };

/** The model's row per tape tick (after t advances): the spinner's body, or null once it is out of the list. */
function modelRows(source, over = {}) {
    return withContactFidelity({ [PULSE]: false, ...over }, () => {
        const run = createRunForStaging(stagingFromTape(TAPE), source);
        const rows = [null];
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            run.advance(heldKeysAt(TAPE, t));
            rows.push((run.spinnerBodies ?? []).find((s) => s.id === ID) ?? null);
        }
        return { rows, writes: run.spinnerWrites.map((w) => [w.t, w.flag.tag]), deadPulserFrames: run.deadPulserFrames,
            firstPulse: run.pulserHits[0]?.t ?? null };
    });
}
/**
 * The game's hit ticks of the body, read off ITS stream alone: tracked by nearest neighbour from `start` (the
 * spawn's first row), a hit is a tick whose `hits` differs from the tracked row's before it.
 */
function gameHitTicks(samples, start) {
    let prev = start;
    let hits = 0;
    const out = [];
    for (const s of samples) {
        if (s.level !== 39 || s.sp.length === 0 || prev === null) continue;
        const g = s.sp.reduce((a, b) => (Math.hypot(a.x - prev.x, a.y - prev.y) <= Math.hypot(b.x - prev.x, b.y - prev.y) ? a : b));
        if (Math.hypot(g.x - prev.x, g.y - prev.y) > 12) { prev = null; continue; }
        if (g.hits !== hits) out.push(s.tick);
        hits = g.hits;
        prev = g;
    }
    return out;
}
const gameLedgerTick = (samples) => samples.find((s) => s.cleared.includes('39:4'))?.tick ?? null;
/** Every tick where the model's body (x, y, hits, hitsTimer) is not one of the game's Spinner rows at that tick. */
function mismatches(samples, rows) {
    const out = [];
    for (const s of samples) {
        const m = rows[s.tick];
        if (m === undefined || m === null || m.destroy) continue;
        if (!s.sp.some((g) => g.x === m.x && g.y === m.y && g.hits === m.hits && g.ht === m.hitsTimer)) out.push(s.tick);
    }
    return out;
}

describe('SPINNERPULSE — r5-shaft-control, the model OFF against the game, on the set the game ran', () => {
    for (const set of ['rockless', 'rock']) {
        it(`${set}: the spinner's every live tick (position, hits, hitsTimer) is the game's, OFF`, () => {
            const m = modelRows(SOURCES[set]);
            expect([set, mismatches(GAME[set], m.rows)]).toEqual([set, []]);
        });
    }
    it('the hit ticks and the kill: the model OFF lands the game\'s three pulse hits on each set', () => {
        const hits = (set) => {
            const m = modelRows(SOURCES[set]);
            return m.rows.map((r, t) => (t > 0 && r && m.rows[t - 1] && r.hits !== m.rows[t - 1].hits ? t : null)).filter((t) => t !== null);
        };
        expect([hits('rockless'), hits('rock')]).toEqual([[1068, 1109, 1632], [1068, 1116, 1385]]);
        // the game's own: the same ticks, read off its stream (the body tracked from the spawn's first row)
        const spawn = modelRows(SOURCES.rock).rows[1];
        expect([gameHitTicks(GAME.rockless, spawn), gameHitTicks(GAME.rock, spawn)]).toEqual([[1068, 1109, 1632], [1068, 1116, 1385]]);
    });
    it('the removal: the game\'s ledger holds (39,4) at the sample the body leaves; the model stamps the write one later', () => {
        // `spinnerWrites`' `t` is `ticksCompleted + 1` at the step that finds `removed` (and FENCEPOST's
        // `spinnerRemoveRead` keeps that stamp), so it reads one past the game's sample on both sets.
        const at = (set, over) => modelRows(SOURCES[set], over).writes;
        expect([gameLedgerTick(GAME.rockless), at('rockless'), gameLedgerTick(GAME.rock), at('rock')])
            .toEqual([1643, [[1644, 4]], 1396, [[1397, 4]]]);
        // and with `spinnerRemoveRead` ON the body is out of the list at the game's sample
        const rr = modelRows(SOURCES.rockless, { spinnerRemoveRead: true }).rows;
        const off = modelRows(SOURCES.rockless).rows;
        expect([rr[1642] !== null, rr[1643], off[1643] !== null]).toEqual([true, null, true]);
    });
});

describe('SPINNERPULSE — the four arms of the kill tick, and the named ON defect', () => {
    it('kill write: [rock OFF, rock pulserDeadFrameUpdate ON, rockless OFF, rockless ON]; the game: 1396 and 1643', () => {
        const w = (set, on) => modelRows(SOURCES[set], { [PULSE]: on }).writes;
        expect([w('rock', false), w('rock', true), w('rockless', false), w('rockless', true)])
            .toEqual([[[1397, 4]], [[1207, 4]], [[1644, 4]], [[1644, 4]]]);
    });
    it('the double step: ON queues the rope rock\'s 197 frames that the pull already stepped (pulse phase +7)', () => {
        const off = modelRows(SOURCES.rock);
        const on = modelRows(SOURCES.rock, { [PULSE]: true });
        const none = modelRows(SOURCES.rockless);
        // the Pulser's first pulse hit: no span (rockless, the game's 191 by its 51-frame phase), the span once
        // (OFF, the game's rock set), the span twice (ON)
        expect([none.firstPulse, off.firstPulse, on.firstPulse]).toEqual([191, 198, 205]);
        expect([off.deadPulserFrames, on.deadPulserFrames.map((q) => [q.why, q.frames])])
            .toEqual([[], [['a rope\'s rock', 197]]]);
    });
    it('runTape (the committed-tape replay) is the atlas arm: its write is the rock set\'s', () => {
        expect(runTape(TAPE, { levelSource: SOURCES.rock }).spinnerWrites.map((w) => [w.t, w.flag.tag])).toEqual([[1397, 4]]);
    });
});
