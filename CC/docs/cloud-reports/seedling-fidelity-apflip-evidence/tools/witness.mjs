#!/usr/bin/env node
/**
 * ROCKMOVE D2 — game witnesses on SCRATCH delivered sets (no tracked edit). Shape: `probe-seedling-l37-fallrock.mjs`.
 *
 * A spec names a tape (a committed fixture or an inline v8 tape) and arms; each arm is the delivery's own default
 * (`vanillaRecordSet(EMBED, MAP)`, i.e. SEEDLING_SET_PATCHES applied) built from a SCRATCH copy of the map with ops:
 *   {op:'remove', level, type, x, y}            the entity deleted
 *   {op:'move',   level, type, x, y, to:{x,y}}  the entity's placement rewritten (attrs kept)
 *   {op:'apitem', level, type, x, y, tag, look} the entity replaced as `rewriteRecordSet` would
 * Every arm runs on a FRESH page (p4f headless logic-only, the box lock). Per arm the drained stream (t, level, x, y),
 * `botStatus` at the end, derived transitions, and the model's replay of the same tape on the arm's mounted records
 * (or its refusal, by name) are written to <out>/<spec>-<arm>.json.
 *
 * Run: SEEDLING_PORT=9690 node witness.mjs <spec.json> [--out=<dir>]
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const S = (p) => import(join(REPO, 'scripts/procgen', p));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { HEADLESS_LOGIC_ONLY_ARGS } = await S('headlessChromium.js');
const { assertLogicOnlyChannel } = await S('seedlingChannel.js');
const { takeBoxLockOrExit } = await S('boxLock.js');
const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { mountedRecordsOf } = await M('wasmWalkTape.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const { runTape } = await M('tapeRunner.js');

const specPath = process.argv[2];
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? join(HERE, '..', 'd1', 'witness');
mkdirSync(OUT, { recursive: true });
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const readJson = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const EMBED = readJson('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json');
const PORT = process.env.SEEDLING_PORT ?? '9698';
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const PAGE_URL = `http://localhost:${PORT}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;

const tapeRaw = spec.tapeFile ? readJson(spec.tapeFile)
    : { tape_version: 8, game: 'seedling', name: spec.name, description: 'apflip D1 witness', noclip: false,
        noDamage: true, noHazards: [], grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: { seed: 1, split: false }, seam: {}, ...spec.tape };
if (spec.tapePatch) {
    const tp = spec.tapePatch;
    tapeRaw.inputs = tapeRaw.inputs.filter((i) => i.from < tp.inputsUntil).map((i) => ({ ...i, to: Math.min(i.to, tp.inputsUntil) }))
        .concat(tp.append ?? []);
    tapeRaw.tick_count = tp.tick_count;
    tapeRaw.name = spec.name;
}
const tape = parseTape(tapeRaw);

function applyOps(map, ops) {
    const levels = map.levels.map((r) => {
        const mine = ops.filter((o) => o.level === r.level);
        if (!mine.length) return r;
        let ents = r.entities.slice();
        for (const o of mine) {
            const i = o.op === 'add' ? -2 : ents.findIndex((e) => e.type === o.type && e.x === o.x && e.y === o.y);
            if (i === -1) throw new Error(`op ${JSON.stringify(o)}: no such entity`);
            if (o.op === 'remove') ents = ents.filter((_, j) => j !== i);
            else if (o.op === 'move') ents[i] = { ...ents[i], x: o.to.x, y: o.to.y };
            else if (o.op === 'add') { ents.push({ type: o.add.type, x: o.add.x, y: o.add.y, attrs: o.add.attrs ?? {} }); continue; }
            else if (o.op === 'apitem') ents[i] = { type: 'apitem', x: ents[i].x, y: ents[i].y, attrs: { tag: String(o.tag), look: o.look } };
            else throw new Error(`unknown op ${o.op}`);
        }
        return { ...r, entities: ents };
    });
    return { ...map, levels };
}

const derivedTransitions = (ticks) => ticks.slice(1).flatMap((o, i) => (o.level === ticks[i].level ? []
    : [{ t: o.t, from: ticks[i].level, to: o.level, at: { x: o.x, y: o.y } }]));

takeBoxLockOrExit({ name: `apflip D1 witness ${basename(specPath)}`, kind: 'browser' });
const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const call = (page, n, a) => page.evaluate(([name, x]) => {
    const g = window.__swfBridge && window.__swfBridge.game;
    if (!g || typeof g[name] !== 'function') return null;
    return String(x === undefined ? g[name]() : g[name](x));
}, [n, a]);
const json = async (page, n, a) => { const r = await call(page, n, a); return r === null ? null : JSON.parse(r); };
const waitFor = async (page, what, fn, ms) => {
    for (const t0 = Date.now(); ;) {
        const v = await fn(); if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timeout waiting for ${what}`);
        await page.waitForTimeout(250);
    }
};
const summary = [];
try {
    for (const arm of spec.arms) {
        const set = vanillaRecordSet(EMBED, applyOps(MAP, arm.ops ?? [])).set;
        const page = await browser.newPage();
        const logs = [];
        page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
        let g;
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
            const lt = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (lt !== 'ok') throw new Error(`botLoadTape: ${lt}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await waitFor(page, 'the tape to finish', async () => {
                const st = await json(page, 'botStatus');
                if (st?.error) throw new Error(`botStatus: ${st.error}`);
                return st?.finished ? st : null;
            }, 15 * 60 * 1000);
            const drained = await json(page, 'botDrain');
            g = { status, mounted: mounted?.active, ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y })) };
        } catch (e) {
            g = { error: String(e.message).split('\n')[0], logs: logs.slice(-15) };
        } finally { await page.close(); }
        let model;
        try {
            const out = runTape(tape, { levelSource: levelSourceFromAtlas(mountedRecordsOf(set)) });
            model = { refused: null, transitions: derivedTransitions(out.ticks), final: out.ticks.at(-1) ? { t: out.ticks.at(-1).t, level: out.ticks.at(-1).level, x: out.ticks.at(-1).x, y: out.ticks.at(-1).y } : null };
        } catch (e) { model = { refused: String(e.message).split('\n')[0].slice(0, 400) }; }
        const row = {
            spec: spec.name, arm: arm.name, ops: arm.ops ?? [], set_id: set.set_id, page: PAGE, tape: spec.tapeFile ?? 'inline',
            game: g.error ? { error: g.error, logs: g.logs } : {
                mounted: g.mounted, observations: g.ticks.length, transitions: derivedTransitions(g.ticks),
                final: g.ticks.at(-1) ?? null,
                persistence_cleared: g.status.persistence_cleared ?? null,
                ...(spec.window ? { window: g.ticks.filter((o) => o.t >= spec.window[0] && o.t <= spec.window[1]) } : {}),
                ticks: g.ticks,
            },
            model,
        };
        writeFileSync(join(OUT, `${spec.name}-${arm.name}.json`), `${JSON.stringify(row)}\n`);
        const brief = { arm: arm.name, set_id: set.set_id, game: g.error ? g.error : { obs: g.ticks.length, transitions: row.game.transitions, final: row.game.final,
            cleared: (row.game.persistence_cleared ?? []).filter((c) => (spec.levels ?? []).includes(Number(c.level))) }, model };
        summary.push(brief);
        console.log(`ROW ${JSON.stringify(brief)}`);
    }
} finally { await browser.close(); }
writeFileSync(join(OUT, `${spec.name}-summary.json`), `${JSON.stringify(summary, null, 1)}\n`);
