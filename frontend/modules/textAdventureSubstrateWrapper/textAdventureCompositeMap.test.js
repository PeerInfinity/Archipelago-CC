/**
 * textAdventureCompositeMap — **THE TEXT ADVENTURE'S MAP CELL, PAINTED FROM THE
 * ROOM** (⛓ PRESET SIDECARS G2a).
 *
 * The painter is reached the way the map reaches it: the registry entry's
 * `compositeMap.drawRegion`, over a region whose `playable_payload` is the
 * entry's own `deserializeWorld` of a payload the entry's own serializer wrote
 * (two gated exits, one open, three locations — one gated). The canvas is a
 * recorder; every assertion is over the recorded operations.
 */
import { describe, expect, it } from 'vitest';

import { TILE_PX, COLORS, resolveExitTilePositions } from '../procgenCore/compositeMapRenderer.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';
import {
    extractTextAdventureRules,
    generateTextAdventureRoom,
    placeTextAdventureRules,
    serializeTextAdventureRoom,
} from './textAdventureRoom.js';

/** A `CanvasRenderingContext2D` stand-in that records every call (1 char = 1px). */
function makeCtx() {
    const ops = [];
    const ctx = {
        fillStyle: null, strokeStyle: null, lineWidth: null, font: null, textAlign: null, textBaseline: null,
        fillRect: (...a) => ops.push({ op: 'fillRect', style: ctx.fillStyle, a }),
        strokeRect: (...a) => ops.push({ op: 'strokeRect', style: ctx.strokeStyle, a }),
        fillText: (...a) => ops.push({ op: 'fillText', style: ctx.fillStyle, a }),
        save: () => {}, restore: () => {},
        measureText: (s) => ({ width: String(s ?? '').length }),
    };
    return { ctx, ops };
}

const REGION_ID = 'Hall';
const GATE_A = { rule: 'Has', args: { item_name: 'Red Key' } };
const GATE_B = { rule: 'HasAll', args: { items: ['Lamp', 'Rope'] } };
/** Wide enough that no location name is cut or folded into "+N more". */
const SIZE = { width: 40, height: 20 };

/** The room's payload, written by the entry's own hooks. */
function hallPayload() {
    const { world } = generateTextAdventureRoom({
        region_id: REGION_ID,
        exits: [
            { exit_id: 'north_door', side: 'N', targetRegion: 'Attic' },
            { exit_id: 'east_door', side: 'E', targetRegion: 'Kitchen' },
            { exit_id: 'south_door', side: 'S', targetRegion: 'Garden' },
        ],
    });
    placeTextAdventureRules(world, {
        exit_rules: { north_door: GATE_A, east_door: GATE_B, south_door: { rule: 'True_' } },
        location_rules: { chest: GATE_A, shelf: { rule: 'True_' } },
        item_placements: [{ item_id: 'Lamp', location_id: 'shelf' }, { item_id: 'Rope', location_id: 'rug' }],
    });
    return serializeTextAdventureRoom(world, extractTextAdventureRules(world, { regionId: REGION_ID }));
}

function paint(room) {
    const { ctx, ops } = makeCtx();
    substrateRegistryEntry.compositeMap.drawRegion(ctx, { region_id: REGION_ID, playable_payload: room }, {
        offX: 0, offY: 0, regionSize: SIZE,
    });
    return ops;
}

const exitMarkers = (ops) => ops.filter((o) => o.op === 'fillRect'
    && (o.style === COLORS.exit || o.style === COLORS.exitBlocked)
    && o.a[2] === TILE_PX && o.a[3] === TILE_PX);
const texts = (ops) => ops.filter((o) => o.op === 'fillText').map((o) => o.a[0]);

