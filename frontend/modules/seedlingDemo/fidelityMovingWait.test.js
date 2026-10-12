/**
 * seedling-fidelity-movingwait — A LATCHED WAIT INSIDE A LOBBER'S REACH PACES (`MOVING_WAIT`, which is
 * `CONTACT_FIDELITY.movingWait`, OFF by default).
 *
 * BOMBPUSHER refused L40's legs 378/381 at `buttonroom@272,208`'s 131-tick hold by name: a standing player within
 * 256 px of `bombpusher@112,128` is always hit, and both of the hold's waits stood still by contract. The group is
 * LATCHED (`ButtonRoom.as`'s setter, *"Can't be reset to false!!"*), so the wait may move. ON, `execHold` asks the
 * still wait first and, when it prices a bomb, plans an out-and-back pacing on the run's own `previewStepper` whose
 * every sample is clean against the walk forecast (`planPacedWait`); `runPace` drives it and asserts the plan.
 *
 * The two witnesses are the GAME's rows (p4f, headless, damage on, `probe-seedling-bombpusher.mjs --record`) of the
 * MOVING_WAIT solver's own inputs for each leg, cut before the leg's next stop (381: before the break stance's blast
 * at t1156; 378: at the t1 hold, whose still wait an in-flight bomb's blast on `spinner@192,128` refuses — see the
 * report). The replay reads the game's camera on uncertain shake ticks (⚖ the cosmetic RNG is never modelled).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BotDriverV2Error, runHold } from './botDriverV2.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS } from './contactFidelity.js';
import { dangerAt } from './dangerMap.js';
import { KNOWN_STRATEGY_VERBS } from './decisionTrace.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { MOVING_WAIT, PACE, planPacedWait, withMovingWait } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', `${n}.json`), 'utf8'));
const HOLD_BOUND = 131; // `deriveHold`: the lock's 101-tick fade + `HOLD_SLACK` 30 — BOMBPUSHER's refusal quotes it
const WITNESSES = [
    { name: 'movingwait-l42-381-pace', leg: 381, waitAt: 1007, stance: [280.73845846483005, 215.296841709541],
        out: ['left'], back: ['right'], span: 8, gap: 18, rejected: 56, cycle: 46, executed: 92 },
    { name: 'movingwait-l41-378-pace', leg: 378, waitAt: 1106, stance: [280.0835434089258, 216.2321037687089],
        out: ['down', 'left'], back: ['up', 'right'], span: 6, gap: 18, rejected: 30, cycle: 48, executed: 96 },
];

/** The model's run after the tape's tick `upto` (and, per sampled tick, its player, bombs and lobber anim). */
function replay(w, upto = w.upto) {
    const tape = parseTape(JSON.stringify(w.tape));
    const cams = new Map(w.samples.map((s) => [s.t, s.cam]));
    let run = null;
    const st = createTapeStepper(tape, {
        levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        cameraWitness: (t) => cams.get(t) ?? null,
    });
    const cols = new Map();
    for (let r = st.next(); !r.done; r = st.next()) {
        const o = r.value.observation;
        cols.set(o.t, {
            p: [o.x, o.y],
            bombs: run.entities('bombs').map((b) => [b.x, b.y, b.v.x, b.v.y]),
            anim: run.entities('bombPushers')[0]?.anim ?? null,
        });
        if (o.t >= upto) break;
    }
    return { cols, run, tape };
}

const keysOf = (set) => [...set].sort().join('+');
const groupZero = (run) => run.world.activators.filter((a) => a.t === 0);
const presserOf = (run) => run.world.pressers.find((p) => p.x === 272 && p.y === 208);

describe('MOVINGWAIT — the switch and the vocabulary', () => {
    it('movingWait ships OFF, and MOVING_WAIT reads it', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.movingWait).toBe(false);
        expect(MOVING_WAIT.enabled).toBe(CONTACT_FIDELITY.movingWait);
        withMovingWait(true, () => expect(CONTACT_FIDELITY.movingWait).toBe(true));
        expect(MOVING_WAIT.enabled).toBe(CONTACT_FIDELITY_DEFAULTS.movingWait);
    });

    it('the trace names a paced wait `pace` (appended to KNOWN_STRATEGY_VERBS)', () => {
        expect(KNOWN_STRATEGY_VERBS.at(-1)).toBe('pace');
    });

    it('the alphabet: 8 out-and-back directions, spans 6..24, gaps 0..18 — smallest motion first', () => {
        expect(PACE.dirs.length).toBe(8);
        expect([...PACE.spans]).toEqual([...PACE.spans].sort((a, b) => a - b));
        expect([...PACE.gaps]).toEqual([0, 6, 12, 18]);
    });
});

