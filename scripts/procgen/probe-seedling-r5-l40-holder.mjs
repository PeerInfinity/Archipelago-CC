#!/usr/bin/env node
/**
 * probe-seedling-r5-l40-holder — ⛔⛔⛔ LINK 5 HAS NO HOLDER, ENUMERATED
 * RATHER THAN ASSUMED — AND THE CORPSE CANNOT MAKE THE CROSSING EITHER.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 22 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §35.11 item 2 and the
 * STEP 1 rule — *"enumerate every holder-capable entity against Button's
 * press list (Player/Enemy/Solid): the lurable bob-family, spinner
 * billiards, the spear block's reachable set, the corpse's ALTERNATIVE
 * spend, and the player. The obstacle may be the machine."*
 *
 * §35.6 said *"`Button.update`'s hitables admits exactly one thing in L40
 * that can be put somewhere and stays: the corpse"*. That is an assertion
 * about a census nobody had run. This runs it, over every entity class the
 * level actually holds, with the reason each is refused — and then answers
 * the open question `L40_LINK4_REPAIRED.openQuestion` banked beside it.
 *
 * ── WHAT A HOLDER HAS TO BE ───────────────────────────────────────────
 *
 * `Button.update`'s hitables is `["Player", "Enemy", "Solid"]` and it
 * excludes only a `Cover`. So a holder needs THREE properties, and the
 * census below reports which one each candidate fails:
 *
 *   TYPE      it must be one of those three AS3 types;
 *   PLACING   some verb this rung has must be able to put it on the cell;
 *   STAYING   it must still be there 101 ticks later — a `Lock` needs 101
 *             CONTINUOUS ticks of its group being published and the count
 *             restarts the moment the button is released.
 *
 * ⛔ THE THIRD IS WHERE THE ENEMIES DIE. A `Bob` is an `"Enemy"` and it is
 * LURABLE — that is two of three — and it follows the player, so the tick
 * the player walks east it comes too. Killing it on the button does not
 * help either: a dying `Enemy` is still an `"Enemy"` for its death
 * animation plus `Mobile.death()`'s eleven-tick fade, which for a Bob is
 * 36 ticks against the Lock's 101. **A corpse that fades is not a holder.**
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40-holder.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE, rectsOverlap } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { fireRect, fireRadiusDistance, FIRE_RADIUS } = await import(join(MODULE, 'fireVerb.js'));
const {
    ICE_TURRET, bumpIceTurret, createIceTurret, killIceTurret, stepIceTurret,
} = await import(join(MODULE, 'iceTurret.js'));
const { MOBILE_DEATH_FADE } = await import(join(MODULE, 'enemyDamage.js'));
const { L40_CHAIN, L40_CORPSE } = await import(join(MODULE, 'r5Totem.js'));

const LEVEL = 40;
const LATTICE = L40_CHAIN.lattice;
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const CHEST = new Set(['chest@880,816']);
const TREE_TAG = 0;
const TURRET = L40_CORPSE.turret.id;

const rec = atlasLevelSource()(LEVEL);
const world = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY, cleared: [TREE_TAG] });

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

// ── the census ────────────────────────────────────────────────────────
/**
 * ⛓ THE THREE PROPERTIES, PER CLASS, WITH THE SOURCE THAT DECIDES EACH.
 *
 * `placing` and `staying` are transcribed from the class rather than
 * measured, because they are statements about the CODE; `type` comes from
 * `levelWorld.ENTITY_CLASSES`, which is the same table the collision
 * queries read, so a class whose type changes changes this census too.
 */
