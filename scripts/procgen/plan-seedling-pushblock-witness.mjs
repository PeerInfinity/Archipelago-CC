#!/usr/bin/env node
/**
 * plan-seedling-pushblock-witness — ⛓⛓⛓ SEEDLING FIDELITY PUSHBLOCK: A
 * `PushableBlockSpear` ON THE FRONTIER OF A REACH-EXIT, MOVED BY THE SOLVER'S
 * `shove` VERB'S THRUST ARM.
 *
 * The route survey refused steps 137/145/146/148/149/180 on
 * `solid:pushableblockspear` with *"No strategy row exists for this obstacle"*.
 * The row now resolves it (`solverBot.resolveSpearPushStrategy`: a spear thrust
 * per tile, from a stance whose 32x5 rect is on the block, the spear's slot
 * selected for it). These tapes are the solver's own plans for the two steps it
 * SOLVES, staged exactly as the survey stages them, so the GAME can be recorded
 * against them (`check-seedling-bot-differential --record --only=…`):
 *
 *   pushblock-l65-reach-l68   route step 146's room (booted in the block's pocket,
 *                             not at the L63 arrival — see below; → L68): R4's
 *                             three pushes, re-derived — W, N from two cells
 *                             below ACROSS the pit, W onto the pit (the block
 *                             sinks); the third thrust also sweeps
 *                             `lightpole@176,120`, as R4's did.
 *   pushblock-l65-reach-l63   route step 148 (L68 arrival (185,80) → L63): one
 *                             thrust E opens the corridor to `teleporter@128,0`.
 *
 *   pushblock-l65-sword-press D1's control, AUTHORED (not solved): R4's L65 probe
 *                             stance, a SWORD slash facing W at the block, then a
 *                             walk W into it — the block does NOT move (game Δx
 *                             0.00; `probe-seedling-pushblock-weapon.mjs`). Pins
 *                             `pushables.PUSH_SPEAR_DIRECTION` in the pairs suite.
 *
 * ⛔ ONE DEPARTURE FROM THE SURVEY'S STAGING, AND IT IS THE POINT OF A WITNESS:
 * `darktrap@144,144`'s clear (65:1) is DECLARED. Unstaged, the solver's walk
 * meets it first and the DarkTrap LIGHT arm kills it — and the GAME refuted that
 * kill (first recording: "darktrap@144,144 (65:1) still SET — the model removed
 * a body the game did not", 2 hits, t54 dy 1.88; the step-148 walk left the game
 * at t137 just after its light thrust, 0 px through its push at t32-72). That is
 * the light arm's finding (handed over), not the push's; a witness of the push
 * stages the body cleared so the recording is about the block.
 *
 * THE STAGING (the survey's, written out): `r8-solve-11`'s committed block
 * (`solveStaging`), re-pointed at the step's atlas arrival, with the save keys
 * and seam items the route holds by then (the survey row's `saveGrant`), its
 * timed clears stripped. `--check` re-derives both and compares them to the
 * committed tapes byte for byte, and asserts the model's replay crosses where
 * the plan says.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-pushblock-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-pushblock-witness.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** The staged base every witness boots from (the survey's `staged` boot). */
export const PUSHBLOCK_BASE = 'r8-solve-11';

