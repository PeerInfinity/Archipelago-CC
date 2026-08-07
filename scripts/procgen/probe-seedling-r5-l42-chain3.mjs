#!/usr/bin/env node
/**
 * probe-seedling-r5-l42-chain3 — ⛓⛓⛓ THE NOOK AS A WALL, AND THE CHAIN IS
 * THERE. ⛔⛔ THE ARM THAT DIED AND THE ARM THAT FOUND IT DIFFER IN ONE TERM.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 19 step 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §32.5 (the death this
 * closes) and §32.8 item 1 (what it asked for). `r5Totem.L42_SOLVE.chain3`
 * is the chain; `.chain3Arms` is the pair of searches.
 *
 * ── ⛔ WHAT §32.5's DEATH WAS ─────────────────────────────────────────
 *
 * A's return chain is W -> (80,224), N -> (80,96), E -> (208,96). Slice 18
 * got the first two charges — the beam found the pre-position unaided — and
 * then the third ran the player down: 90 of 90 successors RUN OVER at depth
 * 43. The top room is two tiles tall, a `Crusher` is exactly 32 px, and B's
 * parked body closes the far end at x = 224, so running east ahead of the
 * charge is a race with no finish line. The only escape is the nook at tile
 * (6,4) — and the nook was in the SCORE, as a distance hint.
 *
 * ── ⛓⛓ AND THE FIX IS ONE TERM OF THE TRIPLE ─────────────────────────
 *
 * Same beam, same 8-tick blocks, same arc-length progress, same prefix (the
 * tape `synthesizeLegs` emits for arrival -> chain 1 -> chain 2 -> stance).
 * The one addition is a WALL, and it is raised PER STAGE:
 *
 *     while the crusher is anywhere on row 96, the player's box must lie
 *     inside [96,112] — the nook's own column
 *
 * With it the beam finds the chain at depth 47. ⛓ Per-stage is not a
 * convenience: the chain STARTS by presenting the player to A's west lane,
 * which needs `box.right >= 112`, so a global confinement to col 6 would
 * forbid the first charge outright. What the wall says is "for THIS charge,
 * the rest of the room is not an option" — which is what a hint cannot say.
 *
 * ── ⛓⛓⛓ THE SEAM, ONE AXIS OVER ──────────────────────────────────────
 *
 * A parked at (80,96) has body `[64,96) x [80,112)` and an east lane
 * `[64,160] x [80,112]`. `laneHitsPlayer` is inclusive on all four edges and
 * the sweep's own overlap is strict (§29.5), so a player box whose `bottom`
 * is exactly 80 is INSIDE the lane and OUTSIDE the body: it triggers the
 * charge from a cell the 32 px body passes one pixel beneath. Chain 1 rides
 * the same disagreement at the col-6 shaft's southern edge; this is it in
 * the other axis, and the two together are the whole room.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r5-l42-chain3.mjs [--search]
 *
 * `--search` re-runs the confined beam (~15 minutes). The default derives
 * the window and DRIVES the banked chain, which is the claim.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { synthesizeLegs, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
const { playerBoxAt } = await import(join(MODULE, 'playerPhysicsV2.js'));
const { L42_PART4, L42_SOLVE } = await import(join(MODULE, 'r5Totem.js'));
const {
    CRUSHER, DIRECTIONS, crusherRect, detectionRects, laneHitsPlayer,
} = await import(join(MODULE, 'crusher.js'));

const SEARCH = process.argv.includes('--search');
const levelSource = atlasLevelSource();
const held = { hasSword: true, hasFire: true, canSwim: true, hasFeather: true };
const world = buildLevelWorld(levelSource(42), { roles: ROLES, inventory: held });
const A = L42_PART4.crushers[0].id;
const C3 = L42_SOLVE.chain3;
const HELD_ITEMS = [...L42_SOLVE.escape.items];
const BOOT = {
    level: 42,
    x: L42_PART4.arrival.tx * TILE_SIZE,
    y: L42_PART4.arrival.ty * TILE_SIZE,
};
const RELAX = {
    noclip: false,
    noDamage: true,
    noHazards: [],
    grants: [{ level: 42, items: [...HELD_ITEMS] }],
    persistence: [],
    equips: [],
    pins: ['sound', 'dead_frames'],
    roles: [...ROLES],
};
const centre = (tx, ty) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

const checks = [];
const check = (ok, name, detail) => checks.push({ ok, name, detail });

// ── the room's own geometry ───────────────────────────────────────────
const room = L42_SOLVE.topRoom;
const freeIn = (ty) => {
    const out = [];
    for (let tx = room.tx0; tx <= room.tx1; tx += 1) {
        if (!plannerObstacleAt(world, tx * TILE_SIZE + 8, ty * TILE_SIZE + 8, null,
            { inventory: held, avoidVolumes: false })) out.push(tx);
    }
    return out;
};
console.log('## the top room');
for (let ty = room.ty0 - 1; ty <= room.ty1 + 1; ty += 1) {
    console.log(`   row ${ty}: free cols [${freeIn(ty).join(' ') || 'none'}]`);
}
check(freeIn(C3.nook.ty).length === 1 && freeIn(C3.nook.ty)[0] === C3.nook.tx
    && freeIn(room.ty0).length === room.tx1 - room.tx0 + 1
    && freeIn(room.ty1).length === room.tx1 - room.tx0 + 1
    && freeIn(room.ty1 + 1).join(' ') === '4 5',
'⛓⛓ THE NOOK IS THE ONLY FREE CELL IN ITS ROW, AND THE ROOM IS EXACTLY A BODY TALL',
`row ${C3.nook.ty} free [${freeIn(C3.nook.ty).join(' ')}], rows ${room.ty0}/${room.ty1} `
+ `open across cols ${room.tx0}..${room.tx1}, row ${room.ty1 + 1} free only at `
+ `[${freeIn(room.ty1 + 1).join(' ')}] — the west corridor. A \`Crusher\` is `
+ `${CRUSHER.h} px and the room is ${(room.ty1 - room.ty0 + 1) * TILE_SIZE} — the same `
+ 'number — so an eastward charge in it has no lateral escape anywhere but those two, '
+ 'and the check below is why they are not one either.');

/**
 * ⛔ AND THE WEST CORRIDOR IS NOT THE SECOND ESCAPE, because of LAST MATCH
 * WINS. Row 7 at cols 4,5 is free and BELOW the swept volume — but a box
 * there is inside the crusher's SOUTH lane as well as its east one, and
 * `DIRECTIONS` is E,N,W,S with no `break`, so a stance in both is charged
 * at from the south. It is the same mechanism that sets the west edge of
 * chain 1's band, one room up: the room does not forbid the cell, the
 * scan's iteration order does.
 */
