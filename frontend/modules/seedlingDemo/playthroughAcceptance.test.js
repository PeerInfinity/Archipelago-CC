/**
 * playthroughAcceptance / playthroughWalk — ENDS-MEET v2, and the mutations
 * that prove it bites. R7 slice 2.
 *
 * ⛔ THE POINT OF EVERY TEST HERE: R1's chain claim could be satisfied by
 * six tapes that walked the same PATH from six unrelated STATES. The seam
 * is what closes that, so every mutation below breaks the chain in a way
 * R1's four assertions (level, position, item set, hitsMax) would not have
 * noticed — a moved seam field, a staged first segment, a swapped ending
 * state — and asserts the corresponding row goes red.
 */

import { describe, it, expect } from 'vitest';
import {
    L5_ARROW_BAIT, PLAYTHROUGH_CHAINS, PlaythroughError, TRUE_INITIAL_BOOT,
    assertChainsWellFormed, assertWalkUnits, isPlaythroughSegment,
    playthroughSegmentNames, playthroughTapeNames, walkGroups,
} from './playthroughWalk.js';
import {
    chainFindings, latchAgreementFindings, witnessedClearFindings,
} from './playthroughAcceptance.js';
import {
    SEAM_SIGNATURE, SEAM_PREBUILD_FIELDS, seamExitFields, segmentBootFromLatch,
} from './r7Acceptance.js';
import { parseTape, TAPE_VERSION } from './tapeFormat.js';

/**
 * A synthetic two-segment chain, built the way the real one is: segment 2
 * is AUTHORED FROM segment 1's latch, so the seam is green by construction
 * and every red below is caused by the mutation and nothing else.
 */
const CUT = 4;
const END = 9;

function latchAt(over = {}) {
    const seam = {
        level: 94,
        playerPositionX: 288,
        playerPositionY: 160,
        'save.hasSword': false,
        'save.hasGhostSword': false,
        'save.hasShield': false,
        'save.hasFire': false,
        'save.hasWand': false,
        'save.hasFireWand': false,
        'save.canSwim': false,
        'save.hasSpear': false,
        'save.hasDarkShield': false,
        'save.hasDarkSuit': false,
        'save.hasDarkSword': false,
        'save.hasFeather': false,
        'save.hasTorch': false,
        'save.beam': false,
        'save.rockSet': false,
        'save.hitsMax': 3,
        'save.firstUse': true,
        'save.extended': false,
        'save.time': 900,
        'save.primary': 0,
        'save.secondary': 0,
        'save.grassCut': 0,
        'save.hasKey': [false, false, false, false, false],
        'save.hasTotemPart': [false, false, false, false, false],
        'save.hasSealPart': Array.from({ length: 16 }, () => -1),
        'save.levelPersistence': [],
        'save.hasBadge': [false],
        'static.Game.cutscene': [false, false, false, false],
        'static.Game.shake': 0,
        'static.Game.menu': false,
        'static.Game.menuState': 0,
        'static.Game.freezeObjects': false,
        'static.Game.talking': false,
        'static.Game.inventory': [],
        'static.Music.currentSet': 'Rock',
        'static.Music.currentIndex': 0,
        'static.Rng.split': true,
        'static.Bot.pins': { sound: false, dead_frames: true },
        'rng.gameplay': 55512345,
        'rng.cosmetic': 777,
        'fp.seed': 987286273,
        'arrival.blackCover': 0,
        'arrival.velocity': { vx: 0, vy: 0, hits: 0, hits_timer: 0 },
        'latch.tick': CUT,
        'latch.dead_frames': 20,
    };
    /**
     * ⛓ R7 slice 2b: THE `Game.begin()`-ENTRY BLOCK, and its four values are
     * DELIBERATELY NOT the terminal ones.
     *
     * A boundary at an arrival duplicates one level BUILD, so a real latch's
     * terminal `rng.gameplay` is one build's draws ahead of its entry
     * reading and its `save.time` one fade's dead frames ahead. Making the
     * two blocks agree here would have let a consumer that reads the WRONG
     * block pass every test — the vacuity that `seamExitFields` and
     * `segmentBootFromLatch` exist to be pinned against.
     *
     * ⛔ AND `over` ROUTES BY FIELD, not to both blocks. A prebuild field in
     * `over` lands in the ENTRY block only, so the whole-signature mutation
     * sweep below keeps biting through the block the code really reads. If a
     * consumer ever went back to the terminal value, that sweep would go
     * green on four rows and say so.
     */
    const entry = {
        'begin.level': 94,
        'begin.tick': CUT,
        'rng.gameplay': 55512345,
        'rng.cosmetic': 777,
        'fp.seed': 987286273,
        'save.time': 900,
    };
    // …and the terminal block is one build past all four.
    seam['rng.gameplay'] = 1414141;
    seam['rng.cosmetic'] = 999;
    seam['fp.seed'] = 123456789;
    seam['save.time'] = 921;
    const prebuild = new Set(SEAM_PREBUILD_FIELDS);
    for (const [k, v] of Object.entries(over)) {
        if (prebuild.has(k)) entry[k] = v; else seam[k] = v;
    }
    return { latched: true, partial: false, why: '', seam, beginEntry: entry };
}

