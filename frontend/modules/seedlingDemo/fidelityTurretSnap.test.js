/**
 * ⛓⛓ SEEDLING FIDELITY TURRETSNAP (wave 35) — the danger map prices a live ice turret at the box its contact is tested
 * on, not at its placement (`CONTACT_FIDELITY.turretSnapPricing`, OFF). The witnesses are recorded on the game
 * (`fixtures/turretsnap-witness/`, p4g headless, `probe-seedling-turret-snap.mjs --record`, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { compareTurretCircleWitness, turretCircleModelSamples, unpackTurretCircleSample } from './fidelityTurretCircle.js';
import { L40_TURRET, TURRETSNAP_D1_SWITCHES, TURRETSNAP_WITNESS_DIR, TURRETSNAP_WITNESSES, turretSnapTape }
    from './fidelityTurretSnap.js';
import { iceTurretLiveContactCycle } from './iceTurret.js';
import { dangerVolumes, liveTurretContactRect, staticEnemyDanger } from './dangerMap.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const load = (name) => JSON.parse(readFileSync(join(TURRETSNAP_WITNESS_DIR, `${name}.json`), 'utf8'));
const BELOW = load('turretsnap-l40-below-strip');
const ABOVE = load('turretsnap-l40-above-strip');
const BELOW_GAME = BELOW.samples.map(unpackTurretCircleSample);
const ABOVE_GAME = ABOVE.samples.map(unpackTurretCircleSample);

/** A run at the witness's boot, `ticks` stood; returns what `fn(run)` reads. */
function atBoot(tape, ticks, fn) {
    const run = createRunForStaging(stagingFromTape(parseTape(JSON.stringify(tape))), atlasLevelSource());
    for (let i = 0; i < ticks; i += 1) run.advance(new Set());
    return fn(run);
}
const turretIds = (run, x, y) => staticEnemyDanger(run, playerBoxAt(x, y)).map((d) => d.id);

describe('TURRETSNAP — the switch', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_TURRET_SNAP_PRICING)(
        'turretSnapPricing ships OFF', () => {
            expect(CONTACT_FIDELITY_DEFAULTS.turretSnapPricing).toBe(false);
            expect(CONTACT_FIDELITY.turretSnapPricing).toBe(false);
        });
});

