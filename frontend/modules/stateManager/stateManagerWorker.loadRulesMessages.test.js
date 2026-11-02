/**
 * The REAL worker module's message ORDER on loadRules (js-15 condition 3 for the
 * rule-engine-worker-load-failure slice): a good load posts exactly what it posted
 * before the slice, and a load that throws posts `rulesLoadFailed` BEFORE the
 * unchanged `workerError`.
 *
 * Measured once at the base efbeb33501 with the same harness: concept_trial AP_1 and
 * ALTTP seed 1, good load → the base's and this tree's posted messages are
 * deep-equal (timestamps stripped); C5 → the base posts [init, workerError] only.
 *
 * The worker is driven in node: `self` is a stub that records postMessage, and
 * `self.onmessage` is the worker's own handler (it enqueues and drains its queue).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '..', '..', 'presets', 'concept_trial', 'AP_1', 'AP_1_rules.json'), 'utf8'));

const originalSelf = globalThis.self;
afterEach(() => { globalThis.self = originalSelf; });

async function drive(rules, expectedCount) {
  vi.resetModules();
  const posted = [];
  globalThis.self = { postMessage: (m) => posted.push(m) };
  await import('./stateManagerWorker.js');
  const until = async (n) => {
    for (let i = 0; i < 200 && posted.length < n; i += 1) await new Promise((r) => setTimeout(r, 10));
  };
  await globalThis.self.onmessage({ data: { command: 'initialize', payload: { config: { playerId: '1', settings: {} } } } });
  await until(1);
  await globalThis.self.onmessage({ data: { command: 'loadRules', payload: {
    loadSeq: 4, rulesData: rules, playerInfo: { playerId: '1', playerName: 'P' },
  } } });
  await until(expectedCount);
  await new Promise((r) => setTimeout(r, 50)); // nothing more may follow
  return posted;
}

const types = (posted) => posted.map((m) => m.type);

describe('stateManagerWorker loadRules: the messages it posts, in order', () => {
  it('a good load posts exactly today\'s sequence: no new message on success', async () => {
    const posted = await drive(structuredClone(RULES), 2);
    expect(types(posted)).toEqual(['workerInitializedConfirmation', 'rulesLoadedConfirmation']);
    expect(posted[1].loadSeq).toBe(4);
  }, 20_000);

  it.each([
    ['C5', (r) => { r.region_2_2.exits = 5; }, /not iterable/],
    ['C9', (r) => { r.region_2_2.exits.push(null); }, /null/],
  ])('%s posts rulesLoadFailed, then the unchanged workerError', async (_l, mutate, msg) => {
    const rules = structuredClone(RULES);
    mutate(rules.regions['1']);
    const posted = await drive(rules, 3);
    expect(types(posted)).toEqual(['workerInitializedConfirmation', 'rulesLoadFailed', 'workerError']);
    const [, failed, workerError] = posted;
    expect(failed).toMatchObject({ loadSeq: 4, game: 'Procgen Maze', player: '1', phase: 'processStartingItems' });
    expect(failed.message).toMatch(msg);
    expect(workerError).toMatchObject({ command: 'loadRules', errorMessage: failed.message });
  }, 20_000);
});