describe.each(WITNESSES)('MOVINGWAIT — the game witness $name (leg $leg)', (row) => {
    const w = witness(row.name);

    it('the GAME took no hit on the whole witness, through the paced hold', () => {
        expect(w.samples.length).toBe(w.upto);
        expect(w.samples.every((s) => s.hits === 0)).toBe(true);
    });

    it('the model reproduces every sampled tick at 0 px — the player, each bomb to the bit, the anim; no hit', () => {
        const { cols, run } = replay(w);
        const bad = [];
        for (const s of w.samples) {
            const m = cols.get(s.t);
            if (!m) { bad.push(`t${s.t}: no model tick`); continue; }
            if (m.p[0] !== s.p[0] || m.p[1] !== s.p[1]) bad.push(`t${s.t}: player ${s.p} vs ${m.p}`);
            const gb = [...s.bombs].sort((a, b) => a[0] - b[0]);
            const mb = [...m.bombs].sort((a, b) => a[0] - b[0]);
            if (JSON.stringify(gb) !== JSON.stringify(mb)) bad.push(`t${s.t}: bombs ${JSON.stringify(gb)} vs ${JSON.stringify(mb)}`);
            if ((s.anim ?? '') !== (m.anim ?? '')) bad.push(`t${s.t}: anim ${s.anim} vs ${m.anim}`);
        }
        expect(bad.slice(0, 5)).toEqual([]);
        expect(run.ledger('playerHits')).toEqual([]);
        // the lobber fired through the wait: the blasts landed, and none on the player
        const blasts = run.ledger('bombEvents').filter((e) => e.what === 'blast');
        expect(blasts.length).toBeGreaterThanOrEqual(6);
        expect(blasts.some((e) => e.hitPlayer)).toBe(false);
    }, 120_000);

    it(`at t${row.waitAt} the STILL wait is a bomb hit (why it paces), and the group is latched`, () => {
        const { run } = replay(w, row.waitAt);
        expect([run.state.x, run.state.y]).toEqual(row.stance);
        expect(run.entities('latchedGroups').has(0)).toBe(true);
        const d = dangerAt(run, run.ticksCompleted + HOLD_BOUND, playerBoxAt(run.state.x, run.state.y), { mode: 'wait' });
        expect(d.sources.some((s) => s.kind === 'bomb' && s.id.startsWith('bombpusher@112,128#'))).toBe(true);
    });

    it('the planner\'s pacing is the one the tape drove, key for key, back on the stance at each cycle end', () => {
        const { run, tape } = replay(w, row.waitAt);
        const { plan, tried } = planPacedWait(run, { ticks: HOLD_BOUND, keep: presserOf(run) });
        expect(tried.length).toBe(row.rejected);
        expect(plan).toMatchObject({ out: row.out, back: row.back, span: row.span, gap: row.gap, bound: HOLD_BOUND });
        expect(plan.ends).toEqual([row.cycle, 2 * row.cycle, 3 * row.cycle]);
        for (const e of plan.ends) expect([plan.path[e - 1].x, plan.path[e - 1].y]).toEqual(row.stance);
        const drove = Array.from({ length: row.executed }, (_, i) => keysOf(heldKeysAt(tape, row.waitAt + i)));
        expect(plan.keys.slice(0, row.executed).map(keysOf)).toEqual(drove);
        // the tape leaves the stance on the next tick: the wait stopped at the SECOND cycle end
        expect(keysOf(heldKeysAt(tape, row.waitAt + row.executed))).not.toBe('');
    });

    it('runHold with the pace: drives it to the cycle end where the lock is open, unhit, back on the stance', () => {
        const { run } = replay(w, row.waitAt);
        const presser = presserOf(run);
        const shut = groupZero(run).filter((a) => !run.entities('openActivators').has(a.id));
        expect(shut.length).toBeGreaterThan(0);
        const { plan } = planPacedWait(run, { ticks: HOLD_BOUND, keep: presser });
        const perTick = [];
        const rec = runHold(run, perTick, { presser: { x: presser.x, y: presser.y }, ticks: HOLD_BOUND, pace: plan,
            until: { why: 'group 0 open', test: (r) => shut.every((a) => r.entities('openActivators').has(a.id)) } },
        'movingwait-test');
        expect(rec.heldFor).toBe(row.executed);
        expect(rec.opened).toEqual(shut.map((a) => a.id));
        expect(rec.paced).toMatchObject({ out: row.out, back: row.back, span: row.span, gap: row.gap, cycles: 2,
            ticks: row.executed, from: 0 });
        expect([run.state.x, run.state.y]).toEqual(row.stance);
        expect(run.ledger('playerHits')).toEqual([]);
    }, 60_000);
});

describe('MOVINGWAIT — the paced contract refuses by name', () => {
    const w = witness(WITNESSES[0].name);
    const at = WITNESSES[0].waitAt;
    const setUp = () => {
        const { run } = replay(w, at);
        const presser = presserOf(run);
        const shut = groupZero(run).filter((a) => !run.entities('openActivators').has(a.id));
        const { plan } = planPacedWait(run, { ticks: HOLD_BOUND, keep: presser });
        const until = { why: 'group 0 open', test: (r) => shut.every((a) => r.entities('openActivators').has(a.id)) };
        return { run, presser, plan, until };
    };

    it('a tick off the previewed path fails "not the previewed"', () => {
        const { run, presser, plan, until } = setUp();
        const path = plan.path.map((p, i) => (i === 3 ? { x: p.x + 1, y: p.y } : p));
        expect(() => runHold(run, [], { presser: { x: presser.x, y: presser.y }, ticks: HOLD_BOUND,
            pace: { ...plan, path }, until }, 'mw')).toThrow(/paced tick 4 of 138 is at .* not the previewed/);
    });

    it('a pace with no stopping condition is refused before a tick is spent', () => {
        const { run, presser, plan } = setUp();
        const perTick = [];
        expect(() => runHold(run, perTick, { presser: { x: presser.x, y: presser.y }, ticks: HOLD_BOUND,
            pace: plan }, 'mw')).toThrow(BotDriverV2Error);
        expect(perTick).toEqual([]);
    });

    it('cycles that end before the lock opens fail with the still wait\'s bound sentence', () => {
        const { run, presser, plan, until } = setUp();
        expect(() => runHold(run, [], { presser: { x: presser.x, y: presser.y }, ticks: HOLD_BOUND,
            pace: { ...plan, ends: plan.ends.slice(0, 1) }, until }, 'mw'))
            .toThrow(/paced 1 cycle\(s\) \(46 tick\(s\), the bound 131\) and the condition never became true/);
    });
});
