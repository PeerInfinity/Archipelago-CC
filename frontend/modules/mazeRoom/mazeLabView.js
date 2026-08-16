/**
 * mazeRoom/mazeLabView — **THE MAZE LAB PAGE'S DOM ARM.** `lab.html` calls
 * `main()` and this file is everything between a URL and a canvas.
 *
 * CONSTRUCTIVE-MODE arc, slice 3 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5). The counterpart of `seedlingDemo/watchViewer.js`, and it
 * is deliberately much smaller: every claim-making thing it touches lives
 * elsewhere — the loop in `procgenCore/`, the bindings in `procgenMaze.js`, the
 * headless page logic in `mazeLab.js`, the DRAW in `mazeRoomRender.js`.
 *
 * ⚠ TOOLING ONLY: it makes no claims and gates nothing.
 *
 * ── ⛔ THE LAWS IT IS BUILT AGAINST, EACH ONE PAID FOR ELSEWHERE ───────
 *
 * 1. **ONE READER, ONE WRITER.** `mazeLab.readLabParams` /
 *    `mazeLab.writeLabParams` are the only two functions in the page that know
 *    what a parameter is called. ⛔ Every control writes its value back through
 *    the writer AT PRESS TIME, so a copied address bar reproduces the run — the
 *    GENERATE-UI arc's slice-1 defect was a form that edited local variables
 *    and left the bar naming a level the page was not showing.
 * 2. **THE SOURCE SELECTOR DOES NOT RELOAD** (the SWITCH arc's law). The three
 *    arms share one state and one canvas; switching shows a different panel and
 *    starts a new LIFETIME.
 * 3. **EVERY `addEventListener` GOES THROUGH THE LIFETIME** (`procgenCore/
 *    pageLifetime.js`, trap 259). Not a style rule: a listener registered
 *    directly is invisible to the readout, so a leak would sit next to a report
 *    of a clean teardown.
 * 4. **THE PAGE NEVER WRITES `fixtures/`** or any repo path. Download and the
 *    save box are the only ways a level leaves.
 * 5. **RAW TRUTH.** A refusal is printed with the oracle's or the editor's own
 *    sentence, verbatim. A paraphrase would be a lossy copy of the only
 *    evidence channel a generator has.
 *
 * ── THE READOUTS ──────────────────────────────────────────────────────
 *
 * `window.__mazeLab` is what `scripts/procgen/check-maze-lab.mjs` asserts on;
 * `window.__mazeLabLifetime` is the teardown account. ⛔ Both are set on EVERY
 * render, not only under a parameter — a readout that existed only when asked
 * for would make the thing it reports untestable from the other side.
 */

import { createLifetimeHolder } from '../procgenCore/pageLifetime.js';
import { describeKeptKind, generationRows, ladderCost, tileAtPoint } from '../procgenCore/labView.js';
import { COLORS, TILE_PX, drawWorld, plainView } from './mazeRoomRender.js';
/**
 * ⛓⛓⛓ THE AREA OVERLAY IS A **SIBLING** DRAW, called after `drawWorld` exactly
 * as the plan and the hover overlays are — a graph is a fact about the MODEL,
 * not a property of the world, and the panel (the renderer's other caller) has
 * no model at all. It brings its own op-log fixture, so `drawWorld`'s seven
 * captured hashes stay byte-identical (⚖ arc-1 slice 3).
 */
import { AREA_LAYERS, areaLegend, drawAreaOverlay } from './mazeAreaOverlay.js';
import {
    DEFAULT_MAZE_BIOME, DIRECTED_ANCHOR_TRIES, MAZE_BIOME_NAMES, MazeRoomEditor, PALETTE_ENTRIES,
    SOURCES, agreementWithPayload, applyDirective, applyEdit, certify, describeState,
    generateStep, generateWithDirectives, labCatalogue, labPayload, loadPayload, planCells,
    readLabParams, serializeMazeLevel, skeletonCatalogue, solveState,
    stepFromParams, undoEdit, writeLabParams,
} from './mazeLab.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
// ⛓ SLICE 7: the ONE normalizer for a skeleton spec — this form, the identity
// line and the URL bar all spell a room the same way.
import { normalizeSkeleton } from '../procgenCore/skeletonKinds.js';
// ⛓ ELEMENTS ARC 1 SLICE 3: the ONE area codec — the form, the identity line,
// the URL bar and both CLIs spell a graph the same way.
import {
    AREA_PARAM_SCHEMA, KEYS_DOMAIN, formatRequireList, normalizeAreaSpec, parseRequireList,
} from '../procgenCore/areaSpec.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
};

/** ⚠ A generous ceiling for ONE maze solve. The whole BFS state space of the
 *  default room is 242 states, so a run of 49 solves measures in tens of ms —
 *  the number is stated so a caller raising the target can price it BEFORE
 *  pressing, which is the same discipline `costModel` applies to one run. */
const WORST_CASE_SOLVE_MS = 3;

