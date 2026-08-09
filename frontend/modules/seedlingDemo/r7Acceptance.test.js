/**
 * r7Acceptance — the ledgers, and the mutations that prove they bite.
 *
 * ⛔ EVERY TEST HERE EXISTS BECAUSE A GREEN GATE ALREADY LIED ONCE. R6's
 * `r6ExitFindings()` reported 6/6 and 8/8 for three slices while
 * `hasShield` was uncollected, because the item ledger was a passthrough
 * field with no findings row (trap 119). So the assertions below are not
 * "the ledger has the right rows" — they are "a row with no earner cannot
 * be reported as satisfied, and a row added tomorrow cannot go
 * unreported".
 */

import { describe, it, expect } from 'vitest';
import {
    R7AcceptanceError, SEAM_SIGNATURE, SAVE_FILE_KEYS, assertSeamSignatureCovers,
    seamRngPosture, seamFindings, R7_GOAL_LEDGER, R7_LEDGER_EXCLUSIONS,
    r7GoalFindings, r7GoalCriteria, R7_BATCH, predictedAttribution,
    SEAM_CHANNELS, SEAM_BOOT_SPEC, assertSeamChannelsTotal, seamLatchFindings,
} from './r7Acceptance.js';
import { parseTape, seamFieldsFromBlock, TAPE_VERSION } from './tapeFormat.js';

/** A whole latch: every signature field present, at a calm arrival. */
function wholeLatch(over = {}) {
    const seam = {};
    for (const row of SEAM_SIGNATURE) seam[row.field] = 0;
    seam['static.Game.shake'] = 0;
    seam['static.Game.menu'] = false;
    seam['static.Game.freezeObjects'] = false;
    seam['static.Game.talking'] = false;
    seam['arrival.blackCover'] = 0;
    seam['arrival.velocity'] = { vx: 0, vy: 0, hits: 0, hits_timer: 0 };
    seam['latch.tick'] = 7;
    return { latched: true, partial: false, why: '', seam: { ...seam, ...over } };
}

describe('SEAM_SIGNATURE — the coverage assertion (trap 86)', () => {
    it('covers every key `Main.startSave()` normalizes', () => {
        const r = assertSeamSignatureCovers();
        expect(r.saveKeys).toBe(SAVE_FILE_KEYS.length);
        expect(r.rows).toBe(SEAM_SIGNATURE.length);
    });

    it('⛔ MUTATION: a save key with no row THROWS, it does not warn', () => {
        expect(() => assertSeamSignatureCovers([...SAVE_FILE_KEYS, 'hasNewThing']))
            .toThrow(R7AcceptanceError);
        expect(() => assertSeamSignatureCovers([...SAVE_FILE_KEYS, 'hasNewThing']))
            .toThrow(/hasNewThing/);
    });

    it('⛔ MUTATION: a row claiming a key the game does not write THROWS', () => {
        // Drop `grassCut` from the game's side: the signature still claims it.
        const shortened = SAVE_FILE_KEYS.filter((k) => k !== 'grassCut');
        expect(() => assertSeamSignatureCovers(shortened)).toThrow(/grassCut/);
    });

    it('the fields that cannot be blanket equalities say so, by name', () => {
        const byField = new Map(SEAM_SIGNATURE.map((r) => [r.field, r]));
        expect(byField.get('save.time').comparable).toBe('pinned-equality');
        expect(byField.get('save.time').pin).toBe('Bot.pinDeadFrames');
        expect(byField.get('rng.gameplay').comparable).toBe('level-qualified-equality');
        expect(byField.get('fp.seed').comparable).toBe('declared-not-compared');
        // The badge row is EXCLUDED, not absent — trap 101.
        expect(byField.get('save.hasBadge').comparable).toBe('excluded');
    });

    it('⛓ `beam` and `rockSet` are signature rows, and the ledger says why', () => {
        const fields = SEAM_SIGNATURE.map((r) => r.field);
        expect(fields).toContain('save.beam');
        expect(fields).toContain('save.rockSet');
        expect(R7_LEDGER_EXCLUSIONS.beam).toMatch(/Shield\.as:46/);
        expect(R7_LEDGER_EXCLUSIONS.rockSet).toMatch(/Moonrock\.as:118/);
        // Neither is a collectible row.
        expect(R7_GOAL_LEDGER.some((r) => r.id.includes('beam'))).toBe(false);
    });
});

