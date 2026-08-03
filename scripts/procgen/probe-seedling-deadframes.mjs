#!/usr/bin/env node
/**
 * probe-seedling-deadframes — how much does the fade cost VARY, and does it
 * care about wall-clock?
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §2.1 and §3.2.
 *
 * ── WHY R5 NEEDS A NUMBER HERE ────────────────────────────────────────
 *
 * `Game.time` is `Main.time` — a STATIC that survives every world swap —
 * and `time += timeRate` sits at `Game.as:818`, OUTSIDE the `blackCover <= 0`
 * gate that skips `super.update()`. So it counts every engine frame the
 * bot's own tick counter skips: the ~18-20 fade frames after each world
 * load, and every frozen frame of every ceremony. (`timeRate` is 1 except
 * inside `cutscene[0]`, the intro, which the bot's boot never fires — so
 * `Game.time` is an integer frame count for every tape on this ladder.)
 *
 * Three things read it, and all three are hazards R5 has to walk past:
 *
 *   `Spinner`   `hammerAngle = (Game.time % 45) / 45 * 2π` — a rotating
 *               `collideLine` that damages. Three spinners are L39's kill
 *               lock, two more are L18's.
 *   `BeamTower` its beam POSITION is `radius * sin(Game.worldFrame(...))`.
 *               FOUR of them flank the L108 ferry corridor.
 *   `LavaChain` `if (!Game.worldFrame(Main.FPS, loops))` gates its step.
 *
 * If the fade cost varies run to run, the phase of all three is uncertain by
 * the accumulated variance and they need JITTER-BAND envelopes (the sweep
 * over phase ± k). If it does NOT vary, the bands collapse to exact and the
 * beamtower corridor is a timed walk — and §6.6's determinism-pin AS3 batch
 * stays shut for free.
 *
 * ── AND IT DOUBLES AS THE ANIMATION-CLOCK PROBE ───────────────────────
 *
 * §2.1's soft spot is that `FP.fixed == false` and `Spritemap.update` steps
 * by `frameRate * FP.elapsed`, so animation advance is WALL-CLOCK-shaped in
 * the source — and a sword swing's hitbox lifetime rides on it. The same
 * measurement answers that, because `blackCover` decays per RENDER while
 * everything else steps per UPDATE: a fade count that is identical across a
 * ~50x frame-rate difference is evidence that the recompiled runtime steps
 * its clock at a mocked constant, which is the same fact `FP.elapsed`
 * constancy would give. So the probe runs the SAME tape on both browsers.
 *
 * ⚠ It drives the SHIPPED verifier rather than a second replay path. A
 * probe with its own driver would be a second implementation of the thing
 * being measured, which is the verifier-shared-assumption trap one level up.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-deadframes.mjs
 *   node scripts/procgen/probe-seedling-deadframes.mjs --tape=r4-walk-1-sword --runs=5
 *   node scripts/procgen/probe-seedling-deadframes.mjs --slow      # local SwiftShader
 */

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(HERE, 'verify-seedling-bot-differential.mjs');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const SLOW = args.includes('--slow');
const TAPE = opt('tape', 'r4-walk-1-sword');
const RUNS = Number(opt('runs', SLOW ? '2' : '5'));

/** `PASS: <tape>: observation count — N ..., M fade frames skipped, Ss` */
const FADE = /observation count — (\d+) .*?(\d+) fade frames skipped, (\d+)s/;

function oneRun(i) {
    const argv = [VERIFY, `--only=${TAPE}`, ...(SLOW ? [] : ['--win'])];
    let out;
    const started = Date.now();
    try {
        out = execFileSync('node', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
        console.log(`  run ${i}: the verifier FAILED — the numbers below are still read `
            + 'from whatever it printed, but treat them as suspect');
    }
    const m = out.match(FADE);
    if (!m) {
        console.log(out.split('\n').slice(-12).join('\n'));
        throw new Error(`run ${i}: no "fade frames skipped" line — did the replay start?`);
    }
    return {
        observations: Number(m[1]),
        deadFrames: Number(m[2]),
        replaySecs: Number(m[3]),
        wallSecs: Math.round((Date.now() - started) / 1000),
        passed: out.includes('ALL CHECKS PASSED'),
    };
}

console.log(`## dead-frame variance — ${TAPE}, ${RUNS} run(s), `
    + `${SLOW ? 'LOCAL SwiftShader (~0.5 fps)' : 'real-GPU Windows Chrome (--win, ~25 fps)'}\n`);

const rows = [];
for (let i = 1; i <= RUNS; i += 1) {
    const r = oneRun(i);
    rows.push(r);
    console.log(`  run ${i}: ${r.observations} observations, dead_frames=${r.deadFrames}, `
        + `replay ${r.replaySecs}s, wall ${r.wallSecs}s${r.passed ? '' : '  ⚠ NOT ALL CHECKS PASSED'}`);
}

const dead = rows.map((r) => r.deadFrames);
const obs = new Set(rows.map((r) => r.observations));
const k = Math.max(...dead) - Math.min(...dead);
console.log(`\nobservation counts: ${[...obs].join(', ')}`
    + (obs.size === 1 ? '  (identical — the tape ran the same length every time)'
        : '  ⛔ THE TAPE DID NOT RUN THE SAME LENGTH — read no variance number off this'));
console.log(`dead_frames: ${dead.join(', ')}`);
console.log(`\n⇒ k = ${k}`);
if (k === 0) {
    console.log('   The fade cost is CONSTANT on this runtime, so `Game.time` at any tape '
        + 'tick is a fixed offset from `tick + dead_frames` — which `botStatus` already '
        + 'reports. The Spinner / BeamTower / LavaChain jitter bands COLLAPSE TO EXACT, '
        + 'and §6.6\'s determinism-pin batch is not needed for them.');
} else {
    console.log(`   The fade cost VARIES by ${k} frame(s) over this tape's world loads, so `
        + 'every `Game.time`-coupled hazard is phase-uncertain by that much and needs the '
        + 'jitter-band envelope — or the §6.6 pin (decay `blackCover` per UPDATE under a '
        + 'Bot flag, which changes no live tick\'s physics).');
}
console.log('\n⚠ This is a claim about THIS tape\'s world-load count. Run it on a longer '
    + 'tape before believing it of a 30k-tick walk, and run --slow to answer the separate '
    + 'question of whether the runtime\'s clock is wall-clock-shaped at all.');
