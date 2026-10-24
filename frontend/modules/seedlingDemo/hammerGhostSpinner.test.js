/**
 * seedlingDemo/hammerGhostSpinner.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE C2: THE GHOST PRESS AGAINST A SPINNER.
 *
 * The game witness is `hammer-c2-l18-ghostspinner` (D1, recorded on p4f; `tapeRunner` replays it, and its bodies and
 * hit tests were asked of the game: the evidence folder). These rows are D2's gate on that walk, A's shape: with
 * `GHOST_SPINNER_PRESS` ON the two spinner forecasts' bodies — every rect and every `{id, hits, hitsTimer, destroy}` —
 * equal the run's, byte for byte, and their landings are the run's; OFF (the BEFORE model) they forecast no landing
 * at all. Then D3's: a ghost-sword run admits the spinner press kill, plans its strike with the ghost press, and the
 * sword's strike is the same object under either value of the switch.
 */
import { describe, expect, it } from 'vitest';

import {
    GHOST_SPINNER_PRESS, GHOST_SPINNER_PRESS_DEFAULT, GHOST_SPINNER_PRESS_ROW, SWORD_SPINNER_PRESS,
    ghostSpinnerPressFor, spinnerStrikePress, withGhostSpinnerPress,
} from './ghostSpinnerPress.js';
import { GHOST_SLASH_ANIM_TICKS, GHOST_SWORD_REACH } from './ghostSword.js';
import { SLASH_HIT_TICKS, SLASH_REACH } from './presses.js';
import { loadTape } from './fixtures/index.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const WITNESS = 'hammer-c2-l18-ghostspinner';

/** The witness walked on the model: its keys, the player's point at the top of each tick, the bodies after it. */
function walk(name) {
    const tape = loadTape(name);
    const staging = stagingFromTape(tape);
    const make = () => createRunForStaging({ ...staging, equips: [] }, atlasLevelSource());
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const keys = held.filter(Boolean);
    const run = make();
    const points = [];
    const rows = [];
    for (let t = 0; t < keys.length; t += 1) {
        points[t] = { x: run.state.x, y: run.state.y };
        run.advance(keys[t]);
        rows[t] = (run.entities('spinnerBodies') ?? []).map((b) => [b.id, b.hits, b.hitsTimer, b.destroy, b.rect]);
    }
    return { make, keys, points, rows, run };
}

/** A forecast's row `i` in the walk's row shape. */
const forecastRow = (f, i) => f.bodies[i].map((b, k) => [b.id, b.hits, b.hitsTimer, b.destroy, f.rows[i][k]]);

/** `spinnerForecastWithPress` at each press of the walk, from a run replayed to the press tick. */
function pressForecasts(w) {
    const presses = w.run.slashPresses;
    return presses.map((p, j) => {
        const until = presses[j + 1]?.t ?? w.keys.length - 1;
        const r = w.make();
        for (let t = 0; t < p.t; t += 1) r.advance(w.keys[t]);
        const f = r.spinnerForecastWithPress(until - p.t + 1, { pressAt: p.t, direction: p.direction ?? r.state.direction,
            positions: (t) => w.points[t] });
        const diverged = [];
        for (let i = 0; i < f.bodies.length; i += 1) {
            if (JSON.stringify(forecastRow(f, i)) !== JSON.stringify(w.rows[p.t + i])) diverged.push(p.t + i);
        }
        const mine = w.run.spinnerPressHits.find((h) => h.landed && h.t > p.t && h.t <= p.t + GHOST_SLASH_ANIM_TICKS.slash
            && !presses.some((q) => q.t > p.t && q.t < h.t));
        return { press: p, f, rows: f.bodies.length, diverged, real: mine ?? null };
    });
}

/** `spinnerFightForecast` advanced along the whole walk with its own presses; the ticks whose bodies leave the run. */
function fightCursor(w) {
    const r = w.make();
    const c = r.spinnerFightForecast();
    const dirAt = new Map(w.run.slashPresses.map((p) => [p.t, p.direction]));
    const diverged = [];
    const outcomes = [];
    for (let t = 0; t < w.keys.length; t += 1) {
        const out = c.advance(w.points[t], w.keys[t].has('primary') ? { direction: dirAt.get(t) ?? w.points[t].d ?? 0 }
            : null);
        if (out) outcomes.push(`${t}:${out.outcome}`);
        if (JSON.stringify(forecastRow(c, t)) !== JSON.stringify(w.rows[t])) diverged.push(t);
    }
    return { c, diverged, outcomes };
}

const testRow = (h) => [h.t, h.id, h.landed, h.killed, h.hits, h.hitsTimer];

