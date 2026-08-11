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
    CHAIN_KINDS, L5_ARROW_BAIT, L6_BOB_DROWN, PLAYTHROUGH_CHAINS, PlaythroughError,
    TRUE_INITIAL_BOOT, assertChainsWellFormed, assertWalkUnits, chainKind, chainPolicy,
    isPlaythroughSegment, playthroughSegmentNames, playthroughTapeNames, walkGroups,
} from './playthroughWalk.js';
import {
    chainFindings, chainGoalFindings, latchAgreementFindings, witnessedClearFindings,
    witnessedDespawnFindings,
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
    despawn: [],
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
        // ⛓ R8 slice 0: undefined by default, which is what makes the
        // `custody` default the thing under test rather than a setting.
        ...(mutate.kind === undefined ? {} : { kind: mutate.kind }),
    };
    return chainFindings(chain, tapes, replayed);
}

const reds = (f) => f.filter((r) => !r.ok).map((r) => r.name);

/**
 * ⛓ R8 slice 0: the goal-ledger harness with a KIND knob. Same shape as the
 * R7 block's `goalChain` — segment 2 picks the sword up, so it boots without
 * the flag and latches with it plus the `{10,0}` clear `Sword.removed()`
 * writes — with the chain's `kind` as the only extra dial. `undefined` means
 * the entry declares no kind at all, which is what makes `custody` the
 * DEFAULT under test rather than a setting.
 */
function goalChainKind(kind, earns = ['sword@L10']) {
    const CUT2 = 40;
    const HELD = {
        'save.hasSword': true,
        'save.levelPersistence': [{ level: 10, tag: 0 }],
    };
    const before = latchAt({ 'latch.tick': CUT });
    const after = latchAt({ 'latch.tick': CUT2, ...HELD });
    const tapes = new Map([
        ['S1', baseTape({ boot: { ...TRUE_INITIAL_BOOT }, tick_count: CUT })],
        ['S2', baseTape({ ...segmentBootFromLatch(before), tick_count: CUT2 })],
    ]);
    const replayed = new Map([
        ['S1', { stream: stream(0, CUT), status: {}, seam: before }],
        ['S2', { stream: stream(0, CUT2), status: {}, seam: after }],
    ]);
    return chainGoalFindings({
        id: 'goal-kind', headline: 'H', segments: ['S1', 'S2'],
        cuts: [CUT], endsAt: CUT + CUT2, earns,
        ...(kind === undefined ? {} : { kind }),
    }, tapes, replayed);
}

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
        // ⚠ A MULTI-segment chain's headline is NOT a segment: it does not
        // claim an arrival at a boundary, it IS the walk the boundaries
        // partition. ⛓ R8 slice 2: a ONE-segment staged chain's headline IS
        // its segment by definition — "the same walk driven in one run" and
        // the segment are the same tape, which is what lets the arithmetic,
        // stream-slice and ending-state rows run with real content instead
        // of skipping on a missing name.
        for (const c of PLAYTHROUGH_CHAINS) {
            expect(isPlaythroughSegment(c.headline))
                .toBe(c.segments.length === 1 && c.segments[0] === c.headline);
        }
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

/**
 * ── ⛓⛓⛓ THE SAME LAW FOR THE V10 FIELD (R7 slice 6e) ─────────────────
 *
 * A `despawn` is the one tape field that can take a BODY out of the world
 * mid-run, so it is fenced exactly as `at` is: no removal without a `phases`
 * block in the same chain that REMOVES that id and whose end tick is `at`.
 * Without this row the field would be a place to delete any body at any tick
 * and call it drowned.
 */
