/**
 * seedlingDemo/watchEditor.test — **THE PAGE'S EDITING FORM, AS DATA.**
 *
 * EDITOR v3 slice C1. What is at stake here is not "does a form render" — it is:
 *
 *  1. **THE DEFAULT PLACE TYPE IS A FACT WITH A CHECKED PROVENANCE.** §11.5
 *     item 4: the page used to take `ENTITY_ROSTER[0]`, so *what the page opens
 *     on* and *the order of the offered list* were one fact. They are two now,
 *     and the tie between them is asserted rather than remembered.
 *  2. **THE WIDE ROSTER REACHES THE FORM AND THE NARROW ONE IS THE NAMED
 *     FALLBACK**, so a schema that did not arrive degrades to slice 11's page
 *     instead of taking the arm down.
 *  3. **EMPTY MEANS OMITTED.** `fillDefaults` is OFF (§11.5 item 2, measured
 *     over 2,461 atlas instances), and the FORM is where a reader meets that
 *     rule — a form that wrote every declared default would put attributes on
 *     every hand placement that the corpus itself does not carry.
 *  4. **⚖ RULING 3's BOUND IS A SENTENCE, NOT A REFUSAL** — and the types it
 *     names are the ones `levelWorld` really does not transcribe, asked of that
 *     table rather than of a list this file keeps.
 *
 * ⛔ `mountEntityPalette` needs a DOM and this repo's vitest is
 * `environment: 'node'`, so the rows below drive the PURE half
 * (`attrFormRows`, `attrsFromRows`, `rosterFor`, `foldersOf`, the bound) and
 * the mount itself is the browser gate's — `check-seedling-editor-edit.mjs`
 * and `check-seedling-editor-arm.mjs` both drive it with a real mouse.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ALL_FOLDERS, COLUMN_VALUE, DEFAULT_PLACE_ATTRS, DEFAULT_PLACE_TYPE, WatchEditorError,
    attrFormRows, attrsFromRows, flagFormRows, foldersOf, mountEntityPalette, mountRoomFlags,
    paintOptionGroups, paintSpecOf, renderTranscribeBound, rosterFor, swatchColour,
} from './watchEditor.js';
import { createLifetime } from './watchLifetime.js';
import {
    ENTITY_ROSTER_PROCGEN, applyEdits, entityIndicesAt, entityRosterFrom, roomFlagOpRefusal,
    roomFlagsIn, transcribeBoundText, untranscribedTypes,
} from './watchEdit.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { loadAtlas } from './levelSource.js';
import { ENTITY_CLASSES } from './levelWorld.js';
import {
    LAYER_COLUMNS, TERRAIN, TERRAIN_NAMES, TILE_LAYERS, columnOfSpec,
} from './procgenLevel.js';
import { TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES, tileSemantics } from '../flashPanel/seedlingSemantics.js';
import { ROOM_FLAG_TAGS } from './watchEdit.js';

const SCHEMA = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/seedling-ogmo-schema.json', import.meta.url)), 'utf8',
));

describe('the page\'s DEFAULT PLACE TYPE — a name, with its provenance checked', () => {
    it('⛓⛓⛓ is the FIRST BODY `procgenPalette` PLACES, and that tie is asserted at '
        + 'import time rather than remembered in a comment', () => {
        expect(DEFAULT_PLACE_TYPE).toBe(ENTITY_ROSTER_PROCGEN[0].type);
        expect(DEFAULT_PLACE_ATTRS).toBe(ENTITY_ROSTER_PROCGEN[0].attrs);
    });

    it('⛔⛔ …and it is NOT the head of the WIDE roster — which is the whole reason it '
        + 'stopped being `[0]`: the two lists disagree, so `[0]` would have moved the '
        + 'page\'s default the moment the datalist widened', () => {
        const wide = entityRosterFrom(SCHEMA);
        expect(wide[0].type).not.toBe(DEFAULT_PLACE_TYPE);
        // …and the default is still IN the wide list, so widening did not orphan it.
        expect(wide.map((r) => r.type)).toContain(DEFAULT_PLACE_TYPE);
    });

    it('⛓ the default is a type the MODEL transcribes, so the page opens on a body it can '
        + 'certify in JS', () => {
        expect(ENTITY_CLASSES[DEFAULT_PLACE_TYPE]).toBeTruthy();
    });
});

describe('the offered roster — wide when the schema arrived, the named five when it did not', () => {
    it(`⛓ with a schema it is the whole declared vocabulary (${
        Object.keys(SCHEMA.entities).length} types)`, () => {
        expect(rosterFor(SCHEMA).map((r) => r.type))
            .toEqual(entityRosterFrom(SCHEMA).map((r) => r.type));
    });

    it('⛓ with `null` it is the SAME frozen array slice 11 shipped — a fallback that is the '
        + 'previous page exactly, not a subset invented here', () => {
        expect(rosterFor(null)).toBe(ENTITY_ROSTER_PROCGEN);
    });

    it('⛓ the folders are DERIVED in first-appearance order, and every declared entity is in '
        + 'one of them', () => {
        const wide = rosterFor(SCHEMA);
        const folders = foldersOf(wide);
        expect(folders.length).toBeGreaterThan(1);
        expect(new Set(wide.map((r) => r.folder))).toEqual(new Set(folders));
        expect(folders).not.toContain(ALL_FOLDERS);
    });

    it('⛔ the NARROW roster has no folders at all, so the filter box has nothing to offer '
        + 'and hides itself rather than showing one empty choice', () => {
        expect(foldersOf(ENTITY_ROSTER_PROCGEN)).toEqual([]);
    });
});

describe('the typed attribute form — generated from the declaration, never from the name', () => {
    it('⛓ one row per declared value, carrying that declaration\'s own type and range', () => {
        const rows = attrFormRows(SCHEMA, 'crusher');
        expect(rows.map((r) => r.name)).toEqual(SCHEMA.entities.crusher.values.map((v) => v.name));
        const tset = rows.find((r) => r.name === 'tset');
        expect(tset.control).toBe('number');
        expect(tset.step).toBe('1');
        expect(tset.min).toBe(SCHEMA.entities.crusher.values[0].min);
        expect(tset.max).toBe(SCHEMA.entities.crusher.values[0].max);
    });

    it('⛓ the control kind is DERIVED from the Ogmo value type — every declared value in the '
        + 'fixture maps onto a control, so no type can arrive without one', () => {
        const kinds = new Map();
        for (const type of Object.keys(SCHEMA.entities)) {
            for (const row of attrFormRows(SCHEMA, type)) {
                kinds.set(row.type, row.control);
            }
        }
        for (const t of SCHEMA.value_types) {
            if (!kinds.has(t)) continue;
            expect(['checkbox', 'number', 'text']).toContain(kinds.get(t));
        }
        expect(kinds.get('integer')).toBe('number');
        expect(kinds.get('string')).toBe('text');
    });

    it('⛔ an UNDECLARED type gets NO rows and that is an ANSWER — law (b) keeps the type '
        + 'field free, so a form that refused would refuse the page\'s own law', () => {
        expect(attrFormRows(SCHEMA, 'notathing')).toEqual([]);
        expect(attrFormRows(null, 'pushableblock')).toEqual([]);
    });

    it('⚠ a value with NO declared default carries `null`, not a zero — three of the 166 '
        + 'declared values have none and inventing one would write an attribute the author '
        + 'never gave a value for', () => {
        const noDefault = Object.entries(SCHEMA.entities)
            .flatMap(([type, d]) => d.values
                .filter((v) => v.default === null || v.default === undefined)
                .map((v) => [type, v.name]));
        expect(noDefault.length).toBeGreaterThan(0);
        for (const [type, name] of noDefault) {
            expect(attrFormRows(SCHEMA, type).find((r) => r.name === name).default).toBe(null);
        }
    });
});

describe('the form → attrs: ⛔ EMPTY MEANS OMITTED (`fillDefaults` is OFF)', () => {
    const rows = attrFormRows(SCHEMA, 'fallrock');

    it('⛔ a blank input contributes NOTHING — not the declared default, and not an empty '
        + 'string: §11.5 item 2 measured 183 of 2,461 atlas instances legitimately carrying '
        + 'no value for an attribute that HAS a default', () => {
        expect(attrsFromRows(rows, () => '')).toEqual({});
        expect(attrsFromRows(rows, (r) => (r.name === 'tag' ? '7' : ''))).toEqual({ tag: '7' });
    });

    it('⛓ …and what IS typed arrives as TEXT, which is what an OEL attribute is', () => {
        expect(attrsFromRows(rows, () => 3)).toEqual({ tset: '3', tag: '3' });
    });

    it('⚠ a CHECKBOX always contributes, because an `<input type=checkbox>` has no third '
        + 'state to spell "omitted" with — named rather than faked with a tri-state select', () => {
        const bool = [{ name: 'flip', type: 'boolean', control: 'checkbox' }];
        expect(attrsFromRows(bool, () => false)).toEqual({ flip: 'false' });
        expect(attrsFromRows(bool, () => true)).toEqual({ flip: 'true' });
    });
});

describe('⚖ RULING 3 — the two-oracle bound is a SENTENCE and not a refusal', () => {
    const recordOf = (types) => ({ entities: types.map((type) => ({ type, x: 0, y: 0 })) });

    it('⛓ it names the types `levelWorld` does not transcribe, asked of THAT table', () => {
        const declared = Object.keys(SCHEMA.entities);
        const missing = declared.filter((t) => !ENTITY_CLASSES[t]);
        expect(missing.length).toBeGreaterThan(0);
        expect(untranscribedTypes(recordOf(declared), ENTITY_CLASSES)).toEqual(missing);
    });

    it('⛔⛔ `bob` IS TRANSCRIBED — the brief called it a non-procgen type that would show '
        + 'the bound and it does not; a NON-PROCGEN type and an UNTRANSCRIBED one are two '
        + 'different sets and only 7 of the 144 are in the second', () => {
        expect(ENTITY_ROSTER_PROCGEN.map((r) => r.type)).not.toContain('bob');
        expect(untranscribedTypes(recordOf(['bob']), ENTITY_CLASSES)).toEqual([]);
        expect(untranscribedTypes(recordOf(['building3']), ENTITY_CLASSES)).toEqual(['building3']);
    });

    it('⚠ DISTINCT types in first-appearance order, not instances — six bodies of one '
        + 'untranscribed type is ONE problem and the sentence says so', () => {
        expect(untranscribedTypes(recordOf(['building3', 'bob', 'building3', 'fire']),
            ENTITY_CLASSES)).toEqual(['building3', 'fire']);
        expect(transcribeBoundText(['building3', 'fire'])).toContain('2 type(s)');
    });

    it('⛓ NOTHING to say is `null`, so a caller cannot print an empty warning', () => {
        expect(transcribeBoundText([])).toBe(null);
        expect(untranscribedTypes({ entities: [] }, ENTITY_CLASSES)).toEqual([]);
    });

    it('⛔ the class table is a PARAMETER and a missing one refuses BY NAME — this file '
        + 'holds no second opinion about which model is being asked', () => {
        expect(() => untranscribedTypes(recordOf(['bob']), null)).toThrow(/class table/);
    });

    it('⛓ the readout is ONE writer over a box, and it HIDES itself when there is nothing '
        + 'to say', () => {
        const box = { textContent: 'stale', className: '', hidden: false };
        expect(renderTranscribeBound(box, recordOf(['bob']), ENTITY_CLASSES)).toEqual([]);
        expect(box.textContent).toBe('');
        expect(box.hidden).toBe(true);
        expect(renderTranscribeBound(box, recordOf(['fire']), ENTITY_CLASSES)).toEqual(['fire']);
        expect(box.hidden).toBe(false);
        expect(box.textContent).toContain('fire');
        expect(box.className).toContain('bad');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 C2 — THE LAYER AND 45-COLUMN PICKER
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ THE PAINT PICKER REACHES EVERY COLUMN OF BOTH LAYERS', () => {
    it('⛓⛓ `tiles` offers the four NAMES first and then all 45 columns — nothing missing '
        + 'and nothing twice', () => {
        const groups = paintOptionGroups('tiles');
        expect(groups[0].label).toMatch(/GENERATOR/);
        expect(groups[0].options.map((o) => o.value)).toEqual([...TERRAIN_NAMES]);
        const columns = groups.slice(1).flatMap((g) => g.options.map((o) => o.column));
        expect(columns.slice().sort((a, b) => a - b))
            .toEqual([...Array(LAYER_COLUMNS.tiles).keys()]);
        expect(new Set(columns).size).toBe(LAYER_COLUMNS.tiles);
    });

    it('⛓⛓⛓ …and the GROUPING is `tileSemantics().kind`, DERIVED — which is a grouping, '
        + 'while grouping by the type NAME would be 38 groups of one', () => {
        const groups = paintOptionGroups('tiles').slice(1);
        const byName = new Set(TILE_COLUMN_TO_TYPE.map((t) => TILE_TYPE_NAMES[t]));
        expect(byName.size).toBeGreaterThan(groups.length * 4);
        for (const g of groups) {
            for (const o of g.options) expect(tileSemantics(o.type).kind).toBe(g.label);
        }
        // every group label is one of the analyzer's OWN kinds
        for (const g of groups) {
            expect(TILE_COLUMN_TO_TYPE.some((t) => tileSemantics(t).kind === g.label)).toBe(true);
        }
    });

    it('⛓⛓ `cliffsides` offers its five pixelmasks and NO terrain name — a name there is '
        + 'refused by `columnOfSpec`, so offering one would arm a brush that always refuses',
    () => {
        const groups = paintOptionGroups('cliffsides');
        const options = groups.flatMap((g) => g.options);
        expect(options.length).toBe(LAYER_COLUMNS.cliffsides);
        expect(options.map((o) => o.value)).toEqual(
            [...Array(LAYER_COLUMNS.cliffsides).keys()].map(COLUMN_VALUE));
        for (const name of TERRAIN_NAMES) {
            expect(options.map((o) => o.value)).not.toContain(name);
            expect(() => columnOfSpec(name, 'cliffsides', 'test')).toThrow(/asked of the/);
        }
    });

    it('⛔ a layer this game does not build is refused BY NAME', () => {
        expect(() => paintOptionGroups('decor')).toThrow(WatchEditorError);
        expect(TILE_LAYERS).toEqual(['tiles', 'cliffsides']);
    });

    it('⛓⛓⛓ EVERY option this picker offers builds a REAL paint spec, on its own layer — '
        + 'the picker and the op cannot disagree about what a value means', () => {
        for (const layer of TILE_LAYERS) {
            for (const g of paintOptionGroups(layer)) {
                for (const o of g.options) {
                    const spec = paintSpecOf(o.value);
                    expect(columnOfSpec(spec.terrain ?? spec, layer, 'test')).toBe(o.column);
                }
            }
        }
    });

    it('⛔ the four names keep spelling THEMSELVES — a respelling would move bytes in every '
        + 'committed `?gen=` payload', () => {
        expect(paintSpecOf('ground')).toEqual({ terrain: 'ground' });
        expect(paintSpecOf(COLUMN_VALUE(TERRAIN.wall.column))).toEqual({ column: 3 });
        expect(() => paintSpecOf('column:nope')).toThrow(/is not a paint option/);
    });

    it('⛓⛓ the SWATCH is the canvas\'s own colour, and its fallback is the canvas\'s rule', () => {
        const palette = { tileColours: { 17: '#8a2b12' }, solidColour: '#solid', floorColour: '#floor' };
        expect(swatchColour(17, palette)).toBe('#8a2b12');
        // an unlisted WALL type falls to the solid colour, anything else to floor
        const wall = TILE_COLUMN_TO_TYPE.find((t) => tileSemantics(t).kind === 'wall'
            && !palette.tileColours[t]);
        expect(swatchColour(wall, palette)).toBe('#solid');
        expect(swatchColour(0, palette)).toBe('#floor');
        // ⛓ a cliffside column has no TILE type, and a null type is not a wall
        expect(swatchColour(null, palette)).toBe('#floor');
    });
});

describe('⛓ the room-flags form reuses the ENTITY form builder — one answer per Ogmo type', () => {
    it('⛓ every declared flag\'s rows are `attrFormRows`, and a presence flag has none', () => {
        for (const tag of ROOM_FLAG_TAGS) {
            expect(flagFormRows(SCHEMA, tag)).toEqual(attrFormRows(SCHEMA, tag));
        }
        expect(flagFormRows(SCHEMA, 'snow')).toEqual([]);
        expect(flagFormRows(SCHEMA, 'lightalpha').map((r) => r.name)).toEqual(['alpha']);
        // ⛓ …and the input kind is DERIVED from the declaration
        expect(flagFormRows(SCHEMA, 'lightalpha')[0].control).toBe('number');
        expect(flagFormRows(SCHEMA, 'droplet').find((r) => r.name === 'color').control).toBe('text');
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E3a — **A REMOUNT DOES NOT LEAVE THE OLD MOUNT LISTENING**
 *   (§21.11 #4, §31.1 #5 — D2's `setEditorView` cure, applied here)
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The six elements `mountEntityPalette` needs, and nothing else — the
 *  smallest DOM that makes the LISTENERS real under `environment: 'node'`. */
