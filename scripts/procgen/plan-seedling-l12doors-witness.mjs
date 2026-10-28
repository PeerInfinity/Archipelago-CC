#!/usr/bin/env node
/**
 * plan-seedling-l12doors-witness — ⛓⛓⛓ SEEDLING FIDELITY L12DOORS: THE SOLVER'S OWN L12 → L83 PLANS, AS TAPES THE
 * GAME PLAYS (`probe-seedling-l12doors.mjs`) AND THE MODEL REPRODUCES (`fidelityL12Doors.test.js`).
 *
 * Survey route steps 172/203 (L12 visits 14/16, `reach-exit` teleporter@32,848 → L83) refused KEYLOCK-SEALED on
 * `bosslock@112,192`. The real door is the STACKED `bosslock@32,864` (Yellow Key) + `magicallock@32,864` (Wand), whose
 * south side is reached through a 13 px cliffside gap (rules-4, `probe-seedling-l12-bosslock.mjs`). Three switches:
 *
 *   wandShotChaserBodies    D1  a WandShot in a room with a stepped chaser (L12's `puncher@416,256`) may fire
 *   fineFrontierHiddenDoor  D2  the 8 px frontier is asked when it names a door the 16 px one cannot see, nearer the aim
 *   fineWandStance          D3  a wand stance the 8 px lattice reaches (the strip under the doors, past the gap)
 *
 *   l12doors-under-locks   the solver from (40,888), right under the doors (rules-4's `model-under-locks`): D1 only
 *   l12doors-arrival       the solver from step 172's arrival (168,384), the survey's staging: D1 + D2 + D3
 *
 * The staging is rules-4's (`probe-seedling-l12-bosslock.mjs` `l12Staging`: `r8-solve-11`'s block re-pointed at the
 * boot, the route's keys [0..4], items, seals and cleared flags at step 172), so the arrival witness IS the survey
 * step's plan.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-l12doors-witness.mjs           # derive both tapes, print the model's rows
 *   node scripts/procgen/plan-seedling-l12doors-witness.mjs --check   # the committed fixtures' tapes, byte for byte
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';
import { l12keylineStaging } from './plan-seedling-l12keyline-witness.mjs';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/**
 * rules-4's facts (`probe-seedling-l12-bosslock.mjs`, which imports playwright, so this headless script does not
 * import it): the boots, the locks, the goal and step 172's save. `fidelityL12Doors.test.js` pins every one of them,
 * and `l12Staging`, equal to the probe's.
 */
export const ARRIVAL = Object.freeze({ level: 12, x: 168, y: 384 });
export const UNDER_DOORS = Object.freeze({ level: 12, x: 32, y: 880 });
export const LOCK11 = Object.freeze({ id: 'bosslock@112,192', tag: 11, top: 192, bottom: 208 });
export const DOOR_LOCK = Object.freeze({ id: 'bosslock@32,864', tag: 12 });
export const DOOR_MAGIC = Object.freeze({ id: 'magicallock@32,864', tag: 7 });
export const GOAL = Object.freeze({ kind: 'reach-exit', exit: Object.freeze({ x: 32, y: 848 }) });
export const TO = 83;
export const STEP172 = Object.freeze({
    keys: [0, 1, 2, 3, 4],
    items: ['canSwim', 'hasDarkSword', 'hasFeather', 'hasFire', 'hasShield', 'hasSpear', 'hasTorch', 'hasWand'],
    seal_parts: [...Array(16).keys()],
    totem_parts: [0, 1, 2, 3, 4],
    clears: [[0, 1], [16, 0], [19, 1], [31, 0], [30, 2], [30, 0], [12, 3], [39, 8], [40, 8], [58, 1], [62, 0], [68, 0]]
        .map(([level, tag]) => Object.freeze({ level, tag })),
});

