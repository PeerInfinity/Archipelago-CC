/**
 * ⛓ GAME SPEED — the flash panel's speed setting: its values are the page clock's speeds (written twice because the
 * panel's closure stays model-free; held equal here), the schema is registered, 1× puts NOTHING on the JS page's
 * URL, and the Settings row shows on the js runtime only.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPEED_SETTING_VALUES, gameSpeed, gameSpeedPageParam, gameSpeedSchemaProps } from './seedlingGameSpeedSettings.js';
import { GAME_SPEEDS, parseGameSpeed } from '../seedlingDemo/jsRuntimeClock.js';
import { register } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('seedlingGameSpeedSettings', () => {
    it('the values are the clock\'s speeds, and each one the page parses back to itself', () => {
        expect(SPEED_SETTING_VALUES.map(gameSpeed)).toEqual([...GAME_SPEEDS]);
        for (const v of SPEED_SETTING_VALUES) expect(parseGameSpeed(v)).toBe(gameSpeed(v));
        for (const v of SPEED_SETTING_VALUES) {
            const q = gameSpeedPageParam(v);
            expect(parseGameSpeed(q ? new URLSearchParams(q).get('speed') : null)).toBe(gameSpeed(v));
        }
    });

    it('1× (the default) is today\'s page: no query parameter; 2× / 4× ride as speed=2 / speed=4', () => {
        expect(gameSpeedPageParam(gameSpeedSchemaProps().seedlingJsSpeed.default)).toBe('');
        expect(gameSpeedPageParam(undefined)).toBe('');
        expect(gameSpeedPageParam('nonsense')).toBe('');
        expect(gameSpeedPageParam('2x')).toBe('speed=2');
        expect(gameSpeedPageParam('4x')).toBe('speed=4');
        // ⛓ the panel caches the speed it READ (a number) and builds the URL from that: the same answer
        expect([1, 2, 4, 3].map(gameSpeedPageParam)).toEqual(['', 'speed=2', 'speed=4', '']);
        expect(gameSpeed(4)).toBe(4);
    });

    it('the flash panel registers the prop in its schema (a per-key module setting, default 1x)', () => {
        let schema = null;
        const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
        register(api);
        expect(schema.properties.seedlingJsSpeed).toMatchObject({ type: 'string', default: '1x', enum: ['1x', '2x', '4x'] });
    });

    it('the Settings section\'s row is the js runtime\'s only (hidden on wasm / flash), and the page URL carries it', () => {
        const ui = readFileSync(join(HERE, 'flashPanelUI.js'), 'utf8');
        expect(ui).toMatch(/\{ prop: 'seedlingJsSpeed', label: 'Game speed', when: 'js' \}/);
        expect(ui).toMatch(/gameSpeedPageParam\(this\._jsSpeed\)/);
    });
});
