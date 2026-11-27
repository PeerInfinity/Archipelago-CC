/**
 * ⛓ region-view-dedup — EQUIVALENCE of the replaced inline reachability copies (`CC/docs/region-map/dedup.md`).
 *
 * Each copy the slice replaced with `isRegionReachable` runs here AS IT WAS (`legacyReachabilityCopies.testkit.js`,
 * cut verbatim from the base) next to the helper, over a generated input space: every `regionReachability` value the
 * app writes and the ones it does not, `regionReachability` missing / null / an empty map, several players' snapshots,
 * missing and empty region names, and names that hit `Object.prototype` keys. Nothing is written by hand: each row
 * compares the two answers, and the counts are asserted so a shrunken space fails.
 *
 * The domain is a snapshot OBJECT for the copies that read `snapshot.regionReachability` (every caller returns early
 * on a null snapshot first: `exitUI.js:507`, `regions/index.js:194`, `regionUI.js:748`); a null / undefined snapshot is
 * in the space for the two `snapshot?.` copies in commonUI, which take whatever their callers hand them.
 *
 * The two LEFT-ALONE copies are measured too, the other way round: each must DIFFER from the helper, on exactly the
 * value the census names. If a later change makes one agree, this fails and the census line is stale.
 */
import { describe, it, expect } from 'vitest';
import { isRegionReachable } from './regionViewModel.js';
import * as legacy from './legacyReachabilityCopies.testkit.js';

const VALUES = [true, false, 'reachable', 'checked', 'unreachable', 'locked', 'Reachable', 'true', '', 0, 1, null,
    undefined, {}, []];
const NAMES = ['Hub', 'Other', '', undefined, null, '__proto__', 'constructor', 'toString', 'hasOwnProperty',
    'Menu Region', 'Ünïcode'];

/** Every snapshot shape: per player, the map missing / null / empty / each value on 'Hub' and 'Other'. */
function snapshots({ allowNull }) {
    const out = [];
    for (const player of [1, 2, 3]) {
        const base = { player, checkedLocations: [] };
        out.push({ ...base });
        out.push({ ...base, regionReachability: undefined });
        out.push({ ...base, regionReachability: null });
        out.push({ ...base, regionReachability: {} });
        for (const hub of VALUES) {
            for (const other of VALUES) {
                const rr = {};
                if (hub !== undefined) rr.Hub = hub;
                if (other !== undefined) rr.Other = other;
                // An own key that shadows a prototype name, on half the maps.
                if (player === 2) rr.constructor = hub;
                out.push({ ...base, regionReachability: rr });
            }
        }
        // A map with no prototype at all.
        out.push({ ...base, regionReachability: Object.assign(Object.create(null), { Hub: 'reachable', Other: true }) });
    }
    if (allowNull) out.push(null, undefined);
    return out;
}

const helper2 = (s, p, c) => [isRegionReachable(s, p), isRegionReachable(s, c)];

/** Each replaced site: its BEFORE, its AFTER (the helper, called as the site now calls it), and its domain. */
const SITES = [
    { site: 'exits/exitUI.js:596 (filter, parent)', arity: 1, before: legacy.exitFilterParent,
        after: (s, n) => isRegionReachable(s, n) },
    { site: 'exits/exitUI.js:614 (filter, connected)', arity: 1, before: legacy.exitFilterConnected,
        after: (s, n) => isRegionReachable(s, n) },
    { site: 'exits/exitUI.js:702 (accessibility sort, A)', arity: 2,
        before: (s, p, c) => legacy.exitSortA(s, { parentRegion: p, connectedRegion: c }), after: helper2 },
    { site: 'exits/exitUI.js:731 (accessibility sort, B)', arity: 2,
        before: (s, p, c) => legacy.exitSortB(s, { parentRegion: p, connectedRegion: c }), after: helper2 },
    { site: 'exits/exitUI.js:894 (card)', arity: 2, before: legacy.exitCard, after: helper2 },
    { site: 'regions/index.js:200 (exit click)', arity: 2, before: legacy.regionsExitClick, after: helper2 },
    { site: 'regions/navigationManager.js:87 (Show All)', arity: 1, before: legacy.navShowAll,
        after: (s, n) => isRegionReachable(s, n) },
    { site: 'regions/navigationManager.js:117 (path)', arity: 1, before: (s, n) => legacy.navPath(s, { name: n }),
        after: (s, n) => isRegionReachable(s, n) },
    { site: 'regions/navigationManager.js:134 (last region)', arity: 1,
        before: (s, n) => legacy.navLast(s, { name: n }), after: (s, n) => isRegionReachable(s, n) },
    { site: 'regions/regionBlockBuilder.js:563 (entrance source)', arity: 1,
        before: (s, n) => legacy.blockEntranceSource(s, { sourceRegion: n }), after: (s, n) => isRegionReachable(s, n) },
    { site: 'regions/regionBlockBuilder.js:747 (exit target)', arity: 1, before: legacy.blockExitConnected,
        after: (s, n) => isRegionReachable(s, n) },
    { site: 'commonUI/commonUI.js:2856 (createRegionLink)', arity: 1, allowNull: true,
        before: legacy.regionLinkDisplayStatus,
        // The adopted code: the helper decides "accessible"; the undefined / else branches are the base's, unchanged.
        after: (snapshot, regionName) => {
            const rawStatus = snapshot?.regionReachability?.[regionName];
            if (isRegionReachable(snapshot, regionName)) return true;
            if (rawStatus === undefined) return undefined;
            return false;
        } },
    { site: 'commonUI/commonUI.js:2964 (createLocationLink)', arity: 1, allowNull: true,
        before: legacy.locationLinkRegion, after: (s, n) => isRegionReachable(s, n) },
];

