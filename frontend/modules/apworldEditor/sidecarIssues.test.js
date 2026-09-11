/**
 * apworldEditor/sidecarIssues — **THE SIDECAR VALIDITY REPORT'S ROWS**
 * (PRESET SIDECARS slice V0).
 *
 * ⛓ The libraries are the ones the capability-matrix generator imports
 * (`REGISTRY_LIBRARIES` — derived, never a literal list), loaded for their
 * REGISTRATION side effect at module scope: the mismatch rule reads EVERY
 * declaring entry, so a partial registry would change its answers.
 *
 * ⛔ Every document here is a COMMITTED one, cloned and broken in one place:
 * the four-player multiworld fixture (maze slots and bounce slots), the jta
 * dataset fixture (sibling references) and the Seedling playthrough (no
 * carriers). Substrate ids and field names are read off the document and the
 * registry, never typed — a row that typed `'maze'` could not see the day the
 * fixture's slot 1 stopped being one.
 *
 * ⛔ Three rows need entries no committed substrate is: one that declares no
 * payload, one whose declaration is malformed, one with no `deserializeWorld`.
 * They are registered here, under ids nothing else uses.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import {
    AP_EXIT_NAMES_SLOT, AP_LOCATION_NAMES_SLOT, SIDECAR_ISSUE_KINDS, SIDECAR_ISSUE_LAYER,
    SIDECAR_ISSUE_SEVERITY, UNCHECKED_SIDECAR_KINDS, bestFittingSubstrates, describeSidecarIssue,
    sidecarFit, sidecarIssues,
} from './sidecarIssues.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const K = SIDECAR_ISSUE_KINDS;
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const DATASET = read('jta_dataset_test/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const SEEDLING = read('seedling_playthrough/AP_1/AP_1_rules.json');
const clone = (v) => JSON.parse(JSON.stringify(v));
const kinds = (issues) => issues.map((i) => i.kind);

/** ⛓ Slots of a document by the substrate their first entry holds (read, never typed). */
const substrateOf = (doc, slot) => Object.values(doc.preset_sidecars[slot])[0].substrate;
const SLOTS = Object.keys(FOUR.preset_sidecars);
const TILE_SLOT = SLOTS[0];
const ZONE_SLOT = SLOTS.find((s) => substrateOf(FOUR, s) !== substrateOf(FOUR, TILE_SLOT));
const TILE = substrateOf(FOUR, TILE_SLOT);
const ZONE = substrateOf(FOUR, ZONE_SLOT);
const firstRegion = (doc, slot) => Object.keys(doc.preset_sidecars[slot])[0];
/** ⛓ The first sidecar region of a slot whose DOCUMENT region holds a location (read, never typed). */
const locatedRegion = (doc, slot) => Object.keys(doc.preset_sidecars[slot])
    .find((r) => (doc.regions?.[slot]?.[r]?.locations ?? []).length > 0);

/** ⛓ A clone of `doc` with slot `slot`'s entry `region` handed to `edit(entry, doc)`. */
function broken(doc, slot, edit, region = firstRegion(doc, slot)) {
    const out = clone(doc);
    edit(out.preset_sidecars[slot][region], out, region);
    return out;
}

/**
 * ⛓ THE LAW for "a required field": the first REQUIRED substrate-owned field
 * of the entry's declaration whose removal the substrate's OWN
 * `deserializeWorld` survives — so the drop is one issue, not a throw as well.
 * Selected by the declaration and the deserializer, never by the check under
 * test (a row selected by the required check would filter its own mutant out).
 */
function droppableRequired(entry) {
    const reg = substrateRegistry.get(entry.substrate);
    return Object.entries(sidecarFieldsOf(reg)).filter(([, d]) => d.required && d.owner === 'substrate')
        .map(([k]) => k).find((k) => {
            const p = { ...entry.playable_payload };
            delete p[k];
            try { reg.deserializeWorld(p); return true; } catch { return false; }
        });
}