const HOLDER_RULES = {
    bob: { placing: 'LURABLE — `Bob.update` chases inside `runRange` 80',
        staying: false,
        why: 'it follows. The lure IS the player, so the tick the player leaves the '
            + 'button the Bob leaves with them — and killing it on the cell buys the '
            + `death animation plus \`Mobile.death()\`'s ${MOBILE_DEATH_FADE.ticks}-tick `
            + 'fade, 36 ticks against a `Lock`\'s 101.' },
    bobsoldier: { placing: 'LURABLE, same family', staying: false, why: 'as `bob`' },
    puncher: { placing: 'LURABLE, same family', staying: false, why: 'as `bob`' },
    spinner: { placing: 'NO — a `Spinner` moves on its own fixed billiard path and no '
        + 'verb aims it', staying: false,
    why: 'and a kill writes `setPersistence(tag, false)` (`Spinner.removed()`), so it '
        + 'is a LEDGER entry as well as a body — which is why `KILL_ARM_POLICY` refuses '
        + 'the class by name' },
    iceturret: { placing: 'KILL then `fire.bumps` — one tile per axis per press',
        staying: true,
        why: 'the ONLY holder in the level: `death()` intercepts the removal, so the '
            + '16x16 body never fades and never leaves' },
    pushableblock: { placing: 'a sword/spear press, one tile per press', staying: true,
        why: 'a holder in principle — the question is REACH, measured below' },
    pushableblockfire: { placing: 'a fire press or a pulse', staying: true,
        why: 'a holder in principle — the question is REACH, measured below' },
    bombpusher: { placing: 'NO — no verb in this rung moves one', staying: true,
        why: 'immovable by this rung\'s means' },
};
const STATIC_SOLIDS = new Set(['bosslock', 'breakablerock', 'burnabletree', 'chest',
    'dungeonspire', 'pulser', 'ruinedpillar', 'wandlock']);

const ents = rec.entities ?? [];
const byType = new Map();
for (const e of ents) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type).push(e);
}
const TYPES = { ...(await import(join(MODULE, 'levelWorld.js'))).ENTITY_CLASSES };
const holderTypes = new Set(['Player', 'Enemy', 'Solid']);

console.log(`## L${LEVEL} — EVERY holder-capable entity against \`Button.update\`'s `
    + 'hitables ["Player","Enemy","Solid"]\n');
console.log('   count  class                type      placing                       stays');
const census = [];
for (const [t, list] of [...byType.entries()].sort()) {
    const cls = TYPES[t];
    const as3Type = cls?.type;
    if (!holderTypes.has(as3Type)) continue;
    const rule = HOLDER_RULES[t]
        ?? (STATIC_SOLIDS.has(t)
            ? { placing: 'NO — a static `.oel` placement', staying: true,
                why: 'nothing in this rung moves one, and none is on either button' }
            : null);
    if (!rule) {
        throw new Error(`probe-…-l40-holder: ${t} is a "${as3Type}" in L${LEVEL} and has `
            + 'no holder rule. A candidate with no verdict is a census that did not '
            + 'run — add the row or say why it cannot hold a button.');
    }
    census.push({ type: t, as3Type, count: list.length, ...rule });
    console.log(`   ${String(list.length).padStart(5)}  ${t.padEnd(20)} ${as3Type.padEnd(9)} `
        + `${rule.placing.slice(0, 29).padEnd(29)} ${rule.staying ? '⛓' : '⛔'}`);
}
console.log(`   ${'1'.padStart(5)}  ${'(the player)'.padEnd(20)} ${'Player'.padEnd(9)} `
    + `${'walks'.padEnd(29)} ⛔`);
console.log('');

/**
 * ⛓⛓⛓ CLAIM 1 — THE CENSUS RAN, AND IT NAMES EVERY CLASS RATHER THAN
 * SAMPLING ONE.
 *
 * [[feedback_bounded_sweep_must_name_what_it_bounded]]: "there is one
 * holder" and "nobody enumerated" print the same thing, so the row count is
 * asserted against the level's own class list.
 */