// ── the seam, asked of the two functions ──────────────────────────────
const from = { x: 80, y: 96 };
const body = crusherRect(from);
const lanes = Object.fromEntries(detectionRects(from).map((r) => [r.dir, r]));
console.log('\n## the third charge');
console.log(`   ${A} parked at (${from.x},${from.y}) — body [${body.x},${body.right}) x `
    + `[${body.y},${body.bottom})`);
for (const d of DIRECTIONS) {
    const r = lanes[d.name];
    console.log(`   lane ${d.name}: [${r.x},${r.right}] x [${r.y},${r.bottom}]`);
}

/**
 * ⛓⛓ THE BAND, ENUMERATED. Sweep the nook's column a pixel at a time and
 * keep every entity position whose box (a) lies inside the column, (b) is
 * inside the EAST lane, (c) matches no LATER direction — `DIRECTIONS` is
 * E,N,W,S with no `break`, so last match wins — and (d) does not overlap
 * the swept body. The last condition is what makes it an escape rather
 * than a stance.
 */
{
    const col = C3.nook.tx;
    const band = [];
    for (let x = col * TILE_SIZE; x < (col + 1) * TILE_SIZE; x += 1) {
        for (let y = C3.nook.ty * TILE_SIZE; y < (C3.nook.ty + 1) * TILE_SIZE; y += 1) {
            const box = playerBoxAt(x, y);
            if (box.x < col * TILE_SIZE || box.right > (col + 1) * TILE_SIZE) continue;
            const hits = DIRECTIONS.map((d) => d.name).filter((d) => laneHitsPlayer(box, lanes[d]));
            if (hits[hits.length - 1] !== 'E') continue;
            const swept = box.bottom > body.y && box.y < body.bottom;
            if (swept) continue;
            band.push({ x, y, margin: box.x - body.right, bottom: box.bottom });
        }
    }
    console.log(`\n## the trigger-and-survive band in the nook (col ${C3.nook.tx}, `
        + `row ${C3.nook.ty})`);
    console.log(`   ${band.length} cell(s); y ∈ [${Math.min(...band.map((b) => b.y))},`
        + `${Math.max(...band.map((b) => b.y))}], x ∈ [${Math.min(...band.map((b) => b.x))},`
        + `${Math.max(...band.map((b) => b.x))}], margin `
        + `${Math.min(...band.map((b) => b.margin))}..${Math.max(...band.map((b) => b.margin))} ticks`);
    check(band.length > 0 && band.every((b) => b.bottom === body.y),
        '⛓⛓⛓ THE LANE IS INCLUSIVE WHERE THE BODY IS STRICT — one pixel, and it is the '
            + 'escape again',
        `${band.length} cell(s), every one of them with box.bottom exactly ${body.y} — the `
        + 'swept body\'s own top edge. `laneHitsPlayer` is `box.bottom >= lane.y` and the '
        + 'overlap is `box.bottom > body.y`, so this row of pixels is SEEN from a cell the '
        + 'body passes one pixel beneath. ⛓ Chain 1 rides the same disagreement at the '
        + 'col-6 shaft\'s southern edge; this is it in the other axis.');
    check(band.every((b) => b.margin >= 1) && Math.max(...band.map((b) => b.margin)) <= 12,
        '⛓ …AND THE MARGIN IS `box.x - 96` TICKS, the same quantity chain 1 is measured in',
        `${Math.min(...band.map((b) => b.margin))}..${Math.max(...band.map((b) => b.margin))} `
        + `ticks. A charging body closes at ${CRUSHER.speed} px/tick from `
        + `${body.right}; the player walks at 1.2. ⛓ Which is why the beam does not have `
        + 'to hit the exact pixel: it can trigger from a tenth of a pixel INSIDE the '
        + 'volume and rise out of it inside the margin, which is what the chain does — '
        + `its resting box is [${playerBoxAt(C3.playerEndsAt.x, C3.playerEndsAt.y).y.toFixed(2)},`
        + `${playerBoxAt(C3.playerEndsAt.x, C3.playerEndsAt.y).bottom.toFixed(2)}], `
        + `${(body.y - playerBoxAt(C3.playerEndsAt.x, C3.playerEndsAt.y).bottom).toFixed(2)} px `
        + 'clear of the sweep.');
}