const NO_DECL = 'v0_row_declares_nothing';
const BAD_DECL = 'v0_row_malformed_declaration';
const NO_DESER = 'v0_row_no_deserializer';
substrateRegistry.register({ id: NO_DECL, deserializeWorld: (p) => p });
substrateRegistry.register({
    id: BAD_DECL, deserializeWorld: (p) => p,
    sidecarFields: { surprise: { type: 'not-a-type', description: 'x' } },
});
substrateRegistry.register({ id: NO_DESER, sidecarFields: {} });

describe('⛓ a CLEAN committed document reports nothing', () => {
    it.each(SLOTS)('the four-player fixture, slot %s: no issue at all', (slot) => {
        expect(sidecarIssues(FOUR, slot)).toEqual([]);
    });

    it('…and the premise: its slots hold two different substrates', () => {
        expect(TILE).not.toBe(ZONE);
    });

    it('the jta dataset fixture (a carrier and two references): no issue', () => {
        expect(sidecarIssues(DATASET, Object.keys(DATASET.preset_sidecars)[0])).toEqual([]);
    });

    it('a slot with no preset_sidecars — and a document with none — reports nothing', () => {
        expect(sidecarIssues(FOUR, '9')).toEqual([]);
        expect(sidecarIssues({ regions: FOUR.regions }, TILE_SLOT)).toEqual([]);
    });
});

/**
 * ⛓⛓ EVERY KIND, PRODUCED. Each row breaks a clean committed slot in ONE place
 * and asks for the kind; the table's completeness is its own row, so a kind
 * added without a row reds here.
 */
const PRODUCERS = {
    [K.NOT_AN_ENTRY]: () => broken(FOUR, TILE_SLOT, (e, d, r) => { d.preset_sidecars[TILE_SLOT][r] = { substrate: 7 }; }),
    [K.NOT_PLAYABLE]: () => broken(FOUR, TILE_SLOT, (e) => { e.substrate = 'no_such_substrate'; }),
    [K.BAD_DECLARATION]: () => broken(FOUR, TILE_SLOT, (e) => { e.substrate = BAD_DECL; }),
    [K.NO_DECLARATION]: () => broken(FOUR, TILE_SLOT, (e) => { e.substrate = NO_DECL; }),
    [K.MISSING_REQUIRED]: () => broken(FOUR, TILE_SLOT, (e) => {
        delete e.playable_payload[droppableRequired(e)];
    }),
    [K.UNDECLARED_FIELD]: () => broken(FOUR, TILE_SLOT, (e) => { e.playable_payload.surprise = 1; }),
    [K.INVALID_VALUE]: () => broken(FOUR, TILE_SLOT, (e) => { e.playable_payload.fogEnabled = 'yes'; }),
    [K.SUBSTRATE_MISMATCH]: () => broken(FOUR, ZONE_SLOT, (e) => { e.substrate = TILE; }),
    [K.DESERIALIZE_THROWS]: () => broken(FOUR, TILE_SLOT, (e) => { e.playable_payload.tiles = []; }),
    [K.NO_REGION]: () => broken(FOUR, TILE_SLOT, (e, d, r) => {
        d.preset_sidecars[TILE_SLOT].Nowhere = e;
        delete d.preset_sidecars[TILE_SLOT][r];
    }),
    [K.EXIT_UNKNOWN]: () => broken(FOUR, TILE_SLOT, (e) => { e.playable_payload.exits[0].exitName = 'Nowhere'; }),
    [K.EXIT_NOT_CARRIED]: () => broken(FOUR, TILE_SLOT, (e) => { e.playable_payload.exits.shift(); }),
    [K.EXITS_UNCHECKED]: () => SEEDLING,
    [K.LOCATION_UNKNOWN]: () => broken(FOUR, TILE_SLOT, (e) => {
        e.playable_payload.items.find((i) => i.locationName).locationName = 'Nowhere';
    }, locatedRegion(FOUR, TILE_SLOT)),
    [K.LOCATION_NOT_CARRIED]: () => broken(FOUR, TILE_SLOT, (e) => {
        e.playable_payload.items.find((i) => i.locationName).locationName = null;
    }, locatedRegion(FOUR, TILE_SLOT)),
    [K.LOCATIONS_UNCHECKED]: () => SEEDLING,
    [K.GRID_CELL_DUPLICATE]: () => broken(FOUR, TILE_SLOT, (e, d) => {
        const other = Object.values(d.preset_sidecars[TILE_SLOT])[1];
        e.grid_cell = { ...other.grid_cell };
    }),
    [K.GRID_CELL_OUTSIDE]: () => broken(FOUR, TILE_SLOT, (e, d) => {
        e.grid_cell = { gx: d.procgen_metadata.grid_dims.width, gy: 0 };
    }),
    [K.REF_UNRESOLVED]: () => {
        const slot = Object.keys(DATASET.preset_sidecars)[0];
        const region = Object.keys(DATASET.preset_sidecars[slot])
            .find((r) => DATASET.preset_sidecars[slot][r].playable_payload.jta_dataset_ref);
        return broken(DATASET, slot, (e) => { e.playable_payload.jta_dataset_ref.dataset_id = 'nowhere'; }, region);
    },
};
const slotFor = (kind) => {
    const doc = PRODUCERS[kind]();
    if (doc === SEEDLING) return [doc, Object.keys(SEEDLING.preset_sidecars)[0]];
    if (kind === K.REF_UNRESOLVED) return [doc, Object.keys(DATASET.preset_sidecars)[0]];
    return [doc, kind === K.SUBSTRATE_MISMATCH ? ZONE_SLOT : TILE_SLOT];
};

