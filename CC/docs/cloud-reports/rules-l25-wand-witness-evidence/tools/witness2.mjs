#!/usr/bin/env node
/**
 * witness2.mjs — slice rules-l25-wand-witness: play hand-authored key tapes on the WASM game (one FRESH page per
 * tape) and read hits, levels, positions AND every mover. The game is the judge; nothing here models the game.
 *
 * Derived from the derivation slice's `tools/witness.mjs` (branch claude/wallflyer-no-hit-derivation-2y9dio
 * @43aa6dcd67, copied under ../from-derivation/tools/). Same staging (`probe-seedling-wallflyer-nohit.mjs`'s
 * `caseTape`: landing of the `<from>` door, holding exactly the case's arm, `noDamage` false, nothing removed).
 * Added: a PAGE-SIDE sampler (setInterval 1 ms) that records `botStatus` + `botMobiles` once per new game tick, so
 * every contact, every flyer launch, every WandShot, the Bobs and the pushable block are attributable by tick.
 *
 * A spec is `{ "case": "l<level>-<from>-<to>-<arm>", "ticks": N, "inputs": [{key, from, to}], "note": "..." }`.
 * `--arm=<arm>` overrides the case's arm (a control: same keys, other items). `--drop=primary` removes those keys.
 *
 * Run: node witness2.mjs <spec.json>... [--host=http://localhost:8000] [--out=<dir>] [--arm=none] [--drop=primary]
 * Prints `ROW {json}` per spec, `EVENTS` lines, and `PASS:`/`FAIL:` for "lands in <to> with no hit".
 * With --out, writes `<dir>/<spec-stem>[.<arm>].trace.json` (every sampled tick: player + movers).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = await import(join(REPO, 'scripts', 'procgen', 'probe-seedling-wallflyer-nohit.mjs'));
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(REPO, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const M = (p) => import(join(MODULE, p));

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const specs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
const OUT = arg('out', null);
const ARM = arg('arm', null);
const DROP = (arg('drop', '') || '').split(',').filter(Boolean);
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) { console.log(`SKIP: no wasm artifact ${PAGE}`); process.exit(0); }
const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;

const map = P.readMap();
const { PIN_NAMES, parseTape, gameVisibleTape, inventorySlotsFor } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const EMBED = JSON.parse(readFileSync(join(MODULE, 'fixtures/seedling-vanilla-set.json'), 'utf8'));
const set = vanillaRecordSet(EMBED, map).set;
console.log(`PAGE: ${PAGE} · delivered ${set.set_id}`);
takeBoxLockOrExit({ name: 'rules-l25-wand-witness witness2.mjs', kind: 'browser' });

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

/** The page-side sampler: one row per new `botStatus.tick`, with the movers. */
const SAMPLER = () => {
    const g = window.__swfBridge.game;
    window.__w2 = { rows: [], last: -1, stop: false };
    const short = (m) => ({ c: String(m.cls).split('::').pop(), x: +m.x.toFixed(2), y: +m.y.toFixed(2), vx: +m.vx.toFixed(3), vy: +m.vy.toFixed(3),
        d: m.destroy ? 1 : 0, ...(m.enemy ? { h: m.enemy.hits, hm: m.enemy.hits_max, ht: m.enemy.hits_timer } : {}), ...(m.anim ? { a: m.anim } : {}) });
    const id = setInterval(() => {
        if (window.__w2.stop) { clearInterval(id); return; }
        let st;
        try { st = JSON.parse(String(g.botStatus())); } catch (e) { return; }
        if (!st || st.tick === window.__w2.last) return;
        window.__w2.last = st.tick;
        let mob = [];
        try { mob = JSON.parse(String(g.botMobiles())).mobiles.map(short); } catch (e) { /* keep going */ }
        window.__w2.rows.push({ tick: st.tick, lv: st.level, x: st.x, y: st.y, hits: st.hits, fin: st.finished, mob });
    }, 1);
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
        await page.evaluate(SAMPLER);
        if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
        let maxHits = 0;
        const hitSamples = [];
        const status = await waitFor(page, 'the tape to finish', async () => {
            const st = JSON.parse(String(await page.evaluate(() => window.__swfBridge.game.botStatus())));
            if (st?.error) throw new Error(`botStatus: ${st.error}`);
            if ((st?.hits ?? 0) > maxHits) hitSamples.push({ t: st.tick ?? null, hits: st.hits });
            maxHits = Math.max(maxHits, st?.hits ?? 0);
            return st?.finished ? st : null;
        }, 15 * 60 * 1000, 20);
        await page.waitForTimeout(100);
        const rows = await page.evaluate(() => { window.__w2.stop = true; return window.__w2.rows; });
        const drained = await json(page, 'botDrain');
        return { mounted, maxHits, hitSamples, rows, status,
            items: Object.entries(status.items ?? {}).filter(([, v]) => v === true).map(([k]) => k).sort(),
            ticks: (drained?.ticks ?? []).map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })) };
    } catch (e) {
        console.log(`PAGE LOGS (last 15):\n${logs.slice(-15).join('\n')}`);
        throw e;
    } finally {
        await page.close();
    }
}

