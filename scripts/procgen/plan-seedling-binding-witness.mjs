#!/usr/bin/env node
/**
 * plan-seedling-binding-witness — ⛓⛓ THE EVENT-LAYER BINDING LEDGER (slice rules-sharedbinding-witnesses): ONE GAME
 * WITNESS PER RE-ADMITTED `sharedBinding` EVENT.
 *
 * ⚖ rules-4's ruling for R-A3, (c): *"later and per row: re-admit only with a GAME witness for the binding"*; ⚖ the user
 * (2026-11-04): *"(c) after R-A3 lands"*. The derived-rule table holds out every element whose derived rule names an
 * event-layer event (`derivedRuleRows.labelDerivedRows`' `sharedBinding`); it re-admits one only when EVERY event it
 * names has an entry in the LEDGER this script writes (`seedling-binding-witnesses.json`), read by
 * `probe-seedling-derived-rules.mjs`.
 *
 * A ledger entry is the witness's committed tape (`fixtures/binding-witness/<key>.json`, the solver's own `clear-tag`
 * plan, `fidelityBindings.BINDING_WITNESSES`) and the GAME's answer to it, recorded by
 *   node scripts/procgen/probe-seedling-cleartag.mjs --set=bindings --repeat=8 --record=frontend/modules/seedlingDemo/fixtures/binding-witness/oracle.json
 * (the default build, headless logic-only): every run of the solve and of the cut after the write holds the flag
 * and exactly that event among the layer's flags; every run of the cut before the write holds none.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-binding-witness.mjs           # write the tapes and the ledger (from the recording)
 *   node scripts/procgen/plan-seedling-binding-witness.mjs --check   # re-derive both from the committed tapes and recording; exit 1 on drift
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
export const LEDGER_FILE = join(HERE, 'seedling-binding-witnesses.json');
export const ORACLE_FILE = join(MODULE, 'fixtures', 'binding-witness', 'oracle.json');
const AP1_FILE = join(REPO, 'frontend', 'presets', 'seedling_playthrough', 'AP_1', 'AP_1_rules.json');
const rel = (p) => p.slice(REPO.length + 1);
export const tapeFile = (w) => join(MODULE, 'fixtures', 'binding-witness', `${w.key}.json`);

/**
 * The ledger's entry for one witness from its tape and the recording's arms, or a list of why not (the reasons the
 * recording does not witness the binding). Pure: exported for the unit rows.
 */
export function ledgerEntry(w, tapePath, oracle, { solveTicks = null } = {}) {
    const arms = oracle.arms.filter((a) => a.witness === w.key);
    const why = [];
    const byArm = new Map();
    for (const a of arms) {
        if (!byArm.has(a.arm)) byArm.set(a.arm, []);
        byArm.get(a.arm).push(a);
    }
    const solve = byArm.get(`${w.key}-solve`) ?? [];
    const cuts = [...byArm.keys()].filter((k) => k.startsWith(`${w.key}-cut-`)).map((k) => Number(k.slice(`${w.key}-cut-`.length))).sort((a, b) => a - b);
    if (cuts.length !== 2 || cuts[1] !== cuts[0] + 1) why.push(`${w.key}: the recording's cuts are ${JSON.stringify(cuts)}, not T and T + 1`);
    const runsOf = (list, expect) => {
        const ok = list.filter((a) => a.gameFlag === expect && a.modelFlag === expect && a.vsModel?.worst === 0 && !a.error
            && JSON.stringify(a.writes?.bound) === JSON.stringify(expect ? [w.event] : []));
        return `${ok.length}/${list.length}`;
    };
    const result = {
        solve: runsOf(solve, true),
        [`cut-${cuts[0]}`]: runsOf(byArm.get(`${w.key}-cut-${cuts[0]}`) ?? [], false),
        [`cut-${cuts[1]}`]: runsOf(byArm.get(`${w.key}-cut-${cuts[1]}`) ?? [], true),
    };
    for (const [k, v] of Object.entries(result)) {
        const [ok, n] = v.split('/').map(Number);
        if (n !== oracle.repeat || ok !== n) why.push(`${w.key}: ${k} passed ${v} runs (want ${oracle.repeat}/${oracle.repeat})`);
    }
    if (solveTicks && solve.some((a) => JSON.stringify(a.ticks) !== JSON.stringify(solveTicks))) {
        why.push(`${w.key}: a recorded solve stream is not the committed tape's model replay`);
    }
    const unbound = [...new Set(arms.filter((a) => a.gameFlag).flatMap((a) => a.writes?.unbound ?? []))].sort();
    const { level, tag } = w.goal.tag;
    return {
        why,
        entry: {
            event: w.event,
            flag: { level, tag },
            entity: w.goal.presser ? `${w.goal.presser.class}@${w.goal.presser.x},${w.goal.presser.y} in L${w.goal.presser.level}` : w.goal.obstacle,
            verb: w.verb,
            witness: { script: 'scripts/procgen/probe-seedling-cleartag.mjs --set=bindings', key: w.key, tape: rel(tapePath) },
            recorded: { build: oracle.build, oracle: rel(ORACLE_FILE), repeat: oracle.repeat, writeTick: cuts[1], runs: result, unboundWrites: unbound },
        },
    };
}

