/**
 * H6 — the check report turned into an AP location check (EDITOR INTEGRATION
 * M1; plan §17.0.4 (e), §17.2.7).
 *
 * ⛔ THE TABLE IS THE REAL ONE. `buildPlacementTable` is run here over the
 * committed goal ledger, the committed map extract and the seed-1
 * `seedling_playthrough` preset's own placement — the same three documents the
 * rewriter and the browser gate use — so the rows are about the addresses that
 * will actually be reported, including the ELEVEN whose tags are allocated
 * because their vanilla elements carry none. A hand-built table would agree
 * with a hand-built filter and prove nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildPlacementTable, placementKey } from '../seedlingDemo/apPlacementRewriter.js';
import { R7_GOAL_LEDGER } from '../seedlingDemo/r7Acceptance.js';
import {
    PENDING_CHECK_FIELDS, SeedlingCheckBinding, parsePendingCheck,
} from './seedlingCheckBinding.js';

const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const MAP = readJson('./atlases/seedling-map.json');
const RULES = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');

const [SLOT] = Object.keys(RULES.regions);
const SELF_PLAYER = Number(SLOT);
const PLACED = new Map();
for (const region of Object.values(RULES.regions[SLOT])) {
    for (const loc of region.locations ?? []) {
        PLACED.set(loc.name, { name: loc.item.name, player: loc.item.player });
    }
}
const { table, entries, encounters } = buildPlacementTable({
    locationItemOf: (n) => PLACED.get(n) ?? null,
    ledger: R7_GOAL_LEDGER,
    rooms: MAP.levels,
    selfPlayer: SELF_PLAYER,
});

const bindingFor = () => new SeedlingCheckBinding({ table, placementKey, selfPlayer: SELF_PLAYER });
const types = (effects) => effects.map((e) => e.type);
/** The game's own payload for one entry, cleared (a collection). */
const report = (entry, { seq = 1, cleared = true } = {}) =>
    `${seq}|${entry.level}|${entry.tag}|${cleared ? 0 : 1}`;

describe('the payload', () => {
    it('parses the four fields the AS3 writes, and STRIPS the seq', () => {
        expect(parsePendingCheck('12|19|4|0')).toEqual({ seq: 12, level: 19, tag: 4, cleared: true });
        expect(parsePendingCheck('12|19|4|1')).toEqual({ seq: 12, level: 19, tag: 4, cleared: false });
        expect(PENDING_CHECK_FIELDS).toBe(4);
    });

    it('refuses the EMPTY boot report and anything malformed', () => {
        // BridgeGeneric reports every declared property once at boot — measured
        // on p4c at W5-0, where the first burst carried the empty string.
        for (const bad of ['', null, undefined, 7, '1|19|4', '1|19|4|0|x', '1|19|4|2', 'a|19|4|0',
            '1|19|4|', '1.5|19|4|0']) {
            expect(parsePendingCheck(bad)).toBeNull();
        }
    });
});

describe('the filter is the PLACEMENT TABLE, never a vanilla tag list', () => {
    it('checks a location whose tag is VANILLA', () => {
        const entry = entries.find((e) => e.tagSource === 'vanilla');
        const out = bindingFor().onStateReport('pendingCheck', report(entry));
        expect(types(out)).toEqual(['locationCheck', 'apItemFound']);
        expect(out[0].location).toBe(entry.location);
    });

    /**
     * ⛔⛔ THE ROW THE OBVIOUS IMPLEMENTATION FAILS. Eleven of the 39 have no
     * vanilla `@tag` at all — `bosskey`, `totempart` and `seed` take none in
     * `Game.as`'s XML loop — so their addresses are ALLOCATED out of each
     * room's free slots. A filter keyed on the tags the vanilla level data uses
     * would drop every one of these checks, and the player would collect an
     * item Archipelago never learns about.
     */
    it('checks a location whose tag is ALLOCATED — and there are 11 of them', () => {
        const allocated = entries.filter((e) => e.tagSource === 'allocated');
        expect(allocated).toHaveLength(11);
        for (const entry of allocated) {
            const out = bindingFor().onStateReport('pendingCheck', report(entry));
            expect(types(out)).toEqual(['locationCheck', 'apItemFound']);
        }
    });

    it('every one of the table\'s addresses is answered, and the table is not small', () => {
        expect(table.size).toBe(39);
        for (const entry of entries) {
            expect(types(bindingFor().onStateReport('pendingCheck', report(entry))))
                .toEqual(['locationCheck', 'apItemFound']);
        }
    });

    /**
     * ⛓ `Lock.turnOff()` clears a slot exactly the way a pickup does, and it is
     * one of ~50 `setPersistence` callers. The address is what separates them.
     */
    it('a clear at an address the table does not hold is SILENT — a lock, a door, a boss', () => {
        const b = bindingFor();
        // A tag past Game.tagsPerLevel's range for a level in the table, and a
        // level nothing in the table names.
        expect(b.onStateReport('pendingCheck', `1|${entries[0].level}|29|0`)).toEqual([]);
        expect(b.onStateReport('pendingCheck', '1|113|0|0')).toEqual([]);
        expect(b.stats.unknown).toBe(2);
        expect(b.stats.checks).toBe(0);
    });
});

