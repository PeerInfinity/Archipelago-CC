/**
 * THE INPUT/OUTPUT SPLIT, red-first (session tile-rules-automation-r-a2, ⚖ Robert 2026-11-03 "3: Both at once"; the
 * designer's GO, condition 5; rules-4's review). The maze worlds copy ONLY the overlay's hand terms
 * (`handInputsFor` = `OV.handExitTerms` + `OV.handLocationTerms`); a charge the rules producer COMPOSED from the grid is
 * derived by walking the grid. Three plants, each read back with the echo method (`seedlingEchoSentinels.js`):
 *   - a sentinel in a COMPOSED atlas charge (L49's necessary Swim, `chargeNecessaryApproaches`; L19 Boss Key 0's
 *     `chargeSealedLocation`) must NOT reach a payload;
 *   - the analyzer's PRICING output (the binder the producer composes from), planted test-only, must not move a payload byte;
 *   - a sentinel in a HAND term (L82's CHARGED_DOORS row, L19 Shieldspire's LOCATION_GUARDS row) MUST reach one.
 * Expectations are the overlay's own tables (counted from them, never from this code). Default tier, on purpose
 * (rules-4): a later rules slice that composes onto a guarded location is caught here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze, handInputsFor, LEVELS, plainLevelWorldFits } from './make-seedling-playthrough-maze.mjs';
import { plantEchoSentinels, findEchoes } from './seedlingEchoSentinels.js';
import * as OV from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

const ATLAS = JSON.parse(readFileSync(new URL('../../frontend/modules/flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const compile = (levels, opts = {}) => JSON.parse(buildPlaythroughMaze({ levels, embedSphereLog: false, ...opts }).text);
const echoesOf = (levels) => findEchoes(compile(levels, { plant: plantEchoSentinels }), compile(levels));
const payloads = (doc) => JSON.stringify(Object.values(doc.preset_sidecars['1']).map((sc) => sc.playable_payload ?? null));

describe('the hand inputs are the overlay\'s tables, and nothing else', () => {
    const hand = handInputsFor(ATLAS);
    it('one exit term per CHARGED_DOORS row and per connection of a DEATH_EXIT_ARENAS level; one location term per LOCATION_GUARDS row', () => {
        const arenaConns = OV.DEATH_EXIT_ARENAS.flatMap((a) => ATLAS.vanilla_layout.connections
            .filter((c) => c.from[0] === `level_${a.level}` || c.to[0] === `level_${a.level}`).map((c) => c.from.join('/')));
        expect([...hand.exits.keys()].sort()).toEqual([...new Set([...OV.CHARGED_DOORS.map((d) => `level_${d.level}/${d.exitId}`), ...arenaConns])].sort());
        expect(hand.locations.size).toBe(Object.keys(OV.LOCATION_GUARDS).length);
    });
});

describe('red-first: a COMPOSED charge never reaches a world; a HAND term always does', () => {
    it('L49\'s necessary Swim (composed) is not copied: its exit is derived', () => {
        const e = echoesOf(['level_49', 'level_50']);
        expect(e.byKind.ex).not.toContain('level_49/out_teleporter_32_128');
        expect(e.byKind.ex).toEqual([]);
    });
    it('L19: Boss Key 0\'s composed sealed-location charge is not copied; Shieldspire\'s LOCATION_GUARDS term is', () => {
        const e = echoesOf(['level_19']);
        expect(e.byKind.loc).toEqual(['level_19/Level 019 - Shieldspire']);
    });
    it('L82\'s CHARGED_DOORS term is copied (a hand input the world must carry)', () => {
        const e = echoesOf(['level_82', 'level_96']);
        expect(e.byKind.ex).toContain('level_82/out_teleporter_144_0');
        expect(e.byKind.ex).toContain('level_96/out_teleporter_32_64');
    });
    it('MUTANT: an exit the hand terms do not name, planted in the hand source, IS carried — the read-back can fail', () => {
        const doc = compile(['level_49', 'level_50'], {
            plant: (x) => { plantEchoSentinels(x); x.hand.exits.set('level_49/out_teleporter_32_128', { rule: 'Has', args: { item_name: '⟦echo|ex|level_49/out_teleporter_32_128⟧' } }); },
        });
        expect(findEchoes(doc, compile(['level_49', 'level_50'])).byKind.ex).toEqual(['level_49/out_teleporter_32_128']);
    });
    it('RULE-LESS rows are planted too: L94\'s kept-plain crossing r2c16 <-> r3c4 (no access_rule, copied open) reads as an echo', () => {
        // ⛓ session tile-rules-automation-r-a3 (designer GO; rules-4 PASS): the plant used to skip a row with no rule, so a kept-plain
        // world that copies an ABSENT rule as an open crossing read as derived True_ — an echo the sentinel could not see.
        const row = ATLAS.regions.find((r) => r.region_id === 'level_94').subgraph.internal_exits.find((x) => x.from === 'r2c16' && x.to === 'r3c4');
        expect(row.access_rule).toBeUndefined();
        const e = echoesOf(['level_94']);
        expect(e.byKind.ix).toEqual(['level_94/r2c16->r3c4']);
        expect(e.elements).toEqual(['level_94__r2c16|level_94__r2c16 -> level_94__r3c4', 'level_94__r3c4|level_94__r3c4 -> level_94__r2c16']);
    });
    it('the analyzer\'s PRICING output does not move a payload byte (L12 one level world, L56 and L49 plain)', () => {
        const levels = ['level_12', 'level_49', 'level_50', 'level_56', 'level_52', 'level_57'];
        const KEY = { key: 4 };   // a condition that RESOLVES (Yellow Key): an unknown one would resolve to null, silently
        const plantBinder = (_region, analysis) => {
            for (const b of analysis.bindings ?? []) {
                if (b.conditionSets) b.conditionSets = b.conditionSets.map(() => ({ conditions: [KEY] }));
                if (b.necessary) b.necessary = [KEY];
                if (b.sealedIn) b.sealedIn = { ...b.sealedIn, conditions: [KEY] };
            }
            for (const c of analysis.crossings ?? []) if (c.conditionSets) c.conditionSets = c.conditionSets.map(() => ({ conditions: [KEY] }));
        };
        expect(payloads(compile(levels, { analysisHook: plantBinder }))).toBe(payloads(compile(levels)));
    });
});

describe('which plain levels become level worlds: the item-axis test, not a list', () => {
    // A level that starts failing (or passing) a test shows up here by name.
    it('every plain multi-sub-region level is one level world but two, each kept per sub-region and saying why', () => {
        const { report, levelWorlds } = buildPlaythroughMaze({ levels: LEVELS, embedSphereLog: false });
        const kept = Object.fromEntries(report.maze_notes.filter((n) => n.kind === 'plain_kept_per_sub_region').map((n) => [n.region_id, n.message]));
        expect(Object.keys(kept).sort()).toEqual(['level_20', 'level_94']);
        // L20: its ButtonRoom latches lock@32,80 in the same level (an in-room press, rules-l20-button-latch).
        expect(kept.level_20).toContain('L20 flag 4: lock@32,80 cleared');
        // L94: r2c16 <-> r3c4 crosses TreeLarge's per-pixel mask; the physics model prices it, the grid cannot.
        expect(kept.level_94).toContain('r2c16 <-> r3c4 goes through material only the physics model walks');
        // ⛓ L12 (session tile-l12-one-world, ⚖ Robert 2026-11-04 "A: Build after R-A3 (Recommended)"): 15 items, 32,768 lattice
        // points, inside the learner's memory bound (`LEVEL_WORLD_MAX_POINTS`) — the ONE level that bound admits past the rank
        // walk's 2^12; until then it was kept per sub-region "over the lattice cap 12".
        expect(levelWorlds.get('level_12')).toBe(true);
        expect(report.maze_notes.filter((n) => n.kind === 'plain_level_world').length).toBe(19);
        expect([...levelWorlds.values()].filter((v) => v !== true)).toEqual([]);
    });
    it('the PLANTED compile takes the true compile\'s level-world decisions (a bound between L12\'s true and planted axes)', () => {
        // ⛓ session tile-l12-one-world (latent since R-A2; found by tile-l12-level-world): the echo plant REPLACES rules, so L12's
        // planted payload carries 17 axis items (its two hand sentinels in, nothing out) where the true one carries 15. A bound
        // between them (2^16 points) makes the true compile ONE world; the planted compile must follow it — deciding on its own
        // axis it kept L12 per sub-region, and the probe read the one-world pairs as echoed. RED on the pre-fix compile.
        // L83 too: L12's teleporter exit to it is wired only then, and its hand rule is the second planted sentinel (L12 alone: 16).
        const levels = ['level_12', 'level_83'];
        const bound = 2 ** 16;
        const truth = buildPlaythroughMaze({ levels, embedSphereLog: false, levelWorldBound: bound });
        expect(truth.levelWorlds.get('level_12')).toBe(true);
        const planted = buildPlaythroughMaze({ levels, plant: plantEchoSentinels, embedSphereLog: false, levelWorldBound: bound });
        expect(planted.levelWorlds.get('level_12')).toBe(true);
        const doc = JSON.parse(planted.text);
        expect(doc.preset_sidecars['1'].level_12__r0c19.playable_payload.shared_world).toBeTruthy();
        // and the planted payload really is over the bound by itself (so the inheritance, not the bound, decides it)
        expect(plainLevelWorldFits({ sidecars: doc.preset_sidecars['1'] }, { maxPoints: bound })).not.toBe(true);
    });
});
