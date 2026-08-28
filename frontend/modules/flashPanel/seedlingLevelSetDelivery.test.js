// Unit tests for H8 — the panel's own level-set delivery
// (EDITOR INTEGRATION §17.1.4; plan §17.2).
//
// ⛓ THE FAKE IS THE ARTIFACT, NOT THE SET. Every row drives the REAL rewritten
// vanilla set through the REAL chunk planner; what is faked is `bot()`, because
// the only thing this module owns is the order of the calls, the readback and
// the refusals. A row that also faked the set would be testing a mock against a
// mock.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    DELIVERY_STATES, READBACK_FIELDS, SeedlingLevelSetDelivery, readbackDisagreement,
} from './seedlingLevelSetDelivery.js';
import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import {
    buildPlacementTable, rewriteRecordSet,
} from '../seedlingDemo/apPlacementRewriter.js';
import { apMappingInvalidation, vanillaRecordSet } from '../seedlingDemo/levelSetExporter.js';
import {
    MAX_CHUNK_BYTES, MAX_ROOMS_PER_CHUNK, planLevelSetChunks,
} from '../seedlingDemo/levelSetValidator.js';
import { levelSetDisagreement } from '../seedlingDemo/watchWasm.js';
import { R7_GOAL_LEDGER } from '../seedlingDemo/r7Acceptance.js';

const json = (name, base) => JSON.parse(readFileSync(
    fileURLToPath(new URL(name, base)), 'utf8'));