/** Events off the sampled rows: hits (with every enemy body touching the player box), flyer launches, shots, kills. */
export function eventsOf(rows) {
    const ev = [];
    let prev = null;
    const PB = { w: 4, h: 5, ox: 2, oy: 2 }; // Player.as:295 setHitbox(4,5,2,2)
    for (const r of rows) {
        if (prev && r.lv === prev.lv) {
            if ((r.hits ?? 0) > (prev.hits ?? 0)) {
                const near = r.mob.concat(prev.mob).filter((m) => m.h !== undefined && Math.abs(m.x - r.x) < 12 && Math.abs(m.y - r.y) < 12)
                    .map((m) => `${m.c}@${m.x},${m.y}`);
                ev.push(`t${r.tick} HIT #${r.hits} player (${r.x.toFixed(1)},${r.y.toFixed(1)}) near [${[...new Set(near)].join(' ')}]`);
            }
            const byKey = (list) => list.filter((m) => m.c === 'WallFlyer');
            const pf = byKey(prev.mob); const cf = byKey(r.mob);
            cf.forEach((f, i) => {
                const q = pf[i];
                if (q && (q.vx === 0 && q.vy === 0) && (f.vx !== 0 || f.vy !== 0)) ev.push(`t${r.tick} LAUNCH WallFlyer#${i} from (${q.x},${q.y}) v=(${f.vx},${f.vy}) player (${r.x.toFixed(1)},${r.y.toFixed(1)})`);
                if (q && (q.vx !== 0 || q.vy !== 0) && f.vx === 0 && f.vy === 0) ev.push(`t${r.tick} REST WallFlyer#${i} at (${f.x},${f.y})`);
            });
            const shots = (l) => l.filter((m) => m.c === 'WandShot').length;
            if (shots(r.mob) > shots(prev.mob)) ev.push(`t${r.tick} SHOT from player (${r.x.toFixed(1)},${r.y.toFixed(1)})`);
            for (const m of r.mob) {
                if (m.h === undefined) continue;
                const q = prev.mob.find((o) => o.c === m.c && Math.abs(o.x - m.x) < 4 && Math.abs(o.y - m.y) < 4);
                if (q && m.h > q.h) ev.push(`t${r.tick} STRUCK ${m.c}@(${m.x},${m.y}) hits ${m.h}/${m.hm}`);
            }
            const enemies = (l) => l.filter((m) => m.h !== undefined && !m.d).length;
            if (enemies(r.mob) < enemies(prev.mob)) ev.push(`t${r.tick} ENEMY GONE (${enemies(prev.mob)}→${enemies(r.mob)})`);
            const blk = (l) => l.find((m) => m.c === 'PushableBlock');
            const b0 = blk(prev.mob); const b1 = blk(r.mob);
            if (b0 && b1 && (b0.x !== b1.x || b0.y !== b1.y) && (Math.abs(b1.x - b0.x) + Math.abs(b1.y - b0.y)) > 0.01 && !ev.at(-1)?.includes('BLOCK')) ev.push(`t${r.tick} BLOCK moves (${b0.x},${b0.y})→(${b1.x},${b1.y})`);
        }
        if (prev && r.lv !== prev.lv) ev.push(`t${r.tick} LEVEL ${prev.lv}→${r.lv}`);
        prev = r;
    }
    return ev;
}

let failed = 0;
try {
    for (const f of specs) {
        const spec = JSON.parse(readFileSync(f, 'utf8'));
        const caseName = ARM ? spec.case.replace(/-[a-z]+$/, `-${ARM}`) : spec.case;
        const c = P.parseCase(caseName);
        const inputs = spec.inputs.filter((s) => !DROP.includes(s.key));
        const perTick = P.perTickOf(inputs, spec.ticks);
        const tape = parseTape({ ...await P.caseTape(map, caseName, perTick), pins: [...PIN_NAMES] });
        const t0 = Date.now();
        const g = await play(tape);
        const read = P.readRun(g.ticks, { maxHits: g.maxHits });
        const ok = P.isNoHitCrossing(c, read);
        const ev = eventsOf(g.rows);
        const first = g.rows[0];
        console.log(`ROW ${JSON.stringify({ spec: basename(f), case: caseName, drop: DROP, note: spec.note, set_id: set.set_id, mounted: g.mounted?.active, observations: g.ticks.length,
            sampled: g.rows.length, boot: tape.boot, held: g.items, primary: g.status?.primary ?? null, inventory_slots: g.status?.inventory_slots ?? null, slotsStaged: inventorySlotsFor(Object.fromEntries(g.items.map((k) => [k, true]))), maxHits: g.maxHits, hitSamples: g.hitSamples,
            levels: read.levels, respawns: read.respawns, final: read.final, crossed: ok, wallSeconds: Math.round((Date.now() - t0) / 1000) })}`);
        console.log(`MOVERS@t${first?.tick}: ${JSON.stringify(first?.mob)}`);
        for (const e of ev) console.log(`EVENT ${e}`);
        if (OUT) {
            mkdirSync(OUT, { recursive: true });
            const stem = basename(f).replace(/\.json$/, '') + (ARM ? `.${ARM}` : '') + (DROP.length ? `.drop-${DROP.join('-')}` : '');
            writeFileSync(join(OUT, `${stem}.trace.json`), `${JSON.stringify({ spec: basename(f), case: caseName, drop: DROP, maxHits: g.maxHits, crossed: ok, events: ev, rows: g.rows })}\n`);
        }
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${caseName} — lands in L${c.to} holding [${P.ARMS[c.arm].join(', ') || 'no item'}] with ${g.maxHits} hit(s) (${spec.note ?? ''})`);
        if (!ok) failed += 1;
    }
} finally {
    await browser.close();
}
console.log(failed ? `${failed} SPEC(S) DID NOT CROSS WITH NO HIT` : 'ALL SPECS CROSSED WITH NO HIT');
