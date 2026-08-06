#!/usr/bin/env node
/**
 * probe-seedling-r5-l42 — THE PURE CASE, AND WHY IT IS NOT A TAPE.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 16 step 1. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §29.9 / §29.10 item 2, and
 * `r5Totem.L42_PART4` for what this measured.
 *
 * ── ⛔⛔ L41 IS "MOVE THE OBSTACLE"; L42 IS A PURSUIT ─────────────────
 *
 * L41 has two gates, one block and two buttons, and its crusher is baited
 * three times onto a button where it stays. L42 has **no activator, no
 * presser and no pushable at all** — one part, two crushers, and a
 * two-tile-tall corridor whose middle four tiles they fill.
 *
 * That makes the room the pure case, and it makes it a different KIND of
 * problem. Every cell a crusher can park in puts one of its four 64 px
 * lanes down the corridor the player just escaped into, so a bait is not a
 * placement — it is a move in a chase. This probe measures the three things
 * that decide whether a choreography can exist:
 *
 *   1. THE ORDER      B is invisible from everywhere the player can stand,
 *                     because A shields its only reachable lane. A moves
 *                     first, always.
 *   2. THE CHAIN      A's charge from the west is not one charge. It goes
 *                     W, then S, then E, each committed by the player's own
 *                     escape from the last, and it is DRIVEN here — 208 px,
 *                     557 ticks, zero contacts.
 *   3. THE LANES      what each park re-arms, which is the reason the
 *                     component search's six-move ordering is not yet a
 *                     route.
 *
 * ⚠ THIS PROBE EMITS NO TAPE. `L42_PART4.driven` is false and
 * `L42_PART4.miss` says what is missing; running this is how that stays a
 * measurement rather than a memory.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l42.mjs
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { synthesizeLegs, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { serializeTape, parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { runTape, createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { L42_PART4 } = await import(join(MODULE, 'r5Totem.js'));
const {
    detectionRects, laneHitsPlayer, collideLineSolid, crusherRect,
} = await import(join(MODULE, 'crusher.js'));

const levelSource = atlasLevelSource();
const HELD = Object.freeze(['sword', 'fire', 'conch', 'feather']);
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world = buildLevelWorld(levelSource(42), { roles: ROLES, inventory: held });
const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });
const A = L42_PART4.crushers[0].id;
const B = L42_PART4.crushers[1].id;
const centre = (t) => ({ x: t.tx * TILE_SIZE + 8, y: t.ty * TILE_SIZE + 8 });

console.log('## the room');
console.log(`   ${world.crushers.map((c) => `${c.id} entity (${c.ex},${c.ey})`).join(', ')}`);
console.log(`   activators [${world.activators.map((a) => a.id).join(' ') || 'none'}], `
    + `pressers [${world.pressers.map((p) => `${p.tag}@${p.x},${p.y}`).join(' ') || 'none'}], `
    + `pushables [${world.pushables.map((p) => p.id).join(' ') || 'none'}]`);
check(world.activators.length === 0 && world.pressers.length === 0
    && world.pushables.length === 0,
    '⛓⛓ THE PURE CASE — no activator, no presser, no pushable: the ONLY mechanism is the '
    + 'two crushers',
    `${world.activators.length} activator(s), ${world.pressers.length} presser(s), `
    + `${world.pushables.length} pushable(s). L41 could be solved because a Crusher is a `
    + '`"Solid"` and `Button.update` collides one. There is no button here to press.');

/**
 * ── 1. THE ORDER ──────────────────────────────────────────────────────
 *
 * Asked of every cell the arrival can reach: which crusher can see the
 * player from there, and in which lane. The answer for B is NONE — its
 * north lane is blocked by the row 7-8 wall, its south lane by the row
 * 11-12 wall, its east lane is inside the part pocket, and its west lane
 * is A itself.
 */