const MAP = json('../flashPanel/atlases/seedling-map.json', import.meta.url);
const EMBED = json('../seedlingDemo/fixtures/seedling-vanilla-set.json', import.meta.url);
const RULES = json('../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url);
const SELF = 1;

function rewritten() {
    const [slot] = Object.keys(RULES.regions);
    const placed = new Map();
    for (const region of Object.values(RULES.regions[slot])) {
        for (const loc of region.locations ?? []) {
            placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
        }
    }
    const { table } = buildPlacementTable({
        locationItemOf: (n) => placed.get(n) ?? null,
        ledger: R7_GOAL_LEDGER, rooms: MAP.levels, selfPlayer: SELF,
    });
    const { set } = rewriteRecordSet(vanillaRecordSet(EMBED, MAP).set, table);
    return { set, invalidation: apMappingInvalidation(set) };
}

/** A `bot()` that behaves like the artifact: it assembles what it is sent and
 *  answers `botLevelSet` from what it assembled. */
function fakeBot(set, fail = null) {
    const calls = [];
    const mounted = { rooms: [], setId: null, start: null };
    const seen = new Set();
    const bot = (name, arg) => {
        calls.push({ name, bytes: arg?.length ?? 0 });
        if (fail && fail.on === name && fail.at === calls.filter((c) => c.name === name).length) {
            if (fail.throw) throw new Error(fail.throw);
            return fail.say;
        }
        if (name === 'botLoadLevels') {
            const chunk = JSON.parse(arg);
            mounted.setId = chunk.set_id;
            if (chunk.set) mounted.start = chunk.set.start;
            mounted.rooms.push(...chunk.rooms);
            seen.add(chunk.chunk_index);
            // ⛔ THE RECEIVER'S REAL ANSWERS. `Bot.botLoadLevels` returns
            // "pending" until the delivery is COMPLETE and "ok" on the chunk
            // that completes it — measured against p4c, and the reason the
            // first browser run of this slice refused chunk 1 of 9.
            return seen.size < chunk.chunk_count ? 'pending' : 'ok';
        }
        if (name === 'botLevelSet') {
            return JSON.stringify({
                active: mounted.setId,
                table_levels: mounted.rooms.length,
                start_level: mounted.start?.level ?? null,
            });
        }
        return null;
    };
    bot.calls = calls;
    bot.mounted = mounted;
    bot.set = set;
    return bot;
}

const deliveryFor = (extra = {}) => new SeedlingLevelSetDelivery({
    planChunks: planLevelSetChunks, ...extra,
});

describe('readbackDisagreement — ONE implementation, hoisted (M1)', () => {
    /**
     * ⛔ THE PIN WAS RE-AIMED, NOT DELETED. H7/H8 restated the comparison here
     * and pinned it equal to `watchWasm`'s over a battery of disagreeing pairs,
     * because importing `watchWasm.js` costs the bundle 15 files / 1,054,916 B.
     * M1 hoisted the function into `seedlingDemo/levelSetDisagreement.js`
     * (closure: ONE file, 2,708 B) and BOTH sides now import it — so asking
     * whether they agree is a FIXED POINT and cannot fail. What still has
     * content is the IDENTITY, which is what would break if someone
     * re-restated one of them, plus the behaviour of the one implementation.
     */
    it('IS `watchWasm.levelSetDisagreement` — the same function object, not a copy', () => {
        expect(readbackDisagreement).toBe(levelSetDisagreement);
    });

    it(`compares ${READBACK_FIELDS.length} fields and names the one that disagrees`, () => {
        const sent = { set_id: 'seedling-ap-record-abcd1234', rooms: new Array(116),
            start: { level: 0 } };
        const cases = [
            null,
            { error: 'boom' },
            { active: 'seedling-vanilla-record-1040ace1', table_levels: 116, start_level: 0 },
            { active: sent.set_id, table_levels: 0, start_level: 0 },
            { active: sent.set_id, table_levels: 116, start_level: 7 },
            { active: sent.set_id, table_levels: 116, start_level: 0 },
        ];
        const said = cases.map((back) => readbackDisagreement(sent, back));
        expect(said[0]).toMatch(/answered nothing/);
        expect(said[1]).toMatch(/level-set error/);
        expect(said[2]).toMatch(/^active seedling-vanilla-record-1040ace1 ≠ /);
        expect(said[3]).toBe('table_levels 0 ≠ 116');
        expect(said[4]).toBe('start_level 7 ≠ 0');
        expect(said[5]).toBeNull();
    });
});

describe('SeedlingLevelSetDelivery — the state machine', () => {
    it('starts idle, and an idle delivery is a SUCCESS that sends nothing', () => {
        const d = deliveryFor();
        expect(d.state).toBe('idle');
        expect(DELIVERY_STATES[0]).toBe('idle');
        const bot = fakeBot(null);
        d.attachBot(bot);
        expect(d.deliver()).toMatchObject({ ok: true, state: 'idle', chunks: 0 });
        expect(bot.calls).toEqual([]);
    });

    it('waits for BOTH the placement and the game', () => {
        const { set, invalidation } = rewritten();
        const d = deliveryFor();
        expect(d.ready()).toBe(false);          // no set, no bot
        d.arm(set, invalidation);
        expect(d.ready()).toBe(false);          // set, no bot
        expect(d.deliver()).toMatchObject({ ok: false });
        expect(d.deliver().why).toMatch(/bot callbacks are not up yet/);
        expect(d.state).toBe('armed');          // and it stays armed
        d.attachBot(fakeBot(set));
        expect(d.ready()).toBe(true);
        expect(d.deliver().ok).toBe(true);
    });

    it('sends every chunk IN ORDER, then reads the set back and diffs it', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const result = d.deliver();
        expect(result).toMatchObject({ ok: true, state: 'delivered', why: null });

        const { chunks } = planLevelSetChunks(set);
        expect(result.chunks).toBe(chunks.length);
        // the call ORDER: N loads, then exactly one readback, and nothing else
        expect(bot.calls.map((c) => c.name))
            .toEqual([...chunks.map(() => 'botLoadLevels'), 'botLevelSet']);
        // and what mounted is what was sent
        expect(bot.mounted.rooms).toHaveLength(set.rooms.length);
        expect(bot.mounted.setId).toBe(set.set_id);
        for (const chunk of chunks) {
            expect(chunk.rooms.length).toBeLessThanOrEqual(MAX_ROOMS_PER_CHUNK);
            expect(chunk.rooms.reduce((n, r) => n + JSON.stringify(r).length, 0))
                .toBeLessThanOrEqual(MAX_CHUNK_BYTES);
        }
    });

    it('is IDEMPOTENT — a second deliver() sends nothing more', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const first = d.deliver();
        const before = bot.calls.length;
        expect(d.deliver()).toBe(first);
        expect(bot.calls).toHaveLength(before);
        expect(d.stats.attempts).toBe(1);
    });

    it('REFUSES when the artifact rejects a chunk, and names which one', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set, { on: 'botLoadLevels', at: 3, say: 'chunk too large' });
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const result = d.deliver();
        expect(result.ok).toBe(false);
        expect(d.state).toBe('refused');
        expect(result.why).toMatch(/botLoadLevels answered "chunk too large" to chunk 3\/\d+/);
        // ⛔ AND IT STOPPED: no readback is taken on a set that never landed.
        expect(bot.calls.filter((c) => c.name === 'botLevelSet')).toHaveLength(0);
    });

    it('⛔ REFUSES an EARLY `ok`: a receiver that mounted before the sender finished', () => {
        // ⛓ `pending` is the SUCCESS answer for every chunk but the last, and
        // `ok` means "the set is now mounted". An `ok` on chunk 1 of 9 says the
        // receiver mounted eight rooms and called it the set.
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set, { on: 'botLoadLevels', at: 1, say: 'ok' });
        const result = deliveryFor({ bot }).arm(set, invalidation).deliver();
        expect(result.ok).toBe(false);
        expect(result.why).toMatch(/the non-final chunk of a delivery must answer "pending"/);
        expect(result.why).toMatch(/an early `ok` means the receiver mounted a set/);
    });

    it('⛔ REFUSES a `pending` on the LAST chunk — the set never mounted', () => {
        const { set, invalidation } = rewritten();
        const n = planLevelSetChunks(set).chunks.length;
        const bot = fakeBot(set, { on: 'botLoadLevels', at: n, say: 'pending' });
        const result = deliveryFor({ bot }).arm(set, invalidation).deliver();
        expect(result.ok).toBe(false);
        expect(result.why).toMatch(new RegExp(`chunk ${n}/${n}, and the LAST chunk`));
    });

    it('REFUSES when the readback disagrees — the mounted set is not the sent set', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const real = bot.mounted;
        const lying = (name, arg) => (name === 'botLevelSet'
            ? JSON.stringify({ active: 'seedling-vanilla-record-1040ace1',
                table_levels: real.rooms.length, start_level: 0 })
            : bot(name, arg));
        const d = deliveryFor({ bot: lying }).arm(set, invalidation);
        const result = d.deliver();
        expect(result.ok).toBe(false);
        expect(result.why).toMatch(/the set that mounted is not the set that was sent — active /);
        expect(result.readback.active).toBe('seedling-vanilla-record-1040ace1');
    });

    it('REFUSES a partial delivery: a set whose readback is short by one room', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const short = (name, arg) => {
            const said = bot(name, arg);
            if (name !== 'botLevelSet') return said;
            const back = JSON.parse(said);
            return JSON.stringify({ ...back, table_levels: back.table_levels - 1 });
        };
        const result = deliveryFor({ bot: short }).arm(set, invalidation).deliver();
        expect(result.ok).toBe(false);
        expect(result.why).toMatch(/table_levels \d+ ≠ \d+/);
    });

    it('REFUSES a set with no `apMappingInvalidation` companion, or one that is another set\'s', () => {
        const { set, invalidation } = rewritten();
        expect(() => deliveryFor().arm(set, null)).toThrow(/needs this set's OWN/);
        expect(() => deliveryFor().arm(set, { ...invalidation, set_id: 'something-else' }))
            .toThrow(/needs this set's OWN/);
        expect(() => deliveryFor().arm(set, { ...invalidation, content_hash: 'deadbeef' }))
            .toThrow(/needs this set's OWN/);
        // the control: the set's own companion arms clean
        expect(deliveryFor().arm(set, invalidation).state).toBe('armed');
    });

    it('REFUSES to construct without the injected chunk planner', () => {
        expect(() => new SeedlingLevelSetDelivery({})).toThrow(/`planChunks` is required/);
    });

    it('REFUSES an oversized room rather than killing the arena mid-call', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const d = new SeedlingLevelSetDelivery({
            bot,
            planChunks: (s) => ({ ...planLevelSetChunks(s),
                oversized: [{ id: 40, name: 'Dungeon4_2', bytes: 999999 }] }),
        }).arm(set, invalidation);
        expect(d.deliver().why).toMatch(/exceed the proven chunk envelope: Dungeon4_2 999999B/);
        expect(bot.calls).toEqual([]);
    });
});

