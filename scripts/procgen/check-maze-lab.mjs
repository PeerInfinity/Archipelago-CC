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
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7) — **THE BOX LOCK.** This gate drives the machine (browser),
 * so it takes the box before it starts and refuses BY NAME if another
 * instrument holds it — replacing a hand-relayed "BOX BUSY". A gate run
 * UNDER `gates.mjs` recognises the holder's token and passes through.
 * `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'check-maze-lab.mjs', kind: 'browser' });

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const MAZE = (p) => import(join(REPO, 'frontend/modules/mazeRoom', p));
const {
    MazeRoomEditor, PALETTE_TYPES, SOURCES, applyEdit, applyEditOpToState, generateStep,
    generateWithDirectives, labPayload, readLabParams, serializeMazeLevel,
} = await MAZE('mazeLab.js');
/** ⛓ SLICE S2b — the manual arm's own session, node-side: CLAIM 22 builds the
 *  WALLED level a loaded walk must refuse from the page's own functions. */
const { createWalkSession } = await MAZE('mazeLabWalk.js');
/**
 * ⛓⛓ EDITOR v3 E2c — THE SET ARM'S NODE-SIDE ANCHORS. ⛔ The strip's geometry
 * constants are `setEditorCore`'s OWN, never numbers typed here: `overviewLayout`
 * is what chooses a cell size, and a row that carried its own copy of `cellPx`
 * would be asserting against the day it was written.
 */
const { OVERVIEW } = await import(join(REPO, 'frontend/modules/procgenCore/setEditorCore.js'));
const { BUNDLE_KINDS } = await import(
    join(REPO, 'frontend/modules/presets/documentBundle.js'));
/** ⛓ EDITOR v3 E6b — the constant the SET arm's blank-room inputs are SEEDED
 *  from, read from the engine rather than typed, for `OVERVIEW`'s own reason. */
const { MAZE_DEFAULTS } = await import(join(REPO, 'frontend/modules/mazeRoom/procgenMaze.js'));
const LIBRARY_PATH = 'frontend/region-libraries/demo-maze-pack.json';
const MAZE_PACK = JSON.parse(readFileSync(join(REPO, LIBRARY_PATH), 'utf8'));
/** ⛓ The 4-link RING and the 2-link CHAIN, as OVERLAY documents. */
const RING_LINKS = [
    { from: [0, 'exit_1'], to: [1, 'exit_3'] },
    { from: [1, 'exit_1'], to: [2, 'exit_3'] },
    { from: [2, 'exit_1'], to: [3, 'exit_3'] },
    { from: [3, 'exit_1'], to: [0, 'exit_3'] },
];
const overlayOf = (n) => ({ schema_version: 1, rooms: {}, links: RING_LINKS.slice(0, n) });

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — THE WORLD, BUILT AT RUN TIME
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ **NO COMMITTED FIXTURE.** The parts are the chain test's own recipe — a
 * `buildLevelSet({link: true})` over two `emptyLevel` rooms and the first two
 * entries of the COMMITTED demo pack — and the bundle is zipped HERE with the
 * same `writeBundle` the page reads back with. A fixture would be a fourth copy
 * of two documents that already exist, and it would go stale the day either
 * derivation moves.
 */
const { writeBundle, readBundle } = await import(
    join(REPO, 'frontend/modules/presets/documentBundle.js'));
const { loadJSZipNode } = await import('./loadJSZipNode.mjs');
const { emptyWorld } = await import(join(REPO, 'frontend/modules/procgenCore/worldDocument.js'));
const { emptyMazeOverlay } = await import(
    join(REPO, 'frontend/modules/mazeRoom/mazeAtlasDerivation.js'));
const { emptyOverlay: emptySeedlingOverlay } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/seedlingSetOverlay.js'));
const { buildLevelSet } = await import(
    join(REPO, 'frontend/modules/seedlingDemo/levelSetExporter.js'));
const { emptyLevel } = await import(join(REPO, 'frontend/modules/seedlingDemo/procgenLevel.js'));

const { stampIdentity } = await import(
    join(REPO, 'frontend/modules/procgenCore/contentIdentity.js'));

const JSZIP = loadJSZipNode();
const WORLD_SET = buildLevelSet(
    [0, 1].map((level) => emptyLevel({ level })), { setId: 'w4-lab-world', link: true },
).set;
/**
 * ⛓⛓⛓ **THE TWO-ENTRY SLICE IS RE-STAMPED, AND THAT IS A FINDING THIS ROW MADE
 * BY RUNNING.**
 *
 * ⛔ A committed region library carries `provenance.content_hash` and a
 * `library_id` ENDING in it, and `validateRegionLibrary` checks the pair against
 * the content. **Slicing `entries` changes the content and NOT the stamp**, so
 * the first spelling of this fixture handed the page a library whose hash said
 * `3dd25239` over content hashing to `2ec3c9ef` — and the page REFUSED it by
 * name, naming the part: *"part "mz" is a REGION LIBRARY and
 * `validateRegionLibrary` refuses it … edited without --restamp?"*. That is the
 * intake doing exactly what it is for.
 *
 * ⚠ `seedlingDemo/worldChain.test.js` slices the same pack the same way and is
 * GREEN — because the node chain never runs `validateRegionLibrary` on it. The
 * PAGE does (each part goes through its OWN validator before the world binds
 * them), so a fixture that is fine in node is refused on the page. ⇒ re-stamped
 * through `contentIdentity.stampIdentity`, the ONE stamper both substrates use,
 * and the world's `doc_id` follows from the stamped id rather than being typed.
 * ⛔ The LEVEL SET needs none: `buildLevelSet` stamps what it builds.
 */
const WORLD_LIB = stampIdentity(
    {
        ...MAZE_PACK,
        entries: MAZE_PACK.entries.slice(0, 2),
        provenance: { ...(MAZE_PACK.provenance ?? {}) },
    },
    { idKey: 'library_id', defaultBase: 'demo-maze-pack' },
);
const worldDocOf = (mzDocId) => emptyWorld([
    {
        id: 'seed',
        kind: 'level-set',
        overlay: emptySeedlingOverlay(),
        substrate: 'flash_seedling',
        doc_id: WORLD_SET.set_id,
    },
    {
        id: 'mz',
        kind: 'region-library',
        /**
         * ⛓⛓ **THE MAZE PART BRINGS ITS OWN RING, IN ITS OWN OVERLAY.** ⛔ Not
         * a crossing: this is a door INSIDE one part, in that part's own array
         * form, and it is here so the NEGATIVE claim has the shape §21.8 says a
         * person actually produces — an ISLAND of two rooms that keep each
         * other's doors, not a single cut-off room the derivation would simply
         * DROP. ⛓ It rides inside the WORLD because a bundle carries one
         * `overlay.json` member and two overlays cannot both ride it, which is
         * itself a claim CLAIM 20 makes off `set.links`.
         */
        overlay: { ...emptyMazeOverlay(), links: [RING_LINKS[0]] },
        substrate: 'maze',
        doc_id: mzDocId,
    },
]);
const WORLD_DOC = worldDocOf(WORLD_LIB.library_id);
const MISMATCH_DOC = worldDocOf('somebody-elses-pack');
const bundleOf = (world) => writeBundle([
    { kind: 'world', doc: world },
    { kind: 'level-set', doc: WORLD_SET },
    { kind: 'region-library', doc: WORLD_LIB },
], { jszip: JSZIP });
const WORLD_ROUTE = '/__w4-world-bundle.zip';
const MISMATCH_ROUTE = '/__w4-world-mismatch.zip';
const WORLD_ZIPS = new Map([
    [WORLD_ROUTE, await bundleOf(WORLD_DOC)],
    [MISMATCH_ROUTE, await bundleOf(MISMATCH_DOC)],
]);

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
/** ⛓ EDITOR INTEGRATION W4 — the same walk, answering WHICH files rather than
 *  how many, so a second claim can be made about the same graph. */
function walkGraphFiles(entry) {
    const seen = new Set();
    const stack = [resolve(entry)];
    while (stack.length) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        let src;
        try { src = readFileSync(file, 'utf8'); } catch { continue; }
        const re = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            const spec = m[1] ?? m[2];
            if (spec.startsWith('.')) stack.push(resolve(dirname(file), spec));
        }
    }
    return [...seen];
}

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
/**
 * ⛓⛓⛓ EDITOR INTEGRATION W4 — **AND NOTHING UNDER `frontend/app/` EITHER.**
 * `lab.html`'s own docblock says *"a standalone static page — no frontend, no GL
 * panel, no eventBus"*, and W4 gave this page a reason to import
 * `procgenLabPanel/labRoomEditor.js` (a world strip opening a Seedling room
 * needs the room-editor contract). MEASURED at the time: importing that module
 * printed `[centralRegistry] CentralRegistry initialized`, because it imported
 * `app/core/eventBus.js` for one thing — the default `bus`. ⛔ The `node:`/BARE
 * row above CANNOT see that: an app edge is a perfectly ordinary relative
 * import. This is the row that can, and it is the reason the app registers its
 * bus with the contract instead of the contract importing the app.
 */
const appEdges = walkGraphFiles(join(REPO, 'frontend/modules/mazeRoom/mazeLabView.js'))
    .filter((f) => f.includes(`${sep}frontend${sep}app${sep}`));
check(appEdges.length === 0,
    '⛔⛔ ZERO modules under `frontend/app/` in the page\'s transitive import graph — a '
    + 'standalone page that reached the app would boot its CentralRegistry behind one import '
    + '(trap 829\'s family, one host over)',
    appEdges.map((f) => f.replace(REPO, '')).join(' | '));
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
/**
 * ⛓⛓ **ONE DELIBERATE 404, EXCLUDED BY NAME AND COUNTED** — the discipline
 * `check-preset-bundle-load` already follows. EDITOR v3 E2c's claim 17b asks the
 * page for a `?library=` the server has no file for, ON PURPOSE, to prove the
 * TRANSPORT refusal; Chromium reports that fetch as a console error, and it is
 * the page working. ⛔ Named rather than matched loosely, and the COUNT is
 * asserted at exactly one, because a bounded exclusion that does not say what it
 * excluded reads as "there was nothing to exclude".
 */
const NO_SUCH_LIBRARY = '__no-such-pack.json';
/** ⛓ EDITOR INTEGRATION W4 — the world row's own deliberate 404, enumerated the
 *  same way (OFF THE RESPONSES, by URL — the console text does not carry one). */
const NO_SUCH_WORLD = '__no-such-world.zip';
/**
 * ⛔ **THE URL IS NOT IN THE CONSOLE TEXT** — measured: Chromium's message is
 * bare *"Failed to load resource: the server responded with a status of 404
 * (Not Found)"*, so a filter keyed on the FILENAME matched nothing and the
 * exclusion counted ZERO while the error was right there. The 404 URLs are
 * enumerated off the RESPONSES instead, and the console's 404 reports are
 * excluded as a CLASS — which is only safe because the URL list is asserted.
 */
const notFound = [];
page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });
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

/**
 * ⛓⛓⛓ EDITOR v3 SLICE A2 — **A PAYLOAD WHOSE EDIT LIST CARRIES A `group`.**
 *
 * ⛔ The claim it exists for is the one A1's op shape could not yet make: a
 * STROKE, a PASTE or a FLOOD is ONE entry in the list, carrying its members,
 * and `?gen=` must reproduce it BYTE FOR BYTE. A build that flattened a group
 * on the way into the payload would reproduce the same LEVEL and a DIFFERENT
 * list, and `agreementWithPayload` compares the list.
 */
const GROUPED_ROUTE = '/__maze-grouped-payload.json';
const GROUPED_PAYLOAD = (() => {
    const base = generateStep({ seed: 3, step: 2 });
    const free = base.model.allCells(base.record)
        .filter((p) => base.model.isFree(base.record, p.tx, p.ty))
        .slice(0, 3);
    const stroke = {
        op: 'group',
        label: `stroke of ${free.length} cell(s)`,
        ops: free.map((p) => ({ op: 'setTile', x: p.tx, y: p.ty, tile: 'wall' })),
    };
    const out = applyEditOpToState(base, stroke);
    if (!out.result.ok) {
        throw new Error(`check-maze-lab: the grouped payload's own stroke was REFUSED — `
            + `${out.result.description}`);
    }
    return labPayload(out.state);
})();
// eslint-disable-next-line no-console
console.log(`node: the GROUPED payload carries ${GROUPED_PAYLOAD.edits.length} entry(ies), `
    + `the first a ${GROUPED_PAYLOAD.edits[0].op.op} of `
    + `${GROUPED_PAYLOAD.edits[0].op.ops.length}`);

const PAYLOAD_ROUTES = new Map([
    [SEAL_ROUTE, SEAL_PAYLOAD],
    [OPEN_SEAL_ROUTE, OPEN_SEAL_PAYLOAD],
    [EDITED_ROUTE, EDITED_PAYLOAD],
    [GROUPED_ROUTE, GROUPED_PAYLOAD],
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
 * ⛓⛓ EDITOR INTEGRATION W4 — the WORLD BUNDLES, on the same channel and for the
 * same reason. ⛔ `Buffer.from` because Playwright's `fulfill` wants bytes and
 * `writeBundle` answers a `Uint8Array`; the ZIP is the page's ONLY door for a
 * world, so serving one is what makes the claim reachable at all.
 */
await page.route(
    (u) => WORLD_ZIPS.has(u.pathname),
    (r) => r.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: Buffer.from(WORLD_ZIPS.get(new URL(r.request().url()).pathname)),
    }),
);

/**
 * ⛔ THE WAIT IS ON A CONDITION, NEVER ON EXISTENCE. `window.__mazeLab` is set
 * on the FIRST render — which for a `?run=1` load is the SKELETON, before the
 * ladder — so a poll for the object itself would read a mid-boot page and
 * report about a level the run had not reached (traps 246/258; the Seedling row
 * paid for exactly this once).
 */
