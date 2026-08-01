#!/usr/bin/env node
/**
 * recon-seedling-r3 — which of R2's persistence clears are LOAD-BEARING,
 * and what does the map look like once they start coming off?
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slice 0. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §4.0.
 *
 * ── THE QUESTION ──────────────────────────────────────────────────────
 *
 * R2's clear list is DERIVED and OFFERED PER LEVEL, not per need:
 * `persistenceClearsFor` hands over every clearable tag in every level the
 * route enters, so 25 clears rode the R2 walk without anybody asking which
 * of them the walk could not have done without. R3 has to retire that
 * crutch class by class, and the retirement bill is not "25 blockers to
 * open" — it is "however many of the 25 are actually in the way".
 *
 * So: drop each clear in turn, re-plan, and see whether the item rooms are
 * still reachable. A clear whose removal changes nothing is not a crutch
 * the walk leant on; it is a flag that happened to be in a level the walk
 * passed through, and R3 retires it by DELETING it rather than by opening
 * anything.
 *
 * ⚠ INSTRUMENTS PROPOSE, THE SHIPPED PLANNER CONFIRMS. Two data points on
 * this arc say a recon instrument errs toward inventing seals, so nothing
 * here is a finding until `plan-seedling-r3-route.mjs` reproduces it. What
 * makes this one trustworthy enough to plan against is that it is not a
 * second implementation at all: the geometry is `seedlingRouteGraph`, the
 * same module the R2 planner walks, at the same movement granularity.
 *
 * ── THE KNOWN-ANSWER CONTROL ──────────────────────────────────────────
 *
 * `--control` re-asks R2's own question with R2's own inputs: R2's clear
 * list, R2's eight item rooms. It must report all eight reachable, every
 * route level R2 published reachable except the ones the graph itself names
 * as chained-fall pass-throughs, and R2's one published hold edge present.
 * A recon pass whose control fails is measuring something else, and the
 * first thing it would measure wrong is whether a seal exists.
 *
 * Run: node scripts/procgen/recon-seedling-r3.mjs --control
 *      node scripts/procgen/recon-seedling-r3.mjs --clears=r2|none
 *      node scripts/procgen/recon-seedling-r3.mjs --necessity
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { persistenceClearsFor, TILE_SIZE } =
    await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { R2_BOOT, R2_HOLD_TICKS, R2_ITEM_ROOMS, R2_LATTICE, R2_NO_HAZARDS } =
    await import(join(MODULE, 'r2Walk.js'));
const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));

const LEVEL_COUNT = 116;
const PLAN = {
    noclip: false, noHazards: R2_NO_HAZARDS, avoidVolumes: true, lattice: R2_LATTICE,
};
const source = atlasLevelSource();

/**
 * R3's item rooms: R2's eight minus `darksword`.
 *
 * ⚠ `darksword` LEAVES THE CLAIM when the grant crutch does, and that is a
 * fact about the game rather than about the route. `Witch.doneTalking()`
 * spawns the pickup only under `Main.hasWand && !Main.hasDarkSword`, and no
 * `darksword` placement exists anywhere in the extract — she is its only
 * source. R2 collected it because a grant is a property write that does not
 * consult her, which R2 recorded as an anomaly rather than hiding. R3 pays
 * that back: real collection means the Witch's precondition is real, the
 * wand is R5 (`Wand.update` gates the whole pickup on
 * `Player.hasAllTotemParts()`), and so darksword is R5 too.
 */
const R3_ITEM_ROOMS = R2_ITEM_ROOMS.filter((r) => !r.items.includes('darksword'));

// ── the clear list, as R2 derives it ──────────────────────────────────
const allClears = [];
for (let level = 0; level < LEVEL_COUNT; level++) {
    allClears.push(...persistenceClearsFor(source(level)).offered);
}
/** R2's own 25: the offered list pruned to the levels R2's route enters. */
const R2_ROUTE_LEVELS = new Set(
    (await import(join(MODULE, 'fixtures', 'r2-route.json'), { with: { type: 'json' } }))
        .default.legs.map((l) => l.level),
);
const r2Clears = allClears.filter((c) => R2_ROUTE_LEVELS.has(c.level));

