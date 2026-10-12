#!/usr/bin/env node
/**
 * probe-seedling-staged-hits — ⛓ seedling-fidelity-stagedhits D3: THE PLAYER'S DAMAGE ACROSS A RE-STAGE IN ONE WORLD,
 * ASKED OF THE GAME.
 *
 * Two tapes on ONE page, exactly the wasm engine's continuation (`wasmPlayback.shippedTape`):
 *   1. leg 622's L73 arrival (`forcedhit-l73-622-plan`'s staging), `down+right` ×2 (the lavarunner's hit lands at t2;
 *      this knockback leaves the player in L73, where `up up` throws it through the door), then nothing to tick `--t1`,
 *      HELD (`holdingWindowTape`). The hold's `botStatus` is the RE-STAGE READ: `hits`, `hits_timer`, the position.
 *   2. the continuation — the same boot (`botStart`'s skip path: no `new Game`, so the game KEEPS its `Player` and its
 *      hits), `--keys2` held for `--n2` ticks, also held (an exact read at its end).
 * Every tick's player position comes from `botDrain`; `hits` / `hits_timer` from `botStatus` polled while it runs.
 *
 * Then THREE model runs against tape 2 (each tick = the game's observation after that many ticks):
 *   S  the SHADOW: the arrival staging, tape 1's keys replayed, then tape 2's (`continuationSolveRequest`'s
 *      construction — the hit is RE-BILLED by the replay). `stagedHitsMismatch(S, hold status)` must be null.
 *   P  an IN-PLACE RE-STAGE (`jsRuntimeCore.rebootInPlace`'s construction: a fresh boot at the held position) WITH
 *      `player_damage` read off the hold's `botStatus` (`playerDamageFromStatus`) — must match the game at 0 px through
 *      the staged i-frame's lapse.
 *   C  the same re-stage WITHOUT the field (hits 0, the i-frame gone) — the control; its first divergence is named.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   SEEDLING_PORT=9650 node scripts/procgen/probe-seedling-staged-hits.mjs [--t1=12] [--keys2=left] [--n2=25]
 *   … --out=<file.json>        write both tapes, every game row and the three model columns
 *   … --record --name=<n>      write the witness to `fixtures/staged-hits-witness/<n>.json` (only on a PASS);
 *                              `fidelityStagedHits.test.js` replays it
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const T1 = Number(arg('t1') ?? 12);
    const KEYS2 = (arg('keys2') ?? 'left').split('+').filter(Boolean);
    const N2 = Number(arg('n2') ?? 25);
    const OUT = arg('out');
    const RECORD = process.argv.includes('--record');
    const NAME = arg('name');
    if (RECORD && !NAME) {
        console.error('probe-seedling-staged-hits: --record needs --name=<witness name>');
        process.exit(2);
    }
    if (!(Number.isInteger(T1) && T1 >= 3) || !(Number.isInteger(N2) && N2 >= 1)) {
        console.error('probe-seedling-staged-hits: --t1 must be an integer ≥ 3 (the hit lands at t2) and --n2 ≥ 1');
        process.exit(2);
    }

    takeBoxLockOrExit({ name: 'probe-seedling-staged-hits.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { gameVisibleTape, holdingWindowTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { shippedTape } = await import(join(MODULE, 'wasmPlayback.js'));
    const { playerDamageFromStatus, stagedHitsMismatch } = await import(join(MODULE, 'playerDamage.js'));

    const W622 = JSON.parse(readFileSync(join(MODULE, 'fixtures', 'chaser-witness', 'forcedhit-l73-622-plan.json'), 'utf8'));
    const arrival = stagingFromTape(parseTape(JSON.stringify(W622.tape)));
    const keys1 = [['down', 'right'], ['down', 'right'], ...Array(T1 - 2).fill([])];
    const keys2 = Array(N2).fill(KEYS2);
    const inputsOf = (keys) => {
        const rows = [];
        keys.forEach((k, t) => { for (const key of k) rows.push({ key, from: t, to: t + 1 }); });
        return rows;
    };
    const tape1 = holdingWindowTape(parseTape({ ...W622.tape, name: `stagedhits-l73-t1-${T1}`,
        description: `⛓ seedling-fidelity-stagedhits D3 — L73 (leg 622's arrival): down+right ×2 (the lavarunner's hit at t2), then nothing to t${T1}, HELD.`,
        tick_count: T1, inputs: inputsOf(keys1) }));
    const tape2 = shippedTape({ staging: arrival, keys: keys2.map((k) => new Set(k)), hold: true,
        name: `stagedhits-l73-continue-${KEYS2.join('+') || 'none'}-${N2}` });

    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const legs = [];
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        for (const [label, tape] of [['tape1', gameVisibleTape(tape1)], ['tape2', tape2]]) {
            const loaded = await bot('botLoadTape', JSON.stringify(tape));
            if (loaded !== 'ok') throw new Error(`${label} botLoadTape: ${loaded}`);
            const started = await bot('botStart');
            if (started !== 'ok') throw new Error(`${label} botStart: ${started}`);
            const polled = [];
            let end = null;
            const deadline = Date.now() + 600000;
            while (Date.now() < deadline) {
                const s = JSON.parse(await bot('botStatus'));
                polled.push({ tick: s.tick, level: s.level, x: s.x, y: s.y, hits: s.hits, hits_timer: s.hits_timer,
                    finished: s.finished, held: s.held });
                if (s.finished) { end = s; break; }
            }
            if (!end) throw new Error(`${label}: the tape never finished inside the deadline`);
            const drain = JSON.parse(await bot('botDrain'));
            const mobiles = JSON.parse(await bot('botMobiles'));
            const player = (mobiles.mobiles ?? []).find((r) => /Player$/.test(r.cls)) ?? null;
            legs.push({ label, end: { tick: end.tick, level: end.level, x: end.x, y: end.y, hits: end.hits,
                hits_timer: end.hits_timer, held: end.held, game_time: end.game_time },
            player: player && { x: player.x, y: player.y, vx: player.vx, vy: player.vy, anim: player.anim ?? null },
            drain: drain.ticks, polled });
        }
    } finally {
        await browser.close();
    }

    // ── the MODEL ───────────────────────────────────────────────────────────
    const ls = atlasLevelSource();
    const [L1, L2] = legs;
    let failures = 0;
    const check = (name, ok, detail = '') => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const pos = (r) => ({ x: r.state.x, y: r.state.y, level: r.level });
    const S = createRunForStaging(arrival, ls);
    const sCol1 = [pos(S)];
    for (const k of keys1) { S.advance(new Set(k)); sCol1.push(pos(S)); }
    const off1 = L1.drain.filter((g) => { const m = sCol1[g.t]; return !m || m.x !== g.x || m.y !== g.y || m.level !== g.level; });
    check(`tape 1: the shadow S is the game at every drained tick (${L1.drain.length} ticks)`, off1.length === 0,
        off1.length ? `first off t${off1[0].t}: game (${off1[0].x}, ${off1[0].y}) model ${JSON.stringify(sCol1[off1[0].t])}` : '');
    check('tape 1: the game HOLDS at its end, still in L73', L1.end.held === true && L1.end.level === 73,
        `held ${L1.end.held}, level ${L1.end.level}`);
    const hold = L1.end;
    check('the hold carries a hit inside its i-frame', hold.hits >= 1 && hold.hits_timer > 0,
        `hits ${hold.hits}, hits_timer ${hold.hits_timer}`);
    check('the player is AT REST at the hold (an in-place re-stage stages no velocity)',
        L1.player && L1.player.vx === 0 && L1.player.vy === 0, JSON.stringify(L1.player));
    const sMismatch = stagedHitsMismatch(S, hold);
    check('stagedHitsMismatch(S, the hold\'s botStatus) is null — the replay re-billed the game\'s hit',
        sMismatch === null, JSON.stringify(sMismatch));

    const restage = { ...arrival, boot: { level: hold.level, x: hold.x - 8, y: hold.y - 8 } };
    const staged = playerDamageFromStatus(hold);
    const P = createRunForStaging({ ...restage, player_damage: staged }, ls);
    const C = createRunForStaging(restage, ls);
    check('P and C boot at the held position (the in-place re-stage)', [P, C].every((r) => r.state.x === hold.x
        && r.state.y === hold.y), `P (${P.state.x}, ${P.state.y}) C (${C.state.x}, ${C.state.y})`);
    check('P is staged with the game\'s damage, C with a fresh Player\'s', stagedHitsMismatch(P, hold) === null
        && stagedHitsMismatch(C, hold) !== null, `P ${JSON.stringify(P.damage)} C ${JSON.stringify(C.damage)}`);
    const cols = { S: [pos(S)], P: [pos(P)], C: [pos(C)] };
    const dmg = { S: [S.damage], P: [P.damage], C: [C.damage] };
    for (const k of keys2) {
        for (const [n, r] of [['S', S], ['P', P], ['C', C]]) {
            r.advance(new Set(k));
            cols[n].push(pos(r));
            dmg[n].push(r.damage);
        }
    }
    const polledAt = new Map();
    for (const p of L2.polled) if (Number.isInteger(p.tick) && !polledAt.has(p.tick)) polledAt.set(p.tick, p);
    const firstOff = (n) => L2.drain.find((g) => { const m = cols[n][g.t]; return !m || m.x !== g.x || m.y !== g.y || m.level !== g.level; }) ?? null;
    const firstDamageOff = (n) => [...polledAt.values()].find((g) => g.tick <= N2 && (dmg[n][g.tick]?.hits !== g.hits
        || dmg[n][g.tick]?.hitsTimer !== g.hits_timer)) ?? null;
    const lapse = staged.hits_timer;
    const summary = {};
    for (const n of ['S', 'P', 'C']) {
        const o = firstOff(n);
        const d = firstDamageOff(n);
        summary[n] = { firstOff: o && { t: o.t, game: { x: o.x, y: o.y, level: o.level }, model: cols[n][o.t] },
            firstDamageOff: d && { t: d.tick, game: { hits: d.hits, hits_timer: d.hits_timer }, model: dmg[n][d.tick] } };
        console.log(`  ${n}: position first off ${o ? `t${o.t} (game ${o.x}, ${o.y} L${o.level}; model ${JSON.stringify(cols[n][o.t])})` : 'never'}`
            + `; damage first off ${d ? `t${d.tick} (game ${d.hits}/${d.hits_timer}; model ${dmg[n][d.tick]?.hits}/${dmg[n][d.tick]?.hitsTimer})` : 'never'}`);
    }
    check(`tape 2: the shadow S is the game at every drained tick (${L2.drain.length}) and every polled damage row`,
        !summary.S.firstOff && !summary.S.firstDamageOff);
    check('tape 2: the game HOLDS at its end', L2.end.held === true, `held ${L2.end.held}`);
    check('stagedHitsMismatch(S, the end hold) is null', stagedHitsMismatch(S, L2.end) === null,
        JSON.stringify(stagedHitsMismatch(S, L2.end)));
    check(`P (staged hits ${staged.hits}, hits_timer ${lapse}) is the game at 0 px through the i-frame's lapse (t0..t${lapse})`,
        !summary.P.firstOff || summary.P.firstOff.t > lapse, summary.P.firstOff ? `first off t${summary.P.firstOff.t}` : 'never off');
    check(`P's damage is the game's at every polled tick through the lapse`, !summary.P.firstDamageOff
        || summary.P.firstDamageOff.t > lapse, summary.P.firstDamageOff ? `first off t${summary.P.firstDamageOff.t}` : 'never off');
    check('the control C (no field) diverges inside the lapse', summary.C.firstOff !== null && summary.C.firstOff.t <= lapse,
        summary.C.firstOff ? `first off t${summary.C.firstOff.t}` : 'never off');

    const witness = { name: NAME ?? null, recordedBy: 'scripts/procgen/probe-seedling-staged-hits.mjs --record', page: PAGE_NAME,
        args: { t1: T1, keys2: KEYS2, n2: N2 }, tape1, tape2,
        hold: { ...hold, player: L1.player }, end: L2.end,
        game: { tape1: { drain: L1.drain, polled: L1.polled }, tape2: { drain: L2.drain, polled: L2.polled } },
        summary };
    if (OUT) writeFileSync(OUT, `${JSON.stringify(witness, null, 1)}\n`);
    console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`);
    if (RECORD && failures === 0) {
        const dir = join(MODULE, 'fixtures', 'staged-hits-witness');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `${NAME}.json`);
        writeFileSync(file, `${JSON.stringify(witness, null, 1)}\n`);
        console.log(`recorded ${file}`);
    }
    process.exit(failures === 0 ? 0 : 1);
}
