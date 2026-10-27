/**
 * ⛓ ENCOUNTER LEGS ON THE JS PAGE (slice `seedling-js-encounter-legs`) — a bound ENCOUNTER location (L32's Bob Boss,
 * L12's Witch) is walked on the JS runtime by the solver's `encounter` executor (`solverBot.ENCOUNTER_EXECUTORS`), and
 * completes when the game's OWN check fires: the clear of the encounter's fixed report address
 * (`jsRuntimeCore.encounterCheckAddress`: {32,4} = `Fire.BOSS_DROP_TAG`, {12,1} = `DarkSword.WITCH_TAG`; R4 AS3
 * `Pickups/Fire.as:49-55`, `Pickups/DarkSword.as:49-57` @ vendor/seedling ccdf189776). Never on the `hasFire` /
 * `hasDarkSword` flag (on a `bossreport` build only the host's grant writes it) and never on the plan finishing.
 *
 * ⛔ THE GOALS ARE THE PRODUCTION LOAD'S: `loadSeedlingRandomizer` over the shipped playthrough rules, then
 * `realRoomPlaybackMap` + `resolveSeedlingAtlasGoal` (as `seedlingEncounterBinding.test.js`). The boots are the
 * encounter tapes' own (`apb-l32-fresh-no-fire` L32@72,120 sword+shield; `enc-l12-witch` L12@16,352 sword+wand).
 *
 * ── THE MUTATION LIST (each predicted red by name) ──
 *   m1 the blanket "walked on the wasm runtime" refusal re-instated in `validateGoal`
 *        -> 8 of 9 red (every row but the fixture: the walks on `walkTo` ok false, the refusals on their wording).
 *   m2 completion on the TAG (the encounter arm of `locationServed` dropped: `collected.has("32:null")`)
 *        -> the Bob and Witch rows red: never DONE (the plan plays out and is refuted).
 *   m3 completion on ANY of the level's reports (`wasmPlayback.encounterReportServed`: the kill {32,3} too)
 *        -> the Bob row reds: DONE at the kill, before the drop {32,4} is collected.
 *   m4 the encounter decline walks instead (`goal.encounter` dropped from the walker's decline arm)
 *        -> the no-wand row reds: WALKING, not FAILED.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsRuntime, encounterCheckAddress } from './jsRuntimeCore.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { withContactFidelity } from './contactFidelity.js';
import { realRoomPlaybackMap, resolveSeedlingAtlasGoal } from '../flashPanel/seedlingPlaybackController.js';
import { loadSeedlingRandomizer } from '../flashPanel/seedlingRandomizerWiring.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const VANILLA = readJson('../flashPanel/atlases/seedling-map.json');
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const LOADED = await loadSeedlingRandomizer({
    flashPanel: PT.flash_panel['1'], manifest: readJson('../flashPanel/wasm/builds.json'), rawRules: PT,
    locations: locationsOf(PT), playerId: '1', gameConfig: readJson('../flashPanel/games/seedling.json'),
    baseUrl: pathToFileURL(abs('../../')).href,
    fetchJson: async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8')),
    importModule: (u) => import(/* @vite-ignore */ u),
});
const MAP = realRoomPlaybackMap(LOADED, PT);
const goalOf = (name) => resolveSeedlingAtlasGoal({ kind: 'location', name }, MAP).goal;
const BOB = goalOf('Level 032 - Bob Boss');
const WITCH = goalOf('Level 012 - Witch');
const SETTLED = [WALK_STATES.DONE, WALK_STATES.FAILED];

const cleared = (rt) => JSON.parse(rt.game.botStatus()).persistence_cleared;
const has = (rt, { level, tag }) => cleared(rt).some((c) => c.level === level && c.tag === tag);

/** A JS page on the vanilla map, `items` held, booted at `[level, x, y]`; the solver mode `solver`. */
function page({ boot, items, solver = true }) {
    const rt = createJsRuntime();
    rt.setVanilla(VANILLA);
    rt.game.configure({ state_properties: [{ class: 'Game', property: 'pendingCheck' }] });
    rt.queueItems(items.map((p) => ({ class: 'Main', property: p, value: true })));
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: boot }]);
    rt.tick();
    rt.playback.setSolverWalk(solver);
    return rt;
}

/** Tick to a settle, recording the first tick each address in `watch` is cleared and DONE's tick. */
function walk(rt, goal, watch, maxTicks = 3000) {
    expect(rt.playback.walkTo(goal)).toEqual({ ok: true });
    rt.playback.play();
    const first = new Map();
    let doneAt = null;
    let t = 0;
    for (; t < maxTicks && !SETTLED.includes(rt.playback.state); t += 1) {
        rt.tick();
        for (const a of watch) if (!first.has(`${a.level}:${a.tag}`) && has(rt, a)) first.set(`${a.level}:${a.tag}`, t);
        if (rt.playback.state === WALK_STATES.DONE) doneAt = t;
    }
    return { first, doneAt };
}

const checksOf = (rt) => rt.events.filter((e) => e.type === 'check' && e.clear).map((e) => `${e.level}:${e.tag}`);

