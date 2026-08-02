/**
 * seedlingDemo/r4Acceptance — R4's terminal claim and its segment chain, as
 * pure functions over what the GAME reported.
 *
 * Same doctrine as `r1Acceptance`, `r2Acceptance` and `r3Acceptance`: the
 * claim lives here as data-in/findings-out, so `r4Acceptance.test.js` can
 * mutate every input and assert the matching check goes red — in CI, in
 * milliseconds. A claim that only ever runs against a passing twenty-minute
 * replay is a claim nobody has ever seen FAIL, and a check that has never
 * failed is indistinguishable from one that cannot.
 *
 * ── What R4 asserts that no earlier rung could ────────────────────────
 *
 * R3 retired `grants` and asserted an exact-set ledger over the persistence
 * flags. R4 keeps both and turns over the one claim on the ladder that was
 * always stated as a NEGATIVE:
 *
 *   1. the five booleans are true                  (as before)
 *   2. `grants` is EMPTY                           (as before)
 *   3. **`hitsMax == 4`, ON ITS OWN, AS A POSITIVE**
 *   4. the flags that are OFF are EXACTLY declared + earned + collected,
 *      where "earned" now has TWO mechanisms in it and one of them is a
 *      lightpole nobody aimed at
 *   5. `saw_auto_advance == 1` — the sword's Help, which is the first
 *      DIALOGUE claim on the ladder rather than a movement one
 *   6. `primary` and `inventory_slots` two-sided, on every tape
 *
 * ⚠ (3) IS CHECKED SEPARATELY FROM (1) and that is not tidiness. `health`
 * has no boolean — `ITEM_PROPERTIES.health` is `{kind: 'add'}` — so a run
 * that lost `hasSword` and gained health satisfies any check that sums the
 * two. R1, R2 and R3 all asserted `hitsMax === 3`, which was true because
 * the walk never entered the room; this is the same field with the opposite
 * burden of proof.
 *
 * Nothing here reads the JS inventory mirror. The mirror supplies the
 * EXPECTATION elsewhere; the game supplies the ANSWER.
 */

import { ITEM_PROPERTIES, inventorySlotsFor } from './tapeFormat.js';
import {
    R4_BLOCKED, R4_CLEARS, R4_EARNED, R4_EQUIP_SLOT, R4_FULL_WALK_NAME, R4_HITS_MAX,
    R4_HITS_MAX_BASE, R4_ITEM_ROOMS, R4_KEY_LOCK, R4_KEY_PICKUP, R4_NO_HAZARDS,
    R4_SEGMENT_NAMES,
} from './r4Walk.js';

/**
 * The BOOLEANS R4 claims, in collection order — FOUR of them.
 *
 * ⚠ The claim is FIVE ITEMS and four booleans, and the missing one is the
 * point: `health` has no boolean at all
 * (`ITEM_PROPERTIES.health` is `{kind: 'add', property: 'hitsMax'}`), so it
 * is claimed by `hitsMax == 4` on its own. A list that included it would be
 * a list with an undefined property in it, and a check that summed the two
 * would be satisfiable by trading one for the other.
 */
export const R4_CLAIMED_ITEMS = Object.freeze(
    R4_ITEM_ROOMS.filter((r) => ITEM_PROPERTIES[r.item].kind !== 'add').map((r) => r.item),
);

/** The published blocked list, item names only. Each seal is in `R4_BLOCKED`. */
export const R4_BLOCKED_ITEMS = Object.freeze(R4_BLOCKED.map((b) => b.item));

/**
 * How many `Help` arrivals the walk should produce.
 *
 * ⚠ ONE, AND IT IS A POSITIVE — the first claim on the ladder about the
 * DIALOGUE machinery rather than about movement. `Bot.as` counts a Help's
 * ARRIVAL and the counter is version-scoped to `tape_version >= 4`, so
 * every v<=3 tape still reports 0 and the fifty committed recordings stayed
 * byte-inert. The one Help an R4 walk raises is the SWORD's — `Help(3)`,
 * "Double tap to dash and swing", which `Sword.removed()` puts up.
 *
 * A zero here would mean the sword's ceremony did not complete the way the
 * game runs it; a two would mean a second Help nobody planned, which is a
 * dialogue the tape has to page and therefore ticks the stream does not
 * have.
 */
