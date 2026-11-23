#!/usr/bin/env node
// rules-l112-owl-executor: THE GAME JUDGES A TAPE. One FRESH wasm page per tape (default `seedling_bot_ap_p4g`,
// headless logic-only), `botLoadTape` + `botStart`, poll `botStatus` + `botMobiles` in ONE JS turn until `finished`,
// then `botDrain` for the per-tick stream. Reports per tape: finished, end level/x/y, hits, every persistence flag the
// game cleared, the boss's last census row, and every HIT the poll saw (tick, player x/y, the mobiles near the player at
// that poll: rocks, grenades, pods, the boss) so a hit's cause is a census row, not an inference.
//
// The stream is also compared tick by tick against the MODEL's replay of the same tape (`tapeRunner.replay` is not
// used: the tape is replayed through `createLevelRun` with the tape's own staging), and the first divergence is named.
//
//   node judge.mjs --out=<results.json> <tape.json> [<tape.json> ...]
//
// Dev server on :8000 (SEEDLING_PORT moves it). Takes the box lock (kind browser).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const R = process.cwd();
const M = (f) => import(join(R, 'frontend/modules/seedlingDemo', f));
const args = process.argv.slice(2);
const OUT = (args.find((a) => a.startsWith('--out=')) ?? '--out=judge-out.json').slice(6);
const TAPES = args.filter((a) => !a.startsWith('--'));
const NO_MODEL = args.includes('--no-model');
/** `--dense`: record the boss on EVERY poll (tick, x, y, vx, vy, hits, anim) — the stage planner reads his walk legs off it. */
const DENSE = args.includes('--dense');
const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
const HOST = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`;

const { parseTape, gameVisibleTape, heldKeysAt } = await M('tapeFormat.js');
const { createLevelRun } = await M('levelRun.js');
const { atlasLevelSource } = await M('levelSource.js');
const { ROLES } = await M('levelWorld.js');
const { chromium } = await import('playwright');
const { HEADLESS_LOGIC_ONLY_ARGS } = await import(join(R, 'scripts/procgen/headlessChromium.js'));
const { assertLogicOnlyChannel } = await import(join(R, 'scripts/procgen/seedlingChannel.js'));
const { takeBoxLockOrExit } = await import(join(R, 'scripts/procgen/boxLock.js'));
takeBoxLockOrExit({ name: 'rules-l112-owl-executor judge', kind: 'browser' });

/** The model's replay of the same tape: per-tick stream, hits, lava, flags. */
export function modelReplay(tape) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(), boot: tape.boot, noclip: tape.noclip, noHazards: tape.noHazards,
        noDamage: tape.noDamage, grants: tape.grants, persistence: tape.persistence, equips: tape.equips,
        pins: tape.pins, save: tape.save, rng: tape.rng, roles: ROLES,
        ...(tape.inventory_slots ? { inventorySlots: tape.inventory_slots } : {}),
    });
    const stream = [];
    let error = null;
    for (let t = 0; t < tape.tick_count; t += 1) {
        stream.push({ t, x: run.state.x, y: run.state.y, level: run.level });
        try { run.advance(heldKeysAt(tape, t)); } catch (e) { error = `t${t}: ${e.message.slice(0, 300)}`; break; }
    }
    if (!error) stream.push({ t: tape.tick_count, x: run.state.x, y: run.state.y, level: run.level });
    return {
        stream, error,
        hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, x: h.x, y: h.y })),
        lava: run.finalBossLava.map((l) => ({ t: l.t, hits: l.hits, killed: !!l.killed })),
        flags: run.finalBossFlags.map((f) => `${f.level}:${f.tag}`),
        end: { level: run.level, x: run.state.x, y: run.state.y },
    };
}

const near = (m, px, py, r = 40) => Math.abs(m.x - px) <= r && Math.abs(m.y - py) <= r;

async function judge(browser, path) {
    const tape = parseTape(readFileSync(path, 'utf8'));
    const page = await browser.newPage();
    const call = (n, a) => page.evaluate(([name, x]) => String(x === undefined
        ? window.__swfBridge.game[name]() : window.__swfBridge.game[name](x)), [n, a]);
    const until = async (fn, ms) => {
        for (const t0 = Date.now(); ;) {
            const v = await fn(); if (v) return v;
            if (Date.now() - t0 > ms) throw new Error('timeout'); await page.waitForTimeout(100);
        }
    };
    const t0 = Date.now();
    try {
        await page.goto(`${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`, { waitUntil: 'domcontentloaded' });
        await until(() => page.evaluate(() => !!window.__runtimeReady), 180000);
        await page.click('#btn-start');
        await until(() => page.evaluate(() => !!(window.__swfBridge?.game?.botStatus)), 180000);
        await assertLogicOnlyChannel(page);
        const loaded = await call('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await call('botStart') !== 'ok') throw new Error('botStart');
        let st = null;
        let mob = null;
        let lastHits = 0;
        const hitPolls = [];
        const bossTrack = [];
        const exitPolls = [];
        for (const tStart = Date.now(); Date.now() - tStart < 40 * 60 * 1000;) {
            const pair = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return { st: String(g.botStatus()), mob: String(g.botMobiles()) };
            });
            st = JSON.parse(pair.st);
            mob = JSON.parse(pair.mob);
            if (st.error) throw new Error(st.error);
            const boss = (mob.mobiles ?? []).find((m) => String(m.cls).includes('FinalBoss'));
            if (boss && (bossTrack.length === 0 || st.tick >= bossTrack.at(-1)[0] + (DENSE ? 1 : 20))) {
                bossTrack.push([st.tick, +boss.x.toFixed(3), +boss.y.toFixed(3), boss.enemy?.hits ?? null, boss.anim, +(boss.vx ?? 0).toFixed(3), +(boss.vy ?? 0).toFixed(3)]);
            }
            if (st.tick >= tape.tick_count - 80) exitPolls.push({ t: st.tick, x: st.x, y: st.y, level: st.level, mobiles: (mob.mobiles ?? []).filter((m) => Math.abs(m.x - st.x) < 48 && Math.abs(m.y - st.y) < 48).map((m) => ({ cls: m.cls, x: m.x, y: m.y, anim: m.anim, type: m.type })) });
            if ((st.hits ?? 0) > lastHits) {
                hitPolls.push({
                    pollTick: st.tick, hits: st.hits, hits_timer: st.hits_timer,
                    // `hits_timer` counts down from 20 (`Player.hitsTimerMax`), so the hit tick is at most this.
                    hitTickAtMost: st.tick - (20 - (st.hits_timer ?? 20)),
                    player: { x: st.x, y: st.y, level: st.level },
                    nearby: (mob.mobiles ?? []).filter((m) => near(m, st.x, st.y))
                        .map((m) => ({ cls: m.cls, x: m.x, y: m.y, anim: m.anim, type: m.type })),
                    pods: (mob.pods ?? []).filter((p) => near(p, st.x, st.y, 24)).map((p) => ({ x: p.x, y: p.y, anim: p.anim })),
                });
                lastHits = st.hits;
            }
            if (st.finished) break;
            await page.waitForTimeout(40);
        }
        const drained = JSON.parse(await call('botDrain'));
        const boss = (mob?.mobiles ?? []).find((m) => String(m.cls).includes('FinalBoss')) ?? null;
        const gameStream = drained.ticks ?? [];
        const row = {
            tape: basename(path), name: tape.name, rng: tape.rng, grants: tape.grants, ticks: tape.tick_count,
            finished: !!st?.finished, wallSec: Math.round((Date.now() - t0) / 1000),
            end: { level: st?.level, x: st?.x, y: st?.y }, hits: st?.hits ?? null,
            cleared: [...new Set((st?.persistence_cleared ?? []).map((c) => `${c.level}:${c.tag}`))].sort(),
            slash: st?.slash ?? null, dead_frames: st?.dead_frames ?? null,
            boss: boss ? { x: boss.x, y: boss.y, anim: boss.anim, type: boss.type, hits: boss.enemy?.hits } : null,
            hitPolls, bossTrack, exitPolls, gameStreamExit: gameStream.slice(-80), observations: gameStream.length,
        };
        if (!NO_MODEL) {
            const m = modelReplay(tape);
            let first = null;
            for (let i = 0; i < Math.min(m.stream.length, gameStream.length); i += 1) {
                const g = gameStream[i]; const s = m.stream[i];
                if (g.x !== s.x || g.y !== s.y || g.level !== s.level) { first = { t: g.t, game: g, model: s }; break; }
            }
            row.model = { hits: m.hits, lava: m.lava, flags: m.flags, end: m.end, error: m.error };
            row.firstDivergence = first;
            row.streamCompared = Math.min(m.stream.length, gameStream.length);
        }
        row.gameStreamTail = gameStream.slice(-3);
        if (!NO_MODEL) row.modelStreamExit = modelReplay(tape).stream.slice(-80);
        return { row, gameStream };
    } finally { await page.close(); }
}

const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
const rows = [];
try {
    for (const p of TAPES) {
        let res;
        try { res = await judge(browser, p); } catch (e) { res = { row: { tape: basename(p), error: e.message } }; }
        rows.push(res.row);
        console.log('ROW', JSON.stringify({ ...res.row, bossTrack: undefined, hitPolls: res.row.hitPolls?.map((h) => ({ ...h, nearby: h.nearby?.length })) }));
        writeFileSync(OUT, `${JSON.stringify(rows, null, 1)}\n`);
    }
} finally { await browser.close(); }
console.log(`wrote ${OUT}`);
