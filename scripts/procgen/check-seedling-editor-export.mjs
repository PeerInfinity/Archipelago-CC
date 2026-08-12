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
 */

import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { EXIT, readPngHeader } from './exportSeedlingView.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('./export-seedling-view.mjs', import.meta.url));
const TAPES = 'frontend/modules/seedlingDemo/fixtures/tapes';

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const OUT = arg('keep', '') || mkdtempSync(join(tmpdir(), 'seedling-export-'));
mkdirSync(OUT, { recursive: true });

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
check(/tick 171 of 254 frame\(s\)/.test(a.stdout),
    'the tick the caller asked for is the tick that was drawn', a.stdout.trim().split('\n').pop());
check(/layers \[player, enemies, pushables, action, damage, events, volumes\]/.test(a.stdout),
    '⚖ the default layer set — and arrow paths are OFF in it');

/**
 * ⛔ ITS OWN SERVER, ON A FREE PORT, AND GONE AFTERWARDS. Never :8000,
 * never a port somebody else holds, and never left behind — the discipline
 * this whole arc runs under, asserted rather than asserted-by-comment.
 */
const port = Number(/127\.0\.0\.1:(\d+)/.exec(a.stdout)?.[1] ?? 0);
check(port > 0 && port !== 8000, 'it served itself on a free 127.0.0.1 port, not :8000',
    `port ${port}`);
const stillUp = await fetch(`http://127.0.0.1:${port}/`).then(() => true).catch(() => false);
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
 * L18's far exit the solve runs 573 ticks, past the declared clear at 385,
 * and the fold stamps VERSION 9 and carries the row. That pair is what
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
 */
check(/tick 573 of 574/.test(v9.stdout),
    '⛓⛓ …and the page REPLAYED all 573 folded ticks — the v9 tape parsed',
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
check(again.code === EXIT.ok && png(`${OUT}/a-again.png`).bytes.equals(aPng.bytes),
    '⛓ the SAME view exported twice is BYTE-IDENTICAL — the page really is paused');
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