export const R4_AUTO_ADVANCES = 1;

const prop = (item) => ITEM_PROPERTIES[item]?.property;
const flagKey = (level, tag) => `${level}:${tag}`;
const sortedKeys = (list) => [...list].sort().join(' ');

/**
 * Every persistence flag the run is ENTITLED to have turned off, by origin.
 *
 * FOUR sources at R4, and keeping them apart is the whole ledger:
 *
 *   `declared`   the tape's own `persistence` — the named exceptions
 *   `earnedLock` `BossLock`'s fade completing, 80 ticks after the key stance
 *   `earnedPole` `lightpole@176,120`, TOGGLED by the third L65 push
 *   `collected`  what each pickup's `removed()` wrote when the player took it
 *
 * ⚠ THE TWO EARNED ONES ARE DIFFERENT MECHANISMS, and folding them would
 * make "which openers did this walk use" unanswerable from the ledger. One
 * is an errand; the other is a side effect the geometry made unavoidable.
 *
 * ⚠ AND THE BOSS KEY IS NOT IN `collected`. `BossKey.removed()` writes
 * `Player.hasKeySet` and does NOT call `super.removed()`, so it is the one
 * pickup on the ladder that turns no flag off. Six pickups are taken and
 * FIVE flags go off — which is exactly the kind of asymmetry an exact-set
 * claim exists to pin, and exactly the kind a count would paper over.
 */
export function r4ExpectedClearedFlags() {
    const declared = R4_CLEARS.map((c) => flagKey(c.level, c.tag));
    const earnedLock = R4_EARNED.filter((e) => e.level === R4_KEY_LOCK.level)
        .map((e) => flagKey(e.level, e.tag));
    const earnedPole = R4_EARNED.filter((e) => e.level !== R4_KEY_LOCK.level)
        .map((e) => flagKey(e.level, e.tag));
    const collected = R4_ITEM_ROOMS.map((r) => flagKey(r.level, r.tag));
    return {
        declared,
        earnedLock,
        earnedPole,
        collected,
        all: [...declared, ...earnedLock, ...earnedPole, ...collected],
    };
}

/**
 * R4's terminal assertion over ONE replayed headline walk.
 *
 * @param {object} route   the committed `r4-route.json`
 * @param {object} result  `{stream, status}` as the harness drained them
 * @returns {Array<{name: string, ok: boolean, detail: string}>}
 */
