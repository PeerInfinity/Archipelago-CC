#!/usr/bin/env node
/**
 * probe-seedling-r5-l40-link4 — ⛔⛔⛔ LINK 4's CONSUMER IS THE REST OF THE
 * CHAIN, SO THE CHAIN FROM THE L40 ARRIVAL IS BROKEN.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 17 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §30.9 / §30.10 item 2 and
 * the STEP 1 rule ("identify link 4's actual consumer before pricing").
 * `r5Totem.L40_LINK4` is what slice 16 measured; `r5Totem.L40_ARRIVAL_BREAK`
 * is what this measured.
 *
 * ── ⛔ THE QUESTION THE STEP-1 BRIEF ASKS ─────────────────────────────
 *
 * Slice 16 established that `button@480,384 {t 2}` cannot be opened by this
 * rung's means: no block reaches it, the player cannot hold it and walk
 * through the door it opens, and `Lock.turnOff`'s persistence write is
 * INERT for a grouped lock, so a window boundary does not carry it either.
 * The brief then reads that as a SAME-WINDOW constraint on everything
 * downstream of link 4 — the hold and its consumer would have to share one
 * window — and asks for link 4's ACTUAL CONSUMER before anything is priced.
 *
 * ⛔⛔⛔ **THE CONSUMER IS THE REST OF THE CHAIN, AND THE ANSWER IS THAT
 * THE CHAIN IS BROKEN.** This probe's own first hypothesis was that §24.5
 * numbers the links by the order a walk MEETS them rather than by
 * dependency, so link 4 might be a cul-de-sac with a price tag and the
 * same-window problem might not exist. Measured, it is the opposite:
 *
 * ```
 *   links 1-3 open, link 4 SHUT      844 cells
 *     button@768,400 {t 5}   ⛔ not reached
 *     button@816,400 {t 4}   ⛔ not reached      <- the PULSER's arm
 *   links 1-3 + link 4              1052 cells   (+208)
 *     both buttons           ⛓ reached
 * ```
 *
 * ⛔ THE CELL COUNTS ABOVE ARE SLICE 20's, AND THEY ARE +16 ON SLICE 17's.
 * That slice ran against `ENTITY_CLASSES.iceturret` priced as an
 * unconditional 32x32 solid; `type = "Solid"` is the else-arm of
 * `if (currentAnim != "dead")`, so an ALIVE turret blocks nothing and
 * `iceturret@472,400`'s body was 4x4 phantom nodes in every arm. The +208
 * and every reachability verdict are unchanged — a constant shift in all
 * four arms cannot move a comparison between them.
 *
 * and `button@816,400 {t 4}` is what arms `pulser@592,576`, whose pulse is
 * the ONLY thing that moves `pushableblockfire@576,576` off the boss-key
 * chamber's approach (a fire press from the south drives it NORTH into the
 * plain block, and the cell east of it is the pulser itself). So:
 *
 *     link 4  ->  links 5, 6  ->  link 7  ->  link 8  ->  link 9 (the key)
 *             ->  link 10 (the bosslock)  ->  BOTH north teleporters
 *
 * ⇒ **`bosskey@656,528`, `bosslock@480,352`, `teleporter@944,96 -> L41` and
 * `teleporter@848,0 -> L42` are UNREACHABLE FROM THE L40 ARRIVAL BY THIS
 * RUNG'S MEANS.** §28.9 asked for exactly this and named what would follow:
 * *"if they cannot, the chain from the arrival is not walkable and §24.5's
 * ordering needs a FINDING rather than a route."* This is that finding.
 *
 * ⚠ It does NOT make parts 3 and 4 unprovable — `r5-l40-part0` already
 * boots into a cluster its own arrival cannot reach and says so out loud
 * (§28.5) — but it does mean the WINDOW that reaches them cannot start at
 * `L40 (480,896)`, and no amount of scheduling fixes that.
 *
 * ⚠ Every flood here runs under ONE policy, named in the header of each
 * run and asserted identical between the arms (§28.4): the R5 item set, the
 * tree's tag cleared at build, `avoidVolumes` off. The only thing that
 * varies between arms is the activator set.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40-link4.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { createPushableState, pushableRects } = await import(join(MODULE, 'pushables.js'));
const { L40_CHAIN, L40_LINK4 } = await import(join(MODULE, 'r5Totem.js'));

const levelSource = atlasLevelSource();
const LEVEL = 40;
const LATTICE = L40_CHAIN.lattice;
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const TREE_TAG = 0;
const CHEST = new Set(['chest@880,816']);

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

const rec = levelSource(LEVEL);
const world = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY, cleared: [TREE_TAG] });

let throws = 0;
const compAt = (opts = {}) => {
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
        const c = nodeCentre(cx, cy, LATTICE);
        try {
            return plannerObstacleAt(world, c.x, c.y, null,
                { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
        } catch { throws += 1; return false; }
    };
    const seen = new Set();
    const sx = Math.floor((L40_CHAIN.from.x + 8) / LATTICE);
    const sy = Math.floor((L40_CHAIN.from.y + 8) / LATTICE);
    const frontier = [];
    for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
            if (free(sx + dx, sy + dy)) {
                seen.add(`${sx + dx},${sy + dy}`); frontier.push([sx + dx, sy + dy]);
            }
        }
    }
    while (frontier.length > 0) {
        const [cx, cy] = frontier.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !free(cx + dx, cy + dy)) continue;
            seen.add(k);
            frontier.push([cx + dx, cy + dy]);
        }
    }
    return seen;
};
/**
 * ⛔⛔⛔ R5 SLICE 22: THE TOLERANCE WAS A WHOLE TILE — AND ONE TOLERANCE
 * WAS THE WRONG SHAPE FOR THE QUESTION IN THE FIRST PLACE.
 *
 * This file's `touches()` swept `dx, dy` from -1 to 2: a FOUR-BY-FOUR node
 * window at an 8 px lattice, 32 px across, answering "is the walk anywhere
 * near this" while reading as "the walk gets here". Slice 21 caught it and
 * fixed the COPY in `probe-seedling-r5-l40-kill.mjs`; this one kept the old
 * window for another slice, which is
 * [[feedback_retired_oracle_check_the_regen]] exactly — the guard corrected
 * in the new place and left rotting in the old.
 *
 * ⛔⛔ AND NARROWING IT TO ±1 IS NOT THE FIX EITHER. Driven: under a
 * straddling-cell window `bosslock@480,352`, `pushableblockfire@576,576`
 * and `stairsdown` all flip from REACHED to no — and every one of those is
 * a SOLID. The player can never stand on a solid, so "is the player's cell
 * this cell" is a question with a guaranteed answer, and a probe that asks
 * it of a lock reports the level unreachable no matter how the route goes.
 *
 * ⇒ **THE TOLERANCE IS NOT A NUMBER, IT IS THE CLAIM** — and the claim is
 * different per target:
 *
 *   `overlapsFrom`  — a BUTTON, a TELEPORTER, a PICKUP: things whose effect
 *                     is `collide`, so the question is whether any walkable
 *                     node puts the PLAYER'S 4x5 BOX over the entity's box.
 *                     That is the game's own test, not an approximation of
 *                     it.
 *   `besideFrom`    — a LOCK, a BLOCK, a STAIRCASE: things the player
 *                     stands NEXT TO (and, for a block, pushes). The
 *                     question is whether any walkable node's player box is
 *                     within one lattice step of the entity's box.
 *
 * ⚠ AND THE VERDICTS THIS FILE ASSERTS DO NOT MOVE. Links 4, 5 and 6 read
 * the same under all three windows, so the +208 and "links 5 and 6 are
 * inside it" were right all along; what was wrong was three rows of the
 * TABLE beside them, which is what a later reader would have quoted.
 */
