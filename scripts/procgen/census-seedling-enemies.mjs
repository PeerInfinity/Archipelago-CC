#!/usr/bin/env node
/**
 * census-seedling-enemies — **ONE ENEMY IN ONE CHAMBER, AND WHAT THE SOLVER
 * DOES ABOUT IT** (PROCGEN ELEMENTS arc 3, slice 4d, D5; ⚖ design ruling 19).
 *
 * ⛔⛔ **NOTHING IS ASSERTED FROM THIS FILE.** Design §5's catalogue carries a
 * STATUS column — "route-modelled", "measure", "?", "R9+" — and ruling 19 makes
 * the *plain obstacle* set a MEASUREMENT rather than a judgement: *"a plain
 * obstacle is anything the solver has a RELIABLE strategy for (MEASURED)"*. So
 * this is a TABLE. It promotes nothing, it gates nothing, and a class that
 * REFUSES here is reported as refusing rather than as excluded.
 *
 * ── THE ROOM, HAND-DRAWN AND THE SAME FOR EVERY CLASS ─────────────────
 *
 * A 10x10 bordered room whose ONLY route from the start to the goal runs
 * through a 6x6 open chamber:
 *
 *      0123456789
 *    0 ##########
 *    1 #S########      S = start (1,1)
 *    2 #.######.#      the corridor cell (1,2) is the chamber's mouth
 *    3 #........#      x 2..7 y 2..7 = the CHAMBER (6x6)
 *    4 #........#      the body stands at its CENTRE (4,4)
 *    5 #........#
 *    6 #........#
 *    7 #........#
 *    8 #######.G#      G = goal (8,8), reached only through (8,7)
 *    9 ##########
 *
 * ⛔ THE ROUTE IS FORCED BY CONSTRUCTION, which is the whole point: a body in
 * the chamber cannot be walked around outside it, so *"the solve reached the
 * goal"* really is *"the solver got past this class"*. The CONTROL is the same
 * room with no body at all, and an outcome that differs from the control is the
 * body's.
 *
 * ── THE SPINNER GETS A SECOND ROW ─────────────────────────────────────
 *
 * The KILL GATE's geometry is not a chamber — it is a 1-cell nub beside a
 * corridor with a `tset:-1` lock in the cut (arc 3, slice 4a) — and §9b.3
 * measured that 79% of that arrangement's throws happen at a ONE-neighbour
 * pocket. So the spinner is measured in BOTH: the chamber, like every other
 * class, and the nub, which is where the generator actually puts it.
 *
 * ── ⚠ WHAT THE COLUMNS ARE, AND WHAT THEY ARE NOT ─────────────────────
 *
 * `outcome`/`ticks`/`strategies`/`obstacle` come from the SOLVE and are
 * observations. `roster`/`as3`/`modelled`/`spellable` come from the ENGINE's
 * own tables (`levelWorld.ENTITY_CLASSES`, `spinner.MODELLED_ENEMY_CLASSES`,
 * `watchEdit.ENTITY_ROSTER`) and are facts about the code, read rather than
 * judged. ⛔ THE DANGER-MAP KIND IS **DERIVED FROM THE ROSTER THE BODY JOINS**,
 * not observed from a live run: `dangerMap`'s producers are keyed on
 * `run.spinners` / `run.chasers` / `run.crushers` / `run.enemies` / `run.hazards`
 * and `solve` does not hand back the run. It is labelled `(derived)` for that
 * reason rather than presented as a reading.
 *
 * Run:
 *   node scripts/procgen/census-seedling-enemies.mjs
 *   node scripts/procgen/census-seedling-enemies.mjs --json=/tmp/enemies.json
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..'));
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));

const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await M('procgenLevel.js');
const { DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve } =
    await M('procgenOracle.js');
const { POST_SWORD_ITEMS } = await M('procgenPalette.js');
const { SEEDLING_DEFAULTS } = await M('procgenSeedling.js');
const { ENTITY_CLASSES } = await M('levelWorld.js');
const { MODELLED_ENEMY_CLASSES } = await M('spinner.js');
const { ENTITY_ROSTER_TYPES } = await M('watchEdit.js');

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(`--${n}=`.length);
const say = (l = '') => process.stdout.write(`${l}\n`);

const LEVEL = SEEDLING_DEFAULTS.level;
const START = { tx: 1, ty: 1 };
const GOAL = { tx: 8, ty: 8 };
const CHAMBER = { x0: 2, y0: 2, x1: 7, y1: 7 };
const CENTRE = { tx: 4, ty: 4 };

/** The hand-drawn room. ⛓ Built by WALLING an open room, so the only floor is
 *  what the diagram in the docblock shows. */
