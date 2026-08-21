#!/usr/bin/env node
/**
 * probe-seedling-shortcut-grade — ⛔⛔⛔ **WHY `SHORTENS` IS NOT REACHABLE ON
 * SEEDLING, EVEN WITH THE `break` VERB REGISTERED.** R9 slice 4 (kickoff
 * §3.5's generator half); the successor to arc 5 slice 5's `probe-rock.mjs`.
 *
 * ── WHAT ARC 5 MEASURED, AND WHAT IT CONCLUDED ────────────────────────
 *
 * `procgen-elements-arc5-kickoff.md` §13.6 put a `breakablerock` on the SHORT
 * ARC of a cycle whose long arc is clear and measured **both arms at 244
 * ticks** against the open room's 129 ⇒ **INERT**. It named the cause:
 *
 *   *"the automatic solver DERIVES no break — a rock press is named by OEL
 *   COORDINATE in a hand-written leg, and `refineStrategy`'s verbs are
 *   `shove` / `weigh` / `kill`. To this solver the rock is a wall, with the
 *   sword and without it."*
 *
 * ⇒ the head was left OUT of `elementSpec.ELEMENT_TABLE`, to be registered
 * *"on the day any ONE of the three walls moves: a derived break verb, a
 * combat ladder that prefers a cheap kill to a long detour, or a
 * non-dialogued goal class."*
 *
 * ── ⛔⛔⛔ WALL 1 HAS MOVED, AND THE GRADE DID NOT ─────────────────────
 *
 * R9 slice 4 registered exactly that verb. Route-survey step 12 — L3, where a
 * `breakablerock` CUTS the room — went REFUSED → SOLVED. **This probe is the
 * same verb asked the shortcut's question, and the answer is unchanged:**
 *
 *     rock on the short arc, post-sword    SOLVED 244   verbs [walk, collect]
 *     rock on the short arc, pre-sword     SOLVED 244   verbs [walk, collect]
 *     control, short arc open              SOLVED 129
 *
 * ⇒ **THE FOURTH WALL, AND IT IS STRUCTURAL RATHER THAN A MISSING VERB:**
 *
 *   **THE SOLVER SPENDS A VERB ONLY WHERE THE CORRIDOR IS *CUT*. A SHORTCUT
 *   IS BY DEFINITION A CELL WHOSE WALLING LEAVES THE GOAL REACHABLE — SO THE
 *   PLANNER NEVER REFUSES, NO OBSTACLE IS EVER RAISED, AND NO VERB IS EVER
 *   SELECTED.**
 *
 * The mechanism is one branch, in `solveSegment`: an obstacle is IDENTIFIED
 * only from a `planError` (`solverBot.js`'s frontier walk runs inside the
 * plan-failure handler). Everything downstream — `OBSTACLE_STRATEGIES`,
 * `refineStrategy`, `STRATEGY_EXECUTORS` — hangs off that refusal. A verb is
 * therefore a way to open a WALL, never a way to take a SHORTER ROUTE.
 *
 * ⛓ **AND THE THEOREM HAS A SECOND BRANCH, WHICH IS THIS PROBE'S FOURTH ARM.**
 * Wall the long arc and the same rock becomes a CUT: the with-sword arm breaks
 * it and solves, the without-sword arm REFUSES BY NAME on the item ⇒ the
 * differential grades it **STRONG**. So on Seedling an item-gated obstacle
 * produces STRONG (cut) or INERT (not cut) and *nothing in between*:
 *
 *   **SHORTENS is unreachable on this substrate until a solver POLICY spends a
 *   registered verb to SHORTEN a route it could already walk.** That is a
 *   route-preference change with a measured cost (it would re-plan every
 *   committed room that holds a clearable obstacle beside an open way round,
 *   i.e. it MOVES TAPES) ⇒ ⚖ an ask, not a slice's to take.
 *
 * ⚠ The MAZE reaches SHORTENS in the same machinery (`procgenMaze
 * .realiseAreaShortcut`, arc 5 §13.7) because its solver is a BFS over an edge
 * graph where an item-locked edge is simply *passable when the item is held* —
 * there is no refusal to hang a verb off, and none is needed. The fifth grade
 * is not unreachable in general; it is unreachable through a REFUSAL-DRIVEN
 * frontier. [[feedback_two_rulings_may_not_compose]]'s shape, one layer down.
 *
 * ⛔ REPORT ONLY. It writes nothing, and it is committed precisely because arc
 * 5's three probes were SCRATCH: §13.18 had to carry them verbatim in prose so
 * the numbers could be re-derived, and this slice paid to rebuild one.
 *
 * Run:
 *   node scripts/procgen/probe-seedling-shortcut-grade.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

const { emptyLevel, withEntities, withTerrain, oelAtTile, bootAtTile } =
    await import(join(MODULE, 'procgenLevel.js'));
const { DEFAULT_BUDGET, GENERATED_BOOT_TIME, collectGoal, solve, bootStaging } =
    await import(join(MODULE, 'procgenOracle.js'));
const { POST_SWORD_ITEMS, PRE_SWORD_ITEMS } = await import(join(MODULE, 'procgenPalette.js'));
const { SEEDLING_DEFAULTS } = await import(join(MODULE, 'procgenSeedling.js'));
const { gradeDifferential } = await import(
    join(MODULE, '..', 'procgenCore', 'differentialGrade.js'));

const LEVEL = SEEDLING_DEFAULTS.level;

/**
 * ARC 5 §13.18's ROOM, REBUILT: a LOOP — short arc along row 1 (x 1..8), long
 * arc along row 5, joined by columns 1 and 8. Start (1,1), goal (8,1).
 *
 * @param {object} o
 * @param {object=} o.rockAt      a `breakablerock` cell, or null
 * @param {boolean=} o.cutLongArc wall the long arc, turning the shortcut into a cut
 */
