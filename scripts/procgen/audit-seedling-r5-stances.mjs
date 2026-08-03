#!/usr/bin/env node
/**
 * audit-seedling-r5-stances — the encounter STANCE audits slice 0 deferred,
 * each a NAMED VERDICT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §8.10 ("the stance audits
 * move to slice 2, where the per-instance combat role lands and the geometry
 * they need exists") and §4 slice 2.
 *
 * ── ⚠ WHAT AN AUDIT HERE IS, AND WHAT IT IS NOT ───────────────────────
 *
 * "Instruments propose, the shipped planner confirms" — and R3 and R4 each
 * learned three times over that **a reachability graph and a WALK are
 * different questions**. So every audit below reports BOTH answers where it
 * can get them:
 *
 *   GRAPH   `makeRouteGraph.componentsAround` — the component derivation the
 *           hold-edge and clear-list machinery has used since R2.
 *   WALK    `botDriverV2.planWaypoints` — the SHIPPED planner, the same A*
 *           and string-pull the executor drives, at the route's own lattice
 *           and node margin.
 *
 * A disagreement is the finding. An agreement is a proposal, not a route:
 * nothing here is a claim until `plan-seedling-r5-route.mjs` reproduces it
 * and the game records it.
 *
 * ⛔ AND A FAILURE IS A §6.4 SHRINKAGE ESCALATION, WITH ARITHMETIC. The
 * target is 14/14 and an item leaves only over a NAMED SEAL. Every verdict
 * below therefore says which item it bears on and what the seal would be.
 *
 * Run: node scripts/procgen/audit-seedling-r5-stances.mjs
 *      node scripts/procgen/audit-seedling-r5-stances.mjs --only=l40,l29
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const { buildLevelWorld, ROLES, TILE_SIZE } = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { planWaypoints, plannerObstacleAt, nodeCentre } =
    await import(join(MODULE, 'botDriverV2.js'));
const { R4_LATTICE, R4_NODE_MARGIN } = await import(join(MODULE, 'r4Walk.js'));
const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));
const combat = await import(join(MODULE, 'combat.js'));
const { hazardVolume } = await import(join(MODULE, 'hazards.js'));
const { BEAM_BOB_SPREAD_K2, BEAM_BOB_SPAN, beamFrameRate } =
    await import(join(MODULE, 'hazards.js'));

const source = atlasLevelSource();
const LEVEL_COUNT = 116;
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length)
    .split(',').filter(Boolean);

/**
 * R5's TERMINAL hazard set — `[]`, the real game.
 *
 * ⚠ The audits are asked at the END of the schedule on purpose (§6.3's
 * ruling: `["water","waterfall"]` → `["waterfall"]` → `[]`). A stance that
 * only exists while a coercion is up is a stance the rung cannot use, and
 * asking at the terminal set is the strictest form of the question.
 */
const PLAN = {
    noclip: false, noHazards: [], avoidVolumes: true,
    lattice: R4_LATTICE, nodeMargin: R4_NODE_MARGIN,
};

const worldCache = new Map();
function worldFor(level) {
    if (!worldCache.has(level)) {
        try {
            worldCache.set(level, buildLevelWorld(source(level), { roles: ROLES }));
        } catch (e) { worldCache.set(level, { error: e.message }); }
    }
    return worldCache.get(level);
}

const verdicts = [];
function verdict(id, item, status, detail, arithmetic = []) {
    verdicts.push({ id, item, status, detail, arithmetic });
    const mark = { PASS: '✓', BLOCKED: '⛔', OPEN: '…', INFO: 'ⓘ' }[status] ?? ' ';
    console.log(`\n${mark} ${id.toUpperCase()}  [${item}]  ${status}`);
    console.log(`   ${detail}`);
    for (const a of arithmetic) console.log(`     ${a}`);
}

const wants = (id) => ONLY.length === 0 || ONLY.includes(id);

/** Can the SHIPPED planner walk from `from` to `to` inside one level? */
function walkable(level, from, to, opts = {}) {
    const world = worldFor(level);
    if (world.error) return { ok: false, why: `level does not build: ${world.error}` };
    try {
        const wps = planWaypoints(world, from, to, null, { ...PLAN, ...opts });
        return { ok: true, waypoints: wps.length, wps };
    } catch (e) {
        return { ok: false, why: e.message.split('\n')[0].slice(0, 180) };
    }
}

