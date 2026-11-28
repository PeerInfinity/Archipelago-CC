/**
 * ⛓ SEEDLING HAMMER-PHASE ENTRY-38 STEP 2 (⚖ the user 2026-11-27, *"Measure-first slice (Recommended)"*) — the
 * default-tier rows of `PRESS_GLIDE_FOLLOW`: the switch, the pure chain rule, the axis rule, the fork admission, the
 * two guarded readers, and a witness on committed fixtures (cheap: one L63 solve per arm, ~1 s together).
 *
 * The witness is `spearPressGateWait.test.js`'s L63 staging (`r8-solve-11`'s, booted at (144,104) with the Spear and the
 * Wand held), with the SWORD selected and `WALK_BLADE_ARM` + `SPEAR_PRESS_GATE_WAIT` on (the folded stack's two press
 * switches), solving the same reach-exit (0,96) push chain entry 38's 38:2 solves (four W thrusts at
 * pushableblockspear@112,96). OFF it solves with one chaser hit taken in an idle glide wait; ON the glide waits of
 * route steps 2 and 3 lean, step 1's lean is refused on the fork (it walks into the spinning axe's sweep and dies),
 * and the plan is hitless and shorter — re-measure-12's A1 38:2 in miniature.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    PRESS_GLIDE_FOLLOW, PRESS_GLIDE_FOLLOW_COUNTS, PRESS_GLIDE_FOLLOW_DEFAULT, blockSettledOn, glideFollowNext,
    glideFollowReady, leanOnFork, pressGlideFollowHook, resetPressGlideFollowCounts, shortOfStance, withPressGlideFollow,
} from './pressGlideFollow.js';
import { withSpearPressGateWait } from './spearPressGateWait.js';
import { withWalkBladeArm } from './walkBladeArm.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { solveStaging, stagingFromTape } from './tapeRunner.js';
import { liveOf, replayTape, solveFromTape } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
const FAMILY = readFileSync(join(HERE, 'pressGlideFollow.js'), 'utf8');

const press = (dir, extra = {}) => ({ verb: 'press', dir, to: { tx: 0, ty: 0 }, ...extra });

describe('PRESS_GLIDE_FOLLOW — the switch', () => {
    it('ships OFF, reads its env name, and the name is in the worker\'s table', () => {
        expect(PRESS_GLIDE_FOLLOW_DEFAULT).toBe(false);
        expect(PRESS_GLIDE_FOLLOW.enabled).toBe(process.env.SEEDLING_PRESS_GLIDE_FOLLOW === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_GLIDE_FOLLOW');
    });

    it('its with-wrapper sets the switch inside and restores it after, also on a throw', () => {
        const was = PRESS_GLIDE_FOLLOW.enabled;
        expect(withPressGlideFollow(true, () => PRESS_GLIDE_FOLLOW.enabled)).toBe(true);
        expect(withPressGlideFollow(false, () => PRESS_GLIDE_FOLLOW.enabled)).toBe(false);
        expect(PRESS_GLIDE_FOLLOW.enabled).toBe(was);
        expect(() => withPressGlideFollow(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_GLIDE_FOLLOW.enabled).toBe(was);
    });
});

describe('glideFollowNext — a push chain only (pure)', () => {
    it('a non-sinking press followed by a press in the same direction from a stance is eligible', () => {
        const next = press('W', { stance: { x: 104, y: 104 } });
        expect(glideFollowNext([press('W'), next], 0)).toBe(next);
    });

    it('a sink, a last step, a turn, a stance-less next step or another verb is not', () => {
        const next = press('W', { stance: { x: 104, y: 104 } });
        expect(glideFollowNext([press('W', { destroys: true }), next], 0)).toBeNull();
        expect(glideFollowNext([press('W')], 0)).toBeNull();
        expect(glideFollowNext([press('W'), press('N', { stance: { x: 1, y: 1 } })], 0)).toBeNull();
        expect(glideFollowNext([press('W'), press('W')], 0)).toBeNull();
        expect(glideFollowNext([{ verb: 'shove', dir: 'W' }, next], 0)).toBeNull();
        expect(glideFollowNext([press('W'), { verb: 'break', stance: { x: 1, y: 1 } }], 0)).toBeNull();
        expect(glideFollowNext(null, 0)).toBeNull();
    });
});

describe('glideFollowReady — the thrust landed and the gates are down (pure)', () => {
    const rect0 = { x: 112, y: 96 };
    const down = { state: { slashing: false }, gate: { wanding: false, firing: false, spearing: false } };
    it('the block still on its rect is not ready; moved or gone is', () => {
        expect(glideFollowReady({ rect0, live: { rect: { x: 112, y: 96 } }, slashInfo: down })).toBe(false);
        expect(glideFollowReady({ rect0, live: { rect: { x: 111.5, y: 96 } }, slashInfo: down })).toBe(true);
        expect(glideFollowReady({ rect0, live: { removed: true, rect: { x: 112, y: 96 } }, slashInfo: down })).toBe(true);
        expect(glideFollowReady({ rect0, live: null, slashInfo: down })).toBe(true);
    });

    it('a press gate still up (the thrust itself) is not ready', () => {
        const up = { state: { slashing: false }, gate: { spearing: true } };
        expect(glideFollowReady({ rect0, live: { rect: { x: 110, y: 96 } }, slashInfo: up })).toBe(false);
    });
});

describe('shortOfStance — the push axis only (pure)', () => {
    it('positive while a step in `dir` brings the player closer, zero or below from level on', () => {
        const stance = { x: 104, y: 104 };
        expect(shortOfStance('W', { x: 118, y: 0 }, stance)).toBe(14);
        expect(shortOfStance('W', { x: 104, y: 0 }, stance)).toBe(0);
        expect(shortOfStance('E', { x: 90, y: 0 }, stance)).toBe(14);
        expect(shortOfStance('N', { x: 0, y: 110 }, stance)).toBe(6);
        expect(shortOfStance('S', { x: 0, y: 110 }, stance)).toBe(-6);
        expect(shortOfStance('?', { x: 0, y: 0 }, stance)).toBe(0);
    });
});

describe('blockSettledOn — the press verb\'s settle test (pure)', () => {
    it('on the tile and settled; off the tile, moving, gone or missing is not', () => {
        const to = { tx: 5, ty: 6 };
        expect(blockSettledOn({ rect: { x: 80, y: 96 } }, true, to, 16)).toBe(true);
        expect(blockSettledOn({ rect: { x: 81, y: 96 } }, true, to, 16)).toBe(true);
        expect(blockSettledOn({ rect: { x: 96, y: 96 } }, true, to, 16)).toBe(false);
        expect(blockSettledOn({ rect: { x: 80, y: 96 } }, false, to, 16)).toBe(false);
        expect(blockSettledOn({ rect: { x: 80, y: 96 }, removed: true }, true, to, 16)).toBe(false);
        expect(blockSettledOn(undefined, true, to, 16)).toBe(false);
    });
});

describe('leanOnFork — the lean is admitted only by the fork', () => {
    /** A fake fork: `left` moves the player 2 px west; the block settles after `settleAt` ticks; `hurt(t)` bills. */
    const fake = ({ x = 118, settleAt = 10, hurtAt = null, dieAt = null, cross = null } = {}) => () => {
        let t = 0;
        const hits = [];
        const deaths = [];
        const f = {
            state: { x, y: 104 },
            ledger: (k) => (k === 'playerHits' ? hits : deaths),
            advance: (keys) => {
                t += 1;
                if (keys.has('left')) f.state.x -= 2;
                if (t === hurtAt) hits.push({ t, source: 'chaser', id: 'c' });
                if (t === dieAt) deaths.push({ t });
                return { transition: t === cross ? { to_level: 1 } : null };
            },
            get t() { return t; },
        };
        return f;
    };
    const next = press('W', { stance: { x: 104, y: 104 } });
    const settledAfter = (n) => (f) => f.t >= n;

    it('leans while short of the stance, then stops; the keys end on the last lean tick', () => {
        const got = leanOnFork({ fork: fake(), next, key: 'left', left: 40, settled: settledAfter(10) });
        expect(got).toEqual({ keys: Array.from({ length: 7 }, () => ['left']) });
    });

    it('refuses by name: no fork, a door, a death, a hit, no settle, already level', () => {
        expect(leanOnFork({ fork: null, next, key: 'left', left: 40, settled: () => true }).why).toMatch(/^no fork/);
        expect(leanOnFork({ fork: () => null, next, key: 'left', left: 40, settled: () => true }).why).toMatch(/^no fork/);
        expect(leanOnFork({ fork: fake({ cross: 2 }), next, key: 'left', left: 40, settled: settledAfter(10) }).why)
            .toBe('the lean crosses a door on the fork');
        expect(leanOnFork({ fork: fake({ dieAt: 3, hurtAt: 2 }), next, key: 'left', left: 40, settled: settledAfter(10) }).why)
            .toBe('the lean dies on the fork');
        expect(leanOnFork({ fork: fake({ hurtAt: 4 }), next, key: 'left', left: 40, settled: settledAfter(10) }).why)
            .toBe('the lean takes 1 hit(s) on the fork (first chaser:c at t4)');
        expect(leanOnFork({ fork: fake(), next, key: 'left', left: 5, settled: settledAfter(10) }).why)
            .toBe('the block does not settle on the fork within 5 tick(s) of leaning');
        expect(leanOnFork({ fork: fake({ x: 104 }), next, key: 'left', left: 40, settled: settledAfter(10) }).why)
            .toBe('the player is already level with the next stance');
    });
});

