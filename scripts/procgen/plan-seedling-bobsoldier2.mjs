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
 *   SEEDLING_BS2_LAPSE_RETIRED=1 node scripts/procgen/plan-seedling-bobsoldier2.mjs --out=<dir>
 *                                     # the retired arm (`LAPSE_PIN_RETIRED`), its tapes written to (or, with
 *                                     # `--check`, compared against) <dir> instead of the committed ones
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
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? null;

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

/**
 * ⚖ PINNED `strikeIframeLapse` OFF — an INTERIM (seedling-fidelity-producers, 2026-10-16).
 * Both tapes were recorded on the game under the PRE-LAPSE strike gate. The lapse flip (`19aaa5cce4`, ⚖ user
 * "Flip after DD lands") turned `strikeIframeLapse` ON and pinned `fidelityBobSoldier2`'s rows OFF for exactly that
 * reason ("game-witnessed under the pre-flip strike gate"); its re-pin list missed this producer (no CI job runs
 * it). ON, both plans move, the OFF staging no longer refuses on the dwell, and the chaser-arm kill row fails.
 * ⛔ RETIRE THIS PIN with a re-record ON: the plan re-derived under the flipped default, recorded on the game
 * (p4f, 0 px), and its roster rows re-pinned — a roster move, so the user's licence.
 */
const PINNED_FIDELITY = Object.freeze({ strikeIframeLapse: false });

/**
 * ⛓ BS2FIX (wave 20) — **THE RETIREMENT, PREPARED BEHIND THE PIN** (⚖ the user, 2026-10-19: "Keep pin, queue fix").
 * `false` (the default, until the user licenses the re-record) is the pinned producer above, byte-identical.
 * `true` retires the interim, measured at `934f99422b` (the BS2FIX report):
 *   - the AFTER (`bobsoldier2-l30-torch`) is planned at the DEFAULTS: 460 → 395 t. The collect runs first (STRIKELAPSE
 *     D1's stand walk, the body alive on 2 hits), and the exit walk's own sword press kills `bobsoldier@48,80`
 *     from the walk towards the stance (72,88) (`killedOnWalk`, dwell 0). Recorded on the game (p4g, 0 px).
 *   - the BEFORE (`bobsoldier2-l30-dash-stance`) keeps `strikeIframeLapse` OFF as a CONTROL, permanently
 *     (`CONTROL_FIDELITY`, u10's shape). The dwell refusal it witnesses is a pre-lapse executor/forecast mismatch:
 *     with the lapse ON, no setting of the two switches reaches the dwell at step 50 (measured at all four), so the
 *     only game witness of `KILL_STANCE_AS_FORECAST`'s defect is the lapse-OFF solve. The tape is game-recorded keys,
 *     and its replay does not read the switch. It stays byte-identical.
 * `SEEDLING_BS2_LAPSE_RETIRED=1` measures the retired arm before the licence (pair it with `--out=`).
 */
const LAPSE_PIN_RETIRED = process.env.SEEDLING_BS2_LAPSE_RETIRED === '1';
const CONTROL_FIDELITY = Object.freeze({ strikeIframeLapse: false });

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main(retired = false) {
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const asControl = (fn) => (retired ? withContactFidelity(CONTROL_FIDELITY, fn) : fn());
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
        const path = join(OUT ?? TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.startsWith(REPO) ? path.slice(REPO.length + 1) : path}`);
        }
    };

    // ── OFF: the base solver refuses on the dwell, and the keys it drove are the BEFORE witness ──
    const off = await asControl(() => bobsoldier2Plan(false));
    check(`both switches OFF${retired ? ' (the control: `strikeIframeLapse` OFF)' : ''}: the staging REFUSES on the kill arm\'s dwell (the survey\'s step-50 text)`,
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
        const { out, last, body } = asControl(() => replay(parseTape(JSON.parse(json))));
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
        if (retired) {
            // ⛓ BS2FIX: at the defaults the collect runs first, and the walk towards the stance (72,88) kills the body
            // with its own press (`PRESS_KILL_DONE_ON_WALK`): the arm records a dwell of 0.
            const collect = on.solved.out.records.findIndex((r) => r.strategy === 'collect');
            check('the plan collects the Torchpickup FIRST, then kills the BobSoldier by the chaser arm ON THE WALK towards the '
                + 'stance (72,88): the walk\'s own press, no dwell',
                kill && kill.target === w.body && kill.stance.x === 72 && kill.stance.y === 88 && kill.ticks === 0
                    && Boolean(kill.killedOnWalk) && collect >= 0 && collect < on.solved.out.records.indexOf(kill),
                kill ? `dwell ${kill.ticks}/${kill.bound} t, killedOnWalk ${JSON.stringify(kill.killedOnWalk ?? null)}`
                    : 'no chaser kill');
        } else {
            check('the plan kills the BobSoldier by the chaser arm, from the stance (88,56), inside the forecast\'s bound',
                kill && kill.target === w.body && kill.stance.x === 88 && kill.stance.y === 56 && kill.ticks <= kill.bound,
                kill ? `dwell ${kill.ticks}/${kill.bound} t, ${kill.strikes} strike(s)` : 'no chaser kill');
        }
        const built = buildStagedTape({
            staging: { ...on.staging, persistence: on.solved.persistence,
                equips: [...(on.staging.equips ?? []), ...(on.solved.out.equips ?? [])] },
            perTick: on.solved.out.perTick,
            name,
        });
        const description = retired ? '⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2 D2 — the AFTER, at the defaults (BS2FIX: '
            + '`strikeIframeLapse` ON, the interim pin retired): survey step 50\'s staging (see `bobsoldier2-l30-dash-stance`), '
            + `solved with \`KILL_STANCE_AS_FORECAST\` and \`SWORD_GATE_TIMED\` ON: ${on.solved.out.perTick.length} t. The `
            + 'collect runs first (the stand walk), with bobsoldier@48,80 alive on 2 hits; the exit walk\'s gate prices the '
            + `body's blade by its tick, and that walk's own sword press (t${kill?.killedOnWalk?.pressedAt ?? '?'}) kills it `
            + 'on the walk towards the stance (72,88). Then stairsup@224,160 → L32. Authored by '
            + 'scripts/procgen/plan-seedling-bobsoldier2.mjs.'
            : '⛓⛓⛓ SEEDLING FIDELITY BOBSOLDIER2 D2 — the AFTER: survey step 50\'s staging (see '
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

if (isEntryPoint(import.meta.url)) {
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    if (LAPSE_PIN_RETIRED) await main(true);
    else await withContactFidelity(PINNED_FIDELITY, () => main(false));
}