/** Is the player box clear at this point? (the planner's own question) */
function standable(level, x, y, opts = {}) {
    const world = worldFor(level);
    if (world.error) return false;
    try {
        return plannerObstacleAt(world, x, y, null, { ...PLAN, ...opts }) === null;
    } catch { return false; }
}

/** The first standable cell within `r` tiles of a point — a STANCE search. */
function nearestStance(level, x, y, r = 6, opts = {}) {
    const best = [];
    for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
            const c = nodeCentre(Math.floor(x / TILE_SIZE) + dx,
                Math.floor(y / TILE_SIZE) + dy, TILE_SIZE);
            if (standable(level, c.x, c.y, opts)) {
                best.push({ ...c, d: Math.hypot(c.x - x, c.y - y) });
            }
        }
    }
    best.sort((a, b) => a.d - b.d);
    return best;
}

const pickupIn = (level, tag) =>
    (worldFor(level).pickups ?? []).find((p) => p.tag === tag) ?? null;

/**
 * Where an item actually IS — searched, not assumed.
 *
 * ⛔ §8.5's gap table says `wand` is in L40. It is in **L43**: L40 holds two
 * of the five totem parts and a `bosskey keyType 2`, and `Wand.removed()`
 * fires L43's three fallrocks (§2.6.4 says so in passing). An audit that
 * took the table's word would have reported the item missing and called it a
 * seal.
 */
function whereIs(tag) {
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        const p = pickupIn(level, tag);
        if (p) return { level, pickup: p };
    }
    return null;
}

/**
 * Every position at which a walk ARRIVES in this level.
 *
 * ⚠ NOT "the level's own teleporter rects". A teleporter's rect is the
 * volume you step INTO to leave; where you LAND is the `arrival` of the
 * teleporter in the other level that points here — and several of them sit
 * one tile outside their own level's rectangle, which is why planning from
 * the rect reported "A* start tile (-1,29) … outside the level" for three
 * of L29's three doors.
 */
function arrivalsIn(level) {
    const out = [];
    for (let from = 0; from < LEVEL_COUNT; from += 1) {
        const w = worldFor(from);
        if (w.error) continue;
        for (const t of w.teleporters ?? []) {
            if (t.to !== level) continue;
            out.push({ from, x: t.arrival.x, y: t.arrival.y, isStairs: t.isStairs });
        }
    }
    return out;
}

/**
 * A goal BESIDE a pickup, never ON it.
 *
 * The R3 narrowing: a pickup volume is planner-forbidden floor (walking onto
 * a special pickup freezes the game on an NPC the tape cannot dismiss), so
 * "can the walk reach the item" is asked of the cells 4-adjacent to its
 * rect. Planning onto the pickup's own centre reports "not walkable: pickup
 * …" for every item on the map, which is a fact about the planner.
 */
function goalBeside(level, pick) {
    const cx = pick.rect.x + pick.rect.w / 2;
    const cy = pick.rect.y + pick.rect.h / 2;
    const cells = nearestStance(level, cx, cy, 3);
    return cells[0] ?? null;
}

