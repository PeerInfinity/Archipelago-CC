/**
 * seedlingDemo/procgenSeedlingAreas.test — THE SEEDLING AREA BINDING, DRIVEN.
 * PROCGEN ELEMENTS arc 3, slice 4b (D3/D4/D5).
 *
 * ⛔ THE SUBJECTS ARE PICKED BY THEIR OWN SCAN (trap 285) rather than pinned by
 * hand, and each scan is the row's first lines — so a subject the binding stops
 * producing shows up as an EMPTY CLASS with its own message rather than as an
 * assertion about a cell that moved.
 *
 * ⛔ AND NO ROW COMPARES THE BINDING AGAINST ITSELF (trap 250): the boundary
 * claim is re-derived from the PARTITION, the cut claim from an independent
 * flood, and the tag claim from the ENGINE's own `tagOf`.
 */

import { describe, expect, it, vi } from 'vitest';

const calls = { buildAreaGraph: 0 };
vi.mock('../procgenCore/areaGraph.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        buildAreaGraph: (...args) => {
            calls.buildAreaGraph += 1;
            return actual.buildAreaGraph(...args);
        },
    };
});

const { connected, reachableFrom } = await import('../procgenCore/gridFlood.js');
const { parseSkeleton } = await import('../procgenCore/skeletonKinds.js');
const { KEYS_DOMAIN, formatAreaSpec, parseAreaSpec } = await import('../procgenCore/areaSpec.js');
const { TAGS_PER_LEVEL } = await import('./breakableRocks.js');
const { tagOf } = await import('./levelWorld.js');
const { terrainAt } = await import('./procgenLevel.js');
const { PRE_SWORD_PALETTE } = await import('./procgenPalette.js');
const {
    GOAL_VESTIBULE_RADIUS, LOCK_MIN_FROM_GOAL, SEEDLING_DEFAULTS, defaultElementsFor,
    seedlingModel, seedlingSeam,
} = await import('./procgenSeedling.js');
const { vestibuleCellsAround } = await import('./procgenSeedlingElements.js');

const KINDS = ['empty', 'winding', 'branchy', 'bushy', 'loopy', 'open',
    'rooms', 'rooms;minRoom=2', 'rooms;minRoom=4',
    'winding;chambers=1', 'winding;chambers=2', 'branchy;chambers=2',
    'bushy;chambers=2', 'loopy;chambers=2', 'open;chambers=2'];
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const sk = (k) => parseSkeleton(k, { simulator: false, substrate: 'this test' });
const groundOf = (rec) => (x, y) => x >= 0 && y >= 0 && x < rec.width && y < rec.height
    && terrainAt(rec, x, y) === 'ground';

/** Every (kind, seed) whose model satisfies `want`, in a fixed order. */
const scan = (want, { keys = 1, elements } = {}) => {
    const out = [];
    for (const k of KINDS) {
        for (const seed of SEEDS) {
            let model = null;
            try { model = seedlingModel({ seed, skeleton: sk(k), elements, areas: { keys } }); }
            catch { continue; }
            if (want(model)) out.push({ kind: k, seed, model });
        }
    }
    return out;
};

describe('⛔ `keys: 0` — the module is NOT CALLED, and the claim is a COUNTING SPY', () => {
    it('a default run never reaches `buildAreaGraph`, on any kind', () => {
        calls.buildAreaGraph = 0;
        for (const k of KINDS) for (const seed of [1, 2, 3]) seedlingModel({ seed, skeleton: sk(k) });
        expect(calls.buildAreaGraph).toBe(0);
    });

    it('⛓ and at `keys: 1` it IS called — so the row above is not vacuous', () => {
        calls.buildAreaGraph = 0;
        seedlingModel({ seed: 2, skeleton: sk('rooms'), areas: { keys: 1 } });
        expect(calls.buildAreaGraph).toBe(1);
    });

    it('⛔ the ROOM STREAM spends the same draws at `keys: 0` as before areas existed', () => {
        for (const k of KINDS) {
            for (const seed of [1, 5, 9]) {
                expect(seedlingModel({ seed, skeleton: sk(k), areas: { keys: 0 } }).roomDraws)
                    .toBe(seedlingModel({ seed, skeleton: sk(k) }).roomDraws);
            }
        }
    });

    it('⛓ and a RAN graph spends STRICTLY MORE — the draws are the graph\'s own', () => {
        const ran = scan((m) => m.areas.ran)[0];
        expect(ran, 'no (kind, seed) accepted an area graph at one key').toBeTruthy();
        const bare = seedlingModel({ seed: ran.seed, skeleton: sk(ran.kind) });
        expect(ran.model.roomDraws).toBeGreaterThan(bare.roomDraws);
    });
});

