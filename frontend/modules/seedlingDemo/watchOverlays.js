/**
 * seedlingDemo/watchOverlays — the editor page's OVERLAY LAYERS, without
 * the DOM (editor arc slice 2).
 *
 * ⚠ TOOLING ONLY, and the same three laws as `watchViewer`/`watchSolve`: it
 * makes no claims, gates nothing, and nothing that DOES make a claim may
 * depend on it.
 *
 * ⛔ RAW TRUTH, WHICH FOR AN OVERLAY MEANS THREE THINGS.
 *
 *  1. **Sampled, never interpolated.** A mover's path is the positions the
 *     run actually held on each tick, one point per tick, exactly like the
 *     player breadcrumb trail. Nothing is smoothed between ticks and no
 *     point is elided; a body that sat still for eighty ticks contributes
 *     eighty coincident points, which is the honest picture of a body that
 *     sat still.
 *  2. **A marker draws at the position AT THE TICK its ledger names**, and
 *     it is FILTERED TO THE LEVEL BEING DRAWN — the trail's own law, for
 *     the same reason: every level is its own coordinate space, so a hit
 *     recorded at (57,71) in L18 means nothing at (57,71) in L19.
 *  3. **A ledger row this module cannot place is REPORTED BY NAME**, in
 *     `unplaced`, never dropped. `makeRenderer`'s `unknownShapes` is the
 *     precedent and the reason is identical: "nothing drawn" and "nothing
 *     happened" look the same on a canvas, and the difference is exactly
 *     what a viewer exists to show.
 *
 * ⛔ AND IT OWNS NO LOOP. Every sample comes from the ONE loop —
 * `createTapeStepper`'s `onTick` hook, which is handed the live run — so
 * the overlay is a second READING of the walk the page is already
 * replaying, never a second simulation of it. See `sampleMovers`.
 *
 * ── WHY THIS IS NOT IN `watchViewer.js` ───────────────────────────────
 *
 * The same split `watchSolve` made: everything here is pure (a run-shaped
 * object and some ledgers in, points and markers out) so it is unit-
 * testable in node while the viewer stays a DOM script. The part that
 * decides WHAT a layer contains is the part that can quietly disagree with
 * the run, so it is the part that gets tests.
 */

