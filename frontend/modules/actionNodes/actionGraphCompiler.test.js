// actionNodes/actionGraphCompiler — the compiled world, its A6 proof, and the committed preset.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTION_COMPILE_REFUSALS, ACTION_NODES_DISCOVERY_BUNDLE, ACTION_NODES_SUBSTRATE_ID, ACT_ACTION, compileActionGraph,
    placementsFromRules,
} from './actionGraphCompiler.js';
import { ACTION_NODES_BUNDLE, readWorldDiscoveryMode } from '../discovery/worldDiscoveryMode.js';
import { buildActionModel } from './actionModel.js';
import { resolvedBoostOf } from './actionGraph.js';
import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import { AP_NAMESPACE_ROWS, namespaceNamed } from '../procgenCore/apIdNamespaces.js';
import { GOAL_ITEM, unplacedGoalSentence } from '../procgenCore/goalItem.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { sidecarFieldsOf, sidecarPayloadErrors } from '../procgenCore/sidecarFields.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const GRAPH_PATH = 'frontend/modules/actionNodes/graphs/example-village.json';
const PRESET_PATH = 'frontend/presets/action_nodes_example/AP_1/AP_1_rules.json';
const EXAMPLE = JSON.parse(readFileSync(join(REPO, GRAPH_PATH), 'utf8'));
const { rules, report } = compileActionGraph(EXAMPLE, { graphPath: GRAPH_PATH });
const P = '1';
const model = buildActionModel(EXAMPLE);
const allLocations = Object.values(rules.regions[P]).flatMap((r) => r.locations);

describe('⛓ the committed preset IS the compiled example', () => {
    it('byte-identical (what action-nodes-compile.mjs writes)', () => {
        expect(readFileSync(join(REPO, PRESET_PATH), 'utf8')).toBe(`${stringifyRulesJson(rules)}\n`);
    });
    it('⛔ its preset_files.json row says seed 1 (any other seed makes ?seed=1 load the DEFAULT preset)', () => {
        const row = JSON.parse(readFileSync(join(REPO, 'frontend/presets/preset_files.json'), 'utf8')).action_nodes_example;
        expect(row.folders.AP_1.seed).toBe(1);
        expect(row.folders.AP_1.files).toEqual(['AP_1_rules.json']);
        expect(row.folders.AP_1.games[0].game).toBe(rules.game_name);
    });
});

