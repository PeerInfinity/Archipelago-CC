#!/usr/bin/env node
/**
 * check-seedling-editor-shapes — THE EDITOR ARC SLICE 6 ACCEPTANCE ROW.
 *
 * Does the PAGE, in a browser, DRAW the three shape layers the slice-6 audit
 * admitted — the enemy body hitboxes, the spinner hammer line at its exact
 * current angle, and the attack rect on the tick it fired?
 *
 * ── ⛔ WHAT MAKES THESE ROWS NON-VACUOUS ──────────────────────────────
 *
 * Slice 5's lesson, carried verbatim into the design of every check here:
 * *a control that writes into state nobody reads passes every test written
 * about the control.* So NOTHING below asserts on `hammerLinesAt`'s return
 * value, on a checkbox, or on the layer roster. Every row reads
 * `window.__editorOverlays.drawn`, which the RENDERER fills in INSIDE its own
 * `if (on.has(…))` arms — so a layer whose derivation is perfect and whose
 * draw call is behind the wrong key reports EMPTY here, which is the failure
 * a widget-side check cannot see.
 *
 * The oracle for the hammer is a COMMITTED NUMBER: `r8-hammer-control`'s
 * recorded contact at tick 247, `Game.time` 5104, phase 19/45, angle 152°
 * (seedling-bot.md §R8, slice 8's material). The page is asked what it drew
 * and the answer has to be that number.
 *
 * ⚠ SCREENSHOTS ARE EVIDENCE, NOT GATES (kickoff §5). `--shot=<dir>` writes
 * PNGs for a human or an agent to look at; every check is a ledger fact.
 *
 * Prereqs: a dev server at the REPO ROOT. SKIPs (exit 0) without one, like
 * its three siblings — `export-seedling-view.mjs` is the arc's non-skipping
 * browser gate and `probe-seedling-watch-page --strict` is the addressable
 * refusal (kickoff §11.5).
 *
 * Run: node scripts/procgen/check-seedling-editor-shapes.mjs
 *      node scripts/procgen/check-seedling-editor-shapes.mjs --host=http://localhost:8003
 *      node scripts/procgen/check-seedling-editor-shapes.mjs --shot=/tmp/shots
 */

/** ⚠ `@playwright/test`, not `playwright` — slice 1's note; only the pinned
 * one's browser build is in `~/.cache/ms-playwright` after `npm ci`. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);

const HOST = arg('host', 'http://localhost:8000');
const SHOT = arg('shot', '');
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/**
 * ⚠ ONE EXPECTED 404 CLASS, NAMED RATHER THAN TOLERATED — slice 2 §9.4's
 * rule, reused. The page asks for `<tape>.trace.json` on EVERY load and only
 * the solver's tapes have one, so a hand-authored walk logs a 404 that IS the
 * correct answer. Filtered by the URL SHAPE — `fixtures/traces/…trace.json` —
 * and never by the word "404", so any other missing resource still reds the
 * row. (⛔ A row that allowed "404" would allow a missing atlas.)
 */
const unexpectedErrors = (errors) =>
    errors.filter((e) => !/fixtures\/traces\/[^\s\]]+\.trace\.json/.test(e));

const alive = await fetch(`${HOST}/${TAPES}/r8-hammer-control.json`)
    .then((r) => r.ok).catch(() => false);
if (!alive) {
    console.log(`SKIP: no dev server serving ${HOST}/${TAPES}/ — start one at the REPO `
        + 'ROOT with `python3 -m http.server 8000` (or pass --host=)');
    process.exit(0);
}
if (SHOT) mkdirSync(SHOT, { recursive: true });

const browser = await chromium.launch();

/**
 * Load a tape at a given tick and hand back the page's DRAWN readout.
 *
 * ⛓ `?tick=` is how the cursor is set, because `?tick=` starts PAUSED
 * (slice 3 §10.6) — poking the scrub afterwards would be a second handshake
 * and would race the rAF pacer.
 */
