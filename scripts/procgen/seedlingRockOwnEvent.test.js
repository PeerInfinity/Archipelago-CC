/**
 * ⛓⛓ tile-fire-breaks-rocks §4 — A ROCK'S OWN CLEARED EVENT, CREDITED WHERE IT IS MINTED. ⚖ Robert 2026-11-12, via the
 * liaison: "Credit where created (Recommended)"; shape ruled by rules-6. A tagged rock whose flag is cleared is removed
 * (`BreakableRock.check`, `BreakableRock.as:47-54`), so its swing-only sides (`rockFireRuling`'s `enter`) also open on
 * its own cleared event, but only where the producer MINTS that event (`mintedObstacleEvents`: the names its own event
 * layer makes, `obstacleEventNames` over the arrival census). A credited name nothing grants is refused by name.
 *
 * MUTATIONS (each reds the named row):
 *   m1 `rockOwnEvent` ignores `ctx.mintedEvents` (credits every tagged rock) -> "every credited rock event is minted…"
 *      (L16/L53/L100's unminted events join the credited set) and the producer exits on `unmintedRockEvents`
 *   m2 `rockFireRuling` drops the credit                                    -> "L0's two in-rock exits open on…"
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    mintedObstacleEvents, creditedRockEvents, unmintedRockEvents,
} from './make-seedling-playthrough-rules.mjs';
import { rockOwnEvent } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const MAP = read('frontend/modules/flashPanel/atlases/seedling-map.json');
const eventLocations = (rules) => new Set(Object.values(rules.regions['1']).flatMap((r) => (r.locations ?? [])
    .filter((l) => l.event).map((l) => l.item?.name ?? l.name)));
const PRESETS = ['seedling_playthrough', 'seedling_er'].map((p) => [p, read(`frontend/presets/${p}/AP_1/AP_1_rules.json`)]);

describe('§4 — the minted set is the producer\'s own, and every credited event is in it', () => {
    it('every minted obstacle event is an event location of the compiled AP_1 (both presets)', () => {
        const minted = [...mintedObstacleEvents()];
        expect(minted.length > 0).toBe(true);
        for (const [preset, rules] of PRESETS) {
            const made = eventLocations(rules);
            expect(minted.filter((n) => !made.has(n)), preset).toEqual([]);
        }
    });

    it('every credited rock event is minted, and the credit is not empty (L0\'s in-rock rocks)', () => {
        const minted = mintedObstacleEvents();
        const credited = creditedRockEvents();
        expect(credited.length > 0).toBe(true);
        expect(credited.filter((n) => !minted.has(n))).toEqual([]);
        expect(credited.every((n) => n.startsWith('L') && n.includes('breakablerock@'))).toBe(true);
    });

    it('a credited name nothing grants is refused BY NAME (the L53 rock, whose event is not minted)', () => {
        const l53 = MAP.levels.find((l) => l.level === 53).entities.find((e) => e.type === 'breakablerock');
        const name = rockOwnEvent(l53, { level: 53, mintedEvents: new Set([`L53 flag ${l53.attrs.tag}: breakablerock@${l53.x},${l53.y} cleared`]) }).event;
        expect(mintedObstacleEvents().has(name)).toBe(false);
        const [refusal] = unmintedRockEvents([name], [...mintedObstacleEvents()]);
        expect(refusal).toMatch(new RegExp(`credits "${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}", which no event location`));
        // and the ruling itself does not credit it under the producer's own set
        expect(rockOwnEvent(l53, { level: 53, mintedEvents: mintedObstacleEvents() })).toBeNull();
    });
});

describe('§4 — the rules it moves', () => {
    const ruleOf = (rules, from, to) => rules.regions['1'][from].exits.find((e) => e.connected_region === to)?.access_rule;
    const names = (r) => JSON.stringify(r).match(/"L\d+ flag \d+: [^"]+ cleared"/g)?.map((s) => JSON.parse(s)) ?? [];

    it("L0's two in-rock exits open on their own rock's event, both presets", () => {
        for (const [preset, rules] of PRESETS) {
            expect(names(ruleOf(rules, 'level_0__r6c5', 'level_0__r7c6')), preset).toEqual(['L0 flag 4: breakablerock@80,112 cleared']);
            expect(names(ruleOf(rules, 'level_0__r11c19', 'level_0__r7c6')), preset).toEqual(['L0 flag 1: breakablerock@288,176 cleared']);
        }
    });

    it('a rock event location never names itself (the occupancy is not credited)', () => {
        for (const [preset, rules] of PRESETS) {
            for (const r of Object.values(rules.regions['1'])) {
                for (const l of (r.locations ?? []).filter((x) => x.event && /breakablerock@/.test(x.name))) {
                    expect(names(l.access_rule).includes(l.item?.name ?? l.name), `${preset} ${l.name}`).toBe(false);
                }
            }
        }
    });
});