export function r4HeadlineFindings(route, { stream, status }) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const ticks = stream.ticks ?? [];

    const missing = R4_CLAIMED_ITEMS.filter((i) => status.items?.[prop(i)] !== true);
    add(`R4 headline walk: ${R4_CLAIMED_ITEMS.length} item booleans true, every one `
        + 'COLLECTED',
        missing.length === 0,
        missing.length > 0
            ? `the game reports false for: ${missing.join(', ')}`
            : `${R4_CLAIMED_ITEMS.join(', ')}`);

    // ⛔ THE RUNG, IN ONE LINE — carried from R3 unchanged. Every boolean
    // above went true because the game ran a pickup's own `removed()`.
    const grants = status.grants ?? [];
    add('R4 headline walk: the tape GRANTED NOTHING',
        grants.length === 0,
        grants.length === 0
            ? 'botStatus.grants is empty — every item above was walked onto and talked '
            + 'through'
            : `the game fired ${grants.length} grant(s): `
            + `${grants.map((g) => `L${g.level}:${[...g.items].join('+')}`).join(' ')}`);

    // ⛔ THE ONE CLAIM ON THE LADDER WHOSE TRUTH VALUE FLIPS. R1, R2 and R3
    // all asserted `hitsMax === 3` — a NEGATIVE, "the walk did not enter that
    // room". `health` is the only thing in the game that adds to it
    // (`HealthPickup.removed()`), so 4 means exactly one grant of it: 3 says
    // the collection silently failed and 5 says something granted it twice.
    //
    // ⚠ ON ITS OWN, never folded into the booleans above, because `health`
    // HAS no boolean — a run that lost `hasSword` and gained health would
    // satisfy any check that summed them.
    add(`R4 headline walk: hitsMax is ${R4_HITS_MAX} — health was COLLECTED, and this is `
        + `the first POSITIVE health claim on the ladder (base is ${R4_HITS_MAX_BASE})`,
        status.items?.hitsMax === R4_HITS_MAX,
        `hitsMax=${status.items?.hitsMax}; health is the only thing that adds to it, so `
        + `${R4_HITS_MAX_BASE} means the collection failed and `
        + `${R4_HITS_MAX + 1} means something granted it twice`);

    // A build that granted everything would sail through the positives.
    const leaked = R4_BLOCKED.filter((b) => {
        const spec = ITEM_PROPERTIES[b.item];
        const got = status.items?.[spec?.property];
        return spec?.kind === 'add' ? got !== spec.base : got !== false;
    });
    add('R4 headline walk: the published blocked list is still false',
        leaked.length === 0,
        leaked.length > 0
            ? `the game reports true for: ${leaked.map((b) => b.item).join(', ')}`
            : `${R4_BLOCKED_ITEMS.join(', ')} — each with its seal and its rung`);

    // ── THE LEDGER ────────────────────────────────────────────────────
    // ⛔ AN EXACT SET, not a subset in either direction. A flag off that
    // nobody accounts for is a clear reaching further than intended; a flag
    // the model says should be off and is not is an opener that did not
    // fire. Both are silent under any weaker phrasing.
    const expected = r4ExpectedClearedFlags();
    const inGame = (status.persistence_cleared ?? []).map((c) => flagKey(c.level, c.tag));
    const want = sortedKeys(expected.all);
    const got = sortedKeys(inGame);
    const extra = inGame.filter((k) => !expected.all.includes(k));
    const absent = expected.all.filter((k) => !inGame.includes(k));
    add('R4 headline walk: the flags that are OFF are exactly declared + earned + '
        + 'collected',
        want === got,
        want === got
            ? `${expected.declared.length} declared, ${expected.earnedLock.length} earned `
            + `by the boss lock, ${expected.earnedPole.length} earned by a lightpole the `
            + `push could not avoid, ${expected.collected.length} written by the pickups `
            + 'the player took — and NONE by the boss key, whose `removed()` does not '
            + 'call `super.removed()`'
            : `${extra.length ? `UNACCOUNTED off: ${extra.join(' ')}. ` : ''}`
            + `${absent.length ? `expected off but SET: ${absent.join(' ')}. ` : ''}`
            + `game [${got}], expected [${want}]`);

    // ⚠ AND THE TWO EARNED ONES ON THEIR OWN, because they are the only
    // flags on that list the tape did not ask for. Stated separately so a
    // route that quietly started declaring one cannot pass by way of the set
    // above — which is exactly what would happen if `L68 tag 0` were
    // declared: the lock would despawn before the walk reached it and the
    // key would open nothing.
    const declaredInTape = (route.persistence ?? []).map((c) => flagKey(c.level, c.tag));
    for (const e of R4_EARNED) {
        const key = flagKey(e.level, e.tag);
        add(`R4 headline walk: ${key} was turned off by the PLAYER (${e.by})`,
            inGame.includes(key) && !declaredInTape.includes(key),
            inGame.includes(key)
                ? (declaredInTape.includes(key)
                    ? `the tape DECLARES ${key}, so ${e.by} proves nothing`
                    : `${key} is off and the tape never asked for it — ${e.why}`)
                : `${key} is still SET: ${e.by} never wrote it`);
    }

    // ⚠ THE BOSS KEY'S ABSENCE, ASSERTED. `bosskey@48,64` carries no `tag`
    // attribute at all and `BossKey.removed()` does not call
    // `super.removed()`, so a flag for L67 turning off would mean the model
    // of that class is wrong — which would be invisible in the set above if
    // the set were ever loosened.
    add(`R4 headline walk: the boss key wrote NO persistence in L${R4_KEY_PICKUP.level}`,
        !inGame.some((k) => k.startsWith(`${R4_KEY_PICKUP.level}:`)),
        `L${R4_KEY_PICKUP.level} flags off: `
        + `[${inGame.filter((k) => k.startsWith(`${R4_KEY_PICKUP.level}:`)).join(' ')}] — `
        + '`BossKey.removed()` is `Player.hasKeySet(keyType, true)` and nothing else');

    // ⛔ THE FIRST DIALOGUE CLAIM ON THE LADDER. `Bot.as` counts a Help's
    // ARRIVAL, version-scoped to v4 so the fifty committed v<=3 recordings
    // still report 0. R4's walk raises exactly one: the sword's `Help(3)`.
    add(`R4 headline walk: saw_auto_advance == ${R4_AUTO_ADVANCES} — the sword's Help, `
        + 'counted as a POSITIVE',
        status.saw_auto_advance === R4_AUTO_ADVANCES,
        `saw_auto_advance=${status.saw_auto_advance}; 0 would mean the sword's ceremony `
        + 'did not run the way the game runs it, and more than one would mean a Help the '
        + 'route never planned to page');

    // ⚠ THE HAZARD SET IS PART OF THE CLAIM, not part of the setup. "Five
    // items" under a floor with the lava turned off is R3's claim, not this
    // one — so the tape's own `noHazards` is asserted here rather than
    // trusted from the spec that built it.
    const tapeHazards = [...(route.noHazards ?? [])].sort().join(',');
    const wantHazards = [...R4_NO_HAZARDS].sort().join(',');
    add(`R4 headline walk: the route runs under noHazards `
        + `[${[...R4_NO_HAZARDS].join(', ')}] — LAVA and ICE armed`,
        tapeHazards === wantHazards,
        `the route declares [${[...(route.noHazards ?? [])].join(', ')}]; a walk with `
        + 'lava coerced is R3\'s claim under a different name');

    // The equip, from the game's own side. Without it every press is a
    // sword slash: no Tile arm, no reach-2 push through a wall.
    add(`R4 headline walk: Main.primary is slot ${R4_EQUIP_SLOT} at the end`,
        status.primary === R4_EQUIP_SLOT,
        `the game reports primary=${status.primary}; `
        + '`Inventory.getItem` on an out-of-range slot is `undefined`, which `useItem` '
        + 'coerces to 0 — the sword — so a wrong slot is a SILENT downgrade');

    // Carried from R2: the win statics stay false until R6.
    add('R4 headline walk: the win statics are still false',
        status.menu === false && (status.cutscene ?? []).every((c) => c === false),
        `menu=${status.menu}, cutscene=${JSON.stringify(status.cutscene)}`);

    // ⚠ AND THE DROWN TIMER, which is the armed floor's own witness. It is
    // never reset off-hazard, so a non-zero value at the end means the walk
    // stood on water at some point and the eleven-tick budget started
    // running — which under this rung's floor policy is a route defect.
    add('R4 headline walk: drownTimer never started',
        (status.drown_timer ?? 0) === 0,
        `drown_timer=${status.drown_timer}; it is set to 10 on first contact and never `
        + 'reset off-hazard, so any non-zero value is a tick spent in water');

    // Quantitative pins, so a walk that recorded nothing cannot pass.
    const endLevel = route.legs[route.legs.length - 1].level;
    const last = ticks[ticks.length - 1];
    add(`R4 headline walk: ends in level ${endLevel}`,
        last?.level === endLevel,
        `the game ended in level ${last?.level} at (${last?.x},${last?.y})`);
    add('R4 headline walk: crossed every boundary the route plans',
        (stream.transitions ?? []).length === route.legs.length - 1,
        `${(stream.transitions ?? []).length} crossing(s) for ${route.legs.length} legs`);
    return found;
}

