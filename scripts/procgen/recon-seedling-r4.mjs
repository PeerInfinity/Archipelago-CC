#!/usr/bin/env node
/**
 * recon-seedling-r4 — slice-0 instruments for the hazards rung.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4, slice 0. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §4.0.
 *
 * ── THE QUESTIONS ─────────────────────────────────────────────────────
 *
 * R4 re-arms lava, then ice, then water/waterfall. "Re-arming" is two
 * separate costs and the kickoff (§2.6) is explicit that only the second
 * one is optional:
 *
 *   1. the ROUTE cost — an armed hazard tile becomes planner-forbidden
 *      floor (the pit precedent), so every leg whose A* crossed one has to
 *      re-plan on dry land;
 *   2. the PHYSICS cost — only if some leg must STAND on one anyway, in
 *      which case the sticky `inWater`/`inLava`/`onIce`/`onWaterfall`
 *      flags, `WATER_FRICTION`, the ice friction replacement, the
 *      waterfall push and `checkDrowning` all have to land.
 *
 * Nothing in the recon can size either cost by reading the map: the R3
 * planner FLATTENED all four hazards, so A* was free to walk across a lake
 * and the committed tapes are the only record of whether it did. So
 * `--raw-states` replays the committed R3 tapes through the shipped model
 * and reads the RESOLVER'S OWN ANSWER — `state.terrain`, the raw sticky
 * value `Player._state` keeps (which is exactly why R0 stored raw and
 * coerced only at the effect sites). The model is tick-exact against the
 * recordings, so this is free and authoritative: it is not a prediction
 * about what the walk did, it is what the walk did.
 *
 * ⚠ THE STICKY STATE IS THE RIGHT MEASURE, not "which tile is under the
 * player". `inLava` and friends are assigned from `state`, which is the
 * nearest WALKABLE tile by centre distance and PERSISTS when no candidate
 * intersects — so a tick whose sticky state is Lava is a tick the armed
 * game would have run lava physics on, whatever the player's box overlaps.
 *
 * `--hazard-tiles` is the static complement, and it goes through
 * `buildLevelWorld` (i.e. through `TILE_COLUMN_TO_TYPE`) rather than
 * dividing `tx` by 16 — §2.5's trap: a tileset COLUMN is not a tile type,
 * column 24 is ice and column 36 is bridge, and a hand sweep that skips the
 * table reports lava as ice and misses every bridge.
 *
 * `--floor-policy` asks the ROUTE half directly, and it is the one mode
 * whose answer can end a rung. §3.4's uniform rule is that an armed hazard
 * tile becomes planner-forbidden floor, and the shipped planner already
 * implements exactly that for free: `plannerBlockerAt` reports UNMODELLED
 * TERRAIN as a blocker, and a hazard is unmodelled precisely when the
 * tape's `noHazards` does not coerce it. So dropping a name from the set
 * and re-flooding IS the R4 floor policy, at the R3 planner's own movement
 * granularity, over the R3 clear list — and the question it answers is the
 * narrowed one (the PICKUP'S OWN TILE, `componentsAround`), because a level
 * can stay reachable while the item leaves the claim.
 *
 * ⚠ INSTRUMENTS PROPOSE, THE SHIPPED PLANNER CONFIRMS. R3 learned this
 * three times over in one slice — a reachability graph and a walk are
 * different questions. Nothing here is a route until
 * `plan-seedling-r4-route.mjs` reproduces it.
 *
 * Run: node scripts/procgen/recon-seedling-r4.mjs --raw-states
 *      node scripts/procgen/recon-seedling-r4.mjs --raw-states --tapes=r3-walk-full
 *      node scripts/procgen/recon-seedling-r4.mjs --hazard-tiles
 *      node scripts/procgen/recon-seedling-r4.mjs --floor-policy
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, RELAXED_ROLES, ROLES } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { HAZARD_STATES } = await import(join(MODULE, 'tapeFormat.js'));
const { loadTape, fixtureNames } = await import(join(MODULE, 'fixtures', 'index.js'));

const source = atlasLevelSource();
const LEVEL_COUNT = 116;

/** The four R4 arms, by name, in the order the ladder arms them. */
const R4_HAZARDS = ['lava', 'ice', 'water', 'waterfall'];
const STATE_TO_NAME = new Map(
    Object.entries(HAZARD_STATES).map(([name, t]) => [t, name]),
);

const arg = (name, fallback) => {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};
const has = (name) => process.argv.includes(`--${name}`);

// ── --raw-states ──────────────────────────────────────────────────────

