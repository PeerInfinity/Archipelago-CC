/**
 * seedling-live-server.mjs — the pure halves: argv, the upstream refusal, the
 * room's players and what the wire says. The live run itself is the scaffold's
 * proof (docs/json/developer/procgen/seedling-bot.md § Live-server test).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkUpstream, parseArgs, playerYamls, wireSummary } from './seedling-live-server.mjs';

describe('seedling-live-server', () => {
    it('argv: defaults, AP_UPSTREAM, and a refusal for an unknown flag', () => {
        expect(parseArgs([], {})).toMatchObject({ upstream: null, seed: 2, budgetS: 120, runtime: 'js', withApquest: false, keep: false });
        expect(parseArgs([], { AP_UPSTREAM: '/x' }).upstream).toBe('/x');
        expect(parseArgs(['--upstream=/y', '--seed=3', '--ws-port=38999', '--with-apquest'], { AP_UPSTREAM: '/x' }))
            .toMatchObject({ upstream: '/y', seed: 3, wsPort: 38999, withApquest: true });
        expect(() => parseArgs(['--runtime=flash'], {})).toThrow(/js or wasm/);
        expect(() => parseArgs(['--bogus'], {})).toThrow(/unknown argument/);
    });

    it('no upstream, or a directory that is not one, is refused with what to do', () => {
        expect(() => checkUpstream(null)).toThrow(/--upstream=<dir> or set AP_UPSTREAM/);
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'not-ap-'));
        try { expect(() => checkUpstream(empty)).toThrow(/not an Archipelago checkout: no MultiServer\.py/); } finally { fs.rmSync(empty, { recursive: true, force: true }); }
    });

    it('the room: Sprout at slot 1 with its spoiler data in its own slot; Questy only on request', () => {
        expect(Object.keys(playerYamls({ withApquest: false }))).toEqual(['1_seedling.yaml']);
        const two = playerYamls({ withApquest: true });
        expect(Object.keys(two)).toEqual(['1_seedling.yaml', '2_quest.yaml']);
        expect(two['1_seedling.yaml']).toContain('spoiler_data_in_slot_data: own_slot');
    });

    it('the wire: distinct checks sent, the slot, and the goal only when it is Sprout\'s', () => {
        const w = wireSummary([
            { dir: '<', cmd: 'Connected', slot: 1, missing: 48, checked: 0 },
            { dir: '>', cmd: 'LocationChecks', locations: [30000005] },
            { dir: '>', cmd: 'LocationChecks', locations: [30000005, 30000014] },
            { dir: '<', cmd: 'PrintJSON', text: 'Questy (Team #1) has completed their goal.' },
        ]);
        expect(w).toEqual({ sent: 2, goal: false, connected: { slot: 1, missing: 48, checked: 0 }, refused: null });
        expect(wireSummary([{ dir: '<', cmd: 'PrintJSON', text: 'Sprout (Team #1) has completed their goal.' }]).goal).toBe(true);
    });
});
