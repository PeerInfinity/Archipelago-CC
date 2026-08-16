#!/usr/bin/env node
/**
 * check-seedling-editor-edit — THE CONSTRUCTIVE-MODE SLICE 11 ACCEPTANCE ROW:
 * **free tile / object editing on watch.html, and its two laws.**
 *
 * ⚖ Kickoff §3.8 (ruling 8) — an edited level's IDENTITY is the PAYLOAD (the
 * URL carries no edits and the page says so), and editing NEVER bypasses the
 * oracle (any edit ⇒ visibly UNCERTIFIED until SOLVE says otherwise).
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * `serveRepoRoot` on a free port, shut down on every path, no skip condition
 * (trap 176). `--host=` reuses an existing server, which is a convenience and
 * not an escape. It also registers ONE extra route: an EDITED payload this
 * file builds in node, which claim 8 loads back through `?gen=`.
 *
 * ── ⛓⛓⛓ WHY IT IS ITS OWN ROW AND NOT MORE OF `-generate` ─────────────
 *
 * `check-seedling-editor-generate.mjs` is 158 checks over five slices and a
 * single browser context; every claim there is about a level the LOOP
 * produced. This one is about levels the loop DID NOT produce — a room with a
 * hand-painted wall, a room with a body no template placed, a room the world
 * refuses to build at all — and three of its claims deliberately leave the
 * page in a state the other row's `settled()` helper would never wait for
 * (uncertified, still-frame, no tape). Separate contexts, separate exit code.
 *
 * ── ⛓ EVERY VALUE CLAIM IS COMPUTED IN NODE FIRST (trap 269) ──────────
 *
 * A page that copied its `edits` parameter into a readout and into a payload
 * while ignoring it would satisfy every ECHO claim. So the anchors here are
 * node's own answers for the SAME construction —
 * `generateWithDirectives({seed, biome, step, edits})` — and the browser's
 * record, trace and refusal text are compared against them BYTE for BYTE.
 *
 * ── THE CLAIMS ────────────────────────────────────────────────────────
 *
 *  1. **PAINT** — a wall at a MEASURED non-sealing cell: the record's terrain
 *     there reads `wall` (read off the page's own payload by node's
 *     `terrainAt`), the identity line says "1 manual edit(s)" AND that the URL
 *     has stopped being a reproduction, the pane says UNCERTIFIED, the
 *     readout's `certified` is `null`, and the URL is CHARACTER FOR CHARACTER
 *     what it was before the click.
 *  2. **SOLVE re-certifies** — the oracle is asked, says SOLVED, and the pane
 *     says CERTIFIED.
 *  3. **A SEALING paint is REFUSED by the ORACLE** — two walls that seal the
 *     START (a hand paint bypasses `refusalAt` BY DESIGN: that rule adjudicates
 *     TEMPLATE anchors), and the page prints the solver's own sentence,
 *     character for character against node's.
 *  4. **PLACE / REMOVE an entity** — a `pushableblock` at a free cell, then
 *     gone; ⛓ and the record after the REMOVE is byte-identical to the record
 *     before the PLACE while the EDIT LIST holds TWO ops — the identity is the
 *     ops, not the diff.
 *  5. **UNDO** — two paints, one undo, one paint left, and the record equals
 *     node's fold of the shorter list.
 *  6. **THE PAYLOAD IS THE REPRODUCTION** — `#genDownload`'s own object
 *     (`window.__editorGenerated`) carries the literal ops and a `level`
 *     byte-identical to node's, which is the cross-runtime claim surviving
 *     editing.
 *  7. **`?gen=` OF AN EDITED PAYLOAD** — served by this row's own server,
 *     reproduced in the browser: `payloadCheck.agrees === true`, the edit count
 *     is back, and the level is UNCERTIFIED whatever the file claimed.
 *  8. **STEP with edits present RESETS and SAYS so.**
 *  9. **A directed ATTEMPT with edits present is REFUSED BY NAME** and the
 *     level does not move.
 * 10. **AN ENGINE THROW IS DISPLAYED, NOT FATAL** — a hand-placed entity the
 *     class table has never heard of: the page shows `LevelWorldError` with the
 *     engine's own message, stays alive, and reports UNCERTIFIED.
 *
 * Run: node scripts/procgen/check-seedling-editor-edit.mjs
 *      node scripts/procgen/check-seedling-editor-edit.mjs --host=http://localhost:8000
 */

