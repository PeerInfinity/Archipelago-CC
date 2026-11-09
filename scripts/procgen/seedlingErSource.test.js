/**
 * ⛓ ER E4c — THE `seedling_er` WORLD AS A SOURCE, AND THE ENTRANCE MODE'S ENVELOPE.
 *
 * What is pinned, each with a mutant where a rule could silently loosen:
 *   - the SHUFFLED ATLAS (`make-seedling-er-preset.mjs` `buildSeedlingErSource`): it compiles to the committed preset, byte
 *     for byte; its moved departures are the preset's (`movedDepartures` = `applyPlacements`'s `moved`), and the authored
 *     atlas moves none;
 *   - the MAZE PRODUCER'S SOURCE (`make-seedling-playthrough-maze.mjs` `buildPlaythroughMaze({source})`): the ER maze compile
 *     skips BY NAME exactly the derived-rule rows of the moved exits (the rules producer's own set on the same doc); its AP
 *     exit names per atlas endpoint are the ER rules preset's (both compile the same graph); a `--source` run never names the
 *     vanilla preset's file;
 *   - ONLY THE CONNECTIONS MAY DIFFER (design review of E4c): the exempt fields are exactly what `applyPlacements` and its
 *     restamp change, and each other difference (an edited, added, removed or reordered room, a connection removed or doubled
 *     or changed beyond its landing, any other field) is a named `SourceRoomsError` mutant;
 *   - `apExitNamesByEndpoint` over a MAZE doc: keyed by `atlas_exit_id`, the internal crossings' synthetic ids left out by
 *     `endpoints` (without it the maze doc's `cross_*` ids collide and it throws);
 *   - the ENVELOPE: serialized at every step it validates against the committed schema (`_binding` never written); a run
 *     serialized after `shuffle` and resumed on COLD hooks compiles the committed preset and never calls pool, classify or
 *     the vanilla compile; an envelope of PUBLIC fields only, another mode's, or one whose atlas is not this tree's build,
 *     is refused by name.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const imp = (p) => import(pathToFileURL(path.join(REPO, p)));
const readJson = (p) => JSON.parse(readFileSync(path.join(REPO, p), 'utf8'));

const M = await imp('frontend/modules/procgenPipeline/entranceShuffleSteps.js');
const { apExitNamesByEndpoint } = await imp('frontend/modules/procgenPipeline/entranceRandomizationReach.js');
const { stringifyRulesJson } = await imp('frontend/modules/shared/rulesJsonBuilder.js');
const { EnvelopeStampError } = await imp('frontend/modules/procgenPipeline/steppedPipeline.js');
const { publicEnvelope, parseEntranceStepArgs } = await import('./entrance-step.js');
const TBL = await import('./seedlingDerivedRuleTable.js');
const MAZE = await import('./make-seedling-playthrough-maze.mjs');
const { seedlingEntranceShuffleHooks } = await import('./seedlingEntranceShuffleHooks.mjs');
const { seedlingErState, SEEDLING_ER_PRESET } = await import('./make-seedling-er-preset.mjs');
const { buildEntranceRun } = await imp('frontend/modules/procgenPipeline/presetRun.js');

const ER_TEXT = readFileSync(SEEDLING_ER_PRESET, 'utf8');
const ER = JSON.parse(ER_TEXT);
const SCHEMA = readJson('frontend/schema/envelopes/entrance-envelope.schema.json');
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(SCHEMA);
const roundTrip = (env) => M.deserializeEntranceEnvelope(JSON.parse(JSON.stringify(M.serializeEntranceEnvelope(env))));

let hooks;
let env;
const snapshots = {};
beforeAll(async () => {
    hooks = await seedlingEntranceShuffleHooks();
    env = M.newEntranceEnvelope(buildEntranceRun(seedlingErState()));
    for (const step of M.ENTRANCE_STEPS) {
        // eslint-disable-next-line no-await-in-loop
        await M.runEntranceStep(step, env, { hooks });
        snapshots[step] = JSON.parse(JSON.stringify(M.serializeEntranceEnvelope(env)));
    }
}, 300_000);

describe('the shuffled atlas the preset compiles', () => {
    it('the fresh run compiles the committed preset, byte for byte', () => {
        expect(stringifyRulesJson(env.compile.rulesJson) === ER_TEXT).toBe(true);
    });
    it('movedDepartures is applyPlacements\'s moved set; the authored atlas moves none; an unknown departure is refused', () => {
        const { atlas, moved } = M.applyPlacements(env.pool.atlas, env.classify, env.shuffle.placements);
        expect(MAZE.movedDepartures(atlas, env.pool.atlas)).toEqual([...moved].sort());
        expect(MAZE.movedDepartures(env.pool.atlas, env.pool.atlas)).toEqual([]);
        expect(env.compile.moved).toEqual([...moved].sort());
        const bad = structuredClone(atlas);
        const [first] = bad.vanilla_layout.connections;
        bad.vanilla_layout.connections.push({ ...first, from: [first.from[0], 'out_mutant'] });
        expect(() => MAZE.movedDepartures(bad, env.pool.atlas)).toThrow(new RegExp(`departure ${first.from[0]}/out_mutant is in no connection`));
    });
});

describe('a source carries its rooms: ONLY the connections may differ (SourceRoomsError)', () => {
    let atlas;
    let rooms;
    const conn = (doc) => doc.vanilla_layout.connections;
    const end = (c) => `${c.from[0]}/${c.from[1]}`;
    // each mutant: one edit of a copy of the shuffled atlas, and the named problem it must raise
    const MUTANTS = [
        ['an edited room', (d) => { d.regions[0].exits = d.regions[0].exits.slice(1); }, (d) => `room ${d.regions[0].region_id} differs`],
        ['a room removed', (d) => { d.regions.pop(); }, (_d, r) => `room ${r.regions.at(-1).region_id} is missing`],
        ['a room added', (d) => { d.regions.push({ ...structuredClone(d.regions[0]), region_id: 'mutant_room' }); }, () => 'room mutant_room is not in the rooms atlas'],
        ['the rooms reordered', (d) => { d.regions.reverse(); }, () => 'the rooms are in another order'],
        ['a connection removed', (d) => { conn(d).pop(); }, (_d, r) => `departure ${end(conn(r).at(-1))} is missing (its connection was removed)`],
        ['a departure doubled', (d) => { conn(d).push(structuredClone(conn(d)[0])); }, (d) => `departure ${end(conn(d)[0])} has two connections`],
        ['a connection changed beyond its landing', (d) => { conn(d)[0].one_way = !conn(d)[0].one_way; }, (d) => `connection ${end(conn(d)[0])} differs in more than its landing`],
        ['the start moved', (d) => { d.vanilla_layout.start_region = d.regions.at(-1).region_id; }, () => 'field vanilla_layout.start_region differs'],
        ['a provenance field other than the content hash', (d) => { d.provenance.generator = 'mutant'; }, () => 'field provenance.generator differs'],
        ['a top-level field', (d) => { d.tile_space = { ...d.tile_space, mutant: 1 }; }, () => 'field tile_space differs'],
    ];
    beforeAll(() => {
        ({ atlas } = M.applyPlacements(env.pool.atlas, env.classify, env.shuffle.placements));
        rooms = env.pool.atlas;
    });
    it('the exempt fields are exactly what applyPlacements and its restamp change: the shuffled atlas passes', () => {
        expect(MAZE.sourceRoomsProblems(atlas, rooms)).toEqual([]);
        // derived, not typed: every field the producer's output differs in is exempt
        expect(atlas.atlas_id).not.toBe(rooms.atlas_id);
        expect(atlas.provenance.content_hash).not.toBe(rooms.provenance.content_hash);
        const relanded = conn(atlas).filter((c, i) => JSON.stringify(c.to) !== JSON.stringify(conn(rooms)[i].to));
        expect(relanded.length).toBeGreaterThan(0);
        const back = structuredClone(atlas);
        for (const p of MAZE.SOURCE_EXEMPT.identity) {
            const ks = p.split('.');
            ks.slice(0, -1).reduce((o, k) => o[k], back)[ks.at(-1)] = ks.reduce((o, k) => o[k], rooms);
        }
        conn(back).forEach((c, i) => { for (const f of MAZE.SOURCE_EXEMPT.connection) c[f] = conn(rooms)[i][f]; });
        expect(JSON.stringify(back)).toBe(JSON.stringify(rooms));
    });
    for (const [label, mutate, problem] of MUTANTS) {
        it(`MUTANT: ${label} is refused by name`, () => {
            const bad = structuredClone(atlas);
            mutate(bad);
            const want = problem(bad, rooms);
            expect(MAZE.sourceRoomsProblems(bad, rooms)).toContain(want);
            let err;
            try { MAZE.movedDepartures(bad, rooms); } catch (e) { err = e; }
            expect(err).toBeInstanceOf(MAZE.SourceRoomsError);
            expect(err.problems).toContain(want);
        });
    }
    it('MUTANT: buildPlaythroughMaze refuses an edited source before it compiles', () => {
        const bad = structuredClone(atlas);
        conn(bad).pop();
        expect(() => MAZE.buildPlaythroughMaze({ source: { atlas: bad, roomsAtlas: rooms } })).toThrow(MAZE.SourceRoomsError);
    });
});

describe('the maze producer over the shuffled atlas (buildPlaythroughMaze({source}))', () => {
    let built;
    let atlas;
    beforeAll(() => {
        ({ atlas } = M.applyPlacements(env.pool.atlas, env.classify, env.shuffle.placements));
        built = MAZE.buildPlaythroughMaze({ levels: atlas.regions.map((r) => r.region_id), source: { atlas, roomsAtlas: env.pool.atlas } });
    }, 300_000);
    it('skips BY NAME exactly the derived-rule rows the rules producer skips on the same doc', () => {
        const table = TBL.readDerivedRuleTable();
        const moved = new Set(env.compile.moved);
        const expected = table.rows.filter((r) => r.kind === 'exit' && moved.has(`${r.atlas.region_id}/${r.atlas.exit_id}`)).map((r) => r.key).sort();
        expect(expected.length).toBeGreaterThan(0);
        expect(built.skipped.map((s) => s.key).sort()).toEqual(expected);
        expect(built.moved).toEqual(env.compile.moved);
    });
    it('every atlas endpoint compiles to the same AP exit name as in the ER rules preset (one graph, two flavours)', () => {
        const doc = JSON.parse(built.text);
        const endpoints = new Set(atlas.regions.flatMap((r) => (r.exits ?? []).map((e) => `${r.region_id}/${e.exit_id}`)));
        const maze = apExitNamesByEndpoint(doc, '1', { endpoints });
        const flash = apExitNamesByEndpoint(ER);
        const named = [...flash].filter(([, n]) => n !== null);
        expect(named.length).toBeGreaterThan(0);
        for (const [k, n] of named) expect(maze.get(k), k).toBe(n);
        // without `endpoints`, the maze's internal crossings' synthetic ids are keys too, and collide
        expect(() => apExitNamesByEndpoint(doc)).toThrow(/compiled to two names/);
    });
    it('the CLI never writes the vanilla preset from a --source run', () => {
        expect(() => MAZE.parseMazeArgs(['node', 'x', '--source=a.json'])).toThrow(/--source needs --out/);
        expect(() => MAZE.parseMazeArgs(['node', 'x', '--out=b.json'])).toThrow(/--out needs --source/);
        expect(() => MAZE.parseMazeArgs(['node', 'x', '--source=a.json', `--out=${MAZE.OUT_FILE}`])).toThrow(/the preset's own file/);
        expect(MAZE.parseMazeArgs(['node', 'x', '--check'])).toEqual({ check: true, quiet: false, source: null, out: null });
    });
});

describe('the entrance envelope: schema, serialize, resume', () => {
    it('every step\'s serialized envelope validates against the committed schema; the live binding is never written', () => {
        for (const step of M.ENTRANCE_STEPS) {
            const ok = validate(snapshots[step]);
            expect(ok, `${step}: ${JSON.stringify(validate.errors)}`).toBe(true);
            expect(snapshots[step]._binding, step).toBeUndefined();
            expect(snapshots[step].completed).toBe(M.ENTRANCE_STEPS.indexOf(step));
        }
        expect(SCHEMA.properties._binding['x-visibility']).toBe('internal');
        expect(SCHEMA.properties.pool['x-visibility']).toBe('internal');
    });
    it('MUTANT: an undeclared top-level field fails the schema', () => {
        expect(validate({ ...snapshots.pool, stray: 1 })).toBe(false);
    });
    it('resumed after shuffle on COLD hooks, it compiles the committed preset and never re-pools, re-classifies or re-compiles vanilla', async () => {
        const cold = await seedlingEntranceShuffleHooks();
        const calls = { pool: 0, classify: 0, vanilla: 0 };
        const spied = Object.create(cold);
        spied.pool = async () => { calls.pool += 1; throw new Error('resume re-pooled'); };
        spied.classify = async () => { calls.classify += 1; throw new Error('resume re-classified'); };
        spied.compile = async (atlas, o = {}) => {
            if (!o.moved?.size) calls.vanilla += 1;
            return cold.compile(atlas, o);
        };
        spied.resume = (ctx) => cold.resume(ctx);
        spied.checks = (r, ctx) => cold.checks(r, ctx);
        const resumed = M.deserializeEntranceEnvelope(JSON.parse(JSON.stringify(snapshots.shuffle)));
        expect(resumed.completed).toBe(M.ENTRANCE_STEPS.indexOf('shuffle'));
        await M.runEntranceToStep(resumed, 'compile', { hooks: spied });
        expect(calls).toEqual({ pool: 0, classify: 0, vanilla: 0 });
        expect(stringifyRulesJson(resumed.compile.rulesJson) === ER_TEXT).toBe(true);
        expect(resumed.compile.attempts).toEqual(env.compile.attempts);
        // the cold hooks were WARMED from the envelope: the checks' state is the fresh run's
        expect(cold.vanillaSphereZero).toBe(hooks.vanillaSphereZero);
        expect(cold.census.permissive).toEqual(hooks.census.permissive);
    }, 300_000);
    it('a finished envelope round-trips to itself and has nothing left to run', async () => {
        const back = roundTrip(env);
        expect(back.completed).toBe(M.ENTRANCE_STEPS.length - 1);
        expect(JSON.stringify(M.serializeEntranceEnvelope(back))).toBe(JSON.stringify(snapshots.compile));
    });
    it('refuses, by name, an envelope of PUBLIC fields only, another mode\'s, or one claiming steps its data lacks', () => {
        const pub = JSON.parse(JSON.stringify(publicEnvelope(env, M.ENTRANCE_ENVELOPE_FIELDS)));
        expect(() => M.deserializeEntranceEnvelope(pub)).toThrow(/says completed 3, but its data reaches only -1/);
        // …and with its `completed` taken at its word for the data it does carry, it still cannot resume
        expect(() => M.deserializeEntranceEnvelope({ ...pub, completed: -1 })).not.toThrow();
        const noVanilla = { ...snapshots.shuffle };
        delete noVanilla.vanilla;
        expect(() => M.deserializeEntranceEnvelope(noVanilla)).toThrow(/carries no vanilla compile/);
        expect(() => M.deserializeEntranceEnvelope({ ...snapshots.pool, kind: 'sphere-envelope' })).toThrow(EnvelopeStampError);
        expect(() => M.deserializeEntranceEnvelope({ ...snapshots.classify, completed: 3 })).toThrow(/says completed 3, but its data reaches only 1/);
    });
    it('the CLI: --save / --resume / --game-name; a resume takes the envelope\'s own run, never a flag', () => {
        const o = parseEntranceStepArgs(['run', '--atlas', 'a', '--game-name', 'G', '--to', 'shuffle', '--save', 's.json']);
        expect([o.atlas, o.gameName, o.to, o.save, o.resume]).toEqual(['a', 'G', 'shuffle', 's.json', null]);
        expect(parseEntranceStepArgs(['run', '--resume', 's.json']).resume).toBe('s.json');
        for (const f of [['--atlas', 'a'], ['--seed', '2'], ['--max-attempts', '3'], ['--sweep', 'events'], ['--game-name', 'G']]) {
            expect(() => parseEntranceStepArgs(['run', '--resume', 's.json', ...f]), f[0]).toThrow(new RegExp(`${f[0]} cannot be given with it`));
        }
        expect(() => parseEntranceStepArgs(['run'])).toThrow(/--atlas names the content source/);
    });
    it('MUTANT: a resume whose pooled atlas is not this tree\'s build is refused by the Seedling hooks', async () => {
        const cold = await seedlingEntranceShuffleHooks();
        const bad = M.deserializeEntranceEnvelope(JSON.parse(JSON.stringify(snapshots.shuffle)));
        bad.pool.atlas.regions[0].exits[0].exit_id = 'out_mutant';
        await expect(M.runEntranceToStep(bad, 'compile', { hooks: cold })).rejects.toThrow(/is not this tree's build/);
    }, 300_000);
});
