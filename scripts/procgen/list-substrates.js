#!/usr/bin/env node
/**
 * list-substrates — prints the substrate registry the pipeline drivers see:
 * the entries the libraries in `procgenCore/substrateLibraries.js` register,
 * read LIVE (not the generated docs snapshot), with what each can do.
 *
 * Usage:
 *   node scripts/procgen/list-substrates.js
 *   node scripts/procgen/list-substrates.js --json --layout spiral
 *   node scripts/procgen/list-substrates.js --json --id maze --fields
 * Flags:
 *   --json                   print JSON (kind `substrate-list`) instead of a
 *                            table
 *   --id ID                  only this substrate; repeat for several (an
 *                            unregistered id is a usage error)
 *   --layout L               only substrates a layout can place: sphere
 *                            (sphere-step, dump-sphere-growth), spiral
 *                            (spiral-step, dump-shuffled-spiral), grid
 *                            (dump-grid-growth) or topdown (topdown-step)
 *   --fields                 with --json: add every field the entry declares,
 *                            in the docs matrix's cell form (type, value, short)
 *   --json-status PATH       write the run's status object to a file (not
 *                            `-`: the listing owns stdout); see cliRun.js
 *   -h, --help               print this and exit
 *
 * Each substrate carries its `id`, `label`, the `library` that registered it,
 * `layouts` (`substratePredicates.js` `pipelineLayoutsOf` — the engine's own
 * refusals), its realiser kind, `defaultProcgenParams`, and `capabilities`:
 * every statement of the user-facing chart (`substrateCapabilities.js`) with
 * its answer. `libraries` lists every library with the ids it registered and
 * the error it threw if it could not load headless.
 */

import { argvHelp } from './argvHelp.js';
import { KIND, W, flag, oneOf, parseFlags } from './cliFlags.js';
import { runCli, parseOrUsage, UsageError } from './cliRun.js';

// Substrate libraries (procgenCore/substrateLibraries.js) — loaded by main, not on import.
import { loadPipelineSubstrates } from './registerPipelineSubstrates.js';

import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import {
    PIPELINE_LAYOUTS, pipelineLayoutsOf, regionRealiserKind,
} from '../../frontend/modules/procgenCore/substratePredicates.js';
import { CELL_MARKS, capabilityRows } from '../../frontend/modules/procgenCore/substrateCapabilities.js';
import { fieldNamesOf, shapeRows } from '../../frontend/modules/procgenDocs/registryShape.js';
import { REGISTRY } from '../../frontend/modules/procgenDocs/generated/registry.js';
import { snapshotExpandable } from '../../frontend/modules/substrateRegistryPanel/substrateRegistryPanelLibrary.js';

argvHelp(import.meta.url);

/** ⛓ The JSON's own version; bump when a key changes meaning. */
export const SUBSTRATE_LIST_VERSION = 1;

/** ⛓ The flags this tool takes (cliFlags.js parses them). */
const FLAGS = {
    '--json': flag('json', KIND.on),
    '--id': flag('ids', KIND.list),
    '--layout': flag('layout', oneOf(...Object.values(PIPELINE_LAYOUTS))),
    '--fields': flag('fields', KIND.on),
    '--json-status': W.jsonStatus,
    '-h': W.help,
};

function parseArgs(argv) {
    const out = parseFlags(argv, FLAGS, { json: false, ids: [], layout: null, fields: false },
        { metaUrl: import.meta.url });
    if (out.fields && !out.json) throw new Error('--fields needs --json');
    return out;
}

/**
 * The listing, from the live registry. Exported for the contract test.
 * @param {{ids?: string[], layout?: string|null, fields?: boolean}} opts
 * @param {ReadonlyArray<{library: string, registered: string[], error: string|null}>} loads
 */
export function substrateList({ ids = [], layout = null, fields = false } = {}, loads = []) {
    const all = substrateRegistry.getAll();
    const unknown = ids.filter((id) => !substrateRegistry.has(id));
    if (unknown.length) {
        throw new UsageError(`--id ${unknown.join(', ')}: not registered (registered: ${all.map((e) => e.id).join(', ')})`);
    }
    const entries = all
        .filter((e) => !ids.length || ids.includes(e.id))
        .filter((e) => layout === null || pipelineLayoutsOf(e).includes(layout));
    const libraryOf = new Map(loads.flatMap((l) => l.registered.map((id) => [id, l.library])));
    // ⛓ rows over ALL entries: a statement's `requires` reads its own prerequisite row.
    const rows = capabilityRows(all);
    // ⛓ which fields expand into dotted sub-fields: the panel's rule, off the docs snapshot.
    const fieldRows = fields ? shapeRows(all, fieldNamesOf(all, snapshotExpandable(REGISTRY))) : [];
    const substrates = entries.map((e) => ({
        id: e.id,
        label: e.label ?? null,
        library: libraryOf.get(e.id) ?? null,
        layouts: pipelineLayoutsOf(e),
        realiser: regionRealiserKind(e),
        defaultProcgenParams: e.defaultProcgenParams ?? null,
        capabilities: rows.map((r) => {
            const c = r.cells.find((cell) => cell.id === e.id);
            return { group: r.group, id: r.id, statement: r.statement, kind: c.kind, text: c.text };
        }),
        ...(fields ? {
            fields: Object.fromEntries(fieldRows
                .map((r) => [r.name, r.cells.find((cell) => cell.id === e.id)])
                .filter(([, c]) => c?.present)
                .map(([name, { id, ...cell }]) => [name, cell])),
        } : {}),
    }));
    return {
        kind: 'substrate-list',
        list_version: SUBSTRATE_LIST_VERSION,
        libraries: loads.map((l) => ({ ...l, registered: [...l.registered] })),
        substrates,
    };
}

/** The human table: one line per substrate, then each library that failed. */
function table(list) {
    const lines = [];
    const w = Math.max(2, ...list.substrates.map((s) => s.id.length));
    const lw = Math.max(5, ...list.substrates.map((s) => (s.label ?? '').length));
    for (const s of list.substrates) {
        const can = s.capabilities.filter((c) => c.kind === 'yes' || c.kind === 'partial').length;
        lines.push(`${s.id.padEnd(w)}  ${(s.label ?? '').padEnd(lw)}  layouts: ${(s.layouts.join(',') || '—').padEnd(25)}`
            + `  ${CELL_MARKS.yes} ${can}/${s.capabilities.length}  ${s.library ?? ''}`);
    }
    for (const l of list.libraries.filter((x) => x.error)) lines.push(`⚠ ${l.library} did not load: ${l.error}`);
    return `${lines.join('\n')}\n`;
}

async function main(status) {
    const opts = parseOrUsage(() => parseArgs(process.argv.slice(2)));
    const loads = await loadPipelineSubstrates();
    const list = substrateList(opts, loads);
    process.stdout.write(opts.json ? `${JSON.stringify(list, null, 2)}\n` : table(list));
    status.summary = {
        substrates: list.substrates.length,
        libraries_failed: list.libraries.filter((l) => l.error).length,
    };
}

runCli('list-substrates', import.meta.url, main, { stdoutIsOutput: true });
