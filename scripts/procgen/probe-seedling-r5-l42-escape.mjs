#!/usr/bin/env node
/**
 * probe-seedling-r5-l42-escape — ⛓⛓⛓ THE ONE CHARGE, AND THE ESCAPE IS
 * THERE. ⛔⛔ AND THE REASON SLICE 17 MISSED IT WAS NOT THE GRANULARITY.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 18 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §31.6 (the bounded
 * negative this closes) and §31.9 item 1 (what it asked for).
 * `r5Totem.L42_SOLVE.chain1` is the refuted chain; `.escape` is this.
 *
 * ── ⛓⛓ THE WINDOW, DERIVED RATHER THAN REMEMBERED ────────────────────
 *
 * §31.6 banked the southern escape as arithmetic: *"the player must be at
 * col 6, x ∈ [98,110], with box.y just under 240 at the trigger tick and
 * ≥ 240 within `x - 98` ticks."* Every term of that comes out of two
 * transcriptions and is re-derived below rather than quoted:
 *
 *   A parked at entity (80,224) has BODY [64,96) x [208,240) — `crusherRect`
 *   subtracts `originX/originY` = 16, so the entity cell is a tile IN.
 *   Its EAST lane is that body grown 64 px east: [64,160] x [208,240], and
 *   `laneHitsPlayer` is INCLUSIVE on all four edges (§29.5) where every
 *   other overlap in the class is strict.
 *
 *   ⛓ SO THE LANE'S SOUTHERN EDGE IS ALSO THE BODY'S, AND THE TWO TESTS
 *   DISAGREE ON IT. A player box with `y == 240` is INSIDE the lane
 *   (`box.y <= 240`) and OUTSIDE the body (`box.y < 240` fails). That one
 *   pixel is the whole escape: the player can be seen from a cell the body
 *   cannot reach.
 *
 *   ⛓ AND THE STANCE'S WEST EDGE IS SET BY LAST-MATCH-WINS, not by the
 *   room. `DIRECTIONS` is E,N,W,S with no `break`, so a stance in both the
 *   east and the south lane is charged at from the SOUTH. A's south lane is
 *   [64,96] x [208,304]; a player box with `box.x <= 96` is in it. So the
 *   eastward stance needs `box.x > 96`, i.e. entity `x >= 99` — and the
 *   margin, A's right edge starting at 96 and closing at 1 px/tick, is
 *   `box.x - 96 = x - 98` ticks. Two conventions, one tile, both derived.
 *
 * ── ⛔⛔⛔ AND THE ARM THE BRIEF PRESCRIBED IS THE ONE THAT DIES ───────
 *
 * §31.6's negative was honest about being a heuristic's negative and named
 * the wrong cause: *"a ~10 px window in one 16 px tile is exactly the size
 * a block search steps over"* — so §31.9 asked for one tick. Measured, the
 * arm that finds the escape is the COARSEST one run:
 *
 *     8-tick blocks, confined to col 6   FOUND at depth 26, 216 ticks
 *     4-tick blocks, NOT confined        DIED  at depth 27, 108/108 RUN OVER
 *     1-tick blocks, confined            DIED  at depth 63, 72/72 SEEN
 *
 * ⛔⛔ AND THE TWO DEATHS ARE DIFFERENT FAILURES. The unconfined arm is
 * refused by the ROOM: without the wall this score walks the player east
 * and every successor takes a contact. The 1-tick arm is refused by
 * ITSELF: 72 of 72 successors are states the frontier has already
 * expanded, zero run over, zero out of bounds — and with an EXACT
 * signature in place of the rounded one it dies at the same depth for the
 * same reason. A beam over a MOVING world may not dedup across depths on
 * the world state alone: a crusher one tick from committing and one that
 * committed sixty ticks ago are the same `(x, y)`, so "wait one more tick"
 * is a move the search cannot express.
 *
 * ⇒ **a finer step is not a stronger search.** A block search's reach is
 * `block x depth`; shrinking the block shortens the horizon and multiplies
 * the ways two candidates can look the same. And a positive is a property
 * of the TRIPLE (score, granularity, constraint) — naming one of the three
 * is how a negative gets the wrong cause attached to it.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l42-escape.mjs [--arms] [--map]
 *
 * `--arms` re-runs the three beam arms (~6 minutes). The default run
 * derives the window and DRIVES the banked escape, which is the claim.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { L42_PART4, L42_SOLVE } = await import(join(MODULE, 'r5Totem.js'));
const {
    CRUSHER, DIRECTIONS, crusherRect, detectionRects, laneHitsPlayer,
} = await import(join(MODULE, 'crusher.js'));

const ARMS = process.argv.includes('--arms');
const levelSource = atlasLevelSource();
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world = buildLevelWorld(levelSource(42), { roles: ROLES, inventory: held });
const A = L42_PART4.crushers[0].id;

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

// ── the window, computed ──────────────────────────────────────────────
const ESCAPE = L42_SOLVE.escape;
const parked = { x: ESCAPE.chargeFrom.x, y: ESCAPE.chargeFrom.y };
const body = crusherRect(parked);
const lanes = Object.fromEntries(detectionRects(parked).map((r) => [r.dir, r]));

console.log('## the charge');
console.log(`   ${A} parked at entity (${parked.x},${parked.y}) — body `
    + `[${body.x},${body.right}) x [${body.y},${body.bottom})`);
for (const d of DIRECTIONS) {
    const r = lanes[d.name];
    console.log(`   lane ${d.name}: [${r.x},${r.right}] x [${r.y},${r.bottom}]`);
}

check(body.x === parked.x - CRUSHER.originX && body.bottom === parked.y - CRUSHER.originY + CRUSHER.h
    && lanes.E.right === body.right + CRUSHER.intDist && lanes.S.bottom === body.bottom + CRUSHER.intDist,
'⛓ THE BODY IS A TILE IN FROM THE ENTITY, AND EACH LANE CONTAINS IT',
`body [${body.x},${body.right}) x [${body.y},${body.bottom}), east lane to ${lanes.E.right}, `
+ `south lane to ${lanes.S.bottom}. The entity cell is `
+ '`super(_x + Tile.w, _y + Tile.h)` and the hitbox is `setHitbox(32,32,16,16)`, so every '
+ 'stance arithmetic taken off the ENTITY position is 16 px wrong in both axes.');

/**
 * ⛓⛓ THE ONE-PIXEL SEAM, ASKED OF THE TWO FUNCTIONS THEMSELVES. A player
 * box sitting exactly on the lane's southern edge is IN the lane and OUT of
 * the body — `laneHitsPlayer` is `<=` (§29.5) and the sweep's own overlap
 * is `<`. That is not a rounding detail: it is the only place in this room
 * where a stance can be seen from outside the swept volume.
 */
{
    const onEdge = playerBoxAt(ESCAPE.stance.x, body.bottom + 2);
    const overlapsBody = onEdge.x < body.right && onEdge.right > body.x
        && onEdge.y < body.bottom && onEdge.bottom > body.y;
    check(onEdge.y === body.bottom && laneHitsPlayer(onEdge, lanes.E) && !overlapsBody,
        '⛓⛓ THE LANE IS INCLUSIVE AND THE BODY IS STRICT — one pixel, and it is the escape',
        `box.y ${onEdge.y} against the body's bottom ${body.bottom}: in the east lane `
        + `${laneHitsPlayer(onEdge, lanes.E)}, overlapping the body ${overlapsBody}. `
        + '⛓ So the southern edge of the lane is a stance the charge cannot reach — the '
        + 'player is SEEN from a cell the body sweeps past one pixel above.');
}