{
    // Row 7, cols 4,5 — the only other free cells an eastward charge could
    // reach, and every one of them is charged at from the SOUTH instead.
    const cells = [];
    for (let tx = room.tx0; tx <= room.tx1; tx += 1) {
        if (plannerObstacleAt(world, tx * TILE_SIZE + 8, (room.ty1 + 1) * TILE_SIZE + 8, null,
            { inventory: held, avoidVolumes: false })) continue;
        const box = playerBoxAt(tx * TILE_SIZE + 8, (room.ty1 + 1) * TILE_SIZE + 8);
        const hits = DIRECTIONS.map((d) => d.name).filter((d) => laneHitsPlayer(box, lanes[d]));
        cells.push({ tx, last: hits[hits.length - 1] ?? null });
    }
    check(cells.length > 0 && cells.every((c) => c.last !== 'E'),
        '⛔ …AND THE WEST CORRIDOR IS NOT A SECOND ESCAPE — LAST MATCH WINS',
        `row ${room.ty1 + 1}: ${cells.map((c) => `col ${c.tx} charges ${c.last}`).join(', ')}. `
        + 'Those cells are free and BELOW the swept volume, so geometry alone would make '
        + 'them an escape. `DIRECTIONS` is E,N,W,S with no `break`, and a box at col 4 or '
        + '5 is inside the SOUTH lane as well as the east one — so presenting the player '
        + 'there charges the crusher the other way and the chain never happens. ⛓ Same '
        + 'mechanism as the west edge of chain 1\'s band: the room does not forbid the '
        + 'cell, the scan\'s iteration order does.');
}

