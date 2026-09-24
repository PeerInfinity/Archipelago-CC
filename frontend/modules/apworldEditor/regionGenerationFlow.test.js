/**
 * regionGenerationFlow — **WHAT THE BLOCK'S REGION GENERATION FORM OPENS ON,
 * SENDS, AND ANSWERS** (APWORLD SUBSTRATE CHANGE R2, task 3), on the committed
 * four-player fixture and `procgen_topdown/AP_10` with every registry library
 * loaded (the `regionRegenerate.test.js` recipe). Plus the panel's teardown
 * rule: the worker run and the elapsed ticker are stopped by every boundary.
 *
 * ⛓ Every population is read off the registry or the document at run time.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GEOMETRY, geometryOf } from '../procgenCore/regionGeometry.js';
import { bagFromPayload } from '../procgenCore/regionGenerationForm.js';
import { assembleRegionParams } from '../procgenPipeline/sphereConfigHooks.js';
import {
    REGENERATE_RIDING_FREE, REGENERATE_RODE_FREE, REGENERATE_RULES_UNCHANGED, applyRulesDocOp,
    describeRegeneration, regenerateOpRefusal,
} from './rulesDocOps.js';
import {
    defaultRegionParamsFor, freeItemsFor, regenerateRegionEntry, regionRealiserKind, regionSizeFor,
} from './regionRegenerate.js';
import {
    REGION_GENERATION_FIRST_SEED, REGION_GENERATION_OP_FIELDS, REGION_GENERATION_SEED_KEY,
    composeRegenerateArgs, freeItemsSentence, regenerateArgsRefusal, regenerationAnswer,
    regenerationProvenance, regionGenerationPlan,
} from './regionGenerationFlow.js';
import {
    REGION_GENERATION_CANCELLED, regionGenerationLoadTimeoutSentence, regionGenerationTimeoutSentence,
} from './regionGenerationRun.js';
import ApworldEditorUI from './apworldEditorUI.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const AP10 = read('procgen_topdown/AP_10/AP_10_rules.json');
const bytes = (o) => JSON.stringify(o);
const tilesIds = () => substrateRegistry.getAll().filter((e) => regionRealiserKind(e)
    && geometryOf(e) === REGION_GEOMETRY.TILES).map((e) => e.id);
const sidesIds = () => substrateRegistry.getAll().filter((e) => regionRealiserKind(e)
    && geometryOf(e) !== REGION_GEOMETRY.TILES).map((e) => e.id);

describe('regionGenerationPlan — what the form opens on', () => {
    it('⛓ a TILES target opens on its registry defaults + the seed + ⚖ Q4\'s size; no recorded knobs off another substrate\'s payload', () => {
        const [target] = tilesIds();
        expect(target, 'premise: a registered tiles realiser').toBeTruthy();
        const plan = regionGenerationPlan(FOUR, '3', 'region_1_0', target);
        const size = regionSizeFor(FOUR, '3');
        expect(plan.refusal).toBeNull();
        expect(plan.tiles).toBe(true);
        expect(plan.size).toEqual(size);
        expect(plan.defaults).toEqual({
            ...substrateRegistry.get(target).defaultProcgenParams,
            [REGION_GENERATION_SEED_KEY]: REGION_GENERATION_FIRST_SEED,
            regionWidth: size.width, regionHeight: size.height,
        });
        expect(FOUR.preset_sidecars['3'].region_1_0.substrate, 'premise: the payload is not the target\'s').not.toBe(target);
        expect(plan.recorded).toBeNull();
    });

    it('⛓ a SIDES target has no size rows; its OWN payload\'s knobs are offered when they differ (trap 1399)', () => {
        const own = FOUR.preset_sidecars['3'].region_2_1.substrate;
        const entry = substrateRegistry.get(own);
        expect(sidesIds(), 'premise: the payload\'s substrate is a sides realiser').toContain(own);
        const plan = regionGenerationPlan(FOUR, '3', 'region_2_1', own, { seed: 7 });
        expect(plan.tiles).toBe(false);
        expect(plan.size).toBeNull();
        expect(Object.keys(plan.defaults)).not.toContain('regionWidth');
        expect(plan.defaults[REGION_GENERATION_SEED_KEY]).toBe(7);
        const read = bagFromPayload(entry, FOUR.preset_sidecars['3'].region_2_1.playable_payload);
        const differ = Object.keys(read).filter((k) => bytes(read[k]) !== bytes(entry.defaultProcgenParams[k]));
        expect(plan.recordedDiff.map(([k]) => k)).toEqual(differ);
        expect(!!plan.recorded).toBe(differ.length > 0);
        if (plan.recorded) expect(plan.recorded).toEqual({ ...read, [REGION_GENERATION_SEED_KEY]: 7 });
    });

    it('⛓⛓ a target with NO realiser gets the OP\'s own refusal sentence (no Generate) — every such id', () => {
        const none = substrateRegistry.getAll()
            .filter((e) => typeof e.deserializeWorld === 'function' && !regionRealiserKind(e)).map((e) => e.id);
        expect(none.length, 'premise: the registry holds playable ids without a realiser').toBeGreaterThan(0);
        for (const id of none) {
            const plan = regionGenerationPlan(FOUR, '3', 'region_1_0', id);
            expect(plan.refusal, id).toBe(regenerateOpRefusal(FOUR, {
                op: 'regenerate-region-sidecar', player: '3', region: 'region_1_0', substrate: id,
                seed: REGION_GENERATION_FIRST_SEED,
            }));
            expect(plan.refusal).toContain('has no per-region realiser');
        }
    });
});

describe('composeRegenerateArgs — the bag → the op, as top-down composes it', () => {
    it('⛓ regionParams = assembleRegionParams over the one target in topDown mode; size only for tiles; free items explicit', () => {
        for (const target of [...tilesIds(), ...sidesIds()]) {
            const plan = regionGenerationPlan(FOUR, '3', 'region_1_0', target, { seed: 4 });
            const args = composeRegenerateArgs(FOUR, '3', 'region_1_0', target, { ...plan.defaults });
            expect(args.regionParams, target).toEqual(assembleRegionParams({
                activeIds: [target], mode: 'topDown', params: plan.defaults,
            }));
            expect(args.seed).toBe(4);
            expect(args.freeItems).toEqual(freeItemsFor(FOUR, '3', substrateRegistry.get(target)));
            if (plan.tiles) expect(args.size).toEqual({ width: plan.size.width, height: plan.size.height });
            else expect(args).not.toHaveProperty('size');
        }
    });

    it('⛓⛓ the WORKER\'s entry is the pure OP\'s entry: regenerateRegionEntry(args) ≡ the op on the same args', () => {
        for (const target of [...tilesIds(), ...sidesIds()].slice(0, 3)) {
            const plan = regionGenerationPlan(FOUR, '3', 'region_2_1', target, { seed: 2 });
            if (plan.refusal) continue;
            const args = composeRegenerateArgs(FOUR, '3', 'region_2_1', target, { ...plan.defaults });
            const res = regenerateRegionEntry(args);
            const { doc, ...op } = args;
            const viaOp = applyRulesDocOp(doc, { op: 'regenerate-region-sidecar', ...op });
            expect(res.ok, res.threw).toBe(viaOp.ok);
            if (!res.ok) continue;
            expect(bytes(res.entry), target).toBe(bytes(viaOp.doc.preset_sidecars['3'].region_2_1));
            expect(describeRegeneration({ region: 'region_2_1', substrate: target, seed: 2, res }))
                .toBe(viaOp.description);
        }
    });

    it('⛔ a seed that is not a whole number is the OP\'s refusal, asked before any realiser', () => {
        const [target] = tilesIds();
        const plan = regionGenerationPlan(FOUR, '3', 'region_1_0', target);
        const args = composeRegenerateArgs(FOUR, '3', 'region_1_0', target, {
            ...plan.defaults, [REGION_GENERATION_SEED_KEY]: null,
        });
        expect(regenerateArgsRefusal(args)).toMatch(/needs `seed` as a whole number/);
        expect(regenerateArgsRefusal(composeRegenerateArgs(FOUR, '3', 'region_1_0', target, plan.defaults))).toBeNull();
    });
});

describe('G3 — a GENERATED room\'s block: the form opens on the room\'s own knobs, and an edit reaches the regenerated room', () => {
    /**
     * ⛓ seedling generated G3, on the committed `seedling_generated_leaf` preset:
     * its one generated region, read by its sidecar's substrate (no id typed).
     * The payload's `generation` reads back through `bagFromPayload`; a knob that
     * differs is offered beside the defaults; a changed knob rides
     * `composeRegenerateArgs` (top-down's assembly) into the op, and the room the
     * op builds records it.
     */
    const LEAF = read('seedling_generated_leaf/AP_1/AP_1_rules.json');
    const [region, sidecar] = Object.entries(LEAF.preset_sidecars['1'])
        .find(([, sc]) => sc.playable_payload?.generated === true) ?? [];

    it('⛓ the form opens on the defaults — the room was built at them, so nothing is offered beside', () => {
        const entry = substrateRegistry.get(sidecar.substrate);
        expect(typeof entry.renderProcgenParams, 'premise: the entry draws knobs').toBe('function');
        const plan = regionGenerationPlan(LEAF, '1', region, sidecar.substrate, { seed: 3 });
        expect(plan.refusal).toBeNull();
        expect(plan.defaults).toEqual({ ...entry.defaultProcgenParams, [REGION_GENERATION_SEED_KEY]: 3 });
        expect(bagFromPayload(entry, sidecar.playable_payload)).toEqual(entry.defaultProcgenParams);
        expect(plan.recorded).toBeNull();
    });

    it('⛓ a room built with other knobs reopens on them (the recorded diff)', () => {
        const doc = structuredClone(LEAF);
        doc.preset_sidecars['1'][region].playable_payload.generation.obstacleTarget = 4;
        const plan = regionGenerationPlan(doc, '1', region, sidecar.substrate);
        expect(plan.recordedDiff).toEqual([['seedlingGenObstacleTarget', 4]]);
        expect(plan.recorded).toMatchObject({ seedlingGenObstacleTarget: 4 });
    });

    it('⛓⛓ Obstacle target 2 + Fill shell in the bag → the op\'s regionParams → the regenerated room records them', () => {
        const plan = regionGenerationPlan(LEAF, '1', region, sidecar.substrate, { seed: 1 });
        const bag = { ...plan.defaults, seedlingGenObstacleTarget: 2, seedlingGenFill: 'shell' };
        const args = composeRegenerateArgs(LEAF, '1', region, sidecar.substrate, bag);
        expect(args.regionParams.seedlingGen).toMatchObject({ obstacleTarget: 2, fill: 'shell' });
        const res = regenerateRegionEntry(args);
        expect(res.ok, res.threw).toBe(true);
        expect(res.entry.playable_payload.generation).toMatchObject({ obstacleTarget: 2, fill: 'shell' });
    }, 60_000);
});

