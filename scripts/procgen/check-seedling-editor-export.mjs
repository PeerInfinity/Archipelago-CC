#!/usr/bin/env node
/**
 * check-seedling-editor-export — THE EDITOR ARC SLICE 4 ACCEPTANCE ROW.
 *
 * Does `export-seedling-view.mjs` actually produce the four views the arc
 * promised (kickoff §4.4) — and does it REFUSE properly when the page does?
 *
 * ── WHAT THIS ADDS OVER THE VITEST ROWS ───────────────────────────────
 *
 * `exportSeedlingView.test.js` proves the DERIVATION in CI: the argument
 * split, the URL, and the verdict table (trap 184's law — a named refusal
 * exits non-zero and writes nothing). This proves the WHOLE TOOL, as a
 * subprocess, against a real page in a real browser: its own server on a
 * free port, the readiness wait, the PNG on disk, and the exit code a
 * caller will branch on.
 *
 * ⛓ AND IT NEEDS NO DEV SERVER, which is the point (⚖ kickoff §8.9). The
 * arc's other browser rows SKIP (exit 0) without one, and that graceful
 * skip hid a page that could not load at all for two rungs (slice 1 §8.4,
 * trap 176). This row has nothing to skip on: the tool under test brings
 * the server with it.
 *
 * ⚠ SCREENSHOTS ARE EVIDENCE, NOT GATES (kickoff §5) — but the PNG's
 * EXISTENCE, SIZE and BYTE-DIFFERENCE are ledger facts, and they are what
 * is asserted here. What the pixels MEAN was verified by an agent Reading
 * the four exports; that reading is recorded in the as-built, not here.
 *
 * Run: node scripts/procgen/check-seedling-editor-export.mjs
 *      node scripts/procgen/check-seedling-editor-export.mjs --keep=/tmp/shots
 *
 * ⛓ If the "exported twice is BYTE-IDENTICAL" row fails, its FAIL line says
 * why: both exits and ticks, each PNG's size and sha256, and whether the
 * PIXELS differ (a different frame) or only the bytes (the encoder). Both
 * pictures, plus a diff mask, are kept under
 * test-results/seedling-editor-export-flake/<UTC>/, and the line gives the path.
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { deflateSync, inflateSync } from 'node:zlib';

import { EXIT, readPngHeader } from './exportSeedlingView.js';
/**
 * ⛔⛔ SLICE 9 — THE DEFAULT SET, IMPORTED, AND WHY THIS ROW STOPPED COUNTING
 * TO A LITERAL LIST.
 *
 * This row spelled the default set as TEN NAMES from slice 6 until slice 9
 * found it. Slice 8 took the roster to twelve, replaced the literal in the
 * three sibling rows that spell it as a NUMBER — and missed this one and
 * `-manual`, because neither says "eleven" anywhere a grep for the count
 * would find: one spells the roster as a list of names and the other as a
 * bare integer. Both were RED from `8eb641b12` and nobody saw it.
 *
 * ⇒ the assertion stays EXACT (relaxing it to a subset match is the failure
 * trap 62 is about) and is now BUILT FROM the roster, so a layer added
 * tomorrow moves this row with it.
 */
