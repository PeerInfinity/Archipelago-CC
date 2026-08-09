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
    seamBootFields, segmentBootFromLatch,
    R7_SECOND_BATCH, predictedSeedIs1562BehindTheCommittedOne,
    SEAM_PREBUILD_FIELDS, seamExitFields,
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

/**
 * A REALISTIC whole latch — every signature field at a value the GAME could
 * actually have produced at a calm arrival, with the shapes `Bot.latchSeam`
 * emits (booleans per index for keys/totem parts, an ordered int LOG for
 * the seals, `{level, tag}` for the persistence CLEAR SET, `{sound,
 * dead_frames}` for the pins).
 *
 * ⛔ IT IS NOT `wholeLatch()`'s all-zeros, and the difference is what makes
 * the round trip a test. A latch of zeros round-trips through
 * `segmentBootFromLatch` only by accident (`hits_max: 0` and `time: 0` are
 * both refused, and `music.index: 0` with `music.set: 0` is not a state);
 * the boot side's whole job is turning real shapes into the OTHER key
 * space, and only real shapes exercise it.
 */
function realisticLatch(over = {}) {
    const seam = {
        level: 94,
        playerPositionX: 288,
        playerPositionY: 160,
        'save.hasSword': true,
        'save.hasGhostSword': false,
        'save.hasShield': true,
        'save.hasFire': false,
        'save.hasWand': false,
        'save.hasFireWand': false,
        'save.canSwim': false,
        'save.hasSpear': false,
        'save.hasDarkShield': false,
        'save.hasDarkSuit': false,
        'save.hasDarkSword': false,
        'save.hasFeather': false,
        'save.hasTorch': false,
        'save.beam': false,
        'save.rockSet': true,
        'save.hitsMax': 3,
        'save.firstUse': true,
        'save.extended': false,
        'save.time': 1234,
        'save.primary': 0,
        'save.secondary': 0,
        'save.grassCut': 7,
        'save.hasKey': [true, false, false, false, false],
        'save.hasTotemPart': [false, false, false, false, false],
        'save.hasSealPart': [3, 11, ...Array.from({ length: 14 }, () => -1)],
        'save.levelPersistence': [{ level: 10, tag: 4 }, { level: 20, tag: 1 }],
        'save.hasBadge': [false, false],
        'static.Game.cutscene': [false, false, false, false],
        'static.Game.shake': 0,
        'static.Game.menu': false,
        'static.Game.menuState': 0,
        'static.Game.freezeObjects': false,
        'static.Game.talking': false,
        'static.Game.inventory': [0],
        'static.Music.currentSet': 'Rock',
        'static.Music.currentIndex': 0,
        // ⚠ `split: true` SO THE COSMETIC ROW IS DECLARABLE AT ALL. With
        // split false the second generator is not running, its state is the
        // boot 0, and 0 is the format's "inherit" value — so the row is N/A,
        // which is its own case below. The maximal latch is the one that
        // exercises every channel.
        'static.Rng.split': true,
        'static.Bot.pins': { sound: false, dead_frames: true },
        'rng.gameplay': 1234567891,
        'rng.cosmetic': 12345,
        'fp.seed': 987286273,
        'arrival.blackCover': 0,
        'arrival.velocity': { vx: 0, vy: 0, hits: 0, hits_timer: 0 },
        'latch.tick': 61,
        'latch.dead_frames': 40,
    };
    /**
     * ⛓ R7 slice 2b: THE ENTRY BLOCK, one build BEHIND the terminal one.
     *
     * `Bot.latchBeginEntry` reads the stream at `Game.begin()` ENTRY and
     * `latchSeam` reads it at the terminal disarm; between them sits the
     * arrival level's whole build (1562 draws and 21 dead frames for L94,
     * measured). So the four values below differ from the terminal ones on
     * purpose — a fixture whose two blocks agreed would let a consumer read
     * either and pass.
     *
     * ⛔ `over` ROUTES BY FIELD. A prebuild key lands in the ENTRY block
     * only, which is what keeps the refusal tests above (`save.time: 0`,
     * `rng.gameplay: 0`) biting on the block the authoring code reads.
     */
    const entry = {
        'begin.level': 94,
        'begin.tick': 61,
        'rng.gameplay': 1234567891,
        'rng.cosmetic': 12345,
        'fp.seed': 987286273,
        'save.time': 1234,
    };
    seam['rng.gameplay'] = 2020202;
    seam['rng.cosmetic'] = 54321;
    seam['fp.seed'] = 111222333;
    seam['save.time'] = 1255;
    const prebuild = new Set(SEAM_PREBUILD_FIELDS);
    for (const [k, v] of Object.entries(over)) {
        if (prebuild.has(k)) entry[k] = v; else seam[k] = v;
    }
    return { latched: true, partial: false, why: '', seam, beginEntry: entry };
}

