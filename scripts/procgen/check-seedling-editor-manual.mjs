#!/usr/bin/env node
/**
 * check-seedling-editor-manual — THE EDITOR ARC SLICE 3 ACCEPTANCE ROW.
 *
 * Does the PAGE, in a browser, record a hand-driven session that replays
 * frame-for-frame — and do the pasted tape, `?tick=` and `?shot=` do what
 * the docblock says they do?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 *
 * `watchManual.test.js` already asserts both round trips against the same
 * `createManualSession`/`foldRoundTrip`/`parseTapeText` the page calls, in
 * node, in CI. It is the row that proves the DERIVATION.
 *
 * This is the row that proves the PAGE'S PATH TO IT, which is the unshared
 * part and the part that has broken before (⛔ slice 1 found `watch.html`
 * unloadable for TWO RUNGS behind an exit-0 skip): the module graph loading
 * in a browser at all, REAL KEY EVENTS reaching the held set, the rAF pacer
 * driving `run.advance`, the textarea round-tripping bytes, and `?shot=1`'s
 * readiness contract firing on a DOM attribute a headless waiter can see.
 *
 * ⚠ THE DRIVE IS SCRIPTED THROUGH REAL `keyboard.down`/`keyboard.up`, not
 * by calling into the page. A test that poked `session.step` would prove the
 * module works — which the vitest rows already prove — and would say nothing
 * about the listeners, the `preventDefault`, or the pacer.
 *
 * ⚠ SCREENSHOTS ARE EVIDENCE, NOT GATES (kickoff §5). Every check below is a
 * ledger fact. `--shot=<dir>` writes PNGs for a human or an agent to look at.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * every other seedling probe — ⚠ slice 4 owns the ruling that this arc ends
 * with a browser gate that does NOT skip (kickoff §8.9).
 *
 * Run: node scripts/procgen/check-seedling-editor-manual.mjs
 *      node scripts/procgen/check-seedling-editor-manual.mjs --host=http://localhost:8003
 *      node scripts/procgen/check-seedling-editor-manual.mjs --shot=/tmp/shots
 */

/**
 * ⚠ FROM `@playwright/test`, NOT FROM `playwright` — `package.json` PINS the
 * former and FLOATS the latter, and only the pinned one's browser build is
 * in `~/.cache/ms-playwright` after a plain `npm ci`. Slice 1's own note.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⛔⛔ SLICE 9 — THE ROSTER, IMPORTED, AND WHY THIS ROW NOW READS IT RATHER
 * THAN COUNTING TO A LITERAL.
 *
 * This check asserted **eleven** from slice 6 until slice 9 found it. Slice 8
 * took the roster to TWELVE and replaced the literal in `-overlays`, `-shapes`
 * and `-lanes` — trap 62's "replace, never relax" — and never touched this
 * one, so the row was RED from `8eb641b12` onwards and nobody saw it: the
 * script SKIPs without a dev server and no CI job starts one.
 *
 * ⇒ the literal stays (relaxing it to `>= 11` would be exactly the failure
 * trap 62 is about) AND it is now tied to the module's own roster, across the
 * runtime boundary the page cannot be imported over — `SEAM_SIGNATURE`'s
 * shape. A layer added tomorrow moves BOTH halves at once, so the row cannot
 * silently drift again.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const { LAYER_IDS } = await import(
    join(HERE, '..', '..', 'frontend/modules/seedlingDemo/watchOverlays.js'));

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const SHOT = arg('shot', '');
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';
const PAGE = `${HOST}/frontend/modules/seedlingDemo/watch.html`;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

const alive = await fetch(`${HOST}/${TAPES}/index.json`).then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

async function open(url) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    // ⚠ WITH THE RESOURCE URL — a bare "Failed to load resource: 404" names
    // nothing, so a row that wanted to allow ONE expected 404 could only
    // allow them all.
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return { page, errors };
}

/** Hold a set of physical keys for `ms` of wall clock, then release them. */
async function holdFor(page, codes, ms) {
    for (const c of codes) await page.keyboard.down(c);
    await page.waitForTimeout(ms);
    for (const c of codes) await page.keyboard.up(c);
}

