#!/usr/bin/env node
/**
 * probe-seedling-r6-owl-prefix — ⛔⛔⛔ ATTRIBUTE THE TICK-23 DIVERGENCE.
 *
 * R6 slice 6g, the slice's first job. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §20.7 and §20.11.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────
 *
 * Slice 6f's `--win --record --only=r6-owl-kill` produced a valid 910-
 * observation recording whose every scalar check passed and whose STREAM
 * diverged at tick 23: the game's player went 74.245 -> 72.589 (-1.66 px in
 * one tick) while the model walked on to 75.677. §20.7 left three candidates
 * and named the instrument that separates them — and the instrument is
 * already in the build, so this costs one short arm rather than an AS3 batch.
 *
 * ⛓⛓⛓ **THE PLAYER'S OWN i-FRAME IS A CLOCK, AND IT RUNS BACKWARDS FROM
 * THE POLL.** `Player.hitsTimerMax` is **20** and `hitUpdate` decrements it
 * once per frame, so `botStatus.hits_timer` read at the end of a T-tick arm
 * pins the hit to tick `T - (20 - hits_timer)`. Two arms of different lengths
 * therefore have to agree on ONE tick, which is a two-sided measurement
 * rather than a single reading — and it is the same shape as §19.4's
 * two-quantity fit, for the same reason (the readout is LIVE and the game
 * does not stop when the tape does).
 *
 * ⛓⛓ **AND THE STREAM ITSELF WITNESSES THE HIT A SECOND WAY.**
 * `Player.input()` gates its ENTIRE movement block on `if (hitsTimer <= 0)`
 * (`Player.as:1526`), so a hit does not merely knock — it takes the player's
 * controls away for twenty ticks. The position stream after a hit is pure
 * friction on the knock vector, which is a signature no walking player can
 * produce. ⇒ the hit tick is readable off the observations alone, and the
 * i-frame clock is its independent confirmation.
 *
 * ── THE THREE CANDIDATES, AND WHAT SEPARATES THEM ─────────────────────
 *
 *  1. **the Owl's own `hitPlayer`** — refused by the model for 30 ticks after
 *     the lava hit (`Enemy.hit` sets `hitsTimer = hitsTimerMax = 30` and
 *     `hitPlayer` gates on `hitsTimer <= 0`). `botMobiles`' FinalBoss row
 *     carries `enemy.hits_timer`, so the arm reads his gate directly — and
 *     his POSITION says whether his box could have reached the player at all.
 *  2. **a grenade the model places elsewhere** — `botMobiles` is a census of
 *     every `Mobile` in the world, so a Grenade the model does not have is
 *     visible as a ROW, not as an inference.
 *  3. **a pod's pin** — `botMobiles` reports the four pods with their `anim`,
 *     so a 22-tick phase error is a direct read too.
 *
 * ⛔ AND THE CENSUS IS WHAT MAKES A NEGATIVE ANSWER USABLE. If the world at
 * the end of the arm holds exactly the boss and nothing else, then whatever
 * hit the player was the boss or was not in this room's roster at all — which
 * is a fourth candidate the session would otherwise have had to invent.
 *
 * ── WHY HEADLESS, WHEN THE RECORDING MUST BE `--win` ──────────────────
 *
 * §19.10's WALL 1 is about the BARRAGE: the swiftshader renderer runs the
 * rockfall phase at well under a tenth of realtime. These arms end before the
 * boss reaches his first pod, so every tick is a walk tick and the whole
 * probe is minutes rather than hours. Headless also keeps the Windows browser
 * free, which is the `probe-seedling-r6-boss-rooms` precedent. The RE-RECORD
 * is still `--win`; a probe is not a recording.
 *
 * Usage (dev server on :8000 at the repo root):
 *   node scripts/procgen/probe-seedling-r6-owl-prefix.mjs [--out <path>]
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + `${process.env.SEEDLING_PAGE || 'seedling_bot_ap_p4b'}/game.html`;

const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0
    ? process.argv[outArg + 1]
    : join(MODULE, 'fixtures', 'owl-prefix-oracle.json');

const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { heldKeysAt, parseTape } = await import(join(MODULE, 'tapeFormat.js'));

/**
 * ⛓ THE ARMS ARE PREFIXES OF THE PLAN'S OWN TAPE, not of a second copy of
 * the controller. `plan-seedling-r6-wowl.mjs --write` is the one place the
 * plan exists; re-deriving the spans here would be a second implementation of
 * the thing under test, and the arms would stop being prefixes the moment the
 * two drifted. (The plan script runs its whole 909-tick search on import, so
 * importing it is not an option either.)
 */
