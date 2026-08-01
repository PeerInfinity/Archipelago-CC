/**
 * seedlingDemo/r1Acceptance — R1's terminal assertion and its segment
 * chain, as pure functions over what the GAME reported.
 *
 * ⚠ WHY THIS IS A MODULE AND NOT TWENTY LINES IN THE VERIFY SCRIPT.
 * The rung's claim is "eleven of the thirteen non-combat items, and these
 * three are blocked" — and a claim that only ever runs against a passing
 * eleven-minute replay is a claim nobody has ever seen FAIL. A check that
 * has never failed is indistinguishable from a check that cannot. So the
 * logic lives here, takes the game's `botStatus` and observation stream as
 * data, and reports findings rather than printing them; `r1Acceptance.test.js`
 * then mutates each input in turn and asserts the corresponding check goes
 * red, in CI, in milliseconds.
 *
 * The verify script supplies the real inputs. Nothing here reads the JS
 * inventory mirror: the mirror supplies the EXPECTATION elsewhere (which
 * tick a grant fires on, which properties follow), and the game supplies
 * the ANSWER. Reading the mirror for both would be the mirror agreeing with
 * itself.
 *
 * Dependency-free, like the other core modules — the route, the specs and
 * the replayed results all arrive as arguments.
 */

import { ITEM_PROPERTIES } from './tapeFormat.js';
import { R1_FULL_WALK_NAME, R1_SEGMENT_NAMES } from './r1Walk.js';

/** The ten booleans R1 claims, in the order the rung publishes them. */
export const R1_CLAIMED_ITEMS = Object.freeze([
    'sword', 'darksword', 'shield', 'darkshield', 'wand',
    'conch', 'feather', 'spear', 'darksuit', 'torch',
]);

/**
 * The published blocked list. All three are ENEMY-shaped and all three land
 * at R5 — `fire` is combat-gated by construction, `ghostsword` sits behind
 * L98's ice turret (whose 128 px range covers its whole entrance room, the
 * only door into Dungeon 8), and `firewand` behind L108's darksuit-gated
 * lavatrap ferry.
 */
export const R1_BLOCKED_ITEMS = Object.freeze(['fire', 'ghostsword', 'firewand']);

/** `hitsMax` after `health`: `Player.hitsMaxDef` is 3 and health ADDS 1. */
export const R1_HITS_MAX = 4;

const prop = (item) => ITEM_PROPERTIES[item]?.property;

/**
 * R1's terminal assertion over ONE replayed headline walk.
 *
 * @param {object} route   the committed `r1-route.json`
 * @param {object} result  `{stream, status}` as the harness drained them
 * @returns {Array<{name: boolean|string, ok: boolean, detail: string}>}
 */
export function r1HeadlineFindings(route, { stream, status }) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });

    const missing = R1_CLAIMED_ITEMS.filter((i) => status.items?.[prop(i)] !== true);
    add('R1 headline walk: 10 item booleans true and hitsMax == 4',
        missing.length === 0 && status.items?.hitsMax === R1_HITS_MAX,
        missing.length > 0
            ? `the game reports false for: ${missing.join(', ')}`
            : `all ten true, hitsMax=${status.items.hitsMax} — 11 of the 13 non-combat `
            + 'items');

    // A build that granted everything would sail through the positives.
    const leaked = R1_BLOCKED_ITEMS.filter((i) => status.items?.[prop(i)] !== false);
    add('R1 headline walk: the published blocked list is still false',
        leaked.length === 0,
        leaked.length > 0 ? `the game reports true for: ${leaked.join(', ')}`
            : `${R1_BLOCKED_ITEMS.join(', ')} — all three enemy-shaped, all three R5`);

    // An unfired grant is a route claim that stopped being true. Counted on
    // the GAME's side, where nothing can throw first.
    add("R1 headline walk: every one of the route's grants fired",
        (status.grants?.length ?? -1) === route.grants.length,
        `${status.grants?.length ?? 'no'} grant(s) fired, route declares `
        + `${route.grants.length}`);

    // Quantitative pins — every positional claim is satisfiable by a bot
    // that teleports, and these are not.
    const entered = new Set((stream.ticks ?? []).map((o) => o.level));
    const declared = new Set(route.legs.map((l) => l.level));
    const never = [...declared].filter((l) => !entered.has(l));
    const extra = [...entered].filter((l) => !declared.has(l));
    add("R1 headline walk: the game entered exactly the route's levels",
        never.length === 0 && extra.length === 0,
        never.length > 0 || extra.length > 0
            ? `${never.length ? `never entered ${never.join(', ')}; ` : ''}`
            + `${extra.length ? `entered unplanned ${extra.join(', ')}` : ''}`
            : `${entered.size} levels, exactly as planned`);

    const falls = route.legs.filter((l) => l.exit?.pit).length;
    add('R1 headline walk: crossings, including the pit falls',
        (stream.transitions?.length ?? -1) === route.legs.length - 1,
        `${stream.transitions?.length ?? 'no'} crossing(s) derived from the game's own `
        + `level field, ${route.legs.length - 1} legs to leave, ${falls} of them falls`);

    add('R1 headline walk: no dialogue auto-advance and no ceremony',
        status.saw_auto_advance === 0 && status.menu === false
            && (status.cutscene ?? []).every((c) => c === false),
        `saw_auto_advance=${status.saw_auto_advance}, menu=${status.menu}, `
        + `cutscene=${JSON.stringify(status.cutscene)}`);

    return found;
}

