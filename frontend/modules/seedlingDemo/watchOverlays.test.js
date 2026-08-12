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
    ACTION_KEYS, activeTraceIndex, attackRectsAt, bodiesAt, channelSummary, collectRun,
    defaultLayerSet, extractMarkers, hammerLinesAt, keyEdges, LAYER_IDS, MARKER_GLYPHS,
    markersVisibleAt, OVERLAY_LAYERS, overlaysFor, parseLayersParam, pathPointsUpTo,
    sampleMovers, traceRowFields, traceSidecarPath,
} from './watchOverlays.js';
import { formatTraceRow } from './decisionTrace.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const tape = (name) =>
    JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

// ── the layer roster ─────────────────────────────────────────────────────

describe('the layer roster', () => {
    it('⚖ arrow paths are the ONE layer that defaults OFF (kickoff §1.6)', () => {
        // ⛓ SLICE 6 widened the roster to eleven; `arrows` is still the only
        // OFF one, and the reason is unchanged — it is the only CUMULATIVE
        // layer whose ink scales with bodies × ticks. The three new ones are
        // this-tick-only, so the argument that put `arrows` off does not
        // reach them (the roster's own slice-6 note).
        expect([...defaultLayerSet()].sort()).toEqual([
            'action', 'attacks', 'damage', 'enemies', 'events', 'hammer', 'hitboxes',
            'player', 'pushables', 'volumes',
        ]);
        expect(OVERLAY_LAYERS.find((l) => l.id === 'arrows').on).toBe(false);
        expect(OVERLAY_LAYERS.filter((l) => !l.on).map((l) => l.id)).toEqual(['arrows']);
    });

    it('⛓ SLICE 6: the three new layers are `shape` — this tick, not the walk', () => {
        const shapes = OVERLAY_LAYERS.filter((l) => l.kind === 'shape').map((l) => l.id);
        expect(shapes).toEqual(['hitboxes', 'hammer', 'attacks']);
        // The distinction the renderer branches on, pinned: a `path` layer is
        // cumulative to the cursor and a `shape` layer is the cursor's tick.
        expect(OVERLAY_LAYERS.filter((l) => l.kind === 'path').map((l) => l.id))
            .toEqual(['player', 'enemies', 'pushables', 'arrows']);
        expect(LAYER_IDS).toHaveLength(11);
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
        expect(bodiesAt(samples, 1, 1).map((b) => b.id)).toEqual(['b']);
        expect(bodiesAt(samples, 2, 1)).toEqual([]);
        expect(bodiesAt(samples, 2, 2).map((b) => b.id)).toEqual(['c']);
        expect(bodiesAt(samples, 99, 1)).toEqual([]);
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
        const bodies = bodiesAt(c.samples, t, landed[0].level)
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
            const bodies = bodiesAt(c.samples, t, rows[0].level)
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
