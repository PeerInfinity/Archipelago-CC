#!/usr/bin/env node
/**
 * plan-seedling-burn-witness — ⛓⛓⛓ SEEDLING FIDELITY BURN: A BURNABLE TREE ON
 * THE FRONTIER OF A REACH-EXIT, BURNED BY THE SOLVER'S `burn` VERB.
 *
 * The rules arc's route survey (`survey-seedling-route.mjs --through=end`)
 * refused six steps on `solid:burnabletree` with *"No strategy row exists for
 * this obstacle"*. The solver's `burn` row (`solverBot.resolveBurnStrategy` /
 * `execBurn`) now resolves it. These tapes are the solver's own plans for two of
 * those steps, staged exactly as the survey stages them, so the GAME can be
 * recorded against them (`check-seedling-bot-differential --record --only=…`):
 *
 *   burn-l24-reach-exit   route step 93 (leg 3.1, L24 → L12): the tree stands
 *                         ON both L12 teleporters. The stance is a LEAN against
 *                         the tree's top edge — a tile centre above it is cut by
 *                         `Player.fire()`'s 16 px radius (the transcribed
 *                         `originY`) — then Fire's slot, the press, the 41-tick
 *                         burn, the sword's slot again, and the walk onto the
 *                         uncovered teleporter.
 *   burn-l44-reach-exit   route step 102 (leg 3.2, L44 → L45): the tree is the
 *                         wall between the L37 arrival and the L45 teleporter;
 *                         the stance is a tile centre (no lean).
 *
 * THE STAGING (the survey's, written out): `r8-solve-11`'s committed block
 * (`solveStaging`), re-pointed at the step's atlas arrival, with the save keys
 * and seam items the route holds by then (`stagedGrantFor`), its timed clears
 * stripped. `--check` re-derives both and compares them to the committed tapes
 * byte for byte, and asserts the model's replay crosses where the plan says.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-burn-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-burn-witness.mjs --check    # exit 1 on drift
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
export const BURN_BASE = 'r8-solve-11';

/** The two witnesses: the survey step, its boot, its grant, its goal, the plan's crossing. */
export const BURN_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'burn-l24-reach-exit',
        step: 93,
        boot: { level: 24, x: 96, y: 80 },
        keys: [0, 1],
        items: ['hasTorch', 'hasShield', 'hasFire'],
        goal: { kind: 'reach-exit', exit: { x: 32, y: 144 } },
        tree: 'burnabletree@32,128',
        to: 12,
        what: 'route step 93 (L24 → L12): `burnabletree@32,128` {tag 0} stands on both L12 teleporters. '
            + 'The solver leans against the tree\'s top edge (a tile centre above it is outside '
            + '`Player.fire()`\'s 16 px radius), selects Fire\'s slot, presses, waits out the burn, '
            + 'selects the sword\'s slot again and walks onto `teleporter@32,144`',
    }),
    Object.freeze({
        name: 'burn-l44-reach-exit',
        step: 102,
        boot: { level: 44, x: 128, y: 128 },
        keys: [0, 1, 2],
        items: ['hasTorch', 'hasShield', 'hasFire'],
        goal: { kind: 'reach-exit', exit: { x: 64, y: 0 } },
        tree: 'burnabletree@48,64',
        to: 45,
        what: 'route step 102 (L44 → L45): `burnabletree@48,64` {tag 0} is the wall between the L37 '
            + 'arrival and `teleporter@64,0`. The solver stands at a tile centre beside it, selects '
            + 'Fire\'s slot, presses, waits out the burn, selects the sword\'s slot again and walks out',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function burnStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${BURN_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The solver's plan for one witness, from that staging. */
export async function burnPlan(w) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = await burnStaging(w);
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
    for (const w of BURN_WITNESSES) {
        const { staging, solved } = await burnPlan(w);
        const burns = solved.out.records.filter((r) => r.strategy === 'burn');
        check(`${w.name}: the plan burns ${w.tree} once`, burns.length === 1 && burns[0].target === w.tree,
            JSON.stringify(burns.map((r) => [r.target, r.pressTick])));
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY BURN — ${w.what}. The survey's staging `
            + `(\`${BURN_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]). The solver's own plan: `
            + `${solved.out.perTick.length} t, burn pressed at t${burns[0]?.pressTick}, equips `
            + `${JSON.stringify(solved.out.equips)}. Authored by `
            + 'scripts/procgen/plan-seedling-burn-witness.mjs.';
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
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
