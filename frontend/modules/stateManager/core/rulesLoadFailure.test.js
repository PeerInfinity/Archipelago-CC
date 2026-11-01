/**
 * The worker's named load failure (option A, ⚖ user 2026-11-01): a loadRules that
 * throws posts `rulesLoadFailed {loadSeq, game, player, phase, where, message, stack}`,
 * then rethrows so the worker's catch still posts `workerError`.
 *
 * Driven on the REAL StateManager with the committed concept_trial AP_1 rules, mutated
 * the way rule-engine-catch-and-report.md § WORKER ERROR INVESTIGATION measured them:
 * C5 (`region.exits = 5`) and C9 (`exits.push(null)`), both FATAL before this slice.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { buildRulesLoadFailed, loadRulesOrReport, rulesGameName } from './rulesLoadFailure.js';

const PRESETS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'presets');
const RULES = JSON.parse(readFileSync(join(PRESETS, 'concept_trial', 'AP_1', 'AP_1_rules.json'), 'utf8'));
const GAME = rulesGameName(RULES, '1');

const makeSm = async () => {
  const { StateManager } = await import('../stateManager.js');
  const { evaluateRule } = await import('../../shared/ruleEngine.js');
  const { workerLoggerInstance } = await import('../../../app/core/universalLogger.js');
  return new StateManager(evaluateRule, workerLoggerInstance);
};

const mutated = (fn) => {
  const rules = structuredClone(RULES);
  fn(rules.regions['1']);
  return rules;
};
const C5 = () => mutated((r) => { r.region_2_2.exits = 5; });
const C9 = () => mutated((r) => { r.region_2_2.exits.push(null); });

/** Runs one load; returns {posted, error, result}. */
const run = async (sm, rules, loadSeq = 7) => {
  const posted = [];
  try {
    const result = await loadRulesOrReport(sm, rules, '1', loadSeq, (m) => posted.push(m));
    return { posted, result, error: null };
  } catch (error) {
    return { posted, result: null, error };
  }
};

/** JSON of a value, Maps included, so a key that sneaks into a Map is seen too. */
const deepJson = (v) => JSON.stringify(v, (_k, x) => (x instanceof Map ? [...x.entries()] : x instanceof Set ? [...x] : x));

describe('rulesLoadFailed: the structural fixtures', () => {
  it('the fixture is a real game with a name', () => {
    expect(GAME).toBeTruthy();
  });

  it.each([
    ['C5 region.exits = 5', C5, /not iterable/],
    ['C9 a null exit entry', C9, /null/],
  ])('%s posts rulesLoadFailed with the game, player, phase and message, then rethrows', async (_label, fixture, msg) => {
    const sm = await makeSm();
    const { posted, error } = await run(sm, fixture());
    expect(error).toBeInstanceOf(TypeError);
    expect(posted).toHaveLength(1);
    const [m] = posted;
    expect(m).toMatchObject({ type: 'rulesLoadFailed', loadSeq: 7, game: GAME, player: '1' });
    // The first reachability pass is in processStartingItems (no starting items in this preset).
    expect(m.phase).toBe('processStartingItems');
    expect(m.where).toBe(null); // the BFS keeps no "where" (no bookkeeping on the hot path)
    expect(m.message).toMatch(msg);
    expect(m.message).toBe(error.message);
    expect(m.stack).toBe(error.stack);
    expect(sm._rulesLoadProgress).toBe(null);
  });

  it('an index-building throw names the region the loop had in hand', async () => {
    const sm = await makeSm();
    const { posted } = await run(sm, mutated((r) => { r.region_2_2.locations = [null]; }));
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ phase: 'loadPlayerData/loadLocations', where: 'region_2_2', game: GAME });
  });

  it('a throw in getSnapshot after a completed loadFromJSON is named getSnapshot', async () => {
    const sm = await makeSm();
    sm.getSnapshot = () => { throw new Error('snapshot boom'); };
    const { posted } = await run(sm, structuredClone(RULES));
    expect(posted).toEqual([expect.objectContaining({ phase: 'getSnapshot', message: 'snapshot boom', where: null })]);
  });
});

describe('rulesLoadFailed: the success path posts nothing new', () => {
  it('a good load posts nothing, returns the snapshot and static data, and leaves no marker', async () => {
    const sm = await makeSm();
    const { posted, error, result } = await run(sm, structuredClone(RULES));
    expect(error).toBe(null);
    expect(posted).toEqual([]);
    expect(result.initialSnapshot).toBeTruthy();
    expect(result.workerStaticGameData).toBeTruthy();
    expect(sm._rulesLoadProgress).toBe(null);
    // The marker never reaches a snapshot or static data (its key and its phase names).
    for (const out of [deepJson(result.initialSnapshot), deepJson(result.workerStaticGameData)]) {
      expect(out).not.toMatch(/_rulesLoadProgress|processStartingItems|loadPlayerData\//);
    }
  });

  it('fail, then a good load on the SAME worker instance completes', async () => {
    const sm = await makeSm();
    expect((await run(sm, C5(), 1)).posted).toHaveLength(1);
    const good = await run(sm, structuredClone(RULES), 2);
    expect(good.error).toBe(null);
    expect(good.posted).toEqual([]);
    expect(good.result.initialSnapshot).toBeTruthy();
  });
});

describe('buildRulesLoadFailed', () => {
  it('falls back to the caller phase and the rules game_name', () => {
    const m = buildRulesLoadFailed({
      loadSeq: undefined, rulesData: { game_name: 'G' }, playerId: '2',
      progress: null, fallbackPhase: 'getStaticGameData', error: new Error('x'),
    });
    expect(m).toMatchObject({ type: 'rulesLoadFailed', game: 'G', player: '2', phase: 'getStaticGameData', where: null, message: 'x' });
  });

  it('a non-Error throw still carries a message', () => {
    const post = vi.fn();
    const sm = { loadFromJSON: () => { throw 'plain string'; } };
    return loadRulesOrReport(sm, {}, '1', 3, post).catch(() => {
      expect(post).toHaveBeenCalledWith(expect.objectContaining({ message: 'plain string', game: null, phase: 'loadFromJSON' }));
    });
  });
});