const TAPE_PATH = join(MODULE, 'fixtures', 'tapes', 'r6-owl-kill.json');
let PLAN;
try {
    PLAN = parseTape(readFileSync(TAPE_PATH, 'utf8'));
} catch (e) {
    console.error(`${e.message}\n\nThis probe replays PREFIXES of the W-owl tape. `
        + 'Write it first:\n  node scripts/procgen/plan-seedling-r6-wowl.mjs --write');
    process.exit(1);
}

/** `Player.hitsTimerMax` — the i-frame clock this probe reads backwards. */
const PLAYER_HITS_TIMER_MAX = 20;
/**
 * The arms.
 *
 *  · `prefix` — the plan's own spans, cut short. Two lengths, so the hit tick
 *    the i-frame clock recovers is a FIT rather than a reading.
 *  · `shove`  — the SECOND question, and the one the prefix arm's answer makes
 *    urgent. If the intro press delivers no slash, then no press on this rung
 *    has ever been measured against the game at all: §19.6's 68.25 px and
 *    §20.5's 7-of-15 are both derivations over an update ORDER nothing has
 *    checked. This arm stands still at the boot stance and presses ONCE after
 *    the intro, so `botStatus.slash.{tests, hits}` counts the dispatches and
 *    `botMobiles` reports where the shove actually left him.
 */
const ARMS = (process.env.ARMS === 'shove1' ? [
    // ⛔ THE SECOND REFUTATION (§21.11): the re-searched tape's own first
    // SHOVE. Three lengths across the coast the lava knock throws him into,
    // so the boss's polled position measures the shove's arithmetic at three
    // points rather than at its end.
    { kind: 'prefix', ticks: 22 },
    { kind: 'prefix', ticks: 45 },
    { kind: 'prefix', ticks: 74 },
] : [
    { kind: 'prefix', ticks: 24 },
    { kind: 'prefix', ticks: 40 },
    { kind: 'shove', ticks: 26, press: 6 },
]);
/** Repeats per arm; the poll drift is never negative, so take the MAX timer. */
const REPEATS = 2;

/** The plan's spans, cut at `ticks` — `heldKeysAt` is half-open on `to`. */
const prefixInputs = (ticks) => PLAN.inputs
    .filter((s) => s.from < ticks)
    .map((s) => ({ ...s, to: Math.min(s.to, ticks) }));

/**
 * ⛓ THE SHOVE ARM'S SPANS: the intro press and one more, and NO MOVEMENT.
 *
 * A stationary player is the only stance whose slash rect is a constant, and
 * the rect is the quantity in question — so the arm asks about the shove
 * without also asking about the facing a walk would have set.
 */
const shoveInputs = (press) => [
    { key: 'primary', from: 2, to: 3 },
    { key: 'primary', from: press, to: press + 1 },
];

/**
 * The model's own prefix of the same spans. Written beside the game's so the
 * comparison is per tick and by DELTA (trap 105) — a constant offset and a
 * knock look identical in absolute positions.
 */
