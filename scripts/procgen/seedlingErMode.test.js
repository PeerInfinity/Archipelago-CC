/**
 * ⛓ ER E4b — THE `entranceShuffle` MODE OVER THE SEEDLING PLAYTHROUGH, AND THE COMMITTED `seedling_er` PRESET.
 *
 * What is pinned, each with a mutant where a rule could silently loosen:
 *   - the CLASSIFIER (`flashPanel/seedlingEntranceClassifier.js`) over E1's census: 52 stairs in scope, the PIN-CHAIN pair
 *     pinned, 25 pairs / 50 exits shuffled, every other class out of scope by class; a doorway no rule classifies STOPS
 *     (Q5), and an AT-RISK permissive binding pins the stairs that land in it (PIN-PERMISSIVE);
 *   - the MODE's pure parts: an identity layout moves nothing and keeps the atlas; LANDING-SET refuses a layout that
 *     lands on an arrival twice; vanilla through the mode's compile hook is AP_1, byte for byte;
 *   - the PRESET: it passes E2's validator (COUPLED-MIRROR included); every placement names its own AP exit (L40's
 *     stair included — E4a's "shared AP exit" finding was a base-name count: its exit is not one of the `#k` ones);
 *     it is BEATABLE under its own rules; R-A4 still holds (every way into level_20__r1c12 costs the Shield); the
 *     derived-rule table (R-A3) skipped exactly the rows of the exits the shuffle moved, and applying it BY NAME is a
 *     mutant that either throws or lands a vanilla row on a shuffled edge.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const imp = (p) => import(pathToFileURL(path.join(REPO, p)));
const readJson = (p) => JSON.parse(readFileSync(path.join(REPO, p), 'utf8'));

const M = await imp('frontend/modules/procgenPipeline/entranceShuffleSteps.js');
const { classifySeedlingEntrances } = await imp('frontend/modules/flashPanel/seedlingEntranceClassifier.js');
const { entranceRandomizationProblems } = await imp('frontend/modules/procgenCore/entranceRandomizationCheck.js');
const { apExitNamesByEndpoint } = await imp('frontend/modules/procgenPipeline/entranceRandomizationReach.js');
const { stringifyRulesJson } = await imp('frontend/modules/shared/rulesJsonBuilder.js');
const K = await import('./seedlingErDoorCensus.js');
const TBL = await import('./seedlingDerivedRuleTable.js');
const { seedlingEntranceShuffleHooks, sphereZeroAccessible } = await import('./seedlingEntranceShuffleHooks.mjs');
const { SEEDLING_ER_GAME } = await import('./make-seedling-er-preset.mjs');

const ER = readJson('frontend/presets/seedling_er/AP_1/AP_1_rules.json');
const AP1_TEXT = readFileSync(path.join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8');
const AP1 = JSON.parse(AP1_TEXT);
const BLOCK = ER.entrance_randomization['1'];
const R = ER.regions['1'];
const exitsOf = (doc) => Object.entries(doc.regions['1']).flatMap(([region, r]) => (r.exits ?? []).map((e) => ({ region, ...e })));

let hooks;
let env;
beforeAll(async () => {
    hooks = await seedlingEntranceShuffleHooks();
    env = M.newEntranceEnvelope({ atlasId: BLOCK.source.atlas_id, seed: BLOCK.seed });
    await M.runEntranceToStep(env, 'classify', { hooks });
}, 300_000);

describe('the classifier over E1\'s census (⚖ Q1 stairs only, Q2 coupled, Q5 zero unclassified)', () => {
    it('52 stairs in scope; the PIN-CHAIN pair pinned; 25 pairs / 50 exits shuffle; every other class out, by class', () => {
        const c = env.classify;
        expect(c.doorways).toHaveLength(52);
        expect(c.pinned.map((p) => [p.doorway, p.rule])).toEqual([
            ['L0:out_stairsdown_256_272', 'PIN-CHAIN'], ['L2:out_stairsup_48_16', 'PIN-CHAIN (coupled)'],
        ]);
        expect(c.doorways.filter((d) => !d.pinned)).toHaveLength(50);
        expect(c.outOfScope).toEqual({ pit: 12, 'pit/chained': 1, 'teleporter/door': 23, 'teleporter/edge': 191, warp: 2 });
        expect(c.target_group_lookup).toEqual({ stairsdown: ['stairsup'], stairsup: ['stairsdown'] });
        expect(M.classificationProblems(c)).toEqual([]);
    });
    it('Q5 MUTANT: a doorway no rule classifies STOPS the classifier, by name', () => {
        const census = { ...hooks.census, unclassified: [{ from: ['level_9', 'out_x'], to: ['level_8', 'in_y'], why: 'a mutant' }] };
        expect(() => classifySeedlingEntrances(env.pool.atlas, { census, inScopeClasses: K.IN_SCOPE_CLASSES, opposite: K.OPPOSITE }))
            .toThrow(/Q5 STOP — 1 doorway\(s\).*level_9\/out_x -> level_8\/in_y: a mutant/);
    });
    it('PIN-PERMISSIVE: today no permissive binding is AT RISK (E1 (D)); a mutant one pins the stairs landing in it, with the reverse', () => {
        expect(hooks.census.permissive.filter((p) => p.atRisk)).toEqual([]);
        // L51's stairsup lands in L53 beside L53's stairsdown (r9c2's sub-region): mark a binding there AT RISK.
        const d = env.classify.doorways.find((x) => x.id === 'L53:out_stairsdown_32_144');
        const sub = env.pool.atlas.regions.find((r) => r.region_id === d.from[0]).exits.find((e) => e.exit_id === d.from[1]).sub_region;
        const census = { ...hooks.census, permissive: [{ binding: 'level_53/mutant', level: 53, subRegion: sub, atRisk: true }] };
        const c = classifySeedlingEntrances(env.pool.atlas, { census, inScopeClasses: K.IN_SCOPE_CLASSES, opposite: K.OPPOSITE });
        expect(c.pinned.filter((p) => p.rule.startsWith('PIN-PERMISSIVE')).map((p) => p.doorway).sort())
            .toEqual(['L51:out_stairsup_176_144', 'L53:out_stairsdown_32_144']);
    });
    it('the generic shape check refuses a pair split by a pin (Q2)', () => {
        const c = structuredClone(env.classify);
        c.doorways.find((d) => d.id === 'L4:out_stairsdown_64_16').pinned = true;
        c.pinned.push({ doorway: 'L4:out_stairsdown_64_16', rule: 'MUTANT', why: 'a mutant' });
        expect(M.classificationProblems(c)).toEqual(['L5:out_stairsup_80_16 moves but its reverse L4:out_stairsdown_64_16 is pinned (⚖ Q2: a pair moves together)']);
    });
});

describe('the mode\'s pure parts', () => {
    it('an identity layout (every stair at its own reverse) moves nothing and keeps the atlas id', () => {
        const ids = env.classify.doorways.filter((d) => !d.pinned).map((d) => ({ exit: d.id, target: d.reverse }));
        const { atlas, moved } = M.applyPlacements(env.pool.atlas, env.classify, ids);
        expect(moved.size).toBe(0);
        expect(atlas).toEqual(env.pool.atlas);
    });
    it('LANDING-SET: a coupled layout permutes the arrivals; a mutant landing two stairs on one arrival is refused', () => {
        const { atlas } = M.applyPlacements(env.pool.atlas, env.classify, BLOCK_BY_ID());
        expect(M.landingSetProblems(env.pool.atlas, atlas)).toEqual([]);
        const bad = structuredClone(atlas);
        const [a, b] = bad.vanilla_layout.connections.filter((c) => /out_stairs/.test(c.from[1]));
        a.to = [...b.to];
        expect(M.landingSetProblems(env.pool.atlas, bad).length).toBe(2);
    });
    it('vanilla through the mode\'s compile hook is AP_1, byte for byte', async () => {
        const { rules } = await hooks.compile(env.pool.atlas, { moved: new Set() });
        expect(stringifyRulesJson(rules) === AP1_TEXT).toBe(true);
    }, 120_000);
});

/** The committed placements, by doorway id (the preset names AP exits; map them back through its own sidecars). */
function BLOCK_BY_ID() {
    const names = apExitNamesByEndpoint(ER);
    const idOf = new Map();
    for (const d of env.classify.doorways) idOf.set(names.get(`${d.from[0]}/${d.from[1]}`), d.id);
    return BLOCK.placements.map((p) => ({ exit: idOf.get(p.exit), target: idOf.get(p.target) }));
}