/**
 * The SEGMENT CHAIN: each segment must end where the next one boots.
 *
 * ⚠ This is what lets six recordings stand in for one eleven-minute one. Six
 * tapes that each start wherever they like and each end wherever they get to
 * are six unrelated walks — so the chain is asserted four ways, all from the
 * GAME's own reports: level, position, item set and `hitsMax`. Delete a
 * segment and the neighbours stop meeting.
 *
 * @param {object} route
 * @param {Array}  specs     `r1TapeSpecs(route)`
 * @param {Map}    replayed  name -> `{stream, status}`
 */
export function r1ChainFindings(route, specs, replayed) {
    const found = [];
    const add = (name, ok, detail) => found.push({ name, ok, detail });
    const bySpec = new Map(specs.map((s) => [s.name, s]));

    R1_SEGMENT_NAMES.forEach((name, i) => {
        const here = replayed.get(name);
        if (!here) return;
        const last = here.stream.ticks[here.stream.ticks.length - 1];
        const nextName = R1_SEGMENT_NAMES[i + 1];
        if (!nextName) {
            const endLevel = route.legs[route.legs.length - 1].level;
            add(`R1 chain: ${name} is the last segment and ends in level ${endLevel}`,
                last.level === endLevel,
                `the game ended in level ${last.level} at (${last.x},${last.y})`);
            return;
        }
        const next = bySpec.get(nextName);
        const there = replayed.get(nextName);
        if (!next || !there) return;

        const wantX = next.boot.x + 8;
        const wantY = next.boot.y + 8;
        add(`R1 chain: ${name} ends exactly where ${nextName} boots`,
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
        add(`R1 chain: ${name} ends holding exactly what ${nextName} inherits`,
            held === inheritedProps,
            `ended holding [${held}]; ${nextName}'s boot grant names [${inheritedProps}]`);

        // ⚠ `health` ADDS, so it cannot ride on the boolean comparison — and
        // it is precisely the one a re-grant would silently inflate.
        const wantHits = 3 + (inherited.includes('health') ? 1 : 0);
        add(`R1 chain: ${name} ends with the hitsMax ${nextName} boots at`,
            here.status.items?.hitsMax === wantHits,
            `ended with hitsMax=${here.status.items?.hitsMax}; ${nextName} inherits `
            + `${inherited.includes('health') ? 'health' : 'no health'}, so it boots at `
            + `${wantHits}`);
    });
    return found;
}

/**
 * Everything R1 asserts about a sweep, or a named SKIP when the sweep did
 * not replay enough of it. A partial `--only` run must not quietly report
 * nothing at all — "the chain was not checked" is information.
 */
export function r1AcceptanceFindings(route, specs, replayed) {
    const found = [];
    const full = replayed.get(R1_FULL_WALK_NAME);
    if (full) {
        found.push(...r1HeadlineFindings(route, full));
    } else {
        // ⚠ ALWAYS SAY SO. R2 added `--tier=fast`, whose whole purpose is to
        // leave the long tapes out — and with them out, this function used
        // to return NOTHING for the headline and nothing for the chain,
        // so the run printed "ALL CHECKS PASSED" without ever mentioning
        // that R1's claim had not been looked at. A bounded sweep that does
        // not name what it bounded reads exactly like a complete one.
        found.push({
            name: `R1 headline walk: SKIPPED — this sweep did not replay ${R1_FULL_WALK_NAME}`,
            ok: true,
            detail: 'run --tier=full (or --only) to assert the eleven-item claim',
            skipped: true,
        });
    }

    const have = R1_SEGMENT_NAMES.filter((n) => replayed.has(n));
    if (have.length === R1_SEGMENT_NAMES.length) {
        found.push(...r1ChainFindings(route, specs, replayed));
    } else {
        found.push({
            name: 'R1 chain: SKIPPED — the chain needs all six segments',
            ok: true,
            detail: `this sweep replayed ${have.length} of ${R1_SEGMENT_NAMES.length}`
                + (have.length === 0 ? ' — run --tier=full to assert the partition' : ''),
            skipped: true,
        });
    }
    return found;
}
