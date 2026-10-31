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
const ROOM = { id: 'Start', exits: [{ id: 'exit' }, { id: 'back' }], items: [{ id: 'loc_0' }] };
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
        expect(r).toEqual({ known: false, exits: { exit: false, back: false }, items: { loc_0: false },
            ruleErrors: { exits: {}, items: {} } });
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
        expect(r).toEqual({ known: true, exits: { exit: false, back: true }, items: { loc_0: true },
            ruleErrors: { exits: {}, items: {} } });
    });

    it('…and with the sword, the guarded exit opens', () => {
        expect(roomAccessibility(ROOM, RULES, { inventory: { 'Progressive Sword': 1 } }, STATIC, deps).exits.exit).toBe(true);
    });

});

/**
 * ⛓ A RULE THAT THROWS IS PASSABLE, AND SAYS SO (⚖ user, 2026-10-30). Before,
 * `evalRule` returned `true` and logged at `debug`: the exit read open and
 * nothing showed why. Now it reads open AND carries `ruleErrors`, logged at
 * `error` once per call (one pass), naming the room, the exit or location and
 * the message.
 */
describe('roomAccessibility — a rule that throws: passable, and visible', () => {
    const throwsOn = (bad) => ({
        ...deps,
        evaluate: (rule, ctx) => {
            if (rule === bad) throw new Error('unknown helper: can_swim');
            return deps.evaluate(rule, ctx);
        },
    });
    const SWORD = RULES.exits.exit;

    it('stays accessible (no softlock), and ruleErrors carries the message for that exit only', () => {
        const r = roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, throwsOn(SWORD));
        expect(r.known).toBe(true);
        expect(r.exits.exit).toBe(true);
        expect(r.ruleErrors).toEqual({ exits: { exit: 'unknown helper: can_swim' }, items: {} });
    });

    it('a location\'s rule that throws is reported under items', () => {
        const locRule = has('Lamp');
        const rules = { ...RULES, items: { loc_0: locRule } };
        const r = roomAccessibility(ROOM, rules, { inventory: {} }, STATIC, throwsOn(locRule));
        expect(r.items.loc_0).toBe(true);
        expect(r.ruleErrors).toEqual({ exits: {}, items: { loc_0: 'unknown helper: can_swim' } });
    });

    it('a rule that is merely FALSE is shut, with no ruleError (the two stay distinct)', () => {
        const r = roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, deps);
        expect(r.exits.exit).toBe(false);
        expect(r.ruleErrors).toEqual({ exits: {}, items: {} });
    });

    it('unknown state is still known:false and shut, even with a rule that would throw (nothing was evaluated)', () => {
        const r = roomAccessibility(ROOM, RULES, null, STATIC, throwsOn(SWORD));
        expect(r.known).toBe(false);
        expect(r.exits.exit).toBe(false);
        expect(r.ruleErrors).toEqual({ exits: {}, items: {} });
    });

    it('logs at error exactly once per pass, naming the room, the exit and the message', () => {
        const calls = [];
        const d = { ...throwsOn(SWORD), log: (level, ...args) => calls.push([level, ...args]) };
        roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, d);
        const errors = calls.filter(([level]) => level === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0][1]).toContain('"Start"');
        expect(errors[0][1]).toContain('exit "exit"');
        expect(errors[0][1]).toContain('unknown helper: can_swim');
        // A second pass (the next snapshot) logs again — once.
        roomAccessibility(ROOM, RULES, { inventory: {} }, STATIC, d);
        expect(calls.filter(([level]) => level === 'error')).toHaveLength(2);
    });
});