/**
 * Replay one tape and return every RUN of consecutive ticks whose raw
 * sticky terrain state was an R4 hazard.
 *
 * ⚠ The observation stream and the terrain are one tick apart by
 * construction and the report says so: `state.terrain` seen alongside
 * observation `t` was resolved at the START of tick `t-1`, from the
 * position observation `t-1` reports. Both are printed so a reader can
 * check the claim against the committed expectation file.
 */
function rawStateRuns(name) {
    const tape = loadTape(name);
    const stepper = createTapeStepper(tape, {
        levelSource: source,
        // The runner's own rule: a noclip tape asks no collider question.
        // Mirrored here so this instrument builds exactly the worlds the
        // recorded run built.
        roles: tape.noclip ? RELAXED_ROLES : ROLES,
    });
    const runs = [];
    let open = null;
    let prev = null;
    for (const step of stepper) {
        const t = step.observation.t;
        const raw = step.state.terrain;
        const hazard = STATE_TO_NAME.get(raw);
        const armed = hazard && R4_HAZARDS.includes(hazard);
        const level = step.observation.level;
        if (armed && open && open.hazard === hazard && open.level === level
            && open.to === t - 1) {
            open.to = t;
            open.lastPos = prev;
        } else {
            if (open) runs.push(open);
            open = armed
                ? {
                    hazard,
                    raw,
                    level,
                    from: t,
                    to: t,
                    firstPos: prev,
                    lastPos: prev,
                }
                : null;
        }
        prev = { x: step.observation.x, y: step.observation.y };
    }
    if (open) runs.push(open);
    return { tape, runs };
}

function rawStatesReport(names) {
    const all = [];
    for (const name of names) {
        const { tape, runs } = rawStateRuns(name);
        const declared = tape.noHazards.join(',') || '(none)';
        console.log(`\n── ${name} — ${tape.tick_count} ticks, noHazards: [${declared}]`);
        if (runs.length === 0) {
            console.log('   no tick resolved to an R4 hazard state.');
        }
        for (const r of runs) {
            const ticks = r.to - r.from + 1;
            console.log(
                `   ${r.hazard.padEnd(9)} t=${r.raw}  L${String(r.level).padEnd(3)}`
                + ` observations ${r.from}..${r.to} (${ticks} tick${ticks === 1 ? '' : 's'})`
                + `  resolved from (${r.firstPos.x.toFixed(2)},${r.firstPos.y.toFixed(2)})`
                + `..(${r.lastPos.x.toFixed(2)},${r.lastPos.y.toFixed(2)})`,
            );
            all.push({ tape: name, ...r });
        }
    }

    console.log('\n══ SUMMARY — the physics cost, per hazard ═══════════════════');
    for (const hazard of R4_HAZARDS) {
        const hits = all.filter((r) => r.hazard === hazard);
        const ticks = hits.reduce((n, r) => n + (r.to - r.from + 1), 0);
        const levels = [...new Set(hits.map((r) => r.level))].sort((a, b) => a - b);
        console.log(
            `   ${hazard.padEnd(9)} ${String(hits.length).padStart(3)} run(s),`
            + ` ${String(ticks).padStart(5)} tick(s)`
            + `${levels.length ? `, levels ${levels.join(', ')}` : ''}`,
        );
    }
    console.log(
        '\n   A hazard with ZERO runs costs no PHYSICS at R4: arming it cannot\n'
        + '   make `assertModelledTerrain` throw on this walk. It still costs a\n'
        + '   ROUTE — the planner forbids its tiles — which `--hazard-tiles`\n'
        + '   sizes and only the shipped planner can settle.',
    );
    return all;
}

// ── --hazard-tiles ────────────────────────────────────────────────────

function hazardTileCensus(levels) {
    const rows = [];
    for (const level of levels) {
        let world;
        try {
            world = buildLevelWorld(source(level), { roles: RELAXED_ROLES });
        } catch (e) {
            rows.push({ level, error: e.message.split('\n')[0] });
            continue;
        }
        const counts = {};
        for (const tile of world.tiles) {
            const name = STATE_TO_NAME.get(tile.t);
            if (name && R4_HAZARDS.includes(name)) counts[name] = (counts[name] ?? 0) + 1;
        }
        // Bridge (29) is not a hazard but is the other R4 terrain mechanic,
        // and the same column trap hides it, so it is counted here too.
        const bridges = world.tiles.filter((t) => t.t === 29).length;
        if (Object.keys(counts).length || bridges) {
            rows.push({ level, counts, bridges, total: world.tiles.length });
        }
    }
    return rows;
}

