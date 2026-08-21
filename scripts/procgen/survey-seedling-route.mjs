#!/usr/bin/env node
/**
 * survey-seedling-route — THE ROUTE-ONLY SOLVER COVERAGE SURVEY.
 * Editor arc slice 7; kickoff §12 item 6 (⚖ user's ROUTE-ONLY correction).
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ─────────────────────
 *
 * It asks ONE question, room by room: **can the live solver walk from the
 * true game start to the shield today, and where exactly does it stop?**
 *
 * ⛔ **REPORT ONLY.** Nothing here writes `fixtures/tapes/`,
 * `fixtures/traces/`, or any committed artifact. Every solve runs IN
 * MEMORY; the outputs are a table and some PNGs under `NewDocs/plans/
 * seedling-editor-survey/` (gitignored by design — the as-built carries
 * the table inline as the durable record). Tapes for newly-solved rooms
 * are R9's business, recorded there under R9's own licence.
 *
 * ⛔ **ROUTE ONLY** (⚖ the user's correction to §12 item 6): the levels a
 * playthrough CROSSES and only the goals that are PART of that route —
 * the crossings plus exactly three pickups (sword@L10, boss key 0@L19,
 * shield@L20). Not the numeric range L0–L20, not every placement per
 * level. The route table is deliverable #1 and it IS the survey's bound.
 *
 * ── THE DERIVATION (computed, never typed) ────────────────────────────
 *
 * Three independent sources, and the route is the intersection:
 *
 *  1. **The AP region graph** — the `_rules.json` under
 *     `frontend/presets/seedling_playthrough/`, 251 sub-room regions with access
 *     rules. This is the authority on WHICH DOOR IS OPEN WHEN: it is
 *     Archipelago's own model of the game's gating, generated from the
 *     region atlas, and it is what makes "the route" a derivation rather
 *     than a reading of the committed chains.
 *  2. **The committed atlas** (`seedling-map.json`) — the LEVEL edge
 *     graph, each edge carrying its exit entity's own OEL coordinates
 *     (which become the `reach-exit` goal) and its `playerx`/`playery`
 *     (which become the next room's boot position). ⛓ Those arrival
 *     coordinates REPRODUCE every committed boot on the route, which is
 *     asserted below rather than assumed.
 *  3. **The sphere order** (`seedling-sphere-order.json`) — AP's own
 *     collection order for seed 1, which fixes the three route pickups
 *     and the order they are taken in: sword 0.1 → boss key 0 1.2 →
 *     shield 2.1.
 *
 * The route is then three BFS legs over the region graph, each run with
 * exactly the items the earlier legs earned:
 *
 *     start -> sword@L10        with {}
 *     L10   -> boss key 0@L19   with {Progressive Sword}
 *     L19   -> shield@L20       with {Progressive Sword, Red Key}
 *
 * A STEP is one level VISIT, and its goals are the route pickup in that
 * room (if any) followed by the crossing out of it — the same segmentation
 * the chains use ("a segment ends at each crossing") and the same goal
 * vocabulary `solveSegment` asserts.
 *
 * ── THE BOOT POLICY, AS DATA ──────────────────────────────────────────
 *
 * Every row NAMES its boot, and there are exactly three kinds:
 *
 *   `committed`  the room's own committed campaign boot, verbatim
 *                (`r7-act2-N` for the pre-sword rooms, `r8-d2-19/20` for
 *                D2's last two). The campaign's measured state.
 *   `staged`     R8 slice 8's own construction for a room with no tape:
 *                `r7-act2-11`'s committed v8 block — the campaign's own
 *                post-sword latch — re-pointed at THIS room's arrival
 *                coordinates from the atlas. ⛓ `r8-solve-18`'s boot is
 *                exactly this, and the script ASSERTS the equality, so
 *                the policy is R8's rather than this script's.
 *   `true-start` `r7-act2-1`'s boot: `new Game(0, 80, 128)`, empty save.
 *
 * ⚠ **THE BOUND A STAGED BOOT NAMES.** A staged boot is a DECLARATION,
 * not a measured latch — `save.time` and the three RNG streams are
 * `SEAM_BOOT_SPEC`-marked `modelled: false`, so a number this script
 * invented for them would be a number nobody measured (the `r8-d2-chain`
 * docblock's own law). So the survey inherits `r7-act2-11`'s declared
 * clock for every staged room rather than accumulating one. ⇒ a SOLVED
 * staged row says "this room is solvable from this declared state", NOT
 * "the campaign reaches it". Chaining the real latches is R9's, through
 * the `--win` channel this survey never touches.
 *
 * ── A SOLVE THAT NEVER RETURNS IS ITS OWN FINDING ─────────────────────
 *
 * `solveSegment` is synchronous, so a runaway search cannot be timed out
 * in-process. Each step therefore runs in a CHILD (`--step=<id>`) under a
 * wall-clock timeout, and a child that overruns is a **TIMEOUT** verdict —
 * distinct from a REFUSAL, and reported as such.
 *
 * Run:
 *   node scripts/procgen/survey-seedling-route.mjs                # all
 *   node scripts/procgen/survey-seedling-route.mjs --derive-only  # route
 *   node scripts/procgen/survey-seedling-route.mjs --only=12,13
 *   node scripts/procgen/survey-seedling-route.mjs --timeout=600
 */

import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');
const OUT_DIR = join(REPO, 'NewDocs', 'plans', 'seedling-editor-survey');

const argOf = (k, dflt) => {
    const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
    return hit === undefined ? dflt : hit.slice(k.length + 3);
};
const STEP = argOf('step', null);
const ONLY = argOf('only', null);
const DERIVE_ONLY = process.argv.includes('--derive-only');
/**
 * ⛔ THE TIMEOUT IS A NAMED BOUND, NOT A GENEROUS ONE. Measured on this
 * route: the slowest SOLVING step is L18 at ~21 s (three two-pass passes)
 * and every other solve is under a second. 120 s is therefore ~6x the
 * slowest answer anyone got — long enough that a slow room still answers,
 * short enough that a runaway search is called one within two minutes
 * instead of fifteen. ⚠ A TIMEOUT verdict is reported WITH this number,
 * because "did not finish in 120 s" is a different claim from "cannot be
 * solved", and only the first one was measured.
 */
const TIMEOUT_S = Number(argOf('timeout', '120'));

// ─────────────────────────────────────────────────────────────────────
// 1. THE SOURCES
// ─────────────────────────────────────────────────────────────────────

const atlas = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const spheres = JSON.parse(readFileSync(
    join(REPO, 'frontend/modules/flashPanel/atlases/seedling-sphere-order.json'), 'utf8'));

/** The AP rules export for the playthrough world — found, never hardcoded. */
function apRulesPath() {
    const base = join(REPO, 'frontend', 'presets', 'seedling_playthrough');
    const seed = readdirSync(base).find((d) => d.startsWith('AP_'));
    if (!seed) throw new Error(`no AP_* export under ${base} — the region graph is the `
        + 'route derivation\'s authority on gating and this survey cannot proceed without it');
    return join(base, seed, `${seed}_rules.json`);
}
const apRules = JSON.parse(readFileSync(apRulesPath(), 'utf8'));
const REGIONS = apRules.regions['1'];