describe('the ordering gate — the set goes in BEFORE the first region load', () => {
    let logged = [];
    const glueWith = (delivery) => {
        logged = [];
        const panel = { _panelLog: (m) => logged.push(String(m)) };
        const glue = new SeedlingRegionGlue({
            eventBus: null, getDispatcher: () => null, loadRegionEvent: 'flashSeedling:loadRegion',
            getPanel: () => panel,
        });
        return glue.setDelivery(delivery);
    };

    it('a loadRegion arriving while the set is armed DELIVERS FIRST, then loads', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const glue = glueWith(d);
        expect(d.state).toBe('armed');
        // ⛔⛔ THE ORDER IS THE CLAIM, AND IT IS OBSERVED ON ONE TIMELINE. A row
        // that only checked "the set is delivered" passes on a glue that
        // delivers AFTER the binding has already resolved the arrival.
        const timeline = [];
        const realBot = d.bot;
        d.attachBot((name, arg) => { timeline.push(name); return realBot(name, arg); });
        const realLoad = glue.binding.onLoadRegion.bind(glue.binding);
        glue.binding.onLoadRegion = (p) => { timeline.push('onLoadRegion'); return realLoad(p); };
        glue.handleLoadRegion({ regionId: 'level_0' });
        expect(d.state).toBe('delivered');
        expect(glue.stats.setDeliveries).toBe(1);
        expect(glue.stats.loads).toBe(1);
        expect(timeline.at(-1)).toBe('onLoadRegion');
        expect(timeline.at(-2)).toBe('botLevelSet');
        expect(timeline.indexOf('onLoadRegion')).toBe(timeline.length - 1);
        expect(timeline.filter((t) => t === 'botLoadLevels'))
            .toHaveLength(planLevelSetChunks(set).chunks.length);
        expect(bot.calls.at(-1).name).toBe('botLevelSet');
    });

    it('a REFUSED delivery does not let the region load REACH THE BINDING', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set, { on: 'botLoadLevels', at: 1, say: 'error:nope' });
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const glue = glueWith(d);
        // ⛔ The observation is DIRECT: count the calls into the state machine.
        // "no teleport happened" would also be true of a glue with no adapter.
        let reached = 0;
        const real = glue.binding.onLoadRegion.bind(glue.binding);
        glue.binding.onLoadRegion = (p) => { reached += 1; return real(p); };
        glue.handleLoadRegion({ regionId: 'level_0' });
        expect(d.state).toBe('refused');
        expect(reached).toBe(0);
        expect(glue.stats.setDeliveries).toBe(0);
        expect(logged.some((m) => /ap placement/.test(m))).toBe(true);
    });

    it('a glue with NO delivery reaches the binding and says nothing about placement', () => {
        const glue = glueWith(null);
        let reached = 0;
        const real = glue.binding.onLoadRegion.bind(glue.binding);
        glue.binding.onLoadRegion = (p) => { reached += 1; return real(p); };
        glue.handleLoadRegion({ regionId: 'level_0' });
        expect(reached).toBe(1);
        expect(glue.stats.loads).toBe(1);
        expect(glue.stats.setDeliveries).toBe(0);
        expect(logged.some((m) => /ap placement/.test(m))).toBe(false);
    });

    it('the gate is idempotent across many loads — the set is delivered ONCE', () => {
        const { set, invalidation } = rewritten();
        const bot = fakeBot(set);
        const d = deliveryFor({ bot }).arm(set, invalidation);
        const glue = glueWith(d);
        for (let i = 0; i < 5; i += 1) glue.handleLoadRegion({ regionId: `level_${i}` });
        expect(d.stats.attempts).toBe(1);
        expect(glue.stats.setDeliveries).toBe(1);
        expect(glue.stats.loads).toBe(5);
        expect(bot.calls.filter((c) => c.name === 'botLevelSet')).toHaveLength(1);
    });
});