describe('⛓ ENCOUNTER LEGS — the fixture and the check address', () => {
    it('the production map binds both encounters as tagless location goals; their checks are the drops\' report addresses', () => {
        expect(BOB).toMatchObject({ kind: 'location', level: 32, tag: null, encounter: { drop: { item: 'Fire' } } });
        expect(WITCH).toMatchObject({ kind: 'location', level: 12, tag: null, encounter: { drop: { item: 'Progressive Sword' } } });
        expect(encounterCheckAddress(BOB)).toEqual({ level: 32, tag: 4 });
        expect(encounterCheckAddress(WITCH)).toEqual({ level: 12, tag: 1 });
        expect(encounterCheckAddress({ kind: 'location', level: 32, tag: 3 })).toBeNull();
    });
});

describe('⛓ ENCOUNTER LEGS — validateGoal', () => {
    const rt = page({ boot: [32, 72, 120], items: ['hasSword', 'hasShield'], solver: false });

    it('the solver mode OFF: refused by name', () => {
        const a = rt.playback.walkTo(BOB);
        expect(a.ok).toBe(false);
        expect(a.reason).toBe('"Level 032 - Bob Boss" is an ENCOUNTER (the Fire drop in level 32): it is walked by the '
            + 'solver\'s encounter executor, and the solver mode is off (`flashPanel.seedlingSolverWalk`)');
    });

    it('an UNBOUND encounter (a drop with no executor) is refused by name, solver on', () => {
        rt.playback.setSolverWalk(true);
        const a = rt.playback.walkTo({ ...BOB, encounter: { ...BOB.encounter, drop: { item: 'Bombs' } } });
        expect(a.ok).toBe(false);
        expect(a.reason).toMatch(/is an ENCOUNTER \(the Bombs drop in level 32\): the solver has no encounter executor for that drop \(it serves Fire, Progressive Sword\)/);
    });

    it('an encounter in a level with no encounter report row is refused by name', () => {
        const a = rt.playback.walkTo({ ...BOB, level: 31 });
        expect(a.ok).toBe(false);
        expect(a.reason).toMatch(/level 31 has no encounter row with a fixed report address/);
    });

    it('`apReportBosses` OFF: refused by name (nothing would write the check)', () => {
        const a = withContactFidelity({ apReportBosses: false }, () => rt.playback.walkTo(BOB));
        expect(a.ok).toBe(false);
        expect(a.reason).toMatch(/its check is the report clear \{32,4\}, which only the boss-report AS3 writes/);
    });

    it('the bound encounter with the solver ON is accepted', () => {
        expect(rt.playback.walkTo(BOB)).toEqual({ ok: true });
        expect(rt.playback.walkTo(WITCH)).toEqual({ ok: true });
    });
});

describe('⛓ ENCOUNTER LEGS — the walks', () => {
    it('L32 Bob Boss (sword + shield): solved once as the encounter, DONE on the tick after the DROP {32,4} — not at the kill {32,3}', () => {
        const rt = page({ boot: [32, 72, 120], items: ['hasSword', 'hasShield'] });
        expect(has(rt, { level: 32, tag: 4 })).toBe(false);
        const { first, doneAt } = walk(rt, BOB, [{ level: 32, tag: 3 }, { level: 32, tag: 4 }]);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        const kill = first.get('32:3');
        const drop = first.get('32:4');
        expect(kill).toBeLessThan(drop);
        // (the walker reads `done` at the top of the NEXT tick's keys: one tick after the clear)
        expect(doneAt - drop).toBe(1);
        expect(rt.halted).toBeNull();
        const s = rt.playback.solverStats;
        expect(s.lastSolve.goal).toEqual({ kind: 'encounter', at: BOB.encounter.at, drop: { item: 'Fire' }, then: null });
        expect(`${s.solves}/${s.declines}/${s.refutations}`).toBe('1/0/0');
        expect(rt.run.level).toBe(32);
        // The host hears both reports as the check binding reads them: one clear each.
        expect(checksOf(rt).filter((k) => k.startsWith('32:'))).toEqual(['32:3', '32:4']);
        expect(rt.playback.describe()).toBe('bot: done → Level 032 - Bob Boss in level 32');
    }, 240_000);

    it('L12 Witch (sword + wand): solved once, DONE on the tick after {12,1}', () => {
        const rt = page({ boot: [12, 16, 352], items: ['hasSword', 'hasWand'] });
        const { first, doneAt } = walk(rt, WITCH, [{ level: 12, tag: 1 }]);
        expect(rt.playback.state).toBe(WALK_STATES.DONE);
        expect(doneAt - first.get('12:1')).toBe(1);
        const s = rt.playback.solverStats;
        expect(s.lastSolve.goal).toMatchObject({ kind: 'encounter', drop: { item: 'Progressive Sword' }, then: null });
        expect(`${s.solves}/${s.declines}/${s.refutations}`).toBe('1/0/0');
        expect(checksOf(rt).filter((k) => k.startsWith('12:'))).toEqual(['12:1']);
    }, 120_000);

    it('L12 Witch WITHOUT the wand: the solver declines by name and the goal FAILS with that reason (no "walking instead")', () => {
        const rt = page({ boot: [12, 16, 352], items: ['hasSword'] });
        walk(rt, WITCH, [], 400);
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toMatch(/^the solver declined — .*WAND/);
        expect(has(rt, { level: 12, tag: 1 })).toBe(false);
        expect(rt.run.level).toBe(12);
    }, 120_000);
});
