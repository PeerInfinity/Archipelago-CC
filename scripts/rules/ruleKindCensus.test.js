/**
 * The cross-layer rule-node kind census as a gate (rule-node-registry R1, ⚖ D2 2026-10-21).
 * What it compares and why: `ruleKindCensus.js`. What to do when it fails: each assertion says.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    AST_FACTORIES, PYTHON_VOCAB_PATH, REGISTRY_PATH, census, coreFactoryImports, gapDrift, jsRbHandled,
} from './ruleKindCensus.js';

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
let result;

beforeAll(async () => {
    result = await census({ registry });
}, 120_000);

describe('rule-node kind census', () => {
    it('reads the AST handler factories core.js actually merges', () => {
        expect(coreFactoryImports()).toEqual(
            Object.entries(AST_FACTORIES).map(([file, fn]) => `${file}:${fn}`).sort());
    });

    it('probes the Rule Builder switch for real: a known case is handled, an invented name is not', async () => {
        const handled = await jsRbHandled(['And', 'Has', 'NoSuchKind_census_probe']);
        expect([...handled].sort()).toEqual(['And', 'Has']);
    });

    it('has a Python vocabulary snapshot covering every layer the census reads', () => {
        const layers = Object.keys(JSON.parse(readFileSync(PYTHON_VOCAB_PATH, 'utf8')).layers);
        for (const layer of ['exporter.emits_ast', 'converter.ast_to_rb.converts', 'rule_builder.serialises',
            'world_generator.rb', 'world_generator.helper_ast', 'world_generator.helper_rb', 'converter.rb_to_ast.converts']) {
            expect(layers, `regenerate with: python scripts/rules/rule_kind_vocab.py --write`).toContain(layer);
        }
    });

    it('registers every kind some layer emits or handles', () => {
        expect(result.unregistered,
            'add these to kinds in frontend/schema/rule-kinds.json (with the capability each needs)').toEqual([]);
    });

    it('registers no kind that no layer knows any more', () => {
        expect(result.stale, 'remove these from kinds in frontend/schema/rule-kinds.json').toEqual([]);
    });

    it('gives every kind a capability from the registry list', () => {
        expect(result.badCapability).toEqual([]);
    });

    it('has exactly the known gaps — a new one fails by name, a closed one must be removed', () => {
        const drift = gapDrift(result.gaps, registry.known_gaps)
            .map(({ obligation, kind, change }) => `${obligation} ${kind}: ${change}`);
        expect(drift, 'a NEW gap means a layer cannot handle a kind another layer emits: '
            + 'handle it there (docs/json/developer/reference/rule-kind-registry.md)').toEqual([]);
    });

    it('keeps the gap total at its ceiling (the list may only shrink: lower the ceiling with it)', () => {
        const listed = Object.values(registry.known_gaps).reduce((n, g) => n + g.length, 0);
        expect(listed).toBe(registry.gap_ceiling);
        expect(result.totalGaps).toBeLessThanOrEqual(registry.gap_ceiling);
    });
});