describe('⛓⛓ every kind is produced by a document broken in one place', () => {
    it('the table covers every kind, and every kind has a severity and a layer', () => {
        expect(Object.keys(PRODUCERS).sort()).toEqual(Object.values(K).sort());
        for (const k of Object.values(K)) {
            expect(['error', 'warning']).toContain(SIDECAR_ISSUE_SEVERITY[k]);
            expect(['shape', 'document']).toContain(SIDECAR_ISSUE_LAYER[k]);
        }
    });

    it.each(Object.values(K))('%s', (kind) => {
        const [doc, slot] = slotFor(kind);
        const issues = sidecarIssues(doc, slot);
        const hit = issues.find((i) => i.kind === kind);
        expect(hit, JSON.stringify(issues, null, 1)).toBeDefined();
        expect(hit.severity).toBe(SIDECAR_ISSUE_SEVERITY[kind]);
        expect(typeof hit.message).toBe('string');
        expect(hit.message.length).toBeGreaterThan(0);
    });
});

describe('the shape layer — D0\'s declaration, in sentences', () => {
    it('⛓ a required field dropped is ONE warning, and its sentence names the field and says '
        + 'what `required` means', () => {
        const entry = FOUR.preset_sidecars[TILE_SLOT][firstRegion(FOUR, TILE_SLOT)];
        const field = droppableRequired(entry);
        expect(field, 'premise: a required field the deserializer survives losing').toBeDefined();
        const issues = sidecarIssues(broken(FOUR, TILE_SLOT, (e) => { delete e.playable_payload[field]; }),
            TILE_SLOT);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ kind: K.MISSING_REQUIRED, severity: 'warning', field });
        expect(issues[0].message).toContain(`\`${field}\``);
        expect(issues[0].message).toContain(`every \`${TILE}\` producer writes it`);
    });

    it('an unregistered substrate is NOT_PLAYABLE, and nothing else is asked of it', () => {
        const issues = sidecarIssues(PRODUCERS[K.NOT_PLAYABLE](), TILE_SLOT);
        expect(issues.find((i) => i.kind === K.NOT_PLAYABLE).message)
            .toContain('`no_such_substrate` is not a substrate this app can play');
        expect(kinds(issues)).not.toContain(K.DESERIALIZE_THROWS);
    });

    it('…and so is a registered entry with no `deserializeWorld`', () => {
        const issues = sidecarIssues(broken(FOUR, TILE_SLOT, (e) => { e.substrate = NO_DESER; }), TILE_SLOT);
        expect(issues.find((i) => i.kind === K.NOT_PLAYABLE).message).toContain('`deserializeWorld`');
    });

    it('a substrate that declares nothing is said ONCE for the slot — not checked, not passed', () => {
        const doc = clone(FOUR);
        for (const e of Object.values(doc.preset_sidecars[TILE_SLOT])) e.substrate = NO_DECL;
        const notices = sidecarIssues(doc, TILE_SLOT).filter((i) => i.kind === K.NO_DECLARATION);
        expect(notices).toHaveLength(1);
        expect(notices[0].region).toBeNull();
        expect(UNCHECKED_SIDECAR_KINDS).toContain(K.NO_DECLARATION);
    });
});

