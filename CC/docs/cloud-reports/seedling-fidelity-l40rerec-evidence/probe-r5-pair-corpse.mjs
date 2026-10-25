#!/usr/bin/env node
/**
 * L40REREC evidence (not a committed instrument): play the committed `r5-l40-part5` pair on the game (p4g, headless,
 * logic-only) and read the ice turret's corpse and the t2 wandlocks every polled tick — the claim the pair makes
 * ("the drive's corpse rests on button@480,384 {t 2}; the control's rests one tile short and t2 never opens"), checked
 * on the GAME rather than the model. Takes the box lock.
 *   SEEDLING_PORT=9735 node CC/docs/cloud-reports/seedling-fidelity-l40rerec-evidence/probe-r5-pair-corpse.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const { assertLogicOnlyChannel } = await import(join(REPO, 'scripts/procgen/seedlingChannel.js'));
const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));

takeBoxLockOrExit({ name: 'probe-r5-pair-corpse.mjs', kind: 'browser' });
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
let failures = 0;
const check = (name, ok, detail) => { if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`); };

async function play(name) {
    const tape = parseTape(readFileSync(join(MODULE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    try {
        const page = await browser.newPage();
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([nm, x]) => String(x === undefined ? window.__swfBridge.game[nm]() : window.__swfBridge.game[nm](x)), [n, a]);
        if ((await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)))) !== 'ok') throw new Error('botLoadTape');
        if ((await bot('botStart')) !== 'ok') throw new Error('botStart');
        const rows = new Map(); const classes = new Set(); let status = null;
        const deadline = Date.now() + 1_200_000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => [String(window.__swfBridge.game.botStatus()), String(window.__swfBridge.game.botMobiles())]);
            const s = JSON.parse(raw[0]); const m = JSON.parse(raw[1]);
            for (const r of m.mobiles ?? []) classes.add(r.cls.split(':').at(-1));
            if (Number.isInteger(s.tick) && m.tick === s.tick) {
                rows.set(s.tick, { t: s.tick, x: s.x, y: s.y,
                    corpse: (m.mobiles ?? []).filter((r) => /(^|:)IceTurret$/.test(r.cls) && r.anim === 'dead').map((r) => [r.x, r.y])[0] ?? null,
                });
            }
            if (s.finished) { status = s; break; }
        }
        return { tape, status, rows: [...rows.values()].filter((r) => r.t < tape.tick_count).sort((a, b) => a.t - b.t), classes };
    } finally { await browser.close(); }
}

const onT2 = (c) => c && c[1] < 400;            // on (30,24): (488,391.5) <-> (487.5,392)
const oneShort = (c) => c && c[1] >= 400 && c[1] < 416; // on (30,25): (488,407.5) <-> (487.5,408)
for (const name of ['r5-l40-part5', 'r5-l40-part5-control']) {
    const { tape, status, rows, classes } = await play(name);
    const dead = rows.filter((r) => r.corpse);
    const last = rows.at(-1);
    console.log(`      ${name}: ${rows.length} polled ticks of ${tape.tick_count}; ends L${status?.level} t${status?.tick}; `
        + `corpse first at t${dead[0]?.t} ${JSON.stringify(dead[0]?.corpse)}, last ${JSON.stringify(last?.corpse)}; mobile classes [${[...classes].sort().join(' ')}]`);
    if (name === 'r5-l40-part5') {
        const first = dead.find((r) => onT2(r.corpse));
        check(`${name}: on the GAME the corpse comes to rest on button@480,384 {t 2} and stays`,
            !!first && dead.filter((r) => r.t >= first.t).every((r) => onT2(r.corpse)),
            first ? `on it from t${first.t} at ${JSON.stringify(first.corpse)}` : 'never on it');
    } else {
        check(`${name}: on the GAME the corpse rests ONE TILE SHORT on (30,25) and never reaches the button`,
            dead.length > 0 && !dead.some((r) => onT2(r.corpse)) && oneShort(last?.corpse),
            `last ${JSON.stringify(last?.corpse)}`);
    }
    // botMobiles lists no Activators (WandLock is not a mobile): the corpse on the button is the game's witness,
    // as in FIREPUSH's `probe-seedling-fire-push.mjs`.
}
console.log(failures ? `${failures} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