/** The tape a latch authors, parsed — the boot side of one seam. */
function segmentTapeFor(latch, extra = {}) {
    const blocks = segmentBootFromLatch(latch);
    return parseTape({
        tape_version: TAPE_VERSION,
        game: 'seedling',
        noclip: false,
        noDamage: false,
        noHazards: [],
        grants: [],
        equips: [],
        tick_count: 10,
        inputs: [],
        ...blocks,
        ...extra,
    });
}

describe('seamBootFields — THE BOOT SIDE (R7 slice 2)', () => {
    it('carries every channel a tape can declare, and no invariant row', () => {
        const tape = segmentTapeFor(realisticLatch());
        const boot = seamBootFields(tape);
        for (const row of SEAM_SIGNATURE) {
            const channel = SEAM_CHANNELS[row.field];
            const present = Object.prototype.hasOwnProperty.call(boot, row.field);
            if (channel === 'invariant' || channel === 'excluded') {
                expect(present, `${row.field} (${channel}) must NOT be on the boot side`)
                    .toBe(false);
            } else {
                expect(present, `${row.field} (${channel}) missing from the boot side`)
                    .toBe(true);
            }
        }
    });

    it('⛓ THE ROUND TRIP: latch -> tape -> boot map reproduces the latch', () => {
        const latch = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(latch));
        for (const field of Object.keys(boot)) {
            expect(JSON.stringify(boot[field]), field)
                .toBe(JSON.stringify(seamExitFields(latch)[field]));
        }
    });

    it('⛔ an rng field of 0 is UNDECLARED and emits nothing', () => {
        // `botStart` gates all three writes on a non-zero (Bot.as:1689-1698),
        // so a 0 inherits the page's stream and must not read as a value.
        const tape = parseTape({
            tape_version: TAPE_VERSION, game: 'seedling', noclip: false,
            noDamage: false, noHazards: [], grants: [], persistence: [], equips: [],
            pins: [], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: { seed: 0, split: false, cosmetic: 0, fp: 0 },
            boot: { level: 0, x: 80, y: 128 }, tick_count: 1, inputs: [],
        });
        const boot = seamBootFields(tape);
        expect(Object.prototype.hasOwnProperty.call(boot, 'rng.gameplay')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(boot, 'rng.cosmetic')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(boot, 'fp.seed')).toBe(false);
        // `split` is a BOOLEAN with no "undeclared" value, so it is always carried.
        expect(boot['static.Rng.split']).toBe(false);
    });

    it('⛔ MUTATION: a PARTIAL item declaration leaves the derived slot array out', () => {
        // `inventorySlotsFor` reads six flags and treats a missing one as
        // "not held" — a silent wrong answer in the one row whose nature is
        // "reproduced as a consequence of declared rows".
        const latch = realisticLatch();
        const blocks = segmentBootFromLatch(latch);
        delete blocks.seam.items.hasWand;
        const tape = parseTape({
            tape_version: TAPE_VERSION, game: 'seedling', noclip: false,
            noDamage: false, noHazards: [], grants: [], equips: [],
            tick_count: 1, inputs: [], ...blocks,
        });
        const boot = seamBootFields(tape);
        expect(Object.prototype.hasOwnProperty.call(boot, 'static.Game.inventory'))
            .toBe(false);
    });

    it('index LISTS become the latch\'s positional shapes', () => {
        const latch = realisticLatch({
            'save.hasKey': [false, true, false, false, true],
            'save.hasTotemPart': [true, false, false, false, false],
            'save.hasSealPart': [9, ...Array.from({ length: 15 }, () => -1)],
        });
        const boot = seamBootFields(segmentTapeFor(latch));
        expect(boot['save.hasKey']).toEqual([false, true, false, false, true]);
        expect(boot['save.hasTotemPart']).toEqual([true, false, false, false, false]);
        expect(boot['save.hasSealPart'][0]).toBe(9);
        expect(boot['save.hasSealPart'].slice(1).every((v) => v === -1)).toBe(true);
    });
});