const NODE_BOX = 16;
const nodesNear = (rect, pad) => {
    const out = [];
    const x0 = Math.floor((rect.x - pad) / LATTICE);
    const x1 = Math.floor((rect.right + pad) / LATTICE);
    const y0 = Math.floor((rect.y - pad) / LATTICE);
    const y1 = Math.floor((rect.bottom + pad) / LATTICE);
    for (let cx = x0; cx <= x1; cx += 1) for (let cy = y0; cy <= y1; cy += 1) out.push([cx, cy]);
    return out;
};
/**
 * ⛔⛔ THE RECT IS THE WORLD'S OWN, AND THE FIRST THING THAT FOUND WAS THAT
 * A 16x16 GUESS IS WRONG FOR THE BOSS KEY.
 *
 * A synthetic `16x16 at the .oel point` looked safe — every entity this
 * probe names is placed on a tile — and `bosskey@656,528` is **8x8**
 * (`Pickups/BossKey`'s own `setHitbox`). So the old window was asking about
 * a volume four times the size of the one the game collides, on top of a
 * tolerance two tiles wide. The world already carries every rect; nothing
 * here needs to guess one.
 *
 * ⚠ A FALLBACK IS A NAMED FAILURE, not a default. An entity with no rect in
 * any of the world's four lists is one this probe cannot ask about
 * honestly, and it says so rather than substituting a tile.
 */
