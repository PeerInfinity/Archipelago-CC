#!/usr/bin/env node
/**
 * plan-seedling-proximity-witness — ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY: THE GAME
 * WITNESSES FOR THE PROXIMITY-HAZARD ROWS.
 *
 * Authors (and with `--check` re-derives, byte for byte) the committed tapes the
 * slice records on the GAME and the model then reproduces:
 *
 *   prox-l38-chest           route step 68  — L38's chest behind the five-link
 *                            chain: `hold` on `buttonroom@144,128` (the new
 *                            `proximity-hazard:buttonroom` row), the covered chest
 *                            resolved to its cover, `pulse` (press
 *                            `buttonroom@208,224`, the pulser parks the fire block on
 *                            `button@80,192`), then the chest and the north door
 *   prox-l38-reach-l39       route step 103 — the same room reached for its north
 *                            door, the chest raised by the FRONTIER
 *   prox-l29-key-return      route step 57  — L29's trap button skirted OUT and BACK:
 *                            the return stance two tiles up (the fallrock's own row
 *                            has no wall to align against) and the x grid kept
 *                            between the crossings
 *   prox-l40-turret-volley   hand keys: L40 inside `iceturret@472,400`'s range — the
 *                            turret's volleys freeze the walk and do not wall it
 *   prox-l40-turret-contact  hand keys: L40, walking INTO the live turret's body —
 *                            `Enemy.hitPlayer`'s contact, now billed by the run
 *
 * The staging is the survey's (`r8-solve-11`'s committed block re-pointed at the
 * atlas arrival, the route's keys and items), so a solver witness IS the survey
 * step's plan.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-proximity-witness.mjs           # write the tapes
 *   node scripts/procgen/plan-seedling-proximity-witness.mjs --check   # re-derive; exit 1 on drift
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
export const PROXIMITY_BASE = 'r8-solve-11';

/** L40's ice turret: the placement, the entity point (`IceTurret.as:32`'s whole tile). */
export const L40_TURRET = Object.freeze({ level: 40, id: 'iceturret@472,400', ex: 488, ey: 416 });

const L38_ITEMS = Object.freeze(['hasFire', 'hasShield', 'hasTorch']);
const L40_ITEMS = Object.freeze(['canSwim', 'hasFire', 'hasShield', 'hasTorch']);

