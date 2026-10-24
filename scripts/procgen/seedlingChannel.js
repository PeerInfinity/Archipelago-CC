/**
 * seedlingChannel — **PROVE A HEADLESS SEEDLING RUN IS ON THE LOGIC-ONLY
 * CHANNEL, ONCE, BEFORE IT MEASURES ANYTHING** (extracted from
 * `check-seedling-bot-differential.mjs` by slice seedling-headless-H2,
 * 2026-09-12; the refusal itself is R1's).
 *
 * ⛔⛔ WHY THIS IS A REFUSAL AND NOT A WARNING. `HEADLESS_LOGIC_ONLY_ARGS`
 * ASKS Chromium to lose the WebGPU device (no Vulkan pair ⇒ the compositor has
 * no shared-image backing for the swapchain). It cannot MAKE it. A Chromium
 * bump, a driver, a container that presents fine turns the run into the PIXELS
 * mode: same verdicts, SwiftShader rasterising on the CPU, against deadlines
 * derived at ~30 ticks/s — a timeout storm whose diagnosis looks like "the game
 * got slow". This converts that into one named sentence. ⛓ Measured on both
 * machines the channel runs on: this box (R1) and ubuntu-latest (H2 task 0,
 * run 34724984639: logic-only `{lost:1,stalls:0}` 29.9 f/s, pixels readout
 * never created 18.0 f/s).
 *
 * ⛓ THE READOUT, NOT THE MESSAGE. `window.__swfGpu.lost` is the runtime's own
 * counter (SWFRecomp-CC `b0a6a487b`+). ⛔ Never key on `device.lost`'s TEXT:
 * Chromium 1194 says `reason=unknown`, "A valid external Instance reference no
 * longer exists."; Chromium 145 says `destroyed`, "Device was destroyed."
 *
 * ⛔⛔ ABSENCE IS A REFUSAL TOO, AND IT NAMES BOTH CAUSES (trap 1332) — a
 * pre-`b0a6a487b` build has no readout at all, and a rebuilt build whose device
 * stayed alive never creates it either. A check that skipped a missing object
 * would pass on both.
 *
 * `texFail` / `stalls` ride along: a texture the device refused, or a
 * frames-in-flight park. Neither can be non-zero on a lost device.
 *
 * ⛓⛓ TWO WAYS IN, ONE VERDICT. A gate that owns its Playwright page polls it
 * (`assertLogicOnlyChannel`). A gate whose page lives in a `seedling-*-win.py`
 * driver cannot, so it prepends `LOGIC_ONLY_DRIVER_STEPS` to each arm — a soft
 * wait for the loss and an `eval` of the readout, authored HERE and carried to
 * the driver as data, like every other step — and hands the recorded readout
 * to `logicOnlyProblem`. Both read `GPU_READOUT_JS`; neither can drift from
 * the other.
 *
 * ⛔ WHICH GATES USE IT (⚖ ruling A as narrowed 2026-09-12): every wasm-driving
 * gate EXCEPT one whose claim asserts zero pageerrors — the device-lost message
 * IS this channel's own signature, so such a claim cannot be asked on it, and
 * those gates stay on `HEADLESS_WEBGPU_ARGS`. `headlessChromium.test.js`
 * derives the split from the gates' own text.
 */

/** The runtime's GPU readout as plain data, or `null` when never created. */
export const GPU_READOUT_JS = '() => (globalThis.__swfGpu === undefined ? null '
    + ': JSON.parse(JSON.stringify(globalThis.__swfGpu)))';

/** True once the device has been lost at least once. */
export const DEVICE_LOST_JS = '() => ((globalThis.__swfGpu && globalThis.__swfGpu.lost) || 0) >= 1';

/** How long the loss may take to land after the start click. */
export const LOGIC_ONLY_WAIT_SEC = 90;

/** The label the driver steps record the readout under. */
export const GPU_READOUT_LABEL = '__swfGpu';

/**
 * The refusal for a readout that is not the logic-only channel, or `null`.
 * @param {object|null} gpu  the readout, as `GPU_READOUT_JS` returns it
 */
