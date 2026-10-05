#!/usr/bin/env node
/**
 * Measure-only (slice `seedling-fidelity-terrain` D1/D3) — REPLAY A CAPTURED GAME WITNESS ON THE MODEL, in node,
 * no browser, no box. Each capture (`probe-seedling-contact-divergence.mjs --capture=<dir>`) holds one leg's solve
 * request as the production engine sent it (the staging, its prefix, its equips), the room records the worker
 * built its level source from, the settled plan, and EVERY game tick the in-page sampler read while the game
 * played that plan (`botMobiles` + `botStatus`: the player's x, y, vx, vy, hits, hits_timer, and every body).
 *
 * The model's run is rebuilt exactly as the lab's `modelRows` builds it (`createRunForStaging` over the staging,
 * then the prefix and the solution, the plan's equips at their ticks), and after every tick its player is compared
 * with the game's at the same tick. A capture REPRODUCES when every sampled tick agrees on x and y to 1e-9 px;
 * the first differing tick and field are named otherwise (and the model's wallflyer / drill rows beside the game's).
 *
 *   --dir=<dir>       the captures (every *.json), or
 *   --file=<json>     one capture
 *   --json            print one JSON row per capture instead of text
 *   --bodies          also print the bodies at the first differing tick
 *
 * Exit 0 when every capture reproduces, 1 otherwise.
 *
 * Run: node scripts/procgen/replay-seedling-contact-capture.mjs --dir=<dir> [--json] [--bodies]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', '..', 'frontend', 'modules', 'seedlingDemo');

/** Undo `seedlingContactLab.tagged`: `{__map}` → Map, `{__set}` → Set. */
export function untag(o) {
    if (Array.isArray(o)) return o.map(untag);
    if (o && typeof o === 'object') {
        if (Array.isArray(o.__map) && Object.keys(o).length === 1) return new Map(o.__map.map(([k, v]) => [k, untag(v)]));
        if (Array.isArray(o.__set) && Object.keys(o).length === 1) return new Set(o.__set.map(untag));
        return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, untag(v)]));
    }
    return o;
}

/**
 * Replay one capture on the model. Returns `{ticks, compared, firstDiff, worst, model}` where `model` is the
 * per-tick model rows (player + wallflyers + chasers + drills when the run exposes them).
 */
export async function replayCapture(cap) {
    const { createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
    const { levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    const req = untag(cap.request);
    const plan = untag(cap.plan);
    const ls = levelSourceFromAtlas(untag(cap.records));
    const run = createRunForStaging(req.staging, ls, { scratchPersistence: req.scratchPersistence === true });
    const prefix = req.perTick ?? [];
    const keys = [...prefix, ...(plan.solution ?? [])];
    const eq = new Map([...(req.equips instanceof Map ? req.equips : []),
        ...((plan.equips ?? []).map((e) => [e.t + prefix.length, e.slot]))]);
    const game = new Map((cap.game ?? []).map((g) => [g.t, g]));
    const lastT = Math.max(...(cap.game ?? []).map((g) => g.t));
    const model = [];
    let firstDiff = null;
    let worst = 0;
    let compared = 0;
    let error = null;
    for (let i = 0; i <= keys.length; i++) {
        const t = i - prefix.length;
        if (t >= 0) {
            const st = run.state;
            const dmg = run.damage ?? {};
            const row = { t, level: run.level, x: st.x, y: st.y, vx: st.vx, vy: st.vy, hits: dmg.hits, hits_timer: dmg.hitsTimer,
                wallFlyers: (run.wallFlyers?.bodies ?? []).map((w) => ({ id: w.id, x: w.x, y: w.y, vx: w.vx, vy: w.vy, hitsTimer: w.hitsTimer })),
                drills: (run.drills?.bodies ?? []).map((d) => ({ id: d.id, x: d.x, y: d.y, anim: d.anim, hitsTimer: d.hitsTimer })) };
            model.push(row);
            const g = game.get(t);
            if (g?.player && g.level === row.level) {
                compared += 1;
                const d = Math.max(Math.abs(g.player.x - row.x), Math.abs(g.player.y - row.y));
                worst = Math.max(worst, d);
                if (!firstDiff) {
                    const fields = [['x', g.player.x, row.x], ['y', g.player.y, row.y], ['vx', g.player.vx, row.vx],
                        ['vy', g.player.vy, row.vy], ['hits', g.hits, row.hits], ['hits_timer', g.hits_timer, row.hits_timer]]
                        .filter(([, a, b]) => a !== undefined && b !== undefined && Math.abs(a - b) > 1e-9)
                        .map(([f, a, b]) => ({ field: f, game: a, model: b }));
                    if (fields.length) firstDiff = { t, fields, gameBodies: g.bodies, modelRow: row };
                }
            }
            if (t >= lastT) break;
        }
        if (i === keys.length) break;
        try {
            if (eq.has(i)) run.equipNow(eq.get(i));
            run.advance(keys[i]);
        } catch (e) {
            error = `${e.name}: ${String(e.message).slice(0, 400)}`;
            break;
        }
    }
    return { compared, firstDiff, worst, error, ticks: model.length, model };
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
    const dir = arg('dir');
    const files = arg('file') ? [arg('file')]
        : (dir ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map((f) => join(dir, f)) : []);
    if (!files.length) {
        console.error('replay-seedling-contact-capture: --dir=<dir> or --file=<json> is required');
        process.exit(2);
    }
    let bad = 0;
    for (const f of files) {
        const cap = JSON.parse(readFileSync(f, 'utf8'));
        // eslint-disable-next-line no-await-in-loop
        const r = await replayCapture(cap);
        const ok = !r.error && r.compared > 0 && r.worst <= 1e-9;
        if (!ok) bad += 1;
        const id = cap.leg?.id;
        const fd = r.firstDiff;
        if (process.argv.includes('--json')) {
            console.log(JSON.stringify({ id, level: cap.leg?.level, goal: cap.leg?.goal?.name, ok, compared: r.compared, worst: r.worst,
                error: r.error, first: fd ? { t: fd.t, fields: fd.fields } : null }));
        } else {
            console.log(`${ok ? 'PASS' : 'FAIL'}: leg ${id} L${cap.leg?.level} ${cap.leg?.goal?.name} — ${r.compared} game tick(s) compared, `
                + `worst |Δ| ${r.worst.toFixed(3)} px${r.error ? `; the model threw: ${r.error}` : ''}`
                + `${fd ? `; first differs at t${fd.t}: ${fd.fields.map((x) => `${x.field} game ${+x.game.toFixed?.(3) || x.game} model ${+x.model.toFixed?.(3) || x.model}`).join(', ')}` : ''}`);
            if (fd && process.argv.includes('--bodies')) {
                console.log(`      game bodies: ${JSON.stringify(fd.gameBodies.filter((b) => !/Torch|Light|Coin|Block/.test(b.cls)).map((b) => [b.cls, b.x, b.y, b.vx, b.vy, b.enemy?.hits_timer]))}`);
                console.log(`      model flyers: ${JSON.stringify(fd.modelRow.wallFlyers.map((w) => [w.id, w.x, w.y, w.vx, w.vy, w.hitsTimer]))} drills: ${JSON.stringify(fd.modelRow.drills)}`);
            }
        }
    }
    process.exit(bad ? 1 : 0);
}
