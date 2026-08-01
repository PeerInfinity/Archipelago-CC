/**
 * seedlingDemo/r2Acceptance — R2's terminal claim and its segment chain, as
 * pure functions over what the GAME reported.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT TWENTY LINES IN THE VERIFY SCRIPT.
 * The rung's claim is "eight of the thirteen non-combat items with the
 * SOLIDS BACK, `hitsMax` still 3, and these six are blocked by these named
 * entities" — and a claim that only ever runs against a passing
 * twenty-minute replay is a claim nobody has ever seen FAIL. A check that
 * has never failed is indistinguishable from a check that cannot. So the
 * logic lives here, takes the game's `botStatus` and observation stream as
 * data, and reports findings rather than printing them; `r2Acceptance.test.js`
 * then mutates each input in turn and asserts the corresponding check goes
 * red, in CI, in milliseconds.
 *
 * Nothing here reads the JS inventory mirror. The mirror supplies the
 * EXPECTATION elsewhere (which tick a grant fires on, which properties
 * follow); the game supplies the ANSWER. Reading the mirror for both would
 * be the mirror agreeing with itself.
 *
 * Dependency-free, like the other core modules — the route, the specs and
 * the replayed results all arrive as arguments.
 */

import { ITEM_PROPERTIES } from './tapeFormat.js';
import {
    R2_BLOCKED, R2_FULL_WALK_NAME, R2_HITS_MAX, R2_HOLD_TICKS, R2_HOLD_WITNESS,
    R2_ITEM_ROOMS, R2_SEGMENT_NAMES,
} from './r2Walk.js';

/** The eight booleans R2 claims, in the order the rung publishes them. */
export const R2_CLAIMED_ITEMS = Object.freeze(R2_ITEM_ROOMS.flatMap((r) => [...r.items]));

/** The published blocked list, item names only. Each seal is in `R2_BLOCKED`. */
export const R2_BLOCKED_ITEMS = Object.freeze(R2_BLOCKED.map((b) => b.item));

const prop = (item) => ITEM_PROPERTIES[item]?.property;

const overlaps = (box, rect) => box.x < rect.right && rect.x < box.right
    && box.y < rect.bottom && rect.y < box.bottom;

/**
 * The player's box at an observation, from the ONE hitbox both engines use.
 *
 * Duplicated as four numbers rather than imported so this module stays
 * dependency-free — and pinned against `playerPhysicsV2.playerBoxAt` by a
 * test, because a box that has silently drifted would make every volume
 * claim below a claim about nothing.
 */
export const PLAYER_BOX = Object.freeze({ originX: 2, originY: 2, width: 4, height: 5 });

const boxAt = (o) => ({
    x: o.x - PLAYER_BOX.originX,
    y: o.y - PLAYER_BOX.originY,
    right: o.x - PLAYER_BOX.originX + PLAYER_BOX.width,
    bottom: o.y - PLAYER_BOX.originY + PLAYER_BOX.height,
});

/**
 * The longest run of consecutive observations in which the player did not
 * move AND their box was inside `rect`, in `level`.
 *
 * ⚠ DERIVED FROM THE GAME'S OWN STREAM, not from the tape's hold record.
 * The driver knows which ticks it meant to hold; the question this answers
 * is whether the GAME spent them standing on the button. Reading the
 * driver's own bookkeeping would be the driver agreeing with itself.
 */
export function longestStationaryHold(ticks, level, rect) {
    let best = { length: 0, from: null, to: null };
    let run = 0;
    let start = null;
    for (let i = 0; i < ticks.length; i++) {
        const o = ticks[i];
        const prev = ticks[i - 1];
        const inside = o.level === level && overlaps(boxAt(o), rect);
        const still = prev && prev.x === o.x && prev.y === o.y && prev.level === o.level;
        if (inside && still) {
            if (run === 0) start = i - 1;
            run += 1;
            if (run > best.length) best = { length: run, from: start, to: i };
        } else {
            run = 0;
        }
    }
    return best;
}