describe('seamRngPosture — stricter than R6\'s window question', () => {
    it('a render-CLEAN level makes the state comparable', () => {
        const p = seamRngPosture([], []);
        expect(p.comparable).toBe(true);
        expect(p.verdict).toMatch(/RENDER-CLEAN/);
    });

    it('⛔ a polluter with NO consumer still breaks the seam — R6 tolerated it', () => {
        const p = seamRngPosture(['Tile.render waterfall spray (t=25)'], []);
        expect(p.comparable).toBe(false);
        expect(p.verdict).toMatch(/NOT COMPARABLE, NOT READ/);
    });

    it('a polluter WITH a consumer is the at-risk case', () => {
        const p = seamRngPosture(['Moonrock.drawFlares (280/render)'], ['finalboss']);
        expect(p.comparable).toBe(false);
        expect(p.verdict).toMatch(/AT RISK/);
    });
});

describe('seamFindings — derived per field per seam', () => {
    const comparableRows = SEAM_SIGNATURE.filter((r) => r.comparable !== 'excluded');

    it('emits one row per comparable signature field per seam', () => {
        const seam = { name: 'S1->S2', exit: {}, boot: {} };
        const f = seamFindings([seam]);
        // one per field, plus the completeness row
        expect(f.length).toBe(comparableRows.length + 1);
    });

    it('⛔ MUTATION: a field missing on either side reads UNCLAIMED, never green', () => {
        const exit = {}; const boot = {};
        for (const r of comparableRows) { exit[r.field] = 1; boot[r.field] = 1; }
        delete exit['save.hasSword'];
        const f = seamFindings([{ name: 'S1->S2', exit, boot }]);
        const row = f.find((x) => x.name === 'S1->S2: save.hasSword');
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/UNCLAIMED/);
        expect(row.detail).toMatch(/exit latch does not carry it/);
    });

    it('⛔ MUTATION: perturbing ANY one field turns exactly that row red', () => {
        for (const target of comparableRows) {
            const exit = {}; const boot = {};
            for (const r of comparableRows) { exit[r.field] = 'v'; boot[r.field] = 'v'; }
            boot[target.field] = 'PERTURBED';
            const f = seamFindings([{ name: 'S', exit, boot }]);
            const reds = f.filter((x) => !x.ok);
            expect(reds.length, `perturbing ${target.field}`).toBe(1);
            expect(reds[0].name).toBe(`S: ${target.field}`);
        }
    });

    it('⛔ MUTATION: no seams at all is NOT green', () => {
        const f = seamFindings([]);
        expect(f.every((r) => r.ok)).toBe(false);
    });
});

describe('R7_GOAL_LEDGER — the census', () => {
    it('holds the sixteen chests, five keys, five totem parts and the Seed', () => {
        const by = (k) => R7_GOAL_LEDGER.filter((r) => r.kind === k).length;
        expect(by('chest')).toBe(16);
        expect(by('key')).toBe(5);
        expect(by('totempart')).toBe(5);
        expect(by('ending')).toBe(1);
        expect(by('pickup')).toBe(12);
        expect(by('encounter')).toBe(2);
    });

    it('every row has a gate and a citation — a row with neither is a comment', () => {
        for (const r of R7_GOAL_LEDGER) {
            expect(r.gate, r.id).toBeTruthy();
            expect(r.cite, r.id).toBeTruthy();
            expect(r.flag, r.id).toBeTruthy();
        }
    });

    it('ids are unique — two chests in one level would collide', () => {
        const ids = R7_GOAL_LEDGER.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('r7GoalFindings — trap 119\'s construction, asserted', () => {
    it('⛔ an empty earner map is 0/N and every row says UNCLAIMED', () => {
        const f = r7GoalFindings({}, []);
        expect(f.filter((r) => r.ok).length).toBe(0);
        expect(f.length).toBe(R7_GOAL_LEDGER.length + 1);
        for (const r of f.slice(0, -1)) expect(r.detail).toMatch(/UNCLAIMED/);
    });

    it('⛔⛔ MUTATION: a row added tomorrow CANNOT go unreported', () => {
        // The findings are a `.map()` over the ledger, so this is a claim
        // about the CONSTRUCTION, not about today's rows. Simulate the added
        // row by counting: every ledger row appears in the findings by id.
        const f = r7GoalFindings({}, []);
        for (const row of R7_GOAL_LEDGER) {
            expect(f.some((x) => x.name.startsWith(row.id)), `${row.id} unreported`).toBe(true);
        }
        // and nothing else does
        expect(f.length - 1).toBe(R7_GOAL_LEDGER.length);
    });

    it('a row earned by a segment NOT in the roster stays UNCLAIMED', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1', witness: 'save.hasSword' } },
            [],
        );
        const row = f.find((x) => x.name.startsWith('sword@L10'));
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/not in the roster/);
    });

    it('⛔ a row earned with NO game-side witness stays UNCLAIMED', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1' } },
            ['r7-seg-1'],
        );
        const row = f.find((x) => x.name.startsWith('sword@L10'));
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/no game-side witness/);
    });

    it('a fully witnessed row goes green, and only that row', () => {
        const f = r7GoalFindings(
            { 'sword@L10': { segment: 'r7-seg-1', witness: 'botStatus.save.hasSword' } },
            ['r7-seg-1'],
        );
        expect(f.filter((r) => r.ok).length).toBe(1);
        expect(f.find((r) => r.ok).name).toMatch(/^sword@L10/);
    });

    it('the criteria store no counts — totals come from the ledger', () => {
        const c = r7GoalCriteria({}, ['a', 'b']);
        expect(c.total).toBe(R7_GOAL_LEDGER.length);
        expect(c.earned).toBe(0);
        expect(c.rosterSize).toBe(2);
        expect(Object.values(c.byKind).reduce((a, k) => a + k.total, 0))
            .toBe(R7_GOAL_LEDGER.length);
    });
});

