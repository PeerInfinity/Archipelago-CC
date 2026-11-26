/**
 * ⛓⛓ SEEDLING FIDELITY RELEASETICK (wave 55) — a texted ceremony's finishing tick: the release frame's one unfrozen
 * update of the families that update after the pickup (`CONTACT_FIDELITY.freezeReleaseTick`, OFF byte-identical).
 *
 *     NPCs/NPC.as:207-214,250-263   the last page: `talking = false` lowers the flag; `FP.world.remove(this)` (deferred)
 *     Pickups/Pickup.as:57-60,95    the close C: `pick_up()` re-raises it (`myText` is still set)
 *     NPCs/NPC.as:71-85             `removed()` nulls the pickup's `myText` at C's end
 *     Pickups/Pickup.as:106-112     the release R: `!myText` → `Game.freezeObjects = false; removeSelf()`
 *     Game.as:2290-2297 / 2330-2351 the drill, turret, ice turret, beam tower are added BEFORE the pickups; addUpdate
 *                                   prepends, so on C they read the flag up and on R they read it DOWN
 *
 * The model's finishing tick stands for C and R. OFF each of the four was stepped once there, frozen, in its main slot
 * (C's update); ON the ceremony branch's finishing arm adds R's, unfrozen. Each observable leads by one tick ON.
 * The rope rock's player release step (the brief's second gap) needs no key: the pull frame is itself frozen for the
 * player, so the model's pull-tick step IS the game's release-frame step — game-witnessed below (Δ 0 after the cut).
 *
 * Every family row is STAGED (`.oel` rows appended to a cloned atlas level): no room the game ships holds a texted
 * ceremony beside one of the four. ⚠ Not game-witnessed: every ON family row (the pieces are the AS3 lines above and
 * the families' own transcriptions). Report: `CC/docs/cloud-reports/seedling-fidelity-releasetick.md`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { ROCKBUTTON_WITNESS_DIR } from './fidelityRockButton.js';

const KEY = 'freezeReleaseTick';
const ALL = { freezeEdgeFrames: true, frozenTickUngated: true, pickupTickFreeze: true, dialogueFrameFreeze: true,
    turretSuitRetaliation: true };
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const TEXTED = (x, y) => ({ type: 'feather', x, y, attrs: { tag: '5' } });
const TEXTLESS = (x, y) => ({ type: 'bosskey', x, y, attrs: { keyType: '1' } });
const TOWER = { type: 'beamtower', x: 112, y: 40, attrs: { direction: '0', rate: '1', speed: '1' } };

function stagedSource(level, inject, remove) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/**
 * Boot on the pickup, tap the talk key (press, release) from tick 10 until the dialogue closes, run `after` more
 * ticks. Per tick from the close: the tower's trace rows, the turrets, the drills. Plus the ledgers, or the throw.
 */
function stage({ level, x, y, inject = [], remove = [], after = 40 }, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({ levelSource: stagedSource(level, inject, remove), boot: { level, x, y },
            roles: ROLES, pins: ['sound', 'dead_frames'] });
        const rows = [];
        let thrown = null;
        let closeT = null;
        let left = -1;
        try {
            for (let k = 0; k < 400 && left !== 0; k += 1) {
                const before = run.collected.length;
                run.advance(new Set(k > 8 && k % 2 === 1 ? ['primary'] : []));
                if (run.collected.length > before && closeT === null) {
                    closeT = k + 1;
                    left = after;
                } else if (left > 0) left -= 1;
                if (closeT !== null) {
                    rows.push({ t: k + 1,
                        beam: run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen),
                        turrets: [...run.shooters.values()].map((s) => [s.id, s.shootTimer, s.anim]),
                        drills: run.drills.bodies.map((d) => [d.id, d.x, d.y, d.anim]) });
                }
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown, closeT, rows,
            beams: run.beamTowerTrace.filter((r) => r.beam && r.t > (closeT ?? 0)).map((r) => r.t).slice(0, 2),
            volleys: run.volleys.map((v) => v.t),
            spits: run.spitEvents.filter((e) => e.what === 'spawn').map((e) => [e.t, e.id]),
            hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
            hops: run.drills.events.filter((e) => e.kind === 'hop').map((e) => [e.t, e.id]),
        };
    });
}
const atClose = (r) => r.rows[0];

describe('RELEASETICK — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FREEZE_RELEASE_TICK)(
        'ships OFF, appended last, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FREEZE_RELEASE_TICK');
        });
});