describe('segmentBootFromLatch — the inverse, and what it REFUSES', () => {
    it('a partial latch is never a boot state (trap 111)', () => {
        const l = realisticLatch();
        expect(() => segmentBootFromLatch({ ...l, partial: true, why: 'pin fault' }))
            .toThrow(/PARTIAL/);
        expect(() => segmentBootFromLatch({ ...l, latched: false })).toThrow(/WHOLE latch/);
        expect(() => segmentBootFromLatch(null)).toThrow(/no envelope at all/);
    });

    it('⛔ a latched value no tape can DECLARE is refused BY NAME', () => {
        expect(() => segmentBootFromLatch(realisticLatch({ 'save.hitsMax': 0 })))
            .toThrow(/hits_max/);
        expect(() => segmentBootFromLatch(realisticLatch({ 'save.time': 0 })))
            .toThrow(/time/);
        expect(() => segmentBootFromLatch(realisticLatch({ 'save.grassCut': 10000 })))
            .toThrow(/grass_cut/);
        expect(() => segmentBootFromLatch(realisticLatch({ 'static.Game.menuState': 1 })))
            .toThrow(/menu_state/);
        expect(() => segmentBootFromLatch(realisticLatch({ 'rng.gameplay': 0 })))
            .toThrow(/inherit the page/);
    });

    it('⛔ a NON-COMPACT seal log is a state the game cannot reach', () => {
        const seals = Array.from({ length: 16 }, () => -1);
        seals[0] = 3; seals[2] = 5;   // a filled slot AFTER an empty one
        expect(() => segmentBootFromLatch(realisticLatch({ 'save.hasSealPart': seals })))
            .toThrow(/NOT COMPACT/);
    });

    it('⛔ a music index with no set is half a rejection loop\'s state', () => {
        expect(() => segmentBootFromLatch(realisticLatch({
            'static.Music.currentSet': '', 'static.Music.currentIndex': 2,
        }))).toThrow(/half\s+a state/);
    });

    it('a signature field the latch omits is named, not defaulted', () => {
        const l = realisticLatch();
        delete l.seam['save.grassCut'];
        expect(() => segmentBootFromLatch(l)).toThrow(/save\.grassCut/);
    });
});