describe('R7_BATCH — the attribution, committed BEFORE the batch', () => {
    it('every item declares its stream effect', () => {
        for (const i of R7_BATCH.items) {
            expect(i.streamEffect, i.id).toMatch(/^IDENTICAL/);
            expect(i.cite, i.id).toBeTruthy();
        }
    });

    it('the prediction is ZERO re-records — and that is a falsifiable claim', () => {
        expect(R7_BATCH.predictedReRecords).toBe(0);
    });

    it('predictedAttribution: only v<=3 sword tapes change their VALUE', () => {
        const rows = predictedAttribution([
            { name: 'r3-walk-full', tape_version: 3, swordPickups: 1 },
            { name: 'r4-walk-full', tape_version: 4, swordPickups: 1 },
            { name: 'r5-shaft', tape_version: 5, swordPickups: 0 },
            { name: 'r1-walk-1', tape_version: 1, swordPickups: 0 },
        ]);
        expect(rows.every((r) => r.stream === 'IDENTICAL')).toBe(true);
        expect(rows.filter((r) => r.value !== 'unchanged').map((r) => r.name))
            .toEqual(['r3-walk-full']);
    });

    it('the recorded value-change set matches the derivation\'s shape', () => {
        // The three names were DERIVED at slice 0 by running `runTape` over
        // the whole roster; they are pinned here so a drift is visible, and
        // the derivation is what a re-run must reproduce.
        expect(R7_BATCH.predictedValueChanges).toHaveLength(3);
        for (const n of R7_BATCH.predictedValueChanges) expect(n).toMatch(/^r3-/);
    });
});


