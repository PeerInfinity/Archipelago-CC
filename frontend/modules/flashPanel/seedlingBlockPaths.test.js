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

import { blockCrossingCost, blockHolderSearch, blockHolderVerdict, blockPushSearch, selfHoldTiles } from './seedlingBlockPaths.js';
import { anyOf, buildSeedlingRegionGrid, conditionKey, entitySemantics, flag } from './seedlingSemantics.js';
import { ropeEventCondition } from './seedlingObstacleEvents.js';
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

    // ⛓ RULES rope-events — the same rock, carrying its rope's cut EVENT: down on THIS visit whenever the event is
    // held, whichever visit cut it, so the entry is DECIDED at the event's price.
    it('…and with the rope\'s cut EVENT the same entry is decided: it costs the event', () => {
        const rope = { tiles: [[7, 1]], condition: ROCK };
        const event = ropeEventCondition({ level: 99, tag: 0, x: 112, y: 16 });
        const v = blockHolderVerdict(r.grid, { ...base, heldBy: { blocks: [], pulser: false, fallers: [{ tx: 4, ty: 2, event, triggers: [rope] }] } });
        expect(v.decided).toBe(true);
        expect(v.search.entries(r.at(1, 2))).toEqual({ sets: [[conditionKey(event)]], refused: null });
    });

    it('…an event on a rock that lands on NO holder is not a key at all (it opens nothing)', () => {
        const rope = { tiles: [[7, 1]], condition: ROCK };
        const event = ropeEventCondition({ level: 99, tag: 0, x: 112, y: 16 });
        const s2 = blockHolderSearch(r.grid, { ...base, blocks: [BLOCK], fallers: [{ tx: 1, ty: 1, event, triggers: [rope] }] });
        expect(s2.universe).not.toContain(conditionKey(event));
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
            blocks: [{ tx: 4, ty: 4, kind: 'pushableblock', condition: null }], pulser: false, pulsers: [], fallers: [],
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
    // ⛓ RULES rope-events: the cut is saved ({28,0}, and the rock's own {28,1} the same frame), and the rock is
    // rebuilt fallen on every later visit — game-witnessed (`probe-seedling-rope-events.mjs` l28-cross / -control /
    // -rock-only) — so the rock carries its rope's cut EVENT.
    const EVENT = ropeEventCondition({ level: 28, tag: 0, x: 160, y: 64 });
    it('the census reads the rock, its rope and the cut\'s event', () => {
        const rope = MAP.levels.find((l) => l.level === 28).entities.find((e) => e.type === 'rope');
        expect(buildBlockHolders(MAP).get(28).fallers).toEqual([
            // ⛓ rules-l39: the rope's whole RUN (10..12, 4) is its tiles until the cut (`RopeStart.as:26`)
            { tx: 7, ty: 15, event: EVENT, triggers: [{ tiles: [[10, 4], [11, 4], [12, 4]], condition: entitySemantics(rope).condition }] },
        ]);
        expect(EVENT).toEqual({ event: 'L28 flag 0: rope@160,64 cleared' });
    });

    it('so the lock is entered at the EVENT\'s price, from the button side (moving N) and from r1c18 (moving S)', () => {
        const gates = cellAt(gridOf(MAP, 28), 11, 13).enter;
        expect([keyOfEntry(gates.N), keyOfEntry(gates.S)]).toEqual([conditionKey(EVENT), conditionKey(EVENT)]);
    });
});

describe('L41 — ⚖ applied: the FIRE block is the only holder, so Totem Part 3\'s room costs Fire too', () => {
    // wandlock@240,96 = (15,6), button@176,176 = (11,11), pushableblockfire@112,144 = (7,9).
    it('from the rocks\' side (15,5): Sword|Spear AND Fire, where the player-reach price said Sword|Spear', () => {
        expect(keyOfEntry(cellAt(gridOf(MAP, 41), 15, 6).enter.S))
            .toBe(conditionKey({ all: [A_WEAPON, flag('hasFire')] }));
    });
});