/**
 * R2's terminal assertion over ONE replayed headline walk.
 *
 * @param {object} route   the committed `r2-route.json`
 * @param {object} result  `{stream, status}` as the harness drained them
 * @returns {Array<{name: string, ok: boolean, detail: string}>}
 */
export function r2HeadlineFindings(route, { stream, status }) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const ticks = stream.ticks ?? [];

    const missing = R2_CLAIMED_ITEMS.filter((i) => status.items?.[prop(i)] !== true);
    add('R2 headline walk: 8 item booleans true, with the solids back',
        missing.length === 0,
        missing.length > 0
            ? `the game reports false for: ${missing.join(', ')}`
            : `${R2_CLAIMED_ITEMS.join(', ')} — 8 of the 13 non-combat items`);

    // ⚠ A SEPARATE CHECK, AND A NEGATIVE ONE. `Player.hitsMaxDef` is 3 and
    // `health` ADDS 1, so this asserts an item was NOT collected — R1's walk
    // ended at 4 and R2's must end at 3. Folded into the line above it would
    // be satisfiable by a run that collected health and lost a boolean
    // somewhere else; on its own it is the one claim in the readout that
    // only a missing grant can satisfy.
    add(`R2 headline walk: hitsMax is still its base ${R2_HITS_MAX} — health was NOT `
        + 'collected',
        status.items?.hitsMax === R2_HITS_MAX,
        `hitsMax=${status.items?.hitsMax}; ${R2_HITS_MAX} is Player.hitsMaxDef and health `
        + 'is the only thing that adds to it, so 4 would mean a grant fired for a room '
        + 'this walk never enters');

    // A build that granted everything would sail through the positives.
    //
    // ⚠ `health` IS NOT A BOOLEAN, and the first cut of this line reported
    // it leaked on every single run — `ITEM_PROPERTIES.health` is
    // `{kind: 'add', property: 'hitsMax', base: 3}`, so `!== false` is true
    // of the number 3. Blocked, for an adding item, means the property is
    // still its BASE, which is the same fact the hitsMax check states on
    // its own and is worth stating from both directions.
    const leaked = R2_BLOCKED.filter((b) => {
        const spec = ITEM_PROPERTIES[b.item];
        const got = status.items?.[spec?.property];
        return spec?.kind === 'add' ? got !== spec.base : got !== false;
    });
    add('R2 headline walk: the published blocked list is still false',
        leaked.length === 0,
        leaked.length > 0 ? `the game reports true for: ${leaked.map((b) => b.item).join(', ')}`
            : R2_BLOCKED.map((b) => `${b.item} (${b.rung})`).join(', '));

    // An unfired grant is a route claim that stopped being true. Counted on
    // the GAME's side, where nothing can throw first.
    add("R2 headline walk: every one of the route's grants fired",
        (status.grants?.length ?? -1) === route.grants.length,
        `${status.grants?.length ?? 'no'} grant(s) fired, route declares `
        + `${route.grants.length}`);

    // ── the HOLD, from the game's own observations ────────────────────
    // Two halves, and neither is worth anything alone. The first says the
    // game spent 101 consecutive ticks standing still on the button; the
    // second says it later walked through where the lock stood. A run that
    // held and never moved satisfies only the first; a lock that was never
    // solid satisfies only the second.
    const hold = longestStationaryHold(ticks, R2_HOLD_WITNESS.level,
        R2_HOLD_WITNESS.button);
    add(`R2 headline walk: the game stood still on ${R2_HOLD_WITNESS.presser} for at `
        + `least ${R2_HOLD_TICKS} consecutive ticks`,
        hold.length >= R2_HOLD_TICKS,
        hold.length > 0
            ? `${hold.length} tick(s), observations ${hold.from}-${hold.to}`
            : 'the game never stood still inside the button volume at all');

    const through = ticks.filter((o, i) => o.level === R2_HOLD_WITNESS.level
        && i > (hold.to ?? -1) && overlaps(boxAt(o), R2_HOLD_WITNESS.lock));
    add(`R2 headline walk: and then walked THROUGH where ${R2_HOLD_WITNESS.lock_tag} `
        + 'stood',
        through.length > 0,
        through.length > 0
            ? `${through.length} observation(s) inside `
            + `[${R2_HOLD_WITNESS.lock.x},${R2_HOLD_WITNESS.lock.right}) x `
            + `[${R2_HOLD_WITNESS.lock.y},${R2_HOLD_WITNESS.lock.bottom}) after the hold`
            : 'the game never occupied the lock volume after the hold — either the lock '
            + 'never opened or the walk went another way');

    // ── quantitative pins ─────────────────────────────────────────────
    // Every positional claim is satisfiable by a bot that teleports, and
    // these are not.
    const entered = new Set(ticks.map((o) => o.level));
    const declared = new Set(route.legs.map((l) => l.level));
    const never = [...declared].filter((l) => !entered.has(l));
    const extra = [...entered].filter((l) => !declared.has(l));
    add("R2 headline walk: the game entered exactly the route's levels",
        never.length === 0 && extra.length === 0,
        never.length > 0 || extra.length > 0
            ? `${never.length ? `never entered ${never.join(', ')}; ` : ''}`
            + `${extra.length ? `entered unplanned ${extra.join(', ')}` : ''}`
            : `${entered.size} levels, exactly as planned`);

    const falls = route.legs.filter((l) => l.exit?.pit).length;
    add('R2 headline walk: crossings, including the pit falls',
        (stream.transitions?.length ?? -1) === route.legs.length - 1,
        `${stream.transitions?.length ?? 'no'} crossing(s) derived from the game's own `
        + `level field, ${route.legs.length - 1} legs to leave, ${falls} of them falls`);

    add('R2 headline walk: no dialogue auto-advance and no ceremony',
        status.saw_auto_advance === 0 && status.menu === false
            && (status.cutscene ?? []).every((c) => c === false),
        `saw_auto_advance=${status.saw_auto_advance}, menu=${status.menu}, `
        + `cutscene=${JSON.stringify(status.cutscene)}`);

    // ── the crutch, audited from the GAME's own array ─────────────────
    // `botStatus.persistence` is read back out of `Game`'s flags rather than
    // echoed from the tape, so this says the clears LANDED, not that the
    // tape asked for them.
    const applied = status.persistence ?? [];
    const wanted = route.persistence.map((c) => `${c.level}:${c.tag}`).sort();
    const got = applied.map((c) => `${c.level}:${c.tag}`).sort();
    const sameList = got.length === wanted.length && got.every((k, i) => k === wanted[i]);
    // ⚠ AND `cleared` MUST BE TRUE FOR EVERY ONE. `Bot.persistenceReadout`
    // computes it as `!Main.levelPersistence(level, tag)` — read back out of
    // the game rather than echoed from the tape — so this is the half that
    // says the flags actually went false. A readout that only agreed about
    // the LIST would go on saying "applied" if `botStart` never ran, which
    // is the one failure an audit surface exists to catch.
    const notCleared = applied.filter((c) => c.cleared !== true)
        .map((c) => `${c.level}:${c.tag}`);
    add('R2 headline walk: every persistence clear the route derived was applied, and '
        + 'the game reports each flag actually false',
        sameList && notCleared.length === 0,
        !sameList
            ? `the game reports ${got.length} clear(s), the route derives `
            + `${wanted.length}; game [${got.join(' ')}], route [${wanted.join(' ')}]`
            : (notCleared.length > 0
                ? `still TRUE in the game: ${notCleared.join(' ')}`
                : `${got.length} flag(s), each read back as false from Game's own array`));

    return found;
}

