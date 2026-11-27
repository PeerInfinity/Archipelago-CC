/**
 * ⛓ SEEDLING FIDELITY WANDSWINGDRILL (wave 70) — the two model errors wave 68 measured outside its key, each behind
 * its own OFF key:
 *   · `itemPressHeldBySlash` — a LONE wand or fire press while `_slashing` holds is dropped (`set wanding` /
 *     `set firing`'s `!slashing`, `Player.as:834` / `:858`; `slashEnd` fires below `input()`);
 *   · `drillSightLineGame` — on a world's first tick a drill's `collideLine("Solid", …)` sees no tile (a Tile writes its
 *     "Solid" type in its own first `update()`, `Scenery/Tile.as:117-121`, after the drills have updated).
 * The witnesses are the GAME's rows (p4g, `fixtures/wandswingdrill-witness/`, recorded by
 * `scripts/procgen/probe-seedling-wandswingdrill.mjs`), replayed here against the model: ON is the game at every
 * sampled tick (the player at 0 px, every WandShot, the six enemy classes' bodies); OFF is the shipped model.
 * The every-committed-tape ON vs OFF measurement is `fidelityWandSwingDrill.slow.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { slashEndTicksFor } from './ghostSword.js';
import { WAND_WINDOW } from './wandVerb.js';
import { CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    GAP_KEY, WAND_SWING_DRILL_TAPES, clockOk, disagreements, modelWandEnemySamples, wandSwingDrillSwitches,
    wandSwingDrillTape,
} from '../../../scripts/procgen/probe-seedling-wandswingdrill.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ITEM = 'itemPressHeldBySlash';
const DRILL = 'drillSightLineGame';
const DIR = join(HERE, 'fixtures', 'wandswingdrill-witness');
const WITNESSES = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')))
    .sort((a, b) => a.name.localeCompare(b.name));
const byName = Object.fromEntries(WITNESSES.map((w) => [w.name, w]));
/** The witnesses whose OFF replay disagrees with the game (D1's GAP verdicts); the rest are NO GAP controls. */
const GAPS = new Set(['swing-wand-1', 'swing-wand-2', 'swing-wand-3', 'swing-wand-4', 'swing-wand-5', 'swing-wand-held',
    'swing-fire-2', 'c1-wand-87', 'c1-wand-88', 'c1-wand-89',
    'drill-l88-e', 'drill-l88-se', 'drill-l88-nw', 'drill-l91-e', 'drill-l91-w']);
/** The base's OFF tail (wave 68's tip): the last ten keys before this slice's, all OFF by default. */
const OFF_TAIL = ['plainPickupInFreeze', 'chestCoverFencepost', 'presserRecursionHang', 'publishedButtonRoomSetter',
    'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies',
    'wandShotEnemyBodies'];

const tapeOf = (w) => parseTape(JSON.stringify(w.tape));
const replay = async (w, over) => modelWandEnemySamples(tapeOf(w), over);
const firstShot = (samples) => samples.find((s) => s.shots.length > 0)?.t ?? null;
const drillAt = (w, t) => w.samples.find((s) => s.t === t)?.bodies.find((b) => b.cls === 'Drill') ?? null;

describe('fidelity WANDSWINGDRILL — the keys', () => {
    it('both ship OFF, appended last in this order, each with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[ITEM]).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS[DRILL]).toBe(false);
        // ⛓ wave 69 (DEADFRAME2) landed its three keys first; wave 71 (WANDKILL) appended its one after these.
        expect(CONTACT_FIDELITY_KEYS.slice(CONTACT_FIDELITY_KEYS.indexOf('wandShotEnemyBodies') + 1)).toEqual(['freezeFramesStepResponders', 'pulserDeadFrameUpdate', 'blockPressesFallRockButtonSameFrame', ITEM, DRILL, 'wandShotKill']);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_ITEM_PRESS_HELD_BY_SLASH');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DRILL_SIGHT_LINE_GAME');
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
        expect(GAP_KEY).toEqual({ 1: ITEM, 2: DRILL });
    });

    it('each env line is in contactFidelity.js, both arms', () => {
        const src = readFileSync(join(HERE, 'contactFidelity.js'), 'utf8');
        for (const [env, key] of [['SEEDLING_ITEM_PRESS_HELD_BY_SLASH', ITEM], ['SEEDLING_DRILL_SIGHT_LINE_GAME', DRILL]]) {
            expect(src).toContain(`env?.${env} === '1') CONTACT_FIDELITY.${key} = true;`);
            expect(src).toContain(`env?.${env} === '0') CONTACT_FIDELITY.${key} = false;`);
        }
    });
});

describe('fidelity WANDSWINGDRILL — the recordings', () => {
    it('every non-residue witness of the probe is recorded, on p4g and the delivered set, with the probe\'s own tape', () => {
        const want = Object.entries(WAND_SWING_DRILL_TAPES).filter(([, w]) => !w.residue).map(([n]) => n).sort();
        expect(WITNESSES.map((w) => w.name)).toEqual(want);
        for (const w of WITNESSES) {
            expect(w.page).toBe('seedling_bot_ap_p4g');
            expect(w.delivered_set).toBe('seedling-vanilla-record-23510f80');
            expect(w.tape).toEqual(wandSwingDrillTape(w.name));
            expect(w.samples.length).toBeGreaterThan(20);
        }
        expect(Object.entries(WAND_SWING_DRILL_TAPES).filter(([, w]) => w.residue).map(([n]) => n)).toEqual(['wand-walk']);
    });
});