function room() {
    let rec = emptyLevel({ level: LEVEL });
    const wall = [];
    const floor = new Set([`${START.tx},${START.ty}`, '1,2', `${GOAL.tx},${GOAL.ty}`, '8,7']);
    for (let y = CHAMBER.y0; y <= CHAMBER.y1; y += 1) {
        for (let x = CHAMBER.x0; x <= CHAMBER.x1; x += 1) floor.add(`${x},${y}`);
    }
    for (let ty = 1; ty <= 8; ty += 1) {
        for (let tx = 1; tx <= 8; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [{
        type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(GOAL.tx, GOAL.ty),
        attrs: { tag: SEEDLING_DEFAULTS.goalTag },
    }]);
}

/**
 * ⛓⛓⛓ **THE CORRIDOR ARM, AND IT EXISTS BECAUSE THE CHAMBER ARM CAME BACK
 * VACUOUS.** The brief's room is a 6x6 chamber with the body at its centre, and
 * the first run of this file answered **SOLVED in 251 ticks for 20 of 23
 * classes — the CONTROL's own tick count, exactly**. That is not "the solver
 * got past it": it is *the planner walked around it and the body was never on
 * the route*. Identical ticks against a control is the same INERT signal the
 * requirements differential reads, and a table of twenty rows all reading it
 * would have measured the ROOM.
 *
 * ⇒ a second arm the route CANNOT avoid: a 1-wide L corridor from the start to
 * the goal with the body standing IN it. Both arms are published — the chamber
 * one is the measurement that *a body in open space is not an obstacle at all*,
 * which is a fact design §5's "plain obstacle" column wants, and the corridor
 * one is the measurement of what happens when it must be dealt with.
 */
function corridorRoom(cls) {
    let rec = emptyLevel({ level: LEVEL });
    const floor = new Set();
    for (let x = 1; x <= 8; x += 1) floor.add(`${x},1`);
    for (let y = 1; y <= 8; y += 1) floor.add(`8,${y}`);
    const wall = [];
    for (let ty = 1; ty <= 8; ty += 1) {
        for (let tx = 1; tx <= 8; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    const ents = [{ type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 8),
        attrs: { tag: SEEDLING_DEFAULTS.goalTag } }];
    if (cls) {
        ents.push({ type: cls, ...oelAtTile(4, 1), ...(ATTRS[cls] ? { attrs: ATTRS[cls] } : {}) });
    }
    return withEntities(rec, ents);
}

/**
 * ⛓ THE SPINNER'S OWN GEOMETRY — a corridor with a `tset:-1` lock in the cut
 * and the body in a ONE-NEIGHBOUR NUB beside it. This is what the KILL GATE
 * builds, and §9b.3's throw class lives here rather than in a chamber.
 */
function nubRoom() {
    let rec = emptyLevel({ level: LEVEL });
    const floor = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '6,1', '7,1', '8,1',
        '8,2', '8,3', '3,2']);
    const wall = [];
    for (let ty = 1; ty <= 8; ty += 1) {
        for (let tx = 1; tx <= 8; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 3),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'lock', ...oelAtTile(5, 1), attrs: { tset: '-1', tag: '1' } },
        { type: 'spinner', ...oelAtTile(3, 2), attrs: { tag: '-1' } },
    ]);
}

/**
 * ⛓ THE CLASSES — read from the ENGINE's own table, never a hand list. Every
 * `ENTITY_CLASSES` row whose AS3 `type` is `"Enemy"` (the damage-dealing bodies)
 * plus the three PUZZLEMENT bodies that are enemies in everything but the field:
 * the crusher, the spinning axe and the arrow trap.
 */
const NAMED_EXTRAS = Object.freeze(['crusher', 'spinningaxe', 'arrowtrap', 'lavachain']);
const CLASSES = Object.keys(ENTITY_CLASSES)
    .filter((k) => ENTITY_CLASSES[k].type === 'Enemy' || NAMED_EXTRAS.includes(k))
    .sort();