import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeServer, serveRepoRoot } from './serveRepoRoot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { displaySolve, generateStep, generateWithDirectives } = await M('watchGenerate.js');
const { terrainAt } = await M('procgenLevel.js');
const { normalizeEdit } = await M('watchEdit.js');

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
const EDITED_ROUTE = '/__edited-payload.json';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};
const json = (v) => JSON.stringify(v);

/**
 * ⛓⛓⛓ THE SUBJECT, AND ALL FOUR OF ITS CELLS ARE **MEASURED** BELOW.
 *
 * `pre-sword seed 3 at target 2` — a two-template ladder (`pit-patch`,
 * `pit-patch`) whose open interior leaves room for every op. ⛔ Each cell's
 * defining property is ASSERTED before any claim uses it (trap 235: a subject
 * that agrees with its fallback cannot fail):
 *
 *   `PAINT_OK`   painting WALL here still SOLVES — so claim 2's re-certification
 *                is about the oracle and not about a room that was already dead.
 *   `SEAL`       painting WALL at BOTH of these seals the START into its corner,
 *                and the oracle REFUSES. ⛔ The two cells are the start's only
 *                orthogonal neighbours, computed from the model's own start.
 *   `FREE`       holds ground and no entity — a place/remove subject.
 *   `BAD_TYPE`   a type `ENTITY_CLASSES` does not hold, so `buildLevelWorld`
 *                throws `LevelWorldError` (asserted in node before the browser
 *                is asked to display it).
 */
/**
 * ⛓⛓⛓ **RE-PICKED AT PROCGEN ELEMENTS ARC 3 SLICE 2 — 3 → 4, AND THE FAILURE
 * MODE IS WORTH RECORDING.** The door law moved every pre-sword level, and seed
 * 3 at target 2 now keeps a `wall-gap-block` whose wall runs through **(2,1)** —
 * which is `SEAL[0]`. ⛔ In NODE every assertion above still passed: an explicit
 * `paint wall` op is applied whether or not the cell was already wall, so
 * `nodeSeal` still REFUSED and every node check was green. In the BROWSER the
 * click is a NO-OP by trap 263's own rule (*painting the terrain a cell already
 * holds is not an edit*), the edit count never reached 1, and the row **hung on
 * `settledEdits(1)` for the full 300 s timeout** — a STUCK wait, not a failed
 * assertion.
 *
 * ⛓ SO THE SUBJECT'S REAL PRECONDITION WAS NEVER WRITTEN DOWN: the SEAL cells
 * must be GROUND *in the browser's starting record*, or the claim cannot even be
 * driven. Re-scanned (pre-sword, target 2, seeds 3..8) for a seed where (2,1)
 * AND (1,2) AND (8,8) AND (6,6) are all ground and entity-free, the (8,8) paint
 * still SOLVES, the SEAL pair is REFUSED and the (6,6) place SOLVES: **4, 6 and
 * 8 all qualify; 4 is taken** (8's goal IS (2,1), which would make the seal
 * subject the goal cell wearing another name). It keeps `wall-segment(ori=v,
 * len=5)` + `wall-segment(ori=v,len=4)`, goal (6,2). The precondition is now
 * ASSERTED below rather than assumed.
 */
const SUBJECT = { seed: 4, biome: 'pre-sword', count: 2 };
const PAINT_OK = { tx: 8, ty: 8 };
const FREE = { tx: 6, ty: 6 };
const BAD_TYPE = 'notathing';

const nodeBase = generateStep({ ...SUBJECT, step: SUBJECT.count });
const START = { tx: 1, ty: 1 };
const SEAL = [{ tx: START.tx + 1, ty: START.ty }, { tx: START.tx, ty: START.ty + 1 }];
/**
 * ⛔ THE PRECONDITION THE HANG TAUGHT (arc 3 slice 2): both SEAL cells must hold
 * GROUND in the state the browser starts from. A cell that is already wall makes
 * the paint click a NO-OP, the edit count never advances, and the row STALLS on
 * a `waitForFunction` instead of failing a claim — the least readable failure a
 * browser row can have.
 */
for (const c of SEAL) {
    check(terrainAt(nodeBase.record, c.tx, c.ty) === 'ground',
        `⛔ the SEAL cell (${c.tx},${c.ty}) is GROUND before the paint — a cell already `
        + 'holding wall would make the click a NO-OP and hang the row rather than fail it',
        terrainAt(nodeBase.record, c.tx, c.ty));
}

