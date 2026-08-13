#!/usr/bin/env node
/**
 * check-seedling-editor-switch — THE IN-PLACE SOURCE SWITCH, AND ITS LEAKS.
 *
 * Switching arms used to be a page NAVIGATION, which meant a document
 * teardown did every arm's cleanup for free. It no longer is. This row is the
 * acceptance for what replaced it — and for the thing the replacement is FOR,
 * which is that your own work survives the switch.
 *
 * ── ⛔ IT BRINGS ITS OWN SERVER, SO IT CANNOT SKIP ─────────────────────
 *
 * The arc's standing lesson (trap 176): the browser rows that SKIPPED when no
 * dev server was up hid a page that could not load AT ALL for two rungs.
 * `--host=` uses an existing server instead, which is a convenience and not an
 * escape.
 *
 * ── ⛓⛓⛓ WHY THE LEAK CLAIMS ARE **BEHAVIOURAL** ──────────────────────
 *
 * `window.__editorLifetime` is the page's own account of what it tore down,
 * and a row that only read it would be asking the suspect for an alibi: a
 * lifetime that never registered a listener reports `listeners: 0` and a
 * lifetime whose listeners leaked reports the same number. The readout is
 * asserted BESIDE a behavioural witness, never instead of one.
 *
 * The witness is `preventDefault`. MANUAL binds keydown on WINDOW and cancels
 * the bound keys while driving, so a synthetic ArrowRight is cancelled by a
 * live driving MANUAL and NOT cancelled once that arm is retired. ⚠ BOTH
 * READINGS ARE TAKEN — cancelled before, uncancelled after — because an
 * "after" reading alone passes just as well when the listener was never
 * registered in the first place, which is the vacuity the whole page is
 * written against.
 *
 * ── THE SIX CLAIMS ────────────────────────────────────────────────────
 *
 *  1. **NO RELOAD** — a stamp put on `window` survives the switch, and the
 *     address bar still describes what is on screen.
 *  2. **THE LOOP STOPS** — a live `manual-frame` is named in the retired
 *     arm's `stopped` list, which is positive evidence it was running AND
 *     that it was guarded (an unguarded loop leaves that list empty).
 *  3. **THE KEYBOARD IS RELEASED** — the before/after `preventDefault`
 *     witness above.
 *  4. **THE CHROME IS CLEARED** — no readout of the arm you left survives to
 *     describe the arm you are in, `window.__editorX` included.
 *  5. **⛓ YOUR WORK IS KEPT** — a sword ticked in SOLVE is still ticked after
 *     SOLVE → MANUAL → SOLVE, the block is the edited one, and the page SAYS
 *     the block is the tab's own rather than the URL's.
 *  6. **NOTHING DOUBLES** — the boot form has one row of controls after three
 *     mounts, not three.
 *
 * Run: node scripts/procgen/check-seedling-editor-switch.mjs
 *      node scripts/procgen/check-seedling-editor-switch.mjs --host=http://localhost:8000
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
const { ITEM_FORM_FIELDS } = await M('watchSolve.js');

const PAGE_PATH = '/frontend/modules/seedlingDemo/watch.html';
/** A committed segment tape, so SOLVE and MANUAL both boot into a real room. */
const BOOT = 'frontend/modules/seedlingDemo/fixtures/tapes/r7-act2-1.json';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

let server = null;
const host = arg('host', '');
if (!host) server = await serveRepoRoot();
const origin = host || `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const finish = async (code) => {
    await browser.close().catch(() => {});
    await closeServer(server);
    process.exit(code);
};

/**
 * Drive the page's own selector, and wait for the ARRIVING arm to finish.
 *
 * ⛔ WAITING ON `__editorArm`, NOT ON THE ARM'S BOX. The first cut of this row
 * waited for `#bootBox` to be non-empty — which is true the instant the
 * switch begins, because keeping that box full across a switch is the feature
 * being tested. The wait returned immediately, the row read the OUTGOING
 * arm's page, and it reported a missing note that the page wrote a moment
 * later. A settle condition that the PREVIOUS state already satisfies is not
 * a wait at all.
 */
