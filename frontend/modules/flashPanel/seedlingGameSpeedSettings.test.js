/**
 * ⛓ GAME SPEED — the flash panel's speed setting: its range and verdicts are the page clock's (written twice because
 * the panel's closure stays model-free; held equal here), the schema is registered, 1× puts NOTHING on the JS page's
 * URL, and the Settings row shows on the js runtime only. ⛓ CUSTOM SPEED: a number 0.25 … 16; the old values migrate.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    SPEED_MAX, SPEED_MIN, SPEED_QUICK_CHOICES, SPEED_STEP, achievedReadout, gameSpeed, gameSpeedPageParam, gameSpeedSchemaProps,
    readGameSpeed,
} from './seedlingGameSpeedSettings.js';
import {
    GAME_SPEED_STEP, GAME_SPEEDS, MAX_GAME_SPEED, MIN_GAME_SPEED, checkGameSpeed, parseGameSpeed,
} from '../seedlingDemo/jsRuntimeClock.js';
import { register } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('seedlingGameSpeedSettings', () => {
    it('the quick choices and the range are the clock\'s, and each speed the page parses back to itself', () => {
        expect([...SPEED_QUICK_CHOICES]).toEqual([...GAME_SPEEDS]);
        expect([SPEED_MIN, SPEED_MAX, SPEED_STEP]).toEqual([MIN_GAME_SPEED, MAX_GAME_SPEED, GAME_SPEED_STEP]);
        for (const v of [0.25, 0.5, 1, 1.5, 2, 3, 4, 7.35, 16, '1x', '2x', '4x', '1.5', '3x']) {
            const q = gameSpeedPageParam(v);
            expect(parseGameSpeed(q ? new URLSearchParams(q).get('speed') : null)).toBe(gameSpeed(v));
        }
    });

    it('⛓ CUSTOM SPEED — every verdict is the clock\'s (written twice: the panel stays model-free)', () => {
        const probes = [0, 0.2, 0.24, 0.25, 0.3, 0.1 + 0.2, 0.33, 0.5, 1, 1.05, 1.5, 2.999, 3, 15.95, 16, 16.05, 17, -1,
            NaN, Infinity, '1.5', '1.5x', '1.5×', ' 2 ', 'fast', '0x', '20'];
        for (const v of probes) {
            const panel = readGameSpeed(v);
            const clock = checkGameSpeed(v);
            expect({ ok: panel.ok, speed: panel.speed, reason: panel.reason }, String(v))
                .toEqual({ ok: clock.ok, speed: clock.speed, reason: clock.reason });
        }
        expect(readGameSpeed(0.1 + 0.2)).toEqual({ ok: true, speed: 0.3, legacy: false });
    });

    it('⛓ CUSTOM SPEED — the old 1x / 2x / 4x migrate (legacy: the panel writes the number back); a number is not legacy', () => {
        expect(readGameSpeed('1x')).toEqual({ ok: true, speed: 1, legacy: true });
        expect(readGameSpeed('2x')).toEqual({ ok: true, speed: 2, legacy: true });
        expect(readGameSpeed('4x')).toEqual({ ok: true, speed: 4, legacy: true });
        expect(readGameSpeed(1.5)).toEqual({ ok: true, speed: 1.5, legacy: false });
        expect(readGameSpeed(undefined)).toEqual({ ok: true, speed: 1, legacy: false });
    });

    it('⛓ CUSTOM SPEED — out of range or off the grid is REFUSED with its reason, never clamped; the page then plays 1×', () => {
        expect(readGameSpeed(20)).toEqual({ ok: false, reason: '20× is above the maximum 16×' });
        expect(readGameSpeed(0.1)).toEqual({ ok: false, reason: '0.1× is below the minimum 0.25×' });
        expect(readGameSpeed(1.33)).toEqual({ ok: false, reason: '1.33× is not a multiple of 0.05' });
        expect(readGameSpeed('fast')).toEqual({ ok: false, reason: 'fast is not a number' });
        for (const v of [20, 0.1, 1.33, 'fast']) {
            expect(gameSpeed(v)).toBe(1);
            expect(gameSpeedPageParam(v)).toBe('');
        }
        expect(() => parseGameSpeed('20')).toThrow(/\?speed=20: 20× is above the maximum 16× \(0\.25–16, in steps of 0\.05\)/);
    });

    it('⛓ CUSTOM SPEED — the achieved readout: blank before a second ran, flagged under 95 % of the request', () => {
        expect(achievedReadout(4, 0)).toEqual({ text: '', short: false });
        expect(achievedReadout(4, 3.98)).toEqual({ text: 'achieved 3.98×', short: false });
        expect(achievedReadout(16, 9.5)).toEqual({ text: 'achieved 9.5× — the browser cannot keep up', short: true });
    });

    it('1× (the default) is today\'s page: no query parameter; others ride as speed=<n>', () => {
        expect(gameSpeedPageParam(gameSpeedSchemaProps().seedlingJsSpeed.default)).toBe('');
        expect(gameSpeedPageParam(undefined)).toBe('');
        expect(gameSpeedPageParam('nonsense')).toBe('');
        expect(gameSpeedPageParam('2x')).toBe('speed=2');
        expect(gameSpeedPageParam('4x')).toBe('speed=4');
        // ⛓ the panel caches the speed it READ (a number) and builds the URL from that: the same answer
        expect([1, 2, 4, 3, 0.5, 1.5, 16].map(gameSpeedPageParam)).toEqual(['', 'speed=2', 'speed=4', 'speed=3', 'speed=0.5', 'speed=1.5', 'speed=16']);
        expect(gameSpeed(4)).toBe(4);
    });

    it('the flash panel registers the prop in its schema (a per-key module setting, default 1x)', () => {
        let schema = null;
        const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
        register(api);
        expect(schema.properties.seedlingJsSpeed).toMatchObject({ type: 'number', default: 1, minimum: 0.25, maximum: 16, multipleOf: 0.05 });
        expect(schema.properties.seedlingJsSpeed.enum).toBeUndefined();
    });

    it('the Settings section\'s row is the js runtime\'s only (hidden on wasm / flash), and the page URL carries it', () => {
        const ui = readFileSync(join(HERE, 'flashPanelUI.js'), 'utf8');
        expect(ui).toMatch(/\{ prop: 'seedlingJsSpeed', label: 'Game speed', when: 'js', control: 'speed' \}/);
        expect(ui).toMatch(/gameSpeedPageParam\(this\._jsSpeed\)/);
    });
});