// ── --floor-policy ────────────────────────────────────────────────────

/**
 * The R3 ladder rung's own inputs, re-asked under a different floor.
 *
 * Two phases, exactly as `plan-seedling-r3-route.mjs` has them: the ten
 * DECLARED clears, and then those plus the one the player EARNS at L71's
 * shieldlock — because five of the six item rooms are reached before the
 * touch and `darksuit` only after it.
 */
async function floorPolicy(sets) {
    const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));
    const { TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
    const {
        R3_BOOT, R3_CLEARS, R3_HOLD_TICKS, R3_ITEM_ROOMS, R3_LATTICE, R3_TOUCH,
    } = await import(join(MODULE, 'r3Walk.js'));

    const DECLARED = R3_CLEARS.map((c) => ({ level: c.level, tag: c.tag }));
    const EARNED = { level: R3_TOUCH.level, tag: R3_TOUCH.tag };
    const AFTER_TOUCH = R3_ITEM_ROOMS[R3_ITEM_ROOMS.length - 1];
    /** The FIRST set is the control: every later set is diffed against it. */
    let baseline = null;

    for (const noHazards of sets) {
        const label = noHazards.length ? noHazards.join(',') : '[] (all armed)';
        const armed = R4_HAZARDS.filter((h) => !noHazards.includes(h));
        // A fresh cache per set: the world cache keys on level + cleared
        // tags, NOT on the plan, so sharing it across two different floors
        // would hand the second run the first one's component maps.
        const cache = { worlds: new Map(), components: new Map() };
        const plan = {
            noclip: false, noHazards, avoidVolumes: true, lattice: R3_LATTICE,
        };
        const graphFor = (clears) => makeRouteGraph({
            source, clears, plan, lattice: R3_LATTICE,
            holdTicks: R3_HOLD_TICKS, levelCount: LEVEL_COUNT, cache,
        });
        const phase1 = graphFor(DECLARED);
        const phase2 = graphFor([...DECLARED, EARNED]);

        const spawn = { x: R3_BOOT.x + TILE_SIZE / 2, y: R3_BOOT.y + TILE_SIZE / 2 };
        const bootComponent = phase1.componentAt(R3_BOOT.level, spawn.x, spawn.y);
        console.log(`\n── noHazards [${label}] — armed: ${armed.join(', ') || 'none'}`);
        if (bootComponent === null) {
            console.log('   ⛔ THE BOOT POSITION IS NOT WALKABLE under this floor.');
            continue;
        }
        const start = `${R3_BOOT.level}:${bootComponent}`;
        const reach = (g) => new Set(g.bfs(start).dist.keys());
        const r1 = reach(phase1);
        const r2 = reach(phase2);

        for (const room of R3_ITEM_ROOMS) {
            const g = room === AFTER_TOUCH ? phase2 : phase1;
            const nodes = room === AFTER_TOUCH ? r2 : r1;
            const phase = room === AFTER_TOUCH ? 'phase2' : 'phase1';
            const world = g.worldFor(room.level);
            if (!world) {
                console.log(`   ${room.item.padEnd(11)} L${room.level}: LEVEL UNBUILDABLE`);
                continue;
            }
            const p = (world.pickups ?? []).find(
                (q) => q.x === room.pickup.x && q.y === room.pickup.y,
            );
            if (!p) {
                console.log(`   ${room.item.padEnd(11)} L${room.level}: NO PICKUP at `
                    + `(${room.pickup.x},${room.pickup.y})`);
                continue;
            }
            // THE NARROWING, R3's own: the components the pickup's volume is
            // 4-adjacent to, not any component of the level.
            const around = g.componentsAround(room.level, p.rect);
            const ok = around.some((id) => nodes.has(`${room.level}:${id}`));
            const levelReached = [...nodes].some(
                (n) => Number(n.split(':')[0]) === room.level,
            );
            console.log(
                `   ${room.item.padEnd(11)} L${String(room.level).padEnd(3)} ${phase}`
                + `  pickup tile ${ok ? 'REACHABLE' : '⛔ SEALED  '}`
                + `  (level ${levelReached ? 'reached' : 'NOT reached'},`
                + ` ${around.length} component(s) touch the pickup)`,
            );
        }
        // The touch is what unlocks phase 2 at all, so its own approach is
        // part of the answer rather than an implementation detail.
        const lockWorld = phase1.worldFor(R3_TOUCH.level);
        const lock = (lockWorld?.activators ?? []).find(
            (a) => a.x === R3_TOUCH.lock.x && a.y === R3_TOUCH.lock.y,
        );
        if (lock?.touchRect) {
            const around = phase1.componentsAround(R3_TOUCH.level, lock.touchRect);
            const ok = around.some((id) => r1.has(`${R3_TOUCH.level}:${id}`));
            console.log(`   ${'the touch'.padEnd(11)} L${R3_TOUCH.level} phase1`
                + `  lock       ${ok ? 'REACHABLE' : '⛔ SEALED  '}`);
        }
        const levelsOf = (nodes) => new Set([...nodes].map((n) => Number(n.split(':')[0])));
        const l1 = levelsOf(r1);
        const l2 = levelsOf(r2);
        console.log(`   nodes reachable: ${r1.size} (phase1), ${r2.size} (phase2);`
            + ` levels: ${l2.size}`);
        if (baseline) {
            const lost = [...baseline.levels].filter((l) => !l2.has(l)).sort((a, b) => a - b);
            console.log(`   levels LOST against the R3 floor: `
                + `${lost.length ? lost.map((l) => `L${l}`).join(' ') : 'none'}`);
        } else {
            baseline = { levels: l2 };
        }
    }
}