describe('witnessedDespawnFindings — no removal nobody measured', () => {
    const block = (over = {}) => ({
        id: 'b', why: 'w', provenance: { probe: 'p.mjs' },
        startsAt: { level: 6, x: 32, y: 16 }, startsAtTick: 10,
        endsAt: { level: 6, x: 48, y: 16 },
        steps: [{ label: 'a', ticks: 20 }], ticks: 20,
        spans: [], removes: [{ level: 6, id: 'bob@112,48' }],
        outcome: { cleared: [], enemies: 1 }, ...over,
    });
    const chainWith = (b, at, id = 'bob@112,48') => ({
        id: 'test',
        headline: 'H',
        segments: ['S1'],
        walk: { units: [{ leg: { level: 6, targets: [] } }, { phases: b }] },
        tapes: new Map([
            ['S1', { tick_count: 50, persistence: [], despawn: at === null ? []
                : [{ level: 6, id, at }] }],
            ['H', { tick_count: 50, persistence: [], despawn: at === null ? []
                : [{ level: 6, id, at }] }],
        ]),
    });
    const run = (c) => witnessedDespawnFindings(c, c.tapes);

    it('a removal at the block\'s own end tick is WITNESSED', () => {
        const rows = run(chainWith(block(), 30));
        expect(rows.every((r) => r.ok)).toBe(true);
        expect(rows.length).toBe(2);       // one per tape that carries it
        expect(rows[0].detail).toMatch(/p\.mjs/);
        // ⛓ and the row REPORTS the count the game was asked for, so a
        // reader can tell which measurement backs it without opening the probe
        expect(rows[0].detail).toMatch(/asked for 1 body/);
    });

    it('⛔ MUTATION: a removal at ANY OTHER tick goes RED', () => {
        for (const at of [29, 31, 0]) {
            const rows = run(chainWith(block(), at));
            expect(rows.some((r) => !r.ok), `at=${at}`).toBe(true);
        }
    });

    it('⛔ MUTATION: a removal of a body NO block removes goes RED', () => {
        const rows = run(chainWith(block(), 30, 'bob@96,16'));
        expect(rows.some((r) => !r.ok)).toBe(true);
        expect(rows.find((r) => !r.ok).detail).toMatch(/NO phases block/);
    });

    it('⛔ MUTATION: a block that removes NOTHING witnesses nothing', () => {
        const rows = run(chainWith(block({ removes: [] }), 30));
        expect(rows.some((r) => !r.ok)).toBe(true);
        expect(rows.find((r) => !r.ok).detail).toMatch(/removes nothing/);
    });

    it('a chain with no removal REPORTS the absence rather than going silent', () => {
        const rows = run(chainWith(block(), null));
        expect(rows).toHaveLength(1);
        expect(rows[0].ok).toBe(true);
        expect(rows[0].name).toMatch(/no tape declares a mid-run despawn/);
    });
});

/**
 * ⛔ THE BLOCK'S OWN SHAPE REFUSAL for the same field: a block may not move a
 * body out of the PLANNER's world without asking the GAME how many are left.
 */
describe('assertWalkUnits — a removal owes the game a count', () => {
    const chainOf = (over) => ({
        id: 't',
        walk: { units: [{ phases: { ...L6_BOB_DROWN, ...over } }] },
    });

    it('the committed L6 block is the probe\'s own numbers', () => {
        expect(L6_BOB_DROWN.ticks).toBe(120);
        expect(L6_BOB_DROWN.steps.reduce((n, s) => n + s.ticks, 0)).toBe(120);
        expect(L6_BOB_DROWN.removes).toEqual([{ level: 6, id: 'bob@112,48' }]);
        expect(L6_BOB_DROWN.outcome).toEqual({ cleared: [], enemies: 1 });
        expect(assertWalkUnits(chainOf({}))).toEqual({ units: 1, legs: 0, phases: 1 });
    });

    it('⛔ MUTATION: REMOVES a body with no `enemies` count THROWS', () => {
        expect(() => assertWalkUnits(chainOf({ outcome: { cleared: [] } })))
            .toThrow(/declares no `enemies` count/);
    });

    it('⛔ MUTATION: a removes entry that is not {level, id} THROWS', () => {
        expect(() => assertWalkUnits(chainOf({ removes: [{ level: 6 }] })))
            .toThrow(/removes entries are \{level, id\}/);
    });
});

/**
 * ⛓⛓⛓ R7 SLICE 6f — THE GOAL LEDGER'S EARNED ROWS. `R7_GOAL_LEDGER` has
 * existed since slice 0 with no caller for its `earnedBy` argument; these
 * are the tests for the caller.
 */