// ── the chain, DRIVEN behind the planner's own walk ───────────────────
/**
 * ⛓⛓⛓ THREE BAITS FROM THE ARRIVAL. The prefix is not a boot at the stance
 * tile: it is the tape `synthesizeLegs` emits for arrival -> chain 1 ->
 * chain 2 -> chain 3's stance, so the choreography is verified from the
 * state the real walk leaves. A boot would also RESET both crushers to
 * their constructor cells, which is the whole reason this cannot be
 * shortened.
 */
{
    const baitOf = (crusher, chain, stance) => ({
        ...centre(stance.tx, stance.ty),
        bait: {
            crusher,
            approach: chain.approach.map((s) => ({ ...s })),
            spans: chain.spans.map((s) => ({ ...s })),
            park: { ...chain.park },
        },
    });
    const out = synthesizeLegs([{
        level: 42,
        targets: [
            baitOf({ x: 96, y: 144 }, L42_SOLVE.escape, L42_PART4.chainA.stance),
            baitOf({ x: 128, y: 144 }, L42_SOLVE.chain2, L42_SOLVE.chain2.stance),
            baitOf({ x: 96, y: 144 }, C3, C3.stance),
        ],
    }], {
        levelSource, boot: { ...BOOT }, relax: RELAX, name: 'l42-chain3',
        lattice: 8, allowGrazes: true, maxTicksPerTarget: 6000,
    });
    const b3 = out.baits[2];
    console.log(`\n## the chain, driven — ${out.tape.tick_count} ticks from the arrival`);
    console.log(`   bait 3: ${b3.crusherFrom.x},${b3.crusherFrom.y} -> `
        + `${b3.crusherTo.x},${b3.crusherTo.y} (${b3.approachTicks} approach + `
        + `${b3.ticks - b3.approachTicks} escape)`);
    check(b3.crusherTo.x === C3.park.x && b3.crusherTo.y === C3.park.y
        && b3.ticks === C3.ticks && out.tape.tick_count === C3.tripleTicks,
    '⛓⛓⛓ THE THIRD CHAIN DRIVES, AND ITS PARK IS THE ORDERING\'S OWN',
    `${A} (${b3.crusherTo.x},${b3.crusherTo.y}) against (${C3.park.x},${C3.park.y}), `
    + `${b3.ticks} ticks against ${C3.ticks}, ${out.tape.tick_count} from the arrival `
    + `against ${C3.tripleTicks}. \`runBait\` asserts the crusher was AT REST when the `
    + 'verb began, AWAKE when the approach ended, parked at the declared POSITION, and '
    + 'never once overlapping the player — so this is the run\'s answer and not a replay.');
    check(b3.dir === C3.recordDir && C3.lastCharge !== C3.recordDir,
        '⛔⛔ …AND THE RECORD\'S `dir` IS THE NET DISPLACEMENT, WHICH FOR A CHAIN IS NOT '
            + 'ANY CHARGE',
        `the record says ${b3.dir}; the chain's charges are [${C3.charges.join(' ')}] and `
        + `its last is ${C3.lastCharge}. \`runBait\` derives the field from `
        + '`after - before` on the reading that "a charge is committed at rest and never '
        + 're-aimed, so the net displacement IS the direction it was charged in" — true '
        + 'of ONE charge. This chain goes W 112, N 128, E 128 and nets (+16,-128). ⛓ '
        + 'Chains 1 and 2 both report E and both happen to end on an E charge, which is '
        + 'why three drives were needed before the field disagreed with itself. Nothing '
        + 'consumes it; what it costs is a reader.');
}