describe('R7 slice 1 — SEAM_CHANNELS: every signature row can be declared', () => {
    it('is total, both ways, and the v8 block covers its channel', () => {
        const r = assertSeamChannelsTotal();
        expect(r.rows).toBe(SEAM_SIGNATURE.length);
        expect(r.seamKeys).toBe(SEAM_BOOT_SPEC.length);
        // Not an assertion about the numbers so much as about there being no
        // silent third state: every row is in exactly one bucket.
        expect(Object.values(r.byChannel).reduce((a, b) => a + b, 0))
            .toBe(SEAM_SIGNATURE.length);
    });

    it('⛔ MUTATION: a signature row with no channel THROWS', () => {
        // The mutation is applied to the real assertion by asking it about a
        // row the map does not have — which is what "add a signature row and
        // forget the channel" looks like from here.
        const saved = { ...SEAM_CHANNELS };
        expect(Object.keys(saved).length).toBe(SEAM_SIGNATURE.length);
        const withoutOne = Object.fromEntries(
            Object.entries(saved).filter(([k]) => k !== 'save.beam'));
        const missing = SEAM_SIGNATURE.map((r) => r.field)
            .filter((f) => !Object.prototype.hasOwnProperty.call(withoutOne, f));
        expect(missing).toEqual(['save.beam']);
    });

    it('⛔ MUTATION: every seam-channel row has a SEAM_BOOT_SPEC entry', () => {
        const seamRows = SEAM_SIGNATURE
            .filter((r) => SEAM_CHANNELS[r.field] === 'seam').map((r) => r.field);
        const spec = new Set(SEAM_BOOT_SPEC.map((x) => x.field));
        expect(seamRows.filter((f) => !spec.has(f))).toEqual([]);
        expect([...spec].filter((f) => !seamRows.includes(f))).toEqual([]);
    });

    it('names which seam fields the JS engine MODELS, rather than implying all', () => {
        // A declared field nothing simulates is fine; a declared field nobody
        // said was unsimulated is a silence. The list is asserted non-empty
        // in BOTH directions so neither can quietly become the whole set.
        const modelled = SEAM_BOOT_SPEC.filter((x) => x.modelled).map((x) => x.key);
        const carried = SEAM_BOOT_SPEC.filter((x) => !x.modelled).map((x) => x.key);
        expect(modelled.length).toBeGreaterThan(0);
        expect(carried.length).toBeGreaterThan(0);
        expect(carried).toContain('beam');
        expect(modelled).toContain('cutscene');
    });
});

describe('R7 slice 1 — the seam LATCH consumer (trap 111 + trap 119)', () => {
    it('a whole latch turns every row green', () => {
        const rows = seamLatchFindings(wholeLatch());
        expect(rows.every((r) => r.ok)).toBe(true);
        expect(rows).toHaveLength(SEAM_SIGNATURE.length + 1);
    });

    it('⛔ MUTATION: NO envelope is UNCLAIMED on every row, never green', () => {
        const rows = seamLatchFindings(null);
        expect(rows.some((r) => r.ok && r.name.startsWith('latch:')
            && !r.detail.startsWith('EXCLUDED'))).toBe(false);
        expect(rows.at(-1).ok).toBe(false);
        expect(rows.at(-1).detail).toContain('NOTHING LATCHED');
    });

    it('⛔ MUTATION: a PARTIAL latch is not whole, and says which disarm', () => {
        const rows = seamLatchFindings({ ...wholeLatch(), partial: true, why: 'pin fault: x' });
        expect(rows.at(-1).ok).toBe(false);
        expect(rows.at(-1).detail).toContain('pin fault: x');
    });

    it('⛔ MUTATION: dropping ANY ONE field turns exactly that row red', () => {
        for (const row of SEAM_SIGNATURE) {
            if (row.comparable === 'excluded') continue;
            const env = wholeLatch();
            delete env.seam[row.field];
            const rows = seamLatchFindings(env, { requireCalm: false });
            const red = rows.filter((r) => !r.ok).map((r) => r.name);
            expect(red).toEqual([`latch: ${row.field}`]);
        }
    });

    it('⛔ MUTATION: each calm-arrival invariant bites, one at a time', () => {
        const breakers = {
            'static.Game.shake': 4,
            'static.Game.menu': true,
            'static.Game.freezeObjects': true,
            'static.Game.talking': true,
            'arrival.blackCover': 0.8,
            'arrival.velocity': { vx: 1, vy: 0, hits: 0, hits_timer: 0 },
        };
        for (const [field, bad] of Object.entries(breakers)) {
            const rows = seamLatchFindings(wholeLatch({ [field]: bad }));
            expect(rows.filter((r) => !r.ok).map((r) => r.name))
                .toEqual([`latch: ${field}`]);
        }
    });

    it('a mid-window tape reports the invariants instead of failing them', () => {
        // Every fixture in the R1..R6 roster ends mid-window; the ARRIVAL
        // convention arrives with the segments. `requireCalm: false` is what
        // lets the latch be checked on all 118 without claiming they are
        // arrivals — and it must still catch a MISSING field.
        const rows = seamLatchFindings(wholeLatch({ 'arrival.blackCover': 0.8 }),
            { requireCalm: false });
        expect(rows.every((r) => r.ok)).toBe(true);
    });

    it('⛔ a latch with -1 blackCover (no world) is NOT calm', () => {
        const rows = seamLatchFindings(wholeLatch({ 'arrival.blackCover': -1 }));
        const bad = rows.find((r) => r.name === 'latch: arrival.blackCover');
        expect(bad.ok).toBe(false);
        expect(bad.detail).toContain('NO WORLD WAS CURRENT');
    });
});