const holderClasses = census.filter((c) => c.staying && c.placing.startsWith('KILL'));
claim(census.length >= 8 && holderClasses.length === 1
    && holderClasses[0].type === 'iceturret',
    '⛔⛔⛔ EVERY HOLDER-CAPABLE CLASS IN L40, AND EXACTLY ONE STAYS WHERE IT IS PUT',
    `${census.length} classes carry a hitable AS3 type; ${holderClasses.length} can be `
    + 'PLACED by a verb this rung has AND is still there 101 ticks later, and it is the '
    + `\`iceturret\` corpse. ⛔ THE ENEMIES FAIL ON STAYING, NOT ON TYPE: a Bob is an `
    + '"Enemy" and it is lurable, and it follows — and killing it on the cell buys the '
    + `death animation plus \`Mobile.death()\`'s ${MOBILE_DEATH_FADE.ticks}-tick fade, 36 `
    + 'ticks against a `Lock`\'s 101 CONTINUOUS. ⛔ The static Solids fail on PLACING; '
    + 'the spinners fail on both and carry a persistence write besides.');

// ── the blocks' reach, measured rather than quoted ────────────────────
/**
 * ⛔ THE TWO CLASSES THAT COULD HAVE BEEN HOLDERS, PRICED. §35.6 says "no
 * block in the level can reach", quoting slice 16; that number is
 * re-derived here against the button this slice cares about rather than
 * the one slice 16 did.
 */
const T5_BUTTON = world.pressers.find((p) => p.tag === 'button' && p.t === 5);
const T4_BUTTON = world.pressers.find((p) => p.tag === 'button' && p.t === 4);
const T2_BUTTON = world.pressers.find((p) => p.tag === 'button' && p.t === 2);
for (const b of [T5_BUTTON, T4_BUTTON, T2_BUTTON]) {
    if (!b) throw new Error('probe-…-l40-holder: L40 is missing one of the three buttons');
}
const blocks = (world.pushables ?? []);
const nearest = blocks.map((b) => ({
    id: b.id,
    dx: Math.abs(b.x - T5_BUTTON.x) / TILE_SIZE,
    dy: Math.abs(b.y - T5_BUTTON.y) / TILE_SIZE,
}));
console.log('## the three pushable blocks against `button@768,400 {t 5}`');
for (const n of nearest) {
    console.log(`   ${n.id.padEnd(30)} ${n.dx.toFixed(1)} tiles x, ${n.dy.toFixed(1)} tiles y`);
}
console.log('');
claim(nearest.every((n) => n.dx + n.dy > 8),
    '⛔ …AND NO BLOCK IS EVEN CLOSE — the nearest is 8+ tiles of pushing away',
    nearest.map((n) => `${n.id} ${(n.dx + n.dy).toFixed(0)} tiles`).join(', ')
    + '. Slice 16 measured each block\'s whole reachable set (27 / 1 / 1 cells) and '
    + 'none of them contains either button; this is the coarser version of the same '
    + 'refusal, re-derived against THIS button so the claim is not inherited.');

// ── ⛓⛓⛓ THE CORPSE'S 17½ TILES, AS A SEARCH ────────────────────────
/**
 * ⛔⛔⛔ `L40_LINK4_REPAIRED.openQuestion`, ANSWERED.
 *
 * *"can the corpse be BUMPED the 17½ tiles east from `button@480,384` to
 * `button@768,400` — one tile per axis per press, so ~18 presses each
 * needing a stance — and if it can, does the t2 group re-shutting BEHIND it
 * wall the corpse in?"*
 *
 * The state is the CORPSE'S TILE and nothing else: the player can
 * re-position freely inside whatever component the current activator set
 * gives them, so what a bump costs in ticks does not change what is
 * reachable. The activator set is a FUNCTION of the corpse's tile — the t2
 * group is published only while the body's 16x16 box overlaps
 * `button@480,384`'s 8x6 press rect — which is exactly the feedback loop
 * the open question is about.
 *
 * A bump in direction `d` is legal when all four hold:
 *   1. the destination tile is free for the 16x16 body;
 *   2. it is not water, lava or a pit (`Enemy.update`'s terrain switch kills
 *      a corpse AT REST, §34.7);
 *   3. some node in the PLAYER'S CURRENT COMPONENT is a stance from which
 *      `bumpIceTurret` returns `d` — the model's own angle arithmetic, not
 *      a re-derivation;
 *   4. …and from which the fire rect reaches, through `fireRadiusDistance`'s
 *      own corrected gate.
 */
