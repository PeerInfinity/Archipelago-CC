/**
 * seedlingSoundSettings — the three settings, the page parameters, and the
 * ▶ Start bypass for automated runs.
 */
import { describe, expect, it } from 'vitest';

import {
    START_SETTING_VALUES, VOLUME_SETTING_VALUES, isAutomatedRun, soundMode, soundPageParams, soundSchemaProps, soundVolume, startMode,
} from './seedlingSoundSettings.js';

describe('seedlingSoundSettings', () => {
    it('the schema: sound on|off (on), volume 0–100 in tens (100), start tests-auto|click|auto (tests-auto)', () => {
        const s = soundSchemaProps();
        expect(s.seedlingJsSound).toMatchObject({ type: 'string', enum: ['on', 'off'], default: 'on' });
        expect(s.seedlingJsVolume).toMatchObject({ type: 'number', default: 100 });
        expect(VOLUME_SETTING_VALUES).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
        expect(s.seedlingJsStart).toMatchObject({ type: 'string', default: 'tests-auto' });
        expect(START_SETTING_VALUES).toEqual(['tests-auto', 'click', 'auto']);
    });

    it('the page parameters: none for on / 100 / auto; sound=off, volume=<n>, start=click otherwise', () => {
        expect(soundPageParams('on', 100, 'auto')).toBe('');
        expect(soundPageParams('off', 40, 'click')).toBe('sound=off&volume=40&start=click');
        expect(soundPageParams(undefined, undefined, undefined)).toBe('');
        expect(soundMode('bogus')).toBe('on');
        expect(soundVolume('70')).toBe(70);
        expect(soundVolume(250)).toBe(100);
        expect(soundVolume('x')).toBe(100);
    });

    it('▶ START: tests-auto is `auto` only when the app page is in a test mode; click / auto are taken as set', () => {
        expect(isAutomatedRun('?mode=test-substrates')).toBe(true);
        expect(isAutomatedRun('?mode=test')).toBe(true);
        expect(isAutomatedRun('?mode=loops')).toBe(false);
        expect(isAutomatedRun('')).toBe(false);
        expect(startMode('tests-auto', '?mode=test-substrates&batch=fast')).toBe('auto');
        expect(startMode('tests-auto', '?mode=default')).toBe('click');
        expect(startMode('click', '?mode=test-substrates')).toBe('click');
        expect(startMode('auto', '')).toBe('auto');
    });
});