const stream = (from, to, mapper = (t) => ({ t, x: 10 + t, y: 20, level: t >= 0 ? 0 : 0 })) => ({
    ticks: Array.from({ length: to - from + 1 }, (_, i) => mapper(from + i)),
});

const baseTape = (over) => parseTape({
    tape_version: TAPE_VERSION,
    game: 'seedling',
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: [],
    equips: [],
    pins: ['dead_frames'],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 0, split: false, cosmetic: 0, fp: 987286273 },
    seam: null,
    inputs: [],
    ...over,
});

/** The chain under test: headline 0..END, segments 0..CUT and CUT..END. */
function buildChain(mutate = {}) {
    const latch = mutate.latch ?? latchAt();
    const blocks = segmentBootFromLatch(latch);
    const tapes = new Map([
        ['H', baseTape({ boot: { ...TRUE_INITIAL_BOOT }, tick_count: END })],
        ['S1', baseTape({ boot: { ...TRUE_INITIAL_BOOT }, tick_count: CUT })],
        ['S2', baseTape({ ...blocks, tick_count: END - CUT })],
    ]);
    if (mutate.tapes) mutate.tapes(tapes);
    const headStream = stream(0, END);
    const replayed = new Map([
        ['H', { stream: headStream, status: {}, seam: latchAt({ 'latch.tick': END }) }],
        ['S1', { stream: stream(0, CUT), status: {}, seam: latch }],
        ['S2', {
            stream: { ticks: headStream.ticks.slice(CUT).map((o) => ({ ...o, t: o.t - CUT })) },
            status: {},
            seam: latchAt({ 'latch.tick': END - CUT }),
        }],
    ]);
    if (mutate.replayed) mutate.replayed(replayed);
    const chain = {
        id: 'test', headline: 'H', segments: ['S1', 'S2'], cuts: [CUT], endsAt: END,
    };
    return chainFindings(chain, tapes, replayed);
}

const reds = (f) => f.filter((r) => !r.ok).map((r) => r.name);