const cache = { worlds: new Map(), components: new Map() };

/** Plan under `clears` and report which of `rooms` the boot can reach. */
function reachability(clears, rooms) {
    const g = makeRouteGraph({
        source, clears, plan: PLAN, lattice: R2_LATTICE,
        holdTicks: R2_HOLD_TICKS, levelCount: LEVEL_COUNT, cache,
    });
    const spawn = { x: R2_BOOT.x + TILE_SIZE / 2, y: R2_BOOT.y + TILE_SIZE / 2 };
    const bootComponent = g.componentAt(R2_BOOT.level, spawn.x, spawn.y);
    if (bootComponent === null) throw new Error('the boot position is not walkable');
    const { dist } = g.bfs(`${R2_BOOT.level}:${bootComponent}`);
    const levels = new Set([...dist.keys()].map((n) => Number(n.split(':')[0])));
    // ⚠ A ROOM IS REACHED WHEN A COMPONENT OF ITS LEVEL IS, which is the
    // same test the R2 tour applies. It is WIDER than "the pickup's own
    // tile is reachable": entering the room was collection at R2. R3
    // collects for real, so the shipped planner has to narrow it to the
    // pickup itself — recorded here so the difference is not discovered
    // as a divergence later.
    return {
        graph: g,
        levels,
        reached: rooms.filter((r) => levels.has(r.level)),
        missing: rooms.filter((r) => !levels.has(r.level)),
    };
}

const arg = (name, fallback) => {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found === undefined ? fallback : found.slice(name.length + 3);
};

// ── the known-answer control ──────────────────────────────────────────
if (process.argv.includes('--control')) {
    const { graph: g, reached, missing, levels } = reachability(r2Clears, R2_ITEM_ROOMS);
    console.log(`control: R2's ${r2Clears.length} clears, R2's ${R2_ITEM_ROOMS.length} `
        + 'item rooms');
    console.log(`  reached ${reached.length}: `
        + `${reached.map((r) => `${r.items.join('+')}(L${r.level})`).join(' ')}`);
    console.log(`  missing ${missing.length}: `
        + `${missing.map((r) => `${r.items.join('+')}(L${r.level})`).join(' ') || 'none'}`);
    // ⚠ A PASS-THROUGH LEVEL IS NOT A GRAPH NODE, and the first cut of this
    // control did not know that: `resolveArrival` follows a chained fall to
    // where it LANDS and records the levels it fell through in `through`, so
    // a level the walk only falls across never becomes a `(level, component)`
    // at all. R2's leg 39 is exactly one — L84, zero targets, straight out
    // through the pit at (2,2) — and the control called the graph broken for
    // agreeing with the route. Subtract the levels the graph itself names as
    // pass-throughs, and only then is an unreachable route level a defect.
    const passThrough = new Set();
    for (const list of g.edges.values()) {
        for (const e of list) for (const p of e.through ?? []) passThrough.add(p.level);
    }
    const routeLevels = [...R2_ROUTE_LEVELS].sort((a, b) => a - b);
    const unreachedRoute = routeLevels
        .filter((l) => !levels.has(l) && !passThrough.has(l));
    console.log(`  R2's ${routeLevels.length} route levels reachable (minus `
        + `${routeLevels.filter((l) => !levels.has(l) && passThrough.has(l)).length} `
        + `pass-through): `
        + `${unreachedRoute.length === 0 ? 'YES' : `NO — ${unreachedRoute.join(' ')}`}`);
    // R2 published exactly one hold edge; a graph that lost it would report
    // Dungeon 7 sealed, which is the failure this line exists to catch.
    const holds = g.holdEdges.filter((h) => h.level === 71);
    const holdOk = holds.some((h) => h.presser === 'button@112,176');
    console.log(`  R2's published L71 hold edge present: ${holdOk ? 'YES' : 'NO'}`);
    const ok = missing.length === 0 && unreachedRoute.length === 0 && holdOk;
    console.log(ok ? '\nCONTROL PASSED ✅' : '\nCONTROL FAILED ❌');
    process.exit(ok ? 0 : 1);
}