const RECTS = () => {
    // ⛔ FIVE LISTS, and `pressers` is the one a first cut leaves out — a
    // `Button`'s press volume is 8x6 at (+4,+5) and a `ButtonRoom`'s is the
    // same, so the 16x16 guess was wrong for the three rows this whole
    // probe is ABOUT. Between the 8x8 boss key and the 8x6 buttons, every
    // named target but the blocks and the locks had the wrong volume.
    const all = [...world.activators, ...world.teleporters, ...world.pickups,
        ...world.pressers, ...world.solids].filter((r) => r && r.rect);
    return (ent) => {
        const w = all.find((r) => r.x === ent.x && r.y === ent.y)
            ?? all.find((r) => r.rect.x >= ent.x && r.rect.x < ent.x + NODE_BOX
                && r.rect.y >= ent.y && r.rect.y < ent.y + NODE_BOX);
        if (!w) {
            throw new Error(`probe-…-l40-link4: no world rect for ${ent.type}@`
                + `${ent.x},${ent.y}. Guessing a 16x16 tile is what made `
                + '`bosskey@656,528` (an 8x8 hitbox) and every `button` (an 8x6 press '
                + 'volume) read as reached from several times their own area — so this '
                + 'refuses rather than defaulting.');
        }
        return w.rect;
    };
};
const rectOf = RECTS();
/** Can a walkable node put the PLAYER'S BOX over this entity's box? */
const overlapsFrom = (comp, rect) => nodesNear(rect, LATTICE).some(([cx, cy]) => {
    if (!comp.has(`${cx},${cy}`)) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    const b = playerBoxAt(c.x, c.y);
    return b.right > rect.x && b.x < rect.right && b.bottom > rect.y && b.y < rect.bottom;
});
/** Can a walkable node put the player's box WITHIN ONE LATTICE STEP of it? */
const besideFrom = (comp, rect) => nodesNear(rect, LATTICE * 2).some(([cx, cy]) => {
    if (!comp.has(`${cx},${cy}`)) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    const b = playerBoxAt(c.x, c.y);
    return b.right >= rect.x - LATTICE && b.x <= rect.right + LATTICE
        && b.bottom >= rect.y - LATTICE && b.y <= rect.bottom + LATTICE;
});
/**
 * ⛔⛔⛔ AND THE KIND IS MEASURED, NOT TABULATED — because the third try at
 * this was wrong too.
 *
 * A hand-written `{button: overlap, teleporter: overlap, …}` table put the
 * two north doors on the overlap arm and they came back UNREACHABLE in
 * every flood. Driven, the reason is not the level: `plannerObstacleAt`
 * reports a TELEPORTER as an obstacle — the planner refuses to route
 * THROUGH a door — so no flood it produces can ever contain a node that
 * overlaps one. "Can the walk overlap this?" asked of a cell the flood
 * excludes by construction is a question with a guaranteed answer, which is
 * the same defect as asking it of a lock, one class along.
 *
 * ⇒ the kind is derived from the PLANNER'S OWN VERDICT: if any node whose
 * player box overlaps the entity is walkable at all, the honest question is
 * OVERLAP (a button, a `ButtonRoom` — things you stand on); if none is, it
 * is BESIDE (a lock, a block, a teleporter, a pickup — things you stand
 * next to, or that the planner will not route into). Nothing is asserted
 * about which class an entity belongs to; the flood's own obstacle function
 * decides, and the row prints which it chose.
 */
