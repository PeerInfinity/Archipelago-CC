/**
 * apworldEditor/regionLayout — **THE MAP MOVES' ROWS** (PRESET SIDECARS M2): the
 * `move-region` / `swap-regions` ops of `rulesDocOps.js`, asked of the OP, and
 * the layout module behind them.
 *
 * ⛓ These rows live beside the sibling rather than in `rulesDocOps.test.js`,
 * whose fixture is built and depends on no preset file by design: a move's
 * write-back goes through each payload's OWN substrate serializer, so the rows
 * need committed payloads and a registry with the substrates in it.
 *
 * ⛓⛓ **POPULATIONS ARE SELECTED BY THE LAW, NEVER BY THE FIELD UNDER TEST.**
 * The fixture rows walk EVERY move to every empty cell and EVERY swap of a
 * slot, and the flag rows read every exit whose endpoints are both on the map —
 * never "the exits that are teleporters", which is the field the op writes
 * (a row selected by it filters its own mutant out).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { linkIsAdjacentOnSide } from '../procgenPipeline/procgenPipelineEngine.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { MAP_SIZE_IS_THE_EXTENT, NO_LINK_BECAME_TELEPORTER, applyRulesDocOp } from './rulesDocOps.js';
import {
    NO_EXITS_KEY_KEPT_ABSENT, SIDE_WORDS, rewriteExitFlags, slotLayout,
} from './regionLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
// ⛓ registration side effect, at module scope (the sidecarIssues.test.js recipe):
//   the write-back asks each payload's own substrate, so every one is loaded.
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const read = (rel) => JSON.parse(readFileSync(join(PRESETS, rel), 'utf8'));
const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');

/** ⛓ The fixture's slot 1, and the first slot whose payload FAMILY differs. */
const SLOTS = Object.keys(FOUR.preset_sidecars);
const substrateOf = (slot) => Object.values(FOUR.preset_sidecars[slot])[0].substrate;
const MAZE_SLOT = SLOTS[0];
const OTHER_SLOT = SLOTS.find((s) => substrateOf(s) !== substrateOf(MAZE_SLOT));

/** Every cell of a slot's map that no region holds, row-major. */
function emptyCells(doc, slot) {
    const { grid } = slotLayout(doc, slot);
    const out = [];
    for (let gy = 0; gy < grid.height; gy += 1) {
        for (let gx = 0; gx < grid.width; gx += 1) {
            if (!grid.hasRegion({ gx, gy })) out.push({ gx, gy });
        }
    }
    return out;
}

/** Every move to an empty cell and every swap of a slot, in a stable order. */
function everyChange(doc, slot) {
    const names = [...slotLayout(doc, slot).cells.keys()];
    const moves = names.flatMap((region) => emptyCells(doc, slot)
        .map((to) => ({ op: 'move-region', player: slot, region, to })));
    const swaps = names.flatMap((a, i) => names.slice(i + 1)
        .map((b) => ({ op: 'swap-regions', player: slot, a, b })));
    return { moves, swaps };
}

/** Leaf paths at which two JSON values differ (added / removed keys included). */
function leafDiff(a, b, path = [], out = []) {
    if (a && b && typeof a === 'object' && typeof b === 'object'
        && Array.isArray(a) === Array.isArray(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            leafDiff(a[k], b[k], [...path, k], out);
        }
    } else if (bytes(a) !== bytes(b)) {
        out.push(path.join('.'));
    }
    return out;
}

/**
 * ⛓ The side law's verdict for every exit of a slot whose endpoints are BOTH on
 * the map — `[{where, want, got}]`. The population is chosen by where the exit
 * and its target SIT, never by its flag.
 */