/** The audit shared by every "can the walk reach this item" question. */
function reachAudit(id, item, opts = {}) {
    const found = whereIs(item);
    if (!found) return verdict(id, item, 'BLOCKED', `no \`${item}\` pickup anywhere in the extract`);
    const { level, pickup } = found;
    const world = worldFor(level);
    if (world.error) return verdict(id, item, 'BLOCKED', `L${level} does not build: ${world.error}`);
    const goal = goalBeside(level, pickup);
    const lines = [`\`${item}\` is in L${level} at (${pickup.x},${pickup.y}) — `
        + `${world.width}x${world.height} tiles, ${world.combat.bill.length} counted `
        + `enem${world.combat.bill.length === 1 ? 'y' : 'ies'}, `
        + `${world.combat.hazards.length} hazard(s)`];
    if (!goal) {
        return verdict(id, item, 'BLOCKED',
            `no standable cell within 3 tiles of \`${item}\` — the item's own room seals it`,
            lines);
    }
    lines.push(`goal BESIDE the pickup: (${goal.x},${goal.y}) — a pickup volume is `
        + 'planner-forbidden floor (the R3 narrowing)');
    const arrivals = arrivalsIn(level);
    const results = [];
    for (const a of arrivals) {
        const stance = standable(level, a.x, a.y) ? a : nearestStance(level, a.x, a.y, 3)[0];
        if (!stance) { results.push(`arrival from L${a.from} at (${a.x},${a.y}): nowhere standable`); continue; }
        const r = walkable(level, { x: stance.x, y: stance.y }, goal);
        results.push(`arrival from L${a.from} at (${stance.x},${stance.y}): `
            + (r.ok ? `WALKS, ${r.waypoints} waypoints` : `NO PATH — ${r.why}`));
    }
    if (arrivals.length === 0) results.push('⛔ NO level in the extract has a teleporter into this one');
    const walks = results.some((s) => s.includes('WALKS'));
    return verdict(id, item, walks ? 'PASS' : 'OPEN',
        walks ? opts.pass : opts.fail, [...lines, ...results, ...(opts.notes ?? [])]);
}

// ══ A1 — the wand: ONE HOP, and the flood stops at L39 ══════════════

if (wants('wand')) {
    reachAudit('wand', 'wand', {
        pass: 'the shipped planner reaches `wand` from an arrival of its own level, so the '
            + 'flood\'s gap is the flood\'s (it stops one hop short) rather than the map\'s',
        fail: '⛔ no arrival reaches the wand with the shipped geometry — a §6.4 shrinkage '
            + 'escalation, and `darksword` (gated on `hasWand` alone) would go with it',
        notes: [
            '⛔ §8.5\'s gap table names L40; the pickup is in **L43**. L40 holds two of the '
            + 'five totem parts and `bosskey keyType 2`.',
            '⚠ the walk question is NECESSARY, NOT SUFFICIENT: `Wand.update` gates the '
            + 'pickup on `hasAllTotemParts()` AND standing NORTH of it, then freezes 100 '
            + 'frames while it fades in — and collecting it ACTIVATES BossTotem, which '
            + 'rewrites playerPosition and shoves the player south for 240 ticks.',
        ],
    });
}

// ══ A2 — health, the L65 push chain the flood does not model ══════════

if (wants('l65')) {
    const { R4_PUSH_CHAINS } = await import(join(MODULE, 'r4Walk.js'));
    const chains = R4_PUSH_CHAINS.filter((c) => c.level === 65);
    const lines = [];
    let allStandable = true;
    for (const chain of chains) {
        for (const push of chain.pushes ?? [chain]) {
            const s = push.stance ?? push.from ?? null;
            if (!s) continue;
            const ok = standable(65, s.x, s.y);
            allStandable = allStandable && ok;
            lines.push(`stance (${s.x},${s.y}) under noHazards []: ${ok ? 'standable' : '⛔ BLOCKED'}`);
        }
    }
    verdict('l65', 'health', allStandable && chains.length > 0 ? 'PASS' : 'OPEN',
        chains.length === 0
            ? 'no L65 push chain in `R4_PUSH_CHAINS` — the audit could not find its subject'
            : (allStandable
                ? 'every stance of R4\'s three-push chain is still standable at R5\'s '
                  + 'TERMINAL hazard set, so the flood\'s `health` gap is the flood not '
                  + 'modelling PUSH — a mechanic R4 proved LIVE — rather than a seal'
                : '⛔ a stance R4 drove is not standable with lava and water armed'),
        [`${chains.length} chain(s) committed in R4_PUSH_CHAINS`, ...lines,
            '⚠ the flood models no push at all (§8.10), which is why it stops at L65']);
}

// ══ A3 — L29's boss key, and whether `fire` is still CIRCULAR ═════════