const levelsByNo = new Map(atlas.levels.map((l) => [l.level, l]));

/** Every `to` edge in the atlas, with the goal coordinates on both sides. */
function atlasEdges(from) {
    return (levelsByNo.get(from)?.entities ?? [])
        .filter((e) => e.attrs && e.attrs.to !== undefined)
        .map((e) => ({
            from,
            to: Number(e.attrs.to),
            via: `${e.type}@${e.x},${e.y}`,
            exit: { x: e.x, y: e.y },
            arrival: { x: Number(e.attrs.playerx), y: Number(e.attrs.playery) },
        }));
}

/** ONE edge for a route hop; two would make the goal ambiguous, so it says so. */
function edgeFor(from, to) {
    const hits = atlasEdges(from).filter((e) => e.to === to);
    if (hits.length !== 1) {
        throw new Error(`the atlas has ${hits.length} edges L${from} -> L${to} `
            + `(${hits.map((h) => h.via).join(', ') || 'none'}). A route hop with more than `
            + 'one door has an ambiguous `reach-exit` goal and the survey will not pick one '
            + 'for you.');
    }
    return hits[0];
}

// ─────────────────────────────────────────────────────────────────────
// 2. THE ROUTE — three BFS legs over AP's own region graph
// ─────────────────────────────────────────────────────────────────────

/** AP's rule vocabulary, whole — an unknown rule THROWS rather than passing. */
function ruleHolds(rule, items) {
    if (!rule) return true;
    switch (rule.rule) {
    case 'True_': return true;
    case 'Has': return (items[rule.args.item_name] ?? 0) >= (rule.args.count ?? 1);
    case 'HasAny': return rule.args.item_names.some((n) => (items[n] ?? 0) > 0);
    case 'HasAll': return rule.args.item_names.every((n) => (items[n] ?? 0) > 0);
    case 'And': return rule.children.every((c) => ruleHolds(c, items));
    case 'Or': return rule.children.some((c) => ruleHolds(c, items));
    default:
        throw new Error(`unknown AP access rule '${rule.rule}' — a rule this evaluator `
            + 'does not know must never read as SATISFIED, because a route derived through '
            + 'a door nobody evaluated is a route nobody derived.');
    }
}

const levelOfRegion = (name) => Number(name.split('__')[0].split('_')[1]);

/** Shortest region path under a fixed item set; null when there is none. */
function regionPath(src, dst, items, banned = new Set()) {
    const prev = new Map([[src, null]]);
    const queue = [src];
    while (queue.length) {
        const u = queue.shift();
        if (u === dst) break;
        for (const e of REGIONS[u]?.exits ?? []) {
            const v = e.connected_region;
            if (prev.has(v) || banned.has(v)) continue;
            if (!ruleHolds(e.access_rule, items)) continue;
            prev.set(v, u);
            queue.push(v);
        }
    }
    if (!prev.has(dst)) return null;
    const out = [];
    for (let u = dst; u !== null; u = prev.get(u)) out.push(u);
    return out.reverse();
}

/** A region path projected onto the LEVELS it visits, in order. */
function levelsOf(path) {
    const out = [];
    for (const r of path) {
        const n = levelOfRegion(r);
        if (out[out.length - 1] !== n) out.push(n);
    }
    return out;
}

/**
 * ⛓ THE ALTERNATIVES, AND THE BOUND THEY ARE FOUND UNDER.
 *
 * A shortest path is not a choice until you can see what it was chosen
 * OVER. So each region on the chosen path is BANNED in turn and the leg is
 * re-derived: what comes back is either a genuinely different route (kept,
 * with its length, so "shortest" is a comparison rather than an adjective)
 * or nothing at all — which is the more useful answer, because a room no
 * detour can avoid is **FORCED**, and a forced room that refuses is a wall
 * across the whole campaign rather than an inconvenience.
 *
 * ⚠ **BOUND, NAMED:** this finds every alternative that differs from the
 * chosen route by at least one ROOM. It does not enumerate every path in
 * the graph, and it does not find an alternative that uses the same rooms
 * in a different order.
 */
function alternativesFor(src, dst, chosen, items) {
    const out = [];
    const seen = new Set([levelsOf(chosen).join(',')]);
    for (const banned of chosen.slice(1, -1)) {
        const path = regionPath(src, dst, items, new Set([banned]));
        if (!path) {
            out.push({ banned, forced: true, levels: null });
            continue;
        }
        const levels = levelsOf(path);
        const key = levels.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ banned, forced: false, levels, regions: path });
    }
    return out;
}

/**
 * ⛔ THE D2 ENTRY, ASKED DIRECTLY. `assertD2RouteGraph` proves L13 has no
 * edge to L18; the atlas DOES give L13 a direct stairs to L20, which reads
 * like a shortcut straight to the shield. This asks AP's own rules what is
 * on the other side of that door, so the answer is a quoted rule rather
 * than an inference from the route's shape.
 */
function d2EntryProbe() {
    const shieldRegion = placementOf('Level 020 - Shield').region;
    const direct = (REGIONS.level_13?.exits ?? [])
        .filter((e) => levelOfRegion(e.connected_region) === 20);
    return direct.map((e) => {
        const lands = e.connected_region;
        const onward = (REGIONS[lands]?.exits ?? [])
            .filter((x) => x.connected_region === shieldRegion)
            .map((x) => x.access_rule);
        return {
            edge: `level_13 -> ${lands}`,
            enterRule: e.access_rule,
            onwardTo: shieldRegion,
            onwardRules: onward,
            passableWithoutShield: onward.some((r) => ruleHolds(r, { 'Progressive Sword': 1, 'Red Key': 1 })),
        };
    });
}

/** The three route pickups, read out of the sphere order rather than typed. */
const ROUTE_PICKUPS = [
    { match: /Level 010 - Sword/, item: 'Progressive Sword' },
    { match: /Level 019 - Boss Key 0/, item: 'Red Key' },
    { match: /Level 020 - Shield/, item: 'Progressive Shield' },
].map((want) => {
    const row = spheres.order.find((o) => want.match.test(o.location));
    if (!row) throw new Error(`the sphere order has no row matching ${want.match} — the `
        + 'route\'s goals come from AP\'s own collection order and this survey will not '
        + 'invent one.');
    if (row.item !== want.item) throw new Error(`sphere row '${row.location}' grants `
        + `'${row.item}', not '${want.item}' — the seed's placement moved and the route's `
        + 'item bookkeeping with it.');
    return { ...row, item: row.item };
});

/** Where each pickup lives, as an AP region + the placement's own coordinates. */
function placementOf(locationName) {
    for (const [name, reg] of Object.entries(REGIONS)) {
        for (const loc of reg.locations ?? []) {
            if (loc.name === locationName) return { region: name, level: levelOfRegion(name) };
        }
    }
    throw new Error(`no AP region holds location '${locationName}'`);
}