import { KEY_NAMES, parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { formatTraceRow } from './decisionTrace.js';

/**
 * ⛔ THE LAYER ROSTER — kickoff §3.2's table, transcribed once.
 *
 * `on` is the DEFAULT, and `arrows: false` is a ⚖ ruling (kickoff §1.6),
 * not a taste: an arrow path is one dot per tick per arrow and an arrow
 * room fills the canvas with them.
 *
 * `volumes` is the page's pre-existing checkbox and is listed here anyway —
 * a roster that named seven of the eight toggles would make `?layers=`
 * silently unable to address the eighth.
 */
export const OVERLAY_LAYERS = Object.freeze([
    Object.freeze({ id: 'player', label: 'player path', kind: 'path', on: true }),
    Object.freeze({ id: 'enemies', label: 'enemy paths (chasers, spinners)', kind: 'path', on: true }),
    Object.freeze({ id: 'pushables', label: 'pushable positions', kind: 'path', on: true }),
    Object.freeze({ id: 'arrows', label: 'arrow paths', kind: 'path', on: false }),
    Object.freeze({ id: 'action', label: 'action markers (attack-key edges)', kind: 'marker', on: true }),
    Object.freeze({ id: 'damage', label: 'damage / death markers', kind: 'marker', on: true }),
    Object.freeze({ id: 'events', label: 'event markers (grants, transitions)', kind: 'marker', on: true }),
    Object.freeze({ id: 'volumes', label: 'hazard volumes', kind: 'volume', on: true }),
]);

export const LAYER_IDS = Object.freeze(OVERLAY_LAYERS.map((l) => l.id));

/** The ON set when no `?layers=` says otherwise. */
export const defaultLayerSet = () =>
    new Set(OVERLAY_LAYERS.filter((l) => l.on).map((l) => l.id));

/**
 * `?layers=a,b,c` — the ON set, and everything else OFF.
 *
 * ⚠ AN UNKNOWN NAME IS REPORTED, NOT REFUSED AND NOT IGNORED. Throwing
 * would take the whole page down over a typo in a query string; ignoring
 * would show the DEFAULT layers under a URL that asked for others, which is
 * the silent-failure shape this arc's own laws forbid. So the legal names
 * are honoured, the rest come back in `unknown`, and the page says so.
 *
 * `on: null` means the parameter was absent — which is different from
 * `?layers=` (present and empty), and that difference is "everything off".
 */
export function parseLayersParam(raw) {
    if (raw === null || raw === undefined) return { on: null, unknown: [] };
    const names = String(raw).split(',').map((s) => s.trim()).filter((s) => s !== '');
    const on = new Set();
    const unknown = [];
    for (const n of names) {
        if (LAYER_IDS.includes(n)) on.add(n);
        else unknown.push(n);
    }
    return { on, unknown };
}

/**
 * The attack keys, by name — the edges the ACTION layer marks.
 *
 * ⚠ `primary` is X (`Player.attack`) and `secondary` is C (the item slot).
 * Movement keys are deliberately NOT here: an edge on `right` is a step,
 * and a marker on every step is the breadcrumb trail with more ink.
 */
export const ACTION_KEYS = Object.freeze(['primary', 'secondary']);

/**
 * Rising edges of the named keys across a per-tick held sequence.
 *
 * ⛔ EDGES, NOT HOLDS. `Player.attack` fires on the frame the key goes
 * DOWN; a five-tick hold is one swing, and a marker per held tick would
 * report five. The whole reason this is a separate reading from the run's
 * own `presses` ledger is that the two are derived from different things —
 * the tape's input spans here, the collided rect there — and the editor
 * acceptance row is that they agree on the ticks.
 */
export function keyEdges(heldPerTick, keys = ACTION_KEYS) {
    for (const k of keys) {
        if (!KEY_NAMES.includes(k)) {
            throw new Error(`watchOverlays: "${k}" is not a tape key. The legal names are `
                + `${KEY_NAMES.join(', ')} — one definition, shared with the format the `
                + 'game is handed.');
        }
    }
    const out = [];
    let prev = new Set();
    for (let t = 0; t < heldPerTick.length; t += 1) {
        const now = heldPerTick[t] instanceof Set ? heldPerTick[t] : new Set(heldPerTick[t] ?? []);
        for (const k of keys) if (now.has(k) && !prev.has(k)) out.push({ tick: t, key: k });
        prev = now;
    }
    return out;
}

/**
 * ⛓ ONE PER-TICK SAMPLE OF EVERY MOVER, taken INSIDE the one loop.
 *
 * `createTapeStepper`'s `onTick(tick, state, held, run)` hands the live run
 * to its caller once per observation — the seam its own docblock calls "the
 * one seam a claim may read live state through". This reads it and copies
 * out the four position channels the yielded frame does NOT carry
 * (`world`, `crushers` and `crusherScans` are already on the frame;
 * `chasers`, `spinnerBodies`, `pushables` and `arrowsInFlight` are not).
 *
 * ⛔ IT COPIES RATHER THAN KEEPING THE RUN'S OBJECTS. The getters hand back
 * fresh arrays but the underlying bodies keep moving; a viewer that stored
 * the getter's rows and read them after the loop would draw the LAST tick's
 * geometry at every scrub position — which is exactly the mistake slice 1
 * documented on the world side and deliberately did not make.
 *
 * ⚠ `null` CHANNELS ARE HONEST ABSENCES, not empties. `run.pushables` is
 * `null` under `noclip` and `run.chasers` is `[]` under `noclip` or
 * `noDamage`, because under those flags the steppers do not run and there
 * are no live positions to report. Both come through as an empty layer, and
 * the page's own emptiness readout is what says which tapes those were.
 */
export function sampleMovers(run) {
    const enemies = [];
    for (const c of run.chasers ?? []) {
        enemies.push({ id: c.id, kind: 'chaser', x: c.x, y: c.y });
    }
    for (const s of run.spinnerBodies ?? []) {
        enemies.push({ id: s.id, kind: 'spinner', x: s.x, y: s.y });
    }
    const pushables = [];
    // A Map keyed by id — `pushableRects`' own shape. A REMOVED block has no
    // position to draw, and drawing its last one would put a wall where the
    // run has none.
    for (const [id, b] of run.pushables ?? []) {
        if (b.removed) continue;
        pushables.push({ id, x: b.rect.x, y: b.rect.y, w: b.rect.w, h: b.rect.h });
    }
    const arrows = (run.arrowsInFlight ?? []).map((a) => ({ id: a.id, x: a.x, y: a.y }));
    return { level: run.level, enemies, pushables, arrows };
}

/**
 * ⛓⛓⛓ THE COLLECT PASS — the tape's frames AND its overlay samples, in ONE
 * walk of the ONE loop.
 *
 * ⛔ IT LIVES HERE, NOT IN THE PAGE, FOR THE REASON `watchSolve` exists.
 * The acceptance rows below assert what the overlays contain; if the page
 * collected samples with its own copy of this loop, the rows would be
 * checking a derivation nothing on screen used. One walk, two readers — the
 * DOM and the tests — and `samples[i]` is `frames[i]`'s own instant BY
 * CONSTRUCTION: `onTick` fires immediately before the frame for that tick is
 * yielded, so the two arrays cannot fall out of step.
 *
 * ⚠ A THROW MID-WALK IS RETURNED, NOT RAISED. `runTape` refuses a tape that
 * grants into a level it never enters, and the page's answer to that has
 * always been to show what it got and say where it stopped — so the partial
 * frames come back beside the error rather than instead of it.
 */
export function collectRun(tape, levelSource) {
    const parsed = parseTape(tape);
    const samples = [];
    let run = null;
    const stepper = createTapeStepper(tape, {
        levelSource,
        onTick: (tick, state, held, r) => {
            run = r;
            // A tape with no run (the v1 engine, no levelSource) has no
            // movers — an EMPTY sample, never a missing one.
            samples.push(r ? sampleMovers(r)
                : { level: parsed.boot.level, enemies: [], pushables: [], arrows: [] });
        },
    });
    const frames = [];
    let finished = null;
    let error = null;
    try {
        for (let r = stepper.next(); ; r = stepper.next()) {
            if (r.done) { finished = r.value; break; }
            frames.push(r.value);
        }
    } catch (e) {
        error = e;
    }
    return { parsed, frames, samples, finished, run, error };
}

/**
 * Every marker a collected walk implies — the ledgers, placed on the frames.
 *
 * The page and the acceptance script both call THIS; neither reaches into
 * `extractMarkers`' argument shape itself, so "which ledgers feed which
 * layer" is written down once.
 */
export function overlaysFor({ frames, run }) {
    return extractMarkers({
        hits: run?.playerHits ?? [],
        deaths: run?.playerDeaths ?? [],
        grants: run?.grantsFired ?? [],
        transitions: run?.transitions ?? [],
        clears: run?.earnedClears ?? [],
        held: frames.map((f) => f.held),
        frameAt: (t) => (frames[t]
            ? {
                level: frames[t].observation.level,
                x: frames[t].observation.x,
                y: frames[t].observation.y,
            }
            : null),
    });
}

/** The glyph vocabulary. The legend renders THIS — one list, one page. */
export const MARKER_GLYPHS = Object.freeze({
    action: Object.freeze({ glyph: 'square', colour: '#ffd75f', label: 'attack key pressed' }),
    hit: Object.freeze({ glyph: 'cross', colour: '#ff5f5f', label: 'player hit' }),
    death: Object.freeze({ glyph: 'diamond', colour: '#ff2f2f', label: 'player death' }),
    grant: Object.freeze({ glyph: 'plus', colour: '#d8c030', label: 'items granted' }),
    transition: Object.freeze({ glyph: 'triangle', colour: '#3fd8ce', label: 'level transition' }),
});

/**
 * ⛔ EVERY MARKER THE OVERLAYS DRAW, AND EVERY LEDGER ROW THEY COULD NOT.
 *
 * `frameAt(tick)` is the collected frames' own `{level, x, y}` — the
 * position the run held on that tick, which is what "at the tick the ledger
 * names" means. A row whose tick falls outside the collected frames is
 * UNPLACED rather than clamped: clamping would draw a hit at a position the
 * player was never at on that tick, which is the one thing an overlay must
 * not do.
 *
 * ⛔⛔ `clears` IS UNPLACEABLE BY CONSTRUCTION, AND SAYING SO IS THE POINT.
 * `run.earnedClears` is `{level, tag, by}` — it has NO TICK. It is built to
 * be set-compared against the game's `persistence_cleared` readout, and a
 * set comparison never needed one. So every clear lands in `unplaced` with
 * that reason rather than being dropped (a layer silently missing an arm
 * the §3.2 table promised) or invented (a marker at a tick nobody recorded).
 */
export function extractMarkers({
    hits = [], deaths = [], grants = [], transitions = [], clears = [],
    held = [], frameAt,
} = {}) {
    const markers = [];
    const unplaced = [];
    const place = (layer, tick, source, label, what) => {
        const at = frameAt(tick);
        if (!at) {
            unplaced.push({
                layer,
                what,
                why: `tick ${tick} is outside the collected frames, so there is no `
                    + 'position the run held on it — a marker drawn anyway would be at a '
                    + 'place the player never was',
            });
            return;
        }
        markers.push({
            layer, tick, source, label, level: at.level, x: at.x, y: at.y,
        });
    };

    for (const e of keyEdges(held)) {
        place('action', e.tick, 'action', `${e.key} pressed`, `key edge ${e.key}@${e.tick}`);
    }
    for (const h of hits) {
        place('damage', h.t, 'hit',
            `hit by ${h.source}${h.id ? ` (${h.id})` : ''} — ${h.hits}/${h.hitsMax}`
            + `${h.died ? ' — FATAL' : ''}`,
            `playerHit ${h.source}@${h.t}`);
    }
    for (const d of deaths) {
        place('damage', d.t, 'death',
            `DEATH by ${d.source}${d.id ? ` (${d.id})` : ''} — respawn `
            + `${d.respawn ? `${d.respawn.x},${d.respawn.y}` : '?'}`,
            `playerDeath@${d.t}`);
    }
    for (const g of grants) {
        place('events', g.t, 'grant', `granted ${(g.items ?? []).join('+') || '(nothing)'}`,
            `grant L${g.level}@${g.t}`);
    }
    for (const tr of transitions) {
        place('events', tr.t, 'transition', `L${tr.from_level} → L${tr.to_level}`,
            `transition ${tr.from_level}->${tr.to_level}@${tr.t}`);
    }
    for (const c of clears) {
        unplaced.push({
            layer: 'events',
            what: `earned clear L${c.level} tag ${c.tag} (by ${c.by})`,
            why: '`run.earnedClears` carries {level, tag, by} and NO TICK — it exists to '
                + 'be set-compared against the game\'s `persistence_cleared` readout, and '
                + 'a set comparison never needed one. There is no honest tick to draw it at',
        });
    }
    markers.sort((a, b) => a.tick - b.tick);
    return { markers, unplaced };
}

/**
 * The markers to paint right now: at or before the cursor, in THIS level.
 *
 * ⚠ AT OR BEFORE, exactly like the breadcrumb trail. A marker for a hit
 * forty ticks in the future, visible while scrubbing the opening, would say
 * the run had already taken it.
 */
export const markersVisibleAt = (markers, cursor, level, on) => markers.filter(
    (m) => m.tick <= cursor && m.level === level && on.has(m.layer));

/**
 * One mover channel's points, up to the cursor, in THIS level.
 *
 * `samples[t]` is the sample taken on tick `t`; `samples[t].level` is the
 * level the run was in then, which is what filters it — a body sampled in
 * L18 must not be drawn on L19's canvas.
 */
export function pathPointsUpTo(samples, cursor, level, channel) {
    const out = [];
    const end = Math.min(cursor, samples.length - 1);
    for (let t = 0; t <= end; t += 1) {
        const s = samples[t];
        if (!s || s.level !== level) continue;
        for (const b of s[channel] ?? []) out.push(b);
    }
    return out;
}

/** How many DISTINCT bodies a channel ever showed — the emptiness readout. */
export function channelSummary(samples, channel) {
    const ids = new Set();
    let points = 0;
    for (const s of samples) {
        for (const b of s?.[channel] ?? []) { ids.add(b.id); points += 1; }
    }
    return { ids: [...ids].sort(), bodies: ids.size, points };
}

// ── the trace pane (kickoff §3.3) ────────────────────────────────────────

/**
 * `…/fixtures/tapes/<name>.json` → `…/fixtures/traces/<name>.trace.json`.
 *
 * ⛔ ONE CONVENTION, and it is `decisionTrace.traceSidecarName`'s — the
 * sidecar is `<tape name>.trace.json` beside the tapes' sibling directory.
 * A page that spelled the convention a second time would find nothing the
 * day the convention moved, and "no trace for this tape" is exactly what a
 * wrong path looks like.
 *
 * Returns `{path}` or `{path: null, why}`; a tape outside a `tapes/`
 * directory has no derivable sidecar and says so rather than guessing.
 */
export function traceSidecarPath(tapePath) {
    const clean = String(tapePath ?? '').replace(/^\/+/, '');
    const m = /^(.*)\/tapes\/([^/]+)\.json$/.exec(clean);
    if (!m) {
        return {
            path: null,
            why: `${clean || '(no tape)'} is not `
                + '`<dir>/tapes/<name>.json`, so there is no sidecar path to derive — '
                + 'traces live in the `traces/` directory beside `tapes/`, keyed by the '
                + 'tape\'s own name',
        };
    }
    return { path: `${m[1]}/traces/${m[2]}.trace.json`, why: null };
}

/**
 * The pane's fields for one trace row — §3.3's five, as strings.
 *
 * The one-line form is `decisionTrace.formatTraceRow`, the CLI's own, and
 * it rides along as the row's tooltip so the pane and
 * `show-seedling-trace --dump` cannot drift into two summaries of one row.
 */
export function traceRowFields(row) {
    return {
        tick: row.tick,
        goal: row.goal.kind,
        obstacle: row.obstacle
            ? `${row.obstacle.kind}${row.obstacle.id ? `:${row.obstacle.id}` : ''}`
            : '—',
        strategy: row.strategy.verb,
        rejected: row.rejected.map((r) => `${r.option} (${r.why})`),
        line: formatTraceRow(row),
    };
}

/**
 * The index of the last row at or before the cursor, or -1.
 *
 * A trace is SPARSE (a row per DECISION), so the highlighted row is "the
 * decision in force right now" and every row above it is history. Rows are
 * strictly increasing by contract, so a scan is honest and a binary search
 * would be the same answer with more code.
 */
export function activeTraceIndex(rows, cursor) {
    let idx = -1;
    for (let i = 0; i < rows.length; i += 1) {
        if (rows[i].tick <= cursor) idx = i; else break;
    }
    return idx;
}
