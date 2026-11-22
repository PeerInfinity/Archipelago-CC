#!/usr/bin/env node
/**
 * segtape.mjs — slice rules-l25-wand-witness: compile a HAND-AUTHORED segment list into a witness spec (the plans
 * file's span form). The model (levelRun) refuses a WandShot in a wallflyer room (`MODEL_REFUSES.wand` in
 * probe-seedling-wallflyer-nohit.mjs), so no search exists for the Wand: every Wand tape here is authored by hand,
 * tuned against the GAME's own trace (witness2.mjs), never against a model.
 *
 * A segment file: `{ "case": "l25-26-22-wand", "note": "...", "lead": 5, "segs": [["right+up", 12], ["primary", 1], ["", 8], ...] }`
 * Each seg holds its '+'-joined keys for n ticks ('' = none). `lead` empty ticks come first (the probe's lead).
 * Run: node segtape.mjs <segs.json> --out=<spec.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = await import(join(REPO, 'scripts/procgen/probe-seedling-wallflyer-nohit.mjs'));
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

export function compile(src) {
    const perTick = [];
    for (let i = 0; i < (src.lead ?? 5); i += 1) perTick.push([]);
    for (const [keys, n] of src.segs) for (let i = 0; i < n; i += 1) perTick.push(keys ? keys.split('+').sort() : []);
    return { case: src.case, ticks: perTick.length, inputs: P.spansOf(perTick), note: src.note, segs: src.segs };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const src = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    const spec = compile(src);
    writeFileSync(arg('out'), `${JSON.stringify(spec)}\n`);
    console.log(`wrote ${arg('out')} (${spec.ticks} ticks, ${spec.inputs.length} spans)`);
}
