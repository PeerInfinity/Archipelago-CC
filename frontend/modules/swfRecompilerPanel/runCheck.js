/**
 * runCheck.js — the panel's Check: is the movie that runs the one the SWF
 * describes? Two independent readings of one run:
 *   - the TRACE: every line of the example's `output.txt` (the expected
 *     `trace()` output, shipped beside its `test.swf`) is among the lines the
 *     graphics host printed;
 *   - the PIXELS: `readback` at points whose colours the example draws.
 *
 * The pixel expectations are the ones WALK_API.md documents for
 * `avm2_graphics_runtime` (background, rectangle, triangles, line, gradient
 * start, gradient end), measured exact by slice F2b-1 on every route. An
 * example with no entry here is checked by its trace alone; a SWF of your own
 * has no expectation at all, so Check just reports what it printed.
 *
 * ⛔ Pure (no DOM): unit-tested in node.
 */

export const EXAMPLE_PIXELS = Object.freeze({
    avm2_graphics_runtime: Object.freeze([
        { at: [5, 5], rgba: 'ffffffff', what: 'background' },
        { at: [30, 30], rgba: 'ff0000ff', what: 'rectangle' },
        { at: [130, 40], rgba: '00ffffff', what: 'triangles' },
        { at: [90, 100], rgba: '0000ffff', what: 'line' },
        { at: [20, 140], rgba: 'ff0000ff', what: 'gradient start' },
        { at: [180, 140], rgba: '00ff00ff', what: 'gradient end' },
    ]),
});

/** The example's `output.txt`, relative to the submodule root (catalog layout: pipeline.js). */
export function outputTxtPath({ name, kind }) {
    return kind === 'graphics' ? `examples/graphics/${name}/output.txt` : `examples/${name}/output.txt`;
}

/** The non-empty lines of an `output.txt`. */
export function expectedLines(text) {
    return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * Grade one run → { verdict: 'pass' | 'fail' | 'none', text, missing, wrongPixels }.
 *   expected  the output.txt lines, or null (no expectation: a SWF of your own)
 *   lines     the traces the host printed
 *   pixels    EXAMPLE_PIXELS entries, or null
 *   readback  the `readback` reply's `pixels` ([{x, y, rgba}]), parallel to `pixels`
 */
export function gradeRun({ expected, lines, pixels = null, readback = null }) {
    if (!expected) {
        return { verdict: 'none', text: `${lines.length} trace line(s); no expected output for this SWF`, missing: [], wrongPixels: [] };
    }
    const have = new Set(lines.map((l) => String(l).trim()));
    const missing = expected.filter((l) => !have.has(l));
    const wrongPixels = (pixels ?? []).flatMap((p, i) => {
        const got = readback?.[i]?.rgba ?? null;
        return got === p.rgba ? [] : [{ ...p, got }];
    });
    const parts = [`trace ${expected.length - missing.length}/${expected.length} expected lines`];
    if (pixels) parts.push(`pixels ${pixels.length - wrongPixels.length}/${pixels.length}`);
    const ok = missing.length === 0 && wrongPixels.length === 0;
    let text = `${ok ? 'Pass' : 'Fail'}: ${parts.join(', ')}`;
    if (missing.length) text += ` — missing ${missing.map((l) => JSON.stringify(l)).join(', ')}`;
    if (wrongPixels.length) {
        text += ` — ${wrongPixels.map((p) => `${p.what} (${p.at.join(',')}) is ${p.got ?? 'unread'}, not ${p.rgba}`).join('; ')}`;
    }
    return { verdict: ok ? 'pass' : 'fail', text, missing, wrongPixels };
}
