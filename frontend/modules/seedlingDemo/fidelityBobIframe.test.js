/**
 * ⛓⛓ SEEDLING FIDELITY BOBIFRAME (wave 39) — L40's `bob@736,752` and the swing pressed at t925, game-witnessed.
 *
 * THE CLAIM IT WAS HANDED (hammer L40-FLIP-BUILD §3.1): on sweep legs `Level 040 - Chest ← L39` / `flag 12 ← L39` the
 * model lands the bob's THIRD hit at t930 — the last test of the swing pressed at t925, on the tick `hitsTimer` lapses
 * (`strikeIframeLapse`) — and the game's bob lives and hits the player at t936. Two candidates: the swing's last test
 * tick against the lapse, or bob state the game holds.
 *
 * WHAT THE GAME SAYS (`probe-seedling-bobiframe.mjs --record`, p4g headless logic-only, the delivered AP record set):
 * bob state, and neither the swing nor the lapse. `spinner@816,848` crosses the bob's box on the bob's FIRST step
 * (t544); a Spinner is `type = "Enemy"` (`Enemy.as:58`) and `Bob.solids` hold "Enemy" (`Bob.as:39`), so
 * `Mobile.moveX/moveY` stop the bob. Every later bob row stands elsewhere: hit 1 lands at t874 (the model's t867), hit
 * 2 at t906 (the model's t900), and the t925 swing's five tests (t926..t930 — the game counts five, `Bot.slashTests`)
 * all meet `hits_timer` 10..6. The lapse and the swing are the model's already.
 *
 * The wall is modelled: `CONTACT_FIDELITY.chaserSpinnerWalls` (L40CONTACT D1, OFF by default). ON, the model is the
 * game at 0 px over the whole tape. No new key is added here; these rows hold either default.
 *
 * Fixtures: `fixtures/bobiframe-witness/` — `…-default` is the solver's own plan at the shipped defaults (1226 t; the
 * game takes hits at t936, t977 and the lethal t1064), `…-walls` its plan for the same request with the key ON
 * (1222 t; the game takes none).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { l25Sets } from './fidelityL25ApItem.js';
import { SLASH_HIT_TICKS } from './presses.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const WIT = join(ROOT, 'frontend/modules/seedlingDemo/fixtures/bobiframe-witness');
const SETS = l25Sets(ROOT);
const BOB = 'bob@736,752';
const SPINNER = 'spinner@816,848';
const load = (name) => ({
    tape: parseTape(readFileSync(join(WIT, `${name}.tape.json`), 'utf8')),
    game: JSON.parse(readFileSync(join(WIT, `${name}.game.json`), 'utf8')),
});
const DEFAULT = load('l40-chest-l39-s5222-default');
const WALLS = load('l40-chest-l39-s5222-walls');

/** The model's replay of a witness tape on the delivered set: per-tick rows in the fixture's own shapes. */
const replay = ({ tape, game }, walls) => withContactFidelity({ chaserSpinnerWalls: walls }, () => {
    const run = createRunForStaging(stagingFromTape(tape), SETS.deliveredSource);
    const player = [];
    const bodies = Object.fromEntries(Object.keys(game.bodies).map((id) => [id, new Map()]));
    for (let t = 1; t <= tape.tick_count; t += 1) {
        run.advance(new Set(heldKeysAt(tape, t - 1)));
        player.push([t, run.state.x, run.state.y]);
        for (const c of run.entities('chasers')) {
            if (bodies[c.id] && c.removed !== true) bodies[c.id].set(t, [t, c.x, c.y, c.vx, c.vy, c.hits, c.hitsTimer]);
        }
        for (const s of run.entities('spinnerBodies')) {
            if (bodies[s.id] && s.removed !== true && s.destroy !== true) bodies[s.id].set(t, [t, s.x, s.y]);
        }
    }
    return { player, bodies, hits: run.playerHits.map((h) => [h.t, h.id]), deaths: run.ledger('playerDeaths').map((d) => d.t),
        press: run.chaserPressHits.filter((h) => h.id === BOB) };
});

/** The first game row the model does not hold (position/velocity within 1e-9, `hits` and `hits_timer` exact). */
const firstParting = (gameRows, modelRows) => {
    for (const g of gameRows) {
        const m = modelRows.get(g[0]);
        if (!m || g.some((v, i) => (i >= 5 ? v !== m[i] : Math.abs(v - m[i]) > 1e-9))) return { t: g[0], game: g, model: m ?? null };
    }
    return null;
};
const firstPlayerParting = (game, model) => game.player.find((g, i) => Math.abs(g[1] - model.player[i][1]) > 1e-9
    || Math.abs(g[2] - model.player[i][2]) > 1e-9)?.[0] ?? null;
const gameBob = (w, t) => w.game.bodies[BOB].find((r) => r[0] === t);

describe('BOBIFRAME — the fixtures are the probe\'s, on p4g and the delivered set', () => {
    it('both recordings name the build, the set and every tick', () => {
        for (const w of [DEFAULT, WALLS]) {
            expect(w.game).toMatchObject({ page: 'seedling_bot_ap_p4g', delivered_set: SETS.delivered.set_id, ticks: w.tape.tick_count });
            expect(w.game.player.map((r) => r[0])).toEqual(Array.from({ length: w.tape.tick_count }, (_, i) => i + 1));
        }
        expect(DEFAULT.tape.tick_count).toBe(1226);
        expect(WALLS.tape.tick_count).toBe(1222);
    });
    it('the game: the default plan takes hits at t936, t977 and the lethal t1064; the walls plan takes none', () => {
        expect(DEFAULT.game.gameHits).toEqual([936, 977, 1064]);
        expect(DEFAULT.game.player.find((r) => r[0] === 936).slice(1, 5)).toEqual([745.8594284721097, 786.5671307599894, 1, 19]);
        expect(WALLS.game.gameHits).toEqual([]);
        expect(WALLS.game.player.every((r) => r[3] === 0 && r[4] === 0)).toBe(true);
    });
});