class Node6 {
    constructor(tag = 'div') {
        this.tagName = String(tag).toUpperCase();
        this.children = [];
        this.handlers = new Map();
        this.value = '';
        this.textContent = '';
        this.innerHTML = '';
        this.hidden = false;
        this.className = '';
    }

    appendChild(c) { this.children.push(c); return c; }

    addEventListener(type, fn, options = undefined) {
        if (!this.handlers.has(type)) this.handlers.set(type, new Set());
        this.handlers.get(type).add(fn);
        options?.signal?.addEventListener('abort',
            () => { this.handlers.get(type)?.delete(fn); });
    }

    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }

    live(type) { return this.handlers.get(type)?.size ?? 0; }

    dispatch(type) { for (const fn of [...(this.handlers.get(type) ?? [])]) fn({ target: this }); }
}

const paletteHarness = (lifetime) => {
    const els = {
        typeInput: new Node6('input'),
        typeList: new Node6('datalist'),
        folderSel: new Node6('select'),
        attrsInput: new Node6('input'),
        attrsForm: new Node6('div'),
        rosterNote: new Node6('div'),
    };
    return {
        els,
        ui: mountEntityPalette({
            ...els,
            schema: SCHEMA,
            lifetime,
            doc: { createElement: (t) => new Node6(t) },
        }),
    };
};