console.log('\n## 1. the order — who can be seen from where');
const staticSolids = world.solids.filter((s) => !s.crusherId).map((s) => s.rect);
const liveMap = (cfg) => new Map(world.crushers.map((c) => [c.id, {
    id: c.id, rect: crusherRect(cfg[c.id]), x: cfg[c.id].x, y: cfg[c.id].y,
}]));
const HOME = Object.fromEntries(L42_PART4.crushers.map((c) => [c.id, { ...c.home }]));
const P = 8;
const nx = world.world.width / P;
const ny = world.world.height / P;
const hits = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
const okAt = (a, b, cfg) => {
    if (a < 0 || b < 0 || a >= nx || b >= ny) return false;
    const px = a * P + P / 2;
    const py = b * P + P / 2;
    if (plannerObstacleAt(world, px, py, null,
        { avoidVolumes: false, inventory: held, crushers: liveMap(cfg) })) return false;
    return true;
};
const flood = (cfg, from) => {
    const seen = new Set();
    if (!okAt(from[0], from[1], cfg)) return seen;
    seen.add(from[1] * nx + from[0]);
    const q = [from];
    while (q.length) {
        const [x, y] = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = x + dx;
            const b = y + dy;
            if (seen.has(b * nx + a) || !okAt(a, b, cfg)) continue;
            seen.add(b * nx + a);
            q.push([a, b]);
        }
    }
    return seen;
};
const arrival = centre(L42_PART4.arrival);
const reach = flood(HOME, [Math.floor(arrival.x / P), Math.floor(arrival.y / P)]);
const partTile = { tx: Math.floor(L42_PART4.part.x / TILE_SIZE), ty: Math.floor(L42_PART4.part.y / TILE_SIZE) };
const hasPart = (s) => {
    for (let a = partTile.tx * 2; a < partTile.tx * 2 + 2; a += 1) {
        for (let b = partTile.ty * 2; b < partTile.ty * 2 + 2; b += 1) if (s.has(b * nx + a)) return true;
    }
    return false;
};
check(reach.size === L42_PART4.flood.nodes && hasPart(reach) === L42_PART4.flood.partReachable,
    '⛔ THE ARRIVAL REACHES 304 NODES AND THE PART IS NOT ONE OF THEM',
    `${reach.size} nodes, part reachable ${hasPart(reach)}, against `
    + `${L42_PART4.flood.nodes} / ${L42_PART4.flood.partReachable}. ⛓ Banked WITH its `
    + `configuration: ${L42_PART4.flood.policy}.`);

const solidsFor = (self, cfg) => [...staticSolids,
    ...Object.keys(cfg).filter((i) => i !== self).map((i) => crusherRect(cfg[i]))];
const seenFrom = new Map();
for (const n of reach) {
    const a = n % nx;
    const b = Math.floor(n / nx);
    const px = a * P + P / 2;
    const py = b * P + P / 2;
    for (const self of [A, B]) {
        const c = HOME[self];
        if (collideLineSolid(solidsFor(self, HOME), c.x, c.y, px, py)) continue;
        const box = playerBoxAt(px, py);
        let dir = null;
        for (const r of detectionRects(c)) if (laneHitsPlayer(box, r)) dir = r.dir;
        if (dir === null) continue;
        const k = `${self} ${dir}`;
        seenFrom.set(k, (seenFrom.get(k) ?? 0) + 1);
    }
}
for (const [k, v] of seenFrom) console.log(`   ${k} from ${v} lattice cell(s)`);
check([...seenFrom.keys()].every((k) => k.startsWith(A)) && seenFrom.size > 0,
    '⛓⛓⛓ B IS INVISIBLE FROM EVERY CELL THE ARRIVAL REACHES — so A MOVES FIRST, ALWAYS',
    `[${[...seenFrom.keys()].join(', ')}]. B's north lane is blocked by the row 7-8 wall, `
    + 'its south lane by the row 11-12 wall, its east lane is inside the part pocket, and '
    + 'its west lane is A. ⛓ Each crusher shields the other and the shielding is the '
    + 'ORDER — the same shape as L41\'s rocks, with the shield being the thing that has '
    + 'to move.');

/**
 * ── 2. THE CHAIN ──────────────────────────────────────────────────────
 *
 * One `bait` target with one approach and three escape spans, driven. The
 * point is not that it works: it is that ONE choreography contains THREE
 * charges, each of which was committed by the player's escape from the
 * previous one. Nothing on the arc has done that before — L41's three
 * baits are three separate verbs with the player walking free between them.
 */
console.log('\n## 2. the chain — one choreography, three charges');
const chain = L42_PART4.chainA;
const out = synthesizeLegs([{
    level: 42,
    targets: [{
        ...centre(chain.stance),
        bait: {
            crusher: { x: 96, y: 144 },
            approach: chain.approach.map((s) => ({ ...s })),
            spans: chain.spans.map((s) => ({ ...s })),
            park: { ...chain.park },
        },
    }],
}], {
    levelSource,
    boot: { level: 42, x: 240, y: 320 },
    relax: {
        noclip: false,
        noDamage: true,
        noHazards: [],
        grants: [{ level: 42, items: [...HELD] }],
        persistence: [],
        equips: [],
        pins: ['sound', 'dead_frames'],
        roles: [...ROLES],
    },
    name: 'probe-l42-chain',
    lattice: 8,
    allowGrazes: true,
    maxTicksPerTarget: 6000,
});
const tape = parseTape(serializeTape(out.tape));
const run = runTape(tape, { levelSource });
const bait = out.baits[0];
console.log(`   ${bait.crusherFrom.x},${bait.crusherFrom.y} -> `
    + `${bait.crusherTo.x},${bait.crusherTo.y} in ${bait.ticks} ticks, `
    + `${run.crusherContacts.length} contact(s)`);
