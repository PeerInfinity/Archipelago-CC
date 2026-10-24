/**
 * ⛓⛓ CONCEPT LIBRARY T2c, D3 — **`Re-derive rules ▸` ON A TEXT-ADVENTURE ROOM
 * BEHIND A GATE KEEPS (AND CAN MOVE) ITS BACK-EXIT'S GATE.**
 *
 * The world is `shipped:maze-ta-sphere-mix`, built headless; its TA room
 * `region_4_1` has the forward `exit` (→ region_4_2, `Has(key_blue)`) and the
 * gated back-exit `region_3_1` (`Has(key_red)`, the forward rule of region_3_1's
 * `exit`). Every row goes through a SESSION, as `regionRederive.test.js`'s do.
 *
 * ⛓ MEASURED at `5a086f6`, before T2c: the payload's `exitGates` had no
 * `region_3_1`, so the round trip (`regionRoundTrip.save`) answered `True_` for
 * it — Re-derive on the unedited document FROZE `exit "region_3_1"` ("nothing
 * proves the room wrote them"), and a raw edit of that gate could never move
 * the document's rule.
 */
import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { SHIPPED_PRESETS } from '../procgenPipeline/presetDefs.js';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { rederiveRegionRules } from './regionRederive.js';
import { RULE_AGREEMENT, regionRuleAgreement } from './sidecarRuleAgreement.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const SLOT = '1';
const ROOM = 'region_4_1';
const exitRule = (doc, name) => doc.regions[SLOT][ROOM].exits.find((e) => e.name === name).access_rule;

/** ⛓ A session on `base` with ROOM's `exitGates[exitId]` raw-set to `rule` (the hub's raw save). */
function rawGateEdit(base, exitId, rule) {
    const session = createEditSession(rulesEditAdapter, base);
    const entry = structuredClone(base.preset_sidecars[SLOT][ROOM]);
    entry.playable_payload.exitGates[exitId] = rule;
    const res = session.apply({ op: 'set-region-sidecar', player: SLOT, region: ROOM, entry });
    expect(res.applied, res.description).toBe(true);
    return session;
}
const historyOf = (session, base) => ({ base, ops: session.ops(), doc: session.record() });

describe('T2c D3 — Re-derive rules ▸ on a TA room behind a gate', async () => {
    const state = structuredClone(SHIPPED_PRESETS.find((p) => p.id === 'shipped:maze-ta-sphere-mix').state);
    const DOC = (await runPresetHeadless(buildRunFromState(state))).rulesJson;

    it('premise: the room has the forward gate and the gated back-exit', () => {
        expect(exitRule(DOC, 'exit')).toEqual(has('key_blue'));
        expect(exitRule(DOC, 'region_3_1')).toEqual(has('key_red'));
        expect(DOC.preset_sidecars[SLOT][ROOM].playable_payload.exitGates)
            .toEqual({ exit: has('key_blue'), region_3_1: has('key_red') });
    });

    it('unedited: the back-exit AGREES (at 5a086f6 it was frozen), nothing moves, the payload is kept', async () => {
        const out = await rederiveRegionRules({ base: DOC, ops: [], doc: DOC }, SLOT, ROOM);
        expect(out.error).toBeUndefined();
        expect(out.agreed).toContain('exit "region_3_1"');
        expect(out.frozen).toEqual([]);
        expect(out.moved).toEqual([]);
        expect(out.normalised).toBe(null);
    });

    it('a raw edit of the FORWARD gate moves it, and the back-exit\'s gate is kept (agreed, not frozen)', async () => {
        const session = rawGateEdit(DOC, 'exit', has('key_green'));
        const out = await rederiveRegionRules(historyOf(session, DOC), SLOT, ROOM);
        expect(out.error).toBeUndefined();
        expect(out.moved).toEqual(['exit "exit"']);
        expect(out.frozen).toEqual([]);
        expect(out.agreed).toContain('exit "region_3_1"');
        expect(session.apply(out.op).applied).toBe(true);
        const after = session.record();
        expect(exitRule(after, 'exit')).toEqual(has('key_green'));
        expect(exitRule(after, 'region_3_1')).toEqual(has('key_red'));
        expect((await regionRuleAgreement(after, SLOT, ROOM)).status).toBe(RULE_AGREEMENT.AGREED);
    });

    it('a raw edit of the BACK-exit\'s gate MOVES the document\'s back-exit rule (at 5a086f6 it could only freeze)', async () => {
        const session = rawGateEdit(DOC, 'region_3_1', has('key_yellow'));
        const out = await rederiveRegionRules(historyOf(session, DOC), SLOT, ROOM);
        expect(out.error).toBeUndefined();
        expect(out.moved).toEqual(['exit "region_3_1"']);
        expect(out.frozen).toEqual([]);
        expect(session.apply(out.op).applied).toBe(true);
        const after = session.record();
        expect(exitRule(after, 'region_3_1')).toEqual(has('key_yellow'));
        expect(exitRule(after, 'exit')).toEqual(has('key_blue'));
        expect((await regionRuleAgreement(after, SLOT, ROOM)).status).toBe(RULE_AGREEMENT.AGREED);
    });
});
