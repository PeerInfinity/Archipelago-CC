/**
 * procgenCore/deserializeRefusal — **ONE REGION ITS SUBSTRATE REFUSES DOES NOT
 * TAKE THE DOCUMENT DOWN** (PRESET SIDECARS C1).
 *
 * One row per reader that builds worlds for a whole document, each asked of
 * the SAME scratch document: the committed `procgen_topdown/AP_11` with one
 * undeclared key added to one region's payload IN MEMORY (never a committed
 * byte). The expected sentence is never typed: it is the entry's own throw,
 * caught here, run through the one spelling (`deserializeRefusalSentence`).
 *
 * BEFORE C1 all three readers threw that sentence out of themselves (plan
 * §28.0's headless witness): play lost every region, the Map tab came up blank.
 *
 * ⛓ The registry is loaded from `REGISTRY_LIBRARIES` (the reference
 * generator's list), so no row here names a substrate: the region's substrate
 * is read off its own sidecar entry.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { deserializeOrRefuse, deserializeRefusalSentence } from './deserializeRefusal.js';
import { buildWarehouse } from '../procgenPlayer/procgenPlayerEngine.js';
import { reconstructResultFromSidecars, refusedRegionsNote } from '../procgenPipeline/compositeMapDocument.js';
import { rebuildEnvelopeFromRulesJson, sphereRebuildRefusal } from '../procgenPipeline/procgenPipelineEngine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const DOC = 'frontend/presets/procgen_topdown/AP_11/AP_11_rules.json';
const PLAYER = '1';
/** The region the scratch copy breaks, and the key it adds: the tile grid's
 *  `tiles`, which this region's room declaration does not know (plan §25.6). */
const REFUSED_REGION = 'BlackCastle';
const UNDECLARED_KEY = 'tiles';

const committed = () => JSON.parse(readFileSync(join(ROOT, DOC), 'utf8'));
function scratch() {
    const doc = committed();
    doc.preset_sidecars[PLAYER][REFUSED_REGION].playable_payload[UNDECLARED_KEY] = [];
    return doc;
}
const entryOf = (doc) => doc.preset_sidecars[PLAYER][REFUSED_REGION];
/** The entry's OWN throw on the scratch payload, through the one spelling. */
function expectedSentence() {
    const entry = entryOf(scratch());
    let thrown = null;
    try {
        substrateRegistry.get(entry.substrate).deserializeWorld(entry.playable_payload);
    } catch (err) {
        thrown = err;
    }
    expect(thrown, 'the scratch payload must be refused by its own substrate').not.toBe(null);
    return deserializeRefusalSentence(REFUSED_REGION, entry.substrate, thrown);
}
const otherRegions = (doc) => Object.keys(doc.preset_sidecars[PLAYER]).filter((r) => r !== REFUSED_REGION);

describe('⛓ the fixture discriminates', () => {
    it('the committed payload reads; the scratch copy is refused by the entry itself', () => {
        const entry = entryOf(committed());
        const adapter = substrateRegistry.get(entry.substrate);
        expect(() => adapter.deserializeWorld(entry.playable_payload)).not.toThrow();
        const sentence = expectedSentence();
        expect(sentence).toContain(REFUSED_REGION);
        expect(sentence).toContain(entry.substrate);
        expect(otherRegions(committed()).length).toBeGreaterThan(1);
    });

    it('deserializeOrRefuse answers the world, or the sentence — and passes opts through', () => {
        const seen = [];
        const adapter = { deserializeWorld: (p, o) => { seen.push(o); return { p }; } };
        expect(deserializeOrRefuse(adapter, 1, { regionId: 'r', substrate: 's' })).toEqual({ world: { p: 1 } });
        deserializeOrRefuse(adapter, 1, { regionId: 'r', substrate: 's', opts: { k: 2 } });
        expect(seen).toEqual([undefined, { k: 2 }]);
        const refusing = { deserializeWorld: () => { throw new Error('not mine'); } };
        expect(deserializeOrRefuse(refusing, 1, { regionId: 'r', substrate: 's' }))
            .toEqual({ refusal: 'region r: its `s` payload cannot be read — not mine' });
    });
});

describe('⛓⛓ each whole-document reader SKIPS or REFUSES the region by its sentence', () => {
    it('play — buildWarehouse: the other regions load, the refused one is logged and kept on `refused`', () => {
        const warnings = [];
        const wh = buildWarehouse(scratch(), PLAYER, substrateRegistry, {
            logger: { warn: (m) => warnings.push(m) },
        });
        const sentence = expectedSentence();
        expect(wh.keys()).toEqual(otherRegions(committed()));
        expect([...wh.refused]).toEqual([[REFUSED_REGION, sentence]]);
        expect(warnings.filter((w) => w.includes(sentence))).toHaveLength(1);
        // control: the committed document refuses nothing
        const control = buildWarehouse(committed(), PLAYER, substrateRegistry, { logger: { warn() {} } });
        expect(control.refused.size).toBe(0);
        expect(control.size()).toBe(wh.size() + 1);
    });

    it('the Map — reconstructResultFromSidecars: the other regions draw, `refused` and the note name the one', () => {
        const result = reconstructResultFromSidecars(scratch(), { playerId: PLAYER });
        const control = reconstructResultFromSidecars(committed(), { playerId: PLAYER });
        const sentence = expectedSentence();
        expect(result.stats.regionsBuilt).toBe(control.stats.regionsBuilt - 1);
        expect(result.stats.regionsSkipped).toBe(1);
        expect(result.grid.allRegions().map((r) => r.region_id)).not.toContain(REFUSED_REGION);
        expect(result.refused).toEqual([{ region_id: REFUSED_REGION, substrate: entryOf(committed()).substrate, sentence }]);
        expect(refusedRegionsNote(result)).toContain(sentence);
        expect(control.refused).toEqual([]);
        expect(refusedRegionsNote(control)).toBe(null);
    });

    it('the sphere rebuild — refuses the WHOLE document by its named refusal (a tree cannot drop a node)', () => {
        expect(() => rebuildEnvelopeFromRulesJson(committed(), { playerId: PLAYER })).not.toThrow();
        let thrown = null;
        try { rebuildEnvelopeFromRulesJson(scratch(), { playerId: PLAYER }); } catch (e) { thrown = e.message; }
        expect(thrown).toBe(`rebuildEnvelopeFromRulesJson: ${expectedSentence()}`);
        // ⚠ the cheap predicate deserializes nothing, so it does not ask this one (named in the refusal's docblock)
        expect(sphereRebuildRefusal(scratch(), { playerId: PLAYER })).toBe(null);
    });
});
