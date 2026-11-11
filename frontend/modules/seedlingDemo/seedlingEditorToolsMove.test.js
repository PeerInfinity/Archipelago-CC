/**
 * ⛓⛓⛓ **THE SEEDLING EDITOR'S TOOL SURFACE IS BYTE-IDENTICAL ACROSS THE MOVE** (editor tools, step B1).
 *
 * Seedling editor E1's FILL (`l`), CLEAR (`x` + `#genEditClearWhat`), MOVE (`m`) and the paste mode
 * (`#genEditPasteMode`) were wired on the Seedling page only (`watchEditor.js`). B1 moved that wiring into
 * `procgenCore/editorView.js` as opt-in tools. This row mounts the REAL panel (`mountWatchEditor`, over the
 * page's own `watch.html` ids, in a node-side DOM) and digests everything a press answers: the command table
 * (ids, labels, keys), the gesture buttons, the two selects, and, for a fixed script of gestures, every status
 * line, every op the host received, the clipboard note and every overlay stroke. Over two vanilla rooms (L14,
 * L38) and a generated one (`seedling_generated_chestdoor`, room 0).
 *
 * The digests were measured on the base BEFORE the move (origin/main 856d1aec89) and re-measured after it:
 * equal. ⛔ A change to the Seedling tools' behaviour must re-measure them and say so; that is the point of the pin.
 *
 * MUTANTS (each turns a digest red): FILL's refusal text; CLEAR ignoring `#genEditClearWhat`; MOVE not marking
 * its clip spent; the paste mode's option labels; a FILL/CLEAR corner surviving a tool change; the tools' shapes
 * drawn before the page's link shapes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createEditSession } from '../procgenCore/editCore.js';
import { checkedIdsInHtml, fakeDocument, idsInHtml, staticOptionsOf } from '../procgenCore/fakeEditorDom.testkit.js';
import { createSeedlingEditAdapter } from './seedlingEditAdapter.js';
import { mountWatchEditor } from './watchEditor.js';
import { createLifetime } from './watchLifetime.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { parseOelLevel } from './procgenLevelOel.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { buildLevelWorld } from './levelWorld.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => readFileSync(here(p), 'utf8');
const MAP = JSON.parse(read('../flashPanel/atlases/seedling-map.json'));
const EMBED = JSON.parse(read('./fixtures/seedling-vanilla-set.json'));
const SCHEMA = JSON.parse(read('./fixtures/seedling-ogmo-schema.json'));
const HTML = read('./watch.html');
const IDS = idsInHtml(HTML, 'genEdit');
const adapter = createSeedlingEditAdapter({
    schema: null, levelSource: levelSourceFromAtlas(MAP), vanillaSetId: EMBED.set_id, parseOel: parseOelLevel,
});

/** ⛓ Mount the page's panel over `record` and run the fixed gesture script; everything observed, in order. */
function surfaceOf(record) {
    const doc = fakeDocument(IDS.keys(), { tagOf: (id) => IDS.get(id) });
    const $ = (id) => doc.getElementById(id);
    // ⛓ the mode select ships pre-filled in watch.html; fill it from the page itself
    for (const v of staticOptionsOf(HTML, 'genEditTool')) {
        const o = doc.createElement('option');
        o.value = v;
        $('genEditTool').appendChild(o);
    }
    // ⛓ …and its ticked checkboxes (`#genEditShowLinks`: the link overlay is ON when the page opens)
    for (const id of checkedIdsInHtml(HTML, 'genEdit')) $(id).checked = true;
    const canvasParent = doc.createElement('div');
    const canvas = canvasParent.appendChild(doc.createElement('canvas'));
    canvas.width = record.width * 16;
    canvas.height = record.height * 16;
    const log = [];
    const host = createEditSession(adapter, record);
    const lifetime = createLifetime('seedlingEditorToolsMove.test');
    const ui = mountWatchEditor({
        canvas, host, adapter, cellAt: (e) => e?.cell ?? null, lifetime, schema: SCHEMA,
        buildWorld: buildLevelWorld,
        say: (text, bad) => log.push(['say', Boolean(bad), text]),
        onChange: (c) => log.push(['change', c?.tool ?? null, Boolean(c?.result?.applied)]),
        doc,
    });
    const view = ui.view;
    const snap = (what) => {
        log.push(['ops', what, JSON.stringify(host.ops())]);
        log.push(['clip', $('genEditClipNote')?.textContent ?? null]);
        log.push(['paint', doc.paintLog.splice(0).filter((c) => c[0] === 'strokeRect' || c[0] === 'stroke'
            || c[0] === 'moveTo' || c[0] === 'lineTo')]);
        log.push(['buttons', [...($('genEditGestures')?.children ?? [])].map((b) => [b.id, b.className])]);
    };
    const key = (k) => { doc.dispatch('keydown', { key: k }); };
    const click = (tx, ty) => { canvas.dispatch('click', { cell: { tx, ty } }); };
    const setSel = (id, v) => { $(id).value = v; $(id).dispatch('change'); };
    const out = {
        commands: view.commands.map((r) => [r.id, r.label, r.key ?? null]),
        keys: [...view.keys.keys()],
        buttons: [...$('genEditGestures').children].map((b) => [b.id, b.textContent, b.title]),
        pasteMode: $('genEditPasteMode').options.map((o) => [o.value, o.textContent]),
        pasteModeValue: $('genEditPasteMode').value,
        clearWhat: $('genEditClearWhat').options.map((o) => [o.value, o.textContent]),
        pasteOnly: $('genEditPasteOnly').options.map((o) => [o.value, o.textContent]),
    };
    snap('mount');
    const W = record.width;
    const H = record.height;
    const xs = [1, 2, Math.min(4, W - 1), W - 2];
    const ys = [1, 2, Math.min(4, H - 1), H - 2];

    // MOVE with nothing copied
    key('m'); click(xs[0], ys[0]); snap('move-no-clip');
    // FILL with the mode off → refused; then PAINT
    setSel('genEditTool', 'attrs'); key('l'); click(xs[0], ys[0]); click(xs[1], ys[1]); snap('fill-attrs');
    setSel('genEditTool', 'paint'); key('l'); click(xs[0], ys[0]); snap('fill-corner1');
    // a corner dies with its tool: arm RECT with the FILL corner pending
    key('r'); snap('corner-then-rect');
    key('l'); click(xs[0], ys[0]); click(xs[1], ys[1]); snap('fill-paint');
    // FILL of a PLACE target
    $('genEditType').value = 'pushableblock';
    setSel('genEditTool', 'place'); key('l'); click(xs[2], ys[0]); click(xs[3], ys[0]); snap('fill-place');
    // CLEAR, every field, then entities only (on a body-less rectangle → refused), then Escape mid-rect
    key('x'); click(xs[0], ys[0]); click(xs[0], ys[1]); snap('clear-all');
    setSel('genEditClearWhat', 'entities'); key('x'); click(xs[0], ys[3]); click(xs[0], ys[3]); snap('clear-entities');
    key('x'); click(xs[1], ys[1]); key('Escape'); snap('clear-escape');
    // RECT, then MOVE, then MOVE again (spent), with the paste filter at its default
    key('r'); click(xs[2], ys[0]); click(xs[3], ys[0]); snap('rect');
    key('m'); snap('move-armed'); click(xs[1], ys[2]); snap('move');
    click(xs[1], ys[3]); snap('move-spent');
    // REPLACE paste and MOVE in replace mode
    setSel('genEditPasteMode', 'replace'); key('r'); click(xs[1], ys[2]); click(xs[2], ys[2]); snap('rect-replace');
    key('p'); click(xs[0], ys[3]); snap('paste-replace');
    key('m'); click(xs[2], ys[3]); snap('move-replace');
    setSel('genEditPasteMode', 'add'); key('r'); click(xs[0], ys[0]); click(xs[0], ys[0]); key('p'); click(xs[3], ys[3]);
    snap('paste-add');
    // a filter: entities only, MOVE
    setSel('genEditPasteOnly', 'entities'); key('r'); click(xs[2], ys[0]); click(xs[2], ys[0]); key('m'); click(xs[3], ys[1]);
    snap('move-only');
    // off the room
    key('x'); click(xs[0], ys[0]); canvas.dispatch('click', { cell: null }); snap('clear-off');
    // a re-render on a new record refills the clear select and keeps its pick
    ui.render(); out.clearWhatAfter = [$('genEditClearWhat').value, $('genEditClearWhat').options.length];
    out.showLinks = $('genEditShowLinks').checked;
    out.log = log;
    out.oel = JSON.stringify(host.record());
    ui.destroy();
    lifetime.retire('done');
    return out;
}

