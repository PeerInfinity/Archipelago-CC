/**
 * ⛓ LATCHING BUTTONS — the art (session tile-mechanisms-m4-latch; art-4's next-slice line "the latched-ButtonRoom look
 * once `buttonLib.latch` exists"). In node, over the committed packs, map and preset (no pixels): a latching button is
 * drawn DOWN while latched this visit or while its event is carried — `ButtonRoom.as` `check()` enters it down
 * (`_active = !Game.checkPersistence(tag)`) and its setter never lifts it — with nothing standing on it; art off, its
 * ring is filled. The census refuses a latch the game would not draw so (a `Button`, which holds per visit) and a room −1
 * ButtonRoom laid as a per-visit hold.
 *
 * No preset lays a latch yet, so the world is a SCRATCH copy of L38's committed payload with one latching button laid on
 * its room −1 ButtonRoom (208,224) = cell (13,14) — data the test makes, not a level's laying.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { formatOp } from '../seedlingDemo/seedlingSkinRenderer.js';
import { patchedMapDocument } from '../seedlingDemo/seedlingSetPatches.js';
import { recordingContext } from './drawOpRecorder.js';
import { createState, deserializeMazeWorld } from './mazeRoomEngine.js';
import { drawLiveMarkers, plainView } from './mazeRoomRender.js';
import { seedlingCensus, seedlingSprites } from './mazeSeedlingSprites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORD = patchedMapDocument(MAP).levels.find((r) => r.level === 38);
const PLAYTHROUGH = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const L38 = PLAYTHROUGH.preset_sidecars['1'].level_38.playable_payload;
const LATCH_CELL = '13,14';
const EV = 'L38 latch pressed';

/** L38's payload with a latching button on its room −1 ButtonRoom (and the payload's own Button left as it is). */
function latchWorld({ latch = { event: EV }, extra = {} } = {}) {
    const p = JSON.parse(JSON.stringify(L38));
    p.buttons = [...p.buttons, { x: 13, y: 14, id: 'button_latch' }];
    p.buttonLib = { ...p.buttonLib, button_latch: { kind: 'button', holds: 'sw_latch', ...(latch ? { latch } : {}) }, ...extra };
    return deserializeMazeWorld(p);
}

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

const viewOf = (state, extra = {}) => plainView({
    tilePx: 32, playerPos: state.player_pos, inventory: state.inventory, blocks: state.blocks ?? null,
    latched: state.latched ?? null, ...extra,
});
/** The latch's sprite op, formatted (its frame is the look: 0 up, 1 down). */
function latchOp(w, state, view = viewOf(state)) {
    const census = seedlingCensus(w, RECORD);
    const { ops } = seedlingSprites(census, art, { mazeWorld: w, view, blocks: state.blocks ?? null });
    const row = census.rows.find((r) => r.what === 'button' && r.cells[0] === LATCH_CELL);
    const lines = ops.map(formatOp).filter((l) => l.includes('uttonRoom') || l.includes('buttonRoom'));
    return { census, row, lines };
}

describe('the latched ButtonRoom look', () => {
    it('the scratch world loads, and the census claims the latch as the room −1 ButtonRoom, zero refusals', () => {
        const w = latchWorld();
        const { census, row } = latchOp(w, createState(w));
        expect(census.refusals).toEqual([]);
        expect(row.cls).toBe('ButtonRoom');
        expect(row.e.attrs.room).toBe('-1');
    });

    it('UP at the start, DOWN while latched this visit, DOWN with its event carried — nobody standing on it', () => {
        const w = latchWorld();
        const s = createState(w);
        expect(s.player_pos).not.toEqual({ x: 13, y: 14 });
        const up = latchOp(w, s).lines;
        const latched = latchOp(w, { ...s, latched: [LATCH_CELL] }).lines;
        const carried = latchOp(w, { ...s, inventory: new Set([EV]) }).lines;
        expect(up).toHaveLength(1);
        expect(latched).toHaveLength(1);
        expect(up[0]).not.toEqual(latched[0]);
        expect(carried).toEqual(latched);
        // the down look is the frame a press draws: the same op with the player on the cell
        expect(latchOp(w, { ...s, player_pos: { x: 13, y: 14 } }).lines).toEqual(latched);
    });

    it('art off: the ring is filled while latched, open before', () => {
        const w = latchWorld();
        const s = createState(w);
        const fills = (state) => {
            const ctx = recordingContext();
            drawLiveMarkers(ctx, w, viewOf(state, { tilePx: 8 }));
            return ctx.__log.filter((op) => op === 'fill()').length;
        };
        expect(fills({ ...s, latched: [LATCH_CELL] })).toBe(fills(s) + 1);
        expect(fills({ ...s, inventory: new Set([EV]) })).toBe(fills(s) + 1);
    });

    it('the view refuses a `latched` that is not an array (null = none)', async () => {
        const { drawWorld } = await import('./mazeRoomRender.js');
        const w = latchWorld();
        expect(() => drawWorld(recordingContext(), w, { ...viewOf(createState(w)), latched: '13,14' })).toThrow(/view\.latched must be null or an array/);
        const view = viewOf(createState(w));
        delete view.latched;
        expect(() => drawWorld(recordingContext(), w, view)).toThrow(/the view is missing "latched"/);
    });
});

describe('the census refuses a latch the game would not draw so, by name', () => {
    it('a latch on a Button (per visit in the game)', () => {
        const w = latchWorld({ extra: { button_0: { kind: 'button', holds: 'sw_0', latch: {} } } });
        expect(seedlingCensus(w, RECORD).refusals).toEqual([expect.stringMatching(/^L38 button at 5,12: it latches, but .* is a Button, which holds per visit$/)]);
    });
    it('a room −1 ButtonRoom laid as a per-visit hold', () => {
        const w = latchWorld({ latch: null });
        expect(seedlingCensus(w, RECORD).refusals).toEqual([expect.stringMatching(/^L38 button at 13,14: .* is a room −1 ButtonRoom, which latches, laid as a per-visit hold$/)]);
    });
});
