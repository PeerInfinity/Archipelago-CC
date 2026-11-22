#!/usr/bin/env node
// rules-l77-suit-alone-witness: ON THE GAME (wasm `seedling_bot_ap_p4g`, headless logic-only), does a player crossing
// L77 between L76 and L78 take a hit? Each arm is ONE hand-authored tape on a FRESH page, DAMAGE ON (`noDamage: false`,
// no hazard coerced), the arm's items granted on L77 (and L78). Built on rules-k-pursuit-resume's k-route-witness.mjs.
//
// Per arm it records the game's per-tick player trace (botDrain), the game's `hits` (botStatus), and then derives:
//   reels    : a tick whose position is set BY a lava trap's tongue (LavaTrap.as:56-74 writes attached.x/y = trap +
//              tongueLengths[ind]·(cos,sin)) — detected as a step > 1.2 px (the player walks <= 0.8 px/tick) whose end lies
//              on the trap's ray at one of tongueLengths [32,29,22,15,10,7] (±0.6 px).
//   contacts : the tick `hits` rises. Found by TRUNCATED REPLAYS on fresh pages (the same tape cut at tick t; the game is
//              deterministic), bisecting on botStatus.hits; at the first hit tick the page's botMobiles names the body.
// Arms are read from an arms JSON: { name: { level, boot:[x,y] (px), grants:[items], segs:[[keys|null, ticks], ...],
//   equips?:[{t,slot}], note } } where keys is "left" or "left+down".
//   node w77.mjs --arms=<arms.json> [--only=a,b] [--out=<dir>] [--host=http://localhost:8000] [--no-bisect]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || new URL('../../../../../', import.meta.url).pathname;
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k) => process.argv.includes(`--${k}`);
const T = 16;
const { chromium } = createRequire(join(REPO, 'package.json'))('playwright');
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(REPO, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(REPO, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(REPO, 'scripts/procgen/boxLock.js'));
const { PIN_NAMES, parseTape, gameVisibleTape } = await M('tapeFormat.js');
const { vanillaRecordSet } = await M('levelSetExporter.js');
const { planLevelSetChunks } = await M('levelSetValidator.js');
const J = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const MAP = J('frontend/modules/flashPanel/atlases/seedling-map.json');
const set = vanillaRecordSet(J('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), MAP).set;
// LavaTrap(_x,_y) centres itself (+Tile/2, LavaTrap.as:30); Bob/LavaRunner likewise (Bob.as:34).
const ents = (level, type) => MAP.levels.find((l) => l.level === level).entities.filter((e) => e.type === type)
    .map((e) => ({ id: `${type}@${e.x},${e.y}`, cx: e.x + 8, cy: e.y + 8, tile: [Math.floor(e.x / T), Math.floor(e.y / T)] }));
const TONGUE = [32, 29, 22, 15, 10, 7];

export function tapeOf(name, a, cut = null) {
    if (a.tapeFile) { // a committed tape, played as is (cut = the same tape stopped at tick `cut`)
        const raw = JSON.parse(readFileSync(join(REPO, a.tapeFile), 'utf8'));
        const tc = cut ?? raw.tick_count;
        return parseTape({ ...raw, tick_count: tc, inputs: raw.inputs.filter((i) => i.from < tc).map((i) => ({ ...i, to: Math.min(i.to, tc) })),
            equips: (raw.equips ?? []).filter((e) => e.t < tc) });
    }
    let t = 0;
    const inputs = [];
    for (const [keys, n] of a.segs) {
        if (keys) for (const key of keys.split('+')) inputs.push({ key, from: t, to: t + n });
        t += n;
    }
    const tick_count = cut ?? t;
    const clipped = inputs.filter((i) => i.from < tick_count).map((i) => ({ ...i, to: Math.min(i.to, tick_count) }));
    const grants = [...new Set([a.level, ...(a.grantLevels ?? [])])].sort((x, y) => x - y).map((level) => ({ level, items: a.grants }));
    return parseTape({
        tape_version: 6, game: 'seedling', noclip: false, noDamage: false, noHazards: [], persistence: [],
        equips: (a.equips ?? []).filter((e) => e.t < tick_count),
        save: { totem_parts: [], keys: [], seal_parts: [] }, name: `l77-suit-alone-${name}`,
        description: `rules-l77-suit-alone-witness ${name}: ${a.note ?? ''}`.slice(0, 400),
        boot: { level: a.level, x: a.boot[0], y: a.boot[1] }, grants: a.grants.length ? grants : [],
        tick_count, inputs: clipped, pins: [...PIN_NAMES],
    });
}

export function analyse(a, ticks) {
    // A REEL: LavaTrap.as:56-61 writes attached.x/y = trap + tongueLengths[ind]·(cos,sin) every tick it is attached, and
    // the player's own update then moves it by at most its walk step (~1.2 px; less when no key is held). So a reel is a
    // run of >= 4 consecutive ticks whose distances to one trap's centre follow the table [32,29,22,15,10,7] from some
    // index k, each within 1.6 px (a walk never drops 3-7 px a tick toward a point).
    const pulls = [];
    for (let i = 1; i < ticks.length; i += 1) {
        const o = ticks[i];
        for (const tr of ents(o.level, 'lavatrap')) {
            if (pulls.some((p) => p.trap === tr.id && i <= p.lastI)) continue;
            for (let k = 0; k <= 2; k += 1) {
                let n = 0;
                while (k + n < TONGUE.length && i + n < ticks.length && ticks[i + n].level === o.level
                    && Math.abs(Math.hypot(ticks[i + n].x - tr.cx, ticks[i + n].y - tr.cy) - TONGUE[k + n]) <= 1.6) n += 1;
                if (n >= 4 && k + n >= TONGUE.length - 1) {
                    const p = ticks[i - 1], e = ticks[i + n - 1];
                    pulls.push({ trap: tr.id, trapTile: tr.tile, level: o.level, t: o.t, lastT: e.t, lastI: i + n - 1,
                        start: { t: p.t, x: +p.x.toFixed(2), y: +p.y.toFixed(2), tile: [Math.floor(p.x / T), Math.floor(p.y / T)],
                            d: +Math.hypot(p.x - tr.cx, p.y - tr.cy).toFixed(2) },
                        attachedAt: { x: +o.x.toFixed(2), y: +o.y.toFixed(2), tile: [Math.floor(o.x / T), Math.floor(o.y / T)] },
                        end: { x: +e.x.toFixed(2), y: +e.y.toFixed(2), tile: [Math.floor(e.x / T), Math.floor(e.y / T)] },
                        tongues: TONGUE.slice(k, k + n),
                        ds: ticks.slice(i, i + n).map((q) => +Math.hypot(q.x - tr.cx, q.y - tr.cy).toFixed(2)) });
                    break;
                }
            }
        }
    }
    pulls.forEach((p) => delete p.lastI);
    const path = [];
    for (const o of ticks) { const k = `L${o.level}:${Math.floor(o.x / T)},${Math.floor(o.y / T)}`; if (path.at(-1)?.k !== k) path.push({ k, t: o.t }); }
    const levelAt = ticks.find((o) => o.level !== a.level);
    return { pulls, path: path.map((p) => `${p.k}@${p.t}`).join(' '), leftLevelAt: levelAt ? { t: levelAt.t, level: levelAt.level, x: levelAt.x, y: levelAt.y } : null };
}

if (process.argv[1] && process.argv[1].endsWith('w77.mjs')) {
    if (arg('reanalyse')) { // --reanalyse=<dir>: re-derive pulls/path from saved *.game.json (no game)
        const { readdirSync } = await import('node:fs');
        for (const f of readdirSync(arg('reanalyse')).filter((x) => x.endsWith('.game.json'))) {
            const d = JSON.parse(readFileSync(join(arg('reanalyse'), f), 'utf8'));
            const an = analyse({ level: d.row.level }, d.ticks);
            d.row.pulls = an.pulls;
            writeFileSync(join(arg('reanalyse'), f), JSON.stringify(d));
            console.log('PULLS', f, JSON.stringify(an.pulls.map((p) => ({ trap: p.trap, t: p.t, start: p.start, end: p.end.tile, tongues: p.tongues.length }))));
        }
        process.exit(0);
    }
    const HOST = arg('host', 'http://localhost:8000').replace(/\/+$/, '');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const out = arg('out', null);
    if (out) mkdirSync(out, { recursive: true });
    const ARMS = JSON.parse(readFileSync(arg('arms'), 'utf8'));
    takeBoxLockOrExit({ name: 'rules-l77-suit-alone-witness', kind: 'browser' });
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const call = (page, n, x) => page.evaluate(([name, v]) => String(v === undefined ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](v)), [n, x]);
    const until = async (fn, ms) => { for (const t0 = Date.now(); ;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 120)); } };
    let proved = false;
    // ⛔ ONE FRESH PAGE PER TAPE (a reused page carries the previous tape's world).
    const play = async (tape, wantMobiles = false) => {
        const page = await browser.newPage();
        try {
            await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
            await until(() => page.evaluate(() => !!window.__runtimeReady), 180000);
            await page.click('#btn-start');
            await until(() => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
            if (!proved) { await assertLogicOnlyChannel(page); proved = true; }
            const answers = [];
            for (const c of planLevelSetChunks(set).chunks) answers.push(await call(page, 'botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels ${answers}`);
            const lt = await call(page, 'botLoadTape', JSON.stringify(gameVisibleTape(tape)));
            if (lt !== 'ok') throw new Error(`botLoadTape ${lt}`);
            if (await call(page, 'botStart') !== 'ok') throw new Error('botStart');
            const status = await until(async () => { const s = JSON.parse(await call(page, 'botStatus')); if (s.error) throw new Error(s.error); return s.finished ? s : null; }, 900000);
            const ticks = (JSON.parse(await call(page, 'botDrain'))?.ticks ?? []).map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
            const mobiles = wantMobiles ? (JSON.parse(await call(page, 'botMobiles')).mobiles ?? []) : null;
            return { status, ticks, mobiles };
        } finally { await page.close(); }
    };
    const only = arg('only', null)?.split(',');
    for (const [name, a] of Object.entries(ARMS)) {
        if (only && !only.includes(name)) continue;
        if (name.startsWith('_')) continue;
        if (arg('probe')) { // --probe=t1,t2,...: hits, hits_timer and the bodies at each cut (fresh page each)
            for (const t of arg('probe').split(',').map(Number)) {
                const r = await play(tapeOf(name, a, t), true);
                const p = r.ticks.at(-1);
                console.log('PROBE', name, t, JSON.stringify({ hits: r.status.hits, hits_timer: r.status.hits_timer, p: [+p.x.toFixed(2), +p.y.toFixed(2)],
                    bodies: (r.mobiles ?? []).filter((m) => /Bulb|LavaRunner/.test(m.cls ?? '')).map((m) => [(m.cls ?? '').split('::').pop(), +(+m.x).toFixed(1), +(+m.y).toFixed(1), m.destroy ? 'X' : '', m.enemy?.hits]) }));
            }
            continue;
        }
        try {
            const tape = tapeOf(name, a);
            const { status, ticks, mobiles } = await play(tape, true);
            const an = analyse(a, ticks);
            const hits = status.hits ?? null;
            const row = { arm: name, level: a.level, grants: a.grants, tick_count: tape.tick_count, obs: ticks.length, hits,
                hits_max: status.hits_max ?? null, dead: status.dead ?? null, inventory_slots: status.inventory_slots ?? null,
                items: status.items ? Object.fromEntries(Object.entries(status.items).filter(([, v]) => v)) : null,
                start: ticks[0], end: ticks.at(-1), bodiesAtEnd: (mobiles ?? []).filter((m) => /Bulb|LavaRunner|LavaTrap/.test(m.cls ?? '')).map((m) => `${(m.cls ?? '').split('::').pop()}@${(+m.x).toFixed(1)},${(+m.y).toFixed(1)}${m.destroy ? ' destroyed' : ''} hits=${m.enemy?.hits}`), leftLevelAt: an.leftLevelAt, pulls: an.pulls, path: an.path, contacts: [] };
            // DEATHS: a respawn is a same-level jump > 20 px that no reel explains (the game resets `hits` on respawn,
            // so the final `hits` alone undercounts). LIVES are the spans between them.
            const reelTicks = new Set(an.pulls.flatMap((p) => Array.from({ length: p.lastT - p.t + 1 }, (_, i) => p.t + i)));
            const lives = [[0, null]];
            row.deaths = [];
            for (let i = 1; i < ticks.length; i += 1) {
                const p = ticks[i - 1], o = ticks[i];
                if (o.level === p.level && !reelTicks.has(o.t) && Math.hypot(o.x - p.x, o.y - p.y) > 20) {
                    row.deaths.push({ respawnT: o.t, lastAlive: { t: p.t, x: +p.x.toFixed(2), y: +p.y.toFixed(2), tile: [Math.floor(p.x / T), Math.floor(p.y / T)] }, respawnAt: [o.x, o.y] });
                    lives.at(-1)[1] = p.t; lives.push([o.t, null]);
                }
            }
            lives.at(-1)[1] = tape.tick_count;
            // CONTACTS: per life, bisect each rise of `hits` on truncated fresh-page replays (monotone within a life)
            const hitsAt = async (t, mob = false) => (t === tape.tick_count && !mob ? { status, ticks, mobiles } : await play(tapeOf(name, a, t), mob));
            row.totalHits = 0;
            const bodyRows = (r, p) => (r.mobiles ?? []).filter((m) => /Bulb|LavaRunner|LavaTrap/.test(m.cls ?? '') && !m.destroy).map((m) => ({ cls: (m.cls ?? '').split('::').pop(), x: +(+m.x).toFixed(2), y: +(+m.y).toFixed(2), d: +Math.hypot(m.x - p.x, m.y - p.y).toFixed(2), hits: m.enemy?.hits, hits_timer: m.enemy?.hits_timer }))
                .sort((u, v) => u.d - v.d);
            if (!flag('no-bisect')) for (let li = 0; li < lives.length; li += 1) {
                const s0 = lives[li][0];
                let e0 = lives[li][1];
                const died = li < lives.length - 1;
                if (died) {
                    // the game resets the room (hits 0, bodies at spawn) a few ticks BEFORE the respawn shows in the trace:
                    // step back to the last tick that still holds this life's hits, and record the killing contact there
                    for (let t = e0; t > s0 && t > e0 - 12; t -= 1) {
                        const r = await play(tapeOf(name, a, t), true);
                        if ((r.status.hits ?? 0) > 0) {
                            e0 = t;
                            const p = r.ticks.at(-1);
                            row.deaths[li].killingContact = { t: `${t + 1}..${lives[li][1]}`, hitsBefore: r.status.hits, player: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), tile: [Math.floor(p.x / T), Math.floor(p.y / T)] }, nearestBodies: bodyRows(r, p).slice(0, 3) };
                            break;
                        }
                    }
                }
                const atEnd = (await hitsAt(e0)).status.hits ?? 0;
                const base = s0 === 0 ? 0 : ((await hitsAt(s0)).status.hits ?? 0);
                row.totalHits += atEnd - base + (died ? 1 : 0);
                let lo = s0;
                for (let k = base + 1; k <= atEnd; k += 1) {
                    let a0 = lo, b0 = e0; // hits(a0) < k <= hits(b0)
                    while (b0 - a0 > 1) {
                        const mid = (a0 + b0) >> 1;
                        const r = await play(tapeOf(name, a, mid));
                        if ((r.status.hits ?? 0) >= k) b0 = mid; else a0 = mid;
                    }
                    const r = await play(tapeOf(name, a, b0), true);
                    const p = r.ticks.at(-1);
                    const bodies = bodyRows(r, p);
                    row.contacts.push({ hit: k, life: s0, t: b0, player: p && { x: +p.x.toFixed(2), y: +p.y.toFixed(2), tile: [Math.floor(p.x / T), Math.floor(p.y / T)], level: p.level },
                        nearestBodies: bodies.slice(0, 3) });
                    lo = b0;
                }
            }
            console.log('ROW', JSON.stringify(row));
            if (out) { writeFileSync(join(out, `${name}.tape.json`), JSON.stringify(tape)); writeFileSync(join(out, `${name}.game.json`), JSON.stringify({ row, ticks })); }
        } catch (e) {
            console.log('ROW', JSON.stringify({ arm: name, error: String(e.message).split('\n')[0] }));
        }
    }
    await browser.close();
}