function modelPrefix(ticks, inputs) {
    const run = createLevelRun({
        levelSource: atlasLevelSource(),
        boot: PLAN.boot,
        noclip: PLAN.noclip,
        noHazards: PLAN.noHazards,
        noDamage: PLAN.noDamage,
        grants: PLAN.grants,
        persistence: PLAN.persistence,
        equips: PLAN.equips,
        pins: PLAN.pins,
        save: PLAN.save,
        rng: PLAN.rng,
        roles: ROLES,
    });
    const stream = [];
    for (let t = 0; t < ticks; t += 1) {
        stream.push({ t, x: run.state.x, y: run.state.y, level: run.level });
        run.advance(heldKeysAt({ inputs }, t));
    }
    stream.push({ t: ticks, x: run.state.x, y: run.state.y, level: run.level });
    return { run, stream };
}

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

/** One run of one arm. */
async function runArm(ticks, inputs) {
    const page = await browser.newPage();
    const bot = (n, a) => page.evaluate(
        ([nn, x]) => String(window.__swfBridge.game[nn](x)), [n, a]);
    const botJson = async (n, a) => JSON.parse(await bot(n, a));
    try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
        for (let i = 0; i < 480
            && !(await page.evaluate(() => !!window.__runtimeReady)); i += 1) {
            await page.waitForTimeout(250);
        }
        await page.click('#btn-start');
        for (let i = 0; i < 480 && !(await page.evaluate(
            () => !!(window.__swfBridge?.game?.botStatus))); i += 1) {
            await page.waitForTimeout(250);
        }
        const tape = {
            tape_version: 7,
            game: 'seedling',
            name: `owl-prefix-${ticks}`,
            description: 'R6 slice 6g: the W-owl plan\'s first ticks, to attribute '
                + '§20.7\'s tick-23 divergence.',
            boot: PLAN.boot,
            noclip: PLAN.noclip,
            // ⛔ THE PLAN'S OWN `noDamage: false`, AND THAT IS THE WHOLE PROBE.
            // `Player.hit`'s first line is `if (Bot.noDamage) return;`, so a
            // relaxed arm cannot show the hit this probe exists to attribute.
            noDamage: PLAN.noDamage,
            noHazards: PLAN.noHazards,
            grants: PLAN.grants,
            persistence: PLAN.persistence,
            equips: PLAN.equips,
            pins: PLAN.pins,
            save: PLAN.save,
            rng: PLAN.rng,
            tick_count: ticks,
            inputs,
        };
        const loaded = await bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

        let st = null;
        const DEADLINE = Date.now() + 30 * 60 * 1000;
        for (;;) {
            st = await botJson('botStatus');
            if (st.finished) break;
            if (Date.now() > DEADLINE) {
                throw new Error(`deadline at tick ${st.tick}/${st.tick_count}, `
                    + `dead_frames ${st.dead_frames}`);
            }
            await page.waitForTimeout(60);
        }
        const mob = await botJson('botMobiles');
        const drained = await botJson('botDrain');
        return { status: st, mobiles: mob, stream: drained };
    } finally {
        await page.close();
    }
}

