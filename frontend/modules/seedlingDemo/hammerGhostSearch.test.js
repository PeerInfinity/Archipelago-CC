/**
 * seedlingDemo/hammerGhostSearch.test — ⛓⛓⛓ SEEDLING HAMMER-PHASE D (D3): THE APPROACH AND THE FIGHT SCORE WITH THE
 * PRESS'S OWN ROW (`GHOST_SEARCH_BUCKETS`, OFF by default).
 *
 * C2 handed `pressReadyAt` the run's press row, but `deriveFight` pre-filters every press successor at the SWORD's
 * reach (16) and train (5) before it asks that predicate, so a ghost primary (reach 24) was never offered a press from
 * the 16–24 px band — the band the ghost exists for. Measured on C2's L18 staging (`r9-solve-18`'s frozen base with the
 * ghost sword): with the switch OFF the fight at t0 meets 22 in-reach press nodes and certifies its goal at index 173,
 * every press from ≤ 16 px; ON it meets 653, certifies at 166, and its first two landings are from ~20 px. The sword's
 * certificate is the same object ON and OFF (its row IS the constants). `deriveApproach` reads the row only for its
 * probe and row margins: unchanged here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    GHOST_SEARCH_BUCKETS, GHOST_SEARCH_BUCKETS_DEFAULT, GHOST_SPINNER_PRESS_ROW, SWORD_SPINNER_PRESS,
    searchPressFor, withGhostSearchBuckets,
} from './ghostSpinnerPress.js';
import { GHOST_SWORD_REACH } from './ghostSword.js';
import { SLASH_HIT_TICKS, SLASH_REACH } from './presses.js';
import { deriveApproach, deriveFight } from './solverBot.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = stagingFromTape(parseTape(readFileSync(join(HERE, 'fixtures', 'witness-bases', 'r9-solve-18.hammer-a.json'),
    'utf8')));
/** A fresh run of C2's L18 staging, with or without the ghost sword (the sword held either way). */
const makeRun = (ghost) => createRunForStaging({ ...BASE, persistence: BASE.persistence.filter((c) => c.at === undefined),
    equips: [], seam: { ...BASE.seam, items: { ...BASE.seam.items, hasGhostSword: ghost } } }, atlasLevelSource());

/** The fight at t0 for every body, the switch as given; its certificate replayed on a fresh run (landings, hits). */
function fightAt0(ghost, on) {
    const run = makeRun(ghost);
    const targets = run.entities('spinnerBodies').map((b) => b.id);
    const f = withGhostSearchBuckets(on, () => deriveFight(run, { targets, lastPressAt: -31, caller: 'test' }));
    const r = makeRun(ghost);
    for (const k of f.fight?.keys ?? []) r.advance(k);
    return { f, keys: JSON.stringify((f.fight?.keys ?? []).map((k) => [...k])),
        landed: r.spinnerPressHits.filter((h) => h.landed), hits: r.playerHits.length };
}

describe('GHOST_SEARCH_BUCKETS — the switch and its row', () => {
    it('is OFF by default (the env opt-in is `SEEDLING_GHOST_SEARCH_BUCKETS=1`)', () => {
        expect(GHOST_SEARCH_BUCKETS_DEFAULT).toBe(false);
        expect(GHOST_SEARCH_BUCKETS.enabled).toBe(process.env.SEEDLING_GHOST_SEARCH_BUCKETS === '1');
    });

    it('OFF the searches read the sword\'s row whatever they are handed; ON the press\'s own', () => {
        withGhostSearchBuckets(false, () => {
            expect(searchPressFor(GHOST_SPINNER_PRESS_ROW)).toBe(SWORD_SPINNER_PRESS);
            expect(searchPressFor(SWORD_SPINNER_PRESS)).toBe(SWORD_SPINNER_PRESS);
        });
        withGhostSearchBuckets(true, () => {
            expect(searchPressFor(GHOST_SPINNER_PRESS_ROW)).toBe(GHOST_SPINNER_PRESS_ROW);
            expect(searchPressFor(SWORD_SPINNER_PRESS)).toBe(SWORD_SPINNER_PRESS);
        });
        // the sword's row IS the constants the two searches read before (OFF is byte-inert by construction)
        expect([SWORD_SPINNER_PRESS.reach, SWORD_SPINNER_PRESS.hitTicks]).toEqual([SLASH_REACH, SLASH_HIT_TICKS]);
        expect(GHOST_SPINNER_PRESS_ROW.reach).toBe(GHOST_SWORD_REACH);
    });
});

describe('deriveFight on C2\'s L18 staging (D3\'s measurement)', () => {
    it('the SWORD\'s certificate is the same ON and OFF', () => {
        const off = fightAt0(false, false);
        const on = fightAt0(false, true);
        expect(off.f.ok).toBe(true);
        expect(on.keys).toBe(off.keys);
        expect(on.f.record).toEqual(off.f.record);
    }, 120000);

    it('⛓⛓⛓ the GHOST OFF is offered only presses from ≤ 16 px; ON it presses from the 16–24 px band and kills sooner',
        () => {
            const off = fightAt0(true, false);
            const on = fightAt0(true, true);
            expect(off.f.ok && on.f.ok).toBe(true);
            expect([off.f.record.inReach, off.f.fight.goal]).toEqual([22, 173]);
            expect([on.f.record.inReach, on.f.fight.goal]).toEqual([653, 166]);
            expect(on.f.fight.goal).toBeLessThan(off.f.fight.goal);
            const firstTwo = (x) => x.landed.slice(0, 2).map((h) => h.reach);
            expect(firstTwo(off).every((r) => r <= SLASH_REACH)).toBe(true);
            expect(firstTwo(on).every((r) => r > SLASH_REACH && r <= GHOST_SWORD_REACH)).toBe(true);
            expect(on.landed.every((h) => h.weapon === 'ghostsword')).toBe(true);
            expect([off.hits, on.hits]).toEqual([0, 0]);
        }, 120000);
});

describe('deriveApproach on the same staging', () => {
    it('reads the row only for its probe and row margins: the ghost\'s approach at t0 is the same ON and OFF', () => {
        const ask = (on) => {
            const run = makeRun(true);
            const id = run.entities('spinnerBodies')[0].id;
            const a = withGhostSearchBuckets(on, () => deriveApproach(run, { bodyId: id, lastPressAt: -31, caller: 'test' }));
            return JSON.stringify({ ok: a.ok, bound: a.bound ?? null, record: a.record,
                keys: a.ok ? a.strike.approach.keys.map((k) => [...k]) : null });
        };
        expect(ask(true)).toBe(ask(false));
    }, 120000);
});
