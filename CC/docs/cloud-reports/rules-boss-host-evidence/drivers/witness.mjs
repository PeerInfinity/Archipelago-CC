#!/usr/bin/env node
/**
 * rules-boss-host (R4b part 2) — GAME WITNESSES on the headless p4g build (and one p4d control): the boss /
 * encounter reports, Bob with server Fire, the L32 re-entry after the kill, the Totem gate, the seal door at N,
 * and leaving L32 after the kill without Fire. One fresh page per arm; `botLoadTape` + `botStart` to the latch.
 * Every arm's `pendingCheck` reports are fed, in order, to the REAL `SeedlingCheckBinding` over the REAL table
 * (`buildPlacementTable(bossReport: true)` on seedling_playthrough AP_1), with the reconcile read off the
 * arm's final `persistence_cleared` after each live clear (the glue's trigger).
 *
 * Run (from the worktree root, a server on SEEDLING_PORT): node CC/docs/cloud-reports/rules-boss-host-evidence/drivers/witness.mjs
 *   [--wait-for-box=<sec>] [--only=<arm,arm>]   → writes ../witnesses.json, prints PASS/FAIL rows.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = (rel) => join(REPO, rel);
const { takeBoxLockOrExit } = await import(P('scripts/procgen/boxLock.js'));
takeBoxLockOrExit({ name: 'rules-boss-host witness.mjs', kind: 'browser' });
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(P('scripts/procgen/headlessChromium.js'));
const { parseTape, gameVisibleTape } = await import(P('frontend/modules/seedlingDemo/tapeFormat.js'));
const { buildPlacementTable, placementKey } = await import(P('frontend/modules/seedlingDemo/apPlacementRewriter.js'));
const { R7_GOAL_LEDGER } = await import(P('frontend/modules/seedlingDemo/r7Acceptance.js'));
const { SeedlingCheckBinding } = await import(P('frontend/modules/flashPanel/seedlingCheckBinding.js'));
const { sealLogSlots } = await import(P('frontend/modules/seedlingDemo/saveArrayRules.js'));

const readJson = (rel) => JSON.parse(readFileSync(P(rel), 'utf8'));
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const RULES = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const PLACED = new Map();
for (const r of Object.values(RULES.regions['1'])) for (const l of r.locations ?? []) {
    if (l.event !== true) PLACED.set(l.name, { name: l.item.name, player: l.item.player });
}
const { table } = buildPlacementTable({ locationItemOf: (n) => PLACED.get(n) ?? null, ledger: R7_GOAL_LEDGER,
    rooms: MAP.levels, selfPlayer: 1, bossReport: true });
const tape = (name) => readJson(`frontend/modules/seedlingDemo/fixtures/tapes/${name}.json`);
const PORT = process.env.SEEDLING_PORT || '8209';
const url = (b) => `http://localhost:${PORT}/frontend/modules/flashPanel/wasm/${b}/game.html`;
const ONLY = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? '').split(',').filter(Boolean);

/** A tape over the base, with the fields given replaced (inputs cut to tick_count). */
const variant = (raw, over) => {
    const t = { ...raw, ...over };
    t.inputs = (t.inputs ?? []).filter((i) => i.from < t.tick_count).map((i) => ({ ...i, to: Math.min(i.to, t.tick_count) }));
    t.equips = (t.equips ?? []).filter((e) => e.t < t.tick_count);
    return t;
};
const idle = (boot, ticks, over = {}) => variant(tape('enc-l32-fire-return'), {
    name: over.name ?? 'idle', boot, tick_count: ticks, inputs: over.inputs ?? [], persistence: over.persistence ?? [],
    seam: over.seam ?? tape('enc-l32-fire-return').seam, ...over });
const NOFIRE_SEAM = { ...tape('enc-l32-fire-return').seam, items: { ...tape('enc-l32-fire-return').seam.items, hasFire: false } };
const door = (n) => variant(tape('r6-final-door'), { name: `final-door-${n}-slots`,
    save: { ...tape('r6-final-door').save, seal_parts: tape('r6-final-door').save.seal_parts.slice(0, n) } });