// ── ROW 1: MANUAL — a hand-driven session that REPLAYS frame-for-frame ───

{
    /**
     * ⚠ THE ROOM AND THE SCRIPT ARE BOTH CHOSEN, AND BOTH FOR THE SAME
     * REASON: a wall-clock-paced drive records a tick count nobody can
     * predict, so nothing here may depend on where the player ends up.
     *
     * The room is `r8-hammer-control`'s L18. Two earlier cuts died on real
     * refusals from L4 — a LETHAL PIT at `speed=4`, then WATER in L3 (an
     * unpinned `sound` hazard) at `speed=1` — each a legitimate refusal and
     * each a flaky row. L18 survives a script THREE TIMES longer than this
     * one, measured, so wall-clock jitter cannot reach an edge.
     *
     * The script oscillates: every hold is answered by its opposite, so net
     * displacement is ~0 however many ticks the machine manages. The claim
     * is not the walk — it is that whatever was driven replays identically.
     *
     * ⛓ And L18 has two live spinners, so the LIVE damage/enemy layers are
     * exercised by a room that can actually hit back.
     */
    const url = `${PAGE}?source=manual&boot=${TAPES}/r8-hammer-control.json&speed=1`;
    const { page, errors } = await open(url);
    console.log(`\n## SOURCE=MANUAL — driven by real key events\n   ${url}`);

    await page.waitForSelector('#manualStart:not([disabled])', { timeout: 60000 });
    /**
     * ⛓ SWITCH SLICE 3: SOLVE and MANUAL now share ONE boot panel and differ
     * only in the ACTIONS beside it, so "the right panel is up" is two facts
     * rather than one — the shared block is there, and the buttons are this
     * arm's. Asserting only the first would pass under SOLVE.
     */
    check(await page.isVisible('#bootPanel') && await page.isVisible('#manualActions')
        && !(await page.isVisible('#solveActions')),
        'the shared boot panel is up with MANUAL\'s actions, and SOLVE\'s are not');
    check(!(await page.isVisible('#solvePanel')) && !(await page.isVisible('#replayPick')),
        'and the other two arms are hidden — one panel per source');

    await page.click('#manualStart');
    await holdFor(page, ['ArrowRight'], 250);
    await holdFor(page, ['ArrowLeft'], 250);
    await holdFor(page, ['KeyX'], 60);
    await page.waitForTimeout(100);
    await holdFor(page, ['ArrowDown'], 200);
    await holdFor(page, ['ArrowUp'], 200);
    await holdFor(page, ['ArrowRight', 'KeyC'], 120);
    await holdFor(page, ['ArrowLeft'], 120);

    const driving = await page.evaluate(() => ({
        status: document.getElementById('status').textContent,
        hud: document.getElementById('hud').textContent,
        toggles: document.querySelectorAll('#layers input').length,
    }));
    check(/DRIVING/.test(driving.status) && /tick\(s\) recorded/.test(driving.status),
        'the page reports a LIVE drive with its tick count', driving.status);
    /**
     * ⛔ THE LITERAL IS GONE (R9 slice 13). This line read `driving.toggles ===
     * 15 && driving.toggles === LAYER_IDS.length` — a typed cardinality
     * standing beside the derivation that already answered it, so adding a
     * layer reddened the row for the one reason it was never meant to catch.
     * Trap 572's cure applied where it was found: the DERIVATION is the claim,
     * and what it asserts is that the page mounts one toggle per roster entry.
     */
    /**
     * ⛔⛔ AND THE LABEL SAID **FIFTEEN** WHILE THE ROSTER WAS SIXTEEN — trap
     * 573 caught live, by this slice's own sweep for the literal above. Once
     * the assertion derived, the row went green with a label that had gone
     * FALSE, which is the one part of a gate that can do that silently. The
     * number now comes from the expression the assertion uses.
     */
    check(driving.toggles === LAYER_IDS.length,
        `the ${LAYER_IDS.length} layer toggles are mounted over the LIVE drive too, and they `
        + 'ARE the roster',
        `${driving.toggles} toggle(s), roster ${LAYER_IDS.length}`);
    if (SHOT) await page.screenshot({ path: `${SHOT}/manual-driving.png` });

    await page.click('#manualStop');
    await page.waitForFunction(() => window.__editorManual?.roundTrip !== undefined,
        null, { timeout: 60000 });
    const m = await page.evaluate(() => window.__editorManual);

    check(m.ticks > 20, '⛓ REAL KEY EVENTS DROVE REAL TICKS — the listeners, the '
        + 'preventDefault and the rAF pacer are all in the path',
        `${m.ticks} tick(s) driven, ${m.observations} observation(s)`);
    /**
     * ⛓⛓⛓ THE ROW THE SLICE EXISTS FOR. The manual loop is a PRODUCER beside
     * `solveForPage`; what makes that legal rather than a second replay loop
     * is that what it produces means, to the ONE reader, exactly what it
     * meant while being produced.
     */
    check(m.roundTrip === true && m.faithful === true && m.mismatches.length === 0,
        '⛓⛓⛓ THE FOLD REPLAYS FRAME-FOR-FRAME — every observation and every '
        + 'held set identical',
        m.roundTrip
            ? `${m.observations} driven == ${m.frames} replayed, 0 mismatch(es)`
            : JSON.stringify(m.mismatches.slice(0, 4)));
    // ⚠ THE DRIVE MUST NOT HAVE REFUSED. A refused session round-trips too
    // (its refusal reproduces — see the vitest row), but this row's subject
    // is a COMPLETE drive, and a script that started refusing would quietly
    // become a much weaker check.
    check(m.refusal === null && m.error === null,
        'and the drive completed — no refusal, and the replay threw nothing',
        m.refusal ? `refused at t${m.refusal.tick}: ${m.refusal.message}` : 'clean');
    check(m.inputs.length > 0 && m.inputs.length < m.ticks,
        '⛓ the ONE FOLD really compressed — this is not a per-tick dump',
        `${m.inputs.length} span(s) for ${m.ticks} tick(s)`);

    // The folded tape is handed to the page's own REPLAY arm and lands in
    // the save box — which is the whole of "save v1" (⚖ §1.3).
    const saved = await page.evaluate(() => ({
        text: document.getElementById('tapeText').value,
        name: document.getElementById('tapeName').textContent,
        frames: window.__editorOverlays?.frames ?? null,
    }));
    const savedTape = JSON.parse(saved.text);
    check(savedTape.tick_count === m.ticks && savedTape.tape_version === 8,
        'STOP put the folded tape in the SAVE box',
        `${savedTape.name}: ${savedTape.tick_count} ticks, v${savedTape.tape_version}`);
    check(m.clears >= 0 && typeof m.clears === 'number',
        'and the drive\'s own earned-clear count rode out with it',
        `${m.clears} clear(s)`);
    check(saved.frames === m.frames,
        'and the page is now SCRUBBING that tape through the REPLAY arm',
        `${saved.frames} frame(s)`);
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    if (SHOT) await page.screenshot({ path: `${SHOT}/manual-folded.png` });
    await page.close();
}