const op = (o) => normalizeEdit(o);
const PAINT_OP = op({ op: 'paint', ...PAINT_OK, terrain: 'wall' });
const SEAL_OPS = SEAL.map((c) => op({ op: 'paint', ...c, terrain: 'wall' }));
const PLACE_OP = op({ op: 'place', ...FREE, type: 'pushableblock', attrs: {} });
const REMOVE_OP = op({ op: 'remove', ...FREE });
const BAD_OP = op({ op: 'place', ...FREE, type: BAD_TYPE, attrs: {} });

const withEdits = (edits) => generateWithDirectives({
    seed: SUBJECT.seed, biome: SUBJECT.biome, step: SUBJECT.count, edits,
});
const solveOf = (state) => {
    try {
        return { verdict: displaySolve(state).verdict, threw: null };
    } catch (e) {
        return { verdict: null, threw: e };
    }
};

// ── node's own answers, and the subjects' own properties ──────────────

console.log(`node: seed ${SUBJECT.seed} target ${SUBJECT.count} keeps `
    + `${nodeBase.summary.kept.map((k) => k.template).join(', ')}; goal `
    + `(${nodeBase.model.goalCell.tx},${nodeBase.model.goalCell.ty})`);

check(json(nodeBase.edits) === '[]',
    '⛓ a plain ladder state carries an EMPTY edit list — one shape for every reader');

const nodePaint = withEdits([PAINT_OP]);
check(terrainAt(nodeBase.record, PAINT_OK.tx, PAINT_OK.ty) === 'ground'
    && terrainAt(nodePaint.record, PAINT_OK.tx, PAINT_OK.ty) === 'wall',
    `⛓ the PAINT subject (${PAINT_OK.tx},${PAINT_OK.ty}) is GROUND before and WALL after — `
    + 'a cell that was already a wall would make claim 1 pass on a click that did nothing');
check(solveOf(nodePaint).verdict === 'SOLVED',
    '⛓ …and the painted room still SOLVES, so claim 2\'s re-certification is about the '
    + 'ORACLE and not about a room that was already dead');

const nodeSeal = withEdits(SEAL_OPS);
const sealSolve = solveOf(nodeSeal);
check(sealSolve.verdict === 'REFUSED',
    `⛓ the SEALING subject (${SEAL.map((c) => `${c.tx},${c.ty}`).join(' + ')}) — the START's `
    + 'own two orthogonal neighbours — is REFUSED by the oracle. ⛔ It is NOT refused by '
    + '`refusalAt`: that rule adjudicates TEMPLATE anchors and a hand paint bypasses it BY '
    + 'DESIGN (free means free; certification is the guard)', sealSolve.verdict);
const SEAL_REASON = displaySolve(nodeSeal).reasonText;
check(typeof SEAL_REASON === 'string' && SEAL_REASON.length > 20,
    '⛓ …and node holds its VERBATIM reason text, which the page must print character for '
    + 'character', SEAL_REASON?.slice(0, 70));

const nodePlace = withEdits([PLACE_OP]);
const nodePlaceRemove = withEdits([PLACE_OP, REMOVE_OP]);
check(nodePlace.record.entities.length === nodeBase.record.entities.length + 1
    && solveOf(nodePlace).verdict === 'SOLVED',
    `⛓ the FREE subject (${FREE.tx},${FREE.ty}) takes a pushableblock and the room still `
    + 'SOLVES', `${nodeBase.record.entities.length} → ${nodePlace.record.entities.length}`);
check(json(nodePlaceRemove.record) === json(nodeBase.record)
    && nodePlaceRemove.edits.length === 2,
    '⛔⛔ …and PLACE-then-REMOVE returns the RECORD to the recipe\'s bytes while the EDIT '
    + 'LIST holds TWO ops — the identity is the OPS, not the diff');

const badSolve = solveOf(withEdits([BAD_OP]));
check(badSolve.threw?.name === 'LevelWorldError',
    `⛓ the BAD-TYPE subject ("${BAD_TYPE}") makes the WORLD throw LevelWorldError — the class `
    + 'the page\'s catch is bounded by; a row that passed on any throw would pass on a '
    + 'TypeError the page must NOT swallow', badSolve.threw?.name ?? badSolve.verdict);
