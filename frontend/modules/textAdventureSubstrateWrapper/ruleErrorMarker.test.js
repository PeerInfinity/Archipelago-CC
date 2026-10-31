/**
 * ⛓ The rule-error marker: a link whose rule threw is marked (class + title),
 * keeps its accessible class, and re-rendering does not log. The DOM is a
 * minimal stand-in (the suite runs in node): what `markRuleErrors` reads is
 * `querySelectorAll`, the `data-*` attributes, `classList` and `title`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

import { markRuleErrors, RULE_ERROR_CLASS } from './ruleErrorMarker.js';

function fakeLink(attrs, classes) {
    const a = { ...attrs };
    const cls = new Set(classes);
    return {
        getAttribute: (k) => a[k] ?? null,
        setAttribute: (k, v) => { a[k] = String(v); },
        removeAttribute: (k) => { delete a[k]; },
        classList: {
            add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c),
        },
        get className() { return [...cls].join(' '); },
        get title() { return a.title ?? ''; },
    };
}
/** One engine render of room Start: a fresh set of links, as `innerHTML` makes. */
const render = () => {
    const links = [
        fakeLink({ 'data-room-id': 'Start', 'data-exit-id': 'gate' }, ['tae-link', 'tae-link-exit', 'tae-link-accessible']),
        fakeLink({ 'data-room-id': 'Start', 'data-exit-id': 'back' }, ['tae-link', 'tae-link-exit', 'tae-link-accessible']),
        fakeLink({ 'data-room-id': 'Start', 'data-item-id': 'loc_0' }, ['tae-link', 'tae-link-item', 'tae-link-inaccessible']),
    ];
    return { links, root: { querySelectorAll: () => links } };
};
const ERRORS = new Map([['Start', { exits: { gate: 'unknown helper: can_swim' }, items: {} }]]);

afterEach(() => vi.restoreAllMocks());

describe('markRuleErrors', () => {
    it('marks only the link whose rule threw, with the message in its title; it keeps tae-link-accessible', () => {
        const { links: [gate, back, loc], root } = render();
        markRuleErrors(root, ERRORS);
        expect(gate.className).toContain(RULE_ERROR_CLASS);
        expect(gate.className).toContain('tae-link-accessible');
        expect(gate.title).toContain('unknown helper: can_swim');
        expect(back.className).not.toContain(RULE_ERROR_CLASS);
        expect(back.title).toBe('');
        expect(loc.className).not.toContain(RULE_ERROR_CLASS);
    });

    it('marks a location by its data-item-id', () => {
        const { links: [, , loc], root } = render();
        markRuleErrors(root, new Map([['Start', { exits: {}, items: { loc_0: 'boom' } }]]));
        expect(loc.className).toContain(RULE_ERROR_CLASS);
        expect(loc.title).toContain('boom');
    });

    it('clears a stale marker when the next pass has no error for that link', () => {
        const { links: [gate], root } = render();
        markRuleErrors(root, ERRORS);
        markRuleErrors(root, new Map([['Start', { exits: {}, items: {} }]]));
        expect(gate.className).not.toContain(RULE_ERROR_CLASS);
        expect(gate.title).toBe('');
    });

    it('re-applies on every render (each render is fresh innerHTML) and NEVER logs — 60 renders, 0 console.error', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        let last;
        for (let frame = 0; frame < 60; frame++) {
            last = render();
            markRuleErrors(last.root, ERRORS);
        }
        expect(last.links[0].className).toContain(RULE_ERROR_CLASS);
        expect(err).not.toHaveBeenCalled();
    });
});
