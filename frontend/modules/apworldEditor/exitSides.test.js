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
import {
    DEFAULT_REGION_SIZE, buildRulesJson, linkIsAdjacentOnSide, topDownFromRulesJson,
} from '../procgenPipeline/procgenPipelineEngine.js';
import { SIDE_SHARING, exitSidesOf, sideMayHoldAnotherExit } from '../procgenCore/exitSides.js';
import { resolveExitTilePositions } from '../procgenCore/compositeMapRenderer.js';
import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import { EXIT_LINK_ONE_WAY, NO_EXIT_SIDES_DECLARED, applyRulesDocOp } from './rulesDocOps.js';
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
/** ⛓ R2 — the keys an entry's declaration names (the DECLARATION — fixtures are selected by it, never by
 *  the rule under test, so a broken rule reds a row instead of emptying a population). */
const declaredKeys = (entry) => exitSidesOf(substrateRegistry.get(entry?.substrate)).decl?.keys ?? [];
/** ⛓ R2 — may a side of this entry's regions hold another exit? (`sideMayHoldAnotherExit`, the declaration) */
const sideShared = (entry) => sideMayHoldAnotherExit(substrateRegistry.get(entry?.substrate)).may;

/**
 * ⛓ G2a — **THE REGENERATED POPULATION.** Until the ask-first re-record
 * (`156c49f9cd`, ⚖ the user) the committed text-adventure entries
 * (`procgen_topdown` AP_10–12) were the pre-G2a maze shape, and over them the
 * corpus rows below were RED (the write-back re-serialized their exits through
 * the room serializer); since it, they are rooms and the rows hold over the
 * committed corpus too. These three worlds are the same documents built NOW, in memory, with
 * `generate-topdown-preset.js`'s own arguments (`scripts/utils/generated_commands.sh`)
 * — so the rows also run over the shape the re-record will commit. A row below
 * pins that each build reproduces its committed file in every top key but
 * `preset_sidecars`.
 */