describe('chainGoalFindings — EARNED is measured, and the set is two-sided', () => {
    const CUT2 = 40;
    /**
     * A three-segment chain whose SECOND segment picks the sword up: it boots
     * without it (the latch of segment 1) and latches with it, plus the
     * `{10,0}` clear `Sword.removed()` writes.
     */
    const HELD = {
        'save.hasSword': true,
        'save.levelPersistence': [{ level: 10, tag: 0 }],
    };
    function goalChain(mutate = {}) {
        // ⚠ `before` feeds BOTH segment 2's boot block and segment 1's latch,
        // exactly as the planner does it — so a staged-grant arm only has to
        // move ONE object and the two sides move together. A test that
        // mutated the latch alone would be testing a chain the planner
        // cannot author.
        const before = latchAt({ 'latch.tick': CUT, ...(mutate.before ?? {}) });
        const after = latchAt({ 'latch.tick': CUT2, ...HELD });
        const tapes = new Map([
            ['S1', baseTape({ boot: { ...TRUE_INITIAL_BOOT }, tick_count: CUT })],
            ['S2', baseTape({ ...segmentBootFromLatch(before), tick_count: CUT2 })],
        ]);
        const replayed = new Map([
            ['S1', { stream: stream(0, CUT), status: {}, seam: before }],
            ['S2', { stream: stream(0, CUT2), status: {}, seam: after }],
        ]);
        if (mutate.replayed) mutate.replayed(replayed);
        const chain = {
            id: 'goal', headline: 'H', segments: ['S1', 'S2'],
            cuts: [CUT], endsAt: CUT + CUT2, earns: mutate.earns ?? ['sword@L10'],
            ...(mutate.kind === undefined ? {} : { kind: mutate.kind }),
        };
        return chainGoalFindings(chain, tapes, replayed);
    }

    it('⛓⛓⛓ the sword is EARNED in the segment whose latch flipped the flag', () => {
        const f = goalChain();
        const row = f.find((r) => r.name.startsWith('sword@L10'));
        expect(row.ok).toBe(true);
        expect(row.detail).toMatch(/^S2: /);
        expect(row.detail).toMatch(/\{10,0\}/);
        expect(reds(f)).toEqual([]);
    });

    it('⛔ a DECLARED row nobody earns is RED, and an EARNED row nobody declared is too', () => {
        // declared, not earned
        const missing = goalChain({ earns: ['sword@L10', 'shield@L20'] });
        expect(reds(missing).some((n) => n.includes('EARNED set is exactly'))).toBe(true);
        expect(missing.find((r) => r.name.includes('EARNED set is exactly')).detail)
            .toMatch(/DECLARED but not earned: shield@L20/);
        // earned, not declared
        const extra = goalChain({ earns: [] });
        expect(extra.find((r) => r.name.includes('EARNED set is exactly')).detail)
            .toMatch(/EARNED but not declared: sword@L10/);
    });

    it('⛔⛔ A STAGED GRANT IS NOT AN EARN — a segment that BOOTS the flag reads '
        + 'UNCLAIMED', () => {
        // Both latches hold the sword, so the boot side declares it too and
        // nothing ever flips. This is the whole difference between §3.3's
        // "EARNED inside a driven segment" and six rungs of staged tapes.
        const f = goalChain({ before: HELD });
        expect(f.find((r) => r.name.startsWith('sword@L10')).ok).toBe(false);
        expect(f.find((r) => r.name.startsWith('sword@L10')).detail).toMatch(/UNCLAIMED/);
    });

    it('the progress line is REPORTED, never asserted — R7 ends at the sword', () => {
        const f = goalChain();
        const progress = f.find((r) => r.name.includes('goal ledger stands at'));
        expect(progress.ok).toBe(true);
        expect(progress.skipped).toBe(true);
        expect(progress.detail).toMatch(/R8/);
    });

    it('⛔ a declared id that is not a ledger row is a named failure', () => {
        const f = goalChain({ earns: ['sword@L10', 'nonsense@L999'] });
        const row = f.find((r) => r.name.includes('"nonsense@L999"'));
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/R7_GOAL_LEDGER has no row/);
    });

    it('⛓ THE REAL CHAIN declares exactly the rows R7 ends on', () => {
        const chain = PLAYTHROUGH_CHAINS.find((c) => c.id === 'act2-the-sword');
        expect(chain.earns).toEqual(['sword@L10', 'chest@L11']);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 0 TRACK D — THE STAGED CHAIN KIND (kickoff §3.6, ⚖ §6.1).
 *
 * R8's solver verifies segments INDIVIDUALLY from a DECLARED boot. Those are
 * a different kind of chain from R7's custody ones, and the difference is a
 * POLICY TABLE rather than an `if` — because trap 119's law is that a claim
 * quietly absent reads exactly like a claim that passed, and a new kind is
 * precisely the machinery that could make one disappear.
 */
describe('the chain kind — custody vs staged (R8 slice 0 track D)', () => {
    /**
     * ⛔⛔ BOTH EXISTING CHAINS ARE BYTE-UNCHANGED, AND THIS IS THE EXACT
     * ASSERTION RATHER THAN A PROXY FOR IT: neither declares a `kind` at all,
     * so the entries on disk did not gain a character. "Asserted, not
     * assumed" is the charge; a test that only checked `chainKind(c) ===
     * 'custody'` would pass just as well if someone had TYPED `kind:
     * 'custody'` into both, which is not the same claim.
     */
    it('⛔ neither PRE-EXISTING chain declares a kind — the entries are byte-unchanged', () => {
        // ⛓ R8 slice 2 scoped this loop BY NAME: the claim was always about
        // the two chains that predate the kind (their data on disk must not
        // gain a character), and slice 2's battery chains DO declare
        // `staged` — which is the kind existing at all. The two claims are
        // separated rather than the old one weakened.
        for (const id of ['toy-west-pair', 'act2-the-sword']) {
            const c = PLAYTHROUGH_CHAINS.find((x) => x.id === id);
            expect(Object.prototype.hasOwnProperty.call(c, 'kind'), c.id).toBe(false);
            expect(chainKind(c)).toBe('custody');
            expect(chainPolicy(c).custodyBaseCase).toBe(true);
            expect(chainPolicy(c).goalLedgerCredit).toBe(true);
        }
    });

    it('the policy table is TOTAL and every kind is tallied — and staged is REAL now', () => {
        const r = assertChainsWellFormed();
        expect(Object.keys(r.byKind).sort()).toEqual(Object.keys(CHAIN_KINDS).sort());
        // ⛓ R8 slice 2: the battery's seven one-segment staged chains are
        // the first on disk — slice 0's "no staged chain exists yet" bounded
        // vacuity, discharged. The tallies are DERIVED from the table so a
        // chain added tomorrow moves this test out loud.
        const staged = PLAYTHROUGH_CHAINS.filter((c) => (c.kind ?? 'custody') === 'staged');
        expect(r.byKind.custody).toBe(PLAYTHROUGH_CHAINS.length - staged.length);
        expect(r.byKind.staged).toBe(staged.length);
        expect(staged.length).toBe(7);
    });

    it('⛔ MUTATION: an unknown kind THROWS by name rather than falling through', () => {
        expect(() => chainKind({ id: 'x', kind: 'freestyle' })).toThrow(PlaythroughError);
        expect(() => chainKind({ id: 'x', kind: 'freestyle' })).toThrow(/the kinds are/);
        expect(() => chainKind({ id: 'x', kind: 'freestyle' }))
            .toThrow(/quietly acquire a custody claim/);
    });

    /**
     * ⛓ A CUSTODY CHAIN OF ONE HAS NO SEAM AND IS REFUSED; A STAGED CHAIN OF
     * ONE IS THE POINT OF THE KIND. Per-segment verification is exactly a
     * one-segment chain, and it still gets the witnessed-clear/despawn laws
     * and the calm-arrival requirement — the gap kickoff §2.4 measured for
     * UNCHAINED tapes.
     */
    it('the minimum segment count is per KIND, and both directions are checked', () => {
        expect(CHAIN_KINDS.custody.minSegments).toBe(2);
        expect(CHAIN_KINDS.staged.minSegments).toBe(1);
    });

    it('⛓ a staged chain SKIPS the custody base case and NAMES the reason', () => {
        const f = buildChain({ kind: 'staged' });
        const skipped = f.find((r) => r.name.includes('custody base case is SKIPPED'));
        expect(skipped, 'the skip must be REPORTED, never silently absent').toBeTruthy();
        expect(skipped.ok).toBe(true);
        expect(skipped.skipped).toBe(true);
        expect(skipped.detail).toMatch(/by DECLARATION/);
        // …and the custody row itself is gone, which is the other half.
        expect(f.some((r) => r.name.includes('boots the TRUE INITIAL STATE'))).toBe(false);
    });

    it('a custody chain still asserts the base case, unskipped', () => {
        const f = buildChain();
        const row = f.find((r) => r.name.includes('boots the TRUE INITIAL STATE'));
        expect(row.ok).toBe(true);
        expect(row.skipped).toBeUndefined();
        expect(f.some((r) => r.name.includes('custody base case is SKIPPED'))).toBe(false);
    });

    /**
     * ⛔⛔ THE LAWS A STAGED CHAIN KEEPS. This is the half that closes kickoff
     * §2.4's measured gap: an UNCHAINED solver tape's v9 `at`-clears and v10
     * despawns are never witnessed at all, because `witnessedClearFindings`
     * iterates CHAINS. A staged chain brings them back under the law.
     */
    it('⛓ a staged chain KEEPS the witnessed-clear and witnessed-despawn laws', () => {
        const f = buildChain({ kind: 'staged' });
        expect(f.some((r) => r.name.includes('no tape declares a mid-run clear'))).toBe(true);
        expect(f.some((r) => r.name.includes('no tape declares a mid-run despawn'))).toBe(true);
    });

    it('⛓ a staged chain KEEPS its internal seams and its arithmetic', () => {
        const f = buildChain({ kind: 'staged' });
        expect(f.some((r) => r.name.includes('THE SEAM'))).toBe(true);
        expect(f.some((r) => r.name.includes('tick counts sum to the headline'))).toBe(true);
        expect(f.some((r) => r.name.includes('CALM ARRIVAL'))).toBe(true);
        expect(reds(f)).toEqual([]);
    });

    /**
     * ⛔⛔⛔ A STAGED BOOT CAN DECLARE A FLAG; IT CANNOT EARN ONE.
     *
     * The measurement is still TAKEN — `goalEarnedWitness` asks for a flip
     * between boot and latch, which a declaration cannot fake — but the row
     * is REPORTED rather than CREDITED, because what a staged boot skips is
     * the REACHING, and the campaign's claim is that the run got there.
     */
    it('⛓⛓ a staged chain REPORTS its ledger rows and never CREDITS them', () => {
        const custody = goalChainKind(undefined);
        const staged = goalChainKind('staged');
        const cRow = custody.find((r) => r.name.startsWith('sword@L10'));
        const sRow = staged.find((r) => r.name.startsWith('sword@L10'));
        expect(cRow.ok).toBe(true);
        expect(cRow.skipped).toBeUndefined();
        expect(sRow.ok).toBe(true);
        expect(sRow.skipped).toBe(true);
        expect(sRow.detail).toMatch(/REPORTED, NOT CREDITED/);
        expect(sRow.detail).toMatch(/cannot have EARNED it/);
    });

    /**
     * ⛔ AND A STAGED CHAIN'S RED ROWS GO QUIET TOO — deliberately, and this
     * is the sharpest edge of the ruling. A declared-but-unearned row is a
     * FAILURE for a custody chain and a REPORT for a staged one, because a
     * staged chain never claimed to earn anything. Asserted in both
     * directions so the difference is a decision rather than a side effect.
     */
    it('⛔ a declared-but-unearned row is RED for custody and REPORTED for staged', () => {
        const custody = goalChainKind(undefined, ['sword@L10', 'shield@L20']);
        expect(reds(custody).some((n) => n.includes('EARNED set is exactly'))).toBe(true);
        const staged = goalChainKind('staged', ['sword@L10', 'shield@L20']);
        expect(reds(staged)).toEqual([]);
        const row = staged.find((r) => r.name.includes('EARNED set is exactly'));
        expect(row.skipped).toBe(true);
        expect(row.detail).toMatch(/DECLARED but not earned: shield@L20/);
        expect(row.detail).toMatch(/REPORTED, NOT CREDITED/);
    });
});

/**
 * ── THE MUTATION LIST FOR THE CHAIN KIND ──────────────────────────────
 *
 *  1. type `kind: 'custody'` into either existing chain entry
 *       → `neither existing chain declares a kind` reds — which is the
 *         byte-unchanged claim asserted exactly rather than by proxy
 *  2. declare an unknown kind
 *       → `an unknown kind THROWS by name` reds
 *  3. flip `CHAIN_KINDS.staged.custodyBaseCase` to true
 *       → `a staged chain SKIPS the custody base case` reds (the row
 *         disappears and the TRUE INITIAL STATE row returns)
 *  4. drop the skipped ROW instead of emitting it
 *       → same test reds on `toBeTruthy()` — trap 119's exact shape: a
 *         silently absent claim reads like one that passed
 *  5. flip `CHAIN_KINDS.staged.goalLedgerCredit` to true
 *       → `a staged chain REPORTS its ledger rows and never CREDITS them` reds
 *  6. make `witnessedClearFindings` skip staged chains
 *       → `a staged chain KEEPS the witnessed-clear …` reds
 *  7. give staged chains `minSegments: 2`
 *       → `the minimum segment count is per KIND` reds
 *  8. drop the zero tally from `byKind`
 *       → `the policy table is TOTAL and every kind is tallied` reds
 *
 * ⚠ BOUNDED VACUITY, NAMED: no `staged` chain exists on disk yet, so rows
 * 3–7 are exercised only against SYNTHETIC chains. That is the honest state
 * of the kind at slice 0 — slice 2 is the first producer, and its as-built
 * is where these rows stop being synthetic.
 */
