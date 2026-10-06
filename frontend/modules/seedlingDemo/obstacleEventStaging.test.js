/**
 * ⛓ OBSTACLE EVENTS — **STAGED BOOTS CARRY THE CLEARED FLAGS**, on every wasm staging path.
 *
 * A saved obstacle's flag (`flag:L0:1`, `breakablerock@288,176`) is game state; the model only knows it was broken
 * when the staging says so. Each path is driven from the recorded p4f arrival in level 0
 * (`fixtures/wasm-arrival-p4f.json`), with the game's readout carrying the flag the way the game reports it
 * (`botStatus.persistence_cleared`):
 *
 *   arrival      `stagingFromWasmArrival` stages `persistence_cleared` — and the route survey's step 33 (L12 → L0,
 *                landing (288,176) inside the rock) boots CLEAR of it once the flag is staged: no
 *                `arrival-inside-solid` (without it, the box is inside the rock, by name);
 *   continuation a W7 continuation boots the arrival staging and its tape DECLARES the live clears
 *                (`liveDeclarations`): a rock the last plan broke mid-room is declared broken;
 *   mid-room     the delivery re-stage (`stageItems`) keeps the arrival's clears.
 *
 * The JS page's boots are `jsRuntimeAtlas.test.js`'s row (every boot stages what the run cleared).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { continuationSolveRequest, stagingFromWasmArrival } from './wasmArrival.js';
import { liveDeclarations } from './wasmPlayback.js';
import { stageItems } from './wasmDelivery.js';
import { createRunForStaging } from './tapeRunner.js';
import { arrivalInsideSolid } from './arrivalSolid.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const SRC = levelSourceFromAtlas(RECORDS);
const L0 = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json').arrivals.find((a) => a.status.level === 0);
/** The rules' event for the rock (the playthrough's `flag:L0:1`): its flag, and the landing the rock gates. */
const ROCK_FLAG = { level: 0, tag: 1 };
const STEP_33_LANDING = { level: 0, x: 288, y: 176 };   // L12 → L0's teleporter arrival (the ctor args)

const statusWith = (cleared) => ({ ...L0.status, persistence_cleared: cleared, items: { ...L0.status.items, hasSword: true } });
const arrivalStaging = (cleared) => stagingFromWasmArrival({ seam: L0.seam, status: statusWith(cleared), state: L0.state }).staging;
const insideAt = (staging) => arrivalInsideSolid(createRunForStaging({ ...staging, boot: { ...STEP_33_LANDING } }, SRC));

describe('the ARRIVAL staging carries the game\'s cleared flags', () => {
    it('persistence = botStatus.persistence_cleared — the rock\'s flag included', () => {
        expect(arrivalStaging([]).persistence).toEqual([]);
        expect(arrivalStaging([ROCK_FLAG]).persistence).toEqual([ROCK_FLAG]);
    });

    it('step 33 (L12 → L0 at (288,176)): WITHOUT the flag the box lands inside breakablerock@288,176, by name…', () => {
        const inside = insideAt(arrivalStaging([]));
        expect(inside?.solids.map((s) => [s.id, s.flag])).toEqual([['breakablerock@288,176', ROCK_FLAG]]);
    });

    it('…WITH the flag staged it lands clear: no arrival-inside-solid', () => {
        expect(insideAt(arrivalStaging([ROCK_FLAG]))).toBeNull();
    });
});

describe('a CONTINUATION declares the clears the game holds NOW', () => {
    it('the rock broken after the arrival (mid-room) is in the continuation tape\'s declarations', () => {
        const staging = arrivalStaging([]);
        const now = liveDeclarations(staging, statusWith([ROCK_FLAG]));
        expect(now.persistence).toEqual([ROCK_FLAG]);
        // the model's start stays the arrival (the shipped prefix re-breaks it in the shadow)
        expect(staging.persistence).toEqual([]);
    });

    it('a continuation from an arrival that already held the flag boots it (the request\'s staging IS the arrival\'s)', () => {
        const staging = { ...arrivalStaging([ROCK_FLAG]), boot: { ...STEP_33_LANDING } };
        const c = continuationSolveRequest({ staging, shipped: [[]], goal: { kind: 'exit', level: 0, tiles: [[0, 8]] },
            levelSource: SRC, records: RECORDS, record: RECORDS.get(0) });
        expect(c.refusal ?? null).toBeNull();
        expect(c.request.staging.persistence).toEqual([ROCK_FLAG]);
    });
});

describe('the MID-ROOM delivery re-stage keeps the clears', () => {
    it('stageItems replaces the items, never the persistence', () => {
        const staging = arrivalStaging([ROCK_FLAG]);
        const restaged = stageItems(staging, { ...statusWith([]).items, hasShield: 1 }, { slots: [0] });
        expect(restaged.persistence).toEqual([ROCK_FLAG]);
        expect(insideAt(restaged)).toBeNull();
    });
});
