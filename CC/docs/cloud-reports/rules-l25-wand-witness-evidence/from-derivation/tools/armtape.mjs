#!/usr/bin/env node
/**
 * armtape.mjs — slice rules-nohit-derivation: HAND-AUTHORED arm tapes for the witness (the model refuses a WandShot
 * in a wallflyer room, so no search exists for the Wand). The shape is the derivation's DISARM-AT-REST arm: from a
 * waiting spot beside the band, off every ray, strike the body at rest; while its `hitsTimer` (30 ticks,
 * `Enemy.as:24`) gates its `hitPlayer` (`Enemy.as:213`), cross. Walks are steered in the derivation's lane world
 * (`derive-nohit.mjs`: the transcribed WallFlyer + player tick) with the struck body set aside after the strike.
 *
 * Each plan below is a list of steps:
 *   ['walk', x, y]            walk (BFS inside the waiting component, steered) to (x, y) and stop
 *   ['hold', keys, n]         hold keys ('up', 'up+left', '' = none) n ticks
 *   ['strike', id]            from here on the body `id` is set aside in the lane world (it was struck)
 *   ['door', to]              walk to the door's spawn and through it
 * Run: node armtape.mjs <plan-name> --out=tapes/<name>.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as D from './derive-nohit.mjs';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const P = await import(join(REPO, 'scripts/procgen/probe-seedling-wallflyer-nohit.mjs'));
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

export const PLANS = {
    // L22, south to north (the gated direction), Wand: shoot the west body of the lower band from under it, cross
    // beside it while it is struck (the east body needs ~22 ticks to come that far), then up the west column.
    'l22-25-21-wand': { level: 22, from: 25, to: 21, arm: 'wand', wait: 14, steps: [
        ['walk', 56, 141], ['hold', 'up', 1], ['hold', '', 12], ['hold', 'primary', 1], ['hold', '', 'WAIT'], ['strike', 'wallflyer@48,112'],
        ['hold', 'up', 34], ['walk', 40, 100], ['hold', 'up', 30], ['hold', '', 10], ['walk', 88, 52], ['walk', 104, 52], ['door', 21]] },
    // L25, west to east (the gated direction), Wand: shoot the west body from beside it (west, off both rays), cross
    // its column under its rest pose, shoot the east body from the gap, cross.
    // L25, west to east, Wand, attempt A: strike the west body at rest from the west, cross its column on row 3
    // while struck; strike the east body at rest from the gap, cross its column on row 3 while struck; then down the
    // east body's column and east along row 5 (under the pushable block), up the east column to the L22 door.
    'l25-26-22-wand-a': { level: 25, from: 26, to: 22, arm: 'wand', wait: 14, steps: [
        ['walk', 40, 58], ['hold', 'right', 1], ['hold', '', 12], ['hold', 'primary', 1], ['hold', '', 'WAIT'], ['strike', 'wallflyer@48,48'],
        ['hold', 'right', 12], ['hold', '', 10], ['hold', 'primary', 1], ['hold', '', 'WAIT'], ['strike', 'wallflyer@64,48'],
        ['hold', 'right', 16], ['hold', 'down', 26], ['hold', 'right', 34], ['hold', '', 6], ['hold', 'up', 45], ['hold', '', 6], ['door', 22]] },
    // L25, west to east (the gated direction), Wand: shoot the west body from beside it (west, off both rays) and
    // cross its column while it is struck; from the gap, shoot the east body six times (damage 0.5 of hitsMax 3,
    // each after its 30-tick hitsTimer) to KILL it (its Explosion, radius 9, is 14 px away); then down its column,
    // east along row 5, up the east column to the L22 door.
    'l25-26-22-wand': { level: 25, from: 26, to: 22, arm: 'wand', wait: 14, steps: [
        ['walk', 40, 58], ['hold', 'right', 1], ['hold', '', 12], ['hold', 'primary', 1], ['hold', '', 'WAIT'], ['strike', 'wallflyer@48,48'],
        ['hold', 'right', 12], ['hold', '', 10],
        ...Array.from({ length: 6 }, () => [['hold', 'primary', 1], ['hold', '', 32]]).flat(), ['strike', 'wallflyer@64,48'],
        ['hold', 'right', 10], ['hold', 'down', 25], ['hold', 'right', 32], ['hold', '', 8], ['hold', 'up', 40], ['hold', '', 8], ['door', 22]] },
};

export function buildArmTape(name, { wait } = {}) {
    const plan = PLANS[name];
    const map = D.readMap();
    const level = map.levels.find((l) => l.level === plan.level);
    const room = D.roomOf(level);
    const doors = D.doorsOf(map, level);
    const fromDoor = doors.find((d) => d.to === plan.from);
    let st = { p: { x: fromDoor.spawn.x, y: fromDoor.spawn.y, vx: 0, vy: 0, dir: 3 }, fl: D.settledFlyers(room), triggered: false, t: 0 };
    const perTick = [];
    const log = [];
    const push = (keys) => {
        const nx = D.tick(room, st, new Set(keys.filter((k) => k !== 'primary')), false);
        if (!nx) throw new Error(`lane world: contact at tick ${perTick.length} (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)})`);
        st = nx;
        perTick.push([...keys].sort());
    };
    const W = room.W;
    const walkTo = (tx, ty) => {
        const m = D.waitingMap(room, st.fl);
        const free = (x, y) => room.playerFree(x, y);
        const start = Math.round(st.p.y) * W + Math.round(st.p.x);
        const goal = Math.round(ty) * W + Math.round(tx);
        const prev = new Int32Array(W * room.H).fill(-2);
        prev[start] = -1;
        const q = [start];
        for (let h = 0; h < q.length && prev[goal] === -2; h += 1) {
            const j = q[h]; const x = j % W; const y = (j - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx; const ny = y + dy; const k = ny * W + nx;
                if (nx < 0 || ny < 0 || nx >= W || ny >= room.H || prev[k] !== -2) continue;
                if (!m.ok[k] && !(free(nx, ny) && !m.ok[start])) continue;
                prev[k] = j;
                q.push(k);
            }
        }
        if (prev[goal] === -2) throw new Error(`no waiting-spot walk from (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)}) to (${tx},${ty})`);
        const path = [];
        for (let k = goal; k !== -1; k = prev[k]) path.push([k % W, (k - (k % W)) / W]);
        path.reverse();
        let i = 0;
        for (let n = 0; n < 3000; n += 1) {
            while (i < path.length - 1 && Math.hypot(path[i][0] - st.p.x, path[i][1] - st.p.y) < 3) i += 1;
            const near = i >= path.length - 1;
            const [wx, wy] = near ? [tx, ty] : path[Math.min(i + 3, path.length - 1)];
            const dx = wx - st.p.x; const dy = wy - st.p.y;
            const speed = Math.hypot(st.p.vx, st.p.vy);
            if (near && Math.hypot(tx - st.p.x, ty - st.p.y) < 1 && speed < 0.01) return;
            if (near && Math.hypot(dx, dy) < speed * speed * 2 + 0.5) { push([]); continue; }
            const dead = near ? 0.5 : 1;
            push([...(dx > dead ? ['right'] : dx < -dead ? ['left'] : []), ...(dy > dead ? ['down'] : dy < -dead ? ['up'] : [])]);
        }
        throw new Error(`walk to (${tx},${ty}) did not settle: at (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)}) after ${log.join(' | ')}`);
    };
    for (let i = 0; i < 5; i += 1) push([]);
    for (const s of plan.steps) {
        if (s[0] === 'walk') walkTo(s[1], s[2]);
        else if (s[0] === 'hold') { const n = s[2] === 'WAIT' ? (wait ?? plan.wait) : s[2]; for (let i = 0; i < n; i += 1) push(s[1] ? s[1].split('+') : []); }
        else if (s[0] === 'strike') st = { ...st, fl: st.fl.map((w) => (w.id === s[1] ? { ...w, removed: true, destroy: true } : w)) };
        else if (s[0] === 'door') {
            const d = doors.find((x) => x.to === s[1]);
            walkTo(d.spawn.x, d.spawn.y);
            const dx = d.x + 8 - st.p.x; const dy = d.y + 8 - st.p.y;
            const keys = [...(dx > 2 ? ['right'] : dx < -2 ? ['left'] : []), ...(dy > 2 ? ['down'] : dy < -2 ? ['up'] : [])];
            for (let i = 0; i < 40; i += 1) perTick.push(keys);
            for (let i = 0; i < 20; i += 1) perTick.push([]);
        }
        log.push(`${JSON.stringify(s)} -> t ${perTick.length} at (${st.p.x.toFixed(1)},${st.p.y.toFixed(1)})`);
    }
    return { case: name, ticks: perTick.length, inputs: P.spansOf(perTick), log };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const name = process.argv[2];
    const caseName = name.replace(/-wand-[a-z]$/, '-wand');
    const wait = arg('wait', null);
    const t = buildArmTape(name, { wait: wait === null ? undefined : Number(wait) });
    for (const l of t.log) console.log(l);
    const spec = { case: caseName, ticks: t.ticks, inputs: t.inputs, note: `hand-authored ${name} (armtape.mjs plan${wait ? `, wait ${wait}` : ''})`, log: t.log };
    writeFileSync(arg('out'), `${JSON.stringify(spec)}\n`);
    console.log(`wrote ${arg('out')} (${t.ticks} ticks)`);
}