const switchTo = async (source) => {
    await page.evaluate(() => { delete window.__editorArm; });
    await page.selectOption('#source', source);
    await page.waitForFunction(
        (s) => window.__editorArm?.source === s, source, { timeout: 120000 });
};

const lifetimes = () => page.evaluate(() => window.__editorLifetime);
const armState = () => page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    detail: document.getElementById('detail').textContent,
    hud: document.getElementById('hud').innerHTML,
    title: document.getElementById('title').textContent,
    url: window.location.search,
    stamp: window.__switchProbe ?? null,
    editorSolve: window.__editorSolve ?? null,
    editorManual: window.__editorManual ?? null,
    bootBox: document.getElementById('bootBox').value,
    bootNote: document.getElementById('bootNote').textContent,
    bootFormControls: document.querySelectorAll('#bootForm input[type=checkbox]').length,
    swordTicked: document.getElementById('bootForm-sword')?.checked ?? null,
}));

/**
 * ⛓ IS ANYTHING ACTUALLY DRAWN? "The arm mounted" and "the level is on
 * screen" are different claims and only the second is item 9 — every readout
 * looks identical either way, so the canvas itself has to be read.
 *
 * ⛔⛔ IT COUNTS **OPAQUE** PIXELS AND **DISTINCT COLOURS**, and the first cut
 * counted neither. It counted pixels differing from the renderer's background
 * `#101014` — and an untouched canvas is transparent BLACK, every channel
 * zero, which differs from `#101014` in all three. So a canvas that had never
 * been drawn on scored 100% and the check passed on exactly the failure it
 * was written to catch. It reported `102400/102400`, which is the tell: a
 * measurement that cannot come out any other way is not a measurement.
 *
 * Alpha separates them cleanly — the renderer's own `fillRect` makes every
 * pixel opaque — and the colour count keeps a single flat fill from passing
 * as a room.
 */
const canvasInk = () => page.evaluate(() => {
    const c = document.getElementById('canvas');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    const colours = new Set();
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 255) {
            opaque += 1;
            colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        }
    }
    return { opaque, colours: colours.size, of: c.width * c.height };
});

/**
 * ⛓ THE KEYBOARD WITNESS. Cancelled means a live MANUAL is listening; not
 * cancelled means nothing on `window` claims the key any more.
 */
const arrowIsSwallowed = () => page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { code: 'ArrowRight', cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
});