export function main() {
    const lifetimes = createLifetimeHolder({
        publish: (snap) => { window.__mazeLabLifetime = snap; },
    });

    /* ── THE PAGE'S OWN STATE. `state` is the LEVEL; everything else here is
     *    about the page (which arm, which palette entry, what was hovered). ── */
    let params = null;
    let state = null;
    let lastSolve = null;
    let payloadCheck = null;
    let hover = null;
    let editor = null;
    let message = '';
    let messageBad = false;
    /**
     * ⛓⛓ THE AREA LAYER — a VIEW setting and nothing else. ⛔ It is NOT in the
     * URL (⚖ constructive ruling 9: the bar describes what was BUILT, and which
     * layer a reader is looking at is not part of that), and it never resets
     * the ladder: stepping the layers re-DRAWS, it does not re-generate.
     */
    let areaLayer = 'all';
    /**
     * ⛓⛓ SLICE 4 — THE OPTIONAL HOST BRIDGE. `null` STANDALONE, and that is
     * not a fallback: `mazeLabBridge.js` is never even FETCHED without
     * `?iframeId=` (see `installBridge`), so the page a person opens at
     * :8000 has the module graph slice 3 measured, unchanged.
     *
     * ⛔ EVERY USE IS `bridge?.`, so the hosted and standalone pages run the
     * SAME code down to one optional call — the layout-consistency payoff
     * ⚖ ruling 6 bought the iframe for is only real if the document is
     * genuinely the same document.
     */
    let bridge = null;

    const say = (text, bad = false) => { message = text; messageBad = bad; };

    /* ══════════════════════════════════════════════════════════════════
     * THE URL — written at every press, read only at boot
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛔ `history.replaceState` AND NOT AN ASSIGNMENT TO `location.search`. The
     * latter NAVIGATES, which is the reload the SWITCH arc removed; this
     * rewrites the bar in place and the page keeps its state.
     *
     * ⚠ IT REWRITES THE PARAMETERS IT OWNS AND COPIES THE REST, from the bar as
     * it stands — so a parameter this page does not know about survives a press
     * instead of being silently dropped.
     */
    const writeUrl = () => {
        if (!state) return;
        const search = writeLabParams(window.location.search, {
            source: params.source,
            seed: state.seed,
            biome: state.biome,
            width: state.width,
            height: state.height,
            bounds: state.bounds,
            budget: state.budget,
            step: state.step,
            roster: state.roster,
            // ⛔ SLICE 12: NO `directives` — ⚖ §3.9 took the list off the bar.
            skeleton: state.skeleton,
            areas: state.areas,
            require: state.require,
        });
        window.history.replaceState(null, '', `${window.location.pathname}?${search}`);
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE CANVAS
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛓⛓ ONE DRAW, THREE PASSES: the world through `mazeRoomRender.drawWorld`
     * — the SAME function `mazeRoomUI` calls, pixel-gated — then the PLAN and
     * then the hovered cell, both on top.
     *
     * ⛔ THE OVERLAYS ARE NOT INSIDE `drawWorld`. A plan is a fact about a
     * SOLVE and a hover is a fact about a MOUSE; neither is a property of the
     * world, and putting them in the renderer would mean the panel had to pass
     * `plan: null` forever to say it has no solver.
     */
    /**
     * ⛓⛓⛓ A REFUSED **DIRECTIVE** MEANS THERE IS NO LEVEL TO SHOW. The run did
     * not produce what was asked for, so the page draws nothing and prints the
     * reason where the level would be. ⛔ An area graph that refused is a
     * different case: the room the carve built IS the level this run produced
     * (it simply has no locks), so it is drawn, with the module's reason beside
     * it — ⚖ the honest 11x11-at-two-keys state, which the acceptance table
     * says is most seeds.
     */
    const requireRefusal = () => state?.requireResult?.refused ?? null;

    const draw = () => {
        const canvas = $('canvas');
        if (!state) return;
        const w = state.record;
        canvas.width = w.width * TILE_PX;
        canvas.height = w.height * TILE_PX;
        const ctx = canvas.getContext('2d');
        if (requireRefusal()) {
            canvas.hidden = true;
            return;
        }
        canvas.hidden = false;
        drawWorld(ctx, w, plainView({ tilePx: TILE_PX }));
        // ⛓ THE GRAPH, over the grid — the sibling draw, layer by layer.
        drawAreaOverlay(ctx, state.model?.areas ?? null, { tilePx: TILE_PX, layer: areaLayer });

        const cells = lastSolve ? planCells(state, lastSolve) : null;
        if (cells && cells.length > 1) {
            ctx.save();
            ctx.strokeStyle = COLORS.player;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            cells.forEach((c, i) => {
                const x = c.x * TILE_PX + TILE_PX / 2;
                const y = c.y * TILE_PX + TILE_PX / 2;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.restore();
        }
        if (hover) {
            ctx.save();
            ctx.strokeStyle = '#ffd75f';
            ctx.lineWidth = 2;
            ctx.strokeRect(hover.tx * TILE_PX + 1, hover.ty * TILE_PX + 1,
                TILE_PX - 2, TILE_PX - 2);
            ctx.restore();
        }
    };

    /**
     * ⛔ THE CELL A POINT NAMES IS `labView.tileAtPoint`'s ANSWER, derived from
     * the ROOM's dimensions and the ELEMENT's on-screen size — never from
     * `TILE_PX`, which is the canvas's INTRINSIC scale and says nothing about
     * how the browser is presenting it. ⚠ An out-of-range point REFUSES rather
     * than clamping, so this catches and reports instead of silently naming the
     * last cell.
     */
    const cellAt = (event) => {
        const canvas = $('canvas');
        const rect = canvas.getBoundingClientRect();
        try {
            return tileAtPoint({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
                cols: state.record.width,
                rows: state.record.height,
            });
        } catch {
            return null;
        }
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE PANES
     * ══════════════════════════════════════════════════════════════════ */

    const renderTrace = () => {
        const box = $('labTrace');
        box.textContent = '';
        const rows = generationRows(state?.trace ?? []);
        if (rows.length === 0) {
            box.appendChild(el('div', 'traceNone',
                'no attempts yet — the SKELETON is the open room and its goal, before any '
                + 'template is drawn.'));
            return;
        }
        for (const r of rows) {
            const row = el('div', `tr ${r.outcome === 'KEPT' ? 'kept' : ''}`);
            const head = el('div');
            head.appendChild(el('b', null, r.label));
            head.appendChild(document.createTextNode(' '));
            head.appendChild(el('span', null, r.instance));
            if (r.at) head.appendChild(el('span', null, ` ${r.at}`));
            head.appendChild(document.createTextNode(' '));
            head.appendChild(el('span', r.outcome === 'KEPT' ? 'g' : 'o', r.outcome));
            if (r.verdict) head.appendChild(el('span', 's', ` ${r.verdict}`));
            if (r.ticks !== null) head.appendChild(el('span', null, ` ${r.ticks} step(s)`));
            row.appendChild(head);
            // ⛔ VERBATIM, both of them, and as two lines because they are two
            // claims: HOW the oracle decided, and WHAT the solver said.
            if (r.classifiedBy) row.appendChild(el('div', 'rj', `classified by: ${r.classifiedBy}`));
            if (r.reasonText) row.appendChild(el('div', 'rj', r.reasonText));
            box.appendChild(row);
        }
    };

    /**
     * ⛓⛓⛓ THE CATALOGUE + RESTRICT. ⚖ Ruling 1: *"a list of things that can be
     * generated"* + *"choose the sub-roster a run may draw from"*.
     *
     * ⛔ THE EXCLUDED ROWS ARE IN IT (the v1 maze palette declares none, and the
     * branch is written anyway — a list that could not show what a palette
     * CANNOT generate would be the graceful-skip shape wearing a roster's
     * clothes, and slice 6's yield table is expected to produce exclusions).
     */
    const renderRoster = () => {
        const box = $('labRoster');
        box.textContent = '';
        const cat = labCatalogue(state.biome);
        const picked = new Set(state.roster?.axis === 'families' ? state.roster.names : []);
        for (const g of cat.groups) {
            const fam = el('div', 'catFamily');
            const head = el('div', 'catHead');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'famBox';
            cb.dataset.family = g.family;
            cb.checked = !state.roster || picked.has(g.family);
            lifetimes.current().on(cb, 'change', () => {
                const on = [...document.querySelectorAll('#labRoster .famBox')]
                    .filter((b) => b.checked).map((b) => b.dataset.family);
                /**
                 * ⛔ ALL-TICKED IS **NO RESTRICTION**, not a restriction naming
                 * everything. The two are different questions and
                 * `restrictPalette` names the palette differently for each, so a
                 * page that wrote one when a person meant the other would put a
                 * roster in the payload nobody asked for.
                 */
                const all = on.length === cat.groups.length;
                try {
                    state = Object.freeze({
                        ...state,
                        roster: all ? null : { axis: 'families', names: on },
                    });
                    say(all ? 'the WHOLE roster — no restriction'
                        : `restricted to families [${on.join(', ')}]`);
                } catch (e) {
                    say(e.message, true);
                }
                render();
            });
            head.appendChild(cb);
            head.appendChild(document.createTextNode(` ${g.family}`));
            fam.appendChild(head);
            for (const t of g.templates) {
                const row = el('div', 'catRow');
                row.appendChild(el('b', null, t.name));
                if (t.why) row.appendChild(el('div', 'rj', t.why));
                fam.appendChild(row);
                fam.appendChild(directedForm(t));
            }
            for (const x of g.excluded) {
                const row = el('div', 'catRow excluded');
                row.appendChild(el('b', null, x.name));
                if (x.cause) row.appendChild(el('div', 'rj', x.cause));
                fam.appendChild(row);
            }
            box.appendChild(fam);
        }
        $('labRosterNote').textContent = `${cat.counts.templates} template(s) in `
            + `${cat.counts.families} family(ies)${cat.counts.excluded
                ? `, ${cat.counts.excluded} excluded` : ''}`;
    };

    /**
     * ⛓⛓⛓ VERB 2 — the per-row parameter form and its ATTEMPT button. ⚖ Ruling
     * 1: *"a button to make the generator attempt to generate that specific
     * thing."*
     *
     * ⛔ THE COST IS PRINTED BESIDE THE BUTTON, before it is pressed. A solve is
     * synchronous and uninterruptible, so a budget bounds what is ACCEPTED and
     * never what is SPENT — the number a presser is agreeing to has to be
     * visible at press time.
     */
    const directedForm = (t) => {
        const form = el('div', 'catForm');
        const selects = new Map();
        for (const p of t.params ?? []) {
            const s = document.createElement('select');
            s.dataset.key = p.key;
            /**
             * ⛓ "any" IS A REAL OPTION AND IT IS THE DEFAULT: a directive may
             * leave a parameter to be DRAWN, and what it then RECORDS is the
             * drawn value (`mazeLab.applyDirective`'s two salted streams).
             */
            s.appendChild(new Option('any', ''));
            for (const v of p.domain) s.appendChild(new Option(`${p.key}=${v}`, String(v)));
            form.appendChild(el('span', null, ` ${p.key} `));
            form.appendChild(s);
            selects.set(p.key, { select: s, domain: p.domain });
        }
        const btn = el('button', null, 'ATTEMPT');
        btn.dataset.template = t.name;
        lifetimes.current().on(btn, 'click', () => {
            const values = {};
            for (const [key, { select, domain }] of selects) {
                if (select.value === '') continue;
                values[key] = domain.find((v) => String(v) === select.value);
            }
            try {
                state = applyDirective(state, {
                    template: t.name,
                    params: values,
                    anchor: null,
                    bound: DIRECTED_ANCHOR_TRIES,
                }, (state.directives ?? []).length);
                const d = state.directives[state.directives.length - 1];
                say(`${d.instance}: ${d.outcome}`
                    + (d.at ? ` at (${d.at.tx},${d.at.ty})` : '')
                    + (d.outcome === 'KEPT' ? ` — ${describeKeptKind(d)}` : ''),
                d.outcome !== 'KEPT');
                lastSolve = null;
                writeUrl();
            } catch (e) {
                say(e.message, true);
            }
            render();
        });
        form.appendChild(document.createTextNode(' '));
        form.appendChild(btn);
        form.appendChild(el('span', 'cost',
            ` ≤ ${DIRECTED_ANCHOR_TRIES + 1} solves`));
        return form;
    };

    const renderDirectives = () => {
        const box = $('labDirectives');
        box.textContent = '';
        for (const d of state.directives ?? []) {
            const row = el('div', 'dRow');
            row.appendChild(el('b', null, d.instance));
            row.appendChild(document.createTextNode(' '));
            row.appendChild(el('span', d.outcome === 'KEPT' ? 'g' : 'o', d.outcome));
            if (d.at) row.appendChild(el('span', null, ` at (${d.at.tx},${d.at.ty})`));
            row.appendChild(el('div', 'rj',
                d.outcome === 'KEPT'
                    ? describeKeptKind(d)
                    : `${d.anchorsWalked ?? 0} of ${d.anchorsOffered ?? 0} offered anchor(s) `
                        + 'were walked and none was accepted'));
            box.appendChild(row);
        }
        $('labDirectivesNote').textContent = (state.directives ?? []).length
            ? `${state.directives.length} directive(s), in order`
            : 'none — press ATTEMPT on a catalogue row';
    };

    const renderEditPanel = () => {
        const box = $('labPalette');
        box.textContent = '';
        for (const e of PALETTE_ENTRIES) {
            const b = el('button', 'paletteBtn', `${e.glyph} ${e.label}`);
            b.dataset.type = e.type;
            if (editor?.selectedType === e.type) b.classList.add('armed');
            lifetimes.current().on(b, 'click', () => {
                editor.selectType(e.type);
                say(`palette: ${e.label} — click a tile`);
                render();
            });
            box.appendChild(b);
        }
        $('editNote').textContent = (state.edits ?? []).length
            ? `${state.edits.length} manual edit(s): `
                + state.edits.map((e) => `#${e.n} ${e.description}`).join(' · ')
            : 'no manual edits yet.';
    };

    const renderSolvePanel = () => {
        const note = $('solveNote');
        note.textContent = '';
        if (!lastSolve) {
            note.appendChild(el('div', 'rj',
                'press SOLVE — the ORACLE runs on the world now on screen (the same '
                + '`mazeOracle` the loop uses, certified by REPLAY through the engine\'s own '
                + '`step`).'));
            return;
        }
        note.appendChild(el('div', lastSolve.verdict === 'SOLVED' ? 'g' : 'o',
            `${lastSolve.verdict}${lastSolve.ticks ? ` in ${lastSolve.ticks} step(s)` : ''}`));
        // ⛔ VERBATIM — the oracle's own sentence, never a paraphrase.
        note.appendChild(el('div', 'rj', `classified by: ${lastSolve.classifiedBy}`));
        if (lastSolve.reasonText) note.appendChild(el('div', 'rj', lastSolve.reasonText));
    };

    /* ══════════════════════════════════════════════════════════════════
     * THE FORM
     * ══════════════════════════════════════════════════════════════════ */

    const FIELDS = [
        ['labSeed', (s) => s.seed],
        ['labWidth', (s) => s.width],
        ['labHeight', (s) => s.height],
        ['labCount', (s) => s.bounds.obstacleTarget],
        ['labTries', (s) => s.bounds.triesPerStep],
        ['labK', (s) => s.bounds.saturationK],
        ['labAnchorTries', (s) => s.bounds.anchorTriesPerCandidate],
        ['labExpansions', (s) => s.budget.maxExpansions],
    ];

    /**
     * ── ⛓⛓⛓ SLICE 7 — THE KIND'S PARAMETERS, AS A FORM ─────────────────
     *
     * ⛔ MOUNTED FROM THE CATALOGUE'S OWN SCHEMA (the options ARE the declared
     * domain, the pre-selection IS the declared default), and RE-MOUNTED AT
     * DEFAULTS on every kind change rather than merged — `minRoom` is `rooms`'
     * knob and carrying it onto `winding` would be a control writing state
     * nobody reads. ⚠ No "any (draw it)" option: a template parameter may be
     * drawn, a room parameter is chosen.
     */
    const mountSkeletonParams = (kind, values = {}) => {
        const box = $('labSkeletonParams');
        box.innerHTML = '';
        const row = skeletonCatalogue({ simulator: true }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.skelParam = p.key;
            for (const v of p.domain) {
                const o = new Option(String(v), String(v));
                if (v === (values[p.key] ?? p.default)) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            box.appendChild(label);
        }
    };
    /** ⛔ TYPED FROM THE DOMAIN — a `<select>` hands back a string and the
     *  state, the payload and the URL all carry the domain's own number. */
    const readSkeletonParams = (kind) => {
        const out = {};
        const row = skeletonCatalogue({ simulator: true }).find((r) => r.kind === kind);
        for (const p of row?.params ?? []) {
            const sel = $('labSkeletonParams')
                .querySelector(`select[data-skel-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };

    /**
     * ⛓⛓ THE AREA PANE — the module's own sentence, and a LEGEND with one row
     * per SYMBOL. ⚠ §9.11(6): door counts are not small, so the canvas carries
     * colour only and the symbols are named exactly once, here.
     */
    const renderAreaPane = () => {
        const note = $('labAreaNote');
        const legendBox = $('labAreaLegend');
        legendBox.innerHTML = '';
        note.textContent = '';
        note.className = '';
        const info = state.model?.areas ?? null;
        const req = state.requireResult ?? null;
        // ⛔ VERBATIM — the binding's / the directive's own reason.
        if (req?.refused) {
            note.className = 'refused';
            note.textContent = `⛔ requires ${formatRequireList(req.asked)} — REFUSED: `
                + `${req.refused.reason}. ${req.refused.detail} ⛓ No level is shown, because `
                + 'this run did not produce the one that was asked for.';
            return;
        }
        if (info && info.spec.keys > 0 && !info.ran) {
            note.className = 'refused';
            note.textContent = `⛔ the area graph REFUSED: ${info.refused.reason}. `
                + `${info.refused.detail}`;
            return;
        }
        if (!info?.ran) return;
        note.className = 'ran';
        note.textContent = `areas: ${info.partitionSummary.areaCount} `
            + `(${info.partitionSummary.syntheticCount} synthetic — the 1-cell areas grown on `
            + `the entrance and the goal), ${info.partitionSummary.adjacencyCount} adjacency `
            + `pair(s), ${info.graph.edges.filter((e) => e.kind === 'graphify').length} graphify `
            + `edge(s) (dashed); layer: ${areaLayer}`
            + (req ? ` · requires ${formatRequireList(req.asked)} MET, every symbol STRONG `
                + '(remove the key, keep the doors → the goal is unreachable)' : '');
        for (const row of areaLegend(info)) {
            const box = el('div', 'lg');
            const sw = el('span', 'sw');
            sw.style.background = row.color;
            box.appendChild(sw);
            box.appendChild(el('b', null, row.symbol));
            box.appendChild(el('span', null,
                `${row.doorCount} door(s) on ${row.areas.length} area(s) at key level `
                + `${row.level}; key in ${row.key ? `${row.key.area} (${row.key.x},${row.key.y})`
                    : '(nowhere)'}`));
            legendBox.appendChild(box);
        }
    };

    /**
     * ⛓ THE AREA SPEC'S PARAMETERS, AS A FORM — mounted from the codec's own
     * schema (the options ARE the declared domain, the pre-selection IS the
     * declared default), exactly as the skeleton's params form is.
     */
    const mountAreaParams = (values = {}) => {
        const box = $('labAreaParams');
        box.innerHTML = '';
        for (const p of AREA_PARAM_SCHEMA) {
            const label = document.createElement('label');
            label.textContent = `${p.key} `;
            label.title = p.why;
            const sel = document.createElement('select');
            sel.dataset.areaParam = p.key;
            for (const v of p.domain) {
                const o = new Option(String(v), String(v));
                if (v === (values[p.key] ?? p.default)) o.selected = true;
                sel.appendChild(o);
            }
            label.appendChild(sel);
            box.appendChild(label);
        }
    };
    /** ⛔ TYPED FROM THE DOMAIN — a `<select>` hands back a string. */
    const readAreaParams = () => {
        const out = {};
        for (const p of AREA_PARAM_SCHEMA) {
            const sel = $('labAreaParams').querySelector(`select[data-area-param="${p.key}"]`);
            if (!sel) continue;
            const v = p.domain.find((d) => String(d) === sel.value);
            if (v !== undefined) out[p.key] = v;
        }
        return out;
    };
    /**
     * ⛔ THE DIRECTIVE IS PARSED THROUGH THE ONE CODEC, at the press — an empty
     * box is NO directive (which is what absence means in the URL too), and a
     * misspelled symbol REFUSES by name rather than being dropped.
     */
    const readRequireBox = () => {
        const raw = $('labRequire').value.trim();
        return raw === '' ? null : parseRequireList(raw);
    };

    const fillForm = () => {
        for (const [id, get] of FIELDS) $(id).value = String(get(state));
        $('labBiome').value = state.biome;
        $('labSkeleton').value = state.skeleton?.kind ?? 'empty';
        mountSkeletonParams(state.skeleton?.kind ?? 'empty', state.skeleton?.params ?? {});
        $('labAreas').value = String(state.areas?.keys ?? 0);
        mountAreaParams(state.areas?.params ?? {});
        $('labRequire').value = formatRequireList(state.require);
        $('labAreaLayer').value = areaLayer;
    };

    /** The form's numbers, as the next run's arguments. ⛔ The FORM is read at
     *  press time and never cached — a control that edited a local variable is
     *  the defect law 1 exists to end. */
    const formArgs = () => ({
        seed: Number($('labSeed').value),
        biome: $('labBiome').value,
        width: Number($('labWidth').value),
        height: Number($('labHeight').value),
        bounds: {
            obstacleTarget: Number($('labCount').value),
            triesPerStep: Number($('labTries').value),
            saturationK: Number($('labK').value),
            anchorTriesPerCandidate: Number($('labAnchorTries').value),
        },
        budget: { maxExpansions: Number($('labExpansions').value) },
        roster: state.roster,
        /**
         * ⛓ SLICE 5 — READ AT THE PRESS like every other control (law 1). ⛔
         * The SELECT is read, not a variable: a handler that cached the kind
         * early would leave the form comparing a value to itself, which is the
         * defect the read-at-press law exists to end.
         */
        skeleton: normalizeSkeleton({
            kind: $('labSkeleton').value,
            /** ⛓ SLICE 7 — the parameters, read at the press on the same terms. */
            params: readSkeletonParams($('labSkeleton').value),
        }),
        /** ⛓ ELEMENTS SLICE 3 — the graph and the directive, read at the press. */
        areas: normalizeAreaSpec({
            keys: Number($('labAreas').value), params: readAreaParams(),
        }),
        require: readRequireBox(),
    });

    const goTo = (step) => {
        const a = formArgs();
        try {
            state = generateStep({ ...a, step });
            lastSolve = null;
            payloadCheck = null;
            say(`step ${step}: ${state.summary
                ? `kept ${state.summary.keptCount}/${step}` : 'the skeleton'}`);
        } catch (e) {
            say(e.message, true);
        }
        writeUrl();
        render();
    };

    /**
     * ⛓ RUN-ALL climbs the ladder one rung at a time so the display updates
     * after EVERY placement — and stops at SATURATION, which is the loop's own
     * answer and not a count this page keeps.
     */
    const runAll = () => {
        const a = formArgs();
        const target = a.bounds.obstacleTarget;
        say(`RUN-ALL to ${target}: ≤ ${ladderCost(a.bounds, WORST_CASE_SOLVE_MS).solves} solves`);
        try {
            for (let k = 1; k <= target; k += 1) {
                state = generateStep({ ...a, step: k });
                if (state.saturated) {
                    say(`SATURATED at step ${k} — ${a.bounds.saturationK} consecutive steps `
                        + 'kept nothing', true);
                    break;
                }
            }
            lastSolve = null;
            payloadCheck = null;
        } catch (e) {
            say(e.message, true);
        }
        writeUrl();
        render();
    };

    /* ══════════════════════════════════════════════════════════════════
     * SAVE / LOAD — ⛔ THE PAGE NEVER WRITES fixtures/
     * ══════════════════════════════════════════════════════════════════ */

    const refreshSaveBox = () => {
        $('labText').value = JSON.stringify(labPayload(state), null, 2);
    };

    const download = () => {
        const blob = new Blob([`${JSON.stringify(labPayload(state), null, 2)}\n`],
            { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `maze-seed${state.seed}-step${state.step}`
            + `${(state.edits ?? []).length ? `-e${state.edits.length}` : ''}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        say(`downloaded ${a.download}`);
    };

    const loadFromBox = () => {
        try {
            const payload = JSON.parse($('labText').value);
            state = loadPayload(payload);
            editor = null;
            lastSolve = null;
            payloadCheck = null;
            say(`loaded a ${state.width}x${state.height} level with `
                + `${(state.edits ?? []).length} recorded edit(s) — UNCERTIFIED until SOLVE`);
        } catch (e) {
            say(e.message, true);
        }
        render();
    };

    /* ══════════════════════════════════════════════════════════════════
     * RENDER
     * ══════════════════════════════════════════════════════════════════ */

    const render = () => {
        const src = params.source;
        $('generatePanel').hidden = src !== SOURCES.GENERATE;
        $('editPanel').hidden = src !== SOURCES.EDIT;
        $('solvePanel').hidden = src !== SOURCES.SOLVE;
        $('source').value = src;
        fillForm();
        draw();
        renderTrace();
        renderAreaPane();
        if (src === SOURCES.GENERATE) {
            renderRoster();
            renderDirectives();
            /**
             * ⚠ THE BOUNDS ARE READ STRAIGHT OFF THE FIELDS HERE, not through
             * `formArgs()`: that one now also parses the `requires` box, and a
             * REFUSAL while somebody is still typing must not take the whole
             * render down with it. The press is where a malformed directive is
             * reported (and it is, by name).
             */
            const target = {
                obstacleTarget: Number($('labCount').value),
                triesPerStep: Number($('labTries').value),
                saturationK: Number($('labK').value),
                anchorTriesPerCandidate: Number($('labAnchorTries').value),
            };
            $('labNote').textContent = 'RUN-ALL to '
                + `${Number($('labCount').value)} authorises ≤ `
                + `${ladderCost(target, WORST_CASE_SOLVE_MS).solves} solves `
                + '(⚠ a CEILING — the loop keeps its first candidate most of the time).';
        }
        if (src === SOURCES.EDIT) {
            if (!editor) {
                editor = new MazeRoomEditor({
                    itemLib: state.record.itemLib ?? DEFAULT_ITEMS,
                    obstacleLib: state.record.obstacleLib ?? DEFAULT_OBSTACLES,
                });
            }
            renderEditPanel();
        }
        if (src === SOURCES.SOLVE) renderSolvePanel();
        refreshSaveBox();

        $('identity').textContent = describeState(state, lastSolve);
        $('status').textContent = message || '—';
        $('status').className = messageBad ? 'bad' : 'ok';
        $('detail').textContent = payloadCheck
            ? (payloadCheck.why ?? '?gen= — the page REPRODUCED the payload byte-identically')
            : '';

        window.__mazeLab = {
            source: src,
            url: window.location.search,
            seed: state.seed,
            biome: state.biome,
            width: state.width,
            height: state.height,
            step: state.step,
            bounds: state.bounds,
            budget: state.budget,
            roster: state.roster ?? null,
            stop: state.stop,
            saturated: state.saturated,
            /**
             * ⛓⛓ SLICE 4: DID THIS STATE COME OUT OF THE LOOP, OR OUT OF A
             * PAYLOAD? `loadPayload` sets it and nothing else does.
             *
             * ⛔ Added because a MUTANT found the hole: `check-procgen-lab-
             * hosting.mjs` waited for "step 0, uncertified, zero edits" to
             * decide the host's SEND had landed — and the page's OWN BOOT state
             * satisfies all three (no `?run=`, nothing solved yet). With the
             * resend removed the row still went red, but on the byte
             * comparison rather than on the wait, which is trap 246's shape:
             * a wait a PRE-state can satisfy is not a wait for the claim. This
             * field is the one fact that separates the two.
             */
            loaded: Boolean(state.loaded),
            identity: $('identity').textContent,
            /**
             * ⛓⛓⛓ SLICE 12 — THE TRI-STATE, PUBLISHED AS IT STANDS. ⚠ It was
             * `Boolean(state.certification)`, which reported `false` after an
             * EDIT where Seedling reported `null` — both protocol-legal
             * (`labProtocol.assertStateChanged` documents the distinction) and
             * slice 11 §16.2 named this page as the side to move. `null` =
             * nobody has asked; `false` = the ORACLE said no, which on this
             * page happens in exactly one place (`certify` on a REFUSED
             * verdict).
             */
            certified: state.certified ?? null,
            edits: (state.edits ?? []).length,
            editLog: (state.edits ?? []).map((e) => e.description),
            directives: (state.directives ?? []).map((d) => ({
                instance: d.instance, outcome: d.outcome, keptKind: d.keptKind, at: d.at,
            })),
            rows: generationRows(state.trace ?? []),
            catalogue: labCatalogue(state.biome),
            /** ⛓ SLICE 5 — the SKELETONS section, beside the template catalogue. */
            skeletons: skeletonCatalogue({ simulator: true }),
            skeleton: state.skeleton ?? null,
            /**
             * ⛓⛓⛓ SLICE 3 — THE GRAPH THE PAGE IS SHOWING, and ⛔ **NO LEVEL
             * AND NO PAYLOAD WHEN THE DIRECTIVE WAS REFUSED**: a run that did
             * not produce what was asked for has no artifact to hand out, and a
             * readout that offered one anyway would be the page disagreeing
             * with its own refusal box.
             */
            areas: state.areas ?? null,
            require: state.require ?? null,
            requireResult: state.requireResult ?? null,
            areaGraph: state.model?.areas?.ran
                ? {
                    ran: true,
                    areaCount: state.model.areas.partitionSummary.areaCount,
                    syntheticCount: state.model.areas.partitionSummary.syntheticCount,
                    symbols: state.model.areas.graph.symbols,
                    doors: state.model.areas.doors.length,
                    keys: state.model.areas.keys.length,
                    graphifyEdges: state.model.areas.graph.edges
                        .filter((e) => e.kind === 'graphify').length,
                    solutionPath: state.model.areas.graph.solutionPath,
                }
                : { ran: false, refused: state.model?.areas?.refused ?? null },
            areaLegend: areaLegend(state.model?.areas ?? null),
            areaLayer,
            areaNote: $('labAreaNote').textContent,
            level: requireRefusal() ? null : serializeMazeLevel(state.record),
            trace: state.trace ?? [],
            payload: requireRefusal() ? null : labPayload(state),
            payloadCheck,
            solve: lastSolve && {
                verdict: lastSolve.verdict,
                ticks: lastSolve.ticks,
                classifiedBy: lastSolve.classifiedBy,
                reasonText: lastSolve.reasonText,
            },
            message,
            busy: false,
        };
        lifetimes.announce();
        // ⛓ SLICE 4: the host hears what the readout says, at the same moment
        // and from the same object — a second derivation for the host would be
        // a second answer to "what is this page showing".
        bridge?.announce();
    };

    /* ══════════════════════════════════════════════════════════════════
     * MOUNT ONE ARM
     * ══════════════════════════════════════════════════════════════════ */

    /**
     * ⛔ RETIRE-THEN-CREATE, and the ordering is the whole point: the other
     * order leaves a window in which two arms are both alive and both believe
     * they own the canvas. `createLifetimeHolder.start` enforces it.
     */
    const mount = (source, why) => {
        params = { ...params, source };
        const lt = lifetimes.start(source, why);

        lt.on($('source'), 'change', () => {
            mount($('source').value, `the SOURCE selector chose ${$('source').value}`);
            writeUrl();
        });
        for (const [id] of FIELDS) {
            lt.on($(id), 'change', () => { writeUrl(); });
        }
        lt.on($('labBiome'), 'change', () => { writeUrl(); });
        /**
         * ⛓⛓ SLICE 5 — A KIND CHANGE **RESETS THE LADDER TO THE SKELETON**,
         * and says so. The room is the level's identity every bit as much as
         * the seed: step 3 of a `winding` room followed by step 4 of an `open`
         * one is a display that has never shown a level any single run
         * produces. ⛓ It is the same reset a changed seed causes on the
         * Seedling page, applied to the other half of the identity — and it is
         * spelled as a press (`goTo(0)`) rather than as a flag, so the URL, the
         * form and the level all move together through the one path.
         */
        lt.on($('labSkeleton'), 'change', () => {
            /**
             * ⛓ SLICE 7 — THE PARAMS FORM IS RE-MOUNTED AT DEFAULTS **BEFORE**
             * the press, because `goTo(0)` reads it: a kind change that left
             * `rooms`' `minRoom` select standing would hand `winding` a
             * parameter it does not declare, and the press would refuse.
             */
            mountSkeletonParams($('labSkeleton').value);
            goTo(0);
            say(`skeleton kind: ${$('labSkeleton').value} — RESET to the skeleton, because the `
                + 'room a ladder is built in is part of the level\'s identity');
            render();
        });
        /**
         * ⛓⛓ SLICE 7 — AND A PARAMETER CHANGE RESETS ON EXACTLY THE SAME
         * TERMS. `rooms;minRoom=2` and `rooms;minRoom=4` are two different
         * rooms, so a ladder cannot span them. ⛔ Delegated from the CONTAINER
         * rather than bound per select, because the selects are re-created on
         * every kind change and a per-element listener would be re-bound (or
         * leaked) each time.
         */
        lt.on($('labSkeletonParams'), 'change', (e) => {
            if (!e.target?.dataset?.skelParam) return;
            goTo(0);
            say(`skeleton parameter ${e.target.dataset.skelParam}=${e.target.value} — RESET to `
                + 'the skeleton: a kind parameter builds a DIFFERENT room, exactly as the '
                + 'kind does');
            render();
        });
        /**
         * ⛓⛓⛓ AN AREA-SPEC OR DIRECTIVE CHANGE **RESETS THE LADDER**, on
         * exactly the terms a kind change does: the area graph is built with
         * the MODEL, before pass 2 runs, so `keys=1` at step 3 followed by
         * `keys=2` at step 4 would be a display no single run produces. ⛔ And
         * the directive is a property of the RUN, not of a rung.
         */
        lt.on($('labAreas'), 'change', () => {
            // ⛓ the params form is re-mounted BEFORE the press, because the
            // press reads it (the skeleton form's own lesson).
            mountAreaParams();
            goTo(0);
            say(`areas: ${$('labAreas').value} key(s) — RESET to the skeleton, because the `
                + 'area graph is built with the model, before the loop runs');
            render();
        });
        lt.on($('labAreaParams'), 'change', (e) => {
            if (!e.target?.dataset?.areaParam) return;
            goTo(0);
            say(`area parameter ${e.target.dataset.areaParam}=${e.target.value} — RESET to the `
                + 'skeleton: a graph knob builds a DIFFERENT level');
            render();
        });
        lt.on($('labRequire'), 'change', () => {
            goTo(0);
            const asked = $('labRequire').value.trim();
            say(asked === ''
                ? 'no directive — the run is not required to place any symbol'
                : `requires ${asked} — RESET to the skeleton; the directive is MET or the run `
                    + 'is REFUSED (⛔ no bound is widened to meet it, and there is no retry)');
            render();
        });
        /**
         * ⛓ THE LAYER STEPPER — a VIEW control. ⛔ It re-DRAWS and does not
         * regenerate, is not written to the URL, and does not touch the ladder:
         * *"step through the layers"* is a reader building up one picture.
         */
        lt.on($('labAreaLayer'), 'change', () => {
            areaLayer = $('labAreaLayer').value;
            render();
        });
        lt.on($('labAreaLayerNext'), 'click', () => {
            areaLayer = AREA_LAYERS[(AREA_LAYERS.indexOf(areaLayer) + 1) % AREA_LAYERS.length];
            say(`layer: ${areaLayer}`);
            render();
        });
        lt.on($('labStep'), 'click', () => goTo(state.step + 1));
        lt.on($('labRunAll'), 'click', runAll);
        lt.on($('labReset'), 'click', () => goTo(0));
        lt.on($('labRosterAll'), 'click', () => {
            state = Object.freeze({ ...state, roster: null });
            say('the WHOLE roster — no restriction');
            writeUrl();
            render();
        });
        lt.on($('labDirectivesClear'), 'click', () => {
            state = Object.freeze({ ...state, directives: Object.freeze([]) });
            say('directives cleared — press STEP or RUN-ALL to rebuild the level without them');
            writeUrl();
            render();
        });
        lt.on($('labSolve'), 'click', () => {
            try {
                lastSolve = solveState(state);
                state = certify(state);
                say(`SOLVE: ${lastSolve.verdict}`, lastSolve.verdict !== 'SOLVED');
            } catch (e) {
                say(e.message, true);
            }
            render();
        });
        lt.on($('labUndo'), 'click', () => {
            state = undoEdit(state);
            lastSolve = null;
            say('undid one edit — still UNCERTIFIED (nothing has solved the world on screen)');
            render();
        });
        lt.on($('labDownload'), 'click', download);
        lt.on($('labLoad'), 'click', loadFromBox);
        lt.on($('labUpload'), 'change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => lt.report('an upload finished after the arm was retired', () => {
                $('labText').value = String(r.result);
                loadFromBox();
            });
            r.readAsText(file);
        });

        const canvas = $('canvas');
        canvas.classList.toggle('editing', source === SOURCES.EDIT);
        lt.on(canvas, 'mousemove', (e) => {
            const c = cellAt(e);
            if (c?.tx === hover?.tx && c?.ty === hover?.ty) return;
            hover = c;
            draw();
        });
        lt.on(canvas, 'mouseleave', () => { hover = null; draw(); });
        lt.on(canvas, 'click', (e) => {
            /**
             * ⛓⛓ SLICE 4 — `procgenLab:selectTile` FIRES IN EVERY ARM, and
             * BEFORE the EDIT guard. It is not an edit; it is *"the reader
             * pointed at this cell"*, which is the only thing a host can do
             * anything with (⚖ §3.5's third page→host event). Publishing it
             * only in EDIT would make the event mean "an edit happened" under
             * a name that says otherwise, and the host would have no way to
             * learn that a click in SOLVE was a click at all.
             */
            const clicked = cellAt(e);
            if (clicked) bridge?.selectTile(clicked.tx, clicked.ty);
            if (source !== SOURCES.EDIT) return;
            const c = clicked;
            if (!c) {
                say('that point is outside the room — the cell you name is the cell that gets '
                    + 'edited, so a click past the edge REFUSES rather than clamping to the '
                    + 'last one', true);
                render();
                return;
            }
            const out = applyEdit(state, editor, c.tx, c.ty);
            state = out.state;
            // ⛔ VERBATIM — the editor's own refusal sentence.
            say(out.result.description, !out.result.ok);
            if (out.result.ok && out.result.type !== 'noop') lastSolve = null;
            render();
        });

        render();
    };

    /* ══════════════════════════════════════════════════════════════════
     * BOOT
     * ══════════════════════════════════════════════════════════════════ */

    for (const name of MAZE_BIOME_NAMES) {
        $('labBiome').appendChild(new Option(name, name));
    }
    /**
     * ⛓⛓ THE SKELETON SELECTOR — the kinds this page OFFERS, plus the ones it
     * does not, greyed WITH THEIR REASON as the catalogue's exclusion rows are.
     * ⚠ The maze offers every kind, so nothing is greyed HERE today; the
     * disabled branch is written and driven anyway, because it is the branch
     * the Seedling page's copy of this list needs and a list that silently
     * dropped what it cannot offer could not answer *"why not that one?"*.
     */
    for (const row of skeletonCatalogue({ simulator: true })) {
        const opt = new Option(`${row.kind}${row.isDefault ? ' (the open room)' : ''}`, row.kind);
        opt.disabled = !row.offered;
        opt.title = row.offered ? row.description : `unavailable here — needs ${row.why}`;
        $('labSkeleton').appendChild(opt);
    }
    /**
     * ⛓ THE AREA CONTROLS' OPTIONS ARE THE CODEC'S OWN DOMAINS — `KEYS_DOMAIN`
     * and `AREA_LAYERS`. ⛔ A hand-typed list here would be a second
     * vocabulary, and the reader would meet whichever one drifted.
     */
    for (const k of KEYS_DOMAIN) {
        $('labAreas').appendChild(new Option(`${k}${k === 0 ? ' (off)' : ''}`, String(k)));
    }
    for (const l of AREA_LAYERS) $('labAreaLayer').appendChild(new Option(l, l));
    mountAreaParams();
    stamp();

    try {
        params = readLabParams(window.location.search);
    } catch (e) {
        $('status').textContent = e.message;
        $('status').className = 'bad';
        window.__mazeLab = { fatal: e.message };
        return;
    }

    const boot = async () => {
        if (params.gen) {
            /**
             * ⛓⛓⛓ `?gen=` REPRODUCES A PAYLOAD AND CHECKS IT, which is a
             * stronger contract than loading one: the page GENERATES from the
             * payload's own seed/bounds/room and compares. ⛔ One path into the
             * page — every level it draws came out of the loop, in the page —
             * and the export becomes a determinism check across node and the
             * browser rather than a picture of a file.
             */
            const res = await fetch(params.gen);
            if (!res.ok) throw new Error(`?gen=${params.gen} — HTTP ${res.status}`);
            const payload = await res.json();
            state = generateWithDirectives({
                seed: payload.seed,
                biome: payload.biome ?? DEFAULT_MAZE_BIOME,
                step: payload.bounds?.obstacleTarget ?? 0,
                bounds: payload.bounds,
                budget: payload.budget,
                width: payload.width,
                height: payload.height,
                roster: payload.roster ?? null,
                /**
                 * ⛓⛓⛓ SLICE 12 — **THE PAYLOAD IS THE DIRECTIVE CHANNEL.** It
                 * was `null` here while `?directed=` carried the list; ⚖ §3.9
                 * retired the parameter, so a payload's own `directives` are
                 * replayed, IN ORDER AND AT THE SAME INDICES (the array's order
                 * IS the index, so `directiveSeed`'s index-as-salt is
                 * untouched), through the SAME `applyDirective` the ATTEMPT
                 * button presses. ⚠ A RECORDED directive's `params` are the
                 * RESOLVED values, so the replay spends no draw and the
                 * comparison below can be byte-exact.
                 */
                directed: payload.directives ?? null,
                /**
                 * ⛓ SLICE 5: a payload names the ROOM it was built in, and
                 * reproducing it under a different skeleton would report a
                 * level divergence whose real cause is the question. ⚠ `??` and
                 * not a constant: a payload written before the block existed
                 * names no kind, and that IS the open room.
                 */
                skeleton: payload.skeleton ?? undefined,
                /** ⛓ SLICE 3 — a payload names the GRAPH it was built with. */
                areas: payload.areas ?? undefined,
                require: payload.require ?? null,
            });
            payloadCheck = agreementWithPayload(payload, state);
            say(payloadCheck.agrees
                ? 'the browser REPRODUCED the payload byte-identically — level AND trace'
                : `the payload and this page's generation DIFFER: ${payloadCheck.why}`,
            !payloadCheck.agrees);
            return;
        }
        state = generateWithDirectives({
            seed: params.seed,
            biome: params.biome,
            step: stepFromParams(params),
            bounds: params.bounds,
            budget: params.budget,
            width: params.width,
            height: params.height,
            roster: params.roster,
            /**
             * ⛔ SLICE 12 — NO `directed` HERE EITHER: a URL boot is a LADDER,
             * always. A directive reaches this page from the ATTEMPT button or
             * from a payload, and `?directed=` refuses in `readLabParams`.
             */
            /**
             * ⛓⛓ SLICE 5 — AND A DEFECT MY OWN ROW FOUND HERE. `?skeleton=`
             * reached `readLabParams`, the writer echoed it back into the bar
             * and the readout printed it, so three of the five browser claims
             * were green — while THIS call was still missing the argument and
             * the page generated the open room. The one claim that could see it
             * was the byte comparison against node's carved level.
             */
            skeleton: params.skeleton,
            /**
             * ⛓⛓ SLICE 3 — AND THE AREA SPEC AND THE DIRECTIVE REACH THE
             * GENERATOR HERE. ⛔ This is the exact line slice 5's defect was on
             * (`?skeleton=` reached the reader, the bar and the identity line
             * while THIS call was missing the argument, and three of five
             * claims were green on a page generating the open room), so the
             * browser row's `?areas=` claim is a BYTE COMPARISON against node's
             * own level rather than an echo of the parameter.
             */
            areas: params.areas,
            require: params.require,
        });
        say(`seed ${params.seed} at step ${stepFromParams(params)}`
            + (params.skeleton?.kind && params.skeleton.kind !== 'empty'
                ? `, skeleton ${params.skeleton.kind}` : ''));
    };

    /* ══════════════════════════════════════════════════════════════════
     * SLICE 4 — WHAT A HOST MAY DO TO THIS PAGE
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ TWO VERBS, AND EACH GOES THROUGH THE PAGE'S EXISTING ONE-OF. There is
     * no host-only path into this page: `load` is the LOAD box's own function
     * (so the box shows what was loaded, which is what a reader looking at the
     * panel would expect to find), and `navigate` is `readLabParams` + `boot`
     * + `mount` — the SWITCH arc's law, in place, with no reload.
     */

    /** HOST → PAGE `procgenLab:load`. ⛔ The LOAD box's own function, verbatim. */
    const loadFromHost = (payload) => {
        $('labText').value = JSON.stringify(payload, null, 2);
        loadFromBox();
    };

    /**
     * HOST → PAGE `procgenLab:navigate`. ⛔ `history.replaceState` and NOT an
     * assignment to `location.search`: the latter NAVIGATES, and a hosted page
     * that reloaded itself would drop the iframe's adapter connection with it
     * — the standalone page's law (law 2) with a second reason behind it.
     *
     * ⚠ `?iframeId=`/`?hostOrigin=` are PRESERVED, because they are this
     * frame's address and the host did not send them. A navigate that dropped
     * them would leave a page that still runs but can no longer be reached.
     */
    const navigate = async (search) => {
        const asked = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
        const here = new URLSearchParams(window.location.search);
        for (const key of ['iframeId', 'hostOrigin']) {
            if (here.has(key) && !asked.has(key)) asked.set(key, here.get(key));
        }
        window.history.replaceState(null, '', `${window.location.pathname}?${asked}`);
        try {
            params = readLabParams(window.location.search);
            await boot();
        } catch (e) {
            // ⛔ RAW TRUTH, on the page: a refused navigate says so where every
            // other refusal on this page says it, and does NOT fall through to
            // a level nobody asked for.
            say(e.message, true);
            render();
            return;
        }
        mount(params.source, 'the HOST navigated');
    };

    /**
     * ⛓⛓⛓ THE BRIDGE IS FETCHED ONLY UNDER `?iframeId=`.
     *
     * ⛔ Not "loaded and inert" — NOT FETCHED. A static import would put
     * `AdapterClient` (and `shared/communicationProtocol.js` with it) into the
     * standalone page's module graph, where it would install a `message`
     * listener on a page that has no host — and slice 3's §10.10(6) promised
     * the opposite in writing. `check-maze-lab.mjs` asserts the graph.
     */
    const installBridge = async () => {
        const iframeId = new URLSearchParams(window.location.search).get('iframeId');
        if (!iframeId) return;
        const mod = await import('./mazeLabBridge.js');
        bridge = await mod.installMazeLabBridge({
            iframeId,
            readout: () => window.__mazeLab,
            load: loadFromHost,
            navigate,
        });
    };

    boot().then(() => {
        mount(params.source, 'the URL');
        // ⚠ AFTER the first mount, so the `ready` the bridge publishes carries
        // a page that has already drawn — §3.5 says `ready` is *"after connect
        // + first render"*, and a host that mirrored a pre-render state would
        // print an identity line for a level nobody could see.
        return installBridge();
    }).catch((e) => {
        // ⛔ RAW TRUTH: a boot that failed says so with its own message and the
        // page does NOT fall back to a level nobody asked for.
        $('status').textContent = e.message;
        $('status').className = 'bad';
        window.__mazeLab = { fatal: e.message };
    });
}

/**
 * ⛓ IS THIS PAGE RUNNING THE CODE THAT IS ON DISK? The dev server is a plain
 * `python -m http.server`, which sends `Last-Modified` and NO `Cache-Control`,
 * so a browser may serve a module from cache without asking. ⛔ A DIAGNOSTIC,
 * not a fix — a hard reload is what changes the answer; this only says which
 * copy is running. (`watch.html`'s `#sourceStamp`, and it cost a round trip
 * there before it existed.)
 */
function stamp() {
    const box = document.getElementById('sourceStamp');
    fetch(new URL('./mazeLabView.js', import.meta.url), { method: 'HEAD' })
        .then((r) => {
            box.textContent = `mazeLabView.js Last-Modified: ${r.headers.get('last-modified')
                ?? '(none sent)'} — if this is older than your edit, hard-reload `
                + '(Ctrl+Shift+R).';
        })
        .catch(() => { box.textContent = 'source stamp unavailable (no HEAD).'; });
}
