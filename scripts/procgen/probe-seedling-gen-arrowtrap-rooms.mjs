#!/usr/bin/env node
/**
 * probe-seedling-gen-arrowtrap-rooms — HAND-BUILT ARROW-TRAP ROOMS, SOLVED BY THE GENERATOR'S ORACLE.
 *
 * Slice `seedling-gen-content-design` (design + measurement, no generator change) wrote it; slice `seedling-gen-ropegate`
 * committed it as the `ropegate` element's before/after (⚠ since then the oracle REFUSES a solve that tanks an arrow,
 * so the ON arm's "SOLVED by tanking" rows now read REFUSED, naming the hit). The question it answers:
 * what does the oracle (`procgenOracle.solve`, the generator's own keep/revert judge) say about a room built
 * around an arrow trap and the thing that disarms it, with `ARROW_LANE_CROSSING` off and on?
 *
 * Every room is one screen (`SINGLE_SCREEN_TILES`), a bordered `emptyLevel`, start (1,1), goal a `torchpickup`
 * on the EAST side. The trap sits in the interior's top row at column `LANE_TX`, so its lane (the danger map's
 * column to the level's floor, `arrowLaneRect`) splits the room west | east: every route to the goal crosses it.
 *
 *   bare          trap armed by default (`shoot 1`), nothing disarms it — the old `arrow-lane` shape, forced
 *   button        + a button (same `tset`) on the west side — disarmed only WHILE held (L67 without its block)
 *   button-block  + a pushable block beside that button — L67's pattern (a block holds the button down)
 *   rope          + a rope (same `tset`) on the west side — L16's pattern (a sword cut LATCHES it off)
 *   weapon        trap OFF by default (`shoot 0`) + a button that ARMS it — L4/L5/L8's pattern; no bob, so this
 *                 is only the "the lane is safe until you press" control
 *
 * Each room × biome items (pre-sword, post-sword, post-shield) × crossing (off, on). Prints one row per solve:
 * verdict, ms, ticks, the strategies the solve's records name, and the refusal's first line.
 *
 * Usage: node scripts/procgen/probe-seedling-gen-arrowtrap-rooms.mjs [--rooms=a,b] [--items=pre-sword,…]
 *        [--crossing=off,on] [--goal=tx,ty] [--size=WxH] [--json [--full]]
 * Bounded by construction: |rooms| × |items| × |crossing| solves at `DEFAULT_BUDGET`, nothing else.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const M = (p) => import(join(HERE, '..', '..', 'frontend/modules/seedlingDemo', p));

const { bootAtTile, emptyLevel, oelAtTile, withEntities } = await M('procgenLevel.js');
const { DEFAULT_BUDGET, bootStaging, collectGoal, solve } = await M('procgenOracle.js');
const { withArrowLaneCrossing } = await M('arrowLaneCrossing.js');
const { PRE_SWORD_ITEMS, POST_SWORD_ITEMS, POST_SHIELD_ITEMS } = await M('procgenPalette.js');

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))
    ?? `--${name}=${fallback}`).slice(`--${name}=`.length);
const has = (name) => process.argv.includes(`--${name}`);

const LEVEL = 900;
const START = { tx: 1, ty: 1 };
const LANE_TX = 4;

const ITEMS = { 'pre-sword': PRE_SWORD_ITEMS, 'post-sword': POST_SWORD_ITEMS, 'post-shield': POST_SHIELD_ITEMS };

const ent = (type, tx, ty, attrs) => ({ type, ...oelAtTile(tx, ty), ...(attrs ? { attrs } : {}) });

function room(name) {
    const [sw, sh] = arg('size', '').split('x').map(Number);
    const base = emptyLevel({ level: LEVEL, ...(sw && sh ? { width: sw, height: sh } : {}) });
    const W = base.width;
    const H = base.height;
    const [gx, gy] = arg('goal', `${W - 2},${H - 2}`).split(',').map(Number);
    const goal = { tx: gx, ty: gy };
    const trap = (shoot) => ent('arrowtrap', LANE_TX, 1, { tset: '0', shoot: String(shoot) });
    const entities = [ent('torchpickup', goal.tx, goal.ty, { tag: '0' })];
    switch (name) {
        case 'bare': entities.push(trap(1)); break;
        case 'button': entities.push(trap(1), ent('button', 2, H - 3, { tset: '0' })); break;
        case 'button-block':
            entities.push(trap(1), ent('button', 1, H - 3, { tset: '0' }), ent('pushableblock', 2, H - 3));
            break;
        case 'rope':
            // A rope is a SPAN, `x` to its one node's `x` (L16's runs (32,16)→(80,16)); this one spans two cells.
            entities.push(trap(1), { ...ent('rope', 1, H - 3, { tset: '0', tag: '1' }),
                nodes: [oelAtTile(2, H - 3)] });
            break;
        case 'weapon': entities.push(trap(0), ent('button', 2, H - 3, { tset: '0' })); break;
        default: throw new Error(`unknown room ${name}`);
    }
    return { record: withEntities(base, entities), goal, size: `${W}x${H}` };
}

const rooms = arg('rooms', 'bare,button,button-block,rope,weapon').split(',');
const itemSets = arg('items', 'pre-sword,post-sword,post-shield').split(',');
const crossings = arg('crossing', 'off,on').split(',');

const rows = [];
for (const r of rooms) {
    const { record, goal, size } = room(r);
    for (const it of itemSets) {
        for (const c of crossings) {
            const staging = bootStaging({ boot: bootAtTile(record, START.tx, START.ty), items: ITEMS[it] });
            const goals = [collectGoal(goal.tx * 16, goal.ty * 16)];
            const t0 = Date.now();
            let out;
            try {
                out = withArrowLaneCrossing(c === 'on', () => solve(record, staging, goals, DEFAULT_BUDGET,
                    { name: `gen-arrow-${r}` }));
            } catch (e) {
                out = { verdict: 'THREW', reasonText: `${e?.name}: ${String(e?.message ?? e)}` };
            }
            const ms = Date.now() - t0;
            const strategies = [...new Set((out.records ?? []).flatMap((rec) => [rec.strategy,
                ...(rec.forcedHits ?? []).map((f) => `forced:${f.candidate}`)]).filter(Boolean))];
            const row = { room: r, size, items: it, crossing: c, verdict: out.verdict, ms, ticks: out.ticks ?? null,
                strategies, hits: out.records?.at(-1)?.damage?.hits ?? null,
                why: out.verdict === 'SOLVED' ? '' : String(out.reasonText ?? '').split('\n')[0].slice(0, 300),
                full: has('full') ? String(out.reasonText ?? '') : undefined };
            rows.push(row);
            if (!has('json')) {
                process.stdout.write(`${r}\t${it}\tcrossing=${c}\t${row.verdict}\t${ms} ms\tticks=${row.ticks}`
                    + `\t[${strategies.join(',')}]${row.why ? `\n    ${row.why}` : ''}\n`);
            }
        }
    }
}
if (has('json')) process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