// ── the necessity sweep ───────────────────────────────────────────────
if (process.argv.includes('--necessity')) {
    console.log(`necessity sweep: ${r2Clears.length} clears, `
        + `${R3_ITEM_ROOMS.length} R3 item rooms `
        + `(${R3_ITEM_ROOMS.map((r) => r.items.join('+')).join(' ')})\n`);

    const base = reachability(r2Clears, R3_ITEM_ROOMS);
    console.log(`with ALL ${r2Clears.length}: ${base.reached.length}/`
        + `${R3_ITEM_ROOMS.length} rooms reachable`
        + `${base.missing.length ? ` — MISSING ${base.missing
            .map((r) => `${r.items.join('+')}(L${r.level})`).join(' ')}` : ''}`);

    const none = reachability([], R3_ITEM_ROOMS);
    console.log(`with NONE: ${none.reached.length}/${R3_ITEM_ROOMS.length} reachable`
        + `${none.missing.length ? ` — MISSING ${none.missing
            .map((r) => `${r.items.join('+')}(L${r.level})`).join(' ')}` : ''}\n`);

    const necessary = [];
    const incidental = [];
    for (const c of r2Clears) {
        const without = r2Clears.filter((o) => !(o.level === c.level && o.tag === c.tag));
        const r = reachability(without, R3_ITEM_ROOMS);
        const lost = r.missing.filter((m) => base.reached.some((b) => b.level === m.level));
        const label = `L${c.level} tag ${c.tag}: ${c.note}`;
        if (lost.length === 0) {
            incidental.push(c);
            console.log(`  INCIDENTAL  ${label}`);
        } else {
            necessary.push(c);
            console.log(`  LOAD-BEARING ${label}`);
            console.log(`               without it: `
                + `${lost.map((m) => `${m.items.join('+')}(L${m.level})`).join(' ')} unreachable`);
        }
    }

    console.log(`\n${necessary.length} LOAD-BEARING, ${incidental.length} INCIDENTAL.`);
    // ⚠ NECESSITY IS NOT SUFFICIENCY. Two clears can each be droppable
    // alone and jointly required, so the necessary set has to be re-asked
    // as a set — the one-out sweep cannot see a pair.
    const check = reachability(necessary, R3_ITEM_ROOMS);
    console.log(`the load-bearing set ALONE reaches ${check.reached.length}/`
        + `${R3_ITEM_ROOMS.length}`
        + `${check.missing.length ? ` — MISSING ${check.missing
            .map((r) => `${r.items.join('+')}(L${r.level})`).join(' ')}` : ' ✅'}`);
    if (check.missing.length > 0) {
        console.log('  ⚠ a PAIR is jointly required: necessity swept one-out and a '
            + 'pair is invisible to it. Add back greedily before believing any bill.');
    }
    process.exit(0);
}

// ── the minimal sufficient set ────────────────────────────────────────
if (process.argv.includes('--minimal')) {
    // ⚠ NECESSITY IS NOT THE BILL. A one-out sweep asks "is this clear
    // required?", and two clears in a doorway wide enough for either answer
    // NO each — then both come off and the door shuts. R2's own numbers say
    // so: 7 clears are individually load-bearing and those 7 alone reach
    // 3 of 7 rooms. So the bill is an IRREDUNDANT set, computed by removing
    // clears one at a time and keeping each removal only while every room
    // stays reachable. Order-dependent by construction — a different order
    // can yield a different equally-minimal set — which is why the survivors
    // are printed with their notes rather than counted.
    console.log(`minimising from R2's ${r2Clears.length} clears against `
        + `${R3_ITEM_ROOMS.length} R3 item rooms\n`);
    const base = reachability(r2Clears, R3_ITEM_ROOMS);
    if (base.missing.length > 0) {
        console.log('the full set does not reach every room; nothing to minimise from');
        process.exit(1);
    }
    let kept = [...r2Clears];
    for (const c of r2Clears) {
        const without = kept.filter((o) => !(o.level === c.level && o.tag === c.tag));
        const r = reachability(without, R3_ITEM_ROOMS);
        if (r.missing.length === 0) {
            kept = without;
            console.log(`  drop  L${c.level} tag ${c.tag}: ${c.note}`);
        } else {
            console.log(`  KEEP  L${c.level} tag ${c.tag}: ${c.note}`);
            console.log(`        without it: ${r.missing
                .map((m) => `${m.items.join('+')}(L${m.level})`).join(' ')} unreachable`);
        }
    }
    const check = reachability(kept, R3_ITEM_ROOMS);
    console.log(`\nMINIMAL SET: ${kept.length} clear(s), reaching `
        + `${check.reached.length}/${R3_ITEM_ROOMS.length}`
        + `${check.missing.length ? ' ❌' : ' ✅'}`);
    kept.forEach((c) => console.log(`  L${c.level} tag ${c.tag}: ${c.note}`));
    console.log(`\n${r2Clears.length - kept.length} of R2's ${r2Clears.length} clears `
        + 'are retired by DELETION — the walk never needed them. The rest are the '
        + 'retirement bill: each is opened for real or named with its rung.');
    process.exit(0);
}