describe('BOBIFRAME D0 — the default plan on the game: bob state, not the swing and not the lapse', () => {
    const on = replay(DEFAULT, true);
    const off = replay(DEFAULT, false);

    it('the game runs FIVE tests for the swing pressed at t925 (t926..t930), each against a LIVE i-frame', () => {
        const tests = new Map(DEFAULT.game.player.map((r) => [r[0], r[5]]));
        expect(heldKeysAt(DEFAULT.tape, 924)).toContain('primary');
        expect(SLASH_HIT_TICKS).toBe(5);
        expect([925, 926, 927, 928, 929, 930, 931].map((t) => tests.get(t) - tests.get(t - 1))).toEqual([0, 1, 1, 1, 1, 1, 0]);
        // the bob's own `hits` / `hits_timer` on the five test ticks: hit 2 landed at t906, so the timer reads 10..6
        expect([926, 927, 928, 929, 930].map((t) => gameBob(DEFAULT, t).slice(5))).toEqual([[2, 10], [2, 9], [2, 8], [2, 7], [2, 6]]);
        expect(gameBob(DEFAULT, 874).slice(5)).toEqual([1, 30]);
        expect(gameBob(DEFAULT, 906).slice(5)).toEqual([2, 30]);
        // and it dies to the NEXT swing, ten ticks after the contact at t936
        expect(gameBob(DEFAULT, 946).slice(5)).toEqual([3, 30]);
    });

    it('the cause, on the game: the bob\'s first step (t544) is stopped by spinner@816,848 crossing its box', () => {
        const [, bx, by, vx, vy] = gameBob(DEFAULT, 544);
        expect([bx, by]).toEqual([744, 760]);
        expect(gameBob(DEFAULT, 543).slice(1, 3)).toEqual([744, 760]);
        // it steered (v is the chase's) and did not move: `Mobile.moveX/moveY` met an "Enemy"
        expect(Math.hypot(vx, vy)).toBeCloseTo(0.5, 9);
        const [, sx, sy] = DEFAULT.game.bodies[SPINNER].find((r) => r[0] === 544);
        // the spinner's 7x7 box (origin 4,4) against the bob's 8x8 box (origin 4,4) one friction-step along its sweep
        const overlap = (ax, ay, aw, bx2, by2, bw) => ax < bx2 + bw && bx2 < ax + aw && ay < by2 + bw && by2 < ay + aw;
        expect(overlap(sx - 4, sy - 4, 7, bx - 4 - 0.01, by - 4 - 0.01, 8)).toBe(true);
    });

    it('chaserSpinnerWalls ON: the model is the game at 0 px — the player, both bobs (hits, hits_timer), the spinner', () => {
        expect(firstPlayerParting(DEFAULT.game, on)).toBe(null);
        for (const id of Object.keys(DEFAULT.game.bodies)) {
            expect(DEFAULT.game.bodies[id].length).toBeGreaterThan(300);
            expect(firstParting(DEFAULT.game.bodies[id], on.bodies[id])).toBe(null);
        }
        expect(on.hits).toEqual([[936, BOB], [977, 'bob@736,800'], [1064, 'bob@736,800']]);
        expect(on.deaths).toEqual([1064]);
        // the t925 swing in the model: five tests, all refused by the i-frame (the ledger's `t` is the tick before)
        expect(on.press.filter((h) => h.t >= 925 && h.t <= 929).map((h) => [h.t + 1, h.landed, h.hitsTimer]))
            .toEqual([[926, false, 10], [927, false, 9], [928, false, 8], [929, false, 7], [930, false, 6]]);
        expect(on.press.filter((h) => h.landed).map((h) => [h.t + 1, h.hits])).toEqual([[874, 1], [906, 2], [946, 3]]);
    });

    it('chaserSpinnerWalls OFF (the control): the bob parts at t544 by 0.177 px, hit 3 lands at t930, the player parts at t936', () => {
        const p = firstParting(DEFAULT.game.bodies[BOB], off.bodies[BOB]);
        expect(p.t).toBe(544);
        expect(Math.hypot(p.game[1] - p.model[1], p.game[2] - p.model[2])).toBeCloseTo(0.25, 9);
        expect(Math.abs(p.game[2] - p.model[2])).toBeCloseTo(0.17677669529666673, 9);
        expect(off.press.filter((h) => h.landed).map((h) => [h.t + 1, h.hits, h.killed])).toEqual([[867, 1, false], [900, 2, false], [930, 3, true]]);
        expect(firstPlayerParting(DEFAULT.game, off)).toBe(936);
        expect(off.hits).toEqual([]);
    });
});

describe('BOBIFRAME D2 — the same request solved with chaserSpinnerWalls ON plays hitless on the game', () => {
    it('ON: the model is the game at 0 px over the plan\'s 1222 ticks, and neither bills a hit', () => {
        const on = replay(WALLS, true);
        expect(firstPlayerParting(WALLS.game, on)).toBe(null);
        for (const id of Object.keys(WALLS.game.bodies)) expect(firstParting(WALLS.game.bodies[id], on.bodies[id])).toBe(null);
        expect(on.hits).toEqual([]);
        expect(on.press.filter((h) => h.landed).map((h) => h.hits)).toEqual([1, 2, 3]);
    });
    it('OFF (the control): the bob still parts at t544 — the plan is hitless in both, the bodies are the game\'s only ON', () => {
        const off = replay(WALLS, false);
        expect(firstParting(WALLS.game.bodies[BOB], off.bodies[BOB])?.t).toBe(544);
    });
});
