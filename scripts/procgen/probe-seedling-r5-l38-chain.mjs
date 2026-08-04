#!/usr/bin/env node
/**
 * probe-seedling-r5-l38-chain — THE FIVE-LINK CHAIN, DRIVEN.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 9, step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §22.
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────
 *
 * Slice 8 MEASURED the chain (`probe-seedling-r5-l38-entrance`): five
 * links, each one a flood delta, and three of the five unmodelled. This
 * one DRIVES it — a real `synthesizeLegs` over the real geometry, through
 * the `Pulser`, the `Chest` and the `SealPiece` — and reports the ticks.
 * The difference between the two is the difference between "the level
 * opens" and "the bot opens it".
 *
 * ── ⛓ AND EVERY LEG IS PRICED WITH A COMPONENT CHECK ──────────────────
 *
 * The standing rule slice 8 earned: **LEVELS ARE NOT NODES applies to
 * PRICING, not just to routing.** §20.8 priced the L38 leg in one line and
 * the line was wrong by a whole room, because nothing had asked the
 * tile-level flood whether the arrival and the target were in the same
 * component. So every target below is checked against
 * `componentAt(level, x, y)` from the arrival, under the geometry AS OF
 * that point in the chain — and the checks are the point of the probe as
 * much as the drive is.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l38-chain.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs, nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { chestProbeLine, chestStanceBand } = await import(join(MODULE, 'chest.js'));
const { HITBOX } = await import(join(MODULE, 'playerPhysicsV1.js'));
const { CEREMONY_DEAD_FRAMES } = await import(join(MODULE, 'sealCeremony.js'));
const { pulserCycle } = await import(join(MODULE, 'pulser.js'));

const levelSource = atlasLevelSource();
/** Everything the route holds by the time it reaches the totem cluster. */
const INVENTORY = Object.freeze({
    hasSword: true, canSwim: true, hasFeather: true, hasFire: true,
});
const LATTICE = 8;

/** The L37 door's arrival, tile (9,18) — the SOUTH room. */
const ARRIVAL = Object.freeze({ x: 144, y: 288 });
/** The chest that is the join, and the two buttonrooms that unlock it. */
const JOIN = Object.freeze({ x: 144, y: 112 });

const claims = [];
const claim = (ok, name, detail) => { claims.push({ ok, name, detail }); };

const world = buildLevelWorld(levelSource(38), { roles: ROLES, inventory: INVENTORY });

// ── ⛓ THE COMPONENT CHECKS, per the standing rule ────────────────────
/**
 * A tile-level flood from a pixel position, under a named geometry.
 *
 * ⚠ THE SAME LATTICE THE PLANNER USES (8 px), because a component the
 * planner cannot walk is not a component. §17's lesson: neither lattice is
 * the game, so the one that decides a ROUTE has to be the one the route is
 * planned at.
 */
function compAt(start, opts) {
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= world.width * 2 || cy >= world.height * 2) return false;
        const c = nodeCentre(cx, cy, LATTICE);
        try {
            return plannerObstacleAt(world, c.x, c.y, null,
                { inventory: INVENTORY, avoidVolumes: false, ...opts }) === null;
        } catch { return false; }
    };
    const seen = new Set();
    const sx = Math.floor((start.x + 8) / LATTICE);
    const sy = Math.floor((start.y + 8) / LATTICE);
    const frontier = [];
    for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
            if (free(sx + dx, sy + dy)) { seen.add(`${sx + dx},${sy + dy}`); frontier.push([sx + dx, sy + dy]); }
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
const reaches = (comp, p) => comp.has(`${Math.floor(p.x / LATTICE)},${Math.floor(p.y / LATTICE)}`);

const shut = compAt(ARRIVAL, {});
const withCover2 = compAt(ARRIVAL, { openActivators: new Set(['cover@208,224']) });
const withChest = compAt(ARRIVAL, {
    openActivators: new Set(['cover@208,224', 'cover@144,112']),
    openChests: new Set(['chest@144,112']),
});

const link1 = { x: 152, y: 136 };
const link2 = { x: 216, y: 232 };
const stance = { x: 152, y: 130 };
const entrance = { x: 40, y: 56 };

claim(reaches(shut, link1),
    '⛓ link 1 (`buttonroom@144,128`) is in the ARRIVAL\'s component',
    `${shut.size} cells with everything shut`);
claim(!reaches(shut, link2),
    '⛔ link 2 (`buttonroom@208,224`) is NOT — it is under the cover link 1 opens',
    'which is exactly why the order is forced, and it is the first thing a '
    + 'one-line pricing gets wrong');
claim(reaches(withCover2, link2),
    '⛓ …and IS, once `cover@208,224` is open',
    `${withCover2.size} cells (+${withCover2.size - shut.size})`);
claim(reaches(withCover2, stance),
    '⛓ the chest STANCE is in the same component as the arrival throughout',
    'the two-pixel band is south of the chest, so it is reached without the chain');
claim(!reaches(withCover2, entrance),
    '⛔⛔ THE ENTRANCE BUTTON IS NOT — not with both covers open, not ever, '
    + 'until the CHEST opens',
    '§20.8 priced this leg as boot -> button -> door. The button is in the other room.');
claim(reaches(withChest, entrance),
    '⛓⛓ …and it IS, the moment `Chest.open()` writes `type = ""`',
    `${withChest.size} cells (+${withChest.size - withCover2.size}) — the two rooms `
    + 'become one');

