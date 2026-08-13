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
 * waited for `#solveBoot` to be non-empty — which is true the instant the
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
    solveBox: document.getElementById('solveBoot').value,
    solveNote: document.getElementById('solveNote').textContent,
    solveFormControls: document.querySelectorAll('#solveForm input[type=checkbox]').length,
    swordTicked: document.getElementById('solveForm-sword')?.checked ?? null,
}));

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
    await page.waitForFunction(() => document.getElementById('solveBoot').value.length > 0,
        null, { timeout: 120000 });
    await page.evaluate(() => { window.__switchProbe = 'the original document'; });

    // ── CLAIM 5a: an edit, made through the page's own form ──────────
    await page.click('#solveForm-sword');
    const edited = await armState();
    check(edited.swordTicked === true, 'the sword box is ticked in SOLVE, and the block took it',
        `block declares hasSword: ${JSON.parse(edited.solveBox).seam?.items?.hasSword}`);
    check(edited.solveFormControls === ITEM_FORM_FIELDS.length,
        'one row of boot-form controls on the first mount',
        `${edited.solveFormControls} control(s)`);

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
    check(retiredManual?.alive === false && retiredManual?.listeners === 4,
        'it is retired, and it held all four listeners it registered — the three on window '
        + 'plus the boot form\'s',
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
    check(JSON.parse(back.solveBox).seam?.items?.hasSword === true,
        'and the block in the box is the EDITED one, not the one ?boot= names');
    check(/kept across a SOURCE switch/.test(back.solveNote),
        '⛔ and the page SAYS the block is this tab\'s own — a view showing edits the link '
        + 'does not carry must not look like a view of the link', back.solveNote);

    // ── CLAIM 6: nothing doubled over three mounts ───────────────────
    check(back.solveFormControls === ITEM_FORM_FIELDS.length,
        'the boot form still has ONE row of controls after re-mounting',
        `${back.solveFormControls} control(s), expected ${ITEM_FORM_FIELDS.length}`);

    // ── and no errors anywhere in the sequence ───────────────────────
    check(errors.length === 0, 'no page errors across the whole sequence',
        errors.join(' | ') || 'none');
} catch (e) {
    check(false, 'the switch sequence ran to completion', e.message);
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
await finish(failed ? 1 : 0);
