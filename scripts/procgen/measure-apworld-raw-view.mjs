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
 *   · **TTI** — `_selectTab('raw')` to a laid-out view. The tab builds its
 *     chrome and mounts CodeMirror 6 over `JSON.stringify(record, null, 2)`;
 *     the measurement forces layout (`offsetHeight`) before stopping the clock,
 *     because a view that has not been laid out is not one a person can use.
 *   · **keystroke** — one character dispatched into the PANEL'S OWN view, to
 *     the frame after the update. N samples, MEDIAN reported. It runs the
 *     panel's update listener too, so this is the integration's per-key cost.
 *   · **editable / grew** — shape checks beside the timings, because a view
 *     mounted read-only or into a detached host times beautifully and accepts
 *     nothing.
 *
 * ⛓⛓⛓ **H2b RE-POINTED IT AT THE REAL MOUNTED EDITOR.** At H2 the raw tab was
 * a `<textarea>` and this script mounted its own throwaway CodeMirror 6 view
 * beside it to answer "textarea or CM6" with numbers. H2b took that answer and
 * shipped CM6 in the tab, so:
 *
 *   · the TEXTAREA COLUMN IS RETIRED — there is no textarea left to time, and a
 *     column measuring a widget the app does not mount is a number nobody can
 *     act on;
 *   · the CM6 column is now the **panel's own** `panel.rawEditorView`, with the
 *     panel's own extensions (`jsonEditorExtensions`) and its own update
 *     listener attached — the throwaway probe's `basicSetup` was a DIFFERENT
 *     extension list, so H2's CM6 numbers were about the library and these are
 *     about the integration;
 *   · `--all` measures **every committed preset**, because the claim H2b needs
 *     is not "the max is fast" but "every one of the 205 opens", and a claim
 *     about 205 documents interpolated from three is not measured.
 *
 * ⚠ Timings are MACHINE- AND LOAD-DEPENDENT. The script prints the box's load
 * average with the table so a number can be attributed later.
 *
 * Prereq: a dev server serving the repo root (`--host=`, default :8000;
 * localhost -> unbundled ES modules, so source edits are picked up).
 * Run: node scripts/procgen/measure-apworld-raw-view.mjs [--host=URL] [--json=PATH]
 *      [--no-sweep] [--samples=N] [--all]
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
 * ⛓ `--all` — the CORPUS arm. Opens the raw tab over EVERY committed
 * rules.json and reports its time-to-interactive, no keystroke samples. This is
 * the arm that retires `RAW_VIEW_LIMIT_BYTES`: the constant's replacement is
 * the sentence "every preset opens", and that sentence is only true if somebody
 * opened every preset.
 */
const ALL = process.argv.includes('--all');
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
        all: glob,
        picks: [
            { tier: 'median', ...at(0.5) },
            { tier: 'p90', ...at(0.9) },
            { tier: 'max', ...glob[glob.length - 1] },
        ],
    };
}

