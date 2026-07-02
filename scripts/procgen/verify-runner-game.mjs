import { chromium } from 'playwright';

// Runner phase-2 gate (plan §5 row 2) — standalone game page, all
// synthesized input, no manual play:
//  A. keyboard: input tape traverses the gapJump fixture — the
//     3.2-unit gap needs a FULL-HOLD running jump — and the portal
//     touch is observed (dev harness records sendExit).
//  B. touch (hasTouch context + CDP touch events -> real pointer
//     events): tap-vs-hold jump apexes differ (variable-jump wiring
//     through the whole-panel jump zone) and the corner drop button
//     drops through a one-way platform.
//
// Requires the dev server on :8000 (playwright.config webServer /
// long-running instance).

const BASE = 'http://localhost:8000/frontend/modules/runnerDemo/game/index.html';
const browser = await chromium.launch();
let failures = 0;
const ok = (cond, label) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`);
    if (!cond) failures++;
};

function watchErrors(page, bucket) {
    page.on('pageerror', (err) => bucket.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error') bucket.push(`[error] ${msg.text()}`);
    });
}

async function poll(page, desc, fn, timeoutMs = 20000, everyMs = 25) {
    const start = Date.now();
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
        await page.waitForTimeout(everyMs);
    }
}

const dbg = (page) => page.evaluate(() => window.__runnerDebug());
const calls = (page) => page.evaluate(() => window.__devCalls ?? []);

// ── A. keyboard input tape traverses gapJump ─────────────────────
{
    const page = await browser.newPage();
    const errors = [];
    watchErrors(page, errors);
    await page.goto(`${BASE}?fixture=gapJump`);
    await poll(page, 'gapJump configured', async () =>
        (await dbg(page))?.levelId === 'gapJump');
    ok((await dbg(page)).touchVisible === false,
        'touch controls hidden on a fine-pointer context');

    // Input tape with re-plan on respawn: hold Space (full-hold jump)
    // when the runner nears the gap edge; a mistimed attempt falls,
    // respawns, and retries.
    const sawExit = async () => (await calls(page)).some(
        (c) => c.fn === 'sendExit' && c.args[0] === 'exit_main');
    let exited = false;
    for (let attempt = 0; attempt < 10 && !exited; attempt++) {
        try {
            await poll(page, 'runner near the gap edge', async () => {
                const d = await dbg(page);
                return d.player.onGround && d.player.x > 14.4 && d.player.x < 16.2;
            }, 6000, 15);
        } catch {
            exited = await sawExit(); // maybe already across and gone
            continue;
        }
        await page.keyboard.down('Space');
        await page.waitForTimeout(450);
        await page.keyboard.up('Space');
        // cleared the gap -> ~20 more units of auto-run to the portal
        await page.waitForTimeout(3200);
        exited = await sawExit();
    }
    const made = await calls(page);
    ok(made.some((c) => c.fn === 'sendLocation' && c.args[0] === 'pk_edge'),
        'keyboard tape: pickup pk_edge sendLocation observed');
    ok(exited, 'keyboard tape: gapJump traversed — portal sendExit observed');
    ok(errors.length === 0, `no page errors (keyboard) ${errors[0] ?? ''}`);
    await page.close();
}

// ── B. touch context ─────────────────────────────────────────────
{
    const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 1100, height: 700 },
    });
    const page = await context.newPage();
    const errors = [];
    watchErrors(page, errors);
    const cdp = await context.newCDPSession(page);
    const touchDown = (x, y) => cdp.send('Input.dispatchTouchEvent',
        { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    const touchUp = () => cdp.send('Input.dispatchTouchEvent',
        { type: 'touchEnd', touchPoints: [] });

    // B1: tap vs hold on the whole-panel jump zone (flatRun)
    await page.goto(`${BASE}?fixture=flatRun&touch=1`);
    await poll(page, 'flatRun configured', async () =>
        (await dbg(page))?.levelId === 'flatRun');
    ok((await dbg(page)).touchVisible === true, 'touch controls shown with ?touch=1');
    const box = await page.locator('#game').boundingBox();
    const jumpAt = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 };
    const dropAt = { x: box.x + box.width * 0.92, y: box.y + box.height * 0.9 };

    async function apexAfter(holdMs) {
        await poll(page, 'grounded before gesture', async () =>
            (await dbg(page)).player.onGround);
        await page.evaluate(() => window.__runnerMark());
        await touchDown(jumpAt.x, jumpAt.y);
        await page.waitForTimeout(holdMs);
        await touchUp();
        await page.waitForTimeout(1100); // full arc lands well within this
        return (await dbg(page)).maxY;
    }
    const tapApex = await apexAfter(60);
    const holdApex = await apexAfter(450);
    console.log(`tap apex y=${tapApex.toFixed(2)}, hold apex y=${holdApex.toFixed(2)}`);
    ok(tapApex > 1.3, 'tap produced a jump (apex above standing height)');
    ok(holdApex > tapApex + 0.4,
        'variable jump: held touch rises well above a tap');

    // B2: corner drop button drops through the one-way shelf (oneWay)
    await page.selectOption('#dev-fixture', 'oneWay');
    await poll(page, 'oneWay configured', async () =>
        (await dbg(page))?.levelId === 'oneWay');
    await page.evaluate(() => window.__swfBridge.pollItems(['Blue Platforms']));
    ok((await dbg(page)).abilities.blue === true, 'Blue Platforms ability applied');
    await poll(page, 'runner riding the blue shelf', async () => {
        const d = await dbg(page);
        return d.player.onGround && d.player.y > 5.5 && d.player.x > 6;
    }, 10000, 15);
    await touchDown(dropAt.x, dropAt.y);
    await page.waitForTimeout(400);
    await touchUp();
    const landed = await poll(page, 'landed on the floor below', async () => {
        const d = await dbg(page);
        return (d.player.onGround && d.player.y < 1.5) ? d : null;
    }, 5000, 15);
    console.log(`dropped through at x=${landed.player.x.toFixed(2)}`);
    ok(landed.player.x < 24,
        'drop button: fell through the shelf before its right end');
    ok(errors.length === 0, `no page errors (touch) ${errors[0] ?? ''}`);
    await context.close();
}

await browser.close();
if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('\nAll runner game-page checks passed.');