/** The survey's staging at step 172 for one boot (rules-4's `l12Staging`, pinned equal by the test). */
export async function l12Staging(boot) {
    const staging = await l12keylineStaging({ boot, keys: [], items: STEP172.items, clears: [...STEP172.clears] });
    staging.save = { ...staging.save, keys: [...STEP172.keys], seal_parts: [...STEP172.seal_parts],
        totem_parts: [...STEP172.totem_parts] };
    return staging;
}

/** The solver from one staging (the survey's `twoPassSolve`). Throws its refusal. */
export async function solveFrom(staging, goals, name) {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    return twoPassSolve({ makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals, name, boot: staging.boot, dashMode: 'all', persistence: staging.persistence, log: () => {} });
}

/** Where the game recordings live (`probe-seedling-l12doors.mjs --record`). */
export const L12DOORS_WITNESS_DIR = join(MODULE, 'fixtures', 'l12doors-witness');

/** The slice's three switches. */
export const L12DOORS_SWITCHES = Object.freeze({
    wandShotChaserBodies: true, fineFrontierHiddenDoor: true, fineWandStance: true,
});

export const L12DOORS_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'l12doors-under-locks',
        boot: Object.freeze({ ...UNDER_DOORS, x: 40, y: 888 }),
        switches: Object.freeze({ wandShotChaserBodies: true }),
        what: 'the solver from (40,888), right under the stacked doors: the Wand shot opens `magicallock@32,864` '
            + 'THROUGH the standing `bosslock@32,864`, the key line opens the bosslock, and the walk goes UP into L83',
    }),
    Object.freeze({
        name: 'l12doors-arrival',
        boot: ARRIVAL,
        switches: L12DOORS_SWITCHES,
        what: 'route step 172 from the L36 arrival (168,384): the 8 px frontier names `magicallock@32,864`, the walk '
            + 'swims the row-48 water and passes the 13 px cliffside gap to the strip under the doors, the Wand and '
            + 'the key line open them, and the walk goes UP into L83. `bosslock@112,192` ({12,11}) is never touched',
    }),
]);

/** The trace's verbs, `verb(obstacle)`. */
export const verbsOf = (solved) => (solved.out.trace?.rows ?? [])
    .map((r) => `${r.strategy?.verb ?? '?'}${r.obstacle?.id ? `(${r.obstacle.id})` : ''}`);

/** The solver's plan for one witness under its switches (`{staging, solved}`; throws the refusal). */
export async function l12doorsPlan(w, switches = w.switches) {
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const staging = await l12Staging(w.boot);
    const solved = await withContactFidelity(switches, () => solveFrom(staging, [GOAL], w.name));
    return { staging, solved };
}

/** The witness tape: the solver's own ticks, folded on the survey's staging. */
export async function l12doorsTape(w) {
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { requiredTapeVersion } = await import(join(MODULE, 'tapeFormat.js'));
    const { staging, solved } = await l12doorsPlan(w);
    const built = buildStagedTape({
        staging: { ...staging, persistence: solved.persistence,
            equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
        perTick: solved.out.perTick, name: w.name,
    });
    const tape = { ...built, description: `⛓⛓⛓ SEEDLING FIDELITY L12DOORS — ${w.what}. The survey's staging at step `
        + `172 (rules-4's \`l12Staging\`), boot L${w.boot.level} (${w.boot.x},${w.boot.y}); switches `
        + `${Object.keys(w.switches).join(', ')} ON. The solver's own plan: ${solved.out.perTick.length} t, verbs `
        + `[${verbsOf(solved).join(', ')}]. Authored by scripts/procgen/plan-seedling-l12doors-witness.mjs.` };
    return { ...tape, tape_version: requiredTapeVersion(tape, 8) };
}

/**
 * The model's side of one tape under `switches`: the observation stream (`runTape`), and from a replay of the run
 * the player's hits, the magical locks it opened and the levels it visited. `error` is a run refusal's message.
 */
export async function l12doorsModel(tapeJson, switches) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const tape = parseTape(JSON.stringify(tapeJson));
    const levelSource = atlasLevelSource();
    return withContactFidelity(switches, () => {
        let ticks = [];
        let error = null;
        try {
            ticks = runTape(tape, { levelSource }).ticks.map((o) => ({ t: o.t, level: o.level, x: o.x, y: o.y }));
        } catch (e) {
            error = String(e.message);
        }
        const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
        const levels = new Set([run.level]);
        try {
            for (let i = 0; i < tape.tick_count; i += 1) {
                run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
                levels.add(run.level);
            }
        } catch (e) {
            error ??= String(e.message);
        }
        return { ticks, error, hits: run.playerHits.length, levels: [...levels],
            magicalLocksOpened: run.magicalLocksOpened.map((l) => ({ id: l.id, tag: l.tag, hitTick: l.hitTick })) };
    });
}