const standable = (rect) => nodesNear(rect, LATTICE).some(([cx, cy]) => {
    if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    const b = playerBoxAt(c.x, c.y);
    if (!(b.right > rect.x && b.x < rect.right && b.bottom > rect.y && b.y < rect.bottom)) {
        return false;
    }
    try {
        return plannerObstacleAt(world, c.x, c.y, null,
            { inventory: INVENTORY, avoidVolumes: false }) === null;
    } catch { throws += 1; return false; }
});
const KIND_CACHE = new Map();
const kindOf = (ent) => {
    const k = `${ent.type}@${ent.x},${ent.y}`;
    if (!KIND_CACHE.has(k)) KIND_CACHE.set(k, standable(rectOf(ent)) ? 'overlap' : 'beside');
    return KIND_CACHE.get(k);
};
const touches = (comp, ent) => {
    const rect = rectOf(ent);
    return kindOf(ent) === 'overlap' ? overlapsFrom(comp, rect) : besideFrom(comp, rect);
};
const ents = rec.entities ?? [];
const one = (type, pred = () => true) => ents.find((e) => e.type === type && pred(e));
const NAMED = {
    'link 4  button t2 @480,384': one('button', (e) => Number(e.attrs.tset) === 2),
    'link 5  button t5 @768,400': one('button', (e) => Number(e.attrs.tset) === 5),
    'link 6  button t4 @816,400': one('button', (e) => Number(e.attrs.tset) === 4),
    'link 7  fire block @576,576': one('pushableblockfire', (e) => e.x === 576 && e.y === 576),
    'link 8  plain block @576,560': one('pushableblock', (e) => e.x === 576 && e.y === 560),
    'link 9  bosskey @656,528': one('bosskey'),
    'link 10 bosslock @480,352': one('bosslock'),
    'link 11 buttonroom t0 @272,208': one('buttonroom', (e) => e.x === 272),
    'the L41 door': one('teleporter', (e) => Number(e.attrs.to) === 41),
    'the L42 door': one('teleporter', (e) => Number(e.attrs.to) === 42),
    'stairsdown -> L43': one('stairsdown'),
};
for (const [k, v] of Object.entries(NAMED)) {
    if (!v) throw new Error(`probe-seedling-r5-l40-link4: L${LEVEL} has no ${k}`);
}
// ⛓ Resolve every rect and kind UP FRONT, so a missing one is a failure at
// the top rather than a row that silently never reaches.
const KINDS = Object.fromEntries(Object.entries(NAMED)
    .map(([k, e]) => [k, `${kindOf(e)} ${rectOf(e).w}x${rectOf(e).h}`]));

const withBlocks = (moves = {}) => {
    const st = createPushableState(world);
    for (const [id, pos] of Object.entries(moves)) {
        const b = st.byId.get(id);
        if (!b) throw new Error(`probe-seedling-r5-l40-link4: no pushable ${id}`);
        st.byId.set(id, {
            ...b,
            x: pos.x,
            y: pos.y,
            target: b.family === 'walk'
                ? { x: Math.floor(pos.x / TILE_SIZE), y: Math.floor(pos.y / TILE_SIZE) }
                : { x: pos.x + 8, y: pos.y + 8 },
        });
    }
    return pushableRects(st);
};

/**
 * ── THE TWO ARMS ─────────────────────────────────────────────────────
 *
 * `WITHOUT` is links 1, 2 and 3 — the chest, the burn and the room -1
 * self-latch — and nothing else. `WITH` adds link 4's two Locks by fiat,
 * which is the state slice 16 proved unreachable. The difference is what
 * link 4 BUYS; the WITHOUT arm's own contents are what link 4 COSTS.
 */
const LINK3 = ['wandlock@480,560'];
const LINK4 = ['wandlock@448,432', 'wandlock@512,480'];
const without = compAt({ openChests: CHEST, openActivators: new Set(LINK3) });
const with4 = compAt({ openChests: CHEST, openActivators: new Set([...LINK3, ...LINK4]) });

