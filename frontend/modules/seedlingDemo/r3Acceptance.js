/**
 * seedlingDemo/r3Acceptance — R3's terminal claim and its segment chain, as
 * pure functions over what the GAME reported.
 *
 * Same doctrine as `r1Acceptance` and `r2Acceptance`: the claim lives here
 * as data-in/findings-out, so `r3Acceptance.test.js` can mutate every input
 * and assert the matching check goes red — in CI, in milliseconds. A claim
 * that only ever runs against a passing twenty-minute replay is a claim
 * nobody has ever seen FAIL, and a check that has never failed is
 * indistinguishable from one that cannot.
 *
 * ── What R3 asserts that no earlier rung could ────────────────────────
 * R1 and R2 asked "which item booleans are true". Their answer was
 * produced by `grants` — a property write on room entry — so the readout
 * was really a report about `Bot.as`. R3 retires that, and the claim
 * splits in three:
 *
 *   1. the booleans are true                (as before)
 *   2. `grants` is EMPTY                    (so nothing wrote them)
 *   3. the persistence flags that are OFF are EXACTLY the declared
 *      exceptions, plus the one the TOUCH earned, plus the six the
 *      PICKUPS turned off — and nothing else
 *
 * The third is the one with teeth. `Bot.persistenceClearedAll()` scans
 * `Main.levelPersistence` rather than echoing the tape, so it reports flags
 * nobody asked about; an exact-set claim over it is the only thing that
 * distinguishes "the player did this" from "the tape did".
 *
 * Nothing here reads the JS inventory mirror. The mirror supplies the
 * EXPECTATION elsewhere; the game supplies the ANSWER.
 */

import { ITEM_PROPERTIES } from './tapeFormat.js';
import {
    R3_BLOCKED, R3_CLEARS, R3_FULL_WALK_NAME, R3_HITS_MAX, R3_ITEM_ROOMS,
    R3_SEGMENT_NAMES, R3_TOUCH,
} from './r3Walk.js';

/** The six booleans R3 claims, in collection order. */
export const R3_CLAIMED_ITEMS = Object.freeze(R3_ITEM_ROOMS.map((r) => r.item));

/** The published blocked list, item names only. Each seal is in `R3_BLOCKED`. */
export const R3_BLOCKED_ITEMS = Object.freeze(R3_BLOCKED.map((b) => b.item));

const prop = (item) => ITEM_PROPERTIES[item]?.property;
const flagKey = (level, tag) => `${level}:${tag}`;
const sortedKeys = (list) => [...list].sort().join(' ');

/**
 * Every persistence flag the run is ENTITLED to have turned off, by origin.
 *
 * Three sources, and keeping them apart is the whole ledger:
 *
 *   `declared`  the tape's own `persistence` — the named exceptions, each
 *               waiting on an opener a later rung builds
 *   `earned`    what `Lock.turnOff()` wrote when the player touched the
 *               shield lock
 *   `collected` what each pickup's `removed()` wrote when the player took it
 */
export function r3ExpectedClearedFlags() {
    const declared = R3_CLEARS.map((c) => flagKey(c.level, c.tag));
    const earned = [flagKey(R3_TOUCH.level, R3_TOUCH.tag)];
    const collected = R3_ITEM_ROOMS.map((r) => flagKey(r.level, r.tag));
    return { declared, earned, collected, all: [...declared, ...earned, ...collected] };
}

/**
 * R3's terminal assertion over ONE replayed headline walk.
 *
 * @param {object} route   the committed `r3-route.json`
 * @param {object} result  `{stream, status}` as the harness drained them
 * @returns {Array<{name: string, ok: boolean, detail: string}>}
 */
