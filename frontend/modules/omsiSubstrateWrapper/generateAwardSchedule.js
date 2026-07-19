/**
 * P2-omsi award-schedule generator (cross-game plan §2d / §9b-pre).
 *
 * v1 scope (ruled 2026-07-19): LOOTABLES ONLY — the generator mints
 * per-good-instance contents schedules for the town-0 lootables (Smash
 * Pots / Pick Locks) and never mints generic award entries, so the §2c
 * protected list is untouched by construction (non-lootable grant sites
 * are simply never named). Within the lootables the knobs ARE the §8
 * ratio-capped posture: originalItemWeight bounds how much of the
 * mana/gold pool shuffles, and the fork's §9b-pre category-priority UI
 * is the player's mitigation (the §9b experiment's DNF was the
 * UNPRIORITIZED worst case).
 *
 * Knobs mirror the JtA generator's pair (ONE global pair per the S3
 * ruling — spiral-step feeds both generators the same values):
 *   originalItemWeight [0,1] default 1 — per-instance chance a good
 *       keeps its vanilla loot
 *   dummyItemRatio     [0,1] default 0 — per-instance chance a good is
 *       a dummy (suppressed at the executor; no fake bag keys)
 * Composition per instance: dummy roll first, else original-vs-different
 * (the exact draw order generateDataset uses). Zero-draw-at-default
 * discipline: both knobs at default ⇒ NO rng consumed and null returned
 * — no payload field, existing worlds byte-identical.
 *
 * Pool (the R3 shape): the engine's shareable local numerics ∪ the
 * co-present substrates' declared foreign types; count fixed 1 in v1
 * (magnitude tuning is X2).
 *
 * The schedule is the fork carrier's vocabulary verbatim
 * (actionListXml.js setAwardSchedule): { version, lootables:
 * { [varName]: { contents: [ null | {dummy} | {name,count} |
 * {substrate,type,count} ] } } }, contents keyed by the k-th GOOD
 * instance; indices past the horizon are vanilla.
 */
import { createRng } from '../shared/rng.js';
import { substrateRegistryEntry } from './omsiSubstrateWrapperLibrary.js';

// v1 town-0 lootables (engine varNames).
export const OMSI_LOOTABLES = Object.freeze(['Pots', 'Locks']);

// Contents horizon per lootable: good indices beyond it stay vanilla by
// the carrier's declared semantics. 100 covers the reachable town-0
// pools (Pots good tops out around 80 at max exploration + bonuses;
// Locks far fewer).
export const CONTENTS_HORIZON = 100;

/**
 * @param {Object} opts
 * @param {number} [opts.seed=1]
 * @param {number} [opts.originalItemWeight=1]
 * @param {number} [opts.dummyItemRatio=0]
 * @param {{substrate: string, type: string}[]|null} [opts.foreignTypes]
 * @returns {Object|null} the schedule, or null when byte-inert
 */
export function generateOmsiAwardSchedule({
    seed = 1, originalItemWeight = 1, dummyItemRatio = 0, foreignTypes = null,
} = {}) {
    for (const [k, v] of [['originalItemWeight', originalItemWeight], ['dummyItemRatio', dummyItemRatio]]) {
        if (typeof v !== 'number' || !(v >= 0 && v <= 1)) {
            throw new Error(`${k} must be a number in [0, 1], got ${JSON.stringify(v)}`);
        }
    }
    if (foreignTypes != null && (!Array.isArray(foreignTypes) || foreignTypes.some(
        (f) => typeof f?.substrate !== 'string' || !f.substrate
            || typeof f?.type !== 'string' || !f.type))) {
        throw new Error('foreignTypes must be an array of {substrate, type} with non-empty strings');
    }
    if (originalItemWeight === 1 && dummyItemRatio === 0) return null;

    const rng = createRng(seed);
    const pool = [
        ...substrateRegistryEntry.sharing.items.types.map((name) => ({ local: name })),
        ...(foreignTypes ?? []).map((f) => ({ foreign: f })),
    ];
    const lootables = {};
    for (const varName of OMSI_LOOTABLES) {
        const contents = [];
        let differs = false;
        for (let k = 0; k < CONTENTS_HORIZON; k += 1) {
            let entry = null;
            if (dummyItemRatio > 0 && rng.next() < dummyItemRatio) {
                entry = { dummy: true };
                differs = true;
            } else if (originalItemWeight < 1 && rng.next() >= originalItemWeight && pool.length > 0) {
                const pick = pool[Math.floor(rng.next() * pool.length)];
                entry = pick.local !== undefined
                    ? { name: pick.local, count: 1 }
                    : { substrate: pick.foreign.substrate, type: pick.foreign.type, count: 1 };
                differs = true;
            }
            contents.push(entry);
        }
        // an all-vanilla roll leaves the lootable unnamed (smaller payload,
        // and the fork renders no UI for it)
        if (differs) lootables[varName] = { contents };
    }
    if (Object.keys(lootables).length === 0) return null;
    return { version: 1, lootables };
}
