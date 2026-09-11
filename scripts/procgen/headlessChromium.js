/**
 * headlessChromium — **THE ONE SPELLING of the flags a headless Chromium needs
 * to run a WebGPU page (the recompiled Seedling) on SwiftShader, and of the
 * ONE `--enable-features=` switch they ride on** (slice seedling-headless-H1,
 * 2026-09-11; plan `NewDocs/plans/seedling-headless-webgpu-plan.md`).
 *
 * ── ⛔⛔ WHY THIS FILE EXISTS ────────────────────────────────────────────
 *
 * Until H1, 28 files under `scripts/procgen/` each spelled these flags for
 * themselves (`grep -al use-angle=swiftshader scripts/procgen/*.mjs` at
 * `19a7e9dcf7`: 13 + 15), in two variants, and BOTH lost the WebGPU device at the
 * page's second frame. Every Seedling gate, deadline constant and doc in this
 * repo was then built around the resulting "~0.5 ticks/s headless" for six
 * weeks. The cure is two flags, so the cure lives in one place: a second
 * spelling anywhere is the defect coming back.
 *
 * ── THE FLAGS, AND WHAT EACH ONE IS FOR ───────────────────────────────
 *
 *   --enable-unsafe-webgpu        exposes `navigator.gpu` at all on Linux,
 *                                 where WebGPU is not on by default.
 *   --ignore-gpu-blocklist        a software adapter is on the blocklist; this
 *                                 lets Chromium hand it out anyway.
 *   --enable-unsafe-swiftshader   opts in to SwiftShader as a WebGPU adapter
 *                                 (the no-GPU fallback is otherwise refused).
 *   --use-angle=swiftshader       the compositor / WebGL backend: ANGLE on
 *                                 SwiftShader GL.
 *   --use-vulkan=swiftshader      Dawn's backend: SwiftShader's Vulkan ICD.
 *   --enable-features=Vulkan      turns on Chromium's Vulkan path, so the
 *                                 WebGPU swapchain gets a shared-image backing
 *                                 the compositor can present.
 *   --no-sandbox                  WSL and CI containers cannot run the setuid
 *                                 sandbox.
 *
 * ⛔ Without these, no Seedling page runs at all: it reaches `__runtimeReady`,
 * the ▶ click calls `runSWF`, the renderer cannot come up and `botStatus`
 * never appears.
 *
 * ── ⛔⛔⛔ THE ROOT CAUSE (two sentences) ──────────────────────────────
 *
 * With `--use-angle=swiftshader` alone, the compositor runs on ANGLE-SwiftShader
 * GL, which has no shared-image backing for the WebGPU swapchain, so Chromium
 * loses the WebGPU device at the page's FIRST canvas present (any page, not
 * only Seedling; root-caused by SWFRecomp-CC's `swfrecomp-cc-d8`, runtime
 * fixed at SWFRecomp-CC `b0a6a487b`). The pinned Seedling builds then park
 * every other frame in 1000 × `emscripten_sleep(1)` ≈ 4.4 s waiting for a
 * work-done callback that never comes — THAT was the "~0.5 ticks/s", not
 * software rasterising.
 *
 * ── ⛓ MEASURED (2026-09-11, this box, Chromium 1194 / Playwright 1.56,
 *    `seedling_bot_ap_p4d/game.html` on :8000,
 *    `NewDocs/investigation/seedling-headless-probe.mjs`) ─────────────────
 *
 *   the gates' old five flags             device LOST at submit #2;
 *                                         0.40 frames/s, median 2064 ms
 *   the probes' old line (Vulkan, then    device LOST at submit #2;
 *     a second --enable-features=JSPI)    0.40 frames/s, median 4226 ms
 *   the gates' five + the Vulkan pair     device alive, 0 pageerrors;
 *                                         27.97 frames/s, median 20 ms
 *   the probes' line, features MERGED     device alive, 0 pageerrors;
 *                                         29.50 frames/s, median 21 ms
 *   HEADLESS_WEBGPU_ARGS exactly          device alive, 0 pageerrors;
 *                                         25.13 frames/s, median 27 ms
 *   a migrated probe end to end           `probe-seedling-r5-mobiles.mjs`
 *                                         12/12 in 6.3 s wall
 *
 * ⚠ The canvas stays BLACK on the pinned builds (a 283-layer bitmap array is
 * over SwiftShader's 256 `maxTextureArrayLayers`; thousands of GPU validation
 * errors per run). Pixels need a seedling-wasm rebuild after SWFRecomp-CC
 * `c6681e744`. No gate in this repo reads the wasm canvas's pixels — they read
 * state through the bridge — so the flags alone unblock the tick rate.
 *
 * ── ⛔⛔ ONE `--enable-features=` SWITCH, AND WHY THAT IS THE WHOLE API ──
 *
 * Chromium keeps the LAST `--enable-features=` on its command line; it does
 * not merge them. Measured, not read: 15 probe sites spelled
 * `--enable-features=Vulkan` and then `--enable-features=WebAssemblyExperimentalJSPI`
 * on the next line, and that line lost the device exactly like the gates'
 * that never asked for Vulkan at all — the second switch had deleted the
 * first; the same features in ONE switch kept it (table above).
 * And Playwright itself passes `--enable-features=CDPScreenshotNewSurface`
 * (argv[15] of 44 in `launchServer().process().spawnargs`, Playwright 1.56),
 * BEFORE the caller's args — so any caller switch silently deletes
 * Playwright's own feature too. ⇒ `headlessWebgpuArgs({ enableFeatures })`
 * MERGES every feature a site needs, Playwright's included, into ONE switch,
 * and REFUSES an `extra` that tries to add a second one. The unit rows pin
 * both, and pin Playwright's own list against the installed
 * `chromiumSwitches.js`, so a Playwright bump that adds a feature reds there
 * instead of being clobbered in silence.
 *
 * ── ⛔ NEVER KEY ANYTHING ON THE `device.lost` MESSAGE ────────────────
 *
 * Chromium 1194 reports the loss as `reason=unknown`, "A valid external
 * Instance reference no longer exists."; Chromium 145 reports `destroyed`,
 * "Device was destroyed." Detect a live device by BEHAVIOUR: `__swfPerf`'s
 * frame wall staying in the tens of ms, or `device.lost` still pending.
 *
 * ── ⛓ WHY A `.js` AND NOT A `.mjs` ───────────────────────────────────
 *
 * `gateRoster.js`'s populations (the gate roster, `machineDrivers`, the CI
 * plan's arm list) enumerate `scripts/procgen/*.mjs`. A `.js` module — like
 * `boxLock.js` and `gateRoster.js` — sits outside them and matches neither
 * `PLAYWRIGHT_RE` nor `SIBLING_RE`, so importing it moves no roster, no lock
 * population and no arm. ⛔ It also deliberately does NOT import `playwright`:
 * every site keeps its own `import { chromium } from 'playwright'`, which is
 * how the roster knows that site drives a browser.
 */