// ── the search, re-run (opt-in: ~15 minutes) ──────────────────────────
if (SEARCH) {
    /**
     * ⛓ THE ARMS ARE THE SAME BEAM. Everything below is shared: the 8-tick
     * block, the 10-wide beam, the arc-length progress term along the
     * ordering's own parks, the per-stage positional hints and the prefix.
     * Only `CONFINES` differs, and that is the point.
     */
    const K = ['', 'up', 'down', 'left', 'right', 'up+left', 'up+right', 'down+left', 'down+right'];
    const KEYSETS = K.map((k) => (k ? new Set(k.split('+')) : new Set()));
    const baitOf = (crusher, chain, stance) => ({
        ...centre(stance.tx, stance.ty),
        bait: {
            crusher,
            approach: chain.approach.map((s) => ({ ...s })),
            spans: chain.spans.map((s) => ({ ...s })),
            park: { ...chain.park },
        },
    });
    const pre = synthesizeLegs([{
        level: 42,
        targets: [
            baitOf({ x: 96, y: 144 }, L42_SOLVE.escape, L42_PART4.chainA.stance),
            baitOf({ x: 128, y: 144 }, L42_SOLVE.chain2, L42_SOLVE.chain2.stance),
            centre(C3.stance.tx, C3.stance.ty),
        ],
    }], {
        levelSource, boot: { ...BOOT }, relax: RELAX, name: 'l42-chain3-prefix',
        lattice: 8, allowGrazes: true, maxTicksPerTarget: 6000,
    });
    const prefix = [];
    for (let t = 0; t < pre.tape.tick_count; t += 1) prefix.push(new Set());
    for (const s of pre.tape.inputs) for (let t = s.from; t < s.to; t += 1) prefix[t].add(s.key);
    console.log(`\n## the search — prefix ${prefix.length} ticks, ${pre.baits.length} baits`);

    /** ⛔ PROGRESS IS ARC LENGTH ALONG THE ORDERING, not distance from home. */
    const PARKS = [[192, 224], [80, 224], [80, 96], [208, 96]];
    const between = (a, b, c) => Math.min(a, b) <= c && c <= Math.max(a, b);
    const progress = (n) => {
        let base = 0;
        let best = 0;
        for (let i = 0; i + 1 < PARKS.length; i += 1) {
            const [ax, ay] = PARKS[i];
            const [bx, by] = PARKS[i + 1];
            if (between(ax, bx, n.cx) && between(ay, by, n.cy)
                && (ax === bx ? n.cx === ax : n.cy === ay)) {
                best = base + Math.abs(n.cx - ax) + Math.abs(n.cy - ay);
            }
            base += Math.abs(bx - ax) + Math.abs(by - ay);
        }
        return best;
    };
    /**
     * ⛓⛓ THE HINT IS PER STAGE, and so is the WALL. Once a charge commits
     * every candidate shares the crusher, so a score made of crusher
     * progress TIES across the whole beam (§31.6) — the positional term is
     * what tells the player where to be while nothing it does can change
     * the crusher. Keyed `cx,cy` then `cx,*` then `*,cy`.
     */
    const HINTS = {
        '192,224': [118, 216], '*,224': [72, 150], '80,224': [72, 141],
        '80,*': [105, 76], '80,96': [105, 78], '*,96': [105, 74],
    };
    const lookup = (map, cx, cy) => map[`${cx},${cy}`] ?? map[`${cx},*`] ?? map[`*,${cy}`];
    const score = (n) => {
        const h = lookup(HINTS, n.cx, n.cy);
        return progress(n) * 100 + (h ? -Math.hypot(n.px - h[0], n.py - h[1]) * 3 : 0);
    };

    const runArm = ({ confine, block = 8, width = 10, maxDepth = 80 }) => {
        const CONFINES = confine ? { '*,96': [confine.x0, confine.x1] } : {};
        const drive = (seq, idle = 0) => {
            const run = createLevelRun({
                levelSource, boot: { ...BOOT }, noclip: false, ...RELAX,
            });
            for (const k of prefix) run.advance(k);
            const base = run.crusherContacts.length;
            const ok = () => {
                if (run.crusherContacts.length > base) return false;
                const c = run.crushers.get(A);
                const w = lookup(CONFINES, c.x, c.y);
                if (!w) return true;
                const b = playerBoxAt(run.state.x, run.state.y);
                return b.x >= w[0] && b.right <= w[1];
            };
            for (const k of seq) { run.advance(k); if (!ok()) return null; }
            for (let i = 0; i < idle; i += 1) { run.advance(new Set()); if (!ok()) return null; }
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
                atPark: c.x === C3.park.x && c.y === C3.park.y && run.crushersParked,
            };
        };
        const sig = (n) => `${n.cx},${n.cy}|${Math.round(n.px * 2)},${Math.round(n.py * 2)}`
            + `|${Math.round(n.vx * 4)},${Math.round(n.vy * 4)}`;
        const seen = new Set();
        let beam = [nodeOf([], drive([]))];
        for (let d = 0; d < maxDepth; d += 1) {
            const next = [];
            const why = { runOver: 0, alreadySeen: 0, kept: 0 };
            for (const n of beam) {
                for (const ks of KEYSETS) {
                    const seq = [...n.seq, ...Array.from({ length: block }, () => ks)];
                    const run = drive(seq);
                    if (!run) { why.runOver += 1; continue; }
                    const m = nodeOf(seq, run);
                    if (seen.has(sig(m))) { why.alreadySeen += 1; continue; }
                    seen.add(sig(m));
                    why.kept += 1;
                    next.push(m);
                    if (m.atPark && drive(seq, 200)) {
                        return { found: true, depth: d, ticks: seq.length, why };
                    }
                }
            }
            next.sort((a, b) => score(b) - score(a));
            beam = next.slice(0, width);
            if (!beam.length) return { found: false, depth: d, why };
        }
        return { found: false, exhausted: maxDepth };
    };

    for (const arm of L42_SOLVE.chain3Arms) {
        const r = runArm({ confine: arm.confine });
        console.log(`   ${arm.name}: ${JSON.stringify(r)}`);
        check(r.found === arm.found && r.depth === arm.depth,
            `${arm.found ? '⛓' : '⛔'} ARM "${arm.name}" — ${arm.found ? 'FOUND' : 'DIED'} `
                + `at depth ${arm.depth}`,
            `${JSON.stringify(r)} against found=${arm.found} depth=${arm.depth}. ${arm.why}`);
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
console.log('\n(the CHECK is `plan-seedling-r5-l42-part4.mjs`, which drives all three chains, '
    + 'collects the part and takes the exit)');