/**
 * ⛓ WHICH `dangerMap` PRODUCER WOULD PRICE THIS BODY, derived from the roster
 * `levelWorld` puts it in. ⛔ DERIVED, not observed — see the file docblock.
 */
const DANGER_BY_CLASS = Object.freeze({
    spinner: 'spinner (dangerMap.spinnerDanger)',
    bob: 'chaser (dangerMap.chaserDanger)',
    jellyfish: 'chaser (dangerMap.chaserDanger)',
    crusher: 'crusher (dangerMap.crusherDanger)',
    arrowtrap: 'arrow/arrowLane (dangerMap.arrowDanger)',
});
const dangerOf = (cls) => DANGER_BY_CLASS[cls] ?? 'enemy (dangerMap.staticEnemyDanger)';

const ATTRS = Object.freeze({
    spinner: { tag: '-1' },
    arrowtrap: { shoot: '1', tset: '0' },
});

function attempt(record, name, goalAt = null) {
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: POST_SWORD_ITEMS,
        pins: ['dead_frames'],
        time: GENERATED_BOOT_TIME,
    });
    const goalCell = goalAt ?? (name === 'spinner@nub' ? { tx: 8, ty: 3 } : GOAL);
    try {
        const out = solve(record, staging, [collectGoal(goalCell.tx * 16, goalCell.ty * 16)],
            DEFAULT_BUDGET, { name: `enemy-census-${name}`, scratchPersistence: true });
        return {
            outcome: out.verdict,
            certified: out.certification?.certified ?? null,
            ticks: out.ticks ?? null,
            strategies: [...new Set((out.records ?? []).map((r) => r.strategy).filter(Boolean))],
            obstacle: out.obstacle ? JSON.stringify(out.obstacle).slice(0, 60) : null,
            reason: (out.reasonText ?? '').slice(0, 90) || null,
        };
    } catch (e) {
        return { outcome: `THREW:${e.name}`, certified: null, ticks: null, strategies: [],
            obstacle: null, reason: String(e.message).split('\n')[0].slice(0, 90) };
    }
}

const rows = [];
rows.push({ cls: '(control — empty chamber)', ...attempt(room(), 'control') });
rows.push({ cls: '(control — empty corridor)', ...attempt(corridorRoom(null), 'control-corridor') });
for (const cls of CLASSES) {
    const rec = withEntities(room(), [{ type: cls, ...oelAtTile(CENTRE.tx, CENTRE.ty),
        ...(ATTRS[cls] ? { attrs: ATTRS[cls] } : {}) }]);
    const corr = attempt(corridorRoom(cls), `${cls}@corridor`);
    rows.push({
        cls,
        as3: ENTITY_CLASSES[cls].as3,
        modelled: Object.keys(MODELLED_ENEMY_CLASSES)
            .some((k) => k.toLowerCase() === cls) ? 'yes' : 'no',
        spellable: ENTITY_ROSTER_TYPES.includes(cls) ? 'yes' : 'no',
        danger: dangerOf(cls),
        ...attempt(rec, cls),
        corridor: corr,
    });
}
rows.push({ cls: 'spinner@nub', as3: 'Spinner', modelled: 'yes',
    spellable: 'yes', danger: dangerOf('spinner'), ...attempt(nubRoom(), 'spinner@nub') });

say('# census-seedling-enemies — ⚖ design ruling 19, and it asserts NOTHING');
say('');
say(`room: 10x10, ONE route start (1,1) -> a 6x6 chamber (2,2)..(7,7) -> goal (8,8); `
    + `the body stands at (${CENTRE.tx},${CENTRE.ty}). Boot post-sword, budget `
    + `maxTicksPerTarget=${DEFAULT_BUDGET.maxTicksPerTarget}.`);
say(`classes: every \`levelWorld.ENTITY_CLASSES\` row whose AS3 type is "Enemy", plus `
    + `[${NAMED_EXTRAS.join(', ')}] — **${CLASSES.length}** of them, read from the table.`);
say('');
say('| class | AS3 | stepper? | palette can SPELL | danger kind (derived) | CHAMBER '
    + '| ticks | CORRIDOR | ticks | strategies (corridor) | the corridor solve\'s own words |');