const ARMS = [
    { id: 'bob-nofire', build: 'seedling_bot_ap_p4g', tape: tape('r5-bobboss-fire') },
    { id: 'bob-serverfire', build: 'seedling_bot_ap_p4g', tape: variant(tape('r5-bobboss-fire'), {
        name: 'r5-bobboss-fire+fire', grants: [{ level: 32, items: ['sword', 'fire'] }] }) },
    { id: 'l32-reentry-killed', build: 'seedling_bot_ap_p4g', tape: idle({ level: 32, x: 72, y: 120 }, 90, {
        name: 'l32-reentry-killed', seam: NOFIRE_SEAM, persistence: [{ level: 32, tag: 1, note: '' }, { level: 32, tag: 3, note: '' }] }) },
    { id: 'l32-reentry-collected', build: 'seedling_bot_ap_p4g', tape: idle({ level: 32, x: 72, y: 120 }, 90, {
        name: 'l32-reentry-collected', seam: NOFIRE_SEAM, persistence: [{ level: 32, tag: 1, note: '' }, { level: 32, tag: 3, note: '' },
            { level: 32, tag: 4, note: '' }] }) },
    { id: 'l32-leave-stairs-nofire', build: 'seedling_bot_ap_p4g', tape: idle({ level: 32, x: 72, y: 120 }, 400, {
        name: 'l32-leave-stairs-nofire', seam: NOFIRE_SEAM, inputs: [{ key: 'down', from: 0, to: 400 }],
        persistence: [{ level: 32, tag: 1, note: '' }, { level: 32, tag: 3, note: '' }, { level: 32, tag: 4, note: '' }] }) },
    { id: 'l32-leave-pit-nofire', build: 'seedling_bot_ap_p4g', tape: variant(tape('enc-l32-fire-return'), {
        name: 'l32-leave-pit-nofire', seam: NOFIRE_SEAM, tick_count: 400,
        persistence: [...tape('enc-l32-fire-return').persistence.filter((p) => !(p.level === 32 && p.tag === 0)),
            { level: 32, tag: 3, note: '' }, { level: 32, tag: 4, note: '' }] }) },
    { id: 'witch', build: 'seedling_bot_ap_p4g', tape: tape('enc-l12-witch') },
    { id: 'owl', build: 'seedling_bot_ap_p4g', tape: tape('r6-owl-kill') },
    { id: 'shieldspire', build: 'seedling_bot_ap_p4g', tape: tape('r6-shield-kill') },
    { id: 'totem-all-parts', build: 'seedling_bot_ap_p4g', tape: tape('r6-totem-kill') },
    { id: 'totem-four-parts', build: 'seedling_bot_ap_p4g', tape: variant(tape('r6-totem-kill'), {
        name: 'r6-totem-kill-4parts', save: { ...tape('r6-totem-kill').save, totem_parts: [0, 1, 2, 3] } }) },
    // ⛓ the R4 AS3 guard itself: the Wand already collected ({43,0} declared — `Wand.check` removes it at room begin,
    // as an `apitem` in its place would leave `classCount(Wand)` at 0), so only `Player.hasAllTotemParts()` gates
    ...[[0, 1, 2, 3, 4], [0, 1, 2, 3]].map((parts) => ({ id: `totem-wand-gone-${parts.length}-parts`, build: 'seedling_bot_ap_p4g',
        tape: variant(tape('r6-totem-kill'), { name: `r6-totem-kill-wandgone-${parts.length}`,
            persistence: [{ level: 43, tag: 0, note: 'the Wand already collected' }], grants: [{ level: 43, items: ['wand'] }],
            save: { ...tape('r6-totem-kill').save, totem_parts: parts } }) })),
    ...[[16, 16], [15, 16], [8, 8], [7, 8]].map(([c, n]) => ({ id: `door-N${n}-seals${c}`, build: 'seedling_bot_ap_p4g',
        seals: { count: c, required: n, slots: sealLogSlots(c, n) }, tape: door(sealLogSlots(c, n)) })),
    { id: 'p4d-bob-control', build: 'seedling_bot_ap_p4d', tape: tape('r5-bobboss-fire') },
].filter((a) => ONLY.length === 0 || ONLY.includes(a.id));

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const out = { build_manifest: readJson('frontend/modules/flashPanel/wasm/builds.json').builds
    .map((b) => ({ name: b.name, capabilities: b.capabilities })), port: PORT, arms: [] };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed += 1; };

