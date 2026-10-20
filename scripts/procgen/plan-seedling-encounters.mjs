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
 * ⛓⛓ fidelity APFLIP (D3/D6, `CONTACT_FIDELITY.apReportBosses` ON, the p4g wasm = vendor/seedling `ccdf189776`): the
 * R4 AS3 REPORTS Bob's kill {32,3}, his Fire drop {32,4} and the Witch's sword {12,1}, and grants neither item (the
 * HOST does, and the probe has no host). So a tape that fights Bob WITHOUT Fire ends in the arena after the Fire's
 * ceremony and `IDLE_AFTER` idle ticks (`L32_ROOM_GOAL`): the burn would need the host's grant (APBOSSES H1). The
 * return visit `enc-l32-fire-return` is replaced by `apb-l32-both-reported` (Fire held AND both slots reported: the
 * boss is no longer removed by `hasFire`, it is the SLOT that keeps him out). The `apb-*` blocks are APBOSSES §D3's
 * witnesses, plus the Totem gate's `apb-l43-totem-no-parts` (`BossTotem.as:291` @ccdf189776).
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
    /** ⛓ APFLIP: `enc-l12-witch`'s header and plan, for the `apb-l12-witch-*` rows. */
    let WITCH = null;
    const persistence = (extra) => [...U5.persistence, ...extra.map(([level, tag]) => ({ level, tag, note: '' }))];
    const L32_GOAL = Object.freeze({ kind: 'encounter', at: { x: 64, y: 128 }, drop: { item: 'Fire' }, then: 'reach-pit' });
    /** ⛓ APFLIP: the same encounter, ending in the arena (no Fire is granted without the host, so no burn). */
    const L32_ROOM_GOAL = Object.freeze({ ...L32_GOAL, then: null });
    /** ⛓ APFLIP: idle ticks after the last goal, so the stream carries the room's quiet frames past the ceremony. */
    const IDLE_AFTER = 30;
    const idled = (perTick) => [...perTick, ...Array.from({ length: IDLE_AFTER }, () => new Set())];
    const slotReported = (run, level, tag) => run.apReportSlotHeld(level, tag) === false;
    const bobFlags = (run) => run.ledger('bobBossEvents').filter((r) => r.flag)
        .map((r) => `${r.what} ${r.flag.level},${r.flag.tag}`);

    // ── enc-l32-fallen-door ──────────────────────────────────────────────
    {
        const NAME = 'enc-l32-fallen-door';
        const over = { persistence: persistence([[32, 1]]) };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_ROOM_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        const snap = ev.find((r) => r.what === 'rock-snap');
        check('⛓⛓ the door arrival is INSIDE the fallen rock and is snapped onto its top on the first frame',
            snap?.t === 0 && snap.from === 128 && snap.to === 125, JSON.stringify(snap));
        check('⛓ the boss is re-added at build (`rock-fallen-at-build`), with no arm leg',
            ev.some((r) => r.what === 'rock-fallen-at-build' && r.boss === true)
            && !out.records.some((r) => r.leg === 'arm'), out.records.map((r) => r.leg ?? r.goal).join(','));
        check('⛓ seven landings, three kills, untouched; {32,3} and {32,4} REPORTED, no Fire granted, still in L32',
            ev.filter((r) => r.what === 'boss-hit' && r.landed).length === 7 && run.level === 32
            && slotReported(run, 32, 3) && slotReported(run, 32, 4) && run.progress('inventory').hasFire !== true
            && run.ledger('playerHits').length === 0, `level ${run.level}, ${out.perTick.length} t, ${bobFlags(run)}`);
        const description = '⛓⛓ seedling-fidelity-encounters D2 — L32\'s encounter from a ROCK-FALLEN arrival. '
            + '`swim-u5-bobboss-encounter`\'s staging with {32,1} cleared (the state after a death mid-fight), entered '
            + 'through the L30 door: the rock is built fallen on the door\'s stairs, the arrival (80,128) is inside it, '
            + '`FallRockLarge.update` snaps the player to y 125 and re-adds the boss at once (`cameraTimer == 0`). '
            + `Solved by \`solveSegment\` (the encounter goal, no arm leg): ${out.perTick.length} ticks, seven landings, `
            + 'the Fire. ⛓ fidelity APFLIP (R4, p4g): the kill reports {32,3} and the collect {32,4}, and NO Fire is '
            + `granted (the host grants it), so the tape ends in the arena, ${IDLE_AFTER} idle ticks after the Fire's `
            + 'ceremony. Authored by scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, U5, over, idled(out.perTick), out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks, equips ${JSON.stringify(out.equips)}`);
    }

    // ── apb-l32-both-reported (⛓ APFLIP: replaces enc-l32-fire-return) ─────────────────────────────────
    {
        const NAME = 'apb-l32-both-reported';
        const over = {
            persistence: persistence([[32, 0], [32, 1], [32, 3], [32, 4]]),
            seam: { ...U5.seam, items: { ...U5.seam.items, hasFire: true } },
        };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        check('⛓ both reported: the fallen rock adds NOTHING (no boss, no Fire), the drop record says `already`',
            ev.some((r) => r.what === 'rock-fallen-at-build' && r.boss === false && r.fire === false)
            && !ev.some((r) => r.what === 'boss-added' || r.what === 'fire-added')
            && out.records.some((r) => r.leg === 'drop' && r.already === true), JSON.stringify(ev.slice(0, 3)));
        check('⛓ the snap, then the burned pit to L30', ev.some((r) => r.what === 'rock-snap') && run.level === 30,
            `level ${run.level}, ${out.perTick.length} t`);
        const description = '⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L32 with BOTH R4 slots reported ({32,3} the kill, '
            + '{32,4} the Fire drop), the Fire held, the rock {32,1} fallen and the tree {32,0} burned: the R7 '
            + 'replacement for `enc-l32-fire-return`. `FallRockLarge.as:118-126` @ccdf189776 adds neither the boss nor '
            + 'the Fire; the door arrival is snapped onto the rock, the encounter is `already`, and the walk takes the '
            + `burned pit to L30 in ${out.perTick.length} ticks. Authored by scripts/procgen/plan-seedling-encounters.mjs.`;
        emit(NAME, tapeJson(NAME, U5, over, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks`);
    }

    // ── apb-l32-fresh-fire-held ──────────────────────────────────────────
    {
        const NAME = 'apb-l32-fresh-fire-held';
        const over = { equips: [], seam: { ...U5.seam, items: { ...U5.seam.items, hasFire: true } } };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        check('⛓⛓ Q2: the Fire from the server does NOT remove the boss — the rock arms, seven landings',
            ev.some((r) => r.what === 'rock-armed') && ev.filter((r) => r.what === 'boss-hit' && r.landed).length === 7,
            bobFlags(run).join(', '));
        check('⛓ the kill reports {32,3}, the drop is collected and reports {32,4} (in band), no {31,29}; the burn, the pit',
            slotReported(run, 32, 3) && slotReported(run, 32, 4) && !bobFlags(run).includes('fire-removed 31,29')
            && run.level === 30, `level ${run.level}, ${out.perTick.length} t, ${bobFlags(run)}`);
        const description = '⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L32 FRESH with the Fire already held (from the '
            + 'server): `swim-u5-bobboss-encounter`\'s staging + `hasFire`. R4 (`BobBoss.as` @ccdf189776) removed the '
            + 'three `hasFire` guards, so the boss is fought anyway (Q2): the arm, seven landings, the final death '
            + 'reports {32,3} and adds the Fire (tag 4), collecting it reports {32,4} (no {31,29}); then the burn and the '
            + `pit to L30. Solved by \`solveSegment\` in ${out.perTick.length} ticks. Authored by `
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, U5, over, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks, equips ${JSON.stringify(out.equips)}`);
    }

    // ── apb-l32-fresh-no-fire ────────────────────────────────────────────
    {
        const NAME = 'apb-l32-fresh-no-fire';
        const { run, out } = solve(NAME, { ...U5, equips: [] }, [{ ...L32_ROOM_GOAL }]);
        check('⛓⛓ no Fire, fresh: the fight, both reports, and `hasFire` stays FALSE (the probe has no host)',
            slotReported(run, 32, 3) && slotReported(run, 32, 4) && run.progress('inventory').hasFire !== true
            && run.level === 32 && run.ledger('playerHits').length === 0,
            `level ${run.level}, ${out.perTick.length} t, ${bobFlags(run)}`);
        const description = '⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L32 FRESH without Fire: '
            + '`swim-u5-bobboss-encounter`\'s staging, unchanged. The fight, the kill reports {32,3}, the Fire drop is '
            + 'collected and reports {32,4}; R4 grants nothing (`Fire.as:49-55` @ccdf189776, the host grants it), so '
            + `\`hasFire\` stays false and the tape ends in the arena ${IDLE_AFTER} idle ticks after the Fire's ceremony `
            + `(${out.perTick.length + IDLE_AFTER} ticks). Authored by scripts/procgen/plan-seedling-encounters.mjs.`;
        emit(NAME, tapeJson(NAME, U5, {}, idled(out.perTick), out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} + ${IDLE_AFTER} ticks`);
    }

    // ── apb-l32-killed-drop-held ─────────────────────────────────────────
    {
        const NAME = 'apb-l32-killed-drop-held';
        const over = { equips: [], persistence: persistence([[32, 1], [32, 3]]) };
        const { run, out } = solve(NAME, { ...U5, ...over }, [{ ...L32_ROOM_GOAL }]);
        const ev = run.ledger('bobBossEvents');
        check('⛓⛓ killed, drop unreported: the fallen rock\'s first frame adds the FIRE, no boss, no `playerPosition`',
            ev.some((r) => r.what === 'rock-fallen-at-build' && r.boss === false && r.fire === true)
            && !ev.some((r) => r.what === 'boss-added'), JSON.stringify(ev.slice(0, 3)));
        check('⛓ collected: {32,4} reported, no Fire granted, still in L32',
            slotReported(run, 32, 4) && run.progress('inventory').hasFire !== true && run.level === 32,
            `level ${run.level}, ${out.perTick.length} t, ${bobFlags(run)}`);
        const description = '⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L32 after the kill, the drop unreported: '
            + '`swim-u5-bobboss-encounter`\'s staging + {32,1} {32,3}. The rock is built fallen and its first frame '
            + 'takes `FallRockLarge.as:123-126` @ccdf189776: the Fire (tag 4), no boss, no BobBossNPC, and '
            + '`playerPosition` is not rewritten. The door arrival is snapped onto the rock, the Fire is collected and '
            + `reports {32,4}; no item. Ends ${IDLE_AFTER} idle ticks after its ceremony. Authored by `
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, U5, over, idled(out.perTick), out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} + ${IDLE_AFTER} ticks`);
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
        check('⛓ collected by overlap on the NEXT frame; ⛓ APFLIP (R4): it REPORTS {12,1} and grants nothing, untouched',
            contact?.t === close.t + 1 && slotReported(run, 12, 1) && run.progress('inventory').hasDarkSword !== true
            && run.ledger('playerHits').length === 0, `contact t ${contact?.t}, ${out.perTick.length} t`);
        check('⛓ then the walk out by the L95 door', run.level === 95, `level ${run.level}`);
        const description = '⛓⛓ seedling-fidelity-encounters D3 — L12\'s WITCH, holding the wand. From the survey\'s '
            + 'step-140 arrival (16,352) with the sword and the wand, the encounter goal walks into the Witch\'s talk '
            + `circle, opens her dialogue on an X release (t ${ev.find((r) => r.what === 'witch-open')?.t}), pages `
            + `\`textExtra\` to its end (t ${close?.t}); \`Witch.doneTalking\` adds a \`DarkSword\` at the player's feet `
            + `(${added?.x},${added?.y}), collected by overlap on the next frame; its ceremony is paged; ⛓ APFLIP (R4, `
            + '`DarkSword.as:49-58` @ccdf189776): the collect reports {12,1} and grants nothing (the host does); then '
            + `the walk out by the L95 door (t ${out.perTick.length}). Authored by `
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, header, {}, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks`);
        WITCH = { header, perTick: out.perTick, equips: out.equips };
    }

    // ── apb-l12-witch-slot-held / -server-sword / -reported ──────────────
    // ⛓ APFLIP D3 (APBOSSES §D3): the Witch's three R4 states. `slot-held` is `enc-l12-witch`'s staging and goal
    // under its R4 name; `server-sword` adds the sword from the server (`Witch.update`'s text swap still reads it, so
    // she speaks `textExtra1`, and R4's `doneTalking` adds the sword anyway); `reported` stages {12,1} and REPLAYS
    // `slot-held`'s inputs — the solver would not talk to a Witch whose slot is reported (`already`), and the witness
    // is that the same talk now closes with NOTHING added.
    const WITCH_GOALS = [{ kind: 'encounter', at: { x: 416, y: 384 }, drop: { item: 'Progressive Sword' }, then: null },
        { kind: 'reach-exit', exit: { x: 0, y: 352 } }];
    for (const [NAME, over, why] of [
        ['apb-l12-witch-slot-held', {}, '{12,1} held, the wand, no dark sword: the talk, the sword at the feet, its '
            + 'ceremony; the collect reports {12,1}, `hasDarkSword` stays FALSE, no {11,29}'],
        ['apb-l12-witch-server-sword', { seam: { items: { hasSword: true, hasWand: true, hasDarkSword: true } } },
            '{12,1} held and the dark sword already held (from the server): `textExtra1` is spoken (`Witch.update` is '
            + 'unchanged) AND the sword is still added and collected (`Witch.as:50-53` reads the slot); {12,1} reported'],
    ]) {
        const header = { ...WITCH.header, ...over };
        const { run, out } = solve(NAME, header, WITCH_GOALS);
        const ev = run.ledger('witchEvents');
        check(`⛓⛓ ${NAME}: the sword is ADDED and collected, {12,1} reported, then out by the L95 door`,
            ev.some((r) => r.what === 'darksword-added') && ev.some((r) => r.what === 'darksword-contact')
            && slotReported(run, 12, 1) && run.level === 95, `${out.perTick.length} t, ${JSON.stringify(ev.map((r) => r.what))}`);
        const description = `⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L12's Witch, ${why}. From the survey's step-140 `
            + `arrival (16,352), solved by \`solveSegment\` (the encounter goal, then out by the L95 door, ${out.perTick.length} `
            + 'ticks). AS3 @ccdf189776. Authored by scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, header, {}, out.perTick, out.equips, description));
        console.log(`## ${NAME}: ${out.perTick.length} ticks`);
    }
    {
        const NAME = 'apb-l12-witch-reported';
        const header = { ...WITCH.header, persistence: [{ level: 12, tag: 1, note: '' }] };
        const staging = solveStaging(stagingFromTape(parseTape({ ...header, name: NAME, tick_count: 0, inputs: [] })));
        const run = createRunForStaging(staging, levelSource);
        for (const held of WITCH.perTick) run.advance(held);
        const ev = run.ledger('witchEvents');
        check('⛓⛓ {12,1} reported: the same talk opens and closes, and NOTHING is added (`Witch.as:50` reads the slot)',
            ev.some((r) => r.what === 'witch-open') && ev.some((r) => r.what === 'witch-close')
            && !ev.some((r) => r.what === 'darksword-added') && run.progress('inventory').hasDarkSword !== true,
            `${JSON.stringify(ev.map((r) => r.what))}, level ${run.level}`);
        const description = '⛓⛓ fidelity APFLIP D3 (APBOSSES §D3) — L12\'s Witch with {12,1} REPORTED: '
            + '`apb-l12-witch-slot-held`\'s inputs replayed on its staging + `persistence` {12,1} (the solver would not '
            + 'talk to her: `already`). The talk opens and closes, `doneTalking`\'s `checkPersistence(WITCH_TAG)` is '
            + 'false (`Witch.as:50-53` @ccdf189776), so nothing is added. Authored by '
            + 'scripts/procgen/plan-seedling-encounters.mjs.';
        emit(NAME, tapeJson(NAME, header, {}, WITCH.perTick, WITCH.equips, description));
        console.log(`## ${NAME}: ${WITCH.perTick.length} ticks (replayed)`);
    }

    // ── apb-l43-totem-no-parts ───────────────────────────────────────────
    {
        const NAME = 'apb-l43-totem-no-parts';
        // ⛓ APFLIP D2/D3: the Wand GONE ({43,0} cleared — what an `apitem` in its place also leaves) and NO totem
        // parts. `BossTotem.as:291` @ccdf189776 holds the fight back; the seal rocks fall only on `Wand.removed`.
        const header = {
            ...U5,
            boot: Object.freeze({ level: 43, x: 144, y: 240 }),
            persistence: [{ level: 43, tag: 0, note: '' }],
            equips: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 1, split: false },
            seam: { items: { hasSword: true } },
        };
        // ⚠ AUTHORED, NOT SOLVED: the solver's walk from this boot throws by name (a sword press reaching
        // `watcher@200,280`, a walker gap this witness does not need). The keys are ROCKMOVE's witnessed walk from the
        // Wand to the stairs (`l43-wand-stairs`, right then down the neck) without the Wand's ceremony.
        const out = { perTick: Array.from({ length: 400 }, (_, t) => new Set(t < 29 ? ['right'] : t >= 35 ? ['down'] : [])),
            equips: [] };
        const staging = solveStaging(stagingFromTape(parseTape({ ...header, name: NAME, tick_count: 0, inputs: [] })));
        const run = createRunForStaging(staging, levelSource);
        let woke = false;
        for (const held of out.perTick) {
            run.advance(held);
            if ([...(run.bosses?.values() ?? [])].some((b) => b.activated)) woke = true;
        }
        check('⛓⛓ no parts: the boss never wakes, no rock falls, and the stairs to L40 stay open',
            !woke && run.rockFalls.length === 0 && run.level === 40, `level ${run.level}, ${out.perTick.length} t`);
        const description = '⛓⛓ fidelity APFLIP D2/D3 — the Totem gate (`BossTotem.as:291` @ccdf189776: '
            + '`classCount(Wand) <= 0 && !activated && Player.hasAllTotemParts()`). L43 with the Wand gone ({43,0} '
            + 'cleared, as an `apitem` in its place leaves it) and NO totem parts: the boss stays asleep, the three seal '
            + 'rocks (tags 1/2/3, dropped only by `Wand.removed`) never fall, and an authored walk (right, then down '
            + `the neck) takes the stairs to L40 inside ${out.perTick.length} ticks. Authored by `
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
        const out = solveSegment({ run, goals: [{ ...L32_ROOM_GOAL }], name: NAME, boot: staging.boot, dashMode: 'none' });
        const ev = run.ledger('bobBossEvents');
        check('⛓⛓ the live arrival is the fresh arena: the rock arms, three forms, the Fire; ⛓ APFLIP: both reported, '
            + 'no Fire granted, still in L32',
            ev.some((r) => r.what === 'rock-armed') && slotReported(run, 32, 3) && slotReported(run, 32, 4)
            && run.progress('inventory').hasFire !== true && run.level === 32
            && run.ledger('playerHits').length === 0, `level ${run.level}, ${out.perTick.length} t`);
        check('⛓ the page\'s shipped plan to the collect, to the tick: 832 ticks (the Fire slot WAS selected at t833, one after)',
            out.perTick.length === 832 && out.equips.length === 0,
            `${out.perTick.length} t, equips ${JSON.stringify(out.equips)}`);
        const folded = buildTape(idled(out.perTick), header.boot, NAME,
            { noclip: false, noDamage: false, noHazards: [], grants: [] });
        const description = '⛓⛓ seedling-fidelity-encounters2 D1/D2 — L32\'s Bob Boss from the LIVE page\'s arrival '
            + '(the JS arc\'s logical-links B session: the walk\'s own inventory, the shield and the torch held, 35 '
            + 'cleared flags, the arrival\'s rng), solved by the worker\'s shipping pass (dashless): '
            + `${out.perTick.length} ticks, the arm, seven landings, the Fire. ⛓ fidelity APFLIP (R4, p4g): the kill `
            + 'reports {32,3}, the collect {32,4}, and NO Fire is granted (the host does), so the plan stops at the '
            + `collect and the tape ends ${IDLE_AFTER} idle ticks later in the arena (it was the 1,049-tick plan to the pit `
            + 'before R4). Authored by scripts/procgen/plan-seedling-encounters.mjs.';
        const tape = {
            ...header, name: NAME, tick_count: out.perTick.length + IDLE_AFTER, inputs: folded.inputs, equips: out.equips,
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