/**
 * ⛓ THE STANCE BAND, ENUMERATED. Sweep the tile at col 6 a pixel at a time
 * and keep the entity x whose box is (a) inside the east lane, (b) NOT
 * inside the south lane — because `DIRECTIONS` has no `break` and S is
 * last, so a stance in both is charged at from the south — and (c) inside
 * the tile. The margin is what the band is worth.
 */
{
    const col = ESCAPE.col;
    const band = [];
    for (let x = col * TILE_SIZE; x < (col + 1) * TILE_SIZE; x += 1) {
        const box = playerBoxAt(x, body.bottom + 2);
        if (box.x < col * TILE_SIZE || box.right > (col + 1) * TILE_SIZE) continue;
        if (!laneHitsPlayer(box, lanes.E)) continue;
        if (laneHitsPlayer(box, lanes.S)) continue;
        band.push({ x, margin: box.x - body.right });
    }
    console.log(`\n## the stance band at col ${col}`);
    console.log(`   x ∈ [${band[0]?.x},${band[band.length - 1]?.x}], margin `
        + `${band[0]?.margin}..${band[band.length - 1]?.margin} ticks`);
    check(band.length > 0 && band[0].x === ESCAPE.band.x0
        && band[band.length - 1].x === ESCAPE.band.x1
        && band[0].margin === ESCAPE.band.margin0
        && band[band.length - 1].margin === ESCAPE.band.margin1,
    '⛓⛓ THE BAND IS 12 PIXELS WIDE AND ITS MARGIN IS `x - 98` TICKS, DERIVED',
    `x ∈ [${band[0]?.x},${band[band.length - 1]?.x}] against the banked `
    + `[${ESCAPE.band.x0},${ESCAPE.band.x1}], margin `
    + `${band[0]?.margin}..${band[band.length - 1]?.margin} against `
    + `${ESCAPE.band.margin0}..${ESCAPE.band.margin1}. The west edge is `
    + 'LAST-MATCH-WINS, not the room: one pixel further west and the south lane matches '
    + 'too and A charges the other way. ⛔ §31.6 called this "a ~10 px window in a 16 px '
    + 'tile that a block search steps over" — it is 12, and the block was never what '
    + 'stepped over it.');
}

