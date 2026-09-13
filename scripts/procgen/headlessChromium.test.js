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
 *
 * ⛓ R1 (2026-09-12) adds a fourth: the LOGIC-ONLY set differs from the pixels
 *   set in EXACTLY the Vulkan pair and in nothing else, so the two cannot drift
 *   apart when somebody edits one of them.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    HEADLESS_LOGIC_ONLY_ARGS, HEADLESS_WEBGPU_ARGS, HEADLESS_WEBGPU_FEATURES,
    PLAYWRIGHT_ENABLED_FEATURES, VULKAN_PAIR, headlessWebgpuArgs,
} from './headlessChromium.js';
import { requirementLines } from './repoPython.js';

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

describe('HEADLESS_LOGIC_ONLY_ARGS — the pixels set MINUS exactly the Vulkan pair', () => {
    // ⛔ THE CLAIM IS A DIFFERENCE, NOT A LIST. Asserting the logic-only set's
    // contents against a hand-written list would pass forever while somebody
    // added a switch to the pixels set and not to this one — the two would
    // then differ in something nobody chose, and the tier's rate would move
    // for a reason no row names.
    it('drops the Vulkan SWITCH and keeps every other switch, in order', () => {
        const nonFeature = (a) => a.filter((s) => !s.startsWith(FEATURES));
        expect(nonFeature(HEADLESS_LOGIC_ONLY_ARGS))
            .toEqual(nonFeature(HEADLESS_WEBGPU_ARGS).filter((s) => s !== VULKAN_PAIR.switch));
        expect(HEADLESS_LOGIC_ONLY_ARGS).not.toContain(VULKAN_PAIR.switch);
        expect(HEADLESS_LOGIC_ONLY_ARGS).toContain('--use-angle=swiftshader');
    });

    it('drops the Vulkan FEATURE and keeps every other feature, still in ONE switch', () => {
        expect(featureSwitches(HEADLESS_LOGIC_ONLY_ARGS)).toHaveLength(1);
        expect(featuresOf(HEADLESS_LOGIC_ONLY_ARGS)).not.toContain(VULKAN_PAIR.feature);
        expect(featuresOf(HEADLESS_LOGIC_ONLY_ARGS))
            .toEqual(expect.arrayContaining([...PLAYWRIGHT_ENABLED_FEATURES]));
        expect(featuresOf(HEADLESS_LOGIC_ONLY_ARGS))
            .toEqual(featuresOf(HEADLESS_WEBGPU_ARGS).filter((f) => f !== VULKAN_PAIR.feature));
    });

    it('the pair is BOTH halves — dropping only one of them is not this set', () => {
        // ⛓ The switch alone, or the feature alone, still leaves the other
        // half on the command line; the difference between the two sets is
        // exactly two entries and the row says so as a number.
        const diff = HEADLESS_WEBGPU_ARGS.filter((a) => !HEADLESS_LOGIC_ONLY_ARGS.includes(a));
        expect(diff).toHaveLength(2);
        expect(diff).toContain(VULKAN_PAIR.switch);
        expect(diff.some((a) => a.startsWith(FEATURES) && a.includes(VULKAN_PAIR.feature))).toBe(true);
    });

    it('a site can still merge its own features into the logic-only set', () => {
        const args = headlessWebgpuArgs({ pixels: false, enableFeatures: ['Foo'] });
        expect(featureSwitches(args)).toHaveLength(1);
        expect(featuresOf(args)).toContain('Foo');
        expect(featuresOf(args)).not.toContain(VULKAN_PAIR.feature);
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
        // ⛓ H2: the `.py` drivers are IN the census. Their `--headless` channel
        // receives the switches over argv; a Python copy of the list is the
        // second spelling this row exists to refuse.
        const offenders = readdirSync(HERE)
            .filter((f) => /\.(m?js|py)$/.test(f) && !/^headlessChromium(\.test)?\.js$/.test(f))
            .filter((f) => spellings.test(readFileSync(join(HERE, f), 'utf8')));
        expect(offenders).toEqual([]);
    });
});

