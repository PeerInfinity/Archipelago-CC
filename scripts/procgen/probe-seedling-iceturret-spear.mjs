#!/usr/bin/env node
/**
 * probe-seedling-iceturret-spear — ⛓⛓ SEEDLING HAMMER-PHASE C3: **L98'S ICE TURRET, KILLED BY THE GHOST SPEAR
 * THROUGH A WALL, ASKED OF THE GAME.**
 *
 * The divergence sweep's `level_98 -> level_99__r2c7` (legs 745 and 748) refuses unbudgeted at *"kill: no side of
 * iceturret@104,24 is reachable"*: the stairs sit behind `lock@112,112` (`tset -1`, `Game.totalEnemies() == 0`), the
 * count holds the turret, and every sword side of its box lies inside, or is reached only between, the two spinning
 * axes whose hubs sit on its bottom corners. `Player.spear()` has no `collideLine("Solid")` gate (`slash()` has one),
 * and its 32x5 rect reaches the turret from the pockets beside it, through the wall, clear of both axes.
 *
 * Each ARM is a tape (`--author` writes it), played on the game (`--record`), and compared (the default) — the
 * KILLLOCK probe's shape and its readings (`killLockWitness.js`):
 *   · the PLAYER's stream, observation for observation, at 0 px;
 *   · every counted body's `hits`/`hitsTimer` at every sampled tick (`botMobiles()`, the sample clock calibrated
 *     against the player's x/y at shift 0), and its removal tick.
 *
 * Arms:
 *   c3-d1-l98-spear-west   HAND-BUILT (D1): the KILLLOCK turret witness's staging (survey step 200, the route's
 *                          L98 inventory, the spear held) booted in the west pocket, (76,40); the spear selected,
 *                          two thrusts east at the 31-tick cadence. The game: landed t4 / t35 (2 + 2 of `hitsMax`
 *                          3), "dead" t36, the corpse drowns on its own Water tile (removed t47).
 *                          ⚠ `jellyfish@56,48` reaches the player meanwhile, and the second thrust's REPEAT hit
 *                          (`presses.SPEAR_HIT_TICKS_UNMODELLED`) lands on it in the game at t39, past its i-frame
 *                          (a dark-shield bump latched `hitByDarkStuff`): the model carries one landing a thrust,
 *                          so that body's rows disagree from t39. Named, not fixed here (fidelity's region).
 *   c3-l98-spear-l93       PLANNED (D2): sweep leg 745's arrival (L98 from L93, (112,176)) on the same staging
 *                          with the route's `Health` (`hits_max` 4), solved with `ICE_TURRET_SPEAR_ARM` ON: the
 *                          kill rung kills the three jellyfish, the spear arm kills the turret from the west pocket,
 *                          the lock opens and the walk crosses to L99. OFF the same staging refuses with the sweep's
 *                          words (*"no side of iceturret@104,24 is reachable"*).
 *
 * Writes `seedlingDemo/fixtures/iceturret-spear-witness/<arm>.json` (`--author`: the tape and the model's readings;
 * `--record`: adds the game's stream and body rows). `fidelityIceTurretSpear.test.js` replays them in node.
 * `--check` re-derives every arm's tape and compares it with the committed one byte for byte.
 * Prints `PASS:`/`FAIL:` rows and `ALL CHECKS PASSED` / `N CHECK(S) FAILED`.
 *
 * Prereqs: `--record` needs a dev server at the repo root (`SEEDLING_PORT`, default 8000) and the wasm build, or it
 * SKIPs (exit 0); it takes the box lock.
 *
 * Run: node scripts/procgen/probe-seedling-iceturret-spear.mjs --author
 *      SEEDLING_PORT=9574 node scripts/procgen/probe-seedling-iceturret-spear.mjs --record [--arms=a,b]
 *      node scripts/procgen/probe-seedling-iceturret-spear.mjs [--check]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const WITNESS_DIR = join(MODULE, 'fixtures', 'iceturret-spear-witness');
/** The staging every arm starts from: the KILLLOCK turret witness's tape (survey step 200's L98 block). */
const BASE = join(MODULE, 'fixtures', 'killlock-witness', 'killlock-l98-turret.json');

export const ICETURRET_SPEAR_ARMS = Object.freeze([
    Object.freeze({ name: 'c3-d1-l98-spear-west', kind: 'hand', boot: { x: 68, y: 32 }, face: 'right',
        presses: [2, 33], ticks: 60 }),
    Object.freeze({ name: 'c3-l98-spear-l93', kind: 'plan', boot: { x: 112, y: 176 }, hitsMax: 4,
        goals: [{ kind: 'reach-exit', exit: { x: 112, y: 112 } }],
        offRefusal: /reach-exit \(112,112\)->L99 -> kill: no side of iceturret@104,24 is reachable — down: /,
        endLevel: 99 }),
]);

