#!/usr/bin/env node
/**
 * probe-seedling-u11-wall5 — ⛓⛓⛓ U11-swim D1: STEP 24'S FIFTH WALL, MEASURED.
 *
 * U10 left step 24 refused at *"keylock: bosslock@80,656 needs a key"* after
 * both keyType-0 locks opened, and read the cause as the walk's view of the
 * opened lock row (26–27,15), because "a fresh run booted at (424,224) reaches
 * the pit's neighbour tiles in 6–9 waypoints". U11's file-sink probe at the
 * survey's own t 2048 found otherwise: the lock cells read CLEAR, and the
 * planner's flood from the player and from (424,224) reach the SAME 702 tiles
 * and not the pit — under the solver's plan bag. With `avoidVolumes: false`
 * both reach it. The lock row was never the wall.
 *
 * THE WALL IS L12's `Pull` FUNNEL. L12 has ONE pit tile, (36,43), and all four
 * of its neighbours are `Pull` entities (`region1.oel`: 14 of them, force 1,
 * directions pointing at the pit). `Pull.update` writes the player's x/y
 * DIRECTLY every tick (`e.x += force*cos(dir); e.y -= force*sin(dir)`), no
 * model transcribes it ("routed around since R1", `combat.js`), and so the
 * planner prices every pull tile as a proximity-hazard avoid volume. The pit
 * is therefore unreachable by construction, and the frontier, finding no
 * strategy for a pull, names the next obstacle it can resolve: the keyType-1
 * `bosslock@80,656`, a sub-order with nothing to do with the pit.
 *
 * This file re-measures it OFFLINE from a fresh L12 run carrying step 24's
 * grants (the Red Key, the sword, the shield) — the run's opened locks do not
 * matter here, because the funnel is south of everything they gate — and
 * prints PASS/FAIL per claim. It drives no browser and writes nothing.
 *
 *   node scripts/procgen/probe-seedling-u11-wall5.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));
const {
    DEFAULT_LATTICE, contactKey, nodeAt, nodeCentre, plannerObstacleAt, planWaypoints,
} = await import(join(MODULE, 'botDriverV2.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

/** The survey's step-24 goal: `pit@576,688 (out_pit_5_5, tile 36,43) → L21`. */
const PIT = Object.freeze({ tx: 36, ty: 43, x: 584, y: 696 });
/** U10's fresh-boot point, north of the lock row. */
const FROM = Object.freeze({ x: 424, y: 224 });

const run = createLevelRun({
    levelSource: atlasLevelSource(),
    boot: { level: 12, x: FROM.x, y: FROM.y },
    noclip: false,
    noHazards: [],
    noDamage: false,
    grants: [],
    persistence: [],
    despawn: [],
    equips: [],
    pins: [...PIN_NAMES],
    // Step 24's `saveGrant`: `save.keys[0]`, latched `hasSword`, `seam.items.hasShield`.
    save: { totem_parts: [], keys: [0], seal_parts: [] },
    rng: null,
    seam: { items: { hasSword: true, hasShield: true } },
    roles: ROLES,
});
const world = run.world;

/** `solverBot.solverPlanOpts` — the solver's own plan bag — plus the pit leg's `allowPit`. */
const bag = (extra = {}) => ({
    liveBag: run.liveGeometryOpts(),
    avoidVolumes: true,
    keys: run.progress('keys'),
    contacts: new Set(),
    lattice: DEFAULT_LATTICE,
    inventory: run.progress('inventory'),
    noHazards: run.noHazards,
    allowPit: { tx: PIT.tx, ty: PIT.ty },
    ...extra,
});

const obstacleAtNode = (tx, ty, opts) => {
    const c = nodeCentre(tx, ty, DEFAULT_LATTICE);
    return plannerObstacleAt(world, c.x, c.y, null, opts);
};
const flood = (opts) => {
    const s = nodeAt(FROM.x, FROM.y, DEFAULT_LATTICE);
    const seen = new Set([`${s.tx},${s.ty}`]);
    const q = [s];
    while (q.length > 0) {
        const c = q.shift();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const tx = c.tx + dx;
            const ty = c.ty + dy;
            if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) continue;
            const k = `${tx},${ty}`;
            if (seen.has(k) || obstacleAtNode(tx, ty, opts)) continue;
            seen.add(k);
            q.push({ tx, ty });
        }
    }
    return seen;
};
const plan = (opts) => {
    try {
        return { n: planWaypoints(world, FROM, PIT, null, opts).length };
    } catch (e) {
        return { refused: e.message.split('. ')[0] };
    }
};

