#!/usr/bin/env node
/**
 * plan-seedling-encounters — ⛓⛓ seedling-fidelity-encounters: THE ENCOUNTER WITNESSES FROM NON-SURVEY ARRIVALS.
 *
 * The survey solves L32's Bob Boss from ONE staging (the rock unarmed, the player on the L30 door). These tapes are
 * the same encounter GOAL solved by `solveSegment` from arrivals the survey never stages, recorded on the GAME
 * (`check-seedling-bot-differential --record --only=<name>`), and the model must agree per tick.
 *
 *   enc-l32-fallen-door   `swim-u5-bobboss-encounter`'s staging with the rock's flag {32,1} CLEARED — the live state
 *                         after a death mid-fight — entered through the L30 door. The rock is built FALLEN on the
 *                         door's stairs, so the arrival (80,128) is INSIDE it: `FallRockLarge.update` snaps the player
 *                         onto its top on the first frame and re-adds the boss (form 0) at once (`cameraTimer == 0`).
 *                         No arm leg; seven landings, the Fire, the burn, the pit to L30.
 *   enc-l32-fire-return   the same, with the Fire HELD and the tree {32,0} burned — the return visit after the
 *                         encounter. `BobBoss`'s ctor removes itself (`Player.hasFire`); the snap, then the walk to
 *                         the burned pit and the fall to L30.
 *   enc-l12-witch         L12's Witch, holding the wand (D3, `witch.js`): the talk, the three pages, the `DarkSword`
 *                         spawned at the player's feet, its ceremony, `hasDarkSword`.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-encounters.mjs            # write the tapes
 *   node scripts/procgen/plan-seedling-encounters.mjs --check    # exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REPO = join(HERE, '..', '..');
    const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
    const TAPES = join(MODULE, 'fixtures', 'tapes');
    const CHECK = process.argv.includes('--check');

    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
    const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const levelSource = atlasLevelSource();
    const U5 = JSON.parse(readFileSync(join(TAPES, 'swim-u5-bobboss-encounter.json'), 'utf8'));

    /** A tape whose header is `base`'s with `over` applied, carrying `perTick` and `equips`. */
    function tapeJson(name, base, over, perTick, equips, description) {
        const header = { ...base, ...over };
        const folded = buildTape(perTick, header.boot, name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const tape = {
            game: 'seedling', name, boot: header.boot, noclip: false, noDamage: false, noHazards: [], grants: [],
            persistence: header.persistence, equips, pins: header.pins, save: header.save, rng: header.rng,
            seam: header.seam, tick_count: perTick.length, inputs: folded.inputs, tape_version: 8,
        };
        const parsed = parseTape({ ...tape, description });
        return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
    }
    function emit(name, json) {
        const path = join(TAPES, `${name}.json`);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === json;
            check(`⛓ the committed ${name} is what this script produces today`, same,
                same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, json);
            console.log(`wrote ${path.slice(REPO.length + 1)}`);
        }
    }
    /** Solve `goals` from `header`'s staging; the run, the keys and the equips. */
    function solve(name, header, goals) {
        const staging = solveStaging(stagingFromTape(parseTape({ ...header, name, tick_count: 0, inputs: [] })));
        const run = createRunForStaging(staging, levelSource);
        const out = solveSegment({ run, goals, name, boot: staging.boot });
        return { run, out };
    }
    const persistence = (extra) => [...U5.persistence, ...extra.map(([level, tag]) => ({ level, tag, note: '' }))];
    const L32_GOAL = Object.freeze({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });

    // ── enc-l32-fallen-door ──────────────────────────────────────────────
    {
        const NAME = 'enc-l32-fallen-door';
        const over = { persistence: persistence([[32, 1]]) };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        const snap = ev.find((r) => r.what === 'rock-snap');
        check('⛓⛓ the door arrival is INSIDE the fallen rock and is snapped onto its top on the first frame',
            snap?.t === 0 && snap.from === 128 && snap.to === 125, JSON.stringify(snap));
        check('⛓ the boss is re-added at build (`rock-fallen-at-build`), with no arm leg',
            ev.some((r) => r.what === 'rock-fallen-at-build' && r.boss === true)
            && !out.records.some((r) => r.leg === 'arm'), out.records.map((r) => r.leg ?? r.goal).join(','));
        check('⛓ seven landings, three kills, untouched, then the pit to L30',
            ev.filter((r) => r.what === 'boss-hit' && r.landed).length === 7 && run.level === 30
            && run.ledger('playerHits').length === 0, `level ${run.level}, ${out.perTick.length} t`);
        const description = '⛓⛓ seedling-fidelity-encounters D2 — L32\'s encounter from a ROCK-FALLEN arrival. '
            + '`swim-u5-bobboss-encounter`\'s staging with {32,1} cleared (the state after a death mid-fight), entered '
            + 'through the L30 door: the rock is built fallen on the door\'s stairs, the arrival (80,128) is inside it, '
            + '`FallRockLarge.update` snaps the player to y 125 and re-adds the boss at once (`cameraTimer == 0`). '
            + `Solved by \`solveSegment\` (the encounter goal, no arm leg): ${out.perTick.length} ticks, seven landings, `
            + 'the Fire, the burn, the pit to L30. Authored by scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, U5, over, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks, equips ${JSON.stringify(out.equips)}`);
    }

    // ── enc-l32-fire-return ──────────────────────────────────────────────
    {
        const NAME = 'enc-l32-fire-return';
        const over = {
            persistence: persistence([[32, 0], [32, 1]]),
            seam: { ...U5.seam, items: { ...U5.seam.items, hasFire: true } },
        };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        check('⛓ the Fire held: the ctor removes the boss (no `boss-added`), the drop record says `already`',
            ev.some((r) => r.what === 'rock-fallen-at-build' && r.boss === false)
            && !ev.some((r) => r.what === 'boss-added')
            && out.records.some((r) => r.leg === 'drop' && r.already === true), JSON.stringify(ev.slice(0, 3)));
        check('⛓ the snap, then the burned pit to L30', ev.some((r) => r.what === 'rock-snap') && run.level === 30,
            `level ${run.level}, ${out.perTick.length} t`);
        const description = '⛓⛓ seedling-fidelity-encounters D2 — L32 on the RETURN visit: the Fire held, the rock '
            + '{32,1} fallen and the tree {32,0} burned. The door arrival is snapped onto the rock; `BobBoss`\'s ctor '
            + 'removes itself (`Player.hasFire`), so the encounter goal has no fight and no drop to collect '
            + `(\`already\`); the walk takes the burned pit to L30 in ${out.perTick.length} ticks. Authored by `
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, U5, over, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks`);
    }

    if (failures > 0) {
        console.error(`plan-seedling-encounters: ${failures} check(s) FAILED`);
        process.exit(1);
    }
}