async function main() {
    const CHECK = process.argv.includes('--check');
    const { BINDING_WITNESSES, bindingMismatches, eventLayerFlags, splitWrites } = await import(join(MODULE, 'fidelityBindings.js'));
    const { clearTagSolve } = await import(join(MODULE, 'fidelityClearTag.js'));
    const { runTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { compactTicks } = await import(join(MODULE, 'fidelityStepOff.js'));
    const levelSource = atlasLevelSource();
    const AP1 = JSON.parse(readFileSync(AP1_FILE, 'utf8'));
    const layer = eventLayerFlags(AP1);
    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };
    const oracle = existsSync(ORACLE_FILE) ? JSON.parse(readFileSync(ORACLE_FILE, 'utf8')) : null;
    check(`the recording ${rel(ORACLE_FILE)} is committed`, oracle !== null);
    if (!oracle) process.exit(1);
    const entries = [];
    for (const w of BINDING_WITNESSES) {
        const why = bindingMismatches(w, AP1);
        check(`${w.key}: the witness asks the layer's own binding of "${w.event}"`, why.length === 0, why.join('; '));
        const s = clearTagSolve(w, levelSource);
        const text = `${JSON.stringify(s.tape, null, 4)}\n`;
        const path = tapeFile(w);
        if (CHECK) {
            const same = existsSync(path) && readFileSync(path, 'utf8') === text;
            check(`${w.key}: the committed ${rel(path)} is the solver's plan today`, same, same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
        } else {
            writeFileSync(path, text);
            console.log(`wrote ${rel(path)}`);
        }
        // The committed tape, replayed by the model: the flag, and exactly this event among the layer's flags.
        const tape = parseTape(JSON.parse(readFileSync(path, 'utf8')));
        const m = runTape(tape, { levelSource });
        const writes = splitWrites(m.earnedClears, layer);
        check(`${w.key}: the model's replay writes exactly "${w.event}" among the layer's flags`,
            JSON.stringify(writes.bound) === JSON.stringify([w.event]), JSON.stringify(writes));
        const { why: rec, entry } = ledgerEntry(w, path, oracle, { solveTicks: compactTicks(m.ticks) });
        check(`${w.key}: the recording (${oracle.build}, --repeat=${oracle.repeat}) witnesses the binding`, rec.length === 0,
            rec.length ? rec.join('; ') : JSON.stringify(entry.recorded.runs));
        entries.push(entry);
    }
    const ledger = {
        $comment: 'GENERATED by scripts/procgen/plan-seedling-binding-witness.mjs from the committed tapes and the game recording '
            + `(${rel(ORACLE_FILE)}) — never hand-edited. Each entry is one event-layer binding put to the game; `
            + 'probe-seedling-derived-rules.mjs re-admits a sharedBinding element only when every event it names has an entry here.',
        witnesses: entries.sort((a, b) => (a.event < b.event ? -1 : 1)),
    };
    const ledgerText = `${JSON.stringify(ledger, null, 1)}\n`;
    if (CHECK) {
        const same = existsSync(LEDGER_FILE) && readFileSync(LEDGER_FILE, 'utf8') === ledgerText;
        check(`the committed ${rel(LEDGER_FILE)} is what the tapes and the recording derive`, same, same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else if (failures === 0) {
        writeFileSync(LEDGER_FILE, ledgerText);
        console.log(`wrote ${rel(LEDGER_FILE)}`);
    }
    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (isEntryPoint(import.meta.url)) await main();