import { defaultLayerSet, OVERLAY_LAYERS } from
    '../../frontend/modules/seedlingDemo/watchOverlays.js';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7) — **THE BOX LOCK.** This gate drives the machine (browser),
 * so it takes the box before it starts and refuses BY NAME if another
 * instrument holds it — replacing a hand-relayed "BOX BUSY". A gate run
 * UNDER `gates.mjs` recognises the holder's token and passes through.
 * `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'check-seedling-editor-export.mjs', kind: 'browser' });

/** The set the exporter prints, in the roster's own order. */
const DEFAULT_ON = OVERLAY_LAYERS.filter((l) => defaultLayerSet().has(l.id)).map((l) => l.id);

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('./export-seedling-view.mjs', import.meta.url));
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const OUT = arg('keep', '') || mkdtempSync(join(tmpdir(), 'seedling-export-'));
mkdirSync(OUT, { recursive: true });

/**
 * ⛓⛓⛓ HOW MANY FRAMES A TAPE IS — READ FROM THE TAPE (R9 slice 12e).
 *
 * ⛔⛔ TWO ROWS BELOW FROZE THIS NUMBER AS A LITERAL AND WERE RED FROM
 * `64875843c` — R9 slice 11's `facingToward` repair, which re-recorded
 * `r8-solve-18` from 573 ticks to 541 and moved `r8-solve-4` with it. Nobody
 * saw it for two rungs: the reach instrument did not exist when the repair
 * landed, and slice 13 found them by running the gate. A gate whose subject is
 * a COMMITTED ARTIFACT must ask the artifact.
 *
 * ⛓ `frames = tick_count + 1` is the exporter's own arithmetic, not a
 * coincidence: `export-seedling-view.mjs:295` resolves `--tick=last` to
 * `(shot.frames ?? 1) - 1`, i.e. the run holds one frame per tick from 0 to
 * `tick_count` inclusive. So the assertion says *the page drew what the tape
 * says*, which is the claim both rows always meant.
 */
const tickCountOf = (file) => JSON.parse(readFileSync(file, 'utf8')).tick_count;
const framesOf = (file) => tickCountOf(file) + 1;

let failed = 0;
const check = (ok, what, detail) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failed++;
};

/** The CLI as a caller sees it: exit code, stdout, stderr — never a throw. */
async function cli(args) {
    try {
        const { stdout, stderr } = await run('node', [CLI, ...args], { maxBuffer: 1 << 24 });
        return { code: 0, stdout, stderr };
    } catch (e) {
        return { code: e.code ?? -1, stdout: e.stdout ?? '', stderr: e.stderr ?? String(e) };
    }
}
const png = (file) => (existsSync(file)
    ? { ...readPngHeader(readFileSync(file)), bytes: readFileSync(file) }
    : { isPng: false, width: 0, height: 0, bytes: null });

/**
 * ⛓⛓ EXPORT-FLAKE-EVIDENCE — WHY TWO EXPORTS OF ONE VIEW DIFFERED.
 *
 * Row 7's byte-identity check went red 4 times in ~1,800 CI runs, each time
 * as a bare label and each time green on rerun, so nobody could tell which of
 * three causes it was: the CLI exited non-zero, the page was not really
 * paused (a later frame), or the encoder is not deterministic. On a FAIL ONLY
 * (a green run prints exactly what it always did) the detail below separates
 * them: the CLI's exit and its own `wrote … tick N` line for BOTH exports, each
 * PNG's size, dimensions and sha256, and — when both decode at one size — how
 * many pixels differ and where. Same pixels with different bytes is the
 * encoder; different pixels is the frame.
 *
 * ⛔ ONE LINE, because `ci-gates.mjs` copies only `FAIL:`/`SKIP:` lines into
 * the CI log — a detail printed on a line of its own would never reach it.
 * Both pictures (and a diff mask) are copied to a stable, named directory under
 * `test-results/` (gitignored), whose path is on the same line.
 */
function decodeRgba(buf) {
    let pos = 8; let width = 0; let height = 0; let colour = -1; let depth = 0; let interlace = 0;
    const idat = [];
    while (pos + 8 <= buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4);
            depth = data[8]; colour = data[9]; interlace = data[12];
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
    if (depth !== 8 || !channels || interlace !== 0) {
        throw new Error(`undecodable here (depth ${depth}, colour ${colour}, interlace ${interlace})`);
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const px = Buffer.alloc(height * stride);
    let prev = Buffer.alloc(stride);
    for (let y = 0, p = 0; y < height; y++) {
        const filter = raw[p++];
        const line = Buffer.from(raw.subarray(p, p + stride)); p += stride;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? line[i - channels] : 0;
            const b = prev[i];
            const c = i >= channels ? prev[i - channels] : 0;
            if (filter === 1) line[i] = (line[i] + a) & 0xff;
            else if (filter === 2) line[i] = (line[i] + b) & 0xff;
            else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 0xff;
            else if (filter === 4) {
                const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c);
                line[i] = (line[i] + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff;
            } else if (filter !== 0) throw new Error(`unknown PNG filter ${filter} on row ${y}`);
        }
        line.copy(px, y * stride);
        prev = line;
    }
    return { width, height, channels, px };
}

/** The one-line "why" for two exports of one view that should be byte-identical. */
function whyNotIdentical(first, second, firstRun, secondRun, files) {
    const sha = (b) => (b ? createHash('sha256').update(b).digest('hex').slice(0, 12) : 'none');
    const said = (r) => {
        const tail = `${r.stdout}\n${r.stderr}`.split('\n').map((l) => l.trim()).filter(Boolean);
        const wrote = tail.find((l) => l.startsWith('wrote '));
        return wrote ? wrote.replace(/^wrote \S+ — /, '').replace(/, layers \[[^\]]*\]/, '')
            : (tail.slice(-2).join(' / ').slice(0, 200) || '(silent)');
    };
    const face = (p) => (p.bytes ? `${p.bytes.length} B ${p.width}x${p.height} sha ${sha(p.bytes)}` : 'NO FILE');
    const parts = [
        `exit ${firstRun.code}/${secondRun.code}`,
        `1st: ${face(first)} [${said(firstRun)}]`,
        `2nd: ${face(second)} [${said(secondRun)}]`,
    ];
    let mask = null;
    if (first.bytes && second.bytes) {
        try {
            const A = decodeRgba(first.bytes); const B = decodeRgba(second.bytes);
            if (A.width !== B.width || A.height !== B.height || A.channels !== B.channels) {
                parts.push('pixels: sizes/formats differ');
            } else {
                let n = 0; let x0 = A.width; let y0 = A.height; let x1 = -1; let y1 = -1;
                mask = Buffer.alloc(A.width * A.height);
                for (let y = 0; y < A.height; y++) {
                    for (let x = 0; x < A.width; x++) {
                        const o = (y * A.width + x) * A.channels;
                        if (A.px.compare(B.px, o, o + A.channels, o, o + A.channels) !== 0) {
                            n++; mask[y * A.width + x] = 1;
                            x0 = Math.min(x0, x); y0 = Math.min(y0, y);
                            x1 = Math.max(x1, x); y1 = Math.max(y1, y);
                        }
                    }
                }
                parts.push(n === 0
                    ? 'pixels: IDENTICAL (bytes differ → the encoder, not the frame)'
                    : `pixels: ${n} differ in x${x0}-${x1} y${y0}-${y1} (→ a different frame)`);
                if (n === 0) mask = null;
                else mask = { width: A.width, height: A.height, on: mask };
            }
        } catch (e) {
            parts.push(`pixels: ${e.message}`);
        }
    }
    parts.push(`kept: ${keepEvidence(files, mask)}`);
    return parts.join(' · ');
}

/**
 * Copy the pictures to `test-results/seedling-editor-export-flake/<UTC>/` and,
 * when there is a pixel difference, a black/white diff mask beside them
 * (white = differs), written as a plain grayscale PNG with no dependency.
 */
function keepEvidence(files, mask) {
    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = join(fileURLToPath(new URL('../../', import.meta.url)),
            'test-results', 'seedling-editor-export-flake', stamp);
        mkdirSync(dir, { recursive: true });
        for (const f of files) if (existsSync(f)) copyFileSync(f, join(dir, f.split(/[\\/]/).pop()));
        if (mask) {
            const { width, height, on } = mask;
            const raw = Buffer.alloc(height * (width + 1));
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = on[y * width + x] ? 255 : 0;
            }
            const chunk = (type, data) => {
                const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
                const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
                const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
                return Buffer.concat([len, td, crc]);
            };
            const ihdr = Buffer.alloc(13);
            ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 0;
            writeFileSync(join(dir, 'diff-mask.png'), Buffer.concat([
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
                chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
        }
        return dir;
    } catch (e) {
        return `(could not keep them: ${e.message})`;
    }
}
function crc32(buf) {
    let c = ~0;
    for (const byte of buf) {
        c ^= byte;
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
}

/**
 * ⚠ THE ROOM AND THE TICK ARE BOTH CHOSEN, AND THE CHOOSING IS THE ROW.
 *
 * `r8-solve-4` is a SOLVER tape (so it has a trace sidecar for the pane)
 * whose level-4 corridor has arrows in flight from tick 39 to 171 —
 * measured, not assumed. At tick 171 there are SIXTEEN arrow bodies
 * sampled, which is what makes "(a) and (b) differ exactly by the arrow
 * paths" a claim about arrows rather than about an empty layer: exporting
 * the same pair at the LAST tick produces two byte-identical PNGs, because
 * the walk ends in a room the arrows never reach.
 */
const SOLVE4 = `${TAPES}/r8-solve-4.json`;
const ARROW_TICK = 171;
/** `r8-hammer-control`'s ONE damage marker is at tick 247 (slice 2's row). */
const HAMMER = `${TAPES}/r8-hammer-control.json`;

// ── ROW 1: (a) the default-layers view, and the server it brought ────────

console.log('\n## (a) the default-layers view');
const a = await cli([`--out=${OUT}/a-default.png`, `--tape=${SOLVE4}`, `--tick=${ARROW_TICK}`]);
const aPng = png(`${OUT}/a-default.png`);
check(a.code === EXIT.ok, 'the export exits 0', `exit ${a.code}${a.stderr ? ` — ${a.stderr}` : ''}`);
check(aPng.isPng && aPng.width > 0 && aPng.height > 0,
    'and there is a real PNG at --out, sized like the canvas',
    `${aPng.width}x${aPng.height}, ${aPng.bytes?.length ?? 0} bytes`);
const SOLVE4_FRAMES = framesOf(SOLVE4);
check(a.stdout.includes(`tick ${ARROW_TICK} of ${SOLVE4_FRAMES} frame(s)`),
    `the tick the caller asked for is the tick that was drawn — ${ARROW_TICK} of `
    + `${SOLVE4_FRAMES}, the frame count r8-solve-4 declares`,
    a.stdout.trim().split('\n').pop());
// ⛓ SLICE 6 widened the roster 8 → 11, slice 8 → 12 and slice 9 → 15. The
// check is REPLACED, not relaxed: the default set is still asserted EXACTLY,
// and the ⚖ halves — `arrows` OFF (§1.6) and `danger` OFF (item 9) — are
// asserted as their own clauses so a future roster change cannot quietly
// satisfy the pattern by accident.
check(a.stdout.includes(`layers [${DEFAULT_ON.join(', ')}]`)
    && !/layers \[[^\]]*arrows/.test(a.stdout)
    && !/layers \[[^\]]*danger/.test(a.stdout),
`⚖ the default layer set (${DEFAULT_ON.length}, built from the roster) — arrow paths AND `
+ 'the solver danger map are OFF in it',
`[${DEFAULT_ON.join(', ')}]`);

/**
 * ⛔ ITS OWN SERVER, ON A FREE PORT, AND GONE AFTERWARDS. Never :8000,
 * never a port somebody else holds, and never left behind — the discipline
 * this whole arc runs under, asserted rather than asserted-by-comment.
 */
const port = Number(/127\.0\.0\.1:(\d+)/.exec(a.stdout)?.[1] ?? 0);
check(port > 0 && port !== 8000, 'it served itself on a free 127.0.0.1 port, not :8000',
    `port ${port}`);
/* ⛔ THE BODY IS DRAINED — trap 1057, swept in S4b (3). An UNREAD body kills
 * Node 22's undici on an internal `assert(!this.paused)` thrown from a socket
 * callback that no `try`/`catch` here can see; the process dies and this
 * gate's stdout goes with it. Measured at `check-seedling-wasm-element.mjs`,
 * which carries the numbers: 5/40 crashed undrained, 0/40 drained, 0/40 HEAD.
 * ⛓ A DRAIN AND NOT A `HEAD`, because the probe's QUESTION must not move — a
 * GET that reads the body asks exactly what this line always asked. */
const stillUp = await fetch(`http://127.0.0.1:${port}/`)
    .then(async (r) => { await r.arrayBuffer(); return true; }).catch(() => false);
