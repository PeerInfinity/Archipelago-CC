/**
 * headlessChromium — the rows (slice seedling-headless-H1).
 *
 * ⛓ Three claims, each one a way the device-loss cure has already been lost
 * once or would be lost silently:
 *   1. ONE `--enable-features=` switch, whatever a site asks for — Chromium
 *      keeps only the last, and the probes' old line lost Vulkan exactly so.
 *   2. Playwright's own `--enable-features=` list is carried — anchored on the
 *      INSTALLED `chromiumSwitches.js`, not on this module's own constant.
 *   3. No file under `scripts/procgen/` spells the flags for itself.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    HEADLESS_WEBGPU_ARGS, HEADLESS_WEBGPU_FEATURES, PLAYWRIGHT_ENABLED_FEATURES,
    headlessWebgpuArgs,
} from './headlessChromium.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FEATURES = '--enable-features=';
const featureSwitches = (args) => args.filter((a) => a.startsWith(FEATURES));
const featuresOf = (args) => featureSwitches(args)[0].slice(FEATURES.length).split(',');

describe('headlessWebgpuArgs — one --enable-features= switch', () => {
    it('the default args carry exactly one switch, with Vulkan in it', () => {
        expect(featureSwitches(HEADLESS_WEBGPU_ARGS)).toHaveLength(1);
        expect(featuresOf(HEADLESS_WEBGPU_ARGS)).toContain('Vulkan');
        expect(HEADLESS_WEBGPU_ARGS).toContain('--use-vulkan=swiftshader');
        expect(HEADLESS_WEBGPU_ARGS).toContain('--use-angle=swiftshader');
    });

    it('a site\'s own features are MERGED into the one switch, never appended', () => {
        const args = headlessWebgpuArgs({ enableFeatures: ['WebAssemblyExperimentalJSPI', 'Foo'] });
        expect(featureSwitches(args)).toHaveLength(1);
        expect(featuresOf(args)).toEqual(expect.arrayContaining(
            [...HEADLESS_WEBGPU_FEATURES, ...PLAYWRIGHT_ENABLED_FEATURES,
                'WebAssemblyExperimentalJSPI', 'Foo']));
    });

    it('a second switch smuggled in through `extra` is REFUSED by name', () => {
        expect(() => headlessWebgpuArgs({ extra: ['--enable-features=WebAssemblyExperimentalJSPI'] }))
            .toThrow(/SECOND --enable-features= switch/);
    });

    it('non-feature extras are appended untouched', () => {
        const args = headlessWebgpuArgs({ extra: ['--autoplay-policy=no-user-gesture-required'] });
        expect(args.at(-1)).toBe('--autoplay-policy=no-user-gesture-required');
        expect(featureSwitches(args)).toHaveLength(1);
    });
});

describe("Playwright's own --enable-features= list survives the merge", () => {
    it('every feature the installed chromiumSwitches.js enables is in the merged switch', () => {
        // ⛓ The datum is the INSTALLED Playwright, so a bump that adds a feature
        // reds here instead of being deleted by our switch in silence.
        const require = createRequire(import.meta.url);
        const pkg = require.resolve('playwright-core/package.json');
        const src = readFileSync(join(dirname(pkg), 'lib/server/chromium/chromiumSwitches.js'), 'utf8');
        const theirs = [...src.matchAll(/--enable-features=([A-Za-z0-9_,]+)/g)]
            .flatMap((m) => m[1].split(','));
        expect(theirs.length).toBeGreaterThan(0);
        expect(featuresOf(HEADLESS_WEBGPU_ARGS)).toEqual(expect.arrayContaining(theirs));
    });
});

describe('the census — no second spelling under scripts/procgen/', () => {
    it('no other file spells the WebGPU/SwiftShader switches or its own --enable-features=', () => {
        const spellings = /--use-angle=swiftshader|--use-vulkan=|--enable-unsafe-swiftshader|--enable-features=/;
        const offenders = readdirSync(HERE)
            .filter((f) => /\.(m?js)$/.test(f) && !/^headlessChromium(\.test)?\.js$/.test(f))
            .filter((f) => spellings.test(readFileSync(join(HERE, f), 'utf8')));
        expect(offenders).toEqual([]);
    });
});