describe('the committed seedling_er preset', () => {
    it('is the mode\'s: seed 1, 50 placements over the 25 pairs, coupled, the source the committed atlas', () => {
        expect(BLOCK.algorithm).toBe('ger');
        expect(BLOCK.coupled).toBe(true);
        expect(BLOCK.seed).toBe(1);
        expect(BLOCK.source.atlas_id).toBe(readJson('frontend/modules/flashPanel/atlases/seedling-playthrough.json').atlas_id);
        expect(BLOCK.placements).toHaveLength(50);
        expect(BLOCK_BY_ID().every((p) => p.exit && p.target)).toBe(true);
    });
    it('passes E2\'s validator, COUPLED-MIRROR included; a dropped mirror row is refused', () => {
        expect(entranceRandomizationProblems(ER, '1')).toEqual([]);
        const m = structuredClone(ER);
        m.entrance_randomization['1'].placements.pop();
        expect(entranceRandomizationProblems(m, '1').join('\n')).toMatch(/under a coupled shuffle, but no row places/);
    });
    it('er rides on the 52 classified exits: 50 shuffled, the PIN-CHAIN pair not', () => {
        const er = exitsOf(ER).filter((e) => e.er);
        expect(er).toHaveLength(52);
        expect(er.filter((e) => e.er.shuffle)).toHaveLength(50);
        expect(er.filter((e) => !e.er.shuffle).map((e) => e.name).sort()).toEqual([
            'level_0__r7c6 -> level_2', 'level_2 -> level_0__r7c6',
        ].sort());
    });
    it('L40\'s stair has its own AP exit (E4a\'s FINDING resolved: no split needed; its exit is not one of the twelve `#k` teleporters)', () => {
        const nameOf = (doc) => apExitNamesByEndpoint(doc).get('level_40/out_stairsdown_320_576');
        expect(nameOf(AP1)).toBe('level_40__r23c29 -> level_43__r13c7');
        // AP_1: the stair is the base name, the twelve L43 edge teleporters are `#2`..`#13` — thirteen distinct AP exits.
        const carriers = [...apExitNamesByEndpoint(AP1).entries()].filter(([, n]) => n?.startsWith('level_40__r23c29 -> level_43__r13c7'));
        expect(new Set(carriers.map(([, n]) => n)).size).toBe(carriers.length);
        expect(carriers).toHaveLength(13);
        // the preset names the stair by its own (shuffled) AP exit, in a placement
        expect(BLOCK.placements.some((p) => p.exit === nameOf(ER))).toBe(true);
    });
    it('is BEATABLE under its own compiled rules (every location and the goal), and sphere 0 is not smaller than vanilla\'s', () => {
        const b = M.beatability(ER);
        expect(b.ok).toBe(true);
        expect(sphereZeroAccessible(b.log).length).toBeGreaterThanOrEqual(sphereZeroAccessible(M.beatability(AP1).log).length);
    });
    it('R-A4 holds on the shuffled doc: every way into level_20__r1c12 is L20\'s own and costs the Shield', () => {
        const SHIELD = 'Progressive Shield';
        const requires = (rule) => JSON.stringify(rule ?? {}).includes(JSON.stringify(SHIELD));
        const entries = exitsOf(ER).filter((e) => e.connected_region === 'level_20__r1c12');
        expect(entries.map((e) => e.region)).toEqual(['level_20__r1c4']);
        expect(entries.every((e) => requires(e.access_rule))).toBe(true);
    });
});

