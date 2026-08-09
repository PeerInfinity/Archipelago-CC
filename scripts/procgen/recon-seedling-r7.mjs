#!/usr/bin/env node
/**
 * recon-seedling-r7 — slice-0 instruments for THE HONEST PLAYTHROUGH.
 *
 * Region-atlas Phase 8, subtractive ladder rung R7, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` §4 slice 0, §6.1.
 *
 * ── THE QUESTION ──────────────────────────────────────────────────────
 *
 *   `--trap-boss-flood`  §6.1's RULED verification. The user's stated
 *                        expectation was "collecting all the items will
 *                        require traveling through the areas that trigger
 *                        these boss fights. I might be wrong about that."
 *                        This is the measurement.
 *
 * ⛔⛔ IT IS A DIFFERENTIAL, NOT AN ABSOLUTE — AND THAT IS A CORRECTION TO
 * THE RULING'S OWN TEST. §6.1 as written says "every goal item must remain
 * reachable [under the exclusion], or STOP". Run literally against this
 * instrument that gate STOPS unconditionally, because the flood does not
 * reach five of the fourteen inventory items with the trap bosses fully
 * INCLUDED (`recon-seedling-r5.mjs --flood --no-volumes`: 9/14, missing
 * `health`, `hasWand`, `hasGhostSword`, `hasFireWand`, `hasDarkSword`).
 * Those five are R5/R6's standing walls — the L40 chain, D8's depth — and
 * they are facts about a REACHABILITY FLOOD versus a WALK, not about the
 * three trap rooms. An absolute gate cannot separate them.
 *
 * The question the ruling actually asks is a PAIR: does excluding L57 /
 * L69 / L82 change what the map offers? So this runs a CONTROL (the trap
 * rooms in) and a TREATMENT (the trap rooms out) over the same graph, the
 * same clears, the same lattice, and reports the DELTA. Anything the
 * treatment loses that the control had is the evidence §6.1 wants; a delta
 * of zero is the ruling standing, with the five never-reached items named
 * as OUT OF THIS INSTRUMENT'S REACH IN BOTH ARMS rather than silently
 * folded into a green.
 *
 * ── THE TWO TREATMENT ARMS ────────────────────────────────────────────
 *
 * A. `never-enter` — the POLICY. The transition into a forbidden level is
 *    not an edge; its trigger cells stay walkable. This is what a planner
 *    that refuses those rooms actually does.
 * B. `never-touch` — the STRICTER reading, and the one the user's worry
 *    needs: the trigger/pit cells themselves are refused, so a room whose
 *    only corridor runs across L71's pit into L82 reports as cut. Arm B
 *    is arm A plus a `stepRefusal` over the cells arm A reported.
 *
 * ⚠ ARM B HAS ONE HOLE IT NAMES: the flood seeds an arrival's ring
 * directly (`enter`), so a forbidden cell that is ALSO an arrival ring
 * cell is entered without a step. The overlap is checked and printed; it
 * is empty at the time of writing, and if it ever is not, the number is
 * on the report rather than under it.
 *
 * ── WHAT THE LEDGER COVERS ────────────────────────────────────────────
 *
 * R5's flood harvested 13 pickup tags. R7's goal is COLLECT-ALL, so the
 * ledger here adds the sixteen seal `chest`s, the five `totempart`s and
 * the `seed` — 35 placed targets over 22 levels, checked cell by cell the
 * same way (`reached` = a flooded cell 4-adjacent to the target's volume,
 * R3's narrowing). Encounter items (`hasFire`, `hasDarkSword`) keep R5's
 * level-reached rule.
 *
 * Run: node scripts/procgen/recon-seedling-r7.mjs --trap-boss-flood
 *      node scripts/procgen/recon-seedling-r7.mjs --trap-boss-flood --volumes
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const LEVEL_COUNT = 116;

/**
 * ⛔ THE THREE TRAP ROOMS, by number, with the source fact that makes each
 * one a refusal rather than a challenge. Pinned BY NAME (trap: "a
 * coincidental test-roster predicate rots silently") — a predicate over
 * "levels holding a boss" would quietly take in L19, L32, L43 and L112,
 * every one of which the ladder has already killed.
 */
