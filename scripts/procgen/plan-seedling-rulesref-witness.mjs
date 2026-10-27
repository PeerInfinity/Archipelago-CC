#!/usr/bin/env node
/**
 * plan-seedling-rulesref-witness — ⛓⛓⛓ SEEDLING FIDELITY RULESREF: L66's HALF-TILE DOORWAY, BEHIND A SPEAR BRIDGE.
 *
 * The route survey's step 163 (L66 from the L65 arrival, to `teleporter@72,64` → L70) and divergence leg 579 refused on
 * BOTH arms: *"A* goal tile (5,4) … is not walkable: pixelmask building8"* — the door's notch in `building8`'s mask is
 * x 72-87, half a tile off the 16 px grid, and `bosslock@72,64` stands in it; and before the doorway, the spear bridge
 * (7,9) sits between the arrival and the rest of the room. Two switches, both OFF by default, answer it:
 *
 *   · `spearBridgeVerb` — a closed `Bridge` tile on the frontier is `solid:bridge`, opened by one spear thrust from a
 *     stance one or two tiles behind it (`solverBot.resolveBridgeStrategy` / `execBridge`, `runSpear`'s bridge arm);
 *   · `fineFrontierFlood` — a frontier with no actionable entry is flooded again on the 8 px lattice, which names the
 *     lock (`keylock`), and the lock's key-line stance is asked on the 8 px lattice too.
 *
 * The tape is the solver's own plan with both ON (`withContactFidelity`), staged exactly as the survey stages the step
 * (the survey's boot view: `r8-solve-11`'s committed block re-pointed at the arrival, the route's save keys and seam
 * items granted), so the GAME can be recorded against it (`check-seedling-bot-differential --record --only=…`).
 *
 *   rulesref-l66-door   L66 from (128,144): a W thrust at the bridge from the arrival, the walk up the doorway's
 *                       8 px column, the key line, the lock's fade, and `teleporter@72,64` → L70.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-rulesref-witness.mjs --from-view=<survey step-163 boot view>   # write the tape
 *   node scripts/procgen/plan-seedling-rulesref-witness.mjs --check     # re-derive from the committed tape; exit 1 on drift
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
export const RULESREF_FIDELITY = Object.freeze({ spearBridgeVerb: true, fineFrontierFlood: true });

/** The witness: boot, goal, where it ends, and what it must show. */
export const RULESREF_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'rulesref-l66-door',
        boot: { level: 66, x: 128, y: 144 },
        goal: { kind: 'reach-exit', exit: { x: 72, y: 64 } },
        to: 70,
        bridge: '7,9',
        lock: 'bosslock@72,64',
        // The survey's staging selects nothing at boot; every equip on the tape is the plan's (dropped on --check).
        baseEquips: Object.freeze([]),
        what: 'L66 from the L65 arrival: the spear bridge (7,9) opened by one thrust, the walk up `building8`\'s '
            + 'x 72-87 doorway notch on the 8 px lattice, `bosslock@72,64`\'s key line, and `teleporter@72,64` → L70',
    }),
]);

/** The witness's plan from a staging (`solveSegment`, both switches ON). */
export async function rulesrefPlan(w, staging) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    return withContactFidelity(RULESREF_FIDELITY, () => {
        const run = createRunForStaging(staging, atlasLevelSource());
        return solveSegment({ run, goals: [w.goal], name: w.name, boot: staging.boot, dashMode: 'all' });
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
        console.error('plan-seedling-rulesref-witness: --from-view=<survey boot view> (write) or --check');
        process.exit(2);
    }
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of RULESREF_WITNESSES) {
        const path = join(TAPES, `${w.name}.json`);
        // ⛓ The staging: the survey's boot view on a write; the committed tape's own header on a check (its inputs are
        // the plan's, not the staging's, and are dropped).
        const source = CHECK ? readFileSync(path, 'utf8') : readFileSync(FROM, 'utf8');
        const parsed = parseTape(JSON.parse(source));
        const staging = solveStaging(stagingFromTape({ ...parsed, inputs: [], tick_count: 0 }));
        check(`${w.name}: the staging boots at L${w.boot.level} (${w.boot.x},${w.boot.y})`,
            staging.boot.level === w.boot.level && staging.boot.x === w.boot.x && staging.boot.y === w.boot.y,
            JSON.stringify(staging.boot));
        staging.equips = [...w.baseEquips];
        const out = await rulesrefPlan(w, staging);
        const built = buildStagedTape({
            staging: { ...staging, equips: [...(staging.equips ?? []), ...(out.equips ?? [])] },
            perTick: out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY RULESREF — ${w.what}. The survey's staging (step 163's boot view). `
            + `The solver's own plan with ${Object.keys(RULESREF_FIDELITY).join(' + ')} ON: ${out.perTick.length} t, `
            + `equips ${JSON.stringify(out.equips)}. Authored by scripts/procgen/plan-seedling-rulesref-witness.mjs.`;
        const tape = parseTape({ ...built, description });
        const ran = runTape(tape, { levelSource });
        const last = ran.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${ran.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        // The mechanism, read off a replay run: the bridge opened, the lock opened, no hit.
        const run = createRunForStaging({ ...staging, equips: tape.equips ?? staging.equips }, levelSource);
        let bridgeAt = null;
        let lockAt = null;
        for (let t = 0; t < out.perTick.length; t += 1) {
            run.advance(out.perTick[t]);
            if (run.level !== w.boot.level) break;
            if (bridgeAt === null && run.entities('openBridges')?.has(w.bridge)) bridgeAt = run.ticksCompleted;
            if (lockAt === null && run.entities('openActivators')?.has(w.lock)) lockAt = run.ticksCompleted;
        }
        check(`${w.name}: bridge (${w.bridge}) opens, then ${w.lock}, in that order`,
            bridgeAt !== null && lockAt !== null && bridgeAt < lockAt, `bridge t${bridgeAt}, lock t${lockAt}`);
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