describe('the fourth field — a RESTORE is not a check', () => {
    /**
     * ⛔⛔ SIX OF ~50 WRITERS RESTORE A SLOT WITH `true`
     * (`Lock.returnToNormal`, `RockLock:73`, `BossLock:89`, `LightPole:97`,
     * `ButtonRoom:93,96`) — and `ButtonRoom:93` writes a slot in ANOTHER room,
     * out of exactly the free-tag pool the rewriter allocates from. Without
     * this field a button could credit a check the player never earned.
     */
    it('`|1` at a REAL table address dispatches NOTHING', () => {
        const entry = entries[0];
        const b = bindingFor();
        expect(b.onStateReport('pendingCheck', report(entry, { cleared: false }))).toEqual([]);
        expect(b.stats.restores).toBe(1);
        expect(b.stats.checks).toBe(0);
        // and the same address, cleared, still works afterwards
        expect(types(b.onStateReport('pendingCheck', report(entry, { seq: 2 }))))
            .toEqual(['locationCheck', 'apItemFound']);
    });

    it('the mutant: accepting any value checks a location a ButtonRoom restore never earned', () => {
        // Driven by hand, because the guard is one `if`: with the polarity
        // dropped, the restore above becomes a check.
        const entry = entries[0];
        const parsed = parsePendingCheck(report(entry, { cleared: false }));
        expect(parsed.cleared).toBe(false);
        expect(table.has(placementKey(parsed.level, parsed.tag))).toBe(true);
    });
});

describe('one location, one check', () => {
    it('a re-entry that re-clears the same slot does NOT check twice', () => {
        const entry = entries[0];
        const b = bindingFor();
        expect(types(b.onStateReport('pendingCheck', report(entry, { seq: 1 }))))
            .toEqual(['locationCheck', 'apItemFound']);
        expect(b.onStateReport('pendingCheck', report(entry, { seq: 2 }))).toEqual([]);
        expect(b.stats.repeats).toBe(1);
    });

    it('a fresh adapter forgets what was checked — the game starts over, so may we', () => {
        const entry = entries[0];
        const b = bindingFor();
        b.onStateReport('pendingCheck', report(entry));
        b.onGameRestart();
        expect(types(b.onStateReport('pendingCheck', report(entry, { seq: 9 }))))
            .toEqual(['locationCheck', 'apItemFound']);
    });

    it('ignores every property but its own', () => {
        const b = bindingFor();
        for (const p of ['level', 'playerPositionX', 'pendingExit', 'hasSword']) {
            expect(b.onStateReport(p, '1|19|4|0')).toEqual([]);
        }
        expect(b.stats.reports).toBe(0);
    });
});

describe('the readout — "found X for Player Y"', () => {
    it('names the item and the receiving player, off the table and not the server', () => {
        const entry = entries[0];
        const [, found] = bindingFor().onStateReport('pendingCheck', report(entry));
        expect(found).toMatchObject({
            location: entry.location, item: entry.item, player: entry.player,
            forSelf: entry.player === SELF_PLAYER,
        });
    });

    it('a FOREIGN player\'s item is not marked as ours', () => {
        const foreign = new Map(table);
        const entry = { ...entries[0], player: SELF_PLAYER + 1, item: 'Some Other World Thing' };
        foreign.set(placementKey(entry.level, entry.tag), entry);
        const b = new SeedlingCheckBinding({ table: foreign, placementKey, selfPlayer: SELF_PLAYER });
        const [, found] = b.onStateReport('pendingCheck', report(entry));
        expect(found).toMatchObject({ forSelf: false, player: SELF_PLAYER + 1 });
    });
});

describe('what the adapter is told to stand down on', () => {
    /**
     * ⛓ A SET, NOT A DELETE, and this is the row that says why. The two
     * ENCOUNTER locations are boss/special grants with no pickup entity — they
     * are not rewritten, no `APItem` stands there, and they MUST keep the
     * adapter's property path.
     */
    it('names the 39 rewritten locations and NOT the two encounters', () => {
        const owned = bindingFor().hostOwnedLocations();
        expect(owned.size).toBe(39);
        expect(encounters).toHaveLength(2);
        for (const e of encounters) expect(owned.has(e.location)).toBe(false);
        for (const e of entries) expect(owned.has(e.location)).toBe(true);
    });
});

describe('the dependencies are INJECTED, and it refuses without them', () => {
    it('refuses by name without the table — this module never imports the rewriter', () => {
        expect(() => new SeedlingCheckBinding({ placementKey })).toThrow(/`table`/);
        expect(() => new SeedlingCheckBinding({ table })).toThrow(/`placementKey`/);
    });

    it('uses the rewriter\'s OWN key function, so the two spellings cannot drift', () => {
        const entry = entries[0];
        const seen = [];
        const b = new SeedlingCheckBinding({
            table,
            placementKey: (level, tag) => { seen.push([level, tag]); return placementKey(level, tag); },
            selfPlayer: SELF_PLAYER,
        });
        b.onStateReport('pendingCheck', report(entry));
        expect(seen).toEqual([[entry.level, entry.tag]]);
    });
});