// ── the escape, DRIVEN ────────────────────────────────────────────────
/**
 * ⛓⛓⛓ THE CHAIN, RE-SEARCHED AND DRIVEN TO A WESTERN END. Same room, same
 * `stepCrusher`, same three parks the ordering asks for — and the player
 * finishes on the part's side of the body it just parked, which is the one
 * thing §31.6 could not get.
 *
 * ⛓ THE IDLE HOLD IS PART OF THE CLAIM. A park is a POSITION and a live
 * scanner (§29.8), and the stance this ends on is 0.03 px outside A's WEST
 * lane — so "it worked" is only true if it is still true after the run
 * stops pressing keys. The tail below is asserted, not assumed.
 */
{
    const run = createLevelRun({
        levelSource, boot: { level: 42, ...ESCAPE.boot }, noDamage: true, roles: [...ROLES],
        grants: [{ level: 42, items: [...ESCAPE.items] }],
    });
    let t = 0;
    for (const span of [...ESCAPE.approach, ...ESCAPE.spans]) {
        const keys = span.key ? new Set(span.key.split('+')) : new Set();
        for (let i = 0; i < span.ticks; i += 1) { run.advance(keys); t += 1; }
    }
    const atEnd = { x: run.state.x, y: run.state.y };
    for (let i = 0; i < ESCAPE.idleTicks; i += 1) run.advance(new Set());
    const c = run.crushers.get(A);
    const box = playerBoxAt(run.state.x, run.state.y);
    console.log(`\n## the escape, driven — ${t} ticks + ${ESCAPE.idleTicks} idle`);
    console.log(`   A ends (${c.x},${c.y}), ${run.crusherContacts.length} contact(s), player `
        + `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) tile `
        + `(${Math.floor(run.state.x / TILE_SIZE)},${Math.floor(run.state.y / TILE_SIZE)})`);

    check(c.x === ESCAPE.park.x && c.y === ESCAPE.park.y && run.crusherContacts.length === 0,
        '⛓⛓⛓ THE THREE CHARGES DRIVE, AND THE PARK IS THE ORDERING\'S OWN',
        `A (${c.x},${c.y}) against (${ESCAPE.park.x},${ESCAPE.park.y}), `
        + `${run.crusherContacts.length} contact(s) over ${t + ESCAPE.idleTicks} ticks. `
        + 'Same three parks as `L42_SOLVE.ordering`\'s chain 1 — the ordering was never '
        + 'in question, only whether a player could survive realising it and end on the '
        + 'right side.');

    const west = box.right <= ESCAPE.westOf;
    check(west && ESCAPE.endsInWestRegion === true,
        '⛓⛓⛓ …AND THE PLAYER FINISHES **WEST** OF IT — §31.6 CLOSED',
        `player box right ${box.right.toFixed(2)} against the parked body's west face `
        + `${ESCAPE.westOf}. §31.6 drove this chain to tile (15,13), the far side, and `
        + 'bounded its own negative honestly: "not found is not impossible". It was not '
        + 'impossible. ⛓ The escape is SOUTH into the col-6 shaft, which is the only '
        + 'break in the corridor floor inside A\'s 64 px east lane.');

    /**
     * ⛓⛓ THE STANCE IS 0.09 px OUTSIDE A's NEW WEST LANE, AND THAT IS
     * MEASURED. `crusherScans` is the scan the STEP takes — same solid
     * list, same two player shapes — so "it cannot see me" is the run's own
     * answer rather than a second copy of the model (§30.6). The arithmetic
     * beside it is why the margin is worth naming: a tenth of a pixel.
     */
    const scans = run.crusherScans;
    const westLaneLeft = ESCAPE.park.x - CRUSHER.originX - CRUSHER.intDist;
    check([...scans.values()].every((s) => s.dir === null)
        && Math.abs(run.state.x - atEnd.x) < 1e-9 && Math.abs(run.state.y - atEnd.y) < 1e-9,
    '⛓⛓ AND IT HOLDS — 300 idle ticks, both scanners null, the player not one pixel moved',
    `player moved ${Math.hypot(run.state.x - atEnd.x, run.state.y - atEnd.y).toFixed(6)} px `
    + `over ${ESCAPE.idleTicks} idle ticks; scans [${[...scans.entries()]
        .map(([id, s]) => `${id}=${s.dir}`).join(' ')}]. ⛓ The clearance is `
    + `${(westLaneLeft - box.right).toFixed(2)} px — A's new WEST lane starts at `
    + `${westLaneLeft} and the player's box ends at ${box.right.toFixed(2)}. A parked `
    + 'crusher re-derives `v` on every tick it is at rest, so a choreography that ends a '
    + 'tenth of a pixel outside a lane is making a claim about every tick after it, not '
    + 'only the last one it pressed.');
}

