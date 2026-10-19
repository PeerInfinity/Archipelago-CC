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
const { table, entries, fixed } = buildPlacementTable({
    locationItemOf: (n) => PLACED.get(n) ?? null,
    ledger: R7_GOAL_LEDGER,
    rooms: MAP.levels,
    selfPlayer: SELF_PLAYER,
    bossReport: true,
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
        expect(table.size).toBe(48);  // 39 rewritten + the 9 fixed report rows (R4b part 2)
        for (const entry of [...entries, ...fixed]) {
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
     * ⛓ A SET, NOT A DELETE. ⛓ R4b part 2: the nine report rows (seven boss kills, the Fire drop, the dark sword)
     * are TABLE rows now, so the set is every table row — and the property path's own names for the two flags the
     * host grants (`propertyLocations`), so it never undoes them.
     */
    it('names the 39 rewritten locations AND the 9 fixed report rows; and the property names it is handed', () => {
        expect(fixed).toHaveLength(9);
        const owned = bindingFor().hostOwnedLocations();
        expect(owned.size).toBe(48);
        for (const e of [...entries, ...fixed]) expect(owned.has(e.location)).toBe(true);
        const named = new SeedlingCheckBinding({ table, placementKey, propertyLocations: ['Fire', 'Dark Sword', '', 7] })
            .hostOwnedLocations();
        expect(named.size).toBe(50);
        expect(named.has('Fire') && named.has('Dark Sword')).toBe(true);
    });
});

describe('⛓ R4b part 2 — the nine fixed-address report rows check like any other', () => {
    const ADDRESSES = {
        'Level 032 - Times': '32|3', 'Level 032 - Bob Boss': '32|4', 'Level 012 - Witch': '12|1',
        'Level 112 - Owl': '112|0', 'Level 019 - Shieldspire': '19|0', 'Level 057 - Tentacled Beast': '57|0',
        'Level 043 - Totem of Lacste': '43|5', 'Level 069 - Lights': '69|0', 'Level 082 - King of Fire': '82|0',
    };
    it('each of the 9 is a table row at its upstream address, and its clear checks it exactly once', () => {
        expect(Object.fromEntries(fixed.map((e) => [e.location, placementKey(e.level, e.tag)]))).toEqual(ADDRESSES);
        const b = bindingFor();
        for (const [i, e] of fixed.entries()) {
            const out = b.onStateReport('pendingCheck', report(e, { seq: i + 1 }));
            expect(types(out), e.location).toEqual(['locationCheck', 'apItemFound']);
            expect(out[0]).toMatchObject({ location: e.location, level: e.level, tag: e.tag });
            expect(b.onStateReport('pendingCheck', report(e, { seq: 100 + i }))).toEqual([]);
        }
        expect(b.stats).toMatchObject({ checks: 9, repeats: 9 });
    });

    it('⛔ the retired FLAG path: `hasFire` / `hasDarkSword` turning true checks NOTHING (the host\'s own grant)', () => {
        const b = bindingFor();
        expect(b.onStateReport('hasFire', true)).toEqual([]);
        expect(b.onStateReport('hasDarkSword', true)).toEqual([]);
        expect(b.stats.checks).toBe(0);
    });
});

describe('⛓ R4b part 2 — THE RECONCILE: a clear the single report slot lost is still checked', () => {
    const owl = fixed.find((e) => e.location === 'Level 112 - Owl');
    /** `FinalBoss.endAnim` clears (112,0) then (112,1) in ONE update: only the last reaches `pendingCheck`. */
    it('the Owl: (112,0) and (112,1) cleared in one tick → the live report is (112,1); the re-read checks the Owl', () => {
        const b = bindingFor();
        expect(table.has(placementKey(112, 1))).toBe(false);  // (112,1) is the rocklock EVENT, not a location
        const before = b.liveClears;
        expect(b.onStateReport('pendingCheck', '7|112|1|0')).toEqual([]);
        expect(b.liveClears).toBe(before + 1);  // the glue's trigger to re-read
        const out = b.onReconcile([{ level: 112, tag: 0 }, { level: 112, tag: 1 }]);
        expect(types(out)).toEqual(['locationCheck', 'apItemFound']);
        expect(out[0]).toMatchObject({ location: owl.location, level: 112, tag: 0, at: 'reconcile' });
        expect(b.stats).toMatchObject({ checks: 1, reconcile: 1, reconcileReads: 1 });
        // once: neither a second re-read nor a late live report checks it again
        expect(b.onReconcile([{ level: 112, tag: 0 }])).toEqual([]);
        expect(b.onStateReport('pendingCheck', report(owl, { seq: 9 }))).toEqual([]);
    });

    it('a re-read credits only TABLE addresses, and not an already-checked one; no array is not a read', () => {
        const b = bindingFor();
        const [a, c] = entries;
        b.onStateReport('pendingCheck', report(a));
        const out = b.onReconcile([{ level: a.level, tag: a.tag }, { level: c.level, tag: c.tag }, { level: 0, tag: 29 }]);
        expect(out.filter((e) => e.type === 'locationCheck').map((e) => e.location)).toEqual([c.location]);
        expect(b.onReconcile(null)).toEqual([]);
        expect(b.stats.reconcileReads).toBe(1);
    });

    it('⛔ the arming window holds: a clear refused there is NOT credited by a later re-read; a later LIVE clear is', () => {
        const b = bindingFor();
        const e = entries[0];
        b.ignoreHostStart({ from: 4, to: 5 });
        b.onStateReport('pendingCheck', report(e, { seq: 5 }));
        expect(b.liveClears).toBe(0);  // a declaration asks for no re-read
        expect(b.onReconcile([{ level: e.level, tag: e.tag }])).toEqual([]);
        expect(types(b.onStateReport('pendingCheck', report(e, { seq: 6 })))).toEqual(['locationCheck', 'apItemFound']);
    });

    it('a RESTORE asks for no re-read', () => {
        const b = bindingFor();
        b.onStateReport('pendingCheck', report(entries[0], { cleared: false }));
        expect(b.liveClears).toBe(0);
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

describe('⛓ W2 — ⚖ W0-Q1: a check fired inside a host botStart\'s arming window is NOT a check', () => {
    it('an UNEARNED clear whose seq falls in the window makes no check — counted in armingWindow', () => {
        const b = bindingFor();
        const entry = entries[0];
        expect(b.ignoreHostStart({ from: 4, to: 5 })).toBe(true);
        expect(b.onStateReport('pendingCheck', report(entry, { seq: 5 }))).toEqual([]);
        expect(b.stats).toMatchObject({ checks: 0, armingWindow: 1 });
        expect(b.checked.size).toBe(0);
    });

    it('the SAME clear collected for real, after the window (a later seq), checks once', () => {
        const b = bindingFor();
        const entry = entries[0];
        b.ignoreHostStart({ from: 4, to: 5 });
        b.onStateReport('pendingCheck', report(entry, { seq: 5 }));
        expect(types(b.onStateReport('pendingCheck', report(entry, { seq: 6 })))).toEqual(['locationCheck', 'apItemFound']);
        expect(b.stats).toMatchObject({ checks: 1, armingWindow: 1 });
    });

    it('an EARNED clear re-declared in the window stays a repeat (the dedupe answers first)', () => {
        const b = bindingFor();
        const entry = entries[0];
        b.onStateReport('pendingCheck', report(entry, { seq: 1 }));
        b.ignoreHostStart({ from: 1, to: 2 });
        expect(b.onStateReport('pendingCheck', report(entry, { seq: 2 }))).toEqual([]);
        expect(b.stats).toMatchObject({ checks: 1, repeats: 1, armingWindow: 0 });
    });

    it('a seq at the window\'s lower bound (written BEFORE the botStart) still checks; an empty window is refused', () => {
        const b = bindingFor();
        b.ignoreHostStart({ from: 4, to: 6 });
        expect(types(b.onStateReport('pendingCheck', report(entries[0], { seq: 4 })))).toEqual(['locationCheck', 'apItemFound']);
        expect(b.ignoreHostStart({ from: 3, to: 3 })).toBe(false);
        expect(b.ignoreHostStart({ from: 'a', to: 3 })).toBe(false);
    });

    it('a game restart forgets the windows (the seq counter restarts with the page)', () => {
        const b = bindingFor();
        b.ignoreHostStart({ from: 0, to: 1 });
        b.onGameRestart();
        expect(types(b.onStateReport('pendingCheck', report(entries[0], { seq: 1 })))).toEqual(['locationCheck', 'apItemFound']);
    });
});
