/**
 * ⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2 — the kill arm's stance walked as forecast, the walk gate's timed blade, and
 * the CRUSHER bait's fork hygiene.
 *
 * D1 (measured on the game, `bobsoldier2-l30-dash-stance`): survey step 50's kill arm previewed an UNDASHED walk to
 * its stance (arrival t145, the body on 2 hits, the kill at t167, bound 53) and then drove a DASHED one (`walkTo` asks
 * `planSwordDash`): arrival t92 with the body on one hit, and at t145 the body is alive on two — the game agrees,
 * body bit-exact. D2a (`KILL_STANCE_AS_FORECAST`) walks the stance undashed; D2b (`SWORD_GATE_TIMED`) times the
 * corpse's blade at the next walk's gate. Both OFF by default. (D3, the fork hygiene, is `fidelityForkHygiene.test.js`.)
 */

import { describe, expect, it } from 'vitest';
import { withContactFidelity } from './contactFidelity.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { dangerAt } from './dangerMap.js';
import {
    KILL_STANCE_AS_FORECAST, SWORD_GATE_TIMED, swordTickAt, withKillStanceAsForecast, withSwordGateTimed,
} from './solverBot.js';
import { BOBSOLDIER2_STEP50, bobsoldier2Plan } from '../../../scripts/procgen/plan-seedling-bobsoldier2.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const BODY = BOBSOLDIER2_STEP50.body;

