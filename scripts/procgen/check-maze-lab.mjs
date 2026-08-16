#!/usr/bin/env node
/**
 * check-maze-lab — THE CONSTRUCTIVE-MODE SLICE 3 ACCEPTANCE ROW.
 *
 * Does `frontend/modules/mazeRoom/lab.html`, running the procgen loop over the
 * MAZE bindings in a browser from nothing but URL parameters, generate the same
 * level node does — and does it EDIT, SOLVE and round-trip its payload?
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * The editor arc's lesson (trap 176 / 185): the browser rows that SKIPPED when
 * no dev server was up hid a page that could not load AT ALL for two rungs.
 * This row starts one on a free port (`serveRepoRoot`, the ONE static server in
 * the arc) and shuts it down on every path. **There is no skip condition.**
 * `--host=` uses an existing server instead, which is a convenience and not an
 * escape.
 *
 * ── WHAT IT CAN CATCH, AND WHAT IT CANNOT ─────────────────────────────
 *
 * Both sides call the same loop, so this is NOT a check that the loop is
 * correct — it is a check that the PAGE'S OWN PATH TO IT is, and everything
 * between a URL and that call is page-owned and unshared: parsing the bounds,
 * choosing the palette, wiring the model to the oracle, running the module
 * graph in chromium rather than node, converting a click to a cell, and
 * serialising what came out. A defect in any of them shows here.
 *
 * ⛔ It does NOT re-derive the generator's answer independently — nothing can,
 * short of a second generator. The anchor is node's OWN output for the same
 * seed, which is the artifact `generate-maze-level.mjs --json` emits.
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  0. **THE GRAPH LOADS** — zero console errors, zero `pageerror`s, and zero
 *     `node:` specifiers anywhere in the page's transitive import graph
 *     (statically walked here, and the module COUNT is printed so an empty walk
 *     cannot pass for a clean one — trap 176).
 *  1. **CROSS-RUNTIME IDENTITY** — `?seed=3&count=4&run=1` in the browser gives
 *     the level AND the trace `generate-maze-level.mjs --seed=3 --count=4`
 *     gives, byte for byte.
 *  2. **STEP** advances exactly one rung and the pane shows that row's OUTCOME
 *     WORD, read off the DOM rather than off the readout.
 *  3. **RESTRICT** to one family changes the catalogue's ticks AND the level the
 *     run produces, and the URL names the restriction.
 *  4. **THE DIRECTED ATTEMPT** reports KEPT with its keep-kind sentence, or a
 *     NAMED refusal — never a silent nothing.
 *  5. **EDIT** — a click on a cell THIS FILE computes from the canvas geometry
 *     paints that cell, the identity line says "1 manual edit(s)" AND
 *     UNCERTIFIED, and the URL does NOT carry the edit (⚖ ruling 9).
 *  6. **SOLVE re-certifies**, and a room whose entrance this row SEALS comes
 *     back REFUSED with the oracle's own reason text.
 *  7. **THE PAYLOAD ROUND-TRIPS** — what Download would write, loaded back
 *     through the page's own LOAD box, is the same world.
 *  8. **THE URL ROUND-TRIPS** — edit the form, press, and the bar NAMES the
 *     run; reload it and the level comes back identical (the fixed point) — AND
 *     the bar's literal values are asserted against numbers this file states,
 *     because a fixed point tests self-consistency and never correctness.
 *  9. **`?skeleton=`** (constructive-mode slice 5) — a carved kind reaches the
 *     MODEL and produces node's own carved level byte for byte; the identity
 *     line names it; the DEFAULT is spelled by absence; the SELECTOR writes it
 *     and RESETS the ladder; the catalogue lists the kinds; an unknown kind
 *     refuses BY NAME.
 * 10. **THE CONNECTIVITY PRE-CHECK** (constructive-mode slice 6) — an
 *     EXPLICIT-anchor directive at a cell an INDEPENDENT flood in this file
 *     says would seal a `winding` corridor comes back `ILLEGAL_PLACEMENT`, and
 *     the trace pane prints the flood's own sentence naming the entrance, the
 *     goal and the rule's soundness bound. ⛔ A VALUE claim, not an echo: the
 *     cell is chosen without asking `refusalAt` anything (trap 269).
 * 11. **`?areas=`** (PROCGEN ELEMENTS arc 1) — the spec reaches the MODEL and
 *     the page's level IS node's `--areas=1` level byte for byte; the DOORS and
 *     the KEY are counted on it here; the LEGEND names each symbol once; LAYER
 *     ▶ steps the overlay without touching the ladder or the URL; a REFUSED
 *     graph prints the module's own reason and still shows its carved level.
 * 12. **`?require=`** — the directive is MET with the BFS differential as its
 *     proof and changes nothing about the level; `?require=K1` at `?areas=1`
 *     REFUSES BY NAME and the page then offers NO level and NO payload; a
 *     non-symbol refuses at the parameter.
 *     ⛓ **10b (slice 6b)** — the same directive on an `empty` **3x3** room is
 *     `ILLEGAL_PLACEMENT` too, and the pane's sentence names that room's own
 *     kind. ⚖ The user dropped the rule's kind scope on 2026-08-15; 3x3 is the
 *     only width at which one template can seal an open maze room (measured
 *     2x2..11x11 over seeds 1..40), so it is the only subject that can show it.
 *
 * ⛔ EVERY WAIT IS ON A CONDITION, never on a readout merely EXISTING (traps
 * 246/258): `window.__mazeLab` is set on the FIRST render, so a poll for its
 * existence would read a mid-boot page.
 *
 * Run: node scripts/procgen/check-maze-lab.mjs
 *      node scripts/procgen/check-maze-lab.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const MAZE = (p) => import(join(REPO, 'frontend/modules/mazeRoom', p));
const {
    MazeRoomEditor, PALETTE_TYPES, applyEdit, generateStep, generateWithDirectives, labPayload,
    serializeMazeLevel,
} = await MAZE('mazeLab.js');

const json = (v) => JSON.stringify(v);
let failed = 0;
const check = (ok, what, detail = '') => {
    if (!ok) failed += 1;
    // eslint-disable-next-line no-console
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
};

/* ══════════════════════════════════════════════════════════════════════
 * CLAIM 0a — THE IMPORT GRAPH, WALKED STATICALLY
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ A `node:` import is invisible until the page is loaded in a browser, where
 * it is a hard failure — and the failure looks like "the page is blank", which
 * is exactly what hid one for two rungs. Walking the graph here names the
 * OFFENDING FILE instead. ⚠ The module COUNT is printed and asserted non-tiny:
 * a walk that resolved nothing would report zero `node:` edges and mean it.
 */
function walkGraph(entry) {
    const seen = new Set();
    const nodeEdges = [];
    const stack = [resolve(entry)];
    while (stack.length) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        let src;
        try {
            src = readFileSync(file, 'utf8');
        } catch {
            nodeEdges.push(`UNRESOLVED ${file}`);
            continue;
        }
        const re = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const spec = m[1] ?? m[2];
            if (spec.startsWith('node:')) {
                nodeEdges.push(`${file.replace(REPO, '')} -> ${spec}`);
                continue;
            }
            if (!spec.startsWith('.')) {
                nodeEdges.push(`${file.replace(REPO, '')} -> BARE ${spec}`);
                continue;
            }
            stack.push(resolve(dirname(file), spec));
        }
    }
    return { modules: seen.size, nodeEdges };
}

const graph = walkGraph(join(REPO, 'frontend/modules/mazeRoom/mazeLabView.js'));
// eslint-disable-next-line no-console
console.log(`node: the lab page's import graph is ${graph.modules} module(s)`);
check(graph.modules > 20,
    'the import graph WALK resolved a real graph (a walk that found nothing would report '
    + 'zero node: edges and mean it)', `${graph.modules} modules`);
check(graph.nodeEdges.length === 0,
    '⛓ ZERO node:/bare specifiers anywhere in the page\'s transitive import graph (trap 176 '
    + '— a node: edge is a page that cannot load at all)',
    graph.nodeEdges.join(' | '));

/* ══════════════════════════════════════════════════════════════════════
 * THE NODE-SIDE ANCHORS
 * ══════════════════════════════════════════════════════════════════════ */

