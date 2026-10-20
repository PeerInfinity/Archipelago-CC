/**
 * SEAM OFFSET (slice `seedling-js-seam-offset`) — the divergence sweep row's `seam` is the tape's own block: a REAL
 * row's seam (leg 768, `fixtures/sweep-row-seam-768.json`, verbatim off CI run 38811924099) boots a tape that
 * `parseTape` reads unedited, and the composition a scratch script used before the row had a seam (the row's
 * `items` — `botStatus().items`, the game's Player names) is refused by name. Mutant: `sweepRowSeam` answering the
 * row's items is red.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sweepRowSeam } from './seedlingSweepRowSeam.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { buildStagedTape } from '../../frontend/modules/seedlingDemo/botDriverV1.js';
import { stagingFromWasmArrival } from '../../frontend/modules/seedlingDemo/wasmArrival.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
const ROW = readJson('fixtures/sweep-row-seam-768.json');
// a real arrival's staging, for the tape around the seam (the fields other than `seam` are not the row's to supply)
const ARRIVAL = readJson('../../frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4g.json').arrivals[0];
const { staging: STAGING } = stagingFromWasmArrival({ seam: ARRIVAL.seam, status: ARRIVAL.status, state: ARRIVAL.state });
const tapeWith = (seam) => buildStagedTape({ staging: { ...STAGING, seam }, perTick: [new Set()], name: 'sweep-row-seam' });

describe('the sweep row\'s seam speaks the tape\'s names', () => {
    it('a REAL committed row\'s seam parses with parseTape unedited, and keeps every value', () => {
        const parsed = parseTape(tapeWith(ROW.seam));
        expect(parsed.seam.time).toBe(ROW.seamTime);
        expect(parsed.seam.hits_max).toBe(ROW.items.hitsMax);
        expect(parsed.seam.items).toEqual(ROW.seam.items);
        expect(Object.keys(ROW.seam.items)).not.toContain('hitsMax');
    });

    it('the row\'s `items` (the game\'s Player names) is NOT a seam: parseTape refuses `items.hitsMax` by name', () => {
        expect(() => parseTape(tapeWith({ ...ROW.seam, items: ROW.items }))).toThrow(/seam\.items\.hitsMax is not a seam field/);
    });

    it('sweepRowSeam is the FIRST request\'s staging.seam, a plain copy (not the object the worker holds)', () => {
        const solves = [{ req: { staging: { seam: ROW.seam } } }, { req: { staging: { seam: { time: 1 } } } }];
        const out = sweepRowSeam(solves);
        expect(out).toEqual(ROW.seam);
        expect(out).not.toBe(ROW.seam);
        expect(() => parseTape(tapeWith(out))).not.toThrow();
        expect(sweepRowSeam([])).toBeNull();
        expect(sweepRowSeam([{ req: { staging: { seam: null } } }])).toBeNull();
    });
});
