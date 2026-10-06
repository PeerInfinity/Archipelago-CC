#!/usr/bin/env node
/**
 * probe-seedling-killlock — ⛓⛓⛓ SEEDLING FIDELITY KILLLOCK, D1/D2: **THE KILL-LOCK ROOMS' BODIES, ASKED OF THE
 * GAME.**
 *
 * A `tset == -1` lock opens on `Game.totalEnemies() == 0` (`Puzzlements/Lock.as:111`). The survey refused L60, L71
 * and L99 because the run stepped none of the bodies those rooms count (jellyfish, lavarunners), and L98's count
 * includes an `IceTurret` whose kill is a corpse that leaves `classCount` only when a fatal tile destroys it. The
 * slice's switches (`seedlingDemo/killLockBodies.js`, OFF by default) bridge the bodies, give the kill work order a
 * chaser arm and ledger the turret corpse's removal. Each ARM here is a tape the model authored with the switches ON
 * (`--author`), played on the game (`--record`), and compared (the default):
 *
 *   · the PLAYER's stream, observation for observation, at 0 px (the lock opening is the crossing tick when the arm
 *     walks through it);
 *   · every counted BODY's death and removal tick: the game's `botMobiles()` rows, sampled every game tick (the
 *     sample clock calibrated against the player's x/y at shift 0, U7's law), against the model's run.
 *
 * Arms (each from the `--through=end` survey's staged boot for that step, `.cache/seedling-survey/through-end/views/`):
 *   killlock-l60-west     step 112: L60 from L59, kill both jellyfish, the lock opens, cross to L61.
 *   killlock-l98-jellies  step 200: L98 from L93, kill the three jellyfish from the south (out of the turret's range);
 *                         the arm ends where the solve refuses — the walk to the turret crosses both spinning axes.
 *   killlock-l98-turret   step 200's staging booted in the water pocket ABOVE the turret: kill it in place (two
 *                         landed presses in the model), its corpse drowns on its own tile (Water) and is removed.
 *
 * Writes `seedlingDemo/fixtures/killlock-witness/<arm>.json` (`--author`: the tape and the model's readings;
 * `--record`: adds the game's stream and body rows). `fidelityKillLock.test.js` replays them in node.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: `--record` needs a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the wasm build, or it
 * SKIPs (exit 0); it takes the box lock. `--author` needs the survey's views (run the `--through=end` survey first).
 *
 * Run: node scripts/procgen/probe-seedling-killlock.mjs --author
 *      SEEDLING_PORT=9440 node scripts/procgen/probe-seedling-killlock.mjs --record [--arms=a,b]
 *      node scripts/procgen/probe-seedling-killlock.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import {
    KILLLOCK_ALL_ON, classOf, gameBodyEvents, modelReadings,
} from '../../frontend/modules/seedlingDemo/killLockWitness.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'killlock-witness');
const VIEWS = join(REPO, '.cache', 'seedling-survey', 'through-end', 'views');

export const KILLLOCK_ARMS = Object.freeze([
    { name: 'killlock-l60-west', step: 112, goals: [{ kind: 'reach-exit', exit: { x: 160, y: 80 } }], expect: 'solved' },
    { name: 'killlock-l98-jellies', step: 200, goals: [{ kind: 'reach-exit', exit: { x: 112, y: 112 } }], expect: 'refused',
        until: 'the three jellyfish are removed' },
    { name: 'killlock-l98-turret', step: 200, boot: { x: 112, y: 12 },
        goals: [{ kind: 'reach-exit', exit: { x: 112, y: 112 } }], expect: 'refused',
        until: 'the turret corpse is removed', tail: 30 },
]);

async function author(arm) {
    const M = (p) => import(join(MODULE, p));
    const { parseTape } = await M('tapeFormat.js');
    const { stagingFromTape, createRunForStaging } = await M('tapeRunner.js');
    const { buildStagedTape } = await M('botDriverV1.js');
    const { atlasLevelSource } = await M('levelSource.js');
    const { twoPassSolve } = await M('twoPassSolve.js');
    const { withKillLockBodies } = await M('killLockBodies.js');
    const viewPath = join(VIEWS, `step-${arm.step}-boot.json`);
    if (!existsSync(viewPath)) throw new Error(`${arm.name}: ${viewPath} is missing — run the --through=end survey first`);
    const staging = stagingFromTape(parseTape(readFileSync(viewPath, 'utf8')));
    if (arm.boot) staging.boot = { ...staging.boot, ...arm.boot };
    const levelSource = atlasLevelSource();
    const makeRun = (p) => createRunForStaging({ ...staging, persistence: p }, levelSource);
    let perTick;
    let persistence = staging.persistence;
    let equips = staging.equips ?? [];
    let verdict;
    await withKillLockBodies(KILLLOCK_ALL_ON, async () => {
        try {
            const out = await twoPassSolve({ makeRun, goals: arm.goals, name: arm.name, boot: staging.boot,
                persistence: staging.persistence });
            perTick = out.out.perTick;
            persistence = out.persistence;
            equips = [...equips, ...(out.out.equips ?? [])];
            verdict = 'solved';
        } catch (e) {
            if (!e.perTick) throw e;
            perTick = e.perTick;
            verdict = `refused: ${e.message.split('\n')[0].slice(0, 300)}`;
        }
    });
    let tape = parseTape({ ...buildStagedTape({ staging: { ...staging, persistence, equips }, perTick, name: arm.name }),
        description: `SEEDLING FIDELITY KILLLOCK witness arm ${arm.name} (step ${arm.step}${arm.boot
            ? `, booted at (${arm.boot.x},${arm.boot.y})` : ''}), authored by the model with every KILLLOCK switch ON. `
            + `Solve: ${verdict}. Authored by scripts/procgen/probe-seedling-killlock.mjs.` });
    // A refused arm ends where its witness ends: the last body event plus `tail` ticks.
    if (arm.expect === 'refused') {
        const m = modelReadings(tape);
        const last = Math.max(...Object.values(m.gone), ...Object.values(m.died));
        const end = Math.min(perTick.length, last + (arm.tail ?? 20));
        tape = parseTape({ ...buildStagedTape({ staging: { ...staging, persistence, equips },
            perTick: perTick.slice(0, end), name: arm.name }), description: tape.description });
    }
    const model = modelReadings(tape);
    return { arm: arm.name, step: arm.step, verdict, tape, model: { died: model.died, gone: model.gone,
        observations: model.ticks.length, crossings: model.ticks.filter((o, i) => i > 0 && o.level !== model.ticks[i - 1].level)
            .map((o) => ({ t: o.t, level: o.level })) } };
}

async function main() {
    const AUTHOR = process.argv.includes('--author');
    const RECORD = process.argv.includes('--record');
    const only = process.argv.find((a) => a.startsWith('--arms='))?.slice(7).split(',') ?? null;
    const arms = KILLLOCK_ARMS.filter((a) => !only || only.includes(a.name));
    let failed = 0;
    const check = (name, ok, detail = '') => {
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
        if (!ok) failed += 1;
    };
    mkdirSync(WITNESS_DIR, { recursive: true });
    const fileOf = (a) => join(WITNESS_DIR, `${a.name}.json`);
    if (AUTHOR) {
        for (const arm of arms) {
            const w = await author(arm);
            writeFileSync(fileOf(arm), `${JSON.stringify(w)}\n`);
            console.log(`AUTHORED: ${arm.name} — ${w.verdict.slice(0, 120)}; ${w.tape.tick_count} tick(s); died `
                + `${JSON.stringify(w.model.died)} gone ${JSON.stringify(w.model.gone)} crossings ${JSON.stringify(w.model.crossings)}`);
            check(`${arm.name}: the solve's verdict is the arm's (${arm.expect})`, w.verdict.startsWith(arm.expect));
        }
    }
    if (RECORD) {
        const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
        const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
            + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
        if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
            console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
            process.exit(0);
        }
        const { takeBoxLockOrExit } = await import('./boxLock.js');
        takeBoxLockOrExit({ name: 'probe-seedling-killlock.mjs', kind: 'browser' });
        const { HEADLESS_LOGIC_ONLY_ARGS } = await import('./headlessChromium.js');
        const { assertLogicOnlyChannel } = await import('./seedlingChannel.js');
        const { gameVisibleTape } = await import(join(MODULE, 'tapeFormat.js'));
        const browser = await chromium.launch({ args: HEADLESS_LOGIC_ONLY_ARGS });
        try {
            for (const arm of arms) {
                const w = JSON.parse(readFileSync(fileOf(arm), 'utf8'));
                const page = await browser.newPage();
                try {
                    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
                    for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.__runtimeReady)); i++) await page.waitForTimeout(250);
                    await page.click('#btn-start');
                    for (let i = 0; i < 480 && !(await page.evaluate(() => !!(window.__swfBridge?.game?.botStatus))); i++) await page.waitForTimeout(250);
                    await assertLogicOnlyChannel(page);
                    const bot = (n, a) => page.evaluate(([name, x]) => {
                        const g = window.__swfBridge.game;
                        return String(x === undefined ? g[name]() : g[name](x));
                    }, [n, a]);
                    const loaded = await bot('botLoadTape', JSON.stringify(gameVisibleTape(w.tape)));
                    if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
                    const started = await bot('botStart');
                    if (started !== 'ok') throw new Error(`botStart: ${started}`);
                    const ticks = [];
                    const samples = [];
                    let status = null;
                    const deadline = Date.now() + 900000;
                    while (Date.now() < deadline) {
                        const raw = await page.evaluate(() => {
                            const g = window.__swfBridge.game;
                            return [String(g.botMobiles()), String(g.botStatus()), String(g.botDrain())];
                        });
                        const m = JSON.parse(raw[0]);
                        const s = JSON.parse(raw[1]);
                        ticks.push(...(JSON.parse(raw[2]).ticks ?? []));
                        const t = m.tick ?? s.tick;
                        const rows = (m.mobiles ?? []).filter((r) => /(Jellyfish|LavaRunner|IceTurret|Player)$/.test(r.cls));
                        samples.push({ t, rows: rows.map((r) => ({ cls: r.cls.replace(/^.*[.:]/, ''), x: r.x, y: r.y,
                            anim: r.anim ?? null, destroy: r.destroy ?? null, alpha: r.alpha ?? null,
                            hits: r.enemy?.hits ?? null, hitsTimer: r.enemy?.hits_timer ?? null })) });
                        if (s.finished) { status = s; break; }
                    }
                    ticks.push(...(JSON.parse(await bot('botDrain')).ticks ?? []));
                    const seenT = new Set();
                    const once = samples.filter((x) => Number.isInteger(x.t) && !seenT.has(x.t) && seenT.add(x.t));
                    w.game = { build: PAGE_NAME, ticks, samples: once, status: status ? { tick: status.tick, level: status.level,
                        hits: status.hits ?? null, error: status.error ?? '' } : null };
                    writeFileSync(fileOf(arm), `${JSON.stringify(w)}\n`);
                    console.log(`RECORDED: ${arm.name} — ${ticks.length} observation(s), ${samples.length} sample(s)`);
                } finally {
                    await page.close();
                }
            }
        } finally {
            await browser.close();
        }
    }
    // ── the compare (node only) ─────────────────────────────────────────
    for (const arm of arms) {
        if (!existsSync(fileOf(arm))) { check(`${arm.name}: authored`, false, 'no witness file'); continue; }
        const w = JSON.parse(readFileSync(fileOf(arm), 'utf8'));
        if (!w.game) { check(`${arm.name}: recorded on the game`, false, 'no game readings (run --record)'); continue; }
        const m = modelReadings(w.tape);
        const g = w.game.ticks;
        const first = g.findIndex((o, i) => !m.ticks[i] || o.level !== m.ticks[i].level || o.x !== m.ticks[i].x
            || o.y !== m.ticks[i].y);
        check(`${arm.name}: the game's player stream is the model's, observation for observation (0 px)`,
            first === -1 && g.length === m.ticks.length,
            first === -1 ? `${g.length} observation(s)` : `first difference at t${first}: game ${JSON.stringify(g[first])}, `
                + `model ${JSON.stringify(m.ticks[first])}`);
        const ev = gameBodyEvents(w.game.samples, m.ticks);
        check(`${arm.name}: the sample clock is the model's (every sampled player x/y at shift 0)`, ev.calibrated,
            `${ev.sampled} sample(s)`);
        // Per sampled tick, per class: the multiset of (hits, hitsTimer) — the damage the bodies took, tick for tick.
        const bad = [];
        let comparedDamage = 0;
        const byTick = new Map();
        for (const smp of w.game.samples) if (Number.isInteger(smp.t) && !byTick.has(smp.t)) byTick.set(smp.t, smp);
        for (const [t, smp] of byTick) {
            const mb = m.bodies[t];
            if (!mb) continue;
            for (const cls of ['Jellyfish', 'LavaRunner', 'IceTurret']) {
                const g = smp.rows.filter((r) => r.cls === cls).map((r) => `${r.hits}/${r.hitsTimer}`).sort();
                const mm = Object.entries(mb).filter(([id]) => classOf(id) === cls)
                    .map(([, r]) => `${r.hits}/${r.hitsTimer}`).sort();
                if (g.length === 0 && mm.length === 0) continue;
                comparedDamage += 1;
                if (JSON.stringify(g) !== JSON.stringify(mm)) bad.push(`t${t} ${cls}: game [${g}] model [${mm}]`);
            }
        }
        check(`${arm.name}: every counted body's hits and i-frame are the model's at every sampled tick`, bad.length === 0,
            bad.length ? `${bad.length} disagreement(s), first ${bad.slice(0, 3).join('; ')}` : `${comparedDamage} (tick, class) row(s)`);
        for (const [id, t] of Object.entries(m.gone)) {
            const gt = ev.gone[classOf(id)]?.shift();
            check(`${arm.name}: ${id} leaves the world on t${t} in the model, and in the game`,
                gt !== undefined && gt.lo <= t && t <= gt.hi, gt ? `game between t${gt.lo} and t${gt.hi}` : 'the game never removed it');
        }
    }
    console.log(failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED');
    process.exit(failed ? 1 : 0);
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();