/** Replay `name`, calling `each(run, t)` after every tick; returns the run. */
function replay(name, each = () => {}) {
    let run = null;
    const st = createTapeStepper(tape(name), { levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done) {
        if (run) each(run, r.value.observation.t);
        r = st.next();
    }
    return { run, out: r.value };
}

describe('BOBSOLDIER2 — the switches\' contract', () => {
    // ⚖ (user, 2026-10-10) both ON at the wave-10 harvest (the slice shipped them OFF).
    it('both are ON by default, and `with…` restores them, on a throw too', () => {
        expect(KILL_STANCE_AS_FORECAST.enabled).toBe(true);
        expect(SWORD_GATE_TIMED.enabled).toBe(true);
        expect(withKillStanceAsForecast(false, () => KILL_STANCE_AS_FORECAST.enabled)).toBe(false);
        expect(withSwordGateTimed(false, () => SWORD_GATE_TIMED.enabled)).toBe(false);
        expect(() => withSwordGateTimed(false, () => { throw new Error('x'); })).toThrow('x');
        expect(() => withKillStanceAsForecast(false, () => { throw new Error('x'); })).toThrow('x');
        expect(KILL_STANCE_AS_FORECAST.enabled).toBe(true);
        expect(SWORD_GATE_TIMED.enabled).toBe(true);
    });
});

describe('BOBSOLDIER2 D1 — the game witnesses', () => {
    it('`bobsoldier2-l30-dash-stance`: the dashed approach arrives early and the body is ALIVE on 2 hits at the bound', () => {
        const hits = [];
        const { run, out } = replay('bobsoldier2-l30-dash-stance', (rn, t) => {
            const b = (rn.entities('chasers') ?? []).find((c) => c.id === BODY);
            if (b && b.hits !== hits.at(-1)?.hits) hits.push({ t, hits: b.hits });
        });
        expect(out.playerHits).toHaveLength(0);
        // the first hit lands on the APPROACH (the dash walk's own strike) — the forecast's walk had it at t85
        expect(hits.map((h) => h.hits)).toEqual([0, 1, 2]);
        const b = run.entities('chasers').find((c) => c.id === BODY);
        expect(b.hits).toBe(2);
        expect(b.destroy).toBeFalsy();
    });

    it('`bobsoldier2-l30-torch`: zero hits, the body killed, the crossing into L32', () => {
        let killedAt = null;
        const { out } = replay('bobsoldier2-l30-torch', (rn, t) => {
            const b = (rn.entities('strikeBodies') ?? []).find((c) => c.id === BODY);
            if (!b && killedAt === null && rn.level === 30) killedAt = t;
        });
        expect(out.playerHits).toHaveLength(0);
        expect(out.ticks.at(-1).level).toBe(32);
        expect(killedAt).toBe(167);
    });
});

// ⛓ fidelity FLIP14: these four are BOBSOLDIER2's switch-by-switch CONTROLS, measured (and the both-ON plan
// game-witnessed) under the pre-flip strike gate, so they run `strikeIframeLapse` OFF, solve and replay alike. (FLIP14
// measured step 50 REFUSING at every switch setting with the lapse ON; STRIKELAPSE D1 and hammer DD repaired that —
// the ON answers are the BS2FIX rows below.)
describe('BOBSOLDIER2 D2 — the solver, switch by switch, on survey step 50\'s staging', () => {
    it('both ON: the solver\'s own plan IS the witness `bobsoldier2-l30-torch`', () => withContactFidelity({ strikeIframeLapse: false }, async () => {
        const { solved } = await bobsoldier2Plan(true);
        expect(solved.out.perTick.length).toBe(tape('bobsoldier2-l30-torch').tick_count);
        const kill = solved.out.records.find((r) => r.strategy === 'kill' && r.arm === 'chaser');
        expect(kill).toMatchObject({ target: BODY, stance: { x: 88, y: 56 }, ticks: 22, bound: 53 });
    }), 120_000);

    it('both OFF: the dwell refuses (the survey\'s text), and the keys it drove are `bobsoldier2-l30-dash-stance`', () => withContactFidelity({ strikeIframeLapse: false }, async () => {
        const { solved, refusal, driven } = await bobsoldier2Plan(false);
        expect(solved).toBeNull();
        expect(refusal.message).toMatch(/the dwell's condition .* never became true inside its 53-tick bound/);
        expect(driven).toHaveLength(tape('bobsoldier2-l30-dash-stance').tick_count);
    }), 120_000);

    it('D2a alone: the stance walk keeps the forecast, and the corpse\'s PAD refuses the next walk\'s gate', () => withContactFidelity({ strikeIframeLapse: false }, async () => {
        const { refusal } = await bobsoldier2Plan(true, { swordGate: false });
        expect(refusal.message).toMatch(/collect \(64,64\) stance: the danger map forbids \(87\.86\d*,58\.05\d*\) — chaser:bobsoldier@48,80 \(inside leash 80 \(d=15\.8\), box grown 0\.8 px\/tick x 0 \+ pad 16\)/);
    }), 120_000);

    it('D2b alone: the dashed stance walk still runs the dwell out', () => withContactFidelity({ strikeIframeLapse: false }, async () => {
        const { refusal } = await bobsoldier2Plan(true, { killStance: false });
        expect(refusal.message).toMatch(/the dwell's condition .* never became true inside its 53-tick bound/);
    }), 120_000);
});

/**
 * ⛓ BS2FIX (wave 20) — step 50 AT THE DEFAULTS (`strikeIframeLapse` ON), switch by switch. No setting of the two
 * switches reaches the kill arm's dwell: the walk's lapse-admitted presses leave the collect's corridor clean, so the
 * collect runs first (STRIKELAPSE D1's stand walk) with the body ALIVE on 2 hits. What decides is the exit walk's gate
 * at (72.65,66.46): with `SWORD_GATE_TIMED` it prices the live body's blade by its tick and the walk's own press kills
 * the body (`killedOnWalk`, hammer DD). Without it, pad 16 refuses. `KILL_STANCE_AS_FORECAST` moves only the length
 * (395 vs 404 t). The both-ON plan is the retired producer's AFTER, recorded on the game (p4g, 396 obs, 0 px; the
 * BS2FIX report's evidence).
 */
describe('BS2FIX — step 50 at the defaults: the gate decides, the dwell is never reached', () => {
    const killOnWalk = (solved) => solved.out.records.find((r) => r.strategy === 'kill' && r.arm === 'chaser');
    it('both ON: 395 t; the collect first, then the walk towards the stance (72,88) kills the body with its own press', async () => {
        const { solved } = await bobsoldier2Plan(true);
        expect(solved.out.perTick.length).toBe(395);
        expect(solved.out.records.map((r) => r.strategy).filter(Boolean).slice(0, 2)).toEqual(['collect', 'kill']);
        expect(killOnWalk(solved)).toMatchObject({ target: BODY, stance: { x: 72, y: 88 }, ticks: 0,
            killedOnWalk: { pressedAt: 169, firedAt: 170, weapon: 'sword' } });
    }, 120_000);

    it('D2b alone: 404 t, the same kill on the walk (the stance walk dashed)', async () => {
        const { solved } = await bobsoldier2Plan(true, { killStance: false });
        expect(solved.out.perTick.length).toBe(404);
        expect(killOnWalk(solved)).toMatchObject({ stance: { x: 72, y: 88 }, ticks: 0, killedOnWalk: { pressedAt: 168 } });
    }, 120_000);

    for (const [name, opts, on] of [['both OFF', {}, false], ['D2a alone', { swordGate: false }, true]]) {
        it(`${name}: the exit walk's gate refuses the LIVE body by its pad at 168 t, after the collect`, async () => {
            const { solved, refusal, driven } = await bobsoldier2Plan(on, opts);
            expect(solved).toBeNull();
            expect(driven).toHaveLength(168);
            expect(refusal.message).toMatch(/reach-exit \(224,160\)->L32: the danger map forbids \(72\.65\d*,66\.46\d*\) — chaser:bobsoldier@48,80 \(inside leash 80 \(d=7\.1\), box grown 0\.8 px\/tick x 0 \+ pad 16\)/);
            expect(refusal.message).not.toMatch(/the dwell's condition/);
        }, 120_000);
    }
});

describe('BOBSOLDIER2 D2b — the walk gate prices the corpse\'s blade by its clock', () => {
    it('one tick after the kill, at the dwell\'s stance: the pad forbids, the timed tick is clear', () => {
        let asked = null;
        replay('bobsoldier2-l30-torch', (rn, t) => {
            if (t !== 167 || asked) return;
            const box = playerBoxAt(rn.state.x, rn.state.y);
            const pad = dangerAt(rn, rn.ticksCompleted, box);
            const tick = swordTickAt(rn, rn.state.x, rn.state.y);
            const timed = dangerAt(rn, rn.ticksCompleted, box, { swordTick: tick });
            asked = { pad, timed, corpse: (rn.entities('chasers') ?? []).find((c) => c.id === BODY) };
        });
        expect(asked.corpse.destroy).toBe(true);
        expect(asked.pad.sources.map((s) => s.why).join(' ')).toMatch(/pad 16/);
        expect(asked.timed.danger).toBe(false);
    });

    it('a horizon past zero is the WAIT question, and the timed tick is not consulted there', () => {
        let asked = null;
        replay('bobsoldier2-l30-torch', (rn, t) => {
            if (t !== 167 || asked) return;
            const box = playerBoxAt(rn.state.x, rn.state.y);
            const tick = swordTickAt(rn, rn.state.x, rn.state.y);
            asked = dangerAt(rn, rn.ticksCompleted + 5, box, { swordTick: tick });
        });
        expect(asked.danger).toBe(true);
    });
});