const BAD_MESSAGE = badSolve.threw?.message ?? '';

/**
 * ⛓⛓ CLAIM 7's PAYLOAD, BUILT IN NODE. Same shape `#genDownload` writes; the
 * page fetches it, REGENERATES from its seed/biome/bounds and replays its
 * EDITS, then compares. ⚠ `certified: true` is in it ON PURPOSE — a file's own
 * certification is somebody else's assertion, and the page must load the level
 * UNCERTIFIED anyway.
 */
const editedPayload = {
    generator: 'scripts/procgen/check-seedling-editor-edit.mjs',
    seed: SUBJECT.seed,
    biome: SUBJECT.biome,
    bounds: nodePaint.bounds,
    roster: nodePaint.roster ?? null,
    directives: [],
    edits: [PAINT_OP],
    certified: true,
    skeleton: nodePaint.skeleton,
    level: nodePaint.record,
    trace: nodePaint.trace,
};

// ── the browser ───────────────────────────────────────────────────────

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot();
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 12 — THE PAYLOAD ROUTE IS FULFILLED BY **PLAYWRIGHT**
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⛔ THE DEFECT THIS ENDS, MEASURED BY THE ORCHESTRATOR: the edited payload was
 * a `serveRepoRoot({routes})` entry, so under `--host=` — where this row reuses
 * a server it did not start — `/__edited-payload.json` did not exist, the page
 * fetched a 404, and claim 6 sat in a `waitForFunction` until its **300 s**
 * timeout. A row that loses claims under one of its own modes is a row whose
 * green means two different things.
 *
 * ⇒ the route is intercepted at the BROWSER instead, which needs no server at
 * all and is therefore identical in both modes. ⚠ The predicate matches on the
 * PATHNAME rather than as a glob: the page is loaded at
 * `?gen=/__edited-payload.json`, so a `**\/…` glob matches the DOCUMENT's own
 * URL and serves the JSON as the page (measured on the maze row — it reads as a
 * STUCK wait with no console error to attribute it).
 */
await page.route(
    (u) => u.pathname === EDITED_ROUTE,
    (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: `${json(editedPayload)}\n`,
    }),
);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

/** ⛔ WAIT FOR THE PAGE TO STOP, NOT FOR IT TO START — `busy()` is the marker. */
const settledEdits = (n) => page.waitForFunction(
    (k) => window.__editorGenerate?.edits === k
        && !document.getElementById('genRunAll').disabled,
    n, { timeout: 300000 });

const load = async (search) => {
    await page.goto(`${origin}${PAGE_PATH}?${search}`, { waitUntil: 'domcontentloaded' });
    await settledEdits(0);
};

const read = () => page.evaluate(() => ({
    gen: window.__editorGenerate,
    watch: window.__watch,
    payload: window.__editorGenerated,
    url: window.location.search,
    detail: document.getElementById('detail').textContent,
    status: document.getElementById('status').textContent,
    cert: document.getElementById('genEditCert').textContent,
    editRows: [...document.querySelectorAll('#genEdits .eRow')].map((e) => e.textContent),
}));

/**
 * ⛓⛓⛓ THE CANVAS RECTANGLE IS RE-READ BEFORE **EVERY** CLICK — §10.5's own
 * lesson, paid for once on the maze page: the identity line sits above the
 * canvas and GROWS as edits accumulate, so it re-wraps, the header gets taller
 * and the canvas moves DOWN. A rectangle captured before the first edit puts
 * the second click a row too high, and it surfaces as a STUCK wait rather than
 * as a wrong cell, because the editor happily paints a tile nobody asserted on.
 *
 * ⛔ AND THE TARGET IS THIS FILE'S OWN ARITHMETIC over the LAST PIXEL of the
 * cell — trap 257: an off-by-one is invisible to a middle-of-tile click, and a
 * fixed point cannot gate a VALUE (trap 250). Nothing here calls `tileAtPoint`.
 */
