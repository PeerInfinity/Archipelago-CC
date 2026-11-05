/**
 * seedlingDemo/hammerStagedHuntScanMemo.test — ⛓⛓ SEEDLING HAMMER-PHASE STAGED-HUNT-CHEAP (`STAGED_HUNT_SCAN_MEMO`, OFF;
 * asked only under `CHASER_STAGED_HUNT`): the staged hunt's per-still-tick `deriveKillByChaser` ask reuses the leash
 * scan's floods and per-cell answers while everything they read is unchanged, and answers exactly what it answered.
 *
 * The workload is BK2COMBAT's (`hammerBk2Combat.test.js`): L40LATCH's latch boot re-booted into L40's corridor at
 * (784,856), the pocket shut, asked for `bobsoldier@880,832` with the burn's stance (888,824) as the aim. The chain
 * (a staged kill with the memo, the same plan as without it) is `hammerStagedHuntScanMemo.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { l40LatchBoot } from './fidelityL40Latch.js';
import { deriveKillByChaser, withChaserStagedHunt, withSolveDeadline } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { canonicalDigestText } from './solverView.js';
import {
    STAGED_HUNT_SCAN_MEMO, STAGED_HUNT_SCAN_MEMO_COUNTS, STAGED_HUNT_SCAN_MEMO_DEFAULT, newStagedHuntScanMemo,
    resetStagedHuntScanMemoCounts, stagedScanEntry, withStagedHuntScanMemo,
} from './stagedHuntScanMemo.js';

const BODY = 'bobsoldier@880,832';
const AIM = { x: 888, y: 824 };
const SRC = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');

/** BK2COMBAT's run: the latch boot in the corridor at (784,856), the pocket shut, one still tick in. */
async function corridorRun() {
    const { parseTape } = await import('./tapeFormat.js');
    const { buildTape, DEFAULT_TOLERANCE } = await import('./botDriverV1.js');
    const { createTapeStepper } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const base = await l40LatchBoot();
    const boot = { ...base, boot: { ...base.boot, x: 776, y: 848 },
        persistence: base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
    const folded = buildTape([new Set()], boot.boot, 'bk2combat',
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = parseTape(JSON.stringify({ ...boot, name: 'bk2combat', tick_count: 1, inputs: folded.inputs,
        equips: [] }));
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    for (let r = st.next(); !r.done; r = st.next());
    return { run, tolerance: DEFAULT_TOLERANCE };
}

describe('hammer-phase STAGED-HUNT-CHEAP: STAGED_HUNT_SCAN_MEMO', () => {
    it('ships OFF', async () => {
        expect(STAGED_HUNT_SCAN_MEMO_DEFAULT).toBe(false);
        expect(STAGED_HUNT_SCAN_MEMO.enabled).toBe(globalThis.process?.env?.SEEDLING_STAGED_HUNT_SCAN_MEMO === '1');
        const was = STAGED_HUNT_SCAN_MEMO.enabled;
        expect(withStagedHuntScanMemo(true, () => STAGED_HUNT_SCAN_MEMO.enabled)).toBe(true);
        expect(withStagedHuntScanMemo(false, () => STAGED_HUNT_SCAN_MEMO.enabled)).toBe(false);
        expect(() => withStagedHuntScanMemo(true, () => { throw new Error('x'); })).toThrow('x');
        let inside = null;
        const p = withStagedHuntScanMemo(true, async () => { await null; inside = STAGED_HUNT_SCAN_MEMO.enabled; });
        expect(STAGED_HUNT_SCAN_MEMO.enabled).toBe(true); // held while the promise is pending
        await p;
        expect(inside).toBe(true);
        expect(STAGED_HUNT_SCAN_MEMO.enabled).toBe(was);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_STAGED_HUNT_SCAN_MEMO');
        expect(withStagedHuntScanMemo(false, newStagedHuntScanMemo)).toBeNull();
        expect(withStagedHuntScanMemo(true, newStagedHuntScanMemo)).toEqual({ key: null, world: null, entry: null });
        resetStagedHuntScanMemoCounts();
        expect(STAGED_HUNT_SCAN_MEMO_COUNTS).toEqual({ builds: 0, hits: 0, unkeyed: 0, cellsReused: 0, cellsAsked: 0 });
    });

    it('is made only inside the staged hunt (so it is asked only under CHASER_STAGED_HUNT), and only its asks pass it',
        () => {
            const hunt = SRC.indexOf('const stagedChaserHunt = (hunted, first, ');
            const end = SRC.indexOf('const climbLadderUnder = (', hunt);
            expect(hunt).toBeGreaterThan(0);
            expect(end).toBeGreaterThan(hunt);
            expect(SRC.split('newStagedHuntScanMemo()').length).toBe(2);
            const made = SRC.indexOf('const scanMemo = newStagedHuntScanMemo();');
            expect(made).toBeGreaterThan(hunt);
            expect(made).toBeLessThan(end);
            // the one ask that carries it is the hunt's own `ask`
            expect(SRC.split('dashMode, scanMemo }').length).toBe(2);
            expect(SRC.indexOf('dashMode, scanMemo }')).toBeGreaterThan(made);
            expect(SRC.indexOf('dashMode, scanMemo }')).toBeLessThan(end);
            // `deriveKillByChaser`'s floods come from the entry, built exactly as OFF built them
            expect(SRC).toMatch(/return \{ aimIsPlannable: plannable, reach: plansReach\(run\.world, allowTeleporter, planOpts\) \};/);
            expect(SRC).toMatch(/const reach = scanEntry\.reach;\n/);
        });

    it('the entry: no memo builds every time; one key and one world reuse; another world, key or a function rebuild',
        () => {
            resetStagedHuntScanMemoCounts();
            let built = 0;
            const build = () => { built += 1; return { reach: { n: built }, aimIsPlannable: true }; };
            const world = {};
            const ask = { world, state: { x: 1, y: 2 }, planOpts: { liveBag: { a: new Set([1]) } },
                allowTeleporter: null, aim: { x: 3, y: 4 } };
            expect(stagedScanEntry(null, ask, build)).toEqual({ reach: { n: 1 }, aimIsPlannable: true, cells: null });
            expect(stagedScanEntry(null, ask, build).reach.n).toBe(2);
            const memo = { key: null, world: null, entry: null };
            const a = stagedScanEntry(memo, ask, build);
            expect(a.reach.n).toBe(3);
            expect(a.cells).toBeInstanceOf(Map);
            expect(stagedScanEntry(memo, { ...ask, state: { x: 1, y: 2 } }, build)).toBe(a);
            expect(stagedScanEntry(memo, { ...ask, world: {} }, build).reach.n).toBe(4);
            expect(stagedScanEntry(memo, { ...ask, world: {} }, build).reach.n).toBe(5); // a new world object again
            const w2 = {};
            expect(stagedScanEntry(memo, { ...ask, world: w2 }, build).reach.n).toBe(6);
            expect(stagedScanEntry(memo, { ...ask, world: w2 }, build).reach.n).toBe(6);
            // the same world, the player half a pixel lower: another key
            expect(stagedScanEntry(memo, { ...ask, world: w2, state: { x: 1, y: 2.5 } }, build).reach.n).toBe(7);
            expect(stagedScanEntry(memo, { ...ask, world: w2, state: { x: 1, y: 2.5 } }, build).reach.n).toBe(7);
            expect(stagedScanEntry(memo, { ...ask, world: w2, state: { x: 1, y: 2.5 },
                planOpts: { liveBag: { a: new Set([2]) } } }, build).reach.n).toBe(8);
            const fnOpts = { ...ask, planOpts: { f: () => 0 } };
            expect(stagedScanEntry(memo, fnOpts, build).cells).toBeNull();
            expect(stagedScanEntry(memo, fnOpts, build).reach.n).toBe(10);
            // the string "fn" is a value, not a function
            expect(stagedScanEntry(memo, { ...ask, aim: { id: 'fn' } }, build).cells).toBeInstanceOf(Map);
            expect(STAGED_HUNT_SCAN_MEMO_COUNTS).toMatchObject({ builds: 7, hits: 3, unkeyed: 2 });
        });

    it('on BK2COMBAT\'s corridor run: the memo\'s answer is the no-memo answer, ask after ask and after a still tick; '
        + 'the second ask computes no cell', async () => {
        const { run, tolerance } = await corridorRun();
        expect([run.state.x, run.state.y]).toEqual([784, 856]);
        const text = (a) => canonicalDigestText(a);
        withChaserStagedHunt(true, () => {
            const memo = withStagedHuntScanMemo(true, newStagedHuntScanMemo);
            // every ask runs under a fine deadline that never stops, and counts its work units (`shouldStop` calls)
            let units = 0;
            const counted = (fn) => withSolveDeadline({ shouldStop: () => { units += 1; return false; },
                fineCheckpoints: true }, fn);
            const bare = () => counted(() => deriveKillByChaser(run, { id: BODY }, new Set(), { aim: AIM, tolerance }));
            const memoised = () => counted(() => deriveKillByChaser(run, { id: BODY }, new Set(),
                { aim: AIM, tolerance, scanMemo: memo }));
            resetStagedHuntScanMemoCounts();
            units = 0;
            const off = bare();
            const offUnits = units;
            expect(off.stance).toBeNull();
            expect(off.waits.length).toBeGreaterThan(0);
            const first = memoised();
            expect(text(first)).toBe(text(off));
            const asked = STAGED_HUNT_SCAN_MEMO_COUNTS.cellsAsked;
            const firstUnits = units - offUnits;
            // the first memoised ask computes each distinct cell once: the boxes' overlap is not asked twice
            expect(firstUnits).toBe(offUnits - STAGED_HUNT_SCAN_MEMO_COUNTS.cellsReused);
            expect(asked).toBeGreaterThan(20);
            // the target box overlaps the player's: the rescan already reuses the cells both boxes hold
            expect(STAGED_HUNT_SCAN_MEMO_COUNTS).toMatchObject({ builds: 1, hits: 0 });
            const reused = STAGED_HUNT_SCAN_MEMO_COUNTS.cellsReused;
            units = 0;
            expect(text(memoised())).toBe(text(off));
            // the second spends no unit on any cell: what is left is the entry ask and the scored candidates
            expect(units).toBe(firstUnits - asked);
            expect(units).toBeLessThan(offUnits / 4);
            expect(STAGED_HUNT_SCAN_MEMO_COUNTS).toMatchObject({ builds: 1, hits: 1, cellsAsked: asked });
            expect(STAGED_HUNT_SCAN_MEMO_COUNTS.cellsReused - reused).toBe(asked + reused);
            // one still tick: the bodies moved, the player did not — the memo still answers what a fresh ask does
            run.advance(new Set());
            const after = bare();
            expect(text(memoised())).toBe(text(after));
            expect(STAGED_HUNT_SCAN_MEMO_COUNTS.builds + STAGED_HUNT_SCAN_MEMO_COUNTS.hits).toBe(3);
        });
    }, 300000);
});
