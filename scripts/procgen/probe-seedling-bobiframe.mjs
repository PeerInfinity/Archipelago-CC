#!/usr/bin/env node
/**
 * ⛓ SEEDLING FIDELITY BOBIFRAME (wave 39) — L40's `bob@736,752` on the game, tick by tick, under the solver's own
 * `Level 040 - Chest ← L39` plans (sweep leg key `level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest`).
 *
 * THE QUESTION (hammer L40-FLIP-BUILD §3.1 / §9 item 1): the model lands the bob's THIRD sword hit at t930 (the swing
 * pressed at t925, on the tick its i-frames lapse) and walks the player through the corpse; the game hits the player
 * at t936. Is it the swing's last test tick, the lapse, or bob state the game holds?
 *
 * THE ANSWER THIS PROBE MEASURES: bob state. A live `Spinner` is `type = "Enemy"` and `Bob.solids` hold "Enemy"
 * (`Bob.as:39`), so `Mobile.moveX/moveY` stop the bob against a spinner crossing its box. `spinner@816,848` walls the
 * bob's FIRST step (t544), every later bob row stands elsewhere, hit 2 lands six ticks later than the model's, and the
 * t925 swing's five tests (t926..t930) all meet `hits_timer` 10..6. The model has this wall behind
 * `CONTACT_FIDELITY.chaserSpinnerWalls` (L40CONTACT D1, OFF by default): with it ON the model is the game at 0 px for
 * the whole tape — player, every Bob (position, `hits`, `hits_timer`) and every Spinner.
 *
 * Each witness tape in `fixtures/bobiframe-witness/<name>.tape.json` is played on the game (p4g, the default build,
 * headless logic-only) on the DELIVERED AP record set (`fidelityL25ApItem.l25Sets`, the set the playthrough page
 * mounts: L40's chest is an `apitem`, which a spinner crosses and a vanilla Chest does not), sampled with
 * `botMobiles()` + `botStatus()` at the Bot's own observation point (the last poll before the tick advanced), and
 * compared with the model's replay with `chaserSpinnerWalls` OFF and ON.
 *
 * Usage: `node scripts/procgen/probe-seedling-bobiframe.mjs --host=http://localhost:9781 [--only=<name>] [--record]`
 *   --record   write `fixtures/bobiframe-witness/<name>.game.json` (the game's rows; only when the ON model is the
 *              game at 0 px — a witness the model disagrees with is not a fixture)
 * Takes the box lock (kind `browser`).
 */