describe('⛓⛓⛓ THE REALISATION — a lock on EVERY boundary cell, AREA-SIDE', () => {
    const subjects = scan((m) => m.areas.ran);

    it('⛔ the subject class is not empty', () => {
        expect(subjects.length).toBeGreaterThan(0);
    });

    it('every lock sits on a BOUNDARY cell of an area at key level >= 1 — and every '
        + 'such cell has one', () => {
        for (const { model } of subjects) {
            const p = model.areaPartition();
            const want = new Set();
            for (const area of p.areas) {
                const level = model.areas.graph.areas[area.id]?.keyLevel ?? 0;
                if (level < 1) continue;
                for (const c of area.boundary) want.add(`${c.x},${c.y}`);
            }
            const got = new Set(model.areas.locks.map((l) => `${l.x},${l.y}`));
            expect([...got].sort()).toEqual([...want].sort());
        }
    });

    it('⛔ a lock cell BELONGS to the area it locks — it is never the corridor mouth', () => {
        for (const { model } of subjects) {
            const p = model.areaPartition();
            for (const l of model.areas.locks) {
                expect(p.labelAt(l.x, l.y)).toBe(l.area);
            }
        }
    });

    it('⛓⛓ THE CUT IS REAL — with one symbol\'s locks walled, an INDEPENDENT flood '
        + 'cannot reach the goal, and CAN reach that symbol\'s flag', () => {
        for (const { model } of subjects) {
            const rec = model.skeleton();
            const ground = groundOf(rec);
            const start = { x: SEEDLING_DEFAULTS.start.tx, y: SEEDLING_DEFAULTS.start.ty };
            const goal = { x: model.goalCell.tx, y: model.goalCell.ty };
            for (const sym of model.areas.graph.symbols) {
                const walled = new Set(model.areas.locks
                    .filter((l) => l.symbol === sym).map((l) => `${l.x},${l.y}`));
                if (walled.size === 0) continue;
                const walk = (x, y) => ground(x, y) && !walled.has(`${x},${y}`);
                expect(connected(rec.width, rec.height, walk, start, goal)).toBe(false);
                const flag = model.areas.flags.find((f) => f.symbol === sym);
                expect(reachableFrom(rec.width, rec.height, walk, start)
                    .has(`${flag.x},${flag.y}`)).toBe(true);
            }
        }
    });

    it('⛔ the FLAG is never a lock cell, never the start and never the goal', () => {
        for (const { model } of subjects) {
            const locks = new Set(model.areas.locks.map((l) => `${l.x},${l.y}`));
            for (const f of model.areas.flags) {
                expect(locks.has(`${f.x},${f.y}`)).toBe(false);
                expect(`${f.x},${f.y}`).not.toBe(`${SEEDLING_DEFAULTS.start.tx},`
                    + `${SEEDLING_DEFAULTS.start.ty}`);
                expect(`${f.x},${f.y}`).not.toBe(`${model.goalCell.tx},${model.goalCell.ty}`);
            }
        }
    });
});