function lawVerdicts(doc, slot) {
    const { grid, cells } = slotLayout(doc, slot);
    const out = [];
    for (const [name, entry] of Object.entries(doc.preset_sidecars[slot])) {
        for (const x of entry.playable_payload?.exits ?? []) {
            if (!cells.has(name) || !cells.has(x.targetRegion) || !Object.hasOwn(SIDE_WORDS, x.side)) continue;
            out.push({
                where: `${name} ${x.exit_id} (${x.side} → ${x.targetRegion})`,
                want: !linkIsAdjacentOnSide(grid, cells.get(name), x.side, cells.get(x.targetRegion)),
                got: x.isTeleporter === true,
            });
        }
    }
    return out;
}

/**
 * ⛓⛓ THE EXITS A CHANGE SHOULD FLIP, BY THE LAW — the side law's verdict for each
 * placed exit over the cells BEFORE and the cells the change would leave, never
 * the op's own answer (the field under test: a row that chose its move by what
 * the op wrote would lose the move under the mutant that skips the write).
 * → `[[region, exit]]`.
 */
function lawFlips(doc, slot, op) {
    const { grid, cells } = slotLayout(doc, slot);
    const after = new Map(cells);
    if (op.op === 'move-region') after.set(op.region, op.to);
    else { after.set(op.a, cells.get(op.b)); after.set(op.b, cells.get(op.a)); }
    const out = [];
    for (const [name, entry] of Object.entries(doc.preset_sidecars[slot])) {
        for (const x of entry.playable_payload?.exits ?? []) {
            if (!cells.has(name) || !cells.has(x.targetRegion) || !Object.hasOwn(SIDE_WORDS, x.side)) continue;
            const was = linkIsAdjacentOnSide(grid, cells.get(name), x.side, cells.get(x.targetRegion));
            const now = linkIsAdjacentOnSide(grid, after.get(name), x.side, after.get(x.targetRegion));
            if (was !== now) out.push([name, x]);
        }
    }
    return out;
}

/** ⛓ Every exit's LINK fields — what a move must never change. */
const linksOf = (doc, slot) => Object.fromEntries(Object.entries(doc.preset_sidecars[slot])
    .map(([n, e]) => [n, (e.playable_payload?.exits ?? []).map((x) => ({
        exit_id: x.exit_id, side: x.side, targetRegion: x.targetRegion,
        targetExitId: x.targetExitId, isBackExit: x.isBackExit,
    }))]));

const cellOf = (doc, slot, name) => doc.preset_sidecars[slot][name].grid_cell;
const cellStr = (c) => `(${c.gx},${c.gy})`;
const applied = (doc, op) => {
    const res = applyRulesDocOp(doc, op);
    if (!res.ok) throw new Error(`unexpectedly refused: ${res.error}`);
    return res;
};

describe('the fixture', () => {
    it('slot 1 has empty cells, a second payload family exists, and both slots already obey '
        + 'the side law (the premise every flag row below stands on)', () => {
        expect(emptyCells(FOUR, MAZE_SLOT).length).toBeGreaterThan(0);
        expect(emptyCells(FOUR, OTHER_SLOT).length).toBeGreaterThan(0);
        expect(substrateOf(OTHER_SLOT)).not.toBe(substrateOf(MAZE_SLOT));
        for (const slot of [MAZE_SLOT, OTHER_SLOT]) {
            const v = lawVerdicts(FOUR, slot);
            expect(v.length, slot).toBeGreaterThan(0);
            expect(v.filter((r) => r.want !== r.got), slot).toEqual([]);
        }
    });
});