/** The witnesses: the survey step, its boot, its grant, its goals (or hand keys), the check. */
export const PROXIMITY_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'prox-l38-chest',
        step: 68,
        boot: { level: 38, x: 144, y: 288 },
        keys: [0, 1],
        items: L38_ITEMS,
        goals: [{ kind: 'collect-placement', placement: { x: 144, y: 112 } },
            { kind: 'reach-exit', exit: { x: 144, y: 0 } }],
        to: 39,
        check: 'l38-chain',
        what: 'route step 68 (L38 → L39): from the L37 arrival the solver presses '
            + '`buttonroom@144,128` (a `room = -1` ButtonRoom: the latch opens `cover@208,224`), '
            + 'resolves the chest under the SHUT `cover@144,112` to that cover, presses the pulser\'s '
            + '`buttonroom@208,224`, waits while `pulser@80,224` parks `pushableblockfire@80,208` on '
            + '`button@80,192` (which opens the cover), opens and collects `chest@144,112`, and leaves '
            + 'by `teleporter@144,0`',
    }),
    Object.freeze({
        name: 'prox-l38-reach-l39',
        step: 103,
        boot: { level: 38, x: 144, y: 288 },
        keys: [0, 1, 2, 3],
        items: ['canSwim', ...L38_ITEMS],
        goals: [{ kind: 'reach-exit', exit: { x: 144, y: 0 } }],
        to: 39,
        check: 'l38-chain',
        what: 'route step 103 (L38 → L39): the same chain raised by the FRONTIER — the north '
            + 'door is behind `chest@144,112`, the chest behind its cover, the cover behind the '
            + 'pulse',
    }),
    Object.freeze({
        name: 'prox-l29-key-return',
        step: 57,
        boot: { level: 29, x: 16, y: 224 },
        keys: [0],
        items: ['hasShield'],
        goals: [{ kind: 'collect-placement', placement: { x: 112, y: 64 } },
            { kind: 'reach-exit', exit: { x: 0, y: 224 } }],
        to: 22,
        check: 'skirt-twice',
        what: 'route step 57 (L29 → L22): the solver skirts the trap `button@112,128` NORTH on '
            + 'its east lane (x 126), keeps the walk on the 0.05 grid while the crossing back is '
            + 'owed, collects the Boss Key, skirts SOUTH from a stance two tiles up (row 6, '
            + 'flanked by the dungeon spires — the fallrock\'s own row 7 has no wall to align '
            + 'against), and leaves by `teleporter@0,224`; `fallrock@112,112` never falls',
    }),
    Object.freeze({
        name: 'prox-l40-turret-volley',
        step: null,
        boot: { level: 40, x: 480, y: 456 },
        keys: [0, 1, 2, 3],
        // ⚠ NO SHIELD: `IceTurretBlast.hitables` carries "Shield", so a player
        // facing the turret with it blocks the blasts (measured: the route's
        // inventory drew two volleys and no freeze). The freeze is the claim here.
        items: ['canSwim', 'hasFire', 'hasTorch'],
        // Hand-authored, not planned: south down the turret's own corridor,
        // in its line of fire, then rest. [key, ticks]
        inputs: [['down', 48], [null, 72]],
        to: 40,
        check: 'volley',
        what: 'THE RANGE IS A VOLLEY, NOT A WALL: boots (entity (488,464)) in the corridor 48 px '
            + 'south of `iceturret@472,400`\'s entity point (inside its 129 px range, clear of its '
            + 'body), walks `down` the corridor in its line of fire and rests. The turret aims and '
            + 'fires; a blast that lands freezes the player for 15 ticks and costs one hit, and '
            + 'nothing stops the walk. (No shield: with it, facing the turret blocks the blasts)',
    }),
    Object.freeze({
        name: 'prox-l40-turret-contact',
        step: null,
        boot: { level: 40, x: 488, y: 376 },
        keys: [0, 1, 2, 3],
        items: L40_ITEMS,
        inputs: [['down', 24], [null, 24]],
        to: 40,
        check: 'contact',
        what: 'THE LIVE BODY\'S CONTACT: boots (entity (496,384)) in the corridor 32 px above `iceturret@472,400`\'s '
            + 'entity point and walks `down` into its 32x32 body. An alive turret is "Enemy", not a '
            + 'solid: the walk enters it and `Enemy.hitPlayer` bills a hit (force 3, damage 1, '
            + 'behind `hitsTimer`) — the contact the run used to REFUSE and now prices',
    }),
]);