// ── are the boss-key rooms reachable without the bosslock clears? ─────
if (process.argv.includes('--keys')) {
    // The three bosslock clears in the minimal set answer to `Player.hasKey`,
    // and every `BossKey` is a plain special pickup with no tag and no
    // persistence — so they retire IF their key rooms can be reached first.
    // ⚠ THE CIRCULARITY IS THE WHOLE QUESTION: a key sealed behind the very
    // lock it opens would make its clear permanent, and a bill that assumed
    // otherwise would be discovered at recording time.
    const KEYS = [
        { level: 19, keyType: 0, opens: 'L12 tag 5 bosslock@432,240' },
        { level: 29, keyType: 1, opens: 'L12 tag 3 bosslock@80,656' },
        { level: 67, keyType: 4, opens: 'L12 tag 12 bosslock@32,864' },
    ];
    const BOSSLOCKS = new Set(['12:3', '12:5', '12:12']);
    const withoutLocks = r2Clears.filter((c) => !BOSSLOCKS.has(`${c.level}:${c.tag}`));
    const rooms = KEYS.map((k) => ({ level: k.level, items: [`key${k.keyType}`] }));

    const all = reachability(r2Clears, rooms);
    console.log(`with R2's ${r2Clears.length} clears (bosslocks INCLUDED): `
        + `${all.reached.map((r) => `L${r.level}`).join(' ') || 'none'} reachable`);
    const bare = reachability(withoutLocks, rooms);
    console.log(`with the three bosslock clears REMOVED (${withoutLocks.length}): `
        + `${bare.reached.map((r) => `L${r.level}`).join(' ') || 'none'} reachable\n`);
    // ⚠ THREE OUTCOMES, NOT TWO, and the first cut of this report collapsed
    // them into two and mislabelled a fact. "Unreachable without the lock"
    // is only circular if the room was reachable WITH it; a room the walk
    // cannot get to under ANY clear list is sealed by something else
    // entirely, and calling that circular would send the next slice looking
    // for a lock that is not the problem.
    for (const k of KEYS) {
        const withLocks = all.reached.some((r) => r.level === k.level);
        const without = bare.reached.some((r) => r.level === k.level);
        const verdict = without
            ? 'REACHABLE without its own lock — the clear RETIRES'
            : withLocks
                ? 'reachable ONLY through a bosslock clear — CIRCULAR, the clear STAYS'
                : 'UNREACHABLE under every clear list — sealed by something else; '
                    + 'the clear stays and the seal needs naming';
        console.log(`  L${k.level} key${k.keyType} -> ${k.opens}: ${verdict}`);
    }
    process.exit(0);
}

// ── plain reachability under a named clear set ────────────────────────
const which = arg('clears', 'r2');
const clears = which === 'none' ? [] : r2Clears;
const { reached, missing, levels } = reachability(clears, R3_ITEM_ROOMS);
console.log(`clears=${which} (${clears.length}), R3 item rooms:`);
console.log(`  reached ${reached.length}: `
    + `${reached.map((r) => `${r.items.join('+')}(L${r.level})`).join(' ')}`);
console.log(`  missing ${missing.length}: `
    + `${missing.map((r) => `${r.items.join('+')}(L${r.level})`).join(' ') || 'none'}`);
console.log(`  ${levels.size} level(s) reachable from the boot`);
