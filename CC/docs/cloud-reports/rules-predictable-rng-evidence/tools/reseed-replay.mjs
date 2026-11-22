#!/usr/bin/env node
// rules-predictable-rng Q5: DO THE COMMITTED BOSS/SPAWNER TAPES CHANGE VERDICT WHEN THE GAMEPLAY STREAM IS SEEDED PER
// ROOM? Every committed tape that boots in a room with a GAMEPLAY draw site (census: L57 TentacleBeast, L112 FinalBoss)
// is replayed on a FRESH wasm page twice:
//   committed — the tape as committed (its declared `rng.seed`);
//   per-room  — `rng.seed` := roomSeed(MW, boot.level, 0), design (a)'s derivation (`roomSeed` below), everything else
//               unchanged. For a tape that boots in its boss room, a per-room reseed at the room's build IS a seed swap:
//               `Bot.botStart` already reseeds before the deferred build (`Bot.as:1893-1895`), so the emulation is exact.
// Verdict per run: end level, hits, cleared flags, every world begin (a second begin of the boot room = a death
// rebuild), finished. Page `seedling_bot_ap_p4g`, headless logic-only, dev server :8000, box lock (browser).
//
//   node reseed-replay.mjs --out=<results.json> [--mw=14089154938208861744] <tape-or-witness.json> …
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const R = process.cwd();
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = opt('out', 'reseed-replay.json');
const MW = opt('mw', '14089154938208861744');
const FILES = args.filter((a) => !a.startsWith('--'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;

const { parseTape, gameVisibleTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
takeBoxLockOrExit({ name: 'rules-predictable-rng reseed-replay', kind: 'browser' });

/**
 * Design (a)'s room seed: FNV-1a 32 over "<multiworld seed>|<level>|<entry>", folded into the generator's declarable
 * range 1..2147483647 (`assertOwlStreamPremises`; 0 means "inherit"). `entry` is the per-room entry counter (0 here:
 * every tape below is a first build). A sketch's choice, not a ruling; any hash with that range works.
 */
export function roomSeed(mw, level, entry = 0) {
    let h = 0x811c9dc5;
    for (const ch of `${mw}|${level}|${entry}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return (h % 2147483647) + 1;
}

async function run(browser, tape) {
    tape = parseTape(JSON.stringify(tape));
    const page = await browser.newPage();
    const until = async (fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn(); if (v) return v;
            if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100);
        }
    };
    const call = (n, a) => page.evaluate(([nn, x]) => String(x === undefined
        ? window.__swfBridge.game[nn]() : window.__swfBridge.game[nn](x)), [n, a]);
    try {
        await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
        await until(() => page.evaluate(() => !!window.__runtimeReady), 180000);
        await page.click('#btn-start');
        await until(() => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
        await assertLogicOnlyChannel(page);
        const loaded = await call('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        const begins = []; let lastKey = null; let st = null; let maxHits = 0;
        for (const t0 = Date.now(); Date.now() - t0 < 30 * 60 * 1000;) {
            const p = await page.evaluate(() => ({ st: String(window.__swfBridge.game.botStatus()), seam: String(window.__swfBridge.game.botSeam()) }));
            st = JSON.parse(p.st); const b = JSON.parse(p.seam).beginEntry;
            if (st.error) throw new Error(st.error);
            maxHits = Math.max(maxHits, st.hits ?? 0);
            if (b) {
                const key = `${b['begin.level']}|${b['begin.tick']}`;
                if (key !== lastKey) { begins.push([b['begin.level'], b['begin.tick'], b['rng.gameplay']]); lastKey = key; }
            }
            if (st.finished) break;
            await page.waitForTimeout(40);
        }
        const deaths = begins.filter(([l], i) => i > 0 && l === tape.boot.level && begins[i - 1][0] === tape.boot.level).length;
        return {
            seed: tape.rng?.seed, finished: !!st?.finished, end: { level: st?.level, x: st?.x, y: st?.y },
            hits: st?.hits ?? null, maxHitsSeen: maxHits, deathRebuilds: deaths,
            cleared: [...new Set((st?.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort(), begins,
        };
    } finally { await page.close(); }
}
const verdict = (r) => r.error ? `ERROR ${r.error}` : `end L${r.end.level} hits ${r.maxHitsSeen} deaths ${r.deathRebuilds} cleared [${r.cleared.join(' ')}]`;

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const rows = [];
try {
    for (const f of FILES) {
        const raw = JSON.parse(readFileSync(f, 'utf8'));
        const tape = raw.tape ?? raw;
        const rs = roomSeed(MW, tape.boot.level, 0);
        const row = { file: f, name: tape.name ?? basename(f), boot: tape.boot, declaredSeed: tape.rng?.seed, roomSeed: rs };
        for (const [arm, t] of [['committed', tape], ['perRoom', { ...tape, rng: { ...tape.rng, seed: rs } }]]) {
            try { row[arm] = await run(browser, t); } catch (e) { row[arm] = { error: e.message }; }
            row[arm].verdict = verdict(row[arm]);
        }
        row.changed = row.committed.verdict !== row.perRoom.verdict;
        rows.push(row);
        console.log('ROW', row.name, `seed ${row.declaredSeed} -> ${rs}`, '|', row.committed.verdict, '||', row.perRoom.verdict, row.changed ? 'CHANGED' : 'same');
        writeFileSync(OUT, `${JSON.stringify(rows, null, 1)}\n`);
    }
} finally { await browser.close(); }
console.log(`changed ${rows.filter((r) => r.changed).length} of ${rows.length}; wrote ${OUT}`);
