/**
 * fidelityWatcherTalk.test — ⛓⛓⛓ fidelity WATCHERTALK (wave 19): THE WATCHER'S EVENT IS EARNED BY TALKING
 * (`CONTACT_FIDELITY.watcherTalkVerb`, OFF by default).
 *
 * The AP event "talk to the Watcher" is the clear-tag `{114,0}` on `watcher@72,72` (it gates the FinalDoor). The
 * Watcher is typed "Watcher" (`Watcher.as:48`), in no solids list, so the clear-tag finds no solid at (72,72):
 *
 *   1. OFF is the base: the clear-tag lands in `already-clear` with the flag never written (`watcherTalks` empty,
 *      `earnedClears` empty) — the route survey's L114 step "solves" this way, and the JS runtime's pre-check
 *      (`clearTagVerbOf`, the JS arc's) refuses the sweep's two legs `no-verb` on `solid:watcher` before asking.
 *   2. ON, from both sweep arrivals (L113's two teleporters land at (64,128) and (80,128)), the clear-tag selects
 *      `talk`, pages the dialogue to `doneTalking()`, and the run's `watcherTalks` + `earnedClears` hold `{114,0}`.
 *      `watchertalk-l114-clear` is that plan from (64,128), game-recorded.
 *   3. ON, a SILENT watcher answers by its census reason: the tag cleared at boot → `already-clear` (the game's
 *      own reading); an empty `text` → `cannot-act` (it never runs `doneTalking()`, the only writer of its tag).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { arrivalStaging } from './fidelityArrival.js';
import { parseTape } from './tapeFormat.js';
import { solveSegment, SolverRefusal } from './solverBot.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const WATCHER = 'watcher@72,72';
const FLAG = { level: 114, tag: 0 };

/** The sweep's two L114 arrivals (legs 843 / 846 at the baseline derivation; match by KEY). */
const ARRIVALS = Object.freeze({
    from16: { level: 114, x: 64, y: 128 },
    from32: { level: 114, x: 80, y: 128 },
});
const CLEAR = Object.freeze({ kind: 'clear-tag', tag: FLAG, at: { x: 72, y: 72 }, obstacle: WATCHER });

const runAt = (boot, persistence = []) => createRunForStaging({ ...arrivalStaging(boot), persistence }, SRC);
const solve = (on, run, goals, boot) => withContactFidelity({ watcherTalkVerb: on },
    () => solveSegment({ run, goals, name: 'watchertalk', boot }));
const refusalOf = (fn) => {
    try { fn(); } catch (e) { if (e instanceof SolverRefusal) return e; throw e; }
    return null;
};

describe('fidelity WATCHERTALK — the switch', () => {
    it('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.watcherTalkVerb).toBe(false);
    });
});

describe('OFF — the base: `already-clear`, and the flag is never written', () => {
    it.each(Object.entries(ARRIVALS))('from %s: no verb runs, `watcherTalks` and `earnedClears` stay empty', (_, boot) => {
        const run = runAt(boot);
        const out = solve(false, run, [CLEAR], boot);
        expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', arm: 'already-clear', obstacle: WATCHER })]);
        expect(out.perTick).toHaveLength(0);
        expect(run.watcherTalks).toEqual([]);
        expect(run.ledger('earnedClears')).toEqual([]);
    });
});

describe('ON — the clear-tag talks, and the run records the write', () => {
    it.each(Object.entries(ARRIVALS))('from %s: `talk`, paged to DONE, {114,0} in `watcherTalks` and `earnedClears`', (_, boot) => {
        const run = runAt(boot);
        const out = solve(true, run, [CLEAR], boot);
        expect(out.records).toEqual([expect.objectContaining({ goal: 'clear-tag', arm: 'verb', strategy: 'talk',
            verb: 'talk', target: WATCHER, cause: 'done', flag: FLAG })]);
        const talks = run.watcherTalks.filter((r) => r.id === WATCHER);
        expect(talks).toHaveLength(1);
        expect(talks[0]).toMatchObject({ cause: 'done', flag: { ...FLAG, value: false } });
        expect(talks[0].page).toBe(talks[0].pages);
        expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining({ ...FLAG, by: WATCHER }));
        expect(run.level).toBe(114);
        expect(run.state.vx).toBe(0);
        expect(run.state.vy).toBe(0);
    });

    it('then the exit: the same arrival talks and leaves by `teleporter@64,144` (the survey\'s L114 step)', () => {
        const boot = ARRIVALS.from16;
        const run = runAt(boot);
        const out = solve(true, run, [CLEAR, { kind: 'reach-exit', exit: { x: 64, y: 144 } }], boot);
        expect(out.records.map((r) => r.strategy ?? r.goal)).toEqual(['talk', 'reach-exit']);
        expect(run.level).toBe(113);
        expect(run.ledger('earnedClears')).toContainEqual(expect.objectContaining(FLAG));
    });
});

describe('ON — a SILENT watcher answers by its census reason', () => {
    it('{114,0} cleared at boot: `already-clear` (the game\'s own reading), no tick', () => {
        const boot = ARRIVALS.from16;
        const run = runAt(boot, [{ level: 114, tag: 0 }]);
        const out = solve(true, run, [CLEAR], boot);
        expect(out.records).toEqual([expect.objectContaining({ arm: 'already-clear' })]);
        expect(out.records[0].why).toContain('is cleared');
        expect(out.perTick).toHaveLength(0);
        expect(run.watcherTalks).toEqual([]);
    });

    it('an empty `text` (L37\'s watcher@104,264): `cannot-act` — it never writes its tag', () => {
        const boot = { level: 37, x: 32, y: 288 };
        const goal = { kind: 'clear-tag', tag: { level: 37, tag: 2 }, at: { x: 104, y: 264 }, obstacle: 'watcher@104,264' };
        const e = refusalOf(() => solve(true, runAt(boot), [goal], boot));
        expect(e?.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'cannot-act', id: 'watcher@104,264' });
        expect(e.message).toContain('`text` attribute is empty');
        // OFF the same goal is the base's `already-clear`.
        expect(solve(false, runAt(boot), [goal], boot).records[0].arm).toBe('already-clear');
    });
});