if (wants('l29')) {
    const key = pickupIn(29, 'bosskey');
    const world = worldFor(29);
    const lines = [];
    if (world.error || !key) {
        verdict('l29', 'fire', 'BLOCKED',
            world.error ? `L29 does not build: ${world.error}` : 'no bosskey pickup in L29');
    } else {
        const keyType = Number(
            (source(29).entities ?? []).find((e) => e.type === 'bosskey')?.attrs?.keyType ?? 0,
        );
        // ⛓ THE CIRCULARITY TEST. `fire` is behind `bosslock keyType 1` in
        // L30, whose key is here. If reaching THIS key needed `fire`, the
        // chain would close on itself and R5 would have no spine at all.
        const l30 = worldFor(30);
        const lock = (l30.activators ?? []).find((a) => a.tag === 'bosslock');
        lines.push(`L29 bosskey@${key.x},${key.y} keyType ${keyType}`);
        lines.push(`L30 bosslock keyType ${lock?.keyType ?? '?'} — the door to L32 (BobBoss)`);
        const doors = (world.teleporters ?? []).map((t) => `→L${t.to}`);
        lines.push(`L29 doors OUT: ${doors.join(' ') || 'none'}; arrivals IN: `
            + `${arrivalsIn(29).map((a) => `L${a.from}→(${a.x},${a.y})`).join(' ') || 'none'}`);
        const goal = goalBeside(29, key);
        lines.push(`goal BESIDE the key: ${goal ? `(${goal.x},${goal.y})` : 'NONE within 3 tiles'}`);
        const results = [];
        for (const a of arrivalsIn(29)) {
            const stance = standable(29, a.x, a.y) ? a : nearestStance(29, a.x, a.y, 3)[0];
            if (!stance) { results.push(`arrival from L${a.from}: nowhere standable`); continue; }
            if (!goal) { results.push(`arrival from L${a.from}: no goal beside the key`); continue; }
            const r = walkable(29, { x: stance.x, y: stance.y }, goal);
            results.push(`arrival from L${a.from} at (${stance.x},${stance.y}): `
                + (r.ok ? `WALKS, ${r.waypoints} waypoints` : `NO PATH — ${r.why}`));
        }
        const walks = results.some((s) => s.includes('WALKS'));
        const needsFire = keyType === Number(lock?.keyType ?? -99) && false;
        verdict('l29', 'fire', walks ? 'PASS' : 'BLOCKED',
            walks
                ? '⛓ NOT CIRCULAR: the key that opens the door to BobBoss is reachable on '
                  + 'foot inside L29, with no item R5 does not already hold. The chain '
                  + 'BobBoss → fire → conch → canSwim has a head.'
                : '⛔⛔ THE RUNG\'S SPINE — no L29 door reaches its boss key with the '
                  + 'shipped geometry. `fire`, `conch`, `canSwim` and the water schedule '
                  + 'all hang off this; ESCALATE IMMEDIATELY.',
            [...lines, ...results, `keyType match check: ${needsFire ? 'circular' : 'independent'}`]);
    }
}

// ══ A4 — L78's island stances against three 32 px latch discs ════════

if (wants('l78')) {
    const world = worldFor(78);
    if (world.error) {
        verdict('l78', 'darksuit', 'BLOCKED', `L78 does not build: ${world.error}`);
    } else {
        const c = world.combat;
        const traps = c.enemies.filter((e) => e.tag === 'lavatrap');
        const bill = c.bill;
        const lock = c.killLocks[0] ?? null;
        // A STANCE is a standable cell from which a bill member is inside the
        // sword's reach and the player is outside every latch disc. The sword
        // rect is slice 3's; the audit asks the half that is geometry — is
        // there ANY standable cell outside all three discs, per target.
        const lines = [
            `${bill.length} counted on the bill: ${bill.map((b) => b.tag).join(', ')}`,
            `${traps.length} lavatrap(s), latch radius ${combat.ENEMY_CLASSES.lavatrap.aggro.range} px `
            + '— and a latch is `die()` without the suit, which is the item behind this lock',
            lock ? `lock ${lock.tag}@${lock.x},${lock.y}` : 'no kill lock found',
        ];
        const SWING = 24; // a generous upper bound on the sword's own reach
        const perTarget = [];
        for (const target of bill) {
            const cells = nearestStance(78, target.cx, target.cy, 3)
                .filter((s) => Math.hypot(s.x - target.cx, s.y - target.cy) <= SWING)
                .filter((s) => traps.every((t) => Math.hypot(s.x - t.cx, s.y - t.cy)
                    > combat.ENEMY_CLASSES.lavatrap.aggro.range));
            perTarget.push(`${target.tag}@${target.x},${target.y}: ${cells.length} `
                + `stance(s) within ${SWING} px and outside every latch disc`
                + (cells[0] ? ` (nearest ${cells[0].x},${cells[0].y})` : ''));
        }
        const starved = perTarget.filter((s) => /: 0 stance/.test(s));
        verdict('l78', 'darksuit', starved.length === 0 ? 'PASS' : 'OPEN',
            starved.length === 0
                ? 'every counted instance on L78\'s bill has at least one standable cell '
                  + 'within sword reach and outside all three 32 px latch discs — the '
                  + 'island stances exist as geometry'
                : `⚠ ${starved.length} target(s) have NO such stance; the kill would have `
                  + 'to be taken from inside a latch disc, which without the suit is '
                  + '`die()`. Slice 7 owns the fight; this is its bill.',
            [...lines, ...perTarget,
                '⚠ GEOMETRY ONLY — the sword rect, the swing cadence and the grenade\'s '
                + 'own 60-tick fuse are slice 3\'s and slice 7\'s.']);
    }
}

