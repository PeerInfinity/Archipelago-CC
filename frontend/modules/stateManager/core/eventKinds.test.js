/**
 * ⛓ RULES obstacle-events — the auto-collector honours `event_kind`, FAIL-CLOSED (`eventKinds.js`).
 *
 * A `game_state` event (a saved obstacle's flag) is the GAME's to set: collected on reach it would open
 * the landing it gates with nothing broken. An unknown kind is not auto-collected either; an event with
 * NO kind (every committed event before this slice) keeps today's behaviour. Driven on the REAL
 * `StateManager` the worker constructs, over the committed playthrough rules.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { autoCollectsEvent, EVENT_KIND_POLICY } from './eventKinds.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const PRESETS = join(REPO, 'frontend', 'presets');
const RULES = JSON.parse(readFileSync(join(PRESETS, 'seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const ROCK = 'L0 flag 1: breakablerock@288,176 cleared';

describe('autoCollectsEvent — the policy', () => {
    it('no kind keeps today\'s behaviour; game_state and any unknown kind are never auto-collected', () => {
        expect(autoCollectsEvent({ name: 'Victory' })).toBe(true);
        expect(autoCollectsEvent({ name: 'v', event_kind: null })).toBe(true);
        expect(autoCollectsEvent({ name: 'rock', event_kind: 'game_state' })).toBe(false);
        expect(autoCollectsEvent({ name: 'x', event_kind: 'some_future_kind' })).toBe(false);
        expect(autoCollectsEvent({ name: 'x', event_kind: 'toString' })).toBe(false);
    });

    it('every kind the schema allows has a policy row', () => {
        const schema = JSON.parse(readFileSync(join(REPO, 'frontend/schema/rules.schema.json'), 'utf8'));
        expect(Object.keys(EVENT_KIND_POLICY).sort())
            .toEqual([...schema.$defs.location.properties.event_kind.enum].sort());
    });
});

describe('the REAL stateManager reachability pass, in node', () => {
    const load = async (rules, items) => {
        const { StateManager } = await import('../stateManager.js');
        const { evaluateRule } = await import('../../shared/ruleEngine.js');
        const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(structuredClone(rules), '1');
        for (const item of items) sm.addItemToInventory(item);
        sm.computeReachableRegions();
        return sm;
    };
    const withKind = (kind) => {
        const r = structuredClone(RULES);
        for (const reg of Object.values(r.regions['1'])) {
            for (const l of reg.locations) {
                if (l.event_kind === undefined) continue;
                if (kind === undefined) delete l.event_kind; else l.event_kind = kind;
            }
        }
        return r;
    };

    it('a reachable game_state event is NOT collected: neither checked nor in the inventory', async () => {
        const sm = await load(RULES, ['Progressive Sword']);
        const loc = sm.locations.get(ROCK);
        expect(sm.isRegionReachable(loc.region)).toBe(true);
        expect(sm.isLocationAccessible(loc)).toBe(true);
        expect(sm.checkedLocations.has(ROCK)).toBe(false);
        expect(sm.inventory[ROCK] ?? 0).toBe(0);
        // the rock is still crossed from the room (a plain crossing keeps its item rule)
        expect(sm.isRegionReachable('level_0__r11c19')).toBe(true);
    });

    it('fail-closed: an UNKNOWN kind is not collected either', async () => {
        const sm = await load(withKind('some_future_kind'), ['Progressive Sword']);
        expect(sm.checkedLocations.has(ROCK)).toBe(false);
    });

    it('the same events with NO kind are auto-collected, as every event before this slice', async () => {
        const sm = await load(withKind(undefined), ['Progressive Sword']);
        expect(sm.checkedLocations.has(ROCK)).toBe(true);
        expect(sm.inventory[ROCK]).toBe(1);
    });
});

describe('the committed events — measured and pinned', () => {
    // Every committed rules export: which kinds its event locations carry. A preset gaining a kind is a
    // decision about the auto-collector, so it lands here by name.
    const files = [];
    for (const game of readdirSync(PRESETS)) {
        const dir = join(PRESETS, game);
        if (!statSync(dir).isDirectory()) continue;
        for (const seed of readdirSync(dir)) {
            const f = join(dir, seed, `${seed}_rules.json`);
            try { if (statSync(f).isFile()) files.push(f); } catch { /* not an export */ }
        }
    }

    it('only the playthrough\'s exports carry event_kind, and only game_state', () => {
        const carrying = files.filter((f) => readFileSync(f, 'utf8').includes('"event_kind"'))
            .map((f) => f.slice(PRESETS.length + 1)).sort();
        expect(carrying).toEqual([
            'seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json',
            'seedling_playthrough/AP_1/AP_1_rules.json',
        ].sort());
        for (const f of carrying) {
            const d = JSON.parse(readFileSync(join(PRESETS, f), 'utf8'));
            const kinds = Object.values(d.regions['1']).flatMap((r) => r.locations)
                .filter((l) => 'event_kind' in l).map((l) => l.event_kind);
            expect(kinds, f).toEqual(Array(8).fill('game_state'));
        }
    });
});
