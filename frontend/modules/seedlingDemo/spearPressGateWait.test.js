/**
 * ⛓ SEEDLING HAMMER-PHASE ENTRY-38 SHOVE (⚖ the user 2026-11-27, *"Entry-38 shove slice (Recommended)"*) — the
 * default-tier rows of `SPEAR_PRESS_GATE_WAIT`: the switch, the pure gate rule, the wait's bound, the one call site,
 * and a witness on committed fixtures (cheap: one L63 solve per arm).
 *
 * The witness is the walk's own refusal, rebuilt from `r8-solve-11`'s staging (the survey's construction, as
 * `spearPush.test.js` boots its push rooms): L63 at (144,104), the Spear and the Wand held, the WAND selected and
 * pressed on the prefix's one tick, so a WandShot window is up when the solver's first thrust is pressed. That is
 * re-measure-12's A1 38:2 full pass in miniature (there the walk's strike policy fired the wand at tick 294 and the
 * thrust landed on tick 301, the window's last tick).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SPEAR_PRESS_GATE_BOUND, SPEAR_PRESS_GATE_WAIT, SPEAR_PRESS_GATE_WAIT_COUNTS, SPEAR_PRESS_GATE_WAIT_DEFAULT,
    resetSpearPressGateWaitCounts, spearPressGates, waitSpearPressGate, withSpearPressGateWait,
} from './spearPressGateWait.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { solveStaging, stagingFromTape } from './tapeRunner.js';
import { liveOf, replayTape, solveFromTape } from './jsRuntimeSolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
const FAMILY = readFileSync(join(HERE, 'spearPressGateWait.js'), 'utf8');

describe('SPEAR_PRESS_GATE_WAIT — the switch', () => {
    it('ships OFF, reads its env name, and the name is in the worker\'s table', () => {
        expect(SPEAR_PRESS_GATE_WAIT_DEFAULT).toBe(false);
        expect(SPEAR_PRESS_GATE_WAIT.enabled).toBe(process.env.SEEDLING_SPEAR_PRESS_GATE_WAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SPEAR_PRESS_GATE_WAIT');
    });

    it('its with-wrapper sets the switch inside and restores it after, also on a throw', () => {
        const was = SPEAR_PRESS_GATE_WAIT.enabled;
        expect(withSpearPressGateWait(true, () => SPEAR_PRESS_GATE_WAIT.enabled)).toBe(true);
        expect(withSpearPressGateWait(false, () => SPEAR_PRESS_GATE_WAIT.enabled)).toBe(false);
        expect(SPEAR_PRESS_GATE_WAIT.enabled).toBe(was);
        expect(() => withSpearPressGateWait(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(SPEAR_PRESS_GATE_WAIT.enabled).toBe(was);
    });
});

describe('spearPressGates — `set spearing`\'s gate, read off `slashInfo` (pure)', () => {
    const info = (gate, slashing = false) => ({ state: { slashing }, gate: { wanding: false, firing: false, spearing: false,
        ...gate } });

    it('nothing up: the press starts a thrust', () => {
        expect(spearPressGates(info({}))).toEqual([]);
    });

    it('each of the four gates is named, in a fixed order', () => {
        expect(spearPressGates(info({ wanding: true }))).toEqual(['wanding']);
        expect(spearPressGates(info({ firing: true }))).toEqual(['firing']);
        expect(spearPressGates(info({ spearing: true }))).toEqual(['spearing']);
        expect(spearPressGates(info({}, true))).toEqual(['slashing']);
        expect(spearPressGates(info({ wanding: true, firing: true, spearing: true }, true)))
            .toEqual(['wanding', 'firing', 'spearing', 'slashing']);
    });

    it('a missing field reads as down (a run without the field never waits)', () => {
        expect(spearPressGates(undefined)).toEqual([]);
        expect(spearPressGates({})).toEqual([]);
        expect(spearPressGates({ gate: { wanding: 1 } })).toEqual([]);
    });
});

describe('waitSpearPressGate — the wait and its bound', () => {
    /** A fake run whose gate drops after `up` idle ticks (`null` = never). */
    const fake = (up, gate = 'wanding') => {
        let t = 10;
        let idles = 0;
        return {
            readInfo: () => ({ state: { slashing: false }, gate: { [gate]: up === null || idles < up } }),
            idle: () => { idles += 1; t += 1; },
            refuse: (why) => { throw new Error(why); },
            tick: () => t,
            idles: () => idles,
        };
    };

    it('a gate already down costs no tick and records no wait', () => {
        resetSpearPressGateWaitCounts();
        const f = fake(0);
        expect(waitSpearPressGate(f)).toBe(0);
        expect(f.idles()).toBe(0);
        expect(SPEAR_PRESS_GATE_WAIT_COUNTS).toEqual({ asked: 1, waited: [], refused: 0 });
    });

    it('a gate up for k ticks is waited out in exactly k idle ticks, and the row names it', () => {
        resetSpearPressGateWaitCounts();
        const f = fake(3);
        expect(waitSpearPressGate(f)).toBe(3);
        expect(f.idles()).toBe(3);
        expect(SPEAR_PRESS_GATE_WAIT_COUNTS).toEqual({ asked: 1, waited: [{ t: 10, ticks: 3, gates: ['wanding'] }],
            refused: 0 });
    });

    it('a gate that outlives the bound refuses by name after exactly the bound', () => {
        resetSpearPressGateWaitCounts();
        const f = fake(null, 'firing');
        expect(() => waitSpearPressGate(f)).toThrow(
            `the spear press is still gated (firing) ${SPEAR_PRESS_GATE_BOUND} idle ticks after tick 10`);
        expect(f.idles()).toBe(SPEAR_PRESS_GATE_BOUND);
        expect(SPEAR_PRESS_GATE_WAIT_COUNTS.refused).toBe(1);
    });
});

