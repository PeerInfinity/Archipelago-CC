/**
 * ⛓ SEEDLING FIDELITY PICKUPFREEZE (wave 51) — a pickup's first frame freezes the families that update after it
 * (`CONTACT_FIDELITY.pickupTickFreeze`, OFF).
 *
 *     Game.as:2290-2297   add(Drill) … add(Turret) add(IceTurret) add(BeamTower)   ← BEFORE every pickup (:2330-2351)
 *     World.as:937-947    addUpdate PREPENDS                                        ← so the pickup updates FIRST
 *     Pickup.as:78-95     collide("Player") → pick_up(): if (special) Game.freezeObjects = true
 *     Turret.as:48        if (Game.freezeObjects || …) return;   (IceTurret.as:58, BeamTower.as:54, Drill.as:54 alike)
 *     Pickup.as:106-112   specialTimer 0 and no text: Game.freezeObjects = false; removeSelf()   ← frame F+150
 *
 * The model's collecting tick T stands for frames F..F+150 (`Bot.as:3201` gates at frame start). OFF it stepped the
 * four UNFROZEN on T, above the detection. ON the touch is predicted before them: a turret is frozen on T and its
 * lump ends in an UNFROZEN release frame for a text-less pickup; a lump-less family (ice turret, beam tower, drill) is
 * frozen on T for a texted pickup and left as the release frame for a text-less one.
 * Report: `CC/docs/cloud-reports/seedling-fidelity-pickupfreeze.md`.
 *
 * Every row STAGES its pickup: no room the game ships holds a texted pickup beside one of the four, and L29's own green
 * key stands out of every turret's range. The staging appends `.oel` entity rows to a cloned atlas level.
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const KEY = 'pickupTickFreeze';
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const BODY = 'turret@128,192';
const TEXTLESS = (x, y) => ({ type: 'bosskey', x, y, attrs: { keyType: '1' } });
const TEXTED = (x, y) => ({ type: 'feather', x, y, attrs: { tag: '5' } });

function stagedSource(level, inject, remove = []) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/** Boot, idle `idle` ticks, then hold `keys`; the whole observable result (or the throw). */
function stage({ level = 29, x = 128, y = 168, inject = [], remove = [], idle = 0, keys = [], ticks = 80, health = 0 },
    over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({
            levelSource: stagedSource(level, inject, remove), boot: { level, x, y }, pins: ['sound', 'dead_frames'],
            roles: ROLES, ...(health > 0 ? { grants: [{ level, items: Array(health).fill('health') }] } : {}),
        });
        let thrown = null;
        const turretAt1 = [];
        const drillAt1 = [];
        try {
            for (let k = 0; k < ticks; k += 1) {
                run.advance(new Set(k < idle ? [] : keys));
                if (k === 0) {
                    for (const s of run.shooters) turretAt1.push([s.id, s.shootTimer, s.anim]);
                    for (const d of run.drills.bodies) drillAt1.push([d.id, d.x, d.y, d.anim]);
                }
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown,
            starts: run.ceremonyStarts.map((s) => [s.t, s.tag]),
            hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
            spawns: run.ledger('spitEvents').filter((s) => s.what === 'spawn').map((s) => [s.t, s.id]),
            volleys: run.volleys.map((v) => v.t),
            beamAt1: run.beamTowerTrace.filter((r) => r.t === 1).map((r) => r.frozen),
            turretAt1,
            drillAt1,
        };
    });
}
const mine = (r) => r.spawns.filter(([, id]) => id.startsWith(`${BODY}#`)).map(([t]) => t);

describe('PICKUPFREEZE — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_PICKUP_TICK_FREEZE)(
        'ships OFF, appended after turretSuitRetaliation, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 52: DIALOGUEFREEZE `dialogueFrameFreeze` was appended after this key.
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['dialogueFrameFreeze', 'frozenTickUngated', 'freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze', 'chestCoverFencepost']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PICKUP_TICK_FREEZE');
        });
});

describe('PICKUPFREEZE — the turrets (L29, a pickup underfoot at boot, the turrets in range)', () => {
    it('text-less (a green key): OFF the shot starts on T; ON it starts on the release frame and leaves at t7', () => {
        const s = { inject: [TEXTLESS(128, 168)] };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect(off.thrown).toBe(null);
        expect(on.thrown).toBe(null);
        expect(off.starts).toEqual([[0, 'bosskey']]);
        expect(on.starts).toEqual([[0, 'bosskey']]);
        // OFF: T's unfrozen step started the shot, so the spit left inside the lump (stamped T+1) and the anim is over
        expect(mine(off)).toEqual([1, 48]);
        expect(off.turretAt1.find(([id]) => id === BODY)).toEqual([BODY, 40, '']);
        // ON: frozen on T and for the lump; the release frame starts the shot (the spit leaves six updates later)
        expect(mine(on)).toEqual([7, 61]);
        expect(on.turretAt1.find(([id]) => id === BODY)).toEqual([BODY, 40, 'startshot']);
        // the spit timeline moves the spit's hit on the idle player with it
        expect(off.hits).toEqual([[55, 'spit', `${BODY}#2`]]);
        expect(on.hits).toEqual([[68, 'spit', `${BODY}#2`]]);
    });
    it('texted (a feather): OFF the shot starts on T; ON no turret updates while the dialogue is up', () => {
        const s = { inject: [TEXTED(128, 168)], ticks: 60 };
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect(off.thrown).toBe(null);
        expect(on.thrown).toBe(null);
        expect(on.starts).toEqual([[0, 'feather']]);
        expect(mine(off)).toEqual([1]);
        expect(mine(on)).toEqual([]);
        expect(on.turretAt1.find(([id]) => id === BODY)).toEqual([BODY, 0, '']);
    });
});

