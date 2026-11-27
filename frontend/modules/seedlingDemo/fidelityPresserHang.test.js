/**
 * ⛓ SEEDLING FIDELITY PRESSERLOOP (wave 62) — a group whose re-publishing setters reach each other HANGS the game
 * (`CONTACT_FIDELITY.presserRecursionHang`, OFF byte-identical).
 *
 *     Puzzlements/Button.as:42-61      set activate → activateAll(this, t, activate): every value, every frame
 *     Puzzlements/RopeStart.as:79-91   set activate → every other Activators of t: every value
 *     Puzzlements/ButtonRoom.as:67-98  room == -1: if (a) → persist = a, flipped by flip → every other Activators of t
 *
 * A false loops between two pass-throughs (Button/RopeStart); a true among the pass-throughs and the flip-0
 * ButtonRooms. Game witness (this slice, p4g; p4d for five shapes): each recursing shape throws "Maximum call stack size
 * exceeded" once and NO later frame runs. ON: a first-frame / check-time recursion is refused at build
 * (`LevelWorldError`); a publish during the run marks the activator state, and the next `advance` throws
 * `PresserRecursionHang`.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { PresserRecursionHang } from './activators.js';
import { LevelWorldError, buildLevelWorld, presserRecursionGroups, presserRecursionHangsOn } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { l25Sets } from './fidelityL25ApItem.js';
import { HANG_GROUP, HANG_SHAPES, hangRecord, hangReplay, hangShape, hangTape } from './fidelityPresserHang.js';
import { ENTITY_ROSTER, applyEdits } from './watchEdit.js';

const KEY = 'presserRecursionHang';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const WITNESS = join(ROOT, 'CC/docs/cloud-reports/seedling-fidelity-presserloop-evidence/d3/witness-p4g.json');
const VANILLA = atlasLevelSource();
const SETS = l25Sets(ROOT);
/** The base's last four OFF keys (waves 56 to 61), for the composition row. */
const LAST_FOUR = { freezeSpanUpdates: true, nestedRockCeremony: true, plainPickupInFreeze: true, chestCoverFencepost: true };

/** What the game measured, per shape (`d3/witness-p4g.json`): `build` / `firstFrame` / `press` hang, or `none`. */
const MEASURED = {
    'btn-btn': 'firstFrame', 'btn-rope': 'firstFrame', 'rope-rope-pulled': 'build', 'btn-br0-boot': 'build',
    'br0-btn': 'press', 'btn-br0': 'press', 'br0-br0': 'press', 'br0-rope': 'press', 'br1-rope-rope': 'press',
    'rope-rope': 'none', 'br1-btn': 'none', 'btn-br1': 'none', 'br0-br1': 'none', 'br1-br0': 'none', 'brx-btn': 'none',
    'btn-solo': 'none', 'br1-btn-br0': 'none',
};
const srcFor = (shape) => (n) => hangRecord(SETS.vanillaSource(n), shape);
const replay = (name, over = {}) => withContactFidelity({ [KEY]: false, ...over }, () => {
    const shape = hangShape(name);
    return hangReplay(hangTape(ROOT, shape), srcFor(shape));
});
const whole = (r) => JSON.stringify({ rows: r.rows, error: r.error, result: r.run ? {
    banked: r.run.bankedClears, level: r.run.level, ticks: r.run.ticksCompleted } : null });
const tapeResult = (name, over, src = VANILLA) => withContactFidelity({ [KEY]: false, ...over }, () => {
    try { return JSON.stringify(runTape(loadTape(name), { levelSource: src })); } catch (e) { return `THROW ${e.name}: ${e.message}`; }
});

describe('PRESSERLOOP — the key', () => {
    it('ships OFF, appended last, with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        // ⛓ wave 63 (BUTTONROOMCLEAR) appended `publishedButtonRoomSetter` after it.
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(KEY) + 1)).toEqual(['publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies', 'wandShotEnemyBodies', 'wandShotKill']);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESSER_RECURSION_HANG');
    });
    it.skipIf(!!process.env.SEEDLING_PRESSER_RECURSION_HANG)('is OFF in this process', () => {
        expect(CONTACT_FIDELITY[KEY]).toBe(false);
    });
});