// ── 1. the pit is the level's only one, and the funnel rings it ─────────
const pits = (world.pitTiles ?? []).map((p) => `${p.tx},${p.ty}`);
check('L12 holds exactly ONE pit tile, the goal\'s (36,43)',
    pits.length === 1 && pits[0] === `${PIT.tx},${PIT.ty}`, JSON.stringify(pits));
const ring = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => {
    const o = obstacleAtNode(PIT.tx + dx, PIT.ty + dy, bag());
    return { at: `${PIT.tx + dx},${PIT.ty + dy}`, by: o ? contactKey(o) : null };
});
check('⛓⛓⛓ all four of its neighbours are `Pull` avoid volumes — the pit is enterable only '
    + 'through a current no model transcribes',
    ring.every((r) => /^proximity-hazard:pull@/.test(r.by ?? '')),
    ring.map((r) => `${r.at} ${r.by}`).join('; '));

// ── 2. the planner: the solver's bag refuses, the bare level admits ─────
const withVolumes = flood(bag());
const without = flood(bag({ avoidVolumes: false }));
const p1 = plan(bag());
const p2 = plan(bag({ avoidVolumes: false }));
check('under the SOLVER\'s plan bag the pit is in another component (the refusal U10 met)',
    !withVolumes.has(`${PIT.tx},${PIT.ty}`) && p1.refused !== undefined,
    `${withVolumes.size} tiles reached; ${p1.refused ?? `${p1.n} waypoints`}`);
check('⛔ with `avoidVolumes: false` the same flood reaches it — U10\'s "the level admits the '
    + 'route" was measured without the volumes',
    without.has(`${PIT.tx},${PIT.ty}`) && p2.n !== undefined,
    `${without.size} tiles reached; ${p2.n ?? p2.refused} waypoint(s)`);

// ── 3. which volumes are the cut: peel them nearest-the-pit first ───────
const exempt = [];
let opened = false;
for (let round = 0; round < 16 && !opened; round += 1) {
    const opts = bag({ contacts: new Set(exempt) });
    const seen = flood(opts);
    if (seen.has(`${PIT.tx},${PIT.ty}`)) {
        opened = true;
        break;
    }
    let best = null;
    for (const k of seen) {
        const [tx, ty] = k.split(',').map(Number);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (seen.has(`${nx},${ny}`)) continue;
            const o = obstacleAtNode(nx, ny, opts);
            if (!o || obstacleAtNode(nx, ny, { ...opts, avoidVolumes: false })) continue;
            const d = Math.abs(nx - PIT.tx) + Math.abs(ny - PIT.ty);
            if (best === null || d < best.d) best = { d, key: contactKey(o) };
        }
    }
    if (best === null) break;
    exempt.push(best.key);
}
check('⛓⛓⛓ exempting ONLY pull volumes opens the pit — no other volume stands in the way',
    opened && exempt.length > 0 && exempt.every((k) => /^proximity-hazard:pull@/.test(k)),
    `${exempt.length} exemption(s): ${exempt.join(', ')}`);

// ── 4. the funnel's own attributes, from the level source ───────────────
const oel = join(REPO, 'vendor', 'seedling', 'assets', 'levels', 'OverWorld', 'region1.oel');
if (existsSync(oel)) {
    const pulls = [...readFileSync(oel, 'utf8').matchAll(/<pull x="(\d+)" y="(\d+)" force="([\d.]+)" direction="([\d.]+)"\/>/g)]
        .map((m) => ({ x: +m[1], y: +m[2], force: +m[3], direction: +m[4] }));
    console.log(`  region1.oel: ${pulls.length} <pull>: ${pulls.map((p) => `(${p.x},${p.y}) f ${p.force} `
        + `dir ${p.direction}`).join('; ')}`);
} else {
    console.log('  (vendor/seedling not checked out — the OEL attribute listing is skipped)');
}

if (failures > 0) {
    console.log(`\n${failures} FAIL`);
    process.exit(1);
}
console.log('\nALL PASS');