// ⛓ rules-l39 — L39's pulser@64,96 (4,6) is armed by the rope's cut (tset 6), but no fire block STARTS within its
// reach (the 8 tiles round it: `Pulser.as:23,92-99`), and a fire block moves only on a Fire or Pulse hit, so every
// pulse follows a Fire push: the room is DECIDED. Its chain wandlock@144,64/48/32 = (9,4)/(9,3)/(9,2), tset 3/4/5,
// is a lock RUN — three groups crossed in one walk — so each lock is priced from the run's outer cell (9,5), and the
// room's three fire blocks are three bodies for the three groups.
describe('L39 — the pulser is decided (no fire block starts in its reach), and the chain is a lock RUN priced Fire', () => {
    const FIRE = conditionKey(flag('hasFire'));
    it('the census names the pulser\'s tile, and the verdict decides the room', () => {
        const held = buildBlockHolders(MAP).get(39);
        expect(held.pulser).toBe(true);
        expect(held.pulsers).toEqual([{ tx: 4, ty: 6 }]);
        expect(held.blocks.map((b) => [b.tx, b.ty, b.kind])).toEqual([
            [9, 11, 'pushableblockfire'], [13, 5, 'pushableblockfire'], [3, 11, 'pushableblockfire']]);
    });
    it('every lock of the chain costs Fire from the room side (moving N), and the north side is walled (moving S)', () => {
        const grid = gridOf(MAP, 39);
        for (const y of [4, 3, 2]) {
            expect(keyOfEntry(cellAt(grid, 9, y).enter.N), `(9,${y}) N`).toBe(FIRE);
            expect(keyOfEntry(cellAt(grid, 9, y).enter.S), `(9,${y}) S`).toBe('WALLED');
        }
    });
    it('wandlock@48,160 (3,10) falls out of the same search: Fire from the north, walled from its fire block\'s cell', () => {
        const gates = cellAt(gridOf(MAP, 39), 3, 10).enter;
        expect([keyOfEntry(gates.S), keyOfEntry(gates.N)]).toEqual([FIRE, 'WALLED']);
    });
    it('a RUN needs a body per group: with one fire block fewer (2 bodies, 3 groups) the chain is walled past its first lock', () => {
        const doc = JSON.parse(JSON.stringify(MAP));
        const l39 = levelById(doc, 39);
        l39.entities = l39.entities.filter((e) => !(e.type === 'pushableblockfire' && e.x === 48 && e.y === 176));
        const grid = gridOf(doc, 39);
        expect(keyOfEntry(cellAt(grid, 9, 4).enter.N)).toBe(FIRE);
        expect(keyOfEntry(cellAt(grid, 9, 3).enter.N)).toBe(FIRE);
        expect(keyOfEntry(cellAt(grid, 9, 2).enter.N)).toBe('WALLED');
    });
    it('the Pulser is a static Solid (`Pulser.as:47-48`): its own tile is a wall', () => {
        expect(cellAt(gridOf(MAP, 39), 4, 6).kind).toBe('wall');
    });
});

describe('pulser-arm — UNDECIDED only where a fire block STARTS within a pulser\'s reach (L38, L40, L107 by design)', () => {
    const fire = (tx, ty) => ({ tx, ty, kind: 'pushableblockfire', condition: flag('hasFire') });
    const grid = { width: 3, height: 3, cells: Array.from({ length: 9 }, () => ({ kind: 'open', conditions: [] })) };
    const verdictOf = (blocks, pulsers) => blockHolderVerdict(grid, {
        heldBy: { blocks, pulser: true, pulsers, fallers: [] }, holders: [[0, 0]], lockCells: new Set([8]),
        tileTypes: new Map(), keyOf: conditionKey,
    });
    it('a fire block beside the pulser, orthogonal or diagonal, keeps the room undecided', () => {
        expect(verdictOf([fire(1, 1)], [{ tx: 2, ty: 1 }])).toMatchObject({ decided: false, why: 'pulser-arm' });
        expect(verdictOf([fire(1, 1)], [{ tx: 2, ty: 2 }])).toMatchObject({ decided: false, why: 'pulser-arm' });
    });
    it('two tiles away (24 px > radiusHit 22) it does not', () => {
        expect(verdictOf([fire(0, 0)], [{ tx: 2, ty: 2 }]).why).not.toBe('pulser-arm');
    });
    it('the real rooms: L40\'s pulser@592,576 (37,36) has pushableblockfire@576,576 (36,36) beside it', () => {
        const held = buildBlockHolders(MAP).get(40);
        expect(held.pulsers).toEqual([{ tx: 37, ty: 36 }]);
        expect(held.blocks.some((b) => b.kind === 'pushableblockfire' && b.tx === 36 && b.ty === 36)).toBe(true);
    });
});

// ⛓ rules-l39 F1 — an uncut rope is solid over its whole RUN (`RopeStart.as:26`, game-witnessed on L39 by
// `probe-seedling-l39-pulser.mjs` span-blocked / span-cut / span-slash), at the cut's condition; the run's
// tiles are the rope's, so the pulley tile keeps the same price. L39's run crosses the col-9 corridor at (9,24).
describe('the rope RUN is solid at the cut\'s condition — L39 (the corridor), L16 and L28', () => {
    const CUT = conditionKey(entitySemantics({ type: 'rope' }).condition);
    const priced = (grid, x, y) => {
        const c = cellAt(grid, x, y);
        return c.kind === 'wall' ? 'WALL' : c.conditions.map(conditionKey).join('&');
    };
    it('L39: the corridor tile (9,24) costs the cut; the run\'s other tiles stand in the shaft\'s walls', () => {
        const grid = gridOf(MAP, 39);
        expect(priced(grid, 9, 24)).toBe(CUT);
        expect(cellAt(grid, 9, 23).kind).toBe('open');
        expect(cellAt(grid, 9, 25).kind).toBe('open');
    });
    it('L16: the run (2..5, 1) — (3,1) and the control\'s tile (5,1) cost the cut, the water (4,1) the cut AND Swim', () => {
        const grid = gridOf(MAP, 16);
        expect([2, 3, 5].map((x) => priced(grid, x, 1))).toEqual([CUT, CUT, CUT]);
        expect(cellAt(grid, 4, 1).conditions.map(conditionKey).sort()).toEqual([CUT, conditionKey(flag('canSwim'))].sort());
    });
    it('L28: the run (10..12, 4) costs the cut on every tile', () => {
        const grid = gridOf(MAP, 28);
        expect([10, 11, 12].map((x) => priced(grid, x, 4))).toEqual([CUT, CUT, CUT]);
    });
});

