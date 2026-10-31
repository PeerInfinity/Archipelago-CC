/**
 * ⛓ seedling-js-panel-look — **THE PANEL KEEPS A GENERATED ROOM'S LOOK.**
 *
 * seedling-gen-biomes-1 (C1) gave the room a `look` (`seedlingDemo/procgenLook.js`)
 * it reads from `params.seedlingGen`, but the flash panel's per-region form had no
 * row for it, so a panel round trip (load a region with a look → save) dropped it.
 * The rows below pin the Look row: its choices are exactly `procgenLook`'s, a set
 * look survives the round trip, "(none)" builds no look, and before the names are
 * installed the row still keeps the region's own look.
 *
 * Mutant (driven, the slice's report): drop the `SEEDLING_GEN_LOOK_KEY` read in
 * `buildSeedlingGenRegionParams` → the round-trip row goes red.
 */
import { describe, expect, it, vi } from 'vitest';

import {
    substrateRegistryEntry as ENTRY, SEEDLING_GEN_LOOK_KEY, SEEDLING_GEN_LOOK_NONE_LABEL,
    buildSeedlingGenRegionParams, seedlingGenLookNames, seedlingGenLookOptions,
} from './flashSeedlingGenLibrary.js';
// the headless BUILD door: installs the generator AND the look names
import './flashSeedlingGenBuild.js';
import * as LOOK from '../seedlingDemo/procgenLook.js';
import { GEN_LOOK_NAMES } from '../seedlingDemo/procgenLook.js';

/* ── a minimal document (no jsdom in this repo; `regionGenerationForm.test.js`'s shape) ── */
function makeElement(tag) {
    const el = {
        tagName: tag.toUpperCase(), children: [], parent: null, listeners: {}, dataset: {},
        className: '', title: '', type: '', value: '', checked: false, _text: '',
        appendChild(child) { child.parent = el; el.children.push(child); return child; },
        addEventListener(type, h) { (el.listeners[type] ??= []).push(h); },
        fire(type) { for (const h of el.listeners[type] ?? []) h({ target: el }); },
    };
    Object.defineProperty(el, 'textContent', {
        get: () => el._text + el.children.map((c) => c.textContent).join(''),
        set: (v) => { el._text = String(v); el.children.length = 0; },
    });
    return el;
}
function withFakeDocument(fn) {
    const saved = globalThis.document;
    globalThis.document = { createElement: makeElement, createTextNode: (t) => ({ textContent: String(t) }) };
    try { return fn(); } finally { globalThis.document = saved; }
}
const descendants = (el) => (el.children ?? []).flatMap((c) => [c, ...descendants(c)]);

/** The rendered Look row's select on `params` (the select whose first option is "(none)"). */
function lookRowOf(params) {
    const form = withFakeDocument(() => ENTRY.renderProcgenParams({ params }));
    const rows = descendants(form).filter((c) => c.tagName === 'SELECT'
        && c.children[0]?.textContent === SEEDLING_GEN_LOOK_NONE_LABEL);
    expect(rows.length, 'exactly one Look row').toBe(1);
    return rows[0];
}

/** …and it is the row that WRITES the look key (measured on a probe bag, not read off a label). */
function lookSelect(params) {
    const probe = { ...params };
    const row = lookRowOf(probe);
    row.value = row.children.map((o) => o.value).find((v) => v !== row.value);
    row.fire('change');
    expect(Object.keys(probe).filter((k) => probe[k] !== params[k])).toEqual([SEEDLING_GEN_LOOK_KEY]);
    return lookRowOf(params);
}

const EXITS = [{ exit_id: 'a', side: 'N', targetRegion: 'x' }, { exit_id: 'b', side: 'E', targetRegion: 'y' }];
const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
/** Build a room from the panel bag and read its payload back into a bag (the panel's round trip). */
function roundTrip(bag) {
    const core = ENTRY.generateRegionCore({
        region_id: 'look_probe', size: { width: 10, height: 10 }, entrances: [], exits: EXITS, rng: seededRng(3),
        params: buildSeedlingGenRegionParams({ params: bag }),
    });
    const payload = ENTRY.serializeWorld(core.world, ENTRY.extractPathsAndObstacles(core.world, {}), null, null, {});
    return { payload, bag: ENTRY.procgenParamsFromPayload(payload) };
}

