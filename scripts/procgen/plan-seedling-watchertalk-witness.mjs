#!/usr/bin/env node
/**
 * plan-seedling-watchertalk-witness — ⛓⛓⛓ fidelity WATCHERTALK D3: THE WATCHER'S EVENT `{114,0}`, EARNED BY THE
 * SOLVER'S CLEAR-TAG FROM THE DIVERGENCE SWEEP'S TWO L114 ARRIVALS (`CONTACT_FIDELITY.watcherTalkVerb` ON).
 *
 * The sweep's two L114 location legs (`level_114 <- in_L113_16_0 / in_L113_32_0 -> location:L114 flag 0:
 * watcher@72,72 cleared`) land at (64,128) and (80,128) and ask the clear-tag `{114,0}` on `watcher@72,72`. The
 * Watcher is no solid (`Watcher.as:48`), so OFF the clear-tag reports `already-clear` with the flag unwritten; ON it
 * selects `talk`: walk to a stance outside the 24 px circle, step in until `NPC.talk()` opens the dialogue on
 * proximity, page it with a release of X on the ceremony cadence until `doneTalking()` writes `{114,0}` false, settle.
 *
 *   watchertalk-l114-clear-16   from (64,128) (the `in_L113_16_0` arrival)
 *   watchertalk-l114-clear-32   from (80,128) (the `in_L113_32_0` arrival)
 *
 * THE STAGING is `watcher-l114-talk`'s (WATCHER D2's, game-recorded): `r8-solve-11`'s committed block re-pointed at
 * the arrival, timed clears stripped (`plan-seedling-watcher-witness.watcherStaging`). The sweep's own arrival state
 * holds more items, none of which the room reads. `--check` re-derives both and compares them to the committed tapes
 * byte for byte, and asserts the model's replay pages ONE dialogue to DONE and writes `{114,0}`.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-watchertalk-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-watchertalk-witness.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { L114_WATCHER, WATCHER_BASE, talkCircleVisit, watcherStaging } from './plan-seedling-watcher-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** The AP event's clear-tag, as the JS runtime maps it (`jsRuntimeSolver.eventSolverGoal`). */
export const WATCHER_CLEAR = Object.freeze({ kind: 'clear-tag', tag: { level: 114, tag: 0 }, at: { x: 72, y: 72 },
    obstacle: L114_WATCHER.id });

export const WATCHERTALK_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'watchertalk-l114-clear-16',
        legKey: 'level_114 <- in_L113_16_0 -> location:L114 flag 0: watcher@72,72 cleared',
        boot: { level: 114, x: 64, y: 128 },
        keys: [],
        items: [],
    }),
    Object.freeze({
        name: 'watchertalk-l114-clear-32',
        legKey: 'level_114 <- in_L113_32_0 -> location:L114 flag 0: watcher@72,72 cleared',
        boot: { level: 114, x: 80, y: 128 },
        keys: [],
        items: [],
    }),
]);

/** The solver's plan for one witness (`watcherTalkVerb` ON for its own solve). */
export async function watchertalkPlan(w) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const staging = await watcherStaging(w);
    const out = withContactFidelity({ watcherTalkVerb: true }, () => solveSegment({
        run: createRunForStaging(staging, atlasLevelSource()), goals: [WATCHER_CLEAR], name: w.name, boot: staging.boot,
    }));
    return { staging, perTick: out.perTick, equips: out.equips ?? [], records: out.records };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape, createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    check('the switch ships OFF (each plan turns it on for its own solve)', CONTACT_FIDELITY.watcherTalkVerb === false);
    const levelSource = atlasLevelSource();
    for (const w of WATCHERTALK_WITNESSES) {
        const plan = await watchertalkPlan(w);
        const rec = plan.records.filter((r) => r.strategy === 'talk');
        check(`${w.name}: the plan's clear-tag runs ONE \`talk\` on ${L114_WATCHER.id}`, rec.length === 1
            && plan.records.length === 1 && rec[0].arm === 'verb',
        JSON.stringify(plan.records.map((r) => [r.arm, r.strategy, r.stance, r.openedAt, r.closedAt, r.pages])));
        const built = buildStagedTape({
            staging: { ...plan.staging, equips: [...(plan.staging.equips ?? []), ...(plan.equips ?? [])] },
            perTick: plan.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY WATCHERTALK — the divergence sweep's L114 location leg `
            + `(\`${w.legKey}\`): the clear-tag {114,0} on ${L114_WATCHER.id} from the arrival (${w.boot.x},${w.boot.y}). `
            + 'The solver walks to a talk stance outside the 24 px circle, steps in until `NPC.talk()` opens the '
            + 'dialogue on proximity, pages it with a release of X on the ceremony cadence until `doneTalking()` '
            + `writes {114,0} false, and settles. Staged as \`watcher-l114-talk\` (\`${WATCHER_BASE}\`'s committed block `
            + `re-pointed at the arrival). The solver's own plan (\`watcherTalkVerb\` ON): ${plan.perTick.length} t. `
            + 'Authored by scripts/procgen/plan-seedling-watchertalk-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it and stays in L114`, last?.level === 114,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const visit = talkCircleVisit(out.ticks, L114_WATCHER);
        check(`${w.name}: the walk enters ${L114_WATCHER.id}'s talk circle`, visit.inside > 0,
            `closest ${visit.min.toFixed(2)} px, ${visit.inside} observation(s) within 24`);
        const run = createRunForStaging(stagingFromTape(tape), levelSource);
        for (let i = 0; i < tape.tick_count; i += 1) {
            run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
        }
        const talks = run.watcherTalks.filter((r) => r.id === L114_WATCHER.id);
        check(`${w.name}: the run pages ONE dialogue to DONE`, talks.length === 1 && talks[0].cause === 'done'
            && talks[0].page === talks[0].pages, JSON.stringify(talks.map((r) => [r.t, r.cause, r.pages, r.page, r.frames])));
        check(`${w.name}: the run earns {114,0}`, run.watcherFlags.some((f) => f.level === 114 && f.tag === 0)
            && run.ledger('earnedClears').some((c) => c.level === 114 && c.tag === 0), JSON.stringify(run.watcherFlags));
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
