/**
 * The divergence sweep's LEG LIST (`seedling-divergence-legs.mjs`): an arrival whose door edge needs a `game_state`
 * event is SKIPPED by name (a jump would land inside the unbroken obstacle — L71's `in_L76_0_80`, behind
 * `Has(flag:L71:2)`), and a leg's identity across SHAs is its KEY (region, arrival door, goal), never its numeric id.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { arrivalEventNeeds, legKey, pickLegs, requiredEvents } from './seedling-divergence-legs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const E1 = { item: 'L9 flag 1: rock cleared', eventId: 'flag:L9:1' };
const E2 = { item: 'L9 flag 2: rock cleared', eventId: 'flag:L9:2' };
const byItem = new Map([[E1.item, E1], [E2.item, E2]]);
const ids = (list) => list.map((e) => e.eventId);

describe('requiredEvents — the game_state events a door edge cannot hold without', () => {
    it('Has / HasAll of an event; an ordinary item is not an event', () => {
        expect(ids(requiredEvents(has(E1.item), byItem))).toEqual(['flag:L9:1']);
        expect(ids(requiredEvents({ rule: 'HasAll', args: { item_names: ['Sword', E2.item] } }, byItem))).toEqual(['flag:L9:2']);
        expect(requiredEvents(has('Sword'), byItem)).toEqual([]);
        expect(requiredEvents(null, byItem)).toEqual([]);
        expect(requiredEvents({ rule: 'True_' }, byItem)).toEqual([]);
    });
    it('And = the union; Or = none when one branch needs none, else every branch\'s (fail-closed)', () => {
        expect(ids(requiredEvents({ rule: 'And', children: [has('Sword'), has(E1.item), has(E2.item)] }, byItem)))
            .toEqual(['flag:L9:1', 'flag:L9:2']);
        expect(requiredEvents({ rule: 'Or', children: [has(E1.item), has('Wand')] }, byItem)).toEqual([]);
        expect(ids(requiredEvents({ rule: 'Or', children: [has(E1.item), { rule: 'And', children: [has('Red'), has(E2.item)] }] }, byItem)))
            .toEqual(['flag:L9:1', 'flag:L9:2']);
    });
});

describe('arrivalEventNeeds — an arrival needs an event only when EVERY door into its spawn does', () => {
    it('one ungated door → none; all gated → the union; no door → none', () => {
        expect(arrivalEventNeeds([[E1], []])).toEqual([]);
        expect(arrivalEventNeeds([[], [E1]])).toEqual([]);
        expect(ids(arrivalEventNeeds([[E1], [E2], [E1]]))).toEqual(['flag:L9:1', 'flag:L9:2']);
        expect(arrivalEventNeeds([])).toEqual([]);
    });
});

describe('legKey / pickLegs', () => {
    const exitLeg = { id: 7, region: 'level_71__r0c6', arrive: { via: 'in_L76_0_80' }, goal: { kind: 'exit', exit_id: 'out_teleporter_96_0' } };
    const locLeg = { id: 8, region: 'level_71__r0c6', arrive: { via: 'start' }, goal: { kind: 'location', name: 'L71 flag 2: shieldlock@288,256 cleared' } };
    const legs = [exitLeg, locLeg].map((l) => ({ ...l, key: legKey(l) }));
    it('the key is (region, arrival door, goal) — no list position in it', () => {
        expect(legs[0].key).toBe('level_71__r0c6 <- in_L76_0_80 -> exit:out_teleporter_96_0');
        expect(legKey({ ...exitLeg, id: 99 })).toBe(legs[0].key);
        expect(legs[1].key).toBe('level_71__r0c6 <- start -> location:L71 flag 2: shieldlock@288,256 cleared');
    });
    it('selects by id or by key (a key may hold a comma); an unknown key THROWS by name', () => {
        expect(pickLegs(legs, {})).toBe(legs);
        expect(pickLegs(legs, { ids: [8] }).map((l) => l.id)).toEqual([8]);
        expect(pickLegs(legs, { keys: [legs[1].key] }).map((l) => l.id)).toEqual([8]);
        expect(() => pickLegs(legs, { keys: ['nowhere <- x -> exit:y'] })).toThrow(/no leg has the key/);
    });
});

describe('the committed playthrough\'s leg list', () => {
    let dir;
    let legs;
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-legs-'));
        execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs'), `--out=${join(dir, 'legs.jsonl')}`,
            '--presets=seedling_playthrough'], { cwd: REPO, stdio: 'pipe' });
        legs = readFileSync(join(dir, 'legs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    }, 60000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

    it('every leg has a distinct key; ids are the list positions', () => {
        expect(new Set(legs.map((l) => l.key)).size).toBe(legs.length);
        expect(legs.every((l, i) => l.id === i)).toBe(true);
    });

    it('L71\'s arrival through in_L76_0_80 (edge Has(flag:L71:2)) is SKIPPED by name, with the flag a stager would declare', () => {
        const l71 = legs.filter((l) => l.region === 'level_71__r0c6' && l.arrive.via === 'in_L76_0_80');
        expect(l71.length).toBeGreaterThan(0);
        for (const l of l71) {
            expect(l.skip).toMatch(/^arrival-needs-event: .*flag:L71:2/);
            expect(l.arrive.events).toEqual([expect.objectContaining({ eventId: 'flag:L71:2', level: 71, tag: 2 })]);
        }
    });

    it('a skipped leg needs an event on EVERY door into its spawn; an ungated arrival is never skipped', () => {
        const skipped = legs.filter((l) => l.skip);
        expect(skipped.length).toBeGreaterThan(0);
        expect(skipped.every((l) => l.arrive.events?.length > 0)).toBe(true);
        expect(legs.filter((l) => !l.skip).every((l) => !l.arrive.events)).toBe(true);
        expect(legs.filter((l) => l.arrive.via === 'start').every((l) => !l.skip)).toBe(true);
    });
});