describe('the text adventure\'s composite-map cell is painted from the ROOM', () => {
    it('a sides-only payload: 0 throws, one exit marker per exit on its SIDE, a gate drawn closed', () => {
        const payload = hallPayload();
        for (const e of payload.exits) {
            expect(e, e.exit_id).not.toHaveProperty('x');
            expect(e, e.exit_id).not.toHaveProperty('y');
        }
        const room = substrateRegistryEntry.deserializeWorld(payload);
        const ops = paint(room);
        const markers = exitMarkers(ops);
        expect(markers).toHaveLength(payload.exits.length);

        const lastX = SIZE.width - 1;
        const lastY = SIZE.height - 1;
        const onSide = { N: (x, y) => y === 0, S: (x, y) => y === lastY, E: (x) => x === lastX, W: (x) => x === 0 };
        const placed = resolveExitTilePositions(room.exits, SIZE);
        for (const { exit, x, y } of placed) {
            expect(onSide[exit.side](x, y), `${exit.exit_id} on ${exit.side}`).toBe(true);
            const marker = markers.find((m) => m.a[0] === x * TILE_PX && m.a[1] === y * TILE_PX);
            expect(marker, `${exit.exit_id} marker`).toBeTruthy();
            const gated = exit.exit_id in payload.exitGates;
            expect(marker.style, `${exit.exit_id} gate`).toBe(gated ? COLORS.exitBlocked : COLORS.exit);
        }
        // Both colours are exercised: the spec has gated and open exits.
        expect(new Set(markers.map((m) => m.style))).toEqual(new Set([COLORS.exit, COLORS.exitBlocked]));
    });

    it('the location count and names come from the room; a gated location is marked locked', () => {
        const payload = hallPayload();
        const ops = paint(substrateRegistryEntry.deserializeWorld(payload));
        const drawn = texts(ops);
        const n = payload.locations.length;
        expect(drawn).toContain(`${n} location${n === 1 ? '' : 's'}`);
        for (const l of payload.locations) {
            const locked = !!l.access_rule;
            expect(drawn, l.name).toContain(`${locked ? '\u{1F512} ' : '• '}${l.name}`);
        }
        expect(payload.locations.some((l) => l.access_rule)).toBe(true);
        expect(payload.locations.some((l) => !l.access_rule)).toBe(true);
    });

    it('the live build\'s room (locations by id, no AP name yet) is labelled by id', () => {
        const { world } = generateTextAdventureRoom({ region_id: REGION_ID, exits: [{ exit_id: 'out', side: 'W' }] });
        placeTextAdventureRules(world, { location_rules: { chest: GATE_A }, item_placements: [] });
        const ops = paint(world);
        expect(texts(ops)).toContain('1 location');
        expect(texts(ops)).toContain('\u{1F512} chest');
        expect(exitMarkers(ops)).toHaveLength(1);
    });

    it('⛔ no entrance mark and no tile read: a stray `entrance` / `items` / `obstacles` key is not drawn', () => {
        const room = substrateRegistryEntry.deserializeWorld(hallPayload());
        const clean = paint(room);
        const stray = paint({
            ...room,
            entrance: { x: 3, y: 3 },
            items: new Map([['5,5', 'Ghost']]),
            itemLocationNames: new Map([['5,5', 'Ghost Location']]),
            obstacles: new Map([['5,5', 'logic_gate_0']]),
        });
        expect(stray.filter((o) => o.op === 'strokeRect')).toEqual([]);
        expect(stray).toEqual(clean);
    });

    it('⛔ a tile-grid payload (the format written before G2a) is REFUSED before anything is painted', () => {
        const legacy = {
            width: 8, height: 6, tiles: [], entrance: { x: 4, y: 3 },
            exits: [{ exit_id: 'e', x: 7, y: 1, side: 'E', exitName: 'e', targetRegion: 'X', targetExitId: null, isBackExit: false, isTeleporter: false }],
            items: [{ x: 2, y: 2, id: 'k', locationName: 'Legacy Location' }],
            fogEnabled: true,
        };
        let ops = null;
        expect(() => { ops = paint(substrateRegistryEntry.deserializeWorld(legacy)); })
            .toThrow(/^this payload is not a text-adventure room — it carries `width`, `height`, `tiles`, `items`, which a room does not have; it lacks `exitGates`, `locations`/);
        expect(ops).toBeNull();
    });
});
