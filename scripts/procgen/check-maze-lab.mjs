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
const { generateStep, serializeMazeLevel } = await MAZE('mazeLab.js');

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
    check(one.identity.includes('the URL is NOT a reproduction after edits'),
        '⚖ ruling 9: the page SAYS the URL stopped being a reproduction');
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
    check(sealed.certified === false && sealed.identity.includes('UNCERTIFIED'),
        '⚖ §3.8: an edit DROPS the certification — editing never bypasses the oracle',
        sealed.identity);
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
        'a REFUSED solve leaves the level UNCERTIFIED — a refusal is a NO, not a record');

    /* ── CLAIM 7: the payload round-trips through the page ────────── */
    const beforeLoad = await read();
    await page.click('#labLoad');
    await settled(() => window.__mazeLab?.source === 'solve', 'the reload from the save box');
    const reloaded = await read();
    check(json(reloaded.level) === json(beforeLoad.level),
        '⛓ the payload the save box holds LOADS BACK to the same world, tile for tile',
        `${json(reloaded.level).length} bytes`);
    check(reloaded.certified === false,
        '⛔ and a LOADED level is UNCERTIFIED whatever the file claimed — this page\'s '
        + 'certification is its own oracle\'s answer or nothing');

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
    const sealDirective = `wall-segment(ori=${PRECHECK.ori},len=${PRECHECK.len})`
        + `@1s!${PRECHECK.tx},${PRECHECK.ty}`;
    const sealedRun = await load(`seed=${PRECHECK.seed}&skeleton=winding&count=0`
        + `&directed=${encodeURIComponent(sealDirective)}`,
    () => window.__mazeLab?.directives?.length === 1, 'the sealing directive to be applied');
    const sd = sealedRun.directives[0];
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

    check(errors.length === 0, 'STILL zero console errors after every arm was driven',
        errors.join(' | '));
} catch (e) {
    check(false, 'the row ran to completion', e.message);
}

// eslint-disable-next-line no-console
console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