const freeNode = (cx, cy, opts) => {
    if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
    const c = nodeCentre(cx, cy, LATTICE);
    try {
        return plannerObstacleAt(world, c.x, c.y, null,
            { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
    } catch { return false; }
};
const floodFrom = (from, opts) => {
    const seen = new Set();
    const sx = Math.floor(from.x / LATTICE);
    const sy = Math.floor(from.y / LATTICE);
    const frontier = [];
    for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
            if (freeNode(sx + dx, sy + dy, opts)) {
                seen.add(`${sx + dx},${sy + dy}`); frontier.push([sx + dx, sy + dy]);
            }
        }
    }
    while (frontier.length > 0) {
        const [cx, cy] = frontier.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !freeNode(cx + dx, cy + dy, opts)) continue;
            seen.add(k); frontier.push([cx + dx, cy + dy]);
        }
    }
    return seen;
};

const LINK3 = ['wandlock@480,560'];
const LINK4 = ['wandlock@448,432', 'wandlock@512,480'];
const T5LOCK = ['wandlock@800,400'];
/** The corpse's entity centre for a tile — `input()`'s own snap. */
const centreOf = (tx, ty) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });
const corpseBox = (tx, ty) => {
    const c = centreOf(tx, ty);
    return { x: c.x - 8, y: c.y - 8, right: c.x + 8, bottom: c.y + 8 };
};
const pressed = (tx, ty, b) => rectsOverlap(corpseBox(tx, ty), b.rect);
const activatorsFor = (tx, ty) => {
    const out = [...LINK3];
    if (pressed(tx, ty, T2_BUTTON)) out.push(...LINK4);
    if (pressed(tx, ty, T5_BUTTON)) out.push(...T5LOCK);
    return new Set(out);
};
const turretsFor = (tx, ty) => {
    const c = centreOf(tx, ty);
    return new Map([[TURRET, {
        id: TURRET, x: c.x, y: c.y, dead: true, removed: false, solid: true,
        rect: corpseBox(tx, ty),
    }]]);
};
const FATAL = new Set([1, 6, 17]);
const corpseCellFree = (tx, ty) => {
    const c = centreOf(tx, ty);
    if (world.collidesSolid(corpseBox(tx, ty), { openChests: CHEST })) return false;
    const t = world.nearestWalkableTile(c.x, c.y)?.t ?? 0;
    return !FATAL.has(t);
};
/**
 * ⛔⛔⛔ EVERY TILE A PRESS FROM `comp` CAN PUT THE CORPSE ON — AND THE
 * FIRST CUT OF THIS ASKED `bumpIceTurret` ONCE, WHICH IS THE WRONG VERB.
 *
 * §34.6's headline, one layer up: **a press is FIVE bumps**, on the five
 * consecutive ticks of `FIRE_WINDOW.hitTicks`, and the body's own update
 * runs between them — so bumps 2..5 re-target a body that is already
 * moving, and the tile a press LANDS the body on is not the tile one
 * `bump` call names. A single call from a body parked at a tile centre
 * targets `round(x/16) ± 1`, which for a centre is `tile` and `tile + 2`,
 * and decoding that as a direction gives an empty move set — which is
 * exactly what the first version of this search returned.
 *
 * ⇒ the primitive here is the PRESS, driven through `stepIceTurret` for its
 * whole 40-tick settle, and the answer is read off the body's own position.
 * [[feedback_one_press_is_five_dispatches]] applied to a SEARCH rather than
 * to a leg.
 */