const TRAP_BOSS_LEVELS = Object.freeze([
    Object.freeze({
        level: 57,
        boss: 'TentacleBeast',
        why: 'no exit until the kill — `TentacleBeast.as:213` creates the exit '
            + 'teleporter on death, so an unprepared entry soft-locks the run',
    }),
    Object.freeze({
        level: 69,
        boss: 'LightBoss',
        why: 'no exit until the kill — `LightBossController.as:104` creates the '
            + 'exit teleporter on death',
    }),
    Object.freeze({
        level: 82,
        boss: 'LavaBoss',
        why: 'the boss BODY is the door (a Solid in `Player.solids`); the ctor '
            + 'hijacks every L82 spawn to (152,176) (`LavaBoss.as:53`)',
    }),
]);

/** R5's inventory harvest, unchanged — the flood's item gates. */
const PICKUP_ITEMS = Object.freeze({
    sword: 'hasSword', shield: 'hasShield', darkshield: 'hasDarkShield',
    darksuit: 'hasDarkSuit', feather: 'hasFeather', torchpickup: 'hasTorch',
    ghostspear: 'hasSpear', health: 'health', wand: 'hasWand', conch: 'canSwim',
    ghostsword: 'hasGhostSword', firewand: 'hasFireWand', bosskey: 'bosskey',
});

/** Encounter-granted items: what has to be REACHED for the grant to fire. */
const ENCOUNTER_ITEMS = Object.freeze([
    { item: 'hasFire', at: { level: 32, why: 'BobBoss form 2 drops Fire (BobBoss.as:194)' } },
    { item: 'hasDarkSword', at: { level: 12, why: 'Witch.doneTalking() under hasWand' }, needs: ['hasWand'] },
]);

/**
 * The COLLECT-ALL targets that are not inventory gates: they are things the
 * playthrough must touch, and nothing downstream needs them held.
 *
 * ⚠ `chest` rows are keyed by LEVEL, never by seal identity — the identity
 * is a rejection-sampled draw taken at chest OPEN (`Chest.open`), so
 * "which seal" is an RNG fact and "which chest" is a map fact.
 */
const GOAL_ONLY_TAGS = Object.freeze(['chest', 'totempart', 'seed']);

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? hit.slice(n.length + 3) : d;
};