console.log(`## L${LEVEL} — the chain with link 4 SHUT, against the same chain with it open`);
console.log(`   links 1-3        ${String(without.size).padStart(5)} cells`);
console.log(`   links 1-3 + 4    ${String(with4.size).padStart(5)} cells   `
    + `(+${with4.size - without.size})`);
console.log('');
const table = [];
for (const [k, e] of Object.entries(NAMED)) {
    const a = touches(without, e);
    const b = touches(with4, e);
    table.push({ k, a, b });
    console.log(`   ${k.padEnd(30)} shut ${a ? '⛓ REACHED' : '⛔ no      '}   `
        + `open ${b ? '⛓ REACHED' : '⛔ no'}`);
}

claim(with4.size - without.size === L40_CHAIN.links.find((l) => l.n === 4).gains,
    '⛓ LINK 4 IS STILL WORTH +208 CELLS — the arithmetic §24.5 banked, re-derived',
    `+${with4.size - without.size} against the banked `
    + `${L40_CHAIN.links.find((l) => l.n === 4).gains}. ⚠ Run under ONE policy (§28.4): `
    + 'the R5 item set, the tree cleared at build, `avoidVolumes` off, and the ONLY '
    + 'field that differs between the arms is the two Lock ids.');

const PULSER_ARM = 'link 6  button t4 @816,400';
const GATE = ['link 5  button t5 @768,400', PULSER_ARM];
const T5K = 'link 5  button t5 @768,400';
const row = (k) => table.find((t) => t.k === k);
claim(!row(T5K).a && row(T5K).b && !row(PULSER_ARM).a && !row(PULSER_ARM).b,
    '⛔⛔⛔ LINK 5 IS INSIDE LINK 4\'s +208 — AND LINK 6 IS NOT, which this file used '
    + 'to say it was',
    `with link 4 shut: t5 ${row(T5K).a}, t4 ${row(PULSER_ARM).a}; with it open, `
    + `t5 ${row(T5K).b}, t4 ${row(PULSER_ARM).b}. ⇒ THE ORDERING IS A DEPENDENCY AFTER `
    + 'ALL — this probe set out to show that §24.5 numbers the links by the order a walk '
    + 'MEETS them, so link 4 might be a cul-de-sac with a price tag; it is not. ⛔⛔ AND '
    + 'THE t4 BUTTON IS ONE LINK FURTHER OUT THAN THIS FILE RECORDED: it is behind '
    + '`wandlock@800,400`, whose only opener is the t5 button. Slice 21\'s '
    + '`probe-…-l40-kill.mjs` said so with a ±1 window while this one said the opposite '
    + 'with a 32 px one — and the tolerance was only the first of three errors. The '
    + 'VOLUME was wrong too (a `button`\'s press rect is 8x6 and a `bosskey` is 8x8, not '
    + 'the 16x16 tile this guessed) and so was the QUESTION (a teleporter\'s own cells '
    + 'are refused by `plannerObstacleAt`, so "can the walk stand on it" is unanswerable '
    + 'by construction and had to become "can it stand beside it").');

/**
 * ⛓⛓ AND LINK 4 IS THE *UNIQUE* GATE, which is a different claim from "it
 * is a gate". Every activator in the level opened by fiat EXCEPT link 4's
 * own two Locks: if the two buttons are still unreached, nothing else in
 * L40 can substitute for them.
 */
const allButLink4 = compAt({
    openChests: CHEST,
    openActivators: new Set(world.activators.map((a) => a.id).filter((id) => !LINK4.includes(id))),
});
console.log(`\n## every activator open EXCEPT link 4's two   ${allButLink4.size} cells`);
for (const k of GATE) {
    console.log(`   ${k.padEnd(30)} ${touches(allButLink4, NAMED[k]) ? '⛓ REACHED' : '⛔ no'}`);
}
claim(GATE.every((k) => !touches(allButLink4, NAMED[k])),
    '⛓⛓ …AND NOTHING ELSE IN L40 SUBSTITUTES — every OTHER activator open, still no',
    `${allButLink4.size} cells with ${world.activators.length - LINK4.length} of `
    + `${world.activators.length} activators open, and neither button is in them. A gate `
    + 'that is merely SUFFICIENT is not a finding; this is the necessity arm, and it is '
    + 'what turns "link 4 is unopenable" into "the chain from the arrival stops here".');