async function run(arm) {
    const page = await browser.newPage();
    try {
        await page.goto(url(arm.build), { waitUntil: 'domcontentloaded' });
        const wait = async (what, fn, ms = 600000) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn); if (v) return v; if (Date.now() - t0 > ms) throw new Error(`timeout: ${what}`); await page.waitForTimeout(250); } };
        await wait('runtime', () => !!window.__runtimeReady);
        await page.click('#btn-start');
        await wait('bot', () => !!window.__swfBridge?.game?.botStatus);
        await page.evaluate((cfg) => { window.__swfBridge.stateLog.length = 0; return window.__swfBridge.game.configure(JSON.stringify(cfg)); },
            { classes: GAME.classes, state_properties: GAME.state_properties });
        await page.waitForTimeout(500);
        const t = gameVisibleTape(parseTape(arm.tape));
        const loaded = await page.evaluate((s) => window.__swfBridge.game.botLoadTape(s), JSON.stringify(t));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        // the last report's seq before the host start (the engine's `seqNow`): `botStart` bumps it once per declaration
        const seqBefore = await page.evaluate(() => {
            const v = window.__swfBridge.stateLog.filter((r) => r.name === 'pendingCheck').map((r) => String(r.value)).filter(Boolean).at(-1);
            return v ? Number(v.split('|')[0]) : 0;
        });
        const started = await page.evaluate(() => window.__swfBridge.game.botStart());
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const st = await wait('latch', () => { const s = JSON.parse(window.__swfBridge.game.botStatus()); return (s.finished || s.error) ? s : null; });
        await page.waitForTimeout(500);
        const log = await page.evaluate(() => window.__swfBridge.stateLog.slice());
        const mobiles = await page.evaluate(() => { try { return JSON.parse(window.__swfBridge.game.botMobiles()); } catch { return null; } });
        return { st, log, mobiles, seqBefore };
    } finally { await page.close(); }
}

for (const arm of ARMS) {
    let r;
    try { r = await run(arm); } catch (e) { check(`${arm.id}: ran`, false, e.message); out.arms.push({ id: arm.id, error: e.message }); continue; }
    const reports = r.log.filter((x) => x.name === 'pendingCheck').map((x) => String(x.value)).filter(Boolean);
    const clears = reports.map((v) => v.split('|')).filter((p) => p[3] === '0').map((p) => `${p[1]}|${p[2]}`);
    const cleared = (r.st.persistence_cleared ?? []).map((c) => `${c.level}|${c.tag}`);
    const b = new SeedlingCheckBinding({ table, placementKey, selfPlayer: 1 });
    // ⛓ the engine's arming window (`seedlingWasmPlayback.hostStart`): the tape's declarations, one seq each
    const declared = arm.tape.persistence ?? [];
    if (declared.length) b.ignoreHostStart({ from: r.seqBefore, to: r.seqBefore + declared.length, declared });
    const checks = [];
    for (const v of reports) {
        const n = b.liveClears;
        for (const e of b.onStateReport('pendingCheck', v)) if (e.type === 'locationCheck') checks.push(e.location);
        if (b.liveClears !== n) for (const e of b.onReconcile(r.st.persistence_cleared)) if (e.type === 'locationCheck') checks.push(`${e.location} (reconcile)`);
    }
    const hasProp = (p) => r.log.filter((x) => x.name === p).map((x) => x.value);
    const classes = (r.mobiles?.mobiles ?? []).map((m) => String(m.cls));
    const row = { id: arm.id, build: arm.build, tape: arm.tape.name, ticks: r.st.tick, finished: r.st.finished, error: r.st.error || '',
        level: r.st.level, items: r.st.items ?? null, clears, cleared, checks, hasFire: hasProp('hasFire'), hasDarkSword: hasProp('hasDarkSword'),
        mobileClasses: [...new Set(classes)].sort(), seals: arm.seals ?? null, reports, seqBefore: r.seqBefore,
        declared: declared.map((d) => `${d.level}|${d.tag}`), stats: { ...b.stats },
        bosses: (r.mobiles?.mobiles ?? []).filter((m) => /^Enemies::/.test(String(m.cls))), player: { x: r.st.x, y: r.st.y } };
    out.arms.push(row);
    console.log(`# ${arm.id}: level ${row.level}, clears [${clears.join(' ')}], checks [${checks.join('; ')}]`);
}
await browser.close();
writeFileSync(join(HERE, '..', ONLY.length ? `witnesses-${ONLY.join('+')}.json` : 'witnesses.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('WROTE witnesses.json');
process.exit(failed ? 1 : 0);