describe.each([['maze family', () => MAZE_SLOT], ['a second payload family', () => OTHER_SLOT]])(
    'every move and every swap on the four-player fixture — %s',
    (_family, slotOf) => {
        it('⛔ the deep diff holds ONLY `grid_cell`s and exit `isTeleporter` flags; '
            + '`regions` is byte-equal', () => {
            const slot = slotOf();
            const { moves, swaps } = everyChange(FOUR, slot);
            const allowed = new RegExp(`^preset_sidecars\\.${slot}\\.[^.]+\\.(grid_cell\\.g[xy]`
                + '|playable_payload\\.exits\\.\\d+\\.isTeleporter)$');
            for (const op of [...moves, ...swaps]) {
                const res = applied(FOUR, op);
                const diff = leafDiff(FOUR, res.doc);
                const label = bytes(op);
                expect(diff.length, label).toBeGreaterThan(0);
                expect(diff.filter((p) => !allowed.test(p)), label).toEqual([]);
                expect(bytes(res.doc.regions), label).toBe(bytes(FOUR.regions));
                expect(linksOf(res.doc, slot), label).toEqual(linksOf(FOUR, slot));
            }
        });

        it('a move writes the region\'s new cell and no other cell', () => {
            const slot = slotOf();
            for (const op of everyChange(FOUR, slot).moves) {
                const res = applied(FOUR, op);
                for (const name of Object.keys(FOUR.preset_sidecars[slot])) {
                    expect(cellOf(res.doc, slot, name), `${bytes(op)} ${name}`)
                        .toEqual(name === op.region ? op.to : cellOf(FOUR, slot, name));
                }
            }
        });

        it('a swap exchanges exactly the two cells', () => {
            const slot = slotOf();
            for (const op of everyChange(FOUR, slot).swaps) {
                const res = applied(FOUR, op);
                for (const name of Object.keys(FOUR.preset_sidecars[slot])) {
                    const want = name === op.a ? cellOf(FOUR, slot, op.b)
                        : name === op.b ? cellOf(FOUR, slot, op.a) : cellOf(FOUR, slot, name);
                    expect(cellOf(res.doc, slot, name), `${bytes(op)} ${name}`).toEqual(want);
                }
            }
        });

        it('⛓⛓ after every move and every swap, EVERY placed exit of the slot carries the side '
            + 'law\'s verdict', () => {
            const slot = slotOf();
            const { moves, swaps } = everyChange(FOUR, slot);
            let flipped = 0;
            for (const op of [...moves, ...swaps]) {
                const res = applied(FOUR, op);
                const v = lawVerdicts(res.doc, slot);
                expect(v.filter((r) => r.want !== r.got), bytes(op)).toEqual([]);
                flipped += leafDiff(FOUR, res.doc).filter((p) => p.endsWith('isTeleporter')).length;
            }
            // ⛔ non-vacuity: the walk did flip flags (a slot where no change flips one
            //    would pass with a relayout that writes nothing).
            expect(flipped).toBeGreaterThan(0);
        });

        it('⛔ never mutates the document it is handed (the payload is cloned before its '
            + 'substrate deserializes it)', () => {
            // ⛓ its OWN copy of the fixture: a write-through in an earlier row would
            //   otherwise already sit in `before`, and this row could not see it.
            const slot = slotOf();
            const doc = clone(FOUR);
            const before = bytes(doc);
            for (const op of Object.values(everyChange(doc, slot)).flat()) applied(doc, op);
            expect(bytes(doc)).toBe(before);
        });
    },
);