/**
 * The SEGMENT CHAIN: each segment must end where the next one boots.
 *
 * ⚠ This is what lets six recordings stand in for one twenty-minute one.
 * Six tapes that each start wherever they like are six unrelated walks, so
 * the chain is asserted from the GAME's own reports: level, position, the
 * item set — and at R4 the EQUIP too, because a segment that inherits the
 * spear must also inherit the selection or every press in it is a slash.
 */
export function r4ChainFindings(route, specs, replayed) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const bySpec = new Map(specs.map((s) => [s.name, s]));

    R4_SEGMENT_NAMES.forEach((name, i) => {
        const here = replayed.get(name);
        if (!here) return;
        const last = here.stream.ticks[here.stream.ticks.length - 1];
        const nextName = R4_SEGMENT_NAMES[i + 1];
        if (!nextName) {
            const endLevel = route.legs[route.legs.length - 1].level;
            add(`R4 chain: ${name} is the last segment and ends in level ${endLevel}`,
                last.level === endLevel,
                `the game ended in level ${last.level} at (${last.x},${last.y})`);
            // ⚠ AND THE LAST SEGMENT CARRIES THE HEADLINE'S OWN PAYOFF. The
            // shared-boundary rule strips a boundary leg's targets, and for
            // three rungs the last leg had none to strip; R4's has the boss
            // lock and health. So the final segment is asserted to have
            // taken it.
            add(`R4 chain: ${name} ends with hitsMax ${R4_HITS_MAX}`,
                here.status.items?.hitsMax === R4_HITS_MAX,
                `ended with hitsMax=${here.status.items?.hitsMax} — the final segment is `
                + 'the one that collects health, so a base value here means its last leg '
                + 'was stripped');
            return;
        }
        const next = bySpec.get(nextName);
        const there = replayed.get(nextName);
        if (!next || !there) return;

        const wantX = next.boot.x + 8;
        const wantY = next.boot.y + 8;
        add(`R4 chain: ${name} ends exactly where ${nextName} boots`,
            last.level === next.boot.level && last.x === wantX && last.y === wantY,
            `the game ended at level ${last.level} (${last.x},${last.y}); ${nextName} `
            + `boots level ${next.boot.level} (${wantX},${wantY})`);

        // ⚠ THE ONE PLACE A SEGMENT MAY GRANT. A segment is a SLICE of a
        // longer walk, so it boots holding what the segments before it
        // collected — and the single boot-level grant entry IS that
        // inheritance.
        const inherited = there.status.grants?.[0]?.items ?? [];
        const held = Object.entries(here.status.items ?? {})
            .filter(([k, v]) => v === true && k !== 'hitsMax')
            .map(([k]) => k).sort().join(',');
        const inheritedProps = inherited.map(prop)
            .filter((p) => p && p !== 'hitsMax').sort().join(',');
        add(`R4 chain: ${name} ends holding exactly what ${nextName} inherits`,
            held === inheritedProps,
            `ended holding [${held}]; ${nextName}'s boot grant names [${inheritedProps}]`);

        // ⚠ AND THE SELECTION IS CHAINED TOO, which R3 had no equivalent
        // of. A segment that boots holding the spear and does NOT select it
        // presses X as a sword — the Tile arm never runs, the reach-2 push
        // through a wall never happens, and every check but this one is
        // green.
        //
        // ⚠⚠ THE EXPECTATION IS DERIVED FROM THE ROUTE, NOT FROM THE SPEC'S
        // `relax.equips`, and the difference is a segment that equips
        // MID-RUN. `botStatus.primary` is the value at the END of a replay
        // and the spec's declaration is only its TICK-0 inheritance, so for
        // the segment that COLLECTS the spear the two disagree by
        // construction: it declares `[]` and it ends at slot 1. Reading the
        // declaration here made this check green for the wrong reason on
        // five segments and unable to go red on the sixth — and the fixture
        // in `r4Acceptance.test.js` derived its own `primary` the same way,
        // so the mutation table could not see it either. A verifier sharing
        // the generator's assumption, one field wide.
        //
        // The ROUTE knows: a segment ends selected iff the equip's leg is
        // one it covers.
        const equipLeg = (route.equips ?? [])[0]?.leg;
        const wantSlot = equipLeg !== undefined && equipLeg <= next.lastLeg
            ? R4_EQUIP_SLOT : 0;
        add(`R4 chain: ${nextName} ends with Main.primary at slot ${wantSlot}`,
            there.status.primary === wantSlot,
            `${nextName} reports primary=${there.status.primary}; the equip is on leg `
            + `${equipLeg} and this segment covers legs ${next.firstLeg}-${next.lastLeg}`);

        // ...and the INHERITANCE half, which is a claim about the TAPE
        // rather than about the replay: a segment booting after the equip
        // must declare it at tick 0, because there is no other way for a
        // selection to survive a segment boundary.
        const declaresBootEquip = (next.relax.equips ?? [])
            .some((e) => e.t === 0 && e.slot === R4_EQUIP_SLOT);
        add(`R4 chain: ${nextName} declares its inherited selection at tick 0`,
            next.inheritsEquip === declaresBootEquip,
            `inheritsEquip=${next.inheritsEquip}, tape declares `
            + `${JSON.stringify(next.relax.equips)}`);

        // ...and the slot ARRAY the game built, against what the items imply.
        const mirror = {};
        for (const item of inherited) mirror[prop(item)] = true;
        const wantSlots = inventorySlotsFor(mirror).join(',');
        add(`R4 chain: ${nextName}'s inventory_slots are what its grant implies`,
            (there.status.inventory_slots ?? []).join(',') === wantSlots,
            `game [${(there.status.inventory_slots ?? []).join(',')}], `
            + `addItemsFromSave order implies [${wantSlots}]`);

        // hitsMax stays at its BASE until the last segment, which is where
        // health is. A 4 anywhere earlier is health collected out of order.
        add(`R4 chain: ${name} ends with hitsMax ${R4_HITS_MAX_BASE}`,
            here.status.items?.hitsMax === R4_HITS_MAX_BASE,
            `ended with hitsMax=${here.status.items?.hitsMax}`);
    });

    // ⛔ THE PARTITION, which every weaker phrasing follows from. The six
    // segment tapes must sum to the headline TICK FOR TICK — a deleted
    // segment, a re-recorded one that drifted, or a boundary that moved all
    // fail here and nowhere else.
    const full = replayed.get(R4_FULL_WALK_NAME);
    const haveAll = R4_SEGMENT_NAMES.every((n) => replayed.has(n));
    if (full && haveAll) {
        const sum = R4_SEGMENT_NAMES
            .reduce((a, n) => a + replayed.get(n).stream.ticks.length - 1, 0);
        const headline = full.stream.ticks.length - 1;
        add(`R4 chain: the ${R4_SEGMENT_NAMES.length} segments are a PARTITION of the `
            + 'headline',
            sum === headline,
            `segments sum to ${sum} tick(s), the headline is ${headline}`);
    }
    return found;
}