check(!stillUp, '…and shut that server down on the way out', `nothing answers on ${port}`);

// ── ROW 2: (b) the arrows-on view — the same frame, plus the arrows ──────

console.log('\n## (b) the arrows-on view');
const b = await cli([`--out=${OUT}/b-arrows.png`, `--tape=${SOLVE4}`, `--tick=${ARROW_TICK}`,
    '--layers=player,enemies,pushables,arrows,action,damage,events,volumes']);
const bPng = png(`${OUT}/b-arrows.png`);
check(b.code === EXIT.ok && bPng.isPng, 'the export exits 0 with a PNG',
    `exit ${b.code}, ${bPng.width}x${bPng.height}`);
check(/arrows/.test(b.stdout), '?layers= turned the arrow paths ON', /layers \[[^\]]+\]/.exec(b.stdout)?.[0]);
check(bPng.width === aPng.width && bPng.height === aPng.height,
    'it is the SAME frame — same room, same tick, same canvas',
    `${bPng.width}x${bPng.height}`);
/**
 * ⛓ AND THE PICTURE CHANGED. A layer toggle that reported itself ON while
 * drawing nothing would pass every readout check in this file; the bytes
 * are the only thing that knows the difference.
 */
check(!aPng.bytes.equals(bPng.bytes),
    '⛓ …and the PIXELS DIFFER — the arrow layer actually drew arrows',
    `${aPng.bytes.length} vs ${bPng.bytes.length} bytes`);