describe('H2 — the Python half is pinned to the node half', () => {
    it('requirements-headless.txt pins EXACTLY the node playwright the lockfile resolves', () => {
        // ⛓ Same version ⇒ same browser build ⇒ ONE Chromium under
        // ~/.cache/ms-playwright for both packages (measured on ubuntu-latest,
        // run 34724984639). A drifted pin downloads a second browser, or
        // launches a build nobody installed.
        const lock = JSON.parse(readFileSync(join(HERE, '..', '..', 'package-lock.json'), 'utf8'));
        const node = lock.packages['node_modules/playwright'].version;
        // ⛓ C1: the one parse `repoPython.resolvePython` checks the interpreter against.
        const reqs = requirementLines(readFileSync(join(HERE, 'requirements-headless.txt'), 'utf8'));
        expect(reqs).toEqual([`playwright==${node}`]);
    });
});

/**
 * ⛓⛓ H2 — **WHICH ARG SET EACH WASM-DRIVING GATE LAUNCHES ON, DERIVED FROM
 * THE GATE'S OWN TEXT** (⚖ ruling A, narrowed 2026-09-12). A gate that imports
 * this module drives the recompiled game headless. It runs on
 * `HEADLESS_LOGIC_ONLY_ARGS` UNLESS its claims assert on the page-error list:
 * the device-lost message IS the logic-only channel's signature, so a
 * zero-pageerror claim cannot be asked there and such a gate keeps
 * `HEADLESS_WEBGPU_ARGS`. ⛔ Nothing here keys on the message text — the
 * derivation reads how a gate COLLECTS page errors (a `pageerror` handler that
 * pushes into a binding, or a `/pageerror/` filter assigned to one) and whether
 * that binding reaches a `check(`/`want(` call.
 */
describe('H2 — each wasm gate is on the arg set its claims allow', () => {
    const callArgs = (src, at) => {
        let depth = 0; let i = src.indexOf('(', at); const s = i;
        for (; i < src.length; i += 1) {
            if (src[i] === '(') depth += 1;
            else if (src[i] === ')') { depth -= 1; if (!depth) break; }
        }
        return src.slice(s, i + 1);
    };
    const assertsPageerrors = (src) => {
        const collectors = new Set();
        for (const m of src.matchAll(/on\(\s*['"]pageerror['"]\s*,\s*\(?\w*\)?\s*=>\s*\{?\s*([A-Za-z_$][\w$.]*)\.push\(/g)) collectors.add(m[1]);
        for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=[^;]*\/pageerror\//g)) collectors.add(m[1]);
        return [...src.matchAll(/\b(?:check|want)\(/g)].some((m) => {
            const a = callArgs(src, m.index);
            return [...collectors].some((c) => new RegExp(`(^|[^\\w$.])${c.replace('.', '\\.')}\\b`).test(a));
        });
    };
    const importedSet = (src) => {
        const m = /import\s*\{([^}]*)\}\s*from\s*'\.\/headlessChromium\.js'/.exec(src);
        return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : null;
    };
    const gates = readdirSync(HERE).filter((f) => /^check-.*\.mjs$/.test(f))
        .map((f) => ({ f, src: readFileSync(join(HERE, f), 'utf8') }))
        .filter((g) => importedSet(g.src) !== null);

    it('the population and both halves are non-empty', () => {
        expect(gates.length).toBeGreaterThan(5);
        expect(gates.some((g) => assertsPageerrors(g.src))).toBe(true);
        expect(gates.some((g) => !assertsPageerrors(g.src))).toBe(true);
    });

    it('a gate that asserts page errors keeps the pixels set; every other is logic-only', () => {
        const wrong = gates.map((g) => {
            const set = importedSet(g.src);
            const want = assertsPageerrors(g.src) ? 'HEADLESS_WEBGPU_ARGS' : 'HEADLESS_LOGIC_ONLY_ARGS';
            const other = want === 'HEADLESS_WEBGPU_ARGS' ? 'HEADLESS_LOGIC_ONLY_ARGS' : 'HEADLESS_WEBGPU_ARGS';
            return set.includes(want) && !set.includes(other) ? null : `${g.f}: imports ${set.join(', ')}; wants ${want}`;
        }).filter(Boolean);
        expect(wrong).toEqual([]);
    });
});