say('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const c = r.corridor ?? null;
    say(`| \`${r.cls}\` | ${r.as3 ?? '-'} | ${r.modelled ?? '-'} | ${r.spellable ?? '-'} `
        + `| ${r.danger ?? '-'} | **${r.outcome}** | ${r.ticks ?? '-'} `
        + `| ${c ? `**${c.outcome}**` : '-'} | ${c ? (c.ticks ?? '-') : '-'} `
        + `| ${(c ? c.strategies : r.strategies).join(', ') || '-'} `
        + `| ${((c ? c.reason : r.reason) ?? '-').replace(/\|/g, '/')} |`);
}
say('');
const by = {};
const byCorridor = {};
for (const r of rows) {
    by[r.outcome] = (by[r.outcome] ?? 0) + 1;
    if (r.corridor) byCorridor[r.corridor.outcome] = (byCorridor[r.corridor.outcome] ?? 0) + 1;
}
say(`## ROLL-UP`);
say('');
say(`CHAMBER arm:  ${JSON.stringify(by)}`);
say(`CORRIDOR arm: ${JSON.stringify(byCorridor)}`);
const chamberControl = rows[0].ticks;
const inert = rows.filter((r) => r.corridor && r.ticks === chamberControl).length;
say('');
say(`⛓⛓ **${inert} of ${CLASSES.length} CHAMBER rows solve at the CONTROL'S OWN TICK COUNT `
    + `(${chamberControl})** — the body was never on the route. A 6x6 chamber does not make `
    + 'a body an obstacle; the corridor arm is where the question is actually asked.');
say('');
say('⛔ Nothing here promotes a class. Design §5 marks several of these `?` or `R9+`; a row '
    + 'that SOLVED is reported as having solved THIS room at THIS budget, which is not the '
    + 'same claim as "the generator may place it".');

/**
 * ⛓⛓⛓ **THE ARENA ARM — AN AXIS, PRINTED ONLY WHEN ASKED** (PROCGEN ELEMENTS
 * arc 5, slice 4: D0's cost probe and D2's plain-enemy measurement).
 *
 * ⛔ OMIT `--arena=` AND THIS FILE'S OUTPUT IS BYTE-IDENTICAL. A census that
 * grew a block nobody requested would make every previously published number's
 * command produce a different table (slice 3's rule, one instrument over).
 *
 * ── THE ROOM ──────────────────────────────────────────────────────────
 *
 * The ARENA's own shape, hand-drawn so the two variables are the only things
 * that move: a corridor from the start to the goal with a `tset:-1` LOCK in a
 * cut cell, and a 5x5 open blob hanging off it through ONE mouth, with `n`
 * bodies standing in the blob. That is what `procgenCore/elements/arena.js`
 * plus the binding's kill lock build, with the room's own noise removed.
 *
 *      0123456789
 *    0 ##########
 *    1 #S..L...G#     S start (1,1) · L the kill lock (4,1) · G goal (8,1)
 *    2 #.########     the mouth is (1,2); the blob is x1..5 y3..7
 *    3 #......###
 *    4 #......###     ⛓ the bodies stand in the blob, spread from its far
 *    5 #......###       corner inwards, which is where the element's own
 *    6 #......###       draw puts them on average
 *    7 #......###
 *    8 ##########
 *    9 ##########
 *
 * ── ⚖ RULING 9: COST BEFORE THE DOMAIN ───────────────────────────────
 *
 * `--arena=1,2,3` runs the same room at each body count and prints TICKS and
 * WALL CLOCK beside the outcome, because §7c's warning is a cost one: one
 * corridor spinner is 84 ms/tick in `deriveStrike` (probe 2b) and the worst
 * 10x10 kill-gate certification is already 126 s.
 *
 * ── ⛓ AND THE `nolock` ARM IS D2's MEASUREMENT AND MUTANT (a)'s CONTROL ──
 *
 * The same room with the LOCK REMOVED, per class. Arc-3 §18.2 A10 says what
 * to expect — *a live spinner refuses the collect ceremony outright* — and a
 * class that certifies WITHOUT a lock would be the finding.
 */
