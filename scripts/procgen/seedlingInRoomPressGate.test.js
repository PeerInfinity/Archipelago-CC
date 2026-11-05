// ⛓ tile-rules-automation-r-a4 (⚖ Robert 2026-11-04 "Yes, in R-A4 (Recommended)"; rules-4's rewrite) — L20's lock@32,80
// costs exactly its own press (`GROUPED_LOCK_EXCEPTIONS`, item-free). Two things are pinned here:
//   1. the row is still LOAD-BEARING: the lock keeps the four-cell alcove L13's stairs drop into closed until the press.
//      Judged from AP's own outputs (the committed AP_1 and the seed-1 sphere log), never from the overlay row itself;
//   2. the producer's absorption (`crossingPaysPress`): an in-room latch's gate is skipped only where EVERY way of the
//      crossing already pays THAT press.
// Red-first: with the row deleted (the lock ruled OPEN, the table moved aside) the alcove folds into the room, `level_13`
// reaches `level_20__r1c4` on True_ and AP collects the Shield at sphere 0.3 — rows 1(a)–(c) go red on that AP_1.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crossingPaysPress } from './make-seedling-playthrough-rules.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(REPO, p), 'utf8');
const AP1_FILE = process.env.R_A4_AP1 ?? 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json';
const SPHERES_FILE = process.env.R_A4_SPHERES
    ?? 'frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl';
const REGIONS = JSON.parse(read(AP1_FILE)).regions['1'];
const PRESS = 'L20 flag 4: lock@32,80 cleared';
const SHIELD = 'Progressive Shield';

const isFree = (rule) => rule == null || rule.rule === 'True_';
/** The regions `start` reaches over exits whose rule is True_ (or absent): what costs nothing at all. */
function freeReach(regions, start) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
        const n = queue.shift();
        for (const x of regions[n]?.exits ?? []) {
            if (!isFree(x.access_rule) || seen.has(x.connected_region)) continue;
            seen.add(x.connected_region);
            queue.push(x.connected_region);
        }
    }
    return seen;
}
/** Does `rule` require `item` (a Has of it, or an And holding one)? An Or requires it only if every branch does. */
const requires = (rule, item) => !!rule && ((rule.rule === 'Has' && rule.args?.item_name === item)
    || (rule.rule === 'And' && rule.children.some((c) => requires(c, item)))
    || (rule.rule === 'Or' && rule.children.length > 0 && rule.children.every((c) => requires(c, item))));
/** rules-5's condition (d): every exit INTO `target` requires `item`, and only `level`'s own regions enter it. */
function entriesInto(regions, target) {
    return Object.entries(regions).flatMap(([from, r]) => (r.exits ?? []).filter((x) => x.connected_region === target)
        .map((x) => ({ from, rule: x.access_rule })));
}
/** The first sphere whose newly accessible locations include `location` (AP's own fill, the sphere log). */
function firstAccessibleSphere(jsonl, location) {
    for (const line of jsonl.split('\n')) {
        if (!line.trim()) continue;
        const o = JSON.parse(line);
        if ((o.player_data?.['1']?.new_accessible_locations ?? []).includes(location)) return Number(o.sphere_index);
    }
    return null;
}

describe('R-A4: L20\'s lock@32,80 still keeps the alcove closed until its press (from AP_1 and the sphere log)', () => {
    it('(a) the alcove is its own region, and its only way into the room costs the press', () => {
        expect(REGIONS.level_20__r3c1).toBeDefined();
        const out = REGIONS.level_20__r3c1.exits.filter((x) => x.connected_region.startsWith('level_20__'));
        expect(out.map((x) => [x.connected_region, x.access_rule])).toEqual([
            ['level_20__r1c4', { rule: 'Has', args: { item_name: PRESS } }],
        ]);
    });

    it('(b) nothing reaches L20\'s room from L13 for free: the True_ closure of level_13 holds only the alcove of L20', () => {
        const reach = freeReach(REGIONS, 'level_13');
        expect([...reach].filter((n) => n.startsWith('level_20')).sort()).toEqual(['level_20__r3c1']);
    });

    it('(c) AP collects no Shield for free: Level 020 - Shield first becomes accessible at sphere >= 1 (2.2 today)', () => {
        const sphere = firstAccessibleSphere(read(SPHERES_FILE), 'Level 020 - Shield');
        expect(sphere).toBeGreaterThanOrEqual(1);
        expect(sphere).toBe(2.2);
    });

    it('(d) the press implies the Shield: every exit into the press\'s room requires it, and only L20\'s own regions enter it', () => {
        // rules-5: the 2 re-spellings And(Shield, press) -> press are EQUAL only under this structure. ER (E4b shuffles
        // stairs) could add a landing in r1c12; then this row reds rather than the equality silently loosening.
        const inside = REGIONS.level_20__r1c12.locations.find((l) => l.name === PRESS);
        expect(inside).toBeDefined();
        const entries = entriesInto(REGIONS, 'level_20__r1c12');
        expect(entries.map((e) => e.from)).toEqual(['level_20__r1c4']);
        expect(entries.every((e) => requires(e.rule, SHIELD))).toBe(true);
    });

    it('(d) MUTANT: a True_ way into the press\'s room is caught', () => {
        const mutant = structuredClone(REGIONS);
        mutant.level_19__r1c1.exits.push({ name: 'mutant -> level_20__r1c12', connected_region: 'level_20__r1c12', access_rule: { rule: 'True_' } });
        const entries = entriesInto(mutant, 'level_20__r1c12');
        expect(entries.map((e) => e.from).sort()).toEqual(['level_19__r1c1', 'level_20__r1c4']);
        expect(entries.every((e) => requires(e.rule, SHIELD))).toBe(false);
    });
});

describe('R-A4: crossingPaysPress — an in-room latch\'s gate is skipped only where every way already pays THAT press', () => {
    const resolve = (k) => (k?.event ? { rule: 'Has', args: { item_name: k.event } } : k?.flag ? { rule: 'Has', args: { item_name: k.flag } } : null);
    const own = { event: PRESS };
    const other = { event: 'L40 flag 1: wandlock@176,80 cleared' };
    const item = { flag: SHIELD };
    const way = (...conditions) => ({ conditions, tiles: [[2, 5]] });

    it('every way charged with the press itself: redundant (the gate is skipped)', () => {
        expect(crossingPaysPress([way(own)], PRESS, resolve)).toBe(true);
        expect(crossingPaysPress([way(own, item), way(own)], PRESS, resolve)).toBe(true);
    });
    it('one way without it: the gate stays', () => {
        expect(crossingPaysPress([way(own), way(item)], PRESS, resolve)).toBe(false);
    });
    it('every way charged with ANOTHER press\'s event: the gate stays', () => {
        expect(crossingPaysPress([way(other), way(other, item)], PRESS, resolve)).toBe(false);
    });
    it('an item alone, an unresolvable condition, or no ways at all: the gate stays', () => {
        expect(crossingPaysPress([way(item)], PRESS, resolve)).toBe(false);
        expect(crossingPaysPress([way({ unknown: 1 })], PRESS, resolve)).toBe(false);
        expect(crossingPaysPress([], PRESS, resolve)).toBe(false);
    });
});
