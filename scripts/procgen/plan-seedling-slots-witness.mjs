#!/usr/bin/env node
/**
 * plan-seedling-slots-witness — ⛓⛓⛓ SEEDLING FIDELITY SLOTS: THE SLOT ARRAY IN
 * ARRIVAL ORDER, ON THE GAME.
 *
 * `Inventory.items` is static and `addItemsFromSave` only appends, so Fire
 * received before the sword is the game's `[1, 0]` for the rest of the session
 * (`probe-seedling-slot-order.mjs` measures it). Both tapes boot BURN's L24 leg
 * (route step 93, `plan-seedling-burn-witness.mjs`'s staging) in that order: the
 * seam holds Fire and NOT the sword, and a grant row hands the sword over at
 * L24, so the boot's dead frames append Fire and the tick-0 grant appends the
 * sword after it.
 *
 *   slots-l24-fire-first        (D2, the MODEL) slot 0 is Fire. The keys are the
 *                               solver's plan for the same leg with NO sword
 *                               held (one X press, at the stance, no equips), so
 *                               nothing here selects a slot: the one press burns
 *                               the tree only because slot 0 holds Fire. The
 *                               fresh-game order (`[0, 1]`) slashes there, the
 *                               tree stands and the walk never crosses.
 *   slots-l24-burn-fire-first   (D3, the SOLVER) the solver's own plan from that
 *                               staging: the sword's slot (1) for its dashes,
 *                               Fire's (0) for the burn, the sword's again —
 *                               `[{1,1},{61,0},{115,1}]`, the vanilla plan's keys
 *                               one tick later, with the indices of the staged
 *                               order. ⚠ The tick first is idle: the grant lands
 *                               at the top of t0 and its slot in t0's tail, and
 *                               `Bot.as` checks an equip at the top of its tick.
 *   slots-l24-burn-cut-80       (D4a) BURN's own L24 plan cut MID-BURN (K=80: the
 *                               tree hit at t64, gone at t105) and continued the
 *                               way the wasm engine continues a held room
 *                               (`continuationSolveRequest` → `solveFromTape`, a
 *                               lead tick): the continuation selects the sword's
 *                               slot, WAITS the burn out and walks on.
 *   slots-l24-burn-cut-110      (D4b) the same plan cut after the burn and before
 *                               its sword re-select (K=110, Fire's slot still
 *                               selected): the continuation selects the sword's
 *                               slot on its first tick, before any press.
 *                               Each cut is played as ONE tape (the prefix, the
 *                               lead, the continuation), which is what the held
 *                               game plays.
 *   slots-l24-burn-fencepost    (D4a's fencepost) cut-80 with its walk ONE tick
 *                               earlier: the first key after the wait lands on
 *                               update `goneAt - 1` (t104). The first cut-80
 *                               recording did exactly that and REFUTED the model
 *                               (it let the player into the tree's cell on t104;
 *                               the game blocks it until t105). This tape keeps
 *                               that measurement in the roster: model = game only
 *                               with `levelRun.burnedTreeIdsNow` at `ticksCompleted`.
 *
 * `--check` re-derives all four and compares them to the committed tapes byte
 * for byte, and asserts the model's replay burns the tree and crosses to L12.
 * Record the game: `check-seedling-bot-differential --record --only=…`.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-slots-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-slots-witness.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { BURN_WITNESSES, burnStaging } from './plan-seedling-burn-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

/** BURN's L24 leg (route step 93). */
export const SLOTS_LEG = BURN_WITNESSES.find((w) => w.name === 'burn-l24-reach-exit');
export const SLOTS_D2 = 'slots-l24-fire-first';
export const SLOTS_D3 = 'slots-l24-burn-fire-first';
/** D4a's fencepost witness (cut-80, its walk one tick earlier). */
export const SLOTS_FENCEPOST = 'slots-l24-burn-fencepost';
/** D4's cuts of BURN's L24 plan: mid-burn, and after the burn with Fire's slot still selected. */
export const SLOTS_D4_CUTS = Object.freeze([
    Object.freeze({ name: 'slots-l24-burn-cut-80', K: 80, what: 'MID-BURN (the tree hit at t64, gone at t105)' }),
    Object.freeze({ name: 'slots-l24-burn-cut-110', K: 110, what: 'after the burn, Fire\'s slot still selected (the plan re-selects the sword at t114)' }),
]);