describe('pressGlideFollowHook — asked once, then handed out tick by tick', () => {
    const route = [press('W'), press('W', { stance: { x: 104, y: 104 } })];
    const down = { state: { slashing: false }, gate: {} };
    it('not eligible: null; eligible: idles until the thrust lands, then hands the fork\'s keys out and idles after', () => {
        resetPressGlideFollowCounts();
        expect(pressGlideFollowHook({ route, i: 1, rect: { x: 0, y: 0 } })).toBeNull();
        let forks = 0;
        const hook = pressGlideFollowHook({ route, i: 0, rect: { x: 96, y: 96 } });
        const fork = () => {
            forks += 1;
            const f = { t: 0, state: { x: 108, y: 104 }, ledger: () => [],
                advance: (k) => { f.t += 1; if (k.has('left')) f.state.x -= 2; return {}; } };
            return f;
        };
        const ask = (x) => hook.keys({ live: { rect: { x, y: 96 } }, slashInfo: down, t: 7, fork, key: 'left', left: 30,
            settled: () => false });
        expect(ask(96)).toBeNull();
        expect(forks).toBe(0);
        // a fork that never settles refuses the lean: the hook idles for the rest of the wait and never forks again
        expect(ask(95)).toBeNull();
        expect(ask(94)).toBeNull();
        expect(forks).toBe(1);
        expect(PRESS_GLIDE_FOLLOW_COUNTS.declined).toEqual([{ t: 7, step: 1, next: 2,
            why: 'the block does not settle on the fork within 30 tick(s) of leaning' }]);
        const hook2 = pressGlideFollowHook({ route, i: 0, rect: { x: 96, y: 96 } });
        const ask2 = () => hook2.keys({ live: { rect: { x: 95, y: 96 } }, slashInfo: down, t: 9, fork, key: 'left', left: 30,
            settled: (f) => f.t >= 5 });
        // 108 → 106 → 104 leans two ticks; the fork idles on to its settle, and the hook hands out only the leans
        expect([ask2(), ask2(), ask2(), ask2(), ask2()]).toEqual([['left'], ['left'], null, null, null]);
        expect(forks).toBe(2);
        expect(PRESS_GLIDE_FOLLOW_COUNTS).toMatchObject({ asked: 3, eligible: 2,
            followed: [{ t: 9, step: 1, next: 2, leaned: 2 }] });
    });
});