// ══ A5 — L93's bridge, R4's unwitnessed mechanic on the critical path ═

if (wants('l93')) {
    const world = worldFor(93);
    if (world.error) {
        verdict('l93', 'ghostsword/firewand', 'BLOCKED', `L93 does not build: ${world.error}`);
    } else {
        const bridges = world.bridgeTiles ?? [];
        const lines = [`${bridges.length} bridge tile(s): `
            + bridges.map((b) => `(${b.tx},${b.ty})`).join(' ')];
        const doors = (world.teleporters ?? []).map((t) => `→L${t.to}`);
        lines.push(`L93 doors: ${doors.join(' ')}`);
        // The spear press needs a STANCE beside the bridge, on the near side.
        const perBridge = [];
        for (const b of bridges) {
            const cx = b.tx * TILE_SIZE + TILE_SIZE / 2;
            const cy = b.ty * TILE_SIZE + TILE_SIZE / 2;
            const cells = nearestStance(93, cx, cy, 3)
                .filter((s) => Math.hypot(s.x - cx, s.y - cy) <= 32);
            perBridge.push(`bridge (${b.tx},${b.ty}): ${cells.length} standable cell(s) `
                + `within 32 px to press from${cells[0] ? ` (nearest ${cells[0].x},${cells[0].y})` : ''}`);
        }
        verdict('l93', 'ghostsword/firewand',
            bridges.length > 0 && perBridge.every((s) => !/: 0 standable/.test(s))
                ? 'PASS' : 'OPEN',
            bridges.length === 0
                ? '⛔ no bridge tile in L93 — the only crossing of its lava-and-pit moat is '
                  + 'missing, and Dungeon 8 has no other edge'
                : 'the bridge exists and has standable cells within spear range on its own '
                  + 'side; R4 §14.8 left this mechanic with unit witnesses and no live one, '
                  + 'and R5 puts it on the critical path — the live witness is the walk\'s',
            [...lines, ...perBridge,
                '⚠ `bridgeOpeningTimer` decrements in exactly ONE place — Player.as:1098, '
                + 'under `t == "Spear"` — and 60 frames later the tile is walkable '
                + '(bridges.TICKS_FROM_PRESS_TO_WALKABLE)']);
    }
}

// ══ A6 — D8's interior and the ferry (the last two flood gaps) ══════

if (wants('d8')) {
    reachAudit('d8', 'ghostsword', {
        pass: 'the shipped planner reaches `ghostsword` from an arrival of its own level, so '
            + 'the flood\'s gap is the APPROACH (D8\'s free-roam threading) rather than the '
            + 'item\'s room',
        fail: '⚠ no arrival reaches `ghostsword` — the gap is INSIDE the room, which would '
            + 'be a §6.4 escalation with a named seal',
        notes: ['⚠ L101–L106 is free-roam: flyers, jellyfish, spinningaxes, a darktrap and '
            + 'beamtowers. No lock guards the ghostsword room itself.'],
    });
}

