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
    ACTION_KEYS, activeTraceIndex, channelSummary, collectRun, defaultLayerSet,
    extractMarkers, keyEdges, LAYER_IDS, MARKER_GLYPHS, markersVisibleAt, OVERLAY_LAYERS,
    overlaysFor, parseLayersParam, pathPointsUpTo, sampleMovers, traceRowFields,
    traceSidecarPath,
} from './watchOverlays.js';
import { formatTraceRow } from './decisionTrace.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const tape = (name) =>
    JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));

// ── the layer roster ─────────────────────────────────────────────────────

describe('the layer roster', () => {
    it('⚖ arrow paths are the ONE layer that defaults OFF (kickoff §1.6)', () => {
        expect([...defaultLayerSet()].sort())
            .toEqual(['action', 'damage', 'enemies', 'events', 'player', 'pushables', 'volumes']);
        expect(OVERLAY_LAYERS.find((l) => l.id === 'arrows').on).toBe(false);
    });

    it('every layer has a distinct id and a human label', () => {
        expect(new Set(LAYER_IDS).size).toBe(OVERLAY_LAYERS.length);
        for (const l of OVERLAY_LAYERS) expect(l.label.length).toBeGreaterThan(3);
    });

    it('⛔ every marker source the extractor emits has a GLYPH — no silent marker', () => {
        // The mutation this guards: adding a source to `extractMarkers` and
        // forgetting the legend leaves a marker the renderer cannot draw.
        const sources = new Set(['action', 'hit', 'death', 'grant', 'transition']);
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
        expect(s).toEqual({ level: 3, enemies: [], pushables: [], arrows: [] });
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

    it('⛔⛔ a CLEAR has no tick, so it is UNPLACED and says exactly why', () => {
        const { markers, unplaced } = extractMarkers({
            clears: [{ level: 18, tag: 0, by: 'lock@144,112' }], frameAt,
        });
        expect(markers).toEqual([]);
        expect(unplaced).toHaveLength(1);
        expect(unplaced[0].what).toContain('L18 tag 0');
        expect(unplaced[0].why).toMatch(/NO TICK/);
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
