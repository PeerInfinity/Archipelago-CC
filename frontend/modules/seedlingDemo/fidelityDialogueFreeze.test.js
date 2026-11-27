/**
 * ⛓ SEEDLING FIDELITY DIALOGUEFREEZE (wave 52) — a dialogue's later frames freeze the families that update after the
 * NPC (`CONTACT_FIDELITY.dialogueFrameFreeze`, OFF).
 *
 *     Game.as:2290-2297   add(Drill) … add(Turret) add(IceTurret) add(BeamTower)   ← BEFORE every NPC (:2389-2406)
 *     World.as:937-947    addUpdate PREPENDS                                        ← so the NPC updates FIRST
 *     NPC.as:128-132      update(): super.update(); talk();
 *     NPC.as:193-195      if (talking) Game.freezeObjects = true                    ← not on the startTalking() frame
 *     NPC.as:207-214      pages out → talking = false → the setter lowers it (:253-255)   ← the closing frame
 *     Game.as:1044-1050   !canInventory() → inventory.open = false                  ← lowered at every frame's tail
 *
 * Every dialogue frame is a LIVE tape tick. OFF the model stepped the four UNFROZEN on each of them (a dialogue is
 * not a ceremony), then `runFrozenTick` stepped the beam tower a second time. ON the arms' answer is predicted before
 * the four step: the drill, the ice turret and the turret step frozen, and the beam tower's main slot does not step.
 * Report: `CC/docs/cloud-reports/seedling-fidelity-dialoguefreeze.md`.
 *
 * Every family row is STAGED (`.oel` rows appended to a cloned atlas level): the only texted dialogue the game ships
 * beside one of the four is L88's introchar, and its drill never has the player in sight from the talk circle
 * (the last row pins that room as shipped). L88: boot (56,112), X held at tick 1 (released at 2: the start frame),
 * then every 8 ticks; frames 3..33 are the frozen ones and tick 34 closes the dialogue (`talkerTalks` t 35).
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const KEY = 'dialogueFrameFreeze';
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const TOWER = (x, y) => ({ type: 'beamtower', x, y, attrs: { direction: '0', rate: '1', speed: '1' } });

function stagedSource(level, inject, remove) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/** Boot, release X on the schedule `press(k)`, `ticks` ticks; the whole observable result per tick (or the throw). */
function stage({ level = 88, x = 56, y = 112, inject = [], remove = ['drill'], ticks = 70,
    press = (k) => k >= 1 && k < 40 && (k - 1) % 8 === 0 }, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({
            levelSource: stagedSource(level, inject, level === 88 ? remove : []), boot: { level, x, y },
            pins: ['sound', 'dead_frames'], roles: ROLES,
        });
        let thrown = null;
        const frames = [];
        try {
            for (let k = 0; k < ticks; k += 1) {
                const a = run.advance(new Set(press(k) ? ['primary'] : []));
                frames.push({
                    frozen: a.frozen === true,
                    drills: run.drills.bodies.map((d) => [d.x, d.y, d.anim]),
                    turrets: run.shooters.map((s) => [s.shootTimer, s.anim]),
                    beam: run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen),
                });
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown,
            frames,
            hits: run.ledger('playerHits').map((h) => [h.t, h.source]),
            spawns: run.ledger('spitEvents').filter((s) => s.what === 'spawn').map((s) => s.t),
            volleys: run.volleys.map((v) => v.t),
            talks: run.talkerTalks.map((t) => t.t),
            watcherTalks: run.watcherTalks.map((t) => t.t),
        };
    });
}
const frozenAt = (r) => r.frames.map((f) => f.frozen);

describe('DIALOGUEFREEZE — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_DIALOGUE_FRAME_FREEZE)(
        'ships OFF, followed only by wave 53\'s key, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ fidelity FROZENTICK D2 (wave 53): its key is appended after this one.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['frozenTickUngated', 'freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame', 'itemPressHeldBySlash', 'drillSightLineGame', 'wandShotKill']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DIALOGUE_FRAME_FREEZE');
        });
});

describe('DIALOGUEFREEZE — the turret (L88, `turret@0,104` beside the introchar)', () => {
    const s = { inject: [{ type: 'turret', x: 0, y: 104 }], ticks: 90 };
    it('OFF the timer runs on the middle frames; ON it holds until the closing frame, and the next spit moves', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        // the dialogue: start frame 2 (live), frozen 3..33, closed on tick 34 — the same both ways
        expect(frozenAt(on)).toEqual(frozenAt(off));
        expect(frozenAt(off).indexOf(true)).toBe(3);
        expect(frozenAt(off).lastIndexOf(true)).toBe(33);
        expect(off.talks).toEqual([35]);
        // the start frame: ON = OFF
        expect(on.frames.slice(0, 3)).toEqual(off.frames.slice(0, 3));
        // a middle frame: OFF the timer counts down, ON it is frozen at 40
        expect(off.frames[14].turrets).toEqual([[39, '']]);
        expect(on.frames[14].turrets).toEqual([[40, '']]);
        expect(on.frames[33].turrets).toEqual([[40, '']]);
        // the closing frame is unfrozen: ON the timer moves on it
        expect(on.frames[34].turrets).toEqual([[39, '']]);
        // the shot already in the barrel leaves on schedule (the graphic runs); the next one moves by the frozen count
        expect(off.spawns).toEqual([7, 61]);
        expect(on.spawns).toEqual([7, 81]);
    });
});

