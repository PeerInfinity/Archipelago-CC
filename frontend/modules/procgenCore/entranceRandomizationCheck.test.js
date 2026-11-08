/**
 * ENTRANCE RANDOMIZATION E2 — the cross-field validator (`entranceRandomizationCheck.js`), pinned by MUTANTS:
 * the clean fixture passes (and passes the schema), and each rule's refusal fires, by name, on a fixture broken
 * by hand in exactly that way.
 */

import { describe, expect, it } from 'vitest';

import { rulesJsonSchemaErrors } from './jsonSchemaCheck.js';
import { loadRulesSchema } from './jsonSchemaFiles.js';
import { ER_FIXTURE_NAMES as N, erFixtureRules } from './entranceRandomization.fixture.js';
import {
    entranceRandomizationOf, entranceRandomizationProblems, refuseInvalidEntranceRandomization,
} from './entranceRandomizationCheck.js';

const SCHEMA = loadRulesSchema();
const exitOf = (doc, name) => Object.values(doc.regions[1]).flatMap((r) => r.exits).find((e) => e.name === name);
const block = (doc) => doc.entrance_randomization[1];
const problems = (doc) => entranceRandomizationProblems(doc, '1');

describe('the clean fixture', () => {
    it('passes the schema and the validator', () => {
        expect(rulesJsonSchemaErrors(erFixtureRules(), SCHEMA)).toEqual([]);
        expect(problems(erFixtureRules())).toEqual([]);
        expect(() => refuseInvalidEntranceRandomization(erFixtureRules(), 1)).not.toThrow();
    });

    it('a document with no `er` and no block has nothing to refuse (the data is optional)', () => {
        const doc = erFixtureRules();
        delete doc.entrance_randomization;
        for (const r of Object.values(doc.regions[1])) for (const e of r.exits) delete e.er;
        expect(problems(doc)).toEqual([]);
        expect(rulesJsonSchemaErrors(doc, SCHEMA)).toEqual([]);
        expect(entranceRandomizationOf(doc, '1')).toBeNull();
    });

    it('`coupled: false` is legal (GER allows it), and a two-way exit then needs no reverse', () => {
        const doc = erFixtureRules();
        block(doc).coupled = false;
        delete exitOf(doc, N.stairsDown).er.reverse;
        delete exitOf(doc, N.stairsUp).er.reverse;
        expect(problems(doc)).toEqual([]);
        expect(rulesJsonSchemaErrors(doc, SCHEMA)).toEqual([]);
    });

    it('the block is read per player', () => {
        expect(entranceRandomizationOf(erFixtureRules(), 1)).toEqual(block(erFixtureRules()));
        expect(entranceRandomizationOf(erFixtureRules(), '2')).toBeNull();
    });
});