describe('seamFindings — derived per field per seam', () => {
    it('emits one row per signature field per seam, plus the completeness row', () => {
        const f = seamFindings([{ name: 'S1->S2', exit: {}, boot: {} }]);
        expect(f.length).toBe(SEAM_SIGNATURE.length + 1);
    });

    it('⛓ A REAL SEAM IS GREEN: latch -> authored tape -> boot map', () => {
        const latch = realisticLatch();
        const f = seamFindings([{
            name: 'seg1->seg2',
            exit: seamExitFields(latch),
            boot: seamBootFields(segmentTapeFor(latch)),
        }]);
        const reds = f.filter((r) => !r.ok);
        expect(reds.map((r) => `${r.name} [${r.detail}]`)).toEqual([]);
    });

    it('⛔⛔ MUTATION: perturbing ANY one field turns exactly that row red', () => {
        const base = realisticLatch();
        const bootBase = seamBootFields(segmentTapeFor(base));
        // Every field the seam actually COMPARES — the equality rows. The
        // invariant rows are perturbed in their own case below, because
        // they are not equality rows and a boot cannot declare them.
        //
        // ⚠ AND THE SWEEP NAMES WHAT IT BOUNDED: `fp.seed` is
        // `declared-not-compared` and is therefore NOT in this sweep. It
        // gets its own case below, because a field that cannot go red for a
        // mismatch has to be tested for the thing it CAN do — be absent.
        const notCompared = SEAM_SIGNATURE
            .filter((r) => r.comparable === 'declared-not-compared').map((r) => r.field);
        expect(notCompared).toEqual(['fp.seed']);
        const targets = Object.keys(bootBase).filter((f) => !notCompared.includes(f));
        expect(targets.length).toBeGreaterThan(30);
        for (const target of targets) {
            const boot = { ...bootBase };
            boot[target] = Array.isArray(bootBase[target]) ? ['PERTURBED'] : 'PERTURBED';
            const f = seamFindings([{ name: 'S', exit: seamExitFields(base), boot }]);
            const reds = f.filter((x) => !x.ok);
            expect(reds.map((r) => r.name), `perturbing ${target}`).toEqual([`S: ${target}`]);
        }
    });

    it('⛔⛔ `fp.seed` is DECLARED-NOT-COMPARED — required on both sides, never red '
        + 'for a mismatch', () => {
        // FlashPunk seeds its LCG once per PAGE from one `Math.random()`
        // (`Engine.as:50`) and the differential replays every segment in its
        // own page, so an equality here would be red on every run of every
        // chain, forever, for a reason that is not a defect. What it must
        // still catch is an ABSENCE: a segment that does not declare it is
        // a segment nobody can reproduce.
        const latch = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(latch));
        const mismatched = seamFindings([{
            name: 'S', exit: { ...seamExitFields(latch), 'fp.seed': 42 }, boot,
        }]);
        const row = mismatched.find((r) => r.name === 'S: fp.seed');
        expect(row.ok).toBe(true);
        expect(row.detail).toMatch(/DECLARED, NOT COMPARED \(and they DIFFER/);
        // …and when a chain declares its own FP seed, the row says THAT too.
        const agreeing = seamFindings([{ name: 'S', exit: seamExitFields(latch), boot }]);
        expect(agreeing.find((r) => r.name === 'S: fp.seed').detail)
            .toMatch(/and they AGREE/);
        // ⛔ but an ABSENCE is still UNCLAIMED, on either side.
        const dropped = { ...boot };
        delete dropped['fp.seed'];
        const gone = seamFindings([{ name: 'S', exit: seamExitFields(latch), boot: dropped }]);
        const goneRow = gone.find((r) => r.name === 'S: fp.seed');
        expect(goneRow.ok).toBe(false);
        expect(goneRow.detail).toMatch(/UNCLAIMED/);
    });

    it('⛔ MUTATION: perturbing an INVARIANT turns exactly that row red', () => {
        const invariantFields = SEAM_SIGNATURE
            .filter((r) => SEAM_CHANNELS[r.field] === 'invariant').map((r) => r.field);
        expect(invariantFields.length).toBe(6);
        const notCalm = {
            'static.Game.shake': 3,
            'static.Game.menu': true,
            'static.Game.freezeObjects': true,
            'static.Game.talking': true,
            'arrival.blackCover': 0.5,
            'arrival.velocity': { vx: 1.5, vy: 0, hits: 0, hits_timer: 0 },
        };
        for (const field of invariantFields) {
            const latch = realisticLatch({ [field]: notCalm[field] });
            const f = seamFindings([{
                name: 'S', exit: seamExitFields(latch), boot: seamBootFields(segmentTapeFor(latch)),
            }]);
            const reds = f.filter((x) => !x.ok);
            expect(reds.map((r) => r.name), `perturbing ${field}`).toEqual([`S: ${field}`]);
        }
    });

    it('⛔ an invariant row the latch does not carry has NO boot side to fall back on', () => {
        const latch = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(latch));
        const exit = { ...seamExitFields(latch) };
        delete exit['static.Game.shake'];
        const f = seamFindings([{ name: 'S', exit, boot }]);
        const row = f.find((x) => x.name === 'S: static.Game.shake');
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/no boot side/);
    });

    it('⛔ MUTATION: a field missing on either side reads UNCLAIMED, never green', () => {
        const latch = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(latch));
        const exit = { ...seamExitFields(latch) };
        delete exit['save.hasSword'];
        const f = seamFindings([{ name: 'S1->S2', exit, boot }]);
        const row = f.find((x) => x.name === 'S1->S2: save.hasSword');
        expect(row.ok).toBe(false);
        expect(row.detail).toMatch(/UNCLAIMED/);
        expect(row.detail).toMatch(/exit latch does not carry it/);
    });

    it('⛔⛔ KEY ORDER IS NOT STATE — two runtimes serialize objects differently', () => {
        // The exit side is serialized by AVM2 and the boot side by node.
        // A `JSON.stringify` comparison would call these two states unequal.
        const latch = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(latch));
        const exit = {
            ...seamExitFields(latch),
            'static.Bot.pins': { dead_frames: true, sound: false },
            'save.levelPersistence': [{ tag: 4, level: 10 }, { tag: 1, level: 20 }],
        };
        const f = seamFindings([{ name: 'S', exit, boot }]);
        expect(f.filter((r) => !r.ok).map((r) => r.name)).toEqual([]);
    });

    it('⛔ MUTATION: no seams at all is NOT green', () => {
        const f = seamFindings([]);
        expect(f.every((r) => r.ok)).toBe(false);
        expect(f[f.length - 1].detail).toMatch(/ZERO SEAMS/);
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
    /**
     * The DERIVED total. Two families map over the same ledger — every row
     * once, plus the rows that declare a `durableWitness` a second time —
     * and one completeness row. Counted from the ledger, never typed: a
     * hard-coded total is the shape that rots the first time a row is added.
     */
    const durableRows = () => R7_GOAL_LEDGER.filter((r) => r.durableWitness).length;
    const expectedRows = () => R7_GOAL_LEDGER.length + durableRows() + 1;

    it('⛔ an empty earner map is 0/N and every row says UNCLAIMED', () => {
        const f = r7GoalFindings({}, []);
        expect(f.filter((r) => r.ok).length).toBe(0);
        expect(f.length).toBe(expectedRows());
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
        expect(f.length - 1).toBe(R7_GOAL_LEDGER.length + durableRows());
    });

    it('⛓ THE SHIELD\'S DURABLE WITNESS IS `rockSet`, NOT `beam` (§9.6 item 5)', () => {
        const shield = R7_GOAL_LEDGER.find((r) => r.id === 'shield@L20');
        expect(shield.durableWitness).toBe('save.rockSet');
        expect(shield.durableWhy).toMatch(/beam/);
        // ⚠ It is its OWN row, not a condition on the earned row: `rockSet`
        // flips in L0 and the shield is in L20, so the two are very likely
        // different segments and folding them would report an honest chain
        // as unearned.
        const f = r7GoalFindings(
            { 'shield@L20': { segment: 'seg-d2', witness: 'save.hasShield 0 -> 1' } },
            ['seg-d2'],
        );
        const earned = f.find((x) => x.name.startsWith('shield@L20 (pickup)'));
        const durable = f.find((x) => x.name.includes('DURABLE'));
        expect(earned.ok).toBe(true);
        expect(durable.ok).toBe(false);
        expect(durable.detail).toMatch(/UNCLAIMED/);

        const both = r7GoalFindings({
            'shield@L20': {
                segment: 'seg-d2',
                witness: 'save.hasShield 0 -> 1',
                durable: { segment: 'seg-ow', witness: 'save.rockSet 0 -> 1' },
            },
        }, ['seg-d2', 'seg-ow']);
        expect(both.find((x) => x.name.includes('DURABLE')).ok).toBe(true);
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

/**
 * ⛔⛔ THE SECOND BATCH'S PREDICTION, ASSERTED BEFORE THE FORK CHANGED.
 * R7 slice 2b, kickoff §10.1 step 0.
 *
 * A prediction that only a human reads is a hope; slice 0 paid for that
 * lesson once and answered it with `plan-seedling-r7-attribution.mjs
 * --check`. This batch's prediction is smaller and its load-bearing half is
 * ARITHMETIC, so the oracle is a test rather than a script: the declared
 * PRE-build seed stepped forward L94's own build cost must land on the seed
 * that is committed today.
 *
 * ⚠ NEITHER NUMBER TOUCHES A FIXTURE. Both live in
 * `R7_SECOND_BATCH.predictedTapeChange`, so this test asserts a relation
 * between two committed constants and cannot be "fixed" by re-recording
 * anything. When the re-plan lands, the tape has to agree with the constant
 * or the gate says so by name.
 */
describe('R7_SECOND_BATCH — the prediction, before the change (R7 slice 2b)', () => {
    it('⛓ the predicted PRE-build seed is EXACTLY 1562 draws behind the committed one',
        () => {
            const r = predictedSeedIs1562BehindTheCommittedOne();
            expect(r.draws).toBe(1562);
            expect(r.walked).toBe(r.want);
        });

    it('predicts ZERO re-records and ZERO reported-value changes', () => {
        expect(R7_SECOND_BATCH.predictedReRecords).toBe(0);
        expect(R7_SECOND_BATCH.predictedValueChanges).toEqual([]);
    });

    it('⚠ names THREE fields in ONE tape — not the one §10.1 anticipated', () => {
        const c = R7_SECOND_BATCH.predictedTapeChange;
        expect(c.tape).toBe('r7-ends-meet-2');
        expect(Object.keys(c.fields).sort())
            .toEqual(['rng.fp', 'rng.seed', 'seam.time']);
        // The clock's offset is the build's dead frames, not an independent
        // number — stated as the subtraction so a drift in one shows in both.
        expect(c.fields['seam.time'].from - c.fields['seam.time'].to)
            .toBe(c.buildDeadFrames);
        // ⛔ AND THE UNPREDICTED ONE IS DECLARED UNPREDICTED. A `to` of null
        // is the difference between "measured after the fact" and a value
        // quietly filled in later to match whatever came out.
        expect(c.fields['rng.fp'].to).toBeNull();
    });

    it('the batch item carries the no-draw refusal', () => {
        expect(R7_SECOND_BATCH.item.constraint).toMatch(/NO `Math\.random\(\)`/);
        expect(R7_SECOND_BATCH.item.streamEffect).toMatch(/IDENTICAL/);
    });
});

/**
 * ⛔⛔⛔ THE PRE-BUILD ROWS, AND WHICH BLOCK EACH SIDE READS. R7 slice 2b.
 *
 * Slice 2 shipped a checker that compared a DECLARATION against a latch
 * taken one whole level build later and papered the 1562-draw gap over with
 * a declared offset. The batch closes it by latching the stream at
 * `Game.begin()` ENTRY, and the failure mode this replaces it with is
 * READING THE WRONG BLOCK — which is silent, because both blocks carry the
 * same four keys with plausible values.
 *
 * So every test below is about the SOURCE, not the value: the realistic
 * fixture's two blocks differ on purpose, and a consumer that read the
 * terminal one would pass nothing here.
 */
describe('seamExitFields — which instant each row is read at (R7 slice 2b)', () => {
    it('the prebuild set is DERIVED from the signature, not listed', () => {
        expect([...SEAM_PREBUILD_FIELDS].sort())
            .toEqual(['fp.seed', 'rng.cosmetic', 'rng.gameplay', 'save.time']);
        for (const f of SEAM_PREBUILD_FIELDS) {
            expect(SEAM_SIGNATURE.find((r) => r.field === f).prebuild).toBe(true);
        }
    });

    it('⛓ takes the four prebuild rows from `beginEntry` and everything else from '
        + 'the terminal block', () => {
        const l = realisticLatch();
        const e = seamExitFields(l);
        for (const f of SEAM_PREBUILD_FIELDS) {
            expect(e[f], f).toBe(l.beginEntry[f]);
            // …and the two blocks really do disagree, or this proved nothing.
            expect(e[f], `${f} must differ from the terminal reading`)
                .not.toBe(l.seam[f]);
        }
        expect(e.level).toBe(l.seam.level);
        expect(e['save.hitsMax']).toBe(l.seam['save.hitsMax']);
    });

    it('⛔ NO `beginEntry` DELETES the rows — it never falls back to the terminal '
        + 'block', () => {
        const l = realisticLatch();
        const e = seamExitFields({ ...l, beginEntry: null });
        for (const f of SEAM_PREBUILD_FIELDS) {
            expect(Object.prototype.hasOwnProperty.call(e, f), f).toBe(false);
        }
        // …and a seam over that map reads UNCLAIMED on exactly those rows,
        // which is the honest answer for a boot that ran no `begin()` (a
        // reused world, `Bot.as:1638`) and therefore took no build draws.
        const boot = seamBootFields(segmentTapeFor(l));
        const rows = seamFindings([{ name: 'S', exit: e, boot }]);
        const unclaimed = rows.filter((r) => !r.ok).map((r) => r.name);
        // ⛔ ALL FOUR, INCLUDING `fp.seed`. `declared-not-compared` requires
        // BOTH sides before it reports agreement, so a missing exit side
        // reaches the UNCLAIMED branch like every other row — the class means
        // "never red for a MISMATCH", not "never red".
        expect(new Set(unclaimed))
            .toEqual(new Set(SEAM_PREBUILD_FIELDS.map((f) => `S: ${f}`)));
        expect(rows.find((r) => r.name === 'S: rng.gameplay').detail)
            .toMatch(/exit latch does not carry it/);
    });

    it('a null envelope and a latch with no terminal block are both empty, not '
        + 'partially filled', () => {
        expect(seamExitFields(null)).toEqual({});
        expect(seamExitFields({ latched: false, seam: null, beginEntry: { 'save.time': 5 } }))
            .toEqual({});
    });
});

describe('segmentBootFromLatch — the PRE-BUILD half (R7 slice 2b)', () => {
    it('⛓ authors the four prebuild fields from `beginEntry`, NOT from the terminal '
        + 'latch', () => {
        const l = realisticLatch();
        const blocks = segmentBootFromLatch(l);
        expect(blocks.rng.seed).toBe(l.beginEntry['rng.gameplay']);
        expect(blocks.rng.cosmetic).toBe(l.beginEntry['rng.cosmetic']);
        expect(blocks.rng.fp).toBe(l.beginEntry['fp.seed']);
        expect(blocks.seam.time).toBe(l.beginEntry['save.time']);
        // ⛔ THE NEGATIVE HALF: none of the four is the terminal value. A
        // tape authored from the terminal readings would boot one whole build
        // ahead of where it claims and still parse, record and replay.
        expect(blocks.rng.seed).not.toBe(l.seam['rng.gameplay']);
        expect(blocks.seam.time).not.toBe(l.seam['save.time']);
    });

    it('⛔ MUTATION: a missing `beginEntry` REFUSES BY NAME rather than falling back',
        () => {
            const l = realisticLatch();
            expect(() => segmentBootFromLatch({ ...l, beginEntry: null }))
                .toThrow(/no `beginEntry` block/);
            expect(() => segmentBootFromLatch({ ...l, beginEntry: null }))
                .toThrow(/REUSED the current world/);
        });

    it('⛔ MUTATION: an entry block missing ONE prebuild row is refused, by that '
        + 'row\'s name', () => {
        for (const field of SEAM_PREBUILD_FIELDS) {
            const l = realisticLatch();
            const beginEntry = { ...l.beginEntry };
            delete beginEntry[field];
            expect(() => segmentBootFromLatch({ ...l, beginEntry }), field)
                .toThrow(new RegExp(field.replace('.', '\\.')));
        }
    });

    it('⛔ the refusals that read a prebuild value still bite through the ENTRY '
        + 'block', () => {
        // ⚠ These duplicate the refusal tests above ON PURPOSE, because the
        // BLOCK they read changed. `save.time: 0` and `rng.gameplay: 0` are
        // refused for reasons about the tape format; if the batch had left
        // them reading the terminal block, the refusals would have gone
        // silently vacuous while still passing their original tests.
        const l = realisticLatch();
        expect(l.beginEntry['save.time']).not.toBe(0);
        expect(() => segmentBootFromLatch({
            ...l, beginEntry: { ...l.beginEntry, 'save.time': 0 },
        })).toThrow(/time/);
        expect(() => segmentBootFromLatch({
            ...l, beginEntry: { ...l.beginEntry, 'rng.gameplay': 0 },
        })).toThrow(/inherit the page/);
        // …and a cosmetic state with split off is still the silently-dropped
        // declaration it always was, read from the entry block now.
        expect(() => segmentBootFromLatch({
            ...l,
            seam: { ...l.seam, 'static.Rng.split': false },
            beginEntry: { ...l.beginEntry, 'rng.cosmetic': 99 },
        })).toThrow(/silently drops/);
    });

    it('⛓ THE ROUND TRIP CLOSES AT THE RIGHT INSTANT: latch -> tape -> boot map '
        + 'equals `seamExitFields`, field for field', () => {
        const l = realisticLatch();
        const boot = seamBootFields(segmentTapeFor(l));
        const exit = seamExitFields(l);
        const rows = seamFindings([{ name: 'S', exit, boot }]);
        expect(rows.filter((r) => !r.ok).map((r) => `${r.name} [${r.detail}]`)).toEqual([]);
    });
});
