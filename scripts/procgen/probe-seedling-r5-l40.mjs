#!/usr/bin/env node
/**
 * probe-seedling-r5-l40 — WHAT OPENS L40's NORTH HALF.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 11, step 3.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §24.
 *
 * ── THE QUESTION SLICE 10 LEFT, STATED RATHER THAN GUESSED ────────────
 *
 * §23.9 flooded L40 from the L39 arrival with the R5 item set and
 * everything shut, and reached `totempart 1`, three ways OUT, and NONE of
 * the fifteen things step 3 wants. It then said the honest thing:
 * *"L40's north half is entered by something that is not this arrival."*
 *
 * ⚠⚠ AND THAT BLOCKS STEP 4 AS WELL, which is why this runs first.
 * `teleporter@944,96 -> L41` and `teleporter@848,0 -> L42` are both in the
 * UNREACHED list, so `totempart 3` and `totempart 4` are behind the same
 * wall. Four of the five ceremonies are on the far side of one question.
 *
 * ── HOW IT ASKS ───────────────────────────────────────────────────────
 *
 * The slice-10 flood held every opener shut, which answers *"what does the
 * arrival reach with no help at all"*. It does not answer *"what does the
 * arrival reach given what a route can do FROM INSIDE IT"* — and the
 * difference is the whole level. So this walks the chain link by link and
 * prices each one, with two properties that are the point of doing it this
 * way rather than by reading the map:
 *
 *   · a link that buys NOTHING is as visible as one that buys the level —
 *     link 2 alone is +0, and that is the finding;
 *   · every link's geometry comes from `plannerObstacleAt`, so a link the
 *     planner cannot walk is not a link.
 *
 * ⚠ AT THE PLANNER'S OWN 8 px LATTICE
 * ([[feedback_reachability_needs_the_movement_granularity]]) — which is a
 * DIFFERENT PHASE from §23.9's `collidesSolid` flood over pixel multiples
 * of 8, so the two cell counts are not comparable and this one is
 * deliberately not reconciled to 437. The two agree on every VERDICT.
 *
 * ⚠ AND THE BURN IS STOOD IN FOR BY A BUILD-TIME CLEAR. There is no
 * per-visit family for a burned `BurnableTree` (it would be the eighth),
 * so link 2's geometry is measured with the tree's tag cleared at build.
 * That measures the RIGHT geometry and does not pretend the mechanic is
 * built — `FIRE_ARM_POLICY.BurnableTree` is `refused`, and this probe
 * asserts that it is, so the two halves cannot drift apart.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l40.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { createPushableState, pushableRects } = await import(join(MODULE, 'pushables.js'));
const { auditFire, FIRE_ARM_POLICY } = await import(join(MODULE, 'presses.js'));
const { L40_ARRIVAL, L40_CHAIN } = await import(join(MODULE, 'r5Totem.js'));

const levelSource = atlasLevelSource();
const LEVEL = 40;
const LATTICE = L40_CHAIN.lattice;
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
/** The `burnabletree` tag — cleared at build to stand in for the burn. */
const TREE_TAG = 0;

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

const rec = levelSource(LEVEL);
const standing = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY });
const burned = buildLevelWorld(rec, { roles: ROLES, inventory: INVENTORY, cleared: [TREE_TAG] });
console.log(`## L${LEVEL} — ${rec.width}x${rec.height} tiles, from `
    + `(${L40_CHAIN.from.x},${L40_CHAIN.from.y})`);

/**
 * The flood, under a named geometry.
 *
 * ⚠ IT COUNTS ITS OWN THROWS. `plannerObstacleAt` throws on a malformed
 * option (a `pushables` that is not the rect map, for one), and a `catch`
 * that returns `false` turns that into a silently EMPTY component — which
 * is a flood that reports "nothing is reachable" and looks like a level
 * design. Counted and asserted at zero, per
 * [[feedback_silent_watcher_vacuous_negative]].
 */