/**
 * The SEGMENT CHAIN: each segment must end where the next one boots.
 *
 * ⚠ This is what lets six recordings stand in for one twenty-minute one.
 * Six tapes that each start wherever they like and each end wherever they
 * get to are six unrelated walks — so the chain is asserted four ways, all
 * from the GAME's own reports: level, position, item set and `hitsMax`.
 * Delete a segment and the neighbours stop meeting.
 */
export function r2ChainFindings(route, specs, replayed) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const bySpec = new Map(specs.map((s) => [s.name, s]));

    R2_SEGMENT_NAMES.forEach((name, i) => {
        const here = replayed.get(name);
        if (!here) return;
        const last = here.stream.ticks[here.stream.ticks.length - 1];
        const nextName = R2_SEGMENT_NAMES[i + 1];
        if (!nextName) {
            const endLevel = route.legs[route.legs.length - 1].level;
            add(`R2 chain: ${name} is the last segment and ends in level ${endLevel}`,
                last.level === endLevel,
                `the game ended in level ${last.level} at (${last.x},${last.y})`);
            return;
        }
        const next = bySpec.get(nextName);
        const there = replayed.get(nextName);
        if (!next || !there) return;

        const wantX = next.boot.x + 8;
        const wantY = next.boot.y + 8;
        add(`R2 chain: ${name} ends exactly where ${nextName} boots`,
            last.level === next.boot.level && last.x === wantX && last.y === wantY,
            `the game ended at level ${last.level} (${last.x},${last.y}); ${nextName} `
            + `boots level ${next.boot.level} (${wantX},${wantY})`);

        // The next segment's inventory at ITS tick 0 is not directly
        // observable, but its FIRST GRANT is — that single boot-level entry
        // IS the inheritance — so the comparison is this segment's ending
        // items against the properties that entry names.
        const inherited = there.status.grants?.[0]?.items ?? [];
        const held = Object.entries(here.status.items ?? {})
            .filter(([k, v]) => v === true && k !== 'hitsMax')
            .map(([k]) => k).sort().join(',');
        const inheritedProps = inherited.map(prop)
            .filter((p) => p && p !== 'hitsMax').sort().join(',');
        add(`R2 chain: ${name} ends holding exactly what ${nextName} inherits`,
            held === inheritedProps,
            `ended holding [${held}]; ${nextName}'s boot grant names [${inheritedProps}]`);

        // ⚠ `hitsMax` is checked SEPARATELY, and at R2 it is a constant. R1
        // needed the sum because `health` rode the chain; here nothing adds
        // to it, so every boundary must report the base value — and a
        // boundary that reported 4 would be a grant nobody declared.
        add(`R2 chain: ${name} ends with hitsMax ${R2_HITS_MAX}`,
            here.status.items?.hitsMax === R2_HITS_MAX,
            `ended with hitsMax=${here.status.items?.hitsMax}; R2 collects no health, so `
            + `every boundary is ${R2_HITS_MAX}`);
    });
    return found;
}