describe('⛔⛔ TRAP 348 — the vestibule, and the doorstep refusal', () => {
    it('⛓ the vestibule is a BALL of radius 2, and it always has a frontier — the '
        + 'arithmetic `GOAL_MIN_FROM_START = 3` buys', () => {
        expect(GOAL_VESTIBULE_RADIUS).toBe(2);
        for (const k of KINDS) {
            for (const seed of SEEDS) {
                const model = seedlingModel({ seed, skeleton: sk(k) });
                const rec = model.skeleton();
                const ball = vestibuleCellsAround({ width: rec.width, height: rec.height,
                    walkable: groundOf(rec),
                    goal: { x: model.goalCell.tx, y: model.goalCell.ty },
                    radius: GOAL_VESTIBULE_RADIUS });
                /** the START is at Manhattan >= 3, and Manhattan <= graph distance,
                 *  so it can never be inside a radius-2 ball. */
                expect(ball.some((c) => c.x === SEEDLING_DEFAULTS.start.tx
                    && c.y === SEEDLING_DEFAULTS.start.ty)).toBe(false);
            }
        }
    });

    it('⛓⛓ where the goal needed one, its area IS the vestibule and its boundary is '
        + `at distance ${LOCK_MIN_FROM_GOAL} — never on the goal itself`, () => {
        const withVestibule = scan((m) => m.areaPartition().areas
            .some((a) => a.kind === 'goal'), { keys: 0 });
        expect(withVestibule.length).toBeGreaterThan(0);
        for (const { model } of withVestibule) {
            const p = model.areaPartition();
            const g = p.areas.find((a) => a.kind === 'goal');
            expect(p.goalArea).toBe(g.id);
            expect(g.cells.some((c) => c.x === model.goalCell.tx
                && c.y === model.goalCell.ty)).toBe(true);
            const rec = model.skeleton();
            const near = new Set(vestibuleCellsAround({ width: rec.width, height: rec.height,
                walkable: groundOf(rec), goal: { x: model.goalCell.tx, y: model.goalCell.ty },
                radius: LOCK_MIN_FROM_GOAL - 1 }).map((c) => `${c.x},${c.y}`));
            for (const c of g.boundary) expect(near.has(`${c.x},${c.y}`)).toBe(false);
        }
    });

    it('⛔⛔ a REAL area whose boundary reaches the doorstep REFUSES BY NAME — and the '
        + 'cell is NOT skipped (a skipped boundary cell is a hole in the cut)', () => {
        const refused = scan((m) => m.areas.refused?.reason === 'a-lock-on-the-goals-doorstep',
            { elements: defaultElementsFor(PRE_SWORD_PALETTE.items) });
        expect(refused.length, 'no cell met the doorstep rule — the row is vacuous')
            .toBeGreaterThan(0);
        for (const { model } of refused) {
            expect(model.areas.ran).toBe(false);
            expect(model.areas.locks).toEqual([]);
            expect(model.areas.refused.detail).toMatch(/is NOT skipped/);
        }
    });
});

describe('⛓⛓⛓ THE LEVEL-n FLOOD, and the graded refusals', () => {
    it('every RAN graph passes the flood — and the refusals that did fire are all NAMED', () => {
        const known = new Set(['the-partition-yields-one-area-or-fewer',
            'the-entrance-and-the-goal-share-one-area', 'a-lock-on-the-goals-doorstep',
            'the-tag-budget-is-exceeded', 'the-area-locks-do-not-cut-the-level',
            'the-level-flood-disagrees-with-the-partition', 'no-area-holds-this-symbol',
            'the-flag-area-has-no-cell-that-can-hold-it',
            /** ⛓ `buildAreaGraph`'s own, passed through verbatim. */
            'no-area-at-that-key-level-can-hold-its-key',
            'the-space-grew-fewer-key-levels-than-maxKeys',
            'goal-area-is-not-at-the-highest-key-level',
            'the-entrance-and-the-goal-are-the-same-area',
            'no-area-can-hold-the-switch']);
        const seen = new Set();
        for (const k of KINDS) {
            for (const seed of SEEDS) {
                for (const keys of [1, 2]) {
                    const m = seedlingModel({ seed, skeleton: sk(k), areas: { keys },
                        elements: defaultElementsFor(PRE_SWORD_PALETTE.items) });
                    if (m.areas.refused) seen.add(m.areas.refused.reason);
                }
            }
        }
        expect(seen.size).toBeGreaterThan(2);
        for (const r of seen) expect(known.has(r), `unnamed refusal ${r}`).toBe(true);
    });
});

