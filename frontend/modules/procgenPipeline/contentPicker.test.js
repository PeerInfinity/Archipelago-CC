/**
 * ⛓⛓ CONTENT SETS R3 — **PICK → GENERATE → THE DOCUMENT RECORDS THE PICK.**
 *
 * The pipeline panel's content picker (`_renderContentField`) on a panel holding
 * the concept trial's setup: tick the theme, and the panel's state, captured as
 * the panel saves and generates it (`capturePresetState`), builds through the
 * panel's async assembly (`prepareRunFromState`: the content set is loaded
 * first, as Generate's `_loadWorldContent` does) into a world that records
 * `content: [<theme>]` for its player and IS the committed `meta_trial` preset,
 * byte for byte. The pick also survives the panel's save and reload.
 * In play, the browser row `meta-trial-plays` walks that committed world.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ProcgenPipelineUI, CONTENT_FIELD_CLASS } from './procgenPipelineUI.js';
import { CONCEPT_TRIAL_STATE, META_TRIAL_STATE, capturePresetState, applyPresetState } from './presetDefs.js';
import { panelDefaultParams, prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { documentContentOf, loadSelectableContentPacks } from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const THEME = META_TRIAL_STATE.params.content[0];

/** Just enough DOM for one row: elements with children, listeners and the checkbox fields. */
function fakeElement(tagName) {
    const el = {
        tagName: tagName.toUpperCase(), children: [], listeners: {}, className: '', title: '', type: '', value: '',
        checked: false, textContent: '',
        appendChild(c) { el.children.push(c); return c; },
        addEventListener(type, h) { (el.listeners[type] ??= []).push(h); },
        fire(type) { for (const h of el.listeners[type] ?? []) h({ target: el }); },
    };
    return el;
}
function withFakeDocument(fn) {
    const saved = globalThis.document;
    globalThis.document = { createElement: fakeElement, createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }) };
    try { return fn(); } finally { globalThis.document = saved; }
}
const boxesOf = (el) => (el.children ?? []).flatMap((c) => [c, ...boxesOf(c)]).filter((c) => c.tagName === 'INPUT');

describe('R3 — the picker: pick the theme on the concept trial, Generate, and the document records it', async () => {
    const choices = await loadSelectableContentPacks(nodePackIo());
    const panel = Object.create(ProcgenPipelineUI.prototype);
    Object.assign(panel, structuredClone(CONCEPT_TRIAL_STATE));
    panel.params = { ...panelDefaultParams(), ...structuredClone(CONCEPT_TRIAL_STATE.params) };
    panel._contentPackChoices = choices;
    let saves = 0;
    panel._saveToLocalStorage = () => { saves += 1; };

    const row = withFakeDocument(() => panel._renderContentField());
    const box = boxesOf(row).find((b) => b.value === THEME);
    box.checked = true;
    box.fire('change');

    it('the row offers the theme, and ticking it writes params.content and saves', () => {
        expect(row.className).toBe(CONTENT_FIELD_CLASS);
        expect(box).toBeTruthy();
        expect(panel.params.content).toEqual([THEME]);
        expect(saves).toBe(1);
    });

    it('the pick survives the panel\'s save and reload', () => {
        const saved = JSON.parse(JSON.stringify(capturePresetState(panel)));
        const back = applyPresetState(saved, {
            defaults: panelDefaultParams(), hasSubstrate: (id) => substrateRegistry.has(id),
            current: { params: panelDefaultParams() },
        });
        expect(back.params.content).toEqual([THEME]);
    });

    it('Generate builds the meta trial world: content recorded for player 1, the committed meta_trial byte for byte', async () => {
        const { rulesJson } = await runPresetHeadless(await prepareRunFromState(capturePresetState(panel), { io: nodePackIo() }));
        expect(documentContentOf(rulesJson, 1)).toEqual([THEME]);
        const committed = readFileSync(join(ROOT, 'frontend/presets/meta_trial/AP_1/AP_1_rules.json'), 'utf8');
        expect(JSON.stringify(rulesJson, null, 2)).toBe(committed);
    });
});
