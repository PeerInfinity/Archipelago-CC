/**
 * SEEDLING FIDELITY DIGESTREAD — A READ OF THE RUN DOES NOT MOVE `run.stateDigest()`
 * (`CC/docs/cloud-reports/seedling-fidelity-digestread.md`).
 *
 * The page's graphics stack reads run getters every tick (js G3c's `hazardSkinView`: `crushers`, `bossesWoken`, …).
 * Before D2 a read between a visit's build and its first `advance` asked a lazy `…StateFor(level)`, which STORED the
 * visit state it built — an empty Map in a room without the family — and `stateDigestParts`' `visit` part hashes those
 * maps whole, so the read added a key the never-read run did not have (30 getters moved `visit`; `bobBoss` moved
 * `player` through `bobArena`). The tick builds the same state anyway, so nothing a tick produced differed: only a
 * digest compared across a read seam (graphics on vs off, page vs node, XC's cache key) read red.
 *
 * These rows enumerate the run's OWN getters from its property descriptors (nothing is hand-listed: a getter added
 * later is read here the day it lands) and hold every part of the digest still across each read — on a fresh boot
 * before the first tick, after one tick, and on the tick a level entry lands — over rooms with and without each
 * lazily built family. Methods (`entities`, `progress`, `ledger`, the forecasts, `previewStepper`) are not getters
 * and are not read: they take arguments, and `entities('lightsFight')` is the build DA's own row asks for on purpose.
 */
import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const STAGING = stagingFromTape(loadTape('r9-solve-18'));
const SOURCE = atlasLevelSource();
const boot = (level) => createRunForStaging({ ...STAGING, boot: { level, x: 160, y: 120 }, persistence: [] }, SOURCE);

/**
 * The rooms, chosen from the boot worlds' own family arrays (measured at the slice's base; the row below re-checks
 * each family is still held by one of them): 63 is G5's room (no crusher, no totem); 0 and 112 hold none of the
 * boss families; the rest each hold the family named.
 */
const LEVELS = Object.freeze({
    0: 'none of the boss families', 12: 'magicalLocks, activators', 16: 'arrowTraps, pushables', 18: 'spinners',
    19: 'shieldBosses', 32: 'the Bob arena (bobArena)', 40: 'iceTurrets, pulsers, spinners, chests', 41: 'crushers',
    43: 'bossTotems, fallRocks', 63: 'G5: no crushers, no totems', 69: 'lightsControllers', 82: 'the King of Fire',
    107: 'crushers, pulsers, pushables', 112: 'none', 113: 'finalDoors',
});
const FAMILIES = ['crushers', 'bossTotems', 'shieldBosses', 'finalDoors', 'iceTurrets', 'pulsers', 'spinners',
    'fallRocks', 'magicalLocks', 'chests', 'lightsControllers', 'pushables', 'activators', 'arrowTraps'];

/** Every getter on the run object itself, by its own property descriptors. */
export const runGetters = (run) => Object.entries(Object.getOwnPropertyDescriptors(run))
    .filter(([, d]) => typeof d.get === 'function').map(([k]) => k);

/**
 * Read each getter in turn (a throw is a refusal, still a read) and return `getter -> [moved part, …]` for every read
 * that moved a part of the digest. Reads are cumulative, so each is compared with the digest the read before it left.
 */
export function digestMovesOnRead(run, names = runGetters(run)) {
    const moved = {};
    let before = run.stateDigest({ parts: true });
    for (const g of names) {
        try { void run[g]; } catch { /* a refusal by name is a read too */ }
        const after = run.stateDigest({ parts: true });
        const parts = Object.keys(after.parts).filter((k) => after.parts[k] !== before.parts[k]);
        if (parts.length > 0 || after.digest !== before.digest) moved[g] = parts;
        before = after;
    }
    return moved;
}