describe('the switch', () => {
    /* ⚖ the user's flip (2026-10-11): ON by default; `SEEDLING_GHOST_SPINNER_PRESS=0` is the opt-out. */
    it('is ON by default, and `withGhostSpinnerPress` restores it', () => {
        expect(GHOST_SPINNER_PRESS_DEFAULT).toBe(true);
        expect(GHOST_SPINNER_PRESS.enabled).toBe(true);
        withGhostSpinnerPress(false, () => expect(GHOST_SPINNER_PRESS.enabled).toBe(false));
        expect(GHOST_SPINNER_PRESS.enabled).toBe(true);
    });

    it('the press row is the ghost\'s only with the switch ON and a ghost primary; its numbers are imported', () => {
        withGhostSpinnerPress(false, () => {
            expect(spinnerStrikePress('ghostsword')).toBe(SWORD_SPINNER_PRESS);
            expect(ghostSpinnerPressFor('ghostsword')).toBe(false);
        });
        withGhostSpinnerPress(true, () => {
            expect(spinnerStrikePress('ghostsword')).toBe(GHOST_SPINNER_PRESS_ROW);
            expect(spinnerStrikePress('sword')).toBe(SWORD_SPINNER_PRESS);
            expect(spinnerStrikePress(null)).toBe(SWORD_SPINNER_PRESS);
        });
        expect(SWORD_SPINNER_PRESS).toMatchObject({ reach: SLASH_REACH, lineOfSight: true, hitTicks: SLASH_HIT_TICKS });
        expect(GHOST_SPINNER_PRESS_ROW).toMatchObject({ reach: GHOST_SWORD_REACH, lineOfSight: false,
            hitTicks: GHOST_SLASH_ANIM_TICKS.slash });
        // the 24 x 48 rect, scale 1, anchored as the sword's 16 x 32 (facing right: along x, across y)
        const g = GHOST_SPINNER_PRESS_ROW.rect(100, 100, 0);
        const s = SWORD_SPINNER_PRESS.rect(100, 100, 0);
        expect([g.right - g.x, g.bottom - g.y]).toEqual([24, 48]);
        expect([s.right - s.x, s.bottom - s.y]).toEqual([16, 32]);
    });
});

describe(`D2 — the forecasts on the game witness \`${WITNESS}\``, () => {
    it('the walk the game played: two ghost landings, 2 damage each, the second kills', () => {
        const w = walk(WITNESS);
        expect(w.run.spinnerPressHits.filter((h) => h.landed).map(testRow)).toEqual([
            [27, 'spinner@48,96', true, false, 2, 30], [76, 'spinner@48,96', true, true, 4, 30]]);
        expect(w.run.slashPresses.map((p) => `${p.t}:${p.outcome}`)).toEqual(
            ['26:slash', '28:dash', '34:swallowed', '36:dash', '44:dash', '75:slash']);
    });

    it('OFF (the BEFORE model): a ghost press forecasts NO landing, and the fight cursor leaves the run at the first', () => {
        withGhostSpinnerPress(false, () => {
            const w = walk(WITNESS);
            const fs = pressForecasts(w);
            expect(fs.filter((x) => x.f.landing !== null)).toEqual([]);
            expect(fs[0].f.why).toMatch(/no test's rect reached a body/);
            expect(fs[0].diverged[0]).toBe(27);
            const { c, diverged } = fightCursor(w);
            expect(c.tests).toEqual([]);
            expect(diverged[0]).toBe(27);
        });
    });

    it('⛓⛓⛓ ON: each press\'s forecast is the run\'s, byte for byte, up to the next press — and its landing is the run\'s', () => {
        withGhostSpinnerPress(true, () => {
            const w = walk(WITNESS);
            const fs = pressForecasts(w);
            for (const x of fs) {
                expect(x.diverged, `press t${x.press.t}`).toEqual([]);
                expect(x.rows, `press t${x.press.t}`).toBeGreaterThan(0);
                expect(x.f.landing ? [x.f.landing.t, x.f.landing.id, x.f.landing.killed] : null, `press t${x.press.t}`)
                    .toEqual(x.real ? [x.real.t, x.real.id, x.real.killed] : null);
            }
            expect(fs.filter((x) => x.f.landing).map((x) => x.f.landing.t)).toEqual([27, 76]);
        });
    });

    it('⛓⛓⛓ ON: the fight cursor along the whole walk is the run at every tick — bodies, tests, and the outcomes (the '
        + 'ghost dash\'s 6-tick release swallows +8)', () => {
        withGhostSpinnerPress(true, () => {
            const w = walk(WITNESS);
            const { c, diverged, outcomes } = fightCursor(w);
            expect(diverged).toEqual([]);
            expect(c.tests.map(testRow)).toEqual(w.run.spinnerPressHits.map(testRow));
            expect(outcomes).toEqual(['26:slash', '28:dash', '34:swallowed', '36:dash', '44:dash', '75:slash']);
        });
    });

    it('ON leaves a SWORD press\'s forecast byte-identical (`r9-solve-18`, every press)', () => {
        const off = withGhostSpinnerPress(false, () => JSON.stringify(pressForecasts(walk('r9-solve-18'))
            .map((x) => [x.f.landing, x.f.tests, x.diverged])));
        const on = withGhostSpinnerPress(true, () => JSON.stringify(pressForecasts(walk('r9-solve-18'))
            .map((x) => [x.f.landing, x.f.tests, x.diverged])));
        expect(on).toBe(off);
    });
});

/**
 * D3's staging (W0): `r9-solve-18`'s frozen staging with the ghost sword — the D1 witness's room, solved as
 * `sweep-seedling-l18-residues` solves it. `items` overrides the seam's.
 */
async function solveL18(items) {
    const { parseTape } = await import('./tapeFormat.js');
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { twoPassSolve } = await import('./twoPassSolve.js');
    const base = parseTape(readFileSync(fileURLToPath(new URL('./fixtures/witness-bases/r9-solve-18.hammer-a.json',
        import.meta.url)), 'utf8'));
    const staging = stagingFromTape(base);
    const seam = { ...staging.seam, items: { ...staging.seam.items, ...items } };
    const makeRun = (persistence) => createRunForStaging({ ...staging, seam, persistence, equips: [] },
        atlasLevelSource());
    try {
        const r = await twoPassSolve({ makeRun, goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }],
            name: 'r9-solve-18', boot: staging.boot, persistence: staging.persistence.filter((c) => c.at === undefined),
            gameTick: async () => { throw new Error('no game oracle here'); } });
        const run = makeRun(r.persistence);
        for (const h of r.out.perTick) run.advance(h);
        return { verdict: 'SOLVED', ticks: r.out.perTick.length, keys: r.out.perTick.map((h) => [...h].sort().join('+')),
            run };
    } catch (e) {
        return { verdict: 'REFUSED', code: e?.code ?? e?.name, why: String(e?.message ?? e), obstacle: e?.obstacle ?? null };
    }
}