const { FIRE_WINDOW } = await import(join(MODULE, 'fireVerb.js'));
const PRESS_SETTLE = 60;
const pressFrom = (p, tx, ty) => {
    const c = createIceTurret(472, 400);
    killIceTurret(c);
    stepIceTurret(c, {});
    const at = centreOf(tx, ty);
    c.x = at.x; c.y = at.y;
    c.tile = { x: tx, y: ty };
    c.cTile = { x: tx, y: ty };
    c.lTile = { x: tx, y: ty };
    c.prev1 = null; c.prev2 = null; c.settled = false;
    const ctx = {
        onScreen: true,
        blockedAt: (x, y) => !!world.collidesSolid(
            { x: x - 8, y: y - 8, right: x + 8, bottom: y + 8 },
            { openChests: CHEST, openActivators: activatorsFor(tx, ty) },
        ),
        terrainAt: (x, y) => world.nearestWalkableTile(x, y)?.t ?? 0,
        playerOverlaps: () => false,
    };
    const last = FIRE_WINDOW.hitTicks[FIRE_WINDOW.hitTicks.length - 1];
    for (let k = 0; k <= last; k += 1) {
        stepIceTurret(c, ctx);
        if (FIRE_WINDOW.hitTicks.includes(k)) bumpIceTurret(c, p, 'Fire');
    }
    for (let i = 0; i < PRESS_SETTLE; i += 1) stepIceTurret(c, ctx);
    if (c.destroy || c.removed) return null;
    return { tx: Math.floor(c.x / TILE_SIZE), ty: Math.floor(c.y / TILE_SIZE) };
};
/** Every tile a press from some node in `comp` can move the corpse to. */
const pressTargetsFrom = (comp, tx, ty) => {
    const out = new Map();
    const box = corpseBox(tx, ty);
    const c = centreOf(tx, ty);
    for (const key of comp) {
        const [cx, cy] = key.split(',').map(Number);
        const p = nodeCentre(cx, cy, LATTICE);
        // `Player.fire()`'s own two gates, in its own order: the rect, then
        // the radius.
        const r = fireRect(p.x, p.y);
        if (!(r.right > box.x && r.x < box.right && r.bottom > box.y && r.y < box.bottom)) {
            continue;
        }
        // ⚠ `fireRadiusDistance`, NOT its `Corrected` twin. The game's line
        // reads the PLAYER's `originY` for the target's y (`fireVerb.js:376`,
        // transcribed rather than fixed), and a probe using the corrected
        // one would price a reach the game does not have.
        if (fireRadiusDistance(p, {
            x: c.x, y: c.y, originX: 8, originY: 8, w: 16, h: 16,
        }) > FIRE_RADIUS) continue;
        const to = pressFrom(p, tx, ty);
        if (!to) continue;
        if (to.tx === tx && to.ty === ty) continue;
        out.set(`${to.tx},${to.ty}`, { ...to, from: p });
    }
    return [...out.values()];
};

const START = {
    tx: Math.floor(L40_CORPSE.corpseEndsAt.x / TILE_SIZE),
    ty: Math.floor(L40_CORPSE.corpseEndsAt.y / TILE_SIZE),
};
const GOAL = { tx: Math.floor(T5_BUTTON.x / TILE_SIZE), ty: Math.floor(T5_BUTTON.y / TILE_SIZE) };
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const ARRIVAL = { ...L40_CHAIN.from };

