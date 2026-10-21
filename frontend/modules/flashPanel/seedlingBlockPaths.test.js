/**
 * ⛓ RULES block-path — a re-closing lock's button is held by a BODY, and where
 * the only bodies are pushable blocks the lock costs what the block's path
 * costs. These rows pin the search on hand-built rooms (a free control, a
 * rock on the only path, water that destroys the block, a fire block) and the
 * verdict's three refusals, then the real rooms: L15 (the defect) and its
 * rock-free control, and L16 (an enemy may hold, so the player-reach price
 * stands).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { blockHolderSearch, blockHolderVerdict, selfHoldTiles } from './seedlingBlockPaths.js';
import { anyOf, buildSeedlingRegionGrid, conditionKey, flag } from './seedlingSemantics.js';
import {
    A_WEAPON,
    buildBlockHolders,
    buildCrossLevelOpeners,
    buildGroupOpeners,
    overlayEntitySemantics,
    overlayTileSemantics,
} from './seedlingPlaythroughOverlay.js';

// ── hand-built rooms: '#' wall, '.' floor, '~' water, 'R' rock (Sword|Spear), 'L' the lock ──
const ROCK = anyOf(flag('hasSword'), flag('hasSpear'));
const room = (rows) => {
    const height = rows.length;
    const width = rows[0].length;
    const cells = [];
    const tileTypes = new Map();
    let lock = null;
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const i = y * width + x;
        const cell = { kind: 'open', conditions: [], faces: {}, dirs: {}, manual: [], labels: [] };
        if (ch === '#') cell.kind = 'wall';
        if (ch === 'R') Object.assign(cell, { kind: 'gated', conditions: [ROCK] });
        if (ch === '~') { Object.assign(cell, { kind: 'gated', conditions: [flag('canSwim')] }); tileTypes.set(i, 1); }
        if (ch === 'L') { cell.kind = 'directional'; lock = i; }
        cells.push(cell);
    }));
    return { grid: { width, height, cells }, tileTypes, lock, at: (x, y) => y * width + x };
};
const searchIn = (r, { blocks, holders }) => blockHolderSearch(r.grid, {
    blocks, holders, lockCells: new Set([r.lock]), tileTypes: r.tileTypes, keyOf: conditionKey,
});

// A 5x9 room: the lock is the only door in column 6; the block starts at (2,2)
// and the button is (4,2). `col3` fills column 3 (rows 1-3) with one material.
const roomWith = (col3) => room([
    '#########',
    `#..${col3}..#.#`,
    `#..${col3}..L.#`,
    `#..${col3}..#.#`,
    '#########',
]);
const BLOCK = { tx: 2, ty: 2, kind: 'pushableblock' };
const BUTTON = [4, 2];

describe('the block search on hand-built rooms', () => {
    it('a FREE control: pushed east twice onto the button, then round it to the lock', () => {
        const r = roomWith('.');
        expect(searchIn(r, { blocks: [BLOCK], holders: [BUTTON] }).entries(r.at(1, 2)).sets).toEqual([[]]);
    });

    it('a rock wall across the path costs its item', () => {
        const r = roomWith('R');
        expect(searchIn(r, { blocks: [BLOCK], holders: [BUTTON] }).entries(r.at(1, 2)).sets).toEqual([[conditionKey(ROCK)]]);
    });

    it('water across the path destroys the block: no path, whatever is held (Swim lets only the PLAYER across)', () => {
        const r = roomWith('~');
        expect(searchIn(r, { blocks: [BLOCK], holders: [BUTTON] }).entries(r.at(1, 2)).sets).toEqual([]);
    });

    it('the block on the button must not wall the player off the lock (a 1-wide corridor)', () => {
        const r = room(['#######', '#....L.#'.slice(0, 7), '#######']);
        expect(searchIn(r, { blocks: [{ tx: 2, ty: 1, kind: 'pushableblock' }], holders: [[4, 1]] })
            .entries(r.at(1, 1)).sets).toEqual([]);
    });

    it('a push needs a STANCE: a block against a wall is never pushed away from it', () => {
        const r = roomWith('.');
        expect(searchIn(r, { blocks: [{ tx: 1, ty: 2, kind: 'pushableblock' }], holders: [[0, 2]] })
            .entries(r.at(3, 2)).sets).toEqual([]);
    });

    it('a FIRE block costs Fire on top of its path', () => {
        const r = roomWith('R');
        expect(searchIn(r, { blocks: [{ ...BLOCK, kind: 'pushableblockfire' }], holders: [BUTTON] }).entries(r.at(1, 2)).sets)
            .toEqual([[conditionKey(ROCK), 'flag:hasFire'].sort()]);
    });
});

describe('the verdict: who holds (⚖ enemies are not holders)', () => {
    const r = roomWith('.');
    const base = { holders: [BUTTON], lockCells: new Set([r.lock]), closedCells: new Set([r.lock]), tileTypes: r.tileTypes, keyOf: conditionKey };

    it('no pushable and no faller: decided, and no entry has a holder', () => {
        const v = blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [], pulser: false, fallers: [] } });
        expect(v).toMatchObject({ decided: true, why: 'no-block' });
        expect(v.search.entries(r.at(1, 2)).sets).toEqual([]);
    });

    it('a fire block beside a Pulser (a second push arm) is undecided', () => {
        const fire = { ...BLOCK, kind: 'pushableblockfire' };
        expect(blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [fire], pulser: true, fallers: [] } }).why).toBe('pulser-arm');
    });

    it('blocks alone decide it', () => {
        const v = blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [BLOCK], pulser: false, fallers: [] } });
        expect(v.decided).toBe(true);
        expect(v.search.entries(r.at(1, 2)).sets).toEqual([[]]);
    });

    it('a rope-opened rock landing on the button holds it, at the rope\'s price', () => {
        const rope = { tiles: [[1, 1]], condition: ROCK };
        const v = blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [], pulser: false, fallers: [{ tx: 4, ty: 2, triggers: [rope] }] } });
        expect(v.search.entries(r.at(1, 2)).sets).toEqual([[conditionKey(ROCK)]]);
    });

    it('a rock on the button whose rope this side cannot reach is UNDECIDED (cut on another visit)', () => {
        const rope = { tiles: [[7, 1]], condition: ROCK };
        const v = blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [], pulser: false, fallers: [{ tx: 4, ty: 2, triggers: [rope] }] } });
        expect(v.search.entries(r.at(1, 2))).toEqual({ sets: [], refused: 'faller-cross-visit' });
    });
});

describe('selfHoldTiles — the player holds a button ORTHOGONALLY beside the lock and steps in', () => {
    it('beside: yes; diagonal: no', () => {
        const lock = new Set([3 * 10 + 8]);
        expect([...selfHoldTiles([[8, 4], [7, 3]], lock, 10)]).toEqual([4 * 10 + 8, 3 * 10 + 7]);
        expect([...selfHoldTiles([[7, 2]], lock, 10)]).toEqual([]);
    });
});

// ── the real rooms ──────────────────────────────────────────────────────────
const MAP = JSON.parse(readFileSync(fileURLToPath(new URL('./atlases/seedling-map.json', import.meta.url)), 'utf8'));
const levelById = (doc, id) => doc.levels.find((l) => l.level === id);
const gridOf = (doc, id) => {
    const level = levelById(doc, id);
    const ctx = {
        level: id,
        crossLevelOpeners: buildCrossLevelOpeners(doc),
        groupOpeners: buildGroupOpeners(doc),
        blockHolders: buildBlockHolders(doc),
    };
    return buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level, {
        tileOverride: overlayTileSemantics,
        entityOverride: (e, b) => overlayEntitySemantics(e, b, ctx),
        directionalLocks: true,
    });
};
const cellAt = (grid, x, y) => grid.cells[y * grid.width + x];
const keyOfEntry = (gate) => (gate === undefined ? 'FREE' : gate === null ? 'WALLED' : gate.map(conditionKey).join('&'));

describe('L15 — the block must pass both rocks, so the lock costs a weapon', () => {
    // lock@128,48 = (8,3); button@112,32 = (7,2); pushableblock@64,64 = (4,4);
    // breakablerock@96,80 = (6,5) (the north-push stance) and @96,16 = (6,1)
    // (the only way to (5,2), the east-push stance).
    it('from the button side (7,3): Sword|Spear, where the player-reach price said free', () => {
        expect(keyOfEntry(cellAt(gridOf(MAP, 15), 8, 3).enter.E)).toBe(conditionKey(A_WEAPON));
    });

    it('from the arrival column (9,3): the swim round AND the weapon', () => {
        expect(keyOfEntry(cellAt(gridOf(MAP, 15), 8, 3).enter.W))
            .toBe(conditionKey({ all: [A_WEAPON, flag('canSwim')] }));
    });

    it('the heldBy census names the block and no enemy', () => {
        expect(buildBlockHolders(MAP).get(15)).toEqual({
            blocks: [{ tx: 4, ty: 4, kind: 'pushableblock', condition: null }], pulser: false, fallers: [],
        });
    });

    it('CONTROL: the same room without its rocks is free from the button side', () => {
        const doc = {
            ...MAP,
            levels: MAP.levels.map((l) => (l.level === 15
                ? { ...l, entities: l.entities.filter((e) => e.type !== 'breakablerock') } : l)),
        };
        expect(cellAt(gridOf(doc, 15), 8, 3).enter?.E).toBeUndefined();
    });
});

describe('L16 — ⚖ enemies are not holders, so its bobs do not keep the player-reach price', () => {
    it('from the button side (19,7): Sword|Spear (the block passes rock@304,64)', () => {
        expect(keyOfEntry(cellAt(gridOf(MAP, 16), 20, 7).enter.E)).toBe(conditionKey(A_WEAPON));
    });
});

describe('L71 — the button is SOUTH of the lock, so the player holds it and steps in (game-witnessed)', () => {
    // lock@112,160 = (7,10), button@112,176 = (7,11): `l71-button-lock` /
    // `l71-hold-102-open`. No pushable, no faller: only the self-hold.
    it('from the button (7,11): free', () => {
        expect(cellAt(gridOf(MAP, 71), 7, 10).enter?.N).toBeUndefined();
    });
});

describe('L28 — the designed holder is a falling rock, its rope on a plateau neither side reaches', () => {
    // fallrock@112,240 {tset 1} lands on button@112,240; its only opener is
    // rope@160,64 (10,4), behind cliff faces from both sides of grasslock@176,208.
    it('the census reads the rock and its rope', () => {
        expect(buildBlockHolders(MAP).get(28).fallers).toEqual([
            { tx: 7, ty: 15, triggers: [{ tiles: [[10, 4]], condition: A_WEAPON }] },
        ]);
    });

    it('so the entry is UNDECIDED and keeps the player-reach price (free from the button side)', () => {
        expect(cellAt(gridOf(MAP, 28), 11, 13).enter?.N).toBeUndefined();
    });
});

describe('L41 — ⚖ applied: the FIRE block is the only holder, so Totem Part 3\'s room costs Fire too', () => {
    // wandlock@240,96 = (15,6), button@176,176 = (11,11), pushableblockfire@112,144 = (7,9).
    it('from the rocks\' side (15,5): Sword|Spear AND Fire, where the player-reach price said Sword|Spear', () => {
        expect(keyOfEntry(cellAt(gridOf(MAP, 41), 15, 6).enter.S))
            .toBe(conditionKey({ all: [A_WEAPON, flag('hasFire')] }));
    });
});

describe('L39 — a Pulser moves fire blocks with no item, so the room is UNDECIDED', () => {
    it('the first wandlock of the chain keeps the player-reach price (free from (9,5))', () => {
        expect(buildBlockHolders(MAP).get(39).pulser).toBe(true);
        expect(cellAt(gridOf(MAP, 39), 9, 4).enter?.N).toBeUndefined();
    });
});