describe('the free-item clause follows hostsSurplusExitsNatively (§7.7 ⚖ #5, RULED)', () => {
    const bounceLike = () => sidesIds().find((id) => typeof substrateRegistry.get(id).hostsSurplusExitsNatively
        === 'function' && !substrateRegistry.get(id).hostsSurplusExitsNatively({ bounceMode: 'column' }));

    it('⛓⛓ DROPPED in the form and the op\'s answer when the target hosts surplus exits natively; KEPT otherwise', () => {
        const id = bounceLike();
        expect(id, 'premise: a target whose hosting depends on its params').toBeTruthy();
        const region = 'BlackCastle';
        const native = { doc: AP10, player: '1', region, substrate: id, seed: 1,
            regionParams: defaultRegionParamsFor(substrateRegistry.get(id)), freeItems: freeItemsFor(AP10, '1', substrateRegistry.get(id)) };
        const column = { ...native, regionParams: { ...native.regionParams, bounceMode: 'column' } };
        expect(freeItemsSentence(id, native)).toBeNull();
        expect(freeItemsSentence(id, column)).toContain(`${column.freeItems.length} item`);
        const resNative = regenerateRegionEntry(native);
        const resColumn = regenerateRegionEntry(column);
        expect(resNative.ok && resColumn.ok, `${resNative.threw} ${resColumn.threw}`).toBe(true);
        expect(resNative.hostsSurplus).toBe(true);
        expect(resColumn.hostsSurplus).toBe(false);
        const said = (res) => describeRegeneration({ region, substrate: id, seed: 1, res });
        expect(said(resNative)).not.toContain(REGENERATE_RODE_FREE);
        expect(said(resColumn)).toContain(`item${column.freeItems.length === 1 ? '' : 's'} ${REGENERATE_RODE_FREE}`);
        expect(said(resNative)).toContain(REGENERATE_RULES_UNCHANGED);
        const refusedNative = regenerationAnswer(native, { ok: false, threw: 'x', freeItems: ['A'], hostsSurplus: true }, 60);
        expect(refusedNative.text).not.toContain(REGENERATE_RIDING_FREE);
        const refusedColumn = regenerationAnswer(column, { ok: false, threw: 'x', freeItems: ['A'], hostsSurplus: false }, 60);
        expect(refusedColumn.text).toContain(`1 item ${REGENERATE_RIDING_FREE} [A]`);
    });
});