// ── ROW 2: a PASTED committed tape == the picker's copy ─────────────────

{
    /**
     * ⛔ THE COMPARISON IS BETWEEN TWO PAGE LOADS, not between the page and
     * a node derivation. "The paste path produces the same frames as the
     * fetch path" is the claim; running one of them in node would be
     * comparing the paste path against something no user ever sees.
     */
    const url = `${PAGE}?tape=${TAPES}/r8-hammer-control.json&side=js`;
    const { page, errors } = await open(url);
    console.log(`\n## PASTE — the same tape, through the textarea\n   ${url}`);
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });
    const fetched = await page.evaluate(() => ({
        frames: window.__editorOverlays.frames,
        markers: JSON.stringify(window.__editorOverlays.markers),
        channels: JSON.stringify(window.__editorOverlays.channels),
        text: document.getElementById('tapeText').value,
    }));

    // Paste the SAME bytes back in and press Load. The page must replay it
    // in place — a pasted tape has no path to navigate to.
    await page.evaluate((text) => {
        const box = document.getElementById('tapeText');
        box.value = text;
        document.getElementById('tapeLoad').click();
    }, fetched.text);
    await page.waitForFunction(() => window.__editorLoaded, null, { timeout: 180000 });
    const pasted = await page.evaluate(() => ({
        frames: window.__editorOverlays.frames,
        markers: JSON.stringify(window.__editorOverlays.markers),
        channels: JSON.stringify(window.__editorOverlays.channels),
        loaded: window.__editorLoaded,
        note: document.getElementById('tapeNote').textContent,
    }));

    check(pasted.frames === fetched.frames,
        'the pasted tape replays to the SAME frame count',
        `fetched ${fetched.frames}, pasted ${pasted.frames}`);
    check(pasted.markers === fetched.markers,
        '⛓ …and the SAME overlays, marker for marker',
        `${JSON.parse(pasted.markers).length} marker(s), identical`);
    check(pasted.channels === fetched.channels,
        '…and the same sampled mover channels', pasted.channels);
    check(/r8-hammer-control/.test(pasted.note),
        'the page names what it loaded and from where', pasted.note);

    // ⛔ AND A MALFORMED PASTE REFUSES WITH THE PARSER'S OWN MESSAGE.
    await page.evaluate(() => {
        document.getElementById('tapeText').value = '{"game":"seedling","name":"nope"}';
        document.getElementById('tapeLoad').click();
    });
    const refusal = await page.evaluate(() =>
        document.getElementById('tapeNote').textContent);
    check(/REFUSED \(tape\)/.test(refusal) && /tape/.test(refusal),
        '⚠ a malformed tape REFUSES with the parser\'s own message',
        refusal.slice(0, 160));
    const notJson = await page.evaluate(() => {
        document.getElementById('tapeText').value = 'this is not json';
        document.getElementById('tapeLoad').click();
        return document.getElementById('tapeNote').textContent;
    });
    check(/REFUSED \(json\)/.test(notJson),
        '…and "not JSON at all" is a DIFFERENT fact from "not a tape"',
        notJson.slice(0, 120));

    const unexpected = errors.filter((e) => !e.includes('r8-hammer-control.trace.json'));
    check(unexpected.length === 0, 'no page errors beyond the expected sidecar 404',
        unexpected.join(' | ') || `clean (${errors.length} expected sidecar 404)`);
    await page.close();
}