// ── ROW 3: (c) the trace-pane view ──────────────────────────────────────

console.log('\n## (c) the trace-pane view');
const c = await cli([`--out=${OUT}/c-trace.png`, `--tape=${SOLVE4}`, `--tick=${ARROW_TICK}`, '--trace']);
const cPng = png(`${OUT}/c-trace.png`);
check(c.code === EXIT.ok && cPng.isPng, 'the export exits 0 with a PNG',
    `exit ${c.code}, ${cPng.width}x${cPng.height}`);
check(cPng.width > aPng.width,
    '--trace widens the frame past the canvas — the toggles, the legend, the HUD and the pane',
    `${cPng.width} wide vs the canvas' ${aPng.width}`);
check(/3 trace row\(s\)/.test(c.stdout),
    'and the pane has the solver\'s own decisions in it, from the fetched sidecar',
    /(\d+) trace row/.exec(c.stdout)?.[0]);

// ── ROW 4: (d) the mid-run ?tick=N view ─────────────────────────────────

console.log('\n## (d) the mid-run ?tick=N view');
const d247 = await cli([`--out=${OUT}/d-tick247.png`, `--tape=${HAMMER}`, '--tick=247']);
const d246 = await cli([`--out=${OUT}/d-tick246.png`, `--tape=${HAMMER}`, '--tick=246']);
check(d247.code === EXIT.ok && d246.code === EXIT.ok, 'both exports exit 0',
    `${d247.code} / ${d246.code}`);
