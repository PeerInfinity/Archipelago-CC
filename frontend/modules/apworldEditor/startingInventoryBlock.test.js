/**
 * apworldEditor/startingInventoryBlock — **THE STARTING INVENTORY BLOCK'S
 * DATA: THE LIST, THE NEEDS, THE GRANT** (APWORLD SUBSTRATE CHANGE R3). The
 * panel draws what these functions answer; the in-app rows (category
 * `apworldEditor`) hold the drawing to them.
 *
 * ⛓ On `bounce_worldgen` (every sidecar bounce, `starting_items: []`, both
 * arrows defined) and the four-player fixture — the registry loaded as the
 * sibling rows load it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { declaredStartingNeeds } from '../procgenCore/startingInventory.js';
import { applyRulesDocOp, startingItemRefusal } from './rulesDocOps.js';
import {
    NEED_MET, NEED_NONE_HELD, needSentence, startingCountOf, startingGrantOp, startingInventoryList,
    startingNeedRows, substratesInSlot,
} from './startingInventoryBlock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const BW = read('bounce_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const withStart = (doc, p, list) => ({ ...structuredClone(doc), starting_items: { ...doc.starting_items, [p]: list } });

/** Every substrate in the slot that DECLARES needs — derived off the registry. */
const declaring = (doc, p) => substratesInSlot(doc, p)
    .filter((id) => declaredStartingNeeds(substrateRegistry.get(id)).length);

describe('the list and the counts', () => {
    it('⛓ the list is starting_items as a multiset, first appearance first; the Start count reads the same list', () => {
        const [a, b] = Object.keys(BW.items['1']);
        const doc = withStart(BW, '1', [b, a, b]);
        expect(startingInventoryList(doc, '1')).toEqual([{ name: b, count: 2 }, { name: a, count: 1 }]);
        expect(startingCountOf(doc, '1', b)).toBe(2);
        expect(startingInventoryList(BW, '1')).toEqual([]);
    });

    it('⛓ the slot\'s substrates are its sidecar entries\' distinct ids, in entry order', () => {
        const want = [...new Set(Object.values(FOUR.preset_sidecars['3']).map((e) => e.substrate))];
        expect(substratesInSlot(FOUR, '3')).toEqual(want);
    });
});

describe('the needs and the grant', () => {
    it('⛓⛓ bounce_worldgen slot 1 with nothing held: every declaring substrate\'s need is UNMET, one grant per candidate', () => {
        const ids = declaring(BW, '1');
        expect(ids.length).toBeGreaterThan(0);
        const rows = startingNeedRows(BW, '1', substratesInSlot(BW, '1'));
        expect(rows.map((r) => r.substrate)).toEqual(ids.flatMap((id) => declaredStartingNeeds(substrateRegistry.get(id)).map(() => id)));
        for (const r of rows) {
            expect(r.met).toBe(false);
            expect(needSentence(r).endsWith(NEED_NONE_HELD)).toBe(true);
            expect(r.grants.map((g) => g.item)).toEqual(r.anyOf);
            for (const g of r.grants) {
                expect(g.refusal).toBeNull();
                expect(g.op).toEqual({ op: 'set-starting-count', player: '1', item: g.item, count: 1 });
            }
        }
    });

    it('⛓⛓ a grant is ONE op; after it the need reads met with the held name', () => {
        const [row] = startingNeedRows(BW, '1', declaring(BW, '1'));
        const g = row.grants[row.grants.length - 1];
        const res = applyRulesDocOp(BW, g.op);
        expect(res.ok, res.error).toBe(true);
        expect(res.doc.starting_items['1']).toEqual([g.item]);
        const [after] = startingNeedRows(res.doc, '1', [row.substrate]);
        expect(after).toMatchObject({ met: true, heldName: g.item });
        expect(needSentence(after)).toContain(`${NEED_MET}: ${g.item}`);
    });

    it('⛓ the grant is current + 1 — a list already holding the item gets one MORE', () => {
        const [row] = startingNeedRows(BW, '1', declaring(BW, '1'));
        const item = row.anyOf[0];
        const doc = withStart(BW, '1', [item, item]);
        expect(startingGrantOp(doc, '1', item).count).toBe(3);
        expect(applyRulesDocOp(doc, startingGrantOp(doc, '1', item)).doc.starting_items['1']).toEqual([item, item, item]);
    });

    it('⛔ a candidate the slot does not define: the grant carries the OP\'s refusal, and the op refuses in the same words', () => {
        const [row] = startingNeedRows(BW, '1', declaring(BW, '1'));
        const missing = row.anyOf[0];
        const doc = structuredClone(BW);
        delete doc.items['1'][missing];
        const g = startingNeedRows(doc, '1', [row.substrate])[0].grants.find((x) => x.item === missing);
        expect(g.refusal).toBe(startingItemRefusal(doc, '1', missing, 1));
        const res = applyRulesDocOp(doc, g.op);
        expect(res.ok).toBe(false);
        expect(res.error).toBe(g.refusal);
    });

    it('⛓ a substrate that declares nothing — or is not registered — contributes no row', () => {
        const none = substrateRegistry.getAll().filter((e) => !declaredStartingNeeds(e).length).map((e) => e.id);
        expect(none.length).toBeGreaterThan(0);
        expect(startingNeedRows(BW, '1', [...none, 'no-such-substrate'])).toEqual([]);
    });
});
