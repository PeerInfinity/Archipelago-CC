import { chromium } from 'playwright';

// Bounce touch-controls retrofit gate (runner plan §6): standalone
// bounce page in a hasTouch context — holding the RIGHT half-panel
// touch zone sets keys.right and produces horizontal drift during the
// bounce (abilities gate it: no drift before the Right arrow item).
// Also covers the standalone-page TDZ regression (the dev harness
// calls configure during module init; the page must survive it).

const URL = 'http://localhost:8000/frontend/modules/bounceDemo/game/index.html?touch=1';
const browser = await chromium.launch();
let failures = 0;
const ok = (cond, label) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${label}`);
    if (!cond) failures++;
};

const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 1100, height: 750 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
const cdp = await context.newCDPSession(page);
const touchDown = (x, y) => cdp.send('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
const touchUp = () => cdp.send('Input.dispatchTouchEvent',
    { type: 'touchEnd', touchPoints: [] });
const dbg = () => page.evaluate(() => window.__bounceDebug());

await page.goto(URL);
await page.waitForTimeout(2000);

// standalone dev harness must have configured a level (TDZ fix)
const d0 = await dbg();
ok(d0.levelId !== null, `standalone page configured a level (${d0.levelId})`);
ok(d0.touchVisible === true, 'touch controls shown with ?touch=1');
ok(errors.length === 0, `no page errors on load ${errors[0] ?? ''}`);

const box = await page.locator('#game').boundingBox();
const rightHalf = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.5 };

async function driftWhileHoldingRight(ms) {
    const before = (await dbg()).player.x;
    await touchDown(rightHalf.x, rightHalf.y);
    await page.waitForTimeout(ms);
    await touchUp();
    const after = (await dbg()).player.x;
    return after - before;
}

// without the Right arrow ability, held input must NOT move the player
const lockedDrift = await driftWhileHoldingRight(1200);
console.log(`drift without ability: ${lockedDrift.toFixed(1)}`);
ok(Math.abs(lockedDrift) < 2, 'no drift while Right arrow is locked');

// grant the ability; the same hold now drifts the bounce rightward
await page.evaluate(() => window.__swfBridge.pollItems(['Right arrow']));
const d1 = await dbg();
ok(d1.abilities.right === true, 'Right arrow ability applied');
const drift = await driftWhileHoldingRight(1500);
console.log(`drift with ability: ${drift.toFixed(1)}`);
ok(drift > 10, 'holding the right half-panel produces rightward drift');

// release must clear the synthesized flag (the drift itself may have
// carried the bounce off the stack — physics respawns are fine; a
// stuck held flag is not)
const dAfter = await dbg();
ok(dAfter.touchFlags.right === false && dAfter.touchFlags.left === false,
    'touch flags cleared after release');

ok(errors.length === 0, `no page errors overall ${errors[0] ?? ''}`);
await browser.close();
if (failures) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('\nAll bounce touch checks passed.');
