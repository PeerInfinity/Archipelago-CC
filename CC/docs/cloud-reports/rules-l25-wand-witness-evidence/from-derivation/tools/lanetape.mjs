#!/usr/bin/env node
/**
 * lanetape.mjs — slice rules-nohit-derivation: turn a derived lane chain (`derive-nohit.mjs --json`) into a key
 * tape, simulated on the derivation's own lane world (transcribed WallFlyer + player tick, no other bodies), then
 * replayed on the JS model (`createRunForStaging`: every body of the room, Bobs included) for information. The tape
 * is what `witness.mjs` plays on the game.
 *
 * Between lanes the player WALKS inside the waiting component (a BFS pixel path, steered; it never touches a ray).
 * A lane's start is reached only to within a pixel, so the lane is re-fitted from the state actually reached: the
 * smallest change of (n1, k2, n2) that still ends, with no contact, in the lane's recorded configuration and
 * component.
 *
 * Run: node lanetape.mjs --json=runs/full.json --level=22 --from=21 --to=30 [--arm=none] --out=tapes/x.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './derive-nohit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = await import(join(REPO, 'scripts/procgen/probe-seedling-wallflyer-nohit.mjs'));
const PP = await import(join(REPO, 'frontend/modules/seedlingDemo/playerPhysicsV1.js'));
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const keysToward = (dx, dy, dead = 0.6) => [...(dx > dead ? ['right'] : dx < -dead ? ['left'] : []), ...(dy > dead ? ['down'] : dy < -dead ? ['up'] : [])];
const KS = (arr) => new Set(arr);

export function buildTape({ level: lv, from, to, arm = 'none', chain }) {
    const map = D.readMap();
    const level = map.levels.find((l) => l.level === lv);
    const room = D.roomOf(level);
    const doors = D.doorsOf(map, level);
    const fromDoor = doors.find((d) => d.to === from);
    const toDoor = doors.find((d) => d.to === to);
    let st = { p: { x: fromDoor.spawn.x, y: fromDoor.spawn.y, vx: 0, vy: 0, dir: 3 }, fl: D.settledFlyers(room), triggered: false, t: 0 };
    const perTick = [];
    const push = (keys) => {
        const nx = D.tick(room, st, KS(keys), false);
        if (!nx) throw new Error(`contact at tick ${perTick.length} (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)}) keys ${keys}`);
        st = nx;
        perTick.push([...keys].sort());
    };
    for (let i = 0; i < 5; i += 1) push([]);   // the probe's lead
    const W = room.W;
    const walkTo = (tx, ty, { allowLeave = false } = {}) => {
        const m = D.waitingMap(room, st.fl);
        const comp = (x, y) => { const k = Math.round(y) * W + Math.round(x); return m.ok[k] ? m.comp[k] : -1; };
        const c = comp(st.p.x, st.p.y);
        // BFS path over the component's pixels
        const start = Math.round(st.p.y) * W + Math.round(st.p.x);
        const goal = Math.round(ty) * W + Math.round(tx);
        const prev = new Int32Array(W * room.H).fill(-2);
        prev[start] = -1;
        const q = [start];
        let found = start === goal;
        for (let h = 0; h < q.length && !found; h += 1) {
            const j = q[h];
            const x = j % W; const y = (j - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx; const ny = y + dy;
                const k = ny * W + nx;
                if (nx < 0 || ny < 0 || nx >= W || ny >= room.H || prev[k] !== -2) continue;
                if (!(m.ok[k] && m.comp[k] === c) && !(allowLeave && room.playerFree(nx, ny))) continue;
                prev[k] = j;
                if (k === goal) { found = true; break; }
                q.push(k);
            }
        }
        if (!found) throw new Error(`no walk from (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)}) to (${tx},${ty}) in its component`);
        const path = [];
        for (let k = goal; k !== -1; k = prev[k]) path.push([k % W, (k - (k % W)) / W]);
        path.reverse();
        let i = 0;
        for (let n = 0; n < 2000; n += 1) {
            while (i < path.length - 1 && Math.hypot(path[i][0] - st.p.x, path[i][1] - st.p.y) < 3) i += 1;
            const [wx, wy] = i < path.length - 1 ? path[Math.min(i + 3, path.length - 1)] : [tx, ty];
            const dx = wx - st.p.x; const dy = wy - st.p.y;
            const near = i >= path.length - 1;
            if (near && Math.hypot(tx - st.p.x, ty - st.p.y) < 0.6 && Math.hypot(st.p.vx, st.p.vy) < 0.01) return;
            // near the goal: brake (release) when the coast would carry us there
            const speed = Math.hypot(st.p.vx, st.p.vy);
            if (near && Math.hypot(dx, dy) < speed * speed * 2 + 0.5) { push([]); continue; }
            push(keysToward(dx, dy, near ? 0.5 : 1));
        }
        throw new Error(`walk to (${tx},${ty}) did not settle`);
    };
    const lanes = [];
    for (const lane of chain) {
        const [rd, ph] = lane.runway ? lane.runway.split('x') : [null, 0];
        const rw = rd ? D.runway(rd, Number(ph)) : { x: 0, y: 0 };
        walkTo(lane.from.x - rw.x, lane.from.y - rw.y);
        const before = { ...st, p: { ...st.p } };
        const base = perTick.length;
        // the lane as recorded, then re-fitted if the reached start breaks it
        const tryLane = (n1, k2, n2) => {
            st = { ...before, p: { ...before.p } };
            perTick.length = base;
            try {
                for (let i = 0; i < Number(ph); i += 1) push(rd.split('+'));
                for (let i = 0; i < n1; i += 1) push(lane.k1.split('+'));
                for (let i = 0; i < n2; i += 1) push(k2 === '-' || k2 === 'release' ? [] : k2.split('+'));
                for (let i = 0; i < 20 && !(st.fl.every((w) => !w.vx && !w.vy) && Math.hypot(st.p.vx, st.p.vy) === 0); i += 1) push([]);
                if (configOf(st.fl) !== lane.config) return false;
                return true;
            } catch { return false; }
        };
        const endComp = (() => { const fl0 = lane.config; return fl0; })();
        const tryLane2 = (k1, n1, k2, n2) => {
            st = { ...before, p: { ...before.p } };
            perTick.length = base;
            try {
                for (let i = 0; i < Number(ph); i += 1) push(rd.split('+'));
                for (let i = 0; i < n1; i += 1) push(k1.split('+'));
                for (let i = 0; i < n2; i += 1) push(k2 === '-' || k2 === 'release' ? [] : k2.split('+'));
                for (let i = 0; i < 24 && !(st.fl.every((w) => !w.vx && !w.vy) && Math.hypot(st.p.vx, st.p.vy) === 0); i += 1) push([]);
                if (configOf(st.fl) !== lane.config || Math.hypot(st.p.vx, st.p.vy) !== 0) return false;
                const m = D.waitingMap(room, st.fl);
                const k = (x, y) => Math.round(y) * room.W + Math.round(x);
                return m.ok[k(st.p.x, st.p.y)] === 1 && m.comp[k(st.p.x, st.p.y)] === m.comp[k(lane.end.x, lane.end.y)];
            } catch { return false; }
        };
        const configOf = (fl) => fl.map((w) => (!w.removed && !w.destroy ? `${w.x},${w.y}` : 'x')).join(';');
        let ok = tryLane(lane.n1, lane.k2, lane.n2);
        let fit = ok ? 'as recorded' : null;
        for (let d = 1; !ok && d <= 4; d += 1) {
            for (const n1 of [lane.n1 - d, lane.n1 + d]) {
                for (const n2 of [lane.n2, lane.n2 - d, lane.n2 + d]) {
                    if (!ok && n1 > 0 && n2 >= 0 && tryLane(n1, lane.k2, n2)) { ok = true; fit = `n1 ${n1}, n2 ${n2}`; }
                }
            }
        }
        if (!ok) {
            // a local re-search from the state reached: any (k1, n1, k2, n2) of the lane family that ends, with no
            // contact, with every flyer at rest in the lane's configuration and the player stopped in the waiting
            // component that holds the lane's recorded end
            const holds = ['up', 'down', 'left', 'right', 'up+left', 'up+right', 'down+left', 'down+right'];
            const target = (() => { const fl = null; return lane.config; })();
            outer: for (const k1 of [lane.k1, ...holds.filter((h) => h !== lane.k1)]) {
                for (let n1 = 1; n1 <= 40; n1 += 1) {
                    for (const k2 of [lane.k2, 'release', ...holds]) {
                        for (let n2 = 0; n2 <= 44; n2 += 4) {
                            if (tryLane2(k1, n1, k2, n2)) { ok = true; fit = `re-searched: ${k1} ${n1}, ${k2} ${n2}`; break outer; }
                        }
                    }
                }
            }
        }
        if (!ok) throw new Error(`lane ${JSON.stringify(lane)} does not re-fit from (${before.p.x.toFixed(2)},${before.p.y.toFixed(2)})`);
        lanes.push({ ...lane, startedAt: { x: +before.p.x.toFixed(2), y: +before.p.y.toFixed(2) }, fit, endedAt: { x: +st.p.x.toFixed(2), y: +st.p.y.toFixed(2) } });
    }
    walkTo(toDoor.spawn.x, toDoor.spawn.y);
    // through the door: hold toward the teleporter's cell
    const dx = toDoor.x + 8 - st.p.x; const dy = toDoor.y + 8 - st.p.y;
    const keys = keysToward(dx, dy, 2);
    for (let i = 0; i < 40; i += 1) perTick.push([...keys].sort());
    for (let i = 0; i < 20; i += 1) perTick.push([]);
    return { case: `l${lv}-${from}-${to}-${arm}`, ticks: perTick.length, inputs: P.spansOf(perTick), perTick, lanes };
}

async function main() {
    const out = JSON.parse(readFileSync(arg('json'), 'utf8'));
    const lv = Number(arg('level')); const from = Number(arg('from')); const to = Number(arg('to')); const arm = arg('arm', 'none');
    const row = out.rows.find((r) => r.level === lv && r.from?.includes(from) && r.to?.includes(to));
    const a = row?.arms?.[arm];
    if (!a?.line) throw new Error(`no derived line for L${lv} ${from}->${to} ${arm}`);
    const t = buildTape({ level: lv, from, to, arm, chain: a.chain });
    const model = await P.replayOnModel(P.readMap(), P.parseCase(t.case), t.perTick);
    console.log(`TAPE ${t.case}: ${t.ticks} ticks; lanes ${JSON.stringify(t.lanes)}`);
    console.log(`MODEL (every body of the room): level ${model.level}, hits ${JSON.stringify(model.hits)}`);
    const spec = { case: t.case, ticks: t.ticks, inputs: t.inputs, note: `derived chain (${a.chain.length} lane(s)) from derive-nohit.mjs; lane-world sim clean; model: level ${model.level}, hits ${model.hits.length}`, lanes: t.lanes, model };
    writeFileSync(arg('out'), `${JSON.stringify(spec)}\n`);
    console.log(`wrote ${arg('out')}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
