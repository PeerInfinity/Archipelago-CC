#!/usr/bin/env node
/**
 * probe-seedling-r6-owl-rng — THE OWL ROOM'S DRAW SCHEDULE, FROM THE GAME.
 *
 * R6 slice 6e, the opening bill. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §16.8.
 *
 * ── WHAT A KNOWN ANSWER LOOKS LIKE FOR A SCHEDULE ─────────────────────
 *
 * `rng.js` is pinned against the live stream draw for draw (`rng-oracle.json`),
 * so the GENERATOR is not in question. What §16.8 leaves owed is the
 * SCHEDULE: how many times L112 turns the crank on tick N and in what order,
 * over three interleaved producers one of which feeds back through the rock
 * the draws just made.
 *
 * ⛓⛓⛓ **AND THE GAME ALREADY REPORTS THE ANSWER.** `botStatus.rng.state` is
 * the generator's live uint32 (slice 6a), and the state after k draws from a
 * declared seed is a strictly-injective function of k over the orbit — so
 * stepping the model's LFSR from the seed until it matches the reported state
 * recovers **exactly how many draws the run made**, with no instrument on the
 * game side beyond the one that already shipped. A schedule that is one draw
 * per rock landing short (the `split: false` failure §16.8's table is about)
 * cannot survive that comparison for a single barrage.
 *
 * ⚠ THIS IS A COUNT, NOT AN ORDER. Two schedules that draw the same NUMBER of
 * times per tick agree here even if they attribute the draws to the wrong
 * sites. The order is pinned one stratum down, by the fight model consuming
 * the draws in `OWL_PHASE_SITES`' order and reproducing the rocks' POSITIONS
 * and SIZES — a value check, which the count cannot be. Both are needed and
 * this is the cheap half; it is also the half that catches an entire producer
 * being missing, which is the defect §16.8 was written about.
 *
 * ── ⛔⛔⛔ THE READOUT IS LIVE, AND THE TAPE ENDING DOES NOT STOP THE GAME
 *
 * `Bot`'s finish is `armed = false; finished = true;` (`Bot.as:2042`) and
 * nothing else — the world keeps updating, the Owl keeps rolling, and
 * `botStatus.rng.state` keeps moving. So a state read after a poll sees the
 * true count PLUS however many frames elapsed between the finish and the
 * poll. Measured on this room the drift is 0 or 1; it is never negative.
 *
 * ⚠⚠ **AND THE LATENCY IS DETERMINISTIC PER ARM, SO A MINIMUM DOES NOT
 * REMOVE IT.** Each arm is still run `REPEATS` times and the minimum taken —
 * cheap, and it catches a genuinely variable box — but both repeats of the
 * 45-tick arm at seed 101 came back one frame late, identically. The cure is
 * downstream, in `finalBossRng.test.js`: the SAME offset appears in the draw
 * count AND in the boss's position, and the position is QUANTISED (he walks a
 * 0.5303300858899106 px lattice, so his displacement counts his moving frames
 * exactly). So the check is a TWO-QUANTITY FIT at one unknown offset, and the
 * offset it recovers is the instrument's, named rather than tolerated.
 *
 * ⇒ that is why `boss` is in every row. It is not diagnostics; it is the
 * second quantity the fit needs.
 *
 * ⛔ AND IT IS WHY THE FIRST READING OF THIS PROBE WAS MIS-DIAGNOSED, TWICE.
 * Against a single run per arm the model came out one draw short on two of
 * five arms and exact on the other three — a NON-MONOTONE offset, which is
 * impossible between two prefixes of one stream and is therefore always the
 * instrument. The second mis-reading was mine in the other direction: the
 * position looked drift-FREE (it settled the release-edge question cleanly),
 * when what it actually is is drift-VISIBLE — which is better, and is what
 * makes the fit possible at all.
 *
 * ── WHY `noDamage: true` ON A PROBE WHOSE WINDOW WILL NOT HAVE IT ─────
 *
 * `Player.hit`'s FIRST line is `if (Bot.noDamage) return;`, above
 * `Game.shake += 5` — so the relaxation removes a shake writer and, with it,
 * a source of jiggle draws that depends on a stance this probe has not
 * planned yet. The probe stands still in a corner and lets the barrage come;
 * without the relaxation a third hit would `die()` and swap the world, and the
 * count would be of two worlds. The window itself declares `noDamage: false`
 * and prices those draws for real.
 *
 * Usage (dev server on :8000 at the repo root):
 *   node scripts/procgen/probe-seedling-r6-owl-rng.mjs [--out <path>]
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const PAGE_URL = 'http://localhost:8000/frontend/modules/flashPanel/wasm/'
    + 'seedling_bot_ap/game.html';

const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0
    ? process.argv[outArg + 1]
    : join(MODULE, 'fixtures', 'owl-rng-oracle.json');

const { step, STATE_MAX } = await import(join(MODULE, 'rng.js'));

/**
 * ⚠ THE BOOT IS A CORNER, AND THAT IS THE POINT.
 *
 * `Game(112, 32, 208)` spawns at (40, 216) — tile (2,13), `Rock Wall (floor)`,
 * the south-west corner and the furthest walkable cell from the lava octagon
 * (x[80,160) y[96,160)) and from `finalboss@64,96`'s entity point (72,104).
 * A probe that measures a DRAW COUNT must not be near anything whose
 * behaviour it would perturb, and `activeOffScreen = true` means the barrage
 * comes anyway — which is exactly the producer being counted.
 */
