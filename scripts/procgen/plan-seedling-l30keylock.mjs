#!/usr/bin/env node
/**
 * plan-seedling-l30keylock — ⛓⛓⛓ SEEDLING FIDELITY L30KEYLOCK: L30 → L22 THROUGH `bosslock@64,32`, PAST THE
 * BOBSOLDIER THAT STANDS BESIDE IT.
 *
 * The route survey's step 52 (`--through=end`, L30 from the PIT landing (224,80), goal teleporter@64,0 → L22)
 * refused: *"the danger map forbids (71.77,50.12) — chaser:bobsoldier@48,80 (… bare, one forecast tick on …)"*, and
 * the live playthrough B declined the same crossing at the keylock stance (*"combat ladder EXHAUSTED"*). Three
 * witnesses, all from step 52's staging (and the second pit landing, (240,80)):
 *
 *   l30keylock-pit224-before   BOTH SWITCHES OFF (the base solver): the keys the solve drove before it refused —
 *                              the walk reaches the key line, `execKeylock` stands there unguarded, and the
 *                              BobSoldier lands a sword hit and a body hit before the lock fades open. The refusal
 *                              came only at the NEXT walk's gate. Recorded on the game (D1's measurement).
 *   l30keylock-pit224          BOTH SWITCHES ON (`KILL_STANCE_TARGET_RESCAN`, `KEYLOCK_WAIT_PRICED`): the solver's
 *                              own plan from (224,80) — the keylock's wait priced, the ladder's kill rung finding a
 *                              stance in the BODY's box, the kill, the lock, teleporter@64,0 → L22.
 *   l30keylock-pit240          the same from the other pit landing (240,80) (`in_pit_L32_15_5`), where the base
 *                              solver's walk DIES on the key line.
 *
 * THE STAGING (the survey's, written out — `plan-seedling-bobsoldier2`'s shape): `r8-solve-11`'s committed block
 * re-pointed at the landing, keys [0, 1], the shield, the Fire and the Light, and the four clears the route has
 * earned by step 52 ({0,1} {19,1} {31,0} {30,2}). Byte-equal to the survey's own step-52 boot view (D1).
 * `--check` re-derives every tape and compares it to the committed one byte for byte, and asserts each switch
 * setting's verdict and the model's replay of each tape.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-l30keylock.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-l30keylock.mjs --check    # exit 1 on drift
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

/** Survey step 52's staging and goal (the survey's own `boot` view, written out); `x` is the pit landing. */
export const L30KEYLOCK_STEP52 = Object.freeze({
    step: 52,
    boot: { level: 30, x: 224, y: 80 },
    keys: [0, 1],
    items: ['hasShield', 'hasFire', 'hasTorch'],
    // The clears the route has earned by step 52 (the survey's `staged` persistence beyond r8-solve-11's block).
    earned: [{ level: 0, tag: 1 }, { level: 19, tag: 1 }, { level: 31, tag: 0 }, { level: 30, tag: 2 }],
    goals: [{ kind: 'reach-exit', exit: { x: 64, y: 0 } }],
    body: 'bobsoldier@48,80',
    lock: 'bosslock@64,32',
});

/** The two pit landings into L30 from L32 (`in_pit_L32_14_5`, `in_pit_L32_15_5`). */
export const L30_PIT_LANDINGS = Object.freeze([224, 240]);

/** The staging: `crusherStaging`'s construction with step 52's grants, plus the earned clears, at landing `x`. */
export async function l30keylockStaging(x = 224, w = L30KEYLOCK_STEP52) {
    const staging = await crusherStaging({ ...w, boot: { ...w.boot, x } });
    staging.persistence = [...staging.persistence, ...w.earned.map((r) => ({ ...r }))];
    return staging;
}

/**
 * The solver on that staging with the two switches as given (`rescan`, `waitPriced`). Every run the solve builds
 * is a RECORDING view (`Object.create(run)` with its own `advance`), so a refusal still hands back the keys the last
 * pass drove and the run they were driven on. Resolves `{staging, solved, refusal, driven, run}`.
 */