describe('DIALOGUEFREEZE — the lump-less families (L88, staged)', () => {
    it('ice turret (`iceturret@0,104`): OFF the second volley at t49, ON at t63', () => {
        const s = { inject: [{ type: 'iceturret', x: 0, y: 104 }], ticks: 90 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.volleys).toEqual([4, 49]);
        expect(on.volleys).toEqual([4, 63]);
    });
    it('drill on the player (`drill@56,112`): OFF a contact billed mid-dialogue (t21); ON the next is the closing frame', () => {
        const s = { inject: [{ type: 'drill', x: 56, y: 112 }], ticks: 60 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.hits).toEqual([[1, 'drill'], [21, 'drill'], [41, 'drill'], [42, 'drill']]);
        expect(on.hits).toEqual([[1, 'drill'], [35, 'drill'], [55, 'drill'], [56, 'drill']]);
    });
    it('drill in sight (`drill@88,88`): OFF it hops on frame 15; ON it sits until the dialogue closes', () => {
        const s = { inject: [{ type: 'drill', x: 88, y: 88 }] };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.frames[14].drills).toEqual([[96, 112, 'sit']]);
        expect(off.frames[15].drills).toEqual([[80, 112, 'drill']]);
        expect(on.frames.slice(14, 34).every((f) => JSON.stringify(f.drills) === '[[96,112,"sit"]]')).toBe(true);
        const hop = on.frames.findIndex((f) => f.drills[0][0] !== 96);
        expect(hop).toBeGreaterThanOrEqual(34);
    });
    it('beam tower (`beamtower@0,104`): OFF two steps per frozen tick, ON one (the frozen tick\'s, after the NPC)', () => {
        const s = { inject: [TOWER(0, 104)], ticks: 40 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        for (const k of [3, 14, 33]) {
            expect(off.frames[k].beam).toEqual([false, true]);
            expect(on.frames[k].beam).toEqual([true]);
        }
        // the start frame and the closing frame: one unfrozen step, ON = OFF
        for (const k of [2, 34]) {
            expect(off.frames[k].beam).toEqual([false]);
            expect(on.frames[k].beam).toEqual([false]);
        }
    });
});

describe('DIALOGUEFREEZE — a watcher (L114, `turret@72,128` staged; the watcher talks on proximity)', () => {
    it('OFF the turret fires through the 237-tick dialogue; ON it holds until the dialogue closes', () => {
        const s = { level: 114, x: 72, y: 96, inject: [{ type: 'turret', x: 72, y: 128 }], ticks: 400,
            press: (k) => k % 6 === 1 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(frozenAt(on)).toEqual(frozenAt(off));
        expect(off.watcherTalks).toEqual([237]);
        expect(on.watcherTalks).toEqual([237]);
        expect(off.spawns).toEqual([7, 61, 115, 169, 223, 244, 298, 352]);
        expect(on.spawns).toEqual([7, 283, 337, 391]);
    });
});

describe('DIALOGUEFREEZE — with wave 50\'s slot contact (`turretSuitRetaliation`), `turret@56,120` on the player', () => {
    const s = { inject: [{ type: 'turret', x: 56, y: 120 }] };
    it('OFF wave 50 refuses the dialogue tick by name; ON the frozen slot bills nothing and nothing refuses', () => {
        const off = stage(s, { turretSuitRetaliation: true, [KEY]: false });
        expect(off.thrown).toMatch(/contact was answered in its own slot at tick 4 in level 88, and the same tick then froze \(a placed NPC's dialogue\)/);
        const on = stage(s, { turretSuitRetaliation: true, [KEY]: true });
        expect(on.thrown).toBe(null);
        expect(on.hits).toEqual([[1, 'enemy'], [35, 'enemy'], [55, 'enemy'], [56, 'enemy']]);
        // the same contacts as the static scan bills without wave 50's key
        expect(stage(s, { [KEY]: true }).hits).toEqual(on.hits);
    });
});

describe('DIALOGUEFREEZE — with wave 51\'s `pickupTickFreeze`', () => {
    it('a dialogue: both ON = this key ON alone, the whole result', () => {
        const s = { inject: [{ type: 'turret', x: 0, y: 104 }], ticks: 90 };
        expect(stage(s, { [KEY]: true, pickupTickFreeze: true })).toEqual(stage(s, { [KEY]: true }));
    });
    it('a pickup (L29, a text-less green key underfoot at boot): both ON = `pickupTickFreeze` ON alone', () => {
        const s = { level: 29, x: 128, y: 168, inject: [{ type: 'bosskey', x: 128, y: 168, attrs: { keyType: '1' } }],
            ticks: 80, press: () => false };
        const pickupOnly = stage(s, { pickupTickFreeze: true });
        expect(pickupOnly.thrown).toBe(null);
        expect(stage(s, { [KEY]: true, pickupTickFreeze: true })).toEqual(pickupOnly);
    });
});

describe('DIALOGUEFREEZE — no dialogue, and the room as shipped', () => {
    it('no X released (L88, a staged turret and tower): ON = OFF, the whole result', () => {
        const s = { inject: [{ type: 'turret', x: 0, y: 104 }, TOWER(16, 152)], ticks: 90, press: () => false };
        const off = stage(s, { [KEY]: false });
        expect(off.talks).toEqual([]);
        expect(stage(s, { [KEY]: true })).toEqual(off);
    });
    it('L88 as shipped (`introchar@56,104`, `drill@128,160` out of sight): the dialogue runs, ON = OFF', () => {
        const s = { remove: [], ticks: 50 };
        const off = stage(s, { [KEY]: false });
        expect(off.thrown).toBe(null);
        expect(off.talks).toEqual([35]);
        expect(off.frames.every((f) => JSON.stringify(f.drills) === '[[136,168,"sit"]]')).toBe(true);
        expect(stage(s, { [KEY]: true })).toEqual(off);
    });
});
