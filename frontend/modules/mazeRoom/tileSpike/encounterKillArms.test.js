/**
 * ⛓ ENCOUNTER KILL ARMS (session tile-encounter-kill-arms; ⚖ Robert 2026-11-10 "A: Encounter-lock kill arms (Recommended)").
 * A latched kill-to-open lock (`RockLock`/`Lock` with `tSet == -1`, `RockLock.as`: it opens when `totalEnemies() == 0`) carries
 * the rules' own side grades on its event as `opens_from` (`playthroughEncounterLockOpeners`, read off `encounterLocksOf` /
 * `encounterLockSides`): per neighbour direction, `true` = a `clears` side (the event fires there on the lock's own clear), an
 * item rule = an `across` side (the arms that kill the roster THROUGH the shut lock), absent = `cannot`. Two readers:
 *   - `deriveTileLogic.eventAdjacentCell`: the event fires only from a listed neighbour (L53's pocket no longer clears the room);
 *   - the projection's `latchEntry`: an across side's closed-side entry costs `Or(event, arms)`, the rules' own step INTO the lock.
 * Every expectation is read off the data (the census, AP_1, the committed maze preset); no level is listed (a literal only checks).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { playthroughEncounterLockOpeners } from '../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };
import { RULES, ATLAS, PERMISSIVE, CLOSED_L53, CLOSED_L60 } from './deriveLevelWorldLogic.fixture.js';

const AP1 = JSON.parse(readFileSync(new URL('../../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const has = (item_name) => ({ rule: 'Has', args: { item_name } });
const levelOf = (region) => Number(region.match(/^level_(\d+)/)?.[1] ?? NaN);

/** Every obstacle-lib entry of the committed maze preset whose events carry `opens_from`: [{ region, lib, event }]. */
function eventsWithOpeners(rules) {
    const out = [];
    for (const [region, sc] of Object.entries(rules.preset_sidecars['1'])) {
        for (const lib of Object.values(sc.playable_payload?.obstacleLib ?? {})) {
            for (const event of lib.events ?? []) if (event.opens_from) out.push({ region, lib, event, payload: sc.playable_payload });
        }
    }
    return out;
}
const OPENERS = eventsWithOpeners(RULES);
/** The census's opens_from for the obstacle the event names (`<class>@<x>,<y>` in the event's name). */
const censusFor = (event) => {
    const at = event.name.match(/: (\w+@\d+,\d+) cleared$/)[1];
    return playthroughEncounterLockOpeners(Number(event.name.match(/^L(\d+) /)[1])).get(at);
};
/** Does `tree` contain a node deep-equal to `node`? */
const contains = (tree, node) => JSON.stringify(tree) === JSON.stringify(node)
    || (tree?.children ?? []).some((c) => contains(c, node));

describe('opens_from: the census\'s side grades on each latched kill lock\'s event', () => {
    it('every event that carries it is a census latch, and carries exactly the census\'s grades', () => {
        expect(OPENERS.length).toBeGreaterThan(0);
        for (const { event } of OPENERS) expect(event.opens_from, event.name).toEqual(censusFor(event));
    });
    it('every census latch with a side it fires from is carried (none dropped on the way through the projection)', () => {
        const carried = new Set(OPENERS.map(({ event }) => event.name));
        const levels = new Set(Object.keys(RULES.preset_sidecars['1']).map(levelOf));
        let n = 0;
        for (const level of levels) {
            for (const [at] of playthroughEncounterLockOpeners(level)) {
                n += 1;
                expect([...carried].some((name) => name.startsWith(`L${level} `) && name.endsWith(`: ${at} cleared`)), `L${level} ${at}`).toBe(true);
            }
        }
        expect(n).toBe(new Set(OPENERS.map(({ event }) => event.name)).size);
        // a literal only CHECKS: the four latched kill locks of the committed preset (L71's lock has no event — a plain gate)
        expect([...new Set(OPENERS.map(({ region }) => levelOf(region)))].sort((a, b) => a - b)).toEqual([18, 26, 53, 60]);
    });
    it('a census `cannot` side is absent, `clears` is true, `across` is an item rule (never the empty Or)', () => {
        for (const { event } of OPENERS) {
            for (const [dir, way] of Object.entries(event.opens_from)) {
                expect(['N', 'E', 'S', 'W'], event.name).toContain(dir);
                if (way !== true) expect(way.rule, `${event.name} ${dir}`).toBeTruthy();
            }
        }
    });
});

describe('latchEntry: an across side\'s entry is the rules\' own Or(event, arms)', () => {
    const across = OPENERS.flatMap(({ region, lib, event, payload }) => Object.entries(event.opens_from)
        .filter(([, way]) => way !== true).map(([dir, way]) => ({ region, lib, event, payload, dir, want: { rule: 'Or', children: [has(event.name), way] } })));
    it('there is at least one across side (L60\'s pocket today)', () => expect(across.length).toBeGreaterThan(0));
    it('the maze world lays a gate whose clear rule IS Or(event, arms)', () => {
        for (const { event, payload, want } of across) {
            const gates = Object.values(payload.obstacleLib).filter((g) => JSON.stringify(g.clear_rule) === JSON.stringify(want));
            expect(gates.length, event.name).toBeGreaterThan(0);
        }
    });
    it('and AP_1 prices a step INTO the lock\'s side with that same Or (the two cannot drift)', () => {
        for (const { event, want } of across) {
            const side = event.side;
            const into = Object.entries(AP1.regions['1'])
                .filter(([name]) => levelOf(name) === levelOf(side))
                .flatMap(([, r]) => (r.exits ?? []).filter((e) => e.connected_region === side && contains(e.access_rule, want)));
            expect(into.length, `${event.name}: an AP_1 exit into ${side} holding ${JSON.stringify(want)}`).toBeGreaterThan(0);
        }
    });
});

/** A copy of the preset with `edit` applied to every obstacle-lib entry of `level`'s sidecars. */
function mutant(level, edit) {
    const copy = structuredClone(RULES);
    for (const [region, sc] of Object.entries(copy.preset_sidecars['1'])) {
        if (levelOf(region) !== level) continue;
        for (const lib of Object.values(sc.playable_payload?.obstacleLib ?? {})) edit(lib);
    }
    return copy;
}
const certify = (rules, region) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS, permissive: PERMISSIVE, regions: [region] });
const regionOfProblem = (p) => p.match(/^(level_\d+__r\d+c\d+)/)[1];

describe('both closed rows, each with its red-first mutant', () => {
    it('L53: no problem at the event\'s room; with opens_from stripped, OPEN_L53 returns (the pocket fires the event again)', () => {
        const region = regionOfProblem(CLOSED_L53);
        expect(certify(RULES, region).problems).toEqual([]);
        const stripped = mutant(levelOf(region), (lib) => { for (const e of lib.events ?? []) delete e.opens_from; });
        expect(certify(stripped, region).problems).toContain(CLOSED_L53);
    });
    it('L60: no problem at the lock\'s room; with the across gate reduced to its event, OPEN_L60 returns', () => {
        const target = CLOSED_L60.match(/→ (level_\d+__r\d+c\d+)/)[1];
        expect(certify(RULES, target).problems).toEqual([]);
        const eventOnly = mutant(levelOf(target), (lib) => {
            const or = lib.clear_rule;
            if (or?.rule === 'Or' && or.children.length === 2 && or.children[0].rule === 'Has' && / flag \d+: lock@/.test(or.children[0].args.item_name)) lib.clear_rule = or.children[0];
        });
        expect(certify(eventOnly, target).problems).toContain(CLOSED_L60);
    });
});