const ARENA = arg('arena', '');
if (ARENA) {
    const counts = ARENA.split(',').map(Number);
    const blob = [];
    for (let y = 3; y <= 7; y += 1) for (let x = 1; x <= 5; x += 1) blob.push({ tx: x, ty: y });
    const arenaRoom = (n, cls, { lock = true } = {}) => {
        let rec = emptyLevel({ level: LEVEL });
        const floor = new Set(['1,2', ...blob.map((c) => `${c.tx},${c.ty}`)]);
        for (let x = 1; x <= 8; x += 1) floor.add(`${x},1`);
        const wall = [];
        for (let ty = 1; ty <= 8; ty += 1) {
            for (let tx = 1; tx <= 8; tx += 1) {
                if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
            }
        }
        rec = withTerrain(rec, wall);
        const ents = [{ type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 1),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag } }];
        if (lock) ents.push({ type: 'lock', ...oelAtTile(4, 1), attrs: { tset: '-1', tag: '1' } });
        /** ⛓ FROM THE FAR CORNER INWARDS — a fixed order, so `n` is the only
         *  thing that differs between two rows of this table. */
        for (let i = 0; i < n; i += 1) {
            const c = blob[blob.length - 1 - i];
            ents.push({ type: cls, ...oelAtTile(c.tx, c.ty),
                ...(ATTRS[cls] ? { attrs: ATTRS[cls] } : {}) });
        }
        return withEntities(rec, ents);
    };
    /** ⛓ THE GOAL IS THIS ROOM'S OWN (8,1), NOT the chamber arm's (8,8) — a
     *  fixture solved against somebody else's goal cell refuses for a reason
     *  that has nothing to do with the body. */
    const timed = (record, name) => {
        const t0 = Date.now();
        const out = attempt(record, name, { tx: 8, ty: 1 });
        return { ...out, ms: Date.now() - t0 };
    };
    say('');
    say('## ⛓⛓⛓ THE ARENA ARM — ⚖ arc-5 ruling 9, cost BEFORE the domain');
    say('');
    say('room: a corridor start (1,1) -> goal (8,1) with a `tset:-1` LOCK at (4,1), and a 5x5 '
        + 'blob (1,3)..(5,7) hanging off the mouth (1,2). The bodies stand in the blob, from '
        + 'its far corner inwards. Boot post-sword. ⛔ The GOAL row is the control: the same '
        + 'room with no lock and no body.');
    say('');
    say('| arm | bodies | outcome | ticks | ms | strategies | the solve\'s own words |');
    say('|---|---|---|---|---|---|---|');
    const control = timed(arenaRoom(0, 'spinner', { lock: false }), 'arena-control');
    say(`| control (no lock, no body) | 0 | **${control.outcome}** | ${control.ticks ?? '-'} `
        + `| ${control.ms} | ${control.strategies.join(', ') || '-'} `
        + `| ${(control.reason ?? '-').replace(/\|/g, '/')} |`);
    for (const n of counts) {
        const r = timed(arenaRoom(n, 'spinner'), `arena-spinner-${n}`);
        say(`| \`arena\` + kill lock | ${n} | **${r.outcome}** | ${r.ticks ?? '-'} | ${r.ms} `
            + `| ${r.strategies.join(', ') || '-'} | ${(r.reason ?? '-').replace(/\|/g, '/')} |`);
    }
    say('');
    say('### ⛓ THE `nolock` ARM — D2, the PLAIN enemy obstacle, per class');
    say('');
    say('the same blob, ONE body, and **no lock at all**. ⛓ Arc-3 §18.2 A10 predicts the '
        + 'ceremony refusal; a class that certifies here is one the arena could host without '
        + 'a kill lock, and the table is what says which.');
    say('');
    say('| class | with the LOCK | ticks | NO lock | ticks | the no-lock solve\'s own words |');
    say('|---|---|---|---|---|---|');
    for (const cls of CLASSES) {
        const withLock = timed(arenaRoom(1, cls), `arena-${cls}`);
        const noLock = timed(arenaRoom(1, cls, { lock: false }), `arena-nolock-${cls}`);
        say(`| \`${cls}\` | **${withLock.outcome}** | ${withLock.ticks ?? '-'} `
            + `| **${noLock.outcome}** | ${noLock.ticks ?? '-'} `
            + `| ${(noLock.reason ?? '-').replace(/\|/g, '/')} |`);
    }
    say('');
}

const OUT = arg('json', '');
if (OUT) {
    writeFileSync(OUT, `${JSON.stringify({ budget: DEFAULT_BUDGET, classes: CLASSES, rows }, null, 2)}\n`);
    process.stderr.write(`[stderr] wrote ${OUT}\n`);
}
