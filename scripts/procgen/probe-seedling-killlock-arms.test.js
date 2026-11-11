/**
 * The kill-lock arms probe's PURE helpers (the probe itself drives the wasm game and runs only by hand or in
 * `seedling-probe.yml`): which census rows are its subjects, the stand point of a side, one step of an ARMS loop,
 * and the flood of a side's own tiles.
 */
import { describe, expect, it } from 'vitest';
import { ARMS, armSubjects, sideTiles, standPoint, standStep } from './probe-seedling-killlock-arms.mjs';
import { ITEM_PROPERTIES } from '../../frontend/modules/seedlingDemo/tapeFormat.js';

describe('ARMS', () => {
    it('grants only tape item names, and one arm holds nothing', () => {
        for (const items of Object.values(ARMS)) for (const item of items) expect(ITEM_PROPERTIES[item]).toBeDefined();
        expect(ARMS.none).toEqual([]);
    });
});

describe('armSubjects', () => {
    const row = (fires, why, ...verdicts) => ({ fires, why, sides: verdicts.map((verdict) => ({ verdict })) });
    it('takes a not-fired lock with a side that is not `clears`, and no other', () => {
        const undecided = row(false, 'every side clears the room (or is undecided)', 'clears', 'undecided');
        const none = row(false, 'no side clears the room', 'undecided', 'undecided');
        const rows = [
            row(true, null, 'clears', 'cannot'),
            row(false, 'a cross-level ButtonRoom also clears its tag', 'cannot', 'clears'),
            row(false, 'every side clears the room (or is undecided)', 'clears'),
            undecided, none,
        ];
        expect(armSubjects(rows)).toEqual([undecided, none]);
    });
});

describe('standPoint', () => {
    it('is the point of the side nearest the target, kept a margin inside its tile', () => {
        // A two-tile row at y 5; the target is below-left of it: the CHECK point (y + 1) stays 5 px inside the tile.
        expect(standPoint([[9, 5], [10, 5]], { x: 122, y: 120 })).toMatchObject({ x: 149, y: 90, tile: [9, 5] });
        expect(standPoint([[9, 5], [10, 5]], { x: 122, y: 81 })).toMatchObject({ x: 149, y: 84 });
        // A target inside a tile is its own stand point.
        expect(standPoint([[9, 5]], { x: 152, y: 88 })).toMatchObject({ x: 152, y: 88, d: 0 });
    });
});

describe('standStep', () => {
    const tiles = [[9, 5], [10, 5]];
    const path = () => null;
    const body = (x, y) => ({ cls: 'Enemies::Jellyfish', x, y });
    it('walks to the stand point first, in short holds', () => {
        const step = standStep({ player: { x: 168, y: 88 }, bodies: [body(122, 88)], tiles, path });
        expect(step.kind).toBe('move');
        expect(step.keys).toEqual(['left']);
        expect(step.inputs.every((i) => i.to <= 4)).toBe(true);
    });
    it('a blocked stand point (a move step toward it moved nothing): the player stands where it is and presses', () => {
        const at = { player: { x: 149, y: 92 }, bodies: [body(122, 84)], tiles, path };
        const move = standStep(at);
        expect(move).toMatchObject({ kind: 'move', stand: { x: 149, y: 84 } });
        expect(standStep({ ...at, blocked: move.stand })).toMatchObject({ kind: 'attack', key: 'left' });
        // another body, another stand point: it walks again
        expect(standStep({ ...at, bodies: [body(160, 120)], blocked: move.stand }).kind).toBe('move');
    });
    it('there, faces a body within the engage range and presses; a known facing skips the tap', () => {
        const at = { player: { x: 149, y: 86 }, bodies: [body(122, 86)], tiles, path };
        const tap = standStep(at);
        expect(tap).toMatchObject({ kind: 'attack', key: 'left', facing: 'left' });
        expect(tap.inputs.map((i) => i.key)).toEqual(['left', 'primary']);
        expect(standStep({ ...at, facing: 'left' }).inputs.map((i) => i.key)).toEqual(['primary']);
    });
    it('waits, with no input, while the nearest body is out of the engage range', () => {
        const step = standStep({ player: { x: 149, y: 88 }, bodies: [body(60, 88)], tiles, path, engage: 48 });
        expect(step).toMatchObject({ kind: 'wait', inputs: [] });
    });
});

describe('sideTiles', () => {
    it('floods the walkable cells from the start, 4-connected', () => {
        const rows = ['#####', '#..#.', '#.##.', '#####'];
        const walk = (x, y) => rows[y]?.[x] === '.';
        expect(sideTiles([1, 1], walk).map((t) => t.join(',')).sort()).toEqual(['1,1', '1,2', '2,1']);
    });
});