describe('playthroughWalk — the chain as data', () => {
    // ⛔⛔ AGAINST THE REAL ROSTER ON DISK, and it must be: passing a roster
    // derived from `playthroughTapeNames()` would be the chain checking
    // itself, which is the one thing this assertion exists to prevent. A
    // renamed or unrecorded fixture is a NAMED failure here, not a silently
    // empty chain that reports the same green as a working one.
    it('every chain names a REAL fixture on disk', () => {
        const r = assertChainsWellFormed();
        expect(r.chains).toBe(PLAYTHROUGH_CHAINS.length);
        expect(r.seams).toBe(r.segments - r.chains);
    });

    it('a chain is ordered and has exactly N-1 cuts', () => {
        const roster = [...playthroughTapeNames(),
            ...PLAYTHROUGH_CHAINS.map((c) => c.freeOracle).filter(Boolean)];
        const r = assertChainsWellFormed(roster);
        expect(r.seams).toBe(r.segments - r.chains);
    });

    it('⛔ MUTATION: a chain naming a tape that is not a fixture THROWS', () => {
        expect(() => assertChainsWellFormed(['nothing-like-it']))
            .toThrow(PlaythroughError);
        expect(() => assertChainsWellFormed(['nothing-like-it']))
            .toThrow(/asserts nothing/);
    });

    it('the segment predicate is what `requireCalm` branches on', () => {
        for (const n of playthroughSegmentNames()) expect(isPlaythroughSegment(n)).toBe(true);
        expect(isPlaythroughSegment('transition-west-return')).toBe(false);
        // ⚠ The headline is NOT a segment: it does not claim an arrival at a
        // boundary, it IS the walk the boundaries partition.
        for (const c of PLAYTHROUGH_CHAINS) expect(isPlaythroughSegment(c.headline)).toBe(false);
    });
});

/**
 * ── ⛓⛓⛓ R7 SLICE 6d: THE UNITS, AND WHY THEIR SHAPE IS ASSERTED ──────
 *
 * A `leg` is planner-authored and cannot lie about its own ticks — A*
 * derives them and `--check` re-derives them. A `phases` block is the
 * opposite: every number in it is TYPED, so it is the one place in this
 * machinery where a stale measurement can sit and still pass. These are the
 * refusals that make a hand-authored block checkable.
 */