describe('fidelity DIGESTREAD — reading every getter of the run leaves stateDigest() and every part equal', () => {
    it('the rooms hold every lazily built family (so the row reads each family\'s build, present and absent)', () => {
        const held = new Set();
        for (const n of Object.keys(LEVELS)) {
            const w = boot(Number(n)).world;
            for (const f of FAMILIES) if ((w[f] ?? []).length > 0) held.add(f);
        }
        expect([...held].sort()).toEqual([...FAMILIES].sort());
        // and the enumeration is the whole surface, not a hand list
        expect(runGetters(boot(63)).length).toBeGreaterThan(150);
        expect(runGetters(boot(63))).toEqual(expect.arrayContaining(['crushers', 'bossesWoken', 'bobBoss', 'world']));
    });

    for (const ticks of [0, 1]) {
        it(`a fresh boot, ${ticks === 0 ? 'before its first tick' : 'after one tick'}: no getter moves a part`, () => {
            const moved = {};
            for (const n of Object.keys(LEVELS)) {
                const run = boot(Number(n));
                for (let i = 0; i < ticks; i += 1) run.advance(new Set());
                const m = digestMovesOnRead(run);
                if (Object.keys(m).length > 0) moved[n] = m;
            }
            expect(moved).toEqual({});
        });
    }

    // ⚠ The rows above read cumulatively, so a getter whose build an EARLIER getter already made is hidden behind it
    // (D2 measured one: `armedArrowTraps` on L16, behind `pushables`). Here each getter reads a run of its own.
    it('each getter alone, on a fresh boot of its own (L16 and L41, before the first tick): no part moves', () => {
        const moved = {};
        for (const n of [16, 41]) {
            for (const g of runGetters(boot(n))) {
                const m = digestMovesOnRead(boot(n), [g]);
                if (Object.keys(m).length > 0) moved[`${n}:${g}`] = m[g];
            }
        }
        expect(moved).toEqual({});
    }, 120_000);

    // a level entry rebuilds the visit (`freshVisitState`), and the read lands before that visit's first advance
    for (const [name, entries] of [['f7-l16-walkin', 1], ['r2-two-teleporters', 2]]) {
        it(`a level entry (\`${name}\`): on the tick each entry lands, no getter moves a part`, () => {
            const tape = loadTape(name);
            const run = createRunForStaging(stagingFromTape(tape), SOURCE);
            const moved = [];
            let seen = 0;
            let at = run.level;
            for (let t = 0; t < tape.tick_count; t += 1) {
                if (run.level !== at) {
                    at = run.level;
                    seen += 1;
                    const m = digestMovesOnRead(run);
                    if (Object.keys(m).length > 0) moved.push({ t, level: run.level, m });
                }
                run.advance(new Set(heldKeysAt(tape, t)));
            }
            expect(seen).toBe(entries);
            expect(moved).toEqual([]);
        });
    }

    it('and reading changes nothing a tick produces: a run read every tick walks a tape as one never read', () => {
        const tape = loadTape('r2-two-teleporters');
        const read = createRunForStaging(stagingFromTape(tape), SOURCE);
        const quiet = createRunForStaging(stagingFromTape(tape), SOURCE);
        const names = runGetters(read);
        for (let t = 0; t < tape.tick_count; t += 1) {
            for (const g of names) try { void read[g]; } catch { /* a refusal */ }
            expect(read.stateDigest()).toBe(quiet.stateDigest());
            read.advance(new Set(heldKeysAt(tape, t)));
            quiet.advance(new Set(heldKeysAt(tape, t)));
        }
        expect(read.stateDigest({ fresh: true })).toBe(quiet.stateDigest({ fresh: true }));
        expect([read.level, read.ticksCompleted, read.state]).toEqual([quiet.level, quiet.ticksCompleted, quiet.state]);
    });
});

/**
 * D3 — THE PAGE'S READ PATTERN. js G3c's `hazardSkinView` reads these getters every tick; G5 measured `visit` moving
 * under it on L63, standing still. A run read that way for 120 ticks and a run never read digest equal at every tick.
 */
export const G3C_READS = Object.freeze(['world', 'crushers', 'bossesWoken', 'bossShots', 'bombPushers', 'bombs',
    'placedGrenades', 'cameraNow', 'gameTime']);

describe('fidelity DIGESTREAD D3 — the page\'s G3c read pattern, every tick for 120 ticks on L63', () => {
    it('a run read every tick and a run never read digest equal (all parts) at every tick, from tick 0', () => {
        const read = boot(63);
        const quiet = boot(63);
        const differ = [];
        for (let t = 0; t < 120; t += 1) {
            for (const g of G3C_READS) void read[g];
            const a = read.stateDigest({ parts: true });
            const b = quiet.stateDigest({ parts: true });
            if (a.digest !== b.digest) differ.push({ t, parts: Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]) });
            read.advance(new Set());
            quiet.advance(new Set());
        }
        expect(differ).toEqual([]);
        expect(read.state).toEqual(quiet.state);
    });
});
