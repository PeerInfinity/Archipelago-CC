#!/usr/bin/env node
/**
 * plan-seedling-bobsoldier2 — ⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2: L30's TORCHPICKUP, PAST THE BOBSOLDIER, BY THE
 * KILL ARM'S OWN FORECAST.
 *
 * The route survey's step 50 (`--through=end`, L30 from (176,48), goals [collect Torchpickup (64,64), reach-exit
 * stairsup@224,160 → L32]) refused: *"collect (64,64) stance -> kill (bobsoldier@48,80) by press: the dwell's
 * condition (…) never became true inside its 53-tick bound"*. Two witnesses, both from that staging:
 *
 *   bobsoldier2-l30-dash-stance   BOTH SWITCHES OFF (the base solver): the keys the solve drove before the dwell
 *                                 refused — the walk to the stance DASHED (`planSwordDash`) and arrived at t92 with
 *                                 the body on one hit, and at the 53-tick bound (t145) the body is alive on two.
 *                                 Recorded on the game: the BobSoldier is bit-exact (D1's measurement).
 *   bobsoldier2-l30-torch         BOTH SWITCHES ON (`KILL_STANCE_AS_FORECAST`, `SWORD_GATE_TIMED`): the solver's
 *                                 own plan — the stance walked undashed (arrival t145, kill t167, as forecast), the
 *                                 next walk's gate timing the corpse's blade, the Torchpickup, and the stairs → L32.
 *
 * THE STAGING (the survey's, written out — `plan-seedling-crusher-witness`'s shape): `r8-solve-11`'s committed
 * block re-pointed at (176,48), the save keys and seam items the route holds by step 50, and the five clears the
 * route has earned by then. `--check` re-derives both tapes and compares them to the committed ones byte for byte,
 * asserts the switches-OFF solve still REFUSES on the dwell, and asserts the model's replay of each.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-bobsoldier2.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-bobsoldier2.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { crusherStaging } from './plan-seedling-crusher-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** Survey step 50's staging and goals (the survey's own `boot` view, written out). */
export const BOBSOLDIER2_STEP50 = Object.freeze({
    step: 50,
    boot: { level: 30, x: 176, y: 48 },
    keys: [0, 1],
    items: ['hasShield'],
    // The clears the route has earned by step 50 (the survey's `staged` persistence beyond r8-solve-11's block).
    earned: [{ level: 0, tag: 1 }, { level: 19, tag: 1 }, { level: 12, tag: 4 }, { level: 12, tag: 5 },
        { level: 31, tag: 0 }],
    goals: [
        { kind: 'collect-placement', placement: { x: 64, y: 64 } },
        { kind: 'reach-exit', exit: { x: 224, y: 160 } },
    ],
    body: 'bobsoldier@48,80',
});

/** The staging: `crusherStaging`'s construction with step 50's grants, plus the earned clears. */
export async function bobsoldier2Staging(w = BOBSOLDIER2_STEP50) {
    const staging = await crusherStaging(w);
    staging.persistence = [...staging.persistence, ...w.earned.map((r) => ({ ...r }))];
    return staging;
}

/**
 * The solver on that staging with both switches as given. Every run the solve builds is a RECORDING view
 * (`Object.create(run)` with its own `advance`, `solveSegment`'s own F2 shape), so a refusal still hands back the
 * keys the last pass drove. `killStance` / `swordGate` set the two switches apart (both default to `enabled`).
 * Resolves `{staging, solved, refusal, driven}`.
 */