/**
 * Everything R2 asserts about a sweep, or a named SKIP when the sweep did
 * not replay enough of it.
 *
 * ⚠ ALWAYS SAY SO. `--tier=fast` exists to leave the long tapes out, and a
 * findings list that came back EMPTY when they were left out would let a run
 * print ALL CHECKS PASSED without ever mentioning that the rung's claim had
 * not been looked at. That is not hypothetical: R2 slice 5a shipped exactly
 * that bug in `r1AcceptanceFindings` and found it within minutes. A bounded
 * sweep that does not name what it bounded reads exactly like a complete one.
 */
export function r2AcceptanceFindings(route, specs, replayed) {
    const found = [];
    const full = replayed.get(R2_FULL_WALK_NAME);
    if (full) {
        found.push(...r2HeadlineFindings(route, full));
    } else {
        found.push({
            name: `R2 headline walk: SKIPPED — this sweep did not replay ${R2_FULL_WALK_NAME}`,
            ok: true,
            detail: 'run --tier=full (or --only) to assert the eight-item claim',
            skipped: true,
        });
    }

    const have = R2_SEGMENT_NAMES.filter((n) => replayed.has(n));
    if (have.length === R2_SEGMENT_NAMES.length) {
        found.push(...r2ChainFindings(route, specs, replayed));
    } else {
        found.push({
            name: 'R2 chain: SKIPPED — the chain needs all six segments',
            ok: true,
            detail: `this sweep replayed ${have.length} of ${R2_SEGMENT_NAMES.length}`
                + (have.length === 0 ? ' — run --tier=full to assert the partition' : ''),
            skipped: true,
        });
    }
    return found;
}