describe('playthroughWalk — a walk is a sequence of UNITS', () => {
    const withUnits = (units) => ({ id: 'test', walk: { units } });
    const LEG = { leg: { level: 0, targets: [] } };
    const phasesBlock = (over = {}) => ({
        phases: {
            id: 'p', why: 'w', provenance: { probe: 'x' },
            startsAt: { level: 5, x: 80, y: 32 }, startsAtTick: 0,
            endsAt: { level: 5, x: 48, y: 48 },
            steps: [{ label: 'a', ticks: 3 }, { label: 'b', ticks: 7 }],
            ticks: 10,
            spans: [{ key: 'left', from: 0, to: 4 }],
            earns: [{ level: 5, tag: 0 }],
            outcome: { cleared: ['5,0'], enemies: 0 },
            ...over,
        },
    });

    it('counts the two kinds, and the real chain carries both', () => {
        expect(assertWalkUnits(withUnits([LEG, phasesBlock(), LEG])))
            .toEqual({ units: 3, legs: 2, phases: 1 });
        // ⛔ AGAINST THE COMMITTED CHAIN, not a synthetic one: the whole point
        // of slice 6d is that a REAL chain is heterogeneous, and a test that
        // only ever saw synthetic units would stay green through a chain that
        // quietly went back to being all legs.
        const mixed = PLAYTHROUGH_CHAINS.filter((c) => c.walk?.units)
            .map((c) => assertWalkUnits(c));
        expect(mixed.some((r) => r.legs > 0 && r.phases > 0)).toBe(true);
    });

    it('⛔ MUTATION: a unit that is both kinds, or neither, THROWS', () => {
        expect(() => assertWalkUnits(withUnits([{ ...LEG, ...phasesBlock() }])))
            .toThrow(/exactly one of/);
        expect(() => assertWalkUnits(withUnits([{}]))).toThrow(/exactly one of/);
    });

    it('⛔ MUTATION: a phases block whose STEPS do not sum to its ticks THROWS', () => {
        expect(() => assertWalkUnits(withUnits([phasesBlock({ ticks: 11 })])))
            .toThrow(/steps sum to 10 and it declares 11/);
    });

    it('⛔ MUTATION: a span outside [0, ticks) THROWS', () => {
        expect(() => assertWalkUnits(withUnits([
            phasesBlock({ spans: [{ key: 'left', from: 0, to: 11 }] })])))
            .toThrow(/non-empty \[from, to\)/);
        expect(() => assertWalkUnits(withUnits([
            phasesBlock({ spans: [{ key: 'left', from: 4, to: 4 }] })])))
            .toThrow(/non-empty \[from, to\)/);
    });

    it('⛔ MUTATION: a block with no provenance or no outcome THROWS', () => {
        for (const field of ['provenance', 'outcome', 'startsAt', 'startsAtTick',
            'endsAt', 'spans']) {
            const block = phasesBlock();
            delete block.phases[field];
            expect(() => assertWalkUnits(withUnits([block])), `missing ${field}`)
                .toThrow(new RegExp(`declares no ${field}`));
        }
    });

    /**
     * ⛔⛔ THE SHARPEST ONE. A block's `earns` is what every LATER leg is
     * planned against — the crossing through L5's kill-lock only has a route
     * because `{5,0}` is cleared — so a block that earns a clear its outcome
     * does not assert would move the planner's world without ever asking the
     * game whether the game moved too. That is a plan against a fiction, and
     * it would be GREEN everywhere else: the seam compares state, and the
     * state would agree.
     */
    it('⛔ MUTATION: a block that EARNS a clear its outcome does not assert THROWS', () => {
        expect(() => assertWalkUnits(withUnits([phasesBlock({ outcome: { cleared: [] } })])))
            .toThrow(/may not change the world the planner sees/);
        expect(() => assertWalkUnits(withUnits([
            phasesBlock({ earns: [{ level: 6, tag: 0 }] })])))
            .toThrow(/may not change the world the planner sees/);
    });

    it('⛔ MUTATION: a walk that spells itself twice THROWS', () => {
        expect(() => assertWalkUnits({ id: 't', walk: { units: [LEG], legs: [] } }))
            .toThrow(/exactly one spelling/);
    });

    /**
     * ⛓ THE GROUPING IS WHAT THE PLANNER CALLS `synthesizeLegs` WITH, and
     * consecutive legs MUST stay in one call: the driver carries a live run
     * across a crossing, and two calls would re-boot the second half at a
     * declared position and lose the arrival fade with it.
     */
    it('groups consecutive legs into ONE call and cuts only at phases', () => {
        const g = walkGroups(withUnits([LEG, LEG, phasesBlock(), LEG]));
        expect(g.map((x) => x.kind)).toEqual(['legs', 'phases', 'legs']);
        expect(g[0].legs.length).toBe(2);
        expect(g[2].legs.length).toBe(1);
    });

    it('the committed L5 block is the probe\'s own numbers', () => {
        // ⚠ Pinned by ARITHMETIC, not by copying the list: the six steps and
        // the 737 are the probe's `press 61 + clear 240 + bait 68 + dwell 40
        // + back 68 + hold 260`, and the spans have to fit inside them.
        expect(L5_ARROW_BAIT.ticks).toBe(737);
        expect(L5_ARROW_BAIT.steps.map((s) => s.ticks)).toEqual([61, 240, 68, 40, 68, 260]);
        expect(L5_ARROW_BAIT.provenance.probe)
            .toBe('scripts/procgen/probe-seedling-r7-l5-arrows.mjs');
        // The block's two controls are named, because a single arm that
        // cleared the lock is a lock that was going to open.
        expect(L5_ARROW_BAIT.provenance.controls.length).toBe(2);
        expect(Math.max(...L5_ARROW_BAIT.spans.map((s) => s.to)))
            .toBeLessThanOrEqual(L5_ARROW_BAIT.ticks);
    });
});

