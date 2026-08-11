#!/usr/bin/env node
/**
 * solve-seedling-r8-d2 — D2 AND THE SHIELD, driven by the LIVE SOLVER from a
 * STAGED POST-SWORD BOOT. R8 slice 6, kickoff §13.10's banked recon and
 * §R6 13.8's honest route.
 *
 * ── THE ROOM THIS SCRIPT CROSSES, AND THE TWO IT REPORTS ──────────────
 *
 * The rung's boundary target is `hasShield` flipped inside a driven solver
 * segment. §R6 13.8's honest route is L18 -> L19 -> L20, and L20 is the room
 * that holds the shield:
 *
 *   L18  the KILL-LOCK. `lock@144,112` is `tset -1` and the room's two
 *        `spinner`s are its only openers, so the room needs the PRESS ARM
 *        (this slice's track A) plus a timing policy that can strike from
 *        outside a 13 px rotating hammer. REPORTED, not crossed.
 *   L19  the SHIELDSPIRE. `KILL_ARM_POLICY.ShieldBoss` is `modelled` and
 *        `shieldBossFight.js` is stepped, but the fight is a PRESS SCHEDULE
 *        derived from the boss's own window arithmetic and no executor
 *        drives one. REPORTED, not crossed.
 *   L20  THE SHIELD — and ⛔ THE THREE GATES ARE BEHIND IT, not in front:
 *        `shield@112,48` sits in the middle chamber and the L19 arrival at
 *        tile (12,4) reaches it with NO gate at all. What the gates
 *        (`shieldlocknorm` -> `buttonroom` -> `lock@32,80`) open is the way
 *        OUT to L13, which is the shortcut this room grants and not the
 *        errand it is for.
 *
 * ⇒ this script drives L20 from the east and takes the shield, which is the
 * whole of the rung's boundary claim. The exit it takes is the one it came
 * in by (`stairsdown@192,48 -> L19`), because a segment ends at a LEVEL
 * ARRIVAL (§3.5) and the westward exit is behind the three gates — which is
 * the next slice's charge, with `touch` as its first executor.
 *
 * ── WHAT IS CLAIMED, AND WHAT IS NOT ──────────────────────────────────
 *
 * ⛔ REPORTED, NEVER CREDITED. The chain kind is `staged`: a staged boot can
 * DECLARE a flag and cannot EARN one, because what it skips is the REACHING
 * (§3.6). The FLIP is still measured — `goalEarnedWitness` wants a change
 * between boot and latch, which a declaration cannot fake.
 *
 * ⚠ AND `save.rockSet` IS **NOT** WITNESSED HERE, which §13.10 lists among
 * `hasShield`'s witnesses. `Shield.removed()` sets `Moonrock.beam`; the
 * MOONROCK consumes it and writes `rockSet` (trap 124 — the durable field is
 * the other one), and the moonrock is in **L0**. A segment that never leaves
 * D2 cannot reach it, so this walk witnesses the FLIP and the `{20,2}`
 * placement clear, and `beam` is the field its own seam carries. Stated
 * rather than quietly dropped.
 *
 * Run (model-side):
 *   node scripts/procgen/solve-seedling-r8-d2.mjs
 *   node scripts/procgen/solve-seedling-r8-d2.mjs --check
 *
 * Then record (the game is the only oracle):
 *   node scripts/procgen/verify-seedling-bot-differential.mjs --win --record \
 *       --only=r8-solve-20
 */

import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
const TRACES = join(MODULE, 'fixtures', 'traces');

const CHECK = process.argv.includes('--check');

const { parseTape, requiredTapeVersion } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();

/**
 * ⛔ THE STAGED BOOT IS THE CAMPAIGN'S OWN LATCH, READ OFF DISK.
 *
 * `r7-act2-11` is the last committed segment of chain `act2-the-sword`, so
 * its v8 boot block IS the post-sword campaign state: `hasSword` true,
 * everything else false, the chain's four banked clears, empty save arrays.
 * Booting a state invented beside the campaign would be a claim about a
 * different game (§13.10's own instruction: derive it from the latch).
 *
 * ⚠ WHAT IS **NOT** DECLARED, and the omission is deliberate: nothing about
 * D2. No `{19,0}` (the Shieldspire kill), no `save.keys` entry, no `{18,…}`.
 * The honest route would arrive here holding all three, and none of them is
 * a precondition for anything this walk does — declaring them would be
 * staging the two rooms this slice did not cross.
 */