/** Run one site over its space → { rows, equal, firstMismatch, trueRows }. */
function measure({ arity, before, after, allowNull = false }) {
    let rows = 0; let equal = 0; let trueRows = 0; let firstMismatch = null;
    for (const snap of snapshots({ allowNull })) {
        const pairs = arity === 1 ? NAMES.map((n) => [n]) : NAMES.flatMap((p) => NAMES.map((c) => [p, c]));
        for (const args of pairs) {
            rows++;
            const b = before(snap, ...args);
            const a = after(snap, ...args);
            if (JSON.stringify([b]) === JSON.stringify([a]) && typeof b === typeof a) {
                equal++;
                if ([b].flat().some((v) => v === true)) trueRows++;
            } else if (!firstMismatch) firstMismatch = { snap, args, b, a };
        }
    }
    return { rows, equal, trueRows, firstMismatch };
}

const SNAPS = snapshots({ allowNull: false }).length;
const SNAPS_NULL = snapshots({ allowNull: true }).length;

describe('the replaced reachability copies equal isRegionReachable', () => {
    it('has the space it claims', () => {
        // 3 players × (4 empty shapes + 15 × 15 value pairs + 1 null-prototype map).
        expect(SNAPS).toBe(3 * (4 + VALUES.length ** 2 + 1));
        expect(SNAPS_NULL).toBe(SNAPS + 2);
    });
    for (const s of SITES) {
        it(s.site, () => {
            const r = measure(s);
            const want = (s.allowNull ? SNAPS_NULL : SNAPS) * NAMES.length ** s.arity;
            expect(r.rows).toBe(want);
            expect(r.firstMismatch).toBeNull();
            expect(r.equal).toBe(r.rows);
            // The space reaches the "reachable" answer, not only "no".
            expect(r.trueRows).toBeGreaterThan(0);
        });
    }
    it('counts every row (the packet quotes this)', () => {
        const total = SITES.reduce((n, s) => n + measure(s).rows, 0);
        // 7 one-name sites over the object space, 2 one-name sites over the null-inclusive space, 4 two-name sites.
        expect(total).toBe(7 * SNAPS * NAMES.length + 2 * SNAPS_NULL * NAMES.length + 4 * SNAPS * NAMES.length ** 2);
        expect(total).toBe(402314);
    });
});

describe('the left-alone copies DIFFER from isRegionReachable (census findings, measured)', () => {
    const diffValues = (fn) => {
        const out = new Set();
        for (const v of VALUES) {
            const snap = { regionReachability: { Hub: v } };
            if (fn(snap, 'Hub') !== isRegionReachable(snap, 'Hub')) out.add(String(v));
        }
        return [...out];
    };
    it('locations/locationUI.js (six copies): two-value, no `true`', () => {
        expect(diffValues(legacy.locationsParentRegion)).toEqual(['true']);
    });
    it("exits/exitUI.js:770/796 ('accessibility_original' sort): no 'reachable'", () => {
        expect(diffValues((s, n) => legacy.exitSortOriginalA(s, { parentRegion: n, connectedRegion: n })[0]))
            .toEqual(['reachable']);
    });
});