/**
 * ── ⛓⛓⛓ THE WITNESSED-CLEAR LAW (slice 6d, ⚖ ruled) ──────────────────
 *
 * A v9 `at`-clear is the one tape field that can move the world MID-RUN, so
 * it is fenced: no `at` without a `phases` block in the same chain that
 * EARNS that tag and whose end tick is `at`. Without this row the field
 * would be a place to type any flag at any tick and call it earned.
 */
describe('witnessedClearFindings — no `at`-clear nobody measured', () => {
    const block = (over = {}) => ({
        id: 'b', why: 'w', provenance: { probe: 'p.mjs' },
        startsAt: { level: 5, x: 80, y: 32 }, startsAtTick: 10,
        endsAt: { level: 5, x: 48, y: 48 },
        steps: [{ label: 'a', ticks: 20 }], ticks: 20,
        spans: [], earns: [{ level: 5, tag: 0 }],
        outcome: { cleared: ['5,0'], enemies: 0 }, ...over,
    });
    const chainWith = (b, at) => ({
        id: 'test',
        headline: 'H',
        segments: ['S1'],
        walk: { units: [{ leg: { level: 5, targets: [] } }, { phases: b }] },
        tapes: new Map([
            ['S1', { tick_count: 50, persistence: at === null ? []
                : [{ level: 5, tag: 0, at }] }],
            ['H', { tick_count: 50, persistence: at === null ? []
                : [{ level: 5, tag: 0, at }] }],
        ]),
    });
    const run = (c) => witnessedClearFindings(c, c.tapes);

    it('a clear at the block\'s own end tick is WITNESSED', () => {
        const rows = run(chainWith(block(), 30));
        expect(rows.every((r) => r.ok)).toBe(true);
        expect(rows.length).toBe(2);       // one per tape that carries it
        expect(rows[0].detail).toMatch(/p\.mjs/);
    });

    it('⛔ MUTATION: a clear at ANY OTHER tick goes RED', () => {
        for (const at of [29, 31, 0]) {
            const rows = run(chainWith(block(), at));
            expect(rows.some((r) => !r.ok), `at=${at}`).toBe(true);
        }
    });

    it('⛔ MUTATION: a clear NO block earns goes RED', () => {
        const rows = run(chainWith(block({ earns: [] }), 30));
        expect(rows.some((r) => !r.ok)).toBe(true);
        expect(rows.find((r) => !r.ok).detail).toMatch(/staged grant with extra steps/);
    });

    it('a chain with no `at`-clear REPORTS the absence rather than going silent', () => {
        const rows = run(chainWith(block(), null));
        expect(rows.length).toBe(1);
        expect(rows[0].ok).toBe(true);
        expect(rows[0].name).toMatch(/no tape declares a mid-run clear/);
    });
});

