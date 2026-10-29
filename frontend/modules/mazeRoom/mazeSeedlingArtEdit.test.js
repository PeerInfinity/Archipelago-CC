/**
 * maze-seedling-art-2 — THE STALE-ART DEFECT S1 reported: the panel's baked Seedling room was cached per world
 * OBJECT, so an in-place edit (`_applyEditAt`) with the art on kept the room baked for the world BEFORE the edit:
 * an obstacle placed on a level object's cell left that object baked under the maze's marker, and a wall the editor
 * drew was invisible (the art is the level's tiles, not the maze's). The layer is now kept only while
 * `seedlingLayerKey` (level, modelled cells, edited tiles) is unchanged.
 *
 * Driven through the panel in node: the art is the committed packs (no images — every sprite paints as its stand-in),
 * the canvas a context that keeps the fills it is given.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { MazeRoomUI } from './mazeRoomUI.js';
import { _testOnly_resetModuleState } from './index.js';
import { PALETTE_TYPES } from './mazeRoomEditor.js';
import { TILE_WALL, createState, deserializeMazeWorld, getTile, posKey } from './mazeRoomEngine.js';
import { COLORS } from './mazeRoomRender.js';
import { SEEDLING_CELL_PX, levelWorldFor, mazeModelledCells } from './mazeSeedlingSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const L0 = RULES.preset_sidecars['1'].level_0__r1c6.playable_payload;

/** A 2D context that keeps its fills and ignores everything else (the bake's sprites have no images here). */
function laxContext() {
    const fills = [];
    let fillStyle = null;
    return new Proxy({ fills }, {
        get(t, key) {
            if (key === 'fills') return fills;
            if (key === 'fillStyle') return fillStyle;
            if (key === 'fillRect') return (x, y, w, h) => fills.push({ style: fillStyle, x, y, w, h });
            return () => {};
        },
        set(t, key, value) {
            if (key === 'fillStyle') fillStyle = value;
            return true;
        },
    });
}

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

let savedDocument;
beforeEach(() => {
    _testOnly_resetModuleState();
    savedDocument = globalThis.document;
});
afterEach(() => { globalThis.document = savedDocument; });

function panelOnL0() {
    const panel = new MazeRoomUI(null, {});
    const canvases = [];
    globalThis.document = {
        createElement: (tag) => {
            if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
            const ctx = laxContext();
            const c = { width: 0, height: 0, getContext: () => ctx, ctx };
            canvases.push(c);
            return c;
        },
    };
    panel.world = deserializeMazeWorld(JSON.parse(JSON.stringify(L0)));
    panel.state = createState(panel.world);
    panel._cachedRulesData = RULES;
    panel._cachedRulesPlayer = '1';
    panel._seedlingArt = { status: 'ready', art, images: new Map(), failed: [], credit: '', mapDoc: MAP };
    panel.render = () => {};
    panel._runVerifier = () => {};
    return { panel, canvases };
}

/** A floor cell of L0 that the maze does not model, under a baked level object (a rock, a tree, …). */
function bakedObjectCell(mazeWorld) {
    const { world } = levelWorldFor(MAP, 0, mazeWorld);
    const modelled = mazeModelledCells(mazeWorld);
    for (const o of [...world.objectSolids, ...world.pixelmasks]) {
        const r = o.rect;
        const x = Math.floor((r.x + (r.right ?? r.x + r.w)) / 2 / 16);
        const y = Math.floor((r.y + (r.bottom ?? r.y + r.h)) / 2 / 16);
        if (!modelled.has(posKey(x, y)) && getTile(mazeWorld, x, y) !== TILE_WALL) return { x, y };
    }
    throw new Error('L0 has no baked object on an unmodelled floor cell');
}

describe('maze-seedling-art-2: an in-place edit rebakes the Seedling room', () => {
    it('a render without an edit is a hit (one bake per world)', () => {
        const { panel } = panelOnL0();
        expect(panel._seedlingSkinView()).not.toBe(null);
        expect(panel._seedlingSkinView()).not.toBe(null);
        expect(panel.getSeedlingArtStatus()).toMatchObject({ builds: 1, hits: 1 });
    });

    it('an obstacle placed on a baked object\'s cell rebakes without that object', () => {
        const { panel } = panelOnL0();
        panel._seedlingSkinView();
        const before = panel.getSeedlingArtStatus().last.ops;
        const cell = bakedObjectCell(panel.world);
        const editor = panel._ensureEditor();
        editor.selectType(PALETTE_TYPES.OBSTACLE);
        panel._applyEditAt(cell.x, cell.y);
        expect(panel.world.obstacles.has(posKey(cell.x, cell.y))).toBe(true);
        panel._seedlingSkinView();
        const after = panel.getSeedlingArtStatus();
        expect(after.builds).toBe(2);
        expect(after.last.ops).toBeLessThan(before);
    });

    it('a wall drawn by the editor is painted over the art; erasing it again rebakes clean', () => {
        const { panel, canvases } = panelOnL0();
        panel._seedlingSkinView();
        const { x, y } = panel.world.entrance;
        const target = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
            .find(([cx, cy]) => getTile(panel.world, cx, cy) !== TILE_WALL);
        const editor = panel._ensureEditor();
        editor.selectType(PALETTE_TYPES.WALL);
        panel._applyEditAt(...target);
        panel._seedlingSkinView();
        expect(panel.getSeedlingArtStatus()).toMatchObject({ builds: 2, last: { edits: 1 } });
        const fill = canvases.at(-1).ctx.fills.at(-1);
        expect(fill).toEqual({
            style: COLORS.wall, x: target[0] * SEEDLING_CELL_PX, y: target[1] * SEEDLING_CELL_PX,
            w: SEEDLING_CELL_PX, h: SEEDLING_CELL_PX,
        });
        editor.selectType(PALETTE_TYPES.FLOOR);
        panel._applyEditAt(...target);
        panel._seedlingSkinView();
        expect(panel.getSeedlingArtStatus()).toMatchObject({ builds: 3, last: { edits: 0 } });
    });
});