/** The leg's staging with the sword ARRIVING after Fire: the seam holds Fire, a grant row the sword. */
export async function fireFirstStaging() {
    const staging = await burnStaging(SLOTS_LEG);
    return { ...staging,
        seam: { ...staging.seam, items: { ...staging.seam.items, hasSword: false } },
        grants: [{ level: SLOTS_LEG.boot.level, items: ['sword'] }] };
}

/** The same leg with no sword at all (D2's keys: a plan that presses only for the burn). */
export async function swordlessStaging() {
    const staging = await burnStaging(SLOTS_LEG);
    return { ...staging, seam: { ...staging.seam, items: { ...staging.seam.items, hasSword: false } } };
}

async function solve(staging, name) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    return twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [SLOTS_LEG.goal], name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
}

/**
 * D4's witnesses: BURN's L24 plan (the committed `burn-l24-reach-exit`, which IS
 * the solve the wasm engine asks for) cut at K and continued through the engine's
 * own continuation request, as `wasmEquips.test.js` does. Returns
 * `{name, K, staging, persistence, perTick, equips, cont}` per cut.
 */
export async function slotsCutWitnesses() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveFromTape } = await import(join(MODULE, 'jsRuntimeSolver.js'));
    const { arrivalSolveRequest, continuationSolveRequest } = await import(join(MODULE, 'wasmArrival.js'));
    const { indexLevels } = await import(join(MODULE, 'atlasSource.js'));
    const SRC = atlasLevelSource();
    const witness = parseTape(readFileSync(join(TAPES, `${SLOTS_LEG.name}.json`), 'utf8'));
    const staging = { ...witness, equips: [], despawn: [], tick0: null };
    const records = indexLevels(JSON.parse(readFileSync(join(MODULE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8')));
    const plan = solveFromTape(arrivalSolveRequest({ staging, solverGoal: SLOTS_LEG.goal, levelSource: SRC,
        records: new Map(), scratchPersistence: true }));
    const goal = { kind: 'exit', level: SLOTS_LEG.boot.level, tiles: [[2, 9]], name: `L${SLOTS_LEG.boot.level} → L${SLOTS_LEG.to}` };
    return SLOTS_D4_CUTS.map((cut) => {
        const prefix = plan.solution.slice(0, cut.K).map((h) => [...h]);
        const lead = [[...plan.solution[cut.K - 1]]];
        const roomEquips = new Map([...plan.equipsAt].filter(([t]) => t < cut.K));
        const c = continuationSolveRequest({ staging, shipped: [...prefix, ...lead], goal, levelSource: SRC,
            records, record: records.get(SLOTS_LEG.boot.level), equips: roomEquips });
        if (c.refusal) throw new Error(`${cut.name}: the continuation request refuses: ${c.refusal}`);
        const cont = solveFromTape(c.request);
        const perTick = [...prefix, ...lead, ...cont.solution.map((h) => [...h])].map((h) => new Set(h));
        const equips = [...[...roomEquips].map(([t, slot]) => ({ t, slot })),
            ...[...cont.equipsAt].map(([t, slot]) => ({ t: t + cut.K + 1, slot }))];
        return { ...cut, staging: { ...stagingFromTape(witness), equips: [] }, persistence: witness.persistence,
            perTick, equips, cont };
    });
}

/** Both witnesses, `{name, staging, solved, equips, description}`. */
export async function slotsWitnesses() {
    const ff = await fireFirstStaging();
    const d2 = await solve(await swordlessStaging(), SLOTS_D2);
    const d3 = await solve(ff, SLOTS_D3);
    const presses = (pt) => pt.map((h, i) => (h.has('primary') ? i : -1)).filter((i) => i >= 0);
    return [
        { name: SLOTS_D2, staging: ff, solved: d2, equips: [],
            description: '⛓⛓⛓ SEEDLING FIDELITY SLOTS (D2) — the slot array in ARRIVAL order. BURN\'s L24 leg '
                + '(route step 93) with the seam holding Fire and not the sword, and a grant of the sword at L24: '
                + 'the game holds [1, 0], so slot 0 is Fire. The keys are the solver\'s plan for the same leg with '
                + `no sword held (${d2.out.perTick.length} t, one X press on t${presses(d2.out.perTick).join(', t')}, `
                + 'no equips): the one press burns `burnabletree@32,128` only because slot 0 holds Fire. In the '
                + 'fresh-game order [0, 1] it is a slash, the tree stands and the walk never reaches '
                + '`teleporter@32,144`. Authored by scripts/procgen/plan-seedling-slots-witness.mjs.' },
        { name: SLOTS_D3, staging: ff, solved: d3, equips: d3.out.equips ?? [],
            description: '⛓⛓⛓ SEEDLING FIDELITY SLOTS (D3) — the solver indexes the STAGED slot order. BURN\'s L24 '
                + 'leg (route step 93) booted with Fire received before the sword (the game\'s [1, 0]). The '
                + `solver's own plan: ${d3.out.perTick.length} t, equips ${JSON.stringify(d3.out.equips)} — the `
                + 'sword\'s slot for its dash presses from tick 0, Fire\'s for the burn, the sword\'s again: the '
                + 'vanilla plan\'s keys with the indices of the arrival order. Authored by '
                + 'scripts/procgen/plan-seedling-slots-witness.mjs.' },
    ];
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
    const cuts = (await slotsCutWitnesses()).map((c) => ({
        name: c.name, staging: c.staging, equips: c.equips,
        solved: { persistence: c.persistence, out: { perTick: c.perTick } },
        description: `⛓⛓⛓ SEEDLING FIDELITY SLOTS (D4) — BURN's L24 plan (\`${SLOTS_LEG.name}\`) cut at K=${c.K}, `
            + `${c.what}, and continued the way the wasm engine continues a held room (\`continuationSolveRequest\` `
            + `→ \`solveFromTape\`, one lead tick): the prefix's equips ${JSON.stringify(c.equips.filter((e) => e.t < c.K))}, `
            + `then the continuation's own ${c.cont.solution.length} t with equips `
            + `${JSON.stringify(c.equips.filter((e) => e.t > c.K))} (verbs ${c.cont.verbs.join(', ')}): it selects the sword's `
            + 'slot on its first tick, before any press'
            + `${c.cont.verbs.includes('burn') ? ', and waits the burn out' : ''}. One tape: the prefix, the lead, the `
            + 'continuation. Authored by scripts/procgen/plan-seedling-slots-witness.mjs.',
    }));
    // The fencepost: cut-80's continuation with one idle tick of its wait dropped and one appended at the end.
    const c80 = cuts.find((c) => c.name === 'slots-l24-burn-cut-80');
    const pt = c80.solved.out.perTick;
    const firstKey = pt.findIndex((h, i) => i > 81 && h.size > 0);
    const fencepost = {
        name: SLOTS_FENCEPOST, staging: c80.staging, equips: c80.equips,
        solved: { persistence: c80.solved.persistence,
            out: { perTick: [...pt.slice(0, firstKey - 1), ...pt.slice(firstKey), new Set()] } },
        description: '⛓⛓⛓ SEEDLING FIDELITY SLOTS (D4a, the fencepost) — `slots-l24-burn-cut-80` with its walk one '
            + `tick earlier: the first key after the wait is on t${firstKey - 1}, the update before the tree's \`goneAt\` `
            + '(t105). The game blocks the player against the still-solid tree on that update and lets it through on the '
            + 'next; the model agrees only with `levelRun.burnedTreeIdsNow` asked at `ticksCompleted` (it was `+ 1`, '
            + 'which the first cut-80 recording refuted). Authored by scripts/procgen/plan-seedling-slots-witness.mjs.',
    };
    for (const w of [...await slotsWitnesses(), ...cuts, fencepost]) {
        const built = buildStagedTape({
            staging: { ...w.staging, persistence: w.solved.persistence,
                equips: [...(w.staging.equips ?? []), ...w.equips] },
            perTick: w.solved.out.perTick,
            name: w.name,
        });
        const tape = parseTape({ ...built, description: w.description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        const to = w.name === SLOTS_FENCEPOST ? last?.level : SLOTS_LEG.to;
        check(`${w.name}: the model replays it into L${to}`, last?.level === to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        check(`${w.name}: the model burns ${SLOTS_LEG.tree} once`, (out.treeBurns ?? []).length === 1
            && out.treeBurns[0].id === SLOTS_LEG.tree, JSON.stringify((out.treeBurns ?? []).map((b) => [b.id, b.t])));
        const json = `${JSON.stringify({ ...built, description: w.description }, null, 4)}\n`;
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