describe('PRESSERLOOP — the recursion census (presserRecursionGroups)', () => {
    const b = (x) => ({ tag: 'button', t: 3, x, y: 0 });
    const r = (x, bootPulled = false) => ({ ropeId: `rope@${x},0`, ropeT: 3, bootPulled });
    const br = (x, flip, { room = -1, bootPressed = false } = {}) => ({ tag: 'buttonroom', t: 3, x, y: 0, room, flip, bootPressed });
    const one = (pressers, solids = []) => presserRecursionGroups({ pressers, solids })[0] ?? null;
    it('two pass-throughs with a Button recurse on the first frame', () => {
        expect(one([b(0), b(16)])).toMatchObject({ firstFrame: true, trueLoops: true, falseLoops: true, bootBy: null });
        expect(one([b(0)], [r(16)])).toMatchObject({ firstFrame: true });
    });
    it('two ropes recurse only on a publish (no Button writes every frame)', () => {
        expect(one([], [r(0), r(16)])).toMatchObject({ firstFrame: false, trueLoops: true, falseLoops: true, bootBy: null });
        expect(one([], [r(0, true), r(16)]).bootBy).toMatchObject({ id: 'rope@0,0', boot: true });
    });
    it('a flip-0 ButtonRoom loops a true with any pass-through or another flip-0', () => {
        for (const g of [one([b(0), br(16, false)]), one([br(0, false), br(16, false)]), one([br(0, false)], [r(16)])]) {
            expect(g).toMatchObject({ firstFrame: false, trueLoops: true, falseLoops: false });
            expect(presserRecursionHangsOn(g, true)).toBe(true);
            expect(presserRecursionHangsOn(g, false)).toBe(false);
        }
    });
    it('the near misses form no recursion group', () => {
        expect(one([b(0), br(16, true)])).toBeNull();
        expect(one([br(0, false), br(16, true)])).toBeNull();
        expect(one([br(0, true), br(16, true)])).toBeNull();
        expect(one([b(0), br(16, false, { room: 37 })])).toBeNull();
        expect(one([b(0)])).toBeNull();
        expect(one([b(0), br(16, true), br(32, true)])).toBeNull();
    });
    it('a flip-1 ButtonRoom with two ropes hangs on its own press (a false runs the rope pair)', () => {
        const g = one([br(0, true)], [r(16), r(32)]);
        expect(presserRecursionHangsOn(g, false)).toBe(true);
        expect(g.firstFrame).toBe(false);
    });
    it('a group that loops a true only: a flip-1 press (a false) does not hang it', () => {
        const g = one([br(0, true), b(16), br(32, false)]);
        expect(g).toMatchObject({ firstFrame: false, trueLoops: true, falseLoops: false });
        expect(presserRecursionHangsOn(g, false)).toBe(false);
    });
    it('a ButtonRoom pressed at boot publishes at the build', () => {
        expect(one([b(0), br(16, false, { bootPressed: true })]).bootBy).toMatchObject({ kind: 'br0', boot: true });
        expect(one([br(0, true, { bootPressed: true })], [r(16), r(32)]).bootBy).toMatchObject({ kind: 'br1', boot: false });
        expect(one([br(0, false), br(16, true, { bootPressed: true })])).toBeNull();
    });
    it('a built world carries the same groups (the staged rooms)', () => {
        const w = buildLevelWorld(hangRecord(VANILLA(38), hangShape('br1-rope-rope')));
        expect(presserRecursionGroups(w).map((g) => [g.t, g.members.map((m) => m.kind)])).toEqual([[HANG_GROUP, ['br1', 'rope', 'rope']]]);
        expect(presserRecursionGroups(buildLevelWorld(VANILLA(38)))).toEqual([]);
    });
});

