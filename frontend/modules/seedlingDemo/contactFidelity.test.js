/**
 * seedling-fidelity-terrain — the divergence sweep's "terrain" rows, as GAME WITNESSES replayed on the model.
 *
 * Each fixture in `fixtures/contact-witness/` is one leg the production wasm engine served on p4f
 * (`probe-seedling-contact-divergence.mjs --capture`): the solve request as the engine sent it, the leg's room
 * record from the delivered set, the plan, and every game tick the in-page sampler read while the game played it.
 * `replay-seedling-contact-capture.mjs` rebuilds the model's run and compares the player tick by tick.
 *
 * The pins:
 *   - switches OFF (the default): every witness leaves the model at the tick the sweep named, and the game's side
 *     of that tick carries `hits` 0 → 1 or a body the model's run lacks (it is a CONTACT, not terrain);
 *   - each switch alone fixes exactly its own rows (W1 the two ray rows, W2 the three struck-flyer rows, W3 the
 *     four L88 rows), which is also the mutation: switch one off and its rows come back at their tick;
 *   - all ON: the nine reproduce the game at 0 px; the four residue rows still leave at their named tick.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCapture } from '../../../scripts/procgen/replay-seedling-contact-capture.mjs';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'contact-witness');
const load = (id) => JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));

/** leg id → [the tick the sweep named, the switch that fixes it, or null for residue] */
const ROWS = {
    243: [52, 'wallFlyerSwordHits'], // L22, wallflyer@64,80 struck at t46 in the game
    251: [60, 'wallFlyerSwordHits'], // L22
    269: [55, 'wallFlyerSwordHits'], // L25, wallflyer@48,48 struck at t51
    264: [80, 'collideLinePointsExact'], // L25, the launch a tick late in the model
    283: [19, 'collideLinePointsExact'], // L27, the launch a tick early in the model
    659: [48, 'drillLive'], // L88, drill@128,160 hops onto the player
    661: [48, 'drillLive'],
    663: [104, 'drillLive'],
    666: [53, 'drillLive'],
    308: [67, null], // L30 BobSoldier (unmodelled)
    309: [66, null], // L30 BobSoldier
    576: [141, null], // L71 — no Mobile near the player (the spinning axe: the AXE slice's region)
    589: [1, null], // L74 — the arrival's frozen tick a tick early (the ARRIVAL slice's region)
};
const ALL_OFF = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, false]));

describe('contact witnesses (fixtures/contact-witness)', () => {
    it('holds exactly the thirteen measured legs', () => {
        const ids = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => Number.parseInt(f, 10)).sort((a, b) => a - b);
        expect(ids).toEqual(Object.keys(ROWS).map(Number).sort((a, b) => a - b));
    });

    // ⛓ a measuring run sets SEEDLING_CONTACT_FIDELITY on purpose; the default is what this pins
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY)('the switches are all OFF by default', () => {
        expect(Object.values(CONTACT_FIDELITY).every((v) => v === false)).toBe(true);
    });

    it.each(Object.entries(ROWS))('leg %s — switches OFF, the model leaves the game at the named tick, on a contact', async (id, [t]) => {
        const cap = load(id);
        const r = await withContactFidelity(ALL_OFF, () => replayCapture(cap));
        expect(r.error).toBeNull();
        expect(r.firstDiff?.t).toBe(t);
        if (t > 1) {
            // a knockback: one side's hits moved at that tick
            const hits = r.firstDiff.fields.find((f) => f.field === 'hits');
            expect(hits).toBeTruthy();
            expect(Math.abs(hits.game - hits.model)).toBe(1);
        }
    });

    it.each(Object.entries(ROWS).filter(([, [, sw]]) => sw))('leg %s — its own switch alone reproduces the game at 0 px', async (id, [, sw]) => {
        const r = await withContactFidelity({ ...ALL_OFF, [sw]: true }, () => replayCapture(load(id)));
        expect(r.error).toBeNull();
        expect(r.compared).toBeGreaterThan(15);
        expect(r.worst).toBe(0);
        expect(r.firstDiff).toBeNull();
    });

    it.each(Object.entries(ROWS).filter(([, [, sw]]) => sw))('leg %s — every switch EXCEPT its own leaves it at the named tick (the mutant)', async (id, [t, sw]) => {
        const on = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, k !== sw]));
        const r = await withContactFidelity(on, () => replayCapture(load(id)));
        expect(r.firstDiff?.t).toBe(t);
    });

    it.each(Object.entries(ROWS))('leg %s — all switches ON: fixed rows at 0 px, residue at its tick', async (id, [t, sw]) => {
        const all = Object.fromEntries(Object.keys(CONTACT_FIDELITY).map((k) => [k, true]));
        const r = await withContactFidelity(all, () => replayCapture(load(id)));
        expect(r.error).toBeNull();
        if (sw) expect(r.worst).toBe(0);
        else expect(r.firstDiff?.t).toBe(t);
    });
});
