/**
 * The runtime loader REFUSES a top-level `assume_bidirectional_exits` by name
 * (rules F1, ⚖ user 2026-10-03). A refusal, not a compatibility read: the key's
 * one home is `exporter["<p>"]`, and an ignored old value would silently fall to
 * auto-detection — the misjudgement of procgen exits the proxy's comment
 * describes.
 */

import { describe, it, expect } from 'vitest';

import { loadFromJSON, refuseRetiredTopLevelKeys, RETIRED_TOP_LEVEL_KEYS } from './initialization.js';

function stubStateManager() {
  return {
    invalidateCache() {},
    clearCheckedLocations() {},
    logger: { warn() {}, info() {} },
    _logDebug() {},
  };
}

describe('loadFromJSON — retired top-level keys', () => {
  it('refuses a document carrying a top-level assume_bidirectional_exits, naming the key, its home and the script', () => {
    const doc = { schema_version: 3, assume_bidirectional_exits: true, exporter: {} };
    expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(/`assume_bidirectional_exits`/);
    expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(/exporter\["<player>"\]\.assume_bidirectional_exits/);
    expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(/migrate-per-player-blocks\.mjs/);
  });

  it('refuses a top-level `false` too — the VALUE is never read', () => {
    expect(() => refuseRetiredTopLevelKeys({ assume_bidirectional_exits: false })).toThrow(/assume_bidirectional_exits/);
  });

  it("lets the slot's own exporter flag through", () => {
    expect(() => refuseRetiredTopLevelKeys({ exporter: { 1: { assume_bidirectional_exits: true } } })).not.toThrow();
  });

  it('names a migration script that exists', async () => {
    const { existsSync } = await import('node:fs');
    for (const [, script] of Object.values(RETIRED_TOP_LEVEL_KEYS)) {
      expect(existsSync(script.split(' ')[0]), script).toBe(true);
    }
  });
});