const { total, all, picks } = pickDocuments();
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
const corpus = [];
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
            /**
             * ⛓ Still set at H2b, and it is now a NO-OP on a panel whose guard
             * has been retired — kept so the script also runs against an older
             * checkout of the panel without silently measuring its refusal
             * screen instead of its editor.
             */
            panel._rawForced = true;
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

            /**
             * ⛓ TTI: build + insert + LAY OUT. A view not laid out is not
             * usable. ⛔ This is the PANEL's editor now, not a probe beside it:
             * the clock covers `_renderRawTab` building the chrome, mounting
             * CM6 with `jsonEditorExtensions`' list, and the browser laying the
             * result out.
             */
            const t0 = performance.now();
            panel._selectTab('raw');
            const host = panel.scrollContainer.querySelector('.apworld-raw-editor');
            if (!host) return { url, bytes, error: 'the raw tab did not mount an editor' };
            void host.offsetHeight;
            const cmTti = performance.now() - t0;
            await frame();

            /**
             * ⛔ **A MOUNTED VIEW IS NOT AN EDITABLE ONE.** A shape check
             * before the timing: CM6 renders into a `contenteditable` div, and
             * a view mounted read-only (or into a detached host) would time
             * beautifully and accept nothing. This is what the H2 instrument
             * learned the hard way with `visibility: hidden`.
             */
            const content = host.querySelector('.cm-content');
            const editable = !!content && content.getAttribute('contenteditable') === 'true';
            const view = panel.rawEditorView;
            if (!view) return { url, bytes, error: 'the panel exposes no rawEditorView' };

            /**
             * ⛓ Keystroke: one character through the panel's own view — which
             * runs the panel's update listener too, so this is the INTEGRATION's
             * per-key cost and not the library's.
             */
            const lenBefore = view.state.doc.length;
            const cmKeys = [];
            for (let i = 0; i < samples; i += 1) {
                const k0 = performance.now();
                view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } });
                void host.offsetHeight;
                // eslint-disable-next-line no-await-in-loop
                await frame();
                cmKeys.push(performance.now() - k0);
            }
            const grew = view.state.doc.length === lenBefore + samples;

            return {
                url,
                bytes,
                baselineTti,
                cmTti,
                cmKeystroke: median(cmKeys),
                cmKeystrokeAll: cmKeys,
                editable,
                grew,
                statusSaysEdited: (panel.scrollContainer
                    .querySelector('.apworld-raw-status')?.textContent ?? '').startsWith('Edited'),
            };
        }, { url: pick.url, samples: SAMPLES });

        rows.push({
            tier: pick.tier, label: pick.label, fileBytes: pick.fileBytes, ...row,
        });
        if (LOG_OUT) fs.appendFileSync(LOG_OUT, `${JSON.stringify(row)}\n`);
        const ms = (n) => (n === null || n === undefined ? '    —  ' : `${n.toFixed(1).padStart(7)}`);
        say(`${pick.tier.padEnd(7)} ${String(row.bytes).padStart(9)} B pretty  `
            + `| panel-only TTI ${ms(row.baselineTti)} ms  `
            + `| hub CM6 TTI ${ms(row.cmTti)} ms  key ${ms(row.cmKeystroke)} ms  `
            + `| editable ${row.editable ? 'yes' : 'NO'} grew ${row.grew ? 'yes' : 'NO'} `
            + `status ${row.statusSaysEdited ? 'Edited' : 'unmoved'}`
            + `${row.error ? `  ⛔ ${row.error}` : ''}`);
    }

    /**
     * ⛓⛓⛓ **THE CORPUS ARM — EVERY COMMITTED PRESET, BECAUSE THE CLAIM IS
     * ABOUT ALL OF THEM.** H2's threshold could be picked from three documents;
     * RETIRING it cannot. "No preset is too big to open" is a statement about
     * 205 documents, and the honest way to make it is to open 205 documents.
     * TTI only — the keystroke cost is flat in size (the sweep proves that over
     * a 16× range) and five samples × 205 would be a different budget.
     */
    if (ALL) {
        say('');
        say(`corpus arm: opening the raw tab over all ${all.length} committed presets`);
        for (const doc of all) {
            // eslint-disable-next-line no-await-in-loop
            const row = await page.evaluate(async ({ url }) => {
                const panel = document.querySelector('.apworld-editor-panel').__panel;
                try {
                    const rules = await (await fetch(url)).json();
                    panel._openSession(rules,
                        { kind: 'rules', source: url, player: '1', origin: url });
                    panel._rawForced = true;
                    panel._selectTab('regions');
                    const b0 = performance.now();
                    panel._selectTab('items');
                    void panel.scrollContainer.offsetHeight;
                    const baselineTti = performance.now() - b0;
                    await new Promise((r) => requestAnimationFrame(() => r()));
                    const t0 = performance.now();
                    panel._selectTab('raw');
                    const host = panel.scrollContainer.querySelector('.apworld-raw-editor');
                    if (!host) return { url, error: 'no editor mounted' };
                    void host.offsetHeight;
                    const cmTti = performance.now() - t0;
                    const content = host.querySelector('.cm-content');
                    return {
                        url,
                        bytes: new TextEncoder()
                            .encode(JSON.stringify(panel.session.record(), null, 2)).length,
                        baselineTti,
                        cmTti,
                        editable: !!content && content.getAttribute('contenteditable') === 'true',
                    };
                } catch (err) {
                    return { url, error: err.message };
                }
            }, { url: doc.url });
            corpus.push({ label: doc.label, fileBytes: doc.fileBytes, ...row });
            if (LOG_OUT) fs.appendFileSync(LOG_OUT, `${JSON.stringify(row)}\n`);
        }
        const good = corpus.filter((r) => !r.error);
        const worst = good.slice().sort((a, b) => b.cmTti - a.cmTti).slice(0, 10);
        const failed = corpus.filter((r) => r.error || !r.editable);
        say(`  opened ${good.length}/${corpus.length}; `
            + `${failed.length} did NOT mount an editable editor`);
        for (const f of failed) say(`  ⛔ ${f.label ?? f.url}: ${f.error ?? 'not editable'}`);
        say('  the TEN SLOWEST to open (this is the number that retires the limit):');
        for (const r of worst) {
            say(`    ${String(r.bytes).padStart(9)} B  TTI ${r.cmTti.toFixed(1).padStart(7)} ms  `
                + `(panel-only ${r.baselineTti.toFixed(1).padStart(7)} ms)  ${r.label}`);
        }
        const maxTti = Math.max(...good.map((r) => r.cmTti));
        say(`  ⇒ MAX time-to-interactive over the whole corpus: ${maxTti.toFixed(1)} ms `
            + `(the textarea's 2 MB number, which the H2 limit was set at, was 1,504 ms)`);
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
 * do. So the same two questions are asked of the SHIPPED editor over TEXT of
 * chosen sizes, sliced out of the max document's own pretty-printed bytes.
 *
 * ⛔ The slices are NOT valid JSON, and they do not need to be: this arm
 * measures the WIDGET — how long a browser takes to lay out N bytes of text and
 * how long one keystroke into it costs — which is what the guard is about. The
 * document-shaped arm above is what proves the widget numbers transfer.
 */
/**
 * ⛓ **ONE ARM AT H2b, AND IT REACHES PAST THE CORPUS.** At H2 the sweep had two
 * arms because the question was "which widget"; the textarea lost, ships
 * nowhere, and its column is gone. What is left is the question the retired
 * limit raises: **where does CM6 stop being flat?** — because "no document is
 * too big" is only a defensible sentence if the sizes above the corpus have
 * been looked at. The corpus maximum is 3.15 MB, so the sweep runs to 16 MB,
 * 5× past it.
 *
 * ⛔ The slices are NOT valid JSON and do not need to be: this arm measures the
 * WIDGET. The document arm above is what proves the widget numbers transfer.
 */
const SWEEP_BYTES = NO_SWEEP ? []
    : [500_000, 1_000_000, 2_000_000, 4_000_000, 8_000_000, 16_000_000];
say('');
say('widget sweep (sliced text, no document, the SHIPPED extension list) — '
    + 'where CM6 stops being flat, 5x past the corpus maximum:');
const sweep = [];
{
    const browser2 = await chromium.launch();
    const page2 = await browser2.newPage({ viewport: { width: 1600, height: 1000 } });
    page2.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
    try {
        await page2.goto(`${HOST}/frontend/`, { waitUntil: 'domcontentloaded' });
        await page2.waitForSelector('.apworld-editor-panel', { state: 'attached', timeout: 60000 });
        const biggest = picks[picks.length - 1].url;
        for (const target of SWEEP_BYTES) {
            // eslint-disable-next-line no-await-in-loop
            const row = await page2.evaluate(async ({ url, target: want, samples }) => {
                if (!window.__sweepText) {
                    const doc = await (await fetch(url)).json();
                    let t = JSON.stringify(doc, null, 2);
                    while (new TextEncoder().encode(t).length < 17_000_000) t += t;
                    window.__sweepText = t;
                }
                const text = window.__sweepText.slice(0, want);   // ASCII-dominated: ≈ bytes
                const bytes = new TextEncoder().encode(text).length;
                const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
                const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
                /**
                 * ⛔⛔ **NOT `visibility: hidden` — A HIDDEN WIDGET CANNOT BE
                 * FOCUSED.** H2's first sweep used it and hung FOREVER on its
                 * first point: `focus()` is a no-op on a `visibility:hidden`
                 * element, so `execCommand('insertText')` had no editable
                 * target, no `input` event ever fired, and the keystroke
                 * promise never settled (18 minutes, zero rows). `opacity: 0`
                 * keeps the element focusable AND laid out, which is what a
                 * timing measurement needs. ⛓ The retired textarea arm is what
                 * used `focus()`; this is kept because the NEXT instrument to
                 * mount a widget off-screen here will reach for the same style,
                 * and because a CM6 view in a hidden subtree skips the layout
                 * whose cost is the measurement.
                 *
                 * ⛓ H2's other instrument defect — node's stdout is
                 * block-buffered to a file, so a killed run loses every line —
                 * is handled by `say()`/`LOG_OUT` at the top of this file.
                 */
                const host = document.createElement('div');
                Object.assign(host.style, {
                    position: 'fixed', left: '0', top: '0', width: '1200px', height: '700px',
                    zIndex: '-1', opacity: '0', pointerEvents: 'none',
                });
                document.body.appendChild(host);

                const cm = { tti: null, keystroke: null, error: null };
                try {
                    const mod = await import('./modules/editorCodeMirror6/codemirror6Imports.js');
                    /**
                     * ⛔⛔ **THE SHIPPED EXTENSION LIST, NOT `basicSetup`.** H2's
                     * sweep mounted the library's convenience bundle, which is
                     * NOT what the hub mounts — so its numbers were about
                     * CodeMirror and not about this app. `jsonEditorExtensions`
                     * is the one list both raw editors build from, so a sweep
                     * over it is a sweep over the thing that ships.
                     */
                    const ext = await import(
                        './modules/editorCodeMirror6/jsonEditorExtensions.js');
                    const c0 = performance.now();
                    const view = new mod.EditorView({
                        doc: text,
                        extensions: ext.jsonEditorExtensions(),
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
                    cmTti: cm.tti,
                    cmKeystroke: cm.keystroke,
                    cmError: cm.error,
                };
            }, {
                url: biggest, target, samples: SAMPLES,
            });
            sweep.push(row);
            const ms = (n) => (n === null || n === undefined ? '     — ' : `${n.toFixed(1).padStart(7)}`);
            say(`${String(row.bytes).padStart(9)} B  `
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
        corpusRows: corpus,
        sweep,
    }, null, 2)}\n`);
    console.log(`wrote ${JSON_OUT}`);
}