describe('⛓⛓⛓ the MISMATCH — the substrate-change case (⚖)', () => {
    const payload = FOUR.preset_sidecars[ZONE_SLOT][firstRegion(FOUR, ZONE_SLOT)].playable_payload;
    // ⛓ every well-formed declaration (this file's malformed test entry refuses to merge)
    const candidates = substrateRegistry.getAll().flatMap((e) => {
        try {
            const fields = sidecarFieldsOf(e);
            return fields ? [{ id: e.id, fields }] : [];
        } catch { return []; }
    });

    it('the rule, exported: the payload fits its OWN declaration better than the other '
        + 'slot\'s substrate', () => {
        const own = sidecarFit(sidecarFieldsOf(substrateRegistry.get(ZONE)), payload);
        const other = sidecarFit(sidecarFieldsOf(substrateRegistry.get(TILE)), payload);
        expect(own).toBeGreaterThan(other);
        expect(bestFittingSubstrates(payload, candidates).ids).toEqual([ZONE]);
    });

    it('⛓ a zone payload under the tile-grid substrate says whose keys it has, ONCE, folding '
        + 'the per-field sentences into it', () => {
        const issues = sidecarIssues(PRODUCERS[K.SUBSTRATE_MISMATCH](), ZONE_SLOT);
        const m = issues.filter((i) => i.kind === K.SUBSTRATE_MISMATCH);
        expect(m).toHaveLength(1);
        expect(m[0].message).toContain(`has the keys of \`${ZONE}\`, not \`${TILE}\``);
        expect(m[0].severity).toBe('error');
        for (const k of [K.MISSING_REQUIRED, K.UNDECLARED_FIELD, K.INVALID_VALUE]) {
            expect(kinds(issues)).not.toContain(k);
        }
    });

    it('…and the other way round names the tile-grid substrate', () => {
        const doc = broken(FOUR, TILE_SLOT, (e) => { e.substrate = ZONE; });
        const m = sidecarIssues(doc, TILE_SLOT).find((i) => i.kind === K.SUBSTRATE_MISMATCH);
        expect(m.message).toContain(`\`${TILE}\``);
        expect(m.message).toContain(`not \`${ZONE}\``);
    });

    it('⛔ a payload that merely lost a field does NOT read as another substrate\'s', () => {
        expect(kinds(sidecarIssues(PRODUCERS[K.MISSING_REQUIRED](), TILE_SLOT)))
            .not.toContain(K.SUBSTRATE_MISMATCH);
    });
});

