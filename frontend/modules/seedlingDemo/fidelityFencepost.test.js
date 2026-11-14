/**
 * ⛓⛓ SEEDLING FIDELITY FENCEPOST (wave 40) — `CONTACT_FIDELITY.spinnerRemoveRead`: a spinner whose fade reached
 * `alpha <= 0` leaves the model's roster on the read the game's world has dropped it by.
 *
 * THE GAME (`vendor/seedling/src`): `Mobile.death` (`Mobile.as:60-71`) calls `FP.world.remove` on the alpha-zero update;
 * `Engine.update` (`net/flashpunk/Engine.as:70-78`) is `FP._world.update(); FP._world.updateLists();`, so the entity is
 * out of the world (and `Spinner.removed()` has written its flag) at the END of that update. Every read between frames
 * therefore has no row for it. On the alpha-zero update itself the entity is still in every type list: `Spinner.update`
 * swings its hammer after `super.update()` with no `destroy` test (`Enemies/Spinner.as:66-76`).
 *
 * THE MODEL: `stepSpinner` sets `removePending` on the alpha-zero step and `removed` at the top of the NEXT step, so
 * every between-ticks read (`run.entities('spinnerBodies')`, the press/fire censuses, `spinnerDeaths`) kept the corpse
 * one read past the game (L39PHANTOM D0, `isRemovePendingFencepost`: the game's last listed read is t1277, the model's
 * t1278). ON: `advance` settles the pending removal at the END of the tick that stepped it
 * (`levelRun.settleSpinnerRemovalsNow`), after everything that tick's update reads, and runs the removal's own WRITE
 * loop there too (`spinnerWrites`, the banked clear, `assertSpinnerRemovalIsDeclared`'s kill-lock declaration), with
 * the values it stamped a tick later (`ticksCompleted` has already moved): one clock. A first cut left the write on
 * the next tick, and `solverBot`'s kill verb, which ends on the roster and then asks `spinnerKillLockOpens`, threw
 * *"recorded NOTHING"* in L18 (`solve-seedling-r8-l18 --check`): a body gone with its ledger empty is two clocks.
 *
 * Rows predicted before the change; mutants made by copy + restore (the report lists the measured reds):
 *   M1 the `CONTACT_FIDELITY.spinnerRemoveRead` gate dropped from the settle → "OFF: the named fencepost" and the
 *      default-arm L39PHANTOM row red (the fencepost is gone with the key OFF)
 *   M2 the settle moved ABOVE the tick's body (the top of `advance`)         → "ON: zero fencepost ticks" reds (a
 *      between-ticks read still lists the corpse) and the source-shape row reds
 *   M3 the settle flips the body and does NOT run the write loop (`stepped.bank()` dropped) → "between ticks the
 *      roster and the ledger agree" reds (the body is gone and `spinnerKillLockOpens` has no row for it yet)
 *   M5 the write loop's stamp moved by the settle (`t: ticksCompleted` there)  → "ONE CLOCK" reds
 *   M4 `stepSpinner` itself sets `removed` on the alpha-zero step (the wrong fix: the alpha-zero tick's contact and
 *      block sweep lose the body)                                             → the source-shape row and
 *      `spinner.test.js`'s removePending rows red
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { dangerVolumes, spinnerDanger, staticEnemyDanger } from './dangerMap.js';
import {
    L39PHANTOM_PATH, L39PHANTOM_SOURCE, L39PHANTOM_SPINNER, L39SHAFT_WITNESS_DIR,
    compareL39Phantom, deathReadout, l39PhantomModelSamples, packSpinnerRows,
} from './fidelityL39Phantom.js';
import { l39LevelSource } from './fidelityL39Shaft.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper, runTapeToStream } from './tapeRunner.js';

const WITNESS = JSON.parse(readFileSync(L39PHANTOM_PATH, 'utf8'));
const SOURCE = JSON.parse(readFileSync(`${L39SHAFT_WITNESS_DIR}/${L39PHANTOM_SOURCE}.json`, 'utf8'));
const LEVEL_RUN_SRC = readFileSync(new URL('./levelRun.js', import.meta.url), 'utf8');
const ON = { spinnerRemoveRead: true };
const OFF = { spinnerRemoveRead: false };
const md5 = (v) => createHash('md5').update(JSON.stringify(v)).digest('hex');
const ids = (rows) => rows.map((r) => r.id);

/** The step-66 tape on the delivered set under `over`, stepped to observation `n`; returns the run. */
async function runAt(n, over) {
    const levelSource = await l39LevelSource('delivered');
    const tape = parseTape(JSON.stringify(SOURCE.tape));
    return withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done && r.value.observation.t < n) r = st.next();
        return run;
    });
}