async function drawnAt(name, tick, extra = '') {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?tape=${TAPES}/${name}.json&side=js&tick=${tick}${extra}`,
    { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });
    const out = await page.evaluate(() => ({
        drawn: window.__editorOverlays.drawn,
        layers: window.__editorOverlays.layers,
        presses: window.__editorOverlays.presses,
        markers: window.__editorOverlays.markers,
        bodies: window.__editorOverlays.channels.bodies,
        cursor: Number(document.getElementById('scrub').value),
        legend: [...document.querySelectorAll('#legend .sw')].map((s) => s.textContent),
        toggles: [...document.querySelectorAll('#layers input')].map(
            (i) => [i.id.replace(/^layer-/, ''), i.checked]),
        detail: document.getElementById('detail').textContent,
    }));
    if (SHOT) {
        await page.screenshot({ path: `${SHOT}/${name}-t${tick}${extra ? '-x' : ''}.png` });
        await page.locator('#canvas').screenshot(
            { path: `${SHOT}/${name}-t${tick}${extra ? '-x' : ''}-canvas.png` });
    }
    await page.close();
    return { ...out, errors };
}

// ── 1. THE HAMMER, AGAINST ITS COMMITTED NUMBER ─────────────────────────
console.log('## r8-hammer-control @ tick 247 — the recorded contact is the oracle');
{
    const a = await drawnAt('r8-hammer-control', 247);
    check(a.cursor === 247, 'the page is holding tick 247', `cursor ${a.cursor}`);

    const lines = a.drawn.hammer.lines;
    check(a.drawn.hammer.why === null && lines.length === 2,
        '⛓ BOTH of L18\'s spinners have their hammer DRAWN — one line each',
        `${lines.length} line(s), why=${a.drawn.hammer.why ?? 'none'}`);

    const touching = lines.filter((l) => l.touches);
    check(touching.length === 1 && touching[0].id === 'spinner@48,96',
        '⛓⛓⛓ …and EXACTLY ONE of them REACHES the player',
        touching.map((l) => l.id).join(', ') || 'none');

    const hit = touching[0] ?? {};
    check(Math.abs((hit.degrees ?? 0) - 152) < 1e-9,
        '⛓⛓⛓ THE DRAWN ANGLE IS THE RECORDED 152° — the committed artifact is the oracle',
        `drawn ${(hit.degrees ?? NaN).toFixed(6)}°`);
    check(hit.gameTime === 5104 && hit.gameTime % 45 === 19,
        '⛓ …at the recorded `Game.time` 5104, phase 19/45',
        `gameTime ${hit.gameTime}, phase ${hit.gameTime % 45}/45`);

    // ⛓⛓⛓ THE ROW THE CHARTER ASKED FOR: the damage marker and the hammer
    // layer agree about WHY. Two ledgers, two derivations, one tick.
    const damage = a.markers.filter((m) => m.layer === 'damage' && m.tick <= 247);
    check(damage.length === 1 && damage[0].tick === 247
        && damage[0].label.includes('spinner-hammer'),
    '⛓⛓⛓ …and the DAMAGE MARKER at 247 names the same arm — the two layers agree about WHY',
    damage.map((m) => `${m.label}@${m.tick}`).join(', ') || 'none');

    check(unexpectedErrors(a.errors).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors(a.errors).join(' | ') || `clean (${a.errors.length} expected)`);
}

// ── 2. THE CONTROL: one tick earlier, the SAME spinner is NOT reached ───
console.log('\n## …and the tick BEFORE it — the control that makes the row mean something');
{
    const b = await drawnAt('r8-hammer-control', 246);
    const lines = b.drawn.hammer.lines;
    const touching = lines.filter((l) => l.touches);
    check(lines.length === 2 && touching.length === 0,
        '⛔ at 246 BOTH lines are drawn and NEITHER reaches — the contact is 247\'s alone',
        `${lines.length} line(s), ${touching.length} touching`);
    const at246 = lines.find((l) => l.id === 'spinner@48,96');
    check(at246 && Math.abs(at246.degrees - 144) < 1e-9,
        '⛓ …and the angle really moved — 144° at 246, 152° at 247 (8° = one tick of 45)',
        `${at246?.degrees.toFixed(3)}°`);
    check(unexpectedErrors(b.errors).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors(b.errors).join(' | ') || `clean (${b.errors.length} expected)`);
}

// ── 3. THE ATTACK RECT, AND ITS ABSENCE ─────────────────────────────────
console.log('\n## r8-solve-18 — the attack rect on its FIRED tick, and not otherwise');
{
    // The tick is MEASURED, not chosen: ask the page for its own press ledger
    // first. A hardcoded tick would silently become "some quiet frame" the day
    // the solve drifted (trap 169 is live on this roster).
    const probe = await drawnAt('r8-solve-18', 0);
    const fired = probe.presses.map((p) => p.fired).filter((t) => Number.isInteger(t));
    check(fired.length > 0, 'the page reports a press ledger to aim at',
        `${fired.length} press(es): ${fired.slice(0, 8).join(', ')}`);

    const t = fired[0];
    const on = await drawnAt('r8-solve-18', t);
    check(on.drawn.attacks.length === 1 && on.drawn.attacks[0].fired === t,
        `⛓ the attack rect IS DRAWN on its fired tick ${t}`,
        JSON.stringify(on.drawn.attacks.map((x) => `${x.weapon}@${x.fired}`)));

    const r = on.drawn.attacks[0]?.rect;
    const spinners = on.drawn.hitboxes.boxes.filter((h) => h.kind === 'spinner');
    const overlaps = r && spinners.some((s) => r.x < s.rect.right && r.right > s.rect.x
        && r.y < s.rect.bottom && r.bottom > s.rect.y);
    check(Boolean(overlaps),
        '⛓⛓⛓ …and it OVERLAPS a drawn spinner BODY hitbox — the two layers agree on the canvas',
        `rect ${JSON.stringify(r)} vs ${spinners.length} body/ies`);

    // ⚠ THE OTHER HALF. "It is drawn when it fired" is worth nothing without
    // "and it is absent when it did not".
    const quiet = [...Array(80).keys()].map((i) => t + 3 + i)
        .find((n) => !fired.includes(n));
    const off = await drawnAt('r8-solve-18', quiet);
    check(off.drawn.attacks.length === 0,
        `⚠ …and ABSENT at the non-press tick ${quiet}`,
        `${off.drawn.attacks.length} rect(s)`);
    check(off.drawn.hitboxes.boxes.length > 0 && off.drawn.hitboxes.why === null,
        '⛓ …while the BODY hitboxes are still there — the canvas did not just go blank',
        `${off.drawn.hitboxes.boxes.length} body/ies, why=${off.drawn.hitboxes.why ?? 'none'}`);
    check(unexpectedErrors([...on.errors, ...off.errors]).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors([...on.errors, ...off.errors]).join(' | ') || 'clean');
}

// ── 4. THE CHASER BOX, TICK FOR TICK ────────────────────────────────────
console.log('\n## r7-act2-4 — the chaser BOX tracks the stepped position');
{
    // Three sampled ticks, each asserted against the run's OWN per-tick
    // position ledger (`chaserWalks`) fetched from the same page.
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    // ⚠ WITH THE URL, like `drawnAt` above — `unexpectedErrors` filters on the
    // resource's own path, so a listener that recorded only the text would
    // hand it a line naming nothing and every 404 would red the row.
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${m.text()} [${m.location()?.url ?? '?'}]`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${HOST}/frontend/modules/seedlingDemo/watch.html`
        + `?tape=${TAPES}/r7-act2-4.json&side=js&tick=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__editorOverlays, null, { timeout: 180000 });

    // The walk ledger lives on the run, which the page does not publish — so
    // the sample ticks come from the DRAWN boxes themselves and the positions
    // are compared across ticks: a box that never moved would pass a
    // single-tick check and fail this one.
    const seen = [];
    for (const tick of [40, 80, 120]) {
        // eslint-disable-next-line no-await-in-loop
        const d = await page.evaluate((t) => {
            const s = document.getElementById('scrub');
            s.value = String(t);
            s.dispatchEvent(new Event('input'));
            return {
                boxes: window.__editorOverlays.drawn.hitboxes.boxes.filter((b) => b.kind === 'chaser'),
                cursor: Number(s.value),
            };
        }, tick);
        seen.push({ tick, ...d });
    }
    const withBoxes = seen.filter((s) => s.boxes.length > 0);
    check(withBoxes.length === 3,
        '⛓ a chaser box is drawn at all three sampled ticks',
        seen.map((s) => `t${s.tick}:${s.boxes.length}`).join(' '));
    const centres = withBoxes.map(
        (s) => s.boxes.map((b) => `${b.rect.x},${b.rect.y}`).join('|'));
    check(new Set(centres).size === centres.length,
        '⛓⛓⛓ …and it MOVED between them — the box tracks the stepped position, tick for tick',
        centres.join('  '));
    const sized = withBoxes.every((s) => s.boxes.every(
        (b) => b.rect.right - b.rect.x === 8 && b.rect.bottom - b.rect.y === 8));
    check(sized, '⛓ …at the census hitbox 8x8 — `chaserBoxAt`, not a page-side literal',
        withBoxes[0]?.boxes.map((b) => `${b.tag} ${b.rect.right - b.rect.x}x${b.rect.bottom - b.rect.y}`).join(', '));
    if (SHOT) await page.locator('#canvas').screenshot({ path: `${SHOT}/r7-act2-4-chaser-box.png` });
    check(unexpectedErrors(errors).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors(errors).join(' | ') || `clean (${errors.length} expected)`);
    await page.close();
}

