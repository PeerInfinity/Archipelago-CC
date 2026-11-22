#!/usr/bin/env node
// rules-predictable-rng: IS THE GAMEPLAY STREAM PREDICTABLE, AND FROM WHAT? One FRESH wasm page per arm
// (default `seedling_bot_ap_p4g`, headless logic-only, the `judge.mjs` boot), dev server :8000, box lock (browser).
//
// Arms (`--arms=a,b,…`, default all):
//   normal-1, normal-2 — NO TAPE. The page boots as an AP player's would (no botLoadTape/botStart). Poll for
//       `--normal-sec` seconds: every world `begin` the game latches (`Bot.latchBeginEntry`: level, rng.gameplay,
//       fp.seed) and the live `botStatus.rng.state`. Two fresh pages: do they agree?
//   inherit-1, inherit-2 — the Owl tape `owl-sword-s101` with `rng.seed` 0 ("inherit the page's stream"), split on:
//       the closest bot-drivable thing to normal play with frame-exact inputs. Two fresh pages: same draws? same result?
//   direct — the same tape as committed (seed 101): the control.
//   walkin — boot L111 (128,64) seed 101, walk up into L112, then the SAME in-room inputs (shifted to the arrival).
//   walkin-idle — as walkin, after 120 idle ticks in L111 first.
//   walkin-roundtrip — L111 → L112 → back to L111 → L112, then the same in-room inputs.
// Each arm reports: every begin (level, Bot tick, rng.gameplay at the begin), hits, cleared flags, end, and the
// player stream in L112 from the arrival, so two arms' in-room runs compare tick by tick.
//
//   node determinism.mjs --out=<results.json> [--arms=…] [--normal-sec=20]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const R = process.cwd();
const EV = join(R, 'CC/docs/cloud-reports/rules-predictable-rng-evidence');
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=').slice(1).join('=');
const OUT = opt('out', join(EV, 'logs/determinism.json'));
const ARMS = opt('arms', 'normal-1,normal-2,inherit-1,inherit-2,direct,walkin,walkin-idle,walkin-roundtrip').split(',');
const NORMAL_SEC = Number(opt('normal-sec', '20'));
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;

const { parseTape, gameVisibleTape } = await import(join(R, 'frontend/modules/seedlingDemo/tapeFormat.js'));
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
takeBoxLockOrExit({ name: 'rules-predictable-rng determinism', kind: 'browser' });

const OWL = JSON.parse(readFileSync(join(EV, 'tapes/owl-sword-s101.json'), 'utf8'));

/** The Owl tape's in-room inputs, shifted by `shift` ticks, with the first `up` span merged into a prefix `up`. */
function owlAfter(prefix, shift, name, { seed = 101 } = {}) {
    const inputs = [...prefix];
    for (const s of OWL.inputs) inputs.push({ key: s.key, from: s.from + shift, to: s.to + shift });
    // Merge touching same-key spans (a prefix `up` that ends where the tape's `up` begins), so no tick re-presses.
    inputs.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
    const merged = [];
    for (const s of inputs) {
        const prev = merged.findLast((m) => m.key === s.key);
        if (prev && prev.to >= s.from) prev.to = Math.max(prev.to, s.to); else merged.push({ ...s });
    }
    return {
        ...OWL, name, description: `rules-predictable-rng: ${name}`,
        boot: prefix.length ? { level: 111, x: 128, y: 64 } : OWL.boot,
        grants: prefix.length ? [{ level: 111, items: ['sword'] }] : OWL.grants,
        rng: { seed, split: true },
        tick_count: OWL.tick_count + shift, inputs: merged,
    };
}

async function boot(browser) {
    const page = await browser.newPage();
    const until = async (fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn(); if (v) return v;
            if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100);
        }
    };
    await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
    await until(() => page.evaluate(() => !!window.__runtimeReady), 180000);
    await page.click('#btn-start');
    await until(() => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
    await assertLogicOnlyChannel(page);
    return page;
}
const pollOnce = (page) => page.evaluate(() => {
    const g = window.__swfBridge.game;
    return { st: String(g.botStatus()), seam: String(g.botSeam()) };
});

async function normalArm(browser, name) {
    const page = await boot(browser);
    try {
        const begins = []; const live = [];
        let lastKey = null;
        for (const t0 = Date.now(); Date.now() - t0 < NORMAL_SEC * 1000;) {
            const p = await pollOnce(page);
            const st = JSON.parse(p.st); const seam = JSON.parse(p.seam);
            const b = seam.beginEntry;
            if (b) {
                const key = `${b['begin.level']}|${b['begin.tick']}|${b['rng.gameplay']}`;
                if (key !== lastKey) { begins.push({ level: b['begin.level'], tick: b['begin.tick'], rng: b['rng.gameplay'], cosmetic: b['rng.cosmetic'], fp: b['fp.seed'], save_time: b['save.time'] }); lastKey = key; }
            }
            const s = st.rng?.state ?? null;
            if (live.length === 0 || live.at(-1).state !== s) live.push({ ms: Date.now() - t0, state: s, level: st.level, x: st.x, y: st.y });
            await page.waitForTimeout(250);
        }
        return { arm: name, begins, liveStates: live, finalState: live.at(-1)?.state ?? null };
    } finally { await page.close(); }
}

