#!/usr/bin/env node
/**
 * plan-seedling-sealdoor-witness — ⛓⛓⛓ SEEDLING FIDELITY SEALDOOR: THE FINAL
 * DOOR IS OPENED BY THE SOLVER'S `approach` VERB, AND STAYS SHUT WHEN THE RUN
 * DOES NOT HOLD ITS PREDICATES.
 *
 * Sweep 38926058850 failed nine L113 legs (804-806, 811-813, 818-820) on
 * `finaldoor@112,0`: the exits refused *"no corridor … ITEM-GATE"* and the
 * location's clear-tag *"no-verb: no strategy row exists for solid:finaldoor"*.
 * The RUN has stepped the door since R6 slice 6c (`r6-final-door` and its
 * unspoken-Watcher control, game-recorded); the solver had no verb.
 * `CONTACT_FIDELITY.sealDoorApproach` (ON by default since 2026-10-17) adds one, and these tapes
 * are its plans, solved with the switch ON from the staging the R6 witness was
 * recorded under (`r6-final-door`'s block — sixteen seal identities, `{114,0}`
 * declared cleared), re-pointed at the sweep's arrivals:
 *
 *   sealdoor-l113-clear           sweep leg 806's goal (`L113 flag 0`, the
 *                                 clear-tag {113,0}) from the L112 arrival
 *                                 (64,128): the walk to the stance, the hold
 *                                 into the 32 px circle (the SealController's
 *                                 181 dead frames), "open" on the next tick, the
 *                                 release, and the wait until the wall goes.
 *   sealdoor-l113-exit            sweep leg 811's goal (`out_teleporter_112_0`,
 *                                 to L115) from the L114 arrival (16,16): the
 *                                 same verb, then the walk through the doorway
 *                                 onto the teleporter (canSwim held: L115's
 *                                 arrival tiles are water).
 *   sealdoor-l113-noseal-control  THE SWEEP'S OWN STATE: `sealdoor-l113-clear`'s
 *                                 inputs with `save.seal_parts` EMPTY (an AP
 *                                 `Seal` writes no slot — `flashBridgeAdapter`'s
 *                                 `!seal` is neither progressive nor a fusion).
 *                                 The ceremony fires on the same tick and costs
 *                                 the same dead frames; the door never opens,
 *                                 `{113,0}` stays set. The solver ON refuses it by
 *                                 name before a tick is spent.
 *
 * `--check` re-derives every tape and compares it to the committed one byte for
 * byte, and asserts the model's door events on each.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-sealdoor-witness.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-sealdoor-witness.mjs --check    # exit 1 on drift
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

/** The game-recorded block every witness boots from (R6 slice 6c's W-DOOR). */
export const SEALDOOR_BASE = 'r6-final-door';
export const FINAL_DOOR_ID = 'finaldoor@112,0';

export const SEALDOOR_WITNESSES = Object.freeze([
    Object.freeze({
        name: 'sealdoor-l113-clear',
        leg: 806,
        boot: { level: 113, x: 64, y: 128 },
        goal: { kind: 'clear-tag', tag: { level: 113, tag: 0 }, at: { x: 112, y: 0 }, obstacle: FINAL_DOOR_ID },
        items: [],
        opens: true,
        to: 113,
        what: 'sweep leg 806\'s goal (`L113 flag 0: finaldoor@112,0 cleared`, the clear-tag {113,0}) from the L112 '
            + 'arrival (64,128): the solver walks to its stance, holds toward the door\'s entity point (128,16) into '
            + 'the 32 px circle — the SealController\'s 181 DEAD frames on the trigger tick — "open" plays on the next '
            + 'tick, the hold is released, and the run waits out the 56-tick animation and the one-tick `updateLists` '
            + 'fencepost until the wall is gone and `{113,0}` is written',
    }),
    Object.freeze({
        name: 'sealdoor-l113-exit',
        leg: 811,
        boot: { level: 113, x: 16, y: 16 },
        goal: { kind: 'reach-exit', exit: { x: 112, y: 0 } },
        items: ['canSwim'],
        opens: true,
        to: 115,
        what: 'sweep leg 811\'s goal (`out_teleporter_112_0`, to L115) from the L114 arrival (16,16): the same '
            + '`approach`, then the walk through the open doorway onto `teleporter@112,0` (canSwim held: L115\'s '
            + 'arrival tiles are water)',
    }),
    Object.freeze({
        name: 'sealdoor-l113-noseal-control',
        leg: 806,
        boot: { level: 113, x: 64, y: 128 },
        inputsOf: 'sealdoor-l113-clear',
        sealParts: [],
        items: [],
        opens: false,
        to: 113,
        what: 'THE SWEEP\'S OWN STATE: `sealdoor-l113-clear`\'s inputs with `save.seal_parts` EMPTY — what the '
            + 'divergence sweep stages, because an AP `Seal` writes no slot. The ceremony fires on the same tick at '
            + 'the same dead-frame cost (it is unconditional), and the door never plays "open": '
            + '`SealController.hasAllSealParts()` is `Main.hasSealPart(SEALS - 1) != -1`. `{113,0}` stays SET and '
            + 'the walk stands against the 32x32 body',
    }),
]);