try {
    // ── mount SOLVE, and stamp the document ──────────────────────────
    const url = `${origin}${PAGE_PATH}?source=solve&boot=${BOOT}`;
    console.log(`page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('bootBox').value.length > 0,
        null, { timeout: 120000 });
    await page.evaluate(() => { window.__switchProbe = 'the original document'; });

    // ── CLAIM 0 (item 9): the level is DRAWN before anything is pressed ──
    const atMount = await canvasInk();
    check(atMount.opaque === atMount.of && atMount.colours > 3,
        '⛓⛓⛓ SOLVE DRAWS ITS LEVEL ON MOUNT — no press, no ?solve=1, not a black canvas',
        `${atMount.opaque}/${atMount.of} opaque, ${atMount.colours} distinct colours`);

    // ── CLAIM 5a: an edit, made through the page's own form ──────────
    await page.click('#bootForm-sword');
    const edited = await armState();
    check(edited.swordTicked === true, 'the sword box is ticked in SOLVE, and the block took it',
        `block declares hasSword: ${JSON.parse(edited.bootBox).seam?.items?.hasSword}`);
    check(edited.bootFormControls === ITEM_FORM_FIELDS.length,
        'one row of boot-form controls on the first mount',
        `${edited.bootFormControls} control(s)`);

    // ── CLAIM 1: switch to MANUAL without a reload ───────────────────
    await switchTo('manual');
    const inManual = await armState();
    check(inManual.stamp === 'the original document',
        '⛓ THE SWITCH DID NOT RELOAD — the stamp put on window survived it',
        `stamp: ${inManual.stamp ?? '(gone — the document was replaced)'}`);
    check(inManual.url.includes('source=manual'),
        'and the address bar describes what is on screen, so the view is still a link',
        inManual.url);

    // ── CLAIM 4: nothing SOLVE said survived to describe MANUAL ──────
    check(!inManual.editorSolve,
        'window.__editorSolve is GONE — a row asserting on it now would be reading the '
        + 'arm before last', inManual.editorSolve ? 'still present' : 'cleared');
    check(!inManual.title.includes('solving from'),
        'and the title is MANUAL\'s, not the solve it replaced', inManual.title);

    // ── CLAIM 7 (slice 3): ONE BOX, so the block FOLLOWS you ─────────
    check(JSON.parse(inManual.bootBox).seam?.items?.hasSword === true,
        '⛓⛓⛓ THE SHARED BOOT PANEL: the sword ticked in SOLVE is in the block MANUAL is '
        + 'about to drive — one box, one block, and no copying between two of them');
    check(/kept across a SOURCE switch/.test(inManual.bootNote),
        'and MANUAL says the block is the tab\'s own too', inManual.bootNote);
    /**
     * ⛓ IT WAS `readonly` FOR ONE SLICE, and that was the right answer while
     * both arms wrote it and neither read it. Item 7 made it a WRITER — it
     * edits `boot.level` in the block, through the block — so the claim
     * inverts: what has to be true now is that typing a level CHANGES the
     * block, which is asserted with the stepper below.
     */
    check(!(await page.$eval('#bootLevel', (el) => el.readOnly)),
        '⛓ the shared level field is a CONTROL again — it writes boot.level through the '
        + 'block, the way the item checkboxes do');

    // ── CLAIM 3a: drive, so the keyboard and the loop are both LIVE ──
    await page.click('#manualStart');
    await page.waitForFunction(() => /DRIVING/.test(document.getElementById('status').textContent),
        null, { timeout: 120000 });
    const swallowedWhileDriving = await arrowIsSwallowed();
    check(swallowedWhileDriving === true,
        '⛓ THE BEFORE READING: a driving MANUAL cancels ArrowRight, so the witness has a '
        + 'subject (without this the "after" reading below passes vacuously)');

    // ── CLAIMS 2, 3b: switch away while it is driving ────────────────
    await switchTo('solve');
    const swallowedAfter = await arrowIsSwallowed();
    check(swallowedAfter === false,
        '⛓⛓ THE AFTER READING: the retired MANUAL no longer swallows ArrowRight — its '
        + 'window listeners really are gone, and the page can be scrolled again');

    const lt = await lifetimes();
    const retiredManual = (lt.retired ?? []).find((r) => r.name === 'manual');
    check(Boolean(retiredManual), 'the readout names the retired MANUAL arm',
        (lt.retired ?? []).map((r) => `${r.name}#${r.generation}`).join(', '));
    // ⚠ FOUR, not the three on `window`: the boot form's own `input` listener
    // is registered against the same lifetime, and it is the one that would
    // otherwise ACCUMULATE across re-mounts.
    // ⚠ SIX: the three on `window`, the boot form's `input`, and the shared
    // panel's two (`#bootLevel` change, `#bootBox` change). The number is
    // asserted rather than bounded because a listener that stops being
    // registered is as much a defect as one that leaks.
    check(retiredManual?.alive === false && retiredManual?.listeners === 6,
        'it is retired, and it held all six listeners it registered',
        `alive ${retiredManual?.alive}, ${retiredManual?.listeners} listener(s)`);
    check((retiredManual?.stopped ?? []).includes('manual-frame'),
        '⛓⛓ THE LOOP STOPPED, and being NAMED is what proves it was both running and '
        + 'guarded — an unguarded loop leaves this list empty',
        `stopped: [${(retiredManual?.stopped ?? []).join(', ')}]`);
    check(lt.current?.name === 'solve' && lt.current?.alive === true,
        'and exactly one arm owns the page now',
        `${lt.current?.name}#${lt.current?.generation}`);

    // ── CLAIM 5b: the work survived the round trip ───────────────────
    const back = await armState();
    check(back.swordTicked === true,
        '⛓⛓⛓ THE POINT OF THE ARC: the sword ticked before the switch is still ticked '
        + 'after SOLVE → MANUAL → SOLVE');
    check(JSON.parse(back.bootBox).seam?.items?.hasSword === true,
        'and the block in the box is the EDITED one, not the one ?boot= names');
    check(/kept across a SOURCE switch/.test(back.bootNote),
        '⛔ and the page SAYS the block is this tab\'s own — a view showing edits the link '
        + 'does not carry must not look like a view of the link', back.bootNote);

    // ── CLAIM 6: nothing doubled over three mounts ───────────────────
    check(back.bootFormControls === ITEM_FORM_FIELDS.length,
        'the boot form still has ONE row of controls after re-mounting',
        `${back.bootFormControls} control(s), expected ${ITEM_FORM_FIELDS.length}`);

    check(errors.length === 0, 'no page errors across the switch sequence',
        errors.join(' | ') || 'none');

    // ── ⛓⛓⛓ THE BRIDGE (slice 4): GENERATE → SOLVE ──────────────────
    /**
     * A generated room is not in the atlas and not on disk, so the bridge
     * hands the RECORD over in memory. What has to be true afterwards is not
     * "a button was pressed" but that the receiving arm can actually SOLVE the
     * room it was handed — which exercises the composite level source (the
     * generated level AND the atlas behind it) and the scratch-persistence
     * fork in one press.
     *
     * ⚠ seed 1 / count 1 is the cheapest ladder that keeps a template; the
     * arm's cost is O(N²) solves and this row is not where levels get big.
     */
    const genUrl = `${origin}${PAGE_PATH}?source=generate&seed=1&biome=pre-sword&count=1&run=1`;
    console.log(`\npage: ${genUrl}`);
    errors.length = 0;
    await page.goto(genUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.status === 'ok'
        && window.__editorGenerate?.step === 1, null, { timeout: 300000 });
    const generated = await page.evaluate(() => window.__editorGenerated.level);

    await page.evaluate(() => { delete window.__editorArm; });
    await page.click('#genToSolve');
    await page.waitForFunction(() => window.__editorArm?.source === 'solve',
        null, { timeout: 120000 });
    const bridged = await page.evaluate(() => ({
        box: document.getElementById('bootBox').value,
        note: document.getElementById('bootNote').textContent,
        level: document.getElementById('bootLevel').value,
        goals: document.getElementById('solveGoals').textContent,
        url: window.location.search,
    }));
    check(JSON.parse(bridged.box).boot.level === generated.level,
        '⛓ the block SOLVE mounted boots into the GENERATED level',
        `block level ${JSON.parse(bridged.box).boot.level}, generated ${generated.level}`);
    check(/WAS GENERATED IN THIS PAGE/.test(bridged.note) && /a reload loses it/.test(bridged.note),
        '⛔ and the arm SAYS it is holding a room the URL does not name', bridged.note);
    check(!/[?&]boot=/.test(bridged.url) && !/[?&]level=/.test(bridged.url),
        '?boot= and ?level= are dropped — a stale committed tape must not be re-read '
        + 'over the handed level', bridged.url);
    check(/goals=place/.test(bridged.url) && bridged.goals.startsWith('place:'),
        '⛓ the MODEL\'s own goal rode across, so the arm walks the certified question '
        + 'rather than one the census guessed', `${bridged.url} · picker shows ${bridged.goals}`);

    await page.click('#solveGo');
    await page.waitForFunction(() => window.__editorSolve, null, { timeout: 300000 });
    const solved = await page.evaluate(() => window.__editorSolve);
    check(solved.status === 'ok',
        '⛓⛓⛓ AND IT SOLVES IT — the composite level source and the scratch fork, in one '
        + 'press', solved.status === 'ok'
            ? `level ${solved.level}, ${solved.tickCount} ticks`
            : solved.message);
    check(solved.level === generated.level,
        'the solve was of the generated room, not of something the atlas holds',
        `level ${solved.level}`);
    check(errors.length === 0, 'no page errors across the bridge sequence',
        errors.join(' | ') || 'none');

    // ── ⛓⛓ THE LEVEL STEPPER AND THE AUTO-GOAL (items 7 + 10) ────────
    /**
     * The stepper walks the ATLAS'S OWN level list, so what has to be true is
     * that ▶ lands on a level the atlas HAS, that the block says so, that the
     * canvas shows a DIFFERENT room afterwards, and that SOLVE is pressable
     * without a trip to the goal dropdown. ⚠ The canvas comparison is what
     * separates "the number changed" from "the level changed": every readout
     * would move either way.
     */
    await page.goto(`${origin}${PAGE_PATH}?source=solve&boot=${BOOT}`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorArm?.source === 'solve',
        null, { timeout: 120000 });
    errors.length = 0;
    const before = await page.evaluate(() => ({
        level: JSON.parse(document.getElementById('bootBox').value).boot.level,
        goals: document.getElementById('solveGoals').textContent,
        note: document.getElementById('bootNote').textContent,
    }));
    const inkBefore = await canvasInk();
    /**
     * ⛔ BOTH SIDES OF THE LAW, ON TWO REAL LEVELS. The pre-fill is
     * `defaultGoalsFromCensus` — the page's OWN existing rule — and not a
     * second policy: every placement plus the single live exit, and a REFUSAL
     * naming the alternatives when there is not exactly one.
     *
     * ⚠ Level 0 is the overworld and has EIGHT live exits, so it is the
     * refusing case; level 1 has one, so it is the pre-filling case. Asserting
     * only the convenient half is how the first cut of this feature shipped an
     * auto-pick that silently overruled the refusal — `check-seedling-editor-
     * boot.mjs` went red on level 4 and that is what caught it.
     */
    check(before.goals === '—' && /no goals pre-filled/.test(before.note)
        && /8 live exit\(s\)/.test(before.note),
        '⛓⛓⛓ AN AMBIGUOUS LEVEL IS NOT GUESSED AT — level 0 has 8 live exits, so the page '
        + 'refuses and NAMES them', before.note.slice(-120));

    await page.click('#bootNext');
    await page.waitForFunction((l) =>
        JSON.parse(document.getElementById('bootBox').value).boot.level !== l,
    before.level, { timeout: 60000 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
        level: JSON.parse(document.getElementById('bootBox').value).boot.level,
        field: document.getElementById('bootLevel').value,
        note: document.getElementById('bootNote').textContent,
        goals: document.getElementById('solveGoals').textContent,
        x: JSON.parse(document.getElementById('bootBox').value).boot.x,
    }));
    const inkAfter = await canvasInk();
    check(/pre-filled from this level's census/.test(after.note)
        && /SAME default SOLVE would use/.test(after.note),
        '⛓⛓⛓ …AND AN UNAMBIGUOUS ONE IS PRE-FILLED — level 1 has exactly one live exit, so '
        + 'SOLVE is pressable without a trip to the dropdown, from the SAME default the '
        + 'press itself would use', after.note.slice(-90));
    check(after.level > before.level && Number(after.field) === after.level,
        '⛓ ▶ steps to the next level the ATLAS holds, and the block and the field agree',
        `${before.level} → ${after.level}`);
    check(inkAfter.colours !== inkBefore.colours || inkAfter.opaque !== inkBefore.opaque,
        '⛓ and the CANVAS redraws — a different room, not just a different number',
        `${inkBefore.colours} colours → ${inkAfter.colours}`);
    /**
     * ⛔ THREE OUTCOMES, AND THE NOTE MUST NAME WHICH ONE. Only 42 of the
     * atlas's 116 levels have a committed boot, so the common case is the
     * page CHOOSING a cell — which is a convenience and must never read like
     * a position the game used.
     */
    check(/booting at \(/.test(after.note) || /THIS PAGE CHOSE/.test(after.note)
        || /no free cell could be chosen/.test(after.note),
        '⛔ the boot POSITION names its own provenance — committed boot, a cell this page '
        + 'chose, or a stale one it could not replace', after.note);
    if (/THIS PAGE CHOSE/.test(after.note)) {
        check(/not a position the game ever used/.test(after.note),
            '⛔⛔ and a CHOSEN cell says it is a convenience nothing may rest on');
    }
    check(errors.length === 0, 'no page errors across the stepper sequence',
        errors.join(' | ') || 'none');

    // ── ⛓ THE TRACE PANE SCROLLS ITSELF, NOT THE PAGE (item 8) ───────
    /**
     * `scrollIntoView` scrolls EVERY scrollable ancestor, the document
     * included, so following a solve's trace dragged the whole page under the
     * reader once per highlighted row. The witness is the pair: the PANE must
     * move (the active row is still being kept visible) and the DOCUMENT must
     * not (that is the complaint). Asserting only the second would pass on a
     * pane that had stopped following at all.
     */
    {
        // ⛓ `check-seedling-editor-solve.mjs`'s own subject — r7-act2-4's
        // boot into level 4 toward the battery's `goalsFor(4)`. A known-good
        // combination, because this row is testing SCROLLING and has no
        // business discovering a solve that refuses.
        const solveUrl = `${origin}${PAGE_PATH}?source=solve`
            + '&boot=frontend/modules/seedlingDemo/fixtures/tapes/r7-act2-4.json'
            + '&level=4&goals=exit%3A64%2C16&solve=1';
        console.log(`\npage: ${solveUrl}`);
        await page.setViewportSize({ width: 900, height: 500 });
        await page.goto(solveUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__editorSolve?.status === 'ok',
            null, { timeout: 300000 });
        const rows = await page.evaluate(() => document.querySelectorAll('#trace .tr').length);
        check(rows > 1, 'the solve produced a trace with rows to follow', `${rows} row(s)`);

        const moved = await page.evaluate(() => {
            const doc = document.scrollingElement;
            const pane = document.getElementById('trace');
            const scrub = document.getElementById('scrub');
            doc.scrollTop = 0;
            pane.scrollTop = 0;
            // Drive the cursor to the end, which is what walks the highlight
            // down the pane and used to walk the page with it.
            scrub.value = scrub.max;
            scrub.dispatchEvent(new Event('input', { bubbles: true }));
            return { doc: doc.scrollTop, pane: pane.scrollTop,
                scrollable: doc.scrollHeight > doc.clientHeight,
                paneScrollable: pane.scrollHeight > pane.clientHeight };
        });
        check(moved.scrollable && moved.paneScrollable,
            '⚠ both the page and the pane CAN scroll here — otherwise neither half of the '
            + 'claim below has a subject',
            `page ${moved.scrollable}, pane ${moved.paneScrollable}`);
        check(moved.pane > 0,
            '⛓ the PANE followed the active row', `pane scrollTop ${moved.pane}`);
        check(moved.doc === 0,
            '⛓⛓⛓ …AND THE PAGE DID NOT MOVE — no more jumping under the reader',
            `document scrollTop ${moved.doc}`);
        await page.setViewportSize({ width: 1280, height: 720 });
    }

    // ── ⛓ THE ENGINE PICKER (item 11) ────────────────────────────────
    /**
     * ⛔ ASSERTED ON THE LIFETIME, NOT ON `__editorArm`, AND THAT IS A FACT
     * ABOUT THE WASM ARM RATHER THAN A CONVENIENCE. `__editorArm` means "the
     * mount function RETURNED", and `runWasm` does not return until the tape
     * has started — which needs ONE REAL CLICK inside the frame, by design.
     * A row waiting on it here would hang on any machine that HAS the wasm
     * artifact and pass on any machine that does not.
     *
     * ⚠ AND NOTHING IS ASSERTED ABOUT THE ARTIFACT'S PRESENCE. It is
     * gitignored and machine-local: this box has it, CI does not, and a claim
     * that flips on that is a claim about the machine. What is asserted is the
     * SWITCH — a new arm named for its engine, the old one retired, the URL
     * moved — which is true either way.
     */
    const replayUrl = `${origin}${PAGE_PATH}?tape=${BOOT}&side=js`;
    console.log(`\npage: ${replayUrl}`);
    await page.goto(replayUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorArm?.source === 'replay',
        null, { timeout: 120000 });
    check(await page.isVisible('#side'), 'the engine picker is up for REPLAY');
    check((await page.evaluate(() => window.__editorLifetime.current.name)) === 'replay-js',
        'and the live arm is named for its engine',
        await page.evaluate(() => window.__editorLifetime.current.name));

    await page.selectOption('#side', 'wasm');
    await page.waitForFunction(
        () => window.__editorLifetime.current?.name === 'replay-wasm', null, { timeout: 120000 });
    const wasm = await page.evaluate(() => ({
        url: window.location.search,
        retired: window.__editorLifetime.retired.map((r) => r.name),
        frameShown: !document.getElementById('frame').hidden
            && document.getElementById('frame').style.display !== 'none',
    }));
    check(/side=wasm/.test(wasm.url),
        '⛓ the engine picker switched IN PLACE — a new arm named for its engine, and the '
        + 'URL says so', wasm.url);
    check(wasm.retired.includes('replay-js'),
        'and the JS arm was retired rather than left running beside it',
        wasm.retired.join(', '));

    // ── ⛓⛓ AND BACK, WHICH IS WHERE THE IFRAME TEARDOWN SHOWS ────────
    await page.evaluate(() => { delete window.__editorArm; });
    await page.selectOption('#side', 'js');
    await page.waitForFunction(() => window.__editorArm?.source === 'replay',
        null, { timeout: 120000 });
    const backToJs = await page.evaluate(() => ({
        arm: window.__editorLifetime.current.name,
        frameSrc: document.getElementById('frame').getAttribute('src'),
        canvasShown: document.getElementById('canvas').style.display !== 'none',
        retiredWasm: window.__editorLifetime.retired.some((r) => r.name === 'replay-wasm'),
    }));
    check(backToJs.arm === 'replay-js' && backToJs.retiredWasm,
        'switching back retires the wasm arm',
        `${backToJs.arm}, retired: ${backToJs.retiredWasm}`);
    /**
     * ⛓⛓⛓ THE ONE TEARDOWN THE RELOAD WAS ACTUALLY PROTECTING. The wasm side
     * cannot rewind the GAME — `botReset` forgets the tape, not the world — so
     * leaving it must discard the whole runtime. `about:blank` is that, and it
     * is the observable: the iframe is pointed away and the canvas comes back.
     */
    check(backToJs.frameSrc === 'about:blank' && backToJs.canvasShown,
        '⛓⛓⛓ …AND THE RUNTIME IS DISCARDED — the iframe is blanked, which is the whole of '
        + 'what the wasm side needed a page reload for', `src=${backToJs.frameSrc}`);
    check(errors.length === 0 || errors.every((e) => /404/.test(e)),
        'no page errors beyond the wasm artifact\'s own fetches',
        errors.slice(0, 2).join(' | ') || 'none');

    // ── ⛓ THE SELECTOR ROUTE OUT OF GENERATE (item 1) ────────────────
    /**
     * The bridge BUTTONS were the only thing that armed the hand-over, so the
     * obvious route — switch GENERATE → MANUAL with the SOURCE SELECTOR —
     * found an empty boot box, fell back to `?boot=`, and dropped you at the
     * true game start in level 0 with the generated room gone. Two ways of
     * saying the same thing must leave the same state behind, so this row
     * takes the route that was broken.
     */
    await page.goto(genUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorGenerate?.status === 'ok'
        && window.__editorGenerate?.step === 1, null, { timeout: 300000 });
    errors.length = 0;
    await switchTo('manual');
    const viaSelector = await page.evaluate(() => ({
        box: document.getElementById('bootBox').value,
        note: document.getElementById('bootNote').textContent,
        title: document.getElementById('title').textContent,
    }));
    check(JSON.parse(viaSelector.box).boot.level === generated.level,
        '⛓⛓⛓ THE SOURCE SELECTOR KEEPS THE GENERATED LEVEL — not the true start in level 0',
        `block level ${JSON.parse(viaSelector.box).boot.level}, generated ${generated.level}`);
    check(/WAS GENERATED IN THIS PAGE/.test(viaSelector.note),
        'and MANUAL states the provenance on this route too');
    const genInk = await canvasInk();
    check(genInk.opaque === genInk.of && genInk.colours > 3,
        'and MANUAL draws the generated room on mount, before START',
        `${genInk.opaque}/${genInk.of} opaque, ${genInk.colours} distinct colours`);
    check(errors.length === 0, 'no page errors across the selector route',
        errors.join(' | ') || 'none');
} catch (e) {
    check(false, 'the switch sequence ran to completion', e.message);
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
