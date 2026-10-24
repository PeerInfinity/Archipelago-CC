/**
 * ⛓ GRAPHICS G1 — the flash panel's graphics/camera settings: the value lists are the registry's stacks and the
 * renderer's camera modes (written twice because the panel's closure stays model-free; held equal here), the schema
 * is registered, and the defaults put NOTHING on the JS page's URL.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CAMERA_SETTING_VALUES, GRAPHICS_SETTING_VALUES, LIGHTS_SETTING_VALUES, cameraMode, graphicsPageParams, graphicsSchemaProps, graphicsStack,
    lightsMode,
} from './seedlingGraphicsSettings.js';
import { CAMERA_MODES } from '../seedlingDemo/seedlingSkinRenderer.js';
import { register } from './index.js';

const REGISTRY = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../packs/packs.json'), 'utf8'));

describe('seedlingGraphicsSettings', () => {
    it('graphics = rects + every stack packs.json names; camera = the renderer\'s modes', () => {
        expect(GRAPHICS_SETTING_VALUES).toEqual(['rects', ...Object.keys(REGISTRY.graphics)]);
        expect(CAMERA_SETTING_VALUES).toEqual([...CAMERA_MODES]);
    });

    it('the defaults are today\'s page: no query parameter at all', () => {
        const props = graphicsSchemaProps();
        expect(graphicsPageParams(props.seedlingJsGraphics.default, props.seedlingJsCamera.default)).toBe('');
        expect(graphicsPageParams(undefined, undefined)).toBe('');
        expect(graphicsPageParams('nonsense', 'nonsense')).toBe('');
    });

    it('off-default values ride on the URL', () => {
        expect(graphicsPageParams('seedling', 'room')).toBe('graphics=seedling');
        expect(graphicsPageParams('rects', 'follow')).toBe('camera=follow');
        expect(graphicsPageParams('seedling', 'follow')).toBe('graphics=seedling&camera=follow');
        expect(graphicsStack('rects')).toBeNull();
        expect(cameraMode('follow')).toBe('follow');
    });

    it('the flash panel registers both props in its schema', () => {
        let schema = null;
        const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
        register(api);
        expect(schema.properties.seedlingJsGraphics).toMatchObject({ type: 'string', default: 'rects' });
        expect(schema.properties.seedlingJsCamera).toMatchObject({ type: 'string', default: 'room', enum: ['room', 'follow'] });
        expect(schema.properties.seedlingJsLights).toMatchObject({ type: 'string', default: 'on', enum: ['on', 'off'] });
    });

    it('⛓ G5 — the lights: ON by default (nothing on the URL), `off` rides as lights=off', () => {
        const props = graphicsSchemaProps();
        expect(LIGHTS_SETTING_VALUES).toEqual(['on', 'off']);
        expect(graphicsPageParams(props.seedlingJsGraphics.default, props.seedlingJsCamera.default, props.seedlingJsLights.default)).toBe('');
        expect(graphicsPageParams('seedling', 'room', 'off')).toBe('graphics=seedling&lights=off');
        expect(graphicsPageParams('seedling', 'follow', 'on')).toBe('graphics=seedling&camera=follow');
        expect([lightsMode('off'), lightsMode('on'), lightsMode('nonsense'), lightsMode(undefined)]).toEqual(['off', 'on', 'on', 'on']);
    });
});