describe('PRESSERLOOP — the staged shapes (the game witness rooms)', () => {
    for (const shape of HANG_SHAPES) {
        const kind = MEASURED[shape.name];
        it(`${shape.name}: OFF plays the walk out; ON gives the measured ${kind}`, () => {
            const off = replay(shape.name);
            expect(off.error).toBeNull();
            expect(off.rows.at(-1).level).toBe(37);
            const on = replay(shape.name, { [KEY]: true });
            if (kind === 'none') {
                expect(whole(on)).toBe(whole(off));
            } else if (kind === 'press') {
                expect(on.error.name).toBe('PresserRecursionHang');
                expect(on.error.message).toMatch(/^levelRun: tick 23 cannot run .*group 6 .*PRESSER RECURSION HANG/);
                expect(on.rows).toEqual(off.rows.slice(0, 24));
                // The hang frame writes nothing: the pressed ButtonRoom's own `setPersistence(tag)` is below the recursion.
                expect(on.run.earnedClears).toEqual(off.run.earnedClears.filter((c) => c.t < 23));
            } else {
                expect(on.error.name).toBe('LevelWorldError');
                expect(on.error.message).toMatch(kind === 'build' ? /check\(\) publishes/ : /first live frame/);
                expect(on.error.message).toContain('activator group 6');
                expect(on.rows).toEqual([]);
            }
        });
    }
    it('the press hang is the frame the on-walk presser is first under the box', () => {
        const on = replay('br0-br0', { [KEY]: true });
        expect(on.run.ticksCompleted).toBe(23);
        expect(on.error.message).toContain('buttonroom@144,224 (pressed) publishes true');
    });
});

describe.skipIf(!existsSync(WITNESS))('PRESSERLOOP — the ON replay against the game stream (d3/witness-p4g.json)', () => {
    const W = existsSync(WITNESS) ? JSON.parse(readFileSync(WITNESS, 'utf8')) : { rows: [] };
    const worst = (rows, game) => {
        let w = 0;
        for (let i = 0; i < Math.min(rows.length, game.length); i++) {
            const d = rows[i].level !== game[i].level ? Infinity
                : Math.max(Math.abs(rows[i].x - game[i].x), Math.abs(rows[i].y - game[i].y));
            w = Math.max(w, d);
        }
        return w;
    };
    for (const shape of HANG_SHAPES) {
        it(`${shape.name}: ON is the game's stream at 0 px, and stops where the game stops`, () => {
            const g = W.rows.find((r) => r.shape === shape.name);
            const game = g.drain.ticks;
            const on = replay(shape.name, { [KEY]: true });
            expect(worst(on.rows, game)).toBe(0);
            const kind = MEASURED[shape.name];
            if (kind === 'firstFrame') {
                // The game drains the arrival observation (Bot.update runs before the world's update); ON refuses at build.
                expect(game).toHaveLength(1);
                expect(on.rows).toEqual([]);
            } else {
                expect(on.rows).toHaveLength(game.length);
            }
            expect(g.summary.finished).toBe(kind === 'none');
        });
    }
});

describe('PRESSERLOOP — the hand editor (watchEdit.ENTITY_ROSTER, read only)', () => {
    const rosterButton = ENTITY_ROSTER.find((e) => e.type === 'button');
    const edited = applyEdits(SETS.vanillaSource(38), [
        { op: 'place', tx: 9, ty: 14, type: rosterButton.type, attrs: { ...rosterButton.attrs } },
        { op: 'place', tx: 11, ty: 15, type: rosterButton.type, attrs: { ...rosterButton.attrs } },
    ]);
    const src = (n) => (n === 38 ? edited : SETS.vanillaSource(n));
    const tape = hangTape(ROOT, hangShape('btn-solo'));
    it('two roster buttons share group 0: OFF certifies the walk, ON refuses the room by name', () => {
        expect(rosterButton.attrs.tset).toBe('0');
        const off = withContactFidelity({ [KEY]: false }, () => hangReplay(tape, src));
        expect(off.error).toBeNull();
        expect(off.rows.at(-1).level).toBe(37);
        const on = withContactFidelity({ [KEY]: true }, () => hangReplay(tape, src));
        expect(on.error.name).toBe('LevelWorldError');
        expect(on.error.message).toMatch(/activator group 0 holds .*button@144,224 \[button\].*button@176,240 \[button\]/);
    });
});