/** The pickup ENTITY in the atlas — the `collect-placement` goal's coordinates. */
const PICKUP_ENTITY = { 10: 'sword', 19: 'bosskey', 20: 'shield' };
function pickupCoords(level) {
    const type = PICKUP_ENTITY[level];
    const hits = (levelsByNo.get(level)?.entities ?? []).filter((e) => e.type === type);
    if (hits.length !== 1) {
        throw new Error(`L${level} has ${hits.length} '${type}' entities — the route's `
            + 'pickup goal must name exactly one placement.');
    }
    return { x: hits[0].x, y: hits[0].y };
}

function deriveRoute() {
    const startRegion = REGIONS.Menu.exits[0].connected_region;
    const items = {};
    const legs = [];
    let here = startRegion;
    for (const pickup of ROUTE_PICKUPS) {
        const target = placementOf(pickup.location);
        const path = regionPath(here, target.region, items);
        if (!path) {
            throw new Error(`AP's own rules give NO path from ${here} to `
                + `${target.region} with items {${Object.keys(items).join(', ') || 'none'}} — `
                + 'the route is not derivable and nothing below it means anything.');
        }
        legs.push({
            sphere: pickup.sphere,
            goal: pickup.location,
            item: pickup.item,
            from: here,
            to: target.region,
            itemsHeld: Object.keys(items).slice(),
            regions: path,
            levels: levelsOf(path),
            alternatives: alternativesFor(here, target.region, path, { ...items }),
        });
        items[pickup.item] = (items[pickup.item] ?? 0) + 1;
        here = target.region;
    }

    // The level visit sequence: the legs concatenated, with each leg's first
    // level dropped (it is the previous leg's last — the same visit).
    const visits = [];
    legs.forEach((leg, i) => {
        leg.levels.forEach((n, j) => {
            if (i > 0 && j === 0) return;
            visits.push({ level: n, leg: i });
        });
    });

    return { legs, visits, steps: buildSteps(visits, legs, (i) => i + 1) };
}

/**
 * ⛓ THE ALTERNATIVE LEG, SURVEYED — and it is here because the MEASUREMENT
 * demanded it, not because the charter asked for two routes.
 *
 * The chosen (shortest) leg 2 goes L10 → **L11** → **L3's east half** → L2,
 * and BOTH of those two rooms refuse. The 16-room alternative avoids exactly
 * those two — it walks back the way it came (L10 → L9 → … → L4 → L3's west
 * half → L2), where every room already has a committed solve in the outbound
 * direction. So "the shortest route refuses" and "the campaign cannot get
 * from the sword to D2" are DIFFERENT CLAIMS, and only a survey of the
 * alternative can tell them apart. R9's budget needs the difference.
 */
function deriveAlternative(route) {
    const alt = route.legs[1].alternatives.find((a) => !a.forced);
    if (!alt) return null;
    const visits = [];
    route.legs[0].levels.forEach((n) => visits.push({ level: n, leg: 0 }));
    alt.levels.slice(1).forEach((n) => visits.push({ level: n, leg: 1 }));
    route.legs[2].levels.slice(1).forEach((n) => visits.push({ level: n, leg: 2 }));
    return {
        levels: alt.levels,
        avoids: route.legs[1].regions.filter((r) => !alt.regions.includes(r)),
        steps: buildSteps(visits, route.legs, (i) => `A${i + 1}`),
    };
}

/**
 * Steps: one per visit. Goals = the route pickup here (if any), then the
 * crossing out (if any). The last visit has no crossing — the route ends at
 * the shield.
 */
