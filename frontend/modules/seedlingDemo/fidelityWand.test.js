/**
 * `fidelityWand.test.js` — ⛓⛓⛓ SEEDLING FIDELITY WAND: what a wand shot opens, on the GAME and in the model.
 *
 * `fixtures/wand-witness/<name>.json` holds a tape and the GAME's readings (`probe-seedling-wand-mobiles.mjs
 * --record`, p4f headless) at every sampled tick of the boot level: the player, every `WandShot` row
 * (`botMobiles()`) and the boot level's newly cleared flags (`botStatus().persistence_cleared`). This replays each
 * against the model in node (`wandWitness.modelWandSamples`) — the player at 0 px, the shots at the same points with
 * the same anim, and the wand-subject flags (`wandSubjectTags`: the room's MagicalLock and WandLock tags) the same set.
 *
 *   wand-l39-wandlock-shot   the NEGATIVE: a shot at L39's plug `wandlock@144,592` dies on it and writes nothing;
 *                            the walk north stays shut (a `WandLock` is a `Lock`, `WandShot.checkEntity` has no arm)
 *   wand-l68-magicallock     the POSITIVE: the solver's own `wand` plan (behind `WAND_VERB`) on survey step 147's
 *                            staging — `MagicalLock.hit` writes `{68,1}` and the cell opens fifteen ticks later
 *   wand-l34-barhouse-exit   a whole SOLVE: sweep-3 leg 354's L34 arrival with the Wand, through the lock that stands
 *                            on the teleporter, into L12
 *
 * And the switch (`WAND_VERB`, OFF by default): with it OFF the strategy tables and lookups answer what they did
 * before this slice; with it ON a `wandlock` refines to its own opener and a `MagicalLock` to `wand`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KNOWN_STRATEGY_VERBS } from './decisionTrace.js';
import { atlasLevelSource } from './levelSource.js';
import {
    OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, SolverRefusal, WAND_TARGET_TAGS, frontierExecutor,
} from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, runTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { WAND_VERB, withWandVerb } from './wandVerb.js';
import { modelWandSamples, wandSubjectTags } from './wandWitness.js';
import { WAND_WITNESSES, wandStaging, wandWitnessTape } from '../../../scripts/procgen/plan-seedling-wand-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'fixtures', 'wand-witness');
const levelSource = atlasLevelSource();
const load = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));

function replay(name) {
    const w = load(name);
    const tape = parseTape(JSON.stringify(w.tape));
    const col = modelWandSamples(tape, levelSource);
    const subject = wandSubjectTags(tape.boot.level, levelSource);
    const off = [];
    for (const s of w.samples) {
        const m = col[s.t];
        if (!m) { off.push(`t ${s.t}: no model reading`); continue; }
        if (m.px !== s.player.x || m.py !== s.player.y) {
            off.push(`t ${s.t}: player game (${s.player.x},${s.player.y}) model (${m.px},${m.py})`);
        }
        const gs = s.shots.map((x) => `${x.x},${x.y},${x.anim}`).sort().join(' ');
        const ms = m.shots.map((x) => `${x.x},${x.y},${x.anim}`).sort().join(' ');
        if (gs !== ms) off.push(`t ${s.t}: shots game [${gs}] model [${ms}]`);
        const gf = s.cleared.filter((c) => subject.has(c)).sort().join();
        const mf = m.cleared.filter((c) => c.startsWith(`${tape.boot.level}:`) && subject.has(c)).sort().join();
        if (gf !== mf) off.push(`t ${s.t}: subject flags game [${gf}] model [${mf}]`);
    }
    return { w, tape, col, off };
}

describe('the wand witnesses replay at 0 px (the GAME, p4f headless)', () => {
    it('wand-l39-wandlock-shot: the shot dies on the WandLock, no flag is written, the plug holds', () => {
        const { w, off } = replay('wand-l39-wandlock-shot');
        expect(off).toEqual([]);
        expect(w.samples.length).toBeGreaterThan(100);
        const withShot = w.samples.filter((s) => s.shots.length > 0);
        expect(withShot.length).toBeGreaterThan(0);
        // The shot spawns INSIDE the plug's box (y 592..608) and its first update plays "die".
        expect(withShot[0].shots[0]).toMatchObject({ x: 152, y: 594, anim: 'flare' });
        expect(withShot[1].shots[0].anim).toBe('die');
        expect(w.samples.every((s) => s.cleared.length === 0)).toBe(true);
        expect(w.samples.at(-1).player).toEqual({ x: 152, y: 610.1 });
    });
    it('wand-l68-magicallock: the shot opens the MagicalLock — {68,1} on the hit, the cell 15 ticks later', () => {
        const { w, off } = replay('wand-l68-magicallock');
        expect(off).toEqual([]);
        const first = w.samples.find((s) => s.cleared.includes('68:1'));
        const shot = w.samples.find((s) => s.shots.length > 0);
        expect(shot.t).toBe(130);
        expect(first.t).toBe(131);
        // The walk north passes the lock's bottom edge (y 48) — the wall is gone.
        expect(w.samples.at(-1).player.y).toBeLessThan(48);
    });
    it('wand-l34-barhouse-exit: a whole reach-exit SOLVED through the verb — the lock on the teleporter, then L12', () => {
        const { w, off, tape } = replay('wand-l34-barhouse-exit');
        expect(off).toEqual([]);
        const shot = w.samples.find((s) => s.shots.length > 0);
        const flag = w.samples.find((s) => s.cleared.includes('34:0'));
        expect([shot.t, flag.t]).toEqual([171, 172]);
        const out = runTape(tape, { levelSource });
        expect(out.ticks.at(-1).level).toBe(12);
    });
    it('every witness tape is what the planner script derives today', async () => {
        for (const def of WAND_WITNESSES) {
            const { tape } = await wandWitnessTape(def);
            expect({ ...load(def.name).tape, description: null }).toEqual({ ...tape, description: null });
        }
    }, 120000);
});

describe('WAND_VERB OFF is the base (byte-identical lookups)', () => {
    it('ships OFF, and the shared tables keep their words', () => {
        expect(WAND_VERB.enabled).toBe(false);
        expect(OBSTACLE_STRATEGIES['solid:wandlock']).toBe('wand');
        expect(OBSTACLE_STRATEGIES['solid:magicallock']).toBe('kill');
        expect(OBSTACLE_STRATEGIES['solid:magicallockfire']).toBeUndefined();
        expect(STRATEGY_EXECUTORS.wand).toBeUndefined();
        expect(frontierExecutor('wand')).toBeUndefined();
        expect(KNOWN_STRATEGY_VERBS).toContain('wand');
        expect(WAND_TARGET_TAGS).toEqual(['magicallock', 'magicallockfire']);
    });
    it('ON registers the verb on the frontier only while it is on', () => {
        expect(withWandVerb(true, () => typeof frontierExecutor('wand'))).toBe('function');
        expect(frontierExecutor('wand')).toBeUndefined();
    });
    it('the L68 witness tape, stepped with the switch OFF, opens the lock but folds no flag (ON folds it at the hit)', () => {
        const { tape } = replay('wand-l68-magicallock');
        const stepWith = (on) => withWandVerb(on, () => {
            let run = null;
            const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
            let last = null;
            for (let r = st.next(); !r.done; r = st.next()) last = r.value.observation;
            return { last, flags: run.earnedClears, opened: run.magicalLocksOpened };
        });
        const off = stepWith(false);
        const on = stepWith(true);
        expect(off.last).toEqual(on.last);
        expect(off.last.y).toBeLessThan(48);
        expect(off.opened).toEqual(on.opened);
        expect(off.flags.some((c) => c.level === 68 && c.tag === 1)).toBe(false);
        expect(on.flags.find((c) => c.level === 68 && c.tag === 1))
            .toMatchObject({ by: 'magicallock@16,32', t: on.opened[0].hitTick });
    });
});

/** The survey's staging for a step, as the witness planner writes it (and the goals the survey asked). */
async function solveStep(def, goals) {
    const staging = await wandStaging(def);
    return withWandVerb(true, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals, name: `wand-test-${def.step}`, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
}

describe('WAND_VERB ON — the solver', () => {
    it('L68 (survey step 147): keylock, then the wand opens magicallock@16,32 (press t122, hit t130, open t145)', async () => {
        const def = WAND_WITNESSES.find((w) => w.step === 147);
        const solved = await solveStep(def, def.goals);
        const wand = solved.out.records.find((r) => r.strategy === 'wand');
        expect(solved.out.records.map((r) => r.strategy)).toEqual(['keylock', 'wand']);
        expect(wand).toMatchObject({ target: 'magicallock@16,32', pressTick: 122, hitTick: 130, openTick: 145,
            lean: 'up', restoredSlot: 0 });
        expect(solved.out.equips).toEqual([{ t: 122, slot: 2 }, { t: 145, slot: 0 }]);
    }, 120000);
    it('L39 (survey step 81): the plug is a KILL-LOCK — refined to `kill`, never to `wand`', async () => {
        const def = { ...WAND_WITNESSES.find((w) => w.step === 60), step: 81, keys: [0, 1, 2],
            items: ['canSwim', 'hasFire', 'hasShield', 'hasTorch'] };
        let err = null;
        try {
            await solveStep(def, [{ kind: 'reach-exit', exit: { x: 144, y: 0 } }]);
        } catch (e) { err = e; }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toMatch(/-> kill: /);
        expect(err.message).not.toMatch(/'wand'/);
    }, 120000);
    it('a FIRE MagicalLock (L101, survey step 213) refuses BY NAME: the Fire Wand is the unmodelled case-5 press', async () => {
        const def = { name: 'step-213', step: 213, boot: { level: 101, x: 288, y: 240 }, keys: [0, 1, 2, 3, 4],
            items: ['canSwim', 'hasDarkShield', 'hasDarkSuit', 'hasDarkSword', 'hasFeather', 'hasFire',
                'hasFireWand', 'hasGhostSword', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'] };
        let err = null;
        try {
            await solveStep(def, [{ kind: 'reach-exit', exit: { x: 104, y: 24 } }]);
        } catch (e) { err = e; }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toMatch(/-> wand: magicallockfire@96,48 cannot be opened by this run/);
        expect(err.message).toMatch(/case 5/);
    }, 120000);
});