export function logicOnlyProblem(gpu) {
    if (!gpu || !(Number(gpu.lost) >= 1)) {
        const seen = gpu == null ? 'window.__swfGpu was NEVER CREATED' : JSON.stringify(gpu);
        return 'REFUSED: this is not the logic-only channel. '
            + `Expected \`__swfGpu.lost >= 1\` within ${LOGIC_ONLY_WAIT_SEC} s of the start click; `
            + `${seen}. Two causes, and the run must stop for either: (a) the wasm predates `
            + 'SWFRecomp-CC b0a6a487b and has no readout at all — check the '
            + 'frontend/modules/flashPanel/wasm gitlink; or (b) the device STAYED ALIVE, so this '
            + 'is the PIXELS mode (SwiftShader rasterising) against deadlines derived at ~30 '
            + 'ticks/s — check HEADLESS_LOGIC_ONLY_ARGS against this Chromium. ⛔ Not a slow '
            + 'run: a wrong channel.';
    }
    const sick = ['texFail', 'stalls'].filter((k) => Number(gpu[k]) > 0);
    if (sick.length) {
        return 'REFUSED: the headless channel lost its device as expected, but the render side '
            + `reports ${sick.map((k) => `${k}=${gpu[k]}`).join(', ')} (__swfGpu = `
            + `${JSON.stringify(gpu)}). On a lost device every WebGPU call is a valid no-op, so `
            + 'neither can be non-zero — a texture the device refused or a frames-in-flight park '
            + 'is a real defect in THIS build, not a channel question.';
    }
    return null;
}

/** The line a run prints once the channel is proved. */
export const channelLine = (gpu) => `CHANNEL: headless logic-only — __swfGpu = ${JSON.stringify(gpu)} `
    + '(device lost at the first present, as asked; no pixels, no texFail, no stalls)';

/**
 * ⛔⛔ THE STRING IS INVOKED EXPLICITLY. Python Playwright's `evaluate(expr)`
 * calls an expression that evaluates to a function; NODE'S DOES NOT — it
 * evaluates the string, gets a function object, cannot serialise it and returns
 * `undefined`, no throw. Measured in H2: every node-side gate on this helper
 * refused "NEVER CREATED" on pages whose device was lost (the same trap
 * `check-seedling-ap-placement.mjs` documents for its plan steps). One source,
 * two channels: node wraps it in `(…)()`, the driver gets it bare.
 */
export const invokeJs = (fnSource) => `(${fnSource})()`;

/**
 * Poll a Playwright page (or frame) until the device is lost, then refuse or
 * print the channel line. Throws the refusal.
 */
export async function assertLogicOnlyChannel(page, { timeoutMs = LOGIC_ONLY_WAIT_SEC * 1000,
    pollMs = 250, say = console.log } = {}) {
    const start = Date.now();
    const read = () => page.evaluate(invokeJs(GPU_READOUT_JS));
    let gpu = await read();
    while (!(gpu && gpu.lost >= 1) && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, pollMs));
        gpu = await read();
    }
    const problem = logicOnlyProblem(gpu);
    if (problem) throw new Error(problem);
    say(channelLine(gpu));
    return gpu;
}

/**
 * The two steps a `seedling-level-set-win.py` arm runs right after its boot on
 * the logic-only channel: wait (soft) for the loss, then record the readout.
 */
export const LOGIC_ONLY_DRIVER_STEPS = Object.freeze([
    Object.freeze({ wait_js: DEVICE_LOST_JS, deadline_sec: LOGIC_ONLY_WAIT_SEC, soft: true,
        label: 'the logic-only channel lost its WebGPU device' }),
    Object.freeze({ eval: GPU_READOUT_JS, label: GPU_READOUT_LABEL }),
]);

/**
 * The refusal for a level-set driver's arm records, or `null` — every arm that
 * booted must carry a logic-only readout (a crashed arm is the gate's own
 * finding and is not re-reported here).
 */
export function driverArmsChannelProblem(arms) {
    const booted = arms.filter((a) => !a.crashed || a.results?.some((r) => r.eval === GPU_READOUT_LABEL));
    if (booted.length === 0) return 'REFUSED: no driver arm booted, so the channel was never read';
    for (const a of booted) {
        const rec = a.results?.find((r) => r.eval === GPU_READOUT_LABEL);
        const problem = logicOnlyProblem(rec ? rec.value : null);
        if (problem) return `${a.name}: ${problem}`;
    }
    return null;
}

/** A driver plan's arms on the logic-only channel: each arm proves it first. */
export const withLogicOnlySteps = (arms) => arms.map((a) => ({
    ...a, steps: [...LOGIC_ONLY_DRIVER_STEPS, ...a.steps] }));

/**
 * After a level-set driver ran on the logic-only channel: print the channel
 * line, or print the refusal and return `false` so the gate exits non-zero.
 */
export function proveDriverChannel(arms, { say = console.log } = {}) {
    const problem = driverArmsChannelProblem(arms);
    if (problem) { say(problem); return false; }
    const first = arms.find((a) => a.results?.some((r) => r.eval === GPU_READOUT_LABEL));
    say(channelLine(first.results.find((r) => r.eval === GPU_READOUT_LABEL).value));
    return true;
}
