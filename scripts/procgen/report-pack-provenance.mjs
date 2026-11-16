#!/usr/bin/env node
// Pack provenance report — counts, per committed content pack and layer, the
// entries each provenance source accounts for (⛓ CONTENT SETS PL-1, Z.7 check 4).
//
// Every pack `frontend/packs/packs.json` lists is loaded through the content-pack
// loader (`loadPackStack`), which already refuses a layer whose entries do not all
// resolve to a listed source; this prints what each source covers, so a reader can
// see at a glance how much of a pack came from a game, a person, a model, a hand,
// or a rule. A source no entry resolves to prints 0 (it is listed for another
// source's `from`, or it is stale).
//
// Usage:
//   node scripts/procgen/report-pack-provenance.mjs
//   node scripts/procgen/report-pack-provenance.mjs --json
//
// --json prints `{ <pack>: { <layer>: { <source id>: { type, count } } } }` instead of the table.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';
import { loadPackStack } from '../../frontend/modules/contentPacks/contentPacks.js';
import { nodePackIo } from '../../frontend/modules/contentPacks/nodePackIo.js';
import { checkLayerProvenance, provenanceCounts } from '../../frontend/modules/contentPacks/provenance.js';

argvHelp(import.meta.url);

/** `{ <pack>: { <layer>: { <source id>: { type, count } } } }` over every pack the registry lists. */
export async function packProvenanceReport(io = nodePackIo()) {
    const registry = JSON.parse(readFileSync(fileURLToPath(new URL('packs.json', io.base)), 'utf8'));
    const out = {};
    for (const { id } of registry.packs) {
        // eslint-disable-next-line no-await-in-loop
        const [loaded] = await loadPackStack([id], io);
        const counts = provenanceCounts(loaded);
        out[id] = {};
        for (const [layer, bySource] of Object.entries(counts)) {
            const { block } = checkLayerProvenance(id, layer, loaded.layers[layer]);
            out[id][layer] = Object.fromEntries(Object.entries(bySource)
                .map(([src, count]) => [src, { type: block.sources[src].type, count }]));
        }
    }
    return out;
}

/** The report as table lines. */
export function reportLines(report) {
    const lines = ['pack            layer      source             type      entries'];
    for (const [pack, layers] of Object.entries(report)) {
        for (const [layer, sources] of Object.entries(layers)) {
            for (const [src, { type, count }] of Object.entries(sources)) {
                lines.push(`${pack.padEnd(16)}${layer.padEnd(11)}${src.padEnd(19)}${type.padEnd(10)}${count}`);
            }
        }
    }
    return lines;
}

async function main() {
    const report = await packProvenanceReport();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }
    for (const line of reportLines(report)) console.log(line);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
