#!/usr/bin/env node
/**
 * plan-seedling-l100-witness — ⛓⛓⛓ SEEDLING FIDELITY L100: THE ROCK DOOR'S SWING STANCE IS HALF A TILE OFF THE GRID.
 *
 * L100's `breakablerock@128,144` is the one door through the wall column x 128-143 between the L99 arrival's side and
 * `teleporter@288,96` → L101 (route survey step 219, divergence leg 907). Its near side is the 8 px sliver x 120-127
 * between the `CliffSideMaskL` column at x 112 (opaque x 0-7 of each 16 px cell, y 48-159) and the rock. Every 16 px
 * ring cell on that side is a cell centre x 120 whose 4x5 box meets the mask, so the break stance refused (*"no
 * REACHABLE stance for a swing at breakablerock@128,144 … 2 cell(s) put the slash rect on the rock"* — both on the far
 * side). `fineSwingStance` (OFF by default) asks the same pixel window on the 8 px lattice once every 16 px cell fails.
 *
 * The tape is the solver's own plan with `fineSwingStance` ON, staged as the survey stages step 219 (its boot view:
 * `r8-solve-11`'s committed block, the route's save keys and seam items) but BOOTED INSIDE THE SLIVER at (124,60):
 * the arrival's own approach crosses the waterfall's top past four jellyfish, which is a separate gap (the report's
 * D2), so this witness isolates the stance, the walk down the sliver beside `cliffside@112,96`, the break, the door,
 * and the rest of the leg to L101 — every part the GAME can be recorded against (`check-seedling-bot-differential
 * --record --only=…`).
 *
 *   l100-sliver-rock   L100 from (124,60) in the sliver: down the x 124 column past the CliffSide masks, the sword
 *                      swing at `breakablerock@128,144` from the 8 px stance, the door, and `teleporter@288,96` → L101.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-l100-witness.mjs --from-view=<survey step-219 boot view>   # write the tape
 *   node scripts/procgen/plan-seedling-l100-witness.mjs --check     # re-derive from the committed tape; exit 1 on drift
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

/** The switches the witness is planned under (every other switch at its default). */
export const L100_FIDELITY = Object.freeze({ fineSwingStance: true });

/** The witness: boot (the staged block's top-left; the player stands at +8,+8), goal, where it ends, what it shows. */
export const L100_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'l100-sliver-rock',
        boot: { level: 100, x: 116, y: 52 },
        goal: { kind: 'reach-exit', exit: { x: 288, y: 96 } },
        to: 101,
        rock: 'breakablerock@128,144',
        // The sliver: right of the CliffSide masks' opaque half (x 112-119), left of the wall column (x 128).
        sliver: { left: 120, right: 128, top: 48, bottom: 160 },
        baseEquips: Object.freeze([]),
        what: 'L100 from (124,60) inside the 8 px sliver: the walk down x 124 beside the CliffSideMaskL column, the '
            + 'sword swing at `breakablerock@128,144` from the 8 px stance, the door, and `teleporter@288,96` → L101',
    }),
]);

/** The witness's plan from a staging (`solveSegment`, the switch ON, the survey's dash mode). */
export async function l100Plan(w, staging) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const { DEFAULT_DASH_MODE } = await import('./dashMode.js');
    return withContactFidelity(L100_FIDELITY, () => {
        const run = createRunForStaging(staging, atlasLevelSource());
        return solveSegment({ run, goals: [w.goal], name: w.name, boot: staging.boot, dashMode: DEFAULT_DASH_MODE });
    });
}

async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape, solveStaging, stagingFromTape, createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    const CHECK = process.argv.includes('--check');
    const FROM = process.argv.find((a) => a.startsWith('--from-view='))?.slice('--from-view='.length) ?? null;
    if (!CHECK && !FROM) {
        console.error('plan-seedling-l100-witness: --from-view=<survey step-219 boot view> (write) or --check');
        process.exit(2);
    }
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of L100_WITNESSES) {
        const path = join(TAPES, `${w.name}.json`);
        // ⛓ The staging: the survey's boot view (re-booted in the sliver) on a write; the committed tape's own header on
        // a check (its inputs are the plan's, not the staging's, and are dropped).
        const source = CHECK ? readFileSync(path, 'utf8') : readFileSync(FROM, 'utf8');
        const parsed = parseTape(JSON.parse(source));
        const staging = solveStaging(stagingFromTape({ ...parsed, inputs: [], tick_count: 0 }));
        if (!CHECK) staging.boot = { ...w.boot };
        check(`${w.name}: the staging boots at L${w.boot.level} (${w.boot.x},${w.boot.y})`,
            staging.boot.level === w.boot.level && staging.boot.x === w.boot.x && staging.boot.y === w.boot.y,
            JSON.stringify(staging.boot));
        staging.equips = [...w.baseEquips];
        const out = await l100Plan(w, staging);
        const built = buildStagedTape({
            staging: { ...staging, equips: [...(staging.equips ?? []), ...(out.equips ?? [])] },
            perTick: out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY L100 — ${w.what}. The survey's step-219 staging, booted in the `
            + `sliver. The solver's own plan with ${Object.keys(L100_FIDELITY).join(' + ')} ON: ${out.perTick.length} t, `
            + `equips ${JSON.stringify(out.equips)}. Authored by scripts/procgen/plan-seedling-l100-witness.mjs.`;
        const tape = parseTape({ ...built, description });
        const ran = runTape(tape, { levelSource });
        const last = ran.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${ran.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        // The mechanism, read off a replay run: the rock broken from inside the sliver, no hit.
        const run = createRunForStaging({ ...staging, equips: tape.equips ?? staging.equips }, levelSource);
        let brokeAt = null;
        let brokeFrom = null;
        let inSliver = 0;
        const s = w.sliver;
        for (let t = 0; t < out.perTick.length; t += 1) {
            run.advance(out.perTick[t]);
            if (run.level !== w.boot.level) break;
            const { x, y } = run.state;
            if (x >= s.left && x < s.right && y >= s.top && y < s.bottom) inSliver += 1;
            if (brokeAt === null && run.entities('brokenRocks')?.has(w.rock)) {
                brokeAt = run.ticksCompleted;
                brokeFrom = { x, y };
            }
        }
        check(`${w.name}: ${w.rock} breaks while the player stands in the sliver`,
            brokeAt !== null && brokeFrom.x >= s.left && brokeFrom.x < s.right,
            `broken t${brokeAt} at ${JSON.stringify(brokeFrom)}, ${inSliver} tick(s) in the sliver`);
        check(`${w.name}: no hit`, run.playerHits.length === 0, `${run.playerHits.length} hit(s)`);
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${w.name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run with --from-view');
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
