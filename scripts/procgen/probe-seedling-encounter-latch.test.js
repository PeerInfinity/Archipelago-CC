/**
 * The encounter-latch probe's PURE helpers (the probe itself drives the wasm game and runs only by hand or in
 * `seedling-probe.yml`): the counted classes read off `Game.totalEnemies()`, the tile BFS, and one step of the
 * CLEAR arm's closed loop.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CLEAR_ARMS, armFlags, clearStep, conditionHolds, countedClassesFromSource, heldWindow, moveStalled, tilePath,
} from './probe-seedling-encounter-latch.mjs';
import {
    HOLD_TAPE_VERSION, INVENTORY_ITEM_IDS, ITEM_PROPERTIES, PIN_NAMES, appendInventorySlots, gameVisibleTape, holdingWindowTape,
    parseTape,
} from '../../frontend/modules/seedlingDemo/tapeFormat.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAME_AS = join(REPO, 'vendor/seedling/src/Game.as');

describe('countedClassesFromSource', () => {
    it('reads the classCount terms of totalEnemies, skipping commented ones and other functions', () => {
        const src = `public function other():int { return classCount(Coin); }
        public function totalEnemies():int
        {
            //return typeCount("Enemy") + classCount(Ghost);
            return classCount(Spinner) +
                   classCount(Jellyfish) + classCount(Enemy);
        }
        public function after():void { classCount(IceTrap); }`;
        expect(countedClassesFromSource(src)).toEqual(['Enemies::Enemy', 'Enemies::Jellyfish', 'Enemies::Spinner']);
    });
    it('is null with no totalEnemies', () => {
        expect(countedClassesFromSource('')).toBeNull();
        expect(countedClassesFromSource(undefined)).toBeNull();
    });
    it.skipIf(!existsSync(GAME_AS))('on the real source: the kill-lock classes are counted and IceTrap is not', () => {
        const got = countedClassesFromSource(readFileSync(GAME_AS, 'utf8'));
        for (const c of ['Spinner', 'Jellyfish', 'Puncher']) expect(got).toContain(`Enemies::${c}`);
        expect(got).not.toContain('Enemies::IceTrap');
    });
});

describe('tilePath', () => {
    const open = (rows) => (x, y) => rows[y]?.[x] === '.';
    it('routes around a wall and returns null when walled off', () => {
        const rows = ['...', '##.', '...'];
        const p = tilePath(3, 3, open(rows), [0, 0], [0, 2]);
        expect(p[0]).toEqual([0, 0]);
        expect(p.at(-1)).toEqual([0, 2]);
        expect(p).toHaveLength(7);
        expect(tilePath(3, 3, open(['.#.', '##.', '...']), [0, 0], [2, 2])).toBeNull();
    });
    it('reaches a goal tile that is itself not passable (a body on a blocked cell)', () => {
        expect(tilePath(2, 1, open(['.#']), [0, 0], [1, 0])).toEqual([[0, 0], [1, 0]]);
    });
});

describe('clearStep', () => {
    const straight = (a, b) => [a, b];
    it('attacks a body inside the slash box: face it for a tick, then primary', () => {
        const s = clearStep({ t: 100, player: { x: 50, y: 50 }, bodies: [{ cls: 'Enemies::Spinner', x: 40, y: 54 }], path: straight });
        expect(s.kind).toBe('attack');
        expect(s.inputs).toEqual([{ key: 'left', from: 100, to: 101 }, { key: 'primary', from: 101, to: 103 }]);
    });
    it('walks toward the nearest body along the path, both axes when diagonal', () => {
        const s = clearStep({ t: 0, player: { x: 24, y: 24 }, bodies: [
            { cls: 'Enemies::Puncher', x: 200, y: 200 }, { cls: 'Enemies::Jellyfish', x: 72, y: 72 }], path: straight });
        expect(s.kind).toBe('move');
        expect(s.target).toBe('Enemies::Jellyfish');
        expect(s.keys).toEqual(['right', 'down']);
    });
    it('a move names the route step it is taking, and none inside the body\'s own tile', () => {
        const body = [{ cls: 'Enemies::Puncher', x: 24, y: 200 }];
        const down = (a) => [a, [a[0], a[1] + 1]];
        expect(clearStep({ t: 0, player: { x: 20, y: 24 }, bodies: body, path: down }).step).toBe('down');
        expect(clearStep({ t: 0, player: { x: 20, y: 24 }, bodies: body, path: (a) => [a] }).step).toBeNull();
    });
    it('a stalled move with a step presses facing the STEP, not the sideways key it was also holding', () => {
        const s = clearStep({ t: 0, player: { x: 138, y: 179 }, bodies: [{ cls: 'Enemies::Puncher', x: 144, y: 104 }],
            path: straight, lastMove: { stuck: true, keys: ['left', 'up'], step: 'up' } });
        expect(s.kind).toBe('break');
        expect(s.inputs.map((i) => i.key)).toEqual(['up', 'primary']);
    });
    it('presses into the way it was walking when the last move went nowhere', () => {
        const s = clearStep({ t: 8, player: { x: 24, y: 24 }, bodies: [{ cls: 'Enemies::Puncher', x: 200, y: 24 }],
            path: straight, lastMove: { stuck: true, keys: ['right'] } });
        expect(s.kind).toBe('break');
        expect(s.inputs.map((i) => i.key)).toEqual(['right', 'primary']);
    });
});

describe('CLEAR_ARMS', () => {
    const PLAYER_AS = join(REPO, 'vendor/seedling/src/Player.as');
    const flagsOf = (arm) => Object.fromEntries(CLEAR_ARMS[arm].items.map((i) => [ITEM_PROPERTIES[i].property, true]));
    it('every arm grants only tape items, and `primary` (slot 0) is the arm itself', () => {
        const slot0 = { sword: INVENTORY_ITEM_IDS.sword, spear: INVENTORY_ITEM_IDS.spear, ghostsword: INVENTORY_ITEM_IDS.ghostsword };
        expect(Object.keys(CLEAR_ARMS).sort()).toEqual(Object.keys(slot0).sort());
        for (const [arm, id] of Object.entries(slot0)) {
            for (const item of CLEAR_ARMS[arm].items) expect(ITEM_PROPERTIES[item], `${arm}: ${item}`).toBeTruthy();
            expect(appendInventorySlots([], flagsOf(arm)).slots[0], arm).toBe(id);
        }
    });
    it('the spear arm holds no sword, and the ghost sword arm holds both it replaces', () => {
        expect(flagsOf('spear')).toEqual({ hasSpear: true });
        expect(flagsOf('ghostsword')).toEqual({ hasSword: true, hasSpear: true, hasGhostSword: true });
    });
    it('a body off the thrust line is walked to, not pressed at: the spear box is narrower than the slash box', () => {
        const at = { t: 0, player: { x: 50, y: 50 }, bodies: [{ cls: 'Enemies::Jellyfish', x: 62, y: 60 }], path: (a, b) => [a, b] };
        expect(clearStep({ ...at, ...CLEAR_ARMS.sword }).kind).toBe('attack');
        expect(clearStep({ ...at, ...CLEAR_ARMS.spear }).kind).toBe('move');
        expect(clearStep({ ...at, ...CLEAR_ARMS.spear, bodies: [{ cls: 'Enemies::Jellyfish', x: 76, y: 53 }] }).kind).toBe('attack');
    });
    it('a BREAK press of the spear arm rests first, then taps the step and presses; an attack press does not rest', () => {
        const { rest } = CLEAR_ARMS.spear;
        const stalled = { t: 0, player: { x: 138, y: 179 }, bodies: [{ cls: 'Enemies::Puncher', x: 144, y: 104 }],
            path: (a, b) => [a, b], lastMove: { stuck: true, keys: ['left', 'up'], step: 'up' } };
        const b = clearStep({ ...stalled, ...CLEAR_ARMS.spear });
        expect(b.kind).toBe('break');
        expect(b.inputs).toEqual([{ key: 'up', from: rest, to: rest + 1 }, { key: 'primary', from: rest + 1, to: rest + 3 }]);
        expect(b.ticks).toBe(clearStep({ ...stalled, ...CLEAR_ARMS.sword }).ticks + rest);
        expect(clearStep({ ...stalled, ...CLEAR_ARMS.sword }).inputs[0]).toEqual({ key: 'up', from: 0, to: 1 });
        const a = clearStep({ ...stalled, ...CLEAR_ARMS.spear, bodies: [{ cls: 'Enemies::Jellyfish', x: 139, y: 160 }] });
        expect(a.kind).toBe('attack');
        expect(a.inputs[0]).toEqual({ key: 'up', from: 0, to: 1 });
    });
    it.skipIf(!existsSync(PLAYER_AS))('on the real source: the spear arm rests long enough for friction to stop a walk', () => {
        const dMS = Number(/const dMS:Number = ([\d.]+);/.exec(readFileSync(PLAYER_AS, 'utf8'))[1]);
        const friction = Number(/DEFAULT_FRICTION:Number = ([\d.]+);/.exec(readFileSync(join(REPO, 'vendor/seedling/src/Mobile.as'), 'utf8'))[1]);
        expect(CLEAR_ARMS.spear.rest).toBeGreaterThanOrEqual(Math.ceil((2 * dMS * Math.SQRT2) / friction));
        expect(CLEAR_ARMS.sword.rest ?? 0).toBe(0);
        expect(CLEAR_ARMS.ghostsword.rest ?? 0).toBe(0);
    });
    it.skipIf(!existsSync(PLAYER_AS))('on the real source: the thrust is longer than the spear box reaches and as thick as it is wide', () => {
        const spear = /function\s+spear\s*\(\)[\s\S]*?const length:int = (\d+);\s*const thick:int = (\d+);/.exec(readFileSync(PLAYER_AS, 'utf8'));
        expect(spear).not.toBeNull();
        expect(CLEAR_ARMS.spear.reach).toBeLessThanOrEqual(Number(spear[1]));
        expect(CLEAR_ARMS.spear.across).toBe(Number(spear[2]));
    });
});

describe('conditionHolds / armFlags', () => {
    it('reads flag, any and all', () => {
        const f = new Set(['hasSword']);
        expect(conditionHolds({ flag: 'hasSword' }, f)).toBe(true);
        expect(conditionHolds({ any: [{ flag: 'canSwim' }, { flag: 'hasSword' }] }, f)).toBe(true);
        expect(conditionHolds({ all: [{ flag: 'canSwim' }, { flag: 'hasSword' }] }, f)).toBe(false);
        expect(conditionHolds(null, f)).toBe(false);
    });
    // . open, # wall, ~ water (needs canSwim), r a rock the sword breaks; the room is the left column.
    const level = (rows) => {
        const cellAt = (x, y) => ({ '.': { kind: 'open' }, '#': { kind: 'wall' },
            '~': { kind: 'gated', conditions: [{ flag: 'canSwim' }] },
            r: { kind: 'gated', conditions: [{ any: [{ flag: 'hasSword' }, { flag: 'hasSpear' }] }] } })[rows[y]?.[x]];
        return { width: rows[0].length, height: rows.length, cellAt, blocked: () => false, from: [0, 0], base: new Set(['hasSword']) };
    };
    it('asks for the flag of a gate on the only route to a body, and not for one the sword already opens', () => {
        expect(armFlags({ ...level(['.r~.']), bodies: [[3, 0]] })).toEqual(['canSwim']);
        expect(armFlags({ ...level(['.r..']), bodies: [[3, 0]] })).toEqual([]);
    });
    it('asks for nothing when every body is reachable on foot', () => {
        expect(armFlags({ ...level(['....', '~~~~']), bodies: [[3, 0], [2, 0]] })).toEqual([]);
    });
});

describe('heldWindow', () => {
    const tape = parseTape({
        tape_version: 8, game: 'seedling', name: 'w', description: 'a window', boot: { level: 53, x: 16, y: 16 },
        noclip: false, noDamage: true, noHazards: [], grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 0, split: false }, seam: {}, tick_count: 8,
        inputs: [{ key: 'right', from: 0, to: 8 }],
    });
    const fns = { holdingWindowTape, gameVisibleTape };
    it('on a build that can hold: the game-visible tape declares hold at the holding version, same boot and inputs', () => {
        const h = heldWindow(tape, { capable: true, ...fns });
        expect(h.hold).toBe(true);
        expect(h.tape_version).toBe(HOLD_TAPE_VERSION);
        expect(h.boot).toEqual(tape.boot);
        expect(h.inputs).toEqual(tape.inputs);
        expect(h.tick_count).toBe(tape.tick_count);
    });
    it('on a build that cannot: the tape itself, untouched (the loader would refuse the holding version)', () => {
        expect(heldWindow(tape, { capable: false, ...fns })).toBe(tape);
    });
});

describe('moveStalled', () => {
    it('with a step: no progress along it is a stall, however far the player slid sideways', () => {
        // Held under a rock: the player slides along it past the waypoint and back, never upward.
        expect(moveStalled({ x: 131, y: 179, step: 'up' }, { x: 138, y: 179 })).toBe(true);
        expect(moveStalled({ x: 146, y: 164, step: 'left' }, { x: 146, y: 171 })).toBe(true);
        expect(moveStalled({ x: 131, y: 179, step: 'up' }, { x: 131, y: 180 })).toBe(true);
    });
    it('with a step: a pixel of progress along it is not a stall', () => {
        expect(moveStalled({ x: 131, y: 179, step: 'up' }, { x: 131, y: 178 })).toBe(false);
        expect(moveStalled({ x: 100, y: 50, step: 'right' }, { x: 104, y: 50 })).toBe(false);
    });
    it('with no step: any displacement under a pixel', () => {
        expect(moveStalled({ x: 10, y: 10, step: null }, { x: 10.5, y: 10 })).toBe(true);
        expect(moveStalled({ x: 10, y: 10, step: null }, { x: 10, y: 12 })).toBe(false);
    });
});
