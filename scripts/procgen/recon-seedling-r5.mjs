#!/usr/bin/env node
/**
 * recon-seedling-r5 — slice-0 instruments for the ENEMIES rung.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 0. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §4.0.
 *
 * ── THE QUESTIONS ─────────────────────────────────────────────────────
 *
 * R5 retires `noDamage`. The rung's claim is 14/14, and everything that
 * could move that number is a question about the MAP rather than about the
 * physics:
 *
 *   `--census`        Every combat-relevant instance, per level, per
 *                     instance, from `combat.js`'s tables — the two damage
 *                     families in one list, with the tags that look like
 *                     combat and have no row reported by name.
 *   `--kill-locks`    The ten `tSet == -1` locks and the bill each opens
 *                     on, with each instance's CLEARING ARMS. This is the
 *                     rung's opener list, so it also asserts the two
 *                     things that would make it a lie: that the
 *                     `totalEnemies()` whitelist partitions the class
 *                     directory, and that no lock shares a level with a
 *                     counted-but-unclearable instance.
 *   `--flood`         The armed-map `(level, component)` flood with kill
 *                     locks OPENABLE, under a declared `noHazards` set.
 *                     Answers §6.3: which items are reachable under each
 *                     schedule, and whether any FEATHERLESS crossing of
 *                     L0's waterfall band exists.
 *   `--contact-audit` The committed R4 route replayed against the census's
 *                     own aggro discs and static volumes. Every leg that
 *                     enters one is a named re-route — R4's tapes were
 *                     planned with `noDamage` on and nothing modelled, so
 *                     this is the bill for arming it.
 *   `--windows`       The window plan and the recording wall-clock
 *                     projection (§2.8: the monolithic tape is 2x dead).
 *
 * ⚠ INSTRUMENTS PROPOSE, THE SHIPPED PLANNER CONFIRMS. Carried from R3 and
 * R4, where the one-out sweep lied three times in each rung: a
 * REACHABILITY GRAPH and a WALK are different questions, and only the
 * second one is the claim. Nothing here is a route until
 * `plan-seedling-r5-route.mjs` reproduces it with the shipped geometry.
 *
 * Run: node scripts/procgen/recon-seedling-r5.mjs --census
 *      node scripts/procgen/recon-seedling-r5.mjs --census --levels=98,99
 *      node scripts/procgen/recon-seedling-r5.mjs --kill-locks
 *      node scripts/procgen/recon-seedling-r5.mjs --flood
 *      node scripts/procgen/recon-seedling-r5.mjs --flood --hazards=water,waterfall
 *      node scripts/procgen/recon-seedling-r5.mjs --contact-audit
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

const {
    buildLevelWorld, RELAXED_ROLES, ROLES, TILE_SIZE, rect, ENTITY_CLASSES,
} = await import(join(MODULE, 'levelWorld.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { TILE_COLUMN_TO_TYPE } =
    await import(join(REPO, 'frontend', 'modules', 'flashPanel', 'seedlingSemantics.js'));
const combat = await import(join(MODULE, 'combat.js'));

const source = atlasLevelSource();
const LEVEL_COUNT = 116;

/**
 * The ONE placement table, injected into `combat.js`'s census.
 *
 * `combat.js` refuses to guess an entity's constructed position, and this
 * is why: the offsets are per class and already transcribed once, in
 * `levelWorld.ENTITY_CLASSES`, from each class's `Game.as` construction
 * site. `IceTurret`'s is +16/+16; a census that read the `.oel` attribute
 * would ask about the tile up and left of the one the game put it on.
 */
const placementOf = (tag) => {
    const cls = ENTITY_CLASSES[tag];
    if (!cls) return null;
    return { dx: cls.dx ?? 0, dy: cls.dy ?? 0 };
};
const censusOf = (rec) => combat.combatCensus(rec, { placementOf });

/** The fork the tables were transcribed from, for the recon's own header. */
const SEEDLING_SRC = join(process.env.HOME ?? '/home/robert', 'CC', 'seedling', 'src');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback = null) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};