describe('the description names the move and every link whose kind it changed', () => {
    /** The first move of slot 1 (entry order × empty cells) the side LAW says flips an exit. */
    const firstSeparatingMove = () => everyChange(FOUR, MAZE_SLOT).moves
        .find((op) => lawFlips(FOUR, MAZE_SLOT, op).length > 0);

    it('a move that separates a link: "Moved R (a,b) → (c,d); N link(s) became …", naming '
        + 'both regions and both sides', () => {
        const op = firstSeparatingMove();
        expect(op).toBeTruthy();
        const res = applied(FOUR, op);
        const from = cellOf(FOUR, MAZE_SLOT, op.region);
        expect(res.description.startsWith(`Moved ${op.region} ${cellStr(from)} → ${cellStr(op.to)}; `))
            .toBe(true);
        expect(res.description).toMatch(/\d+ links? became (a teleporter|teleporters): /);
        expect(res.description).not.toContain(NO_LINK_BECAME_TELEPORTER);
        // Every exit the LAW says the move flips is named, by its region and its side's word.
        const flippedExits = lawFlips(FOUR, MAZE_SLOT, op);
        expect(flippedExits.length).toBeGreaterThan(0);
        for (const [r, x] of flippedExits) {
            expect(res.description, `${r} ${x.exit_id}`).toContain(`${r} ${SIDE_WORDS[x.side]}`);
        }
    });

    it('a move that changes no link\'s kind says "no link became a teleporter" — and moving it '
        + 'back names the teleporter that became a plain link again', () => {
        const op = firstSeparatingMove();
        const once = applied(FOUR, op);
        const from = cellOf(FOUR, MAZE_SLOT, op.region);
        // A second move of the same region, to another empty cell, that flips nothing.
        const quiet = emptyCells(once.doc, MAZE_SLOT)
            .map((to) => ({ ...op, to }))
            .filter((o) => !(o.to.gx === from.gx && o.to.gy === from.gy))
            .map((o) => [o, applyRulesDocOp(once.doc, o)])
            .find(([o, r]) => r.ok && lawFlips(once.doc, MAZE_SLOT, o).length === 0);
        expect(quiet, 'a quiet second move exists on the fixture').toBeTruthy();
        const [, quietRes] = quiet;
        expect(quietRes.description.endsWith(`; ${NO_LINK_BECAME_TELEPORTER}`)).toBe(true);
        expect(leafDiff(once.doc, quietRes.doc).every((p) => /grid_cell\.g[xy]$/.test(p))).toBe(true);

        const back = applied(once.doc, { ...op, to: from });
        expect(back.description).toMatch(/became (a plain link|plain links) again: /);
        expect(bytes(back.doc)).toBe(bytes(FOUR));
    });

    it('a swap: "Swapped A (a,b) ↔ B (c,d); …"', () => {
        const [op] = everyChange(FOUR, MAZE_SLOT).swaps;
        const res = applied(FOUR, op);
        expect(res.description.startsWith(`Swapped ${op.a} ${cellStr(cellOf(FOUR, MAZE_SLOT, op.a))} `
            + `↔ ${op.b} ${cellStr(cellOf(FOUR, MAZE_SLOT, op.b))}; `)).toBe(true);
    });
});

