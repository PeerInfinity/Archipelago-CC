#!/usr/bin/env node
/**
 * probe-seedling-gen-chest-rooms — HAND-BUILT CHEST ROOMS, SOLVED BY THE GENERATOR'S ORACLE.
 *
 * Slice `seedling-gen-content-design` (design + measurement, no generator change) wrote it; slice
 * `seedling-gen-chestdoor` committed it as the `chestdoor` element's design instrument (the element owns the
 * doubling-back `door-south` needs, and refuses `door-north`'s shape by name). ⚖ The user ruled (2026-08-12)
 * that a chest is a SOLVER CAPABILITY, not a palette family; this probe measures the three things a chest could be
 * FOR in a generated room, so the user can rule on which (if any) the generator should place:
 *
 *   loot-open     the chest IS the room's goal: open floor, the stance row below it free (vanilla's 15 of 16)
 *   loot-north    the same chest against the north wall (L17's / L86's placement)
 *   door-south    a horizontal wall with a ONE-cell gap holding the chest; the player boots SOUTH of it and the
 *                 goal is NORTH (the south→north crossing a chest door needs — L38's join)
 *   door-north    the same wall, booted NORTH, goal SOUTH: the crossing every single template makes from the NW
 *                 start — the shape `chest-in-the-gap` measured (the stance is beyond the wall)
 *
 * Each room × items (pre-sword, post-sword). One row per solve: verdict, ms, ticks, strategies, first refusal line.
 * Usage: node scripts/procgen/probe-seedling-gen-chest-rooms.mjs [--rooms=…] [--items=…] [--json]
 * Bounded by construction: |rooms| × |items| solves at `DEFAULT_BUDGET`.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help`'s import door): the solves are all `main()`'s. */
async function main() {
    const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await M('procgenLevel.js');
    const { DEFAULT_BUDGET, bootStaging, collectGoal, solve } = await M('procgenOracle.js');
    const { PRE_SWORD_ITEMS, POST_SWORD_ITEMS } = await M('procgenPalette.js');

    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
        ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
    const has = (name) => process.argv.includes(`--${name}`);
    const ITEMS = { 'pre-sword': PRE_SWORD_ITEMS, 'post-sword': POST_SWORD_ITEMS };
    const ent = (type, tx, ty, attrs) => ({ type, ...oelAtTile(tx, ty), ...(attrs ? { attrs } : {}) });

    function room(name) {
        let rec = emptyLevel({ level: 900 });
        const W = rec.width;
        const H = rec.height;
        const wallRow = Math.floor(H / 2);
        const gap = Math.floor(W / 2);
        const wall = () => withTerrain(rec, [...Array(W - 2).keys()].map((i) => i + 1).filter((tx) => tx !== gap)
            .map((tx) => ({ tx, ty: wallRow, terrain: 'wall' })));
        switch (name) {
            case 'loot-open':
                return { rec: withEntities(rec, [ent('chest', W - 3, H - 4, { tag: '0' })]), start: { tx: 1, ty: 1 },
                    goal: { tx: W - 3, ty: H - 4 } };
            case 'loot-north':
                return { rec: withEntities(rec, [ent('chest', W - 3, 1, { tag: '0' })]), start: { tx: 1, ty: H - 2 },
                    goal: { tx: W - 3, ty: 1 } };
            case 'door-south':
                rec = wall();
                return { rec: withEntities(rec, [ent('chest', gap, wallRow, { tag: '1' }),
                    ent('torchpickup', W - 2, 1, { tag: '0' })]), start: { tx: 1, ty: H - 2 }, goal: { tx: W - 2, ty: 1 } };
            case 'door-north':
                rec = wall();
                return { rec: withEntities(rec, [ent('chest', gap, wallRow, { tag: '1' }),
                    ent('torchpickup', W - 2, H - 2, { tag: '0' })]), start: { tx: 1, ty: 1 },
                    goal: { tx: W - 2, ty: H - 2 } };
            default: throw new Error(`unknown room ${name}`);
        }
    }

    const rows = [];
    for (const r of arg('rooms', 'loot-open,loot-north,door-south,door-north').split(',')) {
        const { rec, start, goal } = room(r);
        for (const it of arg('items', 'pre-sword,post-sword').split(',')) {
            const staging = bootStaging({ boot: bootAtTile(rec, start.tx, start.ty), items: ITEMS[it] });
            const t0 = Date.now();
            let out;
            try {
                out = solve(rec, staging, [collectGoal(goal.tx * 16, goal.ty * 16)], DEFAULT_BUDGET, { name: `gen-chest-${r}` });
            } catch (e) {
                out = { verdict: 'THREW', reasonText: `${e?.name}: ${String(e?.message ?? e)}` };
            }
            const ms = Date.now() - t0;
            const row = { room: r, items: it, verdict: out.verdict, ms, ticks: out.ticks ?? null,
                strategies: [...new Set((out.records ?? []).map((x) => x.strategy).filter(Boolean))],
                pickups: (out.records ?? []).map((x) => x.pickup?.tag).filter(Boolean),
                why: out.verdict === 'SOLVED' ? '' : String(out.reasonText ?? '').split('\n')[0].slice(0, 400) };
            rows.push(row);
            if (!has('json')) {
                process.stdout.write(`${r}\t${it}\t${row.verdict}\t${ms} ms\tticks=${row.ticks}\t[${row.strategies}]`
                    + `\tpickups=[${row.pickups}]${row.why ? `\n    ${row.why}` : ''}\n`);
            }
        }
    }
    if (has('json')) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
}

if (isEntryPoint(import.meta.url)) await main();