/** The base staging (`stagingFromTape` of the KILLLOCK turret witness's tape) re-pointed at `arm.boot`. */
export async function armStaging(arm) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = JSON.parse(readFileSync(BASE, 'utf8')).tape;
    return stagingFromTape(parseTape({ ...base, boot: { ...base.boot, ...arm.boot },
        seam: { ...base.seam, hits_max: arm.hitsMax ?? base.seam.hits_max } }));
}

/**
 * A planned arm's solve (`twoPassSolve`, the authoring scripts' path) with `ICE_TURRET_SPEAR_ARM` set to `enabled`:
 * `{staging, solved, refusal}`.
 */
export async function armPlan(arm, enabled) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { withIceTurretSpearArm } = await import(join(MODULE, 'solverBot.js'));
    const staging = await armStaging(arm);
    const levelSource = atlasLevelSource();
    const makeRun = (p) => createRunForStaging({ ...staging, persistence: p }, levelSource);
    try {
        const solved = await withIceTurretSpearArm(enabled, () => twoPassSolve({ makeRun,
            goals: arm.goals.map((g) => JSON.parse(JSON.stringify(g))), name: arm.name, boot: staging.boot,
            persistence: staging.persistence, log: () => {} }));
        return { staging, solved, refusal: null };
    } catch (e) {
        return { staging, solved: null, refusal: e };
    }
}

/**
 * The arm's tape, re-derived (deterministic). A hand arm: the base staging with the arm's boot, the spear's slot and
 * its keys. A planned arm: the ON solve's keys and slot selections on the arm's staging (`armPlan`).
 */
export async function armTape(arm) {
    const { parseTape, inventorySlotsFor, INVENTORY_ITEM_IDS } = await import(join(MODULE, 'tapeFormat.js'));
    if (arm.kind === 'plan') {
        const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
        const on = await armPlan(arm, true);
        if (!on.solved) throw new Error(`${arm.name}: the ON solve refused — ${on.refusal?.message?.split('\n')[0]}`);
        const staging = { ...on.staging, persistence: on.solved.persistence,
            equips: [...(on.staging.equips ?? []), ...(on.solved.out.equips ?? [])] };
        const perTick = on.solved.out.perTick;
        return parseTape({ ...buildStagedTape({ staging, perTick, name: arm.name }),
            description: `⛓⛓ SEEDLING HAMMER-PHASE C3 D2 — planned with \`ICE_TURRET_SPEAR_ARM\` ON: the KILLLOCK turret `
                + `witness's staging (survey step 200) at sweep leg 745's arrival (${arm.boot.x},${arm.boot.y}), hits_max `
                + `${arm.hitsMax}. The kill rung kills the three jellyfish, the spear arm kills iceturret@104,24 from the `
                + `west pocket through the wall, the lock opens and the walk crosses to L${arm.endLevel}: ${perTick.length} t. `
                + 'Authored by scripts/procgen/probe-seedling-iceturret-spear.mjs.' });
    }
    const base = JSON.parse(readFileSync(BASE, 'utf8')).tape;
    const slot = inventorySlotsFor(base.seam.items).indexOf(INVENTORY_ITEM_IDS.spear);
    if (slot < 0) throw new Error(`${arm.name}: the base staging holds no spear slot`);
    const inputs = arm.presses.flatMap((p) => [{ key: arm.face, from: p - 1, to: p }, { key: 'primary', from: p, to: p + 1 }]);
    return parseTape({ ...base, name: arm.name, boot: { ...base.boot, ...arm.boot }, equips: [{ t: 0, slot }], inputs,
        tick_count: arm.ticks, hold: false,
        description: `⛓⛓ SEEDLING HAMMER-PHASE C3 D1 — hand-built: the KILLLOCK turret witness's staging (survey step `
            + `200) booted at (${arm.boot.x},${arm.boot.y}), the spear (slot ${slot}) selected at t0, ${arm.presses.length} `
            + `thrust(s) facing ${arm.face} at [${arm.presses.join(', ')}]. Authored by `
            + 'scripts/procgen/probe-seedling-iceturret-spear.mjs.' });
}

async function author(arm) {
    const { modelReadings } = await import(join(MODULE, 'killLockWitness.js'));
    const tape = await armTape(arm);
    const m = modelReadings(tape);
    return { arm: arm.name, tape, model: { died: m.died, gone: m.gone, observations: m.ticks.length,
        crossings: m.ticks.filter((o, i) => i > 0 && o.level !== m.ticks[i - 1].level).map((o) => ({ t: o.t, level: o.level })) } };
}

