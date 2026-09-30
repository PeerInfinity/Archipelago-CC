/**
 * ⛓⛓ CONCEPT LIBRARY T2c — **A TEXT-ADVENTURE ROOM BEHIND A GATE CARRIES ITS
 * GATED BACK-EXIT IN `exitGates`.**
 *
 * `insertBackExit` gives a back-exit's record no rule; `buildRulesJson`'s
 * bidirectional post-pass copies the forward exit's compiled rule onto the
 * DOCUMENT's back-exit — and, since T2c, onto the record too for an AUTHORED
 * substrate, so `serializeTextAdventureRoom` writes it. Before T2c the payload
 * omitted it: `check-sidecar-fields`' rule agreement FAILed on every such room
 * (measured at `5a086f6`: 3 disagreements in `shipped:maze-ta-sphere-mix`, 4 in
 * `shipped:text-adventure-sphere-demo`, 2 in the maze-start trial world at seed
 * 1), and the round trip answered `True_` for the back-exit.
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import './textAdventureSubstrateWrapperLibrary.js';
import { CONCEPT_TRIAL_STATE, SHIPPED_PRESETS } from '../procgenPipeline/presetDefs.js';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { rebuildEnvelopeFromRulesJson } from '../procgenPipeline/procgenPipelineEngine.js';
import { runStep } from '../procgenPipeline/sphereSteps.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { RULE_AGREEMENT, regionRuleAgreement } from '../apworldEditor/sidecarRuleAgreement.js';
import { deriveRegionRules } from '../apworldEditor/regionRoundTrip.js';

const TRUE = { rule: 'True_' };
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const stateOf = (id) => structuredClone(SHIPPED_PRESETS.find((p) => p.id === id).state);
const build = async (state) => (await runPresetHeadless(buildRunFromState(state))).rulesJson;
const taRegions = (doc) => Object.entries(doc.preset_sidecars['1']).filter(([, s]) => s.substrate === 'text_adventure');
async function rebuiltCompile(doc) {
    const env = rebuildEnvelopeFromRulesJson(structuredClone(doc), { itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES });
    await runStep('compile', env);
    return env.compile.rulesJson;
}

/** `{exit_id: rule}` of every exit the DOCUMENT gates in a TA region — what `exitGates` must equal. */
function documentGates(doc, rid, payload) {
    const byName = Object.fromEntries(doc.regions['1'][rid].exits.map((e) => [e.name, e.access_rule]));
    return Object.fromEntries(payload.exits
        .map((e) => [e.exit_id, byName[e.exit_id] ?? TRUE])
        .filter(([, rule]) => rule.rule !== 'True_'));
}

const WORLDS = {
    'shipped:maze-ta-sphere-mix': stateOf('shipped:maze-ta-sphere-mix'),
    'shipped:text-adventure-sphere-demo': stateOf('shipped:text-adventure-sphere-demo'),
    'the maze-start trial world (seed 1)': {
        ...structuredClone(CONCEPT_TRIAL_STATE),
        params: { ...CONCEPT_TRIAL_STATE.params, seed: 1, startSubstrate: 'maze' },
    },
};

