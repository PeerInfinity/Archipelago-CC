/**
 * apworldEditor/exitSides — **THE EXIT-SIDE MOVES' ROWS** (PRESET SIDECARS M3):
 * `move-exit-side` / `swap-exit-sides` of `rulesDocOps.js`, asked of the OP,
 * over committed payloads and the registry's own `exitSides` declarations
 * (`procgenCore/exitSides.js`).
 *
 * ⛓ Beside `regionLayout.test.js` (M2's rows) and not in it: that file's rows
 * walk every CELL move; these walk every SIDE move, over a different population.
 *
 * ⛓⛓ **POPULATIONS ARE SELECTED BY THE LAW, NEVER BY THE FIELD UNDER TEST.**
 * The corpus rows read every committed entry whose substrate DECLARES
 * `exitSides` and walk every exit × every other side; flags are judged by the
 * side law over the cells, never by what the op wrote; the back-exit rows read
 * the entries whose payload CARRIES `params.backExitSide` (trap 1314).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { linkIsAdjacentOnSide } from '../procgenPipeline/procgenPipelineEngine.js';
import { exitSidesOf } from '../procgenCore/exitSides.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import { SIDE_WORDS, slotLayout } from './regionLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
// ⛓ registration side effect, at module scope (regionLayout.test.js's recipe).
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const bytes = (o) => JSON.stringify(o);
const SIDES = Object.keys(SIDE_WORDS);

function everyRulesPath(dir = PRESETS, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) everyRulesPath(full, out);
        else if (entry.name.endsWith('_rules.json')) out.push(full);
    }
    return out;
}

/** Every `[file, slot, name, entry, doc]` of every sidecar entry on disk. */
const ENTRIES = everyRulesPath().flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('"preset_sidecars"')) return [];
    const doc = JSON.parse(text);
    return Object.entries(doc.preset_sidecars ?? {}).flatMap(([slot, regs]) => Object.entries(regs ?? {})
        .map(([name, entry]) => [relative(PRESETS, file), slot, name, entry, doc]));
});

const declares = (entry) => !!exitSidesOf(substrateRegistry.get(entry?.substrate)).decl;

/** ⛓ THE POPULATION: every entry whose substrate declares `exitSides`. */
const DECLARING = ENTRIES.filter(([, , , entry]) => declares(entry));

/** Every exit × every OTHER side of one entry, as `{op, free}` — `free` = no other exit there. */
function everySideMove(slot, name, entry) {
    const exits = entry.playable_payload?.exits ?? [];
    return exits.flatMap((x) => SIDES.filter((s) => s !== x.side).map((side) => ({
        op: { op: 'move-exit-side', player: slot, region: name, exitId: x.exit_id, side },
        from: x.side,
        free: !exits.some((o) => o !== x && o.side === side),
    })));
}

/** Every unordered pair of exits of one entry on different sides, as a swap op. */
function everySwap(slot, name, entry) {
    const exits = entry.playable_payload?.exits ?? [];
    return exits.flatMap((a, i) => exits.slice(i + 1).filter((b) => b.side !== a.side)
        .map((b) => ({ op: 'swap-exit-sides', player: slot, region: name, exitA: a.exit_id, exitB: b.exit_id })));
}

const applied = (doc, op) => {
    const res = applyRulesDocOp(doc, op);
    if (!res.ok) throw new Error(`unexpectedly refused: ${res.error}`);
    return res;
};

/** The side law's verdict (isTeleporter) for one exit of `name` on `side`, or null when unplaced. */
function lawTeleporter(doc, slot, name, exit, side) {
    const { grid, cells } = slotLayout(doc, slot);
    if (!cells.has(name) || !cells.has(exit.targetRegion)) return null;
    return !linkIsAdjacentOnSide(grid, cells.get(name), side, cells.get(exit.targetRegion));
}

