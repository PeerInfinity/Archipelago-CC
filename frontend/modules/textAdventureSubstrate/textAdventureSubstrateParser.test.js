import { describe, it, expect } from 'vitest';

import { TextAdventureSubstrateParser } from './textAdventureSubstrateParser.js';

function makeContext(exitsBySide = {}, locations = []) {
    return {
        exitsBySide: {
            N: [], E: [], S: [], W: [], C: [],
            ...exitsBySide,
        },
        locations,
    };
}

function exit(id, name = id, opts = {}) {
    return { exit_id: id, exitName: name, ...opts };
}

describe('TextAdventureSubstrateParser — shorthand resolution', () => {
    it('resolves "n" to the first north exit', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ N: [exit('north_a', 'go_north')] });
        const r = parser.parseCommand('n', ctx);
        expect(r).toEqual({ type: 'move', target: 'go_north', matchQuality: 'shorthand' });
    });

    it('resolves "n2" to the second north exit', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            N: [exit('north_a', 'A'), exit('north_b', 'B'), exit('north_c', 'C')],
        });
        const r = parser.parseCommand('n2', ctx);
        expect(r.target).toBe('B');
    });

    it('treats "n" as "n1" (first) when multiple exist', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            N: [exit('a', 'A'), exit('b', 'B')],
        });
        const r = parser.parseCommand('n', ctx);
        expect(r.target).toBe('A');
    });

    it('errors when the index is out of range', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ N: [exit('only')] });
        const r = parser.parseCommand('n5', ctx);
        expect(r.type).toBe('error');
        expect(r.message).toMatch(/n5/);
    });

    it('errors when the cell is empty', () => {
        const parser = new TextAdventureSubstrateParser();
        const r = parser.parseCommand('w', makeContext());
        expect(r.type).toBe('error');
    });

    it('handles each cardinal letter', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            N: [exit('n', 'N')],
            E: [exit('e', 'E')],
            S: [exit('s', 's')],
            W: [exit('w', 'W')],
        });
        expect(parser.parseCommand('n', ctx).target).toBe('N');
        expect(parser.parseCommand('e', ctx).target).toBe('E');
        expect(parser.parseCommand('s', ctx).target).toBe('s');
        expect(parser.parseCommand('w', ctx).target).toBe('W');
    });

    it('handles "c" for the center cell', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ C: [exit('teleporter', 'TP')] });
        expect(parser.parseCommand('c', ctx).target).toBe('TP');
    });

    it('falls back to exit_id when exitName is missing', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ E: [{ exit_id: 'eastdoor' }] });
        expect(parser.parseCommand('e', ctx).target).toBe('eastdoor');
    });
});

describe('TextAdventureSubstrateParser — flat exit shorthand (x<n>)', () => {
    it('"x" resolves to the first exit across all cells', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            N: [exit('north', 'go_north')],
            E: [exit('east', 'go_east')],
        });
        expect(parser.parseCommand('x', ctx).target).toBe('go_north');
    });

    it('"x<n>" iterates N → E → S → W → C', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            N: [exit('a', 'A')],
            E: [exit('b', 'B'), exit('c', 'C')],
            S: [exit('d', 'D')],
            C: [exit('e', 'E')],
        });
        expect(parser.parseCommand('x1', ctx).target).toBe('A');
        expect(parser.parseCommand('x2', ctx).target).toBe('B');
        expect(parser.parseCommand('x3', ctx).target).toBe('C');
        expect(parser.parseCommand('x4', ctx).target).toBe('D');
        expect(parser.parseCommand('x5', ctx).target).toBe('E');
    });

    it('errors when index is out of range', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ N: [exit('only')] });
        const r = parser.parseCommand('x9', ctx);
        expect(r.type).toBe('error');
        expect(r.message).toMatch(/x9/);
    });

    it('errors when no exits exist', () => {
        const parser = new TextAdventureSubstrateParser();
        expect(parser.parseCommand('x', makeContext()).type).toBe('error');
    });

    it('works in standalone-shaped context (all exits in C bucket)', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({
            C: [exit('e1', 'first'), exit('e2', 'second'), exit('e3', 'third')],
        });
        expect(parser.parseCommand('x', ctx).target).toBe('first');
        expect(parser.parseCommand('x2', ctx).target).toBe('second');
        expect(parser.parseCommand('x3', ctx).target).toBe('third');
    });
});

