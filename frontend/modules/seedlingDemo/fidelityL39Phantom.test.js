/**
 * ⛓⛓ SEEDLING FIDELITY L39PHANTOM (wave 38) — a spinner a Pulser killed must stop being priced at its placement.
 *
 *   D0  the game witness `l39phantom-pulser-kill` (p4g, the delivered set, `probe-seedling-l39-pulser-kill.mjs
 *       --record`): `pulser@64,96` kills `spinner@112,88` at t1267; the model reproduces every spinner's x, y, hits,
 *       hitsTimer, destroy and alpha at 0 px over t1180–1300 but ONE named observation (`isRemovePendingFencepost`,
 *       t1278: the game's world has dropped the corpse, the model's roster still lists it at alpha −0.1).
 *   D1  `CONTACT_FIDELITY.spinnerRosterGone` (OFF): `dangerMap.spinnersTheRunSteps` also skips a spinner the visit's
 *       roster was built with (`world.spinners`) and has lost, whatever killed it. Each boundary is a row: before the
 *       kill, in the fade, after the removal, no roster read, no spinner list — and both call sites
 *       (`staticEnemyDanger`, `dangerVolumes`).
 *
 * Mutants (made by copy + restore, predicted first; the report lists them):
 *   M1 drop the `Array.isArray(roster)` guard           → "no roster read" reds (ON stops pricing every spinner)
 *   M2 `dangerVolumes` calls `spinnersTheRunSteps(run)`  → "after the removal" reds on its `dangerVolumes` half
 *   M3 the `CONTACT_FIDELITY.spinnerRosterGone &&` gate dropped → "after the removal" reds on its OFF half
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { dangerVolumes, spinnerDanger, staticEnemyDanger } from './dangerMap.js';
import {
    L39PHANTOM_PATH, L39PHANTOM_PULSER, L39PHANTOM_SOURCE, L39PHANTOM_SPINNER, L39SHAFT_WITNESS_DIR,
    compareL39Phantom, deathReadout, isRemovePendingFencepost, l39PhantomModelSamples, packSpinnerRows,
} from './fidelityL39Phantom.js';
import { l39LevelSource } from './fidelityL39Shaft.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const WITNESS = JSON.parse(readFileSync(L39PHANTOM_PATH, 'utf8'));
const SOURCE = JSON.parse(readFileSync(`${L39SHAFT_WITNESS_DIR}/${L39PHANTOM_SOURCE}.json`, 'utf8'));
const ON = { spinnerRosterGone: true };
const OFF = { spinnerRosterGone: false };

/** A model run on the delivered set, stepped through the step-66 tape to observation `n` (the defaults). */
async function runAt(n) {
    const levelSource = await l39LevelSource('delivered');
    const tape = parseTape(JSON.stringify(SOURCE.tape));
    let run = null;
    const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done && r.value.observation.t < n) r = st.next();
    return run;
}

