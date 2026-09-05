#!/usr/bin/env node
/**
 * measure-apworld-raw-view — **WHAT COUNTS AS "TOO BIG" FOR THE APWORLD HUB'S
 * RAW VIEW, MEASURED IN A REAL BROWSER** (APWORLD EDITOR HUB slice H2; ⚖ user:
 * *"Or maybe this should be disabled if the data is too big. We might need to
 * test to see what counts as too big."*).
 *
 * ⛔ THE THRESHOLD IS NOT A GUESS. `frontend/modules/apworldEditor/rawView.js`'s
 * `RAW_VIEW_LIMIT_BYTES` cites this script by name and carries the table it
 * prints. Re-run it before moving that constant.
 *
 * ── WHAT IT MEASURES ─────────────────────────────────────────────────
 *
 * For each of three committed presets — the MEDIAN, the p90 and the MAX
 * rules.json over the 205 in `frontend/presets/` — it opens a session on the
 * real hub panel with the real document and reports:
 *
 *   · **TTI** — `_selectTab('raw')` to a laid-out view. The tab builds the
 *     textarea, fills it with `JSON.stringify(record, null, 2)` and inserts it;
 *     the measurement forces layout (`offsetHeight`) before stopping the clock,
 *     because a view that has not been laid out is not one a person can use.
 *   · **keystroke** — `document.execCommand('insertText')` at the caret to the
 *     frame after the resulting `input` event. Five samples, MEDIAN reported:
 *     the browser does the text mutation, which is the cost being measured.
 *
 * It measures the same two things for a CodeMirror 6 view over the same text
 * (`codemirror6Imports.js`, the bundle the raw-JSON editor panels use) so the
 * "textarea or CM6" question is answered with numbers rather than taste.
 *
 * ⚠ Timings are MACHINE- AND LOAD-DEPENDENT. The script prints the box's load
 * average with the table so a number can be attributed later.
 *
 * Prereq: a dev server serving the repo root (`--host=`, default :8000;
 * localhost -> unbundled ES modules, so source edits are picked up).
 * Run: node scripts/procgen/measure-apworld-raw-view.mjs [--host=URL] [--json=PATH]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { argvHelp } from './argvHelp.js';
import { takeBoxLockOrExit } from './boxLock.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'measure-apworld-raw-view.mjs', kind: 'browser' });

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const HOST = arg('host', 'http://localhost:8000');
const JSON_OUT = arg('json', null);
const SAMPLES = Number(arg('samples', '3'));
const NO_SWEEP = process.argv.includes('--no-sweep');
/**
 * ⛔ **A ROW IS FLUSHED THE MOMENT IT EXISTS.** node's stdout is BLOCK-BUFFERED
 * when it is a file, so the first attempt at this measurement was killed by its
 * own outer `timeout` after 900 s and lost every line it had printed — a run
 * that measured for fifteen minutes and reported nothing. Each row now appends
 * to `<--json>.log` as it lands, so a killed run still leaves its rows behind.
 */
const LOG_OUT = JSON_OUT ? `${JSON_OUT}.log` : null;
function say(line) {
    console.log(line);
    if (LOG_OUT) fs.appendFileSync(LOG_OUT, `${line}\n`);
}

/**
 * ⛓ THE THREE DOCUMENTS, PICKED BY SIZE RATHER THAN BY NAME. The percentiles
 * are re-derived here from the tree, so a preset added or dropped retargets the
 * measurement instead of silently measuring yesterday's corpus.
 *
 * ⛔⛔ **RANKED BY PRETTY-PRINTED BYTES, NOT BY FILE SIZE — they are not the
 * same corpus.** 13 of the 205 committed presets are written COMPACT
 * (`compactJsonFile`), so the text the raw view holds is up to **1.75×** the
 * file on disk: `procgen_topdown/AP_8` is 1,799,872 B on disk and **3,146,656
 * B** in the view, which makes IT the worst case and not `stardew_valley`
 * (2,620,221 B, the file-size max the arc plan's §2 names). A threshold in
 * pretty bytes measured against a file-size ranking would never have seen its
 * own maximum. Parsing 205 files costs about a second.
 */