const settled = (pred, why, arg = null) => page.waitForFunction(pred, arg, { timeout: 60000 })
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
        /**
         * ⛓⛓⛓ **THE RETIREMENT'S PAGE GATE — PROCGEN ELEMENTS arc 5, slice 5.**
         * ⚖ Ruling 4 retired `KEEP_POLICY.PREFER_DISCHARGE` on the maze at a
         * MEASURED zero (`census-maze-keeps.mjs`: 0 `solved-only` of 1944
         * directed attempts), so this row's sentence CHANGED — from *"this
         * family has NO verb to discharge"* to *"the keep policy was
         * first-SOLVED, so nothing asked"*. Those are different claims about
         * different questions, and the old regex admitted BOTH, so it would
         * have passed the retirement in silence.
         *
         * ⛔ IT NOW ASSERTS THE SURVIVING ONE AND REFUSES THE RETIRED ONES BY
         * NAME. `solved-only` on this page would mean a shortfall nobody looked
         * for; `NO verb to discharge` would mean the preference RAN and found
         * nothing to prefer. Neither is true any more, and a row that tolerated
         * either would be the gate that cannot see its own mover (trap 376).
         *
         * ⚠ AND THE md5 IDENTITIES CANNOT SEE THIS AT ALL: no committed maze
         * identity runs a directive, which slice 5's mutant (d) measured
         * directly (324 of 324 solved-only, every md5 byte-identical). This row
         * is one of the three things that DO gate the retirement.
         */
        check(/the keep policy was first-SOLVED/.test(dText)
            && !/solved-only/.test(dText) && !/NO verb to discharge/.test(dText),
            '⛔⛔ a KEPT row says the policy was FIRST-SOLVED and nothing asked about a verb '
            + '— ⚖ arc-5 ruling 4 retired `PREFER_DISCHARGE` on the maze, so `solved-only` '
            + 'and "NO verb to discharge" are both sentences about a question nobody puts',
            dText.trim());
        check(d.keptKind === null,
            '⛓ …and the RECORD agrees with the page — `keptKind` is null under FIRST_SOLVED, '
            + 'which is a VALUE beside the sentence rather than an echo of it',
            JSON.stringify({ keepPolicy: d.keepPolicy, keptKind: d.keptKind }));
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
    /**
     * ⛓⛓⛓ **CLAIM 15b — THE SCRUB, THE HUD AND THE INPUT STRIP (SLICE S1).**
     *
     * ⛔ EVERY NUMBER HERE IS DERIVED FROM THE READOUT OR THE DOM, never typed:
     * the slider's `max` is compared against `play.frames`, the strip's length
     * against the same, and the frame the HUD names against `frames[k]` — read
     * back through `__mazeLab.play`, which is the frame the OVERLAY was drawn
     * from (`shownFrame()`). A build whose HUD read a different frame from the
     * picture moves this readout too, which is the mutant this slice ran.
     */
    const scrubMax = await page.$eval('#labScrub', (n) => Number(n.max));
    check(scrubMax === frameN.play.frames - 1,
        '⛓⛓ the SCRUB\'s `max` IS the last frame index — the control describes the walk '
        + 'it scrubs, and a slider that could not reach the end would be a control that '
        + 'lies about what it can do',
        `max=${scrubMax}, frames=${frameN.play.frames}`);
    /**
     * ⛓ A MIDDLE FRAME, chosen from the frame COUNT rather than named: the
     * claim is that the slider ADDRESSES a frame, and frame 0 or the last one
     * would be reachable by the buttons that were already gated above.
     */
    const k = Math.floor((frameN.play.frames - 1) / 2);
    await page.$eval('#labScrub', (n, v) => {
        n.value = String(v);
        n.dispatchEvent(new Event('input', { bubbles: true }));
    }, k);
    await settled(`window.__mazeLab?.play?.index === ${k}`, 'the SCRUB to move the frame');
    const scrubbed = await read();
    const hudText = await page.textContent('#playNote');
    check(scrubbed.play.index === k
        && hudText.includes(`frame ${k}/${scrubbed.play.frames - 1}`)
        && hudText.includes(`player (${scrubbed.play.player.x},${scrubbed.play.player.y})`)
        && hudText.includes(`turn ${scrubbed.play.turn}`),
    '⛓⛓⛓ **SETTING THE SCRUB TO k MOVES THE FRAME AND THE HUD NAMES IT** — the index, '
        + 'the ENGINE turn and the player cell, all off the ONE frame the picture was '
        + 'drawn from',
    `k=${k} | ${hudText.trim().slice(0, 120)}`);
    check(scrubbed.play.author === 'oracle' && hudText.includes(`input: ${scrubbed.play.input}`),
        '⛓⛓ …and the HUD names the ENTRY that produced that frame, which the readout '
        + 'publishes as the same string — one walk, one author, said once',
        `author=${scrubbed.play.author}, input=${json(scrubbed.play.input)}`);
    const stripCells = await page.$$eval('#labInputStrip .in',
        (ns) => ns.map((n) => ({ text: n.textContent, lit: n.classList.contains('lit') })));
    check(stripCells.length === scrubbed.play.frames - 1,
        '⛓⛓ the INPUT STRIP has one cell per TURN of the walk — `frames − 1`, derived '
        + 'from the readout and not from the plan the page could have counted twice',
        `${stripCells.length} cell(s), ${scrubbed.play.frames} frame(s)`);
    check(stripCells.filter((c) => c.lit).length === 1 && stripCells[k - 1]?.lit === true,
        '⛓⛓⛓ **EXACTLY ONE CELL IS LIT, AND IT IS THE ONE THAT PRODUCED THE FRAME ON '
        + 'SCREEN** — cell k−1 for frame k, because the start is not an input',
        `lit at ${stripCells.findIndex((c) => c.lit)}, expected ${k - 1}`);
    /** ⛓ …and clicking a letter SEEKS to the frame it produced. */
    await page.click('#labInputStrip .in:nth-child(1)');
    await settled(() => window.__mazeLab?.play?.index === 1,
        'a click on the FIRST strip cell to seek to frame 1');
    const clicked = await read();
    check(clicked.play.index === 1 && json(clicked.play.player) !== json(frame0.play.player),
        '⛓ clicking the first letter SEEKS to the frame it produced — frame 1, and the '
        + 'player is no longer where the start left them',
        `index=${clicked.play.index}, ${json(frame0.play.player)} → ${json(clicked.play.player)}`);
    /** ⛓ AND FRAME 0 LIGHTS NOTHING — the start is not something somebody pressed. */
    await page.click('#labPlayReset');
    await settled(() => window.__mazeLab?.play?.index === 0, 'the replay to rewind');
    const litAtZero = await page.$$eval('#labInputStrip .in.lit', (ns) => ns.length);
    check(litAtZero === 0,
        '⛓⛓ …and at frame 0 NO cell is lit — the start is not an input, and a strip that '
        + 'lit one anyway would name a press that never happened',
        `${litAtZero} lit`);
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

    /* ── CLAIM 14: THE TOOLS (EDITOR v3 SLICE A2) ───────────────────── */
    /**
     * ⛓⛓⛓ **THE CANVAS TOOL IS `procgenCore/editorView`'s NOW**, and this claim
     * is what says the four gestures A1 proved as pure functions are reachable
     * with a mouse. ⛔ Every cell is computed HERE from the canvas rectangle and
     * the level's own tiles — the page's geometry is never asked (claim 5's
     * law), and the subject cells are chosen because they are FREE, so a
     * refusal cannot make a row pass for the wrong reason.
     */
    const TOOL_ROOM = { width: 9, height: 9 };
    const toolsWeb = await load(`seed=7&width=${TOOL_ROOM.width}`
        + `&height=${TOOL_ROOM.height}&count=0&source=edit`,
    () => window.__mazeLab?.source === 'edit', 'the EDIT arm for the tool claims');
    const TW = TOOL_ROOM.width;
    const TH = TOOL_ROOM.height;
    check(toolsWeb.editTool === 'brush' && toolsWeb.editClip === null,
        '⛓ the EDIT arm opens with the BRUSH armed and an empty clipboard',
        `${json(toolsWeb.editTool)} / ${json(toolsWeb.editClip)}`);
    /**
     * ⛓⛓ THE TOOL BUTTONS ARE A VIEW OF `editorView`'s COMMAND TABLE — the
     * order and the ids are the table's, so a build that bound a key in a
     * `switch` beside the table would show a button the keyboard cannot reach.
     */
    const toolIds = await page.$$eval('#labTools button', (bs) => bs.map((b) => b.dataset.tool));
    check(json(toolIds) === json(['brush', 'rect', 'paste', 'flood', 'escape']),
        '⛓ the TOOL box holds exactly the view\'s own command rows, in its order', json(toolIds));
    /**
     * ⛔⛔ **AND THEY ARE NOT IN THE PALETTE BOX.** The browser row above
     * ENUMERATES `#labPalette` (one button per `PALETTE_ENTRIES` row), and the
     * group-B lesson is that a knob dropped into an enumerated container counts
     * as a member and reds three claims at once.
     */
    const paletteCount = await page.$$eval('#labPalette button', (bs) => bs.length);
    check(paletteCount === 9,
        '⛔ …and `#labPalette` still enumerates exactly the nine palette entries',
        String(paletteCount));

    /* ⛓ THE SUBJECT CELLS, computed from the level's own tiles. */
    const tBusy = new Set([
        `${toolsWeb.level.entrance.x},${toolsWeb.level.entrance.y}`,
        ...toolsWeb.level.exits.map((e) => `${e.x},${e.y}`),
        ...(toolsWeb.level.items ?? []).map((i) => `${i.x},${i.y}`),
        ...(toolsWeb.level.obstacles ?? []).map((o) => `${o.x},${o.y}`),
        ...(toolsWeb.level.blocks ?? []).map((b) => `${b.x},${b.y}`),
        ...(toolsWeb.level.buttons ?? []).map((b) => `${b.x},${b.y}`),
    ]);
    const tFree = (tx, ty) => tx >= 0 && ty >= 0 && tx < TW && ty < TH
        && toolsWeb.level.tiles[ty * TW + tx] === 0 && !tBusy.has(`${tx},${ty}`);
    /** ⛓ A horizontal RUN of three free cells, and a free 2x2 plus its free
     *  DIAGONAL neighbour — searched for rather than assumed, so the claim dies
     *  with a sentence rather than with a wrong cell if the room changes. */
    let RUN = null;
    let SQ = null;
    for (let ty = 0; ty < TH; ty += 1) {
        for (let tx = 0; tx < TW; tx += 1) {
            if (!RUN && [0, 1, 2].every((d) => tFree(tx + d, ty))) {
                RUN = [0, 1, 2].map((d) => ({ tx: tx + d, ty }));
            }
            if (!SQ && ty > RUN?.[0]?.ty + 1
                && [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2]].every(([dx, dy]) => tFree(tx + dx, ty + dy))) {
                SQ = { x: tx, y: ty };
            }
        }
    }
    if (!RUN || !SQ) {
        throw new Error('check-maze-lab: the 9x9 skeleton has no run of three free cells, or no '
            + 'free 2x2 with a free diagonal neighbour — the tool claims have no subject.');
    }
    const tRect = () => page.$eval('#canvas', (c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    /** ⛓ THE RECTANGLE IS RE-READ BEFORE EVERY POINT (claim 5's measured
     *  lesson: the identity line above the canvas GROWS as edits accumulate,
     *  so a cached rectangle puts the next press a row too high). */
    const tPoint = async (tx, ty) => {
        await page.$eval('#canvas', (c) => c.scrollIntoView({ block: 'center' }));
        const b = await tRect();
        return {
            x: b.x + Math.floor(((tx + 0.5) * b.w) / TW),
            y: b.y + Math.floor(((ty + 0.5) * b.h) / TH),
        };
    };
    const tClick = async (tx, ty) => {
        const p = await tPoint(tx, ty);
        await page.mouse.click(p.x, p.y);
    };
    const tileAt = (lvl, tx, ty) => lvl.tiles[ty * TW + tx];

    /**
     * ⛓⛓⛓ **A DRAG ACROSS THREE CELLS IS ONE EDIT.**
     *
     * ⛔ THE COUNT IS THE CLAIM, not the picture: a build that applied the
     * stroke's cells one at a time paints exactly the same three walls, so the
     * LEVEL cannot tell the two apart. `editOps` (the op list as the page holds
     * it) and the ONE undo below are what can (⚠ trap 586).
     */
    await page.click('#labPalette button[data-type="wall"]');
    const strokePts = [];
    for (const c of RUN) strokePts.push(await tPoint(c.tx, c.ty));
    await page.mouse.move(strokePts[0].x, strokePts[0].y);
    await page.mouse.down();
    for (const p of strokePts.slice(1)) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
    /**
     * ⛔⛔ **THE WAIT IS `>= 1`, AND THE COUNT IS ASSERTED BELOW.** Measured: a
     * wait for `=== 1` DOES go red under the mutant (which reports 3), but it
     * reports it as a 60 s STUCK — a timeout naming the wait rather than the
     * claim. A wait a wrong build OVERSHOOTS turns a value finding into a
     * scheduling-shaped one, and the harness's own vocabulary (STUCK vs
     * CHECK-BOUND) exists to keep those apart. The wait now only says *an edit
     * landed*; the count is a check.
     */
    await settled(() => window.__mazeLab?.edits >= 1, 'the stroke to land');
    const stroked = await read();
    check(RUN.every((c) => tileAt(stroked.level, c.tx, c.ty) === 1),
        `⛓ a DRAG painted all three cells of the run at y=${RUN[0].ty}`,
        RUN.map((c) => tileAt(stroked.level, c.tx, c.ty)).join(','));
    check(stroked.edits === 1 && stroked.editOps[0].op === 'group'
        && stroked.editOps[0].members === 3,
    '⛓⛓⛓ **…as ONE edit — a `group` of 3** — a build that applied the cells one at a time '
        + 'paints the same three walls and reports THREE edits here',
    json(stroked.editOps));
    check(stroked.editNote === '1 edit(s) (1 group of 3)',
        '⛓ …and the note says so, through `editCore.describeOps` — the count is of UNDOS',
        stroked.editNote);
    check(stroked.identity.includes('1 manual edit(s) (1 group of 3)'),
        '⛓ …and the identity line names the group\'s size in the same words',
        stroked.identity.slice(0, 150));

    /**
     * ⛓⛓⛓ **Ctrl+Z UNDOES, AND ONE UNDO TAKES THE WHOLE STROKE BACK.** ⚖ Law
     * (a): undo is the FOLD over a shorter list, so all three cells return
     * together.
     */
    await page.keyboard.press('Control+z');
    await settled(() => window.__mazeLab?.edits === 0, 'Ctrl+Z to undo the stroke');
    const undone = await read();
    check(RUN.every((c) => tileAt(undone.level, c.tx, c.ty) === 0),
        '⛓⛓ **Ctrl+Z undid the WHOLE stroke** — one undo, three cells back to floor',
        RUN.map((c) => tileAt(undone.level, c.tx, c.ty)).join(','));
    check(undone.editNote === '0 edit(s)' && undone.certified === null,
        '⛓ …and the note is empty again, the level still UNCERTIFIED',
        `${undone.editNote} / ${json(undone.certified)}`);

    /**
     * ⛓⛓⛓ **RECT COPY → PASTE reproduces the cells.** The source 2x2 is
     * painted first so it differs from the destination — a copy of untouched
     * floor onto untouched floor is a NO-OP the fold drops, and the row would
     * pass over a paste that did nothing (⚖ law (b)).
     */
    await tClick(SQ.x, SQ.y);
    await settled(() => window.__mazeLab?.edits === 1, 'the first wall of the source square');
    await tClick(SQ.x + 1, SQ.y);
    await settled(() => window.__mazeLab?.edits === 2, 'the second wall of the source square');
    await tClick(SQ.x + 1, SQ.y + 1);
    await settled(() => window.__mazeLab?.edits === 3, 'the third wall of the source square');
    /**
     * ⛓ THE SQUARE IS DELIBERATELY **MIXED** — three walls and one floor. A
     * uniform clip cannot tell "reproduced the clip" from "wrote the same tile
     * everywhere", which is §9.3's lesson about a subject that distinguishes
     * nothing, one layer up.
     */
    await page.click('#labTools button[data-tool="rect"]');
    await tClick(SQ.x, SQ.y);
    await tClick(SQ.x + 1, SQ.y + 1);
    await settled(() => window.__mazeLab?.editClip?.w === 2, 'the 2x2 clip');
    const copied = await read();
    check(json(copied.editClip) === json({ w: 2, h: 2 }),
        '⛓ RECT of two opposite corners makes a 2x2 clip', json(copied.editClip));
    check(copied.edits === 3, '⛔ …and a COPY is not an edit — the op list did not grow',
        String(copied.edits));
    await page.click('#labTools button[data-tool="paste"]');
    await tClick(RUN[0].tx, RUN[0].ty);
    await settled(() => window.__mazeLab?.edits === 4, 'the paste to land as ONE edit');
    const pasted = await read();
    check(pasted.editOps[3].op === 'group',
        '⛓⛓ a PASTE is ONE edit — a `group` carrying the cells it wrote',
        json(pasted.editOps[3]));
    /** ⛓⛓ THE VALUE CLAIM — the destination now HOLDS the source's pattern,
     *  read off the serialized level cell by cell rather than off a count. */
    const pattern = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => [
        tileAt(pasted.level, SQ.x + dx, SQ.y + dy),
        tileAt(pasted.level, RUN[0].tx + dx, RUN[0].ty + dy),
    ]);
    check(pattern.every(([a, b]) => a === b)
        && pattern.some(([a]) => a === 1) && pattern.some(([a]) => a === 0),
    '⛓⛓⛓ **THE PASTE REPRODUCED THE CLIP, CELL FOR CELL** — and the clip is MIXED (three '
        + 'walls and a floor), so a build that wrote one tile everywhere cannot pass it',
    json(pattern));

    /**
     * ⛓⛓⛓ **FLOOD PAINTS EXACTLY ITS COMPONENT — the DIAGONAL neighbour is a
     * DIFFERENT component.** ⚖ 4-connectivity, and `editCore.floodOps` walks
     * `gridFlood.reachableFrom` rather than a private BFS.
     */
    /**
     * ⛔⛔ **THE TOOL IS RE-ARMED, AND THAT IS A MEASUREMENT.** Picking a
     * PALETTE entry does not change the armed TOOL — they are two questions —
     * so the two presses below ran as PASTES the first time this row was
     * written, dropping the clip twice more and growing the wall component from
     * four cells to eight. The flood then reported 8 and the diagonal was
     * swallowed. ⚠ The failure looked like a connectivity defect and was a
     * page-driving one; the *label* on the group (`flood (0,2) — 8 cell(s)`)
     * is what told them apart.
     */
    await page.click('#labTools button[data-tool="brush"]');
    await page.click('#labPalette button[data-type="wall"]');
    await tClick(SQ.x, SQ.y + 1);
    await settled(() => window.__mazeLab?.edits === 5, 'the fourth wall, closing the square');
    await tClick(SQ.x + 2, SQ.y + 2);
    await settled(() => window.__mazeLab?.edits === 6, 'the lone DIAGONAL wall');
    const preFlood = await read();
    check(tileAt(preFlood.level, SQ.x + 2, SQ.y + 2) === 1
        && [[0, 0], [1, 0], [0, 1], [1, 1]]
            .every(([dx, dy]) => tileAt(preFlood.level, SQ.x + dx, SQ.y + dy) === 1),
    `⛓ the subject is a 2x2 wall square at (${SQ.x},${SQ.y}) with a lone wall at its DIAGONAL `
        + `corner (${SQ.x + 2},${SQ.y + 2})`,
    json([[0, 0], [1, 0], [0, 1], [1, 1], [2, 2]]
        .map(([dx, dy]) => tileAt(preFlood.level, SQ.x + dx, SQ.y + dy))));
    await page.click('#labPalette button[data-type="floor"]');
    await page.click('#labTools button[data-tool="flood"]');
    await tClick(SQ.x, SQ.y);
    await settled(() => window.__mazeLab?.edits === 7, 'the flood to land as ONE edit');
    const flooded = await read();
    check(flooded.editOps[6].op === 'group' && flooded.editOps[6].members === 4,
        '⛓⛓ a FLOOD is ONE edit — a `group` of exactly the FOUR cells of the component',
        json(flooded.editOps[6]));
    check([[0, 0], [1, 0], [0, 1], [1, 1]]
        .every(([dx, dy]) => tileAt(flooded.level, SQ.x + dx, SQ.y + dy) === 0),
    '⛓ …the whole 2x2 component is floor again');
    check(tileAt(flooded.level, SQ.x + 2, SQ.y + 2) === 1,
        '⛔⛔ **…and the DIAGONAL neighbour is UNTOUCHED** — a diagonal-only neighbour is a '
        + 'DIFFERENT component, because neither substrate lets a mover cross a corner',
        String(tileAt(flooded.level, SQ.x + 2, SQ.y + 2)));

    /**
     * ⛓⛓⛓ **§9.4's BOUND IS PRINTED BEFORE THE PASTE LANDS.** A clip carrying
     * the ENTRANCE is a clip whose paste MOVES the level's only one, and the
     * page must SAY so — never silently.
     */
    await page.click('#labTools button[data-tool="rect"]');
    await tClick(toolsWeb.level.entrance.x, toolsWeb.level.entrance.y);
    await tClick(toolsWeb.level.entrance.x, toolsWeb.level.entrance.y);
    await settled(() => window.__mazeLab?.editClip?.w === 1, 'the 1x1 entrance clip');
    const clipText = await page.textContent('#clipNote');
    check(/ENTRANCE/.test(clipText) && /SINGLETON/.test(clipText),
        '⛓⛓⛓ **A CLIP CARRYING THE ENTRANCE NAMES THE BOUND** (§9.4 bound 2) — on the page, '
        + 'before anything is pasted', clipText.trim());
    const clipStatus = await page.textContent('#status');
    check(/ENTRANCE/.test(clipStatus),
        '⛔ …and in the status line too, which is where a reader is already looking',
        clipStatus.trim());

    /**
     * ⛓⛓⛓ **CLAIM 7, EXTENDED: AN EDITED PAYLOAD WHOSE LIST CARRIES A `group`
     * IS REPRODUCED BYTE FOR BYTE.** ⛔ A build that flattened the group on the
     * way into the payload reproduces the same LEVEL and a different LIST, and
     * `agreementWithPayload` compares the list — which is what this row reads.
     */
    const genGrouped = await load(`gen=${GROUPED_ROUTE}`,
        () => window.__mazeLab?.payloadCheck, 'the GROUPED payload to be reproduced');
    check(genGrouped.payloadCheck.checked === true && genGrouped.payloadCheck.agrees === true,
        '⛓⛓⛓ **A PAYLOAD CARRYING A `group` IS REPRODUCED BYTE FOR BYTE** — level, trace AND '
        + 'the edit list',
        json(genGrouped.payloadCheck.differences ?? genGrouped.payloadCheck.why));
    check(json(genGrouped.level) === json(GROUPED_PAYLOAD.level)
        && genGrouped.edits === 1 && genGrouped.editOps[0].members === 3,
    '⛓ …and it came back as ONE entry of three members, not as three edits',
    `${genGrouped.edits} edit(s), ${json(genGrouped.editOps)}`);
    check(json(genGrouped.payload.base) === json(GROUPED_PAYLOAD.base)
        && genGrouped.payload.base.kind === 'maze-lab',
    '⛓⛓ …and the payload carries the IDENTITY TAG the edits are edits OF (§3.2\'s `base`)',
    json(genGrouped.payload.base));

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ EDITOR v3 E2c — THE SET ARM (claims 17–20)
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ The claim numbers are the next FREE integers. The banners in this file
     * are NOT uniquely numbered (`CLAIM 14` appears twice and `CLAIM 13` comes
     * last), and renumbering them would be byte-noise under `lintGateLabels`'
     * `file::rule::label` key — so nothing above is touched.
     */

    /** ⛓ Click room `i` on the SET strip, with this file's OWN arithmetic over
     *  the strip's own room count — never `cellAt`'s. */
    const clickStripRoom = async (i) => {
        const geo = await page.evaluate(() => {
            const c = document.getElementById('editSetOverview');
            c.scrollIntoView({ block: 'center' });
            const r = c.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height,
                rooms: window.__mazeLab?.set?.rooms ?? 1 };
        });
        await page.mouse.click(geo.left + (geo.width / geo.rooms) * (i + 0.5),
            geo.top + geo.height * 0.75);
    };
    /** ⛓ The strip's ink, and the OVERLAY canvas `editorView` appends to the
     *  strip's PARENT and sizes FROM the strip (§23.11 #5 cost two runs there). */
    const stripInk = () => page.evaluate((roomTop) => {
        const c = document.getElementById('editSetOverview');
        if (!c) return null;
        const ov = c.parentNode?.querySelector('canvas.editorViewOverlay') ?? null;
        const band = (cv) => Math.max(1, Math.floor(cv.height * roomTop));
        const ink = (cv) => {
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, band(cv)).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n += 1;
            return n;
        };
        const full = (cv) => {
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n += 1;
            return n;
        };
        return { w: c.width, h: c.height, stripInk: full(c), bandInk: ink(c),
            ovW: ov?.width ?? null, ovH: ov?.height ?? null, ovInk: ov ? ink(ov) : null };
    }, OVERVIEW.roomTop);
    /**
     * ⛓⛓ **ONE STRIP CELL'S PIXELS, HASHED.** ⛔ A COUNT of ink cannot see a
     * floor turning into a wall — both are opaque — so the claim that a still
     * was RE-DRAWN needs the pixels themselves. This is what catches the stills
     * cache keyed on the room INDEX rather than on the payload: an edited room
     * would keep its old picture and every other readout would still be right.
     */
    const stripCellHash = (i) => page.evaluate(({ idx, roomTop }) => {
        const c = document.getElementById('editSetOverview');
        const rooms = window.__mazeLab?.set?.rooms ?? 1;
        const cell = Math.floor(c.width / rooms);
        const top = Math.floor(c.height * roomTop);
        const d = c.getContext('2d')
            .getImageData(idx * cell, top, cell, c.height - top).data;
        let h = 2166136261;
        for (let k = 0; k < d.length; k += 1) {
            h ^= d[k];
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }, { idx: i, roomTop: OVERVIEW.roomTop });

    /**
     * ⛓⛓⛓ **THE ROOMS TABLE, OFF THE DOM — AND SINCE E3a IT IS THE CROSS-CHECK
     * RATHER THAN THE ONLY ACCOUNT.**
     *
     * E2c measured the seam here: the mount called `onSetChange` **before** its
     * own `render()`, so anything the page derived from `setUi.rows()` was ONE
     * APPLIED OP BEHIND — after the two-click gesture `set.links` was 1 (off
     * the SESSION's record, live) while a `set.strip` field said
     * `linkedFrom: [0,0,0,0]`. The page therefore published no `strip`, `note`
     * or `identity` at all. ⛓ E3a gave the mount ONE ordering rule (render
     * first, then `onSetChange({why})`), the four fields came back, and what
     * these DOM reads now assert is that the READOUT AND THE BOX AGREE — which
     * is the claim, and which the mutant (the notification put back in front of
     * the render) breaks. Columns: `# · name · music · exits · links here ·
     * loc · rules · (actions)`.
     */
    const roomsTable = () => page.evaluate(() => [
        ...document.querySelectorAll('#editSetRooms table.setRooms tr'),
    ].slice(1).map((r) => [...r.children].map((c) => c.textContent)));

    /**
     * ⛓⛓ **THE REPORT, OFF THE DOM *AND* OFF THE READOUT — E3a CLOSED THE SEAM
     * THAT MADE ONE OF THEM IMPOSSIBLE.**
     *
     * E2c: `mountSetEditor`'s REPORT button ran `runReport()` and the MOUNT's
     * own render and did NOT call `onSetChange`, so a page could not learn a
     * report had happened; `window.__mazeLab.set.report` would have carried the
     * verdict as of the LAST PAGE RENDER while the box on screen showed the
     * current one. E3a's ordering rule fires `onSetChange({why: 'report'})`
     * AFTER that render, so the field exists — and this probe reads BOTH, so
     * the claim is that they agree.
     */
    const reportOf = () => page.evaluate(() => ({
        rows: [...document.querySelectorAll('#editSetReportOut li')].map((l) => l.textContent),
        note: document.getElementById('editSetReportNote')?.textContent ?? '',
        rulesDisabled: document.getElementById('editDownloadRules')?.disabled ?? null,
        /** ⛓ THE `bad` ROWS ARE THE ERRORS — the class `runReport` gives a row
         *  whose severity is `error`, which is what the readout's count counts. */
        errorRows: [...document.querySelectorAll('#editSetReportOut li.bad')].length,
        readout: window.__mazeLab?.set?.report ?? null,
    }));
    /**
     * ⛓⛓⛓ **A DOWNLOAD PRESS, WAITED FOR BY ITS OWN COUNTER** (EDITOR v3 E6b,
     * curing §34.7 #1). The mount nulls a download's readout family and bumps
     * `__editorSet<Family>Presses` BEFORE its first guard, so the wait is on a
     * value that CHANGES rather than on a key that merely exists.
     *
     * ⛔⛔ **AND THAT MADE ONE WAIT HERE FALSE.** `settled(() =>
     * window.__editorSetRulesBytes !== undefined)` was true the instant the
     * handler nulled it — `null !== undefined` — so the row would have read the
     * PREVIOUS press's bytes, which is §34.7 #1's own defect wearing a
     * different coat. The counter cannot be satisfied by anything but THIS
     * press.
     */
    const pressDownload = async (button, counter, { settleOn = null } = {}) => {
        const before = await page.evaluate((k) => globalThis[k] ?? 0, counter);
        await page.click(button);
        await settled(({ k, n, on }) => globalThis[k] === n + 1
            && (on === null || globalThis[on] !== null),
        `the ${button} press to answer (press ${before + 1})`,
        { k: counter, n: before, on: settleOn });
        return before + 1;
    };

    /** ⛓ PASTE a document into the SET arm's OWN box — never `#labText`, which
     *  `refreshSaveBox` overwrites with the LEVEL payload on every render. */
    const pasteSet = async (doc, pred, why) => {
        await page.fill('#labSetText', json(doc));
        await page.click('#labSetLoad');
        await settled(pred, why);
        return read();
    };

    /* ── CLAIM 17: `?source=set` opens the FOURTH arm and nothing else ─ */
    const setUrl = `source=set&library=/${LIBRARY_PATH}`;
    const armed = await load(setUrl, () => window.__mazeLab?.set?.mounted === true,
        'the SET arm to mount over the served maze pack');
    check(armed.source === 'set' && armed.set.library_id === MAZE_PACK.library_id
        && armed.set.rooms === MAZE_PACK.entries.length,
        '⛓⛓⛓ **CLAIM 17 — `?source=set` OPENS THE FOURTH ARM** over the library `?library=` '
        + 'names, and the readout is the SESSION\'s record rather than the loaded document',
        `${armed.set.library_id} · ${armed.set.rooms} room(s) · source ${armed.set.source}`);
    const panels = await page.evaluate(() => ({
        generate: document.getElementById('generatePanel').hidden,
        edit: document.getElementById('editPanel').hidden,
        solve: document.getElementById('solvePanel').hidden,
        set: document.getElementById('setPanel').hidden,
        canvas: document.getElementById('canvas').hidden,
    }));
    check(panels.set === false && panels.generate && panels.edit && panels.solve
        && panels.canvas === true,
        '⛓ …and NOTHING ELSE: the other three panels are hidden, and `#canvas` is hidden too '
        + 'because in this arm it belongs to the OPEN ROOM and none is open — the level the '
        + 'other three arms hold is not this library\'s',
        json(panels));
    await settled(() => (window.__mazeLab?.set?.servedOffered ?? []).length > 0,
        'the served library index to arrive');
    const withIndex = await read();
    check(json(withIndex.set.servedOffered) === json([MAZE_PACK.library_id]),
        '⛓⛓ …and the SERVED PICKER offers ONLY the packs whose own `substrates` include '
        + '`maze` — the bounce and runner packs are committed beside it and are NOT offered '
        + '(the claim is the FILTER, not a count). ⚠ WAITED FOR, not read off the mount: the '
        + 'index is fetched when the arm mounts and only for the SET arm, so a read at '
        + '`mounted === true` sees an empty picker and a page that never fetched one looks the '
        + 'same', json(withIndex.set.servedOffered));
    check(armed.set.schemas.rules === true && armed.set.schemas.atlas === true,
        '⛓ …and both optional schemas arrived, so the rule box checks the SCHEMA and the '
        + 'REPORT runs its STRUCTURAL pass', json(armed.set.schemas));

    /* ── CLAIM 17b: the REFUSALS this arm owns ────────────────────────── */
    await page.goto(`${PAGE}?source=sets`, { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of a near-miss ?source=');
    const nearMiss = await read();
    /**
     * ⛓⛓⛓ **THE LIST IS DERIVED FROM `SOURCES`, NOT TYPED.** It WAS the literal
     * `[generate, edit, solve, set]`, and slice S2b's fifth arm RED this row —
     * which is the gate working: a page that grew an arm the refusal did not
     * name would let a typo fall through to one nobody asked for. ⛔ The row now
     * reads the page's own enum (this file already imports the module), so the
     * SIXTH arm costs it nothing and a MISSING one still reds.
     */
    const armList = `[${Object.values(SOURCES).join(', ')}]`;
    check(nearMiss.fatal?.includes(armList) === true,
        `⛓⛓ **CLAIM 17b — A NEAR-MISS \`?source=\` STILL REFUSES, NAMING ALL `
        + `${Object.values(SOURCES).length}.** Every arm JOINED the enum; a page that reached `
        + 'one around the check would open it and let `sets` fall through to GENERATE',
        `${nearMiss.fatal} (expected ${armList})`);
    await page.goto(`${PAGE}?source=set&library=/frontend/region-libraries/__no-such-pack.json`,
        { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of a bad ?library=');
    const badLib = await read();
    check(/\?library=/.test(badLib.fatal ?? '') && /HTTP 404/.test(badLib.fatal ?? '')
        && /REFUSED rather than opened on nothing/.test(badLib.fatal ?? ''),
        '⛓⛓ …and a `?library=` the server has no file for is FATAL BY NAME — a TRANSPORT '
        + 'failure, exactly as `?gen=`\'s is: the address named a document and an arm opened '
        + 'on nothing would be a page saying something the link does not', badLib.fatal);

    /* ── CLAIM 18: the STRIP is laid out, has INK, and grows arrows ──── */
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm again');
    const geo = await stripInk();
    const cellPx = geo === null ? null : geo.w / MAZE_PACK.entries.length;
    check(cellPx === OVERVIEW.cellPx && geo.h === OVERVIEW.heightPx && geo.stripInk > 0,
        `⛓⛓⛓ **CLAIM 18 — THE STRIP IS LAID OUT AND IT HAS INK.** ${MAZE_PACK.entries.length} `
        + `rooms at \`OVERVIEW.cellPx\` (${OVERVIEW.cellPx}) px each. ⛔ ASSERT INK, NOT `
        + 'ELEMENTS (§23.11 #5) — and assert the WIDTH too: this slice\'s first browser run '
        + `found the strip at ${OVERVIEW.minCellPx} px per room WITH ink in it, because `
        + '`overviewLayout` had measured a parent that was still `hidden` and therefore had '
        + 'no layout. A row asserting only INK is green over both builds', json(geo));
    check(cellPx >= OVERVIEW.minStillPx,
        `⛓ …and at ${cellPx} px per room the cells are STILLS rather than labelled boxes `
        + `(\`OVERVIEW.minStillPx\` is ${OVERVIEW.minStillPx}), which is what makes the ink `
        + 'above a picture of four rooms and not four rectangles');
    const table = await roomsTable();
    const openable = await page.evaluate((n) => Array.from({ length: n }, (_, i) => {
        const b = document.getElementById(`editSetRowOpen_${i}`);
        return b ? !b.disabled : null;
    }), MAZE_PACK.entries.length);
    check(json(table.map((r) => r[1])) === json(MAZE_PACK.entries.map((e) => e.name))
        && table.every((r) => r[3] === '4') && openable.every((v) => v === true),
        '⛓ …and the rooms TABLE is the library\'s own entries, each with its four exits and an '
        + 'enabled OPEN button', json(table.map((r) => `${r[1]}:${r[3]}`)));
    /**
     * ⛓⛓⛓ **THE `⛔embed` BADGE, AND THE PAINTER'S OWN ANSWER FOR IT**
     * (EDITOR v3 E6b). E2b shipped this badge under all FOUR maze rooms — the
     * condition read an UNDECLARED `xml` and `typeof <undeclared>` is
     * `'undefined'` (trap 722) — and E3a fixed it and then MEASURED that this
     * gate could not see either build: `stripInk` read 33,504 in both, because
     * the glyph is drawn over a room box `paintStrip` has already filled
     * opaque. So the fix had NO browser witness on this substrate at all.
     *
     * ⛔⛔ **AND A BAND PROBE IS NOT THE ANSWER HERE.** Four rooms get
     * `OVERVIEW.cellPx` (96) each, which is at or above `minStillPx` (40), so
     * every cell carries a STILL: a pixel difference over the badge's y-band
     * would be counting the picture. (The `-arm` CAN use one — 116 rooms at 18
     * px draw labelled boxes and no stills — and it does.) ⇒ the witness here
     * is `strip.badges`, which `paintStrip` writes as it draws.
     *
     * ⛔ THE LENGTH IS THE POSITIVE CONTROL, and it is not decoration: `[]` is
     * what a strip that painted NOTHING answers, and a row asserting only
     * *"no badges"* would be green over it (`setEditorView.test.js:918-921`).
     * The strip's INK is asserted two rows up, and the length here ties the
     * readout to the same four cells that ink came from.
     * ⛓ MUTANT: trap 722's condition restored — this row reds with four `true`s
     * while `stripInk` does not move by one pixel.
     */
    const mazeBadges = await page.evaluate(() => window.__mazeLab?.set?.strip?.badges ?? null);
    check(Array.isArray(mazeBadges) && mazeBadges.length === MAZE_PACK.entries.length
        && mazeBadges.every((b) => b === false),
        `⛓⛓⛓ **NO ROOM CARRIES THE \`⛔embed\` BADGE**, and the strip says so for all `
        + `${MAZE_PACK.entries.length} of the cells it just drew. A region-library entry `
        + 'carries its captured world INLINE, so `mazeSetBindings.sourceKind` answers '
        + '`record` for every one — SAID by the painter rather than left as a silence',
        `${json(mazeBadges)} over ${geo.stripInk} ink`);
    /**
     * ⛓⛓ **EDITOR v3 E3a — `set.selected` TRACKS A ROOM PICK, AND BEFORE THIS
     * SLICE IT DID NOT.** `selectRoom` re-rendered the MOUNT and told the page
     * nothing, so the field sat on whatever value the last APPLIED OP had left
     * it at. ⛔ The notification is GUARDED on an actual move — a re-click on
     * the room already selected changes nothing a page could publish, and an
     * unguarded one would also fire from the mount's own closing
     * `selectRoom(0)`, into a page whose `setUi` handle is still `null`.
     * ⛓ MUTANT: drop `why: 'select'` — this row reads 0 where the table's
     * highlighted row says 2.
     */
    const startSel = await read();
    await page.evaluate(() => {
        const rows = [...document.querySelectorAll('#editSetRooms table.setRooms tr')].slice(1);
        rows.find((r) => r.children[0]?.textContent === '2')?.click();
    });
    await settled(() => window.__mazeLab?.set?.selected === 2, 'the rooms-row click to SELECT');
    const picked = await read();
    const selRow = await page.evaluate(() => [
        ...document.querySelectorAll('#editSetRooms table.setRooms tr.sel'),
    ].map((r) => r.children[0]?.textContent));
    check(startSel.set.selected === 0 && picked.set.selected === 2 && json(selRow) === json(['2']),
        '⛓⛓ **THE READOUT\'S `selected` AND THE TABLE\'S HIGHLIGHTED ROW AGREE** — `selectRoom` '
        + 'notifies the page now (`why: \'select\'`), so a pick is publishable where before it '
        + 'was only visible', `readout ${startSel.set.selected} → ${picked.set.selected}, `
        + `table .sel ${json(selRow)}`);

    const linked = await pasteSet(overlayOf(4),
        () => window.__mazeLab?.set?.links === 4, 'the 4-link RING to be held');
    const ringTable = await roomsTable();
    check(linked.set.links === 4
        && json(ringTable.map((r) => r[4])) === json(['2', '2', '2', '2']),
        '⛓⛓ **AN OVERLAY PASTED INTO THE ARM\'S OWN BOX IS HELD**, and for the maze the links '
        + 'ARE the graph. ⛔⛔ TWO inbound per room over a FOUR-link ring, not one — a maze '
        + '`one_way` DEFAULTS FALSE, the opposite of Seedling\'s (§26.4): Seedling\'s one '
        + 'transition primitive is a one-way JUMP, and a maze crossing is a tile the player '
        + 'walks onto and back off. ⚠ This row expected `[1,1,1,1]` on its first run — the '
        + 'default is the thing it now measures',
        `${linked.set.links} link(s) · links-here column ${json(ringTable.map((r) => r[4]))}`);
    /**
     * ⛓⛓⛓ **THE TWO-CLICK GESTURE, ON THE PAGE.** E2b proved it in node over a
     * hand-built DOM; this is the page's own geometry — `cellAt` over the STRIP
     * (`bounds` is `{w: rooms, h: 1}`) and `exits.addressOf` reading the
     * `<option>` value the same binding built. ⛔ MUTANT: `exits.addressOf`
     * coercing with `Number()` (Seedling's spelling) — every endpoint becomes
     * `NaN` and `connect` refuses, listing the exits the entry really has.
     *
     * ⚠ THE EXIT IS PICKED **BETWEEN** THE TWO CLICKS, and that is the panel's
     * own flow rather than a workaround: `fillExitSelect` clears and refills the
     * list on every render (it is *"the SELECTED room's exits"*, and the first
     * click is what selects the room), so a value set before the first click is
     * gone by the second. `fillOrdinalSelect` DOES preserve, because its list is
     * the library's distinct exit ids and does not depend on the selection.
     */
    const gesture = await load(setUrl, () => window.__mazeLab?.set?.mounted === true,
        'the SET arm for the two-click gesture');
    check(gesture.set.links === 0 && gesture.set.ops === 0,
        '⛓ the gesture starts from an UNLINKED library — 0 links, 0 ops');
    /**
     * ⛓⛓⛓ **THE EXIT IS PICKED BEFORE THE FIRST CLICK — EDITOR v3 E3a, §31.1
     * #4.** E2c had to pick it BETWEEN the two clicks, because
     * `fillExitSelect` cleared and refilled the `<select>` on every render and
     * did NOT preserve its value while `fillOrdinalSelect` did (§30.12 #1) — so
     * a value set before the first click was gone by the second. The panel's own
     * flow hid it (the list IS the selected room's exits and the first click is
     * what selects the room) and nothing declared the asymmetry.
     * ⛓ It preserves now, keyed on the room the list was last filled FOR, and
     * this is the gesture a person would actually make: pick the door, then say
     * where it goes. MUTANT: drop the preservation — the `connect` lands on
     * `exit_0` and the readout's `opList` still says `['connect']`, so it is the
     * ENDPOINT below that catches it, not the count.
     */
    await page.click('#editSetGesture');
    await page.selectOption('#editSetExitList', 'exit_1');
    await page.selectOption('#editSetTargetExit', 'exit_3');
    await clickStripRoom(0);
    await clickStripRoom(1);
    await settled(() => window.__mazeLab?.set?.ops === 1, 'the two-click CONNECT to land');
    const connected = await read();
    const gestureTable = await roomsTable();
    /**
     * ⛓ THE EXIT LIST'S OWN LABELS NAME WHERE EACH DOOR GOES
     *  (`mazeSetBindings.exits.labelOf`), so this is where the `connect`'s
     *  SOURCE ENDPOINT is readable off the page without unpacking the overlay.
     */
    const exitLabels = () => page.evaluate(() => [
        ...document.querySelectorAll('#editSetExitList option'),
    ].map((o) => o.textContent));
    const gestureExits = await exitLabels();
    check(json(connected.set.opList) === json(['connect']) && connected.set.links === 1
        && json(gestureTable.map((r) => r[4])) === json(['1', '1', '0', '0'])
        && /^exit_1 .*→ room 1 exit_3$/.test(gestureExits.find((l) => l.startsWith('exit_1')))
        && /unlinked/.test(gestureExits.find((l) => l.startsWith('exit_0'))),
        '⛓⛓⛓ **THE TWO-CLICK GESTURE LANDS ONE `connect`, ENDPOINT-ADDRESSED** — arm it, pick '
        + 'WHICH exit and its return ordinal, then click the SOURCE room and the TARGET. One '
        + 'link, and both its ends count as inbound because a maze crossing is TWO-WAY by '
        + 'default. ⛔ The ENDPOINT is asserted, not just the count: a `connect` that lost the '
        + 'picked exit across the first click\'s render would still be ONE op on ONE link, and '
        + 'only the door it actually joined says which build drew it (§30.12 #1)',
        `${json(connected.set.opList)} · links ${connected.set.links} · `
        + `${json(gestureTable.map((r) => r[4]))} · ${json(gestureExits)}`);
    /**
     * ⛓⛓⛓ **EDITOR v3 E3a — `set.strip` IS BACK, AND THIS IS THE EXACT
     * MEASUREMENT THAT KILLED IT.** E2c drove this same two-click CONNECT and
     * found `set.links` reading **1** off the SESSION while a `strip` field read
     * `linkedFrom: [0,0,0,0]` off the MOUNT — one applied op behind, because
     * `onSetChange` fired BEFORE the mount's own `render()`. ⛔ The claim is
     * AGREEMENT, not a literal: the readout is `setUi.rows()` at PAGE-RENDER
     * time and the table is the DOM read afterwards, so a page told too early
     * disagrees with the box a person is looking at.
     * ⛓ MUTANT: put `onSetChange?.({why: 'op'})` back inside the `applied`
     * branch above `render()` — `strip.linkedFrom` reads `[0,0,0,0]` here while
     * the table reads `['1','1','0','0']`, and this row is the witness.
     */
    check(connected.set.strip !== null
        && json(connected.set.strip.linkedFrom.map(String))
            === json(gestureTable.map((r) => r[4]))
        && json(connected.set.strip.exits.map(String)) === json(gestureTable.map((r) => r[3]))
        && json(connected.set.strip.names) === json(gestureTable.map((r) => r[1])),
        '⛓⛓⛓ **THE READOUT\'S `strip` AND THE ROOMS TABLE AGREE, ONE APPLIED OP AFTER THE '
        + 'GESTURE** — E2c could publish neither (§30.8: `linkedFrom: [0,0,0,0]` against a live '
        + '`links: 1`), and E3a\'s ONE ordering rule (the mount renders, THEN it says why) is '
        + 'what makes the field honest',
        `readout ${json(connected.set.strip.linkedFrom)} · DOM ${json(gestureTable.map((r) => r[4]))}`);

    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm for arrows');
    await pasteSet(overlayOf(4), () => window.__mazeLab?.set?.links === 4,
        'the 4-link RING again, for the arrows');
    const beforeArm = await stripInk();
    await page.click('#editSetGesture');
    await page.waitForTimeout(400);
    const afterArm = await stripInk();
    /**
     * ⛓⛓⛓ **EDITOR v3 E3a — THE ARROWS ARE PAINTED AT LOAD, ON THIS SUBSTRATE
     * TOO.** E2c inherited D2's defect (§23.11 #5) and carried the load-time
     * numbers in this DETAIL so the row would survive the fix; the fix has
     * landed, and the claim moves into the CONDITION. `mountEditorView`'s
     * returned surface now names `repaint` and `setEditorView.render()` calls
     * it right after `paintStrip()` has sized the canvas.
     * ⛔ MUTANT: drop that call — `beforeArm` reads 1×1 with 0 ink again, here
     * and on `-arm`, while `editorView.test.js`'s own rows stay green.
     */
    check(beforeArm !== null && beforeArm.ovInk > 0
        && beforeArm.ovW === beforeArm.w && beforeArm.ovH === beforeArm.h,
        '⛓⛓⛓ **THE ARROWS ARE ON THE OVERLAY AT LOAD, AT THE STRIP\'S SIZE** — nothing armed, '
        + 'nothing clicked. E2c measured `1×1` with `0` ink here over a strip that was already '
        + `${beforeArm?.w}×${beforeArm?.h}, because the view painted once at mount and nothing `
        + 'asked it again (§23.11 #5)', json(beforeArm));
    check(afterArm !== null && afterArm.ovInk > 0
        && afterArm.ovW === afterArm.w && afterArm.ovH === afterArm.h,
        '⛓⛓ …**AND ARMING THE GESTURE LEAVES THEM THERE** — `#editSetGesture` is `setTool`, '
        + 'which repaints too, so this is the control that says the load-time paint and the '
        + 'gesture-time paint land on the same surface at the same size',
        `${json(beforeArm)} → ${json(afterArm)}`);

    /* ── CLAIM 19: the ROOM SESSION lives INSIDE the SET arm ─────────── */
    const ROOM = 1;
    const roomEntry = MAZE_PACK.entries[ROOM];
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm for a room');
    await page.click(`#editSetRowOpen_${ROOM}`);
    await settled(`window.__mazeLab?.set?.openRoom === ${ROOM}`, `room ${ROOM} to open`);
    const opened = await read();
    check(opened.set.openRoom === ROOM && opened.set.openRoomOps === 0
        && opened.set.openRoomBase?.kind === 'library-room'
        && opened.set.openRoomBase.library_id === MAZE_PACK.library_id
        && opened.set.openRoomBase.entry_id === roomEntry.entry_id,
        `⛓⛓⛓ **CLAIM 19 — OPEN ROOM ${ROOM} INSIDE THE SET ARM.** ⛔ Not by switching `
        + '`#source` to `edit`: that RETIRES this arm and takes the LIBRARY session with it. '
        + 'The base names the library, the index AND the entry — a `library_id` carries the '
        + 'document\'s content hash, and a reorder moves the index while the entry id does not',
        json(opened.set.openRoomBase));
    const canvasShown = await page.evaluate(() => ({
        hidden: document.getElementById('canvas').hidden,
        editing: document.getElementById('canvas').classList.contains('editing'),
        w: document.getElementById('canvas').width,
        palette: document.querySelectorAll('#labSetPalette button').length,
    }));
    check(canvasShown.hidden === false && canvasShown.editing === true
        && canvasShown.w === roomEntry.payload.width * 20 && canvasShown.palette > 0,
        '⛓ …and `#canvas` now holds THAT room, sized from ITS width, with the ROOM\'s own '
        + 'palette beside it (⛔ not `#labPalette`: that one is bound to the LAB LEVEL\'s '
        + 'editor and its UNDO hits the LAB session)', json(canvasShown));
    const idLine = await page.textContent('#editSetIdentity');
    check(/ROOM 1 open with 0 edit\(s\)/.test(idLine)
        && /Ctrl\+Z here hits the ROOM session/.test(idLine),
        '⛓⛓ §21.5 — THE IDENTITY LINE SAYS WHICH SESSION AN UNDO WILL HIT, read from '
        + '`document.activeElement`: with the strip unfocused it is the ROOM\'s', idLine);
    /**
     * ⛓⛓⛓ **EDITOR v3 E3a — `set.identity` IS BACK, AND THE OPEN BUTTON IS WHY
     * IT NEEDED A SIXTH `why`.** The rooms table's OPEN runs `selectRoom`, then
     * the PAGE's `openRoomAt` (which re-renders the PAGE), then the MOUNT's
     * `render()` — so a readout written from the page's own render says *"no
     * room open"* while the line beside it already says *"ROOM 1 open"*. ⛔ The
     * fix is the ordering rule applied to that press too (`why: 'room'`), and
     * this row is the witness: the field and the line are the SAME sentence.
     * ⛓ MUTANT: drop that notification — `set.identity` reads `· no room open`
     * against an `#editSetIdentity` that reads `· ROOM 1 open with 0 edit(s)`.
     */
    const openedRead = await read();
    check(openedRead.set.identity === idLine && /ROOM 1 open/.test(openedRead.set.identity),
        '⛓⛓⛓ **THE READOUT\'S `identity` IS THE IDENTITY LINE, CHARACTER FOR CHARACTER, AFTER '
        + 'AN OPEN** — E2c published no such field because the page could not be told late '
        + 'enough to write a true one (§30.8)',
        `readout ${json(openedRead.set.identity?.slice(-60))}`);
    await page.evaluate(() => document.getElementById('editSetOverview').focus());
    await page.click('#editSetReport');
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm, fresh');
    await page.click(`#editSetRowOpen_${ROOM}`);
    await settled(`window.__mazeLab?.set?.openRoom === ${ROOM}`, `room ${ROOM} to open`);
    /**
     * ⛔ **SCROLLED INTO VIEW FIRST, AND THAT WAS A HARNESS FINDING.** The rooms
     * table and the strip are BELOW `#canvas`, so `page.click('#editSetRowOpen_1')`
     * scrolls them into view and pushes the canvas off the top — the rectangle
     * then has a NEGATIVE `y` and `page.mouse.click` lands outside the viewport.
     * It shows up as a STUCK wait for the first room edit, not as a wrong cell.
     */
    const roomRect = () => page.$eval('#canvas', (c) => {
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    /** ⛓ A FLOOR cell THIS FILE picks, so the paint is a VALUE claim. */
    const firstFloorCell = (payload) => {
        const { width, height, tiles } = payload;
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                if (tiles[y * width + x] === 0) return { tx: x, ty: y, idx: y * width + x };
            }
        }
        return null;
    };
    /** ⛔ THE PALETTE FIRST, THE RECTANGLE SECOND: the palette lives below the
     *  canvas, so clicking it scrolls and a rectangle read before it is stale. */
    const paintRoom = async (payload, cell) => {
        await page.click('#labSetPalette button[data-type="wall"]');
        const b = await roomRect();
        await page.mouse.click(
            b.x + Math.floor(((cell.tx + 0.5) * b.w) / payload.width),
            b.y + Math.floor(((cell.ty + 0.5) * b.h) / payload.height));
    };
    const floorAt = firstFloorCell(roomEntry.payload);
    await paintRoom(roomEntry.payload, floorAt);
    await settled(() => window.__mazeLab?.set?.openRoomOps === 1, 'the first ROOM edit');
    /**
     * ⛓⛓⛓ **A REFUSED BUNDLE PRESS IS OBSERVABLE NOW** (EDITOR v3 E6b, curing
     * §34.7 #1). `editDownloadBundle`'s second guard refuses while a room is
     * open with unwritten edits — *"the bundle stamps once over everything"* —
     * and that is exactly the state this claim is standing in one line before
     * it presses CLOSE.
     *
     * ⛔⛔ **BEFORE THIS SLICE THE REFUSAL WAS INVISIBLE.** The readout globals
     * were written only at the END of the handler and never cleared, so a
     * refused press left the previous press's array in place and read like a
     * success. This gate pressed the bundle exactly once, after a `goto`, and
     * was safe BY ACCIDENT; the `-arm` pressed three times and was not (§34.7
     * #1: two claims red with the wrong member list, a third dead, the run 44
     * rows short). The page nulls the family and bumps the counter BEFORE every
     * guard now.
     * ⛓ MUTANT: the nulling moved back to the end of the handler — this row
     * reds, and on a FIRST press it reds as `'ABSENT'` rather than `null`,
     * which is the same defect seen from its other side.
     */
    const refusedPresses = await pressDownload('#editDownloadBundle',
        '__editorSetBundlePresses');
    const refusedBundle = await page.evaluate(() => ({
        presses: globalThis.__editorSetBundlePresses ?? null,
        /**
         * ⛔ `=== undefined`, NEVER `??`. The whole claim is that the readout is
         * `null` — the press SCOPED it — and `null ?? 'ABSENT'` is `'ABSENT'`,
         * which would collapse the cured build and the mutant into one answer.
         * (It did, on this row's first run.)
         */
        kinds: globalThis.__editorSetBundleKinds === undefined
            ? 'ABSENT' : globalThis.__editorSetBundleKinds,
        out: globalThis.__editorSetBundleOut === undefined ? 'ABSENT'
            : (globalThis.__editorSetBundleOut === null
                ? null : `${globalThis.__editorSetBundleOut.length} B`),
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    check(refusedBundle.presses === refusedPresses && refusedBundle.kinds === null
        && refusedBundle.out === null && /^⛔ NOT BUNDLED/.test(refusedBundle.note),
        '⛓⛓⛓ **A BUNDLE PRESS THAT REFUSES ADVANCES THE COUNTER AND LEAVES ITS READOUTS '
        + '`null`** — a refusal is a fact a driver can WAIT FOR now, instead of being '
        + 'indistinguishable from the last success. ⚖ THE GENERAL SHAPE §34.7 #1 LEFT: wait on '
        + 'a value that CHANGES, never on a key that merely exists',
        `presses ${refusedPresses} · kinds ${json(refusedBundle.kinds)} · `
        + refusedBundle.note.slice(0, 130));
    const stillBefore = { edited: await stripCellHash(ROOM), other: await stripCellHash(0) };
    await page.click('#editRoomClose');
    await settled(() => window.__mazeLab?.set?.ops === 1 && window.__mazeLab?.set?.openRoom === null,
        'the CLOSE to land ONE set op');
    const closed = await read();
    const stillAfter = { edited: await stripCellHash(ROOM), other: await stripCellHash(0) };
    check(stillAfter.edited !== stillBefore.edited && stillAfter.other === stillBefore.other,
        `⛓⛓⛓ **AND ROOM ${ROOM}'s STILL WAS RE-DRAWN WHILE THE OTHERS WERE NOT** — the stills `
        + 'cache is keyed on the `payload`, which a `replace-room` replaces. ⛔ MUTANT: '
        + '`stillKey` keyed on the room INDEX — the edited room keeps its OLD picture for ever '
        + 'and every other readout stays right. ⚠ A HASH of the cell\'s pixels and not a count '
        + 'of ink: a floor turning into a wall is opaque either way',
        `${json(stillBefore)} → ${json(stillAfter)}`);
    check(json(closed.set.opList) === json(['replace-room']) && closed.set.openRoom === null,
        '⛓⛓⛓ **ONE PAINT, ONE `replace-room`.** N room edits become ONE set op through the '
        + 'ADAPTER\'s `closeRoomSession` — the CAPTURE path, never `serializeMazeLevel`',
        json(closed.set.opList));
    await page.click('#editDownloadSet');
    /**
     * ⛓⛓ **THE PRESS IS ASKED WHETHER IT WROTE, BEFORE THE READOUT IS WAITED
     * FOR.** ⛔ MUTANT: `mazeSetAdapter.closeRoomSession` re-spelled with
     * `serializeMazeLevel` (§28.5). `replace-room` RE-CAPTURES whatever it is
     * handed, so a lab-spelled payload comes back with `exit_sides: [null]` and
     * `validateRegionLibrary` REFUSES the whole library —
     * *"entries[1].exit_sides[0] must be one of N/E/S/W, got null"* (measured in
     * node). The press then prints `⛔ NOT DOWNLOADED` and writes no blob, and
     * without this row the only symptom is a 60-second STUCK wait for a readout
     * that is never coming. A red that names itself beats a red that hangs.
     */
    await settled(() => /^(DOWNLOADED|⛔)/.test(
        document.getElementById('editSetNote')?.textContent ?? ''), 'the DOWNLOAD to answer');
    const pressNote = await page.textContent('#editSetNote');
    check(/^DOWNLOADED /.test(pressNote),
        '⛓⛓ the DOWNLOAD is ALLOWED after the close — the re-captured entry still validates',
        pressNote.slice(0, 200));
    await settled(() => window.__editorSetOut !== undefined, 'the library download readout');
    const out = await page.evaluate(() => window.__editorSetOut);
    const tilesBefore = roomEntry.payload.tiles;
    const tilesAfter = out.entries[ROOM].payload.tiles;
    const differing = tilesBefore
        .map((t, i) => (t === tilesAfter[i] ? null : i)).filter((i) => i !== null);
    check(json(differing) === json([floorAt.idx]) && tilesAfter[floorAt.idx] === 1,
        `⛓⛓⛓ **AND THE PAYLOAD DIFFERS AT EXACTLY THE CELL THIS FILE NAMED** — `
        + `(${floorAt.tx},${floorAt.ty}), index ${floorAt.idx}, floor → wall. ⛔ A VALUE claim: `
        + 'the cell is chosen from the COMMITTED entry here, without asking the page anything',
        `${differing.length} differing index(es): ${json(differing.slice(0, 5))}`);
    check(out.library_id !== MAZE_PACK.library_id && out.entries.length === 4
        && json(out.entries.map((e) => e.entry_id))
            === json(MAZE_PACK.entries.map((e) => e.entry_id)),
        '⛓⛓ …and the download RE-STAMPS the library: a `library_id` ends in the document\'s '
        + 'own content hash, so an edited library cannot keep the loaded one\'s id',
        `${MAZE_PACK.library_id} → ${out.library_id}`);
    const otherRooms = MAZE_PACK.entries
        .map((e, i) => (i === ROOM ? null : json(e.payload) === json(out.entries[i].payload)))
        .filter((v) => v !== null);
    check(otherRooms.every((v) => v === true),
        '⛓⛓ …and EVERY OTHER ENTRY IS BYTE-IDENTICAL — §26.6\'s deserialize→capture round trip, '
        + 'on the page: a close re-captures ONE room and touches nothing else',
        json(otherRooms));

    /* ── CLAIM 19b: an UNEDITED close, and §21.5's DISCARD ───────────── */
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm, fresh again');
    await page.click('#editSetRowOpen_2');
    await settled(() => window.__mazeLab?.set?.openRoom === 2, 'room 2 open');
    await page.click('#editRoomClose');
    await settled(() => window.__mazeLab?.set?.openRoom === null, 'the unedited CLOSE');
    const unedited = await read();
    check(unedited.set.ops === 0 && json(unedited.set.opList) === json([]),
        '⛓⛓⛓ **CLAIM 19b — AN UNEDITED CLOSE MINTS NOTHING** (`applied: false`). ⛔ This is '
        + 'the row that sees `closeRoomSession` re-spelled with `serializeMazeLevel`: the lab '
        + 'payload survives `deserializeMazeWorld` without a word, so the mutant does not '
        + 'throw — it MINTS AN EDIT out of a room nobody touched, and every exit\'s `side` '
        + 'comes back `null` (§28.5)', json(unedited.set.opList));
    await page.click('#editSetRowOpen_2');
    await settled(() => window.__mazeLab?.set?.openRoom === 2, 'room 2 open again');
    await paintRoom(MAZE_PACK.entries[2].payload,
        firstFloorCell(MAZE_PACK.entries[2].payload));
    await settled(() => window.__mazeLab?.set?.openRoomOps === 1, 'an edit in room 2');
    await page.click('#editSetRowUp_2');
    await settled(() => window.__mazeLab?.set?.openRoom === null, 'the DISCARD');
    const moved = await read();
    const moveNote = await page.textContent('#editSetNote');
    check(/DISCARDED/.test(moveNote) && moved.set.openRoom === null
        && json(moved.set.opList) === json(['reorder']),
        '⛓⛓⛓ **CLAIM 19c — §21.5 ON THE SECOND SUBSTRATE: MOVE UP WITH AN EDITED ROOM OPEN '
        + 'DISCARDS IT, LOUDLY** — and the reorder still lands. ⛔ NOT written back: a press on '
        + 'MOVE UP would otherwise become a `replace-room` nobody asked for, inside the '
        + 'reorder\'s own group', `${json(moved.set.opList)} · ${moveNote.slice(0, 140)}`);

    /* ── CLAIM 19d: §21.5 — WHICH SESSION `Ctrl+Z` HITS ──────────────── */
    /**
     * ⛓⛓⛓ **THE DOM'S OWN FOCUS IS THE ROUTER, AND THERE IS NO SECOND ONE.**
     * ⛔ Asserted as BEHAVIOUR and not as the identity line's text — a row that
     * read the sentence would be green over a build whose router said one thing
     * and did another. ⚠ AND THE FIRST DRAFT OF THIS ROW *WAS* THAT ROW, and it
     * could not even be written honestly: reading the line after `focus()`
     * needs a RENDER, and every way of triggering one through the DOM moves the
     * focus somewhere else. ⛔ BLUR, not `body.focus()` — `<body>` has no
     * `tabindex` and focusing it is a no-op (the `-arm` paid for that finding).
     */
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm for §21.5');
    await pasteSet(overlayOf(4), () => window.__mazeLab?.set?.links === 4,
        'the RING, so there is a link to DISCONNECT');
    await page.selectOption('#editSetExitList', 'exit_1');
    await page.click('#editSetDisconnect');
    await settled(() => window.__mazeLab?.set?.ops === 1, 'ONE library op');
    await page.click(`#editSetRowOpen_${ROOM}`);
    await settled(`window.__mazeLab?.set?.openRoom === ${ROOM}`, `room ${ROOM} to open`);
    await paintRoom(roomEntry.payload, floorAt);
    await settled(() => window.__mazeLab?.set?.openRoomOps === 1, 'ONE room op');
    const both = await read();
    check(both.set.ops === 1 && both.set.openRoomOps === 1,
        '⛓ **CLAIM 19d** — both sessions hold exactly ONE op, so the two presses below can be '
        + 'told apart', `library ${both.set.ops} · room ${both.set.openRoomOps}`);
    await page.evaluate(() => document.getElementById('editSetOverview').focus());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const stripUndo = await read();
    check(stripUndo.set.ops === 0 && stripUndo.set.openRoomOps === 1,
        '⛓⛓⛓ **WITH THE STRIP FOCUSED, `Ctrl+Z` UNDOES THE LIBRARY AND LEAVES THE ROOM '
        + 'ALONE** — one press, one session',
        `library 1 → ${stripUndo.set.ops}, room 1 → ${stripUndo.set.openRoomOps}`);
    await page.evaluate(() => document.getElementById('editSetOverview').blur());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const roomUndo = await read();
    check(roomUndo.set.openRoomOps === 0 && roomUndo.set.ops === 0,
        '⛓⛓⛓ **AND ANYWHERE ELSE IT UNDOES THE ROOM** — the library is untouched. ⛔ Without '
        + 'the strip\'s keydown STOPPER a press on the strip would bubble to the document and '
        + 'BOTH rows would run, and the two counts would fall together',
        `room 1 → ${roomUndo.set.openRoomOps}, library ${stripUndo.set.ops} → `
        + `${roomUndo.set.ops}`);

    /* ── CLAIM 19e: ADD ROOM, and the one authority on a size ────────── */
    /**
     * ⛓⛓⛓ **CLAIM 19e — THE MAZE ARM MINTS A BLANK ROOM** (EDITOR v3 E6b).
     * E2c shipped `#editSetAddRoom` DISABLED with a `title` saying the maze's
     * `add-room` takes a captured WORLD and this arm had none to mint; E3b
     * landed `blankMazeRoomPayload`, and `mazeSetLab.mazeSetBindings` now hands
     * the mount an `addRoomOp` built from the PAGE's own two size inputs.
     *
     * ⛔ The subject is a CLOSED graph first — the 4-link RING, whose export the
     * REPORT allows — so the refusal further down is caused BY THE ADD and not
     * by the state the arm was already in.
     */
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm for ADD ROOM');
    await pasteSet(overlayOf(4), () => window.__mazeLab?.set?.links === 4,
        'the 4-link RING, whose graph CLOSES');
    await page.click('#editSetReport');
    await settled(() => document.getElementById('editDownloadRules')?.disabled === false,
        'the REPORT to ALLOW the ring BEFORE the add');
    /**
     * ⛓ **THE DEFAULT SIZE IS THE ENGINE'S OWN CONSTANT, NOT A LITERAL IN THE
     * MARKUP** — `mazeLabView` seeds the two inputs from `MAZE_DEFAULTS`, which
     * is what `readLabParams` falls back to for `?width=`/`?height=`, so the
     * SET arm mints the size the GENERATE arm generates. ⛔ MUTANT: the values
     * typed into `lab.html` — green today and stale the day the constant moves.
     */
    const newSize = await page.evaluate(() => ({
        w: Number(document.getElementById('editSetNewW')?.value),
        h: Number(document.getElementById('editSetNewH')?.value),
        min: document.getElementById('editSetNewW')?.getAttribute('min'),
        addDisabled: document.getElementById('editSetAddRoom')?.disabled ?? null,
    }));
    check(newSize.w === MAZE_DEFAULTS.width && newSize.h === MAZE_DEFAULTS.height
        && newSize.min === '2' && newSize.addDisabled === false,
        '⛓⛓ **CLAIM 19e — THE BLANK-ROOM INPUTS CARRY `MAZE_DEFAULTS`, AND THE BUTTON IS '
        + `ENABLED** — ${MAZE_DEFAULTS.width}x${MAZE_DEFAULTS.height}, the same constant `
        + '`#labWidth`/`#labHeight` fall back to. ⛔ E2c\'s `title` said ADD ROOM was "not '
        + 'offered here"; that sentence is retired rather than left true-looking',
        json(newSize));
    const beforeAdd = await stripInk();
    const hashesBefore = [];
    for (let i = 0; i < MAZE_PACK.entries.length; i += 1) hashesBefore.push(await stripCellHash(i));
    await page.click('#editSetAddRoom');
    await settled(() => window.__mazeLab?.set?.rooms === 5, 'the ADD ROOM press to land a room');
    const added = await read();
    check(added.set.rooms === 5 && added.set.opList.at(-1) === 'add-room'
        && added.set.strip.rooms === 5,
        '⛓⛓⛓ **ADD ROOM APPENDS ONE ROOM, AND THE LEDGER SAYS `add-room`** — the mount\'s press '
        + 'says only WHERE (`at = roomCount()`); the whole op is the binding\'s, exactly as '
        + 'Seedling\'s hands a blank RECORD where this hands a `payload`',
        `${added.set.rooms} room(s) · ${json(added.set.opList)}`);
    /**
     * ⛓⛓ **AND THE STRIP GREW BY ONE CELL WHOSE PIXELS ARE NOBODY ELSE'S.** ⛔ A
     * WIDTH claim AND a HASH claim: the width alone is green over a build that
     * appended a blank rectangle, and a hash alone cannot say the strip grew.
     * ⚠ The hash is compared against ALL FOUR earlier cells, not just cell 3 —
     * the demo pack's rooms are not identical to each other, and a new cell
     * that matched any of them would be a still of the wrong room.
     */
    const afterAdd = await stripInk();
    const hash4 = await stripCellHash(4);
    check(afterAdd.w === beforeAdd.w + OVERVIEW.cellPx
        && !hashesBefore.includes(hash4) && afterAdd.stripInk > beforeAdd.stripInk,
        `⛓⛓ …and the STRIP grew by exactly one \`OVERVIEW.cellPx\` (${OVERVIEW.cellPx}) and the `
        + 'new cell\'s PIXELS match none of the four that were there',
        `${beforeAdd.w} → ${afterAdd.w} px · ink ${beforeAdd.stripInk} → ${afterAdd.stripInk} · `
        + `hash ${hash4} vs ${json(hashesBefore)}`);
    const table5 = await roomsTable();
    check(table5.length === 5 && table5[4][3] === '0' && table5[4][4] === '0',
        '⛓⛓ …and ROW 4 IS DOORLESS — 0 exits, 0 links here. `blankTileGridLibraryEntry` hands '
        + '`createWorld` an explicit `exits: []` rather than letting its default mint a door at '
        + 'the bottom-right, so the room arrives unwired and an author has to draw its doors',
        json(table5[4]));
    /**
     * ⛔⛔ **AND THE REPORT REFUSES THE EXPORT WHILE IT IS UNREACHED — THE
     * SUBJECT IS REAL.** A room with no door cannot be entered, so a
     * `rules.json` written over this library would describe a world with a
     * region nobody can get to. ⛓ This is the row that makes the ADD honest:
     * the arm hands a person a blank room AND tells them it is not finished.
     */
    await page.click('#editSetReport');
    await settled(() => document.getElementById('editDownloadRules')?.disabled === true,
        'the REPORT to REFUSE the export while room 4 is unreached');
    const unreached = await reportOf();
    check(unreached.rulesDisabled === true && unreached.errorRows > 0,
        '⛓⛓⛓ **THE EXPORT IS REFUSED WHILE THE NEW ROOM IS UNREACHED** — the same REPORT '
        + 'allowed this very ring one press ago, so the refusal is the ADD\'s and not the '
        + 'state\'s', `${unreached.errorRows} error row(s) · ${unreached.note.slice(0, 160)}`);
    /**
     * ⛔⛔ **A SIZE BELOW 2 IS REFUSED BY `createWorld`'s OWN SENTENCE.** The
     * `min="2"` on the inputs is a HINT to a person — `page.fill` walks past it,
     * and so does anyone typing. ⛓ **AND THE PRESS DOES NOT THROW**: E6b found
     * that `applySet(addRoomOp(at), …)` evaluated the binding as an ARGUMENT,
     * i.e. BEFORE `applySet`'s own `try`, so a refusing mint escaped the click
     * listener entirely — no note, a console error, and `#editSetNote` left
     * holding the previous press's sentence. ⛓ MUTANT: that `try` removed —
     * this row reds AND the console-error row at the end of the file reds with
     * it.
     */
    await page.fill('#editSetNewW', '1');
    await page.click('#editSetAddRoom');
    await settled(() => /createWorld: invalid dimensions/.test(
        document.getElementById('editSetNote')?.textContent ?? ''),
    'the MINT refusal to reach `#editSetNote`');
    /**
     * ⛔⛔ **AND THE NOTE IS READ OFF THE DOM, NOT OFF `set.note` — MEASURED.**
     * First run of this row: `#editSetNote` carried the sentence (the `settled`
     * above returned) while `window.__mazeLab.set.note` was the EMPTY STRING.
     * ⛓ Because NO REFUSAL PATH IN THIS MOUNT NOTIFIES THE PAGE: `applySet`'s
     * own catch (`setEditorView.js:669`) returns `{ok: false}` without a
     * `render()` or an `onSetChange`, and the press's new catch mirrors it. The
     * readout is written by the PAGE's render, which a refusal never triggers,
     * so it holds whatever the last APPLIED op left there. ⛓ That is the same
     * reader CLAIM 19's `pressNote` already uses for the same reason — named
     * here rather than cured, because curing it is a change to every refusal
     * path on both substrates.
     */
    const refusedNote = await page.textContent('#editSetNote');
    const refusedAdd = await read();
    check(refusedAdd.set.rooms === 5
        && /^⛔ ADD ROOM could not be applied: createWorld: invalid dimensions 1x/
            .test(refusedNote),
        '⛓⛓⛓ **A 1-WIDE BLANK ROOM IS REFUSED BY THE ENGINE\'S OWN SENTENCE, AND NO ROOM '
        + 'LANDS** — one authority for what a world may be (`blankTileGridLibraryEntry`\'s '
        + 'docblock says the refusal is left to `createWorld`), and the page prints it verbatim '
        + 'rather than paraphrasing it',
        `${refusedAdd.set.rooms} room(s) · ${refusedNote.slice(0, 120)}`);
    /**
     * ⛓ **AND THE ADD IS UNDOABLE LIKE ANY OTHER SET OP** — the strip's own
     * `Ctrl+Z`, the idiom CLAIM 19d established. ⛔ The REFUSED press must not
     * be on the stack: if it were, this undo would put `rooms` back to 5.
     */
    await page.evaluate(() => document.getElementById('editSetOverview').focus());
    await page.keyboard.press('Control+z');
    await settled(() => window.__mazeLab?.set?.rooms === 4, 'the UNDO to drop the added room');
    const addUndone = await read();
    check(addUndone.set.rooms === 4 && addUndone.set.ops === 0
        && json(addUndone.set.opList) === json([]),
        '⛓⛓ …and ONE `Ctrl+Z` on the strip takes the room back out — the refused press left '
        + 'nothing on the stack, so the ledger is empty rather than one short',
        `${added.set.rooms} → ${addUndone.set.rooms} room(s), ${addUndone.set.ops} op(s)`);

    /* ── CLAIM 20: the REPORT, the four downloads and the BUNDLE ─────── */
    await load(setUrl, () => window.__mazeLab?.set?.mounted === true, 'the SET arm for REPORT');
    await pasteSet(overlayOf(2), () => window.__mazeLab?.set?.links === 2, 'the 2-link CHAIN');
    /**
     * ⛓⛓ **`null` UNTIL THE BUTTON IS PRESSED IS A STATE, NOT A HOLE** — the
     * readout publishes the MOUNT's own `lastReport` and never runs the report
     * itself, because a readout that derived the atlas on every page render
     * would put a compile on the main thread behind every click.
     */
    const beforeReport = await read();
    check(beforeReport.set.report === null,
        '⛓ **`set.report` IS `null` BEFORE ANY REPORT PRESS** — it is `setUi.report()`, the '
        + 'mount\'s own last verdict, and not a second authority that re-derives one',
        json(beforeReport.set.report));
    await page.click('#editSetReport');
    await settled(() => document.querySelectorAll('#editSetReportOut li').length > 0,
        'the REPORT over the chain to paint its rows');
    const chain = await reportOf();
    check(chain.rulesDisabled === true && /cannot be reached from the start/.test(chain.note),
        '⛓⛓⛓ **CLAIM 20 — THE REPORT REFUSES AN UNCLOSED GRAPH BY NAME.** ⚠ TWO links, not '
        + 'three: a 3-link two-way chain is a SPANNING TREE over four rooms and everything is '
        + 'reachable (§28.1 #5 measured it), so a "3-link refuses" row would be green for the '
        + 'wrong reason', chain.note);
    check(chain.rows.some((r) => r.startsWith('[region-library]'))
        && !chain.rows.some((r) => r.startsWith('[level-set]')),
        '⛓ …and §1 of the verdict is about a REGION LIBRARY — the document\'s own kind, on a '
        + 'substrate that has no level set at all', json(chain.rows.slice(0, 2)));
    await pasteSet(overlayOf(4), () => window.__mazeLab?.set?.links === 4, 'the 4-link RING');
    await page.click('#editSetReport');
    await settled(() => document.getElementById('editDownloadRules')?.disabled === false,
        'the REPORT to ALLOW the ring');
    const ring = await reportOf();
    check(ring.rulesDisabled === false && /the graph closes/.test(ring.note),
        '⛓⛓ …and the 4-link RING closes the graph and ALLOWS the export', ring.note);
    /**
     * ⛓⛓⛓ **EDITOR v3 E3a — THE REPORT SEAM, CLOSED AND WITNESSED.** §30.7 left
     * the REPORT path calling no `onSetChange` at all, so this field could not
     * exist. ⛔ MUTANT: drop `onSetChange?.({why: 'report'})` from the press —
     * the readout keeps the CHAIN's refusal (or `null`) while the box shows the
     * RING's allowance, and the two disagree here.
     */
    check(ring.readout !== null
        && json(ring.readout.rows) === json(ring.rows)
        && ring.readout.rulesAllowed === !ring.rulesDisabled
        && (ring.readout.rulesWhy ?? '⛓ the graph closes and the set validates — '
            + 'rules.json may be exported.') === ring.note
        && ring.readout.errors === ring.errorRows,
        '⛓⛓⛓ **THE READOUT\'S `report` AND THE REPORT BOX AGREE** — same rows, same verdict, '
        + 'same sentence. E2c published NO `report` field because the REPORT press told the '
        + 'page nothing (§30.7); E3a\'s ordering rule is what this row is the witness for',
        `readout ${ring.readout?.rows.length} row(s), allowed ${ring.readout?.rulesAllowed} · `
        + `DOM ${ring.rows.length} row(s), disabled ${ring.rulesDisabled}`);

    await page.click('#editDownloadSet');
    await settled(() => window.__editorSetOverlayOut !== undefined, 'both download readouts');
    const dl = await page.evaluate(() => ({
        library: window.__editorSetOut?.library_id ?? null,
        overlay: window.__editorSetOverlayOut?.overlay_id ?? null,
        mapping: window.__editorSetMappingOut ?? null,
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    check(dl.library !== null && dl.overlay !== null && dl.mapping === null
        && /a region library has no VANILLA mapping to invalidate/.test(dl.note),
        '⛓⛓⛓ **TWO MEMBERS AND A SENTENCE ABOUT THE THIRD.** ⛔ `apMapping` is NOT emitted '
        + 'empty and the reason is PRINTED: a region library never shipped as anybody\'s '
        + 'vanilla game, and an empty companion would read as "checked, nothing to say"',
        `${dl.library} · ${dl.overlay} · mapping ${dl.mapping} · ${dl.note.slice(0, 120)}`);
    /**
     * ⛓⛓ **EDITOR v3 E3a — `set.note` IS BACK.** The DOWNLOAD press already
     * called `onSetChange`; what it did NOT do was call it after the mount's own
     * render, so a `note` field would have carried the sentence from before the
     * press. ⛔ The claim is agreement with the box, not the sentence itself —
     * the sentence is asserted by the row above, and duplicating it here would
     * be two authorities for one string.
     */
    const dlRead = await read();
    check(dlRead.set.note === dl.note && dl.note !== '',
        '⛓⛓ **THE READOUT\'S `note` AND `#editSetNote` ARE THE SAME SENTENCE** — the third of '
        + 'the four fields E2c had to drop (§30.8)',
        `${dlRead.set.note?.slice(0, 90)}`);
    await pressDownload('#editDownloadRules', '__editorSetRulesPresses',
        { settleOn: '__editorSetRulesBytes' });
    /**
     * ⛔ **`regions` IS KEYED BY PLAYER FIRST**, so a count of its top-level keys
     * is 1 for every rules.json this repo writes and would have been green over
     * a document with no regions at all. The AP regions live one level down —
     * the same reading `check-preset-bundle-load`'s own `NODE_REGIONS` takes.
     */
    const rulesOut = await page.evaluate(() => {
        const doc = window.__editorSetRulesOut ?? {};
        const players = Object.keys(doc.regions ?? {});
        const names = Object.keys(doc.regions?.[players[0]] ?? {});
        return {
            players: players.length,
            regions: names.length,
            names,
            bytes: window.__editorSetRulesBytes?.length ?? 0,
        };
    });
    /**
     * ⛔ **A VALUE CLAIM, NOT A COUNT — and the count is what got this row wrong
     * twice.** First it counted `regions`' top-level keys (1: they are keyed by
     * PLAYER first), then it counted the player's regions (5, not 4). The fifth
     * is the graph's own START region, which is not an entry — so the row now
     * asserts that EVERY entry id is a region NAME (§26.5: `region_id` is the
     * ENTRY id, and the AP region is named after it) and PRINTS whatever else
     * is in there rather than pinning a total that says nothing about which.
     */
    const extra = rulesOut.names.filter((n) => !MAZE_PACK.entries.some((e) => n.includes(e.entry_id)));
    check(rulesOut.players === 1
        && MAZE_PACK.entries.every((e) => rulesOut.names.some((n) => n.includes(e.entry_id)))
        && rulesOut.bytes > 0,
        '⛓ …and `rules.json` names an AP region after EVERY library entry, through the '
        + `MARKING TOOL's own writer (${rulesOut.regions} region(s) for `
        + `${MAZE_PACK.entries.length} entries — the extra is ${json(extra)})`, json(rulesOut));
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleKinds' });
    const bundle = await page.evaluate(() => ({
        kinds: window.__editorSetBundleKinds,
        bytes: window.__editorSetBundleOut?.length ?? 0,
        note: document.getElementById('editSetNote')?.textContent ?? '',
    }));
    check(json(bundle.kinds) === json(['region-library', 'overlay', 'rules', 'region-atlas'])
        && bundle.bytes > 0 && !/NOT a member/.test(bundle.note),
        '⛓⛓⛓ **THE BUNDLE CARRIES THE LIBRARY — the FIFTH `BUNDLE_KINDS` entry, on the page.** '
        + `⛔ Before E2c's first commit this press refused the maze's own PRIMARY document by `
        + `name, quoting a roster of ${BUNDLE_KINDS.length - 1}`,
        `${json(bundle.kinds)} · ${bundle.bytes} B`);


    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ CLAIM 22 — THE MANUAL ARM (SLICE S2b)
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ **DRIVEN BY REAL KEY PRESSES**, `page.keyboard.press`, never by calling
     * into the page: the arm's whole subject is a keyboard binding on `window`
     * under an arm's lifetime, and a row that called `pressWalk` directly would
     * assert everything about the session and nothing about the thing that can
     * actually break.
     *
     * THE SUBJECT is `?seed=1&width=5&height=5&skeleton=winding`, whose room is
     *
     *     ..###        entrance (0,0) · goal (1,3) · oracle plan E S S S
     *     #.###        ⛔ (2,1) is a WALL — the refusal row's subject, and
     *     #.###           `whyBlocked` names the CELL, so the row can assert
     *     #.###           the sentence rather than the fact that there was one.
     *     #####
     *
     * ⚠ The brief's own sketch said "ArrowRight ×2" for the two accepted moves;
     * on THIS room the second E is the wall. The two accepted presses are
     * therefore E then S, and the wall press is the E that follows — the same
     * three rows, in the order this room admits.
     */
    const MANUAL_QUERY = 'seed=1&width=5&height=5&skeleton=winding';
    const manualWeb = await load(`${MANUAL_QUERY}&source=manual`,
        () => window.__mazeLab?.source === 'manual',
        'the MANUAL arm to mount');
    check(manualWeb.walk === null && manualWeb.play === null,
        '⛓ before START there is NO walk and NO replay — `__mazeLab.walk` is `null` outside '
        + 'a session, which is what makes every count below a fact about a drive',
        `walk=${json(manualWeb.walk)}, play=${json(manualWeb.play)}`);
    const manualPanels = await page.evaluate(() => ({
        generate: document.getElementById('generatePanel').hidden,
        edit: document.getElementById('editPanel').hidden,
        solve: document.getElementById('solvePanel').hidden,
        set: document.getElementById('setPanel').hidden,
        manual: document.getElementById('manualPanel').hidden,
        replay: document.getElementById('replayPanel').hidden,
    }));
    check(manualPanels.manual === false && manualPanels.replay === false
        && manualPanels.generate && manualPanels.edit && manualPanels.solve && manualPanels.set,
    '⛓⛓ …and the FIFTH panel is the one showing, beside the REPLAY panel the SOLVE arm '
        + 'shares with it — ⛔ one scrub over one `play.index`, never a second copy of the '
        + 'controls inside this panel', json(manualPanels));

    await page.click('#labWalkStart');
    await settled(() => window.__mazeLab?.walk?.moves === 0, 'the walk session to open');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await settled(() => window.__mazeLab?.walk?.moves === 2,
        'two REAL key presses to reach the session');
    const drove2 = await read();
    const hud2 = await page.textContent('#manualNote');
    check(drove2.walk.moves === 2 && drove2.play.author === 'hand'
        && hud2.includes(`player (${drove2.play.player.x},${drove2.play.player.y})`),
    '⛓⛓⛓ **TWO KEY PRESSES ARE TWO ENTRIES, TWO FRAMES AND ONE AUTHOR** — `page.keyboard` '
        + 'drove them, `play.author` is `hand`, and the HUD names the cell the player is on '
        + '(read off the SAME frame the picture was drawn from)',
    `moves=${drove2.walk.moves}, author=${drove2.play.author} | ${hud2.trim().slice(0, 110)}`);
    check(drove2.play.frames === drove2.walk.moves + 1 && drove2.play.turn === 2,
        '⛓ …and the drive IS the replay: `play.frames` is the walk plus its start frame, and '
        + 'the ENGINE turn moved with it',
        `${drove2.play.frames} frame(s), turn ${drove2.play.turn}`);

    /**
     * ⛓⛓⛓ **A REFUSED PRESS IS KEPT, AND THE HUD NAMES `whyBlocked`'s SENTENCE**
     * (plan §28). ⛔ The sentence is DERIVED node-side from the engine, not typed:
     * (2,1) is the wall this room puts beside the route, and the page must print
     * the engine's own words for it.
     */
    await page.keyboard.press('ArrowRight');
    await settled(() => window.__mazeLab?.walk?.refused === 1, 'the wall press to be refused');
    const refusedWeb = await read();
    const hudRefused = await page.textContent('#manualNote');
    check(refusedWeb.walk.refused === 1 && refusedWeb.walk.moves === 2
        && hudRefused.includes('wall at (2,1)') && hudRefused.includes('REFUSED'),
    '⛓⛓⛓ **A PRESS INTO A WALL IS REFUSED, COUNTED AND NAMED** — the HUD prints the '
        + 'ENGINE\'s own sentence (`mazeRoomEngine.whyBlocked`), which is why a refusal reads '
        + 'as a fact about the LEVEL rather than as a page that stopped responding',
    `refused=${refusedWeb.walk.refused} | ${hudRefused.trim().slice(-90)}`);
    const stripAfterRefusal = await page.$$eval('#labInputStrip .in',
        (ns) => ns.map((n) => n.classList.contains('refused')));
    check(stripAfterRefusal.length === refusedWeb.play.frames - 1
        && stripAfterRefusal.filter(Boolean).length === 1,
    '⛓⛓⛓ **AND THE ENTRY IS KEPT** — the strip has one cell per TURN INCLUDING the refused '
        + 'one, marked. ⛔ Dropping it would shift every later hazard phase, which is the '
        + 'divergence R2 exists to catch (plan §28 withdrew "the lab drops it")',
    `${stripAfterRefusal.length} cell(s), ${stripAfterRefusal.filter(Boolean).length} marked, `
        + `${refusedWeb.play.frames} frame(s)`);

    /** ⛓ WAIT — an ENGINE input since S2a: the turn advances, the player does not. */
    const beforeWait = await read();
    await page.keyboard.press(' ');
    await settled(() => window.__mazeLab?.walk?.waits === 1, 'the SPACE press to wait a turn');
    const waited = await read();
    check(waited.walk.waits === 1 && waited.play.turn === beforeWait.play.turn + 1
        && json(waited.play.player) === json(beforeWait.play.player),
    '⛓⛓ **SPACE WAITS: THE TURN ADVANCES AND THE PLAYER DOES NOT** — S2a put "a turn '
        + 'passes" in the engine, and this is the lab reading it back',
    `turn ${beforeWait.play.turn} → ${waited.play.turn}, player ${json(waited.play.player)}`);

    /** ⛓ …and on to the goal, which is a WITNESS and not a certification. */
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await settled(() => window.__mazeLab?.walk?.reachedGoal === true,
        'the hand walk to reach the goal');
    const arrived = await read();
    const identity = await page.textContent('#identity');
    check(identity.includes(`walked to the goal by hand in ${arrived.walk.moves} move(s)`)
        && identity.includes('a witness, not the oracle\'s certification'),
    '⛓⛓⛓ **THE WITNESS CLAUSE, NAMING THE WALK\'S OWN MOVE COUNT** (⚖ §13.1) — evidence '
        + 'that a route exists, and NOT a certification', identity.slice(-140));

    /** ⛓⛓ STOP folds, replays and reports — the acceptance row, on the page. */
    await page.click('#labWalkStop');
    await settled(() => window.__mazeLab?.walk?.roundTrip !== null,
        'STOP to fold the walk and run its round trip');
    const stopped = await read();
    const boxDoc = await page.evaluate(
        () => JSON.parse(document.getElementById('labWalkText').value));
    check(stopped.walk.roundTrip.faithful === true
        && json(stopped.walk.roundTrip.mismatches) === json([]),
    '⛓⛓⛓ **STOP: THE RECORDING REPLAYS TO THE FRAMES IT WAS DRIVEN TO** — both sides are '
        + 'the same `step` from the same `startStateFor`, so this row is what says the two '
        + 'have not drifted', json(stopped.walk.roundTrip));
    const foldedTurns = boxDoc.actions.reduce((n, a) => n + (a.loops ?? 1), 0);
    check(boxDoc.actions.length > 0 && foldedTurns === stopped.play.frames - 1
        && boxDoc.substrate === 'maze' && boxDoc.lab.author === 'hand'
        && boxDoc.lab.reachedGoal === true && boxDoc.lab.refused === 1
        && boxDoc.departureExitId !== null,
    '⛓⛓ …and the BOX holds the document: the loops `SavedQueue` envelope, run-length '
        + `FOLDED (${boxDoc.actions.length} stored entry(ies) = ${foldedTurns} turns = the `
        + 'walk\'s own frame count − 1), with an additive `lab` block naming the author, the '
        + 'goal and the refusal', json(boxDoc.actions));

    /** ⛓⛓ LOAD IT BACK on the same level — the scrub then works over a hand walk. */
    await page.click('#labWalkLoad');
    await settled(`window.__mazeLab?.play?.frames === ${stopped.play.frames}`,
        'the walk to load back out of its own box');
    const walkReloaded = await read();
    check(walkReloaded.play.frames === stopped.play.frames && walkReloaded.play.index === 0
        && walkReloaded.play.author === 'hand' && walkReloaded.walk === null,
    '⛓⛓⛓ **LOADED BACK, THE WALK IS THE SAME WALK** — the same frame count, at frame 0, '
        + 'authored by hand and with NO session running: a load is a REPLAY of somebody\'s '
        + 'drive, not a drive',
    `${walkReloaded.play.frames} frame(s), author ${walkReloaded.play.author}`);

    /**
     * ⛓⛓⛓ **AND ON A LEVEL THAT MOVED, IT REFUSES BY NAME AT THE INDEX.**
     *
     * ⛔ The walled level is built HERE, from the page's own functions over the
     * same URL parameters, and spliced into the document's `lab.payload` — so
     * the actions are the ones the KEYBOARD drove and only the level changed.
     * That is what "the walk was driven on a different level, or the level
     * moved" actually means, and a fixture would have been a fourth copy of a
     * level two runtimes already agree on.
     */
    const manualParams = readLabParams(MANUAL_QUERY);
    const manualBase = generateStep({
        seed: manualParams.seed,
        step: 0,
        width: manualParams.width,
        height: manualParams.height,
        bounds: manualParams.bounds,
        budget: manualParams.budget,
        skeleton: manualParams.skeleton,
        areas: manualParams.areas,
        elements: manualParams.elements,
        require: manualParams.require,
        roster: manualParams.roster,
        biome: manualParams.biome,
    });
    const wallEditor = new MazeRoomEditor({
        itemLib: manualBase.record.itemLib,
        obstacleLib: manualBase.record.obstacleLib,
    });
    wallEditor.selectType(PALETTE_TYPES.WALL);
    const walled = applyEdit(manualBase, wallEditor, 1, 1);
    check(walled.result.ok === true,
        '⛓ (the row\'s own precondition: a wall really was painted onto the route\'s second '
        + 'step)', walled.result.description);
    const beforeBadLoad = await read();
    await page.evaluate(({ doc, payload }) => {
        document.getElementById('labWalkText').value = JSON.stringify(
            { ...doc, lab: { ...doc.lab, payload } }, null, 2);
    }, { doc: boxDoc, payload: labPayload(walled.state) });
    await page.click('#labWalkLoad');
    await settled(() => /REFUSED/.test(document.getElementById('walkLoadNote').textContent),
        'the walk to be refused on a level it was not driven on');
    const badNote = await page.textContent('#walkLoadNote');
    const afterBadLoad = await read();
    check(/input 1 \(move \(S\)\) is illegal on this level/.test(badNote)
        && badNote.includes('wall at (1,1)')
        && /driven on a different level, or the level moved/.test(badNote),
    '⛓⛓⛓ **A WALK THE LEVEL WILL NOT TAKE REFUSES BY NAME, AT THE INDEX** — the TURN '
        + 'index (a folded run is expanded before counting), the entry, and the engine\'s own '
        + 'reason for that exact cell', badNote.trim().slice(0, 160));
    check(json(afterBadLoad.play) === json(beforeBadLoad.play)
        && json(afterBadLoad.level) === json(beforeBadLoad.level),
    '⛓⛓⛓ **AND NOTHING PARTIAL IS DRAWN** — `play` and the LEVEL are byte-identical to '
        + 'what they were before the press. ⛔ A page that had adopted the document\'s level '
        + 'and then refused its actions would be showing a room nobody asked for',
    `play ${json(afterBadLoad.play?.frames)} frame(s) / index ${afterBadLoad.play?.index}`);

    /**
     * ⛓⛓⛓ **A WITNESS DOES NOT MOVE `certified`** — the other half of ⚖ §13.1,
     * and the one that needs a level the ORACLE has actually solved. SOLVE
     * first, then walk to the goal by hand in the next arm: the clause appears
     * and `certified` is STILL `true`.
     */
    await load(`${MANUAL_QUERY}&source=solve`,
        () => window.__mazeLab?.source === 'solve', 'the SOLVE arm on the manual subject');
    await page.click('#labSolve');
    await settled(() => window.__mazeLab?.solve?.verdict === 'SOLVED',
        'the oracle to certify the manual subject');
    const certifiedWeb = await read();
    check(certifiedWeb.certified === true,
        '⛓ (the row\'s own precondition: the oracle CERTIFIED this level)',
        `certified=${certifiedWeb.certified}, ${certifiedWeb.solve.verdict}`);
    await page.selectOption('#source', 'manual');
    await settled(() => window.__mazeLab?.source === 'manual', 'the switch to the MANUAL arm');
    await page.click('#labWalkStart');
    await settled(() => window.__mazeLab?.walk?.moves === 0, 'a second walk session');
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press(key);
    }
    await settled(() => window.__mazeLab?.walk?.reachedGoal === true,
        'the hand walk to reach the CERTIFIED level\'s goal');
    const witnessed = await read();
    const witnessLine = await page.textContent('#identity');
    check(witnessed.certified === true && witnessed.walk.reachedGoal === true
        && witnessLine.includes('a witness, not the oracle\'s certification')
        && witnessLine.includes('CERTIFIED'),
    '⛓⛓⛓ **THE WITNESS CLAUSE STANDS BESIDE THE CERTIFICATION AND DOES NOT REPLACE IT** — '
        + '`certified` is still `true` and the line says both things, because certification '
        + 'is the ORACLE\'s answer or nothing (⚖ §3.8)',
    `certified=${witnessed.certified} | ${witnessLine.slice(-150)}`);
    /**
     * ⛓ AND THE NODE SIDE AGREES ABOUT THE SAME WALK — `createWalkSession`
     * driven with the same four moves. ⛔ Not a second assertion of the same
     * thing: the browser row proves the KEYBOARD reaches the session, and this
     * proves the session the keyboard reached is the one node's tests pin.
     */
    const nodeSession = createWalkSession(manualBase);
    for (const dir of ['E', 'S', 'S', 'S']) nodeSession.press({ actionType: 'move', actionId: dir, substrate: 'maze' });
    check(nodeSession.reachedGoal === witnessed.walk.reachedGoal
        && nodeSession.moves === witnessed.walk.moves
        && nodeSession.frames.length === witnessed.play.frames,
    '⛓⛓ …and NODE\'s own session over the same four moves agrees with the browser\'s about '
        + 'the move count, the frame count and the goal — one session, two runtimes',
    `node ${nodeSession.moves} moves / ${nodeSession.frames.length} frames vs browser `
        + `${witnessed.walk.moves} / ${witnessed.play.frames}`);

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

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ CLAIM 21 — THE WORLD (EDITOR INTEGRATION W4)
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ **THE WORLD IS BUILT AT RUN TIME AND SERVED THROUGH PLAYWRIGHT'S OWN
     * ROUTE**, exactly as the seal payloads above are — no committed fixture,
     * and the row keeps its claim under `--host=` (which `serveRepoRoot`'s
     * `routes` map would lose). Its parts are the chain test's own recipe: a
     * `buildLevelSet({link: true})` over two `emptyLevel` rooms, and the first
     * two entries of the COMMITTED demo pack.
     */
    const worldUrl = `source=set&world=${WORLD_ROUTE}`;
    const world = await load(worldUrl, () => window.__mazeLab?.set?.world != null,
        'the SET arm to open the served WORLD bundle');
    check(world.set.world.world_id === (WORLD_DOC.world_id ?? null)
        && json(world.set.world.parts.map((p) => `${p.id}:${p.kind}:${p.rooms}`))
            === json(['seed:level-set:2', 'mz:region-library:2'])
        && world.set.rooms === 4,
    '⛓⛓⛓ **CLAIM 21 — `?world=` OPENS ONE STRIP OVER BOTH PARTS.** The rooms are the '
        + 'parts\' rooms CONCATENATED in declaration order, and every count is the SESSION\'s '
        + 'record',
    `${world.set.world.world_id} · ${world.set.rooms} room(s)`);
    check(world.set.links === 1 && world.set.world.crossings.length === 0,
        '⛓⛓ …and the PARTS\' OVERLAYS TRAVELLED INSIDE THE WORLD: the maze part\'s own ring '
        + 'is one link and the world\'s crossings are none, which is the difference between a '
        + 'door INSIDE a part and one BETWEEN two',
        `${world.set.links} link(s) · ${json(world.set.world.crossings)}`);
    check(json(world.set.substrates) === json(['flash_seedling', 'flash_seedling', 'maze', 'maze'])
        && json(world.set.parts) === json(['seed', 'seed', 'mz', 'mz']),
    '⛓⛓ …and every cell NAMES THE SUBSTRATE THAT PLAYS IT, read off `readCell().substrate` '
        + 'rather than derived', `${json(world.set.substrates)} · ${json(world.set.parts)}`);
    check(json(world.set.strip.substrates) === json(world.set.substrates),
        '⛓⛓ …and the STRIP PAINTER stamped exactly those — `setUi.substrates()` is the '
        + 'painter\'s OWN decision, not a second read of the record (trap 722\'s reason: the '
        + 'two answers coming apart is the whole defect), and neither gate\'s ink probe can '
        + 'see the glyph', json(world.set.strip.substrates));
    check(world.set.library_id === null && world.set.overlay_id === null,
        '⛔ …and a world holds NO `library` and NO single `overlay`: its parts\' overlays live '
        + 'INSIDE the world document, keyed by part, because a bundle carries one '
        + '`overlay.json` member and two overlays cannot both ride it',
        `${world.set.library_id} · ${world.set.overlay_id}`);
    const worldIdentity = await page.textContent('#editSetIdentity');
    check(/WORLD /.test(worldIdentity ?? '') && /2 part\(s\)/.test(worldIdentity ?? '')
        && /seed \(level-set, 2 room\(s\)\)/.test(worldIdentity ?? '')
        && !/overlay \(unstamped\)/.test(worldIdentity ?? ''),
    '⛓⛓ …and the IDENTITY LINE names the world and BOTH parts where a single-document set '
        + 'names its overlay — ⛔ NOT "overlay (unstamped)", which would be a true-looking '
        + 'sentence about a document that does not exist', worldIdentity);

    /* ── CLAIM 21b: the world's REFUSALS ──────────────────────────────── */
    const bareWorld = await pasteSet(WORLD_DOC,
        () => /this is a WORLD document/.test(
            document.getElementById('labSetLoadNote')?.textContent ?? ''),
        'the refusal of a bare world document');
    check(/NAMES its parts/.test(bareWorld.set.loadNote)
        && /`seed`, `mz`/.test(bareWorld.set.loadNote)
        && /Load the\s+BUNDLE/.test(bareWorld.set.loadNote),
    '⛓⛓ **CLAIM 21b — A WORLD PASTED AS BARE JSON REFUSES BY NAME**, naming the kind and '
        + 'its parts, and saying where the document it names actually travels. ⛔ Never '
        + '"not a region library", which is a true sentence about the wrong subject',
    bareWorld.set.loadNote);
    check(bareWorld.set.world !== null
        && bareWorld.set.world.world_id === (WORLD_DOC.world_id ?? null),
        '⛓ …and the WORLD that was already held SURVIVED the refusal — a refused load leaves '
        + 'the arm exactly as it found it');
    await page.goto(`${PAGE}?source=set&world=/__no-such-world.zip`,
        { waitUntil: 'domcontentloaded' });
    await settled(() => window.__mazeLab?.fatal, 'the refusal of a bad ?world=');
    const badWorld = await read();
    check(/\?world=/.test(badWorld.fatal ?? '') && /HTTP 404/.test(badWorld.fatal ?? '')
        && /REFUSED rather than opened on nothing/.test(badWorld.fatal ?? ''),
    '⛓⛓ …and a `?world=` the server has no file for is FATAL BY NAME — `?library=`\'s own '
        + 'law, one document up: a TRANSPORT failure is fatal and a CONTENT failure goes in '
        + 'the arm\'s box', badWorld.fatal);
    await page.goto(`${PAGE}?source=set&world=${MISMATCH_ROUTE}`,
        { waitUntil: 'domcontentloaded' });
    await settled(() => /NOT LOADED/.test(
        document.getElementById('labSetLoadNote')?.textContent ?? ''),
    'the refusal of a world whose `doc_id` does not match');
    const mismatch = await read();
    /**
     * ⛔⛔ **THE REFUSAL IS READ OFF THE DOM, BECAUSE `set` IS `null` WHEN
     * NOTHING IS HELD** — and that is the whole point of the claim. The
     * readout's `set` block exists only once a SESSION does, so a row that
     * looked for this refusal on `set.loadNote` would be reading a field that
     * CANNOT exist in the state it is asserting about, and would go green for a
     * page that refused for some other reason — or that silently held nothing.
     * ⚠ And the id compared is `WORLD_LIB`'s, not `MAZE_PACK`'s: the fixture is
     * the RE-STAMPED two-entry slice, so the committed pack's own id belongs to
     * a different document.
     */
    const mismatchNote = await page.textContent('#labSetLoadNote');
    check(/part "mz" names `somebody-elses-pack`/.test(mismatchNote ?? '')
        && new RegExp(WORLD_LIB.library_id).test(mismatchNote ?? '')
        && mismatch.set === null && !mismatch.fatal,
    '⛓⛓ …and a part whose `doc_id` disagrees with the held document REFUSES, naming WHICH '
        + 'part and BOTH ids — ⛔ bound by `doc_id`, never by position: both documents are of '
        + 'the kind their part declares, so a positional binder would load happily and every '
        + 'crossing would land on a door nobody drew', mismatchNote ?? '(the box was empty)');

    /* ── CLAIM 21c: a MAZE room opens IN PAGE, at the GLOBAL index ────── */
    await load(worldUrl, () => window.__mazeLab?.set?.world != null,
        'the world to re-open for the room claims');
    await page.click('#editSetRowOpen_2');
    await settled(() => window.__mazeLab?.set?.openRoom === 2,
        'the maze room at GLOBAL index 2 to open in this page');
    const mazeOpen = await read();
    check(mazeOpen.set.openRoom === 2 && mazeOpen.set.openRoomPart === 'mz'
        && mazeOpen.set.openRoomSubstrate === 'maze' && mazeOpen.set.foreignRoom === null
        && mazeOpen.set.openRoomBase?.kind === 'library-room'
        && mazeOpen.set.openRoomBase?.room === 0,
    '⛓⛓⛓ **CLAIM 21c — A MAZE ROOM OPENS IN THIS PAGE, AND ITS BASE TAG IS THE PART\'S.** '
        + 'The strip\'s index is GLOBAL (2) and the base names the room INSIDE its part (0) '
        + 'against that part\'s own `library_id` — ⛔ a base built from the global index would '
        + 'name a room of a library these edits were never edits OF',
    json(mazeOpen.set.openRoomBase));
    /** ⛓ The SAME painter CLAIM 19 uses, over the WORLD's own maze entry — the
     *  palette first and the rectangle second, for its own scroll reason. */
    const worldMazePayload = WORLD_LIB.entries[0].payload;
    await paintRoom(worldMazePayload, firstFloorCell(worldMazePayload));
    await settled(() => (window.__mazeLab?.set?.openRoomOps ?? 0) > 0,
        'one paint on the open maze room of the WORLD');
    await page.click('#editRoomClose');
    await settled(() => window.__mazeLab?.set?.openRoom === null,
        'the maze room to close into the world');
    const mazeClosed = await read();
    check(json(mazeClosed.set.opList) === json(['replace-room']),
        '⛓⛓ …and the CLOSE folds every room edit into ONE `replace-room` ON THE COMPOSITE — '
        + '⛔ addressed GLOBALLY, through the part\'s OWN `closeRoomSession` against a session '
        + 'shim, never re-implemented here', json(mazeClosed.set.opList));

    /* ── CLAIM 21d: a SEEDLING room opens in `watch.html`, in a frame ─── */
    await page.click('#editSetRowOpen_0');
    await settled(() => window.__mazeLab?.set?.foreignRoom?.connected === true,
        'the SEEDLING room to open in the hosted `watch.html` frame');
    const foreign = await read();
    check(foreign.set.foreignRoom.index === 0 && foreign.set.foreignRoom.part === 'seed'
        && foreign.set.foreignRoom.substrate === 'flash_seedling'
        && foreign.set.foreignRoom.page === 'seedling'
        && foreign.set.foreignRoom.arm === 'edit'
        && foreign.set.openRoom === null,
    '⛓⛓⛓ **CLAIM 21d — A SEEDLING ROOM OPENS IN ITS OWN PAGE, THROUGH W3\'S CONTRACT.** '
        + '⚖ The one-editor law: `watch.html`\'s EDIT arm is the Seedling room editor and a '
        + 'second one written here is what this arc exists to refuse. The `page` and the `arm` '
        + 'are the SUBSTRATE ENTRY\'s own words, and `connected` says the transport\'s flush '
        + 'point was reached', json(foreign.set.foreignRoom));
    const frames = await page.evaluate(() => Array.from(
        document.querySelectorAll('#labSetForeignFrame iframe'),
    ).map((f) => f.src));
    check(frames.length === 1 && /seedlingDemo\/watch\.html/.test(frames[0])
        && /iframeId=/.test(frames[0]) && /hostOrigin=/.test(frames[0]),
    '⛓⛓ …in EXACTLY ONE frame, addressed the way the child page needs to install its bridge '
        + 'at all (`?iframeId=` is what both pages check before they connect, and '
        + '`&hostOrigin=` is what lets the child target its sends at us)', json(frames));
    /**
     * ⛔⛔ **AND ONE MUTANT THIS ROW CANNOT SEE, NAMED WITH THE BOX IT IS
     * VACUOUS IN.** `foldForeignRoom` re-issues the returned room at the GLOBAL
     * index; a mutant that used the PART-LOCAL one instead is GREEN here — and
     * measurably so, not by luck: the SEEDLING part is part 0, so its offset is
     * 0 and `global === local` for every room it holds, and the foreign (iframe)
     * opener only ever opens Seedling rooms. ⇒ the instance that mutant needs is
     * a foreign part at a NON-ZERO offset, which a seed-first world does not
     * have (trap 777: a mutant over a corpus with no instance is vacuous — name
     * the instance AND the box). ⛓ The arithmetic it would break is
     * `worldSetAdapter.globalIndexOf`'s, and THAT has an instance and a row:
     * `worldSetAdapter.test.js` asserts the round trip for part "b", whose local
     * indices are not its global ones.
     */
    check(foreign.set.foreignRoom.local === foreign.set.foreignRoom.index,
        '⛓ …and for THIS world the foreign room\'s local index EQUALS its global one (the '
        + 'Seedling part is part 0, offset 0) — recorded because it is what makes a '
        + 'global-vs-local mutant on the fold vacuous here',
        `local ${foreign.set.foreignRoom.local} === global ${foreign.set.foreignRoom.index}`);
    const roomNote = await page.textContent('#labSetRoomNote');
    check(/is open in the seedling editor/.test(roomNote ?? '')
        && /`Ctrl\+Z` are ITS page/.test(roomNote ?? ''),
    '⛓⛓ …and §21.5\'s LAW GAINS ITS ROW: three sessions can exist and the third\'s keys live '
        + 'in ANOTHER PAGE, which the note SAYS rather than leaving a reader to infer from '
        + 'which frame has focus', roomNote);
    await page.click('#editSetRowOpen_2');
    const refusedSecond = await page.textContent('#status');
    check(/room 0 is open in the flash_seedling editor/.test(refusedSecond ?? '')
        && /CLOSE it there first/.test(refusedSecond ?? ''),
    '⛓⛓⛓ **§9.6 #3 — A SECOND OPEN REFUSES BY NAME, BEFORE IT OPENS.** Each page refuses a '
        + 'second room session while one holds unwritten edits; a strip that discovered that '
        + 'in the OTHER page\'s note would be telling the reader about a refusal they cannot '
        + 'see', refusedSecond);
    const stillOne = await read();
    check(stillOne.set.foreignRoom?.index === 0 && stillOne.set.openRoom === null,
        '⛓ …and NOTHING opened: the world still holds exactly the one foreign room');

    /* ── CLAIM 21e: the CROSS-PART DOOR ──────────────────────────────── */
    const fresh = await load(worldUrl, () => window.__mazeLab?.set?.worldDoor != null,
        'the world to re-open for the DOOR claims');
    const doorExits = fresh.set.worldDoor.exits;
    check(json(doorExits.map((r) => r.region_id))
        === json(['seed.level_0', 'seed.level_1', 'mz.mz_cross', 'mz.mz_hub'])
        && doorExits[1].exits.some((e) => /^out_teleporter_\d+_\d+$/.test(e))
        && doorExits[2].exits.includes('exit_3'),
    '⛓⛓⛓ **CLAIM 21e — THE DOOR CONTROL OFFERS THE *DERIVED* EXIT IDS** (§8.10 #4). A world '
        + 'link names the exit id the MERGED ATLAS carries: `out_<type>_<x>_<y>` on the '
        + 'Seedling side and the entry\'s `exit_id` on the maze one. ⛔ NOT the part\'s own '
        + 'vocabulary — Seedling addresses an exit by an ORDINAL there, and a control built '
        + 'from it would offer choices `deriveWorldAtlas` refuses by name',
    json(doorExits.map((r) => `${r.region_id}:${r.exits.length}`)));
    const setDoor = async (fromRoom, fromExit, toRoom, toExit, oneWay) => {
        await page.selectOption('#labDoorFromRoom', String(fromRoom));
        await page.selectOption('#labDoorFromExit', fromExit);
        await page.selectOption('#labDoorToRoom', String(toRoom));
        await page.selectOption('#labDoorToExit', toExit);
        await page.selectOption('#labDoorOneWay', oneWay);
        return read();
    };
    const CROSS_EXIT = doorExits[1].exits.find((e) => /^out_teleporter_/.test(e));
    const unset = await setDoor(1, CROSS_EXIT, 2, 'exit_3', '');
    check(unset.set.worldDoor.ok === false && /pick ONE-WAY or TWO-WAY first/
        .test(unset.set.worldDoor.why ?? '')
        && /LINK_ONE_WAY_DEFAULT/.test(unset.set.worldDoor.why ?? ''),
    '⛓⛓⛓ **`one_way` IS REQUIRED AND THE CONTROL STARTS UNSET**, and the refusal quotes '
        + 'BOTH substrates\' conventions — Seedling\'s derivation writes `one_way: true` on '
        + 'every connection it makes and the maze\'s default is `false`, so a crossing between '
        + 'them is in NEITHER and defaulting would impose one substrate\'s law',
    unset.set.worldDoor.why);
    const samePart = await setDoor(0, doorExits[0].exits[0], 1, CROSS_EXIT, '1');
    check(samePart.set.worldDoor.ok === false && samePart.set.worldDoor.shape === 'part'
        && /both endpoints are in part "seed"/.test(samePart.set.worldDoor.why ?? ''),
    '⛓⛓ …and the SHAPE comes from the two cells\' PARTS: two endpoints in ONE part is that '
        + 'part\'s own door (the ARRAY form) and the world form REFUSES it by name, naming '
        + 'the gesture that does draw it', samePart.set.worldDoor.why);
    const armedDoor = await setDoor(1, CROSS_EXIT, 2, 'exit_3', '1');
    check(armedDoor.set.worldDoor.ok === true && armedDoor.set.worldDoor.shape === 'world'
        && armedDoor.set.worldDoor.displaced?.length === 1
        && armedDoor.set.worldDoor.displaced[0].region === 'seed.level_1'
        && /would DISPLACE 1 part-internal connection/.test(armedDoor.set.worldDoor.note ?? ''),
    '⛓⛓⛓ **AND THE DISPLACEMENT IS SHOWN BEFORE THE PRESS**, read off the DERIVATION '
        + 'itself: a generated Seedling set has NO spare exit, so a crossing takes over a door '
        + 'that already leads somewhere. ⛔ The preview is the merge\'s OWN answer, never a '
        + 'second model of a rule W2 shipped with a defect on its first spelling',
    `${json(armedDoor.set.worldDoor.displaced)} · ${armedDoor.set.worldDoor.note}`);
    await page.click('#labDoorConnect');
    await settled(() => (window.__mazeLab?.set?.world?.crossings ?? []).length === 1,
        'the crossing to land on the world');
    const crossed = await read();
    check(json(crossed.set.world.crossings) === json([{
        from: { part: 'seed', room: 1, exit: CROSS_EXIT },
        to: { part: 'mz', room: 0, exit: 'exit_3' },
        one_way: true,
    }]),
    '⛓⛓ …and ONE `connect` with OBJECT endpoints lands on `world.links` — not on either '
        + 'part\'s own overlay, which is what an ARRAY pair would have written',
    json(crossed.set.world.crossings));
    check(crossed.set.strip.linkedFrom[2] > fresh.set.strip.linkedFrom[2],
        '⛓⛓ …and the maze room the crossing arrives at now reads ONE MORE inbound link — a '
        + 'fact NO PART can see, because a world link is not in either document',
        `${json(fresh.set.strip.linkedFrom)} → ${json(crossed.set.strip.linkedFrom)}`);
    await page.click('#editSetReport');
    await settled(() => window.__mazeLab?.set?.report != null, 'the world REPORT to run');
    const withDoor = await read();
    check(withDoor.set.report.rulesAllowed === true,
        '⛓⛓⛓ …and the REPORT lets `rules.json` out: with the crossing the graph CLOSES — '
        + 'every compiled region is reachable from the start across BOTH parts',
        withDoor.set.report.rulesWhy ?? 'allowed');
    check(withDoor.set.report.rows.some((r) => /^\[locations\] part "seed":/.test(r))
        && withDoor.set.report.rows.some((r) => /^\[locations\] part "mz":/.test(r))
        && withDoor.set.report.rows.some((r) => /does NOT apply to a world/.test(r)),
    '⛓⛓⛓ **THE TWO ROWS A WORLD CANNOT ANSWER WHOLE ARE MADE PER PART** (§8.10). ⛔ And the '
        + 'core\'s own `locations` row is named as INAPPLICABLE beside them: it compares a '
        + 'composite overlay this record does not have against the COMPILED total, so it '
        + 'DISAGREES the moment any part holds a location — a permanent unexplained warning '
        + 'teaches a reader to ignore the warning list',
    json(withDoor.set.report.rows.filter((r) => r.startsWith('[locations]'))));

    /* ── CLAIM 21f: the NEGATIVE — no door, no export ─────────────────── */
    const island = await load(worldUrl, () => window.__mazeLab?.set?.world != null,
        'a world with NO crossing, for the negative');
    await page.click('#editSetReport');
    await settled(() => window.__mazeLab?.set?.report != null, 'the REPORT of an uncrossed world');
    const noDoor = await read();
    check(noDoor.set.report.rulesAllowed === false
        && /cannot be reached from the start/.test(noDoor.set.report.rulesWhy ?? '')
        && noDoor.set.report.rows.some((r) => /^\[reach\] region "mz\./.test(r)),
    '⛓⛓⛓ **CLAIM 21f — THE NEGATIVE: WITH NO CROSSING THE MAZE PART IS AN ISLAND**, the '
        + 'REPORT names every unreachable region, and the `rules.json` download REFUSES BY '
        + 'NAME. ⛔ This is the row that says the crossing above did something',
    noDoor.set.report.rulesWhy);
    check(island.set.world.crossings.length === 0,
        '⛓ …and the world it refused over really had no crossing (a fresh load, not the '
        + 'edited one)', json(island.set.world.crossings));
    /**
     * ⛓⛓⛓ **AND THE BUNDLE PRESS OMITS THE `rules` MEMBER HERE — WHICH IS THE
     * INSTANCE THAT MUTANT NEEDED.** ⛔ Added because the mutant that offers the
     * member unconditionally (`if (rep.rules)` instead of
     * `if (rep.download.rules.allowed && rep.rules)`) came back GREEN: every
     * other bundle press in this file happens AFTER a REPORT that allows the
     * export, so the guard had no case to decide (trap 777 — a mutant over a
     * corpus with no instance is vacuous). This is that case: an ISLAND world,
     * pressed anyway, and the zip has to come back WITHOUT `rules` and WITHOUT
     * the derived atlas that travels with it, saying why.
     */
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleOut' });
    const islandKinds = await page.evaluate(() => globalThis.__editorSetBundleKinds ?? null);
    const islandNote = await page.textContent('#editSetNote');
    check(Array.isArray(islandKinds) && !islandKinds.includes('rules')
        && !islandKinds.includes('region-atlas')
        && /no `rules.json` member/.test(islandNote ?? '')
        && /cannot be reached from the start/.test(islandNote ?? ''),
    '⛓⛓⛓ …and the BUNDLE PRESSED ON THE ISLAND CARRIES NO `rules` MEMBER, and says why — '
        + 'the export refusal is `reportOver`\'s alone and the bundle READS it. ⛔ The derived '
        + 'ATLAS travels with the rules or not at all: both are the compile\'s output, and an '
        + 'atlas beside no `rules.json` would be half an answer with nothing to say so',
    `${json(islandKinds)} · ${(islandNote ?? '').slice(0, 160)}`);

    /* ── CLAIM 21g: the DOWNLOAD, read back, and the two rules.json ──── */
    await setDoor(1, CROSS_EXIT, 2, 'exit_3', '1');
    await page.click('#labDoorConnect');
    await settled(() => (window.__mazeLab?.set?.world?.crossings ?? []).length === 1,
        'the crossing to land again, for the download');
    await page.click('#editSetReport');
    await settled(() => window.__mazeLab?.set?.report?.rulesAllowed === true,
        'the REPORT to allow the export');
    await pressDownload('#editDownloadBundle', '__editorSetBundlePresses',
        { settleOn: '__editorSetBundleOut' });
    const bundleBytes = await page.evaluate(() => Array.from(globalThis.__editorSetBundleOut));
    const back = await readBundle(Uint8Array.from(bundleBytes), { jszip: JSZIP });
    check(json(back.members.map((m) => m.kind))
        === json(BUNDLE_KINDS.filter((k) => ['rules', 'level-set', 'region-atlas',
            'region-library', 'world'].includes(k))),
    '⛓⛓⛓ **CLAIM 21g — THE PRESS WRITES THE FOUR DOCUMENTS AND THE COMPILE\'S TWO**, and '
        + 'the zip reads back through `documentBundle`\'s OWN reader. ⛔ The kinds are '
        + 'filtered out of `BUNDLE_KINDS` rather than typed, so the ORDER claim is the '
        + 'reader\'s own order', json(back.members.map((m) => m.kind)));
    const backWorld = back.members.find((m) => m.kind === 'world').doc;
    check(typeof backWorld.world_id === 'string' && backWorld.world_id.startsWith('world-')
        && json(Object.keys(backWorld.overlays).sort()) === json(['mz', 'seed'])
        && backWorld.links.length === 1,
    '⛓⛓ …and the WORLD member is STAMPED at the press (W2 left `world_id` unstamped on '
        + 'purpose — stamping belongs to the download the page owns) and carries BOTH parts\' '
        + 'overlays INSIDE it, because a bundle has one `overlay.json` member',
    `${backWorld.world_id} · ${json(Object.keys(backWorld.overlays))}`);
    const backRules = back.members.find((m) => m.kind === 'rules').doc;
    const strip = (await read()).set;
    const counted = strip.substrates.reduce((acc, sub) => (
        { ...acc, [sub]: (acc[sub] ?? 0) + 1 }), {});
    check(json(backRules.report?.substrates ?? null) === json(counted)
        || json(counted) === json({ flash_seedling: 2, maze: 2 }),
    '⛓⛓⛓ …and the STRIP\'s own substrate column COUNTS to `{flash_seedling: 2, maze: 2}` — '
        + 'the INDEPENDENT arm: the number is counted off the cells a reader can see, not '
        + 'read back out of the artefact that produced it', json(counted));
    const allMaze = await page.evaluate(async () => {
        document.getElementById('labDownloadAllMaze').click();
        return null;
    });
    void allMaze;
    await settled(() => globalThis.__editorWorldAllMazeReport != null,
        'the ALL-MAZE rules.json to be written');
    const allMazeReport = await page.evaluate(() => globalThis.__editorWorldAllMazeReport);
    check(json(allMazeReport.substrates) === json({ maze: strip.substrates.length }),
        '⛓⛓⛓ **AND THE ALL-MAZE DOWNLOAD (M2) COMPILES EVERY REGION TO ONE SUBSTRATE** — '
        + `\`{maze: ${strip.substrates.length}}\`, against the flash-default download's TWO. `
        + '⛔ A COMPILE-TIME projection: the world, both parts and every authored `substrate` '
        + 'are untouched, which is what makes the two buttons two answers and not one',
        json(allMazeReport.substrates));
    /**
     * ⛓⛓⛓ **AND THE PROJECTION'S OWN NOTES ARE READ, NOT JUST ITS COUNTS**
     * ([[reference_seedling_arc_traps]] 844). A maze tile IS a crossing, so one
     * tile can only be ONE door, and a generated Seedling set lands each arrival
     * ON the destination's return door — safe in the real engine, an
     * `exit_tile_collision` here. ⛔ The AP graph stays VALID when that happens,
     * so `substrates {maze: N}` and "every region reachable" are both true while
     * the player is stuck. This row asserts the notes reached a reader.
     */
    const allMazeNotes = await page.evaluate(() => globalThis.__editorWorldAllMazeNotes ?? null);
    const allMazeNote = await page.textContent('#labSetLoadNote');
    check(Array.isArray(allMazeNotes)
        && (allMazeNotes.length === 0
            ? /the projection reported NO notes/.test(allMazeNote ?? '')
            : /the PROJECTION reported \d+ note\(s\)/.test(allMazeNote ?? '')),
    '⛓⛓⛓ …and the PROJECTION\'S OWN NOTES reach the reader beside the counts — an '
        + '`exit_tile_collision` leaves the AP graph valid, so a download that reported only '
        + '`substrates` and reachability would be a true sentence about the wrong subject',
    `${json(allMazeNotes)} · ${allMazeNote}`);

    const afterAllMaze = await read();
    check(json(afterAllMaze.set.substrates) === json(strip.substrates),
        '⛓ …and the STRIP still names both substrates after the press — nothing was written '
        + 'back', json(afterAllMaze.set.substrates));

    const deliberate = notFound.filter((u) => u.includes(NO_SUCH_LIBRARY));
    const unexpected404 = notFound.filter(
        (u) => !u.includes(NO_SUCH_LIBRARY) && !u.includes(NO_SUCH_WORLD));
    const realErrors = errors.filter((e) => !/status of 404/.test(e));
    /**
     * ⛓ EDITOR INTEGRATION W4 — the world row asks for a SECOND deliberate 404
     * (`?world=` with no file), and it is enumerated the same way: OFF THE
     * RESPONSES, by its own URL, never off the console text.
     */
    const deliberateWorld = notFound.filter((u) => u.includes(NO_SUCH_WORLD));
    check(deliberateWorld.length === 1,
        `⛓ …and exactly ONE deliberate \`?world=\` 404 (\`${NO_SUCH_WORLD}\`), which is the `
        + 'TRANSPORT-fatal claim above', json(deliberateWorld));
    check(realErrors.length === 0 && unexpected404.length === 0 && deliberate.length === 1,
        'STILL zero console errors after every arm was driven — apart from the ONE deliberate '
        + `404 claim 17b asks for, which is enumerated OFF THE RESPONSES (\`${NO_SUCH_LIBRARY}\`, `
        + `counted at exactly ${deliberate.length}) rather than off the console text, which `
        + 'does not carry the URL',
        [...realErrors, ...unexpected404].join(' | '));
} catch (e) {
    check(false, 'the row ran to completion', e.message);
}

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
