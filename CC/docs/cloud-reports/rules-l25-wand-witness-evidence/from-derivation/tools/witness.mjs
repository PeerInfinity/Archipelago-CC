#!/usr/bin/env node
/**
 * witness.mjs — slice rules-nohit-derivation: play hand-authored or derived key tapes on the WASM game and read
 * hits, levels and positions. The game is the judge; nothing here models the game.
 *
 * A tape spec is a JSON file `{ "case": "l<level>-<from>-<to>-<arm>", "ticks": N, "inputs": [{key, from, to}],
 * "note": "..." }` (the plans file's span form). The staging is `probe-seedling-wallflyer-nohit.mjs`'s
 * `caseStaging` (the item-less latch re-pointed at the landing of the `<from>` door, holding exactly the arm's
 * items; `noDamage` false, nothing removed).
 *
 * Run: node witness.mjs <spec.json>... [--host=http://localhost:8000] [--dump=N] (every Nth observation)
 * Prints `ROW {json}` per spec and `PASS:`/`FAIL:` for "lands in <to> with no hit".
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const PROBE = join(REPO, 'scripts', 'procgen', 'probe-seedling-wallflyer-nohit.mjs');
const P = await import(PROBE);
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(REPO, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const M = (p) => import(join(MODULE, p));

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const specs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
const DUMP = Number(arg('dump', '0'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;

const map = P.readMap();
const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const EMBED = JSON.parse(readFileSync(join(MODULE, 'fixtures/seedling-vanilla-set.json'), 'utf8'));
const set = vanillaRecordSet(EMBED, map).set;
console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);
takeBoxLockOrExit({ name: 'rules-nohit-derivation witness.mjs', kind: 'browser' });

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const call = (page, n, a) => page.evaluate(([name, x]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[name] !== 'function') return null;
    return String(x === undefined ? g[name]() : g[name](x));
}, [n, a]);
const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
const waitFor = async (page, what, fn, ms, every = 250) => {
    for (const t0 = Date.now(); ;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
        await page.waitForTimeout(every);
    }
};
async function play(tape) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        await waitFor(page, 'runtime ready', () => page.evaluate(() => !!window.__runtimeReady), 180000);
        await page.click('#btn-start');
        await waitFor(page, 'bot callbacks', () => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
        await assertLogicOnlyChannel(page);
        const answers = [];
        for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
        if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
        const mounted = await json(page, 'botLevelSet');
        const loaded = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
        let maxHits = 0;
        const hitSamples = [];
        const status = await waitFor(page, 'the tape to finish', async () => {
            const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
            if (st?.error) throw new Error(`botStatus: ${st.error}`);
            if ((st?.hits ?? 0) > maxHits) hitSamples.push({ t: st.t ?? st.tick ?? null, hits: st.hits });
            maxHits = Math.max(maxHits, st?.hits ?? 0);
            return st?.finished ? st : null;
        }, 15 * 60 * 1000, 20);
        const drained = await json(page, 'botDrain');
        return { mounted, maxHits, hitSamples, statusKeys: Object.keys(status ?? {}),
            items: Object.entries(status.items ?? {}).filter(([, v]) => v === true).map(([k]) => k).sort(),
            ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level, hp: o.hp ?? o.health ?? null })) };
    } catch (e) {
        console.log(`PAGE LOGS (last 15):\n${logs.slice(-15).join('\n')}`);
        throw e;
    } finally {
        await page.close();
    }
}

let failed = 0;
try {
    for (const f of specs) {
        const spec = JSON.parse(readFileSync(f, 'utf8'));
        const c = P.parseCase(spec.case);
        const perTick = P.perTickOf(spec.inputs, spec.ticks);
        const tape = parseTape({ ...await P.caseTape(map, spec.case, perTick), pins: [...PIN_NAMES] });
        const g = await play(tape);
        const read = P.readRun(g.ticks, { maxHits: g.maxHits });
        const ok = P.isNoHitCrossing(c, read);
        console.log(`ROW ${JSON.stringify({ spec: f.split('/').pop(), case: spec.case, note: spec.note, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
            boot: tape.boot, held: g.items, maxHits: g.maxHits, hitSamples: g.hitSamples, levels: read.levels, respawns: read.respawns, final: read.final, crossed: ok })}`);
        if (DUMP) console.log(`TICKS ${g.ticks.filter((o) => o.t % DUMP === 0).map((o) => `${o.t}:${o.level}:${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(' ')}`);
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${spec.case} — lands in L${c.to} holding [${P.ARMS[c.arm].join(', ') || 'no item'}] with ${g.maxHits} hit(s) (${spec.note ?? ''})`);
        if (!ok) failed += 1;
    }
} finally {
    await browser.close();
}
console.log(failed ? `${failed} SPEC(S) DID NOT CROSS WITH NO HIT` : 'ALL SPECS CROSSED WITH NO HIT');
