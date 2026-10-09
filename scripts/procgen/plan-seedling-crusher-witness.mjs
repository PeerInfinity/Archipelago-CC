#!/usr/bin/env node
/**
 * plan-seedling-crusher-witness — ⛓⛓⛓ SEEDLING FIDELITY CRUSHER: L42's TOTEM PART,
 * AND THE WAY BACK, BY THE SOLVER'S `bait` VERB.
 *
 * The route survey's step 85 (`--through=end`, L42 from `teleporter@848,0`)
 * refused with *"Obstacle: solid:crusher (crusher@96,144). Strategy 'bait' is
 * SELECTED but not registered this slice"*. With `CRUSHER_BAIT` on, the solver
 * resolves it (`solverBot.resolveBaitStrategy` / `execBait`): the ordering is
 * SEARCHED from the live arrival (`crusherBait.searchBaitOrdering`, R5 slice 17's
 * proposer with the round trip priced) and comes back as R5's own nine charges
 * in three chains; each chain is R5's beam-searched choreography
 * (`BAIT_CHOREOGRAPHIES`), started from an aligned rest state the FORK says
 * survives, and driven by `botDriverV2.runBait`. Then the collect, and the walk
 * back out through `teleporter@240,336` into L40 — the round trip.
 *
 *   crusher-l42-round-trip   step 85's staging, goals [collect totempart@184,152,
 *                            reach-exit teleporter@240,336]
 *
 * THE STAGING (the survey's, written out — `plan-seedling-burn-witness`'s
 * shape): `r8-solve-11`'s committed block (`solveStaging`) re-pointed at the
 * atlas arrival (240,320), with the save keys and seam items the route holds by
 * step 85 (`stagedGrantFor`), its timed clears stripped. `--check` re-derives
 * the tape with the flag ON and compares it to the committed one byte for byte,
 * asserts the model's replay collects with zero crusher contacts and crosses
 * into L40, and asserts that with the flag OFF the same staging still REFUSES
 * by naming `bait` (the flag's byte-inertia, from the solver's side).
 *
 * Run:
 *   node scripts/procgen/plan-seedling-crusher-witness.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-crusher-witness.mjs --check    # exit 1 on drift
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
export const CRUSHER_BASE = 'r8-solve-11';

export const CRUSHER_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'crusher-l42-round-trip',
        step: 85,
        boot: { level: 42, x: 240, y: 320 },
        keys: [0, 1, 2],
        items: ['canSwim', 'hasFire', 'hasShield', 'hasTorch'],
        goals: [
            { kind: 'collect-placement', placement: { x: 184, y: 152 } },
            { kind: 'reach-exit', exit: { x: 240, y: 336 } },
        ],
        to: 40,
        parks: { 'crusher@96,144': { x: 208, y: 96 }, 'crusher@128,144': { x: 240, y: 96 } },
        what: 'route step 85 (L42 from `teleporter@848,0`), and back: the solver\'s `bait` searches '
            + 'the ordering from the arrival (nine charges, three chains: A W/S/E, B W/N/E, A W/N/E), '
            + 'drives each chain from an aligned rest state its fork certified, parks both crushers '
            + 'in the top room, collects `totempart@184,152` and leaves by `teleporter@240,336`',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function crusherStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${CRUSHER_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The solver's plan for one witness, from that staging, with `CRUSHER_BAIT` as given. */
export async function crusherPlan(w, enabled = true) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withCrusherBait } = await import(join(MODULE, 'crusherBait.js'));
    const staging = await crusherStaging(w);
    const levelSource = atlasLevelSource();
    const solved = await withCrusherBait(enabled, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals.map((g) => JSON.parse(JSON.stringify(g))), name: w.name, boot: staging.boot,
        dashMode: 'all', persistence: staging.persistence, log: () => {},
    }));
    return { staging, solved };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape, serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of CRUSHER_WITNESSES) {
        // ⛔ the flag OFF first: the same staging refuses, naming the verb.
        let offRefusal = null;
        try {
            await crusherPlan(w, false);
        } catch (e) {
            offRefusal = e.message;
        }
        check(`${w.name}: with CRUSHER_BAIT OFF the staging REFUSES on the unregistered \`bait\``,
            /Strategy 'bait' is SELECTED but not registered/.test(offRefusal ?? ''),
            (offRefusal ?? 'it solved').slice(0, 160));
        const { staging, solved } = await crusherPlan(w, true);
        const baits = solved.out.records.filter((r) => r.strategy === 'bait');
        check(`${w.name}: the plan baits once, three chains, both crushers to the top room`,
            baits.length === 1 && baits[0].chains.length === 3
                && baits[0].chains.map((c) => c.charges).join(' ') === 'WSE WNE WNE',
            JSON.stringify(baits.map((r) => r.chains.map((c) => [c.id, c.charges, c.alignTicks, c.tried]))));
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY CRUSHER — ${w.what}. The survey's staging `
            + `(\`${CRUSHER_BASE}\`'s committed block re-pointed at the atlas arrival, keys `
            + `[${w.keys.join(', ')}], items [${w.items.join(', ')}]). The solver's own plan with `
            + `\`CRUSHER_BAIT\` on: ${solved.out.perTick.length} t; the bait spans `
            + `t${baits[0]?.from}..t${(baits[0]?.from ?? 0) + (baits[0]?.ticks ?? 0)} (chains `
            + `${(baits[0]?.chains ?? []).map((c) => `${c.charges} align ${c.alignTicks} t, fork try ${c.tried}`).join('; ')}). `
            + 'Authored by scripts/procgen/plan-seedling-crusher-witness.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const tape = parseTape(JSON.parse(json));
        // The replay, one loop: contacts per tick, the parks at the last L42 tick.
        const stepper = createTapeStepper(tape, { levelSource });
        let r = stepper.next();
        let lastInRoom = null;
        let contacts = 0;
        let last = null;
        while (!r.done) {
            const { observation, crushers } = r.value;
            if (observation.level === 42 && crushers) {
                lastInRoom = new Map([...crushers].map(([id, c]) => [id, { x: c.x, y: c.y }]));
            }
            last = observation;
            r = stepper.next();
        }
        const out = r.value;
        contacts = out.crusherContacts?.length ?? 0;
        check(`${w.name}: the model replays it — the part collected, zero crusher contacts`,
            out.collected.length === 1 && contacts === 0,
            `${out.collected.length} collect(s), ${contacts} contact(s)`);
        check(`${w.name}: both crushers on their top-room parks at the last L42 tick`,
            lastInRoom && Object.entries(w.parks).every(([id, p]) => lastInRoom.get(id)?.x === p.x
                && lastInRoom.get(id)?.y === p.y),
            JSON.stringify(lastInRoom ? [...lastInRoom] : null));
        check(`${w.name}: …and the replay crosses into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        // ⛓ the tape is what the tape format serialises (`serializeTape` round trip).
        check(`${w.name}: the tape round-trips through the tape format`,
            Boolean(serializeTape(tape)));
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
