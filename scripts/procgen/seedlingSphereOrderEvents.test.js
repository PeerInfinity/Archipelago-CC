/**
 * ⛓ RULES obstacle-events (⚖ planner, option B) — **EVENTS NEVER NUMBER A LABEL.** The sphere log writes
 * each event as its own fractional step; the sphere order skips them and counts a sphere's labels over
 * its REAL steps, so the committed artifact (and every label the survey and the frontier key on) reads
 * the same with or without events in the log.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { orderRows } from './make-seedling-sphere-order.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const step = (sphere, locations, item) => ({
    type: 'state_update', sphere_index: sphere,
    player_data: { 1: { sphere_locations: locations, new_inventory_details: { base_items: { [item]: 1 } } } },
});

describe('make-seedling-sphere-order — events never number a label', () => {
    const real = [step('0', [], 'x'), step('0.1', ['Level 010 - Sword'], 'Sword'), step('1.1', ['Level 019 - Key'], 'Key'),
        step('1.2', ['Level 036 - Chest'], 'Seal')];
    const withEvents = [step('0', [], 'x'), step('0.1', ['Level 010 - Sword'], 'Sword'),
        step('1.1', ['L0 flag 1: rock cleared'], 'L0 flag 1: rock cleared'),
        step('1.2', ['Level 019 - Key'], 'Key'), step('1.3', ['L0 flag 4: rock cleared'], 'L0 flag 4: rock cleared'),
        step('1.4', ['Level 036 - Chest'], 'Seal')];
    const meta = (events) => ({ type: 'metadata', seed: 1, seed_name: 's',
        event_locations: { 1: events }, event_items: { 1: events } });

    it('the same rows, labels and all, with or without events in the log', () => {
        const a = orderRows([meta([]), ...real]);
        const b = orderRows([meta(['L0 flag 1: rock cleared', 'L0 flag 4: rock cleared']), ...withEvents]);
        expect(b).toEqual(a);
        expect(b.rows.map((r) => r.sphere)).toEqual(['0.1', '1.1', '1.2']);
    });

    it('a log that names no events is read as it always was', () => {
        const rows = orderRows([meta([]), ...withEvents]).rows;
        expect(rows.map((r) => r.sphere)).toEqual(['0.1', '1.1', '1.2', '1.3', '1.4']);
    });

    it('the committed log carries the playthrough\'s events, and the committed order none of them', () => {
        const log = readFileSync(join(REPO,
            'frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl'), 'utf8')
            .trim().split('\n').map((l) => JSON.parse(l));
        const events = log.find((l) => l.type === 'metadata').event_locations['1'];
        expect(events.length).toBeGreaterThan(0);
        const order = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-sphere-order.json'), 'utf8'));
        expect(order.order.filter((r) => events.includes(r.location) || r.level < 0)).toEqual([]);
        expect(order.order).toEqual(orderRows(log).rows);
    });
});
