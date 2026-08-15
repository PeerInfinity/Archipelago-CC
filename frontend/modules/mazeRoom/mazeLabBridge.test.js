/**
 * mazeRoom/mazeLabBridge — **THE PROJECTION FROM `__mazeLab` ONTO THE
 * PROTOCOL**, tested where it is pure.
 *
 * CONSTRUCTIVE-MODE arc, slice 4. ⛔ `installMazeLabBridge` itself needs a
 * `window`, an `AdapterClient` and a host on the other end of a postMessage —
 * that is `scripts/procgen/check-procgen-lab-hosting.mjs`' job and nothing
 * here may be read as covering it. What IS pure, and is the one place a field
 * could be silently coerced on its way across the boundary, is
 * `mazeLabSummary`.
 */

import { describe, expect, it } from 'vitest';

import { mazeLabSummary } from './mazeLabBridge.js';
import { assertStateChanged } from '../procgenCore/labProtocol.js';

const HREF = 'http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&count=4';

/** The shape `mazeLabView.render()` writes — only the fields read here. */
const READOUT = Object.freeze({
    source: 'generate',
    url: '?seed=3&count=4',
    seed: 3,
    step: 4,
    identity: 'seed 3 · maze-v1 · 11x11 · step 4 · CERTIFIED',
    certified: true,
    edits: 0,
    directives: [],
    payload: { seed: 3, level: { width: 11 } },
});

describe('mazeLabSummary', () => {
    it('carries the readout\'s fields under the protocol\'s names', () => {
        const s = mazeLabSummary(READOUT, HREF);
        expect(s.source).toBe('generate');
        expect(s.seed).toBe(3);
        expect(s.step).toBe(4);
        expect(s.identity).toBe(READOUT.identity);
        expect(s.certified).toBe(true);
        expect(s.edits).toBe(0);
        expect(s.directives).toEqual([]);
    });

    it('⛓ reports the FULL href, not the readout\'s search-only url', () => {
        const s = mazeLabSummary(READOUT, HREF);
        expect(s.url).toBe(HREF);
        expect(s.url).not.toBe(READOUT.url);
    });

    it('⛔ a FATAL boot is not a state — the host is told nothing rather than a stale line', () => {
        expect(mazeLabSummary({ fatal: 'the URL was refused' }, HREF)).toBe(null);
        expect(mazeLabSummary(null, HREF)).toBe(null);
        expect(mazeLabSummary(undefined, HREF)).toBe(null);
    });

    it('an absent directives list becomes [] — the protocol wants an array', () => {
        const s = mazeLabSummary({ ...READOUT, directives: undefined }, HREF);
        expect(s.directives).toEqual([]);
    });

    it('⛓⛓ produces a payload the protocol\'s validator ACCEPTS', () => {
        const message = {
            substrate: 'maze', iframeId: 'procgenLab-maze-1', ...mazeLabSummary(READOUT, HREF),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
    });

    it('⛓ an EDITED, uncertified level projects with edits > 0 and certified false', () => {
        const message = {
            substrate: 'maze',
            iframeId: 'procgenLab-maze-1',
            ...mazeLabSummary({ ...READOUT, edits: 2, certified: false }, HREF),
        };
        expect(() => assertStateChanged(message)).not.toThrow();
        expect(message.edits).toBe(2);
        expect(message.certified).toBe(false);
    });

    it('⛔ drops the level payload — stateChanged is the SMALL event', () => {
        expect(Object.keys(mazeLabSummary(READOUT, HREF)).sort()).toEqual([
            'certified', 'directives', 'edits', 'identity', 'seed', 'source', 'step', 'url',
        ]);
    });
});