check(/tick 247 of 325/.test(d247.stdout) && /tick 246 of 325/.test(d246.stdout),
    'the cursor lands exactly where the caller asked, mid-run');
/**
 * ⛓ THE ROW THAT IS NOT A CURSOR CHECK. `r8-hammer-control`'s ONE damage
 * marker is at tick 247 and markers draw only at or before the cursor, so
 * two frames one tick apart being DIFFERENT PICTURES is the statement that
 * the whole overlay stack exported with the cursor — which no readout
 * assertion about `scrub.value` can make.
 */
check(!png(`${OUT}/d-tick247.png`).bytes.equals(png(`${OUT}/d-tick246.png`).bytes),
    '⛓ 247 and 246 are DIFFERENT PICTURES — the damage marker exported with the cursor');

// ── ROW 5: --tick=last, resolved without going through the clamp ────────

console.log('\n## --tick=last — the same contract, twice');
const last = await cli([`--out=${OUT}/e-last.png`, `--tape=${HAMMER}`, '--tick=last']);
check(last.code === EXIT.ok && /--tick=last → tick 324 of 325 frame\(s\)/.test(last.stdout),
    'it resolves to the run\'s own last frame', /--tick=last[^\n]*/.exec(last.stdout)?.[0]);
check((last.stdout.match(/^page: /gm) ?? []).length === 2,
    '…by loading the SAME page twice — never by poking the page\'s scrub');