// ── ROW 3: ?tick=N lands the cursor AND the overlays ────────────────────

{
    const AT = 247;
    const url = `${PAGE}?tape=${TAPES}/r8-hammer-control.json&side=js&tick=${AT}`;
    const { page, errors } = await open(url);
    console.log(`\n## ?tick=${AT}\n   ${url}`);
    await page.waitForFunction(() => window.__editorShot?.ready, null, { timeout: 180000 });
    const at = await page.evaluate(() => ({
        shot: window.__editorShot,
        cursor: Number(document.getElementById('scrub').value),
        play: document.getElementById('play').textContent,
        hud: document.getElementById('hud').textContent,
    }));
    check(at.cursor === AT && at.shot.tick === AT,
        '?tick= lands the cursor exactly', `cursor ${at.cursor}, readout ${at.shot.tick}`);
    // ⚠ `textContent` CONCATENATES WITHOUT SEPARATORS — the HUD reads
    // "tick247 / 324level18…", so `\b247\b` never matches (k and 2 are both
    // word characters). Anchored on the row's own shape instead.
    check(at.hud.replace(/\s+/g, ' ').startsWith(`tick${AT} /`),
        'and the HUD is showing that tick', at.hud.replace(/\s+/g, ' ').slice(0, 40));
    check(at.play === 'Play',
        '⛓ …PAUSED there. Landing and then playing forward would make the '
        + 'parameter a flicker', `button says "${at.play}"`);
    /**
     * ⛓ THE OVERLAYS ARE AT N TOO, and that is the half a cursor check
     * misses. `r8-hammer-control`'s ONE damage marker is at tick 247 (slice
     * 2's row), and markers are drawn only at or before the cursor — so it
     * being VISIBLE at 247 and INVISIBLE at 246 is the statement that the
     * whole overlay stack landed with the cursor.
     */
    const visible = (t) => page.evaluate((tick) => {
        const s = document.getElementById('scrub');
        s.value = String(tick);
        s.dispatchEvent(new Event('input'));
        return window.__editorOverlays.markers
            .filter((m) => m.layer === 'damage' && m.tick <= tick).length;
    }, t);
    check(await visible(AT) === 1 && await visible(AT - 1) === 0,
        '⛓ the OVERLAYS land at N as well — the damage marker is in at 247, out at 246',
        `at ${AT}: 1, at ${AT - 1}: 0`);

    // Out of range CLAMPS AND SAYS SO.
    await page.close();
    const { page: p2 } = await open(
        `${PAGE}?tape=${TAPES}/r8-hammer-control.json&side=js&tick=99999`);
    await p2.waitForFunction(() => window.__editorShot?.ready, null, { timeout: 180000 });
    const over = await p2.evaluate(() => ({
        shot: window.__editorShot,
        detail: document.getElementById('detail').textContent,
    }));
    check(over.shot.tick === over.shot.frames - 1 && /past the last frame/.test(over.detail),
        '⚠ an out-of-range ?tick= clamps AND SAYS SO',
        `landed at ${over.shot.tick} of ${over.shot.frames}`);
    const unexpected = errors.filter((e) => !e.includes('r8-hammer-control.trace.json'));
    check(unexpected.length === 0, 'no page errors beyond the expected sidecar 404',
        unexpected.join(' | ') || 'clean');
    await p2.close();
}