describe('the compiled world', () => {
    it('validates against rules.schema.json', () => {
        expect(rulesJsonSchemaErrors(rules, loadRulesSchema())).toEqual([]);
    });
    it('one region per node plus Menu; TWO exits per `after` edge (forward + reverse), plus Menu → start', () => {
        expect(Object.keys(rules.regions[P]).sort()).toEqual(['Menu', ...Object.keys(EXAMPLE.nodes)].sort());
        const edges = Object.values(EXAMPLE.nodes).reduce((n, node) => n + new Set((node.after ?? []).flat()).size, 0);
        const exits = Object.values(rules.regions[P]).reduce((n, r) => n + r.exits.length, 0);
        expect(exits).toBe(2 * edges + 1);
    });
    it('⛓ two-way edges: each `after` edge A→B is a gated forward exit and an UNGATED reverse exit B→A', () => {
        const exitOf = (from, to) => rules.regions[P][from].exits.find((e) => e.connected_region === to);
        let pairs = 0;
        for (const [b, node] of Object.entries(EXAMPLE.nodes)) {
            for (const a of new Set((node.after ?? []).flat())) {
                pairs += 1;
                expect(exitOf(a, b), `${a} -> ${b}`).toBeTruthy();
                const back = exitOf(b, a);
                expect(back, `${b} -> ${a}`).toBeTruthy();
                expect(back.access_rule).toEqual({ rule: 'True_' });
                const payloadBack = rules.preset_sidecars[P][b].playable_payload.exits.find((e) => e.targetRegion === a);
                expect(payloadBack.reverse).toBe(true);
                const payloadFwd = rules.preset_sidecars[P][a].playable_payload.exits.find((e) => e.targetRegion === b);
                expect(payloadFwd.reverse).toBeUndefined();
            }
        }
        // No other exit: no return-to-start exit, nothing back to Menu (reaching the start is the Menu → start hop).
        const nodeExits = Object.entries(rules.regions[P]).filter(([r]) => r !== 'Menu').reduce((n, [, r]) => n + r.exits.length, 0);
        expect(nodeExits).toBe(2 * pairs);
        for (const r of Object.values(rules.regions[P])) expect(r.exits.some((e) => e.connected_region === 'Menu')).toBe(false);
    });
    it('⛓ the world names the discovery module\'s actionNodes bundle, and it reads back as that mode', () => {
        expect(rules.discovery_mode[P]).toEqual({ enabled: true, bundle: ACTION_NODES_DISCOVERY_BUNDLE });
        expect(ACTION_NODES_DISCOVERY_BUNDLE).toBe(ACTION_NODES_BUNDLE);
        expect(readWorldDiscoveryMode(rules, P)).toBe(ACTION_NODES_BUNDLE);
    });
    it('the world states its back-exits are LISTED, not assumed (assume_bidirectional_exits: false)', () => {
        expect(rules.exporter[P].assume_bidirectional_exits).toBe(false);
    });
    it('a location per check node, and the goal holds Victory, locked', () => {
        const checks = Object.values(EXAMPLE.nodes).filter((n) => n.kind === 'check').map((n) => n.name);
        const goal = Object.values(EXAMPLE.nodes).find((n) => n.kind === 'goal').name;
        expect(allLocations.map((l) => l.name).sort()).toEqual([...checks, goal].sort());
        const g = allLocations.find((l) => l.name === goal);
        expect(g.item.name).toBe(GOAL_ITEM);
        expect(g.locked).toBe(true);
        expect(unplacedGoalSentence(rules, P)).toBeNull();
        expect(rules.game_info[P].completion_condition).toEqual({ type: 'item_check', item: GOAL_ITEM });
    });
    it('the derived rules: both checks True, the goal Has(Strength Boost)', () => {
        const ruleOf = (name) => allLocations.find((l) => l.name === name).access_rule;
        expect(ruleOf('Guard\'s Locker')).toEqual({ rule: 'True_' });
        expect(ruleOf('Move the Boulder')).toEqual({ rule: 'True_' });
        expect(ruleOf('Leave the Village')).toEqual({ rule: 'Has', args: { item_name: 'Strength Boost' } });
    });
    it('every boon copy is placed once, and the placement reads back', () => {
        const placed = placementsFromRules(rules, model, P);
        const pool = Object.values(EXAMPLE.boons).reduce((n, b) => n + b.count, 0);
        expect(Object.keys(placed)).toHaveLength(pool);
        expect(Object.values(rules.itempool_counts[P]).reduce((a, b) => a + b, 0)).toBe(pool + 1);
    });
    it('ids come from the action-nodes namespace, which overlaps no other row', () => {
        const ns = namespaceNamed('action-nodes');
        for (const l of allLocations) expect(l.id).toBeGreaterThanOrEqual(ns.locationBase);
        for (const row of AP_NAMESPACE_ROWS) {
            if (row.name === 'action-nodes' || row.locationBase == null) continue;
            expect(Math.abs(row.locationBase - ns.locationBase), row.name).toBeGreaterThan(1_000_000);
        }
    });
    it('every sidecar names the substrate and passes its own declaration', () => {
        for (const [region, sc] of Object.entries(rules.preset_sidecars[P])) {
            expect(sc.substrate).toBe(ACTION_NODES_SUBSTRATE_ID);
            expect(sidecarPayloadErrors(sidecarFieldsOf(substrateRegistryEntry), sc.playable_payload), region).toEqual([]);
            const world = substrateRegistryEntry.deserializeWorld(sc.playable_payload);
            expect(world.exits).toBeInstanceOf(Map);
            expect(substrateRegistryEntry.serializeWorld(world)).toEqual(sc.playable_payload);
            expect(substrateRegistryEntry.apExitNamesOf(sc.playable_payload).sort())
                .toEqual(rules.regions[P][region].exits.map((e) => e.name).sort());
            expect(substrateRegistryEntry.apLocationNamesOf(sc.playable_payload))
                .toEqual(rules.regions[P][region].locations.map((l) => l.name));
        }
    });
    it('authored loop costs: every node moves for 0 and acts for its time', () => {
        const lc = rules.loop_costs[P];
        for (const [id, node] of Object.entries(EXAMPLE.nodes)) {
            expect(lc.regions[id].moveCost).toBe(0);
            expect(lc.regions[id].actions[ACT_ACTION]).toBe(node.time);
            expect(lc.regions[id].xpGainScale).toBe(EXAMPLE.settings.xpGainScale);
        }
    });
    it('⛓ the action_nodes block states every item\'s per-item mana boost', () => {
        const block = rules.action_nodes[P];
        for (const b of Object.values(EXAMPLE.boons)) {
            expect(block.boosts[b.name].mana).toBe(resolvedBoostOf(b).mana);
        }
        expect(block.goal).toBe(Object.keys(EXAMPLE.nodes).find((k) => EXAMPLE.nodes[k].kind === 'goal'));
        expect(block.action).toBe(ACT_ACTION);
    });
    it('the graph\'s provenance travels with the world', () => {
        expect(rules.provenance[P].graph_provenance).toEqual(EXAMPLE.provenance);
        expect(rules.procgen_metadata[P].graph_path).toBe(GRAPH_PATH);
    });
});

describe('⛓ the A6 proof', () => {
    it('the sphere log reaches the goal; every check has a witness', () => {
        const picks = rules.sphere_log.flatMap((e) => e.player_data?.[P]?.sphere_locations ?? []);
        expect(picks).toContain('Leave the Village');
        for (const t of Object.values(report.targets)) expect(t.witnesses.length).toBeGreaterThan(0);
        expect(report.a6.spheres.flatMap((s) => s.checks).sort()).toEqual(allLocations.map((l) => l.name).sort());
        expect(report.a6.spheres[0].open_at_once).toBeGreaterThan(1);
    });
    it('refuses a check no loop can earn', () => {
        const g = structuredClone(EXAMPLE);
        g.nodes['guards-locker'].requires = { stats: { knowledge: 5 } };
        expect(() => compileActionGraph(g)).toThrow(ACTION_COMPILE_REFUSALS.CHECK_NEVER_EARNABLE);
    });
    it('refuses a goal the sphere log never reaches', () => {
        // The only Strength Boost sits behind the goal's own requirement: earnable with the item, never in logic.
        const g = structuredClone(EXAMPLE);
        g.nodes['guards-locker'].requires = { stats: { strength: 2 } };
        g.nodes['move-the-boulder'].requires = { stats: { strength: 2 } };
        expect(() => compileActionGraph(g)).toThrow(/fill-failed|goal-not-in-logic/);
    });
    it('is deterministic for a seed', () => {
        expect(stringifyRulesJson(compileActionGraph(EXAMPLE, { graphPath: GRAPH_PATH }).rules)).toBe(stringifyRulesJson(rules));
    });
});