// ── 5. THE LAYERS ARE ADDRESSABLE, AND THE READOUT IS THE DRIVEN SYSTEM ──
console.log('\n## the three layers as LAYERS — legend, ?layers=, and OFF really is off');
{
    const all = await drawnAt('r8-hammer-control', 247);
    const ids = all.toggles.map(([id]) => id);
    check(ids.includes('hitboxes') && ids.includes('hammer') && ids.includes('attacks')
        && ids.includes('lanes') && all.toggles.length === 15,
    '⛓ all three have a toggle, generated from the roster — FIFTEEN now (slice 9 added three)',
    `${all.toggles.length}: ${ids.join(', ')}`);
    check(all.legend.some((t) => /hammer REACHING/i.test(t))
        && all.legend.some((t) => /enemy hitbox/i.test(t))
        && all.legend.some((t) => /attack rect/i.test(t)),
    '⛓ …and a LEGEND ROW each — no stroke on the canvas nobody can name',
    all.legend.filter((t) => /hammer|hitbox|attack/i.test(t)).join(' · '));

    // ⛔ THE DRIVEN-SYSTEM CHECK. `?layers=` without `hammer` must leave the
    // readout EMPTY — a page that computed the lines and merely skipped the
    // stroke would report them here, and that is exactly the defect slice 5
    // found twice.
    const off = await drawnAt('r8-hammer-control', 247, '&layers=player,hitboxes');
    check(off.drawn.hammer.lines.length === 0 && off.drawn.attacks.length === 0,
        '⛔ a layer left out of ?layers= draws NOTHING — asserted at the renderer, not the widget',
        `hammer ${off.drawn.hammer.lines.length}, attacks ${off.drawn.attacks.length}`);
    check(off.drawn.hitboxes.boxes.length > 0,
        '⛓ …while the one that WAS named still draws — the check is not vacuous',
        `${off.drawn.hitboxes.boxes.length} body/ies`);
    check(unexpectedErrors([...all.errors, ...off.errors]).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors([...all.errors, ...off.errors]).join(' | ') || 'clean');
}

// ── 6. THE NAMED ABSENCE — a spinner room with no clock ─────────────────
console.log('\n## ⚠ the hammer\'s named absence — 125 of 153 committed tapes have no clock');
{
    const n = await drawnAt('r1-walk-full', 300);
    const why = n.drawn.hammer.why;
    check(n.drawn.hammer.lines.length === 0,
        'a tape whose boot declares no `save.time` draws no hammer line',
        `${n.drawn.hammer.lines.length} line(s)`);
    check(why === null || /Game\.time|tick 0/.test(why),
        '⚠ …and when a spinner IS in the room the absence is NAMED, never silent',
        why ? why.slice(0, 90) : 'no spinner in the drawn room — not a limitation, no reason given');
    check(unexpectedErrors(n.errors).length === 0,
        'no page errors beyond the expected missing-sidecar 404',
        unexpectedErrors(n.errors).join(' | ') || `clean (${n.errors.length} expected)`);
}

await browser.close();
if (SHOT) console.log(`\nscreenshots (EVIDENCE, not gates) in ${SHOT}`);
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
