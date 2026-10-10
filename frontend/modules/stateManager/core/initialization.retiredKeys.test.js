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

/**
 * ⛓ rules F2 — `region_atlas`, `flash_panel` and `provenance` keep their names
 * and became slot maps; the document-level BLOCK is the retired shape, refused
 * by name.
 */
describe('loadFromJSON — the F2 slot-map keys refuse their document-level block', () => {
  const OLD = {
    region_atlas: { atlas_id: 'seedling-abc', game: 'seedling', map_document: 'seedling-map.json' },
    flash_panel: { config: 'seedling.json', wasm: 'seedling_bot_ap_p4f/game.html' },
    provenance: { generator: 'make-seedling-playthrough-rules' },
  };

  for (const [key, block] of Object.entries(OLD)) {
    it(`refuses a document-level \`${key}\` block, naming the key, its home and the script`, () => {
      const doc = { schema_version: 3, [key]: block };
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(new RegExp(`\`${key}\` block`));
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(new RegExp(`${key}\\["<player>"\\]`));
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(/migrate-per-player-blocks\.mjs/);
    });

    it(`lets the slot map \`${key}\` through (one slot, two slots, none)`, () => {
      expect(() => refuseRetiredTopLevelKeys({ [key]: { 1: block } })).not.toThrow();
      expect(() => refuseRetiredTopLevelKeys({ [key]: { 1: block, 2: block } })).not.toThrow();
      expect(() => refuseRetiredTopLevelKeys({ [key]: {} })).not.toThrow();
    });
  }

  it('refuses a map that mixes a slot with a field name — not a slot map', () => {
    expect(() => refuseRetiredTopLevelKeys({ flash_panel: { 1: OLD.flash_panel, config: 'x' } }))
      .toThrow(/flash_panel/);
  });
});

/**
 * ⛓ rules F3 — `is_vanilla`, `is_canonical` and `preset_label` are per-world
 * facts: slot maps (`{"<p>": true}` / `{"<p>": "label"}`). The flat document-
 * level value (OR'd / first-wins over every slot by the old exporter) is the
 * retired shape, refused by name.
 */
describe('loadFromJSON — the F3 per-slot flags refuse their document-level value', () => {
  const OLD = { is_vanilla: true, is_canonical: true, preset_label: 'canth s4' };

  for (const [key, value] of Object.entries(OLD)) {
    it(`refuses a document-level \`${key}\` value, naming the key, its home and the script`, () => {
      const doc = { schema_version: 3, [key]: value };
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(new RegExp(`\`${key}\` value`));
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(new RegExp(`${key}\\["<player>"\\]`));
      expect(() => loadFromJSON(stubStateManager(), doc, '1')).toThrow(/migrate-per-player-blocks\.mjs/);
    });

    it(`lets the slot map \`${key}\` through (one slot, two slots)`, () => {
      expect(() => refuseRetiredTopLevelKeys({ [key]: { 1: value } })).not.toThrow();
      expect(() => refuseRetiredTopLevelKeys({ [key]: { 3: value, 4: value } })).not.toThrow();
    });
  }

  it('refuses a document-level `false` too — the VALUE is never read', () => {
    expect(() => refuseRetiredTopLevelKeys({ is_vanilla: false })).toThrow(/`is_vanilla` value/);
  });
});