export async function l30keylockPlan(x, { rescan, waitPriced }) {
    const w = L30KEYLOCK_STEP52;
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { withKillStanceTargetRescan, withKeylockWaitPriced } = await import(join(MODULE, 'solverBot.js'));
    const staging = await l30keylockStaging(x, w);
    const levelSource = atlasLevelSource();
    let driven = null;
    let lastRun = null;
    const makeRun = (p) => {
        const run = createRunForStaging({ ...staging, persistence: p }, levelSource);
        const keys = [];
        driven = keys;
        lastRun = run;
        const view = Object.create(run);
        view.advance = (held) => { keys.push(new Set(held)); return run.advance(held); };
        return view;
    };
    let solved = null;
    let refusal = null;
    try {
        solved = await withKillStanceTargetRescan(rescan, () => withKeylockWaitPriced(waitPriced, () => twoPassSolve({
            makeRun, goals: w.goals.map((g) => JSON.parse(JSON.stringify(g))), name: `survey-step-${w.step}`,
            boot: staging.boot, persistence: staging.persistence, log: () => {},
        })));
    } catch (e) {
        refusal = e;
    }
    return { staging, solved, refusal, driven, run: lastRun };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape, serializeTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const w = L30KEYLOCK_STEP52;
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
    const hitsOf = (out) => (out.playerHits ?? []).map((h) => `t${h.t} ${h.source}`).join(', ');

    // ── OFF: the base solver's walk is hit on the key line, and it refuses only at the next walk's gate ──
    {
        const off = await l30keylockPlan(224, { rescan: false, waitPriced: false });
        check('both switches OFF, (224,80): the staging REFUSES at the gate after the keylock (the survey\'s step-52 text)',
            off.solved === null && /the danger map forbids \(71\.77\d*,50\.11\d*\) — chaser:bobsoldier@48,80/
                .test(off.refusal?.message ?? ''), (off.refusal?.message ?? 'it solved').slice(0, 200));
        const name = 'l30keylock-pit224-before';
        const built = buildStagedTape({ staging: off.staging, perTick: off.driven ?? [], name });
        const description = '⛓⛓⛓ SEEDLING FIDELITY L30KEYLOCK D1 — the BEFORE: survey step 52\'s staging (`r8-solve-11`\'s '
            + 'block re-pointed at the L30 pit landing (224,80), keys [0, 1], the shield, the Fire and the Light, the four '
            + 'clears the route has earned), solved with `KILL_STANCE_TARGET_RESCAN` and `KEYLOCK_WAIT_PRICED` OFF. These '
            + `are the keys it drove before it refused: ${(off.driven ?? []).length} t — a detour to the keylock stance `
            + '(72,56), `execKeylock` leaning onto bosslock@64,32\'s key line and standing there UNGUARDED while '
            + 'bobsoldier@48,80 closes: a sword hit and a body hit, then the lock fades open, and only the NEXT walk\'s '
            + 'gate refuses. Authored by scripts/procgen/plan-seedling-l30keylock.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const { out, last, body } = replay(parseTape(JSON.parse(json)));
        check(`${name}: the model replays it — TWO hits on the key line (a sword, then the body), still in L30, `
            + `${w.body} alive`,
            (out.playerHits?.length ?? 0) === 2 && out.playerHits[0].source === 'sword'
                && out.playerHits[1].source === 'chaser' && last?.level === 30 && body !== null,
            `hits [${hitsOf(out)}], level ${last?.level}, body ${body ? `(${body.x.toFixed(2)},${body.y.toFixed(2)}) h${body.hits}` : 'gone'}`);
        check(`${name}: the tape round-trips through the tape format`, Boolean(serializeTape(parseTape(JSON.parse(json)))));
        emit(name, json);
    }

    // ── ON: the solver's own plan from each pit landing ──
    for (const x of L30_PIT_LANDINGS) {
        const off = await l30keylockPlan(x, { rescan: false, waitPriced: false });
        check(`both switches OFF, (${x},80): REFUSED, and the walk it drove was hit on the key line`,
            off.solved === null && (off.run?.playerHits?.length ?? 0) >= 2,
            `${(off.refusal?.message ?? 'it solved').slice(0, 120)} — hits ${off.run?.playerHits?.length ?? '?'}`);
        const only = await l30keylockPlan(x, { rescan: false, waitPriced: true });
        check(`KEYLOCK_WAIT_PRICED alone, (${x},80): no walk is hit (a solve or a refusal before the wait)`,
            (only.run?.playerHits?.length ?? 0) === 0,
            only.solved ? `SOLVED ${only.solved.out.perTick.length} t`
                : `REFUSED: ${(only.refusal?.message ?? '').slice(0, 140)}`);
        const on = await l30keylockPlan(x, { rescan: true, waitPriced: true });
        check(`both switches ON, (${x},80): the staging SOLVES`, on.solved !== null,
            (on.refusal?.message ?? '').slice(0, 200));
        if (!on.solved) continue;
        const name = `l30keylock-pit${x}`;
        const kill = on.solved.out.records.find((r) => r.strategy === 'kill' && r.arm === 'chaser');
        const keylock = on.solved.out.records.find((r) => r.strategy === 'keylock');
        check(`${name}: the plan kills the BobSoldier by the chaser arm inside the forecast's bound, then opens the lock`,
            Boolean(kill && keylock) && kill.target === w.body && kill.ticks <= kill.bound && keylock.target === w.lock
                && on.solved.out.records.indexOf(kill) < on.solved.out.records.indexOf(keylock),
            kill ? `stance (${kill.stance.x},${kill.stance.y}), dwell ${kill.ticks}/${kill.bound} t; keylock from t${keylock?.from}`
                : 'no chaser kill');
        const built = buildStagedTape({
            staging: { ...on.staging, persistence: on.solved.persistence,
                equips: [...(on.staging.equips ?? []), ...(on.solved.out.equips ?? [])] },
            perTick: on.solved.out.perTick,
            name,
        });
        const description = '⛓⛓⛓ SEEDLING FIDELITY L30KEYLOCK D2/D3 — the AFTER: survey step 52\'s staging (see '
            + `\`l30keylock-pit224-before\`) at the pit landing (${x},80), solved with \`KILL_STANCE_TARGET_RESCAN\` and `
            + `\`KEYLOCK_WAIT_PRICED\` ON: ${on.solved.out.perTick.length} t. The keylock's wait is priced as the stance `
            + 'walk\'s tail, so the ladder climbs; the kill rung\'s chaser arm finds no stance in the player\'s box and '
            + `scans the body's: (${kill?.stance?.x},${kill?.stance?.y}), where the dwell kills bobsoldier@48,80 in `
            + `${kill?.ticks ?? '?'} of its ${kill?.bound ?? '?'}-tick bound; then bosslock@64,32's key line and `
            + 'teleporter@64,0 → L22. Authored by scripts/procgen/plan-seedling-l30keylock.mjs.';
        const json = `${JSON.stringify({ ...built, description }, null, 4)}\n`;
        const { out, last } = replay(parseTape(JSON.parse(json)));
        check(`${name}: the model replays it — zero hits, the crossing into L22`,
            (out.playerHits?.length ?? 0) === 0 && last?.level === 22,
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