describe('chainFindings — ENDS-MEET v2', () => {
    it('an honest chain is GREEN on every claim', () => {
        expect(reds(buildChain())).toEqual([]);
    });

    it('⛔ MUTATION: a MISSING tape is a NAMED SKIP, never a silence', () => {
        const f = buildChain({ replayed: (r) => r.delete('S2') });
        expect(f.length).toBe(1);
        expect(f[0].skipped).toBe(true);
        expect(f[0].name).toMatch(/SKIPPED/);
        expect(f[0].name).toMatch(/S2/);
    });

    it('⛔ MUTATION: a first segment that INHERITS breaks the custody base case', () => {
        const f = buildChain({
            tapes: (t) => t.set('S1', baseTape({
                boot: { ...TRUE_INITIAL_BOOT },
                tick_count: CUT,
                grants: [{ level: 0, items: ['sword'] }],
            })),
        });
        expect(reds(f)).toContain('chain test: segment 1 boots the TRUE INITIAL STATE '
            + 'and inherits nothing');
    });

    it('⛔ MUTATION: a first segment booting somewhere else breaks it too', () => {
        const f = buildChain({
            tapes: (t) => t.set('S1', baseTape({
                boot: { level: 20, x: 80, y: 128 }, tick_count: CUT,
            })),
        });
        expect(reds(f)).toContain('chain test: segment 1 boots the TRUE INITIAL STATE '
            + 'and inherits nothing');
    });

    it('⛔ MUTATION: tick counts that do not sum to the headline\'s go red', () => {
        const f = buildChain({
            tapes: (t) => t.set('S2', parseTape({
                ...JSON.parse(JSON.stringify(t.get('S2'))), tick_count: END - CUT + 1,
            })),
        });
        expect(reds(f)).toContain('chain test: the segment tick counts sum to the '
            + "headline's");
    });

    it('⛔ MUTATION: a segment that walks a different path goes red on the SLICE', () => {
        const f = buildChain({
            replayed: (r) => {
                const s2 = r.get('S2');
                r.set('S2', {
                    ...s2,
                    stream: { ticks: s2.stream.ticks.map((o, i) => (i === 2
                        ? { ...o, x: o.x + 1 } : o)) },
                });
            },
        });
        expect(reds(f).some((n) => n.includes('S2 is the headline\'s ticks'))).toBe(true);
    });

    it('⛔⛔ MUTATION: ONE seam field moved breaks the SEAM and nothing else', () => {
        // The whole reason ENDS-MEET v2 exists. R1's four assertions —
        // level, position, item set, hitsMax — see NOTHING here: the walk is
        // identical, the positions are identical, no item moved. Only the
        // seam notices.
        const f = buildChain({
            tapes: (t) => {
                const s2 = JSON.parse(JSON.stringify(t.get('S2')));
                s2.seam.grass_cut = 3;   // the latch says 0
                t.set('S2', parseTape(s2));
            },
        });
        expect(reds(f)).toEqual(['chain test: ⛓ THE SEAM S1 -> S2 is GREEN over the '
            + 'whole signature']);
    });

    it('⛔ MUTATION: a NOT-CALM arrival breaks the segment that claims one', () => {
        for (const [field, bad] of [['static.Game.shake', 4],
            ['static.Game.freezeObjects', true], ['arrival.blackCover', 0.6],
            ['static.Game.talking', true], ['static.Game.menu', true],
            ['arrival.velocity', { vx: -1.5, vy: 0, hits: 0, hits_timer: 0 }]]) {
            const f = buildChain({
                replayed: (r) => r.set('S1', {
                    ...r.get('S1'), seam: latchAt({ [field]: bad }),
                }),
            });
            expect(reds(f), field).toContain('chain test: S1 ends at a CALM ARRIVAL');
        }
    });

    it('⛔ MUTATION: a PARTIAL latch is an unclaimed seam, never a green one', () => {
        const f = buildChain({
            replayed: (r) => r.set('S1', {
                ...r.get('S1'),
                seam: { ...latchAt(), partial: true, why: 'pin fault: dead_frames' },
            }),
        });
        expect(reds(f)).toContain('chain test: S1 ends at a CALM ARRIVAL');
    });

    it('⛔ MUTATION: NO latch at all is red, not skipped', () => {
        const f = buildChain({
            replayed: (r) => r.set('S1', { ...r.get('S1'), seam: null }),
        });
        expect(reds(f)).toContain('chain test: S1 ends at a CALM ARRIVAL');
        expect(reds(f)).toContain('chain test: ⛓ THE SEAM S1 -> S2 is GREEN over the '
            + 'whole signature');
    });

    it('⛔⛔ MUTATION: the ENDING STATE is its own claim — same path, different state', () => {
        // Every position identical, every tick count right, the seam green —
        // and the chain ended holding something the headline did not. This
        // is the row that catches it and it is the only one that can.
        const f = buildChain({
            replayed: (r) => r.set('S2', {
                ...r.get('S2'),
                seam: latchAt({ 'latch.tick': END - CUT, 'save.hasSword': true }),
            }),
        });
        expect(reds(f)).toEqual(['chain test: ⛓ THE ENDING STATE — the chain ends where '
            + 'the headline ends, field by field, with NO offset declared anywhere']);
    });

    it('⛓ THE BRIDGE IS GONE, and the ending state is an EQUALITY on every row', () => {
        // ⛔ R7 slice 2b step 4 — the step everything stays green without
        // taking. Slice 2's chain declared `seamBuildCost` and `chainFindings`
        // EXEMPTED `rng.gameplay` and `save.time` from the ending-state claim,
        // asserting them offset instead. With the begin()-entry latch the
        // offset is zero, so the exemption has to go — a declared offset that
        // is no longer measuring anything still passes, which is trap 119's
        // shape and the reason this deletion is a named step.
        for (const chain of PLAYTHROUGH_CHAINS) {
            expect(chain.seamBuildCost, `${chain.id} must not declare a build cost`)
                .toBeUndefined();
        }
        // …and a chain whose ending state moves on EITHER formerly-exempt row
        // now goes red, which it could not have done while the bridge stood.
        for (const field of ['rng.gameplay', 'save.time']) {
            const base = latchAt().seam;
            const f = buildChain({
                replayed: (r) => r.set('S2', {
                    ...r.get('S2'),
                    seam: {
                        ...latchAt({ 'latch.tick': END - CUT }),
                        seam: { ...base, [field]: base[field] + 1562 },
                    },
                }),
            });
            expect(reds(f), `ending state must catch a moved ${field}`)
                .toContain('chain test: ⛓ THE ENDING STATE — the chain ends where the '
                    + 'headline ends, field by field, with NO offset declared anywhere');
        }
    });

    it('⛔ MUTATION: a boundary tick the two segments disagree about goes red', () => {
        const f = buildChain({
            replayed: (r) => {
                const s2 = r.get('S2');
                const ticks = s2.stream.ticks.map((o, i) => (i === 0 ? { ...o, y: 99 } : o));
                r.set('S2', { ...s2, stream: { ticks } });
            },
        });
        expect(reds(f)).toContain('chain test: the boundary tick is observed twice '
            + 'and agrees');
    });
});