const cli = (args) => JSON.parse(execFileSync(process.execPath,
    [join(HERE, 'generate-maze-level.mjs'), ...args, '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));

const SUBJECT = { seed: 3, count: 4 };
const nodePayload = cli([`--seed=${SUBJECT.seed}`, `--count=${SUBJECT.count}`]);
// eslint-disable-next-line no-console
console.log(`node: seed ${SUBJECT.seed} at count ${SUBJECT.count} keeps `
    + `${nodePayload.summary.keptCount} over ${nodePayload.summary.attempts} attempt(s)`);

/**
 * ⛓ THE SEALING SUBJECT IS MEASURED, NOT PICKED. Claim 6 needs a room in which
 * walling the entrance's two orthogonal neighbours DISCONNECTS the goal — so
 * neither neighbour may BE the goal (the editor refuses a wall on an exit tile,
 * which would make the claim pass for the wrong reason). Scanned over seeds
 * 1..12 on a 5x5 room; the first that qualifies is the subject and its goal is
 * printed.
 */
const SEAL_ROOM = { width: 5, height: 5 };
let SEAL = null;
for (let seed = 1; seed <= 12 && !SEAL; seed += 1) {
    const st = generateStep({ seed, step: 0, ...SEAL_ROOM });
    const g = st.model.goalCell;
    const adjacent = (g.tx === 1 && g.ty === 0) || (g.tx === 0 && g.ty === 1);
    if (!adjacent) SEAL = { seed, goal: g };
}
if (!SEAL) throw new Error('check-maze-lab: no seed in 1..12 puts the 5x5 goal off the '
    + 'entrance\'s two neighbours — the sealing claim has no subject.');
// eslint-disable-next-line no-console
console.log(`node: sealing subject = seed ${SEAL.seed} on ${SEAL_ROOM.width}x`
    + `${SEAL_ROOM.height}, goal (${SEAL.goal.tx},${SEAL.goal.ty})`);

/**
 * ⛓⛓⛓ CONSTRUCTIVE-MODE SLICE 6 — THE **CONNECTIVITY PRE-CHECK'S** SUBJECT, and
 * it is found by an INDEPENDENT FLOOD written here rather than by asking
 * `refusalAt` which cell it dislikes.
 *
 * ⛔ Trap 269's law: an ECHO claim and a VALUE claim are different claims. If
 * this file located the cell by calling the very rule it then asserts fired,
 * the row would be *"the model agrees with itself"* — green for a build whose
 * flood is inverted, because the search and the assertion would move together.
 * So the cell comes from a flood written from the RULE'S ENGLISH (4-neighbour,
 * `TILE_FLOOR` only, tiles ignored above), and what the browser is then asked is
 * whether the PAGE refuses it, by name, with the sentence.
 */
const floodOpen = (level, writes, from, to) => {
    const painted = new Map(writes.map((w) => [`${w.x},${w.y}`, 1]));
    const at = (x, y) => level.tiles[x + y * level.width];
    const ok = (x, y) => x >= 0 && y >= 0 && x < level.width && y < level.height
        && !painted.has(`${x},${y}`) && at(x, y) === 0;
    if (!ok(from.x, from.y) || !ok(to.x, to.y)) return false;
    const seen = new Set([`${from.x},${from.y}`]);
    let frontier = [{ ...from }];
    while (frontier.length) {
        const nextRing = [];
        for (const p of frontier) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const q = { x: p.x + dx, y: p.y + dy };
                const key = `${q.x},${q.y}`;
                if (seen.has(key) || !ok(q.x, q.y)) continue;
                if (q.x === to.x && q.y === to.y) return true;
                seen.add(key);
                nextRing.push(q);
            }
        }
        frontier = nextRing;
    }
    return false;
};

let PRECHECK = null;
for (let seed = 1; seed <= 12 && !PRECHECK; seed += 1) {
    const st = generateStep({ seed, step: 0, skeleton: { kind: 'winding' } });
    const level = serializeMazeLevel(st.record);
    const goal = { x: st.model.goalCell.tx, y: st.model.goalCell.ty };
    for (const [ori, len] of [['h', 3], ['v', 3], ['h', 2], ['v', 2], ['h', 1], ['v', 1]]) {
        for (let ty = 0; ty < level.height && !PRECHECK; ty += 1) {
            for (let tx = 0; tx < level.width && !PRECHECK; tx += 1) {
                const cells = Array.from({ length: len }, (_, i) => (ori === 'h'
                    ? { x: tx + i, y: ty } : { x: tx, y: ty + i }));
                const onGrid = cells.every((c) => c.x < level.width && c.y < level.height);
                const free = cells.every((c) => level.tiles[c.x + c.y * level.width] === 0
                    && !(c.x === level.entrance.x && c.y === level.entrance.y)
                    && !(c.x === goal.x && c.y === goal.y));
                if (!onGrid || !free) continue;
                if (floodOpen(level, cells, level.entrance, goal)) continue;
                PRECHECK = { seed, ori, len, tx, ty, goal, entrance: level.entrance };
            }
        }
        if (PRECHECK) break;
    }
}
if (!PRECHECK) {
    throw new Error('check-maze-lab: no `winding` skeleton in seeds 1..12 has a cell where '
        + 'one wall-segment SEALS the room — the pre-check claim has no subject.');
}
// eslint-disable-next-line no-console
console.log(`node: pre-check subject = seed ${PRECHECK.seed} winding, `
    + `wall-segment(ori=${PRECHECK.ori},len=${PRECHECK.len}) at `
    + `(${PRECHECK.tx},${PRECHECK.ty}) seals (${PRECHECK.entrance.x},${PRECHECK.entrance.y})`
    + `->(${PRECHECK.goal.x},${PRECHECK.goal.y})`);

/**
 * ⛓⛓⛓ CONSTRUCTIVE-MODE SLICE 6b — THE SAME RULE'S **OPEN-ROOM** SUBJECT.
 *
 * ⚖ The user widened the pre-check to EVERY kind on 2026-08-15, so `empty` is
 * no longer exempt and the page owes the claim there too. ⛔ THE SIZE IS A
 * MEASUREMENT, NOT A GUESS: slice 6 scanned every open room from 2x2 to 11x11
 * over seeds 1..40 for a SINGLE palette row that seals it and found
 * `2x2 0 · **3x3 29** · 4x4 0 · 5x5 0 · 6x6 0 · 7x7 0 · 11x11 0`. 3x3 is the
 * only width where one `wall-segment` spans the room, so it is the only
 * open-room subject this page can be asked about — and the reason no committed
 * maze pair moved when the scope was dropped (the default room is 11x11).
 *
 * ⛔ Same law as above: the cell comes from THIS FILE's flood, never from
 * `refusalAt` (trap 269).
 */
const OPEN_ROOM = { width: 3, height: 3 };
let OPEN_PRECHECK = null;
for (let seed = 1; seed <= 12 && !OPEN_PRECHECK; seed += 1) {
    const st = generateStep({ seed, step: 0, ...OPEN_ROOM });
    const level = serializeMazeLevel(st.record);
    const goal = { x: st.model.goalCell.tx, y: st.model.goalCell.ty };
    for (const [ori, len] of [['h', 3], ['v', 3], ['h', 2], ['v', 2]]) {
        for (let ty = 0; ty < level.height && !OPEN_PRECHECK; ty += 1) {
            for (let tx = 0; tx < level.width && !OPEN_PRECHECK; tx += 1) {
                const cells = Array.from({ length: len }, (_, i) => (ori === 'h'
                    ? { x: tx + i, y: ty } : { x: tx, y: ty + i }));
                const onGrid = cells.every((c) => c.x < level.width && c.y < level.height);
                const free = cells.every((c) => level.tiles[c.x + c.y * level.width] === 0
                    && !(c.x === level.entrance.x && c.y === level.entrance.y)
                    && !(c.x === goal.x && c.y === goal.y));
                if (!onGrid || !free) continue;
                if (floodOpen(level, cells, level.entrance, goal)) continue;
                OPEN_PRECHECK = { seed, ori, len, tx, ty, goal, entrance: level.entrance };
            }
        }
        if (OPEN_PRECHECK) break;
    }
}
if (!OPEN_PRECHECK) {
    throw new Error('check-maze-lab: no 3x3 `empty` room in seeds 1..12 has a cell where one '
        + 'wall-segment SEALS it — slice 6b\'s open-room claim has no subject, and the '
        + 'measurement it rests on has to be re-run before this row is relaxed.');
}
// eslint-disable-next-line no-console
console.log(`node: OPEN-room pre-check subject = seed ${OPEN_PRECHECK.seed} empty `
    + `${OPEN_ROOM.width}x${OPEN_ROOM.height}, wall-segment(ori=${OPEN_PRECHECK.ori},`
    + `len=${OPEN_PRECHECK.len}) at (${OPEN_PRECHECK.tx},${OPEN_PRECHECK.ty}) seals `
    + `(${OPEN_PRECHECK.entrance.x},${OPEN_PRECHECK.entrance.y})->`
    + `(${OPEN_PRECHECK.goal.x},${OPEN_PRECHECK.goal.y})`);

/**
 * ⛓⛓⛓ THE AREA SUBJECT IS **MEASURED**, NOT PICKED (⚖ arc-1 §9.5's acceptance
 * table, re-measured here): `rooms` at 15x15 with one key accepts 20 of 24
 * seeds, and 11x11 with two accepts 4 — so a page defaulting to 11x11 shows a
 * REFUSAL most of the time and that is the honest state. This row needs one
 * seed of each, and it SCANS for them rather than hard-coding a number that a
 * later change to the partition would silently turn into the wrong subject.
 */
const AREA_ROOM = { width: 15, height: 15 };
let AREA_SUBJECT = null;
let AREA_REFUSAL = null;
for (let seed = 1; seed <= 24 && !(AREA_SUBJECT && AREA_REFUSAL); seed += 1) {
    if (!AREA_SUBJECT) {
        const st = generateStep({ seed, step: 0, ...AREA_ROOM, skeleton: { kind: 'rooms' },
            areas: { keys: 1 } });
        if (st.model.areas.ran) AREA_SUBJECT = { seed, areas: st.model.areas };
    }
    if (!AREA_REFUSAL) {
        const st = generateStep({ seed, step: 0, width: 11, height: 11,
            skeleton: { kind: 'rooms' }, areas: { keys: 2 } });
        if (!st.model.areas.ran) AREA_REFUSAL = { seed, reason: st.model.areas.refused.reason };
    }
}
if (!AREA_SUBJECT) {
    throw new Error('check-maze-lab: no `rooms` 15x15 seed in 1..24 runs the area graph at one '
        + 'key — the acceptance table this row rests on (20/24) has moved and the claims '
        + 'below would be about nothing.');
}
if (!AREA_REFUSAL) {
    throw new Error('check-maze-lab: no `rooms` 11x11 seed in 1..24 REFUSES two keys — the '
        + 'honest-refusal claim has no subject.');
}
// eslint-disable-next-line no-console
console.log(`node: AREA subject = seed ${AREA_SUBJECT.seed} rooms 15x15 keys=1 -> `
    + `${AREA_SUBJECT.areas.doors.length} door(s), ${AREA_SUBJECT.areas.keys.length} key(s), `
    + `symbols [${AREA_SUBJECT.areas.graph.symbols.join(', ')}]; REFUSAL subject = seed `
    + `${AREA_REFUSAL.seed} rooms 11x11 keys=2 -> ${AREA_REFUSAL.reason}`);

/**
 * ⛓⛓⛓ PROCGEN ELEMENTS ARC 2 SLICE 4 — **THE ELEMENT SUBJECTS ARE SCANNED, NOT
 * PICKED**, and BOTH of them are: one seed that PLACES a gadget and guards a
 * symbol with it, and one that REFUSES.
 *
 * ⚠ §10.11.5 is why the second subject is as important as the first:
 * `guard;len=2;turns=1` on `rooms` at 15x15 places on about 57% of seeds, so a
 * page that only ever showed a success would be silent on nearly half of them.
 * ⛔ A hard-coded seed would quietly become a claim about the other outcome the
 * day the site draw moved; the scan THROWS instead.
 */
const ELEMENT_ROOM = { width: 15, height: 15, skeleton: { kind: 'rooms' }, areas: { keys: 1 } };
const ELEMENT_SPEC = { name: 'guard', params: { len: 2, turns: 1 } };
const ELEMENT_QUERY = 'width=15&height=15&skeleton=rooms&areas=1'
    + '&elements=guard%3Blen%3D2%3Bturns%3D1';
let ELEMENT_SUBJECT = null;
let ELEMENT_REFUSAL = null;
for (let seed = 1; seed <= 24 && !(ELEMENT_SUBJECT && ELEMENT_REFUSAL); seed += 1) {
    const info = generateStep({ seed, step: 0, ...ELEMENT_ROOM, elements: ELEMENT_SPEC })
        .model.elements;
    if (!ELEMENT_SUBJECT && info.ran && info.placed[0].guards) {
        ELEMENT_SUBJECT = { seed, placed: info.placed[0] };
    }
    if (!ELEMENT_REFUSAL && !info.ran) ELEMENT_REFUSAL = { seed, reason: info.refused.reason };
}
if (!ELEMENT_SUBJECT) {
    throw new Error('check-maze-lab: no `rooms` 15x15 seed in 1..24 places a '
        + '`guard;len=2;turns=1` gadget that GUARDS a symbol — the ELEMENTS CENSUS (§10.1) has '
        + 'moved and every claim below would be about nothing.');
}
if (!ELEMENT_REFUSAL) {
    throw new Error('check-maze-lab: no `rooms` 15x15 seed in 1..24 REFUSES a '
        + '`guard;len=2;turns=1` gadget — the honest-refusal claim has no subject, and §10.11.5 '
        + 'says most seeds should have one.');
}
// eslint-disable-next-line no-console
console.log(`node: ELEMENT subject = seed ${ELEMENT_SUBJECT.seed} -> `
    + `${ELEMENT_SUBJECT.placed.instance}, block at (${ELEMENT_SUBJECT.placed.block.x},`
    + `${ELEMENT_SUBJECT.placed.block.y}), button (${ELEMENT_SUBJECT.placed.button.x},`
    + `${ELEMENT_SUBJECT.placed.button.y}), guards ${ELEMENT_SUBJECT.placed.guards}, `
    + `${ELEMENT_SUBJECT.placed.tunnel.length} tunnel cell(s); REFUSAL subject = seed `
    + `${ELEMENT_REFUSAL.seed} -> ${ELEMENT_REFUSAL.reason}`);

/* ══════════════════════════════════════════════════════════════════════
 * THE BROWSER
 * ══════════════════════════════════════════════════════════════════════ */

const host = arg('host', '');
const server = host ? null : await serveRepoRoot();
const base = host || `http://127.0.0.1:${server.address().port}`;
const PAGE = `${base}/frontend/modules/mazeRoom/lab.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close();
    if (server) await closeServer(server);
    process.exit(code);
};

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 12 — THE PAYLOAD ROUTES, AND WHY THEY ARE `page.route`
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚖ §3.9 took `?directed=` off the address bar, so the two SEALING claims
 * below — which need an EXPLICIT-anchor directive, and which this page cannot
 * arm by clicking (there is no click-to-anchor on the maze, ⚖ §3.4) — reach the
 * page through the ONE channel a directive list now has: a PAYLOAD, loaded with
 * `?gen=`. ⛔ Replaced, never relaxed (trap 62/199): the CLAIM is the same
 * `ILLEGAL_PLACEMENT` sentence, driven through the new channel.
 *
 * ⛓⛓ AND THE ROUTE IS FULFILLED BY **PLAYWRIGHT**, not by `serveRepoRoot`'s
 * `routes` map — because a row whose payload lives on its OWN server loses that
 * claim under `--host=`, which is exactly the defect the orchestrator measured
 * in `check-seedling-editor-edit.mjs` (a 300 s `waitForFunction` timeout on a
 * route the reused server does not have). Intercepting the fetch keeps the page
 * unchanged, keeps the claim, and works in BOTH modes.
 */
const SEAL_ROUTE = '/__maze-seal-payload.json';
const OPEN_SEAL_ROUTE = '/__maze-open-seal-payload.json';
const directedPayload = (args, spec) => labPayload(
    generateWithDirectives({ ...args, directed: [spec] }),
);
const SEAL_SPEC = {
    template: 'wall-segment',
    params: { ori: PRECHECK.ori, len: PRECHECK.len },
    anchor: { tx: PRECHECK.tx, ty: PRECHECK.ty },
    bound: 1,
    keepPolicy: 'first-solved',
};
const OPEN_SEAL_SPEC = {
    template: 'wall-segment',
    params: { ori: OPEN_PRECHECK.ori, len: OPEN_PRECHECK.len },
    anchor: { tx: OPEN_PRECHECK.tx, ty: OPEN_PRECHECK.ty },
    bound: 1,
    keepPolicy: 'first-solved',
};
const SEAL_PAYLOAD = directedPayload(
    { seed: PRECHECK.seed, step: 0, skeleton: { kind: 'winding' } }, SEAL_SPEC,
);
const OPEN_SEAL_PAYLOAD = directedPayload(
    { seed: OPEN_PRECHECK.seed, step: 0, ...OPEN_ROOM }, OPEN_SEAL_SPEC,
);
/**
 * ⛔⛔ THE MATCH IS ON THE **PATHNAME**, AND A GLOB IS WRONG HERE — measured.
 * `page.route('**\/__maze-seal-payload.json')` matches the whole URL, and the
 * page is loaded at `lab.html?gen=/__maze-seal-payload.json`, so the glob
 * intercepted the NAVIGATION and served the payload JSON as the document:
 * `window.__mazeLab` was simply undefined and the wait read as a 60 s STUCK
 * with no console error to attribute it (trap 298's shape, one layer down).
 */
/**
 * ⛓⛓⛓ PROCGEN ELEMENTS ARC 2 SLICE 4 — **AN EDITED PAYLOAD, FOR THE CLAIM THAT
 * CLOSES CONSTRUCTIVE §18.2.** Until this slice the maze REFUSED to reproduce
 * one: an edit was recorded as a DESCRIPTION (cell + palette TYPE) and a fold
 * would have placed a different body at the right cell, so `?gen=` could only
 * ever report the refusal. The edit record is an OP now, and this payload is
 * how the page is asked to prove it.
 *
 * ⛔ THE ITEM ID IS DELIBERATELY **NOT** THE EDITOR'S DEFAULT. `MazeRoomEditor`
 * starts on `firstKey(itemLib)`, and the page constructs its editor from the
 * world's own library — so a fold that used the SELECTION rather than the op
 * would place `key_red` at the right cell and every count would still agree.
 * `key_blue` is the one value that separates the two.
 */
const EDITED_ROUTE = '/__maze-edited-payload.json';
const EDITED_PAYLOAD = (() => {
    const base = generateStep({ seed: 3, step: 2 });
    const editor = new MazeRoomEditor({
        itemLib: base.record.itemLib, obstacleLib: base.record.obstacleLib,
    });
    const free = base.model.allCells(base.record)
        .filter((p) => base.model.isFree(base.record, p.tx, p.ty));
    editor.selectType(PALETTE_TYPES.ITEM);
    editor.selectItemId('key_blue');
    let st = applyEdit(base, editor, free[0].tx, free[0].ty).state;
    editor.selectType(PALETTE_TYPES.BLOCK);
    st = applyEdit(st, editor, free[1].tx, free[1].ty).state;
    return labPayload(st);
})();
// eslint-disable-next-line no-console
console.log(`node: the EDITED payload carries ${EDITED_PAYLOAD.edits.length} op(s): `
    + `${EDITED_PAYLOAD.edits.map((e) => `${e.op.op}${e.op.id ? `(${e.op.id})` : ''}`).join(', ')}`);

const PAYLOAD_ROUTES = new Map([
    [SEAL_ROUTE, SEAL_PAYLOAD],
    [OPEN_SEAL_ROUTE, OPEN_SEAL_PAYLOAD],
    [EDITED_ROUTE, EDITED_PAYLOAD],
]);
await page.route(
    (u) => PAYLOAD_ROUTES.has(u.pathname),
    (r) => r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: `${json(PAYLOAD_ROUTES.get(new URL(r.request().url()).pathname))}\n`,
    }),
);

/**
 * ⛔ THE WAIT IS ON A CONDITION, NEVER ON EXISTENCE. `window.__mazeLab` is set
 * on the FIRST render — which for a `?run=1` load is the SKELETON, before the
 * ladder — so a poll for the object itself would read a mid-boot page and
 * report about a level the run had not reached (traps 246/258; the Seedling row
 * paid for exactly this once).
 */
const settled = (pred, why) => page.waitForFunction(pred, null, { timeout: 60000 })
    .catch((e) => { throw new Error(`STUCK waiting for ${why}: ${e.message}`); });

const load = async (query, pred, why) => {
    await page.goto(`${PAGE}?${query}`, { waitUntil: 'domcontentloaded' });
    await settled(pred, why);
    return page.evaluate(() => window.__mazeLab);
};

const read = () => page.evaluate(() => window.__mazeLab);

try {
    /* ── CLAIM 0b: the page loads clean ────────────────────────────── */
    const web = await load(`seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`,
        () => window.__mazeLab?.step === 4, 'the ladder to reach step 4');
    check(errors.length === 0, 'the page loads with ZERO console errors and ZERO pageerrors',
        errors.join(' | '));
    check(!web.fatal, 'the page did not refuse its own URL', web.fatal ?? '');

    /* ── CLAIM 1: cross-runtime byte identity ─────────────────────── */
    check(json(web.level) === json(nodePayload.level),
        '⛓⛓ the BROWSER reproduced node\'s LEVEL for seed 3 at count 4, byte for byte',
        `${json(web.level).length} vs ${json(nodePayload.level).length} bytes`);
    check(json(web.trace) === json(nodePayload.trace),
        '⛓⛓ …and its whole TRACE, including every verbatim refusal');
    check(web.identity.includes('seed 3') && web.identity.includes('11x11')
        && web.identity.includes('CERTIFIED'),
        'the identity line names the seed, the ROOM and the certification', web.identity);

    /* ── CLAIM 2: STEP advances one rung, and the PANE says so ────── */
    const before = await load(`seed=${SUBJECT.seed}&count=1&run=1`,
        () => window.__mazeLab?.step === 1, 'step 1');
    const beforeRows = await page.$$eval('#labTrace .tr', (n) => n.length);
    await page.click('#labStep');
    await settled(() => window.__mazeLab?.step === 2, 'step 2 after one STEP press');
    const after = await read();
    const afterRows = await page.$$eval('#labTrace .tr', (n) => n.length);
    check(after.step === before.step + 1, 'STEP advances exactly ONE rung',
        `${before.step} -> ${after.step}`);
    check(afterRows > beforeRows, 'and the generation pane GREW by at least one row',
        `${beforeRows} -> ${afterRows}`);
    /**
     * ⛔ READ OFF THE DOM, NOT OFF THE READOUT. `window.__mazeLab.rows` and the
     * pane are two renderings of one trace, and a pane that stopped printing
     * the outcome word would leave the readout perfectly correct.
     */
    const paneText = await page.textContent('#labTrace');
    const wordsInPane = ['KEPT', 'REVERTED', 'NO_ANCHOR', 'ILLEGAL_PLACEMENT']
        .filter((w) => paneText.includes(w));
    check(wordsInPane.length > 0,
        'the PANE ITSELF shows each row\'s OUTCOME WORD (read off the DOM)',
        wordsInPane.join(', '));
    check(after.rows.every((r) => r.outcome),
        'and every row in the readout carries an outcome');

    /* ── CLAIM 3: RESTRICT changes the catalogue AND the run ──────── */
    const whole = await load('seed=7&count=4&run=1',
        () => window.__mazeLab?.step === 4, 'the unrestricted run');
    const restricted = await load('seed=7&count=4&run=1&families=wall',
        () => window.__mazeLab?.step === 4, 'the restricted run');
    check(restricted.roster?.axis === 'families'
        && json(restricted.roster.names) === json(['wall']),
        'the page READ the restriction off the URL', json(restricted.roster));
    // ⚠ The SKELETON row is the loop's own control and carries `family:
    // 'skeleton'`; it is not a draw from any roster, so it is excluded BY NAME
    // rather than by a truthiness test that would also swallow a real gap.
    const drawnFamilies = [...new Set(restricted.rows
        .filter((r) => r.family !== 'skeleton').map((r) => r.family))];
    check(drawnFamilies.length > 0 && drawnFamilies.every((f) => f === 'wall'),
        '⛔ the run DREW ONLY from the restricted family — a restriction the page echoed '
        + 'without PASSING to the loop would show a door here',
        drawnFamilies.join(','));
    check(json(restricted.level) !== json(whole.level),
        'and the LEVEL differs from the unrestricted one (the restriction reached the loop)');
    const ticked = await page.$$eval('#labRoster .famBox',
        (n) => n.map((b) => `${b.dataset.family}:${b.checked}`));
    check(ticked.includes('wall:true') && ticked.includes('door:false'),
        'the catalogue\'s ticks show WHICH families the run may draw from', ticked.join(' '));
    const rurl = new URLSearchParams(restricted.url);
    check(rurl.get('families') === 'wall' && rurl.get('templates') === null,
        'the URL names the restriction on exactly ONE axis', restricted.url);

    /* ── CLAIM 4: the DIRECTED attempt reports, never silently ────── */
    await load('seed=5&count=2&run=1', () => window.__mazeLab?.step === 2, 'seed 5 at step 2');
    await page.click('#labRoster .catForm button[data-template="door-key"]');
    await settled(() => window.__mazeLab?.directives?.length === 1,
        'the directed attempt to be recorded');
    const directed = await read();
    const d = directed.directives[0];
    check(['KEPT', 'REVERTED', 'NO_ANCHOR', 'ILLEGAL_PLACEMENT'].includes(d.outcome),
        '⛓ the directed ATTEMPT reports a named outcome', `${d.instance}: ${d.outcome}`);
    const dText = await page.textContent('#labDirectives');
    check(dText.includes(d.outcome) && dText.includes(d.instance),
        'and the directives pane PRINTS it (instance + outcome), on the page', dText.trim());
    if (d.outcome === 'KEPT') {
        check(/NO verb to discharge|first-SOLVED/.test(dText),
            '⛔ a KEPT row says WHICH KIND OF KEEP it was — the v1 maze palette declares no '
            + 'verbs, so the honest sentence is "this family has NO verb to discharge"',
            dText.trim());
    }
    check(directed.identity.includes('1 directed attempt(s)'),
        'and the identity line counts the directed attempt', directed.identity);
    /**
     * ⛓⛓⛓ SLICE 12 — AND THE PRESS DID NOT PUT IT IN THE BAR. ⛔ This is the
     * ONE place on this page where a writer that still emitted `?directed=`
     * becomes visible: the `?gen=` boot never rewrites the bar (the payload owns
     * it), so without this row the maze row is BLIND to that mutant — which is
     * exactly how it measured the first time this table was run.
     */
    check(new URLSearchParams(directed.url).get('directed') === null
        && directed.identity.includes('the URL is NOT a reproduction of this construction'),
    '⛔⛔ SLICE 12: the ATTEMPT press leaves NO directive in the bar, and the identity line '
        + 'SAYS the URL names the ladder alone', directed.url);

    /* ── CLAIM 5: EDIT paints the cell THIS FILE names ────────────── */
    const edited = await load(`seed=${SEAL.seed}&width=${SEAL_ROOM.width}`
        + `&height=${SEAL_ROOM.height}&count=0&source=edit`,
    () => window.__mazeLab?.source === 'edit', 'the EDIT arm');
    check(edited.edits === 0 && edited.identity.includes('UNCERTIFIED'),
        'a freshly-loaded SKELETON is UNCERTIFIED — nothing has solved it yet',
        edited.identity);
    await page.click('#labPalette button[data-type="wall"]');
    /**
     * ⛓⛓ THE TARGET CELL IS COMPUTED HERE, FROM THE CANVAS RECTANGLE — the URL
     * fixed point cannot gate a VALUE (trap 250), so the row must know which
     * cell it clicked independently of the page. ⛔ AND IT CLICKS THE LAST PIXEL
     * OF THE TILE, because an off-by-one is invisible to a middle-of-tile click.
     */
    /**
     * ⛓⛓ THE RECTANGLE IS RE-READ BEFORE **EVERY** CLICK, and that is a
     * measurement rather than caution: the identity line is above the canvas
     * and GROWS as edits accumulate ("…, then 1 manual edit(s) … ⚠ the URL is
     * NOT a reproduction…"), so it re-wraps, the header gets taller and the
     * canvas moves DOWN. A rectangle captured before the first edit put the
     * second click a row too high — which showed up as a STUCK wait, not as a
     * wrong cell, because the editor happily painted a tile nobody asserted on.
     */
    const rectNow = () => page.$eval('#canvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    /** `where: 'last'` clicks the LAST PIXEL of the tile — an off-by-one is
     *  invisible to a middle-of-tile click. */
    const clickCell = async (tx, ty, where = 'mid') => {
        const b = await rectNow();
        const px = where === 'last'
            ? { x: b.x + Math.floor(((tx + 1) * b.w) / SEAL_ROOM.width) - 1,
                y: b.y + Math.floor(((ty + 1) * b.h) / SEAL_ROOM.height) - 1 }
            : { x: b.x + Math.floor(((tx + 0.5) * b.w) / SEAL_ROOM.width),
                y: b.y + Math.floor(((ty + 0.5) * b.h) / SEAL_ROOM.height) };
        await page.mouse.click(px.x, px.y);
    };
    const TARGET = { tx: 2, ty: 3 };
    await clickCell(TARGET.tx, TARGET.ty, 'last');
    await settled(() => window.__mazeLab?.edits === 1, 'the first manual edit');
    const one = await read();
    const idx = TARGET.ty * SEAL_ROOM.width + TARGET.tx;
    check(one.level.tiles[idx] === 1,
        `⛓ the LAST PIXEL of tile (${TARGET.tx},${TARGET.ty}) painted THAT tile — the cell `
        + 'this file computed, not the one the page happened to pick',
        `tiles[${idx}] = ${one.level.tiles[idx]}`);
    check(one.identity.includes('1 manual edit(s)') && one.identity.includes('UNCERTIFIED'),
        '⚖ §3.8: the identity line says "1 manual edit(s)" AND UNCERTIFIED', one.identity);
    check(one.identity.includes('the URL is NOT a reproduction of this construction')
        && one.identity.includes('names the LADDER alone'),
        '⚖ ruling 9 + ⛓ SLICE 12: the page SAYS the URL stopped being a reproduction — and '
        + 'the wording no longer says "after edits", because since slice 12 a DIRECTIVE '
        + 'triggers the same clause',
        one.identity.slice(-140));
    check(!new URLSearchParams(one.url).has('edits')
        && json(new URLSearchParams(one.url).get('count')) === json('0'),
        '⛔ and the URL carries NO edit — an edited level\'s identity is the PAYLOAD',
        one.url);

    /* ── CLAIM 6: SOLVE re-certifies; a SEALED entrance REFUSES ───── */
    await page.selectOption('#source', 'solve');
    await settled(() => window.__mazeLab?.source === 'solve', 'the SOLVE arm');
    await page.click('#labSolve');
    await settled(() => window.__mazeLab?.solve?.verdict === 'SOLVED',
        'the solve of a room with one stray wall');
    const certified = await read();
    check(certified.certified === true,
        '⛓ SOLVE after an edit RE-CERTIFIES — the certification is the oracle\'s answer, '
        + 'not the absence of one');
    check(certified.identity.includes('CERTIFIED')
        && !certified.identity.includes('UNCERTIFIED'),
        'and the identity line flips to CERTIFIED', certified.identity);

    // Seal the entrance: wall its two orthogonal neighbours. ⛓ The subject was
    // MEASURED above so neither of them is the goal (the editor refuses a wall
    // on an exit, which would make this pass for the wrong reason).
    await page.selectOption('#source', 'edit');
    await settled(() => window.__mazeLab?.source === 'edit', 'the EDIT arm again');
    await page.click('#labPalette button[data-type="wall"]');
    await clickCell(1, 0);
    await settled(() => window.__mazeLab?.edits === 2, 'the first sealing edit');
    await clickCell(0, 1);
    await settled(() => window.__mazeLab?.edits === 3, 'the two sealing edits');
    const sealed = await read();
    check(sealed.certified === null && sealed.identity.includes('UNCERTIFIED'),
        '⚖ §3.8 + ⛓ SLICE 12: an edit DROPS the certification to `null` — NOBODY HAS ASKED. '
        + 'This page published `false` here until slice 12 (§16.2 flagged the divergence from '
        + 'Seedling and named this side to move); `false` now means the ORACLE said no',
        `${json(sealed.certified)} · ${sealed.identity.slice(0, 90)}`);
    await page.selectOption('#source', 'solve');
    await settled(() => window.__mazeLab?.source === 'solve', 'the SOLVE arm');
    await page.click('#labSolve');
    await settled(() => window.__mazeLab?.solve?.verdict === 'REFUSED',
        'the REFUSED verdict on a sealed entrance');
    const refused = await read();
    check(refused.solve.verdict === 'REFUSED',
        '⛓ a SEALED entrance comes back REFUSED, not "solved anyway"');
    check(/no route from the entrance/.test(refused.solve.reasonText ?? ''),
        '⛔ …with the ORACLE\'S OWN reason text, verbatim', refused.solve.reasonText);
    const solveText = await page.textContent('#solveNote');
    check(solveText.includes('REFUSED') && solveText.includes('no route from the entrance'),
        'and the refusal is ON THE PAGE, not only in the readout — a refusal nobody can see '
        + 'is a refusal that did not happen', solveText.trim());
    check(refused.certified === false,
        '⛓⛓ SLICE 12: a REFUSED solve reports `false` — THE ORACLE WAS ASKED AND SAID NO, '
        + 'which is the one place on this page `false` is reachable, and a different fact '
        + 'from the `null` the edit above left',
        json(refused.certified));

    /* ── CLAIM 7: the payload round-trips through the page ────────── */
    const beforeLoad = await read();
    await page.click('#labLoad');
    await settled(() => window.__mazeLab?.source === 'solve', 'the reload from the save box');
    const reloaded = await read();
    check(json(reloaded.level) === json(beforeLoad.level),
        '⛓ the payload the save box holds LOADS BACK to the same world, tile for tile',
        `${json(reloaded.level).length} bytes`);
    check(reloaded.certified === null,
        '⛔ and a LOADED level is UNCERTIFIED whatever the file claimed — `null`, because '
        + 'NOBODY HAS ASKED this page about the world it just took in (slice 12: it was '
        + '`false`, which claimed an answer nobody gave)',
        json(reloaded.certified));

    /* ── CLAIM 8: the URL round-trips, and its VALUES are asserted ── */
    await load('seed=1&count=1&run=1', () => window.__mazeLab?.step === 1, 'the form subject');
    await page.fill('#labSeed', '9');
    await page.fill('#labCount', '3');
    await page.fill('#labWidth', '7');
    await page.fill('#labHeight', '7');
    await page.fill('#labAnchorTries', '2');
    await page.click('#labRunAll');
    await settled(() => window.__mazeLab?.step === 3, 'the RUN-ALL to the new target');
    const pressed = await read();
    const u = new URLSearchParams(pressed.url);
    /**
     * ⛓⛓⛓ THE LITERAL VALUES, STATED HERE. ⛔ A round-trip fixed point tests
     * SELF-CONSISTENCY and never correctness: a writer that dropped
     * `anchortries` and a reader that defaulted it would round-trip perfectly
     * and generate a different level. So each parameter is asserted against the
     * number this file typed into the form.
     */
    for (const [key, want] of [['seed', '9'], ['count', '3'], ['width', '7'], ['height', '7'],
        ['anchortries', '2'], ['tries', '8'], ['k', '3'], ['expansions', '20000'],
        ['source', 'generate'], ['biome', 'maze-v1'], ['run', '1']]) {
        check(u.get(key) === want, `the URL names ?${key}=${want}`, `got ${json(u.get(key))}`);
    }
    const reOpened = await load(pressed.url.replace(/^\?/, ''),
        () => window.__mazeLab?.step === 3, 'the reloaded link');
    check(json(reOpened.level) === json(pressed.level),
        '⛓ and the copied link reproduces the level the press produced, byte for byte');
    check(reOpened.url === pressed.url,
        '⛓ the URL is a FIXED POINT — a second load rewrites the bar identically',
        `${pressed.url}\n        vs ${reOpened.url}`);
    const nodeSame = generateStep({ seed: 9, step: 3, width: 7, height: 7,
        bounds: { obstacleTarget: 3, triesPerStep: 8, saturationK: 3,
            anchorTriesPerCandidate: 2 } });
    check(json(reOpened.level) === json(serializeMazeLevel(nodeSame.record)),
        '⛓⛓ …and NODE agrees about that level too — the form\'s numbers reached the loop',
    );

    /* ── CLAIM 9: ?skeleton= — CONSTRUCTIVE-MODE SLICE 5 ─────────── */
    /**
     * ⛓⛓⛓ THE CONSTRUCTIVE SKELETON, IN THE BROWSER. Five claims, and the
     * first four are about the PAGE'S OWN PATH to the kind — the URL reaches
     * the model, the selector reaches the URL, the identity line says which
     * room this is, and a kind the page cannot build refuses BY NAME.
     *
     * ⛔ THE VALUE IS ASSERTED AGAINST THE LITERAL THIS FILE TYPED, never
     * against a round trip (⚖ kickoff §5).
     */
    const carved = await load(`seed=${SUBJECT.seed}&count=3&skeleton=winding&run=1`,
        () => window.__mazeLab?.step === 3, 'the winding ladder to step 3');
    check(carved.skeleton?.kind === 'winding',
        '⛓ ?skeleton=winding reached the MODEL — the state names the kind',
        json(carved.skeleton));
    check(new URLSearchParams(carved.url).get('skeleton') === 'winding',
        '⛓ …and the bar still names it after the page rewrote the URL', carved.url);
    check(/skeleton: winding \(CARVED, not the open room\)/.test(carved.identity),
        'the identity line NAMES the carved kind', carved.identity);
    /**
     * ⛓⛓ AND THE ROOM IS ACTUALLY DIFFERENT. A page that read the parameter,
     * echoed it into its readout and generated the open room anyway would pass
     * all three claims above — this is the one that cannot.
     */
    const nodeCarved = generateStep({
        seed: SUBJECT.seed, step: 3, skeleton: { kind: 'winding' },
        bounds: { obstacleTarget: 3, triesPerStep: 8, saturationK: 3,
            anchorTriesPerCandidate: 1 },
    });
    check(json(carved.level) === json(serializeMazeLevel(nodeCarved.record)),
        '⛓⛓ the BROWSER\'s carved level IS node\'s, byte for byte',
        `${json(carved.level).length} vs ${json(serializeMazeLevel(nodeCarved.record)).length} bytes`);
    /**
     * ⛔ AND A CHECK THAT PASSED FOR THE WRONG REASON, FIXED. "the room holds
     * wall tiles" was green even while the page was generating the OPEN room,
     * because `wall-segment` places wall tiles too. The claim that separates a
     * CARVE from a ladder is the wall COUNT against the same seed's open room
     * at the same step — a carve puts down dozens, six templates put down a
     * handful.
     */
    const openSame = generateStep({
        seed: SUBJECT.seed,
        step: 3,
        bounds: { obstacleTarget: 3, triesPerStep: 8, saturationK: 3,
            anchorTriesPerCandidate: 1 },
    });
    const wallsIn = (level) => level.tiles.filter((t) => t === 1).length;
    check(wallsIn(carved.level) > wallsIn(serializeMazeLevel(openSame.record)) + 20,
        '⛔ …and it is genuinely CARVED — far more wall than the SAME seed\'s open room at '
        + 'the same step, which is what a ladder alone can never produce',
        `${wallsIn(carved.level)} wall tiles vs ${wallsIn(serializeMazeLevel(openSame.record))}`);

    /** ⛓ The DEFAULT is spelled by ABSENCE, never as `?skeleton=empty`. */
    const openRoom = await load(`seed=${SUBJECT.seed}&count=1&run=1`,
        () => window.__mazeLab?.step === 1, 'the open-room ladder');
    check(new URLSearchParams(openRoom.url).get('skeleton') === null,
        '⛔ the writer DELETES ?skeleton= at the open room rather than writing the default',
        openRoom.url);
    check(!/skeleton: /.test(openRoom.identity),
        '…and the identity line stays silent about the kind when it is the open room',
        openRoom.identity);

    /** ⛓ THE SELECTOR — the kind reaches the URL through the form, and RESETS. */
    await page.selectOption('#labSkeleton', 'rooms');
    await settled(() => window.__mazeLab?.skeleton?.kind === 'rooms'
        && window.__mazeLab?.step === 0, 'the selector to reset to the skeleton');
    const selected = await read();
    check(new URLSearchParams(selected.url).get('skeleton') === 'rooms',
        '⛓ the SELECTOR writes ?skeleton=rooms into the bar', selected.url);
    check(selected.step === 0 && new URLSearchParams(selected.url).get('run') === null,
        '⛔ …and a kind change RESETS the ladder to the skeleton, as a seed change does',
        `step ${selected.step}, url ${selected.url}`);

    /** ⛓ The catalogue's SKELETONS section, and it is not the roster. */
    check(selected.skeletons?.length === 9 && selected.skeletons.every((r) => r.offered),
        'the catalogue lists all 9 kinds, every one offered by the MAZE (it owns the '
        + 'simulator-bound backends)', json((selected.skeletons ?? []).map((r) => r.kind)));

    /** ⛔ A REFUSAL BY NAME, not a silent fallback. */
    await page.goto(`${PAGE}?skeleton=spiral`, { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of an unknown kind');
    const refusedKind = await read();
    check(/\?skeleton="spiral"/.test(refusedKind.fatal ?? '')
        && /is not a skeleton kind/.test(refusedKind.fatal ?? ''),
        '⛔ ?skeleton=spiral REFUSES BY NAME with the whole vocabulary', refusedKind.fatal);

    /* ── CLAIM 9b: THE KIND PARAMETERS (constructive-mode slice 7) ─── */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM, NOT AN ECHO (trap 269). Slice 5 shipped a page
     * that read `?skeleton=`, echoed it into the bar AND printed it in the
     * identity line while generating the open room; three of five claims were
     * green. So the subject here is the FLOOR COUNT of the level the page
     * produced, read off `window.__mazeLab.level` — a page that copied
     * `;chambers=2` into its readout and its URL and carved without it fails
     * this and nothing else.
     */
    const plain = await load(`seed=3&count=0&skeleton=winding&run=1`,
        () => window.__mazeLab?.step === 0 && window.__mazeLab?.level,
        'the bare winding skeleton');
    const roomy = await load(`seed=3&count=0&skeleton=${encodeURIComponent('winding;chambers=2')}`
        + '&run=1', () => window.__mazeLab?.step === 0 && window.__mazeLab?.level,
        'the winding skeleton with chambers');
    const floorIn = (level) => level.tiles.filter((t) => t === 0).length;
    check(floorIn(roomy.level) > floorIn(plain.level),
        '⛓⛓ ?skeleton=winding;chambers=2 produces MORE FLOOR than ?skeleton=winding at the '
        + 'same seed — counted from the LEVEL the page built, not from the URL it echoed',
        `${floorIn(roomy.level)} floor tiles vs ${floorIn(plain.level)}`);
    /**
     * ⛔ AND IT IS THE SAME LEVEL NODE BUILDS. The count above proves the
     * parameter did SOMETHING; this proves it did the RIGHT thing, against the
     * other runtime's bytes.
     */
    const nodeRoomy = generateStep({
        seed: 3, step: 0, skeleton: { kind: 'winding', params: { chambers: 2 } },
    });
    check(json(roomy.level) === json(serializeMazeLevel(nodeRoomy.record)),
        '⛓⛓ …and the browser\'s parameterized room IS node\'s, byte for byte',
        `${json(roomy.level).length} bytes`);
    check(/skeleton: winding;chambers=2 \(CARVED/.test(roomy.identity),
        '⛓ the identity line NAMES the non-default parameter, in the URL\'s own spelling',
        roomy.identity);
    check(new URLSearchParams(roomy.url).get('skeleton') === 'winding;chambers=2',
        '⛓ …and the bar still spells it that way after the page rewrote the URL', roomy.url);
    /** ⛓ THE FORM — the params selects are mounted from the catalogue's schema. */
    await page.goto(`${PAGE}?seed=3&skeleton=rooms`, { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.skeleton?.kind === 'rooms', 'the rooms skeleton');
    const paramKeys = await page.evaluate(() => [...document.querySelectorAll(
        '#labSkeletonParams select[data-skel-param]')].map((s2) => s2.dataset.skelParam));
    check(json(paramKeys) === json(['minRoom', 'chambers']),
        '⛓ the SKELETON PARAMS form mounts one control per declared knob, in declaration '
        + 'order', json(paramKeys));
    await page.selectOption('#labSkeletonParams select[data-skel-param="minRoom"]', '2');
    await settled(() => window.__mazeLab?.skeleton?.params?.minRoom === 2
        && window.__mazeLab?.step === 0, 'the param change to reach the state');
    const paramed = await read();
    check(new URLSearchParams(paramed.url).get('skeleton') === 'rooms;minRoom=2',
        '⛓ a PARAMETER change reaches the bar, in the one spelling', paramed.url);
    check(paramed.step === 0,
        '⛔ …and RESETS the ladder, because a kind parameter builds a DIFFERENT room',
        `step ${paramed.step}`);
    /** ⛔ A refusal by name, on the parameter rather than the kind. */
    await page.goto(`${PAGE}?skeleton=${encodeURIComponent('rooms;minRoom=9')}`,
        { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of an out-of-domain value');
    const refusedParam = await read();
    check(/declared domain \[2, 3, 4\]/.test(refusedParam.fatal ?? ''),
        '⛔ ?skeleton=rooms;minRoom=9 REFUSES BY NAME with the declared domain',
        refusedParam.fatal);

    /* ── CLAIM 10: THE CONNECTIVITY PRE-CHECK, ON THE PAGE (slice 6) ─ */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM ABOUT WHAT THE RULE DID (trap 269), not an echo:
     * the cell was chosen above by an independent flood, and what is asserted
     * here is that the page's own directed attempt at that cell comes back
     * `ILLEGAL_PLACEMENT` **with the flood's sentence printed in the trace
     * pane** — read off the DOM, because the readout and the pane are two
     * renderings and a pane that stopped printing the refusal would leave the
     * readout perfectly correct.
     */
    /**
     * ⛓⛓⛓ SLICE 12 — DRIVEN THROUGH THE **PAYLOAD**, not through `?directed=`.
     * ⛔ The cell is still THIS FILE's own flood's (trap 269) and the sentence
     * is still the model's own; what moved is the channel the directive rides.
     */
    const sealedRun = await load(`gen=${SEAL_ROUTE}`,
        () => window.__mazeLab?.directives?.length === 1, 'the sealing directive to be applied');
    const sd = sealedRun.directives[0];
    check(new URLSearchParams(sealedRun.url).get('directed') === null,
        '⛔ SLICE 12: the bar names NO directive — the construction rode the payload',
        sealedRun.url);
    check(sealedRun.payloadCheck?.checked === true && sealedRun.payloadCheck?.agrees === true,
        '⛓⛓⛓ …and the page REPRODUCED a DIRECTED payload byte-identically: the directives '
        + 'were REPLAYED (this was `directed: null` until slice 12, and the level would have '
        + 'been the plain skeleton)',
        json(sealedRun.payloadCheck?.differences ?? sealedRun.payloadCheck?.why ?? []));
    check(sd.outcome === 'ILLEGAL_PLACEMENT' && sd.at === null,
        '⛓⛓⛓ SLICE 6: an EXPLICIT-anchor directive that would SEAL a `winding` corridor is '
        + 'ILLEGAL_PLACEMENT — the MODEL refused it before any solve, and the record did '
        + 'not move',
        `${sd.instance} @!${PRECHECK.tx},${PRECHECK.ty} -> ${sd.outcome}, at=${json(sd.at)}`);
    const sealPane = await page.textContent('#labTrace');
    check(/would SEAL the room/.test(sealPane)
        && new RegExp(`no floor path from the ENTRANCE \\(${PRECHECK.entrance.x},`
            + `${PRECHECK.entrance.y}\\) to the GOAL \\(${PRECHECK.goal.x},`
            + `${PRECHECK.goal.y}\\)`).test(sealPane),
    '⛓⛓ …and the PANE prints the flood\'s own sentence, naming the entrance and the goal '
        + 'THIS FILE computed independently — a VALUE claim, not an echo of the outcome word',
    (sealPane.match(/[^\n]*would SEAL the room[^\n]*/) ?? ['(absent)'])[0].slice(0, 220));
    check(/obstacles and items are the ORACLE/.test(sealPane),
        '⛔ …and the sentence states the rule\'s SOUNDNESS BOUND — tiles only, so a door is '
        + 'never a wall here');

    /* ── CLAIM 10b: THE SAME RULE ON AN **OPEN** ROOM (slice 6b) ───── */
    /**
     * ⛓⛓⛓ THE SCOPE IS GONE, AND THE PAGE IS WHERE THAT IS VISIBLE. ⚖ Slice 6
     * shipped this rule off at `empty`; the user widened it on 2026-08-15. The
     * subject is the 3x3 room scanned above by THIS FILE's own flood — the only
     * width at which one template can seal an open maze room — and the claim is
     * a VALUE claim: `ILLEGAL_PLACEMENT`, the record unmoved, and the pane
     * printing a sentence that names THIS room's kind as `empty`.
     *
     * ⛔ Restoring `if (skeletonKind === DEFAULT_SKELETON_KIND) return null;` in
     * `procgenMaze.sealRefusal` reddens exactly here and nowhere else in this
     * row (claim 10 above runs on `winding` and cannot see it).
     */
    const openSealed = await load(`gen=${OPEN_SEAL_ROUTE}`,
    () => window.__mazeLab?.directives?.length === 1,
    'the OPEN-room sealing directive to be applied');
    const od = openSealed.directives[0];
    check(od.outcome === 'ILLEGAL_PLACEMENT' && od.at === null,
        '⛓⛓⛓ SLICE 6b: the SAME directive on an `empty` 3x3 room is ILLEGAL_PLACEMENT too — '
        + 'the pre-check is no longer kind-scoped, and the open room is not exempt',
        `${od.instance} @!${OPEN_PRECHECK.tx},${OPEN_PRECHECK.ty} -> ${od.outcome}, `
        + `at=${json(od.at)}`);
    const openPane = await page.textContent('#labTrace');
    check(/would SEAL the room/.test(openPane)
        && /at EVERY skeleton kind — this room is "empty"/.test(openPane)
        && new RegExp(`no floor path from the ENTRANCE \\(${OPEN_PRECHECK.entrance.x},`
            + `${OPEN_PRECHECK.entrance.y}\\) to the GOAL \\(${OPEN_PRECHECK.goal.x},`
            + `${OPEN_PRECHECK.goal.y}\\)`).test(openPane),
    '⛓⛓ …and the PANE\'s sentence names the ENTRANCE, the GOAL and THIS ROOM\'S OWN KIND '
        + '(`empty`) — a VALUE claim: a page still running the kind-scoped build could not '
        + 'print this line at all',
    (openPane.match(/[^\n]*would SEAL the room[^\n]*/) ?? ['(absent)'])[0].slice(0, 240));

    /* ── CLAIM 11: `?areas=` — THE AREA GRAPH ON THE PAGE (ELEMENTS 1.3) ── */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM, AND THE ANCHOR IS THE OTHER RUNTIME'S BYTES
     * (trap 269 / slice 5's §12.8 defect, which this arc's own mutant (b)
     * re-ran): the page must pass `?areas=` to `generateWithDirectives`, not
     * merely echo it into the bar and the identity line. What separates the two
     * is the LEVEL — its doors, its key and its grid — compared byte for byte
     * against `generate-maze-level.mjs --areas=1` for the same seed.
     */
    const areaCli = cli([`--seed=${AREA_SUBJECT.seed}`, '--count=2', '--width=15', '--height=15',
        '--skeleton=rooms', '--areas=1']);
    const areaWeb = await load(`seed=${AREA_SUBJECT.seed}&width=15&height=15&skeleton=rooms`
        + '&areas=1&count=2&run=1',
    () => window.__mazeLab?.step === 2 && window.__mazeLab?.areaGraph?.ran,
    'the areas ladder to reach step 2 with a graph');
    check(json(areaWeb.level) === json(areaCli.level),
        '⛓⛓ ?areas=1 reached the MODEL — the BROWSER\'s level (grid, obstacles AND items) IS '
        + 'node\'s, byte for byte',
        `${json(areaWeb.level).length} vs ${json(areaCli.level).length} bytes`);
    // ⛓ COUNTED OFF THE SERIALIZED LEVEL'S OWN ARRAYS (`[{x,y,id}]`), which is
    // the shape the CLI writes and the page's LOAD box reads.
    const doorsIn = (level) => (level.obstacles ?? [])
        .filter((o) => String(o.id).startsWith('door_K')).length;
    const keysIn = (level) => (level.items ?? [])
        .filter((o) => String(o.id).startsWith('key_K')).length;
    check(doorsIn(areaWeb.level) === AREA_SUBJECT.areas.doors.length
        && doorsIn(areaWeb.level) > 0,
    '⛓⛓ …and the DOOR obstacles on the page\'s level are the doors the binding placed, '
        + 'counted here rather than read off the page\'s own summary',
    `${doorsIn(areaWeb.level)} doors on the page vs ${AREA_SUBJECT.areas.doors.length} in the `
        + 'model');
    check(keysIn(areaWeb.level) === 1 && areaWeb.areaGraph.symbols.length === 1,
        '⛓ …one KEY item per symbol, on the grid',
        `${keysIn(areaWeb.level)} key(s), symbols ${json(areaWeb.areaGraph.symbols)}`);
    /** ⚠ §9.11(6): the LEGEND names each symbol ONCE — never a label per cell. */
    check(json(areaWeb.areaLegend.map((r) => r.symbol)) === json(areaWeb.areaGraph.symbols)
        && areaWeb.areaLegend.every((r) => r.doorCount > 0),
    '⛓ the LEGEND lists exactly the symbols the LEVEL carries, one row each, with the door '
        + 'COUNT rather than a label per door',
    json(areaWeb.areaLegend.map((r) => `${r.symbol}:${r.doorCount}`)));
    check(new URLSearchParams(areaWeb.url).get('areas') === '1'
        && /areas: 1/.test(areaWeb.identity),
    '⛓ the bar and the identity line name the spec (the ECHO half — kept because a link that '
        + 'does not name its graph is not a link to this level)', areaWeb.url);
    /** ⛓ THE LAYER STEPPER — a VIEW control: it re-draws and does NOT reset. */
    const layersSeen = [areaWeb.areaLayer];
    for (const want of ['off', 'partition', 'locks', 'keys', 'all']) {
        // eslint-disable-next-line no-await-in-loop
        await page.click('#labAreaLayerNext');
        /**
         * ⛔ THE PREDICATE IS A **STRING**, because it runs in the PAGE: a
         * closure over this file's `layersSeen` is not defined there, which is
         * a ReferenceError the row reported as a STUCK wait until it was fixed.
         */
        // eslint-disable-next-line no-await-in-loop
        await settled(`window.__mazeLab?.areaLayer === ${json(want)}`,
            `the layer to advance to ${want}`);
        // eslint-disable-next-line no-await-in-loop
        layersSeen.push((await read()).areaLayer);
    }
    check(json(layersSeen) === json(['all', 'off', 'partition', 'locks', 'keys', 'all']),
        '⛓⛓ LAYER ▶ steps through the declared layers and wraps — skeleton → partition → '
        + 'graph → keys', json(layersSeen));
    const afterLayers = await read();
    check(afterLayers.step === 2 && json(afterLayers.level) === json(areaCli.level),
        '⛔ …and stepping the LAYERS re-draws only: the ladder, the level and the bar are '
        + 'unmoved, and the layer is NOT in the URL (a view setting is not what was built)',
        `step ${afterLayers.step}, ?layer=${new URLSearchParams(afterLayers.url).get('layer')}`);
    /** ⛓ THE HONEST REFUSAL — the page prints the module's own reason. */
    const refusedAreas = await load(`seed=${AREA_REFUSAL.seed}&skeleton=rooms&areas=2&count=0`
        + '&run=1', () => window.__mazeLab?.areaGraph?.ran === false
        && window.__mazeLab?.areas?.keys === 2, 'the refused area graph');
    check(refusedAreas.areaGraph.refused?.reason === AREA_REFUSAL.reason
        && refusedAreas.areaNote.includes(AREA_REFUSAL.reason)
        && refusedAreas.identity.includes(`⛔ the area graph REFUSED: ${AREA_REFUSAL.reason}`),
    '⛓⛓ a REFUSED graph prints the module\'s OWN reason where the level would be — the '
        + 'honest 11x11-at-two-keys state, not a widened bound',
    `${AREA_REFUSAL.reason} | ${refusedAreas.areaNote.slice(0, 120)}`);
    check(refusedAreas.level !== null,
        '⛓ …and the CARVED level is still shown, because it IS the level this run produced '
        + '(it simply has no locks) — which is what separates it from a refused DIRECTIVE');

    /* ── CLAIM 12: `?require=` — RULE-DIRECTED ON THE PAGE ────────────── */
    /**
     * ⛓⛓⛓ THE DIFFERENTIAL, ON THE PAGE. A met directive carries the PROOF
     * (`planWithoutKey === null`), and a directive the key count cannot admit
     * is a REFUSED RUN: the reason is printed where the level would be, and
     * ⛔ **NO LEVEL AND NO PAYLOAD ARE OFFERED** — a run that did not produce
     * what was asked for must not be shown as if it had.
     */
    const met = await load(`seed=${AREA_SUBJECT.seed}&width=15&height=15&skeleton=rooms`
        + '&areas=1&require=K0&count=2&run=1',
    () => window.__mazeLab?.requireResult, 'the directive to be answered');
    check(met.requireResult.refused === null
        && met.requireResult.met[0].symbol === 'K0'
        && met.requireResult.met[0].grade === 'STRONG'
        && met.requireResult.met[0].planWithoutKey === null,
    '⛓⛓ ?require=K0 is MET and its PROOF is the BFS differential — the goal is '
        + `${met.requireResult.met[0]?.planWith} step(s) away WITH the key and UNREACHABLE `
        + 'without it', json(met.requireResult.met[0]));
    check(json(met.level) === json(areaCli.level),
        '⛔ …and the directive changed NOTHING about the level: it is a QUESTION asked of the '
        + 'run, not a search that re-rolls it (the same bytes as the run without it)');
    check(/require K0 MET — K0 STRONG/.test(met.identity),
        '⛓ the identity line states the grade', met.identity);
    const refusedReq = await load(`seed=${AREA_SUBJECT.seed}&width=15&height=15&skeleton=rooms`
        + '&areas=1&require=K1&count=2&run=1',
    () => window.__mazeLab?.requireResult?.refused, 'the refused directive');
    check(refusedReq.requireResult.refused.reason
        === 'no-key-level-admits-this-symbol-within-maxkeys'
        && refusedReq.areaNote.includes('no-key-level-admits-this-symbol-within-maxkeys')
        && /No bound is widened/.test(refusedReq.areaNote),
    '⛓⛓ ?require=K1 with ?areas=1 REFUSES BY NAME, and the page prints the sentence where '
        + 'the level would be — ⛔ no bound is widened to meet a directive',
    refusedReq.areaNote.slice(0, 160));
    check(refusedReq.level === null && refusedReq.payload === null,
        '⛔ …and there is NO LEVEL and NO PAYLOAD to hand out: the run did not produce what '
        + 'was asked for', `level=${refusedReq.level}, payload=${refusedReq.payload}`);
    const canvasHidden = await page.$eval('#canvas', (n) => n.hidden);
    check(canvasHidden === true,
        '⛓ …read off the DOM as well as off the readout: the canvas itself is not shown');
    /** ⛔ A refusal by name on the PARAMETER, before any generation. */
    await page.goto(`${PAGE}?require=key_red`, { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of a non-symbol');
    const badRequire = await read();
    check(/\?require="key_red"/.test(badRequire.fatal ?? '')
        && /is not an area-graph symbol/.test(badRequire.fatal ?? ''),
    '⛔ ?require=key_red REFUSES BY NAME, naming the parameter and the vocabulary',
    badRequire.fatal);
    /** ⛓ THE SELECTOR — the spec reaches the URL through the form, and RESETS. */
    await page.goto(`${PAGE}?seed=${AREA_SUBJECT.seed}&width=15&height=15&skeleton=rooms`
        + '&count=2&run=1', { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.step === 2, 'the ladder before the area selector');
    await page.selectOption('#labAreas', '1');
    await settled(() => window.__mazeLab?.areas?.keys === 1 && window.__mazeLab?.step === 0,
        'the area selector to reset to the skeleton');
    const selectedAreas = await read();
    check(new URLSearchParams(selectedAreas.url).get('areas') === '1'
        && selectedAreas.step === 0 && selectedAreas.areaGraph.ran === true,
    '⛓⛓ the SELECTOR writes ?areas=1 into the bar and RESETS the ladder — the graph is built '
        + 'with the MODEL, so a ladder cannot span two of them', selectedAreas.url);

    /* ── CLAIM 14: `?elements=` — THE GADGET ON THE PAGE (ELEMENTS 2.4) ── */
    /**
     * ⛓⛓⛓ A **VALUE** CLAIM, AND THE ANCHOR IS THE OTHER RUNTIME'S BYTES
     * (trap 269, and mutant (a) of this slice is exactly the build it is aimed
     * at): the page must PASS `?elements=` to `generateWithDirectives`, not
     * merely echo it into the bar and the identity line. What separates the two
     * is the LEVEL — its blocks, its buttons, its button library and its guard
     * door — compared byte for byte against
     * `generate-maze-level.mjs --elements=guard;len=2;turns=1` for the same
     * seed, and then COUNTED here off the serialized level.
     */
    const elemCli = cli([`--seed=${ELEMENT_SUBJECT.seed}`, '--count=2', '--width=15',
        '--height=15', '--skeleton=rooms', '--areas=1', '--elements=guard;len=2;turns=1']);
    const elemWeb = await load(`seed=${ELEMENT_SUBJECT.seed}&${ELEMENT_QUERY}&count=2&run=1`,
        () => window.__mazeLab?.step === 2 && window.__mazeLab?.elementInfo?.ran,
        'the elements ladder to reach step 2 with a placed gadget');
    check(json(elemWeb.level) === json(elemCli.level),
        '⛓⛓ ?elements= reached the MODEL — the BROWSER\'s level (grid, obstacles, items, '
        + 'BLOCKS, BUTTONS and the button library) IS node\'s, byte for byte',
        `${json(elemWeb.level).length} vs ${json(elemCli.level).length} bytes`);
    /**
     * ⛓ COUNTED OFF THE SERIALIZED LEVEL'S OWN ARRAYS, which is the shape the
     * CLI writes and the page's LOAD box reads — and the ids are the BINDING's
     * allocator's, asserted literally so a second spelling would show up here.
     */
    const P = ELEMENT_SUBJECT.placed;
    check((elemWeb.level.blocks ?? []).length === 1
        && json(elemWeb.level.blocks[0]) === json({ x: P.block.x, y: P.block.y })
        && (elemWeb.level.buttons ?? []).length === 1
        && elemWeb.level.buttons[0].id === 'button_A0'
        && elemWeb.level.buttonLib.button_A0.holds === 'sw_A0',
    '⛓⛓ …and the gadget\'s ENTITIES are on it — ONE block at the cell the binding recorded, '
        + 'ONE button_A0 holding sw_A0 — counted here, not read off the page\'s summary',
    `${json(elemWeb.level.blocks)} / ${json(elemWeb.level.buttons)}`);
    const guardDoors = (elemWeb.level.obstacles ?? []).filter((o) => o.id === 'door_A0');
    const flags = (elemWeb.level.items ?? []).filter((i) => String(i.id).startsWith('flag_'));
    check(guardDoors.length === 1
        && elemWeb.level.obstacleLib.door_A0.clear_set[0][0] === 'sw_A0'
        && flags.length === 1,
    '⛓⛓ …the GUARD DOOR is on the grid with its combo_list [[sw_A0]], and the symbol it '
        + `guards is realised as a FLAG (${json(flags.map((f) => f.id))}) rather than a key — `
        + '⚖ rulings 21-22, scoped to the guarded symbol', json(guardDoors));
    check(elemWeb.elementInfo.placed[0].guards === ELEMENT_SUBJECT.placed.guards
        && elemWeb.elementInfo.placed[0].tunnel.length === P.tunnel.length
        && elemWeb.elementInfo.placed[0].tunnel.length > 0,
    '⛓ the page\'s own element readout agrees with node about WHAT IT GUARDS and how many '
        + 'cells the CONNECTOR had to dig (the TUNNEL, drawn distinctly from the carve)',
    `guards ${elemWeb.elementInfo.placed[0].guards}, `
        + `${elemWeb.elementInfo.placed[0].tunnel.length} tunnel cell(s)`);
    check(elemWeb.elementLegend.length === 1
        && elemWeb.elementLegend[0].button === 'button_A0'
        && elemWeb.elementLegend[0].door === 'door_A0'
        && elemWeb.elementLegend[0].hold === 'sw_A0',
    '⛓ the LEGEND names the gadget ONCE, with its three per-instance ids — arc 1\'s rule '
        + '(label per SYMBOL, never per cell) applied to the element layer',
    json(elemWeb.elementLegend.map((r) => `${r.instance}:${r.button}`)));
    check(new URLSearchParams(elemWeb.url).get('elements') === 'guard;len=2;turns=1'
        && /elements: guard;len=2;turns=1/.test(elemWeb.identity)
        && /GUARDS K0/.test(elemWeb.identity),
    '⛓ the bar and the identity line name the spec AND what the binding did (the ECHO half, '
        + 'kept and labelled as such — a link that does not name its gadget is not a link to '
        + 'this level)', elemWeb.url);
    /** ⛓ THE HONEST REFUSAL — §10.11.5: most seeds refuse and the page says why. */
    const elemRefused = await load(`seed=${ELEMENT_REFUSAL.seed}&${ELEMENT_QUERY}&count=0&run=1`,
        () => window.__mazeLab?.elementInfo?.ran === false
            && window.__mazeLab?.elements?.name === 'guard', 'the refused element');
    check(elemRefused.elementInfo.refused?.reason === ELEMENT_REFUSAL.reason
        && elemRefused.elementNote.includes(ELEMENT_REFUSAL.reason)
        && elemRefused.identity.includes(`⛔ the element REFUSED: ${ELEMENT_REFUSAL.reason}`),
    '⛓⛓ a REFUSED element prints the binding\'s OWN reason where the gadget would be — the '
        + 'honest state on most seeds, and ⛔ no bound is widened to hide it',
    `${ELEMENT_REFUSAL.reason} | ${elemRefused.elementNote.slice(0, 110)}`);
    check(elemRefused.level !== null && (elemRefused.level.blocks ?? []).length === 0
        && (elemRefused.level.buttons ?? []).length === 0,
    '⛓ …and the CARVED level is still shown and carries NO gadget at all — the run produced '
        + 'that room, it simply has no element in it');
    /** ⛓ THE SELECTOR — the spec reaches the URL through the form, and RESETS. */
    await page.goto(`${PAGE}?seed=${ELEMENT_SUBJECT.seed}&width=15&height=15&skeleton=rooms`
        + '&areas=1&count=2&run=1', { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.step === 2, 'the ladder before the element selector');
    await page.selectOption('#labElements', 'guard');
    await settled(() => window.__mazeLab?.elements?.name === 'guard'
        && window.__mazeLab?.step === 0, 'the element selector to reset to the skeleton');
    const selectedElem = await read();
    check(new URLSearchParams(selectedElem.url).get('elements') === 'guard'
        && selectedElem.step === 0,
    '⛓⛓ the SELECTOR writes ?elements=guard into the bar and RESETS the ladder — an element '
        + 'is stamped into the room BEFORE the carve, so it moves the whole room stream',
    selectedElem.url);

    /* ── CLAIM 15: THE SOLVE REPLAY — the BLOCK MOVES ─────────────── */
    /**
     * ⛓⛓⛓ ⚖ DESIGN RULING 6 fn. 3 (*"step-through visualisation is
     * non-negotiable"*), and a **VALUE** claim rather than a pixel one: what is
     * asserted is `window.__mazeLab.play.blocks`, which is the OVERLAY'S OWN
     * ARGUMENT (`mazeLabView.overlayBlocks` is called once for the draw and
     * once for the readout), so a build that drew the level's INITIAL layout
     * during the replay moves this readout too. That is mutant (b).
     */
    const solveWeb = await load(`seed=${ELEMENT_SUBJECT.seed}&${ELEMENT_QUERY}`
        + '&count=2&run=1&source=solve',
    () => window.__mazeLab?.source === 'solve' && window.__mazeLab?.elementInfo?.ran,
    'the SOLVE arm on a level with a gadget in it');
    check(solveWeb.play === null,
        '⛓ before SOLVE there is NO replay — the frames come from a plan, and there is none');
    await page.click('#labSolve');
    await settled(() => window.__mazeLab?.play?.frames > 1,
        'the SOLVE to produce a replay');
    const frame0 = await read();
    check(frame0.solve.verdict === 'SOLVED' && frame0.play.index === 0,
        '⛓ SOLVE produces a plan and the replay starts at frame 0',
        `${frame0.solve.verdict}, ${frame0.play.frames} frame(s)`);
    check(json(frame0.play.blocks) === json([`${P.block.x},${P.block.y}`]),
        '⛓ …and frame 0\'s block layout is the LEVEL\'s own — the cell the binding recorded',
        json(frame0.play.blocks));
    // ⛓ STEP to the LAST frame. ⛔ Driven by presses, not by a wall clock: the
    // autoplay below is asserted separately and on a CONDITION.
    for (let i = 0; i < frame0.play.frames - 1; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await page.click('#labPlayNext');
    }
    await settled(`window.__mazeLab?.play?.index === ${frame0.play.frames - 1}`,
        'the replay to be stepped to its last frame');
    const frameN = await read();
    check(json(frameN.play.blocks) !== json(frame0.play.blocks),
        '⛓⛓⛓ **THE BLOCK MOVED BETWEEN TWO FRAMES OF THE REPLAY** — a VALUE, not a pixel: '
        + 'this is the array the element overlay was HANDED, so a build drawing `world.blocks` '
        + 'instead of `state.blocks` moves it too',
        `${json(frame0.play.blocks)} → ${json(frameN.play.blocks)}`);
    check(json(frameN.play.blocks) === json([`${P.button.x},${P.button.y}`]),
        '⛓⛓ …and it ended ON ITS BUTTON, which is the MECHANISM stated as the mechanism '
        + '(§9.4): the guard door is open because something is standing on the button',
        json(frameN.play.blocks));
    check(frameN.play.layouts > 1 && frameN.play.player.x >= 0,
        '⛓ the whole plan visits MORE THAN ONE block layout — a walk that pushed nothing '
        + 'would visit exactly one', `${frameN.play.layouts} distinct layout(s)`);
    const playText = await page.textContent('#playNote');
    check(playText.includes('DISTINCT block layout') && playText.includes('the walk PUSHES'),
        '⛓ …and the page SAYS so, where a reader can see it', playText.trim().slice(0, 120));
    /**
     * ⛓⛓ THE SENTENCE ON THE PAGE NAMES THE **SAME** LAYOUT THE READOUT DOES —
     * a claim mutant (b) demanded: the line read the FRAME directly, so under a
     * build that handed the overlay the level's initial layout the picture
     * showed one thing and the page's own line said another. Now both come
     * from `overlayBlocks()`, and this row is what holds them together.
     */
    check(playText.includes(`[${frameN.play.blocks.join(' ')}]`),
        '⛓⛓ …naming the SAME block layout the readout publishes — the page and the picture '
        + 'have ONE answer to "which layout is on screen"',
        `${playText.trim().slice(0, 90)} vs ${json(frameN.play.blocks)}`);
    // ⛓ AUTOPLAY: asserted on a CONDITION (it reaches the last frame), never on
    // a sleep — the frame interval is a wall clock and nothing may gate on it.
    await page.click('#labPlayReset');
    await settled(() => window.__mazeLab?.play?.index === 0, 'the replay to rewind');
    await page.click('#labPlay');
    await settled(`window.__mazeLab?.play?.index === ${frame0.play.frames - 1}`,
        'the AUTOPLAY to reach the last frame on its own');
    check((await read()).play.playing === false,
        '⛓ PLAY runs to the last frame and STOPS there — an animation that wrapped would '
        + 'replay a solve nobody pressed again');

    /* ── CLAIM 16: THE EDIT PALETTE, AND EDITS AS REPLAYABLE OPS ───── */
    /**
     * ⛓⛓⛓ THE PALETTE GAINED BLOCK / BUTTON / FLAG, and the claim is the one
     * ⚖ §3.8 makes: an edit that CHANGES the world drops the certification to
     * `null` and the level carries what was placed.
     */
    const editWeb = await load(`seed=${ELEMENT_SUBJECT.seed}&${ELEMENT_QUERY}`
        + '&count=2&run=1&source=edit',
    () => window.__mazeLab?.source === 'edit' && window.__mazeLab?.elementInfo?.ran,
    'the EDIT arm on a level with a gadget in it');
    check(editWeb.edits === 0 && editWeb.certified === true,
        '⛓ the level opens with NO manual edits and CERTIFIED — the loop\'s own last '
        + 'accepting solve did it, which is what the edit below is about to drop',
        `${editWeb.edits} edit(s), certified=${json(editWeb.certified)}`);
    const paletteTypes = await page.$$eval('#labPalette button',
        (bs) => bs.map((b) => b.dataset.type));
    check(['block', 'button', 'flag'].every((t) => paletteTypes.includes(t)),
        '⛓ the palette OFFERS block / button / flag — the gadget\'s three parts, on the page',
        json(paletteTypes));
    await page.click('#labPalette button[data-type="block"]');
    /**
     * ⛓ THE TARGET CELL IS COMPUTED HERE from the level's own tiles — a FLOOR
     * cell that is not the entrance, not an exit and carries no entity, so the
     * edit cannot be refused for a reason that has nothing to do with blocks.
     */
    const W = editWeb.width;
    const busy = new Set([
        `${editWeb.level.entrance.x},${editWeb.level.entrance.y}`,
        ...editWeb.level.exits.map((e) => `${e.x},${e.y}`),
        ...(editWeb.level.items ?? []).map((i) => `${i.x},${i.y}`),
        ...(editWeb.level.obstacles ?? []).map((o) => `${o.x},${o.y}`),
        ...(editWeb.level.blocks ?? []).map((b) => `${b.x},${b.y}`),
        ...(editWeb.level.buttons ?? []).map((b) => `${b.x},${b.y}`),
    ]);
    let SPOT = null;
    for (let i = 0; i < editWeb.level.tiles.length && !SPOT; i += 1) {
        const c = { tx: i % W, ty: Math.floor(i / W) };
        if (editWeb.level.tiles[i] === 0 && !busy.has(`${c.tx},${c.ty}`)) SPOT = c;
    }
    if (!SPOT) throw new Error('check-maze-lab: the element subject has no free floor cell to '
        + 'drop a block on — the palette claim has no subject.');
    /**
     * ⛓⛓⛓ **THE CANVAS IS SCROLLED BACK INTO VIEW BEFORE THE RECTANGLE IS
     * READ, AND THAT IS A MEASUREMENT.** Clicking a palette button below the
     * canvas makes the browser scroll it into view, which on this 15x15 page
     * (long identity line, two overlay panes, the catalogue) pushed the canvas
     * to `y = -179`. `page.mouse.click` takes VIEWPORT coordinates, so the
     * click landed above the document and nothing happened — reported as a
     * STUCK wait for an edit, not as a click that missed.
     *
     * ⛓ This is the sibling of claim 5's lesson (*"re-read the rectangle before
     * EVERY click"*): there the readout GREW under the canvas, here an
     * unrelated control SCROLLED it away. Both are "a cached geometry is a
     * click somewhere else", and claim 5 never saw this one because its 5x5
     * room fits on screen whole.
     */
    await page.$eval('#canvas', (c) => c.scrollIntoView({ block: 'center' }));
    const eRect = await page.$eval('#canvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (eRect.y < 0 || eRect.w <= 0) {
        throw new Error(`check-maze-lab: the canvas is at y=${eRect.y} after scrolling it into `
            + 'view — a click computed from this rectangle lands outside the document.');
    }
    await page.mouse.click(eRect.x + Math.floor(((SPOT.tx + 0.5) * eRect.w) / W),
        eRect.y + Math.floor(((SPOT.ty + 0.5) * eRect.h) / editWeb.height));
    await settled(() => window.__mazeLab?.edits === 1, 'the block edit to land');
    const blocked = await read();
    check((blocked.level.blocks ?? []).some((b) => b.x === SPOT.tx && b.y === SPOT.ty),
        `⛓⛓ a BLOCK brush click paints a block at (${SPOT.tx},${SPOT.ty}) — the cell this file `
        + 'computed, read back off the serialized level', json(blocked.level.blocks));
    check(blocked.certified === null && blocked.identity.includes('UNCERTIFIED')
        && blocked.identity.includes('1 manual edit(s)'),
    '⚖ §3.8: placing a block DROPS the certification to `null` and the identity line says '
        + 'UNCERTIFIED — editing never bypasses the oracle', blocked.identity.slice(0, 120));
    check(json(blocked.payload.edits[0].op)
        === json({ op: 'setBlock', x: SPOT.tx, y: SPOT.ty }),
    '⛓⛓⛓ …and the payload records it as an **OP**, not a description — constructive '
        + '§18.2\'s residue, closed: the record carries its whole argument',
    json(blocked.payload.edits[0]));
    /**
     * ⛓⛓⛓ AND THE OTHER HALF OF THAT RESIDUE: a payload whose edits are OPS is
     * REPRODUCED at `?gen=`. ⛔ The subject's item op names `key_blue`, which is
     * NOT the editor's default — a fold that used the selection would place
     * `key_red` at the right cell and the byte comparison is what sees it.
     */
    const genEdited = await load(`gen=${EDITED_ROUTE}`,
        () => window.__mazeLab?.payloadCheck, 'the EDITED payload to be reproduced');
    check(genEdited.payloadCheck.checked === true && genEdited.payloadCheck.agrees === true,
        '⛓⛓⛓ **AN EDITED PAYLOAD IS REPRODUCED BYTE FOR BYTE** — the maze refused this until '
        + 'this slice, because an edit was a DESCRIPTION and a fold would have placed a '
        + 'different body at the right cell (constructive §17.2/§18.2)',
        json(genEdited.payloadCheck.differences ?? genEdited.payloadCheck.why));
    check(json(genEdited.level) === json(EDITED_PAYLOAD.level)
        && genEdited.edits === EDITED_PAYLOAD.edits.length,
    '⛓ …and the LEVEL it rebuilt is the payload\'s own, edits included',
    `${genEdited.edits} edit(s), ${json(genEdited.level).length} bytes`);
    check((genEdited.level.items ?? []).some((i) => i.id === 'key_blue'),
        '⛓⛓ …carrying `key_blue`, which is NOT the editor\'s default id — the one value that '
        + 'separates "replayed the OP" from "replayed the palette selection"',
        json((genEdited.level.items ?? []).map((i) => i.id)));

    /* ── CLAIM 13: `?directed=` IS REFUSED BY NAME (SLICE 12) ────────── */
    /**
     * ⛓⛓⛓ ⚖ §3.9 — THE RETIRED PARAMETER, ON THE PAGE. ⛔ A saved link naming a
     * construction must FAIL LOUDLY rather than quietly open the plain ladder:
     * the page would otherwise show a level the address promises is something
     * else. The refusal has to NAME THE WAY IN, because a reader holding an old
     * link has no other channel to learn where directives went.
     */
    await page.goto(`${PAGE}?seed=3&count=0&directed=`
        + `${encodeURIComponent('wall-segment(ori=v,len=2)@12d')}`,
    { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of ?directed=');
    const retired = await read();
    check(/no longer a URL parameter/.test(retired.fatal ?? ''),
        '⛔⛔ SLICE 12: ?directed= REFUSES BY NAME on the maze page', retired.fatal);
    check(/directives ride the PAYLOAD/.test(retired.fatal ?? '')
        && /\?gen=/.test(retired.fatal ?? '') && /--directed=/.test(retired.fatal ?? ''),
    '⛔ …and the refusal NAMES THE WAY IN — the payload via ?gen= or the host\'s SEND, and '
        + 'the CLI flag that stayed', retired.fatal);
    check(!retired.level && !retired.payload,
        '⛔ …and a refused page offers NO level and NO payload — it does not fall through to '
        + 'the ladder the link is not naming');

    check(errors.length === 0, 'STILL zero console errors after every arm was driven',
        errors.join(' | '));
} catch (e) {
    check(false, 'the row ran to completion', e.message);
}

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