export function r3HeadlineFindings(route, { stream, status }) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const ticks = stream.ticks ?? [];

    const missing = R3_CLAIMED_ITEMS.filter((i) => status.items?.[prop(i)] !== true);
    add('R3 headline walk: 6 item booleans true, every one COLLECTED',
        missing.length === 0,
        missing.length > 0
            ? `the game reports false for: ${missing.join(', ')}`
            : `${R3_CLAIMED_ITEMS.join(', ')}`);

    // ⛔ THE RUNG, IN ONE LINE. Every boolean above went true because the
    // game ran a pickup's own `removed()`. A non-empty list here would mean
    // `Bot.as` wrote at least one of them, and the whole claim would be
    // about the bot rather than about the game.
    const grants = status.grants ?? [];
    add('R3 headline walk: the tape GRANTED NOTHING',
        grants.length === 0,
        grants.length === 0
            ? 'botStatus.grants is empty — every item above was walked onto and talked '
            + 'through'
            : `the game fired ${grants.length} grant(s): `
            + `${grants.map((g) => `L${g.level}:${[...g.items].join('+')}`).join(' ')}`);

    // ⚠ A SEPARATE, NEGATIVE CHECK. `Player.hitsMaxDef` is 3 and `health`
    // ADDS 1, so this asserts an item was NOT collected. Folded into the
    // line above it would be satisfiable by a run that took health and lost
    // a boolean somewhere else.
    add(`R3 headline walk: hitsMax is still its base ${R3_HITS_MAX} — health was NOT `
        + 'collected',
        status.items?.hitsMax === R3_HITS_MAX,
        `hitsMax=${status.items?.hitsMax}; health is the only thing that adds to it`);

    // A build that granted everything would sail through the positives.
    const leaked = R3_BLOCKED.filter((b) => {
        const spec = ITEM_PROPERTIES[b.item];
        const got = status.items?.[spec?.property];
        return spec?.kind === 'add' ? got !== spec.base : got !== false;
    });
    add('R3 headline walk: the published blocked list is still false',
        leaked.length === 0,
        leaked.length > 0
            ? `the game reports true for: ${leaked.map((b) => b.item).join(', ')}`
            : `${R3_BLOCKED_ITEMS.join(', ')} — each with its source-level seal`);

    // ── THE LEDGER ────────────────────────────────────────────────────
    // ⛔ AN EXACT SET, not a subset in either direction. A flag off that
    // nobody accounts for is a clear reaching further than intended; a flag
    // the model says should be off and is not is an opener that did not
    // fire. Both are silent under any weaker phrasing.
    const expected = r3ExpectedClearedFlags();
    const inGame = (status.persistence_cleared ?? []).map((c) => flagKey(c.level, c.tag));
    const want = sortedKeys(expected.all);
    const got = sortedKeys(inGame);
    const extra = inGame.filter((k) => !expected.all.includes(k));
    const absent = expected.all.filter((k) => !inGame.includes(k));
    add('R3 headline walk: the flags that are OFF are exactly declared + earned + '
        + 'collected',
        want === got,
        want === got
            ? `${expected.declared.length} declared, ${expected.earned.length} earned by `
            + `the touch, ${expected.collected.length} written by the pickups the player `
            + 'took'
            : `${extra.length ? `UNACCOUNTED off: ${extra.join(' ')}. ` : ''}`
            + `${absent.length ? `expected off but SET: ${absent.join(' ')}. ` : ''}`
            + `game [${got}], expected [${want}]`);

    // ⚠ AND THE EARNED ONE ON ITS OWN, because it is the only flag on that
    // list the tape did not ask for. Stated separately so a route that
    // quietly started declaring it cannot pass by way of the set above.
    const earnedKey = expected.earned[0];
    const declaredInTape = (route.persistence ?? [])
        .map((c) => flagKey(c.level, c.tag));
    add(`R3 headline walk: ${R3_TOUCH.lock.x},${R3_TOUCH.lock.y}'s flag was turned off `
        + 'by the PLAYER',
        inGame.includes(earnedKey) && !declaredInTape.includes(earnedKey),
        inGame.includes(earnedKey)
            ? (declaredInTape.includes(earnedKey)
                ? `the tape DECLARES ${earnedKey}, so the touch proves nothing`
                : `${earnedKey} is off and the tape never asked for it — `
                + '`Lock.turnOff()` wrote it')
            : `${earnedKey} is still SET: the shield lock never finished its fade`);

    // The touch REFUSES INPUT for its whole fade, and the game says so from
    // its own side. Without this the walk could have crossed a lock that
    // was never there.
    add('R3 headline walk: the game refused input, which only the touch does here',
        status.saw_input_refused === true,
        status.saw_input_refused
            ? 'receiveInput went false — the shield lock took the player over'
            : 'the game never refused input, so no shield lock ever activated');

    // Carried from R2: the win statics stay false until R6.
    add('R3 headline walk: the win statics are still false',
        status.menu === false && (status.cutscene ?? []).every((c) => c === false),
        `menu=${status.menu}, cutscene=${JSON.stringify(status.cutscene)}`);

    // Quantitative pins, so a walk that recorded nothing cannot pass.
    const endLevel = route.legs[route.legs.length - 1].level;
    const last = ticks[ticks.length - 1];
    add(`R3 headline walk: ends in level ${endLevel}`,
        last?.level === endLevel,
        `the game ended in level ${last?.level} at (${last?.x},${last?.y})`);
    add('R3 headline walk: crossed every boundary the route plans',
        (stream.transitions ?? []).length === route.legs.length - 1,
        `${(stream.transitions ?? []).length} crossing(s) for ${route.legs.length} legs`);
    return found;
}

/**
 * The SEGMENT CHAIN: each segment must end where the next one boots.
 *
 * ⚠ This is what lets six recordings stand in for one twenty-minute one.
 * Six tapes that each start wherever they like are six unrelated walks, so
 * the chain is asserted from the GAME's own reports: level, position, and
 * the item set — which at R3 is compared against the next segment's
 * INHERITANCE GRANT, the one place a segment is allowed one.
 */
