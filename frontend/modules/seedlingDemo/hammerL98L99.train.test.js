/**
 * ⛓ hammer-phase L98-L99 — `KILLLOCK_STANDOUT_GUARD` (`SEEDLING_KILLLOCK_STANDOUT_GUARD`, OFF) and `DRIVE_DEATH_REFUSED`
 * (`SEEDLING_DRIVE_DEATH_REFUSED`, OFF), measured with `KILLLOCK_LINE_STANCE` (OFF) on and off.
 *
 * The witnesses are the vanilla route survey's steps 227 (L98: the Chest, then the L99 stairs) and 228 (L99: the L100
 * stairs), staged from the survey's own 0-tick boot views (`fixtures/hammer-l98-l99/survey-step-22{7,8}-boot.json`,
 * written by `survey-seedling-route.mjs --through=end`) on the survey's own rooms (the patched map with the AP chest
 * delivered). Every plan's hits and deaths are read off a REPLAY of its inputs on a fresh run (⚖ 30(c)).
 *   227, LINE_STANCE ON: the line kill leaves the player in `spinningaxe@128,64`'s sweep and the corpse/lock fade
 *        stands take it twice; the stand-out guard refuses that attempt and the next stance kills hitless.
 *   228, LINE_STANCE OFF: the exit walk dies to `lavachain@80,64` and the reboot's kept shake band refuses an on-screen
 *        question 12 ticks later; the death guard refuses at the death, by name.
 * The switches' own row is `hammerL98L99.test.js`. `CC/docs/cloud-reports/seedling-hammer-l98-l99-line-stance.md`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { deliveredChestDocument } from './apChestDelivery.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY } from './contactFidelity.js';
import {
    DRIVE_DEATH_REFUSED_COUNTS, KILLLOCK_STANDOUT_GUARD_COUNTS, resetDriveDeathRefusedCounts,
    resetKillLockStandOutGuardCounts, withDriveDeathRefused, withKillLockLineStance, withKillLockStandOutGuard,
} from './solverBot.js';
import { patchedMapDocument } from './seedlingSetPatches.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const boot = (step) => readFileSync(join(HERE, 'fixtures', 'hammer-l98-l99', `survey-step-${step}-boot.json`), 'utf8');
const MAP = patchedMapDocument(JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8')));
/** The survey's MODEL rooms: the AP chest delivered as its `apitem` while `apChestItem` is on (its default). */
const SOURCE = levelSourceFromAtlas(CONTACT_FIDELITY.apChestItem ? deliveredChestDocument(MAP) : MAP);
const STEPS = {
    227: [{ kind: 'collect-placement', placement: { x: 160, y: 32 } }, { kind: 'reach-exit', exit: { x: 112, y: 112 } }],
    228: [{ kind: 'reach-exit', exit: { x: 48, y: 96 } }],
};

/** One survey step solved as the survey does, under the three switches; the plan replayed on a fresh run. */
async function solveStep(step, { line = false, standOut = false, death = false } = {}) {
    const staging = solveStaging(stagingFromTape(parseTape(boot(step))));
    const makeRun = (persistence) => createRunForStaging({ ...staging, persistence }, SOURCE);
    resetKillLockStandOutGuardCounts();
    resetDriveDeathRefusedCounts();
    const solve = () => twoPassSolve({ makeRun, goals: STEPS[step], name: `hammer-l98-l99-step-${step}`,
        boot: staging.boot, persistence: staging.persistence, log: () => {} });
    let solved;
    try {
        solved = await withKillLockLineStance(line, () => withKillLockStandOutGuard(standOut,
            () => withDriveDeathRefused(death, solve)));
    } catch (e) {
        return { ok: false, message: String(e.message), obstacle: e.obstacle ?? null,
            standOut: [...KILLLOCK_STANDOUT_GUARD_COUNTS.rows], deaths: [...DRIVE_DEATH_REFUSED_COUNTS.rows] };
    }
    const run = makeRun(solved.persistence);
    const equipsAt = new Map((solved.out.equips ?? []).map((e) => [e.t, e.slot]));
    solved.out.perTick.forEach((held, t) => {
        if (equipsAt.has(t)) run.equipNow(equipsAt.get(t));
        run.advance(held);
    });
    return { ok: true, ticks: solved.out.perTick.length, perTick: solved.out.perTick.map((k) => [...k].sort().join('+')),
        hits: run.playerHits.map((h) => `${h.id ?? h.source}@t${h.t}`), deaths: run.playerDeaths.length,
        level: run.level, standOut: [...KILLLOCK_STANDOUT_GUARD_COUNTS.rows] };
}

describe('hammer-phase L98-L99 — survey step 227 (L98, the Chest then the L99 stairs)', () => {
    it('LINE_STANCE OFF: solved hitless, and both new switches leave the plan byte-identical (the control)', async () => {
        const off = await solveStep(227);
        expect(off).toMatchObject({ ok: true, ticks: 520, hits: [], deaths: 0, level: 99 });
        const on = await solveStep(227, { standOut: true, death: true });
        expect(on.perTick).toEqual(off.perTick);
        // the guard was asked (the last kill's stand-out) and found it clear
        expect(on.standOut.length).toBeGreaterThan(0);
        expect(on.standOut.every((r) => r.verdict === 'clear')).toBe(true);
    }, 120000);

    it('LINE_STANCE ON alone: solved by standing out the fades in the axe\'s sweep — 2 hits no plan billed', async () => {
        const line = await solveStep(227, { line: true });
        expect(line).toMatchObject({ ok: true, ticks: 483, deaths: 0, level: 99,
            hits: ['spinningaxe@128,64@t358', 'spinningaxe@128,64@t381'] });
    }, 120000);

    it('LINE_STANCE ON + KILLLOCK_STANDOUT_GUARD: the axe-hit stand-out is refused by name, the next stance kills, '
        + 'solved hitless', async () => {
        const g = await solveStep(227, { line: true, standOut: true });
        expect(g).toMatchObject({ ok: true, ticks: 576, hits: [], deaths: 0, level: 99 });
        const refused = g.standOut.filter((r) => r.verdict === 'refused');
        expect(refused.length).toBeGreaterThan(0);
        expect(refused[0].why).toMatch(/^spinningaxe@128,64 hits the player at run t358 /);
        expect(g.standOut.at(-1).verdict).toBe('clear');
    }, 120000);
});

describe('hammer-phase L98-L99 — survey step 228 (L99, the L100 stairs)', () => {
    it('LINE_STANCE OFF: the reboot band refuses at t496; DRIVE_DEATH_REFUSED names the death at t484 instead', async () => {
        const off = await solveStep(228);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/whether lavarunner lavarunner@176,64 is on screen at tick 496 depends on where inside/);
        const death = await solveStep(228, { death: true });
        expect(death.ok).toBe(false);
        expect(death.message).toContain('the player DIED at run t484 in level 99 (lavachain@80,64; the hits before it: '
            + 'lavachain@80,64 at t394, lavachain@80,64 at t414, lavachain@80,64 at t484)');
        expect(death.obstacle).toEqual({ kind: 'death', id: 'lavachain@80,64' });
        expect(death.deaths).toHaveLength(1);
    }, 120000);

    it('LINE_STANCE ON: solved hitless, and the same plan with both new switches on', async () => {
        const line = await solveStep(228, { line: true });
        expect(line).toMatchObject({ ok: true, ticks: 477, hits: [], deaths: 0, level: 100 });
        const all = await solveStep(228, { line: true, standOut: true, death: true });
        expect(all.perTick).toEqual(line.perTick);
    }, 120000);
});