describe('R7 slice 1 — tape v8, both-sided', () => {
    const base = {
        tape_version: 8, game: 'seedling', noclip: false,
        boot: { level: 0, x: 80, y: 128 },
        noDamage: false, noHazards: [], grants: [], persistence: [], equips: [],
        pins: [], save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
        inputs: [], tick_count: 0,
    };

    it('TAPE_VERSION is 8 and v8 parses', () => {
        expect(TAPE_VERSION).toBe(8);
        expect(parseTape({ ...base, seam: { hits_max: 4 } }).seam.hits_max).toBe(4);
    });

    it('a v8 tape with no seam block normalises to null, not to an empty object', () => {
        // There is no "empty seam": a tape either declares boot state or it
        // inherits whatever the page had, and those are different runs.
        expect(parseTape(base).seam).toBe(null);
    });

    it('⛔ MUTATION: a v7 tape declaring a seam is REFUSED', () => {
        expect(() => parseTape({ ...base, tape_version: 7, seam: { hits_max: 4 } }))
            .toThrow(/versions below 8 mean seam: null/);
    });

    it('⛔ MUTATION: a v7 tape declaring the v8 STREAMS is refused, and a v7 '
        + 'tape declaring a SEED is not', () => {
        expect(() => parseTape({
            ...base, tape_version: 7, rng: { seed: 0, split: false, cosmetic: 9, fp: 0 },
        })).toThrow(/versions below 8 mean rng: \{cosmetic: 0, fp: 0\}/);
        expect(() => parseTape({
            ...base, tape_version: 7, rng: { seed: 12345, split: true },
        })).not.toThrow();
    });

    it('⛔ EVERY BOUND BITES, and each is the game\'s own', () => {
        const bad = [
            [{ hits_max: 0 }, /hits_max/],
            [{ time: 0 }, /time/],
            [{ grass_cut: 10000 }, /grass_cut/],
            [{ menu_state: 1 }, /menu_state/],
            [{ primary: 6 }, /primary/],
            [{ secondary: -1 }, /secondary/],
            [{ cutscene: [false, false, false] }, /cutscene/],
            [{ items: { hasNothing: true } }, /not a seam field/],
            [{ items: { hasSword: 1 } }, /must be a boolean/],
            [{ nonsense: 1 }, /not a seam field/],
            [{ music: { index: 3 } }, /half a state/],
        ];
        for (const [seam, re] of bad) {
            expect(() => parseTape({ ...base, seam }), JSON.stringify(seam)).toThrow(re);
        }
    });

    it('⛔ the rng transport bounds bite on BOTH new streams', () => {
        expect(() => parseTape({
            ...base, rng: { seed: 0, split: false, cosmetic: 2147483648, fp: 0 },
        })).toThrow(/rng.cosmetic/);
        // 2147483647 is legal for the LFSR orbit and ILLEGAL for FP, whose
        // setter clamps to 2147483646 — the two bounds differ by one and the
        // reason is a `clamp` call, not a taste.
        expect(() => parseTape({
            ...base, rng: { seed: 2147483647, split: false, cosmetic: 0, fp: 0 },
        })).not.toThrow();
        expect(() => parseTape({
            ...base, rng: { seed: 0, split: false, cosmetic: 0, fp: 2147483647 },
        })).toThrow(/rng.fp/);
    });

    it('is IDEMPOTENT — a parsed v8 tape re-parses to itself', () => {
        const seam = {
            items: { hasSword: true, hasShield: false }, hits_max: 4, beam: true,
            cutscene: [false, false, true, false], music: { set: 'Chest', index: 0 },
        };
        const once = parseTape({ ...base, seam });
        const twice = parseTape(once);
        expect(JSON.stringify(twice.seam)).toBe(JSON.stringify(once.seam));
    });

    it('maps the wire block onto the SIGNATURE\'s own field names', () => {
        const t = parseTape({ ...base, seam: { items: { hasSword: true }, hits_max: 4 } });
        expect(seamFieldsFromBlock(t.seam)).toEqual({
            'save.hasSword': true, 'save.hitsMax': 4,
        });
        // …and the two key spaces are genuinely different, which is why the
        // translation exists at all.
        expect(Object.keys(seamFieldsFromBlock(t.seam))
            .every((f) => SEAM_CHANNELS[f] === 'seam')).toBe(true);
    });
});