describe('refusals — asked of the op, each by name, the document untouched', () => {
    const slot = MAZE_SLOT;
    const names = () => [...slotLayout(FOUR, slot).cells.keys()];
    const refused = (doc, op) => {
        const before = bytes(doc);
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, bytes(op)).toBe(false);
        expect(bytes(doc)).toBe(before);
        return res.error;
    };

    it('⛔ an OCCUPIED target, as a move — never an overwrite; it names the occupant and the swap', () => {
        const [a, b] = names();
        const error = refused(FOUR, { op: 'move-region', player: slot, region: a, to: cellOf(FOUR, slot, b) });
        expect(error).toContain(`occupied by region "${b}"`);
        expect(error).toContain('swap-regions');
    });

    it('⛔ a target OUTSIDE the map — the extent of the slot\'s grid_cells; a move never grows it', () => {
        const [a] = names();
        const { grid } = slotLayout(FOUR, slot);
        for (const to of [{ gx: grid.width, gy: 0 }, { gx: 0, gy: grid.height }, { gx: -1, gy: 0 }]) {
            const error = refused(FOUR, { op: 'move-region', player: slot, region: a, to });
            expect(error).toContain(`outside player ${slot}'s map, which is ${grid.width}×${grid.height} cells`);
        }
    });

    it('⛔ an unknown region, and a region whose entry carries no grid_cell', () => {
        const [a] = names();
        const to = emptyCells(FOUR, slot)[0];
        expect(refused(FOUR, { op: 'move-region', player: slot, region: 'Nowhere', to }))
            .toContain('no sidecar entry for region "Nowhere"');
        const noCell = clone(FOUR);
        delete noCell.preset_sidecars[slot][a].grid_cell;
        expect(refused(noCell, { op: 'move-region', player: slot, region: a, to }))
            .toContain(`region "${a}" carries no usable \`grid_cell\` (got none)`);
        const [, b] = names();
        expect(refused(noCell, { op: 'swap-regions', player: slot, a: b, b: a }))
            .toContain(`region "${a}" carries no usable \`grid_cell\``);
        expect(refused(FOUR, { op: 'swap-regions', player: slot, a, b: 'Nowhere' }))
            .toContain('no sidecar entry for region "Nowhere"');
    });

    it('⛔ a malformed target and a missing name', () => {
        const [a] = names();
        for (const to of [undefined, { gx: '1', gy: 0 }, { gx: 0.5, gy: 0 }, [1, 0]]) {
            expect(refused(FOUR, { op: 'move-region', player: slot, region: a, to }))
                .toContain('needs `to` as a cell {gx, gy}');
        }
        expect(refused(FOUR, { op: 'move-region', player: slot, to: { gx: 0, gy: 0 } }))
            .toContain('move-region needs a region NAME');
    });

    it('⛔ two regions sharing one cell — the map cannot say which one a move vacates', () => {
        const [a, b] = names();
        const clash = clone(FOUR);
        clash.preset_sidecars[slot][b].grid_cell = { ...cellOf(FOUR, slot, a) };
        expect(refused(clash, { op: 'move-region', player: slot, region: a, to: emptyCells(FOUR, slot)[0] }))
            .toMatch(/both sit at \(\d+,\d+\)/);
    });

    it('⛔ a flag the substrate cannot re-serialize is refused, never hand-written', () => {
        const op = everyChange(FOUR, slot).moves.find((o) => lawFlips(FOUR, slot, o).length > 0);
        const [[flippedRegion]] = lawFlips(FOUR, slot, op);
        const orphan = clone(FOUR);
        const unregistered = `${substrateOf(slot)}-not-registered`;
        expect(substrateRegistry.get(unregistered)).toBeFalsy();
        orphan.preset_sidecars[slot][flippedRegion].substrate = unregistered;
        const error = refused(orphan, op);
        expect(error).toContain(`region "${flippedRegion}"`);
        expect(error).toContain(`"${unregistered}"`);
        expect(error).toContain('no module registers it here');
    });

    it('a move to the region\'s own cell and a swap with itself are NO-OPs, not refusals', () => {
        const [a] = names();
        const stay = applied(FOUR, { op: 'move-region', player: slot, region: a, to: cellOf(FOUR, slot, a) });
        expect(stay.doc).toBe(FOUR);
        const self = applied(FOUR, { op: 'swap-regions', player: slot, a, b: a });
        expect(self.doc).toBe(FOUR);
    });
});

describe('through a session', () => {
    it('one op per gesture; each undo restores the bytes before it', () => {
        const session = createEditSession(rulesEditAdapter, clone(FOUR));
        const { moves, swaps } = everyChange(FOUR, MAZE_SLOT);
        const s0 = bytes(session.record());
        expect(session.apply(moves[0]).applied).toBe(true);
        const s1 = bytes(session.record());
        expect(session.apply(swaps[0]).applied).toBe(true);
        expect(session.ops().map((o) => o.op)).toEqual(['move-region', 'swap-regions']);
        session.undo();
        expect(bytes(session.record())).toBe(s1);
        session.undo();
        expect(bytes(session.record())).toBe(s0);
        expect(s0).toBe(bytes(FOUR));
    });

    it('a no-op move is dropped by the session, not recorded', () => {
        const session = createEditSession(rulesEditAdapter, clone(FOUR));
        const [a] = slotLayout(FOUR, MAZE_SLOT).cells.keys();
        const res = session.apply({ op: 'move-region', player: MAZE_SLOT, region: a, to: cellOf(FOUR, MAZE_SLOT, a) });
        expect(res.applied).toBe(false);
        expect(session.ops()).toEqual([]);
    });
});

/* ── the committed corpus ────────────────────────────────────────────────── */

function everyRulesPath(dir = PRESETS, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) everyRulesPath(full, out);
        else if (entry.name.endsWith('_rules.json')) out.push(full);
    }
    return out;
}

