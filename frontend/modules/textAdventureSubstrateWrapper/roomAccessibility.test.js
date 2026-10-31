/**
 * ⛓ UNKNOWN IS INACCESSIBLE — the concept trial's Phase A flake, pinned.
 *
 * The static data answers the iframe in one round trip; the state snapshot is a
 * `pingWorker` round trip, so the world can be built before the snapshot lands.
 * The bridge used to skip the evaluation then, leaving the engine's
 * `loadWorld` default (`accessible: true`) on a gated exit: measured in the
 * cloud's Chromium, the concept trial's guarded exit painted
 * `tae-link-accessible` ~10 ms before `STATE_SNAPSHOT`, holding no sword (1/30
 * solo boots; 5 of ~145 CI runs failed Phase A on it). These rows force that
 * ordering — static data first, snapshot later — instead of waiting for it.
 */
import { describe, it, expect } from 'vitest';

import { roomAccessibility } from './roomAccessibility.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const ROOM = { exits: [{ id: 'exit' }, { id: 'back' }], items: [{ id: 'loc_0' }] };
const RULES = { exits: { exit: has('Progressive Sword'), back: null }, items: { loc_0: null } };
const STATIC = { regions: new Map() };
/** A context that answers `Has` off the snapshot's inventory, as the snapshot interface does. */
const deps = {
    createContext: (snapshot) => ({ inv: snapshot.inventory }),
    evaluate: (rule, ctx) => (rule.rule === 'Has' ? (ctx.inv[rule.args.item_name] ?? 0) > 0 : true),
};

describe('roomAccessibility — before the snapshot, nothing is open', () => {
    it('static data built the world, the snapshot is still in flight: every exit and location is inaccessible', () => {
        const r = roomAccessibility(ROOM, RULES, null, STATIC, deps);
        expect(r).toEqual({ known: false, exits: { exit: false, back: false }, items: { loc_0: false } });
    });

    it('no static data yet: inaccessible too', () => {
        expect(roomAccessibility(ROOM, RULES, { inventory: {} }, null, deps).exits.exit).toBe(false);
    });

    it('the snapshot context cannot be built: inaccessible, not the engine default', () => {
        const boom = { ...deps, createContext: () => { throw new Error('bad snapshot'); } };
        expect(roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, boom).exits.exit).toBe(false);
    });

    it('the late snapshot lands without the sword: the guarded exit stays shut, the unguarded ones open', () => {
        const r = roomAccessibility(ROOM, RULES, { inventory: { 'Progressive Sword': 0 } }, STATIC, deps);
        expect(r).toEqual({ known: true, exits: { exit: false, back: true }, items: { loc_0: true } });
    });

    it('…and with the sword, the guarded exit opens', () => {
        expect(roomAccessibility(ROOM, RULES, { inventory: { 'Progressive Sword': 1 } }, STATIC, deps).exits.exit).toBe(true);
    });

    it('a rule the evaluator throws on keeps the bridge\'s accessible default (a different question from "no state yet")', () => {
        const throws = { ...deps, evaluate: () => { throw new Error('unknown helper'); } };
        expect(roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, throws).exits.exit).toBe(true);
    });
});