/**
 * ⚠ AND NOT BY OVERSHOOTING INTO THE CLAMP. `?tick=99999` would also land
 * on the last frame — with the page's "past the last frame" note attached,
 * which is a report about a caller's mistake. A resolved tick is exact.
 */
check(!/past the last frame/.test(last.stdout),
    '⚠ …and EXACTLY, not by overshooting into the page\'s clamp');

// ── ROW 6: ⛔ THE REFUSAL — trap 184, end to end ────────────────────────

console.log('\n## ⛔ the refusal path — a NAMED refusal, non-zero, and NOTHING written');
/**
 * ⛓⛓⛓ SLICE 5 — THE CONTROL WAS **REPLACED, NOT DELETED** (trap 62), AND
 * THE REPLACEMENT IS THE SAME COMMAND.
 *
 * This row used to exercise the v8 fold's refusal of a v9 boot: six
 * committed boots carry a `persistence[].at` and the assembly could not
 * label them. ⚖ The user promoted the extension (kickoff §12.1), so those
 * six now FOLD — and a deleted refusal check whose subject moved into the
 * model is a discharge, while a deleted one whose subject did NOT is trap
 * 62. The subject here only half-moved, which is why the arguments below
 * are byte-for-byte the ones this row has always used:
 *
 *   `at` is bounded by `[0, tick_count]`, and a FOLD's tick_count is the
 *   RUN'S. `exit:16,16` is L18's own boot door, so the solve finishes in
 *   SEVEN ticks and the block's clear at 385 is still unrepresentable —
 *   the same unparseable artifact, through a different door, refused at
 *   the same moment of assembly by the same function.
 *
 * ⚠ MEASURED BEFORE THE OLD ASSERTION DIED: this exact invocation was run
 * against the new tree and exits 2 with the message below. And the
 * feature's own positive is asserted directly beneath it, so the row now
 * carries BOTH halves — the boot that folds and the one that cannot.
 */
const refusalOut = `${OUT}/refusal-never-written.png`;
const r = await cli([`--out=${refusalOut}`, `--boot=${TAPES}/r8-solve-18.json`,
    '--solve=1', '--goals=exit:16,16']);
check(r.code === EXIT.refused, '⛔ a refused run exits NON-ZERO', `exit ${r.code}`);
check(/buildStagedTape/.test(r.stderr) && /beyond this run's own \d+ tick\(s\)/.test(r.stderr),
    '⛓ …carrying the RUN\'S OWN message, not the CLI\'s',
    r.stderr.replace(/\s+/g, ' ').slice(0, 170));
check(!existsSync(refusalOut),
    '⛔⛔ …and it wrote NOTHING. A blank frame with exit 0 is the defect this rule exists for');