const seen = new Map([[`${START.tx},${START.ty}`, null]]);
const queue = [[START.tx, START.ty]];
let reachedGoal = false;
let expanded = 0;
while (queue.length > 0 && !reachedGoal) {
    const [tx, ty] = queue.shift();
    expanded += 1;
    const opts = {
        openChests: CHEST,
        openActivators: activatorsFor(tx, ty),
        turrets: turretsFor(tx, ty),
    };
    const comp = floodFrom(ARRIVAL, opts);
    for (const to of pressTargetsFrom(comp, tx, ty)) {
        const k = `${to.tx},${to.ty}`;
        if (seen.has(k) || !corpseCellFree(to.tx, to.ty)) continue;
        seen.set(k, `${tx},${ty}`);
        queue.push([to.tx, to.ty]);
        if (to.tx === GOAL.tx && to.ty === GOAL.ty) reachedGoal = true;
    }
}
console.log(`## the corpse's own reachable set, from (${START.tx},${START.ty})`);
console.log(`   ${seen.size} tile(s) reachable by bumping, ${expanded} expanded`);
console.log(`   goal button@${T5_BUTTON.x},${T5_BUTTON.y} tile (${GOAL.tx},${GOAL.ty})   `
    + `${reachedGoal ? '⛓ REACHED' : '⛔ NOT REACHED'}`);
{
    const xs = [...seen.keys()].map((k) => Number(k.split(',')[0]));
    console.log(`   east-most column the body reaches: ${Math.max(...xs)} `
        + `(the goal is ${GOAL.tx})`);
}
console.log('');

claim(!reachedGoal,
    '⛔⛔⛔ THE CORPSE CANNOT MAKE THE CROSSING — `openQuestion` IS ANSWERED, AND IT IS NO',
    `${seen.size} tile(s) are reachable by bumping from (${START.tx},${START.ty}), and `
    + `tile (${GOAL.tx},${GOAL.ty}) is not one of them. The search is over the CORPSE'S `
    + 'TILE with the activator set a FUNCTION of it — the t2 group is published only '
    + 'while the body overlaps `button@480,384`\'s 8x6 press rect — so the feedback the '
    + 'open question asks about is in the model rather than in the argument. Each edge '
    + 'needs a player node in the CURRENT component that `bumpIceTurret` returns that '
    + 'direction from and `Player.fire()`\'s own radius gate admits.');

claim(seen.size >= 2,
    '⛓ …and the search is not vacuous: the body CAN be moved, just not there',
    `${seen.size} tiles against a start of 1. A refusal from a search that could not `
    + 'move the body at all would say nothing about the crossing — it would say the '
    + 'stance model was broken. [[feedback_silent_watcher_vacuous_negative]]');

/**
 * ⛔⛔ AND THE INVERSION IS REFUSED FOR A REASON THE SEARCH ALREADY HOLDS.
 *
 * The brief asks for the alternative spend — corpse on t4, t2 held some
 * other way. There is no other way: the census above is the whole list, and
 * the corpse is the only entry. And the ORDER is forced: `button@768,400
 * {t 5}` is not in the arrival's component until the t2 group is open
 * (`probe-…-l40-kill.mjs`), so the corpse has to spend itself on t2 BEFORE
 * anything east of it is reachable at all.
 */
claim(census.filter((c) => c.staying && !c.placing.startsWith('NO')).length === 3,
    '⛔⛔ …AND THERE IS NO ALTERNATIVE SPEND: t2 HAS THE SAME ONE HOLDER',
    'the placeable-and-staying classes are the corpse and the two pushable-block '
    + 'families, and no block reaches either button. So "corpse on t4, t2 held some '
    + 'other way" has no second way — and the ORDER is forced besides: the t5 button is '
    + 'not in the arrival\'s component until the t2 group is open, so the corpse must be '
    + 'spent on t2 before anything east of it exists to spend it on.');

console.log('## claims');
let bad = 0;
for (const c of claims) {
    console.log(`   ${c.ok ? '✅' : '❌'} ${c.name}`);
    console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
console.log(`\n${bad === 0 ? '✅ ALL CLAIMS HOLD' : `❌ ${bad} CLAIM(S) FAILED`}`);
console.log('\n(a probe — no tape)');
process.exit(bad === 0 ? 0 : 1);