const LATCH = parseTape(JSON.parse(
    readFileSync(join(TAPES, 'r7-act2-11.json'), 'utf8')));

/**
 * L20's own arrival from L19 — `stairsup@16,96 {to: 20, playerx: 192,
 * playery: 64}`, read from the atlas rather than typed, because a boot block
 * is `new Game(level, x, y)`'s ARGUMENTS and a tile centre typed by hand
 * spawns a whole tile away (R6 slice 0's own lesson).
 */
const L19 = levelSource(19);
const STAIRS = (L19.entities ?? []).find(
    (e) => e.type === 'stairsup' && Number(e.attrs.to) === 20);
if (!STAIRS) throw new Error('solve-seedling-r8-d2: L19 has no stairsup to L20');
const BOOT = Object.freeze({
    level: 20,
    x: Number(STAIRS.attrs.playerx),
    y: Number(STAIRS.attrs.playery),
});

/**
 * The goals: the macro layer names WHAT, and these two are the room's whole
 * errand. The placement is the atlas's own `shield@112,48`; the exit is the
 * stairs this arrival came in by.
 */
const L20 = levelSource(20);
const SHIELD = (L20.entities ?? []).find((e) => e.type === 'shield');
const EXIT = (L20.entities ?? []).find(
    (e) => e.type === 'stairsdown' && Number(e.attrs.to) === 19);
if (!SHIELD || !EXIT) throw new Error('solve-seedling-r8-d2: L20 has no shield or no exit to L19');

const GOALS = [
    { kind: 'collect-placement', placement: { x: SHIELD.x, y: SHIELD.y } },
    { kind: 'reach-exit', exit: { x: EXIT.x, y: EXIT.y } },
];

console.log(`## r8-solve-20 — boot L${BOOT.level} (${BOOT.x},${BOOT.y}), goals `
    + `${GOALS.map((g) => g.kind).join(' then ')}`);

const run = createLevelRun({
    levelSource,
    boot: BOOT,
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    persistence: LATCH.persistence,
    despawn: [],
    equips: LATCH.equips,
    pins: LATCH.pins ?? [],
    save: LATCH.save ?? null,
    rng: LATCH.rng ?? null,
    seam: LATCH.seam ?? null,
    // ⛔ THE REPLAY'S OWN CENSUS, BY NAME (trap 158) — the world the solver
    // senses and the world `tapeRunner` replays must be ONE world.
    roles: ROLES,
});

const heldBefore = run.inventory.hasShield;
check('hasShield is NOT held at the boot (a flip needs somewhere to flip from)',
    heldBefore === false, `hasShield ${heldBefore}`);
check('hasSword IS held at the boot (the campaign\'s own latch)',
    run.inventory.hasSword === true);

const out = solveSegment({ run, goals: GOALS, name: 'r8-solve-20', boot: BOOT });

const hits = run.playerHits.length;
const deaths = run.playerDeaths.length;
check('r8-solve-20: ZERO hits and ZERO deaths (the standing zero-hit policy)',
    hits === 0 && deaths === 0, `hits ${hits}, deaths ${deaths}`);

// ── THE HEADLINE, MEASURED FROM THE RUN'S OWN READOUTS ────────────────
check('⛓ `hasShield` flips NOT-HELD -> HELD inside the driven segment',
    heldBefore === false && run.inventory.hasShield === true,
    `${heldBefore} -> ${run.inventory.hasShield}`);
const clears = run.earnedClears ?? [];
check('⛓ the `{20,2}` placement clear is EARNED by the pickup itself',
    clears.some((c) => c.level === 20 && c.tag === 2),
    JSON.stringify(clears));
/**
 * ⚠ `beam` IS THE FIELD THIS SEGMENT CAN WITNESS, and `rockSet` is not.
 * `Shield.removed()` sets `Main.beam`; the moonrock in L0 consumes it and
 * writes `rockSet` (trap 124). A D2 walk never reaches L0.
 */
check('⚠ `rockSet` is NOT claimed — the moonrock that writes it is in L0',
    (run.saveArrays?.rock_set ?? false) === false);

const t = run.transitions[run.transitions.length - 1];
check('the segment ends at a LEVEL ARRIVAL (§3.5)', Boolean(t) && t.to_level === 19,
    JSON.stringify(run.transitions));
check('the arrival is CALM (v = 0 at the latch)',
    run.state.vx === 0 && run.state.vy === 0,
    `v=(${run.state.vx},${run.state.vy})`);

