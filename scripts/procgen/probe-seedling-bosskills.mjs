#!/usr/bin/env node
/**
 * probe-seedling-bosskills — ⛓⛓⛓ seedling-fidelity-bosskills D1: THE KING OF FIRE (`LavaBoss`, L82) AND THE TENTACLED
 * BEAST (L57), ASKED OF THE GAME TICK BY SAMPLED TICK.
 *
 * Plays one tape on the game (p4g by default, headless, the logic-only channel) and polls `botMobiles()` +
 * `botStatus()` as fast as the page answers, so every sample carries the game's own tick. The rows kept are the
 * player, every `LavaBoss` / `LavaBall` / `LavaRunner` / `TentacleBeast` / `Tentacle` (the classes the two fights
 * spawn), the persistence-cleared set, and the RNG state (`botStatus().rng`), one JSON object per sampled tick.
 *
 * `--model` ALSO steps the same tape through the model (`tapeRunner.createTapeStepper`) with the given
 * `CONTACT_FIDELITY` switches ON (`--fidelity=<k1,k2>`) and joins the two by tick: the player (x, y) and every boss
 * family row the model exposes (`run.lavaBoss`, `run.tentacleBeast`), so a disagreement names its tick.
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-bosskills.mjs --file=<tape.json> --out=<samples.json>
 *   … --model [--fidelity=kingOfFireFight]    join the model's run at every sampled tick
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** The AS3 classes the two fights spawn (the player is joined separately). */
export const BOSS_CLASSES = /(LavaBoss|LavaBall|LavaRunner|TentacleBeast|Tentacle)$/;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const FILE = arg('file');
    if (!FILE) {
        console.error('probe-seedling-bosskills: --file=<tape.json> is required');
        process.exit(2);
    }
    const OUT = arg('out');
    const MODEL = process.argv.includes('--model');
    const EXTRA = (arg('fidelity') ?? '').split(',').map((k) => k.trim()).filter(Boolean);

    takeBoxLockOrExit({ name: 'probe-seedling-bosskills.mjs', kind: 'browser' });

    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;

    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(readFileSync(FILE, 'utf8'));

    // ── the MODEL (optional): the player and the boss families after each tick (index 0 = boot) ──
    const col = [];
    if (MODEL) {
        const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
        const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
        const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
        withContactFidelity(Object.fromEntries(EXTRA.map((k) => [k, true])), () => {
            let run = null;
            const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
            let r = st.next();
            while (!r.done) {
                const o = r.value.observation;
                col[o.t] = { px: o.x, py: o.y, level: run ? run.level : tape.boot.level, hits: o.hits ?? null,
                    boss: run?.bossKillsView ? run.bossKillsView() : null };
                r = st.next();
            }
        });
    }

    // ── the GAME ────────────────────────────────────────────────────────────
    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    const frames = [];
    let status = null;
    try {
        const page = await browser.newPage();
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) {
            await page.waitForTimeout(250);
        }
        await assertLogicOnlyChannel(page);
        const bot = (n, a) => page.evaluate(([name, x]) => {
            const g = window.__swfBridge.game;
            return String(x === undefined ? g[name]() : g[name](x));
        }, [n, a]);
        const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape)));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        const started = await bot('botStart');
        if (started !== 'ok') throw new Error(`botStart: ${started}`);
        const deadline = Date.now() + 900000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            frames.push({ m, s });
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }
    const byTick = new Map();
    for (const { m, s } of frames) {
        const t = m.tick ?? s.tick;
        if (!Number.isInteger(t) || byTick.has(t)) continue;
        const rows = m.mobiles ?? [];
        const player = rows.find((r) => /Player$/.test(r.cls));
        byTick.set(t, {
            t, level: s.level, hits: s.hits ?? null, cleared: s.persistence_cleared ?? null, rng: s.rng ?? null,
            freeze: s.frozen ?? null, frozenTimer: s.frozen_timer ?? null, camera: s.camera ?? null, hitsTimer: s.hits_timer ?? null,
            player: player ? { x: player.x, y: player.y, vx: player.vx, vy: player.vy, anim: player.anim } : null,
            bodies: rows.filter((r) => BOSS_CLASSES.test(r.cls)).map((r) => ({
                cls: r.cls.replace(/^.*::/, ''), x: r.x, y: r.y, vx: r.vx, vy: r.vy, type: r.type, destroy: r.destroy,
                anim: r.anim, frame: r.frame, anim_index: r.anim_index, alpha: r.alpha, collidable: r.collidable,
                enemy: r.enemy ? { hits: r.enemy.hits, hits_max: r.enemy.hits_max, hits_timer: r.enemy.hits_timer,
                    can_hit: r.enemy.can_hit, dark: r.enemy.hit_by_dark_stuff } : null,
            })),
        });
    }
    const samples = [...byTick.values()].sort((a, b) => a.t - b.t);
    console.log(`${samples.length} sampled tick(s) of ${tape.tick_count}; end: level ${status.level}, tick ${status.tick}, `
        + `hits ${status.hits ?? '?'}`);
    let mismatches = 0;
    if (MODEL) {
        for (const g of samples) {
            const m = col[g.t];
            if (!m || !g.player) continue;
            if (Math.abs(m.px - g.player.x) > 1e-9 || Math.abs(m.py - g.player.y) > 1e-9) {
                if (mismatches < 8) console.log(`      t ${g.t}: game (${g.player.x}, ${g.player.y}) model (${m.px}, ${m.py})`);
                mismatches += 1;
            }
        }
        console.log(`${mismatches === 0 ? 'PASS' : 'FAIL'}: the player at every sampled tick (${mismatches} differ)`);
    }
    if (OUT) {
        writeFileSync(OUT, `${JSON.stringify({ file: FILE, page: PAGE_NAME, status, samples,
            model: MODEL ? col : null }, null, 0)}\n`);
        console.log(`wrote ${OUT}`);
    }
    process.exit(mismatches === 0 ? 0 : 1);
}