async function main() {
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));
    const { climbsArmedWaterfall } = await import(join(MODULE, 'botDriverV2.js'));
    const { R4_BOOT, R4_LATTICE, R4_NO_HAZARDS } = await import(join(MODULE, 'r4Walk.js'));
    const { persistenceClearsFor, buildLevelWorld } = await import(join(MODULE, 'levelWorld.js'));

    const source = atlasLevelSource();
    const hazards = (opt('hazards') ?? R4_NO_HAZARDS.join(',')).split(',').filter(Boolean);
    const lattice = Number(opt('lattice', String(R4_LATTICE)));
    // `--clears=all` is R5's upper bound and the only defensible default for
    // a REACHABILITY question: what the whole clear offer cannot reach, no
    // clear bill can.
    const clears = [];
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        let offered;
        try { offered = persistenceClearsFor(source(level)); } catch { continue; }
        for (const c of offered.offers ?? offered.offered ?? []) clears.push({ level, tag: c.tag });
    }

    // ⚠ AVOID VOLUMES OFF IS THE DEFAULT HERE, and R5's `--flood` has it on.
    // The volumes-on arm reports Dungeon 7 sealed for a reason that is a fact
    // about the instrument (a leg may DECLARE the contacts it starts inside),
    // so the arm that can answer a reachability question is this one. `--volumes`
    // runs the stricter one; both are quoted in the write-up.
    const avoidVolumes = flag('volumes');
    const PLAN = { noclip: false, noHazards: hazards, avoidVolumes };
    const cache = { worlds: new Map(), components: new Map() };
    // ⛔ NO `excludeLevels`. R2/R3/R4's planners pin a frozen census to keep
    // their committed routes reproducible; this consumer wants the whole map
    // and says so (kickoff §2.3).
    const graph = makeRouteGraph({
        source, clears, plan: PLAN, lattice, holdTicks: 101, levelCount: LEVEL_COUNT, cache,
    });

    /** Which locks the flood treats as open, given what the run holds. */
    function locksOpenUnder(inv) {
        const open = new Set();
        const keys = inv.keys ?? new Set();
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            const world = graph.worldFor(level);
            if (!world) continue;
            for (const a of world.activators) {
                let ok = false;
                if (a.t === -1 && a.tag !== 'bosslock') ok = true; // kill lock
                else if (a.tag === 'bosslock') ok = keys.has(a.keyType);
                else if (a.tag === 'wandlock' || a.tag === 'magicallock') ok = Boolean(inv.hasWand);
                else if (a.tag === 'magicallockfire') ok = Boolean(inv.hasFireWand);
                else if (a.shield) ok = Boolean(inv[a.shield]);
                else if (a.t >= 0 && world.pressers.some((p) => p.t === a.t)) ok = true;
                if (ok) open.add(a.id);
            }
        }
        return open;
    }

    /** The keyType each placed `bosskey` grants, straight off the extract. */
    const keyTypeAt = new Map();
    /** Every collect-all target, placed: `{level, tag, x, y}`. */
    const TARGETS = [];
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        for (const e of source(level).entities ?? []) {
            if (e.type === 'bosskey') {
                keyTypeAt.set(`${level}:${e.x},${e.y}`, Number(e.attrs?.keyType ?? 0));
            }
            if (GOAL_ONLY_TAGS.includes(e.type) || PICKUP_ITEMS[e.type]) {
                TARGETS.push({ level, tag: e.type, x: e.x, y: e.y });
            }
        }
    }

    /**
     * A target's volume, whichever list the model files it under.
     *
     * ⛔ A CHEST IS NOT A PICKUP IN THIS MODEL. `buildLevelWorld` files the
     * sixteen seal chests under `world.chests` with no `rect` — L11's
     * `pickups` is EMPTY — so a harvest that only walked `pickups` would
     * report every chest unreached and call it a finding. The rect is
     * rebuilt from the constructor: `Chest(_x, _y)` is
     * `super(_x + 8, _y + 8)` with `setHitbox(16, 16, 8, 8)`, i.e. the
     * 16x16 box at the `.oel` coordinate (`Chest.as:26-30`).
     *
     * ⛔⛔ AND THE VOLUME IS THE STRIP BELOW IT, NOT THE BOX — THE FIRST CUT
     * GOT THIS WRONG AND REPORTED FIFTEEN REACHED CHESTS AS UNREACHED.
     * R3's narrowing dilates a target's rect by ONE LATTICE CELL and asks
     * whether the flood stood there. That is right for a PICKUP, whose
     * volume is not solid. A chest is `type = "Solid"` with a 16x16 box
     * (`Chest.as:29`), so every cell inside the one-cell dilation is a cell
     * whose PLAYER BOX still overlaps the chest — i.e. blocked — and the
     * test could only ever answer no. Fifteen chests in levels the flood
     * demonstrably reaches came back unreached, which reads exactly like a
     * finding about the map.
     *
     * The game's own predicate is the fix: `Chest.update` opens on
     * `collideLine("Player", x-originX+2, y-originY+height+1, …)` — a line
     * ONE PIXEL BELOW the bottom edge, i.e. **approach from below**
     * (`Chest.as:62`). So the volume a walk must reach is the strip under
     * the chest, and that strip is ordinary floor. Derive the predicate
     * from the mechanism, never from the entity's own rect.
     *
     * ⛔⛔ AND IT READS THE **UNCLEARED** WORLD — THE SECOND DEFECT THIS
     * FUNCTION HAD, AND THE ONE THAT PRODUCED THE FIRST CUT'S 10/39.
     * The flood runs with `--clears=all`, the upper bound: every persistence
     * tag the map OFFERS is treated as already cleared. A cleared chest tag
     * means the chest is OPEN — so `graph.worldFor(11).chests` is EMPTY, and
     * a harvest that asked the flood's own world where the chest is got the
     * honest answer "there is no chest here" and recorded it as UNREACHED.
     * Fifteen chests, again, for a second and completely different reason;
     * the strip fix alone moved the count by zero.
     *
     * ⇒ a CLEAR is a permission about the run's persistence state, not a
     * claim about the goal ledger. Reachability comes from the cleared
     * world; the target's GEOMETRY comes from the level as authored.
     */
    const pristine = new Map();
    function pristineWorld(level) {
        if (!pristine.has(level)) {
            let w = null;
            try { w = buildLevelWorld(source(level)); } catch { w = null; }
            pristine.set(level, w);
        }
        return pristine.get(level);
    }

    function rectOf(level, t) {
        const world = pristineWorld(level);
        if (!world) return null;
        const p = (world.pickups ?? []).find((q) => q.tag === t.tag && q.x === t.x && q.y === t.y);
        if (p) return p.rect;
        const c = (world.chests ?? []).find((q) => q.x === t.x && q.y === t.y);
        // The open strip: one tile tall, immediately below the 16x16 box.
        if (c) return { x: c.x, y: c.y + 16, right: c.x + 16, bottom: c.y + 32 };
        return null;
    }

    /** Did the flood reach this target's own volume (R3's narrowing)? */
    function touched(seen, level, r) {
        const c0 = Math.floor(r.x / lattice) - 1;
        const c1 = Math.ceil(r.right / lattice);
        const r0 = Math.floor(r.y / lattice) - 1;
        const r1 = Math.ceil(r.bottom / lattice);
        for (let cy = r0; cy <= r1; cy += 1) {
            for (let cx = c0; cx <= c1; cx += 1) {
                if (seen.has(`${level}:${cx},${cy}`)) return true;
            }
        }
        return false;
    }

    /**
     * One fixed point: flood, harvest, re-flood, until nothing new.
     *
     * @param {Set|null} forbidLevels  levels the flood may never enter
     * @param {Map|null} refuseCells   `Map<level, Set<"cx,cy">>` arm B refuses
     */
    function fixedPoint(forbidLevels, refuseCells) {
        const inventory = { keys: new Set() };
        let result = null;
        let round = 0;
        for (;;) {
            round += 1;
            const open = locksOpenUnder(inventory);
            const openBridges = new Set();
            if (inventory.hasSpear) {
                for (let level = 0; level < LEVEL_COUNT; level += 1) {
                    for (const b of graph.worldFor(level)?.bridgeTiles ?? []) {
                        openBridges.add(`${b.tx},${b.ty}`);
                    }
                }
            }
            result = graph.directedFlood({
                start: R4_BOOT,
                inventory: { ...inventory },
                openLocks: open,
                openBridges,
                forbidLevels,
                stepRefusal: (world, from, to) => {
                    if (refuseCells) {
                        const cells = refuseCells.get(world.level);
                        if (cells && cells.has(`${to.tx},${to.ty}`)) return true;
                    }
                    return climbsArmedWaterfall(world, from, to,
                        { noHazards: hazards, inventory, lattice });
                },
            });

            let changed = false;
            const reachedLevels = new Set([...result.seen]
                .filter((k) => !k.startsWith('exit:')).map((k) => Number(k.split(':')[0])));
            for (const level of reachedLevels) {
                for (const p of graph.worldFor(level)?.pickups ?? []) {
                    const item = PICKUP_ITEMS[p.tag];
                    if (!item || inventory[item]) continue;
                    if (!touched(result.seen, level, p.rect)) continue;
                    if (p.tag === 'bosskey') {
                        const kt = keyTypeAt.get(`${level}:${p.x},${p.y}`);
                        if (kt === undefined || inventory.keys.has(kt)) continue;
                        inventory.keys.add(kt);
                        changed = true;
                        continue;
                    }
                    inventory[item] = true;
                    changed = true;
                }
            }
            for (const enc of ENCOUNTER_ITEMS) {
                if (inventory[enc.item]) continue;
                if (!reachedLevels.has(enc.at.level)) continue;
                if ((enc.needs ?? []).some((n) => !inventory[n])) continue;
                inventory[enc.item] = true;
                changed = true;
            }
            if (!changed || round > 12) break;
        }
        // The goal-only targets are harvested once, at the fixed point — they
        // gate nothing, so re-flooding for them would change no answer.
        const goals = new Map();
        for (const t of TARGETS) {
            const key = `${t.tag}@L${t.level}:${t.x},${t.y}`;
            const r = rectOf(t.level, t);
            goals.set(key, Boolean(r && touched(result.seen, t.level, r)));
        }
        const levels = [...new Set([...result.seen]
            .filter((k) => !k.startsWith('exit:')).map((k) => Number(k.split(':')[0])))]
            .sort((a, b) => a - b);
        return { inventory, result, round, goals, levels };
    }

    console.log('## R7 §6.1 — the trap-boss exclusion, measured as a PAIR\n');
    console.log(`noHazards ${JSON.stringify(hazards)}, clears all (${clears.length}), `
        + `lattice ${lattice}, avoidVolumes ${avoidVolumes}`);
    console.log(`targets: ${TARGETS.length} placed over `
        + `${new Set(TARGETS.map((t) => t.level)).size} levels\n`);

    const forbid = new Set(TRAP_BOSS_LEVELS.map((t) => t.level));

    console.log('— CONTROL: the trap rooms IN —');
    const control = fixedPoint(null, null);
    console.log(`   ${control.round} rounds, ${control.levels.length} levels, `
        + `${[...control.goals.values()].filter(Boolean).length}/${control.goals.size} goal targets\n`);

    console.log('— TREATMENT A: never-enter (the transition is not an edge) —');
    const armA = fixedPoint(forbid, null);
    console.log(`   ${armA.round} rounds, ${armA.levels.length} levels, `
        + `${[...armA.goals.values()].filter(Boolean).length}/${armA.goals.size} goal targets`);
    const entryCells = new Map();
    for (const [level, cells] of armA.result.forbidden) {
        entryCells.set(level, new Set(cells.keys()));
        for (const [k, whys] of cells) {
            console.log(`   forbidden entry  L${level} cell ${k}  ${[...new Set(whys)].join(' / ')}`);
        }
    }
    if (entryCells.size === 0) console.log('   (no entry cell into any trap room was ever reached)');
    console.log('');

    console.log('— TREATMENT B: never-touch (the entry cells refused outright) —');
    const armB = fixedPoint(forbid, entryCells);
    console.log(`   ${armB.round} rounds, ${armB.levels.length} levels, `
        + `${[...armB.goals.values()].filter(Boolean).length}/${armB.goals.size} goal targets`);
    // ⚠ arm B's named hole: an arrival seeds its ring without a step.
    const seeded = [];
    for (const a of armB.result.arrivals) {
        const cells = entryCells.get(a.level);
        if (!cells) continue;
        const acx = Math.floor((a.boot.x + 8) / lattice);
        const acy = Math.floor((a.boot.y + 8) / lattice);
        for (let dy = -2; dy <= 2; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
                if (cells.has(`${acx + dx},${acy + dy}`)) seeded.push(`L${a.level} ${acx + dx},${acy + dy}`);
            }
        }
    }
    console.log(`   arrival-seeded forbidden cells (arm B's named hole): ${seeded.length}`
        + (seeded.length ? ` — ${[...new Set(seeded)].join(', ')}` : ''));
    console.log('');

    // ── THE DELTA, which is the finding ───────────────────────────────
    const ALL_ITEMS = [...new Set(Object.values(PICKUP_ITEMS))]
        .filter((i) => i !== 'bosskey').concat(ENCOUNTER_ITEMS.map((e) => e.item));
    const itemsOf = (r) => new Set(ALL_ITEMS.filter((i) => r.inventory[i]));
    const keysOf = (r) => new Set([...r.inventory.keys].map((k) => `key${k}`));
    const goalsOf = (r) => new Set([...r.goals].filter(([, v]) => v).map(([k]) => k));

    let stop = false;
    for (const [name, arm] of [['A never-enter', armA], ['B never-touch', armB]]) {
        const lostItems = [...itemsOf(control)].filter((i) => !itemsOf(arm).has(i));
        const lostKeys = [...keysOf(control)].filter((k) => !keysOf(arm).has(k));
        const lostGoals = [...goalsOf(control)].filter((g) => !goalsOf(arm).has(g));
        const lostLevels = control.levels.filter((l) => !arm.levels.includes(l) && !forbid.has(l));
        console.log(`DELTA vs control — arm ${name}:`);
        console.log(`   items lost : ${lostItems.length ? lostItems.join(', ') : 'NONE'}`);
        console.log(`   keys lost  : ${lostKeys.length ? lostKeys.join(', ') : 'NONE'}`);
        console.log(`   goals lost : ${lostGoals.length ? lostGoals.join(', ') : 'NONE'}`);
        console.log(`   levels lost (excluding the three themselves): `
            + `${lostLevels.length ? lostLevels.join(' ') : 'NONE'}`);
        if (lostItems.length || lostKeys.length || lostGoals.length) stop = true;
        console.log('');
    }

    // ── THE BOUND. Never a green without it. ──────────────────────────
    const neverItems = ALL_ITEMS.filter((i) => !control.inventory[i]);
    const neverGoals = [...control.goals].filter(([, v]) => !v).map(([k]) => k);
    console.log('BOUND — what this instrument cannot speak to (unreached in BOTH arms):');
    console.log(`   items : ${neverItems.length ? neverItems.join(', ') : 'none'}`);
    console.log(`   goals : ${neverGoals.length ? neverGoals.join(', ') : 'none'}`);
    console.log(`   levels: ${[...Array(LEVEL_COUNT).keys()]
        .filter((l) => !control.levels.includes(l)).join(' ')}`);
    console.log('\n⇒ these are R5/R6 standing walls (the L40 chain, D8 depth, the End '
        + 'rooms) and are IDENTICAL in both arms, so they are not evidence about the '
        + 'trap rooms in either direction.');

    // ── THE POSITIVE CONTROL. A delta of zero is worth nothing until the
    // instrument has shown it can print a delta that is not zero.
    // (`Bot.as:2027`'s own law: a check that cannot fail is
    // indistinguishable from one that is absent.)
    const pc = Number(opt('positive-control', '20'));
    console.log(`\nPOSITIVE CONTROL — forbid L${pc} the same way and expect a LOSS:`);
    const ctrlArm = fixedPoint(new Set([pc]), null);
    const lostI = [...itemsOf(control)].filter((i) => !itemsOf(ctrlArm).has(i));
    const lostG = [...goalsOf(control)].filter((g) => !goalsOf(ctrlArm).has(g));
    const lostK = [...keysOf(control)].filter((k) => !keysOf(ctrlArm).has(k));
    console.log(`   items lost : ${lostI.length ? lostI.join(', ') : 'NONE'}`);
    console.log(`   keys lost  : ${lostK.length ? lostK.join(', ') : 'NONE'}`);
    console.log(`   goals lost : ${lostG.length ? lostG.join(', ') : 'NONE'}`);
    const armed = lostI.length || lostG.length || lostK.length;
    console.log(`   ⇒ the instrument ${armed ? 'CAN' : '⛔ CANNOT'} report a loss.`);

    console.log(`\nVERDICT: ${stop
        ? '⛔ STOP — the exclusion COSTS something; §6.1 reopens.'
        : armed
            ? '✅ the exclusion costs NOTHING this instrument can see (delta zero, '
                + 'both arms, against a positive control that does register a loss).'
            : '⛔ INCONCLUSIVE — the positive control did not fire, so a zero delta '
                + 'says nothing.'}`);
    for (const t of TRAP_BOSS_LEVELS) console.log(`   L${t.level} (${t.boss}) — ${t.why}`);
    process.exitCode = (stop || !armed) ? 1 : 0;
}

if (flag('trap-boss-flood')) {
    await main();
} else {
    console.log('usage: node scripts/procgen/recon-seedling-r7.mjs --trap-boss-flood [--volumes]');
    process.exitCode = 2;
}
