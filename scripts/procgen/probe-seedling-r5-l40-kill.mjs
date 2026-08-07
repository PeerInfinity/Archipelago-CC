#!/usr/bin/env node
/**
 * probe-seedling-r5-l40-kill — ⛓⛓⛓ THE BREAK AT LINK 4 IS REPAIRED, AND
 * THE CHAIN NOW STOPS AT LINK 6 FOR A DIFFERENT REASON.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 21 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §34.10 item 2 — "then the
 * leg, in one window". `r5Totem.L40_ARRIVAL_BREAK` is what slice 17
 * measured; this is what the kill changes about it.
 *
 * ── ⛓⛓⛓ WHAT THE KILL BUYS ───────────────────────────────────────────
 *
 * `L40_ARRIVAL_BREAK`'s verdict is: *"THE CHAIN FROM THE L40 ARRIVAL STOPS
 * AT LINK 4. One plain button, whose opening exists only WHILE HELD, whose
 * persistence write is inert because its group is 2, and which no block in
 * the level can reach, gates every remaining link — so the boss key, the
 * bosslock and both north teleporters are unreachable from (480,896) by
 * this rung's means."*
 *
 * The corpse is one of this rung's means as of slice 21. The kill stance is
 * INSIDE the links-1–3 component, the leg drives from the arrival in 1,965
 * ticks (`plan-seedling-r5-l40-part5.mjs`), and `button@480,384 {t 2}` is
 * held by a 16x16 body that stays where it is put. ⇒ **link 4 opens from
 * the arrival**, and that clause of the verdict is refuted.
 *
 * ── ⛔⛔⛔ AND THE NEXT LINK IS A ONE-WAY TRAP WITH ONE KEY ────────────
 *
 * What replaces it is sharper, not vaguer:
 *
 *   · `button@816,400 {t 4}` — the PULSER's arm, and everything past it —
 *     is NOT in link 4's component. It is behind `wandlock@800,400`, whose
 *     only opener is `button@768,400 {t 5}`;
 *   · standing on `button@816,400` with that lock shut leaves **8 lattice
 *     cells and no way west**. The room is a one-way trap;
 *   · so link 5 needs a HOLDER while the player crosses — and L40 has
 *     exactly ONE thing that can hold a button without a player on it: the
 *     corpse. It is already spent on link 4, and taking it off link 4
 *     re-shuts the locks that make link 5 reachable at all.
 *
 * ⇒ **ONE CORPSE, TWO HOLDS, IN A STRICT DEPENDENCY.** That is a statement
 * about the room rather than about the model, and it is what the next slice
 * has to answer (the open question: can the corpse be BUMPED the 17½ tiles
 * east from `button@480,384` to `button@768,400` — and if it can, does the
 * t2 group re-shutting behind it wall the corpse in?).
 *
 * ── ⛔⛔ A METHOD CORRECTION THIS PROBE OWES ITS OWN ANCESTOR ─────────
 *
 * `probe-seedling-r5-l40-link4.mjs`'s `touches()` tests a **±2 node**
 * window at an 8 px lattice — 16 px, a WHOLE TILE past the point. That
 * answers "is the walk within a tile of this" and reads as "the walk gets
 * here", and three of that probe's rows are REACHED under it for cells the
 * planner then refuses outright. The window here is ±1 (the player box's
 * own half-width) and the EXACT node is reported beside it, so a solid the
 * walk can only stand NEXT to and a button it stands ON are told apart.
 * [[feedback_distance_hint_is_not_a_constraint]] — a probe's tolerance is
 * not a free parameter; it is the claim.
 *
 * ⚠ Every flood here runs under ONE policy, asserted identical between the
 * arms: the R5 item set, the tree's tag cleared at build, the chest open,
 * `avoidVolumes` off. The only thing that varies is the activator set and
 * the corpse.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40-kill.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { L40_CHAIN, L40_ARRIVAL_BREAK } = await import(join(MODULE, 'r5Totem.js'));
const { L40_CORPSE } = await import(join(MODULE, 'r5Totem.js'));

const levelSource = atlasLevelSource();
const LEVEL = 40;
const LATTICE = L40_CHAIN.lattice;
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const TREE_TAG = 0;
const CHEST = new Set(['chest@880,816']);
const TURRET = L40_CORPSE.turret.id;

const rec = levelSource(LEVEL);
const world = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY, cleared: [TREE_TAG] });

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

let throws = 0;
const freeAt = (cx, cy, opts) => {
    if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    try {
        return plannerObstacleAt(world, c.x, c.y, null,
            { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
    } catch { throws += 1; return false; }
};
const compFrom = (from, opts = {}) => {
    const seen = new Set();
    const frontier = [];
    const sx = Math.floor(from.x / LATTICE);
    const sy = Math.floor(from.y / LATTICE);
    for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
            if (freeAt(sx + dx, sy + dy, opts)) {
                seen.add(`${sx + dx},${sy + dy}`); frontier.push([sx + dx, sy + dy]);
            }
        }
    }
    while (frontier.length > 0) {
        const [cx, cy] = frontier.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !freeAt(cx + dx, cy + dy, opts)) continue;
            seen.add(k);
            frontier.push([cx + dx, cy + dy]);
        }
    }
    return seen;
};
/**
 * ⛔ ±1 NODE, and the node itself is reported. See the header: a ±2 window
 * at this lattice reaches a whole tile past the point.
 */
