#!/usr/bin/env node
/**
 * can-cross-seedling — ⛓⛓⛓ SEEDLING FIDELITY CANCROSS: ASK THE SOLVER WHETHER
 * THE BOT CAN CROSS ONE ROOM, FROM AN ARRIVAL, WITH AN INVENTORY.
 *
 * ⚖ The user, 2026-10-04: *"… we shouldn't hardcode it. We should derive the
 * requirements from what the solver can do."* This is the command-line face of
 * `seedlingDemo/seedlingCanCross.canCross`: one deterministic, budgeted verdict
 * (`can` / `cannot` / `undecided` / `model-refused`), the solver's stamp, and on
 * `can` the witness tape a certifier can play on the game. No box lock: it
 * plays nothing and drives no browser.
 *
 * Run:
 *   node scripts/procgen/can-cross-seedling.mjs --level=14 --exit=15 --from=13
 *   node scripts/procgen/can-cross-seedling.mjs --level=14 --exit=15 --from=13 --inventory=sword,spear --json
 *   node scripts/procgen/can-cross-seedling.mjs --level=16 --exit=17 --spawn=32,64 --inventory=sword --dash=none
 *   node scripts/procgen/can-cross-seedling.mjs --level=14 --exit=15 --from=13 --budget=0      # a tiny budget: undecided
 *   node scripts/procgen/can-cross-seedling.mjs --level=14 --exit=15 --from=13 --witness=/tmp/w.json
 *   node scripts/procgen/can-cross-seedling.mjs --level=14 --exit=15 --from=13 --no-budget --budget-ms=5000
 *   node scripts/procgen/can-cross-seedling.mjs --level=6 --exit=7 --from=5 --time=6138 --persistence=5:0 --primary=0
 *
 * Flags: `--level=<n>` (required); `--exit=<to-level>` or `--exit=<x>,<y>` (a door);
 * `--from=<level>` (the door the game lands you by) or `--spawn=<x>,<y>`;
 * `--inventory=a,b` (`tapeFormat.ITEM_PROPERTIES` names); `--primary=<slot>`;
 * `--time=<save.time>`; `--persistence=<level>:<tag>,…`; `--dash=none|full|all`;
 * `--budget=<consults>` (deterministic, default `DEFAULT_CONSULT_BUDGET`) or
 * `--budget-ms=<ms>` (wall clock, marked non-deterministic) or `--no-budget`;
 * `--json` (the whole result, the witness tape included); `--witness=<path>`
 * (write the witness tape on `can`). Exit 0 on any verdict; 2 on a bad request.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

/** `--name=<value>`'s value in `argv`, or undefined. */
const opt = (name, argv) => argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const pair = (s) => s.split(',').map(Number);

/** argv → the `canCross` request (throws a plain Error on a malformed flag). */
export function requestFromArgv(argv) {
    const level = Number(opt('--level', argv));
    const exitRaw = opt('--exit', argv);
    const from = opt('--from', argv);
    const spawn = opt('--spawn', argv);
    const inv = opt('--inventory', argv);
    const primary = opt('--primary', argv);
    const time = opt('--time', argv);
    const pers = opt('--persistence', argv);
    const dash = opt('--dash', argv);
    const budget = opt('--budget', argv);
    const budgetMs = opt('--budget-ms', argv);
    if (!Number.isInteger(level)) throw new Error('--level=<n> is required');
    if (exitRaw === undefined) throw new Error('--exit=<to-level> or --exit=<x>,<y> is required');
    const exit = exitRaw.includes(',') ? (([x, y]) => ({ x, y }))(pair(exitRaw)) : Number(exitRaw);
    let arrival;
    if (from !== undefined) arrival = { from: Number(from) };
    else if (spawn !== undefined) arrival = (([x, y]) => ({ x, y }))(pair(spawn));
    else throw new Error('--from=<level> or --spawn=<x>,<y> is required (there is no default spawn)');
    const req = { level, exit, arrival, inventory: inv ? inv.split(',').filter(Boolean) : [] };
    if (primary !== undefined) req.primary = Number(primary);
    if (time !== undefined) req.time = Number(time);
    if (pers !== undefined) {
        req.persistence = pers.split(',').filter(Boolean).map((p) => {
            const [l, t] = p.split(':').map(Number);
            return { level: l, tag: t };
        });
    }
    if (dash !== undefined) req.dashMode = dash;
    if (argv.includes('--no-budget')) req.budget = null;
    else if (budgetMs !== undefined) req.budget = { ms: Number(budgetMs) };
    else if (budget !== undefined) req.budget = { consults: Number(budget) };
    return req;
}

async function main() {
    const { canCross, CanCrossError } = await import(join(MODULE, 'seedlingCanCross.js'));
    const argv = process.argv.slice(2);
    let r;
    try {
        r = canCross(requestFromArgv(argv));
    } catch (e) {
        if (!(e instanceof CanCrossError) && e.constructor !== Error) throw e;
        console.error(`can-cross-seedling: ${e.message}`);
        process.exit(2);
    }
    const witnessPath = opt('--witness', argv);
    if (witnessPath && r.witness) {
        writeFileSync(witnessPath, `${JSON.stringify(r.witness.tape, null, 4)}\n`);
    }
    if (argv.includes('--json')) {
        console.log(JSON.stringify(r, null, 2));
        return;
    }
    console.log(`L${r.request.level} → ${r.request.to ?? JSON.stringify(r.request.goal)}  `
        + `inventory [${r.arrival.items.join(', ')}]  arrival ${r.arrival.source} `
        + `(${r.arrival.spawn.x},${r.arrival.spawn.y})  dash ${r.request.dashMode}`);
    console.log(`VERDICT: ${r.verdict}  (${r.cause.kind}, basis ${r.cause.basis})  ${r.ms} ms  `
        + `budget ${r.budget.kind} ${r.budget.consults} consult(s)${r.budget.deterministic ? '' : ' ⚠ NON-DETERMINISTIC'}`);
    if (r.plan) console.log(`plan: ${r.plan.ticks} t, hash ${r.plan.hash}, rungs [${r.plan.rungs.join(', ')}]`);
    console.log(`why: ${r.why.replace(/\s+/g, ' ').slice(0, 600)}`);
    if (r.arrival.assumed.length) console.log(`assumed: ${r.arrival.assumed.join('; ')}`);
    if (r.witness) {
        console.log(`witness: tape v${r.witness.tape.tape_version}, ${r.witness.tape.tick_count} t; model replay `
            + `${r.witness.replayed.observations} obs → L${r.witness.replayed.landed} `
            + `${r.witness.replayed.agrees ? 'AGREES' : '⛔ DISAGREES'}${witnessPath ? ` → ${witnessPath}` : ''}`);
    }
    console.log(`solver: ${r.solver.id} (${r.solver.files} files)`);
}

if (isEntryPoint(import.meta.url)) await main();