async function tapeArm(browser, name, tape, expectArrival = 0) {
    tape = parseTape(JSON.stringify(tape));
    const page = await boot(browser);
    const call = (n, a) => page.evaluate(([nn, x]) => String(x === undefined
        ? window.__swfBridge.game[nn]() : window.__swfBridge.game[nn](x)), [n, a]);
    try {
        const loaded = await call('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        const begins = []; let lastKey = null; let st = null;
        for (const tStart = Date.now(); Date.now() - tStart < 30 * 60 * 1000;) {
            const p = await pollOnce(page);
            st = JSON.parse(p.st); const seam = JSON.parse(p.seam);
            if (st.error) throw new Error(st.error);
            const b = seam.beginEntry;
            if (b) {
                const key = `${b['begin.level']}|${b['begin.tick']}|${b['rng.gameplay']}`;
                if (key !== lastKey) { begins.push({ level: b['begin.level'], tick: b['begin.tick'], rng: b['rng.gameplay'], fp: b['fp.seed'] }); lastKey = key; }
            }
            if (st.finished) break;
            await page.waitForTimeout(40);
        }
        const drained = JSON.parse(await call('botDrain'));
        const ticks = drained.ticks ?? [];
        // The arrival: the L112 begin at the tick the in-room inputs were shifted to (`expectArrival`; 0 for a boot in
        // L112). A later L112 begin is a death rebuild; the prefix probe passes `null` and takes the last L112 begin.
        const arr = expectArrival === null ? begins.findLast((b) => b.level === 112) : begins.find((b) => b.level === 112 && b.tick === expectArrival);
        const arrival = arr ? arr.tick : null;
        const inRoom = arrival === null ? [] : ticks.filter((o) => o.t >= arrival && o.level === 112)
            .map((o) => [o.t - arrival, o.x, o.y]);
        return {
            arm: name, rng: tape.rng, boot: tape.boot, ticks: tape.tick_count, finished: !!st?.finished,
            begins, arrivalTick: arrival, hits: st?.hits ?? null,
            cleared: [...new Set((st?.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort(),
            end: { level: st?.level, x: st?.x, y: st?.y }, rngEnd: st?.rng ?? null, inRoom,
        };
    } finally { await page.close(); }
}

// The walk-in prefixes. Arrival ticks are MEASURED (pass 1: the prefix alone), then the in-room inputs follow them.
const PREFIX = {
    walkin: [{ key: 'up', from: 0, to: 40 }],
    'walkin-idle': [{ key: 'up', from: 120, to: 160 }],
    // up into L112 (t7); wait out the Owl's intro freeze (the player cannot move: the first try, `down` at t40, never
    // left); down back out through the (32,224) teleporter to L111; up again.
    'walkin-roundtrip': [{ key: 'up', from: 0, to: 8 }, { key: 'down', from: 200, to: 330 }, { key: 'up', from: 330, to: 450 }],
};

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const rows = [];
const save = () => writeFileSync(OUT, `${JSON.stringify(rows, null, 1)}\n`);
try {
    for (const arm of ARMS) {
        let row;
        try {
            if (arm.startsWith('normal')) row = await normalArm(browser, arm);
            else if (arm.startsWith('inherit')) row = await tapeArm(browser, arm, owlAfter([], 0, `owl-sword-s101-${arm}`, { seed: 0 }));
            else if (arm === 'direct') row = await tapeArm(browser, arm, owlAfter([], 0, 'owl-sword-s101-direct'));
            else if (PREFIX[arm]) {
                // Pass 1: the prefix alone, long enough to arrive; read the LAST L112 begin tick.
                const pre = PREFIX[arm];
                const end = Math.max(...pre.map((s) => s.to)) + 60;
                const probe = await tapeArm(browser, `${arm}-prefix`, {
                    ...OWL, name: `${arm}-prefix`, boot: { level: 111, x: 128, y: 64 }, grants: [{ level: 111, items: ['sword'] }],
                    rng: { seed: 101, split: true }, tick_count: end, inputs: pre,
                }, null);
                if (probe.arrivalTick === null) throw new Error(`${arm}: the prefix never arrived in L112 (${JSON.stringify(probe.begins)})`);
                // The in-room inputs start at the arrival; the prefix's last `up` is cut there (the tape's own `up` follows).
                const a = probe.arrivalTick;
                const cut = pre.map((s) => ({ ...s, to: Math.min(s.to, a) })).filter((s) => s.to > s.from);
                const tape = owlAfter(cut, a, `owl-sword-s101-${arm}`);
                writeFileSync(join(EV, `tapes/owl-sword-s101-${arm}.json`), `${JSON.stringify(tape, null, 1)}\n`);
                row = await tapeArm(browser, arm, tape, a);
                row.prefixProbe = { begins: probe.begins, arrivalTick: a };
            } else throw new Error(`unknown arm ${arm}`);
        } catch (e) { row = { arm, error: e.message }; }
        rows.push(row);
        console.log('ROW', JSON.stringify({ ...row, inRoom: row.inRoom ? `${row.inRoom.length} obs` : undefined, liveStates: row.liveStates?.length }));
        save();
    }
} finally { await browser.close(); }

// Pairwise: the in-room streams of the tape arms against `direct`.
const direct = rows.find((r) => r.arm === 'direct');
if (direct?.inRoom) {
    for (const r of rows.filter((x) => x.inRoom && x.arm !== 'direct')) {
        let first = null;
        for (let i = 0; i < Math.min(r.inRoom.length, direct.inRoom.length); i += 1) {
            const [t, x, y] = r.inRoom[i]; const [, dx, dy] = direct.inRoom[i];
            if (x !== dx || y !== dy) { first = { t, arm: [x, y], direct: [dx, dy] }; break; }
        }
        r.vsDirect = { compared: Math.min(r.inRoom.length, direct.inRoom.length), firstDivergence: first };
        console.log('VS-DIRECT', r.arm, JSON.stringify(r.vsDirect));
    }
}
for (const r of rows) if (r.inRoom) r.inRoom = r.inRoom.length; // keep the log small; the stream was compared above
save();
console.log(`wrote ${OUT}`);