function pickDocuments() {
    const glob = [];
    const presets = path.join(repoRoot, 'frontend/presets');
    for (const game of fs.readdirSync(presets)) {
        const gameDir = path.join(presets, game);
        if (!fs.statSync(gameDir).isDirectory()) continue;
        for (const seed of fs.readdirSync(gameDir)) {
            const seedDir = path.join(gameDir, seed);
            if (!seed.startsWith('AP_') || !fs.statSync(seedDir).isDirectory()) continue;
            for (const file of fs.readdirSync(seedDir)) {
                if (!file.endsWith('_rules.json')) continue;
                const full = path.join(seedDir, file);
                const pretty = Buffer.byteLength(
                    JSON.stringify(JSON.parse(fs.readFileSync(full, 'utf8')), null, 2), 'utf8');
                glob.push({
                    bytes: pretty,
                    fileBytes: fs.statSync(full).size,
                    url: `./presets/${game}/${seed}/${file}`,
                    label: `${game}/${seed}/${file}`,
                });
            }
        }
    }
    glob.sort((a, b) => a.bytes - b.bytes);   // ⛓ by PRETTY bytes — the view's units
    const at = (q) => glob[Math.min(glob.length - 1, Math.floor(glob.length * q))];
    return {
        total: glob.length,
        picks: [
            { tier: 'median', ...at(0.5) },
            { tier: 'p90', ...at(0.9) },
            { tier: 'max', ...glob[glob.length - 1] },
        ],
    };
}

const { total, picks } = pickDocuments();
say(`corpus: ${total} committed rules.json under frontend/presets/`);
for (const p of picks) {
    say(`  ${p.tier.padEnd(7)} ${String(p.bytes).padStart(9)} B pretty `
        + `(${String(p.fileBytes).padStart(9)} B on disk)  ${p.label}`);
}
say(`machine: ${os.cpus().length} cpus, load ${os.loadavg().map((n) => n.toFixed(2)).join(' ')}`);
say('');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));