function buildSteps(visits, legs, id) {
    return visits.map((v, i) => {
        const next = visits[i + 1];
        const goals = [];
        const pickupHere = ROUTE_PICKUPS.find((p) => p.level === v.level
            && legs[v.leg].goal === p.location && (!next || next.leg !== v.leg));
        if (pickupHere) {
            goals.push({
                kind: 'collect-placement',
                placement: pickupCoords(v.level),
                why: `${pickupHere.location} (sphere ${pickupHere.sphere}) → ${pickupHere.item}`,
            });
        }
        let edge = null;
        if (next) {
            edge = edgeFor(v.level, next.level);
            goals.push({ kind: 'reach-exit', exit: edge.exit, why: `${edge.via} → L${next.level}` });
        }
        const prev = visits[i - 1];
        const arrival = prev ? edgeFor(prev.level, v.level).arrival : { x: 80, y: 128 };
        return {
            step: id(i),
            level: v.level,
            visit: visits.slice(0, i).filter((w) => w.level === v.level).length + 1,
            arrival,
            goals,
            crossesTo: next ? next.level : null,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────
// 3. THE BOOT POLICY — data, one row per step
// ─────────────────────────────────────────────────────────────────────

const committedTape = (name) => JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8'));

/**
 * ⛔ THE COMMITTED BOOTS ARE MATCHED BY **ROOM AND ARRIVAL POSITION**, never
 * by level number and never by step index.
 *
 * L0, L2, L3 and (on the alternative leg) L4–L9 are each visited TWICE on
 * this route: the second visit comes through a different door, lands on a
 * different tile and has a different errand. A lookup keyed on the LEVEL
 * would have handed the return leg the outbound room's boot and reported the
 * result as a known-answer agreement. A lookup keyed on the STEP INDEX would
 * have silently mis-assigned every row the moment the alternative leg added
 * six steps in the middle. The position is the only key that is a fact about
 * the game.
 */
const CAMPAIGN_TAPES = [
    'r7-act2-1', 'r7-act2-2', 'r7-act2-3', 'r7-act2-4', 'r7-act2-5', 'r7-act2-6',
    'r7-act2-7', 'r7-act2-8', 'r7-act2-9', 'r7-act2-10', 'r7-act2-11',
    'r8-d2-19', 'r8-d2-20',
];
const bootKey = (level, x, y) => `L${level}@${x},${y}`;
const COMMITTED_BY_ARRIVAL = new Map();
for (const name of CAMPAIGN_TAPES) {
    const b = committedTape(name).boot;
    const key = bootKey(b.level, b.x, b.y);
    if (COMMITTED_BY_ARRIVAL.has(key)) {
        throw new Error(`two committed tapes boot at ${key} `
            + `(${COMMITTED_BY_ARRIVAL.get(key)} and ${name}) — the survey's boot lookup is `
            + 'keyed on the arrival position and cannot choose between them.');
    }
    COMMITTED_BY_ARRIVAL.set(key, name);
}

/** The staged construction: `r7-act2-11`'s block, re-pointed. R8 slice 8's own. */
const STAGED_BASE = 'r7-act2-11';

/**
 * A staged row that ALREADY has a committed tape — the one place the staged
 * construction can be checked against something nobody wrote for this survey.
 * Keyed on arrival for the same reason everything else here is.
 */
const STAGED_CROSSCHECK = new Map([[bootKey(18, 16, 32), 'r8-solve-18']]);

/**
 * The KNOWN-ANSWER tape a row's tick count can be compared against — a
 * SOLVER tape for the same room from the same boot. Re-solving these is
 * agreement information, which is why they are in the survey at all.
 */
const KNOWN_ANSWERS = new Map([
    [bootKey(0, 80, 128), 'r8-solve-1'], [bootKey(2, 48, 32), 'r8-solve-2'],
    [bootKey(3, 64, 16), 'r8-solve-3'], [bootKey(4, 16, 16), 'r8-solve-4'],
    [bootKey(5, 80, 32), 'r8-solve-5'], [bootKey(6, 32, 16), 'r8-solve-6'],
    [bootKey(7, 32, 32), 'r8-solve-7'], [bootKey(8, 144, 48), 'r8-solve-8'],
    [bootKey(9, 144, 16), 'r8-solve-9'], [bootKey(10, 48, 80), 'r8-solve-10'],
    [bootKey(11, 32, 64), 'r8-solve-11'],
    [bootKey(18, 16, 32), 'r8-solve-18'],
    [bootKey(19, 16, 144), 'r8-d2-19'], [bootKey(20, 192, 64), 'r8-d2-20'],
]);

function bootFor(step) {
    const key = bootKey(step.level, step.arrival.x, step.arrival.y);
    const tape = COMMITTED_BY_ARRIVAL.get(key);
    if (tape) {
        return {
            kind: tape === 'r7-act2-1' ? 'true-start' : 'committed',
            source: tape,
            note: tape === 'r7-act2-1'
                ? 'the TRUE GAME START — new Game(0, 80, 128), empty save'
                : `${tape}'s committed v8 boot block, verbatim (it boots at ${key})`,
        };
    }
    return {
        kind: 'staged',
        source: STAGED_BASE,
        note: `${STAGED_BASE}'s committed v8 block (the campaign's own post-sword latch) `
            + `re-pointed at ${key} — R8 slice 8's construction for r8-solve-18`,
    };
}

// ─────────────────────────────────────────────────────────────────────
// 4. THE SOLVE (child mode)
// ─────────────────────────────────────────────────────────────────────

async function solveOneStep(step) {
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { twoPassSolve } = await import(join(MODULE, 'twoPassSolve.js'));
    const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
    const { createRunForStaging, solveStaging, stagingFromTape } =
        await import(join(MODULE, 'tapeRunner.js'));

    const boot = bootFor(step);
    const base = parseTape(committedTape(boot.source));
    const staging = solveStaging(stagingFromTape(base));
    if (boot.kind === 'staged') {
        staging.boot = { level: step.level, x: step.arrival.x, y: step.arrival.y };
    }
    /**
     * ⛔⛔⛔ THE TIMED CLEARS ARE STRIPPED, AND THIS IS THE DESPAWN DROP ONE
     * FIELD OVER — measured on L8, not reasoned to.
     *
     * `solveStaging` empties `despawn` with a written reason: *"a v10 despawn
     * is a WITNESSED mid-run body removal … that witness belongs to the HAND
     * walk. A solver re-solving the same room derives its own walk, in which
     * the removal never happened."* A v9 `persistence[].at` is the same
     * sentence about a FLAG instead of a BODY — and the seam carries it.
     *
     * MEASURED on route step 8 (L8, the two sandtraps under the arrow
     * column), from `r7-act2-8`'s committed block:
     *
     *   inherited (what `solveStaging` hands over today)
     *       → SOLVED, 1113 ticks, ONE pass, planning around {8,0}@380 and
     *         {8,1}@932 — the HAND walk's ticks, on a walk that is not it,
     *         and nothing raised a word about it.
     *   stripped (this line)
     *       → REFUSES BY NAME: "pass 1 needs a GAME-sourced tick for {8,0}
     *         … §11.4 refuses the death staging" — which is the truth: the
     *         room needs the `--win` oracle to author, exactly as
     *         `r8-solve-8` did.
     *
     * ⛓ R8's own scripts already strip it — `solve-seedling-r8-tail`'s tape
     * says "with that tape's own timed clear(s) STRIPPED" — BY HAND, in
     * prose, outside the seam. ⚠ REPORTED, NOT FIXED in `tapeRunner`: ⚖
     * §14.5's fourth reason measured that removing these rows is NOT inert
     * (three of the six declaring boots then refuse by name), so where the
     * strip belongs is a design question with a real cost, and this slice is
     * a consumer. Where the model CAN compute the clear (L5's kill-lock),
     * `twoPassSolve`'s discovery arm re-declares it and the inherited row is
     * replaced — which is why this went unseen: it is invisible in exactly
     * the rooms the model can answer for itself.
     */
    const inheritedTimed = (staging.persistence ?? []).filter((r) => r.at !== undefined);
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    /**
     * ⛓ TWO NON-VACUOUS CHECKS ON THE BOOT DERIVATION, and neither is a
     * restatement of what the line above just wrote.
     *
     *  · a COMMITTED row's own boot must BE the atlas's `playerx/playery`
     *    for the door it came through. Twelve committed campaign boots on
     *    this route, none of them authored from the atlas — if they agree,
     *    the arrival derivation the STAGED rows depend on is the game's.
     *  · and where a staged room already HAS a committed tape
     *    (`r8-solve-18`), the block this script builds must be that tape's
     *    boot block. That is the claim "the staged policy is R8's, not this
     *    script's", asserted rather than asserted-in-a-docblock.
     */
    let bootCheck = null;
    if (boot.kind === 'committed') {
        bootCheck = {
            what: `${boot.source}'s committed boot IS the atlas arrival for this door`,
            ok: staging.boot.level === step.level
                && staging.boot.x === step.arrival.x && staging.boot.y === step.arrival.y,
            got: { ...staging.boot },
            want: { level: step.level, ...step.arrival },
        };
    } else if (STAGED_CROSSCHECK.has(bootKey(step.level, step.arrival.x, step.arrival.y))) {
        const crossName = STAGED_CROSSCHECK.get(bootKey(step.level, step.arrival.x, step.arrival.y));
        const other = parseTape(committedTape(crossName));
        bootCheck = {
            what: `the staged block equals ${crossName}'s committed boot`,
            ok: JSON.stringify(staging.boot) === JSON.stringify(other.boot)
                && JSON.stringify(staging.save) === JSON.stringify(other.save)
                && JSON.stringify(staging.rng) === JSON.stringify(other.rng)
                && JSON.stringify(staging.seam) === JSON.stringify(other.seam),
            got: { ...staging.boot },
            want: { ...other.boot },
        };
    }

    const known = KNOWN_ANSWERS.get(bootKey(step.level, step.arrival.x, step.arrival.y)) ?? null;
    const goals = step.goals.map((g) => (g.kind === 'reach-exit'
        ? { kind: 'reach-exit', exit: { ...g.exit } }
        : { kind: 'collect-placement', placement: { ...g.placement } }));

    /**
     * ⛔⛔ THE SURVEY DRIVES THE **TWO-PASS** LOOP, NOT BARE `solveSegment`.
     *
     * Measured the hard way on step 19: a single-pass call against L18 comes
     * back with `levelRun`'s undeclared-kill-lock throw — the state pass 1 is
     * in ON PURPOSE (`twoPassSolve`'s docblock) — and a survey that recorded
     * that as a REFUSAL would have reported the room R8 slice 8 recorded as
     * a wall. A room whose own walk opens its own gate needs the loop, and
     * the loop is the authoring machinery R9 would use anyway.
     *
     * ⚠ `gameTick` is DELIBERATELY NOT INJECTED. A declaration the model
     * refuses to compute is answerable only by the `--win` game oracle, which
     * is a RECORDING channel and this slice is report-only. Such a room comes
     * back as its own verdict (`NEEDS-GAME-ORACLE`), which is the honest
     * answer: the solver is not what stands in its way.
     */
    const levelSource = atlasLevelSource();
    const makeRun = (persistence) =>
        createRunForStaging({ ...staging, persistence }, levelSource);

    // ⛓ §14's caution, asked at the boot rather than inferred from a picture:
    // 125 of 153 committed tapes have NO live clock, so "no hammer line" is
    // the common case and means UNDECLARED CLOCK, never "no spinner".
    const probe = makeRun(staging.persistence);
    const clock = {
        gameTime: Number.isFinite(probe.gameTime) ? probe.gameTime : null,
        refusal: probe.gameTimeRefusal ?? null,
    };

    /**
     * ── THE PICTURES' INPUTS, WRITTEN WHERE NO ROSTER READS THEM ──────
     *
     * ⛔ NOT `fixtures/tapes/`. That directory IS the differential's roster
     * (`fixtures/index.js:46` derives it from disk), so a survey tape left
     * there would silently join 153 committed artifacts. These go under the
     * gitignored survey directory, exactly where a page DOWNLOAD would put
     * one, and only the exporter ever reads them.
     *
     *  · EVERY room gets a **0-tick tape at its declared boot**. That is the
     *    refusal's picture: a plan-time refusal never spends a tick, so the
     *    interesting instant IS tick 0, and the room at tick 0 is where the
     *    obstacle the refusal names is standing.
     *  · a SOLVED room additionally folds its own walk with the ONE fold
     *    (`buildStagedTape`) so `--tick=last` shows where it ended up.
     *
     * ⛔⛔ THE BOOT VIEW IS WRITTEN **BEFORE** THE SOLVE, and that ordering
     * is a repair rather than a preference: written after, a step that
     * TIMES OUT is SIGKILLed with nothing on disk — so the one verdict that
     * most needs a picture of the room was the only one that had none.
     * Measured on A14 (L6, the alternative leg), which produced no view at
     * all on the first pass.
     */
    mkdirSync(join(OUT_DIR, 'views'), { recursive: true });
    const viewPath = (kind) => join(OUT_DIR, 'views', `step-${step.step}-${kind}.json`);
    const rel = (p) => p.slice(REPO.length + 1);
    const views = {};
    writeFileSync(viewPath('boot'), `${JSON.stringify(buildStagedTape({
        staging, perTick: [], name: `survey-step-${step.step}-boot`,
    }), null, 4)}\n`);
    views.boot = rel(viewPath('boot'));

    const t0 = Date.now();
    let solved = null;
    let refusal = null;
    let verdict = 'SOLVED';
    try {
        solved = await twoPassSolve({
            makeRun,
            goals,
            name: `survey-step-${step.step}`,
            boot: staging.boot,
            persistence: staging.persistence,
            log: () => {},
        });
    } catch (e) {
        refusal = e.message;
        verdict = /needs a GAME-sourced tick/i.test(e.message) ? 'NEEDS-GAME-ORACLE' : 'REFUSED';
    }
    const ms = Date.now() - t0;

    /**
     * ⛓ AND WHERE A ROW HAD TIMED CLEARS TO STRIP, **BOTH READINGS ARE
     * RECORDED** (⚖ the design session, mid-flight on this slice's own data).
     * Staging IS declared, so a known-answer room may legitimately carry its
     * own committed v9 rows — and a FRESH derivation of the same room may
     * still need the game. Those are two honest answers to two questions,
     * and a table printing one of them would be answering the other by
     * accident. Only a step whose committed boot declares an `at` pays for
     * the second solve: measured, that is L5 and L8 and nobody else.
     */
    let withCommitted = null;
    if (inheritedTimed.length) {
        try {
            const alt = await twoPassSolve({
                makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
                goals,
                name: `survey-step-${step.step}-committed`,
                boot: staging.boot,
                persistence: [...staging.persistence, ...inheritedTimed],
                log: () => {},
            });
            withCommitted = {
                verdict: 'SOLVED', ticks: alt.out.perTick.length, passes: alt.passes.length,
            };
        } catch (e) {
            withCommitted = {
                verdict: /needs a GAME-sourced tick/i.test(e.message)
                    ? 'NEEDS-GAME-ORACLE' : 'REFUSED',
                refusal: e.message,
            };
        }
    }

    // ⛔ THE VERDICT IS READ OFF A **REPLAY** OF THE EMITTED INPUTS, not off
    // the solving pass — the r8-l18 precedent. A solve that "worked" and a
    // walk that reproduces it are different artifacts.
    let replay = null;
    if (solved) {
        const run = makeRun(solved.persistence);
        for (const held of solved.out.perTick) run.advance(held);
        replay = {
            hits: run.playerHits.length,
            deaths: run.playerDeaths.length,
            endLevel: run.level,
            transitions: (run.transitions ?? []).map((t) => `${t.from}->${t.to}@${t.t}`),
            earnedClears: (run.earnedClears ?? []).map((c) => `{${c.level},${c.tag}}`),
        };
    }

    if (solved) {
        const walk = buildStagedTape({
            staging: { ...staging, persistence: solved.persistence },
            perTick: solved.out.perTick,
            name: `survey-step-${step.step}`,
        });
        writeFileSync(viewPath('walk'), `${JSON.stringify(walk, null, 4)}\n`);
        views.walk = rel(viewPath('walk'));
    }

    return {
        step: step.step,
        level: step.level,
        boot: {
            ...boot,
            block: staging.boot,
            check: bootCheck,
            strippedTimedClears: inheritedTimed.map((r) => `{${r.level},${r.tag}}@${r.at}`),
        },
        withCommittedDeclarations: withCommitted,
        goals: step.goals,
        views,
        clock,
        verdict,
        refusal,
        ticks: solved ? solved.out.perTick.length : null,
        traceRows: solved ? solved.out.trace.rows.length : null,
        replans: solved ? solved.out.replans : null,
        passes: solved ? solved.passes : null,
        declarations: solved ? solved.declarations : null,
        replay,
        ms,
        knownAnswer: known,
        knownTicks: known ? committedTape(known).tick_count : null,
        /**
         * ⛓ AGREEMENT IS A MEASUREMENT, NOT A LABEL. A known-answer row is
         * here to be re-solved; whether the tick counts match is reported
         * either way and explained afterwards. ⚠ A known tape solved for a
         * DIFFERENT errand in the same room (r8-solve-11 takes the chest and
         * leaves east; this route leaves north) will disagree, and that
         * disagreement is information rather than a defect.
         */
        agreesWithKnown: known && solved
            ? solved.out.perTick.length === committedTape(known).tick_count : null,
    };
}

// ─────────────────────────────────────────────────────────────────────
// 5. THE MECHANISM FAMILY — a refusal mapped to R8's conversion queue
// ─────────────────────────────────────────────────────────────────────

/**
 * ⚠⚠ **EVERY ROW OF THIS TABLE WAS WRITTEN AFTER READING THE REFUSAL IT
 * CLASSIFIES**, and the first draft — written before the survey ran, from
 * the vocabulary the R8 doc uses — got THREE of the five wrong. It filed
 * L15's `shove` under a generic "PLAN" because the message contains "no
 * corridor", and L16's chaser-roster refusal under "CENSUS" because it
 * contains the word "census". A classifier keyed on words that appear in
 * every refusal classifies nothing.
 *
 * ⛔ So the rules key on the SENTENCE THAT DECIDES, most specific first,
 * and each names its row in R8's own handoff table. A refusal matching
 * nothing lands as `unclassified` WITH ITS FULL TEXT — a survey whose
 * classifier silently swallows the unknown reports a smaller problem than
 * it found (⚖ the bounded-sweep law: name what you bounded).
 */
const FAMILY_RULES = [
    [/chaser roster is REFUSED|no live position for it|priced "stepped"/,
        'BRIDGE+KILL_ARM — the room\'s CHASER ROSTER is refused, so the body has no live '
        + 'position: `bait` has no line to move it along and `kill` has no removal to '
        + 'watch. R8 handoff: `KILL_ARM_POLICY.Bob` still `refused` — "nothing drove a '
        + 'PRESS against a chaser"'],
    [/`Game\.shake`|is on screen at tick/,
        'CAMERA BAND — `levelRun` REFUSES an on-screen verdict for a body at the screen '
        + 'edge inside `Game.shake`\'s jiggle (camera.js, "THE SHAKE, AND WHY IT IS A '
        + 'BAND"). Not a missing mechanism: a missing STANCE RULE. The refusal names its '
        + 'own cure — "move the stance away from the screen edge, or wait the shake out"'],
    [/Strategy '([a-z]+)' failed to apply/,
        (m) => `VERB-APPLY — the '${m[1]}' strategy IS registered and did not apply here`],
    /**
     * ⛓ R9 SLICE 4 — R8 LESSON 2's OWN SHAPE HAD NO RULE, and a mutant is what
     * found it. `solverBot` deliberately distinguishes *"no strategy row
     * exists"* from *"a strategy is SELECTED and not registered"* — the second
     * is the COMPUTED work order the whole seam exists to produce — and this
     * classifier had a rule for the first and not the second, so the sentence
     * that names the next slice's job landed as `unclassified`.
     *
     * ⚠ AND IT REACHES NOTHING ON TODAY'S ROUTE (trap 475: a declared axis that
     * reaches nothing prints a complete-looking table). Its witness is slice
     * 4's mutant (b) — the `break` row registered with `STRATEGY_EXECUTORS
     * .break` removed — which produced exactly this text on step 12 and landed
     * as `unclassified`. It is added with that witness named, not on the
     * strength of a shape nobody has seen.
     */
    [/Strategy '([a-z]+)' is SELECTED but not registered/,
        (m) => `VERB-SELECTED-NOT-REGISTERED — the table names '${m[1]}' for this obstacle `
            + 'and no executor is registered for it. R8 lesson 2: this is a COMPUTED work '
            + 'order, not a missing mechanism — the room says which verb it wants'],
    [/No strategy row exists for this obstacle/,
        'VERB-MISSING — the selected obstacle has NO strategy row at all'],
    [/needs a GAME-sourced tick/,
        'ORACLE — a declaration the model refuses to compute; only the `--win` game '
        + 'channel can answer it, which is a RECORDING channel (R9\'s)'],
    [/combat ladder is EXHAUSTED/,
        'LADDER — every rung of ⚖ §11.8a\'s order refused; see the per-rung reasons'],
];

/** The obstacle a solver refusal names, verbatim — the family's actual subject. */
function obstacleOf(refusal) {
    const m = /Obstacle: (\S+) \(([^)]+)\)/.exec(refusal ?? '')
        ?? /danger at \([^)]*\) — (\S+?) \(/.exec(refusal ?? '');
    return m ? (m[2] ? `${m[1]} ${m[2]}` : m[1]) : null;
}

function familyOf(refusal) {
    if (!refusal) return null;
    for (const [re, family] of FAMILY_RULES) {
        const m = re.exec(refusal);
        if (m) return typeof family === 'function' ? family(m) : family;
    }
    return 'unclassified — see the refusal text';
}

// ─────────────────────────────────────────────────────────────────────
// 6. MAIN
// ─────────────────────────────────────────────────────────────────────

const route = deriveRoute();
const alternative = deriveAlternative(route);
/** Every step this survey can run — the chosen route, then the alternative leg. */
const allSteps = [...route.steps, ...(alternative?.steps ?? [])];

if (STEP !== null) {
    const step = allSteps.find((s) => String(s.step) === String(STEP));
    if (!step) throw new Error(`no route step ${STEP} (the survey has ${allSteps.length})`);
    const result = await solveOneStep(step);
    console.log(`##SURVEY##${JSON.stringify(result)}`);
    process.exit(0);
}

// ── the route, printed and published FIRST ───────────────────────────
console.log('## THE ROUTE — derived from AP\'s own region rules, the atlas, and the '
    + 'sphere order\n');
for (const leg of route.legs) {
    console.log(`LEG ${leg.sphere}  ${leg.goal}  (+${leg.item})`);
    console.log(`  items held entering: {${leg.itemsHeld.join(', ') || 'none'}}`);
    console.log(`  levels: ${leg.levels.map((n) => `L${n}`).join(' → ')}`);
    console.log(`  regions: ${leg.regions.join(' > ')}`);
    const detours = leg.alternatives.filter((a) => !a.forced);
    const forced = leg.alternatives.filter((a) => a.forced).map((a) => a.banned);
    console.log(`  FORCED rooms (no route avoids them): ${forced.join(', ') || 'none'}`);
    if (!detours.length) console.log('  alternatives: NONE — every room on this leg is forced');
    for (const alt of detours) {
        console.log(`  alternative (without ${alt.banned}): `
            + `${alt.levels.map((n) => `L${n}`).join(' → ')} — ${alt.levels.length} rooms `
            + `vs ${leg.levels.length} chosen`);
    }
}
console.log('\n## THE D2 ENTRY — L13 has a direct stairs to L20; what is behind it');
for (const probe of d2EntryProbe()) {
    console.log(`  ${probe.edge}: enter ${JSON.stringify(probe.enterRule)}`);
    console.log(`    onward to ${probe.onwardTo}: ${JSON.stringify(probe.onwardRules)}`);
    console.log(`    reaches the shield without already holding it? `
        + `${probe.passableWithoutShield ? '⛔ YES' : 'NO'}`);
}
console.log(`\n## ${route.steps.length} STEPS (one per level visit)\n`);
for (const s of route.steps) {
    const boot = bootFor(s);
    console.log(`${String(s.step).padStart(2)}  L${String(s.level).padEnd(2)} `
        + `visit ${s.visit}  boot=${boot.kind}:${boot.source}  `
        + `goals: ${s.goals.map((g) => `${g.kind}(${g.why})`).join(' then ') || 'none'}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const routeDoc = {
    generator: 'scripts/procgen/survey-seedling-route.mjs',
    sources: {
        ap_rules: apRulesPath().slice(REPO.length + 1),
        atlas: 'frontend/modules/flashPanel/atlases/seedling-map.json',
        spheres: 'frontend/modules/flashPanel/atlases/seedling-sphere-order.json',
    },
    legs: route.legs,
    steps: route.steps.map((s) => ({
        ...s,
        boot: bootFor(s),
        known: KNOWN_ANSWERS.get(bootKey(s.level, s.arrival.x, s.arrival.y)) ?? null,
    })),
    alternative: alternative && {
        levels: alternative.levels,
        avoids: alternative.avoids,
        steps: alternative.steps.map((s) => ({ ...s, boot: bootFor(s) })),
    },
};
writeFileSync(join(OUT_DIR, 'route.json'), `${JSON.stringify(routeDoc, null, 2)}\n`);
console.log(`\nwrote ${join(OUT_DIR, 'route.json')}`);

if (DERIVE_ONLY) process.exit(0);

/**
 * ── `--views`: THE PICTURES ───────────────────────────────────────────
 *
 * Reads the survey it already wrote and drives `export-seedling-view.mjs`,
 * the arc's own CLI, over the view tapes each step left behind. ⛔ ONE
 * RENDERER: this adds a loop and a filename. It draws nothing.
 *
 *  · a REFUSAL (or a TIMEOUT, or a game-oracle wall) gets its room at
 *    **tick 0**. That IS the measured interesting tick for these rows: all
 *    seven refuse during PLANNING, before the run advances a single tick,
 *    so there is no ledger to read a later instant off and inventing one
 *    would be the hardcoded tick ⚖ §14 warns against.
 *  · a SOLVED row whose errand no committed tape already answers gets
 *    `--tick=last` — where the walk ended up.
 *
 * ⚠ §14's OTHER caution, carried: 125 of 153 committed boots have no live
 * `Game.time`, so a spinner room drawn without a hammer line means
 * UNDECLARED CLOCK. Every row's clock is measured at its boot and printed
 * beside its picture, so the reader never has to guess which it is.
 */
const ALL_LAYERS = 'player,enemies,pushables,action,damage,events,volumes,hitboxes,hammer,attacks';
/**
 * Rows whose GOALS are not the known tape's, hand-audited against the
 * committed descriptions — so "disagrees with the known answer" can be told
 * apart from "answers a different question in the same room".
 */
const DIFFERENT_ERRAND = new Map([
    [11, 'exits NORTH to L3; r8-solve-11 takes the chest and leaves EAST to L10'],
    [21, 'the shield ALONE; r8-d2-20 also crosses west through the three gates to L13'],
    ['A10', 'exits to L9 (the alternative leg); r8-solve-10 exits to L11'],
]);

/**
 * ── `--table`: THE DELIVERABLE, IN MARKDOWN ───────────────────────────
 *
 * The same rows as `survey.json`, rendered. ⛔ A refusal is quoted WHOLE
 * below the table, never summarised into the cell — a survey whose refusal
 * column reads "planner error" has thrown away the only thing it produced.
 */
if (process.argv.includes('--table')) {
    const survey = JSON.parse(readFileSync(join(OUT_DIR, 'survey.json'), 'utf8'));
    const L = [];
    const solvedN = survey.rows.filter((r) => r.verdict === 'SOLVED').length;
    L.push('# The route-only solver coverage survey', '');
    L.push(`**${solvedN}/${survey.rows.length} route steps solve today.** Generated by `
        + '`scripts/procgen/survey-seedling-route.mjs`; ⛔ REPORT ONLY — no committed '
        + 'artifact moved.', '');
    L.push('## The route (deliverable #1 — and the survey\'s BOUND)', '');
    for (const leg of survey.route.legs) {
        L.push(`- **leg ${leg.sphere} → ${leg.goal}** (+${leg.item}), holding `
            + `{${leg.itemsHeld.join(', ') || 'nothing'}}: `
            + `${leg.levels.map((n) => `L${n}`).join(' → ')}`);
        for (const alt of leg.alternatives.filter((a) => !a.forced)) {
            L.push(`  - alternative without \`${alt.banned}\`: `
                + `${alt.levels.map((n) => `L${n}`).join(' → ')} `
                + `(${alt.levels.length} rooms vs ${leg.levels.length})`);
        }
    }
    L.push('', '## The table', '');
    L.push('| step | level | goal(s) | boot | verdict | missing MECHANISM FAMILY |');
    L.push('|---|---|---|---|---|---|');
    for (const r of survey.rows) {
        const goals = r.goals.map((g) => g.why).join('<br>then ');
        // ⛓ THE ARRIVAL IS IN THE CELL BECAUSE IT DECIDES THE ANSWER. Steps
        // 12 and A17 are the SAME room with the SAME exit goal and opposite
        // verdicts — L3 entered from L11 at (96,128) is behind
        // `breakablerock@96,112`; entered from L4 at (16,16) it is not. A
        // table without this column would read as a contradiction.
        const boot = `\`${r.boot.kind}\`: ${r.boot.source}`
            + `<br>at (${r.boot.block?.x ?? '?'},${r.boot.block?.y ?? '?'})`
            + (r.boot.strippedTimedClears?.length
                ? `<br>⚠ stripped ${r.boot.strippedTimedClears.join(' ')}` : '');
        let verdict;
        if (r.verdict === 'SOLVED') {
            verdict = `**SOLVED** ${r.ticks} ticks, ${r.traceRows} decision(s), `
                + `${r.replans} re-plan(s), ${r.passes.length} pass(es), `
                + `${r.replay.hits} hit(s)`
                + (r.knownAnswer ? `<br>known ${r.knownAnswer}: ${r.knownTicks} `
                    + `— ${r.agreesWithKnown ? '✔ agrees' : '⚠ differs'}` : '');
        } else if (r.verdict === 'TIMEOUT') {
            verdict = `**TIMEOUT** — no answer in ${r.timeoutSeconds} s `
                + '(a bound, not a proof of unsolvability)';
        } else {
            verdict = `**${r.verdict}** — see the quoted refusal below`;
        }
        if (r.withCommittedDeclarations) {
            verdict += `<br>⛓ with the committed declarations carried: `
                + `${r.withCommittedDeclarations.verdict}`
                + (r.withCommittedDeclarations.ticks
                    ? ` ${r.withCommittedDeclarations.ticks} ticks` : '');
        }
        L.push(`| ${r.step} | L${r.level} | ${goals} | ${boot} | ${verdict} | `
            + `${r.family ?? '—'} |`);
    }
    L.push('', '## The refusals, verbatim', '');
    for (const r of survey.rows.filter((x) => x.verdict !== 'SOLVED')) {
        L.push(`### step ${r.step} — L${r.level} — ${r.verdict}`, '');
        L.push('```');
        L.push(r.refusal ?? `(no message — the child was killed at the ${r.timeoutSeconds} s bound)`);
        L.push('```', '');
    }
    writeFileSync(join(OUT_DIR, 'survey.md'), `${L.join('\n')}\n`);
    console.log(`wrote ${join(OUT_DIR, 'survey.md')}`);
    process.exit(0);
}

if (process.argv.includes('--views')) {
    const survey = JSON.parse(readFileSync(join(OUT_DIR, 'survey.json'), 'utf8'));
    const pngDir = join(OUT_DIR, 'png');
    mkdirSync(pngDir, { recursive: true });
    const exporter = join(HERE, 'export-seedling-view.mjs');
    const shots = [];
    for (const row of survey.rows) {
        const solvedKnown = row.verdict === 'SOLVED' && row.knownAnswer
            && row.agreesWithKnown && !DIFFERENT_ERRAND.has(row.step);
        if (solvedKnown) continue;
        const walk = row.verdict === 'SOLVED';
        const tape = walk ? row.views?.walk : row.views?.boot;
        if (!tape) continue;
        const out = join(pngDir, `step-${row.step}-${walk ? 'last' : 'refusal'}.png`);
        const args = [exporter, `--out=${out}`, `--tape=${tape}`, `--layers=${ALL_LAYERS}`, '--quiet'];
        if (walk) args.push('--tick=last');
        // eslint-disable-next-line no-await-in-loop
        const code = await new Promise((done) => {
            execFile(process.execPath, args, { cwd: REPO, timeout: 300000 },
                (err) => done(err ? (err.code ?? 1) : 0));
        });
        shots.push({ step: row.step, level: row.level, verdict: row.verdict, out, exit: code,
            clock: row.clock, why: walk ? 'tick=last' : 'tick 0 — the refusal is at PLAN time' });
        console.log(`  ${out} — exit ${code} (${row.verdict}, ${walk ? 'last' : 'tick 0'}, `
            + `clock ${row.clock?.gameTime ?? 'UNDECLARED'})`);
    }
    writeFileSync(join(OUT_DIR, 'png', 'index.json'), `${JSON.stringify(shots, null, 2)}\n`);
    process.exit(shots.some((s) => s.exit !== 0) ? 1 : 0);
}

// ── the solves, one child each ───────────────────────────────────────
const wanted = ONLY ? new Set(ONLY.split(',').map((s) => s.trim())) : null;

/**
 * A step's IDENTITY for the addendum: room, arrival and goals. The
 * alternative shares nine of its rooms with the chosen route in the OUTBOUND
 * direction — same level number, different door, different errand — so a key
 * on the level alone would have skipped six genuinely new solves and called
 * the addendum cheap.
 */
const identityOf = (s) => `L${s.level}@${s.arrival.x},${s.arrival.y}:`
    + s.goals.map((g) => `${g.kind}(${JSON.stringify(g.exit ?? g.placement)})`).join('+');
const chosenIdentities = new Set(route.steps.map(identityOf));
const addendum = (alternative?.steps ?? []).filter((s) => !chosenIdentities.has(identityOf(s)));
console.log(`\n## THE ADDENDUM — ${addendum.length} step(s) of the alternative leg 2 that `
    + 'the chosen route never walks');
for (const s of addendum) {
    console.log(`  ${s.step}  L${s.level} visit ${s.visit}  boot=${bootFor(s).kind}:`
        + `${bootFor(s).source}  goals: ${s.goals.map((g) => g.why).join(' then ')}`);
}

const rows = [];
for (const step of [...route.steps, ...addendum]) {
    if (wanted && !wanted.has(String(step.step))) continue;
    process.stdout.write(`\n== step ${step.step} — L${step.level} ... `);
    const started = Date.now();
    // eslint-disable-next-line no-await-in-loop
    const res = await new Promise((resolve) => {
        execFile(process.execPath, [fileURLToPath(import.meta.url), `--step=${step.step}`], {
            cwd: REPO, timeout: TIMEOUT_S * 1000, maxBuffer: 64 * 1024 * 1024, killSignal: 'SIGKILL',
        }, (err, stdout, stderr) => {
            const marked = String(stdout).split('\n').find((l) => l.startsWith('##SURVEY##'));
            if (marked) return resolve(JSON.parse(marked.slice('##SURVEY##'.length)));
            if (err && err.killed) {
                return resolve({
                    step: step.step, level: step.level, verdict: 'TIMEOUT',
                    refusal: null, ms: Date.now() - started,
                    timeoutSeconds: TIMEOUT_S,
                    stderr: String(stderr).trim().split('\n').slice(-6).join('\n'),
                });
            }
            return resolve({
                step: step.step, level: step.level, verdict: 'CRASHED',
                refusal: String(stderr).trim() || String(err),
                ms: Date.now() - started,
            });
        });
    });
    // ⛔ A TIMEOUT/CRASH row comes back from the PARENT, not the child, so it
    // carries none of the step's own description. Filling it in here is what
    // keeps the table's shape uniform — a row missing its goals reads as a
    // step with no errand rather than a step with no answer.
    res.boot = res.boot ?? { ...bootFor(step), block: { level: step.level, ...step.arrival } };
    res.goals = res.goals ?? step.goals;
    res.visit = res.visit ?? step.visit;
    res.clock = res.clock ?? { gameTime: null, refusal: 'not measured — the child was killed' };
    res.family = familyOf(res.refusal);
    rows.push(res);
    console.log(res.verdict === 'SOLVED'
        ? `SOLVED ${res.ticks} ticks, ${res.traceRows} decision(s), ${res.replans} re-plan(s), `
          + `${res.replay.hits} hit(s), ${res.passes.length} pass(es) — ${res.ms} ms`
        : `${res.verdict} — ${(res.refusal ?? '').split('\n')[0].slice(0, 160)}`);
}

/**
 * ⛔ `--only` MERGES, it does not replace. A partial re-run that overwrote
 * `survey.json` with its own two rows would silently delete the other
 * twenty-seven — and the file is the table's source.
 */
let merged = rows;
if (wanted) {
    let prior = [];
    try { prior = JSON.parse(readFileSync(join(OUT_DIR, 'survey.json'), 'utf8')).rows ?? []; }
    catch { prior = []; }
    const byStep = new Map(prior.map((r) => [String(r.step), r]));
    for (const r of rows) byStep.set(String(r.step), r);
    const order = new Map([...route.steps, ...(alternative?.steps ?? [])]
        .map((s, i) => [String(s.step), i]));
    merged = [...byStep.values()].sort((a, b) =>
        (order.get(String(a.step)) ?? 0) - (order.get(String(b.step)) ?? 0));
}
const survey = { generator: routeDoc.generator, route: routeDoc, rows: merged };
writeFileSync(join(OUT_DIR, 'survey.json'), `${JSON.stringify(survey, null, 2)}\n`);
console.log(`\nwrote ${join(OUT_DIR, 'survey.json')}`);

const solvedRows = merged.filter((r) => r.verdict === 'SOLVED');
console.log(`\n## HEADLINE: ${solvedRows.length}/${merged.length} route steps SOLVE today`);
for (const r of merged.filter((x) => x.verdict !== 'SOLVED')) {
    console.log(`  step ${r.step} L${r.level}: ${r.verdict} — ${r.family ?? ''}`);
}