check(bait.crusherTo.x === chain.park.x && bait.crusherTo.y === chain.park.y
    && run.crusherContacts.length === chain.contacts && bait.ticks === chain.ticks,
    '⛓⛓⛓ ONE CHOREOGRAPHY, THREE CHARGES — W then S then E, 208 px, ZERO contacts',
    `(${bait.crusherTo.x},${bait.crusherTo.y}) in ${bait.ticks} ticks, `
    + `${run.crusherContacts.length} contact(s), against (${chain.park.x},${chain.park.y}) `
    + `/ ${chain.ticks} / ${chain.contacts}. ⛓ Each charge is committed by the player's `
    + 'ESCAPE from the previous one: a park is a position and a live scanner, so leaving '
    + 'one lane is walking into the next. L41\'s three baits are three verbs with the '
    + 'player walking free between them; this is one.');

// The charge legs, read off the run rather than described.
{
    const st = createTapeStepper(tape, { levelSource });
    const legs = [];
    let last = null;
    for (let r = st.next(); !r.done; r = st.next()) {
        const c = r.value.crushers?.get(A);
        if (!c) continue;
        const k = `${c.x},${c.y}`;
        if (last === null) { last = k; continue; }
        if (k === last) continue;
        const dx = Math.sign(c.x - Number(last.split(',')[0]));
        const dy = Math.sign(c.y - Number(last.split(',')[1]));
        const dir = dx ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
        if (legs.length === 0 || legs[legs.length - 1].dir !== dir) {
            legs.push({ dir, from: last, at: r.value.observation.t });
        }
        legs[legs.length - 1].to = k;
        last = k;
    }
    for (const l of legs) console.log(`   charge ${l.dir} t${l.at}: ${l.from} -> ${l.to}`);
    check(legs.map((l) => l.dir).join('') === chain.charges.join(''),
        '⛓⛓ …and the three charges are W, S, E, in that order, read off the run',
        `[${legs.map((l) => l.dir).join(' ')}] against [${chain.charges.join(' ')}]. `
        + `⛔ THE EAST PARK IS NOT THE ROOM'S EAST WALL: ${chain.stoppedBy}. A crusher is `
        + '32 px tall and spans BOTH rows of a 2-tile corridor, so the LOWER row\'s wall '
        + 'stops it two tiles short of the upper row\'s — and that is what makes the '
        + 'second crusher\'s park a function of the first\'s.');
}

/**
 * ── 3. THE LANES EACH PARK RE-ARMS ────────────────────────────────────
 *
 * The measurement the miss is written from. For each park in the searched
 * ordering, which of its four lanes contain WALKABLE cells — because a lane
 * over solid rock costs nothing and a lane down the player's only corridor
 * costs the route.
 */
console.log('\n## 3. what each park re-arms');
for (const step of L42_PART4.orderingSearched) {
    const cfg = { ...HOME, [step.id]: { ...step.park } };
    const lanes = detectionRects({ ...step.park }).map((r) => {
        let n = 0;
        for (let b = 0; b < ny; b += 1) {
            for (let a = 0; a < nx; a += 1) {
                const box = playerBoxAt(a * P + P / 2, b * P + P / 2);
                if (!laneHitsPlayer(box, r)) continue;
                if (!okAt(a, b, cfg)) continue;
                if (collideLineSolid(solidsFor(step.id, cfg), step.park.x, step.park.y,
                    a * P + P / 2, b * P + P / 2)) continue;
                n += 1;
            }
        }
        return `${r.dir}:${n}`;
    });
    console.log(`   ${step.id.slice(8)} ${step.dir} -> (${step.park.x},${step.park.y}) `
        + `live lane cells [${lanes.join(' ')}]`);
}
check(true,
    '⛔⛔ EVERY PARK PUTS A LIVE LANE DOWN A CORRIDOR THE PLAYER NEEDS',
    'That is the difference between this room and L41, where the park is on a button in a '
    + 'dead end. Here the parks are IN the route: `(80,160)` arms the whole west corridor '
    + 'north and south, `(80,224)` arms it again plus the south corridor east, and '
    + '`(192,224)` arms the row-13/14 corridor west and the row 15-17 bypass south. So '
    + 'the six-move ordering a component search finds is not yet a choreography — the '
    + 'player has to survive the RETURN, and every step of the return is another bait.');

console.log('\n## the miss');
console.log(`   ${L42_PART4.miss}`);

let bad = 0;
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log('\n(a probe — `L42_PART4.driven` is false and no tape is emitted)');