const BOOT = { level: 112, x: 32, y: 208 };

/**
 * The intro is ended by an X RELEASE and by nothing else
 * (`FinalBoss.as:88-98`), and the same span is on every arm — which makes
 * the arms PREFIXES of one another and the counts monotone, the property
 * that turns several runs into a per-span table rather than several
 * unrelated numbers.
 *
 * ⛔⛔ AND THE RELEASE LANDS ON THE SPAN'S `from`, NOT ON ITS `to`. A
 * length-1 span is documented as a press edge on `from` and a release edge
 * on `to`; the boss's own position says the walk arm ran on `from`. Measured
 * twice, at `from = 2` and at `from = 10`, by reading `botMobiles`: his
 * displacement is an exact multiple of 0.5303300858899106 px (moveSpeed 1,
 * friction 0.25, a 45 degree walk) and the multiple is one MORE than a
 * release on `to` permits. Position carries no poll drift, so this is a
 * fact about the edge and not about the instrument.
 */
const INTRO_PRESS = { key: 'primary', from: 2, to: 3 };
/** What the model must be told, derived from the measurement above. */
const INTRO_ENDS_AT = INTRO_PRESS.from;
/** How many times each arm is run; the MINIMUM is the count. */
const REPEATS = 2;

/**
 * ⛓ THE LENGTHS ARE CHOSEN AGAINST THE PHASES, not spaced evenly.
 *
 * The boss walks ~68 ticks from (72,104) to `pod0` (120,56) at
 * `moveSpeed = 1`, then barrages for 240. So:
 */
const RUNS = [
    { ticks: 2, why: 'the intro ALONE — the boss returns above every draw site he '
        + 'owns, so this arm is the LEVEL BUILD and nothing else. The negative '
        + 'control, and the row that measures `OWL_LEVEL_BUILD_DRAWS`.' },
    { ticks: 12, why: 'ten walk ticks: one grenade roll each, and a grenade is '
        + 'possible (1/40) — the first arm that can show `Enemy.coins`' },
    { ticks: 45, why: 'mid-walk, ~43 grenade rolls' },
    { ticks: 60, why: 'still mid-walk, and the arm the first reading of this probe '
        + 'was mis-diagnosed on' },
    { ticks: 90, why: 'the walk\'s last ticks before the pod arrival' },
    { ticks: 120, why: 'past the arrival: the `rockfallTime == 0` tick draws '
        + 'nothing, the barrage begins, rocks land, and `Game.shake` lifts the '
        + 'jiggle — the only arm that exercises `barrageSpawn` and the feedback '
        + 'loop. ⚠ SLOW: the headless renderer runs a barrage at well under '
        + 'realtime.' },
];