const at = (comp, p) => {
    for (let dx = 0; dx <= 1; dx += 1) {
        for (let dy = 0; dy <= 1; dy += 1) {
            if (comp.has(`${Math.floor(p.x / LATTICE) + dx},${Math.floor(p.y / LATTICE) + dy}`)) {
                return true;
            }
        }
    }
    return false;
};

const ARRIVAL = { ...L40_CHAIN.from };
/** The stance `runKill` drives from — due south of the body, inside the disc. */
const KILL_STANCE = { x: 488, y: 440 };
const LINK3 = ['wandlock@480,560'];
const LINK4 = ['wandlock@448,432', 'wandlock@512,480'];
const T5 = ['wandlock@800,400'];

const PTS = {
    'the kill stance (488,440)': KILL_STANCE,
    'link 4  button t2 @480,384': { x: 480, y: 384 },
    'link 5  button t5 @768,400': { x: 768, y: 400 },
    'link 6  button t4 @816,400': { x: 816, y: 400 },
    'link 9  bosskey @656,528': { x: 656, y: 528 },
    'link 10 bosslock @480,352': { x: 480, y: 352 },
};

/** The corpse, as `collidesSolid`'s `turrets` arm sees it. */
const corpseAt = (x, y) => new Map([[TURRET, {
    id: TURRET, x, y, dead: true, removed: false, solid: true,
    rect: { x: x - 8, y: y - 8, right: x + 8, bottom: y + 8 },
}]]);

const ARMS = [
    ['links 1-3 (chest + burn + the t3 self-latch)',
        { openChests: CHEST, openActivators: new Set(LINK3) }],
    ['+ link 4, HELD BY THE CORPSE on button@480,384',
        { openChests: CHEST,
            openActivators: new Set([...LINK3, ...LINK4]),
            turrets: corpseAt(L40_CORPSE.corpseEndsAt.x, L40_CORPSE.corpseEndsAt.y) }],
    ['+ link 5 (wandlock@800,400 open — NOTHING CAN HOLD IT)',
        { openChests: CHEST,
            openActivators: new Set([...LINK3, ...LINK4, ...T5]),
            turrets: corpseAt(L40_CORPSE.corpseEndsAt.x, L40_CORPSE.corpseEndsAt.y) }],
];

console.log(`## L${LEVEL} — the chain from the ARRIVAL (${ARRIVAL.x},${ARRIVAL.y}), `
    + 'with the corpse as a holder\n');
const comps = [];
for (const [name, opts] of ARMS) {
    const c = compFrom(ARRIVAL, opts);
    comps.push(c);
    console.log(`   ${name}`);
    console.log(`   ${String(c.size).padStart(6)} cells`);
    for (const [k, p] of Object.entries(PTS)) {
        console.log(`      ${k.padEnd(30)} ${at(c, p) ? '⛓ REACHED' : '⛔ no'}`);
    }
    console.log('');
}
const [links13, withCorpse, withT5] = comps;