const digestOf = (record) => createHash('sha256').update(JSON.stringify(surfaceOf(record))).digest('hex');
const L = (n) => MAP.levels.find((l) => l.level === n);

/** ⛓ Measured on origin/main 856d1aec89 before the move. */
const BEFORE_THE_MOVE = Object.freeze({
    L14: 'e0f2d347283f9d88920372b06074151a6dbc5c70d85e8c051d6555a357826856',
    L38: '8a4f47cd612d667d43ce2f3f105d8fec7d44fe957cabf9b9d059b48063af21cd',
    generated: 'df4065efa08eced8295076a3017e94b8c33ed857fd4450f8091b42eb0b958156',
});

describe('the Seedling editor\'s tool surface across the move to procgenCore/editorView', () => {
    it.each([['L14', () => L(14)], ['L38', () => L(38)], ['generated', () => assembleGeneratedSeedlingSet(
        JSON.parse(read('../../presets/seedling_generated_chestdoor/AP_1/AP_1_rules.json'))).set.rooms[0].source.record]])(
        '%s: the same digest as before the move', (name, rec) => {
            const s = surfaceOf(rec());
            // ⛓ non-vacuity: the script reached every tool and applied real edits
            expect(s.commands.map((c) => c[0])).toEqual(expect.arrayContaining(['fill', 'clear', 'move']));
            expect(s.pasteMode.map((o) => o[0])).toEqual(['add', 'replace']);
            expect(s.clearWhat.length).toBeGreaterThan(1);
            const applied = s.log.filter((e) => e[0] === 'change' && e[2]).length;
            expect(applied).toBeGreaterThanOrEqual(4);
            expect(s.log.some((e) => e[0] === 'say' && /already MOVED/.test(e[2]))).toBe(true);
            expect(s.log.some((e) => e[0] === 'say' && /FILL has no target/.test(e[2]))).toBe(true);
            expect(s.showLinks).toBe(true);
            expect(digestOf(rec())).toBe(BEFORE_THE_MOVE[name]);
        },
    );
});