describe('PRESS_GLIDE_FOLLOW — the two guarded readers', () => {
    it('`execRoute` hands the hook only with the switch on; `execSpearPress`\'s glide wait asks it, else idles', () => {
        expect(SOURCE.match(/pressGlideFollowHook\(/g) ?? []).toHaveLength(1);
        expect(SOURCE).toContain('...(PRESS_GLIDE_FOLLOW.enabled ? { glideFollow: pressGlideFollowHook({ route, i,');
        const at = SOURCE.indexOf('function execSpearPress(');
        const body = SOURCE.slice(at, SOURCE.indexOf('\n}\n', at));
        const thrust = body.indexOf("step(new Set(['primary']), 'the thrust');");
        const ask = body.indexOf('const lean = p.glideFollow?.keys({');
        expect(thrust).toBeGreaterThan(-1);
        expect(ask).toBeGreaterThan(thrust);
        expect(body).toContain("step(lean ? new Set(lean) : IDLE, 'the glide wait');");
        expect(body.match(/p\.glideFollow/g) ?? []).toHaveLength(1);
    });

    it('the family file carries no single-game constant and reads no run getter (the fork\'s ledgers only)', () => {
        const code = FAMILY.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*\*)/.test(l)).join('\n');
        expect(code).not.toMatch(/level\s*===\s*\d|@\d+,\d+|\b(?:jellyfish|pushableblockspear|spinningaxe)\b|\b16\b/);
        expect(code).not.toMatch(/\.progress\(|\.entities\(/);
    });
});

describe('the witness: entry 38\'s push chain in miniature (r8-solve-11 staging, L63, sword selected)', () => {
    const levelSource = atlasLevelSource();
    const WAND_KEYS = { wandShotTrapBodies: true, wandShotEnemyBodies: true };
    const fixture = () => {
        const tape = parseTape(JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r8-solve-11.json'), 'utf8')));
        const staging = solveStaging(stagingFromTape(tape));
        staging.boot = { level: 63, x: 144, y: 104 };
        staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
        staging.seam = { ...staging.seam, items: { ...(staging.seam?.items ?? {}), hasSpear: true, hasWand: true } };
        return staging;
    };
    // the prefix: one idle tick with the sword selected (slot 0 of [sword, wand, spear])
    const perTick = [new Set()];
    const equips = new Map([[0, 0]]);
    const solve = (on) => withContactFidelity(WAND_KEYS, () => withSpearPressGateWait(true, () => withWalkBladeArm(true,
        () => withPressGlideFollow(on, () => {
            const staging = fixture();
            const run = replayTape({ staging, perTick, levelSource, equips, scratchPersistence: true });
            expect(run.progress('primaryWeapon')).toBe('sword');
            resetPressGlideFollowCounts();
            const out = solveFromTape({ staging, perTick, live: liveOf(run), levelSource, scratchPersistence: true, equips,
                solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 96 } } });
            const shifted = [...(out.equipsAt ?? [])].map(([t, s]) => [t + perTick.length, s]);
            const replay = replayTape({ staging, perTick: [...perTick, ...out.solution], levelSource,
                equips: new Map([...equips, ...shifted]), scratchPersistence: true });
            return { ticks: out.solution.length, hits: (replay.ledger('playerHits') ?? []).map((h) => `${h.source}:${h.id}`),
                row: liveOf(replay).row, counts: structuredClone(PRESS_GLIDE_FOLLOW_COUNTS) };
        }))));

    it('OFF: the chain solves and its replay takes a chaser hit in an idle glide wait; the hook is never asked', () => {
        const off = solve(false);
        expect(off.row.level).toBe(61);
        expect(off.hits).toEqual(['chaser:jellyfish@160,64']);
        expect(off.counts).toEqual({ asked: 0, eligible: 0, followed: [], declined: [] });
    });

    it('ON: steps 2 and 3 lean, step 1\'s lean dies on the fork and is refused, and the plan is hitless and shorter', () => {
        const off = solve(false);
        const on = solve(true);
        expect(on.row.level).toBe(61);
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBeLessThan(off.ticks);
        expect(on.counts.asked).toBe(4);
        expect(on.counts.eligible).toBe(3);
        expect(on.counts.declined.map((d) => [d.step, d.why])).toEqual([[1, 'the lean dies on the fork']]);
        expect(on.counts.followed.map((d) => d.step)).toEqual([2, 3]);
    });
});