/** Every level's raw tile-type grid, through the shipped column table. */
const tileGridCache = new Map();
function tileGrid(level) {
    if (tileGridCache.has(level)) return tileGridCache.get(level);
    const rec = source(level);
    const layer = rec.layers.find((l) => l.name === 'tiles');
    const g = new Map();
    for (const [tx, ty, tpx] of layer?.tiles ?? []) {
        // ⚠ A TILESET COLUMN IS NOT A TILE TYPE — R4 §2.5's trap. Column 24
        // is ice and column 36 is bridge; dividing `tx` by 16 and calling it
        // a type reports lava as ice and misses every bridge.
        g.set(`${tx},${ty}`, TILE_COLUMN_TO_TYPE[tpx / TILE_SIZE] ?? null);
    }
    tileGridCache.set(level, g);
    return g;
}
const rawTileAt = (level, px, py) =>
    tileGrid(level).get(`${Math.floor(px / TILE_SIZE)},${Math.floor(py / TILE_SIZE)}`) ?? null;

// ── --census ──────────────────────────────────────────────────────────

function levelsFromOpt() {
    const raw = opt('levels');
    if (!raw) return [...Array(LEVEL_COUNT).keys()];
    return raw.split(',').map(Number);
}

function runCensus() {
    const levels = levelsFromOpt();
    const totals = new Map();
    const unclassified = new Set();
    let instances = 0;
    console.log('## the combat census, per instance\n');
    for (const level of levels) {
        const rec = source(level);
        const c = censusOf(rec);
        for (const u of c.unclassified) unclassified.add(u);
        if (c.enemies.length === 0 && c.hazards.length === 0) continue;
        console.log(`L${String(level).padStart(3)}  ${rec.class}`);
        for (const e of c.enemies) {
            instances += 1;
            totals.set(e.tag, (totals.get(e.tag) ?? 0) + 1);
            const t = rawTileAt(level, e.cx, e.cy);
            const { ways } = combat.clearabilityOf(e, { rawTileType: t });
            console.log(`      ${e.tag.padEnd(14)} @${String(e.x).padStart(4)},${String(e.y).padStart(4)}`
                + `  ${e.counted ? 'COUNTED' : '       '}`
                + `  aggro ${String(e.row.aggro.range).padEnd(12)}`
                + `  tile ${String(t).padStart(3)}`
                + `  clear: ${ways.map((w) => w.how).join('|') || 'NONE'}`);
        }
        for (const h of c.hazards) {
            instances += 1;
            totals.set(h.tag, (totals.get(h.tag) ?? 0) + 1);
            console.log(`      ${h.tag.padEnd(14)} @${String(h.x).padStart(4)},${String(h.y).padStart(4)}`
                + `  hazard   timing ${h.timing}`
                + (h.row.damage === 1000 ? '   ⛔ damage 1000 (instant die)' : ''));
        }
    }
    console.log(`\n${instances} instances over ${levels.length} levels`);
    console.log([...totals].sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v}`).join('  '));
    if (unclassified.size > 0) {
        console.log(`\n⛔ UNCLASSIFIED combat tags: ${[...unclassified].join(', ')}`);
        process.exitCode = 1;
    } else {
        console.log('\n✓ every combat-looking tag in the scanned levels has a row');
    }
}

// ── --kill-locks ──────────────────────────────────────────────────────

function runKillLocks() {
    console.log('## the ten kill locks, and the bill each opens on\n');

    // The whitelist partitions the class directory — asserted, not claimed.
    const dirClasses = readdirSync(join(SEEDLING_SRC, 'Enemies'))
        .filter((f) => f.endsWith('.as')).map((f) => f.replace(/\.as$/, ''));
    const partition = combat.assertTotalEnemiesTable(dirClasses);
    if (partition.length > 0) {
        console.log('⛔ the totalEnemies() whitelist does NOT partition Enemies/:');
        for (const f of partition) console.log(`   - ${f}`);
        process.exitCode = 1;
    } else {
        console.log(`✓ the whitelist + its omissions partition all ${dirClasses.length} `
            + 'classes in Enemies/ (the base class Enemy is both, deliberately)\n');
    }

    let found = 0;
    const sealed = [];
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        const rec = source(level);
        const locks = combat.killLocksIn(rec, { placementOf });
        if (locks.length === 0) continue;
        for (const f of combat.assertNoUnclearableKillLock(rec, { placementOf })) sealed.push(f);
        for (const lock of locks) {
            found += 1;
            const bill = lock.bill.map((inst) => {
                const t = rawTileAt(level, inst.cx, inst.cy);
                const { ways } = combat.clearabilityOf(inst, { rawTileType: t });
                return { inst, t, ways };
            });
            const plain = bill.reduce((n, b) =>
                n + (combat.pressesFor(b.inst.row) ?? 0), 0);
            const dark = bill.reduce((n, b) =>
                n + (combat.pressesFor(b.inst.row, { hasDarkSword: true }) ?? 0), 0);
            console.log(`L${String(level).padStart(3)}  ${lock.tag}@${lock.x},${lock.y}`
                + `  flag ${lock.flag}  — ${bill.length} counted`);
            for (const b of bill) {
                const free = b.ways.find((w) => w.how !== 'kill');
                console.log(`        ${b.inst.tag.padEnd(12)} @${String(b.inst.x).padStart(4)},`
                    + `${String(b.inst.y).padStart(4)}  ${combat.pressesFor(b.inst.row) ?? '—'} presses`
                    + (free ? `   ⚑ FREE: ${free.how} (${free.note})` : ''));
            }
            console.log(`        → ${plain} plain-sword presses, ${dark} with darksword\n`);
        }
    }
    console.log(`${found} kill locks map-wide`);
    if (sealed.length > 0) {
        console.log('\n⛔ SEALED-FOREVER kill locks:');
        for (const s of sealed) console.log(`   - ${s}`);
        process.exitCode = 1;
    } else {
        console.log('✓ no kill lock shares a level with a counted-but-unclearable instance');
    }
}

// ── --flood ───────────────────────────────────────────────────────────

/**
 * The item each pickup tag grants, and the planner gate each item arms.
 *
 * `darksword` and `fire` are deliberately absent: neither has a placement
 * anywhere in the extract. The Witch spawns one from `doneTalking()` under
 * `hasWand`, and BobBoss's third form spawns the other — so both are
 * ENCOUNTER-granted and the flood models them as such below.
 */
const PICKUP_ITEMS = Object.freeze({
    sword: 'hasSword', shield: 'hasShield', darkshield: 'hasDarkShield',
    darksuit: 'hasDarkSuit', feather: 'hasFeather', torchpickup: 'hasTorch',
    ghostspear: 'hasSpear', health: 'health', wand: 'hasWand', conch: 'canSwim',
    ghostsword: 'hasGhostSword', firewand: 'hasFireWand', bosskey: 'bosskey',
});

/** Encounter-granted items: what has to be REACHED for the grant to fire. */
const ENCOUNTER_ITEMS = Object.freeze([
    { item: 'hasFire', at: { level: 32, why: 'BobBoss form 2 drops Fire (BobBoss.as:194)' } },
    { item: 'hasDarkSword', at: { level: 12, why: 'Witch.doneTalking() under hasWand' }, needs: ['hasWand'] },
]);

async function runFlood() {
    const { makeRouteGraph } = await import(join(HERE, 'seedlingRouteGraph.mjs'));
    const { climbsArmedWaterfall } = await import(join(MODULE, 'botDriverV2.js'));
    const { R4_CLEARS, R4_BOOT, R4_LATTICE, R4_NO_HAZARDS } =
        await import(join(MODULE, 'r4Walk.js'));
    const { R3_CLEARS } = await import(join(MODULE, 'r3Walk.js'));
    const { persistenceClearsFor } = await import(join(MODULE, 'levelWorld.js'));

    const hazards = (opt('hazards') ?? R4_NO_HAZARDS.join(',')).split(',').filter(Boolean);
    const lattice = Number(opt('lattice', String(R4_LATTICE)));
    // ⚠ THE CLEAR LIST IS AN EXPERIMENT, NOT A CONSTANT, and R4 is the
    // wrong default for an R5 question: R4 dropped `L12 tag 7` and `L12 tag
    // 12` because "the route no longer threads either corridor", and those
    // two corridors are how R3 reached L83 — i.e. the whole underworld, D7,
    // `darkshield` and `darksuit`. `--clears=all` takes every clear the map
    // OFFERS (`persistenceClearsFor`, which already publishes its own
    // refusals by name) and is therefore the UPPER BOUND on reachability:
    // what it cannot reach, no clear bill can.
    const clearsArg = opt('clears', 'all');
    let clears;
    if (clearsArg === 'none') clears = [];
    else if (clearsArg === 'r4') clears = R4_CLEARS.map((c) => ({ level: c.level, tag: c.tag }));
    else if (clearsArg === 'r3') clears = R3_CLEARS.map((c) => ({ level: c.level, tag: c.tag }));
    else if (clearsArg === 'all') {
        clears = [];
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            let offered;
            try { offered = persistenceClearsFor(source(level)); } catch { continue; }
            for (const c of offered.offers ?? offered.offered ?? []) {
                clears.push({ level, tag: c.tag });
            }
        }
    } else throw new Error(`--clears=${clearsArg}?`);

    console.log(`## the armed-map directed flood — noHazards ${JSON.stringify(hazards)}, `
        + `clears ${clearsArg} (${clears.length}), lattice ${lattice}`
        + `${flag('no-volumes') ? ', AVOID VOLUMES OFF (the upper bound)' : ''}\n`);

    // ⚠ `--no-volumes` is the UPPER BOUND, and it exists because the flood
    // is otherwise stricter than a LEG is. A leg may DECLARE the contacts it
    // starts inside (R1's forced-contact rule) and the hold/collect/touch
    // verbs all walk deliberately ONTO a priced volume — L71's `button@112,176`
    // is a proximity-hazard cell that R3's committed route stands on for 101
    // ticks. A flood that refuses every volume reports Dungeon 7 sealed for a
    // reason that is a fact about the instrument, not about the map. So the
    // sweep is run BOTH ways and the two numbers are quoted together.
    const PLAN = { noclip: false, noHazards: hazards, avoidVolumes: !flag('no-volumes') };
    const cache = { worlds: new Map(), components: new Map() };
    const graph = makeRouteGraph({
        source, clears, plan: PLAN, lattice, holdTicks: 101,
        levelCount: LEVEL_COUNT, cache,
    });

    /**
     * Which locks the flood treats as OPEN, given what the run holds.
     *
     * ⚠ EVERY ARM IS A PERMISSION AND EVERY PERMISSION IS REPORTED. The
     * flood is deliberately looser than the driver — too strict loses
     * reachability in silence, too loose offers an edge the planner then
     * refuses BY NAME before anything is recorded. What it must never do is
     * take a permission nobody can read afterwards, so the reasons come back
     * in `permissions` and the §8 write-up quotes them.
     *
     * ⛔ The arm that was missing on the first cut is the KEY one, and it
     * cost the whole verdict: `BossLock`'s `tSet` is forced to −1 by its
     * ctor, so a rule that opened "t === -1 kill locks" and "t >= 0 groups
     * with a presser" opened NEITHER — and L32, the BobBoss arena, is behind
     * `bosslock@224,208 keyType 1` in a brickpole-walled chamber of L30. The
     * flood reported `fire` unreachable and the reason was a lock class it
     * had no arm for.
     */
    function locksOpenUnder(inv) {
        const open = new Set();
        const why = [];
        const keys = inv.keys ?? new Set();
        for (let level = 0; level < LEVEL_COUNT; level += 1) {
            const world = graph.worldFor(level);
            if (!world) continue;
            for (const a of world.activators) {
                let reason = null;
                if (a.t === combat.KILL_LOCK_TSET && combat.KILL_LOCK_TAGS.includes(a.tag)) {
                    reason = 'kill lock — bill priced by --kill-locks';
                } else if (a.tag === 'bosslock') {
                    if (keys.has(a.keyType)) reason = `bosslock keyType ${a.keyType} — key held`;
                } else if (a.tag === 'wandlock') {
                    if (inv.hasWand) reason = 'wandlock — a wand shot';
                } else if (a.tag === 'magicallock') {
                    if (inv.hasWand) reason = 'magicallock — a wand shot';
                } else if (a.tag === 'magicallockfire') {
                    if (inv.hasFireWand) reason = 'magicallockfire — a firewand shot';
                } else if (a.shield) {
                    if (inv[a.shield]) reason = `shieldlock — ${a.shield} held`;
                } else if (a.t >= 0 && world.pressers.some((p) => p.t === a.t)) {
                    reason = 'hold lock — presser in the same level';
                }
                if (reason) { open.add(a.id); why.push(`L${level} ${a.id} — ${reason}`); }
            }
        }
        return { open, why };
    }

    /** The keyType each placed `bosskey` grants, straight off the extract. */
    const keyTypeAt = new Map();
    for (let level = 0; level < LEVEL_COUNT; level += 1) {
        for (const e of source(level).entities ?? []) {
            if (e.type === 'bosskey') {
                keyTypeAt.set(`${level}:${e.x},${e.y}`, Number(e.attrs?.keyType ?? 0));
            }
        }
    }

    // The fixed point: flood, harvest, re-flood.
    const inventory = { keys: new Set() };
    const gained = [];
    let permissions = [];
    let round = 0;
    let result = null;
    for (;;) {
        round += 1;
        const { open, why } = locksOpenUnder(inventory);
        permissions = why;
        // ⛔ BRIDGES ARE ON THE CRITICAL PATH AT LAST. `bridgeOpeningTimer`
        // decrements in exactly one place — `Player.as:1098`, under
        // `t == "Spear"` — so a bridge is permanently Solid to a walk with no
        // spear and a 60-frame delay to one that has it. R4 shipped
        // `bridges.js`, the `spear: {bridge}` verb and the 64 px on-screen
        // policy and then routed around every bridge, leaving the mechanic
        // with unit witnesses and no live one (§14.8). L93's bridge at (7,13)
        // is the ONLY way across its lava-and-pit moat, and L93 is the only
        // level with an edge into L98 — i.e. into Dungeon 8. So `ghostsword`
        // and `firewand` are behind the mechanic R4 could not exercise.
        const openBridges = new Set();
        if (inventory.hasSpear) {
            for (let level = 0; level < LEVEL_COUNT; level += 1) {
                for (const b of graph.worldFor(level)?.bridgeTiles ?? []) {
                    openBridges.add(`${b.tx},${b.ty}`);
                    permissions.push(`L${level} bridge@${b.tx},${b.ty} — one spear press, `
                        + '60 frames (bridges.TICKS_FROM_PRESS_TO_WALKABLE)');
                }
            }
        }
        result = graph.directedFlood({
            start: R4_BOOT,
            inventory: { ...inventory },
            openLocks: open,
            openBridges,
            stepRefusal: (world, from, to) =>
                climbsArmedWaterfall(world, from, to,
                    { noHazards: hazards, inventory, lattice }),
        });

        // Harvest: a pickup is REACHED when a flooded cell is 4-adjacent to
        // its volume — the R3 narrowing (the pickup's own tile, not the
        // level), because a level can stay reachable while the item leaves
        // the claim.
        let changed = false;
        const reachedLevels = new Set([...result.seen]
            .filter((k) => !k.startsWith('exit:'))
            .map((k) => Number(k.split(':')[0])));
        for (const level of reachedLevels) {
            const world = graph.worldFor(level);
            for (const p of world?.pickups ?? []) {
                const item = PICKUP_ITEMS[p.tag];
                if (!item || inventory[item]) continue;
                const c0 = Math.floor(p.rect.x / lattice) - 1;
                const c1 = Math.ceil(p.rect.right / lattice);
                const r0 = Math.floor(p.rect.y / lattice) - 1;
                const r1 = Math.ceil(p.rect.bottom / lattice);
                let touched = false;
                for (let cy = r0; cy <= r1 && !touched; cy += 1) {
                    for (let cx = c0; cx <= c1 && !touched; cx += 1) {
                        if (result.seen.has(`${level}:${cx},${cy}`)) touched = true;
                    }
                }
                if (!touched) continue;
                if (p.tag === 'bosskey') {
                    // A key is a SET member, not a boolean: five are placed
                    // and each opens only its own `keyType`. And it is the
                    // one pickup that turns no persistence flag off
                    // (`BossKey.removed()` skips `super.removed()`).
                    const kt = keyTypeAt.get(`${level}:${p.x},${p.y}`);
                    if (kt === undefined || inventory.keys.has(kt)) continue;
                    inventory.keys.add(kt);
                    gained.push({ item: `key${kt}`, level, tag: p.tag, round });
                    changed = true;
                    continue;
                }
                inventory[item] = true;
                gained.push({ item, level, tag: p.tag, round });
                changed = true;
            }
        }
        for (const enc of ENCOUNTER_ITEMS) {
            if (inventory[enc.item]) continue;
            if (!reachedLevels.has(enc.at.level)) continue;
            if ((enc.needs ?? []).some((n) => !inventory[n])) continue;
            inventory[enc.item] = true;
            gained.push({ item: enc.item, level: enc.at.level, tag: '(encounter)', round });
            changed = true;
        }
        if (!changed || round > 12) break;
    }

    const reachedLevels = [...new Set([...result.seen]
        .filter((k) => !k.startsWith('exit:'))
        .map((k) => Number(k.split(':')[0])))].sort((a, b) => a - b);
    console.log(`${round} fixed-point rounds, ${reachedLevels.length} levels reached, `
        + `${[...result.seen].filter((k) => !k.startsWith('exit:')).length} cells\n`);
    console.log('items:');
    for (const g of gained) {
        console.log(`   round ${g.round}  ${g.item.padEnd(15)} L${g.level} (${g.tag})`);
    }
    const ALL = [...Object.values(PICKUP_ITEMS), ...ENCOUNTER_ITEMS.map((e) => e.item)]
        .filter((i) => i !== 'bosskey');
    const missing = ALL.filter((i) => !inventory[i]);
    console.log(`\nreached ${ALL.length - missing.length}/${ALL.length}`
        + (missing.length ? `; MISSING: ${missing.join(', ')}` : ''));
    console.log(`\nlevels reached: ${reachedLevels.join(' ')}`);
    const unreached = [...Array(LEVEL_COUNT).keys()].filter((l) => !reachedLevels.includes(l));
    console.log(`levels NOT reached (${unreached.length}): ${unreached.join(' ')}`);
    console.log(`\npermissions taken in the final round (${permissions.length}):`);
    for (const p of permissions) console.log(`   ${p}`);
    if (result.assumed.size > 0) {
        console.log(`\nforced-contact permissions (${result.assumed.size}):`);
        for (const [k, v] of result.assumed) console.log(`   ${k} — ${v}`);
    }
    const stranded = result.arrivals.filter((a) => a.stranded);
    if (stranded.length > 0) {
        console.log(`\n⚠ arrivals with no standable neighbour (${stranded.length}):`);
        for (const a of stranded) console.log(`   L${a.level} via ${a.why}`);
    }
}