/**
 * Everything R4 asserts about a sweep, or a named SKIP when the sweep did
 * not replay enough of it.
 *
 * ⚠ ALWAYS SAY SO. `--tier=fast` exists to leave the long tapes out, and a
 * findings list that came back EMPTY when they were left out would let a run
 * print ALL CHECKS PASSED without ever mentioning that the rung's claim had
 * not been looked at.
 */
export function r4AcceptanceFindings(route, specs, replayed) {
    const found = [];
    const full = replayed.get(R4_FULL_WALK_NAME);
    if (full) {
        found.push(...r4HeadlineFindings(route, full));
    } else {
        found.push({
            name: `R4 headline walk: SKIPPED — this sweep did not replay `
                + `${R4_FULL_WALK_NAME}`,
            ok: true,
            detail: 'run --tier=full (or --only) to assert the five-item claim, the '
                + 'positive hitsMax and the two earned clears',
            skipped: true,
        });
    }
    const have = R4_SEGMENT_NAMES.filter((n) => replayed.has(n));
    if (have.length === R4_SEGMENT_NAMES.length) {
        found.push(...r4ChainFindings(route, specs, replayed));
    } else {
        found.push({
            name: `R4 chain: SKIPPED — the chain needs all ${R4_SEGMENT_NAMES.length} `
                + 'segments',
            ok: true,
            detail: `this sweep replayed ${have.length} of ${R4_SEGMENT_NAMES.length}`
                + (have.length === 0 ? ' — run --tier=full to assert the partition' : ''),
            skipped: true,
        });
    }
    return found;
}
