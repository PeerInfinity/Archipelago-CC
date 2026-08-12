/**
 * watchOverlays — the editor page's overlay layers, tested where they are
 * pure (editor arc slice 2).
 *
 * ⛔ THE TWO ACCEPTANCE ROWS ARE AT THE BOTTOM AND THEY DRIVE REAL TAPES.
 * Kickoff §4's slice-2 acceptance is a pair of LEDGER facts — `r8-solve-18`
 * shows both spinner paths, press markers at the recorded ticks and ZERO
 * damage markers; `r8-hammer-control` shows exactly ONE damage marker, at
 * tick 247 — and they are asserted here against the same `collectRun` /
 * `overlaysFor` the page calls, so the derivation under test is the
 * derivation on screen. The browser row
 * (`scripts/procgen/check-seedling-editor-overlays.mjs`) proves the PAGE'S
 * PATH to it; this file proves the derivation itself, in node, in CI.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTION_KEYS, activeTraceIndex, arrowLanesAt, attackRectsAt, bodiesAt, channelSummary, collectRun,
    crushersAt, dangerQueriesAt, defaultLayerSet, extractMarkers, hammerLinesAt, keyEdges,
    LAYER_IDS, MARKER_GLYPHS, markersVisibleAt, OVERLAY_LAYERS, overlaysFor, parseLayersParam,
    pathPointsUpTo, sampleMovers, traceRowFields, traceSidecarPath, worldChangesAt,
} from './watchOverlays.js';
import { formatTraceRow } from './decisionTrace.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { ROLES, RELAXED_ROLES } from './levelWorld.js';
import { arrowLaneForPlacement, arrowLaneRect } from './arrowTrap.js';
// ⛓ SLICE 9's three: the crusher lanes the SCAN itself walks, the one loop
// (for the engine differential, which needs the run at the tick the change
// lands on rather than at the end of the walk), and the SOLVE arm.
import { detectionRects } from './crusher.js';
import { createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { solveForPage } from './watchSolve.js';
import { parseTape } from './tapeFormat.js';

/** One level source for the slice-9 rows — built once, like the page's. */
const levelSourceForTests = atlasLevelSource();

const HERE = dirname(fileURLToPath(import.meta.url));
const tape = (name) =>
    JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

// ── the layer roster ─────────────────────────────────────────────────────