describe('RELEASETICK — the four families through a texted ceremony (staged)', () => {
    it('beam tower (L29 + a tower, a feather underfoot): C steps it frozen; ON R unfrozen too, the beam a tick early', () => {
        const s = { level: 29, x: 144, y: 48, inject: [TOWER, TEXTED(144, 48)] };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect([off.closeT, on.closeT]).toEqual([23, 23]);
        expect(atClose(off).beam).toEqual([true]);
        expect(atClose(on).beam).toEqual([true, false]);
        expect(off.rows[1].beam).toEqual([false]);
        expect(on.rows[1].beam).toEqual([false]);
        expect(off.beams).toEqual([25, 26]);
        expect(on.beams).toEqual([24, 25]);
    });
    it('turret (L29, a feather in range): ON R counts one shootTimer, and the next spit leaves a tick early', () => {
        const s = { level: 29, x: 128, y: 168, inject: [TEXTED(128, 168)], after: 60 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(atClose(off).turrets).toEqual([['turret@80,176', 40, ''], ['turret@128,192', 40, ''],
            ['turret@112,240', 40, '']]);
        expect(atClose(on).turrets).toEqual([['turret@80,176', 39, ''], ['turret@128,192', 39, ''],
            ['turret@112,240', 40, '']]);
        expect(off.spits.filter(([t]) => t > 23)).toEqual([[70, 'turret@128,192#2'], [70, 'turret@80,176#2']]);
        expect(on.spits.filter(([t]) => t > 23)).toEqual([[69, 'turret@128,192#2'], [69, 'turret@80,176#2']]);
        expect(off.hits).toEqual([[77, 'spit', 'turret@128,192#2']]);
        expect(on.hits).toEqual([[76, 'spit', 'turret@128,192#2']]);
    });
    it('ice turret (L59, its turret swapped out): ON its volley leaves a tick early', () => {
        const s = { level: 59, x: 144, y: 48, remove: ['turret'],
            inject: [{ type: 'iceturret', x: 144, y: 72 }, TEXTED(144, 48)] };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.volleys).toEqual([4, 52]);
        expect(on.volleys).toEqual([4, 51]);
    });
    it('drill (L59, wave 51\'s T freeze ON so it is idle at the close): ON it hops on R, OFF a tick later', () => {
        const s = { level: 59, x: 144, y: 48, remove: ['turret'],
            inject: [{ type: 'drill', x: 120, y: 64 }, TEXTED(144, 48)] };
        const off = stage(s, { pickupTickFreeze: true, [KEY]: false });
        const on = stage(s, { pickupTickFreeze: true, [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(atClose(off).drills).toEqual([['drill@120,64', 128, 72, 'sit']]);
        expect(atClose(on).drills).toEqual([['drill@120,64', 144, 56, 'drill']]);
        expect(off.hops.filter(([t]) => t >= 23)).toEqual([[24, 'drill@120,64']]);
        expect(on.hops.filter(([t]) => t >= 23)).toEqual([[23, 'drill@120,64']]);
        expect(off.rows[1]).toEqual({ ...on.rows[1] });
    });
});

describe('RELEASETICK — composition (waves 50 to 54 ON underneath)', () => {
    it('every family leads by one tick with all five ON, and nothing refuses', () => {
        const tower = { level: 29, x: 144, y: 48, inject: [TOWER, TEXTED(144, 48)] };
        const turret = { level: 29, x: 128, y: 168, inject: [TEXTED(128, 168)], after: 70 };
        const ice = { level: 59, x: 144, y: 48, remove: ['turret'],
            inject: [{ type: 'iceturret', x: 144, y: 72 }, TEXTED(144, 48)], after: 60 };
        const drill = { level: 59, x: 144, y: 48, remove: ['turret'],
            inject: [{ type: 'drill', x: 120, y: 64 }, TEXTED(144, 48)] };
        const [t0, t1] = [stage(tower, { ...ALL, [KEY]: false }), stage(tower, { ...ALL, [KEY]: true })];
        const [u0, u1] = [stage(turret, { ...ALL, [KEY]: false }), stage(turret, { ...ALL, [KEY]: true })];
        const [i0, i1] = [stage(ice, { ...ALL, [KEY]: false }), stage(ice, { ...ALL, [KEY]: true })];
        const [d0, d1] = [stage(drill, { ...ALL, [KEY]: false }), stage(drill, { ...ALL, [KEY]: true })];
        for (const r of [t0, t1, u0, u1, i0, i1, d0, d1]) expect(r.thrown).toBe(null);
        // the tower: `freezeEdgeFrames` skips the main slot on the hold ticks; the finishing tick keeps C's step
        expect([atClose(t0).beam, atClose(t1).beam]).toEqual([[true], [true, false]]);
        expect([t0.beams, t1.beams]).toEqual([[33, 34], [32, 33]]);
        // the turrets: wave 51's T freeze leaves them idle; ON R starts the shot
        expect(atClose(u0).turrets[0]).toEqual(['turret@80,176', 0, '']);
        expect(atClose(u1).turrets[0]).toEqual(['turret@80,176', 40, 'startshot']);
        expect(u0.spits.slice(0, 2).map(([t]) => t)).toEqual([30, 30]);
        expect(u1.spits.slice(0, 2).map(([t]) => t)).toEqual([29, 29]);
        expect([i0.volleys, i1.volleys]).toEqual([[27, 72], [26, 71]]);
        expect([d0.hops.filter(([t]) => t >= 23), d1.hops.filter(([t]) => t >= 23)])
            .toEqual([[[24, 'drill@120,64']], [[23, 'drill@120,64']]]);
    });
    it('wave 50\'s slot (`turretSuitRetaliation`): the contact on R is billed once, on the finishing tick, ON', () => {
        // booted in `turret@128,192`'s contact box with the pickup underfoot (wave 51's T freeze ON: T bills nothing)
        const s = { level: 29, x: 128, y: 182, inject: [TEXTED(128, 182)], after: 10 };
        const slotOff = stage(s, { pickupTickFreeze: true, turretSuitRetaliation: true, [KEY]: false });
        const slotOn = stage(s, { pickupTickFreeze: true, turretSuitRetaliation: true, [KEY]: true });
        const scanOff = stage(s, { pickupTickFreeze: true, [KEY]: false });
        const scanOn = stage(s, { pickupTickFreeze: true, [KEY]: true });
        for (const r of [slotOff, slotOn, scanOff, scanOn]) expect(r.thrown).toBe(null);
        // OFF the finishing tick's slot step is frozen: the slot bills a tick late
        expect(slotOff.hits).toEqual([[24, 'enemy', 'turret@128,192']]);
        // ON R's slot step bills it where the static scan does
        expect(slotOn.hits).toEqual([[23, 'enemy', 'turret@128,192']]);
        expect(scanOff.hits).toEqual([[23, 'enemy', 'turret@128,192']]);
        expect(scanOn.hits).toEqual([[23, 'enemy', 'turret@128,192']]);
        // and with all five ON
        expect(stage(s, { ...ALL, [KEY]: true }).hits).toEqual([[23, 'enemy', 'turret@128,192']]);
    });
});

describe('RELEASETICK — where it changes nothing', () => {
    it('a text-less pickup (L29\'s green key in the turrets\' range): ON = OFF, the whole result, waves 51 and 53 ON or OFF', () => {
        const s = { level: 29, x: 128, y: 168, inject: [TEXTLESS(128, 168)], after: 30 };
        for (const under of [{}, { pickupTickFreeze: true }, ALL]) {
            const off = stage(s, { ...under, [KEY]: false });
            expect(off.thrown).toBe(null);
            expect(stage(s, { ...under, [KEY]: true })).toEqual(off);
        }
    });
    it('no freeze (L29 as shipped, idle): ON = OFF, the whole result', () => {
        const run = (over) => withContactFidelity(over, () => {
            const r = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 29, x: 128, y: 168 },
                roles: ROLES, pins: ['sound', 'dead_frames'] });
            const out = [];
            for (let k = 0; k < 80; k += 1) {
                r.advance(new Set());
                out.push([r.state.x, r.state.y, [...r.shooters.values()].map((s) => [s.id, s.shootTimer, s.anim])]);
            }
            return { out, hits: r.ledger('playerHits'), spits: r.spitEvents };
        });
        expect(run({ [KEY]: true })).toEqual(run({ [KEY]: false }));
    });
});