let throws = 0;
function compAt(world, start, opts = {}) {
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
        const c = nodeCentre(cx, cy, LATTICE);
        try {
            return plannerObstacleAt(world, c.x, c.y, null,
                { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
        } catch { throws += 1; return false; }
    };
    const seen = new Set();
    const sx = Math.floor((start.x + 8) / LATTICE);
    const sy = Math.floor((start.y + 8) / LATTICE);
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
}
/** Whether the component comes within one lattice cell of an entity's cell. */
const touches = (comp, p) => {
    for (let dx = -1; dx <= 2; dx += 1) {
        for (let dy = -1; dy <= 2; dy += 1) {
            if (comp.has(`${Math.floor(p.x / LATTICE) + dx},${Math.floor(p.y / LATTICE) + dy}`)) {
                return true;
            }
        }
    }
    return false;
};
const ents = rec.entities ?? [];
const one = (type, pred = () => true) => ents.find((e) => e.type === type && pred(e));
const NAMED = {
    'totempart 0': one('totempart', (e) => Number(e.attrs.totempart) === 0),
    'totempart 1': one('totempart', (e) => Number(e.attrs.totempart) === 1),
    'buttonroom t3': one('buttonroom', (e) => e.x === 880),
    'buttonroom t0': one('buttonroom', (e) => e.x === 272),
    'buttonroom t1': one('buttonroom', (e) => e.x === 160),
    'button t2': one('button', (e) => Number(e.attrs.tset) === 2),
    'button t4': one('button', (e) => Number(e.attrs.tset) === 4),
    'button t5': one('button', (e) => Number(e.attrs.tset) === 5),
    bosskey: one('bosskey'),
    bosslock: one('bosslock'),
    'L41 door': one('teleporter', (e) => Number(e.attrs.to) === 41),
    'L42 door': one('teleporter', (e) => Number(e.attrs.to) === 42),
};

/** The pushable rect map, with named blocks displaced. */
const withBlocks = (world, moves = {}) => {
    const st = createPushableState(world);
    for (const [id, pos] of Object.entries(moves)) {
        const b = st.byId.get(id);
        if (!b) throw new Error(`probe-seedling-r5-l40: no pushable ${id} in L${LEVEL}`);
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

// ── ⛔⛔ THE FIRST GATE IS A PAIR, AND THAT IS THE FINDING ─────────────
console.log('\n## the join — two solids stacked in one cell, and neither alone opens it');
const CHEST = new Set(['chest@880,816']);
const br3 = NAMED['buttonroom t3'];
const pairs = [
    ['everything shut', standing, {}],
    ['chest opened, tree STANDING', standing, { openChests: CHEST }],
    ['tree burned, chest SHUT', burned, {}],
    ['BOTH', burned, { openChests: CHEST }],
];
const measured = [];
for (const [label, world, opts] of pairs) {
    const c = compAt(world, L40_CHAIN.from, opts);
    measured.push({ label, cells: c.size, br3: touches(c, br3) });
    console.log(`   ${label.padEnd(30)} ${String(c.size).padStart(5)} cells   `
        + `buttonroom@880,768 ${touches(c, br3) ? '⛓ REACHED' : '⛔ no'}`);
}
claim(!measured[1].br3 && !measured[2].br3 && measured[3].br3,
    '⛔⛔ THE JOIN IS A PAIR — the chest alone and the tree alone both leave it SEALED',
    `chest only ${measured[1].cells}, tree only ${measured[2].cells}, both `
    + `${measured[3].cells} — the tree is a 32x32 solid sitting directly on the one `
    + 'cell of row 51 the chest occupies, so an audit of either blocker alone reads '
    + 'as "no way through". `L38_CHAIN`\'s shape (§21.4) with a different second solid.');
claim(measured[2].cells === measured[0].cells,
    '⛓ and the tree ALONE buys exactly zero, rather than merely little',
    `${measured[2].cells} against ${measured[0].cells} shut`);

// ── ⛔ THE BURN IS NOT BUILT, AND THE PRESS CENSUS SAYS SO BY NAME ────
console.log('\n## the burn — refused by name, which is what slice 11 changed');
const fireAudit = auditFire(standing, { x: 888, y: 824 });
claim(fireAudit.refused.some((r) => r.tag === 'burnabletree'),
    '⛓⛓ a fire press from the chest cell REFUSES the tree BY NAME',
    `refused: [${fireAudit.refused.map((r) => r.id).join(' ') || 'nothing'}] — before `
    + 'slice 11 this census was EMPTY: `PRESS_ARMS` is keyed on the class `genericHit` '
    + 'TESTS (`Tree`) and the census looks up the class the entity IS '
    + '(`BurnableTree`), so the subclass was in no list at all and the model scored a '
    + 'press that removes a 2x2 solid and writes a persistence clear as doing nothing.');
claim(FIRE_ARM_POLICY.BurnableTree?.policy === 'refused',
    '⛓ …and it is REFUSED rather than modelled, because the burn has no geometry family',
    `policy = ${FIRE_ARM_POLICY.BurnableTree?.policy}. A per-visit BurnableTree `
    + 'removal would be the EIGHTH geometry family; until one exists the safe answer is a '
    + 'refusal a route cannot walk past by accident.');

// ── ⛓ THE CHAIN, LINK BY LINK ────────────────────────────────────────
console.log('\n## the chain');
const OA = new Set();
let prev = null;
const walk = (label, opts) => {
    const c = compAt(burned, L40_CHAIN.from, opts);
    const d = prev === null ? '' : ` (${c.size - prev >= 0 ? '+' : ''}${c.size - prev})`;
    const got = Object.entries(NAMED).filter(([, e]) => e && touches(c, e)).map(([k]) => k);
    console.log(`   ${label.padEnd(52)} ${String(c.size).padStart(5)}${d.padEnd(8)}`);
    console.log(`      ${got.join(', ') || '—'}`);
    prev = c.size;
    return c;
};
const base = walk('0  shut (tree burned, chest shut)', {});
walk('1+2  chest opened — the SE chamber', { openChests: CHEST });
['wandlock@480,560'].forEach((x) => OA.add(x));
walk('3  buttonroom t3 (self-latch) -> wandlock tag 11',
    { openChests: CHEST, openActivators: new Set(OA) });
['wandlock@448,432', 'wandlock@512,480'].forEach((x) => OA.add(x));
walk('4  button t2 -> wandlocks tags 9, 10', { openChests: CHEST, openActivators: new Set(OA) });
['wandlock@800,400'].forEach((x) => OA.add(x));
walk('5  button t5 -> wandlock tag 21', { openChests: CHEST, openActivators: new Set(OA) });
const afterButtons = walk('6  button t4 -> the pulser is ARMED (no geometry yet)',
    { openChests: CHEST, openActivators: new Set(OA) });
const pushed = walk('7  the pulse shoves the fire block WEST off (36,36)', {
    openChests: CHEST,
    openActivators: new Set(OA),
    pushables: withBlocks(burned, { 'pushableblockfire@576,576': { x: 560, y: 576 } }),
});

// ⛔ THE WALK-PUSH IS THREE, AND EACH STEP IS MEASURED
console.log('\n## the walk-push — one is not enough, and neither is two');
const keyAt = [];
for (const ty of [35, 34, 33, 32]) {
    const c = compAt(burned, L40_CHAIN.from, {
        openChests: CHEST,
        openActivators: new Set(OA),
        pushables: withBlocks(burned, {
            'pushableblockfire@576,576': { x: 560, y: 576 },
            'pushableblock@576,560': { x: 576, y: ty * TILE_SIZE },
        }),
    });
    keyAt.push({ ty, cells: c.size, key: touches(c, NAMED.bosskey) });
    console.log(`   plain block at (36,${ty})   ${String(c.size).padStart(5)} cells   `
        + `bosskey ${touches(c, NAMED.bosskey) ? '⛓ REACHED' : '⛔ no'}`);
}
claim(!keyAt[0].key && !keyAt[1].key && !keyAt[2].key && keyAt[3].key,
    '⛔ THE KEY NEEDS THREE PUSHES — the block plugs a one-wide column the player follows',
    'the chamber\'s only door is `pushableblock@576,560` and the block cannot be left '
    + 'in it; (36,34) and (36,33) are both still in the player\'s way.');

// ⛔⛔ AND NO FLAG REACHES IT — asserted against EVERY activator open
const everyFlag = compAt(burned, L40_CHAIN.from, {
    openChests: CHEST,
    openActivators: new Set(burned.activators.map((a) => a.id)),
});
claim(!touches(everyFlag, NAMED.bosskey),
    '⛔⛔ NO PUBLICATION REACHES THE BOSS KEY — with EVERY activator open it is still sealed',
    `${everyFlag.size} cells with all ${burned.activators.length} activators open and `
    + 'the chest opened, and `bosskey@656,528` is in none of them. The key is behind a '
    + 'BLOCK, not behind a flag — which is why the mini-chain is load-bearing rather '
    + 'than scenery.');

// ── ⛓⛓ THE BOSSLOCK IS THE LARGEST LINK, AND IT IS WHAT REACHES L41/L42 ─
console.log('\n## the key, and what it opens');
const blocksOpen = {
    openChests: CHEST,
    pushables: withBlocks(burned, {
        'pushableblockfire@576,576': { x: 560, y: 576 },
        'pushableblock@576,560': { x: 576, y: 32 * TILE_SIZE },
    }),
};
const beforeLock = compAt(burned, L40_CHAIN.from,
    { ...blocksOpen, openActivators: new Set(OA) });
OA.add('bosslock@480,352');
const afterLock = compAt(burned, L40_CHAIN.from,
    { ...blocksOpen, openActivators: new Set(OA) });
console.log(`   before the bosslock  ${beforeLock.size} cells   `
    + `L41 ${touches(beforeLock, NAMED['L41 door']) ? 'yes' : 'no'}, `
    + `L42 ${touches(beforeLock, NAMED['L42 door']) ? 'yes' : 'no'}`);
console.log(`   after                ${afterLock.size} cells   `
    + `L41 ${touches(afterLock, NAMED['L41 door']) ? 'yes' : 'no'}, `
    + `L42 ${touches(afterLock, NAMED['L42 door']) ? 'yes' : 'no'}`);
claim(!touches(beforeLock, NAMED['L41 door']) && !touches(beforeLock, NAMED['L42 door'])
    && touches(afterLock, NAMED['L41 door']) && touches(afterLock, NAMED['L42 door']),
    '⛔⛔ L41 AND L42 ARE BEHIND THE BOSS KEY — so `totempart 3` and `totempart 4` are',
    `+${afterLock.size - beforeLock.size} cells, the largest link in the chain. §20.6 `
    + 'concluded the walk should NOT collect `bosskey@656,528` because '
    + '`buttonroom@272,208` would open the lock with no key; §23.8 refuted that (the '
    + 'group is a literal -1), and this is the size of that refutation — step 4 is '
    + 'behind a key an earlier slice had written off.');

// ── the NW cluster, and `totempart 0` ────────────────────────────────
console.log('\n## the NW cluster');
prev = afterLock.size;
['wandlock@208,128', 'wandlock@208,144', 'wandlock@208,160'].forEach((x) => OA.add(x));
walk('10  buttonroom t0 -> wandlocks tags 4, 5, 6',
    { ...blocksOpen, openActivators: new Set(OA) });
const ROCKS = new Set(['breakablerock@160,144', 'breakablerock@176,128', 'breakablerock@176,144']);
walk('11  the three breakablerocks',
    { ...blocksOpen, openActivators: new Set(OA), brokenRocks: ROCKS });
['wandlock@176,80', 'wandlock@176,208'].forEach((x) => OA.add(x));
const closed = walk('12  buttonroom t1 -> wandlocks tags 2, 3',
    { ...blocksOpen, openActivators: new Set(OA), brokenRocks: ROCKS });
claim(touches(closed, NAMED['totempart 0']),
    '⛓ `totempart 0 @64,144` is reached, at the end of an ELEVEN-link chain',
    `${closed.size} cells against ${base.size} shut`);

claim(throws === 0,
    '⛓ no flood swallowed a `plannerObstacleAt` throw',
    `${throws} — a caught throw returns "blocked", so one bad option turns a flood into `
    + 'a silently EMPTY component that reads like level design');

// ── ⚠ WHAT THIS PROBE DOES NOT SHOW ──────────────────────────────────
console.log('\n## what is NOT shown here, named');
console.log('   ⛔ the BURN, as a per-visit removal — the eighth geometry family');
console.log('   ⛔ the pulser wired into `levelRun` for L40 (built for L38, §21.65)');
console.log('   ⛔ the encounter ladder for 12 bobs, 2 punchers, a bobsoldier, an');
console.log('      iceturret and a bombpusher — and 5 spinners on kill-write tags');
console.log('   ⚠ the CONTROL is not a trigger: `control@224,432 {fallthrough 43}` is a');
console.log('      PARAMETER BLOCK (`Game.as:2100-2106`), so it is not something the');
console.log('      route can step on — it is where EVERY pit in L40 leads. The route');
console.log('      must not fall, anywhere.');

console.log('\n## the claims');
let bad = 0;
for (const c of claims) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${claims.length} claims FAILED`);
console.log(`\n   ${claims.length}/${claims.length} claims hold.`);