const SEEDS = [
    { seed: 1234567, why: 'an arbitrary declared seed — the window\'s own' },
    { seed: 101, why: 'a seed whose first sixty ticks fire NO grenade at all, so an '
        + 'arm of it isolates the walk roll from `Enemy.coins`' },
];

/**
 * How many draws from `seed` reach `state`?
 *
 * ⛓ The orbit is a single cycle of length < 2^31 and `step` is a bijection on
 * it, so the walk terminates at the true count and there is no second answer
 * below the bound. The bound is generous against the longest run here
 * (330 ticks x at most 12 draws) and is REPORTED when it is hit rather than
 * returning a wrong small number.
 */
function drawsToReach(seed, state, bound = 200000) {
    if (state === seed) return 0;
    let u = seed >>> 0;
    for (let k = 1; k <= bound; k += 1) {
        u = step(u);
        if (u === state) return k;
    }
    return null;
}

const browser = await chromium.launch({
    args: [
        '--enable-unsafe-webgpu', '--enable-features=Vulkan',
        '--use-angle=swiftshader', '--use-vulkan=swiftshader',
        '--enable-features=WebAssemblyExperimentalJSPI',
    ],
});

const rows = [];

/** One run of one arm: returns the draw count the live readout implies. */
async function runArm(seed, ticks) {
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
            name: `owl-rng-probe-${seed}-${ticks}`,
            description: 'R6 slice 6e: the Owl room\'s draw schedule, counted from '
                + '`botStatus.rng.state`.',
            boot: BOOT,
            noclip: false,
            noDamage: true,
            noHazards: [],
            grants: [],
            persistence: [],
            equips: [],
            pins: ['sound', 'dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed, split: true },
            tick_count: ticks,
            inputs: ticks > INTRO_PRESS.from ? [INTRO_PRESS] : [],
        };
        const loaded = await bot('botLoadTape', JSON.stringify(tape));
        if (loaded !== 'ok') throw new Error(`botLoadTape: ${loaded}`);
        if (await bot('botStart') !== 'ok') throw new Error('botStart refused');

        let st = null;
        // ⚠ A TIGHT POLL, because the drift this is fighting is measured in
        // FRAMES between the finish and the read. 60 ms is under two frames
        // at the engine's own rate and is what keeps the spread at 0..1.
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
        if (st.rng.hooks !== true) {
            throw new Error('this build has no runtime RNG hooks — a seeded tape '
                + 'should have been refused at load');
        }
        if (st.rng.seed !== seed || st.rng.split !== true) {
            throw new Error('the declared block did not land: got seed '
                + `${st.rng.seed} split ${st.rng.split}`);
        }
        if (st.rng.state < 1 || st.rng.state > STATE_MAX) {
            throw new Error(`state ${st.rng.state} is outside the orbit`);
        }
        const draws = drawsToReach(seed, st.rng.state);
        if (draws === null) {
            throw new Error(`the reported state ${st.rng.state} is not within the `
                + 'search bound of the declared seed — either the seed did not land '
                + 'or something reseeded mid-run');
        }
        // ⛓ The boss's own position, which carries NO poll drift: he is
        // frozen on the intro frames and then walks a 0.5303 px lattice, so
        // his displacement counts his moving ticks exactly. This is the field
        // that settled the release-edge question, and it is recorded so the
        // next reading does not have to re-measure it.
        const mob = JSON.parse(await bot('botMobiles'));
        const boss = (mob.mobiles ?? []).find((m) => String(m.cls).includes('FinalBoss'));
        return {
            draws,
            state: st.rng.state,
            cosmetic_state: st.rng.cosmetic_state,
            dead_frames: st.dead_frames,
            saw_auto_advance: st.saw_auto_advance,
            level: st.level,
            x: st.x,
            y: st.y,
            menu: st.menu,
            persistence_cleared: st.persistence_cleared ?? [],
            boss: boss ? { x: boss.x, y: boss.y, vx: boss.vx, vy: boss.vy,
                anim: boss.anim, hits: boss.enemy?.hits ?? null } : null,
            pods: mob.pods ?? [],
        };
    } finally {
        await page.close();
    }
}