describe('T2c — every TA exit the document gates, forward AND back, is in exitGates', async () => {
    const built = Object.fromEntries(await Promise.all(Object.entries(WORLDS)
        .map(async ([tag, state]) => [tag, await build(state)])));

    for (const tag of Object.keys(WORLDS)) {
        it(`${tag}: exitGates equals the document's gated exits in every TA region, and has ≥1 gated back-exit`, () => {
            const doc = built[tag];
            let gatedBack = 0;
            for (const [rid, s] of taRegions(doc)) {
                const p = s.playable_payload;
                expect(p.exitGates, `${rid}`).toEqual(documentGates(doc, rid, p));
                gatedBack += p.exits.filter((e) => e.isBackExit && e.exit_id in p.exitGates).length;
            }
            expect(gatedBack).toBeGreaterThan(0);
        });
        it(`${tag}: the census's rule agreement AGREES on every TA region`, async () => {
            for (const [rid] of taRegions(built[tag])) {
                // eslint-disable-next-line no-await-in-loop
                const a = await regionRuleAgreement(built[tag], '1', rid);
                expect({ rid, status: a.status, disagreements: a.disagreements })
                    .toEqual({ rid, status: RULE_AGREEMENT.AGREED, disagreements: [] });
            }
        });
    }

    it('the W0 pin: maze-ta-sphere-mix region_4_1 carries its back-exit gate beside the unchanged forward one', () => {
        const p = built['shipped:maze-ta-sphere-mix'].preset_sidecars['1'].region_4_1.playable_payload;
        expect(p.exits.find((e) => e.exit_id === 'region_3_1')).toMatchObject({ isBackExit: true, targetRegion: 'region_3_1' });
        expect(p.exitGates).toEqual({ exit: has('key_blue'), region_3_1: has('key_red') });
    });

    it('the round trip re-emits the back-exit\'s gate (at 5a086f6 it answered True_)', async () => {
        const d = await deriveRegionRules(built['shipped:maze-ta-sphere-mix'], '1', 'region_4_1');
        expect(d.ok).toBe(true);
        expect(Object.fromEntries(d.exits)).toEqual({ exit: has('key_blue'), region_3_1: has('key_red') });
    });

    it('a maze payload is untouched: it carries no exitGates, and the maze back-exit\'s gate stays the document\'s alone', () => {
        const doc = built['shipped:maze-ta-sphere-mix'];
        for (const s of Object.values(doc.preset_sidecars['1']).filter((x) => x.substrate === 'maze')) {
            expect('exitGates' in s.playable_payload).toBe(false);
        }
        expect(doc.regions['1'].region_4_2.exits.find((e) => e.name === 'region_4_1').access_rule).toEqual(has('key_blue'));
    });

    // ⚠ Only the TA regions' rules are compared: a rebuild renames a MAZE region's
    // locations (`__loc_0__` → `__key_yellow_pickup__`, measured at 5a086f6 with
    // and without T2c) — a maze rebuild residue, not this row's subject.
    it('a rebuild of the rooms re-emits both gates: every TA payload\'s exitGates and every TA region\'s rules unchanged', async () => {
        for (const tag of ['shipped:maze-ta-sphere-mix', 'shipped:text-adventure-sphere-demo']) {
            const doc = built[tag];
            // eslint-disable-next-line no-await-in-loop
            const again = await rebuiltCompile(doc);
            for (const [rid, s] of taRegions(doc)) {
                expect(again.preset_sidecars['1'][rid].playable_payload.exitGates, `${tag} ${rid}`)
                    .toEqual(s.playable_payload.exitGates);
                expect(again.regions['1'][rid], `${tag} ${rid}`).toEqual(doc.regions['1'][rid]);
            }
        }
    });

    it('an UNGATED back-exit stays absent: a rebuild whose forward exit lost its gate drops the stale back gate', async () => {
        const doc = structuredClone(built['shipped:maze-ta-sphere-mix']);
        // region_3_1's forward `exit` → region_4_1 is the pair of region_4_1's back-exit `region_3_1`.
        delete doc.preset_sidecars['1'].region_3_1.playable_payload.exitGates.exit;
        expect(doc.preset_sidecars['1'].region_4_1.playable_payload.exitGates.region_3_1).toEqual(has('key_red'));
        const again = await rebuiltCompile(doc);
        const back = again.regions['1'].region_4_1.exits.find((e) => e.name === 'region_3_1');
        expect(back.access_rule).toEqual(TRUE);
        expect(again.preset_sidecars['1'].region_4_1.playable_payload.exitGates).toEqual({ exit: has('key_blue') });
        expect((await regionRuleAgreement(again, '1', 'region_4_1')).status).toBe(RULE_AGREEMENT.AGREED);
    });
});