import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADLESS_LOGIC_ONLY_ARGS } from './headlessChromium.js';
import { assertLogicOnlyChannel } from './seedlingChannel.js';
import { takeBoxLockOrExit } from './boxLock.js';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
export const BOBIFRAME_WITNESS_DIR = 'frontend/modules/seedlingDemo/fixtures/bobiframe-witness';
/** The bodies whose rows the fixture keeps (the two bobs of the x 744 shaft, and the spinner that walls the first). */
export const BOBIFRAME_WATCH = Object.freeze(['bob@736,752', 'bob@736,800', 'spinner@816,848']);
/** The fixture keeps the watched bodies from this tick (the bobs sleep at their placements before it). */
export const BOBIFRAME_BODIES_FROM = 500;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3) ?? fallback);
    const HOST = arg('host', `http://localhost:${process.env.SEEDLING_PORT || '8000'}`).replace(/\/+$/, '');
    const ONLY = arg('only', null)?.split(',') ?? null;
    const RECORD = process.argv.includes('--record');
    const PAGE = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4g';
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE, 'game.html'))) {
        console.log(`SKIP: no wasm artifact ${PAGE}`);
        process.exit(0);
    }
    const PAGE_URL = `${HOST}/frontend/modules/flashPanel/wasm/${PAGE}/game.html`;
    const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
    const { parseTape, gameVisibleTape, heldKeysAt } = await M('tapeFormat.js');
    const { planLevelSetChunks } = await M('levelSetValidator.js');
    const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
    const { withContactFidelity } = await M('contactFidelity.js');
    const { l25Sets } = await M('fidelityL25ApItem.js');
    const SETS = l25Sets(REPO);
    const DIR = join(REPO, BOBIFRAME_WITNESS_DIR);
    const names = readdirSync(DIR).filter((f) => f.endsWith('.tape.json')).map((f) => f.slice(0, -'.tape.json'.length))
        .filter((n) => !ONLY || ONLY.includes(n)).sort();
    console.log(`PAGE: ${PAGE} · delivered ${SETS.delivered.set_id} · ${names.length} witness tape(s)`);

    takeBoxLockOrExit({ name: 'probe-seedling-bobiframe.mjs', kind: 'browser' });
    let failed = 0;
    const check = (label, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };

    /** The model's replay: `rows[t]` after tick t (`rows[0]` = boot) — the player, every bob, every spinner. */
    const model = (tape, walls) => withContactFidelity({ chaserSpinnerWalls: walls }, () => {
        const run = createRunForStaging(stagingFromTape(tape), SETS.deliveredSource);
        const snap = () => ({
            x: run.state.x, y: run.state.y,
            bobs: run.entities('chasers').filter((c) => c.id.startsWith('bob@') && c.removed !== true)
                .map((c) => ({ id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy, hits: c.hits, hitsTimer: c.hitsTimer })),
            // a spinner a press killed fades for ten ticks (`Mobile.death`); its row is not compared
            spinners: (run.entities('spinnerBodies') ?? []).filter((s) => s.removed !== true && s.destroy !== true)
                .map((s) => ({ id: s.id, x: s.x, y: s.y })),
        });
        const rows = [snap()];
        for (let t = 0; t < tape.tick_count; t += 1) {
            run.advance(new Set(heldKeysAt(tape, t)));
            rows.push(snap());
        }
        return { rows, hits: run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id })) };
    });

    const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
    /** The game's rows: `byTick.get(t)` = the last poll before the tick advanced (the final tick keeps its first). */
    const game = async (tape) => {
        const page = await browser.newPage();
        try {
            await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) await page.waitForTimeout(250);
            await page.click('#btn-start');
            for (let i = 0; i < 720 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i += 1) await page.waitForTimeout(250);
            await assertLogicOnlyChannel(page);
            const bot = (n, a) => page.evaluate(([name, x]) => {
                const g = window.__swfBridge.game;
                return String(x === undefined ? g[name]() : g[name](x));
            }, [n, a]);
            const answers = [];
            for (const c of planLevelSetChunks(SETS.delivered).chunks) answers.push(await bot('botLoadLevels', JSON.stringify(c)));
            if (answers.at(-1) !== 'ok') throw new Error(`botLoadLevels: ${answers.join(', ')}`);
            if (await bot('botLoadTape', JSON.stringify(gameVisibleTape(tape))) !== 'ok') throw new Error('botLoadTape');
            if (await bot('botStart') !== 'ok') throw new Error('botStart');
            const byTick = new Map();
            for (const deadline = Date.now() + 600000; Date.now() < deadline;) {
                const raw = await page.evaluate(() => {
                    const g = window.__swfBridge.game;
                    return [String(g.botMobiles()), String(g.botStatus())];
                });
                const m = JSON.parse(raw[0]);
                const s = JSON.parse(raw[1]);
                if (s.error) throw new Error(`botStatus: ${s.error}`);
                const t = m.tick ?? s.tick;
                const final = s.finished || t >= tape.tick_count;
                if (Number.isInteger(t) && t >= 0 && !(final && byTick.has(t))) {
                    byTick.set(t, {
                        player: m.mobiles.find((r) => /Player$/.test(r.cls)) ?? null,
                        hits: s.hits, hits_timer: s.hits_timer, slashTests: s.slash?.tests ?? null,
                        bobs: m.mobiles.filter((r) => /(^|[.:])Bob$/.test(r.cls)),
                        spinners: m.mobiles.filter((r) => /(^|[.:])Spinner$/.test(r.cls)),
                    });
                }
                if (s.finished) return byTick;
            }
            throw new Error('the tape never finished inside the deadline');
        } finally {
            await page.close();
        }
    };

    /** Game vs model over every sampled tick: the first parting of each family, by name. */
    const compare = (g, m, tape) => {
        const out = { sampled: 0, bobComparisons: 0, spinnerComparisons: 0, firstPlayer: null, firstBob: null, firstSpinner: null };
        const nearest = (list, b) => list.reduce((best, x) => (!best
            || Math.hypot(x.x - b.x, x.y - b.y) < Math.hypot(best.x - b.x, best.y - b.y) ? x : best), null);
        for (let t = 1; t <= tape.tick_count; t += 1) {
            const row = g.get(t);
            if (!row?.player) continue;
            out.sampled += 1;
            const mr = m.rows[t];
            if (out.firstPlayer === null && (Math.abs(row.player.x - mr.x) > 1e-9 || Math.abs(row.player.y - mr.y) > 1e-9)) {
                out.firstPlayer = { t, game: [row.player.x, row.player.y], model: [mr.x, mr.y] };
            }
            if (row.bobs.length !== mr.bobs.length && out.firstBob === null) out.firstBob = { t, why: `game ${row.bobs.length} bob(s), model ${mr.bobs.length}` };
            for (const b of mr.bobs) {
                const gb = nearest(row.bobs, b);
                if (!gb) continue;
                out.bobComparisons += 1;
                const d = Math.max(Math.abs(gb.x - b.x), Math.abs(gb.y - b.y), Math.abs(gb.vx - b.vx), Math.abs(gb.vy - b.vy));
                if (out.firstBob === null && (d > 1e-9 || gb.enemy.hits !== b.hits || gb.enemy.hits_timer !== b.hitsTimer)) {
                    out.firstBob = { t, id: b.id, d, game: [gb.x, gb.y, gb.enemy.hits, gb.enemy.hits_timer], model: [b.x, b.y, b.hits, b.hitsTimer] };
                }
            }
            for (const sp of mr.spinners) {
                const gs = nearest(row.spinners, sp);
                if (!gs) continue;
                out.spinnerComparisons += 1;
                if (out.firstSpinner === null && Math.max(Math.abs(gs.x - sp.x), Math.abs(gs.y - sp.y)) > 1e-9) out.firstSpinner = { t, id: sp.id };
            }
        }
        return out;
    };

    try {
        for (const name of names) {
            const tape = parseTape(readFileSync(join(DIR, `${name}.tape.json`), 'utf8'));
            const g = await game(tape);
            const off = model(tape, false);
            const on = model(tape, true);
            const cOff = compare(g, off, tape);
            const cOn = compare(g, on, tape);
            const gameHits = [];
            // a landed `Player.hit` re-arms `hits_timer`; the LETHAL one resets `hits` to 0 instead (the respawn)
            for (let t = 1, timer = 0, hits = 0; t <= tape.tick_count; t += 1) {
                const row = g.get(t);
                if (row.hits_timer > timer || (row.hits === 0 && hits > 0)) gameHits.push(t);
                timer = row.hits_timer;
                hits = row.hits;
            }
            console.log(`ROW ${JSON.stringify({ name, ticks: tape.tick_count, gameHits, off: { ...cOff, hits: off.hits }, on: { ...cOn, hits: on.hits } })}`);
            check(`${name}: every tick of the tape was sampled on the game`, cOn.sampled === tape.tick_count, `${cOn.sampled}/${tape.tick_count}`);
            const exact = cOn.firstPlayer === null && cOn.firstBob === null && cOn.firstSpinner === null;
            check(`${name}: chaserSpinnerWalls ON — the model is the game at 0 px (player, bobs with hits/hits_timer, spinners)`, exact,
                `${cOn.bobComparisons} bob + ${cOn.spinnerComparisons} spinner comparison(s); first partings ${JSON.stringify([cOn.firstPlayer, cOn.firstBob, cOn.firstSpinner])}`);
            check(`${name}: chaserSpinnerWalls ON — the model bills the game's player hits, on the game's ticks`,
                JSON.stringify(on.hits.map((h) => h.t)) === JSON.stringify(gameHits), `game [${gameHits}] model ${JSON.stringify(on.hits)}`);
            console.log(`INFO: ${name}: chaserSpinnerWalls OFF — first bob parting ${JSON.stringify(cOff.firstBob)}, first player parting `
                + `${JSON.stringify(cOff.firstPlayer)}, model hits ${JSON.stringify(off.hits)}`);
            if (RECORD) {
                if (!exact) {
                    console.log(`NOT RECORDED: ${name} — the ON model is not the game`);
                    continue;
                }
                const idOf = (list, t, id, key) => {
                    const mb = on.rows[t][key].find((b) => b.id === id);
                    return mb ? list.reduce((best, x) => (!best || Math.hypot(x.x - mb.x, x.y - mb.y)
                        < Math.hypot(best.x - mb.x, best.y - mb.y) ? x : best), null) : null;
                };
                const bodies = Object.fromEntries(BOBIFRAME_WATCH.map((id) => [id, []]));
                const player = [];
                for (let t = 1; t <= tape.tick_count; t += 1) {
                    const row = g.get(t);
                    player.push([t, row.player.x, row.player.y, row.hits, row.hits_timer, row.slashTests]);
                    if (t < BOBIFRAME_BODIES_FROM) continue;
                    for (const id of BOBIFRAME_WATCH) {
                        const spinner = id.startsWith('spinner@');
                        const b = idOf(spinner ? row.spinners : row.bobs, t, id, spinner ? 'spinners' : 'bobs');
                        if (b) bodies[id].push(spinner ? [t, b.x, b.y] : [t, b.x, b.y, b.vx, b.vy, b.enemy.hits, b.enemy.hits_timer]);
                    }
                }
                const out = {
                    name, page: PAGE, delivered_set: SETS.delivered.set_id,
                    recordedBy: 'scripts/procgen/probe-seedling-bobiframe.mjs --record',
                    note: 'the GAME\'s rows at the Bot\'s observation point. player: [t, x, y, hits, hits_timer, slash tests]; '
                        + `a bob (from t ${BOBIFRAME_BODIES_FROM}): [t, x, y, vx, vy, hits, hits_timer]; the spinner: [t, x, y]`,
                    ticks: tape.tick_count, gameHits, player, bodies,
                };
                writeFileSync(join(DIR, `${name}.game.json`), `${JSON.stringify(out)}\n`);
                console.log(`recorded ${BOBIFRAME_WITNESS_DIR}/${name}.game.json`);
            }
        }
    } finally {
        await browser.close();
    }
    console.log(failed ? `FAILED: ${failed} row(s)` : 'ALL PASS');
    process.exit(failed ? 1 : 0);
}
