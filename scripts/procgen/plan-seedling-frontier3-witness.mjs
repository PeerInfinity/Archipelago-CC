#!/usr/bin/env node
/**
 * plan-seedling-frontier3-witness — ⛓⛓⛓ SEEDLING FIDELITY FRONTIER3: THE
 * PLANNER ROUTES THROUGH WHAT THE PIXEL MASK LETS THROUGH.
 *
 * The divergence sweep and the route survey refused legs on "obstacles" with
 * no strategy row — `pixelmask:building6`, `solid:planttorch`,
 * `pixelmask:cliffside1` — where the game lets the player through (the J2
 * walker crossed L62 → L64 in 12 t). The geometry was right; the planner asked
 * it at the wrong POINTS:
 *
 *  · a reach-exit walked at its trigger's centre, and L62's
 *    `teleporter@112,64` sits in `building6`'s doorway with its centre in the
 *    wall (`solverBot.exitAimFor`);
 *  · the A\* lattice is the 16 px tile grid, and a corridor whose only clear
 *    column is off the tile centres (L87's 5 px column beside
 *    `cliffside1@48,32`, L62's pit maze around `planttorch@120,152`) has no
 *    node. After a frontier refusal the walk is asked once more on the 8 px
 *    lattice (`solverBot.FINE_LATTICE`).
 *
 * These tapes are the solver's own plans for those legs, staged as the route
 * survey stages a room (`r8-solve-11`'s committed block re-pointed at the
 * arrival), so the GAME can be recorded against them
 * (`check-seedling-bot-differential --record --only=…`). Each plan is
 * required to show the mechanism it witnesses: the door walk ends inside the
 * mask's niche, and the fine-lattice walk stands at x positions no 16 px node
 * centre reaches.
 *
 *   frontier3-l62-door-niche   L62 from the L64 arrival (entity (120,88), the
 *                              niche below `building6`'s door) to
 *                              `teleporter@112,64`: the aim is (120,74), the
 *                              nearest clear point overlapping the trigger.
 *   frontier3-l87-pocket       L87 from the L92 arrival (the top-left pocket)
 *                              to `teleporter@0,144` (L89): out of the pocket
 *                              up the 5 px column at x 50–54 beside
 *                              `cliffside1@48,32`, on the 8 px lattice (the
 *                              `fineLattice` grant; off roster-wide on `main`).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-frontier3-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-frontier3-witness.mjs --check    # exit 1 on drift
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
export const FRONTIER3_BASE = 'r8-solve-11';

/** The witnesses: boot, goal, the crossing, and the mechanism each must show. */
export const FRONTIER3_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'frontier3-l62-door-niche',
        boot: { level: 62, x: 112, y: 80 },
        goal: { kind: 'reach-exit', exit: { x: 112, y: 64 } },
        to: 64,
        check: 'niche',
        what: 'L62 from the L64 arrival: the walk leaves the niche below `building6`\'s door and '
            + 'enters `teleporter@112,64`, whose centre (120,72) is inside the mask — the aim is '
            + '(120,74), the nearest clear point whose box overlaps the trigger (`exitAimFor`)',
    }),
    Object.freeze({
        name: 'frontier3-l87-pocket',
        boot: { level: 87, x: 16, y: 48 },
        goal: { kind: 'reach-exit', exit: { x: 0, y: 144 } },
        to: 89,
        check: 'fine',
        fineLattice: true,
        what: 'L87 from the L92 arrival: out of the top-left pocket up the 5 px column at x 50–54 '
            + 'beside `cliffside1@48,32` (no 16 px node centre is clear there), planned on the 8 px '
            + 'lattice after the frontier refused, and out by `teleporter@0,144`',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function frontier3Staging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${FRONTIER3_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/**
 * The solver's plan for one witness, from that staging. `solveSegment` is
 * called directly (neither leg declares a clear, so `twoPassSolve`'s second
 * pass has nothing to measure) because the fine-lattice grant is a
 * `solveSegment` option (`fineLattice`; `FINE_LATTICE_ROSTER_WIDE` is off on
 * `main`), which only the L87 witness is given.
 */
export async function frontier3Plan(w) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const staging = await frontier3Staging(w);
    const levelSource = atlasLevelSource();
    const run = createRunForStaging(staging, levelSource);
    const out = solveSegment({ run, goals: [w.goal], name: w.name, boot: staging.boot, dashMode: 'all',
        ...(w.fineLattice ? { fineLattice: true } : {}) });
    return { staging, solved: { persistence: staging.persistence, out } };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const { rectsOverlap, maskHitsBox, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of FRONTIER3_WITNESSES) {
        const { staging, solved } = await frontier3Plan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY FRONTIER3 — ${w.what}. The survey's staging `
            + `(\`${FRONTIER3_BASE}\`'s committed block re-pointed at the atlas arrival). `
            + `The solver's own plan: ${solved.out.perTick.length} t, equips `
            + `${JSON.stringify(solved.out.equips)}. `
            + 'Authored by scripts/procgen/plan-seedling-frontier3-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const inRoom = out.ticks.filter((o) => o.level === w.boot.level);
        const run = createRunForStaging({ ...staging, persistence: solved.persistence }, levelSource);
        if (w.check === 'niche') {
            // The last in-room observation stands in the doorway: its box overlaps the trigger
            // and the box one pixel up (the trigger's centre row) would be inside the mask.
            const tp = run.world.teleporters.find((t) => t.x === w.goal.exit.x && t.y === w.goal.exit.y);
            const mask = run.world.pixelmasks.find((p) => p.tag === 'building6');
            const centreBox = playerBoxAt(tp.rect.x + TILE_SIZE / 2, tp.rect.y + TILE_SIZE / 2);
            check(`${w.name}: the trigger's centre box is inside ${mask?.tag}'s mask (the old aim)`,
                Boolean(mask) && maskHitsBox(mask.mask, mask.maskX, mask.maskY, centreBox));
            const end = inRoom.at(-1);
            check(`${w.name}: the walk's last L${w.boot.level} observation overlaps the trigger and is clear of the mask`,
                rectsOverlap(playerBoxAt(end.x, end.y), tp.rect)
                    && !maskHitsBox(mask.mask, mask.maskX, mask.maskY, playerBoxAt(end.x, end.y)),
                JSON.stringify({ x: end.x, y: end.y }));
            check(`${w.name}: no fine-lattice walk was needed`, !solved.out.fineLatticeWalks,
                JSON.stringify(solved.out.fineLatticeWalks ?? null));
        } else {
            const fine = solved.out.fineLatticeWalks ?? [];
            check(`${w.name}: the plan was made on the 8 px lattice after a frontier refusal`, fine.length > 0,
                JSON.stringify(fine.map((f) => ({ tick: f.tick, waypoints: f.waypoints, refused: f.refused.slice(0, 90) }))));
            // The column beside the cliffside: every in-room observation with y in [30, 48] has x in [48, 56].
            const col = inRoom.filter((o) => o.y >= 30 && o.y <= 48 && o.x > 40 && o.x < 64);
            check(`${w.name}: the walk climbs the 5 px column (x 50–54) beside cliffside1@48,32`,
                col.length > 0 && col.every((o) => o.x >= 49.5 && o.x <= 54.5),
                `${col.length} observation(s), x ${col.length ? `${Math.min(...col.map((o) => o.x)).toFixed(2)}–${Math.max(...col.map((o) => o.x)).toFixed(2)}` : '-'}`);
        }
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