function room({ rockAt = null, cutLongArc = false } = {}) {
    let rec = emptyLevel({ level: LEVEL });
    const floor = new Set();
    for (let tx = 1; tx <= 8; tx += 1) {
        floor.add(`${tx},1`);
        if (!cutLongArc) floor.add(`${tx},5`);
    }
    if (!cutLongArc) for (let ty = 1; ty <= 5; ty += 1) { floor.add(`1,${ty}`); floor.add(`8,${ty}`); }
    const wall = [];
    for (let ty = 0; ty <= 8; ty += 1) {
        for (let tx = 0; tx <= 8; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    const ents = [{
        type: SEEDLING_DEFAULTS.goalClass,
        ...oelAtTile(8, 1),
        attrs: { tag: SEEDLING_DEFAULTS.goalTag },
    }];
    if (rockAt) {
        ents.push({ type: 'breakablerock', ...oelAtTile(rockAt.tx, rockAt.ty),
            attrs: { tag: '1' } });
    }
    return withEntities(rec, ents);
}

function arm(rec, items, label) {
    const boot = { ...bootAtTile(rec, 1, 1), time: GENERATED_BOOT_TIME };
    try {
        const out = solve(rec, bootStaging({ boot, items, pins: ['dead_frames'] }),
            [collectGoal(8 * 16, 1 * 16)], DEFAULT_BUDGET, { name: label });
        const verbs = (out.trace?.rows ?? []).map((r) => r.strategy?.verb);
        return { label, verdict: out.verdict, ticks: out.ticks ?? null, verbs,
            reason: out.reasonText ?? null };
    } catch (e) {
        return { label, verdict: `THREW:${e.name}`, ticks: null, verbs: [],
            reason: e.message };
    }
}

const rows = [];
const shortcutRoom = room({ rockAt: { tx: 4, ty: 1 } });
const cutRoom = room({ rockAt: { tx: 4, ty: 1 }, cutLongArc: true });

rows.push(arm(shortcutRoom, POST_SWORD_ITEMS, 'SHORTCUT rock, WITH sword'));
rows.push(arm(shortcutRoom, PRE_SWORD_ITEMS, 'SHORTCUT rock, WITHOUT sword'));
rows.push(arm(room({}), POST_SWORD_ITEMS, 'control — short arc OPEN'));
rows.push(arm(cutRoom, POST_SWORD_ITEMS, 'CUT rock, WITH sword'));
rows.push(arm(cutRoom, PRE_SWORD_ITEMS, 'CUT rock, WITHOUT sword'));

console.log('\n## the arms\n');
console.log('| room | verdict | ticks | verbs the trace drove |');
console.log('|---|---|---|---|');
for (const r of rows) {
    console.log(`| ${r.label} | ${r.verdict} | ${r.ticks ?? '—'} | `
        + `${r.verbs.length ? r.verbs.join(', ') : '(none)'} |`);
}

const [scWith, scWithout, , cutWith, cutWithout] = rows;

/**
 * ⛔ THE GRADES ARE ASKED OF `differentialGrade` ITSELF, never spelled here —
 * one arithmetic, both substrates (arc 5 §13.5).
 */
const shortcutGrade = gradeDifferential({
    required: false, withCost: scWith.ticks, withoutCost: scWithout.ticks,
});
const cutGrade = gradeDifferential({
    required: cutWithout.verdict !== 'SOLVED',
    withoutVerdict: cutWithout.verdict,
    withCost: cutWith.ticks,
    withoutCost: cutWithout.verdict === 'SOLVED' ? cutWithout.ticks : null,
});

console.log('\n## the grades, from `differentialGrade` itself\n');
console.log(`  the SHORTCUT room  ->  ${shortcutGrade}`);
console.log(`  the CUT room       ->  ${cutGrade}`);

console.log('\n## the theorem\n');
console.log('  A verb is selected ONLY from a `planError` — the frontier walk that names an');
console.log('  obstacle runs inside `solveSegment`\'s plan-failure handler. A SHORTCUT is by');
console.log('  definition a cell whose walling leaves the goal reachable, so the planner never');
console.log('  refuses and no verb is ever selected. ⇒ on Seedling an item-gated obstacle');
console.log(`  grades ${cutGrade} when it CUTS and ${shortcutGrade} when it does not, and`);
console.log('  nothing in between. SHORTENS needs a solver POLICY that spends a registered');
console.log('  verb to SHORTEN a route it could already walk — a route preference that would');
console.log('  re-plan every committed room holding a clearable obstacle beside an open way');
console.log('  round, i.e. one that MOVES TAPES. ⚖ An ask, not a slice\'s to take.');

if (scWithout.verdict === 'SOLVED' && scWith.ticks !== scWithout.ticks) {
    console.log('\n⛔⛔ THE THEOREM IS REFUTED ON THIS CORPUS — the two shortcut arms differ. '
        + 'Read the table above before believing anything downstream of it.');
    process.exit(1);
}
console.log('\nall arms as the theorem predicts');