/**
 * ⛓ RULES l63-pole-crossings — a struck block's crossing, priced by its push paths: the block stops at a STOPPER (a static,
 * unkillable body) unless one of its keys is held, is destroyed on a pit, and the crossing must reach the WHOLE far side.
 */
describe('blockCrossingCost — the far side behind a pushed block', () => {
    // Row 1: the near side (x 5..6), the block (x 4), the far side (x 1..3), a pit at x 0. A stopper at x 2 when asked.
    const SPEAR = flag('hasSpear');
    const corridor = () => {
        const r = room(['#######', '#......', '#######']);
        r.grid.cells[r.at(4, 1)] = { ...r.grid.cells[r.at(4, 1)], kind: 'gated', conditions: [SPEAR] };
        r.grid.cells[r.at(1, 1)].kind = 'sink';
        r.tileTypes.set(r.at(1, 1), 6);
        return r;
    };
    const behind = { N: [[0, -1]], E: [[1, 0]], S: [[0, 1]], W: [[-1, 0]] };
    const cost = (r, { stoppers = [], stances = behind, start, goal }) => blockCrossingCost(r.grid, {
        block: { tx: 4, ty: 1, condition: SPEAR }, stances, stoppers, tileTypes: r.tileTypes, keyOf: conditionKey,
        held: [conditionKey(SPEAR)],
    }, r.at(...start), new Set(goal.map((t) => r.at(...t))));
    const WEST = [[2, 1], [3, 1]];

    it('free beyond the push item when nothing stops the block: it goes on into the pit', () => {
        expect(cost(corridor(), { start: [5, 1], goal: WEST }).sets).toEqual([[]]);
    });

    it('a stopper on the far side parks the block in the way: the crossing costs the stopper\'s key', () => {
        const stoppers = [{ tx: 2, ty: 1, keys: ['lit'], label: 'darktrap' }];
        expect(cost(corridor(), { stoppers, start: [5, 1], goal: WEST }).sets).toEqual([['lit']]);
    });

    it('a stopper no key removes: no way (the caller refuses it by name)', () => {
        const stoppers = [{ tx: 2, ty: 1, keys: [], label: 'darktrap' }];
        expect(cost(corridor(), { stoppers, start: [5, 1], goal: WEST }).sets).toEqual([]);
    });

    it('a thrust\'s stance two cells back (over a pit) still pushes, and the player stays on that stance', () => {
        const r = corridor();
        r.grid.cells[r.at(5, 1)].kind = 'sink';
        expect(cost(r, { start: [6, 1], goal: WEST }).sets).toEqual([]);
        const thrust = { N: [[0, -1], [0, -2]], E: [[1, 0], [2, 0]], S: [[0, 1], [0, 2]], W: [[-1, 0], [-2, 0]] };
        // Pushed W from [6,1] across the pit [5,1]; the player cannot follow it, so the far side stays out of reach.
        expect(cost(r, { stances: thrust, start: [6, 1], goal: WEST }).sets).toEqual([]);
    });

    // ⛓ RULES rules-block-stoppers — the one search, exported for the census: every cell the block stood on, and the
    // fatal tiles it was pushed onto.
    it('blockPushSearch with no goal: the cells the block stands on and the pit it is pushed into', () => {
        const r = corridor();
        const search = (stoppers) => blockPushSearch(r.grid, {
            block: { tx: 4, ty: 1, condition: SPEAR }, stances: behind, stoppers, tileTypes: r.tileTypes, keyOf: conditionKey,
            held: [conditionKey(SPEAR)],
        }, r.at(5, 1), null);
        const tiles = (set) => [...set].map((i) => [i % 7, Math.floor(i / 7)]).sort((a, b) => a[0] - b[0]);
        const free = search([]);
        expect(free.ok).toBe(false);
        expect(tiles(free.cells)).toEqual([[2, 1], [3, 1], [4, 1]]);
        expect(tiles(free.fatal)).toEqual([[1, 1]]);
        const parked = search([{ tx: 2, ty: 1, keys: [], label: 'darktrap' }]);
        expect(tiles(parked.cells)).toEqual([[3, 1], [4, 1]]);
        expect(parked.fatal.size).toBe(0);
    });
});