describe('the flash panel\'s Look row', () => {
    it('⛓ lists "(none)" then EXACTLY procgenLook\'s looks — read off the module, not a second list', () => {
        expect(seedlingGenLookNames()).toEqual(GEN_LOOK_NAMES);
        expect(GEN_LOOK_NAMES.length).toBeGreaterThan(0);
        const sel = lookSelect({});
        expect(sel.children.map((o) => o.value)).toEqual(['', ...GEN_LOOK_NAMES]);
        expect(sel.children.map((o) => o.textContent)).toEqual([SEEDLING_GEN_LOOK_NONE_LABEL, ...GEN_LOOK_NAMES]);
        expect(sel.value).toBe('');
    });

    it('⛓ a round trip KEEPS a set look: bag → room → payload → bag → row → bag', () => {
        const look = GEN_LOOK_NAMES.find((n) => n !== 'pre-sword');
        const bag = {};
        // pick it in the row, as the user does
        const row = lookSelect(bag);
        row.value = look;
        row.fire('change');
        expect(bag[SEEDLING_GEN_LOOK_KEY]).toBe(look);
        expect(buildSeedlingGenRegionParams({ params: bag }).seedlingGen.look).toBe(look);

        const first = roundTrip(bag);
        expect(first.payload.generation.look).toBe(look);
        expect(first.bag[SEEDLING_GEN_LOOK_KEY]).toBe(look);
        // the reloaded region's row shows it, and saving it again keeps it
        expect(lookSelect(first.bag).value).toBe(look);
        const second = roundTrip(first.bag);
        expect(second.payload.generation.look).toBe(look);
        expect(second.payload).toEqual(first.payload);
    });

    it('⛔ "(none)" builds NO look — undefined in the regionParams, absent from `generation` and the bag', () => {
        const bag = { [SEEDLING_GEN_LOOK_KEY]: GEN_LOOK_NAMES[0] };
        const row = lookRowOf(bag);
        expect(row.value).toBe(GEN_LOOK_NAMES[0]);
        row.value = '';
        row.fire('change');
        expect(bag[SEEDLING_GEN_LOOK_KEY]).toBe('');
        expect(buildSeedlingGenRegionParams({ params: bag }).seedlingGen.look).toBeUndefined();
        expect('look' in buildSeedlingGenRegionParams({ params: bag }).seedlingGen).toBe(false);
        const { payload, bag: back } = roundTrip(bag);
        expect('look' in payload.generation).toBe(false);
        expect(SEEDLING_GEN_LOOK_KEY in back).toBe(false);
        // …and that room is the one a bag without the key builds, byte for byte
        expect(payload).toEqual(roundTrip({}).payload);
    });

    it('⛓ before the names are installed, the row still keeps the region\'s own look; a bad install is refused by name', async () => {
        vi.resetModules();
        const fresh = await import('./flashSeedlingGenLibrary.js');
        expect(fresh.seedlingGenLookNames()).toBeNull();
        expect(fresh.seedlingGenLookOptions('')).toEqual([['', SEEDLING_GEN_LOOK_NONE_LABEL]]);
        expect(fresh.seedlingGenLookOptions('post-fire')).toEqual([['', SEEDLING_GEN_LOOK_NONE_LABEL], ['post-fire', 'post-fire']]);
        expect(() => fresh.installSeedlingGenLooks({})).toThrow(/lacks `GEN_LOOK_NAMES`.*procgenLook\.js/);
        expect(fresh.installSeedlingGenLooks(LOOK)).toEqual(GEN_LOOK_NAMES);
        // an installed name is not listed twice
        expect(fresh.seedlingGenLookOptions(GEN_LOOK_NAMES[0]).map(([v]) => v)).toEqual(['', ...GEN_LOOK_NAMES]);
        vi.resetModules();
        expect(seedlingGenLookOptions('').length).toBe(GEN_LOOK_NAMES.length + 1);
    });
});