describe('PICKUPFREEZE — the lump-less families (L59, its turret swapped out)', () => {
    const at = (inject) => ({ level: 59, x: 144, y: 48, inject, remove: ['turret'], ticks: 30 });
    it('ice turret, texted: OFF a volley starts on T and leaves at t4; ON none while the dialogue is up', () => {
        const s = at([{ type: 'iceturret', x: 144, y: 72 }, TEXTED(144, 48)]);
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.volleys).toEqual([4]);
        expect(on.volleys).toEqual([]);
    });
    it('ice turret, text-less: ON = OFF (T\'s one unfrozen step stands for the release frame)', () => {
        const s = at([{ type: 'iceturret', x: 144, y: 72 }, TEXTLESS(144, 48)]);
        const off = stage(s, { [KEY]: false });
        expect(off.volleys).toEqual([4]);
        expect(stage(s, { [KEY]: true })).toEqual(off);
    });
    it('drill, texted: OFF it hops toward the player on T; ON it sits', () => {
        const s = at([{ type: 'drill', x: 120, y: 64 }, TEXTED(144, 48)]);
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.drillAt1).toEqual([['drill@120,64', 144, 56, 'drill']]);
        expect(on.drillAt1).toEqual([['drill@120,64', 128, 72, 'sit']]);
    });
    // ⛓ fidelity FROZENTICK D2 (wave 53): ON the main slot skips the tower on a texted T; `runFrozenTick`'s frozen step
    // is the frame's one update (wave 51 pinned `[true, true]`: two updates for one frame).
    it('beam tower, texted: ON the tower steps ONCE on T, frozen (`runFrozenTick`\'s step; the main slot skips)', () => {
        const s = at([{ type: 'beamtower', x: 112, y: 40, attrs: { direction: '0', rate: '1', speed: '1' } },
            TEXTED(144, 48)]);
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.beamAt1).toEqual([false, true]);
        expect(on.beamAt1).toEqual([true]);
    });
});

describe('PICKUPFREEZE — with wave 50\'s slot contact (`turretSuitRetaliation`)', () => {
    // booted where the held-`down` walk meets `turret@128,192`, with the pickup underfoot: touch and contact on T
    const at = (pickup) => ({ x: 128, y: 182, inject: [pickup(128, 182)], ticks: 20 });
    it('texted: the slot bills and wave 50 refuses by name OFF; ON the slot bills nothing and nothing refuses', () => {
        const off = stage(at(TEXTED), { turretSuitRetaliation: true, [KEY]: false });
        expect(off.thrown).toMatch(/contact was answered in its own slot at tick 1 in level 29, and the same tick then froze \(a pickup ceremony\)/);
        expect(off.thrown).toMatch(/fidelity TURRETSUIT/);
        const on = stage(at(TEXTED), { turretSuitRetaliation: true, [KEY]: true });
        expect(on.thrown).toBe(null);
        expect(on.hits).toEqual([]);
        expect(on.spawns).toEqual([]);
    });
    it('text-less: the contact is billed once, on T — ON from the release frame, after the frozen lump', () => {
        const off = stage(at(TEXTLESS), { turretSuitRetaliation: true, [KEY]: false });
        const on = stage(at(TEXTLESS), { turretSuitRetaliation: true, [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(off.hits).toEqual([[1, 'enemy', BODY]]);
        expect(on.hits).toEqual([[1, 'enemy', BODY]]);
        expect(mine(off)).toEqual([1]);
        expect(mine(on)).toEqual([7]);
        // and without wave 50's key the static scan bills it as before, ON and OFF alike
        expect(stage(at(TEXTLESS), { [KEY]: true }).hits).toEqual([[1, 'enemy', BODY]]);
    });
});

describe('PICKUPFREEZE — a dialogue\'s first frame is not a freeze', () => {
    // `NPC.talk` sets `Game.freezeObjects` only inside `if (talking)`, which is false on the frame `startTalking` runs
    it('L88 (`introchar@56,104` beside `drill@128,160`): the dialogue starts, ON = OFF, the whole result', () => {
        const s = { level: 88, x: 56, y: 112, idle: 1, keys: ['primary'], ticks: 12 };
        const off = stage({ ...s, keys: [] }, { [KEY]: false });
        const talk = (on) => withContactFidelity({ [KEY]: on }, () => {
            const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level: 88, x: s.x, y: s.y }, roles: ROLES });
            return Array.from({ length: s.ticks }, (_, k) => {
                const a = run.advance(new Set(k === 1 ? ['primary'] : []));
                return [a.frozen === true, ...run.drills.bodies.map((d) => [d.x, d.y, d.anim])];
            });
        });
        expect(off.thrown).toBe(null);
        const offTalk = talk(false);
        expect(offTalk.findIndex(([frozen]) => frozen)).toBe(3);
        expect(talk(true)).toEqual(offTalk);
    });
});

describe('PICKUPFREEZE — no pickup touched', () => {
    it('ON = OFF, the whole result (wave 50\'s held-`down` walk into the turret, and a no-pickup ice turret room)', () => {
        for (const s of [
            { keys: ['down'], idle: 1, ticks: 120, health: 6 },
            { level: 59, x: 144, y: 48, inject: [{ type: 'iceturret', x: 144, y: 72 }], remove: ['turret'], ticks: 60 },
        ]) {
            const off = stage(s, { [KEY]: false });
            expect(stage(s, { [KEY]: true })).toEqual(off);
        }
    });
});