/** Game ticks vs model ticks, 0 px: each mismatch as a string. */
export function compareL12DoorsStreams(game, model) {
    const bad = [];
    const byT = new Map(model.map((o) => [o.t, o]));
    for (const g of game) {
        const m = byT.get(g.t);
        if (!m) { bad.push(`t ${g.t}: no model tick`); continue; }
        if (m.level !== g.level || m.x !== g.x || m.y !== g.y) {
            bad.push(`t ${g.t}: game L${g.level} (${g.x}, ${g.y}) model L${m.level} (${m.x}, ${m.y})`);
        }
    }
    if (game.length !== model.length) bad.push(`length: game ${game.length} model ${model.length}`);
    return bad;
}

/** A recorded row `[t, level, x, y]` ↔ an observation. */
export const packL12DoorsTick = (o) => [o.t, o.level, o.x, o.y];
export const unpackL12DoorsTick = ([t, level, x, y]) => ({ t, level, x, y });

/** The committed recording of one witness (`null` if none). */
export function l12doorsFixture(name) {
    const path = join(L12DOORS_WITNESS_DIR, `${name}.json`);
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** The game-side expectation every witness carries: {12,12} and {12,7} written, {12,11} not, into L83, no hit. */
export function l12doorsGameChecks(g) {
    const has = (tag) => g.wrote.includes(`12:${tag}`);
    return [
        { name: `the game writes {12,${DOOR_LOCK.tag}} (${DOOR_LOCK.id}) and {12,${DOOR_MAGIC.tag}} (${DOOR_MAGIC.id})`,
            ok: has(DOOR_LOCK.tag) && has(DOOR_MAGIC.tag), detail: JSON.stringify(g.wrote) },
        { name: `the game never writes {12,${LOCK11.tag}} (${LOCK11.id})`, ok: !has(LOCK11.tag), detail: '' },
        { name: `the game ends in L${TO}`, ok: g.ticks.at(-1)?.level === TO, detail: `last ${JSON.stringify(g.ticks.at(-1))}` },
        { name: 'the game never hits the player', ok: (g.hits ?? 0) === 0, detail: `hits ${g.hits}` },
    ];
}

async function main() {
    const CHECK = process.argv.includes('--check');
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    for (const w of L12DOORS_WITNESSES) {
        const tape = await l12doorsTape(w);
        const m = await l12doorsModel(tape, w.switches);
        check(`${w.name}: the model (switches ON) replays the solver's ${tape.tick_count} t into L${TO}`,
            m.error === null && m.levels.includes(TO) && m.hits === 0,
            `${m.error ?? ''} levels ${m.levels.join(',')} hits ${m.hits} opened ${JSON.stringify(m.magicalLocksOpened)}`);
        if (CHECK) {
            const f = l12doorsFixture(w.name);
            const same = f !== null && JSON.stringify(f.tape) === JSON.stringify(tape);
            check(`the committed ${w.name} recording's tape is what this script derives today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-record with probe-seedling-l12doors.mjs --record');
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