describe('regenerationAnswer / regenerationProvenance', () => {
    const args = { region: 'C', substrate: 'z', seed: 5, regionParams: { a: 1 }, hazardOpts: null, freeItems: ['F'] };

    it('⛓ each outcome answers in the op\'s or the worker\'s own words; only a result lands', () => {
        expect(regenerationAnswer(args, { ok: false, timedOut: true }, 9))
            .toEqual({ landed: false, text: regionGenerationTimeoutSentence(9, 'z', 'C') });
        expect(regenerationAnswer(args, { ok: false, timedOut: true, phase: 'loading', budgetMs: 30000 }, 9))
            .toEqual({ landed: false, text: regionGenerationLoadTimeoutSentence(30000) });
        expect(regenerationAnswer(args, { ok: false, cancelled: true }, 9))
            .toEqual({ landed: false, text: `apworld: ${REGION_GENERATION_CANCELLED}.` });
        expect(regenerationAnswer(args, { ok: false, unavailable: true, threw: 'no z' }, 9).text).toBe('apworld: no z');
        expect(regenerationAnswer(args, { ok: false, threw: 'boom', freeItems: [], hostsSurplus: false }, 9).text)
            .toContain('the `z` realiser refused region "C": boom');
    });

    it('⛓ the provenance is the pure op\'s arguments + the realiser\'s ms, and names the op', () => {
        expect(regenerationProvenance(args, { ms: 1234.6 })).toEqual({
            op: 'regenerate-region-sidecar', substrate: 'z', seed: 5, regionParams: { a: 1 },
            hazardOpts: null, freeItems: ['F'], ms: 1235,
        });
        expect(regenerationProvenance({ ...args, size: { width: 3, height: 4 } }, { ms: 1 }).size)
            .toEqual({ width: 3, height: 4 });
        expect(REGION_GENERATION_OP_FIELDS).toEqual(['regionWidth', 'regionHeight']);
    });
});