// ── main ──────────────────────────────────────────────────────────────

if (has('raw-states')) {
    const which = arg('tapes', null);
    const names = which
        ? which.split(',')
        : fixtureNames().filter((n) => n.startsWith('r3-walk-'));
    for (const n of names) {
        if (!fixtureNames().includes(n)) throw new Error(`no such fixture: ${n}`);
    }
    console.log(`raw terrain-state audit over ${names.length} committed tape(s)`);
    rawStatesReport(names);
} else if (has('hazard-tiles')) {
    const which = arg('levels', null);
    const levels = which
        ? which.split(',').map(Number)
        : Array.from({ length: LEVEL_COUNT }, (_, i) => i);
    const routeLevels = new Set(
        (await import(join(MODULE, 'fixtures', 'r3-route.json'), { with: { type: 'json' } }))
            .default.legs.map((l) => l.level),
    );
    const rows = hazardTileCensus(levels);
    console.log('level  route?  water  lava   ice  waterfall  bridge   (of N tiles)');
    for (const r of rows) {
        if (r.error) {
            console.log(`L${String(r.level).padEnd(4)} BUILD FAILED: ${r.error}`);
            continue;
        }
        const c = r.counts;
        console.log(
            `L${String(r.level).padEnd(4)} ${routeLevels.has(r.level) ? ' R3   ' : '      '}`
            + `${String(c.water ?? 0).padStart(5)}${String(c.lava ?? 0).padStart(6)}`
            + `${String(c.ice ?? 0).padStart(6)}${String(c.waterfall ?? 0).padStart(11)}`
            + `${String(r.bridges).padStart(8)}   (${r.total})`,
        );
    }
    const onRoute = rows.filter((r) => !r.error && routeLevels.has(r.level));
    const sum = (rs, k) => rs.reduce((n, r) => n + (r.counts?.[k] ?? 0), 0);
    console.log(
        `\n${rows.length} level(s) carry an R4 terrain mechanic; ${onRoute.length}`
        + ' of them are on the R3 route.\n'
        + `   on-route totals: water ${sum(onRoute, 'water')}, lava ${sum(onRoute, 'lava')},`
        + ` ice ${sum(onRoute, 'ice')}, waterfall ${sum(onRoute, 'waterfall')},`
        + ` bridge ${onRoute.reduce((n, r) => n + r.bridges, 0)}`,
    );
} else if (has('floor-policy')) {
    const which = arg('sets', null);
    // The ladder's own steps, in order: R3's floor, then lava armed, then
    // ice, then water+waterfall — the terminal state.
    const sets = which
        ? which.split(';').map((s) => (s === '-' ? [] : s.split(',')))
        : [
            ['water', 'lava', 'ice', 'waterfall'],
            ['water', 'ice', 'waterfall'],
            ['water', 'waterfall'],
            [],
        ];
    console.log('the R3 walk\'s own rooms, re-asked under each R4 floor'
        + '\n(pit is LIVE throughout — it has been since R1 — and is never in a set)');
    await floorPolicy(sets);
} else {
    console.log('usage: recon-seedling-r4.mjs --raw-states [--tapes=a,b]'
        + ' | --hazard-tiles [--levels=1,2] | --floor-policy [--sets=a,b;c]');
    process.exit(2);
}
