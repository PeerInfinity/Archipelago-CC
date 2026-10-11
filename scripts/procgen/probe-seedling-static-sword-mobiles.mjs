#!/usr/bin/env node
/**
 * probe-seedling-static-sword-mobiles — ⛓⛓ SEEDLING HAMMER-PHASE C1: A STATIC BODY KILLED BY THE SWORD, ASKED OF THE
 * GAME TICK BY SAMPLED TICK (`probe-seedling-wallflyer-mobiles.mjs`'s shape, for `SandTrap` and `Turret`).
 *
 * An expectation carries the PLAYER, so a static body's death is invisible to the differential: the hits, the
 * i-frames, "die", a turret's `destroy` and fade and the removal are all body state. `botMobiles()` reports every one
 * of them, and this compares them — and every `TurretSpit` — with the model's `staticBodies` / `shooters` at the same
 * tick, with `STATIC_SWORD_ARM` ON (the model that stages the death); the player's x/y must be the model's at every
 * sampled tick (0 px), and both sides must end with zero player hits. With `--off` it compares against the model
 * with the switch OFF (the control: a model that never damages the body must disagree).
 *
 * Run (the dev server at the repo root, `SEEDLING_PORT`, default 8000):
 *   node scripts/procgen/probe-seedling-static-sword-mobiles.mjs --file=<tape.json> [--name=<witness>] [--record] [--off]
 *     --record   write the GAME's samples (and the tape) to `fixtures/static-sword-witness/<name>.json`, which
 *                `fidelityStaticSword.test.js` replays in node — only when this run PASSES
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const WITNESS_DIR = join(MODULE, 'fixtures', 'static-sword-witness');

/** The census id of a `botMobiles` row (the entity point is the `.oel` placement + 8 for both classes). */
export const idOfRow = (row) => `${/Turret$/.test(row.cls) ? 'turret' : 'sandtrap'}@${row.x - 8},${row.y - 8}`;

/**
 * The model's columns for a tape, `STATIC_SWORD_ARM` as given: per observation the player, the static bodies' rows
 * and the spits in flight. Exported for `fidelityStaticSword.test.js`, which replays the committed samples.
 */
export async function modelColumns(tape, on) {
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { withStaticSwordArm } = await import(join(MODULE, 'enemyDamage.js'));
    return withStaticSwordArm(on, () => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
        const col = [];
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            col[o.t] = {
                x: o.x, y: o.y, level: run ? run.level : tape.boot.level,
                hits: run ? run.ledger('playerHits').length : 0,
                bodies: Object.fromEntries((run?.entities('staticBodies') ?? []).map((b) => [b.id, { ...b }])),
                spits: run ? (run.entities('shooters') ?? []).flatMap((t) => t.spits.map((s) => ({ x: s.x, y: s.y }))) : [],
            };
            r = st.next();
        }
        return col;
    });
}