claim(!table.find((t) => t.k === 'link 9  bosskey @656,528').a
    && !table.find((t) => t.k === 'link 9  bosskey @656,528').b,
    '⛔ AND THE BOSS KEY IS IN NEITHER ARM — because it is behind a BLOCK, not a flag',
    'the chamber\'s only door is `pushableblock@576,560` and its own approach is the '
    + 'cell `pushableblockfire@576,576` stands in (§ slice 11). Link 4 does not move '
    + 'either of them, so its +208 cells are irrelevant to the key in both directions.');

/**
 * ⛓⛓⛓ AND THE PROOF THAT LINK 4 IS A CUL-DE-SAC: the whole chain driven
 * to its end with link 4's two Locks NEVER opened. If `bosskey`,
 * `bosslock` and both north teleporters come out of it, the itinerary the
 * STEP 1 brief asks for has no same-window constraint to satisfy — there
 * is no hold to schedule.
 */
console.log('\n## the chain PAST link 4, granted by fiat — where the break is, and only there');
const blocksOpen = {
    openChests: CHEST,
    pushables: withBlocks({
        'pushableblockfire@576,576': { x: 560, y: 576 },
        'pushableblock@576,560': { x: 576, y: 32 * TILE_SIZE },
    }),
};
const OA = [...LINK3, 'wandlock@800,400'];
const keyReach = compAt({ ...blocksOpen, openActivators: new Set(OA) });
const lockReach = compAt({ ...blocksOpen, openActivators: new Set([...OA, 'bosslock@480,352']) });
console.log(`   links 5-8 GRANTED (blocks moved)  ${String(keyReach.size).padStart(5)} cells   `
    + `bosskey ${touches(keyReach, NAMED['link 9  bosskey @656,528']) ? '⛓ REACHED' : '⛔ no'}`);
console.log(`   after link 10 (bosslock)          ${String(lockReach.size).padStart(5)} cells   `
    + `L41 ${touches(lockReach, NAMED['the L41 door']) ? '⛓' : '⛔'} `
    + `L42 ${touches(lockReach, NAMED['the L42 door']) ? '⛓' : '⛔'} `
    + `NW ${touches(lockReach, NAMED['link 11 buttonroom t0 @272,208']) ? '⛓' : '⛔'}`);

claim(touches(keyReach, NAMED['link 9  bosskey @656,528'])
    && touches(lockReach, NAMED['the L41 door'])
    && touches(lockReach, NAMED['the L42 door'])
    && touches(lockReach, NAMED['link 11 buttonroom t0 @272,208']),
    '⛓⛓ THE BREAK IS AT LINK 4 AND NOWHERE ELSE — granted, everything after it closes',
    `${lockReach.size} cells with links 5-8 granted by fiat: key, bosslock, both north `
    + 'doors and the NW cluster all come out. ⛔ THAT IS THE POINT: the chain is not '
    + 'broken in several places and it is not broken vaguely. One plain button, whose '
    + 'opening exists only WHILE HELD, whose persistence write is inert because its '
    + 'group is 2, and which no block in the level can reach, is the whole of it. ⇒ the '
    + 'window that collects `totempart 3` and `totempart 4` cannot begin at the L40 '
    + 'arrival, and this is measured rather than inferred.');

claim(throws === 0,
    '⛓ no flood swallowed a `plannerObstacleAt` throw',
    `${throws} — a caught throw returns "blocked", so one bad option turns a flood into `
    + 'a silently EMPTY component that reads like level design.');

claim(L40_LINK4.clearIsInert === true && L40_LINK4.holdTicks === 101,
    '⛓ …and slice 16\'s three refutations are unchanged, asserted rather than remembered',
    `holdTicks ${L40_LINK4.holdTicks}, clearIsInert ${L40_LINK4.clearIsInert}, `
    + `pushReach [${L40_LINK4.pushReach.map((p) => `${p.id} ${p.tiles}`).join(', ')}]. `
    + 'This probe does not reopen them; it asks what they COST.');

let bad = 0;
console.log('');
for (const c of claims) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${claims.length} claims FAILED`);
console.log('\n(a probe — no tape)');