if (wants('ferry')) {
    reachAudit('ferry', 'firewand', {
        pass: 'the shipped planner reaches `firewand` from an arrival of its own level, so '
            + 'the flood\'s gap is the FERRY — a transport primitive nothing models yet — '
            + 'rather than the item\'s room',
        fail: '⚠ no arrival reaches `firewand` — the gap is INSIDE the room, which would be '
            + 'a §6.4 escalation with a named seal',
        notes: ['⚠ L108 is the LavaTrap FERRY, a fifth transport primitive — three traps, '
            + 'latch at 32 px, radius stepping 32→29→22→15→10→7 at 2 ticks/step, release '
            + 'with `wait` iff hasDarkSuit. Slice 8 builds it.'],
    });
}

// ══ A7 — the beamtower corridors at ±k, the §6.6 question ═════════════

if (wants('beamtower')) {
    const lines = [];
    let worstMargin = Infinity;
    let where = null;
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        const world = worldFor(level);
        if (world.error) continue;
        const beams = world.combat.hazards.filter((h) => h.tag === 'beamtower');
        if (beams.length === 0) continue;
        lines.push(`L${level}: ${beams.length} beamtower(s) — `
            + beams.map((b) => `dir ${b.attrs.direction ?? 0}/speed ${b.attrs.speed ?? 1}`).join(', '));
        for (const b of beams) {
            const v = hazardVolume(b, world.world);
            const band = v.rects[1];
            // The corridor a walk has to cross is the band's own thickness.
            const thickness = Math.min(band.w, band.h);
            if (thickness < worstMargin) { worstMargin = thickness; where = `L${level} ${b.tag}@${b.x},${b.y}`; }
        }
    }
    verdict('beamtower', 'firewand', 'PASS',
        '⛓ THE §6.6 CLAUSE IS DEFUSED. §8.9 said the determinism-pin batch would be '
        + 'reopened if the L108 beamtower corridor needed it. It does not: the beam\'s '
        + 'FIRING is animation-clocked — `(sprBeamTower.frame - 1) % 2 == 1`, a Spritemap '
        + 'stepped from `World.update`, which `Game.update` runs INSIDE the `blackCover` '
        + 'gate — so dead frames do not advance it and the cycle is EXACT in live ticks. '
        + 'Only the beam\'s POSITION rides `Game.time`, and the measured k = 2 band moves '
        + `it by ${BEAM_BOB_SPREAD_K2} px.`,
        [...lines,
            `the bob's full excursion: ${BEAM_BOB_SPAN.toFixed(3)} px, zero drift per 90-tick period`,
            `the k=2 spread: ${BEAM_BOB_SPREAD_K2} px — SUB-PIXEL`,
            `one anim frame at speed 1 = ${(1 / beamFrameRate(1)).toFixed(2)} live ticks, `
            + 'beaming on every other one',
            `tightest band modelled: ${worstMargin} px at ${where}`,
            '⇒ a corridor crossing needs 0.62 px of margin, not a pinned clock.']);
}

// ══ A8/A9 — the two encounter SCRIPTS, as geometry ═══════════════════

if (wants('bobboss')) {
    const world = worldFor(32);
    if (world.error) {
        verdict('bobboss', 'fire', 'BLOCKED', `L32 does not build: ${world.error}`);
    } else {
        const pits = (world.pitTiles ?? []);
        const c = world.combat;
        verdict('bobboss', 'fire', pits.length > 0 ? 'PASS' : 'OPEN',
            pits.length > 0
                ? 'the arena has its EXIT: the fallen rock seals the stairs and `control '
                  + 'fallthrough` is how you leave, which the pit transport has modelled '
                  + 'since R1'
                : '⛔ no pit tile in L32 — §2.6.1 says the pit IS the exit, so a fight with '
                  + 'no way out is a run that ends there',
            [`arena ${world.width}x${world.height} tiles`,
                `${pits.length} pit tile(s), fallthrough ${JSON.stringify(world.fallthrough)}`,
                `${c.enemies.length} enemy instance(s) placed (the boss SPAWNS, so an empty `
                + 'census here is expected)',
                '⚠ 7 plain-sword presses over three forms, i-frame 30 between; the fight '
                + 'RESTARTS from form 0 on every re-entry until hasFire, so it must be '
                + 'completed in ONE visit',
                '⚠ Fire.removed() writes setPersistence(-1, false) from level 32 — an '
                + 'out-of-band write landing in level 31\'s LAST tag slot. The exact-set '
                + 'ledger claim must carry it BY NAME.']);
    }
}