export async function bobsoldier2Plan(enabled, { killStance = enabled, swordGate = enabled } = {}) {
    const w = BOBSOLDIER2_STEP50;
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withKillStanceAsForecast, withSwordGateTimed } = await import(join(MODULE, 'solverBot.js'));
    const staging = await bobsoldier2Staging(w);
    const levelSource = atlasLevelSource();
    let driven = null;
    const makeRun = (p) => {
        const run = createRunForStaging({ ...staging, persistence: p }, levelSource);
        const keys = [];
        driven = keys;
        const view = Object.create(run);
        view.advance = (held) => { keys.push(new Set(held)); return run.advance(held); };
        return view;
    };
    let solved = null;
    let refusal = null;
    try {
        solved = await withKillStanceAsForecast(killStance, () => withSwordGateTimed(swordGate, () => twoPassSolve({
            makeRun, goals: w.goals.map((g) => JSON.parse(JSON.stringify(g))), name: `survey-step-${w.step}`,
            boot: staging.boot, persistence: staging.persistence, log: () => {},
        })));
    } catch (e) {
        refusal = e;
    }
    return { staging, solved, refusal, driven };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape, serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const w = BOBSOLDIER2_STEP50;
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    const replay = (tape) => {
        let run = null;
        const st = createTapeStepper(tape, { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        let last = null;
        while (!r.done) { last = r.value.observation; r = st.next(); }
        const body = (run?.entities('chasers') ?? []).find((c) => c.id === w.body) ?? null;
        return { out: r.value, last, body, run };
    };
    const emit = (name, json) => {
        const path = join(TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    };

    // ── OFF: the base solver refuses on the dwell, and the keys it drove are the BEFORE witness ──
    const off = await bobsoldier2Plan(false);
    check('both switches OFF: the staging REFUSES on the kill arm\'s dwell (the survey\'s step-50 text)',
        off.solved === null && /kill \(bobsoldier@48,80\) by press: the dwell's condition .* never became true inside its 53-tick bound/
            .test(off.refusal?.message ?? ''), (off.refusal?.message ?? 'it solved').slice(0, 200));
    {
        const name = 'bobsoldier2-l30-dash-stance';
        const built = buildStagedTape({ staging: off.staging, perTick: off.driven ?? [], name });
        const description = '⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2 D1 — the BEFORE: survey step 50\'s staging (`r8-solve-11`\'s '
            + 'block re-pointed at L30 (176,48), keys [0, 1], the shield, the five clears the route has earned), solved with '
            + '`KILL_STANCE_AS_FORECAST` and `SWORD_GATE_TIMED` OFF. These are the keys it drove before the kill arm\'s dwell '
            + `refused: ${(off.driven ?? []).length} t — the walk to the stance (88,56) dashed (planSwordDash) and arrived at t92 `
            + 'with bobsoldier@48,80 on one hit; the forecast had priced an undashed walk arriving at t145 with it on two. At '
            + 'the 53-tick bound the body is alive on two hits. Authored by scripts/procgen/plan-seedling-bobsoldier2.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const { out, last, body } = replay(parseTape(JSON.parse(json)));
        check(`${name}: the model replays it — no hit, still in L30, ${w.body} ALIVE on 2 hits at the end`,
            (out.playerHits?.length ?? 0) === 0 && last?.level === 30 && body !== null && body.hits === 2,
            `hits ${out.playerHits?.length ?? '?'}, level ${last?.level}, body ${body ? `(${body.x.toFixed(2)},${body.y.toFixed(2)}) h${body.hits}` : 'gone'}`);
        check(`${name}: the tape round-trips through the tape format`, Boolean(serializeTape(parseTape(JSON.parse(json)))));
        emit(name, json);
    }

    // ── ON: the solver's own plan solves ──
    const on = await bobsoldier2Plan(true);
    check('both switches ON: the staging SOLVES', on.solved !== null, (on.refusal?.message ?? '').slice(0, 200));
    if (on.solved) {
        const name = 'bobsoldier2-l30-torch';
        const kill = on.solved.out.records.find((r) => r.strategy === 'kill' && r.arm === 'chaser');
        check('the plan kills the BobSoldier by the chaser arm, from the stance (88,56), inside the forecast\'s bound',
            kill && kill.target === w.body && kill.stance.x === 88 && kill.stance.y === 56 && kill.ticks <= kill.bound,
            kill ? `dwell ${kill.ticks}/${kill.bound} t, ${kill.strikes} strike(s)` : 'no chaser kill');
        const built = buildStagedTape({
            staging: { ...on.staging, persistence: on.solved.persistence,
                equips: [...(on.staging.equips ?? []), ...(on.solved.out.equips ?? [])] },
            perTick: on.solved.out.perTick,
            name,
        });
        const description = '⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2 D2 — the AFTER: survey step 50\'s staging (see '
            + '`bobsoldier2-l30-dash-stance`), solved with `KILL_STANCE_AS_FORECAST` and `SWORD_GATE_TIMED` ON: '
            + `${on.solved.out.perTick.length} t. The stance (88,56) is walked as forecast (undashed), the dwell kills `
            + `bobsoldier@48,80 in ${kill?.ticks ?? '?'} of its ${kill?.bound ?? '?'}-tick bound, the next walk's gate times the `
            + 'corpse\'s blade, then the Torchpickup (64,64) and stairsup@224,160 → L32. Authored by '
            + 'scripts/procgen/plan-seedling-bobsoldier2.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const { out, last } = replay(parseTape(JSON.parse(json)));
        check(`${name}: the model replays it — zero hits, the body killed, the crossing into L32`,
            (out.playerHits?.length ?? 0) === 0 && last?.level === 32,
            `hits ${out.playerHits?.length ?? '?'}, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        check(`${name}: the tape round-trips through the tape format`, Boolean(serializeTape(parseTape(JSON.parse(json)))));
        emit(name, json);
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