// ── emit ──────────────────────────────────────────────────────────────
const folded = buildTape(out.perTick, BOOT, 'r8-solve-20',
    { noclip: false, noDamage: false, noHazards: [], grants: [] });
const tape = {
    game: 'seedling',
    name: 'r8-solve-20',
    boot: BOOT,
    noclip: false,
    noDamage: false,
    noHazards: [],
    grants: [],
    persistence: LATCH.persistence,
    equips: LATCH.equips,
    pins: LATCH.pins,
    save: LATCH.save,
    rng: LATCH.rng,
    seam: LATCH.seam,
    tick_count: out.perTick.length,
    inputs: folded.inputs,
    tape_version: 8,
};

const description = '⛓⛓⛓ R8 SLICE 6 — THE RUNG\'S BOUNDARY TARGET. The LIVE SOLVER '
    + 'crosses L20 from the L19 arrival and takes the shield: `hasShield` flips '
    + 'NOT-HELD -> HELD inside a DRIVEN SOLVER SEGMENT, with the `{20,2}` placement '
    + 'clear earned by the pickup itself. Boot: r7-act2-11\'s committed v8 block — the '
    + 'campaign\'s own post-sword latch — at L20\'s own arrival from L19 '
    + `(stairsup@16,96 -> ${BOOT.x},${BOOT.y}), staged per kickoff §3.5. GOALS: the `
    + 'placement and the exit ONLY; the stance, the corridor and the ceremony are the '
    + 'solver\'s. ⛔ REPORTED, NEVER CREDITED — the chain kind is `staged` and a staged '
    + 'boot skips the REACHING (§3.6). ⚠ `save.rockSet` is NOT witnessed here: '
    + '`Shield.removed()` sets `Moonrock.beam` and the MOONROCK writes `rockSet` (trap '
    + '124), and the moonrock is in L0. ⛔ The three gates (`shieldlocknorm` -> '
    + '`buttonroom` -> `lock@32,80`) are BEHIND the shield and open the way OUT to L13, '
    + `which is not this errand. Solver: ${out.perTick.length} ticks, `
    + `${out.trace.rows.length} decision(s), ${out.replans} re-plan(s); there is NO hand `
    + 'answer for this room — it is the first NEW room the solver crosses, so the '
    + 'differential is the entire gate. Authored by '
    + 'scripts/procgen/solve-seedling-r8-d2.mjs; trace sidecar in fixtures/traces/.';

function tapeJson(obj) {
    const parsed = parseTape(obj);
    return `${JSON.stringify({
        tape_version: requiredTapeVersion(parsed),
        game: 'seedling',
        name: obj.name,
        description,
        boot: parsed.boot,
        noclip: parsed.noclip,
        noDamage: parsed.noDamage,
        noHazards: parsed.noHazards,
        grants: parsed.grants,
        persistence: parsed.persistence,
        equips: parsed.equips,
        pins: parsed.pins,
        save: parsed.save,
        rng: parsed.rng,
        seam: parsed.seam,
        tick_count: parsed.tick_count,
        inputs: parsed.inputs,
    }, null, 4)}\n`;
}

function emit(path, json, what) {
    if (CHECK) {
        const have = existsSync(path) ? readFileSync(path, 'utf8') : null;
        check(`${what} is byte-identical to what this solver derives`, have === json,
            have === null ? 'the file does not exist'
                : have === json ? `${json.length} bytes`
                    : '⛔ DRIFT — the committed artifact is not what the solver produces today');
        return;
    }
    writeFileSync(path, json);
    console.log(`  wrote ${path} (${json.length} bytes)`);
}

mkdirSync(TRACES, { recursive: true });
emit(join(TAPES, 'r8-solve-20.json'), tapeJson(tape), 'r8-solve-20');
emit(join(TRACES, 'r8-solve-20.trace.json'),
    `${JSON.stringify(out.trace, null, 4)}\n`, 'r8-solve-20 trace');

console.log(`\n## r8-solve-20: ${out.perTick.length} ticks, ${hits} hit(s), `
    + `${deaths} death(s); hasShield ${heldBefore} -> ${run.inventory.hasShield}; `
    + `earnedClears ${JSON.stringify(clears)}`);
console.log('## there is NO hand answer for L20 — the differential is the entire gate.');

if (CHECK) console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks green');
process.exit(failures ? 1 : 0);