// ── ROW 4: ?shot=1 — the CLI's readiness contract ───────────────────────

{
    /**
     * ⛓ THIS SLICE'S CONSUMER FOR `?shot=1`. Slice 4's exporter is the real
     * one; a parameter nobody reads is trap 119, so the contract is exercised
     * HERE, exactly as the CLI will exercise it: wait on the DOM attribute
     * with no page evaluation, then assert the readout.
     */
    const AT = 120;
    const url = `${PAGE}?tape=${TAPES}/r8-solve-18.json&side=js&tick=${AT}`
        + '&shot=1&layers=player,enemies,damage';
    const { page, errors } = await open(url);
    console.log(`\n## ?shot=1 — the readiness signal slice 4 waits on\n   ${url}`);

    // ⛔ THE WAIT THE CLI WILL ACTUALLY DO: a selector, not an evaluation.
    await page.waitForSelector('body[data-shot-ready="1"]', { timeout: 180000 });
    const shot = await page.evaluate(() => ({
        readout: window.__editorShot,
        cursor: Number(document.getElementById('scrub').value),
        // Non-blank canvas: a painted frame has more than one distinct pixel
        // value. NOT a pixel assertion about WHAT was drawn — that is
        // evidence, and this is only "something was".
        painted: (() => {
            const c = document.getElementById('canvas');
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            const seen = new Set();
            for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
            return { colours: seen.size, w: c.width, h: c.height };
        })(),
    }));
    check(shot.readout.ready === true && shot.readout.requested === true,
        'the readiness flag fires, and says it was ASKED for',
        JSON.stringify({ ready: shot.readout.ready, requested: shot.readout.requested }));
    check(shot.readout.tick === AT && shot.cursor === AT,
        'the tick the CLI asked for is the tick that was drawn',
        `readout ${shot.readout.tick}, cursor ${shot.cursor}`);
    check(shot.painted.colours > 3 && shot.painted.w > 0,
        '⛓ THE FRAME IS DRAWN BEFORE THE FLAG IS RAISED — a waiter that sees '
        + 'the flag is looking at a painted canvas',
        `${shot.painted.w}x${shot.painted.h}, ${shot.painted.colours} distinct colour(s)`);
    check(shot.readout.why === null,
        'and nothing about the request had to be reported', shot.readout.why ?? 'clean');

    // ⛔ DETERMINISTIC: nothing animates, so the frame the shutter opens on
    // is the frame that was asked for however long the CLI takes to get there.
    await page.waitForTimeout(900);
    const later = await page.evaluate(() => Number(document.getElementById('scrub').value));
    check(later === AT, '⛓ …and it is STILL that tick a second later — no autoplay',
        `cursor ${later} after 900 ms`);
    if (SHOT) await page.screenshot({ path: `${SHOT}/shot-t${AT}.png` });

    // The other side of the contract: no `?shot=1` means no body attribute,
    // but the readout still exists — a readout that only existed under the
    // parameter would make the parameter untestable from the other side.
    await page.close();
    const { page: p2 } = await open(`${PAGE}?tape=${TAPES}/r8-solve-18.json&side=js`);
    await p2.waitForFunction(() => window.__editorShot?.ready, null, { timeout: 180000 });
    const off = await p2.evaluate(() => ({
        attr: document.body.dataset.shotReady ?? null,
        requested: window.__editorShot.requested,
    }));
    check(off.attr === null && off.requested === false,
        '⚠ without ?shot=1 the body attribute is ABSENT — the flag means what it says',
        `attr ${off.attr}, requested ${off.requested}`);
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    await p2.close();
}

