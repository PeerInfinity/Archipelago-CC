/**
 * ⛓ seedling-fidelity-slowfix D-B — THE L15 POST-CHEST WALK IS A HOLD SEAM, NOT A MODEL GAP.
 *
 * logical-links B's known divergence `l15-post-chest-walk` (`scripts/procgen/seedlingKnownDivergences.js`; battery
 * 39870675057, repeat 39873208691): after 'Level 015 - Chest' (185 t) the continuation `level_15__r1c5 -> level_14`
 * (157 t) leaves the model at t18 — model x 115.05, game 115.30, y equal. The game's witnesses
 * (`fixtures/hold-seam-witness/l15-hold-seam.json`, recorded on p4g headless with the AP set mounted, by
 * `CC/docs/cloud-reports/seedling-fidelity-slowfix-evidence/probe-hold-seam.mjs`) say where the 0.25 px comes from:
 *   · joined  — both legs as ONE tape: the model reproduces the game at 0 px, 343 observations. The physics are right.
 *   · held    — the chest leg ends `hold: true` (as the engine ships it), the game is held 300 ms, then the engine's own
 *               continuation tape: `game_time` stays 26912 and the player stays at x 152.6, but the pinned Swim channel
 *               runs 33 → 44 (`Bot.update` steps `Music.pinStep()` above the armed check, on every engine frame). The
 *               continuation reads 115.30 at t18 — the live signature — and the model reproduces it at 0 px once its
 *               swim channel is stepped by the held frames (`levelRun.stepHeldFrames`).
 * The player stands in the water at the seam, so nothing moves while held: only the boost window (`Player.as:548`,
 * `soundPosition("Swim") < 0.1`) is shifted, and the shift first shows at t18.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createRunForStaging } from './tapeRunner.js';
import { deliveredMoonrockSet } from './fidelityMoonrock.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'hold-seam-witness', 'l15-hold-seam.json'), 'utf8'));

/** The page's AP rooms for this walk: the delivered set with L15's chest the AP placement the page mounts there. */
function apLevelSource() {
    const { records } = deliveredMoonrockSet(REPO);
    const r15 = records.get(15);
    const swapped = new Map(records);
    swapped.set(15, { ...r15, entities: r15.entities.map((e) => (e.type === 'chest' && e.x === 144 && e.y === 96
        ? { type: 'apitem', x: 144, y: 96, attrs: { tag: '1', look: 'chest' } } : e)) });
    return swapped;
}
const RECORDS = apLevelSource();

async function freshRun() {
    const { levelSourceFromAtlas } = await import('./atlasSource.js');
    return createRunForStaging(W.staging, levelSourceFromAtlas(RECORDS), { scratchPersistence: true });
}

/** Step `keys` from `run`, one observation per tick (`t` from `t0`), the start included. */
function track(run, keys, t0 = 0) {
    const out = [{ t: t0, level: run.level, x: run.state.x, y: run.state.y }];
    for (const k of keys) {
        run.advance(new Set(k));
        out.push({ t: out.length + t0, level: run.level, x: run.state.x, y: run.state.y });
    }
    return out;
}

/** The game's observations against the model's: the first differing tick and the worst offset. */
function compare(game, model) {
    let first = null;
    let worst = 0;
    for (const o of game) {
        const m = model.find((q) => q.t === o.t);
        const d = !m || m.level !== o.level ? Infinity : Math.max(Math.abs(m.x - o.x), Math.abs(m.y - o.y));
        if (d > 0 && first === null) first = { t: o.t, game: o, model: m };
        worst = Math.max(worst, d);
    }
    return { first, worst, compared: game.length };
}

describe('fidelity SLOWFIX D-B — the L15 hold seam (the game\'s witnesses, reproduced)', () => {
    it('the AP room the page mounts is the delivered L15 with its chest an apitem {tag 1, look chest}', () => {
        expect(RECORDS.get(15).entities.filter((e) => e.type === 'apitem')).toEqual([
            { type: 'apitem', x: 144, y: 96, attrs: { tag: '1', look: 'chest' } }]);
        expect(RECORDS.get(15).entities.some((e) => e.type === 'chest')).toBe(false);
    });

    it('joined (one tape, no hold): the model reproduces the game at 0 px on every observation', async () => {
        const model = track(await freshRun(), [...W.chestKeys, ...W.walkKeys]);
        const v = compare(W.joined.ticks, model);
        expect(v.compared).toBe(343);
        expect(v.first).toBeNull();
        expect(v.worst).toBe(0);
        // at the continuation's t18 the game read the model's value, not the live 115.30
        expect(W.joined.ticks[W.chestKeys.length + 18].x).toBe(115.05000000000047);
    });

    it('held: the game held 300 ms — game_time and the player frozen, the swim pin 33 → 44 by t1 (10 held frames)', () => {
        expect(W.held.seam.first.game_time).toBe(26912);
        expect(W.held.seam.last.game_time).toBe(26912);
        expect(W.held.seam.last.x).toBe(152.6000000000004);
        expect(W.held.pinAtChestEnd).toEqual({ playing: true, frames: 33, len_frames: 47 });
        expect(W.held.pinAtContinuation['1']).toEqual({ playing: true, frames: 44, len_frames: 47 });
        expect(W.heldFrames).toBe(10);
    });

    it('held: the chest leg is the model\'s at 0 px, and its end channel is the game\'s pin', async () => {
        const run = await freshRun();
        const model = track(run, W.chestKeys);
        const v = compare(W.held.chest.filter((o) => o.t <= W.chestKeys.length), model);
        expect(v.first).toBeNull();
        expect(run.state.swim).toEqual({ frames: 33, open: true, lengthFrames: 47 });
    });

    it('held: with the hold\'s frames stepped (stepHeldFrames(10)) the model reproduces the continuation at 0 px', async () => {
        const run = await freshRun();
        track(run, W.chestKeys);
        expect(run.stepHeldFrames(W.heldFrames)).toEqual({ frames: 43, open: true, lengthFrames: 47 });
        const model = track(run, W.walkKeys);
        const v = compare(W.held.continuation, model);
        expect(v.compared).toBe(158);
        expect(v.first).toBeNull();
        expect(v.worst).toBe(0);
        expect(W.held.continuation[18].x).toBe(115.30000000000047);
    });

    it('CONTROL: without the held frames the model leaves the game at t18, +0.25 px in x, y equal — the live signature', async () => {
        const run = await freshRun();
        track(run, W.chestKeys);
        const v = compare(W.held.continuation, track(run, W.walkKeys));
        expect(v.first.t).toBe(18);
        expect(v.first.model.x).toBe(115.05000000000047);
        expect(v.first.game.x).toBe(115.30000000000047);
        expect(v.first.model.y).toBe(v.first.game.y);
    });

    it('stepHeldFrames touches the swim channel only, refuses a bad count, and is null before any swim sound', async () => {
        const run = await freshRun();
        expect(run.stepHeldFrames(5)).toBeNull();
        const before = { ...run.state, swim: null };
        expect({ ...run.state, swim: null }).toEqual(before);
        expect(() => run.stepHeldFrames(-1)).toThrow(/non-negative integer/);
        expect(() => run.stepHeldFrames(1.5)).toThrow(/non-negative integer/);
    });
});