describe('D3 — the spinner press kill with the ghost sword (`r9-solve-18`\'s staging + `hasGhostSword`)', () => {
    it('OFF (the BEFORE model): refused at t0, by name — the kill arm derives a SWORD press', async () => {
        const off = await withGhostSpinnerPress(false, () => solveL18({ hasGhostSword: true }));
        expect(off.verdict).toBe('REFUSED');
        expect(off.why).toMatch(/the kill work order has no weapon — the run's `primary` slot fires `ghostsword`/);
    });

    it('⛓⛓⛓ ON: SOLVED with no hit, crossing to L19; every landing a ghost press, two per body (2 damage each), '
        + 'from beyond the sword\'s reach', async () => {
        const on = await withGhostSpinnerPress(true, () => solveL18({ hasGhostSword: true }));
        expect(on.verdict).toBe('SOLVED');
        expect(on.ticks).toBe(336);
        expect(on.run.playerHits).toEqual([]);
        expect(on.run.transitions.map((x) => x.to_level)).toEqual([19]);
        const landed = on.run.spinnerPressHits.filter((h) => h.landed);
        expect(landed.map((h) => [h.t, h.id, h.hits, h.killed])).toEqual([
            [37, 'spinner@48,96', 2, false], [92, 'spinner@48,96', 4, true],
            [113, 'spinner@112,48', 2, false], [159, 'spinner@112,48', 4, true]]);
        expect(landed.every((h) => h.weapon === 'ghostsword' && h.reach > SLASH_REACH && h.reach <= GHOST_SWORD_REACH))
            .toBe(true);
    });

    it('ON: a ghost sword WITHOUT the sword is refused by name (it never tests)', async () => {
        const r = await withGhostSpinnerPress(true, () => solveL18({ hasGhostSword: true, hasSword: false }));
        expect(r.verdict).toBe('REFUSED');
        expect(r.why).toMatch(/holds the GHOST SWORD and not the sword/);
    });

    it('ON leaves the SWORD\'s solve byte-identical (the committed staging, 518 ticks)', async () => {
        const off = await withGhostSpinnerPress(false, () => solveL18({}));
        const on = await withGhostSpinnerPress(true, () => solveL18({}));
        expect(off.ticks).toBe(518);
        expect(on.keys).toEqual(off.keys);
    }, 300_000); /* two full solves (24 s alone): the 60 s default timed out under a parallel bounded run */
});