/** Every `[file, slot, name, entry]` of every slot that has a `grid_cell`. */
const PLACED = everyRulesPath().flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    if (!text.includes('"grid_cell"')) return [];
    const doc = JSON.parse(text);
    return Object.entries(doc.preset_sidecars ?? {}).flatMap(([slot, regs]) => {
        const entries = Object.entries(regs ?? {});
        if (!entries.some(([, e]) => e?.grid_cell)) return [];
        return entries.map(([name, entry]) => [relative(PRESETS, file), slot, name, entry, doc]);
    });
});

/**
 * ⛓ The side law's two NAMED dissenters in the corpus: a hand-authored omsi
 * split whose diagonal links are stored `false` — not adjacent on any side, so
 * the law (and the any-side adjacency the top-down driver uses) calls them
 * teleporters. A move re-judges an exit only when it changes the verdict, so
 * these keep their stored flag until one of their regions moves.
 */
const LAW_DISSENT = [
    'omsi_region_split_test/AP_14089154938208861744/AP_14089154938208861744_rules.json 1 region_1_0 exit_to_region_0_1',
    'omsi_region_split_test/AP_14089154938208861744/AP_14089154938208861744_rules.json 1 region_0_1 exit_to_region_1_0',
];

describe('the committed corpus', () => {
    it('⛓⛓ THE CORPUS CONTROL — a no-op write-back of every placed entry moves 0 bytes of `exits`', () => {
        const bySubstrate = {};
        const moved = [];
        const absent = [];
        for (const [file, slot, name, entry] of PLACED) {
            bySubstrate[entry.substrate] = (bySubstrate[entry.substrate] ?? 0) + 1;
            const res = rewriteExitFlags(entry, new Map());
            if (res.absent) { absent.push(`${file} ${slot} ${name}`); continue; }
            expect(res.unwritable, `${file} ${slot} ${name}`).toBeUndefined();
            if (bytes(res.exits) !== bytes(entry.playable_payload.exits)) moved.push(`${file} ${slot} ${name}`);
        }
        expect(PLACED.length).toBeGreaterThan(0);
        expect(moved, JSON.stringify(bySubstrate)).toEqual([]);
        // ⛓ NO_EXITS_KEY_KEPT_ABSENT: every entry the write-back skips truly carries no key.
        for (const where of absent) {
            const [file, slot, name] = where.split(' ');
            const hit = PLACED.find(([f, s, n]) => f === file && s === slot && n === name);
            expect(Object.hasOwn(hit[3].playable_payload ?? {}, 'exits'), `${where}: ${NO_EXITS_KEY_KEPT_ABSENT}`)
                .toBe(false);
        }
    });

    it('⛓⛓ THE LAW\'S PROOF — every stored flag of a placed exit is the side law\'s verdict, '
        + 'but the named dissenters', () => {
        const dissent = [];
        let judged = 0;
        const seen = new Set();
        for (const [file, slot, , , doc] of PLACED) {
            const key = `${file} ${slot}`;
            if (seen.has(key)) continue;
            seen.add(key);
            for (const r of lawVerdicts(doc, slot)) {
                judged += 1;
                if (r.want !== r.got) dissent.push(`${file} ${slot} ${r.where.split(' ').slice(0, 2).join(' ')}`);
            }
        }
        expect(judged).toBeGreaterThan(0);
        expect(dissent.sort()).toEqual([...LAW_DISSENT].sort());
    });
});

/** The extent of a slot's `grid_cell`s alone — what the map would be with no recorded size. */
const extentsOf = (doc, slot) => {
    const cells = Object.values(doc.preset_sidecars[slot]).map((e) => e.grid_cell).filter(Boolean);
    return { width: Math.max(...cells.map((c) => c.gx)) + 1, height: Math.max(...cells.map((c) => c.gy)) + 1 };
};
const shrinks = (before, after, slot) => {
    const [a, b] = [extentsOf(before, slot), extentsOf(after, slot)];
    return b.width < a.width || b.height < a.height;
};