const clickCell = async (cell) => {
    const geo = await page.evaluate(() => {
        document.getElementById('canvas').scrollIntoView({ block: 'center' });
        const r = document.getElementById('canvas').getBoundingClientRect();
        return {
            left: r.left, top: r.top, width: r.width, height: r.height,
            cols: window.__editorGenerated.level.width,
            rows: window.__editorGenerated.level.height,
        };
    });
    const x = ((cell.tx + 1) * geo.width) / geo.cols - 1;
    const y = ((cell.ty + 1) * geo.height) / geo.rows - 1;
    const landsOn = {
        tx: Math.floor((x * geo.cols) / geo.width),
        ty: Math.floor((y * geo.rows) / geo.height),
    };
    if (json(landsOn) !== json(cell)) {
        check(false, `⛔ this file's own arithmetic puts the click in ${json(landsOn)}, not `
            + `${json(cell)} — the geometry moved and the claim below would be about the `
            + 'wrong cell');
    }
    await page.mouse.click(geo.left + x, geo.top + y);
};

const selectTool = (tool) => page.selectOption('#genEditTool', tool);

try {
    /* ══ CLAIM 1 — PAINT, and the two laws in one press ══════════════ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    const before = await read();
    check(json(before.payload.level) === json(nodeBase.record),
        '⛓ the browser\'s starting level IS node\'s, byte for byte — the anchor every claim '
        + 'below moves away from');
    check(before.gen.edits === 0 && json(before.gen.editList) === '[]'
        && before.gen.certified === true,
        '⛓ …and it starts with NO edits and a CERTIFIED display solve',
        `edits ${before.gen.edits}, certified ${before.gen.certified}`);
    check(!/manual edit/.test(before.detail) && !/NOT a reproduction/.test(before.detail),
        '⛓ …and the identity line says nothing about edits — a clause on every line is a '
        + 'clause a reader stops reading');

    await selectTool('paint');
    await page.selectOption('#genEditTerrain', 'wall');
    check(await page.evaluate(() => window.__editorGenerate.editTool) === 'paint',
        '⛓ selecting a tool ARMS it, and the readout says which',
        await page.evaluate(() => window.__editorGenerate.editTool));
    await clickCell(PAINT_OK);
    await settledEdits(1);
    const painted = await read();

    check(terrainAt(painted.payload.level, PAINT_OK.tx, PAINT_OK.ty) === 'wall',
        `⛓⛓⛓ THE VALUE CLAIM: the PAGE'S OWN RECORD now reads \`wall\` at `
        + `(${PAINT_OK.tx},${PAINT_OK.ty}) — read out of the payload by node's \`terrainAt\`, `
        + 'never off a readout the page could have echoed (trap 269)');
    check(json(painted.payload.level) === json(nodePaint.record),
        '⛓⛓⛓ …and the WHOLE record is node\'s `generateWithDirectives({edits})`, byte for '
        + 'byte — the cross-runtime determinism claim, SURVIVING an edit');
    check(json(painted.gen.editList) === json([PAINT_OP])
        && json(painted.payload.edits) === json([PAINT_OP]),
        '⛓ the recorded op is the LITERAL one, in the readout and in the payload',
        json(painted.gen.editList));
    check(/, then 1 manual edit\(s\)/.test(painted.detail),
        '⛓⛓ THE IDENTITY LINE names the third leg, in its order',
        painted.detail.slice(0, 90));
    check(/the URL is NOT a reproduction of this construction — it names the LADDER alone/
        .test(painted.detail),
    '⛓⛓⛓ ⚖ RULING 9, SAID ON THE PAGE: the URL has stopped being a reproduction. ⛓ SLICE 12 '
        + 'dropped "after edits" from the wording and widened the trigger — a DIRECTIVE now '
        + 'raises the same clause, because the bar carries neither leg');
    check(painted.url === before.url,
        '⛔⛔ AND THE URL IS CHARACTER FOR CHARACTER WHAT IT WAS — the writer never learned '
        + 'about edits', painted.url);
    check(!/edit/i.test(painted.url),
        '⛔ …and it carries no edit parameter under any spelling');
    check(painted.gen.certified === null,
        '⛓⛓ THE CERTIFICATION IS `null` — ⚠ trap 262: NOBODY HAS ASKED about the room now on '
        + 'screen, which is not "the oracle said no"', json(painted.gen.certified));
    check(/UNCERTIFIED — 1 edit\(s\) since the last solve; press SOLVE/.test(painted.cert),
        '⛓⛓⛓ AND THE PANE SAYS SO, in the brief\'s own words', painted.cert.slice(0, 80));
    check(painted.watch.edits === 1,
        '⛓ `window.__watch.edits` is the REAL count — the one line slice 4 named',
        json(painted.watch.edits));
    check(json(painted.editRows) === json([`e1${' '}EDIT paint `
        + `(${PAINT_OK.tx},${PAINT_OK.ty}) → wall`]),
        '⛓ the EDIT LOG carries one row, in the brief\'s own spelling',
        json(painted.editRows));

    /* ══ CLAIM 2 — SOLVE re-certifies ════════════════════════════════ */

    await page.click('#genEditSolve');
    await page.waitForFunction(() => window.__editorGenerate?.certified !== null
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    const certified = await read();
    check(certified.gen.certified === true && certified.gen.verdict === 'SOLVED',
        '⛓⛓⛓ SOLVE CERTIFIES THE EDITED LEVEL — the same oracle the loop uses, over the '
        + 'record on screen', `${certified.gen.verdict} / ${json(certified.gen.certified)}`);
    check(/CERTIFIED — the oracle SOLVED this exact record/.test(certified.cert),
        '⛓ …and the pane says so', certified.cert.slice(0, 70));
    check(certified.gen.edits === 1 && certified.url === before.url,
        '⛔ …and certifying moved neither the edit list nor the URL');

    /* ══ TRAP 263 — a click that CHANGED NOTHING is not an edit ══════ */

    await page.selectOption('#genEditTerrain', 'ground');
    await clickCell(FREE);
    await page.waitForFunction(() => /changed\s+NOTHING/.test(
        document.getElementById('status').textContent), null, { timeout: 300000 });
    const noop = await read();
    check(noop.gen.edits === 1 && noop.gen.certified === true,
        '⛓⛓⛓ TRAP 263: painting GROUND on a ground cell moved NEITHER the count NOR the '
        + 'certification — ⚖ §3.8 is a law about CHANGES, and the maze page paid for this '
        + 'one already (§10.6 defect 2)',
        `edits ${noop.gen.edits}, certified ${json(noop.gen.certified)}`);
    check(/changed NOTHING, so it is not an edit/.test(noop.status),
        '⛓ …and it SAID so rather than doing nothing quietly', noop.status.slice(0, 80));

    /* ══ CLAIM 3 — a SEALING paint, REFUSED by the ORACLE ════════════ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    await selectTool('paint');
    await page.selectOption('#genEditTerrain', 'wall');
    await clickCell(SEAL[0]);
    await settledEdits(1);
    await clickCell(SEAL[1]);
    await settledEdits(2);
    const sealed = await read();
    check(json(sealed.payload.level) === json(nodeSeal.record),
        '⛓ the SEALED room is node\'s, byte for byte — two paints, replayed across runtimes');
    check(sealed.gen.certified === null,
        '⛓ …and nothing has solved it yet: an edit never certifies itself');
    await page.click('#genEditSolve');
    await page.waitForFunction(() => window.__editorGenerate?.certified !== null
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    const refused = await read();
    check(refused.gen.certified === false && refused.gen.verdict === 'REFUSED',
        '⛓⛓⛓ THE ORACLE REFUSES THE SEALED ROOM — ⚠ trap 262 again: `false` is "the oracle '
        + 'said no", and this is the first build in which it is reachable at all',
        `${refused.gen.verdict} / ${json(refused.gen.certified)}`);
    check(refused.gen.certification?.reasonText === SEAL_REASON,
        '⛓⛓⛓ …and the reason is the SOLVER\'S OWN TEXT, character for character against '
        + 'node\'s', (refused.gen.certification?.reasonText ?? '').slice(0, 70));
    check(refused.cert.includes(SEAL_REASON),
        '⛓⛓ …and the PANE prints it VERBATIM rather than a paraphrase',
        refused.cert.slice(0, 80));
    check(refused.gen.drewStill === true,
        '⛓ …and the room is drawn as a STILL FRAME — a refused level has no tape to scrub');

    /* ══ CLAIM 4 — PLACE, then REMOVE ═══════════════════════════════ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    const entitiesBefore = nodeBase.record.entities.length;
    await selectTool('place');
    await page.fill('#genEditType', 'pushableblock');
    await page.fill('#genEditAttrs', '{}');
    await clickCell(FREE);
    await settledEdits(1);
    const placed = await read();
    check(placed.payload.level.entities.length === entitiesBefore + 1
        && json(placed.payload.level) === json(nodePlace.record),
        '⛓⛓ PLACE adds exactly one body, at node\'s own bytes',
        `${entitiesBefore} → ${placed.payload.level.entities.length}`);
    check(placed.gen.certified === null,
        '⛓ …and the level is UNCERTIFIED again — every op drops it');
    await selectTool('remove');
    await clickCell(FREE);
    await settledEdits(2);
    const removed = await read();
    check(json(removed.payload.level) === json(nodeBase.record),
        '⛓⛓ REMOVE puts the RECORD back to the recipe\'s bytes exactly');
    check(removed.gen.edits === 2 && json(removed.payload.edits) === json([PLACE_OP, REMOVE_OP]),
        '⛔⛔ …while the EDIT LIST holds BOTH ops — the identity is the construction, not the '
        + 'diff, so a level that came back by hand is not a level that never left',
        json(removed.payload.edits));

    /* ══ CLAIM 5 — UNDO ═════════════════════════════════════════════ */

    await page.click('#genEditUndo');
    await settledEdits(1);
    const undone = await read();
    check(json(undone.payload.level) === json(nodePlace.record)
        && json(undone.payload.edits) === json([PLACE_OP]),
        '⛓⛓⛓ UNDO IS THE FOLD, NOT AN INVERSE — one op popped, the record RE-FOLDED from the '
        + 'recipe, and it is byte-identical to a level that never had the removed op');
    check(undone.gen.certified === null,
        '⛔ …and UNDO does NOT restore a certification: the oracle has still not been asked '
        + 'about the room now on screen');
    await page.click('#genEditUndo');
    await settledEdits(0);
    const empty = await read();
    check(json(empty.payload.level) === json(nodeBase.record) && empty.gen.edits === 0,
        '⛓ …and undoing to zero returns the RECIPE\'s own record');
    check(!/manual edit/.test(empty.detail) && !/NOT a reproduction/.test(empty.detail),
        '⛓ …and the identity line drops both clauses with the last edit');

    /* ══ CLAIM 6+7 — the payload IS the reproduction, through ?gen= ══ */

    check(json(editedPayload.edits) === json([PAINT_OP]),
        '⛓ the payload this row serves carries the literal op — the same object '
        + '`#genDownload` writes (`window.__editorGenerated`)');
    await page.goto(`${origin}${PAGE_PATH}?gen=${EDITED_ROUTE}`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.payloadCheck
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    const loaded = await read();
    check(loaded.gen.payloadCheck?.checked === true
        && loaded.gen.payloadCheck?.agrees === true,
        '⛓⛓⛓ `?gen=` OF AN EDITED PAYLOAD REPRODUCES IT BYTE-IDENTICALLY — the ladder, then '
        + 'the edits, through the ONE fold, in the other runtime',
        json(loaded.gen.payloadCheck?.differences ?? []));
    check(loaded.gen.edits === 1 && json(loaded.payload.edits) === json([PAINT_OP])
        && json(loaded.payload.level) === json(nodePaint.record),
        '⛓ …and the level it drew IS the edited one');
    check(loaded.gen.certified === null,
        '⛔⛔ …and it is UNCERTIFIED whatever the file claimed — the payload this row served '
        + 'says `certified: true`, which is somebody else\'s assertion about a room this '
        + 'page has not solved', json(loaded.gen.certified));

    /* ══ CLAIM 8 — STEP with edits present RESETS and SAYS so ═══════ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    await selectTool('paint');
    await page.selectOption('#genEditTerrain', 'wall');
    await clickCell(PAINT_OK);
    await settledEdits(1);
    await page.click('#genStep');
    await page.waitForFunction(() => window.__editorGenerate?.edits === 0
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    const stepped = await read();
    check(stepped.gen.edits === 0 && stepped.gen.step === 1,
        '⛓⛓ STEP with edits present RESETS to the skeleton and climbs one rung — the prefix '
        + 'property does NOT cross a hand edit', `step ${stepped.gen.step}`);
    check(json(stepped.payload.level) === json(generateStep({ ...SUBJECT, step: 1 }).record),
        '⛓ …and the level is the plain ladder\'s step 1, byte for byte — the edits are gone');

    /* ══ CLAIM 9 — a directed ATTEMPT with edits present is REFUSED ══ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    await selectTool('paint');
    /**
     * ⚠ THE TERRAIN IS SELECTED EXPLICITLY, and this line is a defect my own
     * row found: it was absent on the first cut, so the picker sat at its
     * default (`ground`, the first of `TERRAIN_NAMES`) and the click painted
     * ground onto a ground cell. That PASSED before trap 263's rule landed —
     * the claim was riding on a click that changed NOTHING — and the moment a
     * no-op stopped counting, the wait for `edits === 1` timed out and named
     * it. ⛔ A subject whose defining property is a UI default nobody set is
     * exactly the shape that passes for the wrong reason.
     */
    await page.selectOption('#genEditTerrain', 'wall');
    await clickCell(PAINT_OK);
    await settledEdits(1);
    const beforeAttempt = await read();
    await page.click('#genRoster button[data-attempt]');
    await page.waitForFunction(() => /REFUSED/.test(
        document.getElementById('status').textContent), null, { timeout: 300000 });
    const attempted = await read();
    check(/REFUSED: the level on screen carries 1 manual edit\(s\)/.test(attempted.status),
        '⛓⛓⛓ A DIRECTED ATTEMPT ON AN EDITED LEVEL IS REFUSED **BY NAME**, before it spends '
        + 'a solve', attempted.status.slice(0, 100));
    check(/UNDO the edits, or download the payload first/.test(attempted.status),
        '⛓ …and it names the way out');
    check(attempted.gen.directives.length === 0
        && json(attempted.payload.level) === json(beforeAttempt.payload.level),
        '⛔ …and the level on screen did not move');

    /* ══ CLAIM 10 — an ENGINE THROW is displayed, not fatal ═════════ */

    await load(`source=generate&seed=${SUBJECT.seed}&count=${SUBJECT.count}&run=1`);
    await selectTool('place');
    await page.fill('#genEditType', BAD_TYPE);
    await page.fill('#genEditAttrs', '{}');
    await clickCell(FREE);
    await settledEdits(1);
    const bad = await read();
    check(bad.gen.status === 'ok' && json(bad.payload.edits) === json([BAD_OP]),
        '⛓ the EDIT itself LANDED — `withEntities` validates a shape, never a type, and the '
        + 'record holds the body', json(bad.payload.edits));
    check(/the room would not even BUILD/.test(bad.status)
        && bad.status.includes(BAD_MESSAGE),
        '⛓⛓ …and the STILL FRAME could not be drawn, with the builder\'s own message',
        bad.status.slice(0, 100));
    await page.click('#genEditSolve');
    await page.waitForFunction(() => window.__editorGenerate?.certified !== null
        && !document.getElementById('genRunAll').disabled, null, { timeout: 300000 });
    const badSolved = await read();
    check(badSolved.gen.certified === false
        && badSolved.gen.engineError?.name === 'LevelWorldError',
        '⛓⛓⛓ AN ENGINE THROW IS CAUGHT **AT THE PAGE** AND SHOWN AS UNCERTIFIED, by the '
        + 'error\'s own NAME — the oracle\'s catch is untouched (traps 171/173) and this one '
        + 'is bounded by the class AND by "the record carries edits"',
        json(badSolved.gen.engineError?.name));
    check(badSolved.gen.engineError?.message === BAD_MESSAGE,
        '⛓⛓ …with the engine\'s message VERBATIM against node\'s',
        (badSolved.gen.engineError?.message ?? '').slice(0, 80));
    check(/the world REFUSED to BUILD this record\. LevelWorldError/.test(badSolved.cert),
        '⛓ …and the pane says which of the two failures it was: the world would not BUILD '
        + 'it, not the solver could not BEAT it', badSolved.cert.slice(0, 90));
    check(badSolved.gen.verdict === null,
        '⛔ …and there is no verdict, because the oracle never got to answer');

    /* ══ the page survived all of it ════════════════════════════════ */

    await page.click('#genEditUndo');
    await settledEdits(0);
    const alive = await read();
    check(alive.gen.status === 'ok' && alive.gen.certified === true,
        '⛔⛔ THE PAGE SURVIVED THE ENGINE THROW — one UNDO later it is back on a certified '
        + 'level, which a fatal would have made unreachable',
        `${alive.gen.status} / ${json(alive.gen.certified)}`);
    check(errors.length === 0,
        '⛔ and NOTHING threw to the console across the whole row — a page that survived by '
        + 'swallowing would still have said so here', errors.slice(0, 3).join(' | '));
} catch (e) {
    check(false, 'the row itself threw', e.stack || e.message);
}

console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