/** Every disagreement between the game's body samples and the model's, per (tick, class): `[{t, cls, game, model}]`. */
export function bodyDisagreements(samples, bodies, classOf) {
    const out = [];
    const byTick = new Map();
    for (const smp of samples) if (Number.isInteger(smp.t) && !byTick.has(smp.t)) byTick.set(smp.t, smp);
    let compared = 0;
    for (const [t, smp] of byTick) {
        const mb = bodies[t];
        if (!mb) continue;
        for (const cls of ['Jellyfish', 'IceTurret']) {
            const g = smp.rows.filter((r) => r.cls === cls).map((r) => `${r.hits}/${r.hitsTimer}`).sort();
            const mm = Object.entries(mb).filter(([id]) => classOf(id) === cls).map(([, r]) => `${r.hits}/${r.hitsTimer}`).sort();
            if (g.length === 0 && mm.length === 0) continue;
            compared += 1;
            if (JSON.stringify(g) !== JSON.stringify(mm)) out.push({ t, cls, game: g, model: mm });
        }
    }
    return { compared, bad: out };
}

async function record(arms, fileOf) {
    const PAGE_NAME = process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4f';
    const PAGE_URL = `http://localhost:${process.env.SEEDLING_PORT || '8000'}`
        + `/frontend/modules/flashPanel/wasm/${PAGE_NAME}/game.html`;
    if (!existsSync(join(REPO, 'frontend/modules/flashPanel/wasm', PAGE_NAME, 'game.html'))) {
        console.log(`SKIP: seedling wasm build ${PAGE_NAME} not staged`);
        process.exit(0);
    }
    const { chromium } = await import('playwright');
    const { takeBoxLockOrExit } = await import('./boxLock.js');
    takeBoxLockOrExit({ name: 'probe-seedling-iceturret-spear.mjs', kind: 'browser' });
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
                    const rows = (m.mobiles ?? []).filter((r) => /(Jellyfish|IceTurret|Player)$/.test(r.cls));
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

async function main() {
    const AUTHOR = process.argv.includes('--author');
    const RECORD = process.argv.includes('--record');
    const CHECK = process.argv.includes('--check');
    const only = process.argv.find((a) => a.startsWith('--arms='))?.slice(7).split(',') ?? null;
    const arms = ICETURRET_SPEAR_ARMS.filter((a) => !only || only.includes(a.name));
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
            console.log(`AUTHORED: ${arm.name} — ${w.tape.tick_count} tick(s); died ${JSON.stringify(w.model.died)} gone `
                + `${JSON.stringify(w.model.gone)} crossings ${JSON.stringify(w.model.crossings)}`);
        }
    }
    if (RECORD) await record(arms, fileOf);
    const { modelReadings, gameBodyEvents, classOf } = await import(join(MODULE, 'killLockWitness.js'));
    for (const arm of arms) {
        if (!existsSync(fileOf(arm))) { check(`${arm.name}: authored`, false, 'no witness file'); continue; }
        const w = JSON.parse(readFileSync(fileOf(arm), 'utf8'));
        if (CHECK) {
            const again = await author(arm);
            check(`${arm.name}: the committed tape is what this script derives today`,
                JSON.stringify(again.tape) === JSON.stringify(w.tape), 'byte for byte');
            if (arm.kind === 'plan') {
                const off = await armPlan(arm, false);
                check(`${arm.name}: ICE_TURRET_SPEAR_ARM OFF — the staging REFUSES with the sweep's words`,
                    off.solved === null && arm.offRefusal.test(off.refusal?.message ?? ''),
                    (off.refusal?.message ?? 'it solved').split('\n')[0].slice(0, 160));
            }
        }
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
        const { compared, bad } = bodyDisagreements(w.game.samples, m.bodies, classOf);
        const turretBad = bad.filter((b) => b.cls === 'IceTurret');
        check(`${arm.name}: the ice turret's hits and i-frame are the model's at every sampled tick`, turretBad.length === 0,
            turretBad.length ? `first t${turretBad[0].t}: game [${turretBad[0].game}] model [${turretBad[0].model}]` : `${compared} (tick, class) row(s)`);
        const jellyBad = bad.filter((b) => b.cls === 'Jellyfish');
        console.log(`INFO: ${arm.name}: jellyfish rows disagreeing: ${jellyBad.length}${jellyBad.length
            ? ` (first t${jellyBad[0].t}: game [${jellyBad[0].game}] model [${jellyBad[0].model}])` : ''}`);
        if (arm.endLevel !== undefined) {
            check(`${arm.name}: the game crosses to L${arm.endLevel} with no player hit`,
                g.at(-1)?.level === arm.endLevel && w.game.status?.hits === 0,
                `ends ${JSON.stringify(g.at(-1))}, hits ${w.game.status?.hits}`);
        }
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