/** Each mutant: [name, break the fixture, the refusal it must name]. */
const MUTANTS = [
    ['REVERSE: names no exit', (d) => { exitOf(d, N.stairsDown).er.reverse = 'Nowhere'; },
        /exit "Upstairs -> Downstairs \(stairs\)".*`er\.reverse` names "Nowhere", which is no exit of player 1/],
    ['REVERSE: names an exit of ANOTHER player only', (d) => {
        d.regions[2] = { X: { name: 'X', locations: [], exits: [{ name: 'Elsewhere', connected_region: 'X' }] } };
        exitOf(d, N.stairsDown).er.reverse = 'Elsewhere';
    }, /names "Elsewhere", which is no exit of player 1/],
    ['MUTUAL: the reverse names a third exit', (d) => { exitOf(d, N.stairsUp).er.reverse = N.pit; },
        /its reverse "Downstairs -> Upstairs \(stairs\)" carries `er` but names reverse "Upstairs -> Downstairs \(pit\)".*reverses are mutual/],
    ['MUTUAL: the reverse names none', (d) => { delete exitOf(d, N.stairsUp).er.reverse; },
        /carries `er` but names no reverse.*reverses are mutual/],
    ['ONE-WAY: a one_way exit names a reverse', (d) => { exitOf(d, N.pit).er.reverse = N.stairsUp; },
        /exit "Upstairs -> Downstairs \(pit\)".* is `one_way` but names reverse/],
    ['COUPLED: a shuffled two_way exit names no reverse', (d) => {
        delete exitOf(d, N.stairsDown).er.reverse;
        delete exitOf(d, N.stairsUp).er.reverse;
    }, /shuffled `two_way` exit under a coupled shuffle but names no `er\.reverse`/],
    ['UNIQUE: an er exit shares its name', (d) => {
        d.regions[1][N.down].exits.push({ name: N.stairsDown, connected_region: N.up });
    }, /carries `er` but 2 exits of player 1 are named "Upstairs -> Downstairs \(stairs\)"/],
    ['PLACED: a placement names a non-shuffled exit', (d) => { block(d).placements.push({ exit: N.pit, target: N.stairsUp }); },
        /`placements\[2\]\.exit` names "Upstairs -> Downstairs \(pit\)", which is not an exit with `er\.shuffle: true`/],
    ['PLACED: a placement names no exit', (d) => { block(d).placements[0].exit = 'Ghost'; },
        /`placements\[0\]\.exit` names "Ghost", which is no exit of player 1/],
    ['PLACED: an exit placed twice', (d) => { block(d).placements.push({ exit: N.stairsDown, target: N.stairsUp }); },
        /`placements\[2\]\.exit` places "Upstairs -> Downstairs \(stairs\)" a second time/],
    // ⚖ E4a: `placements[].target` names the exit the placed one arrives beside (its reverse's arrival).
    ['PLACED-TARGET: a target names no exit', (d) => { block(d).placements[0].target = 'Ghost'; },
        /`placements\[0\]\.target` names "Ghost", which is no exit of player 1 — a target is named by the exit it arrives beside/],
    ['PLACED-TARGET: a target names a non-shuffled exit', (d) => { block(d).placements[0].target = N.pit; },
        /`placements\[0\]\.target` names "Upstairs -> Downstairs \(pit\)", which is not an exit with `er\.shuffle: true`/],
    ['PLACED-TARGET: a target of the other type', (d) => {
        exitOf(d, N.pit).er = { group: 'stairs_up', type: 'one_way', shuffle: true };
        block(d).placements[0].target = N.pit;
    }, /a `one_way` exit, for the `two_way` exit "Upstairs -> Downstairs \(stairs\)" — types match/],
    ['PLACED-TARGET: a target of a group the lookup does not allow', (d) => { block(d).placements[0].target = N.stairsDown; },
        /`placements\[0\]\.target` names "Upstairs -> Downstairs \(stairs\)", of group "stairs_down", which `target_group_lookup\["stairs_down"\]`/],
    ['PLACED-TARGET: a target used twice', (d) => { block(d).placements.push({ exit: N.stairsUp, target: N.stairsUp }); },
        /`placements\[2\]\.target` names "Downstairs -> Upstairs \(stairs\)" a second time/],
    // ⚖ E4b: a coupled placement is mirrored ({D, E} ⇒ {E, D}).
    ['COUPLED-MIRROR: a coupled placement without its mirror row', (d) => { block(d).placements.pop(); },
        /`placements\[0\]` places "Upstairs -> Downstairs \(stairs\)" at "Downstairs -> Upstairs \(stairs\)" under a coupled shuffle, but no row places/],
    ['GROUPS: a lookup KEY no exit declares', (d) => { block(d).target_group_lookup.edge_west = ['stairs_up']; },
        /`target_group_lookup` names group "edge_west", which no exit of player 1 declares/],
    ['GROUPS: a lookup VALUE no exit declares', (d) => { block(d).target_group_lookup.stairs_down.push('edge_east'); },
        /names group "edge_east", which no exit of player 1 declares/],
    ['SHAPE: er.type outside EntranceType', (d) => { exitOf(d, N.pit).er.type = 'oneway'; },
        /`er\.type` is one of one_way \/ two_way, got "oneway"/],
    ['SHAPE: er without shuffle', (d) => { delete exitOf(d, N.pit).er.shuffle; }, /`er\.shuffle` is a boolean/],
    ['SHAPE: er with an unknown field', (d) => { exitOf(d, N.pit).er.kind = 'pit'; }, /`er` has no field "kind"/],
    ['SHAPE: an empty group', (d) => { exitOf(d, N.pit).er.group = ''; }, /`er\.group` is a non-empty string/],
    ['SHAPE: the block lacks placements', (d) => { delete block(d).placements; },
        /the entrance_randomization block has no `placements`/],
    ['SHAPE: an unknown algorithm', (d) => { block(d).algorithm = 'vanilla'; }, /`algorithm` is one of ger, got "vanilla"/],
    ['SHAPE: a non-integer seed', (d) => { block(d).seed = 1.5; }, /`seed` is an integer/],
    ['SHAPE: a placement row with an extra field', (d) => { block(d).placements[0].why = 'x'; },
        /`placements\[0\]` is \{exit, target\}/],
    ['SHAPE: a lookup value that is not a list', (d) => { block(d).target_group_lookup.stairs_up = 'stairs_down'; },
        /`target_group_lookup\["stairs_up"\]` is a list of group names/],
];

describe('each refusal fires on its hand-broken fixture (mutants)', () => {
    for (const [name, mutate, refusal] of MUTANTS) {
        it(name, () => {
            const doc = erFixtureRules();
            mutate(doc);
            const out = problems(doc);
            expect(out.some((s) => refusal.test(s)), `${name}\n${out.join('\n')}`).toBe(true);
            expect(() => refuseInvalidEntranceRandomization(doc, '1')).toThrow(/entrance randomization is refused/);
        });
    }

    it('the schema refuses the SHAPE mutants too (the two layers agree)', () => {
        for (const [name, mutate] of MUTANTS.filter(([n]) => n.startsWith('SHAPE'))) {
            const doc = erFixtureRules();
            mutate(doc);
            expect(rulesJsonSchemaErrors(doc, SCHEMA).length, name).toBeGreaterThan(0);
        }
    });
});