// ── ⛔⛔ the stance band, from the same derivation the verb uses ──────
const band = chestStanceBand(JOIN.x, JOIN.y, HITBOX);
claim(band.length === 2 && band[0] === 130 && band[1] === 131,
    '⛔⛔ the stance band is TWO PIXELS',
    `y in {${band.join(', ')}}, probe row ${chestProbeLine(JOIN.x, JOIN.y).y}`);

// ── the drive ─────────────────────────────────────────────────────────
const RELAX = Object.freeze({
    noclip: false,
    noDamage: true,
    noHazards: [],
    grants: [{ level: 38, items: ['sword', 'fire', 'conch', 'feather'] }],
    persistence: [],
});
const legs = [{
    level: 38,
    // The L37 arrival lands ON a second cross-room button (§18): the leg
    // declares what it starts inside, per R1's forced-contact rule.
    contacts: ['proximity-hazard:buttonroom@144,288'],
    targets: [
        { x: link1.x, y: link1.y, hold: { presser: { x: 144, y: 128 }, ticks: 4 } },
        { x: link2.x, y: link2.y, hold: { presser: { x: 208, y: 224 }, ticks: 4 } },
        { x: stance.x, y: stance.y, chest: { chest: { x: JOIN.x, y: JOIN.y } } },
        // ⛓ AND THROUGH THE JOIN: the entrance button, in the north room.
        { x: entrance.x, y: entrance.y, hold: { presser: { x: 32, y: 48 }, ticks: 4 } },
    ],
}];

let out = null;
let failure = null;
try {
    out = synthesizeLegs(legs, {
        levelSource,
        boot: { level: 38, x: ARRIVAL.x, y: ARRIVAL.y },
        relax: RELAX,
        name: 'r5-l38-chain',
        lattice: LATTICE,
        allowGrazes: true,
        maxTicksPerTarget: 1500,
    });
} catch (e) {
    failure = e.message;
}

claim(out !== null, '⛓⛓ THE CHAIN DRIVES END TO END', failure ?? 'synthesized');

if (out) {
    const chest = out.chests[0];
    const holds = out.holds;
    claim(holds.length === 3, 'three holds: two latches and the entrance',
        holds.map((h) => `${h.presser.tag}@${h.presser.x},${h.presser.y}(t=${h.presser.t})`).join(' '));
    claim(holds[0].opened.includes('cover@208,224'),
        'link 1 OPENS the cover link 2 sits under', holds[0].opened.join(' '));
    claim(holds[1].armed.includes('pulser@80,224'),
        '⛓⛓ link 2 ARMS THE PULSER — and it opens nothing, which is why '
        + '`runHold` needed a second observable',
        `opened [${holds[1].opened.join(' ') || 'none'}] armed [${holds[1].armed.join(' ')}]`);
    claim(out.pulses.pushes.length === 1,
        '⛔⛔ THE PULSE MOVES THE BLOCK — once, and the block is then out of range',
        JSON.stringify(out.pulses.pushes));
    claim(chest && chest.chest.id === 'chest@144,112',
        'the chest opened, and its own ledger names the flag it cleared',
        chest ? `tag ${chest.chest.persistTag} at tick ${chest.openedAt}` : 'no chest leg');
    claim(chest && chest.deadFrames === CEREMONY_DEAD_FRAMES.total,
        `the ceremony is ${CEREMONY_DEAD_FRAMES.total} DEAD frames — `
        + `${CEREMONY_DEAD_FRAMES.pickup} of phase A and ${CEREMONY_DEAD_FRAMES.controller} `
        + 'of the SealController behind it',
        'invisible to the observation stream, and the game\'s own `dead_frames` counter '
        + 'is the only witness');
    claim(out.pulses.playerHits.length === 0,
        '⛓ and the walk never enters the 22 px damage ring',
        `${out.pulses.hits.length} pulse ticks, none of them reaching the player`);
}

// ── the report ────────────────────────────────────────────────────────
console.log('\n## ⛓⛓ THE FIVE-LINK CHAIN, DRIVEN\n');
if (out) {
    console.log(`   ticks: ${out.tape.tick_count}   `
        + `spans: ${out.tape.inputs.length}   `
        + `dead frames the ceremony costs: ${CEREMONY_DEAD_FRAMES.total}`);
    console.log(`   pulser cycle: ${JSON.stringify(pulserCycle())}`);
    for (const h of out.holds) {
        console.log(`   hold  ${h.from}..${h.to}  ${h.presser.tag}@${h.presser.x},${h.presser.y} `
            + `t=${h.presser.t}  opened [${h.opened.join(' ') || '-'}]  armed [${h.armed.join(' ') || '-'}]`);
    }
    for (const c of out.chests) {
        console.log(`   chest opened at tick ${c.openedAt}, seal collected at `
            + `${c.collectedAt}, ${c.deadFrames} dead frames, band {${c.band.join(',')}}`);
    }
} else {
    console.log(`   ⛔ ${failure}`);
}

console.log('\n## the claims\n');
let bad = 0;
for (const c of claims) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
console.log(`\n${bad === 0 ? `✓ all ${claims.length} claims hold` : `✗ ${bad} of ${claims.length} FAILED`}\n`);
process.exit(bad === 0 ? 0 : 1);