// ── ROW 4 (GROUP B): DRIVING ONTO A PICKUP — the text, and who presses X ─
/**
 * ⚖ THE ITEM: "manual mode has no way to display or advance text". Both
 * halves, driven by REAL KEY EVENTS in a browser, which is this file's whole
 * reason to exist — the vitest rows already prove the derivation (including
 * the CONTROL ARM: the same drive with the switch off does NOT finish).
 *
 * ⚠ THE ROOM AND THE SCRIPT ARE CHOSEN THE SAME WAY ROW 1's WERE. L10's
 * `r3-collect-sword` staging boots at (56,88) and the sword's pickup is
 * straight UP — 24 ticks of `up`, measured off the committed tape. The hold is
 * 700 ms, which is ~42 ticks at speed 1: overshooting is FREE because once the
 * ceremony starts the player is frozen and the auto-advance replaces the keys
 * anyway, so wall-clock jitter cannot reach an edge in either direction.
 */
{
    const url = `${PAGE}?source=manual&boot=${TAPES}/r3-collect-sword.json&speed=1`;
    const { page, errors } = await open(url);
    console.log(`\n## SOURCE=MANUAL — walking onto a pickup, and the ceremony text\n   ${url}`);
    await page.waitForSelector('#manualStart:not([disabled])', { timeout: 60000 });

    const knob = await page.evaluate(() => ({
        exists: Boolean(document.getElementById('auto-advance-text')),
        inKnobs: Boolean(document.querySelector('#viewknobs #auto-advance-text')),
        inLayers: Boolean(document.querySelector('#layers #auto-advance-text')),
        on: document.getElementById('auto-advance-text')?.checked ?? null,
        hidden: document.getElementById('dialogue')?.hidden ?? null,
    }));
    check(knob.exists && knob.inKnobs && !knob.inLayers && knob.on === true,
        '⚖ the auto-advance switch is mounted, ON by default, and is NOT a layer toggle',
        `knobs=${knob.inKnobs} layers=${knob.inLayers} on=${knob.on}`);
    check(knob.hidden === true,
        '⚠ …and the text box is HIDDEN before anything is driven — a permanent banner '
        + 'saying nothing is happening is noise',
        `hidden=${knob.hidden}`);

    await page.click('#manualStart');
    /**
     * ⛓⛓ THE KEY STAYS DOWN FOR THE WHOLE THING, and that is a stronger claim
     * than taking the hands off would be. `heldFor` REPLACES the driver's keys
     * during a ceremony rather than merging with them (`runCollect`'s
     * precedent: it emits the cadence and nothing else), so a drive that keeps
     * leaning on `up` must still page out. A row that released first would
     * pass on an implementation that merged — and a merged `up` would ride
     * through the freeze into the tape.
     *
     * ⚠ AND THE POLL RUNS WHILE IT IS DOWN. A first cut released after 700 ms
     * and started polling afterwards: page ONE had already been and gone, so
     * the row saw a paged ceremony and could not see it type. The observation
     * has to overlap the event.
     */
    await page.keyboard.down('ArrowUp');
    // ⛔ THE BOX APPEARS AND THE TEXT TYPES. Polled rather than sampled once:
    // a ceremony pages over ~34 ticks and a single read would catch whichever
    // instant the timing happened to land on. Stops as soon as it has both
    // pages, so a fast machine does not keep walking after the sword.
    const seen = await page.evaluate(async () => {
        const box = document.getElementById('dialogue');
        const texts = new Set();
        const metas = new Set();
        let shown = 0;
        for (let i = 0; i < 160; i += 1) {
            if (!box.hidden) {
                shown += 1;
                texts.add(box.querySelector('.txt')?.textContent ?? '');
                metas.add(box.querySelector('.meta')?.textContent ?? '');
            }
            if (texts.size >= 2) break;
            await new Promise((r) => setTimeout(r, 20));
        }
        return {
            shown, texts: [...texts], metas: [...metas],
            hud: document.getElementById('hud').textContent,
        };
    });
    await page.keyboard.up('ArrowUp');
    check(seen.shown > 0, '⛔ the ceremony text box APPEARED while driving',
        `visible on ${seen.shown} poll(s)`);
    // ⚠ THE FULL PAGE IS IN `.txt` (typed prefix + untyped remainder in a
    // second ink), so what is asserted is the GAME's own string, verbatim.
    check(seen.texts.some((t) => t.includes('You got the sword!')),
        '⛔⛔ …carrying the GAME\'s own text, verbatim from `Pickups/Sword.as`',
        JSON.stringify(seen.texts.filter((t) => t).slice(0, 3)));
    check(seen.texts.some((t) => t.includes('Double tap to dash and swing.')),
        '⛔⛔⛔ …and it PAGED — page 2 was reached with the driver holding a DIRECTION and '
        + 'never once pressing X',
        `${seen.texts.filter((t) => t).length} distinct text(s): `
            + JSON.stringify(seen.metas.slice(0, 2)));
    check(/auto text/.test(seen.hud) && /release\(s\)/.test(seen.hud),
        '⛓ …and the HUD says how many X releases the PAGE dispatched on your behalf — '
        + 'keys written into your tape are not a thing to leave to a tooltip',
        (seen.hud.match(/auto text[^a-z]*[^A-Z]*/) ?? ['?'])[0].slice(0, 80));
    if (SHOT) await page.screenshot({ path: `${SHOT}/manual-ceremony.png` });

    await page.click('#manualStop');
    await page.waitForFunction(() => window.__editorManual?.roundTrip !== undefined,
        null, { timeout: 60000 });
    const m = await page.evaluate(() => window.__editorManual);
    // ⛔⛔ THE KEYS THE PAGE PRESSED ARE IN THE TAPE. A producer that drove
    // inputs it did not record would fold to a tape that cannot reproduce the
    // walk it came from — and the round trip is exactly that assertion.
    check(m.roundTrip === true && m.faithful === true && m.mismatches.length === 0,
        '⛔⛔ the fold STILL replays frame-for-frame — the driven X releases were RECORDED',
        m.roundTrip ? `${m.observations} driven == ${m.frames} replayed`
            : JSON.stringify(m.mismatches.slice(0, 4)));
    check(m.refusal === null && m.error === null,
        'and the drive completed — no refusal, and the replay threw nothing',
        m.refusal ? `refused at t${m.refusal.tick}: ${m.refusal.message}` : 'clean');
    check(errors.length === 0, 'no page errors', errors.join(' | ') || 'clean');
    await page.close();
}

await browser.close();
if (SHOT) console.log(`\nscreenshots (EVIDENCE, not gates) in ${SHOT}`);
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
