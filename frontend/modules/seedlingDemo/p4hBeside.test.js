/**
 * seedling-p4h-beside — the JS side of pinning the p4h build beside the default p4g: the six capability words, the
 * AP chest roster (the chest readers), the fold's `secondaries` (emitted only for a build declaring them), and the
 * JS runtime's `botActivators` stub.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTIVATORS_CAPABILITY, AP_CHEST_CAPABILITY, BOSS_DRAWS_CAPABILITY, CHECKPOINT_CAPABILITY, SECONDARIES_CAPABILITY,
    SO_SAVE_CAPABILITY, WASM_BUILD_CAPABILITIES, jsRuntimeCapabilities,
} from '../flashPanel/seedlingRandomizerEligibility.js';
import { AP_CHEST_CLASS, apChestRowsOf, readActivatorsFor, withApChestRows } from './apChestRoster.js';
import { withMenuWrites } from './watchManual.js';
import { secondariesCapableOf } from './watchWasm.js';
import { createJsRuntime } from './jsRuntimeCore.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/wasm/builds.json'), 'utf8'));
const capsOf = (name) => MANIFEST.builds.find((b) => b.name === name)?.capabilities ?? [];
const DEFAULT = MANIFEST.builds.find((b) => b.role === 'default');

describe('the six p4h capability words', () => {
    it('are in the declared vocabulary, spelled as the manifest spells them', () => {
        expect([SECONDARIES_CAPABILITY, AP_CHEST_CAPABILITY, ACTIVATORS_CAPABILITY, CHECKPOINT_CAPABILITY,
            BOSS_DRAWS_CAPABILITY, SO_SAVE_CAPABILITY])
            .toEqual(['secondaries', 'apchest', 'activators', 'checkpoint', 'bossdraws', 'sosave']);
        for (const w of ['secondaries', 'apchest', 'activators', 'checkpoint', 'bossdraws', 'sosave']) {
            expect(WASM_BUILD_CAPABILITIES).toContain(w);
        }
    });

    it('the default declares none of them, and the JS runtime declares none of them', () => {
        const six = ['secondaries', 'apchest', 'activators', 'checkpoint', 'bossdraws', 'sosave'];
        expect(DEFAULT.capabilities.filter((c) => six.includes(c))).toEqual([]);
        expect(jsRuntimeCapabilities().filter((c) => six.includes(c))).toEqual([]);
    });
});

describe('the AP chest roster (the chest readers)', () => {
    const P4H = ['apitem', 'apchest'];
    const P4G = ['apitem'];
    const mobiles = [{ cls: 'Player', x: 1, y: 2 }, { cls: 'Pickups::APItem', x: 40, y: 40 }];
    const activators = { tick: 3, activators: [{ cls: 'Puzzlements::Lock', x: 0, y: 0 }],
        chests: [{ cls: AP_CHEST_CLASS, x: 88, y: 24, tag: 7 }, { cls: 'Chest', x: 8, y: 8, tag: 1 }] };

    it('on a build declaring `apchest`: botMobiles ∪ the APChest rows (never a vanilla Chest, never a lock)', () => {
        expect(withApChestRows(mobiles, { capabilities: P4H, activators })).toEqual([...mobiles, activators.chests[0]]);
        expect(withApChestRows(mobiles, { capabilities: P4H, activators: JSON.stringify(activators) }))
            .toEqual([...mobiles, activators.chests[0]]);
    });

    it('on any other build: botMobiles alone, whatever a reading holds', () => {
        expect(withApChestRows(mobiles, { capabilities: P4G, activators })).toBe(mobiles);
        expect(apChestRowsOf([], activators)).toEqual([]);
    });

    it('a UNION, not a switch: with no APChest (today\'s delivery writes no kind="chest") the APItem stays', () => {
        expect(withApChestRows(mobiles, { capabilities: P4H, activators: { chests: [] } })).toBe(mobiles);
        expect(withApChestRows(mobiles, { capabilities: P4H, activators: null })).toBe(mobiles);
        expect(withApChestRows(mobiles, { capabilities: P4H, activators: 'not json' })).toBe(mobiles);
    });

    it('`readActivatorsFor` asks only a build declaring `apchest`, and survives a missing or throwing export', () => {
        let asked = 0;
        const game = { botActivators: () => { asked += 1; return JSON.stringify(activators); } };
        expect(readActivatorsFor(game, P4G)).toBeNull();
        expect(asked).toBe(0);
        expect(readActivatorsFor(game, P4H)).toEqual(activators);
        expect(readActivatorsFor({}, P4H)).toBeNull();
        expect(readActivatorsFor({ botActivators: () => { throw new Error('x'); } }, P4H)).toBeNull();
    });

    it('the pinned manifest: p4h declares `apchest`, the default does not', () => {
        expect(capsOf('seedling_bot_ap_p4h')).toContain('apchest');
        expect(DEFAULT.capabilities).not.toContain('apchest');
    });
});

describe('the fold\'s `secondaries` — emitted only for a build declaring them', () => {
    const staging = { equips: [{ t: 0, slot: 1 }] };
    const run = { secondariesFired: [{ t: 4, slot: 2 }, { t: 9, slot: 0 }], inventoryMenuEquips: [] };

    it('refuses by name without the capability (p4g, the JS runtime, an unread manifest)', () => {
        expect(() => withMenuWrites(staging, run)).toThrow(/secondaries: \[\{t, slot\}\]/);
        expect(() => withMenuWrites(staging, run, { secondariesCapable: false })).toThrow(/does not declare `secondaries`/);
    });

    it('emits them with it, the equips untouched', () => {
        const out = withMenuWrites(staging, run, { secondariesCapable: true });
        expect(out.secondaries).toEqual([{ t: 4, slot: 2 }, { t: 9, slot: 0 }]);
        expect(out.equips).toEqual(staging.equips);
    });

    it('an untouched session returns the staging itself', () => {
        expect(withMenuWrites(staging, { secondariesFired: [], inventoryMenuEquips: [] }, { secondariesCapable: true }))
            .toBe(staging);
    });

    it('`secondariesCapableOf` reads the manifest: p4h yes, the default no, unread no', () => {
        expect(secondariesCapableOf(MANIFEST, '../flashPanel/wasm/seedling_bot_ap_p4h/game.html')).toBe(true);
        expect(secondariesCapableOf(MANIFEST, `../flashPanel/wasm/${DEFAULT.name}/game.html`)).toBe(false);
        expect(secondariesCapableOf(null, '../flashPanel/wasm/seedling_bot_ap_p4h/game.html')).toBe(false);
    });
});

describe('the JS runtime\'s `botActivators` stub', () => {
    it('answers the p4h shape with empty rosters', () => {
        const rt = createJsRuntime();
        expect(JSON.parse(rt.game.botActivators())).toEqual({ tick: 0, activators: [], chests: [] });
    });
});
