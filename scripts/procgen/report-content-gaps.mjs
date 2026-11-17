#!/usr/bin/env node
// Content gap report — resolves (substrate, the three settings) through the pack resolver and prints its gap report
// (⛓ CONTENT SETS PL-2; Z.5 the resolver, Z.6 the fill rules and the report).
//
// Every number a fill rule wrote, every form a substrate flattened, every entry it could not use and every entry no
// word names is one line, naming its rule as <id>@<version> (frontend/modules/procgenCore/fillRules.js). A settings
// combination the resolver refuses (a numbers pack for another game, `assign` for a substrate with no walk, a pack
// whose graph ActionNodes refuses) prints the refusal and exits 1.
//
// Usage:
//   node scripts/procgen/report-content-gaps.mjs --substrate <id> [--exists a,b] [--content a,b] [--numbers a,b]
//        [--numbers-mode table|assign] [--json] [--document]
//
// Example (the ActionNodes example village, written as a pack):
//   node scripts/procgen/report-content-gaps.mjs --substrate action_nodes --exists example-village
//
// --json prints the report object; --document also prints the resolved document (JSON).
import { argvHelp } from './argvHelp.js';
import { nodePackIo } from '../../frontend/modules/contentPacks/nodePackIo.js';
import { resolveContent } from '../../frontend/modules/packStructure/packResolver.js';
import { SUBSTRATE_LIBRARIES } from '../../frontend/modules/procgenCore/substrateLibraries.js';

argvHelp(import.meta.url);

const USAGE = 'usage: node scripts/procgen/report-content-gaps.mjs --substrate <id> [--exists a,b] [--content a,b] '
    + '[--numbers a,b] [--numbers-mode table|assign] [--json] [--document]';

/**
 * Register every substrate (the libraries self-register on import). Their import-time chatter (a panel's logger, a
 * worker that node has not got) is not this report's output, so the console is quiet while they load.
 */
export async function registerSubstrates() {
    const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    for (const k of Object.keys(saved)) console[k] = () => {};
    try {
        for (const lib of SUBSTRATE_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(new URL(`../../frontend/modules/${lib}`, import.meta.url).href);
        }
    } finally {
        Object.assign(console, saved);
    }
}

/**
 * The gap report of (substrate, settings), resolved over the committed packs: `{ document, report, stacks }`.
 * `registerAll: false` keeps the registry the caller already populated (a test that imported its substrate).
 */
export async function contentGapReport(substrateId, settings = {}, { io = nodePackIo(), registerAll = true } = {}) {
    if (registerAll) await registerSubstrates();
    return resolveContent(substrateId, settings, io);
}

/** The report as lines: a header of the stacks, then one line per row of each section (or "none"). */
export function gapReportLines({ report, stacks }) {
    const lines = [
        `substrate ${report.substrate}  numbersMode ${report.numbersMode}`,
        `  exists  [${stacks.exists.join(', ')}]`,
        `  words   [${stacks.words.join(', ')}]`,
        `  numbers [${stacks.numbers.join(', ')}]${report.numbers.length ? ` (named: ${report.numbers.join(', ')})` : ''}`,
    ];
    const show = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
    for (const section of ['filled', 'flattened', 'unused', 'unnamed']) {
        const rows = report[section];
        lines.push(`${section}: ${rows.length ? rows.length : 'none'}`);
        for (const r of rows) {
            const rest = Object.entries(r).filter(([k]) => !['entry', 'part', 'rule'].includes(k)).map(([k, v]) => `${k} ${show(v)}`);
            lines.push(`  ${r.rule.padEnd(10)}${r.entry}${r.part ? `  ${r.part}` : ''}${rest.length ? `  ${rest.join('  ')}` : ''}`);
        }
    }
    return lines;
}

/** The argv → `{ substrate, settings, json, document }`; throws on an unknown flag. */
export function parseArgs(argv) {
    const out = { settings: {}, json: false, document: false };
    const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') out.json = true;
        else if (a === '--document') out.document = true;
        else if (a === '--substrate') out.substrate = argv[++i];
        else if (a === '--exists') out.settings.exists = list(argv[++i]);
        else if (a === '--content') out.settings.content = list(argv[++i]);
        else if (a === '--numbers') out.settings.numbers = list(argv[++i]);
        else if (a === '--numbers-mode') out.settings.numbersMode = argv[++i];
        else throw new Error(`unknown argument ${a}\n${USAGE}`);
    }
    if (!out.substrate) throw new Error(`--substrate is required\n${USAGE}`);
    return out;
}

async function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (e) {
        console.error(e.message);
        process.exit(2);
    }
    let result;
    try {
        result = await contentGapReport(args.substrate, args.settings);
    } catch (e) {
        console.error(`REFUSED: ${e.message}`);
        process.exit(1);
    }
    if (args.json) console.log(JSON.stringify(args.document ? result : { report: result.report, stacks: result.stacks }, null, 2));
    else {
        for (const line of gapReportLines(result)) console.log(line);
        if (args.document) console.log(JSON.stringify(result.document, null, 2));
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