describe('fidelity WANDSWINGDRILL — every witness: ON is the game, OFF is the shipped model', () => {
    for (const name of Object.keys(WAND_SWING_DRILL_TAPES).filter((n) => !WAND_SWING_DRILL_TAPES[n].residue)) {
        it(`${name}: ON (its gap's key) agrees with the game at every sampled tick`, async () => {
            const w = byName[name];
            const on = await replay(w, wandSwingDrillSwitches(name));
            expect(on.error).toBe(null);
            expect(disagreements(w.samples, on)).toEqual([]);
        }, 60000);
        it(`${name}: OFF ${GAPS.has(name) ? 'disagrees with the game (GAP)' : 'already agrees (NO GAP)'}`, async () => {
            const w = byName[name];
            const off = await replay(w, wandSwingDrillSwitches(name, { on: false }));
            expect(off.error).toBe(null);
            expect(disagreements(w.samples, off).length > 0).toBe(GAPS.has(name));
        }, 60000);
    }
});

describe('fidelity WANDSWINGDRILL — gap 1: the game\'s numbers', () => {
    const SWORD = 4;
    const swing = slashEndTicksFor('slash', 'sword');

    it('the swing holds the wand from its press through its slashEnd tick, and the next tick fires', () => {
        expect(swing).toBe(5);
        for (let k = 0; k <= 6; k += 1) {
            const w = byName[`swing-wand-${k}`];
            const shot = firstShot(w.samples);
            if (k >= 1 && k <= swing) expect(shot, `k ${k}`).toBe(null);
            else expect(shot, `k ${k}`).toBe(SWORD + k + WAND_WINDOW.fireTick + 1);
        }
    });

    it('a key held from inside the swing past its end fires nothing (an edge, not a buffer)', () => {
        const w = byName['swing-wand-held'];
        expect(w.tape.inputs.find((sp) => sp.key === 'primary')).toEqual({ key: 'primary', from: 6, to: 15 });
        expect(firstShot(w.samples)).toBe(null);
    });

    it('a fire press inside the swing is dropped: the sword pressed after the swing DASHES (OFF gates it)', async () => {
        const g = byName['swing-fire-2'];
        const ctl = byName['swing-fire-6'];
        const at = (w, t) => w.samples.find((s) => s.t === t).player.x;
        // the dash (+2) lands on 12's step; the control (fire at 10, after the swing) is refused the dash in the game too
        expect(at(g, 13) - at(ctl, 13)).toBeCloseTo(2, 9);
        const off = await replay(g, wandSwingDrillSwitches('swing-fire-2', { on: false }));
        expect(off.col[13].px).toBeCloseTo(at(ctl, 13), 9);
    });

    it('C1\'s L62 sword kill: the wand at 87, 88 or 89 fires nothing; OFF opens a window and stops on the turret', async () => {
        for (const t of [87, 88, 89]) {
            const w = byName[`c1-wand-${t}`];
            expect(firstShot(w.samples)).toBe(null);
            const off = await replay(w, wandSwingDrillSwitches(`c1-wand-${t}`, { on: false }));
            const shots = off.col.flatMap((c, i) => (c?.shots ?? []).map((s) => ({ i, ...s })));
            expect(shots[0]).toMatchObject({ i: t + WAND_WINDOW.fireTick + 1, x: 236, y: 255 });
        }
    });

    it('the converse is already modelled: the sword during a wand window is refused in both', async () => {
        const w = byName['wand-swing-2'];
        const off = await replay(w, {});
        expect(disagreements(w.samples, off)).toEqual([]);
        expect(firstShot(w.samples)).toBe(4 + WAND_WINDOW.fireTick + 1);
    });
});