/** One witness's staging: `r6-final-door`'s block re-pointed at the arrival (seam items added; seals overridable). */
export async function sealdoorStaging(w) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const base = parseTape(readFileSync(join(TAPES, `${SEALDOOR_BASE}.json`), 'utf8'));
    const staging = solveStaging(stagingFromTape(base));
    staging.boot = { ...w.boot };
    if (w.sealParts) staging.save = { ...staging.save, seal_parts: [...w.sealParts] };
    if (w.items.length) {
        staging.seam = { ...(staging.seam ?? {}),
            items: { ...(staging.seam?.items ?? {}), ...Object.fromEntries(w.items.map((p) => [p, true])) } };
    }
    return staging;
}

/** The solver's plan for one witness (`sealDoorApproach` ON), or another witness's inputs (the control). */
export async function sealdoorPlan(w, byName) {
    const staging = await sealdoorStaging(w);
    if (w.inputsOf) {
        const src = byName.get(w.inputsOf);
        return { staging, perTick: src.perTick, equips: src.equips, records: [] };
    }
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { withContactFidelity } = await import(join(MODULE, 'contactFidelity.js'));
    const levelSource = atlasLevelSource();
    const out = withContactFidelity({ sealDoorApproach: true }, () => solveSegment({
        run: createRunForStaging(staging, levelSource), goals: [w.goal], name: w.name, boot: staging.boot,
    }));
    return { staging, perTick: out.perTick, equips: out.equips ?? [], records: out.records };
}

/** Replay a tape into a fresh run and read the door's three readouts. */
export async function doorReadout(tape, levelSource) {
    const { createRunForStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const run = createRunForStaging(stagingFromTape(tape), levelSource);
    for (let i = 0; i < tape.tick_count && run.level === tape.boot.level; i += 1) {
        run.advance(new Set(tape.inputs.filter((sp) => sp.from <= i && i < sp.to).map((sp) => sp.key)));
    }
    return { ceremonies: run.doorCeremonies, events: run.doorEvents, clears: run.earnedClears, level: run.level };
}

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    // ⛓ planning-9's flip: the switch ships ON (each plan still turns it on for its own solve, so the plans are unmoved).
    check('the switch ships ON (each plan turns it on for its own solve)', CONTACT_FIDELITY.sealDoorApproach === true);
    const levelSource = atlasLevelSource();
    const byName = new Map();
    for (const w of SEALDOOR_WITNESSES) {
        const plan = await sealdoorPlan(w, byName);
        byName.set(w.name, plan);
        const built = buildStagedTape({
            staging: { ...plan.staging, equips: [...(plan.staging.equips ?? []), ...(plan.equips ?? [])] },
            perTick: plan.perTick,
            name: w.name,
        });
        const description = `⛓⛓⛓ SEEDLING FIDELITY SEALDOOR — ${w.what}. Staged from \`${SEALDOOR_BASE}\`'s `
            + `game-recorded block re-pointed at (${w.boot.x},${w.boot.y})`
            + `${w.sealParts ? `, save.seal_parts ${JSON.stringify(w.sealParts)}` : ''}`
            + `${w.items.length ? `, items [${w.items.join(', ')}]` : ''}. `
            + `${w.inputsOf ? `\`${w.inputsOf}\`'s keys` : "The solver's own plan (`sealDoorApproach` ON)"}: `
            + `${plan.perTick.length} t. Authored by scripts/procgen/plan-seedling-sealdoor-witness.mjs.`;
        const tape = parseTape({ ...built, description });
        const out = runTape(tape, { levelSource });
        const last = out.ticks.at(-1);
        check(`${w.name}: the model replays it into L${w.to}`, last?.level === w.to,
            `${out.ticks.length} observations, ends ${JSON.stringify({ level: last?.level, x: last?.x, y: last?.y })}`);
        const r = await doorReadout(tape, levelSource);
        const open = r.events.find((e) => e.what === 'open');
        const removed = r.events.find((e) => e.what === 'removed');
        check(`${w.name}: ONE ceremony, 181 dead frames`, r.ceremonies.length === 1 && r.ceremonies[0].frames === 181,
            JSON.stringify(r.ceremonies.map((c) => [c.t, c.frames])));
        if (w.opens) {
            check(`${w.name}: "open" on the tick after the ceremony, removed 56 later, wall one after that`,
                Boolean(open && removed) && open.t === r.ceremonies[0].t + 1 && removed.t - open.t === 56
                && removed.wallOpensAt === removed.t + 1,
                JSON.stringify(r.events));
            check(`${w.name}: the run earns {113,0}`, r.clears.some((c) => c.level === 113 && c.tag === 0),
                JSON.stringify(r.clears.map((c) => [c.level, c.tag, c.by])));
            const rec = plan.records.find((x) => x.verb === 'approach');
            check(`${w.name}: the plan's verb is \`approach\``, Boolean(rec), JSON.stringify(rec ?? plan.records).slice(0, 300));
        } else {
            check(`${w.name}: the door never opens, nothing is cleared`, r.events.length === 0 && r.clears.length === 0,
                JSON.stringify({ events: r.events, clears: r.clears }));
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