export function r3ChainFindings(route, specs, replayed) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const bySpec = new Map(specs.map((s) => [s.name, s]));

    R3_SEGMENT_NAMES.forEach((name, i) => {
        const here = replayed.get(name);
        if (!here) return;
        const last = here.stream.ticks[here.stream.ticks.length - 1];
        const nextName = R3_SEGMENT_NAMES[i + 1];
        if (!nextName) {
            const endLevel = route.legs[route.legs.length - 1].level;
            add(`R3 chain: ${name} is the last segment and ends in level ${endLevel}`,
                last.level === endLevel,
                `the game ended in level ${last.level} at (${last.x},${last.y})`);
            return;
        }
        const next = bySpec.get(nextName);
        const there = replayed.get(nextName);
        if (!next || !there) return;

        const wantX = next.boot.x + 8;
        const wantY = next.boot.y + 8;
        add(`R3 chain: ${name} ends exactly where ${nextName} boots`,
            last.level === next.boot.level && last.x === wantX && last.y === wantY,
            `the game ended at level ${last.level} (${last.x},${last.y}); ${nextName} `
            + `boots level ${next.boot.level} (${wantX},${wantY})`);

        // ⚠ THE ONE PLACE A SEGMENT MAY GRANT. A segment is a SLICE of a
        // longer walk, so it boots holding what the segments before it
        // collected — and the single boot-level grant entry IS that
        // inheritance. The comparison is this segment's ENDING items
        // against the properties that entry names, which is what makes six
        // tapes one walk.
        const inherited = there.status.grants?.[0]?.items ?? [];
        const held = Object.entries(here.status.items ?? {})
            .filter(([k, v]) => v === true && k !== 'hitsMax')
            .map(([k]) => k).sort().join(',');
        const inheritedProps = inherited.map(prop)
            .filter((p) => p && p !== 'hitsMax').sort().join(',');
        add(`R3 chain: ${name} ends holding exactly what ${nextName} inherits`,
            held === inheritedProps,
            `ended holding [${held}]; ${nextName}'s boot grant names [${inheritedProps}]`);

        add(`R3 chain: ${name} ends with hitsMax ${R3_HITS_MAX}`,
            here.status.items?.hitsMax === R3_HITS_MAX,
            `ended with hitsMax=${here.status.items?.hitsMax}`);
    });

    // ⛔ THE PARTITION, which every weaker phrasing follows from. The six
    // segment tapes must sum to the headline TICK FOR TICK — a deleted
    // segment, a re-recorded one that drifted, or a boundary that moved all
    // fail here and nowhere else.
    const full = replayed.get(R3_FULL_WALK_NAME);
    const haveAll = R3_SEGMENT_NAMES.every((n) => replayed.has(n));
    if (full && haveAll) {
        const sum = R3_SEGMENT_NAMES
            .reduce((a, n) => a + replayed.get(n).stream.ticks.length - 1, 0);
        const headline = full.stream.ticks.length - 1;
        add('R3 chain: the six segments are a PARTITION of the headline',
            sum === headline,
            `segments sum to ${sum} tick(s), the headline is ${headline}`);
    }
    return found;
}

/**
 * Everything R3 asserts about a sweep, or a named SKIP when the sweep did
 * not replay enough of it.
 *
 * ⚠ ALWAYS SAY SO. `--tier=fast` exists to leave the long tapes out, and a
 * findings list that came back EMPTY when they were left out would let a
 * run print ALL CHECKS PASSED without ever mentioning that the rung's claim
 * had not been looked at.
 */
export function r3AcceptanceFindings(route, specs, replayed) {
    const found = [];
    const full = replayed.get(R3_FULL_WALK_NAME);
    if (full) {
        found.push(...r3HeadlineFindings(route, full));
    } else {
        found.push({
            name: `R3 headline walk: SKIPPED — this sweep did not replay `
                + `${R3_FULL_WALK_NAME}`,
            ok: true,
            detail: 'run --tier=full (or --only) to assert the six-item claim and the '
                + 'crutch ledger',
            skipped: true,
        });
    }
    const have = R3_SEGMENT_NAMES.filter((n) => replayed.has(n));
    if (have.length === R3_SEGMENT_NAMES.length) {
        found.push(...r3ChainFindings(route, specs, replayed));
    } else {
        found.push({
            name: 'R3 chain: SKIPPED — the chain needs all six segments',
            ok: true,
            detail: `this sweep replayed ${have.length} of ${R3_SEGMENT_NAMES.length}`
                + (have.length === 0 ? ' — run --tier=full to assert the partition' : ''),
            skipped: true,
        });
    }
    return found;
}