const REGEN_WORLDS = [10, 11, 12].map((seed) => {
    const committedFile = join(PRESETS, 'procgen_topdown', `AP_${seed}`, `AP_${seed}_rules.json`);
    const committed = JSON.parse(readFileSync(committedFile, 'utf8'));
    const sourceRel = readFileSync(join(ROOT, 'scripts', 'utils', 'generated_commands.sh'), 'utf8').split('\n')
        .find((l) => l.includes(`--seed ${seed} --out frontend/downloads/AP_${seed}_rules.json`));
    const sourcePath = sourceRel.match(/--source-rules (\S+)/)[1];
    const mix = Object.fromEntries(sourceRel.match(/--substrate-mix (\S+)/)[1].split(',')
        .map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
    const source = JSON.parse(readFileSync(join(ROOT, sourcePath), 'utf8'));
    const sphereLog = readFileSync(join(ROOT, sourcePath.replace(/_rules\.json$/, '_sphere_log.jsonl')), 'utf8')
        .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
    // the script's defaults: 8×6 regions, grid ≥ 3 grown by 2 on a partial layout, 5 retries
    const n = Object.keys(source.regions['1']).length;
    let dim = Math.max(3, Math.ceil(Math.sqrt(n * 1.5)));
    let built;
    for (let attempt = 0, prev = -1; ; attempt++, dim += 2) {
        built = topDownFromRulesJson(source, {
            gridDims: { width: dim, height: dim }, regionSizeBase: { width: 8, height: 6 }, seed, substrateMix: mix, sphereLog,
        });
        const placed = built.stats.regionsBuilt;
        if (placed >= built.stats.regionsTotal || placed === prev || attempt >= 5) break;
        prev = placed;
    }
    const doc = buildRulesJson(built.grid, {
        startCell: built.startCell, seed, assumeBidirectional: source.assume_bidirectional_exits !== false,
        startingItems: source.starting_items?.['1'] ?? [], sourceItems: source.items?.['1'] ?? null, sphereLog,
        procgenMetadata: {
            driver: 'top-down-sphere', source_game: source.game_name ?? null,
            source_counts: committed.procgen_metadata.source_counts, stop_reason: built.stats.stopReason,
            sphere_tree: built.sphereTree, sphere_plan: built.spherePlan,
        },
    });
    const text = JSON.stringify(doc);
    return { file: `regenerated:procgen_topdown/AP_${seed}`, committed, text, doc: JSON.parse(text) };
});
const REGEN_ENTRIES = REGEN_WORLDS.flatMap(({ file, doc }) => Object.entries(doc.preset_sidecars)
    .flatMap(([slot, regs]) => Object.entries(regs).map(([name, entry]) => [file, slot, name, entry, doc])));

/**
 * ⛓ THE POPULATION: every entry whose substrate declares `exitSides` — committed,
 * plus the regenerated worlds' (G2a) — and whose payload carries an `exits` list
 * (⛓ R2: jta declares now, and a jta zone with no exits key has no exit to move —
 * `NO_EXITS_KEY_KEPT_ABSENT`).
 */
const DECLARING_WITH_EXITS = [...ENTRIES, ...REGEN_ENTRIES].filter(([, , , entry]) => declares(entry)
    && Array.isArray(entry.playable_payload?.exits));
/**
 * ⛓ SEEDLING IN THE PIPELINE T1 — an entry whose exits carry NO `side` has no
 * side to move from. A COMPILED atlas room (`seedling_atlas`: its doors are
 * teleporters, and the compiler writes a `side` only for a map-edge exit) is one;
 * its substrate declares `exitSides` because a room the PIPELINE places does carry
 * sides. Such entries leave the population here, and the row below pins that the
 * op REFUSES each of their exits by name — so the exclusion is a checked fact and
 * not a quiet filter.
 */
const exitsCarrySides = (entry) => entry.playable_payload.exits.every((x) => SIDES.includes(x.side));
const SIDELESS = DECLARING_WITH_EXITS.filter(([, , , entry]) => !exitsCarrySides(entry));
const DECLARING = DECLARING_WITH_EXITS.filter(([, , , entry]) => exitsCarrySides(entry));

/** ⛓ Does the entry's substrate's payload DECLARATION carry a side-keyed portal map? (the declaration, not the payload) */
const declaresPortalMap = (entry) => !!sidecarFieldsOf(substrateRegistry.get(entry?.substrate))
    ?.params?.schema?.properties?.sidePortals;

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

    it('⛓ T1 — the entries left out carry NO side on any exit, and the op refuses every one of their exits by name', () => {
        expect(SIDELESS.length).toBeGreaterThan(0);
        for (const [file, slot, name, entry, doc] of SIDELESS) {
            expect(entry.playable_payload.exits.every((x) => x.side === undefined), `${file} ${name}`).toBe(true);
            for (const x of entry.playable_payload.exits) {
                const res = applyRulesDocOp(doc, {
                    op: 'move-exit-side', player: slot, region: name, exitId: x.exit_id, side: SIDES[0],
                });
                expect(res.ok, `${file} ${name} ${x.exit_id}`).toBe(false);
                expect(res.error).toContain(`exit ${x.exit_id} of region "${name}" carries side undefined`);
            }
        }
    });

    it('⛓ G2a — each regenerated world reproduces its committed file in every top key but '
        + '`preset_sidecars`, and holds declaring entries WITHOUT a portal map', () => {
        for (const { file, committed, doc } of REGEN_WORLDS) {
            const keys = new Set([...Object.keys(committed), ...Object.keys(doc)]);
            const moved = [...keys].filter((k) => bytes(committed[k]) !== bytes(doc[k]));
            expect(moved.filter((k) => k !== 'preset_sidecars'), file).toEqual([]);
        }
        const mapless = DECLARING.filter(([file, , , e]) => file.startsWith('regenerated:') && !declaresPortalMap(e));
        expect(mapless.length).toBeGreaterThan(0);
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

    it('(b) every exit moved to every FREE side and back — and, ⛓ R2, to every OCCUPIED side where the '
        + 'declaration keys nothing by side — and every swap swapped back, is byte-identical to the committed '
        + 'document', () => {
        const drifted = [];
        let moves = 0;
        let occupied = 0;
        let swaps = 0;
        for (const [file, slot, name, entry, doc] of DECLARING) {
            const before = bytes(doc);
            for (const { op, from, free } of everySideMove(slot, name, entry)) {
                if (!free && !sideShared(entry)) continue;
                moves += 1;
                if (!free) occupied += 1;
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
        expect(occupied).toBeGreaterThan(0);
        expect(swaps).toBeGreaterThan(0);
        expect(drifted).toEqual([]);
    });

    it('(c) the side law reproduces every stored flag of the population but M2\'s two hand-authored '
        + 'DIAGONALS — ⛓ R2: omsi declares `exitSides` now, so they are inside it, and they are the only '
        + 'dissent', () => {
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
        // ⛓ a diagonal: its target is a DIAGONAL neighbour (both coordinates differ by one) and the stored
        //   flag says adjacent — derived over the whole population, never an id list
        const want = DECLARING.flatMap(([file, slot, name, entry, doc]) => entry.playable_payload.exits
            .filter((x) => {
                const a = doc.preset_sidecars[slot][name]?.grid_cell;
                const b = doc.preset_sidecars[slot][x.targetRegion]?.grid_cell;
                return a && b && Math.abs(a.gx - b.gx) === 1 && Math.abs(a.gy - b.gy) === 1 && x.isTeleporter !== true;
            }).map((x) => `${file} ${slot} ${name} ${x.exit_id}`));
        expect(want.length).toBeGreaterThan(0);
        expect(dissent.sort()).toEqual(want.sort());
    });
});

/* ── the write-back, exhaustively ───────────────────────────────────────── */

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

/** A declared key (`a.b[].c`) as the leaf paths it covers. */
const keyPattern = (key) => new RegExp(`^${key.split('.').map((part) => part.endsWith('[]')
    ? `${part.slice(0, -2)}\\.\\d+` : part).join('\\.')}$`);

/**
 * ⛓ The side → arrow of the population's portals that carry one, READ OFF THE
 * COMMITTED CORPUS (every portal a portal map serves on side s, whatever key
 * the declaration names for it) — never a table typed here. The row below
 * asserts the corpus agrees with itself first.
 */
function arrowsBySide() {
    const seen = {};
    for (const [, , , entry] of DECLARING.filter(([, , , e]) => declaresPortalMap(e))) {
        const { decl } = exitSidesOf(substrateRegistry.get(entry.substrate));
        const arrowKey = decl.keys.find((k) => k.includes('[]'));
        if (!arrowKey) continue;
        const [listPath, field] = arrowKey.split('[].');
        const list = listPath.split('.').reduce((o, k) => o?.[k], entry.playable_payload);
        for (const [side, id] of Object.entries(entry.playable_payload.params.sidePortals)) {
            const portal = (list ?? []).find((p) => p.id === id);
            if (portal) (seen[side] ??= new Set()).add(portal[field]);
        }
    }
    return seen;
}

/** Every move to a free side and every swap of the population, with its entry. */
const EVERY_CHANGE = DECLARING.flatMap(([file, slot, name, entry, doc]) => [
    ...everySideMove(slot, name, entry).filter((m) => m.free).map((m) => ({ file, slot, name, entry, doc, op: m.op })),
    ...everySwap(slot, name, entry).map((op) => ({ file, slot, name, entry, doc, op })),
]);
/** ⛓ G2a — the changes of the entries whose payload declaration carries a portal map (the portal rows' population). */
const PORTAL_MAP_CHANGES = EVERY_CHANGE.filter(({ entry }) => declaresPortalMap(entry));

/** The moves an op makes, as `[{exitId, from, to}]`, read off the ENTRY BEFORE. */
function movesOf(entry, op) {
    const sideOf = (id) => entry.playable_payload.exits.find((x) => x.exit_id === id).side;
    if (op.op === 'move-exit-side') return [{ exitId: op.exitId, from: sideOf(op.exitId), to: op.side }];
    return [{ exitId: op.exitA, from: sideOf(op.exitA), to: sideOf(op.exitB) },
        { exitId: op.exitB, from: sideOf(op.exitB), to: sideOf(op.exitA) }];
}

describe('⛓⛓⛓ the write-back — every free move and every swap of the population, the document AFTER', () => {
    it('the population\'s arrows agree with themselves: one arrow per side (the premise of the arrow '
        + 'assertion below)', () => {
        const arrows = arrowsBySide();
        expect(Object.keys(arrows).length).toBeGreaterThan(0);
        for (const [side, set] of Object.entries(arrows)) expect([...set], side).toHaveLength(1);
    });

    it('the deep diff holds ONLY the moved sides, the flags the side law changed, the renamed '
        + 'portal-map keys, a back exit\'s `backExitSide` and a declared arrow — nothing else', () => {
        const bad = [];
        let flips = 0;
        for (const { file, slot, name, entry, doc, op } of EVERY_CHANGE) {
            const after = applied(doc, op).doc;
            const moves = movesOf(entry, op);
            const { decl } = exitSidesOf(substrateRegistry.get(entry.substrate));
            const prefix = `preset_sidecars.${slot}.${name}.playable_payload.`;
            const exitsBefore = entry.playable_payload.exits;
            const allowed = new Set();
            for (const m of moves) {
                const i = exitsBefore.findIndex((x) => x.exit_id === m.exitId);
                allowed.add(`exits.${i}.side`);
                const was = lawTeleporter(doc, slot, name, exitsBefore[i], m.from);
                const now = lawTeleporter(doc, slot, name, exitsBefore[i], m.to);
                if (was !== null && was !== now) { allowed.add(`exits.${i}.isTeleporter`); flips += 1; }
                allowed.add(`params.sidePortals.${m.from}`).add(`params.sidePortals.${m.to}`);
                if (exitsBefore[i].isBackExit === true) allowed.add('params.backExitSide');
            }
            const extra = decl.keys.filter((k) => k.includes('[]')).map(keyPattern);
            for (const leaf of leafDiff(doc, after)) {
                const rel = leaf.startsWith(prefix) ? leaf.slice(prefix.length) : null;
                if (rel !== null && (allowed.has(rel) || extra.some((re) => re.test(rel)))) continue;
                bad.push(`${file} ${bytes(op)}: ${leaf}`);
            }
            // …and each allowed flag leaf IS written (a row that only bounds the diff
            // cannot see a flag the op forgot).
            for (const rel of allowed) {
                if (!rel.endsWith('isTeleporter')) continue;
                const i = Number(rel.split('.')[1]);
                const m = moves.find((mv) => mv.exitId === exitsBefore[i].exit_id);
                expect(after.preset_sidecars[slot][name].playable_payload.exits[i].isTeleporter,
                    `${file} ${bytes(op)} ${rel}`).toBe(lawTeleporter(doc, slot, name, exitsBefore[i], m.to));
            }
        }
        expect(EVERY_CHANGE.length).toBeGreaterThan(0);
        expect(flips).toBeGreaterThan(0);
        expect(bad).toEqual([]);
    });

    it('the moved exit carries its new side; the portal map\'s `to` key holds the portal `from` held, '
        + 'in `from`\'s POSITION; every other key is unmoved', () => {
        for (const { file, slot, name, entry, doc, op } of EVERY_CHANGE) {
            const after = applied(doc, op).doc.preset_sidecars[slot][name].playable_payload;
            for (const m of movesOf(entry, op)) {
                expect(after.exits.find((x) => x.exit_id === m.exitId).side, `${file} ${bytes(op)}`).toBe(m.to);
            }
        }
        expect(PORTAL_MAP_CHANGES.length).toBeGreaterThan(0);
        for (const { file, slot, name, entry, doc, op } of PORTAL_MAP_CHANGES) {
            const after = applied(doc, op).doc.preset_sidecars[slot][name].playable_payload;
            const before = entry.playable_payload;
            const rename = new Map(movesOf(entry, op).map((m) => [m.from, m.to]));
            for (const m of movesOf(entry, op)) {
                expect(after.exits.find((x) => x.exit_id === m.exitId).side, `${file} ${bytes(op)}`).toBe(m.to);
            }
            expect(Object.keys(after.params.sidePortals), `${file} ${bytes(op)}`)
                .toEqual(Object.keys(before.params.sidePortals).map((s) => rename.get(s) ?? s));
            for (const [s, id] of Object.entries(before.params.sidePortals)) {
                expect(after.params.sidePortals[rename.get(s) ?? s], `${file} ${bytes(op)} ${s}`).toBe(id);
            }
        }
    });

    it('a declared arrow is RE-POINTED along the side its portal now serves; an entry that declares '
        + 'none keeps every arrow', () => {
        const arrows = arrowsBySide();
        let pointed = 0;
        let kept = 0;
        for (const { file, slot, name, entry, doc, op } of PORTAL_MAP_CHANGES) {
            const { decl } = exitSidesOf(substrateRegistry.get(entry.substrate));
            const arrowKey = decl.keys.find((k) => k.includes('[]'));
            const after = applied(doc, op).doc.preset_sidecars[slot][name].playable_payload;
            if (!arrowKey) {
                kept += 1;
                expect(bytes(after.params[Object.keys(after.params)[0]]), `${file} ${bytes(op)}`)
                    .toBe(bytes(entry.playable_payload.params[Object.keys(after.params)[0]]));
                continue;
            }
            const [listPath, field] = arrowKey.split('[].');
            const list = listPath.split('.').reduce((o, k) => o?.[k], after);
            for (const m of movesOf(entry, op)) {
                const portal = list.find((p) => p.id === after.params.sidePortals[m.to]);
                expect(portal?.[field], `${file} ${bytes(op)} ${m.exitId}`).toBe([...arrows[m.to]][0]);
                pointed += 1;
            }
        }
        expect(pointed).toBeGreaterThan(0);
        expect(kept).toBeGreaterThan(0);
    });
});

/* ── the back exit ───────────────────────────────────────────────────────── */

/** ⛓ The entries whose payload CARRIES `params.backExitSide` — the law, not the declaration. */
const CARRIERS = DECLARING.filter(([, , , e]) => Object.hasOwn(e.playable_payload.params ?? {}, 'backExitSide'));

describe('⛓ `params.backExitSide` follows the BACK exit, and only it', () => {
    it('over every free move and swap of every carrier: after = the back exit\'s new side when a back '
        + 'exit moved, else unmoved; a payload without the key never gains it', () => {
        let backMoves = 0;
        let otherMoves = 0;
        for (const { file, slot, name, entry, doc, op } of EVERY_CHANGE) {
            const after = applied(doc, op).doc.preset_sidecars[slot][name].playable_payload.params ?? {};
            const before = entry.playable_payload.params ?? {};
            if (!Object.hasOwn(before, 'backExitSide')) {
                expect(Object.hasOwn(after, 'backExitSide'), `${file} ${bytes(op)}`).toBe(false);
                continue;
            }
            const back = movesOf(entry, op).find((m) => entry.playable_payload.exits
                .find((x) => x.exit_id === m.exitId).isBackExit === true);
            if (back) backMoves += 1; else otherMoves += 1;
            expect(after.backExitSide, `${file} ${bytes(op)}`).toBe(back ? back.to : before.backExitSide);
        }
        expect(CARRIERS.length).toBeGreaterThan(0);
        expect(backMoves).toBeGreaterThan(0);
        expect(otherMoves).toBeGreaterThan(0);
    });
});

/* ── refusals ────────────────────────────────────────────────────────────── */

const clone = (o) => JSON.parse(JSON.stringify(o));

/** ⛓ A declaring entry with an exit whose target side is taken by another — derived. ⛓ R2: a KEYED
 *  declaration (an occupied side refuses there; where nothing is keyed it is a legal move). */
const [S_FILE, S_SLOT, S_NAME, S_ENTRY, S_DOC] = DECLARING.find(([, slot, name, e]) => declaredKeys(e).length > 0
    && everySideMove(slot, name, e).some((m) => !m.free) && everySideMove(slot, name, e).some((m) => m.free));
/** ⛓ An entry whose substrate declares NO `exitSides` and whose payload carries sided exits — derived. */
const [U_FILE, U_SLOT, U_NAME, U_ENTRY, U_DOC] = ENTRIES.find(([, , , e]) => !declares(e)
    && substrateRegistry.get(e.substrate)
    && (e.playable_payload?.exits ?? []).some((x) => Object.hasOwn(SIDE_WORDS, x.side)));

/** ⛓ A synthetic registered substrate for the refusals only this file can build. */
const FAKE = (id, extra) => {
    if (!substrateRegistry.has(id)) {
        substrateRegistry.register({
            id, deserializeWorld: (p) => ({ ...p }), serializeWorld: (w) => ({ ...w }), ...extra,
        });
    }
    return id;
};
const withSubstrate = (doc, slot, name, substrate) => {
    const next = clone(doc);
    next.preset_sidecars[slot][name].substrate = substrate;
    return next;
};

describe('refusals — asked of the op, each by name, the document untouched', () => {
    const refused = (doc, op) => {
        const before = bytes(doc);
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, bytes(op)).toBe(false);
        expect(bytes(doc)).toBe(before);
        return res.error;
    };
    const firstExit = S_ENTRY.playable_payload.exits[0];
    const move = (extra) => ({ op: 'move-exit-side', player: S_SLOT, region: S_NAME, exitId: firstExit.exit_id, ...extra });
    const freeSide = () => everySideMove(S_SLOT, S_NAME, S_ENTRY).find((m) => m.free && m.op.exitId === firstExit.exit_id)
        ?.op.side ?? everySideMove(S_SLOT, S_NAME, S_ENTRY).find((m) => m.free).op.side;

    it('the fixtures are the law\'s: a declaring entry with a free AND an occupied side, and a sided '
        + 'entry whose substrate declares nothing', () => {
        expect(S_FILE && U_FILE).toBeTruthy();
        expect(exitSidesOf(substrateRegistry.get(U_ENTRY.substrate)).absent).toBe(true);
    });

    it('⛔ no region NAME; no sidecar entry; no `exits` list', () => {
        for (const region of [undefined, '', '  ', 7]) {
            expect(refused(S_DOC, move({ region, side: 'N' }))).toBe(`apworld: move-exit-side needs a region NAME, got ${JSON.stringify(region)}.`);
        }
        expect(refused(S_DOC, move({ region: 'Nowhere', side: 'N' })))
            .toMatch(new RegExp(`^apworld: player ${S_SLOT} has no sidecar entry for region "Nowhere", so it has no exit to move\\. This slot's sidecars are \\[`));
        const bare = clone(S_DOC);
        delete bare.preset_sidecars[S_SLOT][S_NAME].playable_payload.exits;
        expect(refused(bare, move({ side: 'N' })))
            .toBe(`apworld: region "${S_NAME}"'s payload carries no \`exits\` list, so it has no exit to move.`);
    });

    it('⛔ no such exit — naming the exits the region has; for a swap, which of the two', () => {
        const ids = S_ENTRY.playable_payload.exits.map((x) => x.exit_id).join(', ');
        expect(refused(S_DOC, move({ exitId: 'nope', side: 'N' })))
            .toBe(`apworld: region "${S_NAME}" has no exit "nope" — its exits are [${ids}].`);
        const swap = { op: 'swap-exit-sides', player: S_SLOT, region: S_NAME, exitA: firstExit.exit_id, exitB: 'nope' };
        expect(refused(S_DOC, swap)).toBe(`apworld: region "${S_NAME}" has no exit "nope" (\`exitB\`) — its exits are [${ids}].`);
        expect(refused(S_DOC, { ...swap, exitA: 'nope', exitB: firstExit.exit_id }))
            .toContain('has no exit "nope" (`exitA`)');
    });

    it('⛔ a side outside N/S/E/W', () => {
        for (const side of [undefined, 'north', 'n', 'NE', 0, null]) {
            expect(refused(S_DOC, move({ side })))
                .toBe(`apworld: move-exit-side needs \`side\` as one of N/S/E/W, got ${side === undefined ? 'none' : JSON.stringify(side)}.`);
        }
    });

    it('⛔ a substrate that declares no `exitSides` — in the declaration\'s words, for a move and a swap', () => {
        const x = U_ENTRY.playable_payload.exits.find((e) => Object.hasOwn(SIDE_WORDS, e.side));
        const other = Object.keys(SIDE_WORDS).find((s) => s !== x.side);
        const want = `apworld: region "${U_NAME}"'s substrate "${U_ENTRY.substrate}" cannot have an exit moved to `
            + `another side — ${NO_EXIT_SIDES_DECLARED}.`;
        expect(refused(U_DOC, { op: 'move-exit-side', player: U_SLOT, region: U_NAME, exitId: x.exit_id, side: other })).toBe(want);
        const y = U_ENTRY.playable_payload.exits.find((e) => e !== x && e.side !== x.side);
        if (y) {
            expect(refused(U_DOC, { op: 'swap-exit-sides', player: U_SLOT, region: U_NAME, exitA: x.exit_id, exitB: y.exit_id })).toBe(want);
        }
        expect(NO_EXIT_SIDES_DECLARED).toBe('its registry entry declares no `exitSides`, so the hub cannot say what '
            + 'else in the payload is keyed by side');
    });

    it('⛔ an UNREGISTERED substrate, and a MALFORMED declaration — each by name, never a default', () => {
        const unreg = withSubstrate(S_DOC, S_SLOT, S_NAME, 'm3-not-registered');
        expect(refused(unreg, move({ side: freeSide() })))
            .toBe(`apworld: region "${S_NAME}"'s substrate "m3-not-registered" cannot have an exit moved to another side — no module registers it here.`);
        const bad = withSubstrate(S_DOC, S_SLOT, S_NAME, FAKE('m3-malformed', { exitSides: { keys: ['k'], relabel: 'x' } }));
        expect(refused(bad, move({ side: freeSide() })))
            .toBe(`apworld: region "${S_NAME}"'s substrate "m3-malformed" cannot have an exit moved to another side — its \`exitSides.relabel\` is string, not a function.`);
    });

    it('⛔ an OCCUPIED side — a swap, and says so, naming both exits and the op', () => {
        const { op } = everySideMove(S_SLOT, S_NAME, S_ENTRY).find((m) => !m.free);
        const taker = S_ENTRY.playable_payload.exits.find((x) => x.exit_id !== op.exitId && x.side === op.side);
        expect(refused(S_DOC, op)).toBe(`apworld: side ${op.side} (${SIDE_WORDS[op.side]}) of region "${S_NAME}" already `
            + `carries exit ${taker.exit_id} — moving ${op.exitId} there is a swap, and says so: `
            + `swap-exit-sides {exitA: ${op.exitId}, exitB: ${taker.exit_id}}.`);
    });

    it('⛔ a relabel that THROWS (a portal map already keyed on the target side) and a substrate with no '
        + 'serializer', () => {
        const side = freeSide();
        const orphan = clone(S_DOC);
        orphan.preset_sidecars[S_SLOT][S_NAME].playable_payload.params.sidePortals[side] = 'orphan_portal';
        const m = everySideMove(S_SLOT, S_NAME, S_ENTRY).find((mv) => mv.free && mv.op.side === side).op;
        expect(refused(orphan, m)).toBe(`apworld: region "${S_NAME}"'s substrate "${S_ENTRY.substrate}" refused the side `
            + `relabel — params.sidePortals already maps side ${side} to portal "orphan_portal", and no moved exit vacates it.`);
        const noSer = FAKE('m3-no-serializer', { exitSides: { keys: ['k'], relabel: (p) => p }, serializeWorld: undefined });
        expect(refused(withSubstrate(S_DOC, S_SLOT, S_NAME, noSer), m))
            .toBe(`apworld: region "${S_NAME}"'s substrate "m3-no-serializer" cannot rewrite its exits here — its registry `
                + 'entry declares no `deserializeWorld` / `serializeWorld` pair. A payload\'s exits are written back in the '
                + 'substrate\'s OWN serialized form or not at all; load the substrate\'s module first.');
    });

    it('a move to the exit\'s OWN side and a swap with itself are NO-OPS (the same document), even where '
        + 'nothing is declared', () => {
        expect(applied(S_DOC, move({ side: firstExit.side })).doc).toBe(S_DOC);
        expect(applied(S_DOC, { op: 'swap-exit-sides', player: S_SLOT, region: S_NAME, exitA: firstExit.exit_id, exitB: firstExit.exit_id }).doc).toBe(S_DOC);
        const x = U_ENTRY.playable_payload.exits.find((e) => Object.hasOwn(SIDE_WORDS, e.side));
        expect(applied(U_DOC, { op: 'move-exit-side', player: U_SLOT, region: U_NAME, exitId: x.exit_id, side: x.side }).doc).toBe(U_DOC);
    });
});

/* ── ⛓ PIPELINE RELAYOUT R2 — an occupied side, by declaration ────────────── */

/** ⛓ Every occupied-side move of an entry whose declaration keys nothing by side — the law's population. */
const SHARED_OCCUPIED = DECLARING.filter(([, , , e]) => declaredKeys(e).length === 0).flatMap(([file, slot, name, entry, doc]) =>
    everySideMove(slot, name, entry).filter((m) => !m.free).map((m) => ({ file, slot, name, entry, doc, ...m })));

/**
 * ⛓ The BEFORE sentence, measured at `62d359ec1a` (R2 W0.3) on the committed bounce entry
 * `bounce_worldgen` slot 1 `region_1_0`, `exit_S` → side E (held by `exit_E`). A keyed declaration's
 * refusal must stay this sentence, word for word.
 */
const BOUNCE_OCCUPIED_BEFORE = 'apworld: side E (east) of region "region_1_0" already carries exit exit_E — moving '
    + 'exit_S there is a swap, and says so: swap-exit-sides {exitA: exit_S, exitB: exit_E}.';

describe('⛓⛓ R2 — a side that already carries an exit takes another IFF the declaration keys nothing by side', () => {
    it('the population is the law\'s: occupied-side moves of side-agnostic declarers exist, and every '
        + 'side-agnostic declarer declares EMPTY keys', () => {
        expect(SHARED_OCCUPIED.length).toBeGreaterThan(0);
        for (const { file, entry } of SHARED_OCCUPIED) {
            expect(exitSidesOf(substrateRegistry.get(entry.substrate)).decl.keys, file).toEqual([]);
        }
    });

    it('every such move SUCCEEDS: the exit joins the side, nothing else changes side, the answer counts '
        + 'the side\'s exits by name, and the renderer draws every exit of that side on its edge, apart', () => {
        const onEdge = (t, s) => ({ N: t.y === 0, S: t.y === DEFAULT_REGION_SIZE.height - 1,
            W: t.x === 0, E: t.x === DEFAULT_REGION_SIZE.width - 1 })[s];
        for (const { file, slot, name, entry, doc, op } of SHARED_OCCUPIED) {
            const res = applied(doc, op);
            const exits = res.doc.preset_sidecars[slot][name].playable_payload.exits;
            for (const x of exits) {
                const was = entry.playable_payload.exits.find((e) => e.exit_id === x.exit_id).side;
                expect(x.side, `${file} ${bytes(op)} ${x.exit_id}`).toBe(x.exit_id === op.exitId ? op.side : was);
            }
            const holders = exits.filter((x) => x.side === op.side);
            expect(holders.length, `${file} ${bytes(op)}`).toBeGreaterThan(1);
            const others = holders.filter((x) => x.exit_id !== op.exitId).map((x) => x.exit_id);
            expect(res.description, `${file} ${bytes(op)}`).toContain(`; side ${op.side} now holds ${holders.length} `
                + `exits (${[op.exitId, ...others].join(', ')})`);
            const tiles = resolveExitTilePositions(exits, DEFAULT_REGION_SIZE)
                .filter((t, i) => exits[i].side === op.side);
            expect(tiles.length, `${file} ${bytes(op)}`).toBe(holders.length);
            for (const t of tiles) expect(onEdge(t, op.side), `${file} ${bytes(op)}`).toBe(true);
            expect(new Set(tiles.map((t) => `${t.x},${t.y}`)).size, `${file} ${bytes(op)}`).toBe(holders.length);
        }
    });

    it('⛔ a KEYED declaration keeps M3\'s refusal WORD FOR WORD — the bounce sentence measured before R2', () => {
        const hit = ENTRIES.find(([file, slot, name]) => file.startsWith('bounce_worldgen/') && slot === '1'
            && name === 'region_1_0');
        expect(hit).toBeTruthy();
        const [, slot, name, entry, doc] = hit;
        expect(sideMayHoldAnotherExit(substrateRegistry.get(entry.substrate)).reason).toBe(SIDE_SHARING.KEYED);
        const res = applyRulesDocOp(doc, { op: 'move-exit-side', player: slot, region: name, exitId: 'exit_S', side: 'E' });
        expect(res.ok).toBe(false);
        expect(res.error).toBe(BOUNCE_OCCUPIED_BEFORE);
    });

    it('a swap of two exits on ONE side stays a no-op with its sentence', () => {
        const { slot, name, entry, doc, op } = SHARED_OCCUPIED[0];
        const there = applied(doc, op).doc;
        const other = entry.playable_payload.exits.find((x) => x.exit_id !== op.exitId && x.side === op.side);
        const res = applied(there, { op: 'swap-exit-sides', player: slot, region: name, exitA: op.exitId, exitB: other.exit_id });
        expect(res.doc).toBe(there);
        expect(res.description).toBe(`exits ${op.exitId} and ${other.exit_id} of ${name} are on one side — nothing to swap`);
    });
});

/* ── the answer ──────────────────────────────────────────────────────────── */

describe('the answer names the exit, the sides and the link — and a ONE-WAY link', () => {
    /** The reciprocal's STORED flag vs the moved exit's law verdict after — picked by the law. */
    const classify = ({ slot, name, entry, doc, op }) => {
        if (op.op !== 'move-exit-side') return null;
        const x = entry.playable_payload.exits.find((e) => e.exit_id === op.exitId);
        const now = lawTeleporter(doc, slot, name, x, op.side);
        if (now === null) return null;
        // ⛓ R2: an exit whose STORED flag the law disputes (the omsi diagonals, (c)) is not this row's shape
        if (lawTeleporter(doc, slot, name, x, x.side) !== (x.isTeleporter === true)) return null;
        const back = (doc.preset_sidecars[slot][x.targetRegion]?.playable_payload?.exits ?? [])
            .filter((e) => e.targetRegion === name);
        if (!back.length) return null;
        const r = back.find((e) => e.exit_id === x.targetExitId || e.targetExitId === x.exit_id) ?? back[0];
        return { x, r, now, oneWay: (r.isTeleporter === true) !== now };
    };

    it('a move that SEPARATES a link names it a teleporter and ONE-WAY, with the reciprocal exit and its side', () => {
        const hits = EVERY_CHANGE.map((c) => ({ c, k: classify(c) })).filter(({ k }) => k?.oneWay);
        expect(hits.length).toBeGreaterThan(0);
        for (const { c, k } of hits) {
            const { description } = applied(c.doc, c.op);
            expect(description).toContain(`Moved exit ${c.op.exitId} of ${c.name} to side ${c.op.side} `
                + `(${SIDE_WORDS[k.x.side]} → ${SIDE_WORDS[c.op.side]})`);
            expect(description).toContain(`the link to ${k.x.targetRegion} is ${k.now ? 'now a teleporter' : ''}`.trim());
            expect(description).toContain(`— ${EXIT_LINK_ONE_WAY}: ${k.x.targetRegion}'s exit ${k.r.exit_id} (${SIDE_WORDS[k.r.side]}) is `
                + `${k.r.isTeleporter ? 'a teleporter' : 'adjacent'}`);
        }
    });

    it('moving it BACK names the link a plain one again, both ends agreeing — no ONE-WAY', () => {
        const hits = EVERY_CHANGE.map((c) => ({ c, k: classify(c) })).filter(({ k }) => k?.oneWay && k.now);
        expect(hits.length).toBeGreaterThan(0);
        for (const { c, k } of hits) {
            const there = applied(c.doc, c.op).doc;
            const { description } = applied(there, { ...c.op, side: k.x.side });
            expect(description).toContain(`the link to ${k.x.targetRegion} is now adjacent (it was a teleporter)`);
            expect(description).toContain(`${k.x.targetRegion}'s exit ${k.r.exit_id} (${SIDE_WORDS[k.r.side]}) leads back as adjacent too`);
            expect(description).not.toContain(EXIT_LINK_ONE_WAY);
        }
    });

    it('the relabel is named by the declaration\'s own keys; a swap names both exits', () => {
        const swap = EVERY_CHANGE.find((c) => c.op.op === 'swap-exit-sides');
        const { decl } = exitSidesOf(substrateRegistry.get(swap.entry.substrate));
        const { description } = applied(swap.doc, swap.op);
        expect(description).toMatch(new RegExp(`^Swapped exits ${swap.op.exitA} ↔ ${swap.op.exitB} of ${swap.name} \\(`));
        expect(description).toContain(`${swap.op.exitA}: the link to`);
        expect(description).toContain(`${swap.op.exitB}: the link to`);
        expect(description.endsWith(`(the side-keyed fields it declares: ${decl.keys.join(', ')})`)).toBe(true);
    });
});

/* ── the session ─────────────────────────────────────────────────────────── */

describe('through a session', () => {
    it('one op per gesture; each undo restores the bytes before it; a no-op is dropped', () => {
        const session = createEditSession(rulesEditAdapter, clone(S_DOC));
        const s0 = bytes(session.record());
        const free = everySideMove(S_SLOT, S_NAME, S_ENTRY).find((m) => m.free).op;
        expect(session.apply(free).applied).toBe(true);
        const s1 = bytes(session.record());
        const swap = everySwap(S_SLOT, S_NAME, applied(S_DOC, free).doc.preset_sidecars[S_SLOT][S_NAME])[0];
        expect(session.apply(swap).applied).toBe(true);
        expect(session.ops().map((o) => o.op)).toEqual(['move-exit-side', 'swap-exit-sides']);
        const own = S_ENTRY.playable_payload.exits[0];
        expect(session.apply({ op: 'swap-exit-sides', player: S_SLOT, region: S_NAME, exitA: own.exit_id, exitB: own.exit_id }).applied).toBe(false);
        expect(session.ops()).toHaveLength(2);
        session.undo();
        expect(bytes(session.record())).toBe(s1);
        session.undo();
        expect(bytes(session.record())).toBe(s0);
        expect(s0).toBe(bytes(S_DOC));
    });

    it('⛔ NEVER writes through: every document the rows above read still equals its FILE (trap 1323)', () => {
        const files = new Map(DECLARING.map(([file, , , , doc]) => [file, doc]));
        expect(files.size).toBeGreaterThan(0);
        const regenerated = new Map(REGEN_WORLDS.map((w) => [w.file, w.text]));
        for (const [file, doc] of files) {
            // a regenerated world has no file: its bytes as BUILT are the file
            const want = regenerated.get(file) ?? bytes(JSON.parse(readFileSync(join(PRESETS, file), 'utf8')));
            expect(bytes(doc), file).toBe(want);
        }
    });
});