describe('⛓⛓⛓ EDITOR v3 E3a — the entity palette rides its OWN lifetime', () => {
    /**
     * ⛔⛔ **THE DEFECT §21.11 #4 NAMED AND LEFT.** `mountWatchEditor` — and this
     * palette with it — is REMOUNTED by `watchViewer.js`'s `openBase` on every
     * base open, and `destroy()` only took the `editorView` down. Every listener
     * here rode the ARM's lifetime, which the remount does not retire, so the
     * DEAD mount stayed attached to `watch.html`'s STATIC controls
     * (`#genEditFolder`, `#genEditType`, `#genEditAttrs`) and answered every
     * press beside the live one. D2 measured exactly that on the SET panel.
     *
     * ⛓ MUTANT: register on `lifetime` again instead of `mine` — the first
     * mount's handler survives `destroy()` and both counts below double.
     */
    it('a second mount + `destroy()` leaves exactly ONE handler on each shared control', () => {
        const arm = createLifetime('watchEditor.test.arm');
        const first = paletteHarness(arm);
        expect(first.els.folderSel.live('change')).toBe(1);
        expect(first.els.typeInput.live('change')).toBe(1);

        // ⛔ THE REMOUNT'S SHAPE, exactly as `openBase` performs it.
        first.ui.destroy();
        expect(first.els.folderSel.live('change')).toBe(0);
        expect(first.els.attrsInput.live('input')).toBe(0);

        const second = paletteHarness(arm);
        expect(second.els.folderSel.live('change')).toBe(1);
        expect(second.els.typeInput.live('change')).toBe(1);
        expect(second.els.attrsInput.live('input')).toBe(1);
    });

    /**
     * ⛓⛓ **AND THE ARM IS STILL THE OUTER BOUND** — a page teardown takes the
     * palette even if nobody calls `destroy`, because `mine` is chained to it.
     * ⛔ Without the chain the cure would trade one leak for another: a panel
     * whose listeners outlive the whole arm.
     */
    it('retiring the ARM retires the palette too, with nobody calling `destroy`', () => {
        const arm = createLifetime('watchEditor.test.arm2');
        const h = paletteHarness(arm);
        expect(h.els.folderSel.live('change')).toBe(1);
        arm.retire('the page moved to another arm');
        expect(h.els.folderSel.live('change')).toBe(0);
        expect(h.els.typeInput.live('change')).toBe(0);
        expect(h.els.attrsInput.live('input')).toBe(0);
    });

    /**
     * ⛓ **AND THE ARM'S OWN COUNTER DOES NOT MOVE** — which is precisely what
     * `check-seedling-editor-arm` asserts through `window.__editorLifetime`
     * after a second LOAD, on the whole panel rather than on this one mount.
     */
    it('the ARM\'s listener count is unchanged by a mount, a destroy and a remount', () => {
        const arm = createLifetime('watchEditor.test.arm3');
        expect(arm.state().listeners).toBe(0);
        const first = paletteHarness(arm);
        expect(arm.state().listeners).toBe(0);
        first.ui.destroy();
        paletteHarness(arm);
        expect(arm.state().listeners).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ EDITOR v3 E6a — THE ROOM-FLAGS FORM PASSES `which`
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ `Node6` is `mountEntityPalette`'s six elements; the flags form builds its
 * own rows, so it needs three more DOM facts — `dataset`, `style` and
 * `checked`. ⛔ A SUBCLASS rather than three fields added to `Node6`: the
 * palette rows above measure a mount that does not have them, and widening
 * their fixture would be widening what those rows are about.
 */
class FlagNode extends Node6 {
    constructor(tag = 'div') {
        super(tag);
        this.dataset = {};
        this.style = {};
        this.checked = false;
        this.title = '';
        this.disabled = false;
    }
}

const FLAG_DOC = {
    createElement: (t) => new FlagNode(t),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
};

/**
 * ⛓⛓ **A REAL MOUNT OVER A REAL ROOM.** The subject is a committed vanilla room
 * that holds a flag which is NOT the last body in its cell — found by asking
 * `roomFlagsIn`, never by naming a level number, so a re-extract that moved it
 * moves this row's subject with it.
 */
const notLastSubject = () => {
    const src = levelSourceFromAtlas(loadAtlas());
    for (const l of loadAtlas().levels) {
        const record = src(l.level);
        const flag = roomFlagsIn(record).find((f) => !f.last);
        if (flag) return { record, flag, level: l.level };
    }
    throw new Error('watchEditor.test: no committed room holds a not-last flag');
};

const flagsHarness = (record) => {
    const applied = [];
    let current = record;
    const lifetime = createLifetime('watchEditor.test.flags');
    const box = new FlagNode('div');
    const noteEl = new FlagNode('div');
    const ui = mountRoomFlags({
        box,
        noteEl,
        host: { record: () => current },
        view: {
            apply: (op) => {
                applied.push(op);
                current = applyEdits(current, [op]);
                return { ok: true, applied: true, description: op.op };
            },
        },
        schema: SCHEMA,
        lifetime,
        doc: FLAG_DOC,
    });
    const boxFor = (tag) => box.children
        .find((line) => line.dataset.flag === tag)
        .children[0].children[0];
    return {
        applied, ui, box, noteEl, boxFor, record: () => current, lifetime,
    };
};

describe('⛓⛓⛓ EDITOR v3 E6a — the room-flags form passes `which`, so `remove` reaches all 155', () => {
    /**
     * ⛔⛔⛔ **§33.12 #2's DEFECT, AS A PRESS.** `remove {which}` existed since
     * E3b and NOTHING PASSED AN ORDINAL (§33.13), so the form refused to untick
     * the 2 of 155 flags that are not the last body in their cell — the OP
     * could name them and the GESTURE could not.
     *
     * ⛓⛓ MUTANT: drop `which` from the op the gesture builds — the press
     * deletes the OTHER body and the flag survives, and the last two
     * expectations invert. That is exactly the deletion the old refusal was
     * protecting against, which is why the refusal could not simply be dropped.
     */
    it('unticking a NOT-LAST flag applies `remove {which}` and takes THAT body', () => {
        const { record, flag } = notLastSubject();
        const h = flagsHarness(record);
        const before = record.entities;

        expect(h.boxFor(flag.tag).checked).toBe(true);
        h.boxFor(flag.tag).checked = false;
        h.boxFor(flag.tag).dispatch('change');

        expect(h.applied).toHaveLength(1);
        expect(h.applied[0]).toEqual({
            op: 'remove', tx: flag.tx, ty: flag.ty, which: flag.which,
        });
        // ⛔ the FLAG is gone and everything else survived, by value and in order
        expect(h.record().entities).toEqual(before.filter((_, i) => i !== flag.index));
        expect(roomFlagsIn(h.record()).some((f) => f.tag === flag.tag)).toBe(false);
        // ⛓ …and no refusal was said, which is the half that used to fail
        expect(h.noteEl.textContent).not.toMatch(/REFUSED/);
    });

    /**
     * ⛔ **`attrs` STILL REFUSES ON THE SAME ROW**, and that is not an oversight:
     * addressing the last body in the cell is that op's whole contract
     * (`requireEntityAt`), so a second address for it would be a second
     * vocabulary. The two halves are driven on ONE subject, which is what makes
     * this a statement about the OP rather than about the flag.
     */
    it('editing a NOT-LAST flag\'s VALUES still refuses, and applies nothing', () => {
        const { record, flag } = notLastSubject();
        const rows = flagFormRows(SCHEMA, flag.tag);
        if (rows.length === 0) {
            // a presence-only flag has no value inputs; then the refusal is the
            // function's, and `watchEdit.test.js` drives it directly.
            expect(roomFlagOpRefusal(record, flag, 'attrs')).toMatch(/REWRITE/);
            return;
        }
        const h = flagsHarness(record);
        const input = h.box.children
            .find((line) => line.dataset.flag === flag.tag)
            .children.find((c) => c.children?.some?.((g) => g.dataset?.attr === rows[0].name))
            ?.children.find((g) => g.dataset?.attr === rows[0].name);
        input.value = '0.9';
        input.dispatch('change');
        expect(h.applied).toHaveLength(0);
        expect(h.noteEl.textContent).toMatch(/REFUSED/);
        expect(h.noteEl.textContent).toMatch(/REWRITE/);
    });

    /** ⛓ AND THE ORDINAL IS RIGHT FOR EVERY ROW THE FORM SHOWS, not only the
     *  awkward ones — `which` is the position among the bodies of that cell. */
    it('`roomFlagsIn` stamps a `which` that indexes the cell, on every committed room', () => {
        const atlas = loadAtlas();
        const src = levelSourceFromAtlas(atlas);
        let seen = 0;
        for (const l of atlas.levels) {
            const record = src(l.level);
            for (const f of roomFlagsIn(record)) {
                seen += 1;
                expect(entityIndicesAt(record, f.tx, f.ty)[f.which], `L${l.level} ${f.tag}`)
                    .toBe(f.index);
            }
        }
        expect(seen).toBe(155);
    });
});