describe('fidelity WANDSWINGDRILL — gap 2: the game\'s numbers and the rule', () => {
    const HOPS = {
        'drill-l88-e': [152, 168], 'drill-l88-se': [152, 184], 'drill-l88-nw': [120, 152],
        'drill-l91-e': [88, 72], 'drill-l91-w': [56, 88],
    };

    it('each drill hops on tick 1 (its line crossed a tile the shipped model counted)', () => {
        for (const [name, [x, y]] of Object.entries(HOPS)) {
            expect(drillAt(byName[name], 1), name).toMatchObject({ x, y, anim: 'drill' });
        }
    });

    it('L88 SE goes hitless -> hit, as the game does: its contacts land on the game\'s ticks ON, and never OFF', () => {
        const w = byName['drill-l88-se'];
        const hitTicks = (over) => withContactFidelity(over, () => {
            let run = null;
            const st = createTapeStepper(tapeOf(w), { levelSource: atlasLevelSource(), onTick: (a, b, c, r) => { run = r; } });
            for (let r = st.next(); !r.done; r = st.next());
            return run.playerHits.map((h) => [h.t, h.source]);
        });
        // the game's `p.hits` changes on each contact (the third, at `hitsMax`, resets it)
        expect(w.hitsByTick.map(([t]) => t)).toEqual([17, 37, 57]);
        expect(hitTicks({ [DRILL]: true })).toEqual([[17, 'drill'], [37, 'drill'], [57, 'drill']]);
        expect(hitTicks({})).toEqual([]);
    });

    it('L88 E: from the second frame the Cliff is a wall again — the hopped drill never moves, and sits', () => {
        const w = byName['drill-l88-e'];
        for (const s of w.samples) {
            const d = s.bodies.find((b) => b.cls === 'Drill');
            expect([d.x, d.y], `t ${s.t}`).toEqual([152, 168]);
        }
        expect(w.samples.at(-1).bodies.find((b) => b.cls === 'Drill').anim).toBe('sit');
    });

    it('the clock is the hop\'s: the still player fits shift 0, and the drill tapes only take the drill rule', () => {
        for (const name of Object.keys(HOPS)) {
            expect(WAND_SWING_DRILL_TAPES[name].gap).toBe(2);
            expect(clockOk(WAND_SWING_DRILL_TAPES[name], [-1, 0])).toBe(true);
            expect(byName[name].tape.inputs).toEqual([]);
        }
        expect(clockOk({ gap: 1 }, [-1, 0])).toBe(false);
    });

    it('the flip is the FIRST frame\'s only: a player walking into range behind the tiles later is never hopped at', async () => {
        const w = byName['drill-l91-walkin'];
        const world = buildLevelWorld(atlasLevelSource()(91), {});
        const d = drillAt(w, 1);
        const at = w.samples.find((s) => s.t === 6).player;
        // in range on t 6, behind a tile the object-only list does not hold
        expect(Math.hypot(at.x - d.x, at.y - d.y)).toBeLessThanOrEqual(48);
        expect(w.samples.every((s) => s.bodies.find((b) => b.cls === 'Drill').x === d.x
            && s.bodies.find((b) => b.cls === 'Drill').y === d.y)).toBe(true);
        expect(world.solidBoxesForMover({}).length).toBeGreaterThan(world.solidBoxesForMover({}, null, { objectOnly: true }).length);
    });

    it('L88\'s object-only list holds no tile solid; the full list holds the Cliff the shipped line stopped on', () => {
        const w = buildLevelWorld(atlasLevelSource()(88), {});
        const full = w.solidBoxesForMover({});
        const obj = w.solidBoxesForMover({}, null, { objectOnly: true });
        expect(full.some((b) => b.tag === 'tile:Cliff' && b.x === 160 && b.y === 160)).toBe(true);
        expect(obj.filter((b) => String(b.tag).startsWith('tile:'))).toEqual([]);
        expect(obj.length).toBeLessThan(full.length);
        // OFF: the third argument absent and `objectOnly: false` are one list
        expect(w.solidBoxesForMover({}, null, { objectOnly: false })).toEqual(full);
    });

    it('ON reads the type flip on the FIRST tick only: from tick 2 the shipped line holds the hopped drill', async () => {
        const w = byName['drill-l88-e'];
        const on = await replay(w, { [DRILL]: true });
        const drills = on.col.map((c) => c?.bodies.find((b) => b.cls === 'Drill')).filter(Boolean);
        expect([drills[0].x, drills[0].y]).toEqual([136, 168]);
        expect(drills.slice(1).every((d) => d.x === 152 && d.y === 168)).toBe(true);
    });
});

describe('fidelity WANDSWINGDRILL — composition', () => {
    it('every witness is the game with BOTH keys ON, beside both wand keys', async () => {
        for (const w of WITNESSES) {
            const on = await replay(w, { [ITEM]: true, [DRILL]: true, wandShotTrapBodies: true, wandShotEnemyBodies: true });
            expect(on.error, w.name).toBe(null);
            expect(disagreements(w.samples, on), w.name).toEqual([]);
        }
    }, 240000);

    it('every witness is the game with both keys ON beside the base\'s OFF tail', async () => {
        const tail = Object.fromEntries(OFF_TAIL.map((k) => [k, true]));
        for (const k of OFF_TAIL) expect(CONTACT_FIDELITY_DEFAULTS[k], k).toBe(false);
        for (const w of WITNESSES) {
            const on = await replay(w, { ...tail, [ITEM]: true, [DRILL]: true });
            expect(on.error, w.name).toBe(null);
            expect(disagreements(w.samples, on), w.name).toEqual([]);
        }
    }, 240000);

    it('each key is inert on the other gap\'s witnesses', async () => {
        for (const w of WITNESSES) {
            const other = w.gap === 1 ? DRILL : ITEM;
            const a = await replay(w, wandSwingDrillSwitches(w.name, { on: false }));
            const b = await replay(w, wandSwingDrillSwitches(w.name, { on: false, extra: { [other]: true } }));
            expect(JSON.stringify(b.col), w.name).toBe(JSON.stringify(a.col));
        }
    }, 240000);
});
