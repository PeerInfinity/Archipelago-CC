/**
 * ⛓⛓⛓ SEEDLING FIDELITY L30KEYLOCK — L30 → L22 through `bosslock@64,32`, past the BobSoldier beside it.
 *
 * D1 (measured on the game, `l30keylock-pit224-before`): from survey step 52's pit landing (224,80) the base solver
 * walks to the keylock stance, and `execKeylock` stands on the key line for the lock's 60-tick `keyTimer` and fade
 * with nothing asking what reaches it there: bobsoldier@48,80 lands a sword hit (t173) and a body hit (t193) before
 * the lock opens (t212), and only the NEXT walk's gate refuses (the survey's text). From the other pit landing,
 * (240,80), the same wait takes three hits and the run DIES.
 * D2: `KEYLOCK_WAIT_PRICED` probes the keylock stance walk with the hold as its tail (stood as the executor stands),
 * so the ladder climbs; `KILL_STANCE_TARGET_RESCAN` lets the kill rung's chaser arm scan the BODY's box when the
 * player's box priced no stance. Both ON: kill first, then the lock, then the teleporter (`l30keylock-pit224`,
 * `l30keylock-pit240`, recorded on the game).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { keyLineTouches } from './activators.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import {
    KEYLOCK_WAIT_PRICED, KILL_STANCE_TARGET_RESCAN, deriveKillByChaser, previewWalk,
    withKeylockWaitPriced, withKillStanceTargetRescan,
} from './solverBot.js';
import {
    L30KEYLOCK_STEP52, l30keylockPlan, l30keylockStaging,
} from '../../../scripts/procgen/plan-seedling-l30keylock.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const BODY = L30KEYLOCK_STEP52.body;
const LOCK = L30KEYLOCK_STEP52.lock;

/** Replay `name`; the first tick the player touches the key line, the lock opens, the body leaves. */
function landmarks(name) {
    let run = null;
    const st = createTapeStepper(tape(name), { levelSource: SRC, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    const at = { touch: null, open: null, bodyGone: null };
    while (!r.done) {
        const t = r.value.observation.t;
        if (run && run.level === 30) {
            const keyLine = (run.world.activators ?? []).find((a) => a.id === LOCK)?.keyLine;
            if (at.touch === null && keyLine && keyLineTouches(playerBoxAt(run.state.x, run.state.y), keyLine)) {
                at.touch = t;
            }
            if (at.open === null && run.entities('openActivators')?.has?.(LOCK)) at.open = t;
            if (at.bodyGone === null && !(run.entities('strikeBodies') ?? []).some((b) => b.id === BODY)) {
                at.bodyGone = t;
            }
        }
        r = st.next();
    }
    return { at, out: r.value };
}

describe('L30KEYLOCK — the switches\' contract', () => {
    it('both are OFF by default, and `with…` restores them, on a throw too', () => {
        expect(KILL_STANCE_TARGET_RESCAN.enabled).toBe(false);
        expect(KEYLOCK_WAIT_PRICED.enabled).toBe(false);
        expect(withKillStanceTargetRescan(true, () => KILL_STANCE_TARGET_RESCAN.enabled)).toBe(true);
        expect(withKeylockWaitPriced(true, () => KEYLOCK_WAIT_PRICED.enabled)).toBe(true);
        expect(() => withKillStanceTargetRescan(true, () => { throw new Error('x'); })).toThrow('x');
        expect(() => withKeylockWaitPriced(true, () => { throw new Error('x'); })).toThrow('x');
        expect(KILL_STANCE_TARGET_RESCAN.enabled).toBe(false);
        expect(KEYLOCK_WAIT_PRICED.enabled).toBe(false);
    });
});

describe('L30KEYLOCK D1 — the game witnesses', () => {
    it('`l30keylock-pit224-before`: on the key line at t133, hit at t173 (sword) and t193 (body), open only at t212', () => {
        const { at, out } = landmarks('l30keylock-pit224-before');
        expect(at).toEqual({ touch: 133, open: 212, bodyGone: null });
        expect(out.playerHits.map((h) => [h.t, h.source])).toEqual([[173, 'sword'], [193, 'chaser']]);
        expect(out.ticks.at(-1).level).toBe(30);
    });

    for (const [name, at] of [
        ['l30keylock-pit224', { touch: 276, open: 355, bodyGone: 191 }],
        ['l30keylock-pit240', { touch: 291, open: 370, bodyGone: 207 }],
    ]) {
        it(`\`${name}\`: the body dies first, then the key line, then the crossing into L22 — zero hits`, () => {
            const got = landmarks(name);
            expect(got.at).toEqual(at);
            expect(got.out.playerHits).toHaveLength(0);
            expect(got.out.ticks.at(-1).level).toBe(22);
        });
    }
});

describe('L30KEYLOCK D2 — the solver, switch by switch, from both pit landings', () => {
    const verdict = ({ solved, refusal, run }) => ({
        solved: solved ? solved.out.perTick.length : null,
        hits: run.playerHits.length,
        refusal: refusal ? refusal.message : null,
    });

    it('both OFF, (224,80): the survey\'s refusal, the keys driven are the BEFORE witness, and they were hit twice', async () => {
        const p = await l30keylockPlan(224, { rescan: false, waitPriced: false });
        const v = verdict(p);
        expect(v.solved).toBeNull();
        expect(v.refusal).toMatch(/the danger map forbids \(71\.77\d*,50\.11\d*\) — chaser:bobsoldier@48,80 \(the BobSoldier's 8x8 body, bare, one forecast tick on/);
        expect(v.hits).toBe(2);
        expect(p.driven).toHaveLength(tape('l30keylock-pit224-before').tick_count);
    }, 120_000);

    it('both OFF, (240,80): the wait on the key line takes three hits — the walk DIES — before the lock opens', async () => {
        const v = verdict(await l30keylockPlan(240, { rescan: false, waitPriced: false }));
        expect(v.solved).toBeNull();
        expect(v.hits).toBe(3);
        expect(v.refusal).toMatch(/bosslock@64,32 did not open inside its own derived bound of 110 ticks/);
    }, 120_000);

    it('RESCAN alone: (224,80) solves (its corridor probe already climbs); (240,80) still dies on the unpriced wait', async () => {
        expect(verdict(await l30keylockPlan(224, { rescan: true, waitPriced: false })))
            .toMatchObject({ solved: 347, hits: 0 });
        expect(verdict(await l30keylockPlan(240, { rescan: true, waitPriced: false })))
            .toMatchObject({ solved: null, hits: 3 });
    }, 120_000);

    it('WAIT alone: nothing is hit — (224,80) a timed detour, (240,80) an honest EXHAUSTED before a tick', async () => {
        expect(verdict(await l30keylockPlan(224, { rescan: false, waitPriced: true })))
            .toMatchObject({ solved: 332, hits: 0 });
        const v = verdict(await l30keylockPlan(240, { rescan: false, waitPriced: true }));
        expect(v).toMatchObject({ solved: null, hits: 0 });
        expect(v.refusal).toMatch(/keylock stance \(bosslock@64,32\): the combat ladder is EXHAUSTED/);
    }, 120_000);

    for (const [x, kill] of [[224, { ticks: 26, bound: 57 }], [240, { ticks: 31, bound: 62 }]]) {
        it(`both ON, (${x},80): the solver's own plan IS the witness \`l30keylock-pit${x}\` (kill, lock, crossing)`, async () => {
            const p = await l30keylockPlan(x, { rescan: true, waitPriced: true });
            expect(verdict(p)).toMatchObject({ solved: tape(`l30keylock-pit${x}`).tick_count, hits: 0 });
            const rec = p.solved.out.records;
            const k = rec.find((r) => r.strategy === 'kill' && r.arm === 'chaser');
            expect(k).toMatchObject({ target: BODY, stance: { x: 88, y: 120 }, ...kill });
            expect(rec.findIndex((r) => r.strategy === 'keylock')).toBeGreaterThan(rec.indexOf(k));
        }, 120_000);
    }
});

describe('L30KEYLOCK D2 — the two mechanisms, asked directly', () => {
    it('the chaser arm at the pit landing: the player\'s box prices nothing; the body\'s box finds (88,120)', async () => {
        const staging = await l30keylockStaging(224);
        const run = createRunForStaging(staging, SRC);
        const body = run.entities('strikeBodies').find((b) => b.id === BODY);
        // the ladder's own ask: the keylock stance as the aim, the segment's tolerance
        const opts = { aim: { x: 72, y: 56 }, tolerance: DEFAULT_TOLERANCE };
        const off = deriveKillByChaser(run, body, new Set(), opts);
        expect(off.stance).toBeNull();
        expect(off.why).toMatch(/14 cell\(s\) inside its 80 px leash, 7 of those reachable/);
        const on = withKillStanceTargetRescan(true, () => deriveKillByChaser(run, body, new Set(), opts));
        expect(on.stance).toEqual({ x: 88, y: 120 });
    });

    it('`previewWalk`\'s `standKeys` tail presses the stand\'s keys and no strike; without it the tail is unchanged', async () => {
        const staging = await l30keylockStaging(224);
        const run = createRunForStaging(staging, SRC);
        const wps = [{ x: 232, y: 104 }];
        const LEFT = new Set(['left']);
        const plain = previewWalk(run, wps, DEFAULT_TOLERANCE, { standFor: 10 });
        const stood = previewWalk(run, wps, DEFAULT_TOLERANCE, { standFor: 10, standKeys: () => () => LEFT });
        const tail = (w) => w.samples.filter((s) => s.phase === 'dwell');
        expect(tail(plain)).toHaveLength(10);
        expect(tail(stood)).toHaveLength(10);
        expect(tail(stood).every((s) => s.held === LEFT)).toBe(true);
        expect(tail(stood).at(-1).x).toBeLessThan(tail(plain).at(-1).x);
        // the walk half is the same walk
        const walkHalf = (w) => w.samples.filter((s) => s.phase !== 'dwell').map((s) => [s.x, s.y]);
        expect(walkHalf(stood)).toEqual(walkHalf(plain));
    });
});