describe('latchAgreementFindings — two MEASURED states', () => {
    it('emits one row per signature field', () => {
        const f = latchAgreementFindings('X', latchAt().seam, latchAt().seam);
        expect(f.length).toBe(SEAM_SIGNATURE.length);
        expect(f.every((r) => r.ok)).toBe(true);
    });

    it('⛔ an absence on either side is a defect in the READOUT, not a design choice', () => {
        const a = { ...latchAt().seam };
        delete a['save.grassCut'];
        const f = latchAgreementFindings('X', a, latchAt().seam);
        const row = f.find((r) => r.name === 'X: save.grassCut');
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/UNCLAIMED/);
    });

    it('`fp.seed` is reported and not compared — the page-lifetime LCG', () => {
        // ⛔ THE TERMINAL MAP IS PERTURBED DIRECTLY, NOT THROUGH `over`. R7
        // slice 2b: `latchAgreementFindings` compares two TERMINAL latches
        // (the ending-state claim — where two runs stopped), while `over`
        // routes prebuild fields into the `beginEntry` block that the SEAM
        // reads. Going through `over` here would leave both terminal maps
        // identical and the assertion would pass without testing anything.
        const a = latchAt().seam;
        const f = latchAgreementFindings('X', a, { ...a, 'fp.seed': 12345 });
        const row = f.find((r) => r.name === 'X: fp.seed');
        expect(row.ok).toBe(true);
        expect(row.detail).toMatch(/DECLARED, NOT COMPARED/);
        // …and every other field still compares.
        const moved = latchAgreementFindings('X', a, { ...a, 'save.time': 901 });
        expect(moved.find((r) => r.name === 'X: save.time').ok).toBe(false);
    });
});