// ── --contact-audit ───────────────────────────────────────────────────

/**
 * The committed R4 route, replayed against R5's own volumes.
 *
 * R4's tapes were planned with `noDamage: true` and no enemy modelled at
 * all, so every leg is a claim about geometry and NONE of them is a claim
 * about contact. This reads the committed tapes' OWN observation streams —
 * the recordings, i.e. what the game did — and reports every observation
 * that stands inside an aggro disc or a static hazard volume.
 *
 * ⚠ THE RECORDING IS THE RIGHT INPUT, not a re-plan. The question is not
 * "would a re-planned route be clear" (that is the R5 planner's job); it
 * is "how much of R4's committed walk does arming `noDamage` invalidate",
 * which is a fact about the walk that happened.
 */
async function runContactAudit() {
    const { loadTape, fixtureNames } = await import(join(MODULE, 'fixtures', 'index.js'));
    const EXPECT = join(MODULE, 'fixtures', 'expectations');
    const tapes = (opt('tapes') ?? fixtureNames().filter((n) => n.startsWith('r4-walk-')).join(','))
        .split(',').filter(Boolean);
    console.log('## the R4 route vs R5\'s volumes — every leg that arms a wake\n');

    for (const name of tapes) {
        let expectation;
        try {
            expectation = JSON.parse(readFileSync(join(EXPECT, `${name}.json`), 'utf8'));
        } catch {
            console.log(`  ${name}: no committed recording — skipped`);
            continue;
        }
        const ticks = expectation.ticks ?? [];
        const hits = new Map();
        for (let t = 0; t < ticks.length; t += 1) {
            const o = ticks[t];
            const rec = source(o.level);
            const c = censusOf(rec);
            for (const e of c.enemies) {
                const disc = combat.aggroDisc(e.tag, e.cx, e.cy);
                if (!disc) continue;
                const d = Math.hypot(o.x - disc.x, o.y - disc.y);
                if (d > disc.r) continue;
                const key = `L${o.level} ${e.tag}@${e.x},${e.y}`;
                const prev = hits.get(key);
                if (!prev) {
                    hits.set(key, { first: t, last: t, min: d, r: disc.r, counted: e.counted });
                } else {
                    prev.last = t;
                    prev.min = Math.min(prev.min, d);
                }
            }
        }
        console.log(`  ${name}: ${ticks.length} observations, ${hits.size} wakes`);
        for (const [key, h] of [...hits].sort((a, b) => a[1].first - b[1].first)) {
            console.log(`      t${String(h.first).padStart(5)}..${String(h.last).padStart(5)}`
                + `  ${key.padEnd(34)} closest ${h.min.toFixed(1)} of ${h.r}`
                + (h.counted ? '  COUNTED' : ''));
        }
    }
}