const rows = [];
try {
    await page.goto(`${HOST}/frontend/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.apworld-editor-panel', { state: 'attached', timeout: 60000 });
    // The hub mounts inside a stack; bring its tab forward the way a user would.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab .lm_title')]
            .find((t) => t.textContent.trim() === 'APWorld Editor');
        if (!tab) throw new Error('no "APWorld Editor" tab in the default layout');
        tab.click();
    });
    await page.waitForSelector('.apworld-editor-panel', { state: 'visible', timeout: 30000 });

    for (const pick of picks) {
        const row = await page.evaluate(async ({ url, samples }) => {
            const panel = document.querySelector('.apworld-editor-panel').__panel;
            const rules = await (await fetch(url)).json();

            /**
             * ⛓ The real intake path, minus the app-wide churn: this measures
             * the RAW VIEW, and a state-manager worker round trip in the same
             * clock would be measuring something else.
             */
            panel._openSession(rules, { kind: 'rules', source: url, player: '1', origin: url });
            panel._rawForced = true;                    // measure ABOVE the guard too
            panel._selectTab('regions');

            const text = JSON.stringify(panel.session.record(), null, 2);
            const bytes = new TextEncoder().encode(text).length;

            const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
            const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

            /**
             * ⛓⛓ **A BASELINE TAB FIRST, OR THE RAW VIEW GETS BLAMED FOR THE
             * PANEL.** `_selectTab` re-renders the WHOLE panel — chrome, the
             * player selector, and a `validateRules` pass over the entire
             * document — and on a 2.6 MB world that pass is seconds. Timing
             * only the raw tab would attribute all of it to the textarea. The
             * Items tab is the control: same re-render, no big text widget.
             */
            const b0 = performance.now();
            panel._selectTab('items');
            void panel.scrollContainer.offsetHeight;
            const baselineTti = performance.now() - b0;
            await new Promise((r) => requestAnimationFrame(() => r()));

            /** ⛓ TTI: build + insert + LAY OUT. A view not laid out is not usable. */
            const t0 = performance.now();
            panel._selectTab('raw');
            const ta = panel.scrollContainer.querySelector('.apworld-raw-text');
            if (!ta) return { url, bytes, error: 'the raw tab did not mount a textarea' };
            void ta.offsetHeight;
            const textareaTti = performance.now() - t0;
            await frame();

            /** ⛓ Keystroke: the browser does the mutation; we time to the frame after. */
            const keystroke = [];
            for (let i = 0; i < samples; i += 1) {
                ta.focus();
                ta.setSelectionRange(ta.value.length, ta.value.length);
                // eslint-disable-next-line no-await-in-loop
                keystroke.push(await new Promise((resolve) => {
                    const k0 = performance.now();
                    ta.addEventListener('input', () => {
                        requestAnimationFrame(() => resolve(performance.now() - k0));
                    }, { once: true });
                    document.execCommand('insertText', false, 'x');
                }));
                // eslint-disable-next-line no-await-in-loop
                await frame();
            }

            /** ⛓ The CM6 arm — same text, same two questions. */
            const cm = { tti: null, keystroke: null, error: null };
            try {
                const mod = await import('./modules/editorCodeMirror6/codemirror6Imports.js');
                // ⛔ `opacity: 0`, not `visibility: hidden`: a hidden subtree
                //   lets the browser skip paint, which would understate a
                //   virtualised editor's real time-to-interactive.
                const host = document.createElement('div');
                Object.assign(host.style, {
                    position: 'fixed', left: '0', top: '0', width: '1200px', height: '700px',
                    zIndex: '-1', opacity: '0', pointerEvents: 'none',
                });
                document.body.appendChild(host);
                const c0 = performance.now();
                const view = new mod.EditorView({
                    doc: text,
                    extensions: [mod.basicSetup, mod.json(), mod.oneDark],
                    parent: host,
                });
                void host.offsetHeight;
                cm.tti = performance.now() - c0;
                await frame();

                const cmKeys = [];
                for (let i = 0; i < samples; i += 1) {
                    const k0 = performance.now();
                    view.dispatch({
                        changes: { from: view.state.doc.length, insert: 'x' },
                    });
                    void host.offsetHeight;
                    // eslint-disable-next-line no-await-in-loop
                    await frame();
                    cmKeys.push(performance.now() - k0);
                }
                cm.keystroke = median(cmKeys);
                view.destroy();
                host.remove();
            } catch (err) {
                cm.error = err.message;
            }

            return {
                url,
                bytes,
                baselineTti,
                textareaTti,
                textareaKeystroke: median(keystroke),
                textareaKeystrokeAll: keystroke,
                cmTti: cm.tti,
                cmKeystroke: cm.keystroke,
                cmError: cm.error,
            };
        }, { url: pick.url, samples: SAMPLES });

        rows.push({
            tier: pick.tier, label: pick.label, fileBytes: pick.fileBytes, ...row,
        });
        if (LOG_OUT) fs.appendFileSync(LOG_OUT, `${JSON.stringify(row)}\n`);
        const ms = (n) => (n === null || n === undefined ? '    —  ' : `${n.toFixed(1).padStart(7)}`);
        say(`${pick.tier.padEnd(7)} ${String(row.bytes).padStart(9)} B pretty  `
            + `| panel-only TTI ${ms(row.baselineTti)} ms  `
            + `| textarea TTI ${ms(row.textareaTti)} ms  key ${ms(row.textareaKeystroke)} ms  `
            + `| CM6 TTI ${ms(row.cmTti)} ms  key ${ms(row.cmKeystroke)} ms`
            + `${row.cmError ? `  (CM6: ${row.cmError})` : ''}`
            + `${row.error ? `  ⛔ ${row.error}` : ''}`);
    }
} finally {
    await browser.close();
}

/**
 * ⛓⛓⛓ **THE SWEEP — because the corpus has a 3.4× HOLE where the knee is.**
 *
 * The three committed documents are 203 KB, 767 KB and 2.62 MB. A threshold
 * picked from them alone is INTERPOLATED across the gap between the last
 * usable point and the first unusable one, which is the thing the ⚖ said not to
 * do. So the same two questions are asked of the same two widgets over TEXT of
 * chosen sizes, sliced out of the max document's own pretty-printed bytes.
 *
 * ⛔ The slices are NOT valid JSON, and they do not need to be: this arm
 * measures the WIDGET — how long a browser takes to lay out N bytes of text and
 * how long one keystroke into it costs — which is what the guard is about. The
 * document-shaped arm above is what proves the widget numbers transfer.
 */
/**
 * ⛓ TWO ARMS, TWO BUDGETS. The textarea is the expensive widget and its cost is
 * SUPERLINEAR — the first attempt at this sweep spent its entire 900 s budget on
 * the 4 MB and 8 MB textarea points and reported nothing. Its knee is the
 * question, and the knee is below 2 MB. CM6 is flat across the corpus, so its
 * question is where it STOPS being flat, which is above it. `widgets` says which
 * arms a size is measured on.
 */
const SWEEP_BYTES = NO_SWEEP ? [] : [
    { bytes: 500_000, widgets: ['textarea', 'cm6'] },
    { bytes: 1_000_000, widgets: ['textarea', 'cm6'] },
    { bytes: 1_500_000, widgets: ['textarea', 'cm6'] },
    { bytes: 2_000_000, widgets: ['textarea', 'cm6'] },
    { bytes: 4_000_000, widgets: ['cm6'] },
    { bytes: 8_000_000, widgets: ['cm6'] },
];
say('');
say('widget sweep (sliced text, no document) — the knee the corpus cannot show:');
const sweep = [];
{
    const browser2 = await chromium.launch();
    const page2 = await browser2.newPage({ viewport: { width: 1600, height: 1000 } });
    page2.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
    try {
        await page2.goto(`${HOST}/frontend/`, { waitUntil: 'domcontentloaded' });
        await page2.waitForSelector('.apworld-editor-panel', { state: 'attached', timeout: 60000 });
        const biggest = picks[picks.length - 1].url;
        for (const point of SWEEP_BYTES) {
            // eslint-disable-next-line no-await-in-loop
            const row = await page2.evaluate(async ({ url, target: want, samples, widgets }) => {
                if (!window.__sweepText) {
                    const doc = await (await fetch(url)).json();
                    let t = JSON.stringify(doc, null, 2);
                    while (new TextEncoder().encode(t).length < 9_000_000) t += t;
                    window.__sweepText = t;
                }
                const text = window.__sweepText.slice(0, want);   // ASCII-dominated: ≈ bytes
                const bytes = new TextEncoder().encode(text).length;
                const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
                const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
                /**
                 * ⛔ **NO PROMISE IN AN INSTRUMENT MAY BE UNBOUNDED.** A
                 * measurement that waits on an event has to be able to say "it
                 * never came" — a hang reports nothing at all, which is worse
                 * than a null.
                 */
                const capped = (promise, ms) => Promise.race([
                    promise,
                    new Promise((r) => setTimeout(() => r(null), ms)),
                ]);

                /**
                 * ⛔⛔ **NOT `visibility: hidden` — A HIDDEN WIDGET CANNOT BE
                 * FOCUSED.** The first sweep used it and hung FOREVER on its
                 * first point: `ta.focus()` is a no-op on a `visibility:hidden`
                 * element, so `execCommand('insertText')` had no editable
                 * target, no `input` event ever fired, and the keystroke
                 * promise never settled (18 minutes, zero rows). `opacity: 0`
                 * keeps the element focusable AND laid out, which is what a
                 * timing measurement needs.
                 */
                const host = document.createElement('div');
                Object.assign(host.style, {
                    position: 'fixed', left: '0', top: '0', width: '1200px', height: '700px',
                    zIndex: '-1', opacity: '0', pointerEvents: 'none',
                });
                document.body.appendChild(host);

                let taTti = null;
                const taKeys = [];
                if (widgets.includes('textarea')) {
                    const t0 = performance.now();
                    const ta = document.createElement('textarea');
                    ta.style.width = '1200px';
                    ta.style.height = '700px';
                    ta.style.whiteSpace = 'pre';
                    ta.value = text;
                    host.appendChild(ta);
                    void ta.offsetHeight;
                    taTti = performance.now() - t0;
                    await frame();

                    for (let i = 0; i < samples; i += 1) {
                        ta.focus();
                        ta.setSelectionRange(ta.value.length, ta.value.length);
                        // eslint-disable-next-line no-await-in-loop
                        // eslint-disable-next-line no-await-in-loop
                        const sample = await capped(new Promise((resolve) => {
                            const k0 = performance.now();
                            ta.addEventListener('input', () => {
                                requestAnimationFrame(() => resolve(performance.now() - k0));
                            }, { once: true });
                            document.execCommand('insertText', false, 'x');
                        }), 60000);
                        if (sample === null) { taKeys.push(null); break; }
                        taKeys.push(sample);
                        // eslint-disable-next-line no-await-in-loop
                        await frame();
                    }
                    ta.remove();
                }

                const cm = { tti: null, keystroke: null, error: null };
                try {
                    if (!widgets.includes('cm6')) throw new Error('not measured at this size');
                    const mod = await import('./modules/editorCodeMirror6/codemirror6Imports.js');
                    const c0 = performance.now();
                    const view = new mod.EditorView({
                        doc: text,
                        extensions: [mod.basicSetup, mod.json(), mod.oneDark],
                        parent: host,
                    });
                    void host.offsetHeight;
                    cm.tti = performance.now() - c0;
                    await frame();
                    const cmKeys = [];
                    for (let i = 0; i < samples; i += 1) {
                        const k0 = performance.now();
                        view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } });
                        void host.offsetHeight;
                        // eslint-disable-next-line no-await-in-loop
                        await frame();
                        cmKeys.push(performance.now() - k0);
                    }
                    cm.keystroke = median(cmKeys);
                    view.destroy();
                } catch (err) {
                    cm.error = err.message;
                }
                host.remove();

                return {
                    bytes,
                    taTti,
                    taKeystroke: taKeys.filter((n) => n !== null).length
                        ? median(taKeys.filter((n) => n !== null)) : null,
                    taKeystrokeTimedOut: taKeys.includes(null),
                    cmTti: cm.tti,
                    cmKeystroke: cm.keystroke,
                    cmError: cm.error,
                };
            }, {
                url: biggest, target: point.bytes, samples: SAMPLES, widgets: point.widgets,
            });
            sweep.push(row);
            const ms = (n) => (n === null || n === undefined ? '     — ' : `${n.toFixed(1).padStart(7)}`);
            say(`${String(row.bytes).padStart(9)} B  `
                + `| textarea TTI ${ms(row.taTti)} ms  key ${ms(row.taKeystroke)} ms  `
                + `| CM6 TTI ${ms(row.cmTti)} ms  key ${ms(row.cmKeystroke)} ms`
                + `${row.cmError ? `  (CM6: ${row.cmError})` : ''}`);
            if (LOG_OUT) fs.appendFileSync(LOG_OUT, `${JSON.stringify(row)}\n`);
        }
    } finally {
        await browser2.close();
    }
}

say('');
say(`machine at end: load ${os.loadavg().map((n) => n.toFixed(2)).join(' ')}`);
if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, `${JSON.stringify({
        host: HOST,
        cpus: os.cpus().length,
        load: os.loadavg(),
        samples: SAMPLES,
        corpus: total,
        rows,
        sweep,
    }, null, 2)}\n`);
    console.log(`wrote ${JSON_OUT}`);
}