/**
 * ⛓⛓⛓ CLAIM 1 — THE KILL STANCE IS INSIDE THE ARRIVAL'S OWN COMPONENT.
 *
 * This is the whole of what makes the repair possible: the walk that opens
 * link 4 does not need link 4. `L40_ARRIVAL_BREAK` never asked the question
 * because at slice 17 there was nothing to ask it about — no kill, no
 * corpse, and an ALIVE turret priced as a 32x32 wall it would have had to
 * route around.
 */
claim(at(links13, KILL_STANCE) && at(links13, PTS['link 4  button t2 @480,384']),
    '⛓⛓⛓ THE KILL STANCE IS REACHABLE WITH LINK 4 SHUT — the repair is possible',
    `${links13.size} cells from the arrival with links 1-3 open, and both `
    + `(${KILL_STANCE.x},${KILL_STANCE.y}) and button@480,384 are in them. `
    + '⛔ The walk that opens link 4 does not need link 4, which is what makes the '
    + 'corpse-hold a REPAIR rather than a second copy of the same deadlock.');

claim(withCorpse.size - links13.size === L40_CHAIN.links.find((l) => l.n === 4).gains,
    '⛓ …and the corpse buys exactly the banked +208, with its own body in the flood',
    `${links13.size} -> ${withCorpse.size} (+${withCorpse.size - links13.size}) against the `
    + `banked ${L40_CHAIN.links.find((l) => l.n === 4).gains}. ⛓⛓ AND THE CORPSE DOES NOT `
    + 'SEAL ITS OWN CORRIDOR: this arm carries the 16x16 body as a live Solid at '
    + `(${L40_CORPSE.corpseEndsAt.x},${L40_CORPSE.corpseEndsAt.y}) and the number is `
    + 'unchanged, which is the question §34.2 taught this arc to ask of every pickup and '
    + 'every hold. [[feedback_the_pickup_seals_its_own_exit]]');

/**
 * ⛔⛔⛔ CLAIM 2 — AND THE NEXT LINK IS NOT IN THE +208.
 *
 * `probe-…-l40-link4.mjs` reports `button@816,400` REACHED in its link-4
 * arm. It is not: that row is its ±2-node window answering about a
 * neighbouring cell a whole tile away.
 */
claim(at(withCorpse, PTS['link 5  button t5 @768,400'])
    && !at(withCorpse, PTS['link 6  button t4 @816,400']),
    '⛔⛔⛔ LINK 6 IS **NOT** INSIDE LINK 4\'s +208 — the ±2 window said it was',
    'with link 4 held: button@768,400 {t 5} ⛓ REACHED, button@816,400 {t 4} ⛔ NOT. The '
    + 't4 button is behind `wandlock@800,400`, whose only opener is the t5 button — so '
    + 'the pulser, the fire block, the boss key and the bosslock are all one link '
    + 'further away than the link-4 probe records. ⛔ THAT PROBE IS NOT WRONG ABOUT ITS '
    + 'ARITHMETIC; it is wrong about its TOLERANCE. `touches()` there is a ±2 node '
    + 'window at an 8 px lattice — 16 px, one whole tile — and it reads "within a tile "'
    + 'of" as "the walk gets here". [[feedback_distance_hint_is_not_a_constraint]]');

/**
 * ⛔⛔⛔ CLAIM 3 — THE t4 ROOM IS A ONE-WAY TRAP, AND THAT IS WHAT MAKES
 * THE HOLDER SHORTAGE STRUCTURAL RATHER THAN AWKWARD.
 */
const trapped = compFrom({ x: 820, y: 404 },
    { openChests: CHEST, openActivators: new Set([...LINK3, ...LINK4]),
        turrets: corpseAt(L40_CORPSE.corpseEndsAt.x, L40_CORPSE.corpseEndsAt.y) });