describe('the layer roster', () => {
    it('⚖ arrow paths are the ONE layer that defaults OFF (kickoff §1.6)', () => {
        // ⛓ SLICE 6 widened the roster to eleven, SLICE 8 to twelve and
        // SLICE 9 to FIFTEEN. `arrows` was the only OFF one for three slices
        // and the reason is unchanged — it is the only CUMULATIVE layer whose
        // ink scales with bodies × ticks, and every layer added since is
        // this-tick-only, so that argument does not reach them.
        //
        // ⚖⚖ SLICE 9 ADDS THE SECOND OFF LAYER, AND ITS DEFAULT IS A RULING
        // RATHER THAN A TASTE. `danger` is the one layer on the page that
        // draws an OPINION (what the SOLVER was told), and item 9 supersedes
        // slice 6's refusal of danger verdicts (§14.4c) only for a layer that
        // is *default OFF* and labelled as the bot's heuristic. So this row
        // pins WHICH layers are off and not merely how many — a later tidy-up
        // that flipped `danger` on would be reversing a ⚖ ruling.
        expect([...defaultLayerSet()].sort()).toEqual([
            'action', 'attacks', 'crushers', 'damage', 'enemies', 'events', 'hammer',
            'hitboxes', 'lanes', 'player', 'pushables', 'volumes', 'worldstate',
        ]);
        expect(OVERLAY_LAYERS.find((l) => l.id === 'arrows').on).toBe(false);
        expect(OVERLAY_LAYERS.filter((l) => !l.on).map((l) => l.id))
            .toEqual(['arrows', 'danger']);
    });

    /**
     * ⛔ SLICE 8 — `lanes` AND `arrows` ARE TWO LAYERS AND MUST STAY TWO.
     * The flights are a cumulative `path` sampled from `run.arrowsInFlight`;
     * the lanes are the trap's own geometry, drawn while it is armed. Pinning
     * both the KIND and the DEFAULT of each is what stops a later tidy-up
     * from folding one into the other on the grounds that both say "arrow".
     */
    it('⛓ the shape layers are `shape` — this tick, not the walk', () => {
        const shapes = OVERLAY_LAYERS.filter((l) => l.kind === 'shape').map((l) => l.id);
        expect(shapes).toEqual([
            'hitboxes', 'hammer', 'attacks', 'lanes', 'worldstate', 'crushers', 'danger',
        ]);
        // The distinction the renderer branches on, pinned: a `path` layer is
        // cumulative to the cursor and a `shape` layer is the cursor's tick.
        expect(OVERLAY_LAYERS.filter((l) => l.kind === 'path').map((l) => l.id))
            .toEqual(['player', 'enemies', 'pushables', 'arrows']);
        expect(LAYER_IDS).toHaveLength(15);
        const byId = (id) => OVERLAY_LAYERS.find((l) => l.id === id);
        expect({ kind: byId('lanes').kind, on: byId('lanes').on })
            .toEqual({ kind: 'shape', on: true });
        expect({ kind: byId('arrows').kind, on: byId('arrows').on })
            .toEqual({ kind: 'path', on: false });
        // …and the labels do not read as each other's.
        expect(byId('lanes').label).toMatch(/lane/i);
        expect(byId('arrows').label).toMatch(/path/i);
    });

    it('every layer has a distinct id and a human label', () => {
        expect(new Set(LAYER_IDS).size).toBe(OVERLAY_LAYERS.length);
        for (const l of OVERLAY_LAYERS) expect(l.label.length).toBeGreaterThan(3);
    });

    it('⛔ every marker source the extractor emits has a GLYPH — no silent marker', () => {
        // The mutation this guards: adding a source to `extractMarkers` and
        // forgetting the legend leaves a marker the renderer cannot draw.
        const sources = new Set(['action', 'hit', 'death', 'grant', 'transition', 'clear']);
        expect(new Set(Object.keys(MARKER_GLYPHS))).toEqual(sources);
        for (const g of Object.values(MARKER_GLYPHS)) {
            expect(g.glyph).toBeTruthy();
            expect(g.colour).toMatch(/^#[0-9a-f]{6}$/i);
            expect(g.label).toBeTruthy();
        }
    });
});

describe('?layers=', () => {
    it('an ABSENT parameter is not an empty one', () => {
        expect(parseLayersParam(null).on).toBe(null);
        expect(parseLayersParam(undefined).on).toBe(null);
        // present-and-empty means everything OFF, which is a legal view
        expect([...parseLayersParam('').on]).toEqual([]);
    });

    it('selects exactly the named layers', () => {
        const { on, unknown } = parseLayersParam('player,arrows, damage ');
        expect([...on].sort()).toEqual(['arrows', 'damage', 'player']);
        expect(unknown).toEqual([]);
    });

    it('⚠ an unknown name is REPORTED, not thrown and not ignored', () => {
        const { on, unknown } = parseLayersParam('player,enemys,volumes');
        expect([...on].sort()).toEqual(['player', 'volumes']);
        expect(unknown).toEqual(['enemys']);
    });
});

// ── the action layer ─────────────────────────────────────────────────────

describe('keyEdges', () => {
    const held = (...sets) => sets.map((s) => new Set(s));

    it('⛔ marks EDGES, not holds — a five-tick swing is one marker', () => {
        const seq = held([], ['primary'], ['primary'], ['primary'], [], ['primary']);
        expect(keyEdges(seq)).toEqual([{ tick: 1, key: 'primary' }, { tick: 5, key: 'primary' }]);
    });

    it('a key held from tick 0 is an edge at tick 0', () => {
        expect(keyEdges(held(['primary'], ['primary']))).toEqual([{ tick: 0, key: 'primary' }]);
    });

    it('movement keys are not action keys', () => {
        expect(keyEdges(held([], ['right', 'up'], ['right']))).toEqual([]);
        expect(ACTION_KEYS).toEqual(['primary', 'secondary']);
    });

    it('accepts arrays as well as Sets — the frame shape is not assumed', () => {
        expect(keyEdges([[], ['secondary']])).toEqual([{ tick: 1, key: 'secondary' }]);
    });

    it('refuses a key name the tape format does not have, BY NAME', () => {
        expect(() => keyEdges([[]], ['attack'])).toThrow(/"attack" is not a tape key/);
    });
});

// ── the sampler ──────────────────────────────────────────────────────────

describe('sampleMovers', () => {
    const fakeRun = (over = {}) => ({
        level: 7, chasers: [], spinnerBodies: [], pushables: new Map(),
        arrowsInFlight: [], ...over,
    });

    it('merges chasers and spinners into ONE enemy channel, tagged by kind', () => {
        const s = sampleMovers(fakeRun({
            chasers: [{ id: 'bob@1', x: 10, y: 20 }],
            spinnerBodies: [{ id: 'sp@2', x: 30, y: 40 }],
        }));
        expect(s.enemies).toEqual([
            { id: 'bob@1', kind: 'chaser', x: 10, y: 20 },
            { id: 'sp@2', kind: 'spinner', x: 30, y: 40 },
        ]);
        expect(s.level).toBe(7);
    });

    it('⛔ a REMOVED pushable has no position to draw and is dropped', () => {
        const s = sampleMovers(fakeRun({
            pushables: new Map([
                ['a', { rect: { x: 0, y: 0, w: 16, h: 16 }, removed: false }],
                ['b', { rect: { x: 32, y: 0, w: 16, h: 16 }, removed: true }],
            ]),
        }));
        expect(s.pushables).toEqual([{ id: 'a', x: 0, y: 0, w: 16, h: 16 }]);
    });

    it('⚠ null channels (noclip / noDamage) come through EMPTY, never as a throw', () => {
        const s = sampleMovers({ level: 3, chasers: [], spinnerBodies: [], pushables: null,
            arrowsInFlight: null });
        expect(s).toEqual({
            level: 3, enemies: [], pushables: [], arrows: [],
            // ⛓ slice 6's three, and `null` where a value would be a guess:
            // a run with no clock has no hammer phase and a run with no
            // `state` has no player box to test one against.
            bodies: [], gameTime: null, player: null,
            // ⛓ SLICE 8's three, and the two `null`s are the point: a
            // run-shaped fake with no `worldFor` has no room to count a
            // census or a trap in, which is a different answer from "this
            // room holds none" and must not be spelled `0`.
            lanes: [], arrowTraps: null, census: null,
            // ⛓ SLICE 9, and `changeCounts: null` carries the same weight as
            // the two above it: a fake with no world cannot count how many
            // changeable objects stand in the room, and `0` would be a claim
            // that it counted and found none.
            changes: [], changeCounts: null,
        });
    });

    // ── slice 6: the BODY channel, beside the point channel ──────────────

    it('⛓ SLICE 6: the body COLLIDERS come from the engine, per class', () => {
        const s = sampleMovers({
            level: 7,
            chasers: [{ id: 'bob@1', tag: 'bob', x: 100, y: 100 }],
            spinnerBodies: [{ id: 'sp@2', x: 30, y: 40, rect: { x: 26, y: 36, w: 7, h: 7, right: 33, bottom: 43 } }],
            pushables: new Map(),
            arrowsInFlight: [],
            gameTime: 900,
            state: { x: 11, y: 12 },
        });
        // The chaser's box is `chaserBoxAt('bob', …)` — the census hitbox,
        // NOT a retyped literal. bob is 8x8 with a (4,4) origin.
        expect(s.bodies).toEqual([
            { id: 'bob@1', kind: 'chaser', tag: 'bob', x: 100, y: 100,
                rect: { x: 96, y: 96, w: 8, h: 8, right: 104, bottom: 104 } },
            // The spinner's is the run's own `spinnerRect` output, carried.
            { id: 'sp@2', kind: 'spinner', tag: 'spinner', x: 30, y: 40,
                rect: { x: 26, y: 36, w: 7, h: 7, right: 33, bottom: 43 } },
        ]);
        expect(s.gameTime).toBe(900);
        expect(s.player).toEqual({ x: 11, y: 12 });
    });

    it('⚠ a body whose class has no census hitbox is ABSENT, never boxed by guess', () => {
        // The point channel still reports it — "we know where it is" and "we
        // know how big it is" are different claims and the split is the answer.
        const s = sampleMovers({
            level: 7, chasers: [{ id: 'x@1', x: 5, y: 5 }], spinnerBodies: [],
            pushables: new Map(), arrowsInFlight: [],
        });
        expect(s.enemies).toHaveLength(1);
        expect(s.bodies).toEqual([]);
    });

    it('bodiesAt is THIS TICK ONLY and filtered to the level being drawn', () => {
        const samples = [
            { level: 1, bodies: [{ id: 'a', kind: 'chaser' }] },
            { level: 1, bodies: [{ id: 'b', kind: 'chaser' }] },
            { level: 2, bodies: [{ id: 'c', kind: 'chaser' }] },
        ];
        // Not cumulative — tick 1 shows b and NOT a. That is the whole
        // difference from `pathPointsUpTo`, and drawing the union would
        // paint the room.
        expect(bodiesAt(samples, 1, 1).bodies.map((b) => b.id)).toEqual(['b']);
        expect(bodiesAt(samples, 2, 1).bodies).toEqual([]);
        expect(bodiesAt(samples, 2, 2).bodies.map((b) => b.id)).toEqual(['c']);
        expect(bodiesAt(samples, 99, 1).bodies).toEqual([]);
    });
});

// ── markers ──────────────────────────────────────────────────────────────

describe('extractMarkers', () => {
    const frames = [
        { level: 1, x: 0, y: 0 }, { level: 1, x: 10, y: 10 },
        { level: 1, x: 20, y: 20 }, { level: 2, x: 30, y: 30 },
    ];
    const frameAt = (t) => frames[t] ?? null;

    it('places every ledger row at the position the run held on ITS tick', () => {
        const { markers } = extractMarkers({
            hits: [{ t: 2, source: 'spinner-hammer', id: 'sp@1', hits: 1, hitsMax: 3 }],
            transitions: [{ t: 3, from_level: 1, to_level: 2 }],
            grants: [{ t: 1, level: 1, items: ['sword'] }],
            held: [[], ['primary'], [], []],
            frameAt,
        });
        expect(markers.map((m) => [m.tick, m.layer, m.source, m.level, m.x, m.y])).toEqual([
            [1, 'action', 'action', 1, 10, 10],
            [1, 'events', 'grant', 1, 10, 10],
            [2, 'damage', 'hit', 1, 20, 20],
            [3, 'events', 'transition', 2, 30, 30],
        ]);
    });

    it('a death is its own glyph and carries the respawn in its label', () => {
        const { markers } = extractMarkers({
            deaths: [{ t: 2, level: 1, source: 'spinner', respawn: { x: 8, y: 8 } }],
            frameAt,
        });
        expect(markers).toHaveLength(1);
        expect(markers[0].source).toBe('death');
        expect(markers[0].label).toMatch(/respawn 8,8/);
    });

    it('⛓⛓⛓ a CLEAR PLACES now — the ruled tick, at the tick it names', () => {
        // Slice 2 asserted the opposite here: `earnedClears` carried no tick
        // and every clear landed in `unplaced`. ⚖ The designer ruled the
        // tick in (kickoff §9.9) and this is the consumer it rode in on.
        const { markers, unplaced } = extractMarkers({
            clears: [{ level: 18, tag: 0, by: 'lock@144,112', t: 1 }], frameAt,
        });
        expect(unplaced).toEqual([]);
        expect(markers).toHaveLength(1);
        expect(markers[0].source).toBe('clear');
        expect(markers[0].tick).toBe(1);
        expect(markers[0].label).toMatch(/cleared \{18,0\} by lock@144,112/);
        // ⛔ AT THE PLAYER'S POSITION ON THAT TICK, from `frameAt` — not at
        // the flag's own level, which is a fact about the FLAG. A clear
        // written into another room by a ButtonRoom draws where the presser
        // was standing, which is the only place a marker can honestly go.
        expect(markers[0].level).toBe(frameAt(1).level);
        expect(markers[0].x).toBe(frameAt(1).x);
    });

    it('⛔ a clear whose feeder has NO tick is still UNPLACED, and says which', () => {
        // The lightpole read at BOOT: `poleFlagFor`'s initialiser writes
        // `t: null` because nothing was written. A marker at tick 0 would
        // claim a press on the opening frame.
        const { markers, unplaced } = extractMarkers({
            clears: [{ level: 65, tag: 2, by: 'lightpole', t: null }], frameAt,
        });
        expect(markers).toEqual([]);
        expect(unplaced).toHaveLength(1);
        expect(unplaced[0].what).toContain('L65 tag 2');
        expect(unplaced[0].why).toMatch(/carries no tick/);
        expect(unplaced[0].why).toMatch(/BOOT/);
    });

    it('⛔ a row outside the collected frames is UNPLACED, never clamped', () => {
        const { markers, unplaced } = extractMarkers({
            hits: [{ t: 99, source: 'spinner', hits: 1, hitsMax: 3 }], frameAt,
        });
        expect(markers).toEqual([]);
        expect(unplaced[0].why).toMatch(/outside the collected frames/);
        expect(unplaced[0].what).toContain('@99');
    });
});

describe('markersVisibleAt', () => {
    const markers = [
        { layer: 'damage', tick: 5, level: 1 },
        { layer: 'action', tick: 5, level: 2 },
        { layer: 'damage', tick: 9, level: 1 },
    ];
    const all = new Set(['damage', 'action']);

    it('⚠ AT OR BEFORE the cursor — a future hit is not drawn', () => {
        expect(markersVisibleAt(markers, 5, 1, all)).toEqual([markers[0]]);
        expect(markersVisibleAt(markers, 9, 1, all)).toEqual([markers[0], markers[2]]);
    });

    it('filtered to the level being drawn — every level is its own space', () => {
        expect(markersVisibleAt(markers, 9, 2, all)).toEqual([markers[1]]);
    });

    it('and to the ON layers', () => {
        expect(markersVisibleAt(markers, 9, 1, new Set(['action']))).toEqual([]);
    });
});

describe('pathPointsUpTo / channelSummary', () => {
    const samples = [
        { level: 1, enemies: [{ id: 'a', x: 1, y: 1 }] },
        { level: 1, enemies: [{ id: 'a', x: 2, y: 2 }, { id: 'b', x: 9, y: 9 }] },
        { level: 2, enemies: [{ id: 'c', x: 3, y: 3 }] },
    ];

    it('accumulates to the cursor and filters to the level', () => {
        expect(pathPointsUpTo(samples, 1, 1, 'enemies')).toHaveLength(3);
        expect(pathPointsUpTo(samples, 0, 1, 'enemies')).toHaveLength(1);
        expect(pathPointsUpTo(samples, 2, 2, 'enemies')).toEqual([{ id: 'c', x: 3, y: 3 }]);
    });

    it('a cursor past the end is clamped to the samples it has', () => {
        expect(pathPointsUpTo(samples, 99, 1, 'enemies')).toHaveLength(3);
    });

    it('channelSummary counts DISTINCT bodies across every level', () => {
        expect(channelSummary(samples, 'enemies'))
            .toEqual({ ids: ['a', 'b', 'c'], bodies: 3, points: 4 });
        expect(channelSummary(samples, 'arrows')).toEqual({ ids: [], bodies: 0, points: 0 });
    });
});

// ── the trace pane ───────────────────────────────────────────────────────

describe('traceSidecarPath', () => {
    it('is the `traces/` sibling of `tapes/`, keyed by the tape name', () => {
        expect(traceSidecarPath(
            'frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-18.json').path)
            .toBe('frontend/modules/seedlingDemo/fixtures/traces/r8-solve-18.trace.json');
    });

    it('tolerates a leading slash', () => {
        expect(traceSidecarPath('/a/tapes/b.json').path).toBe('a/traces/b.trace.json');
    });

    it('⚠ refuses to GUESS for a path outside a tapes/ directory', () => {
        const r = traceSidecarPath('somewhere/else/x.json');
        expect(r.path).toBe(null);
        expect(r.why).toMatch(/is not/);
    });
});

describe('traceRowFields / activeTraceIndex', () => {
    const row = (tick, over = {}) => ({
        tick, saw: { level: 4, x: 1, y: 2 }, goal: { kind: 'reach-exit' },
        strategy: { verb: 'walk' }, rejected: [], keys: [], ...over,
    });

    it('an absent obstacle is an em dash, not an empty cell', () => {
        expect(traceRowFields(row(3)).obstacle).toBe('—');
        expect(traceRowFields(row(3, { obstacle: { kind: 'block', id: 'b@1' } })).obstacle)
            .toBe('block:b@1');
    });

    it('⛔ the one-line form is the CLI\'s OWN — one summary, two views', () => {
        const r = row(3, { rejected: [{ option: 'walk', why: 'blocked' }] });
        expect(traceRowFields(r).line).toBe(formatTraceRow(r));
        expect(traceRowFields(r).rejected).toEqual(['walk (blocked)']);
    });

    it('the active row is the last DECISION at or before the cursor', () => {
        const rows = [row(0), row(40), row(120)];
        expect(activeTraceIndex(rows, 0)).toBe(0);
        expect(activeTraceIndex(rows, 39)).toBe(0);
        expect(activeTraceIndex(rows, 40)).toBe(1);
        expect(activeTraceIndex(rows, 5000)).toBe(2);
        expect(activeTraceIndex([row(7)], 6)).toBe(-1);
        expect(activeTraceIndex([], 10)).toBe(-1);
    });
});

// ── ⛔ THE SLICE'S ACCEPTANCE ROWS, ON REAL TAPES ─────────────────────────

describe('⛔ kickoff §4 slice 2 acceptance — the overlays on committed tapes', () => {
    const levelSource = atlasLevelSource();

    it('⛓⛓⛓ r8-solve-18: BOTH spinner paths, press markers at the recorded '
        + 'ticks, and ZERO damage markers', () => {
        const collected = collectRun(tape('r8-solve-18'), levelSource);
        expect(collected.error).toBe(null);
        const { markers, unplaced } = overlaysFor(collected);

        // (a) BOTH spinner paths — two distinct bodies, each moving.
        const enemies = channelSummary(collected.samples, 'enemies');
        expect(enemies.ids).toEqual(['spinner@112,48', 'spinner@48,96']);
        for (const id of enemies.ids) {
            const seen = new Set();
            for (const s of collected.samples) {
                for (const e of s.enemies) if (e.id === id) seen.add(`${e.x},${e.y}`);
            }
            // A PATH, not a parked dot: the two bodies glide the whole room.
            expect(seen.size).toBeGreaterThan(100);
        }

        // (b) The press markers, at the ticks the RUN's own press ledger
        // recorded. ⛓ THE TWO DERIVATIONS ARE INDEPENDENT and that is the
        // whole content of the row: the markers come from EDGES IN THE
        // TAPE'S INPUT SPANS and `run.presses` comes from the rect the
        // engine actually collided. They agree on the press tick `t`; the
        // ledger's `fired` is one to five ticks later (the swing's own
        // frames), which is why the comparison names `t`.
        const action = markers.filter((m) => m.layer === 'action');
        const pressTicks = [...new Set(collected.run.presses.map((p) => p.t))].sort((a, b) => a - b);
        expect(pressTicks).toEqual([33, 66, 104, 179, 212, 270]);
        expect(action.map((m) => m.tick)).toEqual(pressTicks);
        expect(new Set(collected.run.presses.map((p) => p.fired - p.t))).toEqual(new Set([1, 2, 3, 4, 5]));

        // (c) ZERO damage markers — the honest L18 took nothing.
        expect(markers.filter((m) => m.layer === 'damage')).toEqual([]);
        expect(collected.run.playerHits).toEqual([]);
        expect(collected.run.spinnerContacts).toEqual([]);

        // …and the one event this walk does have.
        expect(markers.filter((m) => m.layer === 'events')
            .map((m) => `${m.source}@${m.tick}`)).toEqual(['transition@573']);
        // ⚠ NOT A SILENCE: nothing in this walk is unplaceable.
        expect(unplaced).toEqual([]);
    }, 60000);

    it('⛓⛓⛓ r8-hammer-control: exactly ONE damage marker, at tick 247', () => {
        const collected = collectRun(tape('r8-hammer-control'), levelSource);
        expect(collected.error).toBe(null);
        const { markers } = overlaysFor(collected);

        const damage = markers.filter((m) => m.layer === 'damage');
        expect(damage).toHaveLength(1);
        expect(damage[0].tick).toBe(247);
        expect(damage[0].source).toBe('hit');
        expect(damage[0].label).toContain('spinner-hammer');
        // The marker stands where the player WAS on tick 247 — the frame's
        // own position, never the spinner's and never a clamp.
        expect({ x: damage[0].x, y: damage[0].y, level: damage[0].level }).toEqual({
            level: collected.frames[247].observation.level,
            x: collected.frames[247].observation.x,
            y: collected.frames[247].observation.y,
        });
        // ⚠ THE CONTROL'S POINT: four contacts, ONE billed. A marker layer
        // reading `spinnerContacts` instead of `playerHits` would draw four.
        expect(collected.run.spinnerContacts).toHaveLength(4);
        expect(collected.run.spinnerContacts.filter((c) => c.applied)).toHaveLength(1);
    }, 60000);

    it('⚠ a tape with no trace sidecar is NAMED — r8-hammer-control has none', () => {
        // The pane's own refusal path, proven on the roster rather than on a
        // hypothetical: the sidecar convention resolves, and the file is
        // simply not there.
        const p = traceSidecarPath(
            'frontend/modules/seedlingDemo/fixtures/tapes/r8-hammer-control.json');
        expect(p.path).toBe(
            'frontend/modules/seedlingDemo/fixtures/traces/r8-hammer-control.trace.json');
        expect(() => readFileSync(join(HERE, '..', '..', '..', p.path))).toThrow();
        expect(() => readFileSync(join(HERE, '..', '..', '..',
            traceSidecarPath('frontend/modules/seedlingDemo/fixtures/tapes/r8-solve-18.json')
                .path))).not.toThrow();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ⛔⛔⛔ EDITOR ARC SLICE 6 — THE SHAPE LAYERS, AGAINST THE ENGINE'S OWN
// LEDGERS
//
// These are the rows that license `hammerLinesAt` to exist outside the
// engine at all. The layer picks an INSTANT (which sample's body, which
// sample's clock); `run.spinnerContacts` is produced INSIDE `advance` by
// code that shares nothing with it. Two derivations, one answer, or the
// layer is drawing a plausible lie.
// ─────────────────────────────────────────────────────────────────────────

describe('⛓⛓⛓ slice 6 — the hammer line reproduces run.spinnerContacts', () => {
    const collect = (name) => collectRun(tape(name), atlasLevelSource());

    it('r8-hammer-control tick 247: the DRAWN angle IS the recorded 152°', () => {
        const c = collect('r8-hammer-control');
        const ledger = c.run.spinnerContacts.filter((r) => r.arm === 'hammer');
        // The committed artifact is the oracle (kickoff §17.6 of the R8 file):
        // a hammer contact at tick 247, `Game.time` 5104, phase 19/45, 152°.
        const first = ledger[0];
        expect(first.t).toBe(247);
        expect(first.gameTime).toBe(5104);
        expect(first.gameTime % 45).toBe(19);

        const drawn = hammerLinesAt(c.samples, 247, 18);
        expect(drawn.why).toBeNull();
        // ⚠ L18 HOLDS TWO SPINNERS (slice 2's row names both), so the layer
        // draws TWO lines and exactly ONE of them reaches — which is a
        // stronger statement than "a line was drawn": a layer that swept the
        // whole room would touch with both.
        expect(drawn.lines.map((l) => l.id).sort())
            .toEqual(['spinner@112,48', 'spinner@48,96']);
        expect(drawn.lines.filter((l) => l.touches).map((l) => l.id)).toEqual([first.id]);
        const line = drawn.lines.find((l) => l.id === first.id);
        // EXACT, not approximate: same function, same doubles.
        expect(line.angle).toBe(first.angle);
        expect(line.angle * 180 / Math.PI).toBeCloseTo(152, 9);
        expect(line.gameTime).toBe(5104);
        // ⛓⛓⛓ AND IT REACHES THE PLAYER — the damage marker at 247 and the
        // hammer layer at 247 agree about WHY, which is the acceptance row.
        expect(line.touches).toBe(true);
        // …and the marker really is at the same tick, from the OTHER ledger.
        const { markers } = overlaysFor(c);
        const damage = markers.filter((m) => m.layer === 'damage');
        expect(damage.map((m) => m.tick)).toEqual([247]);
        expect(damage[0].label).toContain('spinner-hammer');
    }, 60000);

    it('⛔ THE SPLICE IS THE FINDING: one sample gives the wrong angle, the '
        + 'other gives the wrong place', () => {
        const c = collect('r8-hammer-control');
        const at = (i) => hammerLinesAt(c.samples, i, 18).lines.find((l) => l.id === "spinner@48,96");
        // Sample 247's own clock is 5105 — one tick PAST the contact's — so a
        // layer that read the body and the clock from the same sample would
        // draw 160° where the ledger says 152°.
        expect(c.samples[247].gameTime).toBe(5105);
        expect(c.samples[246].gameTime).toBe(5104);
        // And the body moves 0.707 px per axis per tick, so reading BOTH from
        // 246 gives the right angle attached to a body one step behind — the
        // dangerous member, because it looks entirely correct.
        expect(at(247).angle).toBeCloseTo(152 * Math.PI / 180, 12);
        expect(at(246).angle).toBeCloseTo(144 * Math.PI / 180, 12);
        expect(at(246).touches).toBe(false);
    }, 60000);

    it('⛓ …and over the WHOLE walk: every ledger row reproduced, ZERO extras', () => {
        const c = collect('r8-hammer-control');
        const ledger = c.run.spinnerContacts
            .filter((r) => r.arm === 'hammer')
            .map((r) => `${r.t}|${r.id}|${r.angle}`);
        const drawn = [];
        let evaluated = 0;
        for (let i = 0; i < c.samples.length; i += 1) {
            for (const l of hammerLinesAt(c.samples, i, 18).lines) {
                evaluated += 1;
                if (l.touches) drawn.push(`${i}|${l.id}|${l.angle}`);
            }
        }
        // A differential, not a spot check: 648 lines evaluated across the
        // walk and the two sets are equal — so the layer neither misses a
        // contact the engine billed nor invents one it did not.
        expect(evaluated).toBe(648);
        expect(drawn).toEqual(ledger);
        expect(ledger).toHaveLength(4);
    }, 60000);

    it('⚠ a NAMED absence, not an empty one: no clock ⇒ no line, with the reason', () => {
        // `r8-l6-bob-contact`'s boot declares no `save.time` (the roster sweep:
        // only 28 of 153 tapes ever have a live clock), so the honest answer is
        // a refusal that says so — a disc, not a line, is what a phaseless
        // hammer is, and `hammerReach` is where that lives.
        const c = collect('r8-l6-bob-contact');
        expect(c.run.gameTimeRefusal).toBeTruthy();
        // Force the clock-absent arm on a sample that carries a spinner body.
        const samples = [
            { level: 9, bodies: [], gameTime: null, player: { x: 0, y: 0 } },
            { level: 9, bodies: [{ id: 's', kind: 'spinner', x: 40, y: 40 }], gameTime: null,
                player: { x: 0, y: 0 } },
        ];
        const r = hammerLinesAt(samples, 1, 9);
        expect(r.lines).toEqual([]);
        expect(r.why).toContain('`Game.time`');
        expect(r.why).toContain('hammerReach');
        // Tick 0 has its own reason, and it is a DIFFERENT one.
        const zero = hammerLinesAt(
            [{ level: 9, bodies: [{ id: 's', kind: 'spinner', x: 40, y: 40 }], gameTime: 10,
                player: { x: 0, y: 0 } }], 0, 9);
        expect(zero.why).toContain('tick 0');
        // ⚠ And "no spinner in this room" is NOT a limitation — no reason.
        expect(hammerLinesAt([{ level: 9, bodies: [], gameTime: 10 }], 0, 9))
            .toEqual({ lines: [], why: null });
    }, 60000);
});

describe('⛓ slice 6 — the attack rects are the ledger\'s own', () => {
    it('r8-solve-18: a press rect is drawn on its FIRED tick and overlaps the spinner', () => {
        const c = collectRun(tape('r8-solve-18'), atlasLevelSource());
        const { presses } = overlaysFor(c);
        expect(presses.length).toBeGreaterThan(0);
        // A press that LANDED on a spinner — `spinnerPressHits` is the other
        // ledger, and it names the tick from the engine's side.
        const landed = c.run.spinnerPressHits.filter((h) => h.landed);
        expect(landed.length).toBeGreaterThan(0);
        const t = landed[0].t;
        const at = attackRectsAt(presses, t, landed[0].level);
        expect(at).toHaveLength(1);
        // ⛔ The rect is the ledger's — the rect the run COLLIDED — not a
        // `slashRect` recomputed here from the row's direction.
        expect(at[0].rect).toBe(presses.find((p) => p.fired === t).rect);
        // …and it overlaps the spinner's BODY hitbox at that same tick, which
        // is the two layers agreeing on the canvas.
        const bodies = bodiesAt(c.samples, t, landed[0].level).bodies
            .filter((b) => b.kind === 'spinner' && b.id === landed[0].id);
        expect(bodies).toHaveLength(1);
        const a = at[0].rect;
        const b = bodies[0].rect;
        expect(a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y).toBe(true);
        // ⚠ AND ABSENT AT A NON-PRESS TICK — the half that makes the first
        // half mean anything.
        const quiet = [...Array(60).keys()].map((i) => t + 3 + i)
            .find((n) => !presses.some((p) => p.fired === n));
        expect(attackRectsAt(presses, quiet, landed[0].level)).toEqual([]);
    }, 60000);

    it('⛔ keyed on `fired`, never on `t` — they differ by one BY TRANSCRIPTION', () => {
        const rows = [{ t: 10, fired: 11, level: 4, rect: { x: 0 } }];
        expect(attackRectsAt(rows, 11, 4)).toHaveLength(1);
        expect(attackRectsAt(rows, 10, 4)).toEqual([]);
        // …and filtered to the level being drawn, like every other layer.
        expect(attackRectsAt(rows, 11, 5)).toEqual([]);
        expect(attackRectsAt(undefined, 11, 4)).toEqual([]);
    });
});

describe('⛓ slice 6 — the chaser BOX tracks the stepped position tick for tick', () => {
    it('r7-act2-4: the box is chaserBoxAt of run.chasers, at three sampled ticks', () => {
        const c = collectRun(tape('r7-act2-4'), atlasLevelSource());
        // The tape walks a chaser room; `chaserWalks` is the engine's own
        // per-tick position ledger and is what the boxes are checked against.
        const walks = c.run.chaserWalks;
        expect(walks.length).toBeGreaterThan(3);
        const ticks = [walks[0].t, walks[Math.floor(walks.length / 2)].t,
            walks[walks.length - 1].t];
        let checked = 0;
        for (const t of ticks) {
            // `chaserWalks` rows are stamped `ticksCompleted + 1`, so the
            // position they report is the one the sample at THAT index holds
            // — the same off-by-one the hammer's splice made explicit.
            const rows = walks.filter((w) => w.t === t);
            const bodies = bodiesAt(c.samples, t, rows[0].level).bodies
                .filter((b) => b.kind === 'chaser');
            for (const row of rows) {
                const body = bodies.find((b) => b.id === row.id);
                if (!body) continue;
                // The box is centred on the ledger's own x/y, at the census
                // hitbox — position tracked tick for tick, size from the
                // engine.
                expect(body.x).toBe(row.x);
                expect(body.y).toBe(row.y);
                expect(body.rect.right - body.rect.x).toBe(8);
                expect(body.rect.bottom - body.rect.y).toBe(8);
                expect(body.rect.x).toBe(row.x - 4);
                expect(body.rect.y).toBe(row.y - 4);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThanOrEqual(3);
    }, 60000);
});

/**
 * ── ⛓⛓⛓ SLICE 8 — THE TWO `why` CHANNELS, AND THE LANES LAYER ────────────
 *
 * Both halves of this slice's page work exist because an EMPTY LAYER MEANS
 * TWO THINGS (trap 196) and only a population count tells them apart. The
 * rows below are written from the RUN, not from the survey's recorded file:
 * the numbers slice 7 measured are re-derived here so a drift in the atlas
 * moves the test rather than being papered over by a transcribed literal.
 */
describe('slice 8 — the hitboxes `why` channel', () => {
    /** One tick's sample, taken from a real run standing in `level`. */
    const sampleAt = (level, roles = ROLES) => {
        const run = createLevelRun({ levelSource: atlasLevelSource(), boot: { level, x: 16, y: 16 }, roles });
        return sampleMovers(run);
    };

    /**
     * ⛓⛓⛓ THE DRIVEN CASE, and it is a PAIR because one picture proves
     * nothing. L14 draws six boxes for six census bodies; L16 next door draws
     * ZERO for NINE, and before this channel the two empty-looking outcomes
     * were indistinguishable on the page.
     */
    it('⛓⛓⛓ L16 draws 0 of 9 and says WHY — while L14 draws 6 of 6 and says nothing', () => {
        const l14 = sampleAt(14);
        const l16 = sampleAt(16);
        // the populations, measured rather than quoted
        expect(l14.census.enemies).toBe(6);
        expect(l16.census.enemies).toBe(9);
        expect(l14.census.stepped).toBe(true);
        expect(l16.census.stepped).toBe(false);

        const drawn14 = bodiesAt([l14], 0, 14);
        expect(drawn14.bodies).toHaveLength(6);
        // ⛔ A ROOM THAT DREW EVERYTHING HAS NOTHING TO EXPLAIN. A `why` that
        // were always present would be noise, and a check that only asserted
        // the L16 string would pass on a page that printed it everywhere.
        expect(drawn14.why).toBe(null);

        const drawn16 = bodiesAt([l16], 0, 16);
        expect(drawn16.bodies).toEqual([]);
        expect(drawn16.why).toMatch(/^room refused: 9 census bod\(ies\)/);
    });

    /**
     * ⛓ THE REFUSAL'S TEXT IS THE ENGINE'S, VERBATIM — a page-side paraphrase
     * would be a second spelling of the reason, and the reason is the content.
     */
    it('⛓ the refusal text is `chaserRoomVerdict`\'s own, not a paraphrase', () => {
        const run = createLevelRun({
            levelSource: atlasLevelSource(), boot: { level: 16, x: 16, y: 16 }, roles: ROLES,
        });
        const verdict = run.chaserRoomVerdict(16);
        const why = bodiesAt([sampleMovers(run)], 0, 16).why;
        expect(verdict.stepped).toBe(false);
        expect(why.endsWith(verdict.why)).toBe(true);
    });

    it('an empty ROOM says so — and it is a different sentence from a refused one', () => {
        const l3 = sampleAt(3);
        expect(l3.census.enemies).toBe(0);
        const d = bodiesAt([l3], 0, 3);
        expect(d.bodies).toEqual([]);
        expect(d.why).toMatch(/no enemies in this room's census/);
        expect(d.why).not.toMatch(/refused/);
    });

    /**
     * ⚠ THE FOURTH ANSWER, and the one a chaser-count-only channel would have
     * got wrong: a relaxed-roles run never BUILT the combat census, so it has
     * no bodies and is missing none.
     */
    it('⚠ a COMBAT-BLIND run is a fourth answer, not "the room is empty"', () => {
        const blind = sampleAt(14, RELAXED_ROLES);
        expect(blind.census.consulted).toBe(false);
        const d = bodiesAt([blind], 0, 14);
        expect(d.bodies).toEqual([]);
        expect(d.why).toMatch(/COMBAT-BLIND/);
    });

    /**
     * ⛔ THE ALL-DEAD ARM, driven rather than faked at the boundary: L4's one
     * bob is alive at tick 0 and the arm must not fire, and a sample with the
     * body gone from a STEPPED room must produce it.
     */
    it('⛔ "all dead by this tick" is distinct from every other empty', () => {
        const l4 = sampleAt(4);
        expect(l4.census.enemies).toBe(1);
        expect(bodiesAt([l4], 0, 4).bodies).toHaveLength(1);
        // the same room, one body short — the shape a walk reaches after a kill
        const emptied = { ...l4, bodies: [] };
        const d = bodiesAt([emptied], 0, 4);
        expect(d.why).toMatch(/all 1 census bod\(ies\) in this room are gone by this tick/);
    });

    it('a sample with no census can be reported as absent but not explained', () => {
        expect(bodiesAt([{ level: 1, bodies: [] }], 0, 1)).toEqual({ bodies: [], why: null });
        // …and a cursor off the end, or in another level, is not an "absence"
        expect(bodiesAt([{ level: 1, bodies: [] }], 9, 1)).toEqual({ bodies: [], why: null });
    });
});

describe('slice 8 — the armed arrow-trap LANES layer', () => {
    const runAt = (level, over = {}) => createLevelRun({
        levelSource: atlasLevelSource(), boot: { level, x: 16, y: 16 }, roles: ROLES, ...over,
    });

    /**
     * ⛓⛓⛓ THE DRIVEN CASE — L16 stands three armed traps, and the lanes the
     * page draws are the ENGINE'S geometry through the hoisted adapter, not a
     * page-side retype. Asserted by RECOMPUTING them from `arrowTrap`'s own
     * exports: if the layer ever grew its own arithmetic, these would diverge.
     */
    it('⛓⛓⛓ L16\'s three armed traps each get a lane, at the engine\'s own geometry', () => {
        const run = runAt(16);
        const s = sampleMovers(run);
        const world = run.worldFor(16);
        expect(s.arrowTraps).toEqual({ placed: 3, armed: 3 });

        const got = arrowLanesAt([s], 0, 16);
        expect(got.why).toBe(null);
        expect(got.lanes).toHaveLength(3);
        for (const lane of got.lanes) {
            const placement = world.arrowTraps.find((t) => t.id === lane.id);
            expect(placement).toBeTruthy();
            expect(lane.rect).toEqual(
                arrowLaneRect(arrowLaneForPlacement(placement), world.world.height));
            // …and the lane really runs to the floor, which is the whole shape
            expect(lane.rect.bottom).toBe(world.world.height);
        }
    });

    /**
     * ⛔ THE THREE EMPTIES, EACH A DIFFERENT FACT. `null` and `0` armed are
     * the distinction `dangerMap` writes out at its own call site: only one
     * of them means "no trap is armed".
     */
    it('⛔ a room with no trap, a room with none armed, and a walk that cannot tell', () => {
        // (a) no trap at all
        const none = sampleMovers(runAt(14));
        expect(none.arrowTraps).toEqual({ placed: 0, armed: 0 });
        expect(arrowLanesAt([none], 0, 14).why).toMatch(/no arrow trap stands in this room/);

        // (b) traps here, none armed — L5's four are presser-driven
        const unarmed = sampleMovers(runAt(5));
        expect(unarmed.arrowTraps).toEqual({ placed: 4, armed: 0 });
        const r = arrowLanesAt([unarmed], 0, 5);
        expect(r.lanes).toEqual([]);
        expect(r.why).toMatch(/^4 arrow trap\(s\) stand here and NONE is armed at this tick/);

        // (c) ⚠ noclip — ARMED is not a question this walk can answer
        const blind = sampleMovers(runAt(5, { noclip: true }));
        expect(blind.arrowTraps.armed).toBe(null);
        const b = arrowLanesAt([blind], 0, 5);
        expect(b.lanes).toEqual([]);
        expect(b.why).toMatch(/is not a question this run can answer/);
        // ⛔ …and it is NOT the same sentence as (b), which is the whole point
        expect(b.why).not.toEqual(r.why);
    });

    it('is THIS TICK ONLY and filtered to the level being drawn', () => {
        const s = { level: 5, lanes: [{ id: 'a', t: 1, rect: {} }], arrowTraps: { placed: 1, armed: 1 } };
        expect(arrowLanesAt([s], 0, 5).lanes).toHaveLength(1);
        expect(arrowLanesAt([s], 0, 6)).toEqual({ lanes: [], why: null });
        expect(arrowLanesAt([s], 7, 5)).toEqual({ lanes: [], why: null });
    });
});

/**
 * ── ⛓⛓⛓ SLICE 9: THE WORLD-STATE LAYER, THE CRUSHERS AND THE SOLVER'S OWN
 * ── DANGER ──────────────────────────────────────────────────────────────
 *
 * Kickoff §12b item 8(c) + ⚖ item 9. Slice 6's audit priced what the
 * separately-built, never-advanced world COSTS (§14.3c): a rock broken at
 * tick 50 is still drawn as a wall at tick 300. These rows drive committed
 * tapes to the tick the change lands on and assert the mark is there — and,
 * for every mark that says a solid is GONE, ask the ENGINE whether it agrees.
 */
describe('slice 9 — the WORLD-STATE layer', () => {
    /**
     * Walk a tape through the ONE loop and stop at the first tick whose sample
     * carries a change, returning the sample, the derivation AND the engine's
     * own verdict at that instant.
     *
     * ⛔⛔ THE ENGINE VERDICT IS THE POINT OF THIS HELPER. `WORLD_STATE_FAMILIES`
     * is a page-side JOIN (which run set names which solid key) and the
     * authority is `levelWorld.liveRectOf`, a closure that cannot be imported.
     * So every GONE mark is put back to `world.collidesSolid`, asked with the
     * run's OWN `liveGeometryOpts()`: if the join's polarity ever drifts from
     * the engine's, this row fails instead of the page quietly drawing a wall
     * the game has removed.
     *
     * ⚠ AND THE VERDICT IS A NEGATIVE, WITH ITS BOUND STATED. `collidesSolid`
     * returns the FIRST solid overlapping a box, so "something is there" may be
     * a neighbouring wall tile rather than the entity — which is exactly what
     * L39's rope sits inside. The assertion is therefore *the engine does not
     * report THIS ENTITY at its build box*, which no shadowing can fake.
     */
    const firstChange = (name) => {
        let found = null;
        const stepper = createTapeStepper(tape(name), {
            levelSource: atlasLevelSource(),
            onTick: (t, state, held, run) => {
                if (!run || found) return;
                const s = sampleMovers(run);
                const got = worldChangesAt([s], 0, run.level);
                if (!got.changes.length) return;
                const world = run.worldFor(run.level);
                const live = run.liveGeometryOpts();
                found = {
                    tick: t,
                    level: run.level,
                    sample: s,
                    got,
                    // the engine's answer at each marked box, keyed by family
                    engine: got.changes.map((ch) => {
                        const key = FAMILY_KEY[ch.family];
                        const hit = world.collidesSolid(ch.base, live);
                        return { id: ch.id, effect: ch.effect, stillThere: hit ? hit[key] ?? null : null };
                    }),
                };
            },
        });
        for (let r = stepper.next(); !r.done; r = stepper.next()) { if (found) break; }
        return found;
    };
    const FAMILY_KEY = {
        openActivators: 'activatorId', openChests: 'chestId', brokenRocks: 'rockId',
        burnedTrees: 'treeId', pulledRopes: 'ropeId', turrets: 'turretId',
    };

    /**
     * ⛓⛓⛓ THE DRIVEN CASE, AS A PAIR — a chest drawn shut at tick 0 and
     * marked OPEN at tick 6, in the SAME room, on the SAME walk. One picture
     * proves nothing: the row that only showed the mark could not tell a layer
     * that tracks from a layer that marks everything.
     */
    it('⛓⛓⛓ L11\'s chest is unmarked at tick 0 and GONE at tick 6 — and the engine agrees', () => {
        const c = collectRun(tape('r7-act2-11'), levelSourceForTests);
        // the population, measured — one changeable object stands in this room
        expect(c.samples[0].changeCounts.placed).toBe(1);
        expect(c.samples[0].changeCounts.byFamily).toEqual({ openChests: 1 });

        const before = worldChangesAt(c.samples, 0, 11);
        expect(before.changes).toEqual([]);
        // ⛔ AND THE EMPTY SAYS WHICH EMPTY IT IS, with the count in it.
        expect(before.why).toMatch(/^1 changeable object\(s\) stand in this room and the run has changed NONE/);

        const first = firstChange('r7-act2-11');
        expect(first.tick).toBe(6);
        expect(first.got.why).toBe(null);
        expect(first.got.changes).toEqual([{
            id: 'chest@32,48',
            family: 'openChests',
            tag: expect.anything(),
            effect: 'gone',
            verb: 'OPENED',
            base: { x: 32, y: 48, w: 16, h: 16, right: 48, bottom: 64 },
            rect: null,
        }]);
        // ⛔ THE ENGINE'S OWN VERDICT: nothing solid is at the chest's box.
        expect(first.engine).toEqual([{ id: 'chest@32,48', effect: 'gone', stillThere: null }]);
    });

    it('⛓ L37\'s burnable tree is GONE at tick 118, at the 2x2 box the level built', () => {
        const first = firstChange('r5-l37-burn');
        expect(first.tick).toBe(118);
        expect(first.level).toBe(37);
        expect(first.got.changes.map((c) => [c.id, c.family, c.effect]))
            .toEqual([['burnabletree@128,192', 'burnedTrees', 'gone']]);
        // 32x32 — the whole point of marking rather than un-drawing is that the
        // reader can see WHICH box stopped being true.
        expect(first.got.changes[0].base).toEqual(
            { x: 128, y: 192, w: 32, h: 32, right: 160, bottom: 224 });
        expect(first.engine[0].stillThere).toBe(null);
    });

    /**
     * ⛔⛔ THE ROPE IS THE ONE THAT MUST NOT BE MARKED GONE, and the reason is
     * in `RopeStart.hit()`: `setHitbox(16, 16, 8, 8)` turns 112 px of wall into
     * 16 px of wall AT THE SPAN'S START. A layer that read "pulled" as "gone"
     * would open a tile the game keeps — which is the same class of lie as the
     * stale wall it exists to correct, in the other direction.
     */
    it('⛔⛔ L39\'s rope is SWAPPED, not gone — the builder\'s own shrunk box', () => {
        const first = firstChange('r5-shaft');
        expect(first.level).toBe(39);
        const ch = first.got.changes.find((c) => c.family === 'pulledRopes');
        expect(ch.effect).toBe('swapped');
        expect(ch.verb).toBe('PULLED');
        // the live box is REAL and it is SMALLER than the base — asserted as
        // an inequality on the geometry, so a page-side "resize" that agreed
        // by accident would still have to agree with the builder.
        expect(ch.rect).not.toBe(null);
        // ⚠ AREA, not height: L39's rope runs HORIZONTALLY, and a row that
        // asserted the shrink on one axis would pass on the vertical ropes and
        // silently stop meaning anything on this one.
        const area = (r) => (r.right - r.x) * (r.bottom - r.y);
        expect(area(ch.rect)).toBeLessThan(area(ch.base));
        const world = collectRun(tape('r5-shaft'), levelSourceForTests).run.worldFor(39);
        const solid = world.solids.find((s) => s.ropeId === ch.id);
        expect(ch.rect).toEqual(solid.shrunkRect);
        expect(ch.base).toEqual(solid.rect);
    });

    /**
     * ⛓⛓⛓ THE ICE TURRET IS THE INVERTED POLARITY, and it is why the layer
     * has a third verb. `IceTurret.type` is `"Enemy"` from the base ctor, so
     * the 32x32 body the level builds — and the renderer paints as a wall — is
     * NOT a wall while it lives. That mark is true from tick 0, before the run
     * has changed anything at all.
     */
    it('⛓⛓⛓ L40\'s LIVE ice turret is drawn as a wall and is NOT one — from tick 0', () => {
        const first = firstChange('r5-l40-part0');
        expect(first.tick).toBe(0);
        expect(first.got.changes.map((c) => [c.id, c.family, c.effect]))
            .toEqual([['iceturret@472,400', 'turrets', 'notsolid']]);
        expect(first.got.changes[0].verb).toMatch(/ALIVE/);
        // ⛔ THE ENGINE AGREES THERE IS NO WALL THERE — which is the assertion
        // that makes "drawn as a wall and is not one" a fact and not a caption.
        expect(first.engine[0].stillThere).toBe(null);
        // …and the room's population is counted across all six families
        expect(first.sample.changeCounts.placed).toBe(16);
        expect(first.sample.changeCounts.byFamily.brokenRocks).toBe(3);
    });

    /** ⚠ THE FOUR NAMED EMPTIES, and none of them is a silent `[]`. */
    it('⚠ four named empties — and "no world" is reported, never explained', () => {
        // (a) a sample with no world at all cannot be explained, only reported
        expect(worldChangesAt([{ level: 1, changes: [], changeCounts: null }], 0, 1))
            .toEqual({ changes: [], why: null });
        // (b) a room with nothing changeable in it
        const bare = { level: 1, changes: [], changeCounts: { placed: 0, byFamily: {}, changed: 0, blind: 0, families: 6 } };
        expect(worldChangesAt([bare], 0, 1).why).toMatch(/^no lock, chest, rock, tree, rope or ice turret/);
        // (c) ⚠ noclip: every family reports `null`, so "unchanged" is not a
        // question this walk can answer — a different fact from "unchanged".
        const blind = { level: 1, changes: [], changeCounts: { placed: 4, byFamily: {}, changed: 0, blind: 6, families: 6 } };
        expect(worldChangesAt([blind], 0, 1).why).toMatch(/`noclip`/);
        expect(worldChangesAt([blind], 0, 1).why).toMatch(/NOT the same fact/);
        // (d) …and the three sentences are three sentences
        const none = { level: 1, changes: [], changeCounts: { placed: 4, byFamily: {}, changed: 0, blind: 0, families: 6 } };
        const sentences = new Set([bare, blind, none].map((s) => worldChangesAt([s], 0, 1).why));
        expect(sentences.size).toBe(3);
    });

    it('is THIS TICK ONLY and filtered to the level being drawn', () => {
        const s = { level: 5, changes: [{ id: 'a' }], changeCounts: { placed: 1, byFamily: {}, changed: 1, blind: 0, families: 6 } };
        expect(worldChangesAt([s], 0, 5).changes).toHaveLength(1);
        expect(worldChangesAt([s], 0, 6)).toEqual({ changes: [], why: null });
        expect(worldChangesAt([s], 9, 5)).toEqual({ changes: [], why: null });
    });
});

describe('slice 9 — the CRUSHERS, the R5 forward\'s first reader', () => {
    /**
     * ⛔ FROM THE FRAME, NOT FROM A SECOND SAMPLING. `frames[].crushers` and
     * `frames[].crusherScans` have ridden on every frame since R5 slice 16 and
     * were read by NOBODY (kickoff §14.4b). These rows read exactly what the
     * page reads — the frame the scrubber is showing.
     */
    /**
     * ⚠ ONE WALK, MEMOISED, AND BOUNDED. `r5-l41-part3` is 2,261 ticks; both
     * rows want frames 0 and 300, and collecting the whole tape twice put each
     * within a second of the suite's 10 s per-test budget — a red that would
     * have read as a defect and was a second walk. The stepper is the SAME one
     * `collectRun` drives; only the stopping point is this row's.
     */
    const walks = new Map();
    const framesOf = (name, upTo) => {
        if (!walks.has(name)) {
            const frames = [];
            const stepper = createTapeStepper(tape(name), { levelSource: levelSourceForTests });
            for (let r = stepper.next(); !r.done && frames.length <= upTo; r = stepper.next()) {
                frames.push(r.value);
            }
            walks.set(name, frames);
        }
        return walks.get(name);
    };
    const at = (frames, t) => crushersAt({
        crushers: frames[t].crushers, crusherScans: frames[t].crusherScans });

    it('⛓⛓⛓ L41\'s crusher is drawn where the RUN has it, with the scan\'s own four lanes', () => {
        const frames = framesOf('r5-l41-part3', 300);
        const t0 = at(frames, 0);
        expect(t0.why).toBe(null);
        expect(t0.crushers).toHaveLength(1);
        const c = t0.crushers[0];
        expect(c.id).toBe('crusher@240,64');
        expect(c.resting).toBe(true);
        // ⛔ THE LANES ARE `detectionRects`' OWN — recomputed here from the
        // engine's export, so a layer that grew its own arithmetic diverges.
        expect(c.lanes.map((l) => ({ dir: l.dir, rect: l.rect })))
            .toEqual(detectionRects({ x: c.x, y: c.y }).map((r) => ({
                dir: r.dir, rect: { x: r.x, y: r.y, right: r.right, bottom: r.bottom },
            })));
        // ⛓ …and exactly the lanes the run's own scan MATCHED are live
        expect(c.lanes.filter((l) => l.live).map((l) => l.dir)).toEqual(['W']);
    });

    /**
     * ⛓⛓ THE BODY MOVES, WHICH IS THE WHOLE REASON THE BASE PICTURE CANNOT BE
     * TRUSTED FOR THIS FAMILY: `Crusher` charges at a player it can SEE, so
     * the constructor cell is wrong from the first tick a bait commits.
     */
    it('⛓⛓ the body MOVES off its build cell, and a SHIELDED crusher says so', () => {
        const frames = framesOf('r5-l41-part3', 300);
        const t0 = at(frames, 0).crushers[0];
        const late = at(frames, 300).crushers[0];
        expect(late.rect).not.toEqual(t0.rect);
        // ⛔ AN EARLY EXIT IS A DIFFERENT PICTURE FROM "SEES NOTHING".
        // `scanCrusher` returns before it walks a single lane when the sight
        // line is blocked, so an empty `matched` here has nothing to do with
        // where the player is standing — and the entry says which.
        expect(late.shieldedBy).toBe('tile:Blue Wall');
        expect(late.lanes.filter((l) => l.live)).toEqual([]);
        expect(t0.shieldedBy).toBe(null);
    });

    it('⚠ the two empties are named, and they are different facts', () => {
        expect(crushersAt({ crushers: null, crusherScans: null }).why).toMatch(/`noclip`/);
        expect(crushersAt({ crushers: new Map(), crusherScans: new Map() }).why)
            .toMatch(/^no crusher stands in this room/);
        // a view with no per-tick source at all is an absence, not an explanation
        expect(crushersAt(null)).toEqual({ crushers: [], why: null });
    });
});

describe('⚖ slice 9 — the DANGER the SOLVER was told (item 9)', () => {
    const solveL4 = () => solveForPage({
        levelSource: levelSourceForTests,
        staging: stagingFromTape(parseTape(tape('r7-act2-4'))),
        goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }],
        name: 'slice9-L4',
    });

    /**
     * ⛔⛔⛔ THE LAYER RENDERS WHAT THE SOLVER RECORDED. Nothing here calls
     * `dangerAt`, and nothing on the page may: ⚖ item 9 supersedes slice 6's
     * refusal (§14.4c) only for a layer drawing the bot's own reason lists.
     */
    it('⛓⛓⛓ an in-page SOLVE records its own danger queries, at the TAPE\'s clock', () => {
        const { out } = solveL4();
        const q = out.dangerQueries;
        expect(q.length).toBeGreaterThan(0);
        // ⚠ TWO CLOCKS, BOTH CARRIED. `tick` is the tape's (what the scrub
        // cursor indexes); `runTick` is the run's. A recording that carried
        // only one would put a warning at a cursor the walk never had.
        for (const row of q) {
            expect(row.tick).toBeLessThanOrEqual(out.perTick.length);
            expect(row.runTick).toBeGreaterThanOrEqual(row.tick);
            expect(row.level).toBe(4);
            expect(['sense', 'gate']).toContain(row.where);
        }
        // …and the ticks index into the folded tape the page then replays
        const drawn = dangerQueriesAt(q, q[0].tick, 4);
        expect(drawn.why).toBe(null);
        expect(drawn.queries.length).toBeGreaterThan(0);
    });

    /**
     * ⛓⛓⛓ THE SLICE'S MEASURED FINDING, PINNED AS A ROW: on a SUCCESSFUL
     * segment every recorded query is CLEAR, and that is a theorem rather than
     * an accident. `refuseDanger` THROWS when the union answers danger, so a
     * segment that reaches its goal cannot have had a dangerous gate — the
     * layer's danger ink is the colour of a refusal.
     *
     * ⚠ Swept: 30 solves over 9 committed staging blocks, 62+ recorded
     * queries, ZERO with a non-empty reason list. If this row ever goes red it
     * has found something worth reading, which is why it asserts the
     * population rather than merely tolerating it.
     */
    it('⛓⛓⛓ every query a SUCCESSFUL solve records is CLEAR — the purple is a refusal\'s colour', () => {
        const { out } = solveL4();
        expect(out.dangerQueries.filter((r) => r.danger)).toEqual([]);
        expect(out.dangerQueries.every((r) => r.sources.length === 0)).toBe(true);
    });

    /** ⚖ THE CONDITION IN THE RULING: absence reported BY NAME, never redrawn. */
    it('⚖ a REPLAY or MANUAL source says "no solver ran" — it does not recompute', () => {
        const d = dangerQueriesAt(null, 0, 4);
        expect(d.queries).toEqual([]);
        expect(d.why).toMatch(/^no solver ran — no danger data/);
        expect(d.why).toMatch(/a window, not a third opinion/);
        // ⛔ …and `[]` is a DIFFERENT answer from `null`: a solver that ran and
        // asked nothing is a finding about the solver, not about the source.
        expect(dangerQueriesAt([], 0, 4).why).toMatch(/^the solve recorded NO danger query/);
        expect(dangerQueriesAt([], 0, 4).why).not.toEqual(d.why);
    });

    /**
     * ⚠ SPARSENESS IS THE NORM AND IS REPORTED WITH ITS NEIGHBOUR. The bot
     * asks at DECISION points, so most ticks carry none — and a reason that
     * only said "none here" would leave a reader unable to find the ones that
     * exist.
     */
    it('⚠ a tick with no query names the count AND the nearest tick that has one', () => {
        const q = solveL4().out.dangerQueries;
        const gap = dangerQueriesAt(q, q[0].tick + 1, 4);
        expect(gap.queries).toEqual([]);
        expect(gap.why).toMatch(/it asks at DECISION points, not every tick/);
        expect(gap.why).toMatch(new RegExp(`the nearest is tick ${q[0].tick}`));
        // a level the solve never planned in is its own sentence
        expect(dangerQueriesAt(q, 0, 99).why).toMatch(/NONE of them in level 99/);
    });

    /**
     * ⛔ THE DANGEROUS SHAPE, exercised where it can be: the derivation is
     * pure, so a query WITH sources is a synthetic row — and it must carry the
     * union's `why` through VERBATIM, because the reason is the whole content
     * of the channel.
     */
    it('⛔ a query WITH sources carries the union\'s own reason, verbatim', () => {
        const rows = [{
            where: 'gate', tick: 5, runTick: 5, level: 4, x: 24, y: 24,
            danger: true, mode: 'wait', horizon: 0,
            sources: [{ kind: 'arrowLane', id: 'arrowtrap@96,16', why: 'an ARMED trap\'s lane' }],
        }];
        const got = dangerQueriesAt(rows, 5, 4);
        expect(got.why).toBe(null);
        expect(got.queries[0].danger).toBe(true);
        expect(got.queries[0].sources[0].why).toBe('an ARMED trap\'s lane');
    });
});