describe('the document layer — exits, both ways', () => {
    it('⛓ the prefixed spelling is read through: the zone slot\'s payload says `exit_S` where the '
        + 'document says `<region>__exit_S`, and that is clean', () => {
        const slot = ZONE_SLOT;
        const region = firstRegion(FOUR, slot);
        const payloadNames = FOUR.preset_sidecars[slot][region].playable_payload.exits.map((e) => e.exitName);
        const docNames = FOUR.regions[slot][region].exits.map((e) => e.name);
        expect(payloadNames.some((n) => !docNames.includes(n)), 'premise: a prefixed document name').toBe(true);
        expect(sidecarIssues(FOUR, slot)).toEqual([]);
    });

    it('a payload exit naming nothing in the document is an ERROR naming the exit', () => {
        const hit = sidecarIssues(PRODUCERS[K.EXIT_UNKNOWN](), TILE_SLOT).find((i) => i.kind === K.EXIT_UNKNOWN);
        expect(hit).toMatchObject({ severity: 'error' });
        expect(hit.message).toContain('"Nowhere"');
    });

    it('a document exit the payload does not carry is a WARNING naming the document\'s exit', () => {
        const region = firstRegion(FOUR, TILE_SLOT);
        const dropped = FOUR.preset_sidecars[TILE_SLOT][region].playable_payload.exits[0].exitName;
        const issues = sidecarIssues(PRODUCERS[K.EXIT_NOT_CARRIED](), TILE_SLOT);
        expect(issues.map((i) => [i.kind, i.severity])).toEqual([[K.EXIT_NOT_CARRIED, 'warning']]);
        expect(issues[0].message).toContain(dropped);
    });
});

describe('the document layer — locations, through the DECLARED carrier', () => {
    it.each([['tile-grid', () => TILE_SLOT], ['zone', () => ZONE_SLOT]])(
        '%s slot: a carried name the document lacks is an error; a document name not carried a '
        + 'warning', (_label, slotOf) => {
            const slot = slotOf();
            const reg = substrateRegistry.get(substrateOf(FOUR, slot));
            const region = locatedRegion(FOUR, slot);
            const docLoc = FOUR.regions[slot][region].locations[0].name;
            expect(reg[AP_LOCATION_NAMES_SLOT](FOUR.preset_sidecars[slot][region].playable_payload))
                .toContain(docLoc);
            // rename the document's location: the payload now carries a dangling name,
            // and the document holds one no payload carries
            const doc = clone(FOUR);
            doc.regions[slot][region].locations[0].name = 'Renamed';
            const issues = sidecarIssues(doc, slot);
            expect(issues.map((i) => `${i.kind} ${i.severity}`).sort()).toEqual([
                `${K.LOCATION_NOT_CARRIED} warning`, `${K.LOCATION_UNKNOWN} error`,
            ]);
            expect(issues.find((i) => i.kind === K.LOCATION_UNKNOWN).message).toContain(docLoc);
        });

    it('⛓ a substrate with no carrier gets ONE warning per slot, saying so — and a payload whose '
        + 'reader answers null likewise', () => {
        const slot = Object.keys(SEEDLING.preset_sidecars)[0];
        const sub = substrateOf(SEEDLING, slot);
        expect(substrateRegistry.get(sub)[AP_LOCATION_NAMES_SLOT]).toBeUndefined();
        expect(substrateRegistry.get(sub)[AP_EXIT_NAMES_SLOT]).toBeUndefined();
        const issues = sidecarIssues(SEEDLING, slot);
        const loc = issues.filter((i) => i.kind === K.LOCATIONS_UNCHECKED);
        const ex = issues.filter((i) => i.kind === K.EXITS_UNCHECKED);
        expect(loc).toHaveLength(1);
        expect(ex).toHaveLength(1);
        expect(loc[0].message).toContain(`\`${sub}\` declares no location carrier`);
        expect(loc[0].message).toContain(`(${Object.keys(SEEDLING.preset_sidecars[slot]).length} regions)`);
        expect(issues.every((i) => i.severity === 'warning')).toBe(true);
        // a declared carrier that finds nothing to read: the zone payload without its map
        const nulled = broken(FOUR, ZONE_SLOT, (e) => { delete e.playable_payload.ap_locations; });
        const n = sidecarIssues(nulled, ZONE_SLOT).filter((i) => i.kind === K.LOCATIONS_UNCHECKED);
        expect(n).toHaveLength(1);
        expect(n[0].message).toContain('carries no location names');
    });
});