/**
 * ⛓⛓⛓ AND THE OTHER HALF — THE SAME BOOT, EXPORTED, BECAUSE IT NOW FOLDS.
 *
 * The refusal above and this export differ in ONE argument: the goal. With
 * L18's far exit the solve runs past the declared clear at 385 — how far is
 * the TAPE's business and is read from it, not typed here — and the fold
 * stamps VERSION 9 and carries the row. That pair is what
 * makes the replacement honest rather than a re-aimed regex — the boot that
 * refused for a whole arc is exported here, from the same CLI, in one run.
 */
console.log('\n## ⛓ the v9 boot that refused for a whole arc — EXPORTED (slice 5)');
const v9Out = `${OUT}/f-v9-folded.png`;
const v9 = await cli([`--out=${v9Out}`, `--boot=${TAPES}/r8-solve-18.json`,
    '--solve=1', '--goals=exit:176,112', '--tick=last']);
check(v9.code === EXIT.ok, 'a v9 boot SOLVES, FOLDS and exports — exit 0', `exit ${v9.code}`);
check(png(v9Out).isPng && png(v9Out).width > 0,
    '⛓ …and the PNG is real', `${png(v9Out).width}x${png(v9Out).height}`);
/**
 * ⛔ THE TICK COUNT IS THE CLAIM, not the exit code. `--tick=last` resolves
 * through the page's own readiness contract, so the number the CLI prints
 * is the frame count of the tape the page REPLAYED — i.e. the v9 tape
 * really parsed. A run whose fold had been refused could not have printed
 * one at all.
 *
 * ⛓ The number comes from `r8-solve-18.json` and is interpolated into the
 * LABEL as well as the condition, so it cannot go false silently the next
 * time somebody re-records the tape (trap 573).
 */
const L18_TICKS = tickCountOf(`${TAPES}/r8-solve-18.json`);
check(v9.stdout.includes(`tick ${L18_TICKS} of ${L18_TICKS + 1}`),
    `⛓⛓ …and the page REPLAYED all ${L18_TICKS} folded ticks — the v9 tape parsed`,
    /--tick=last[^\n]*/.exec(v9.stdout)?.[0]);

// A second, different refusal — so the row is about the PATH, not one message.
const amb = await cli([`--out=${OUT}/refusal2.png`, `--boot=${TAPES}/r8-solve-18.json`, '--solve=1']);
check(amb.code === EXIT.refused && /no unambiguous default/.test(amb.stderr)
    && !existsSync(`${OUT}/refusal2.png`),
    'a DIFFERENT refusal behaves the same way — the path is the path',
    amb.stderr.replace(/\s+/g, ' ').slice(0, 110));

// ── ROW 7: determinism, and the usage refusals ──────────────────────────

console.log('\n## the rest of the contract');
const again = await cli([`--out=${OUT}/a-again.png`, `--tape=${SOLVE4}`, `--tick=${ARROW_TICK}`]);
const againPng = png(`${OUT}/a-again.png`);
const sameTwice = again.code === EXIT.ok && againPng.bytes !== null && aPng.bytes !== null
    && againPng.bytes.equals(aPng.bytes);
// ⛓ ONE check, as it always was (the standing value is 29/0): the "why" rides
// in its detail and is computed ONLY on a FAIL, so a green line is unchanged.
check(sameTwice,
    '⛓ the SAME view exported twice is BYTE-IDENTICAL — the page really is paused',
    sameTwice ? undefined : whyNotIdentical(aPng, againPng, a, again,
        [`${OUT}/a-default.png`, `${OUT}/a-again.png`]));
const noOut = await cli([`--tape=${SOLVE4}`]);
check(noOut.code === EXIT.usage && /--out=.*required/.test(noOut.stderr),
    'no --out= is a usage refusal, before any browser starts', `exit ${noOut.code}`);
const noView = await cli([`--out=${OUT}/nope.png`]);
check(noView.code === EXIT.usage && /nothing to draw/.test(noView.stderr)
    && !existsSync(`${OUT}/nope.png`),
    'and so is a run with nothing to draw', `exit ${noView.code}`);

console.log(`\nthe four acceptance views (EVIDENCE, not gates) are in ${OUT}`);
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