/**
 * ⛓⛓ THE PANEL'S TEARDOWN RULE (a remounted panel keeps OLD listeners): the
 * methods run on a minimal `this` — the panel's own prototype, no DOM.
 */
describe('the panel stops the worker run and the elapsed ticker at every boundary', () => {
    const P = ApworldEditorUI.prototype;
    const live = () => {
        const cancel = vi.fn();
        const self = {
            _regionGen: { run: { handle: { cancel } } },
            _regionGenTicker: setInterval(() => {}, 1000),
        };
        Object.assign(self, { _stopRegionGenRun: P._stopRegionGenRun, _closeRegionGeneration: P._closeRegionGeneration });
        return { self, cancel };
    };

    it('⛓ _closeRegionGeneration cancels the run (terminating its worker), clears the ticker, closes the form', () => {
        const { self, cancel } = live();
        const ticker = self._regionGenTicker;
        const cleared = vi.spyOn(globalThis, 'clearInterval');
        self._closeRegionGeneration();
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cleared).toHaveBeenCalledWith(ticker);
        expect(self._regionGenTicker).toBeNull();
        expect(self._regionGen).toBeNull();
        cleared.mockRestore();
    });

    it('⛓⛓ onPanelDestroy stops them (mutant: the ticker left running on destroy)', () => {
        const { self, cancel } = live();
        Object.assign(self, {
            _teardownRawEditor: () => {}, _closeRoomEditor: () => {}, _keyHandler: null,
            rawJsonUnsubscribe: null, loadRulesUnsubscribe: null, selectRegionUnsubscribe: null,
        });
        P.onPanelDestroy.call(self);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(self._regionGenTicker).toBeNull();
        expect(self._regionGen).toBeNull();
    });
});