describe('PRESSERLOOP — the model-only publishes (unwitnessed timing)', () => {
    const br = (x, y, t, tag) => ({ type: 'buttonroom', x, y, attrs: { tset: String(t), tag: String(tag), flip: '0', room: '-1' } });
    const add = (lvl, es) => (n) => { const r = VANILLA(n); return n !== lvl ? r : { ...r, entities: [...r.entities, ...es] }; };
    it('a rope pulled into a recursing group: OFF as vanilla, ON refuses the tick after the pull', () => {
        const src = add(39, [br(288, 624, 6, 20)]);
        expect(tapeResult('r5-shaft', {}, src)).toBe(tapeResult('r5-shaft', {}));
        const on = tapeResult('r5-shaft', { [KEY]: true }, src);
        expect(on).toMatch(/^THROW PresserRecursionHang: levelRun: tick 190 cannot run .*rope@96,384 \(pulled\) publishes true/);
    });
    it("the wand's tset-0 sweep into a recursing group: OFF as vanilla, ON refuses the next tick", () => {
        const src = add(43, [br(176, 464, 0, 20), br(176, 448, 0, 21)]);
        expect(tapeResult('r5-l43-wand', {}, src)).toBe(tapeResult('r5-l43-wand', {}));
        expect(tapeResult('r5-l43-wand', { [KEY]: true }, src)).toMatch(/^THROW PresserRecursionHang: .*the wand \(Wand\.removed\)/);
    });
});

describe('PRESSERLOOP — vanilla rooms: ON = OFF', () => {
    for (const name of ['prox-l38-chest', 'prox-l38-reach-l39', 'r5-shaft', 'r5-l43-wand', 'f7-l16-reentry']) {
        it(`${name}: the whole result`, () => {
            expect(tapeResult(name, { [KEY]: true })).toBe(tapeResult(name, {}));
        });
    }
    it('no vanilla room holds a recursion group', () => {
        const hit = [];
        for (let n = 0; n <= 120; n++) {
            let rec;
            try { rec = VANILLA(n); } catch { continue; }
            if (!rec?.entities) continue;
            if (presserRecursionGroups(buildLevelWorld(rec)).length) hit.push(n);
        }
        expect(hit).toEqual([]);
    });
});

describe('PRESSERLOOP — composition with the base\'s last four OFF keys', () => {
    for (const name of ['btn-btn', 'br0-btn', 'br1-rope-rope', 'br0-br1', 'btn-solo']) {
        it(`${name}: the key's answer is the same with them ON`, () => {
            const alone = replay(name, { [KEY]: true });
            const both = replay(name, { ...LAST_FOUR, [KEY]: true });
            const four = replay(name, LAST_FOUR);
            if (MEASURED[name] === 'none') expect(whole(both)).toBe(whole(four));
            else expect(JSON.stringify([both.rows, both.error])).toBe(JSON.stringify([alone.rows, alone.error]));
        });
    }
    it('prox-l38-chest with all five ON = the four ON', () => {
        expect(tapeResult('prox-l38-chest', { ...LAST_FOUR, [KEY]: true })).toBe(tapeResult('prox-l38-chest', LAST_FOUR));
    });
});

describe('PRESSERLOOP — the error class', () => {
    it('PresserRecursionHang carries the hang', () => {
        const shape = hangShape('br0-rope');
        let caught = null;
        withContactFidelity({ [KEY]: true }, () => {
            try { runTape(hangTape(ROOT, shape), { levelSource: srcFor(shape) }); } catch (e) { caught = e; }
        });
        expect(caught).toBeInstanceOf(PresserRecursionHang);
        expect(caught.hang).toMatchObject({ level: 38, group: HANG_GROUP, value: true, by: 'buttonroom@144,224 (pressed)' });
        expect(() => withContactFidelity({ [KEY]: true }, () => buildLevelWorld(hangRecord(VANILLA(38), hangShape('btn-btn')))))
            .toThrow(LevelWorldError);
    });
});