/** Every disagreement between the game's samples and the model's columns (empty = the witness holds). */
export function disagreements(samples, col) {
    const bad = [];
    for (const f of samples) {
        const m = col[f.t];
        if (!m) { bad.push(`t${f.t}: no model observation`); continue; }
        if (m.x !== f.player.x || m.y !== f.player.y) bad.push(`t${f.t} player game (${f.player.x},${f.player.y}) model (${m.x},${m.y})`);
        const seen = new Set();
        for (const b of f.bodies) {
            const id = idOfRow(b);
            seen.add(id);
            const mb = m.bodies[id];
            const g = { hits: b.hits, ht: b.hits_timer, die: b.anim === 'die', destroy: b.destroy === true };
            const md = { hits: mb?.hits ?? 0, ht: mb?.hitsTimer ?? 0, die: !!mb?.dying && !mb?.destroy, destroy: mb?.destroy === true };
            if (JSON.stringify(g) !== JSON.stringify(md)) bad.push(`t${f.t} ${id} game ${JSON.stringify(g)} model ${JSON.stringify(md)}`);
            if (mb?.removed) bad.push(`t${f.t} ${id} present in the game, removed in the model`);
        }
        for (const [id, mb] of Object.entries(m.bodies)) {
            if (!mb.removed && !seen.has(id)) bad.push(`t${f.t} ${id} gone in the game, present in the model`);
        }
        const gs = f.spits.map((s) => `${s.x},${s.y}`).sort().join(' ');
        const ms = m.spits.map((s) => `${s.x},${s.y}`).sort().join(' ');
        if (gs !== ms) bad.push(`t${f.t} spits game [${gs}] model [${ms}]`);
    }
    return bad;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door); the box is taken inside `main`. */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const FILE = arg('file');
    if (!FILE) {
        console.error('probe-seedling-static-sword-mobiles: --file=<tape.json> is required');
        process.exit(2);
    }
    const NAME = arg('name') ?? basename(FILE).replace(/(\.tape)?\.json$/, '');
    const RECORD = process.argv.includes('--record');
    const OFF = process.argv.includes('--off');
    takeBoxLockOrExit({ name: 'probe-seedling-static-sword-mobiles.mjs', kind: 'browser' });
    const { gameVisibleTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const tape = parseTape(readFileSync(FILE, 'utf8'));
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
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
        const deadline = Date.now() + 600000;
        while (Date.now() < deadline) {
            const raw = await page.evaluate(() => {
                const g = window.__swfBridge.game;
                return [String(g.botMobiles()), String(g.botStatus())];
            });
            const m = JSON.parse(raw[0]);
            const s = JSON.parse(raw[1]);
            frames.push({ tick: m.tick ?? s.tick, level: s.level, hits: s.hits, mobiles: m.mobiles ?? [] });
            if (s.finished) { status = s; break; }
        }
    } finally {
        await browser.close();
    }
    if (!status) {
        console.log('FAIL: the tape never finished inside the deadline');
        process.exit(1);
    }
    const seen = new Set();
    const samples = [];
    for (const f of frames) {
        if (!Number.isInteger(f.tick) || f.tick < 0 || f.tick > tape.tick_count || seen.has(f.tick)) continue;
        if (f.level !== tape.boot.level) continue;
        const pl = f.mobiles.find((r) => /Player$/.test(r.cls));
        if (!pl) continue;
        seen.add(f.tick);
        samples.push({
            t: f.tick,
            player: { x: pl.x, y: pl.y },
            hits: f.hits,
            bodies: f.mobiles.filter((r) => /(SandTrap|Turret)$/.test(r.cls)).map((r) => ({
                cls: r.cls.split('::').pop(), x: r.x, y: r.y, anim: r.anim, anim_index: r.anim_index,
                destroy: r.destroy, alpha: r.alpha, hits: r.enemy?.hits, hits_timer: r.enemy?.hits_timer,
            })),
            spits: f.mobiles.filter((r) => /TurretSpit$/.test(r.cls)).map((r) => ({ x: r.x, y: r.y })),
        });
    }
    samples.sort((a, b) => a.t - b.t);
    const col = await modelColumns(tape, !OFF);
    const bad = disagreements(samples, col);
    const gameHits = Number(status.hits ?? 0);
    const modelHits = col.at(-1)?.hits ?? 0;
    const pass = bad.length === 0 && gameHits === 0 && modelHits === 0 && samples.length > 0;
    console.log(`${pass ? 'PASS' : 'FAIL'}: ${NAME} — ${samples.length} sampled tick(s) of ${tape.tick_count}, `
        + `${bad.length} disagreement(s) with the model (STATIC_SWORD_ARM ${OFF ? 'OFF' : 'ON'}); player hits game `
        + `${gameHits} model ${modelHits}; the game ends at ${JSON.stringify({ level: status.level, x: status.x, y: status.y })}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    if (RECORD) {
        if (!pass || OFF) {
            console.log('NOT RECORDED: --record writes only a passing run with the switch ON');
            process.exit(1);
        }
        const out = join(WITNESS_DIR, `${NAME}.json`);
        writeFileSync(out, `${JSON.stringify({
            name: NAME, page: PAGE_NAME,
            recordedBy: 'scripts/procgen/probe-seedling-static-sword-mobiles.mjs --record',
            note: 'the GAME\'s SandTrap / Turret / TurretSpit rows (`botMobiles()`) and the player at each sampled tick of '
                + 'the boot level; the model with `STATIC_SWORD_ARM` ON reproduces every one',
            final: { level: status.level, x: status.x, y: status.y, hits: gameHits, tick: status.tick },
            tape, samples,
        }, null, 1)}\n`);
        console.log(`wrote ${out.slice(REPO.length + 1)}`);
    }
    process.exit(pass ? 0 : 1);
}