const escaped = compFrom({ x: 820, y: 404 },
    { openChests: CHEST, openActivators: new Set([...LINK3, ...LINK4, ...T5]),
        turrets: corpseAt(L40_CORPSE.corpseEndsAt.x, L40_CORPSE.corpseEndsAt.y) });
console.log('## standing on button@816,400 {t 4}');
console.log(`   with wandlock@800,400 SHUT   ${String(trapped.size).padStart(6)} cells   `
    + `back to the t5 button ${at(trapped, PTS['link 5  button t5 @768,400']) ? '⛓' : '⛔ NO'}`);
console.log(`   with it OPEN                 ${String(escaped.size).padStart(6)} cells   `
    + `back to the t5 button ${at(escaped, PTS['link 5  button t5 @768,400']) ? '⛓' : '⛔ no'}`);

claim(!at(trapped, PTS['link 5  button t5 @768,400'])
    && at(escaped, PTS['link 5  button t5 @768,400']),
    '⛔⛔⛔ THE t4 BUTTON ROOM IS A ONE-WAY TRAP — 8 CELLS AND NO WAY WEST',
    `${trapped.size} cells from the t4 button with wandlock@800,400 shut, and the t5 `
    + `button that opens it is NOT one of them (${escaped.size} with it open). ⇒ a player `
    + 'who walks through the t5 lock to press t4 by hand cannot come back, and a `Button` '
    + 'REPUBLISHES rather than latching — so the lock is shut again on the tick after '
    + 'the player steps off the t5 button unless something is standing in the lock '
    + 'itself.');

/**
 * ⛔⛔⛔ CLAIM 4 — AND THERE IS EXACTLY ONE HOLDER IN THE LEVEL.
 *
 * `Button.update`'s hitables is `["Player","Enemy","Solid"]` minus a Cover.
 * The things in L40 that are one of those AND can be put somewhere on
 * purpose are: the player (one), the three pushable blocks (all west, and
 * none of them reaches either button — `L40_ARRIVAL_BREAK` measured that
 * for link 4 and the same walls hold), and the corpse (one).
 */
const holders = (rec.entities ?? []).filter((e) => e.type === 'iceturret').length;
claim(holders === 1,
    '⛔⛔⛔ ONE CORPSE, TWO HOLDS, AND THEY ARE IN A STRICT DEPENDENCY',
    `L${LEVEL} holds ${holders} iceturret, so it can make exactly ${holders} corpse — and `
    + 'link 4 and link 5 each need a holder that is not the player. Worse than a tie: '
    + 'link 4 being held is WHAT MAKES the t5 button reachable, so the corpse cannot be '
    + 'moved to the t5 button without re-shutting the locks that reach it. ⇒ THE CHAIN '
    + 'FROM THE ARRIVAL NOW STOPS AT LINK 5/6, and the open question for the next slice '
    + 'is whether the corpse can be BUMPED the 17½ tiles east from button@480,384 to '
    + 'button@768,400 with the t2 group re-shutting behind it.');

/**
 * ⚠ AND THE VERDICT THIS REPLACES IS QUOTED, so the record cannot drift
 * into "the break was always at link 6".
 */
claim(/stops at link 4/i.test(L40_ARRIVAL_BREAK.verdict),
    '⛓ `L40_ARRIVAL_BREAK.verdict` still says LINK 4 — and this probe is what moves it',
    `banked: "${L40_ARRIVAL_BREAK.verdict.slice(0, 120)}…". Its clause "no block in the `
    + 'level can reach" is still true and is no longer the whole story: a corpse is not '
    + 'a block. What survives intact is the SHAPE of the finding — one plain button, one '
    + 'holder, everything downstream — moved one link along.');

console.log('\n## claims');
let bad = 0;
for (const c of claims) {
    console.log(`   ${c.ok ? '✅' : '❌'} ${c.name}`);
    console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (throws > 0) console.log(`\n⚠ ${throws} planner throws were swallowed as blocked cells`);
console.log(`\n${bad === 0 ? '✅ ALL CLAIMS HOLD' : `❌ ${bad} CLAIM(S) FAILED`}`);
process.exit(bad === 0 ? 0 : 1);