/** The two witnesses: the survey step, its boot, its grant, its goal, the plan's crossing. */
export const PUSHBLOCK_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'pushblock-l65-reach-l68',
        step: 146,
        // ⚠ NOT the survey's L63 arrival (128,16): from there the walk meets `darktrap@144,144`
        // (refuted light arm, see the docblock) and, staged cleared, `bob@208,80`'s bait stalls.
        // The witness boots in the block's own pocket, one tile east of it (the player's centre
        // at (200,136), R4's first stance), so the recording is the three thrusts and the exit.
        boot: { level: 65, x: 192, y: 128 },
        keys: [0, 1, 2, 3, 4],
        items: ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
        goal: { kind: 'reach-exit', exit: { x: 184, y: 64 } },
        clears: [{ level: 65, tag: 1 }],
        block: 'pushableblockspear@176,128',
        thrusts: 3,
        to: 68,
        what: 'route step 146 (L65 → L68): `pushableblockspear@176,128` is the door. The solver thrusts '
            + 'it W, then N from two cells below across the pit, then W onto the pit where it sinks — R4\'s '
            + 'three pushes, re-derived — selecting the spear\'s slot for each thrust and the sword\'s after, '
            + 'and walks onto `teleporter@184,64`',
    }),
    Object.freeze({
        name: 'pushblock-l65-reach-l63',
        step: 148,
        boot: { level: 65, x: 185, y: 80 },
        keys: [0, 1, 2, 3, 4],
        items: ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
        goal: { kind: 'reach-exit', exit: { x: 128, y: 0 } },
        clears: [{ level: 65, tag: 1 }],
        block: 'pushableblockspear@176,128',
        thrusts: 1,
        to: 63,
        what: 'route step 148 (L65 → L63): from the L68 arrival, one spear thrust E moves '
            + '`pushableblockspear@176,128` to (12,8) and the walk goes up the west column to `teleporter@128,0`',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function pushblockStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${PUSHBLOCK_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = [...(staging.persistence ?? []).filter((r) => r.at === undefined),
        ...(w.clears ?? []).map((c) => ({ ...c }))];
    return staging;
}

/** The solver's plan for one witness, from that staging. */
export async function pushblockPlan(w) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = await pushblockStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [w.goal], name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of PUSHBLOCK_WITNESSES) {
        const { staging, solved } = await pushblockPlan(w);
        const shoves = solved.out.records.filter((r) => r.strategy === 'shove');
        const thrusts = shoves.flatMap((r) => (r.steps ?? [r]).filter((s) => s.verb === 'press'));
        check(`${w.name}: the plan thrusts at ${w.block} ${w.thrusts} time(s)`,
            shoves.length === 1 && shoves[0].target === w.block && thrusts.length === w.thrusts,
            JSON.stringify(shoves.map((r) => [r.target, r.verb, (r.steps ?? [r]).map((s) => s.to)])));
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY PUSHBLOCK — ${w.what}. The survey's staging `
            + `(\`${PUSHBLOCK_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]), with darktrap@144,144's clear `
            + `${JSON.stringify(w.clears)} declared so the walk meets no DarkTrap. The solver's own plan: `
            + `${solved.out.perTick.length} t, ${thrusts.length} thrust(s), equips `
            + `${JSON.stringify(solved.out.equips)}. Authored by `
            + 'scripts/procgen/plan-seedling-pushblock-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const path = join(TAPES, `${w.name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    // ── D1's control: the sword press, authored ─────────────────────────
    {
        const name = 'pushblock-l65-sword-press';
        const authored = {
            tape_version: 4,
            game: 'seedling',
            name,
            description: '⛓⛓⛓ SEEDLING FIDELITY PUSHBLOCK D1 — R4\'s L65 probe stance one cell east of '
                + '`pushableblockspear@176,128`: walk W into its face, ONE sword slash facing W, walk W again. '
                + 'The block does NOT move — `genericHit`\'s Spear arm reads `spearDirection`, which a sword '
                + 'slash leaves at -1 (game-measured, `probe-seedling-pushblock-weapon.mjs`). Authored by '
                + 'scripts/procgen/plan-seedling-pushblock-witness.mjs.',
            boot: { level: 65, x: 192, y: 128 },
            noclip: false,
            noDamage: true,
            noHazards: ['water', 'lava', 'ice', 'waterfall'],
            grants: [{ level: 65, items: ['sword', 'spear'] }],
            persistence: [],
            equips: [{ t: 0, slot: 0 }],
            tick_count: 80,
            inputs: [
                { key: 'left', from: 5, to: 25 },
                { key: 'primary', from: 30, to: 31 },
                { key: 'left', from: 40, to: 75 },
            ],
        };
        const tape = parseTape(authored);
        const out = runTape(tape, { levelSource });
        const xAt = (t) => out.ticks.find((o) => o.t === t)?.x;
        check(`${name}: the model's sword slash leaves the block where it is`,
            Math.abs(xAt(28) - xAt(78)) < 1, `stop x ${xAt(28)} before, ${xAt(78)} after`);
        const json = `${JSON.stringify(authored, null, 4)}\n`;
        const path = join(TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