describe('TURRETSNAP D1 — the game touches the SNAPPED body (L40, the game witnesses)', () => {
    it('the recorded tapes are the ones the module builds', async () => {
        for (const w of [BELOW, ABOVE]) {
            const tape = await turretSnapTape(w.name);
            expect(tape.inputs).toEqual(w.tape.inputs);
            expect(tape.boot).toEqual(w.tape.boot);
        }
        expect(Object.keys(TURRETSNAP_WITNESSES)).toEqual([BELOW.name, ABOVE.name]);
    });

    it('the game: the turret reads its ctor point at t0 and its rest two-cycle from t1, the cycle this derives', () => {
        const cyc = iceTurretLiveContactCycle(488, 416);
        expect(cyc.points).toEqual([{ x: 487.5, y: 424 }, { x: 488, y: 423.5 }]);
        expect(cyc.hull).toEqual({ x: 471.5, y: 407.5, w: 32.5, h: 32.5, right: 504, bottom: 440 });
        for (const g of [BELOW_GAME, ABOVE_GAME]) {
            expect(g[0].turret).toEqual({ x: 488, y: 416, dead: false });
            for (const s of g.slice(1)) expect(cyc.points).toContainEqual({ x: s.turret.x, y: s.turret.y });
        }
    });

    it('the game bills the body on t1 where the player meets only the snapped box; nothing where it meets only the ctor box', () => {
        expect(BELOW_GAME.find((g) => g.hits > 0)?.t).toBe(1);
        expect(ABOVE_GAME.every((g) => g.hits === 0)).toBe(true);
        // the boxes: (488,440)'s y 438..443 is under the ctor box (bottom 432) and inside the snapped one (bottom 440)
        expect(playerBoxAt(488, 440)).toMatchObject({ y: 438, bottom: 443 });
        expect(playerBoxAt(488, 400)).toMatchObject({ y: 398, bottom: 403 });
    });

    it('the model reproduces both witnesses at 0 px, ON and OFF (the key moves no stepped body)', async () => {
        for (const [w, game] of [[BELOW, BELOW_GAME], [ABOVE, ABOVE_GAME]]) {
            for (const over of [TURRETSNAP_D1_SWITCHES, { turretSnapPricing: false }]) {
                const model = await turretCircleModelSamples(w.tape, over);
                expect(model.error).toBeNull();
                expect(compareTurretCircleWitness(game, model.samples)).toEqual([]);
            }
        }
    });

    it('the danger map at the boot (the turret not yet updated): OFF reads both strips backwards, ON reads them as the game', () => {
        for (const ticks of [0, 1, 2]) {
            const off = atBoot(BELOW.tape, ticks, (run) => ({ below: turretIds(run, 488, 440), above: turretIds(run, 488, 400) }));
            const on = withContactFidelity(TURRETSNAP_D1_SWITCHES, () => atBoot(BELOW.tape, ticks,
                (run) => ({ below: turretIds(run, 488, 440), above: turretIds(run, 488, 400) })));
            expect(off).toEqual({ below: [], above: [L40_TURRET] });
            expect(on).toEqual({ below: [L40_TURRET], above: [] });
        }
    });

    it('ON the volume is the cycle\'s hull with a why that says so; the run\'s turret is not moved by the read', () => {
        const read = (over) => withContactFidelity(over, () => atBoot(ABOVE.tape, 0, (run) => {
            const before = { ...run.entities('turrets').get(L40_TURRET) };
            const v = dangerVolumes(run, 0).filter((x) => x.id === L40_TURRET);
            const digest = run.stateDigest();
            dangerVolumes(run, 0);
            staticEnemyDanger(run, playerBoxAt(488, 440));
            const after = run.entities('turrets').get(L40_TURRET);
            return { v, same: before.x === after.x && before.y === after.y, digest: digest === run.stateDigest() };
        }));
        const off = read({ turretSnapPricing: false });
        const on = read(TURRETSNAP_D1_SWITCHES);
        expect(off.v.map((x) => x.rect)).toEqual([{ x: 472, y: 400, right: 504, bottom: 432, w: 32, h: 32 }]);
        expect(off.v[0].why).toBe('a static "Enemy" body');
        expect(on.v.map((x) => x.rect)).toEqual([{ x: 471.5, y: 407.5, w: 32.5, h: 32.5, right: 504, bottom: 440 }]);
        expect(on.v[0].why).toMatch(/the run's turret has not been on screen yet/);
        // ⚠ the digest carries the switch set, and the first read at t0 builds rosters in both arms (measured, the
        // base's behaviour), so the pin is: a read again moves nothing, and the turret stands where it stood
        expect({ on: [on.same, on.digest], off: [off.same, off.digest] }).toEqual({ on: [true, true], off: [true, true] });
    });

    it('a dead turret, a non-turret, and the key OFF: no live box (the caller keeps its own reading)', () => {
        withContactFidelity(TURRETSNAP_D1_SWITCHES, () => atBoot(ABOVE.tape, 0, (run) => {
            const inst = run.worldFor(40).combat.enemies.find((e) => `${e.tag}@${e.x},${e.y}` === L40_TURRET);
            expect(liveTurretContactRect(run, inst)?.rect).toEqual(iceTurretLiveContactCycle(488, 416).hull);
            expect(liveTurretContactRect(run, { ...inst, as3: 'Turret' })).toBeNull();
            withContactFidelity({ turretSnapPricing: false }, () => expect(liveTurretContactRect(run, inst)).toBeNull());
        }));
    });

    it('general for every IceTurret: L98\'s (already on a snap centre, a half-pixel cycle) and the generated corridor\'s (both axes snap)', () => {
        // L98 `iceturret@104,24`, ctor (120,40): the cycle passes through the ctor point
        expect(iceTurretLiveContactCycle(120, 40).points).toEqual([{ x: 119.5, y: 39.5 }, { x: 120, y: 40 }]);
        // ICEST's generated corridor `iceturret@64,16`, ctor (80,32): both axes snap 8 px on the first input
        const c = iceTurretLiveContactCycle(80, 32);
        expect(c.points).toEqual([{ x: 88, y: 40 }, { x: 87.5, y: 39.5 }]);
        expect(c.hull).toEqual({ x: 71.5, y: 23.5, w: 32.5, h: 32.5, right: 104, bottom: 56 });
    });
});