/** A view of `run` with some reads replaced (the boundary rows: no roster read, no spinner list). */
function viewOf(run, { roster, world } = {}) {
    return new Proxy(run, {
        get(target, prop) {
            if (prop === 'entities') {
                return (name) => (name === 'spinnerBodies' && roster !== undefined ? roster : target.entities(name));
            }
            if (prop === 'worldFor' && world) return (lv) => world(target.worldFor(lv));
            const v = Reflect.get(target, prop, target);
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
}

const ids = (rows) => rows.map((r) => r.id);
const phantomRect = (run) => withContactFidelity(OFF, () => dangerVolumes(run, 0))
    .find((v) => v.id === L39PHANTOM_SPINNER)?.rect ?? null;

describe('L39PHANTOM D0 — a Pulser kills spinner@112,88, on the game (p4g), reproduced by the model at 0 px', () => {
    it('the recording is the step-66 tape on the delivered set, sampled on every tick of its window', () => {
        expect(WITNESS.page).toBe('seedling_bot_ap_p4g');
        expect(WITNESS.set).toBe('delivered');
        expect(WITNESS.samples.length).toBe(WITNESS.window.to - WITNESS.window.from + 1);
        expect(WITNESS.readout).toEqual({ destroyAt: 1267, lastListed: 1277, goneAt: 1278 });
    });

    it('the model kills it on the game\'s tick and agrees on every spinner row but the one named fencepost', async () => {
        const model = await l39PhantomModelSamples(SOURCE.tape, {}, { set: 'delivered' });
        expect(model.error).toBeNull();
        expect(model.kills.filter((k) => k.enemy === L39PHANTOM_SPINNER))
            .toEqual([{ t: 1267, level: 39, pulser: L39PHANTOM_PULSER, enemy: L39PHANTOM_SPINNER }]);
        const byT = [];
        for (const m of model.samples) if (m) byT[m.t] = { t: m.t, level: m.level, rows: packSpinnerRows(m.rows) };
        const { bad, fencepost } = compareL39Phantom(WITNESS.samples, byT);
        expect(bad).toEqual([]);
        expect(fencepost).toEqual([1278]);
        expect(deathReadout(byT.filter(Boolean))).toEqual({ destroyAt: 1267, lastListed: 1278, goneAt: 1279 });
    });

    it('the fencepost predicate names exactly one extra destroyed, faded-out row', () => {
        const g = '1,2,0,0,0,1';
        expect(isRemovePendingFencepost(g, `${g};5,5,3,30,1,-0.1`)).toBe(true);
        expect(isRemovePendingFencepost(g, `${g};5,5,3,30,1,0.1`)).toBe(false);
        expect(isRemovePendingFencepost(g, `${g};5,5,3,30,0,-0.1`)).toBe(false);
        expect(isRemovePendingFencepost(g, '1,2,0,0,0,0.9;5,5,3,30,1,-0.1')).toBe(false);
    });
});

describe('L39PHANTOM D1 — `spinnerRosterGone` (ON since the wave-38 joint flip, ⚖ user 2026-11-10)', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_SPINNER_ROSTER_GONE)(
        'ships ON, followed only by its sibling key and wave 39\'s; its env name is a known worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.spinnerRosterGone).toBe(true);
            expect(CONTACT_FIDELITY.spinnerRosterGone).toBe(true);
            // ⛓ FIRESPINNER `fireSpinnerArm` (wave 38's sibling) follows it; then wave 39's ROCKFIRE `fireRockArm`.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf('spinnerRosterGone') + 1)).toEqual(['fireSpinnerArm', 'fireRockArm', 'fireBreakArm']); // ⛓ wave 40: FIREBREAK `fireBreakArm`
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SPINNER_ROSTER_GONE');
        });

    it('after the removal (t1290): OFF prices the phantom at its placement in both call sites; ON in neither', async () => {
        const run = await runAt(1290);
        expect(ids(run.entities('spinnerBodies'))).not.toContain(L39PHANTOM_SPINNER);
        expect((run.ledger('spinnerPressHits') ?? []).some((h) => h.id === L39PHANTOM_SPINNER)).toBe(false);
        const r = phantomRect(run);
        expect(r).not.toBeNull();
        const offStatic = withContactFidelity(OFF, () => staticEnemyDanger(run, r));
        expect(ids(offStatic)).toContain(L39PHANTOM_SPINNER);
        expect(offStatic.find((x) => x.id === L39PHANTOM_SPINNER).why).toMatch(/static "Enemy" body at its placement/);
        expect(ids(withContactFidelity(ON, () => staticEnemyDanger(run, r)))).not.toContain(L39PHANTOM_SPINNER);
        const offVol = withContactFidelity(OFF, () => dangerVolumes(run, 0));
        const onVol = withContactFidelity(ON, () => dangerVolumes(run, 0));
        expect(ids(onVol)).not.toContain(L39PHANTOM_SPINNER);
        // ON is OFF minus exactly the phantom's row(s)
        expect(JSON.stringify(onVol)).toBe(JSON.stringify(offVol.filter((v) => v.id !== L39PHANTOM_SPINNER)));
    });

    it('before the kill (t1200): every spinner is in the roster, ON equals OFF byte for byte', async () => {
        const run = await runAt(1200);
        expect(ids(run.entities('spinnerBodies')).sort())
            .toEqual(run.worldFor(39).spinners.map((s) => s.id).sort());
        expect(JSON.stringify(withContactFidelity(ON, () => dangerVolumes(run, 0))))
            .toBe(JSON.stringify(withContactFidelity(OFF, () => dangerVolumes(run, 0))));
    });

    it('in the death fade (t1270): still in the roster, so the static arm skips it in both arms and the live arm prices it', async () => {
        const run = await runAt(1270);
        const body = run.entities('spinnerBodies').find((b) => b.id === L39PHANTOM_SPINNER);
        expect(body?.destroy).toBe(true);
        expect(body.alpha).toBeGreaterThan(0);
        const r = { x: body.rect.x, y: body.rect.y, w: body.rect.w, h: body.rect.h,
            right: body.rect.x + body.rect.w, bottom: body.rect.y + body.rect.h };
        for (const arm of [ON, OFF]) {
            expect(ids(withContactFidelity(arm, () => staticEnemyDanger(run, r)))).not.toContain(L39PHANTOM_SPINNER);
            expect(ids(withContactFidelity(arm, () => spinnerDanger(run, r, 0)))).toContain(L39PHANTOM_SPINNER);
        }
        expect(JSON.stringify(withContactFidelity(ON, () => dangerVolumes(run, 0))))
            .toBe(JSON.stringify(withContactFidelity(OFF, () => dangerVolumes(run, 0))));
    });

    it('no roster read (`spinnerBodies` not an array): ON prices the phantom exactly as OFF', async () => {
        const run = await runAt(1290);
        const r = phantomRect(run);
        const v = viewOf(run, { roster: null });
        const on = withContactFidelity(ON, () => staticEnemyDanger(v, r));
        expect(ids(on)).toContain(L39PHANTOM_SPINNER);
        expect(JSON.stringify(on)).toBe(JSON.stringify(withContactFidelity(OFF, () => staticEnemyDanger(v, r))));
        expect(JSON.stringify(withContactFidelity(ON, () => dangerVolumes(v, 0))))
            .toBe(JSON.stringify(withContactFidelity(OFF, () => dangerVolumes(v, 0))));
    });

    it('a world with no spinner list: ON prices the phantom exactly as OFF', async () => {
        const run = await runAt(1290);
        const r = phantomRect(run);
        const v = viewOf(run, { world: (w) => ({ ...w, spinners: undefined }) });
        expect(ids(withContactFidelity(ON, () => staticEnemyDanger(v, r)))).toContain(L39PHANTOM_SPINNER);
        expect(JSON.stringify(withContactFidelity(ON, () => dangerVolumes(v, 0))))
            .toBe(JSON.stringify(withContactFidelity(OFF, () => dangerVolumes(v, 0))));
    });
});