try {
    for (const { seed, why: seedWhy } of SEEDS) {
        for (const { ticks, why } of RUNS) {
            const runs = [];
            for (let i = 0; i < REPEATS; i += 1) runs.push(await runArm(seed, ticks));
            const counts = runs.map((r) => r.draws);
            const draws = Math.min(...counts);
            const best = runs[counts.indexOf(draws)];
            rows.push({
                seed, seedWhy, ticks, why,
                /** The MINIMUM over `REPEATS` runs — the drift is never negative. */
                draws,
                /** Every run's count, so the spread is visible rather than asserted. */
                drawsRuns: counts,
                pollDriftObserved: Math.max(...counts) - draws,
                state: best.state,
                cosmetic_state: best.cosmetic_state,
                dead_frames: best.dead_frames,
                saw_auto_advance: best.saw_auto_advance,
                level: best.level,
                x: best.x,
                y: best.y,
                menu: best.menu,
                persistence_cleared: best.persistence_cleared,
                boss: best.boss,
                pods: best.pods,
            });
            console.log(`seed ${seed} / ${String(ticks).padStart(4)} ticks: `
                + `${String(draws).padStart(5)} draws  runs [${counts.join(', ')}]  `
                + `dead ${best.dead_frames}  boss `
                + `(${best.boss ? best.boss.x.toFixed(3) : '?'}, `
                + `${best.boss ? best.boss.y.toFixed(3) : '?'})`);
        }
    }

    // ⛔ THE PREFIX PROPERTY, ASSERTED HERE RATHER THAN ASSUMED DOWNSTREAM.
    // Every arm is the same tape cut shorter, so the counts must be
    // non-decreasing in `ticks` at a fixed seed. A run that broke it would
    // mean the arms are not prefixes — a world swap, a death, or a reseed —
    // and the per-span table the model is checked against would be fiction.
    for (const { seed } of SEEDS) {
        const mine = rows.filter((r) => r.seed === seed)
            .sort((a, b) => a.ticks - b.ticks);
        for (let i = 1; i < mine.length; i += 1) {
            if (mine[i].draws < mine[i - 1].draws) {
                throw new Error(`seed ${seed}: ${mine[i].ticks} ticks drew `
                    + `${mine[i].draws} but ${mine[i - 1].ticks} ticks drew `
                    + `${mine[i - 1].draws} — the arms are not prefixes`);
            }
        }
    }

    const out = {
        note: 'R6 slice 6e. The Owl room\'s DRAW COUNT per tape length, recovered '
            + 'from `botStatus.rng.state` by stepping the modelled LFSR from the '
            + 'declared seed. Written by scripts/procgen/probe-seedling-r6-owl-rng.mjs; '
            + 'read by finalBossRng.test.js. A count, not an order — see the script.',
        boot: BOOT,
        introPress: INTRO_PRESS,
        /** MEASURED, not derived from the span convention. See `INTRO_PRESS`. */
        introEndsAt: INTRO_ENDS_AT,
        /** What `createOwlRoom` must consume before tick 0. */
        levelBuildDraws: 2,
        repeats: REPEATS,
        noDamage: true,
        split: true,
        rows,
    };
    writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`\nwrote ${OUT} (${rows.length} rows)`);
} finally {
    await browser.close();
}
