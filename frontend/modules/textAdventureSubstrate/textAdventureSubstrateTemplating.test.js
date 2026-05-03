import { describe, it, expect } from 'vitest';

import {
    processMessageTemplate,
    customRegionEnterMessage,
    customLocationCheckMessage,
    customLocationInaccessibleMessage,
    customLocationAlreadyCheckedMessage,
    customExitMoveMessage,
    customExitInaccessibleMessage,
} from './textAdventureSubstrateTemplating.js';

describe('processMessageTemplate', () => {
    it('substitutes single placeholder', () => {
        expect(processMessageTemplate('Hello {name}!', { name: 'world' }))
            .toBe('Hello world!');
    });

    it('substitutes multiple distinct placeholders', () => {
        expect(processMessageTemplate('{a} and {b}', { a: 'foo', b: 'bar' }))
            .toBe('foo and bar');
    });

    it('substitutes repeated placeholders', () => {
        expect(processMessageTemplate('{x} {x} {x}', { x: 'go' }))
            .toBe('go go go');
    });

    it('leaves unresolved placeholders intact', () => {
        expect(processMessageTemplate('Hello {missing}.', { other: 'x' }))
            .toBe('Hello {missing}.');
    });

    it('returns empty string for non-string templates', () => {
        expect(processMessageTemplate(null, {})).toBe('');
        expect(processMessageTemplate(undefined, {})).toBe('');
        expect(processMessageTemplate(42, {})).toBe('');
    });

    it('skips null / undefined variable values', () => {
        expect(processMessageTemplate('{a}/{b}', { a: 'x', b: null }))
            .toBe('x/{b}');
    });

    it('coerces non-string values to strings', () => {
        expect(processMessageTemplate('count={n}', { n: 7 }))
            .toBe('count=7');
    });

    it('wraps {item} in item-name span when wasUnchecked is true', () => {
        const out = processMessageTemplate('found {item}', { item: 'sword', wasUnchecked: true });
        expect(out).toBe('found <span class="item-name">sword</span>');
    });

    it('does NOT wrap {item} when wasUnchecked is false', () => {
        const out = processMessageTemplate('found {item}', { item: 'sword', wasUnchecked: false });
        expect(out).toBe('found sword');
    });

    it('does not wrap non-{item} variables even with wasUnchecked', () => {
        const out = processMessageTemplate('{name}', { name: 'X', wasUnchecked: true });
        expect(out).toBe('X');
    });
});

describe('custom*Message lookup helpers', () => {
    const data = {
        regions: { Overworld: { enterMessage: 'Welcome to {regionName}.' } },
        locations: {
            'Slay Yorgle': {
                checkMessage: 'You search {locationName} and find {item}.',
                alreadyCheckedMessage: 'Already done at {locationName}.',
                inaccessibleMessage: 'Cannot reach {locationName}.',
            },
        },
        exits: {
            EastDoor: {
                moveMessage: 'You head through {exitName} to {destinationRegion}.',
                inaccessibleMessage: '{exitName} is locked.',
            },
        },
    };

    it('customRegionEnterMessage substitutes regionName', () => {
        expect(customRegionEnterMessage(data, 'Overworld'))
            .toBe('Welcome to Overworld.');
    });

    it('customRegionEnterMessage returns null when missing', () => {
        expect(customRegionEnterMessage(data, 'Nowhere')).toBeNull();
        expect(customRegionEnterMessage(null, 'Overworld')).toBeNull();
    });

    it('customLocationCheckMessage passes through item + wasUnchecked', () => {
        const out = customLocationCheckMessage(data, 'Slay Yorgle', {
            item: 'sword', wasUnchecked: true,
        });
        expect(out).toBe('You search Slay Yorgle and find <span class="item-name">sword</span>.');
    });

    it('customLocationInaccessibleMessage substitutes locationName', () => {
        expect(customLocationInaccessibleMessage(data, 'Slay Yorgle'))
            .toBe('Cannot reach Slay Yorgle.');
    });

    it('customLocationAlreadyCheckedMessage substitutes locationName', () => {
        expect(customLocationAlreadyCheckedMessage(data, 'Slay Yorgle'))
            .toBe('Already done at Slay Yorgle.');
    });

    it('customExitMoveMessage substitutes exitName + destinationRegion', () => {
        const out = customExitMoveMessage(data, 'EastDoor', { destinationRegion: 'Cave' });
        expect(out).toBe('You head through EastDoor to Cave.');
    });

    it('customExitInaccessibleMessage substitutes exitName', () => {
        expect(customExitInaccessibleMessage(data, 'EastDoor'))
            .toBe('EastDoor is locked.');
    });

    it('all lookups return null when their entry is absent', () => {
        const empty = {};
        expect(customRegionEnterMessage(empty, 'X')).toBeNull();
        expect(customLocationCheckMessage(empty, 'X', {})).toBeNull();
        expect(customLocationInaccessibleMessage(empty, 'X')).toBeNull();
        expect(customLocationAlreadyCheckedMessage(empty, 'X')).toBeNull();
        expect(customExitMoveMessage(empty, 'X', {})).toBeNull();
        expect(customExitInaccessibleMessage(empty, 'X')).toBeNull();
    });
});