describe('R-A3: the derived-rule table on a shuffled doc', () => {
    let out;
    let moved;
    beforeAll(async () => {
        ({ moved } = M.applyPlacements(env.pool.atlas, env.classify, BLOCK_BY_ID()));
        const { atlas } = M.applyPlacements(env.pool.atlas, env.classify, BLOCK_BY_ID());
        out = await hooks.compile(atlas, { moved, authored: env.pool.atlas, gameName: SEEDLING_ER_GAME });
    }, 120_000);
    it('the play-time references name the AUTHORED atlas\'s rooms; the provenance names the shuffled graph', () => {
        const authored = env.pool.atlas.atlas_id;
        expect(ER.region_atlas['1'].atlas_id).toBe(authored);
        expect([...new Set(Object.values(ER.preset_sidecars['1']).map((sc) => sc.playable_payload.atlas_ref))]).toEqual([authored]);
        expect(ER.provenance['1'].atlas_id).not.toBe(authored);
        expect(ER.provenance['1'].atlas_id).toMatch(/^seedling-[0-9a-f]{8}$/);
        expect(ER.game_name).toBe(SEEDLING_ER_GAME);
    });
    it('the mode\'s compile is the committed preset (before its er annotation)', () => {
        const strip = (doc) => {
            const d = structuredClone(doc);
            delete d.entrance_randomization;
            for (const r of Object.values(d.regions['1'])) for (const e of r.exits ?? []) delete e.er;
            return stringifyRulesJson(d);
        };
        expect(strip(out.rules) === strip(ER)).toBe(true);
    });
    it('skipped BY NAME exactly the table rows whose atlas exit the shuffle moved; applied the rest by endpoint', () => {
        const table = TBL.readDerivedRuleTable();
        const expected = table.rows.filter((r) => r.kind === 'exit' && moved.has(`${r.atlas.region_id}/${r.atlas.exit_id}`)).map((r) => r.key).sort();
        expect(expected.length).toBeGreaterThan(0);
        expect(out.override.skipped.map((s) => s.key).sort()).toEqual(expected);
        expect(out.override.applied).toBe(table.rows.length - expected.length);
        expect(out.override.composedDisagrees).toEqual([]);
    });
    it('MUTANT: the table applied BY NAME on the shuffled doc refuses or puts a vanilla row on a shuffled edge', () => {
        const doc = structuredClone(ER);
        const table = TBL.readDerivedRuleTable();
        const names = apExitNamesByEndpoint(doc);
        // a row whose vanilla name the shuffled doc still holds, but on ANOTHER endpoint (or holds no longer)
        const wrong = table.rows.filter((r) => r.kind === 'exit').filter((r) => {
            const now = names.get(`${r.atlas.region_id}/${r.atlas.exit_id}`);
            return now !== r.name;
        });
        expect(wrong.length).toBeGreaterThan(0);
        let threw = null;
        try { TBL.applyDerivedRuleTable(doc, table); } catch (e) { threw = e.message; }
        const hijacked = wrong.filter((r) => (doc.regions['1'][r.region]?.exits ?? []).some((e) => e.name === r.name));
        expect(threw !== null || hijacked.length > 0).toBe(true);
    });
});