// ── --encounters ──────────────────────────────────────────────────────

/**
 * The R4 route through the ENCOUNTER LADDER (§3.2 as amended 2026-08-03).
 *
 * `--contact-audit` answers "how many wakes does arming `noDamage` create";
 * this answers the question the amendment asks instead: **what does each one
 * COST**. Every crossing is priced on the ladder — path-avoid, wake-and-
 * thread, kill, hard-avoid — from the committed recording, with the camera
 * track and the chase envelope.
 *
 * ⚠ The recording is again the right input, and for the same reason: the
 * question is what arming `noDamage` does to the walk that happened, not
 * what a re-planned walk would look like. §8.6's fifteen wakes are the
 * FLOOR on the re-route bill; this says how much of that floor is real.
 */
async function runEncounters() {
    const { loadExpectation } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { fixtureNames } = await import(join(MODULE, 'fixtures', 'index.js'));
    const encounters = await import(join(MODULE, 'encounters.js'));
    const { cameraTrack } = await import(join(MODULE, 'camera.js'));

    const tapes = (opt('tapes') ?? fixtureNames().filter((n) => n.startsWith('r4-walk-'))
        .filter((n) => n !== 'r4-walk-full').join(',')).split(',').filter(Boolean);

    const worldCache = new Map();
    const worldFor = (level) => {
        if (!worldCache.has(level)) {
            try {
                worldCache.set(level, buildLevelWorld(source(level), { roles: ROLES }));
            } catch (e) {
                worldCache.set(level, { error: e.message });
            }
        }
        return worldCache.get(level);
    };

    console.log('## the R4 route on the ENCOUNTER LADDER — what each wake COSTS\n');
    const totals = {};
    const allVerdicts = [];
    for (const name of tapes) {
        let stream;
        try { stream = loadExpectation(name).stream; } catch {
            console.log(`  ${name}: no committed recording — skipped`);
            continue;
        }
        const ticks = stream.ticks ?? [];
        const cam = cameraTrack(ticks, (l) => worldFor(l).world ?? { width: 160, height: 160 });
        const camByTick = new Map(cam.map((c) => [c.t, c]));
        const cameraAt = (t) => camByTick.get(t) ?? null;
        const levels = [...new Set(ticks.map((o) => o.level))];
        const perTape = [];
        for (const level of levels) {
            const world = worldFor(level);
            if (world.error) {
                console.log(`  ⚠ L${level}: ${world.error.slice(0, 90)}`);
                continue;
            }
            if (world.combat.enemies.length === 0 && world.combat.hazards.length === 0) continue;
            // A kill lock in the level puts every counted instance on the
            // bill regardless of what the crossing costs.
            const mustClear = new Set(world.combat.killLocks.length > 0
                ? world.combat.bill.map((e) => `${e.tag}@${e.x},${e.y}`) : []);
            const plan = encounters.encounterPlan(ticks, world, { cameraAt, mustClear });
            perTape.push(...plan.verdicts);
        }
        perTape.sort((a, b) => a.from - b.from);
        allVerdicts.push(...perTape);
        console.log(`  ${name}: ${ticks.length} observations, ${perTape.length} crossings`);
        for (const v of perTape) {
            totals[v.rung] = (totals[v.rung] ?? 0) + 1;
            const mark = { 'wake-and-thread': '✓', kill: '⚔', 'hard-avoid': '⛔' }[v.rung] ?? ' ';
            console.log(`      ${mark} t${String(v.from).padStart(5)}..${String(v.to).padStart(5)}`
                + `  L${String(v.level).padStart(3)} ${`${v.tag}@${v.x},${v.y}`.padEnd(24)}`
                + `  ${v.rung.padEnd(16)}`
                + (v.clearance !== undefined ? ` clearance ${String(v.clearance).padStart(7)} px` : '')
                + (v.presses ? `  ${v.presses} presses` : ''));
            console.log(`          ${v.why}`);
        }
        console.log();
    }
    const inst = (v) => `L${v.level} ${v.tag}@${v.x},${v.y}`;
    console.log(`## the bill: ${allVerdicts.length} crossings over `
        + `${new Set(allVerdicts.map(inst)).size} distinct instances`);
    for (const [rung, n] of Object.entries(totals)) console.log(`   ${rung.padEnd(18)} ${n}`);

    // ⛓ THE THREE PILES, AND ONLY THE FIRST IS A FLOOR. A verdict's `basis`
    // says whether the instrument DECIDED or DEFERRED, and reporting one
    // number for both would make an over-approximation look like a finding.
    const proven = allVerdicts.filter((v) => v.proven === true);
    const deferred = allVerdicts.filter((v) => v.basis === 'envelope-undecided'
        || v.basis === 'phase-not-yet-pinned' || v.basis === 'no-body-proof');
    const cleared = allVerdicts.filter((v) => v.rung === 'wake-and-thread');
    const locked = allVerdicts.filter((v) => v.basis === undefined && v.rung === 'kill');
    const show = (title, rows) => {
        console.log(`\n${title} — ${rows.length} crossing(s), `
            + `${new Set(rows.map(inst)).size} instance(s)`);
        for (const k of [...new Set(rows.map(inst))]) console.log(`   ${k}`);
    };
    show('⛔ PROVEN CONTACT (the re-route FLOOR — a static\'s own body, no approximation)',
        proven);
    show('✓ PROVEN CONTACT-FREE by the envelope (rung 2, no re-route, no press)', cleared);
    show('⚔ DEMANDED by a kill lock (rung 3 whatever the crossing costs)', locked);
    show('… DEFERRED — the instrument could not decide; slice 3\'s exact transcriptions do',
        deferred);
}

// ── main ──────────────────────────────────────────────────────────────

if (flag('census')) runCensus();
else if (flag('encounters')) await runEncounters();
else if (flag('kill-locks')) runKillLocks();
else if (flag('flood')) await runFlood();
else if (flag('contact-audit')) await runContactAudit();
else {
    console.log('usage: recon-seedling-r5.mjs --census | --kill-locks | '
        + '--contact-audit | --flood | --windows');
    process.exitCode = 2;
}