/** The survey's staging for one witness (`survey-seedling-route.mjs`'s `solveOneStep`). */
export async function proximityStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${PROXIMITY_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    const save = staging.save ?? { totem_parts: [], keys: [], seal_parts: [] };
    staging.save = { ...save, keys: [...new Set([...(save.keys ?? []), ...w.keys])].sort((x, y) => x - y) };
    staging.seam = { ...staging.seam,
        items: { ...staging.seam.items, ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return staging;
}

/** The solver's plan for one witness, from that staging (or the hand-authored keys). */
export async function proximityPlan(w) {
    const staging = await proximityStaging(w);
    if (w.inputs) {
        const perTick = w.inputs.flatMap(([key, n]) =>
            Array.from({ length: n }, () => new Set(key ? [key] : [])));
        return { staging, solved: { persistence: staging.persistence, out: { perTick, equips: [], records: [] } } };
    }
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const levelSource = atlasLevelSource();
    const solved = await twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: w.goals, name: w.name, boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
    return { staging, solved };
}

/** The run, advanced through a tape's own keys. */
async function replayRun(tape, levelSource) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const run = createRunForStaging({ ...tape, equips: tape.equips ?? [] }, levelSource);
    for (let i = 0; i < tape.tick_count; i += 1) {
        run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
    }
    return run;
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
    const { rectsOverlap } = await import(join(MODULE, 'levelWorld.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    for (const w of PROXIMITY_WITNESSES) {
        const { staging, solved } = await proximityPlan(w);
        const built = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence,
                equips: [...(staging.equips ?? []), ...(solved.out.equips ?? [])] },
            perTick: solved.out.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — ${w.what}. The survey's staging `
            + `(\`${PROXIMITY_BASE}\`'s committed block re-pointed at L${w.boot.level} `
            + `(${w.boot.x},${w.boot.y}), keys [${w.keys.join(', ')}], items [${w.items.join(', ')}]). `
            + `${w.inputs ? 'Hand-authored keys' : "The solver's own plan"}: `
            + `${solved.out.perTick.length} t, equips ${JSON.stringify(solved.out.equips)}. `
            + 'Authored by scripts/procgen/plan-seedling-proximity-witness.mjs.';
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it ${w.to === w.boot.level ? 'inside' : 'into'} L${w.to}`,
            last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const verbs = (solved.out.records ?? []).map((r) => r.strategy).filter(Boolean);
        const run = await replayRun(tape, levelSource);
        if (w.check === 'l38-chain') {
            // The goal path presses `buttonroom@144,128` as `pulse`'s UNCOVER stage
            // (step 68); the frontier path raises it as a `hold` first (step 103).
            check(`${w.name}: the plan PULSES and opens the chest`,
                verbs.includes('pulse') && verbs.includes('chest'), JSON.stringify(verbs));
            check(`${w.name}: the pulse moved pushableblockfire@80,208 once`,
                run.ledger('pulserPushes').filter((p) => p.block === 'pushableblockfire@80,208').length === 1,
                JSON.stringify(run.ledger('pulserPushes')));
            check(`${w.name}: chest@144,112 opened`, run.ledger('chestOpens').some((c) => c.id === 'chest@144,112'),
                JSON.stringify(run.ledger('chestOpens').map((c) => [c.id, c.t])));
        } else if (w.check === 'skirt-twice') {
            const skirts = (solved.out.records ?? []).filter((r) => r.strategy === 'skirt');
            check(`${w.name}: the plan skirts the button twice, never pressing it`,
                skirts.length === 2 && skirts.every((r) => r.rocksStanding?.length === 1),
                JSON.stringify(skirts.map((r) => [r.lane, r.x, r.ticks])));
            check(`${w.name}: fallrock@112,112 never fell`,
                !(run.liveGeometryOpts().fallenRocks?.size > 0), 'fallenRocks empty');
        } else if (w.check === 'volley') {
            const freezes = run.ledger('blastFreezes');
            check(`${w.name}: the turret's blasts froze the walk at least once`, freezes.length > 0,
                JSON.stringify(freezes.slice(0, 4)));
            const [walk] = w.inputs;
            const window = out.ticks.slice(1, walk[1] + 1);
            const moved = window.filter((o) => o.y > out.ticks[o.t - 1].y).length;
            check(`${w.name}: the walk was never walled — it moved south on the held ticks it was not frozen`,
                moved > 0 && last.y > w.boot.y + 8, `${moved}/${window.length} held tick(s) moved; `
                + `${w.boot.y + 8} -> ${last.y}`);
            const inRange = out.ticks.filter((o) => Math.hypot(o.x - L40_TURRET.ex, o.y - L40_TURRET.ey) < 129);
            check(`${w.name}: the walk stands inside the 129 px range`, inRange.length === out.ticks.length,
                `${inRange.length}/${out.ticks.length} observation(s)`);
        } else if (w.check === 'contact') {
            const hits = run.ledger('playerHits').filter((h) => h.source === 'iceturret');
            check(`${w.name}: the run billed the live turret's contact`, hits.length > 0,
                JSON.stringify(run.ledger('playerHits').slice(0, 4)));
            const body = { x: 472, y: 400, w: 32, h: 32, right: 504, bottom: 432 };
            const inBody = out.ticks.filter((o) => rectsOverlap(playerBoxAt(o.x, o.y), body)).length;
            check(`${w.name}: the walk entered the 32x32 body`, inBody > 0, `${inBody} observation(s)`);
        }
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