/**
 * ⛓⛓ THE MAP'S SIZE — `mapBoundsFor`, the Map's own rule (⚖ planner, M2): the
 * larger of the extents and `procgen_metadata.grid_dims`. A move that empties
 * the last row or column shrinks the EXTENTS; with a recorded size the map keeps
 * it, without one the map shrinks and the move says so.
 */
describe('the map\'s size when a move empties its last row or column', () => {
    /** The first move of slot 1 (entry order × empty cells) that shrinks the extents. */
    const shrinkingMove = (doc) => everyChange(doc, MAZE_SLOT).moves
        .find((op) => shrinks(doc, applied(doc, op).doc, MAZE_SLOT));
    const stripped = () => {
        const doc = clone(FOUR);
        delete doc.procgen_metadata.grid_dims;
        return doc;
    };

    it('with `grid_dims` (the fixture records its size): the map keeps it, the description '
        + 'names no shrink, and the move back is accepted', () => {
        expect(FOUR.procgen_metadata.grid_dims).toEqual(extentsOf(FOUR, MAZE_SLOT));
        const op = shrinkingMove(FOUR);
        expect(op, 'a move that empties the last row or column exists').toBeTruthy();
        const res = applied(FOUR, op);
        const { grid } = slotLayout(res.doc, MAZE_SLOT);
        expect({ width: grid.width, height: grid.height }).toEqual(FOUR.procgen_metadata.grid_dims);
        expect(res.description).not.toContain(MAP_SIZE_IS_THE_EXTENT);
        const back = applied(res.doc, { ...op, to: cellOf(FOUR, MAZE_SLOT, op.region) });
        expect(bytes(back.doc)).toBe(bytes(FOUR));
    });

    it('without `grid_dims` (the same document, stripped): the same move shrinks the map and '
        + 'says so; the move back is refused as outside; one Undo restores the bytes', () => {
        const doc = stripped();
        const op = shrinkingMove(FOUR);
        const session = createEditSession(rulesEditAdapter, doc);
        const res = session.apply(op);
        expect(res.applied).toBe(true);
        const [was, now] = [extentsOf(doc, MAZE_SLOT), extentsOf(session.record(), MAZE_SLOT)];
        expect(res.description.endsWith(`; the map shrinks to ${now.width}×${now.height} (it was `
            + `${was.width}×${was.height} — ${MAP_SIZE_IS_THE_EXTENT})`)).toBe(true);
        const back = applyRulesDocOp(session.record(),
            { ...op, to: cellOf(doc, MAZE_SLOT, op.region) });
        expect(back.ok).toBe(false);
        expect(back.error).toContain(`outside player ${MAZE_SLOT}'s map, which is ${now.width}×${now.height}`);
        session.undo();
        expect(bytes(session.record())).toBe(bytes(doc));
    });

    it('a committed slot that records no size: its map IS its extents — a move one cell '
        + 'past them is refused by those dimensions', () => {
        const seen = new Set();
        let checked = 0;
        for (const [file, slot, , , doc] of PLACED) {
            if (seen.has(`${file} ${slot}`) || doc.procgen_metadata?.grid_dims) continue;
            seen.add(`${file} ${slot}`);
            const ext = extentsOf(doc, slot);
            const [region] = slotLayout(doc, slot).cells.keys();
            for (const to of [{ gx: ext.width, gy: 0 }, { gx: 0, gy: ext.height }]) {
                const res = applyRulesDocOp(doc, { op: 'move-region', player: slot, region, to });
                expect(res.ok, `${file} ${slot}`).toBe(false);
                expect(res.error, `${file} ${slot}`)
                    .toContain(`outside player ${slot}'s map, which is ${ext.width}×${ext.height} cells`);
            }
            checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
    });
});

describe('the module', () => {
    it('no registered substrate id appears in its source as a string literal', () => {
        const src = readFileSync(join(HERE, 'regionLayout.js'), 'utf8');
        for (const { id } of substrateRegistry.getAll()) {
            expect(src.includes(`'${id}'`) || src.includes(`"${id}"`), id).toBe(false);
        }
    });
});