describe('⛓⛓ THE CORPUS CONTROL — every committed entry that declares `exitSides`', () => {
    it('the population is the law\'s, and it is not vacuous: every declaring entry carries exits, and '
        + 'every substrate outside it answers ABSENT', () => {
        expect(DECLARING.length).toBeGreaterThan(0);
        for (const [file, slot, name, entry] of DECLARING) {
            expect(Array.isArray(entry.playable_payload?.exits), `${file} ${slot} ${name}`).toBe(true);
        }
        // ⛓ Every entry OUTSIDE the population is refused by the declaration's
        //   absence, never by name: its substrate's registry answer is `absent`.
        const outside = new Set(ENTRIES.filter(([, , , e]) => !declares(e)).map(([, , , e]) => e.substrate));
        for (const id of outside) {
            expect(exitSidesOf(substrateRegistry.get(id)).absent, id).toBe(true);
        }
        expect(outside.size).toBeGreaterThan(0);
    });

    it('(a) a relabel to every exit\'s OWN side moves 0 bytes — and the op answers it as a no-op', () => {
        let asked = 0;
        for (const [file, slot, name, entry, doc] of DECLARING) {
            const { decl } = exitSidesOf(substrateRegistry.get(entry.substrate));
            for (const x of entry.playable_payload.exits) {
                asked += 1;
                const out = decl.relabel(entry.playable_payload, [{ exitId: x.exit_id, from: x.side, to: x.side }]);
                expect(bytes(out), `${file} ${slot} ${name} ${x.exit_id}`).toBe(bytes(entry.playable_payload));
                const res = applied(doc, { op: 'move-exit-side', player: slot, region: name, exitId: x.exit_id, side: x.side });
                expect(res.doc).toBe(doc);
            }
        }
        expect(asked).toBeGreaterThan(0);
    });

    it('(b) every exit moved to every FREE side and back, and every swap swapped back, is '
        + 'byte-identical to the committed document', () => {
        const drifted = [];
        let moves = 0;
        let swaps = 0;
        for (const [file, slot, name, entry, doc] of DECLARING) {
            const before = bytes(doc);
            for (const { op, from, free } of everySideMove(slot, name, entry)) {
                if (!free) continue;
                moves += 1;
                const there = applied(doc, op).doc;
                const back = applied(there, { ...op, side: from }).doc;
                if (bytes(back) !== before) drifted.push(`${file} ${slot} ${name} ${op.exitId} ${from}→${op.side}`);
            }
            for (const op of everySwap(slot, name, entry)) {
                swaps += 1;
                const back = applied(applied(doc, op).doc, op).doc;
                if (bytes(back) !== before) drifted.push(`${file} ${slot} ${name} ${op.exitA}↔${op.exitB}`);
            }
            expect(bytes(doc), `${file}: an op wrote THROUGH the document`).toBe(before);
        }
        expect(moves).toBeGreaterThan(0);
        expect(swaps).toBeGreaterThan(0);
        expect(drifted).toEqual([]);
    });

    it('(c) the side law reproduces every stored flag of the population — M2\'s two dissenters are '
        + 'omsi, whose substrate declares no `exitSides`, so they are outside it', () => {
        const dissent = [];
        let judged = 0;
        for (const [file, slot, name, entry, doc] of DECLARING) {
            for (const x of entry.playable_payload.exits) {
                const want = lawTeleporter(doc, slot, name, x, x.side);
                if (want === null) continue;
                judged += 1;
                if (want !== (x.isTeleporter === true)) dissent.push(`${file} ${slot} ${name} ${x.exit_id}`);
            }
        }
        expect(judged).toBeGreaterThan(0);
        expect(dissent).toEqual([]);
        const dissenters = ENTRIES.filter(([file, , name]) => file.startsWith('omsi_region_split_test/')
            && (name === 'region_1_0' || name === 'region_0_1'));
        expect(dissenters.length).toBeGreaterThan(0);
        for (const [, , , e] of dissenters) expect(declares(e), e.substrate).toBe(false);
    });
});
