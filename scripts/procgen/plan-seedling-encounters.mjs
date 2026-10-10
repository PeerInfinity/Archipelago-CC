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

    // ── enc-l12-witch ────────────────────────────────────────────────────
    {
        const NAME = 'enc-l12-witch';
        // The survey's step-140 arrival (`in_L95_624_64` → L12 at (16,352)), holding the sword and the wand.
        const header = {
            ...U5,
            boot: Object.freeze({ level: 12, x: 16, y: 352 }),
            persistence: [],
            equips: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 1, split: false },
            seam: { items: { hasSword: true, hasWand: true } },
        };
        const { run, out } = solve(NAME, header,
            [{ kind: 'encounter', at: { x: 416, y: 384 }, drop: { item: 'Progressive Sword' }, then: null },
                // ⚠ and OUT, as survey step 140 does: the talk and the ceremony freeze the player, so a tape that
                // stopped at the drop would read the same x/y stream for any dialogue length — the walk to the
                // L95 door is what makes the stream carry the encounter's timing.
                { kind: 'reach-exit', exit: { x: 0, y: 352 } }]);
        const ev = run.ledger('witchEvents');
        const close = ev.find((r) => r.what === 'witch-close');
        const added = ev.find((r) => r.what === 'darksword-added');
        const contact = ev.find((r) => r.what === 'darksword-contact');
        check('⛓⛓ holding the wand, the Witch speaks `textExtra` (the item\'s text, not the level\'s)',
            ev.find((r) => r.what === 'witch-open')?.extra === true, JSON.stringify(ev[0]));
        check('⛓⛓ the dialogue closes on its last page and `doneTalking` ADDS the sword at the player\'s feet',
            close?.cause === 'done' && close.grants === true && added?.t === close.t, JSON.stringify(added));
        check('⛓ collected by overlap on the NEXT frame, `hasDarkSword` after its ceremony, untouched',
            contact?.t === close.t + 1 && run.progress('inventory').hasDarkSword === true
            && run.ledger('playerHits').length === 0, `contact t ${contact?.t}, ${out.perTick.length} t`);
        check('⛓ then the walk out by the L95 door', run.level === 95, `level ${run.level}`);
        const description = '⛓⛓ seedling-fidelity-encounters D3 — L12\'s WITCH, holding the wand. From the survey\'s '
            + 'step-140 arrival (16,352) with the sword and the wand, the encounter goal walks into the Witch\'s talk '
            + `circle, opens her dialogue on an X release (t ${ev.find((r) => r.what === 'witch-open')?.t}), pages `
            + `\`textExtra\` to its end (t ${close?.t}); \`Witch.doneTalking\` adds a \`DarkSword\` at the player's feet `
            + `(${added?.x},${added?.y}), collected by overlap on the next frame; its ceremony is paged and the run `
            + `holds \`hasDarkSword\`; then the walk out by the L95 door (t ${out.perTick.length}). Authored by `
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, header, {}, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks`);
    }

    // ── enc-l32-live-arrival ─────────────────────────────────────────────
    // ⛓⛓ seedling-fidelity-encounters2 D1/D2: the LIVE page's L32 arrival, not a staged one. The staging is the one
    // the JS arc's page built at the arrival (`stagingFromWasmArrival`, the logical-links B session, branch
    // `seedling-js-encounters-rebased` @ 36b72856f5, its solve request for "Level 032 - Bob Boss"), verbatim: the
    // inventory the walk had earned (the shield, the torch, two keys), 35 cleared flags, the arrival's rng. The plan
    // is the worker's SHIPPING pass (`dashMode: 'none'`, `ANYTIME_PASSES[0]`), which is the 1,049-tick plan the
    // page shipped and CI saw leave at t932 — on the game it is 0 px to its end; the t932 divergence needs the
    // panel's clearing write `hasFire = false` (`probe-seedling-encounter-ticks.mjs --write-at=840,hasFire,false`).
    {
        const NAME = 'enc-l32-live-arrival';
        const LIVE = {
            boot: Object.freeze({ level: 32, x: 64, y: 112 }),
            persistence: [[0, 1], [3, 0], [5, 0], [8, 0], [8, 1], [10, 0], [11, 0], [12, 5], [12, 10], [15, 0],
                [15, 2], [15, 3], [16, 0], [16, 6], [16, 7], [17, 0], [17, 29], [18, 0], [19, 0], [19, 1], [19, 3],
                [20, 0], [20, 1], [20, 2], [20, 4], [25, 0], [29, 1], [30, 2], [30, 4], [31, 0], [36, 0], [36, 2],
                [36, 3], [36, 4], [86, 0]].map(([level, tag]) => ({ level, tag })),
            save: { totem_parts: [], keys: [0, 1], seal_parts: [] },
            rng: { seed: 1370430624, split: true, cosmetic: 0 },
            seam: {
                items: {
                    hasSword: true, hasGhostSword: false, hasShield: true, hasFire: false, hasWand: false,
                    hasFireWand: false, canSwim: false, hasSpear: false, hasDarkShield: false, hasDarkSuit: false,
                    hasDarkSword: false, hasFeather: false, hasTorch: true,
                },
                beam: false, rock_set: false, hits_max: 3, time: 22485, primary: 0, secondary: 0,
                cutscene: [false, false, false, false], menu_state: 0,
            },
        };
        const header = {
            tape_version: 11, game: 'seedling', boot: LIVE.boot, noclip: false, noDamage: false, noHazards: [],
            grants: [], persistence: LIVE.persistence, despawn: [], equips: [], pins: ['sound', 'dead_frames'],
            save: LIVE.save, rng: LIVE.rng, seam: LIVE.seam,
        };
        const staging = solveStaging(stagingFromTape(parseTape({ ...header, name: NAME, tick_count: 0, inputs: [] })));
        const run = createRunForStaging(staging, levelSource);
        const out = solveSegment({ run, goals: [{ ...L32_GOAL }], name: NAME, boot: staging.boot, dashMode: 'none' });
        const ev = run.ledger('bobBossEvents');
        check('⛓⛓ the live arrival is the fresh arena: the rock arms, three forms, the Fire, the burn, the pit to L30',
            ev.some((r) => r.what === 'rock-armed') && run.progress('inventory').hasFire === true && run.level === 30
            && run.ledger('playerHits').length === 0, `level ${run.level}, ${out.perTick.length} t`);
        check('⛓ the page\'s shipped plan, to the tick: 1,049 ticks, the Fire slot selected at t833',
            out.perTick.length === 1049 && JSON.stringify(out.equips) === JSON.stringify([{ t: 833, slot: 1 }]),
            `${out.perTick.length} t, equips ${JSON.stringify(out.equips)}`);
        const folded = buildTape(out.perTick, header.boot, NAME,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const description = '⛓⛓ seedling-fidelity-encounters2 D1/D2 — L32\'s Bob Boss from the LIVE page\'s arrival '
            + '(the JS arc\'s logical-links B session: the walk\'s own inventory, the shield and the torch held, 35 '
            + 'cleared flags, the arrival\'s rng), solved by the worker\'s shipping pass (dashless): '
            + `${out.perTick.length} ticks, the arm, seven landings, the Fire, the burn, the pit to L30. It is the plan `
            + 'CI saw leave at t932 (y 33.85 → 34.25): on the game it plays to its end at 0 px; that divergence is the '
            + 'panel\'s clearing write `hasFire = false` while its delivery gate holds the Fire. Authored by '
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        const tape = {
            ...header, name: NAME, tick_count: out.perTick.length, inputs: folded.inputs, equips: out.equips,
        };
        const parsed = parseTape({ ...tape, description });
        emit(NAME, `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`);
        console.log(`## ${NAME}: ${out.perTick.length} ticks, equips ${JSON.stringify(out.equips)}`);
    }

    if (failures > 0) {
        console.error(`plan-seedling-encounters: ${failures} check(s) FAILED`);
        process.exit(1);
    }
}