describe('TextAdventureSubstrateParser — location shorthand', () => {
    it('resolves "l" to the first location', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({}, [{ locationName: 'Slay Yorgle' }]);
        const r = parser.parseCommand('l', ctx);
        expect(r).toEqual({ type: 'check', target: 'Slay Yorgle', matchQuality: 'shorthand' });
    });

    it('resolves "l3" to the third location', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({}, [
            { locationName: 'A' }, { locationName: 'B' }, { locationName: 'C' },
        ]);
        expect(parser.parseCommand('l3', ctx).target).toBe('C');
    });

    it('errors when no locations exist', () => {
        const parser = new TextAdventureSubstrateParser();
        expect(parser.parseCommand('l', makeContext()).type).toBe('error');
    });

    it('errors when the location index is out of range', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({}, [{ locationName: 'only' }]);
        expect(parser.parseCommand('l9', ctx).type).toBe('error');
    });
});

describe('TextAdventureSubstrateParser — verb commands', () => {
    it('"look" returns a look command (and "l" no longer triggers look)', () => {
        const parser = new TextAdventureSubstrateParser();
        expect(parser.parseCommand('look', makeContext()).type).toBe('look');
        // "l" with no locations is now an error from the shorthand layer,
        // not a look command.
        expect(parser.parseCommand('l', makeContext()).type).toBe('error');
    });

    it('inventory aliases', () => {
        const parser = new TextAdventureSubstrateParser();
        for (const v of ['inventory', 'inv', 'items']) {
            expect(parser.parseCommand(v, makeContext()).type).toBe('inventory');
        }
    });

    it('help aliases', () => {
        const parser = new TextAdventureSubstrateParser();
        for (const v of ['help', '?']) {
            expect(parser.parseCommand(v, makeContext()).type).toBe('help');
        }
    });

    it('move <exit_name> matches exits by name', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ N: [exit('id', 'MainGate')] });
        const r = parser.parseCommand('move maingate', ctx);
        expect(r.type).toBe('move');
        expect(r.target).toBe('MainGate');
    });

    it('check <location> matches locations by name', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({}, [{ locationName: 'Slay Yorgle' }]);
        const r = parser.parseCommand('check yorgle', ctx);
        expect(r.type).toBe('check');
        expect(r.target).toBe('Slay Yorgle');
    });

    it('"search" is an alias for check', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({}, [{ locationName: 'Bridge Key' }]);
        const r = parser.parseCommand('search bridge', ctx);
        expect(r.type).toBe('check');
        expect(r.target).toBe('Bridge Key');
    });

    it('bare-name input matches against both exits and locations', () => {
        const parser = new TextAdventureSubstrateParser();
        const ctx = makeContext({ N: [exit('castle', 'castle_door')] }, [
            { locationName: 'Slay Yorgle' },
        ]);
        const moveResult = parser.parseCommand('castle', ctx);
        expect(moveResult.type).toBe('move');

        const checkResult = parser.parseCommand('yorgle', ctx);
        expect(checkResult.type).toBe('check');
    });

    it('unknown bare-name returns an error', () => {
        const parser = new TextAdventureSubstrateParser();
        expect(parser.parseCommand('xyzzy', makeContext()).type).toBe('error');
    });

    it('empty / whitespace input returns an error', () => {
        const parser = new TextAdventureSubstrateParser();
        expect(parser.parseCommand('', makeContext()).type).toBe('error');
        expect(parser.parseCommand('   ', makeContext()).type).toBe('error');
        expect(parser.parseCommand(null, makeContext()).type).toBe('error');
    });
});