/**
 * Playwright's own `--enable-features=` list, carried so the merged switch does
 * not delete it. Pinned against the installed `chromiumSwitches.js` by
 * `headlessChromium.test.js`.
 */
export const PLAYWRIGHT_ENABLED_FEATURES = Object.freeze(['CDPScreenshotNewSurface']);

/** The features the WebGPU page needs; `Vulkan` is the device-loss cure. */
export const HEADLESS_WEBGPU_FEATURES = Object.freeze(['Vulkan']);

const WEBGPU_SWITCHES = Object.freeze([
    '--enable-unsafe-webgpu',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--use-vulkan=swiftshader',
    '--no-sandbox',
]);

const FEATURES_SWITCH = '--enable-features=';

/**
 * The full argv for `chromium.launch({ args })`.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.enableFeatures]  extra Chromium features this site
 *     needs (e.g. `WebAssemblyExperimentalJSPI`) — merged into the ONE switch.
 * @param {string[]} [opts.extra]           any other switches, appended; ⛔ an
 *     `--enable-features=` here is REFUSED, because it would delete the merged one.
 * @returns {string[]}
 */
export function headlessWebgpuArgs({ enableFeatures = [], extra = [] } = {}) {
    const second = extra.find((a) => a.startsWith(FEATURES_SWITCH));
    if (second) {
        throw new Error(`headlessWebgpuArgs: ${JSON.stringify(second)} in \`extra\` would be a `
            + 'SECOND --enable-features= switch, and Chromium keeps only the last one — it '
            + 'would delete Vulkan and the device would be lost at frame 2. Pass the feature '
            + 'names as `enableFeatures` instead.');
    }
    const features = [...new Set([
        ...HEADLESS_WEBGPU_FEATURES, ...PLAYWRIGHT_ENABLED_FEATURES, ...enableFeatures,
    ])];
    return [...WEBGPU_SWITCHES, `${FEATURES_SWITCH}${features.join(',')}`, ...extra];
}

/** The args every headless Seedling launch uses when it needs nothing extra. */
export const HEADLESS_WEBGPU_ARGS = Object.freeze(headlessWebgpuArgs());