/** The witness comparison under `over`: `{bad, fencepost, readout, kills}`. */
async function compared(over) {
    const model = await l39PhantomModelSamples(SOURCE.tape, over, { set: 'delivered' });
    const byT = [];
    for (const m of model.samples) if (m) byT[m.t] = { t: m.t, level: m.level, rows: packSpinnerRows(m.rows) };
    return { error: model.error, ...compareL39Phantom(WITNESS.samples, byT), readout: deathReadout(byT.filter(Boolean)) };
}

/** A committed tape's per-tick roster ids and the corpse reads (a listed body with `destroy` up and `alpha <= 0`). */
function rosterTrace(name, over) {
    const tape = loadTape(name);
    return withContactFidelity(over, () => {
        let run = null;
        const listed = new Map();
        const corpse = [];
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const t = r.value.observation.t;
            for (const b of run?.entities('spinnerBodies') ?? []) {
                listed.set(`${run.level}:${b.id}`, t);
                if (b.destroy && b.alpha <= 0) corpse.push(t);
            }
            r = st.next();
        }
        return {
            listed: Object.fromEntries(listed), corpse,
            writes: run.ledger('spinnerWrites'), opens: run.ledger('spinnerKillLockOpens'), deaths: run.spinnerDeaths,
        };
    });
}