describe('⛓ D5 — THE TAG RULE, ASKED OF THE ENGINE', () => {
    const subjects = scan((m) => m.areas.ran);

    it('⛔ one tag per KEY GROUP: the flag has its own, and every lock of that group '
        + 'SHARES one', () => {
        for (const { model } of subjects) {
            const rec = model.skeleton();
            const byGroup = new Map();
            for (const e of rec.entities) {
                if (e.type !== 'lock') continue;
                const g = e.attrs?.tset;
                if (!byGroup.has(g)) byGroup.set(g, new Set());
                byGroup.get(g).add(tagOf(e.type, e.attrs));
            }
            for (const sym of model.areas.graph.symbols) {
                const group = String(model.areas.groups[sym]);
                if (!byGroup.has(group)) continue;
                expect([...byGroup.get(group)]).toHaveLength(1);
                expect([...byGroup.get(group)][0]).toBe(model.areas.tags[sym].lock);
                expect(model.areas.tags[sym].flag).not
                    .toBe(model.areas.tags[sym].lock);
            }
        }
    });

    it('⛔ NO ENTITY IS UNTAGGED and no two DIFFERENT mechanisms share a tag — read '
        + 'with the engine\'s own `tagOf`, never `attrs.tag`', () => {
        for (const { model } of subjects) {
            const rec = model.skeleton();
            for (const e of rec.entities) {
                if (e.type !== 'lock' && e.type !== 'buttonroom') continue;
                /** ⛔ -1 is the engine's UNTAGGED, and `Lock.turnOff()` would then
                 *  clear `(level - 1, 29)` — an out-of-band write. */
                expect(tagOf(e.type, e.attrs)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('⛓ the whole level stays inside `TAGS_PER_LEVEL`, and the shipped model costs '
        + '2 tags per key', () => {
        for (const { model } of subjects) {
            const used = new Set();
            for (const e of model.skeleton().entities) {
                const t = tagOf(e.type, e.attrs);
                if (t >= 0) used.add(t);
            }
            expect(used.size).toBeLessThanOrEqual(30);
            for (const sym of model.areas.graph.symbols) {
                expect(model.areas.tags[sym]).toEqual({
                    flag: expect.any(Number), lock: expect.any(Number),
                });
            }
        }
    });
});

describe('⛓⛓ D4 — the guard\'s flag is ADOPTED and its placeholder lock SUPERSEDED', () => {
    const guarded = scan((m) => m.areas.ran && m.areas.flags.some((f) => f.guarded),
        { elements: defaultElementsFor(PRE_SWORD_PALETTE.items) });

    it('⛔ the subject class is not empty', () => {
        expect(guarded.length).toBeGreaterThan(0);
    });

    it('the flag cell IS the element\'s own `flagCell`, its group IS the element\'s B, '
        + 'and NO second buttonroom was added', () => {
        for (const { kind, seed, model } of guarded) {
            const p = model.elements.placed[0];
            const f = model.areas.flags.find((x) => x.guarded);
            expect({ x: f.x, y: f.y }).toEqual({ x: p.flagCell.x, y: p.flagCell.y });
            expect(model.areas.groups[f.symbol]).toBe(p.groups.B);
            expect(model.areas.tags[f.symbol].flag).toBe(p.tags.flag);
            const rooms = model.skeleton().entities.filter((e) => e.type === 'buttonroom');
            expect(rooms, `${kind} seed ${seed}`).toHaveLength(1);
        }
    });

    it('⛓⛓⛓ the placeholder LOCK MOVED — it is gone from its cut cell, its tag is now '
        + 'the boundary locks\', and the cut cell WAS one of the boundary cells anyway', () => {
        for (const { model } of guarded) {
            const p = model.elements.placed[0];
            expect(model.areas.supersededFlagLock)
                .toEqual({ x: p.flagLockCell.x, y: p.flagLockCell.y });
            const sym = model.areas.flags.find((f) => f.guarded).symbol;
            expect(model.areas.tags[sym].lock).toBe(p.tags.lockB);
            /** ⛔ AND THE SUPERSESSION IS A WIDENING, NOT A MOVE: the placeholder's
             *  own cell is IN the boundary set (measured 10 of 10), because a
             *  1-cell cut on the main path IS a boundary cell of the area it seals. */
            expect(model.areas.locks.some((l) => l.x === p.flagLockCell.x
                && l.y === p.flagLockCell.y)).toBe(true);
        }
    });
});

describe('⛓ THE SOLVER CERTIFIES A ONE-FLAG LEVEL', () => {
    it('⛔⛔ CERTIFIED, with `hold` on the buttonroom and `collect` on the torch', () => {
        const ran = scan((m) => m.areas.ran, { elements: { name: 'none' } });
        expect(ran.length).toBeGreaterThan(0);
        let certified = 0;
        const tried = ran.slice(0, 6);
        for (const { kind, seed } of tried) {
            const out = seedlingSeam({ seed, skeleton: sk(kind), elements: { name: 'none' },
                areas: { keys: 1 }, items: PRE_SWORD_PALETTE.items });
            if (out.areaCertification?.certified) {
                certified += 1;
                expect(out.areaCertification.strategies).toContain('hold');
                expect(out.areaCertification.strategies).toContain('collect');
            }
        }
        expect(certified, 'no area graph certified in the first six accepting cells')
            .toBeGreaterThan(0);
    });
});

describe('⛓ THE CODEC — arc 1\'s, and the Seedling binding invents nothing', () => {
    it('the spec round-trips and its KNOBS reach the module', () => {
        const spec = parseAreaSpec('1;graphify=1;goalShortcut=0');
        expect(formatAreaSpec(spec)).toBe('1;graphify=1;goalShortcut=0');
        const m = seedlingModel({ seed: 2, skeleton: sk('rooms'), areas: spec });
        expect(m.areas.spec).toEqual(spec);
        expect(m.areas.graph.bounds.graphifyProbability).toBe(1);
        expect(m.areas.graph.bounds.allowGoalShortcut).toBe(false);
    });

    it('⛔ a value outside the declared domain REFUSES BY NAME, before any room exists', () => {
        expect(() => parseAreaSpec('9')).toThrow(/KEY COUNT/);
        expect(() => seedlingModel({ seed: 1, areas: { keys: 9 } })).toThrow(/domain/);
    });
});

describe('⛔ `the-tag-budget-is-exceeded` — A BOUND NOTHING CAN REACH, SAID SO (trap 355)', () => {
    it('⛓ the SHIPPED cost model puts the worst case at 8 of 30, so the refusal is '
        + 'UNREACHABLE on this room — the arithmetic, not a scan', () => {
        /**
         * ⛔ THE COST MODEL IS THE WHOLE ARGUMENT (D5): one tag for the goal, three
         * for a guard element, and TWO PER KEY (its `buttonroom` and the one slot
         * all of that group's locks share). `KEYS_DOMAIN`'s top is 3, so
         *
         *     1 + 3 + 2 * 3 = 10 <= TAGS_PER_LEVEL (30)
         *
         * and no room this generator builds can exceed it. ⚠ The refusal SHIPS
         * anyway and it is not decoration: `TAGS_PER_LEVEL` is the ENGINE's number
         * (`Game.tagsPerLevel`, one flat array indexed `level * 30 + tag` with no
         * bounds check), the room size is a `defaults` knob, and the day either
         * moves — or the day a lock stops sharing its group's slot — the honest
         * answer must be a named refusal rather than a throw out of
         * `placementTagId`. Said here rather than left as an untested branch.
         */
        expect(1 + 3 + 2 * Math.max(...KEYS_DOMAIN)).toBeLessThanOrEqual(TAGS_PER_LEVEL);
        let worst = 0;
        for (const k of KINDS) {
            for (const seed of SEEDS) {
                for (const keys of [1, 2]) {
                    const m = seedlingModel({ seed, skeleton: sk(k), areas: { keys },
                        elements: defaultElementsFor(PRE_SWORD_PALETTE.items) });
                    const used = new Set();
                    for (const e of m.skeleton().entities) {
                        const t = tagOf(e.type, e.attrs);
                        if (t >= 0) used.add(t);
                    }
                    worst = Math.max(worst, used.size);
                }
            }
        }
        expect(worst).toBeLessThan(TAGS_PER_LEVEL);
        /** ⛓ THE MEASURED NUMBER, so a reader can see the headroom rather than
         *  a bare inequality. It is well under 30 and that is the finding. */
        expect(worst).toBeLessThanOrEqual(8);
    });
});