// ── the three arms (opt-in: ~6 minutes) ───────────────────────────────
if (ARMS) {
    const K = ['', 'up', 'down', 'left', 'right', 'up+left', 'up+right', 'down+left', 'down+right'];
    const KEYSETS = K.map((k) => (k ? new Set(k.split('+')) : new Set()));
    const prefixTicks = [];
    for (const s of ESCAPE.approach) {
        const k = s.key ? new Set(s.key.split('+')) : new Set();
        for (let i = 0; i < s.ticks; i += 1) prefixTicks.push(k);
    }
    const runArm = ({ block, confine, width, maxDepth, exact }) => {
        const drive = (seq) => {
            const run = createLevelRun({
                levelSource, boot: { level: 42, ...ESCAPE.boot }, noDamage: true,
                roles: [...ROLES], grants: [{ level: 42, items: [...ESCAPE.items] }],
            });
            for (const k of prefixTicks) run.advance(k);
            for (const k of seq) {
                run.advance(k);
                if (confine && playerBoxAt(run.state.x, run.state.y).right > confine) return null;
                if (run.crusherContacts.length > 0) return null;
            }
            return run;
        };
        const nodeOf = (seq, run) => {
            const c = run.crushers.get(A);
            return {
                seq,
                cx: c.x,
                cy: c.y,
                px: run.state.x,
                py: run.state.y,
                vx: run.state.vx,
                vy: run.state.vy,
                box: playerBoxAt(run.state.x, run.state.y),
                atPark: c.x === ESCAPE.park.x && c.y === ESCAPE.park.y && run.crushersParked,
            };
        };
        const score = (n) => (n.cy - ESCAPE.chargeFrom.y + 64) * 10 + (n.cx - 80) * 100
            + (n.box.x >= ESCAPE.col * TILE_SIZE
                && n.box.right <= (ESCAPE.col + 1) * TILE_SIZE ? 200 : 0)
            - Math.abs(n.box.y - (body.bottom - 2)) * 2 + n.box.x;
        const sig = (n) => (exact
            ? `${n.cx},${n.cy}|${n.px},${n.py}|${n.vx},${n.vy}`
            : `${n.cx},${n.cy}|${Math.round(n.px * 2)},${Math.round(n.py * 2)}`
                + `|${Math.round(n.vx * 4)},${Math.round(n.vy * 4)}`);
        const seen = new Set();
        let beam = [nodeOf([], drive([]))];
        const why = { driveNull: 0, alreadySeen: 0, kept: 0 };
        for (let d = 0; d < maxDepth; d += 1) {
            const next = [];
            Object.assign(why, { driveNull: 0, alreadySeen: 0, kept: 0 });
            for (const n of beam) {
                for (const ks of KEYSETS) {
                    const seq = [...n.seq, ...Array.from({ length: block }, () => ks)];
                    const run = drive(seq);
                    if (!run) { why.driveNull += 1; continue; }
                    const m = nodeOf(seq, run);
                    if (seen.has(sig(m))) { why.alreadySeen += 1; continue; }
                    seen.add(sig(m));
                    why.kept += 1;
                    next.push(m);
                    if (m.atPark && m.box.right <= ESCAPE.westOf) {
                        return { found: true, ticks: seq.length, depth: d, why };
                    }
                }
            }
            next.sort((a, b) => score(b) - score(a));
            beam = next.slice(0, width);
            if (!beam.length) return { found: false, died: d, why };
        }
        return { found: false, exhausted: maxDepth, why };
    };

    console.log('\n## the three arms');
    for (const arm of L42_SOLVE.escapeArms) {
        const r = runArm(arm);
        console.log(`   ${arm.name}: ${JSON.stringify(r)}`);
        check(r.found === arm.found,
            `${arm.found ? '⛓' : '⛔'} ARM ${arm.name} — ${arm.found ? 'FOUND' : 'DID NOT'}`,
            `${JSON.stringify(r)} against found=${arm.found}. ${arm.why}`);
    }
}

let bad = 0;
console.log('');
for (const c of checks) {
    console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.ok) bad += 1;
}
if (bad > 0) throw new Error(`${bad} of ${checks.length} claims FAILED`);
console.log('\n(the CHECK is `plan-seedling-r5-l42-part4.mjs`, which drives this behind the '
    + 'planner\'s own walk rather than behind a boot at the stance tile)');