const rows = [];
try {
    for (const { kind, ticks, press } of ARMS) {
        const inputs = kind === 'shove' ? shoveInputs(press) : prefixInputs(ticks);
        const model = modelPrefix(ticks, inputs);
        const runs = [];
        for (let i = 0; i < REPEATS; i += 1) runs.push(await runArm(ticks, inputs));
        // ⛔ THE POLL IS LATE, NEVER EARLY (§19.4), and `hits_timer` counts
        // DOWN — so the largest reading is the least drifted one.
        const best = runs.reduce((a, b) => (
            (b.status.hits_timer ?? 0) > (a.status.hits_timer ?? 0) ? b : a));
        const gameTicks = best.stream.ticks;
        const modelTicks = model.stream;
        // The per-tick comparison, by DELTA as well as by position.
        const cmp = [];
        for (let i = 0; i < Math.min(gameTicks.length, modelTicks.length); i += 1) {
            const g = gameTicks[i];
            const m = modelTicks[i];
            const gp = gameTicks[i - 1];
            const mp = modelTicks[i - 1];
            cmp.push({
                t: g.t,
                gx: g.x, gy: g.y, mx: m.x, my: m.y,
                gdx: gp ? g.x - gp.x : null, gdy: gp ? g.y - gp.y : null,
                mdx: mp ? m.x - mp.x : null, mdy: mp ? m.y - mp.y : null,
                agree: g.x === m.x && g.y === m.y && g.level === m.level,
            });
        }
        const firstDiff = cmp.find((r) => !r.agree) ?? null;
        const boss = (best.mobiles.mobiles ?? [])
            .find((m) => String(m.cls).includes('FinalBoss')) ?? null;
        const others = (best.mobiles.mobiles ?? [])
            .filter((m) => !String(m.cls).includes('FinalBoss'))
            .map((m) => ({ cls: m.cls, x: m.x, y: m.y, anim: m.anim, type: m.type }));
        const mb = model.run.finalBosses[0] ?? null;
        const st = best.status;
        /**
         * ⛔ THE POLL IS LATE, SO THE CLOCK READS LOW — and §19.4's finding is
         * that the lateness is DETERMINISTIC per arm, so a minimum over
         * repeats does not remove it. The cure is the same one: report the
         * reading at every plausible drift and let two arms of different
         * lengths intersect on ONE tick. A model wrong about the hit would
         * have to be wrong by the same drift on both arms to survive it.
         */
        const hitTickAtDrift = (st.hits_timer ?? 0) > 0
            ? [0, 1, 2, 3].map((d) => ticks - (PLAYER_HITS_TIMER_MAX - st.hits_timer - d))
            : null;
        rows.push({
            kind,
            ticks,
            press: press ?? null,
            inputs,
            observations: gameTicks.length,
            dead_frames: st.dead_frames,
            game: {
                hits: st.hits, hits_timer: st.hits_timer, drown_timer: st.drown_timer,
                frozen_timer: st.frozen_timer, slash: st.slash, x: st.x, y: st.y,
                rng_state: st.rng?.state, game_time: st.game_time,
                saw_auto_advance: st.saw_auto_advance, menu: st.menu,
            },
            /**
             * `hits_timer` read backwards at each plausible poll drift; null
             * when the arm ends past the i-frame. The ANSWER is the value the
             * arms share.
             */
            recoveredHitTickAtDrift: hitTickAtDrift,
            hitsTimerRuns: runs.map((r) => r.status.hits_timer),
            model: {
                hits: model.run.playerHits.length,
                hitSources: model.run.playerHits.map((h) => `t${h.t} ${h.source}`),
                x: modelTicks[modelTicks.length - 1].x,
                y: modelTicks[modelTicks.length - 1].y,
                shoves: model.run.finalBossShoves.length,
                shovesLanded: model.run.finalBossShoves.filter((h) => h.landed).length,
                lava: model.run.finalBossLava.map((l) => l.t),
                streamCount: model.run.owlStreamCount,
                rocks: model.run.owlRockLandings.length,
                grenades: model.run.owlGrenadeEvents.length,
            },
            boss: boss ? {
                x: boss.x, y: boss.y, vx: boss.vx, vy: boss.vy, anim: boss.anim,
                type: boss.type, hits: boss.enemy?.hits, hits_timer: boss.enemy?.hits_timer,
                can_hit: boss.enemy?.can_hit, max_force: boss.enemy?.max_force,
            } : null,
            modelBoss: mb ? {
                x: mb.x, y: mb.y, vx: mb.vx, vy: mb.vy, anim: mb.anim,
                hits: mb.hits, hits_timer: mb.hitsTimer,
                can_hit: mb.canHit, max_force: mb.maxForce,
            } : null,
            /** ⛔ THE CENSUS — a body the model does not have is a ROW here. */
            otherMobiles: others,
            /**
             * ⚠ COMPARE PODS BY POSITION, NEVER BY INDEX. `botMobiles` walks
             * `FP.world.getClass(Pod, …)` — the level's ADD order — and the
             * model's `owlPods` is in `FinalBoss.podPositions` order. In L112
             * the two are a rotation of each other, so an index-wise print
             * shows pod 0 closed against pod 3 closed on a run where the two
             * agree perfectly. Slice 6g nearly spent an attribution on it.
             */
            pods: (best.mobiles.pods ?? [])
                .map((p) => ({ x: p.x, y: p.y, anim: p.anim }))
                .sort((u, v) => u.x - v.x || u.y - v.y),
            modelPods: model.run.owlPods.map((p) => ({ x: p.x, y: p.y, anim: p.anim }))
                .sort((u, v) => u.x - v.x || u.y - v.y),
            firstDivergence: firstDiff,
            perTick: cmp,
        });

        console.log(`\n━━ ARM ${kind} ${ticks} ticks — ${gameTicks.length} observations, `
            + `dead ${st.dead_frames}`);
        console.log(`   player: game hits ${st.hits} hits_timer ${st.hits_timer} `
            + `(runs ${runs.map((r) => r.status.hits_timer).join('/')}) drown `
            + `${st.drown_timer} | model hits ${model.run.playerHits.length} `
            + `${JSON.stringify(model.run.playerHits.map((h) => `t${h.t} ${h.source}`))}`);
        console.log('   recovered hit tick by poll drift 0/1/2/3: '
            + `${hitTickAtDrift ? hitTickAtDrift.join(' / ') : '(no live i-frame at the poll)'}`);
        console.log(`   slash: ${JSON.stringify(st.slash)} | model shoves `
            + `${model.run.finalBossShoves.length} landed `
            + `${model.run.finalBossShoves.filter((h) => h.landed).length}`);
        console.log(`   boss:  game (${boss?.x?.toFixed(3)}, ${boss?.y?.toFixed(3)}) `
            + `v(${boss?.vx?.toFixed(3)}, ${boss?.vy?.toFixed(3)}) h${boss?.enemy?.hits} `
            + `ht${boss?.enemy?.hits_timer} anim ${boss?.anim}`);
        console.log(`          model (${mb?.x?.toFixed(3)}, ${mb?.y?.toFixed(3)}) `
            + `v(${mb?.vx?.toFixed(3)}, ${mb?.vy?.toFixed(3)}) h${mb?.hits} `
            + `ht${mb?.hitsTimer} anim ${mb?.anim}`);
        console.log(`   other mobiles: ${others.length ? JSON.stringify(others) : 'NONE'}`);
        const podLine = (rows) => JSON.stringify(rows
            .map((p) => `(${p.x},${p.y}) ${p.anim}`));
        console.log(`   pods game ${podLine(rows[rows.length - 1].pods)}`);
        console.log(`        model ${podLine(rows[rows.length - 1].modelPods)}`);
        console.log('    t |        game x, y        |       model x, y        '
            + '|      game dx, dy    |     model dx, dy');
        for (const r of cmp) {
            const f = (v) => (v === null || v === undefined ? '     -' : v.toFixed(3).padStart(8));
            console.log(`  ${String(r.t).padStart(3)} |${f(r.gx)},${f(r.gy)} |`
                + `${f(r.mx)},${f(r.my)} |${f(r.gdx)},${f(r.gdy)} |`
                + `${f(r.mdx)},${f(r.mdy)}  ${r.agree ? '' : '  <<< DIFFERS'}`);
        }
    }

    const out = {
        note: 'R6 slice 6g. The W-owl plan\'s first ticks on the live game, beside the '
            + 'model\'s own, to attribute the tick-23 divergence §20.7 recorded. '
            + 'Written by scripts/procgen/probe-seedling-r6-owl-prefix.mjs.',
        boot: PLAN.boot,
        rng: PLAN.rng,
        playerHitsTimerMax: PLAYER_HITS_TIMER_MAX,
        repeats: REPEATS,
        rows,
    };
    writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`\nwrote ${OUT} (${rows.length} arms)`);
} finally {
    await browser.close();
}