describe('FENCEPOST D1 — `spinnerRemoveRead` (OFF)', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_SPINNER_REMOVE_READ)(
        'ships OFF and LAST; its env name is a known worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.spinnerRemoveRead).toBe(false);
            expect(CONTACT_FIDELITY.spinnerRemoveRead).toBe(false);
            // ⛓ wave 41: ROCKBUTTON `fallRockHoldsButton` landed after it.
            expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf('spinnerRemoveRead') + 1)).toEqual(['fallRockHoldsButton']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SPINNER_REMOVE_READ');
        });

    it('OFF: the named fencepost is exactly t1278 on the D0 game witness (the model lists the corpse one read longer)', async () => {
        const c = await compared(OFF);
        expect(c.error).toBeNull();
        expect(c.bad).toEqual([]);
        expect(c.fencepost).toEqual([1278]);
        expect(c.readout).toEqual({ destroyAt: 1267, lastListed: 1278, goneAt: 1279 });
    });

    it('ON: ZERO fencepost ticks on the D0 game witness — every spinner row equals the game\'s at 0 px on all 121 ticks', async () => {
        const c = await compared(ON);
        expect(c.error).toBeNull();
        expect(c.bad).toEqual([]);
        expect(c.fencepost).toEqual([]);
        expect(c.readout).toEqual(WITNESS.readout);
        expect(c.readout).toEqual({ destroyAt: 1267, lastListed: 1277, goneAt: 1278 });
    });

    it('at the game\'s first gone read (t1278): OFF lists the corpse at alpha <= 0, ON does not, and no other row differs', async () => {
        const off = await runAt(1278, OFF);
        const on = await runAt(1278, ON);
        const corpse = off.entities('spinnerBodies').find((b) => b.id === L39PHANTOM_SPINNER);
        expect(corpse.destroy).toBe(true);
        expect(corpse.alpha).toBeLessThanOrEqual(0);
        expect(ids(on.entities('spinnerBodies'))).not.toContain(L39PHANTOM_SPINNER);
        expect(JSON.stringify(on.entities('spinnerBodies')))
            .toBe(JSON.stringify(off.entities('spinnerBodies').filter((b) => b.id !== L39PHANTOM_SPINNER)));
        // the getter and the query are one function
        expect(JSON.stringify(on.spinnerBodies)).toBe(JSON.stringify(on.entities('spinnerBodies')));
        // ⛓ the live arm at horizon 0: OFF prices the corpse for this one observation, ON does not
        const r = { ...corpse.rect, right: corpse.rect.x + corpse.rect.w, bottom: corpse.rect.y + corpse.rect.h };
        expect(ids(withContactFidelity(OFF, () => spinnerDanger(off, r, 0)))).toContain(L39PHANTOM_SPINNER);
        expect(ids(withContactFidelity(ON, () => spinnerDanger(on, r, 0)))).not.toContain(L39PHANTOM_SPINNER);
        // ⛓ and with `spinnerRosterGone` (ON by default) the static arm does not pick the gone body up at its placement
        expect(ids(withContactFidelity(ON, () => staticEnemyDanger(on, r)))).not.toContain(L39PHANTOM_SPINNER);
        expect(ids(withContactFidelity(ON, () => dangerVolumes(on, 0)))).not.toContain(L39PHANTOM_SPINNER);
    });

    it('one read earlier (t1277, the game\'s last listed read) and one later (t1279): ON equals OFF byte for byte', async () => {
        for (const n of [1277, 1279]) {
            const off = await runAt(n, OFF);
            const on = await runAt(n, ON);
            expect(JSON.stringify(on.entities('spinnerBodies'))).toBe(JSON.stringify(off.entities('spinnerBodies')));
            expect(on.stateDigest()).toBe(off.stateDigest());
        }
        expect(ids((await runAt(1277, ON)).entities('spinnerBodies'))).toContain(L39PHANTOM_SPINNER);
    });

    it('ONE CLOCK: the removal ledger is untouched — `spinnerWrites`, `spinnerKillLockOpens` and the observation stream are identical ON and OFF', async () => {
        const levelSource = await l39LevelSource('delivered');
        const tape = parseTape(JSON.stringify(SOURCE.tape));
        const stream = (over) => withContactFidelity(over, () => md5(runTapeToStream(tape, { levelSource })));
        expect(stream(ON)).toBe(stream(OFF));
        const off = await runAt(1300, OFF);
        const on = await runAt(1300, ON);
        expect(off.ledger('spinnerWrites').length).toBeGreaterThan(0);
        expect(on.ledger('spinnerWrites')).toEqual(off.ledger('spinnerWrites'));
        expect(on.ledger('spinnerKillLockOpens')).toEqual(off.ledger('spinnerKillLockOpens'));
        expect(on.spinnerDeaths).toEqual(off.spinnerDeaths);
        expect(on.stateDigest()).toBe(off.stateDigest());
        // the write's own row: the tick AFTER the alpha-zero step, in both arms (F5's convention, not moved)
        expect(off.ledger('spinnerWrites').find((w) => w.id === L39PHANTOM_SPINNER).t).toBe(1279);
    });

    it('the kill-lock room (L18, `f1c-l18-lock-removal`): ON drops each corpse read, and the F5 lock stamp does not move', () => {
        const off = rosterTrace('f1c-l18-lock-removal', OFF);
        const on = rosterTrace('f1c-l18-lock-removal', ON);
        expect(off.corpse).toEqual([169, 316]);
        expect(on.corpse).toEqual([]);
        expect(off.listed).toEqual({ '18:spinner@48,96': 169, '18:spinner@112,48': 316 });
        expect(on.listed).toEqual({ '18:spinner@48,96': 168, '18:spinner@112,48': 315 });
        expect(off.opens.filter((o) => !o.nil).length).toBeGreaterThan(0);
        expect(on.opens).toEqual(off.opens);
        expect(on.writes).toEqual(off.writes);
        expect(on.deaths).toEqual(off.deaths);
    });

    it('between ticks the roster and the ledger agree: on the first read a body is gone, its kill-lock declaration and its write are there', () => {
        const at = (over) => withContactFidelity(over, () => {
            let run = null;
            const rows = [];
            const st = createTapeStepper(loadTape('f1c-l18-lock-removal'),
                { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            let r = st.next();
            while (!r.done) {
                const t = r.value.observation.t;
                if (run && t >= 314 && t <= 318) {
                    rows.push({ t, listed: ids(run.entities('spinnerBodies')).length,
                        opens: run.ledger('spinnerKillLockOpens').filter((o) => !o.nil).length,
                        writes: run.ledger('spinnerWrites').length });
                }
                r = st.next();
            }
            return rows;
        });
        // OFF: the last body's corpse is listed at 316 and the ledger lands with its drop at 317
        expect(at(OFF)).toEqual([
            { t: 314, listed: 1, opens: 0, writes: 1 }, { t: 315, listed: 1, opens: 0, writes: 1 },
            { t: 316, listed: 1, opens: 0, writes: 1 }, { t: 317, listed: 0, opens: 1, writes: 2 },
            { t: 318, listed: 0, opens: 1, writes: 2 }]);
        // ON: both move together, one read sooner — never a read with the body gone and the ledger empty
        expect(at(ON)).toEqual([
            { t: 314, listed: 1, opens: 0, writes: 1 }, { t: 315, listed: 1, opens: 0, writes: 1 },
            { t: 316, listed: 0, opens: 1, writes: 2 }, { t: 317, listed: 0, opens: 1, writes: 2 },
            { t: 318, listed: 0, opens: 1, writes: 2 }]);
    });

    it('a pit death (L92, `r5-feather`): the same one read', () => {
        const off = rosterTrace('r5-feather', OFF);
        const on = rosterTrace('r5-feather', ON);
        expect(off.corpse).toEqual([1011]);
        expect(on.corpse).toEqual([]);
        expect(on.listed['92:spinner@224,64']).toBe(off.listed['92:spinner@224,64'] - 1);
        expect(on.writes).toEqual(off.writes);
    });

    it('SOURCE SHAPE: the settle runs once, at the end of `advance`, after the tick\'s body; `stepSpinner` is not changed', () => {
        const calls = LEVEL_RUN_SRC.match(/settleSpinnerRemovalsNow\(\)/g) ?? [];
        expect(calls.length).toBe(1);
        // the write loop is ONE arrow with two callers: in place (as before) and the settle's `stepped.bank()`
        expect(LEVEL_RUN_SRC.match(/bankSpinnerRemovals\(\);/g)?.length).toBe(1);
        expect(LEVEL_RUN_SRC.match(/stepped\.bank\(\)/g)?.length).toBe(1);
        const body = LEVEL_RUN_SRC.slice(LEVEL_RUN_SRC.indexOf('        advance(held) {'));
        // the tick's body is one arrow; the settle is below its close and above the return of its result
        expect(body).toMatch(/advance\(held\) \{\n\s+\/\/[^\n]*FENCEPOST[^\n]*\n\s+spinnersSteppedThisTick = null;[^\n]*\n\s+const advanced = \(\(\) => \{/);
        expect(body).toMatch(/\}\)\(\);\n\s+settleSpinnerRemovalsNow\(\);\n\s+return advanced;\n {8}\},/);
        const spinnerSrc = readFileSync(new URL('./spinner.js', import.meta.url), 'utf8');
        expect(spinnerSrc).toMatch(/if \(s\.removePending\) return \{ \.\.\.s, removed: true, removePending: false \};/);
        expect(spinnerSrc).not.toMatch(/spinnerRemoveRead/);
    });
});