describe('RELEASETICK — the rope rock\'s release frame (game-witnessed: no key needed)', () => {
    // `rockbutton-l28-livefall`: a sword cut of `rope@…` at t155, the player mid-motion. `fall()` runs inside
    // `Player.update` above `super.update()`, so the game's player takes no step on the pull frame and one on the
    // release frame: the model's pull-tick step. A banked `pendingFreeSteps` there would be a second step.
    const fixture = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8'));
    const game = new Map(fixture.samples.map((s) => [s.t, s]));
    const replay = (over) => withContactFidelity(over, () => {
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(fixture.tape)), {
            levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; },
        });
        const stream = [];
        let r = st.next();
        while (!r.done) {
            if (run) stream.push([run.state.x, run.state.y]);
            r = st.next();
        }
        return { stream, falls: run.rockFalls.map((f) => [f.t, f.id, f.deadFrames]) };
    });
    it('the model\'s player matches the game\'s exactly through and after the cut, ON and OFF alike', () => {
        const off = replay({ [KEY]: false });
        const on = replay({ [KEY]: true, freezeEdgeFrames: true });
        expect(off.falls).toEqual([[155, 'fallrock@112,240', 181]]);
        expect(on).toEqual(off);
        // stream index i is the observation the game samples as t = i (the boot is sample 0)
        for (let t = 150; t < off.stream.length; t += 1) {
            const g = game.get(t);
            if (!g) continue;
            expect(off.stream[t], `t${t}`).toEqual([g.x, g.y]);
        }
        expect(off.stream[156]).toEqual([142.7294055666542, 55.32346101971778]);
    });
});