describe('the document layer — cells and sibling references', () => {
    it('a duplicate cell is reported on the LATER entry, naming the one that holds it first', () => {
        const [first, second] = Object.keys(FOUR.preset_sidecars[TILE_SLOT]);
        const hits = sidecarIssues(PRODUCERS[K.GRID_CELL_DUPLICATE](), TILE_SLOT)
            .filter((i) => i.kind === K.GRID_CELL_DUPLICATE);
        expect(hits).toHaveLength(1);
        expect(hits[0].region).toBe(second);
        expect(hits[0].message).toContain(`"${first}"`);
    });

    it('a cell outside `procgen_metadata.grid_dims` names the grid', () => {
        const { width, height } = FOUR.procgen_metadata.grid_dims;
        const hit = sidecarIssues(PRODUCERS[K.GRID_CELL_OUTSIDE](), TILE_SLOT)
            .find((i) => i.kind === K.GRID_CELL_OUTSIDE);
        expect(hit.message).toContain(`${width}×${height}`);
    });

    it('⛓ the reference is read off the DECLARATION (`references`), and an unresolved one names '
        + 'the field it points at', () => {
        const slot = Object.keys(DATASET.preset_sidecars)[0];
        const sub = substrateOf(DATASET, slot);
        const refs = Object.entries(sidecarFieldsOf(substrateRegistry.get(sub))).filter(([, d]) => d.references);
        expect(refs.length, 'premise: the substrate declares a reference').toBeGreaterThan(0);
        const [field, d] = refs[0];
        const hit = sidecarIssues(PRODUCERS[K.REF_UNRESOLVED](), slot).find((i) => i.kind === K.REF_UNRESOLVED);
        expect(hit).toMatchObject({ field, severity: 'error' });
        expect(hit.message).toContain(`\`${d.references.field}\``);
    });
});

describe('⛓⛓ the memo is keyed on IDENTITY — an op moves the answer, an Undo restores it (1311)', () => {
    it('set-region-sidecar adds the issue; one Undo takes it away', () => {
        const session = createEditSession(rulesEditAdapter, clone(FOUR));
        const region = firstRegion(FOUR, TILE_SLOT);
        expect(sidecarIssues(session.record(), TILE_SLOT)).toEqual([]);
        const entry = clone(session.record().preset_sidecars[TILE_SLOT][region]);
        delete entry.playable_payload[droppableRequired(entry)];
        expect(session.apply({ op: 'set-region-sidecar', player: TILE_SLOT, region, entry }).applied).toBe(true);
        expect(kinds(sidecarIssues(session.record(), TILE_SLOT))).toEqual([K.MISSING_REQUIRED]);
        expect(session.undo()).toBe(true);
        expect(sidecarIssues(session.record(), TILE_SLOT)).toEqual([]);
    });

    it('⛔ an op on the DOCUMENT side, leaving the entry object alone, moves it too', () => {
        const session = createEditSession(rulesEditAdapter, clone(FOUR));
        const region = locatedRegion(FOUR, TILE_SLOT);
        sidecarIssues(session.record(), TILE_SLOT); // warm the memo on these entry objects
        const res = session.apply({ op: 'delete-location', player: TILE_SLOT, region, index: 0 });
        expect(res.applied).toBe(true);
        expect(kinds(sidecarIssues(session.record(), TILE_SLOT))).toContain(K.LOCATION_UNKNOWN);
        session.undo();
        expect(sidecarIssues(session.record(), TILE_SLOT)).toEqual([]);
    });
});

describe('describeSidecarIssue — the bar\'s and the gate\'s sentence', () => {
    it('prefixes the region, and leaves a slot-level notice as it is', () => {
        expect(describeSidecarIssue({ region: 'r', message: 'm' })).toBe('r — m');
        expect(describeSidecarIssue({ region: null, message: 'm' })).toBe('m');
    });
});