describe('SPEAR_PRESS_GATE_WAIT — the one reader', () => {
    it('one call site, in `execSpearPress` after the freeze wait and before the reach re-ask, guarded by the switch', () => {
        expect(SOURCE.match(/waitSpearPressGate\(/g) ?? []).toHaveLength(1);
        const at = SOURCE.indexOf('function execSpearPress(');
        const body = SOURCE.slice(at, SOURCE.indexOf('\n}\n', at));
        const freeze = body.indexOf("step(IDLE, 'the freeze wait');");
        const call = body.indexOf('if (SPEAR_PRESS_GATE_WAIT.enabled) {');
        const reach = body.indexOf('if (!pressRectTouches(spearHitRect(');
        expect(freeze).toBeGreaterThan(-1);
        expect(call).toBeGreaterThan(freeze);
        expect(reach).toBeGreaterThan(call);
        expect(body).toContain("waitSpearPressGate({ readInfo: () => run.progress('slashInfo')");
    });

    it('the family file carries no single-game constant and reads no run getter', () => {
        const code = FAMILY.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*\*)/.test(l)).join('\n');
        expect(code).not.toMatch(/level\s*===\s*\d|@\d+,\d+|\b(?:jellyfish|pushableblockspear|spinningaxe)\b/);
        expect(code).not.toMatch(/\.progress\(|\.entities\(|\.ledger\(/);
    });
});

describe('the witness: a spear thrust pressed inside a WandShot window (r8-solve-11 staging, L63)', () => {
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
    // the prefix: select the wand (slot 1 of [sword, wand, spear]) and press it once
    const perTick = [new Set(['primary'])];
    const equips = new Map([[0, 1]]);
    const solve = (on) => withContactFidelity(WAND_KEYS, () => withSpearPressGateWait(on, () => {
        const staging = fixture();
        const run = replayTape({ staging, perTick, levelSource, equips, scratchPersistence: true });
        expect(run.progress('primaryWeapon')).toBe('wand');
        expect(run.progress('slashInfo').openUntil.wanding).toBe(7);
        resetSpearPressGateWaitCounts();
        try {
            solveFromTape({ staging, perTick, live: liveOf(run), levelSource, scratchPersistence: true, equips,
                solverGoal: { kind: 'reach-exit', exit: { x: 0, y: 96 } } });
            return { error: null, counts: structuredClone(SPEAR_PRESS_GATE_WAIT_COUNTS) };
        } catch (e) {
            return { error: String(e.message), counts: structuredClone(SPEAR_PRESS_GATE_WAIT_COUNTS) };
        }
    }));

    it('OFF: the thrust on tick 6 is swallowed by the window and the verb refuses as entry 38 did', () => {
        const { error, counts } = solve(false);
        expect(error).toBe('solverBot(js-runtime-solve) reach-exit (0,96)->L61 -> shove (route step 1/4: press): 56 ticks '
            + 'after the thrust (tick 6) pushableblockspear@112,96 is at (112,96), not settled on (6,6).');
        expect(counts).toEqual({ asked: 0, waited: [], refused: 0 });
    });

    it('ON: the verb waits 2 idle ticks for `wanding` to drop, and route step 1 lands (the next stop is elsewhere)', () => {
        const { error, counts } = solve(true);
        expect(counts).toEqual({ asked: 1, waited: [{ t: 6, ticks: 2, gates: ['wanding'] }], refused: 0 });
        // not a solve: the walk to route step 2 fires the still-selected wand at a jellyfish (a hand-over, see the report)
        expect(error).not.toContain('route step 1/4');
        expect(error).toMatch(/^levelRun: a wand shot \(wand@63#\d+\) reached the enemy "jellyfish@160,64"/);
    });
});