/**
 * E3's DEAD-END MUTANT ON THE REAL STAIRS GRAPH (E3 found `deadEndPreference: false` invisible on synthetic graphs: the
 * speculative sweep covers for it). MEASURED here over the Seedling binding (AP_1 = the vanilla compile), 40 seeds:
 *   - the mutant is LIVE: it places differently on nearly every seed;
 *   - it is INVISIBLE ON CORRECTNESS: no accepted layout, mutant or not, loses a region or location the identity reaches;
 *   - it is VISIBLE ONLY AS A REFUSAL RATE under the mode's 'placed' sweep (more draws refused — the speculative sweep
 *     catches the capped graph and GER refuses), and not at all under GER's all-state ('events').
 * The refusal counts are a MEASUREMENT of the committed rules: a rules move re-records them (re-run this row).
 */
describe('E3\'s dead-end mutant over the real Seedling stairs graph (40 seeds)', () => {
    const E = { mod: null };
    const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
    const measure = (sweep, deadEndPreference) => {
        const b = M.shuffleBinding(AP1, env.classify, { sweep });
        const byName = new Map(b.exits.map((x) => [x.name, x]));
        const idToName = new Map([...b.byName.values()].map((r) => [r.doorway.id, r.name]));
        const identity = b.reach(b.exits.map((x) => ({ exit: x.name, from: x.region, to: byName.get(idToName.get(b.byName.get(x.name).doorway.reverse)).region })));
        const out = { refused: 0, incomplete: 0, placements: [] };
        for (const s of SEEDS) {
            try {
                const r = E.mod.randomizeEntrances({
                    exits: b.exits, targets: b.targets, fixedEdges: b.fixedEdges, progressionRegions: b.progressionRegions, reach: b.reach,
                    rng: E.rng(s), coupled: true, targetGroupLookup: b.lookup, guards: { deadEndPreference },
                });
                const after = b.reach(r.placements.map((p) => ({ exit: p.exit, from: byName.get(p.exit).region, to: byName.get(p.target).region })));
                if ([...identity.regions].some((x) => !after.regions.has(x)) || [...identity.locations].some((x) => !after.locations.has(x))) out.incomplete += 1;
                out.placements.push(JSON.stringify(r.placements));
            } catch (err) {
                if (!(err instanceof E.mod.EntranceRandomizationError)) throw err;
                out.refused += 1;
                out.placements.push('refused');
            }
        }
        return out;
    };
    beforeAll(async () => {
        E.mod = await imp('frontend/modules/procgenCore/entranceRandomizer.js');
        E.rng = (await imp('frontend/modules/mazeRoom/procgenRng.js')).rngFor;
    });
    for (const [sweep, refused] of [['placed', { on: 7, off: 9 }], ['events', { on: 0, off: 0 }]]) {
        it(`sweep '${sweep}': live, never incomplete, refusals ${refused.on} → ${refused.off}`, () => {
            const on = measure(sweep, true);
            const off = measure(sweep, false);
            expect(on.placements.filter((p, i) => p !== off.placements[i]).length).toBeGreaterThanOrEqual(35);
            expect([on.incomplete, off.incomplete]).toEqual([0, 0]);
            expect([on.refused, off.refused]).toEqual([refused.on, refused.off]);
        }, 120_000);
    }
});