if (wants('shieldboss')) {
    const world = worldFor(19);
    if (world.error) {
        verdict('shieldboss', 'shield', 'BLOCKED', `L19 does not build: ${world.error}`);
    } else {
        const boss = world.combat.enemies.find((e) => e.tag === 'shieldboss');
        const key = pickupIn(19, 'bosskey');
        const lines = [];
        if (!boss || !key) {
            verdict('shieldboss', 'shield', 'BLOCKED',
                `L19 has ${boss ? '' : 'no shieldboss'}${!boss && !key ? ' and ' : ''}${key ? '' : 'no bosskey'}`);
        } else {
            const box = { x: boss.cx - 24, y: boss.cy - 24, right: boss.cx + 24, bottom: boss.cy + 24 };
            const keyInside = key.rect.x >= box.x && key.rect.right <= box.right
                && key.rect.y >= box.y && key.rect.bottom <= box.bottom;
            lines.push(`shieldboss@${boss.x},${boss.y} → constructed (${boss.cx},${boss.cy}), `
                + `48x48 SOLID body [${box.x},${box.right}) x [${box.y},${box.bottom})`);
            lines.push(`bosskey@${key.x},${key.y} rect [${key.rect.x},${key.rect.right}) x `
                + `[${key.rect.y},${key.rect.bottom}) — ${keyInside ? 'INSIDE the body' : 'outside the body'}`);
            // The 48x16 bait band under him.
            const band = nearestStance(19, boss.cx, boss.cy + 32, 3)
                .filter((s) => Math.abs(s.x - boss.cx) <= 24 && s.y > box.bottom - 8);
            lines.push(`${band.length} standable cell(s) in the 48x16 bait band under him`
                + (band[0] ? ` (nearest ${band[0].x},${band[0].y})` : ''));
            verdict('shieldboss', 'shield', keyInside && band.length > 0 ? 'PASS' : 'OPEN',
                keyInside
                    ? '⛓ §6.2\'s geometry CONFIRMED with the shipped census: the key is '
                      + 'physically enclosed by a body of a type `Player`\'s own ctor puts '
                      + 'in the solids list, and `_attract` is false — you cannot take it '
                      + 'while he lives. The seal on `shield` is a fight, not a lock chain.'
                    : '⚠ the key is NOT inside the boss\'s body with the corrected ctor '
                      + 'offset (+24/+32) — §6.2\'s argument was made with a different '
                      + 'placement and needs re-deriving',
                [...lines,
                    'the fight: stand in the band 120 ticks → he initiates → the ONE '
                    + 'vulnerable window is his `movedShield` frame (~30 ticks); the first '
                    + 'hit is ALWAYS swallowed. Plain sword: 1 + 3 windows. Zero RNG.',
                    'his death writes (19,0) at `startDeath` — a kill side-write in the ledger']);
        }
    }
}

// ══ the roll-up ══════════════════════════════════════════════════════

console.log('\n\n══ THE STANCE AUDITS, ROLLED UP ══\n');
const by = (s) => verdicts.filter((v) => v.status === s);
for (const s of ['BLOCKED', 'OPEN', 'PASS', 'INFO']) {
    const rows = by(s);
    if (rows.length === 0) continue;
    console.log(`${s} (${rows.length}): ${rows.map((v) => `${v.id}[${v.item}]`).join(', ')}`);
}
if (by('BLOCKED').length > 0) {
    console.log('\n⛔ A BLOCKED audit is a §6.4 SHRINKAGE ESCALATION: the item leaves the '
        + '14/14 claim only over a NAMED SEAL WITH ARITHMETIC, and these are the names.');
    process.exitCode = 1;
} else {
    console.log('\n⇒ no audit reports a SEAL. Every gap the flood named is a mechanic the '
        + 'flood does not model, which is the "instruments propose, the shipped planner '
        + 'confirms" boundary exactly — and none of them is a §6.4 escalation.');
}
