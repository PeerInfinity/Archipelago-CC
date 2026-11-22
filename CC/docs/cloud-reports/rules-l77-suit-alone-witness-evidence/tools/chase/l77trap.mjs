#!/usr/bin/env node
// rules-l77-trap-chase-witness: L77's lavatrap@96,192 (centre 104,200) KILLED FROM OUTSIDE its 32 px chompRange, one
// arm at a time, item-less otherwise, from each door's own landing. Hand waypoint scripts on the JS model (the model
// does not model the tongue: it only CHOOSES keys). The game decides (play.mjs).
//   node l77trap.mjs [--case=a,b] [--trace] [--every=10] --build=<dir>
//
// The kill spots (LavaTrap.as:21,81-82: the tongue launches only when int(distance) <= 32, i.e. distance < 33;
// hitbox 10x10 centred, :43 -> x 99..109, y 195..205):
//   S  south, c6 r14, facing up:  Spear rect y in [y-30, y+2)  (Player.as:971-980, spearY :1345) hits iff y < 235;
//      outside the disc iff y >= 233.  Window y in [233, 235).   Wand: shot spawns 16 px ahead (:998) and flies
//      48 px (WandShot.as:64-65, tilesMove 3), c6 r13 is floor: in reach from y <= ~264.
//   W  west, c4 r12, facing right: Spear rect x in [x, x+32) hits iff x > 67; outside iff x <= 71 (y = 200).
//      Wand: c5 r12 is floor.
//   N  north, c6 r10, facing down: Spear rect y in [y+2, y+34) hits iff y > 161; outside iff y <= 167. The spear has
//      no Solid test (Player.as:960-990), so the c6 r11 wall does not stop it; it DOES stop a wand shot (Mobile.solids).
// Damage per hit (Enemy.hit, hitsMax 3, hitsTimerMax 30): Spear 2 (2 hits), Wand 0.5 (6 hits), Sword 1 (3 hits),
// Fire 0 effect (hitByFire false, Enemy.as:38,151). One hit per 30 ticks at most, so the scripts space presses >= 36.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { author, tapeOf } from './author.mjs';
const R0 = new URL('../../../../../../', import.meta.url).pathname;
const { arrivalStaging } = await import(join(R0, 'frontend/modules/seedlingDemo/fidelityArrival.js'));
// OPEN-LOOP key ops with no model (the model refuses a WandShot near the trap: levelRun cannot place a LavaTrap)
export const rawTicks = (ops) => { const t = []; for (const op of ops) {
    if (op[0] === 'wait') for (let i = 0; i < op[1]; i++) t.push([]);
    else if (op[0] === 'keys') for (let i = 0; i < op[2]; i++) t.push(op[1].split('+'));
    else if (op[0] === 'fire') t.push(['primary']);
    else if (op[0] === 'fireEvery') for (let i = 0; i < op[1]; i++) { t.push(['primary']); for (let j = 1; j < op[2]; j++) t.push([]); }
    else throw new Error(`raw op ${op[0]}`); } return t; };
// a model-authored prefix (script) + an open-loop tail (rawTail); `raw: true` = the whole script open loop
export function build(c, opts) {
    if (c.raw) { const st = arrivalStaging(c.boot, { items: c.items }); return { st, perTick: rawTicks(c.script), model: { raw: true, ticks: rawTicks(c.script).length } }; }
    const a = author(c, opts);
    if (c.rawTail) { a.perTick.push(...rawTicks(c.rawTail)); a.model.rawTail = rawTicks(c.rawTail).length; }
    return a;
}
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SOUTH = { level: 77, x: 96, y: 288 };   // the L78 door's landing (census)
const NORTH = { level: 77, x: 16, y: 32 };    // the L76 door's landing (census)
const n = (k, d) => Number(arg(k, d));
// south spot: walk up the c6 corridor, stop in the window, face up
const toS = [['to', 104, 260], ['to', 104, n('sy', '233.9')]];
// press every `gap` ticks, `k` presses
const presses = (k, gap) => [['fireEvery', k, gap]];
// from the south spot, through the dead trap's disc, the bridge and the gap, out of the L76 door (west)
const ON_NORTH = [['to', 88, 216], ['to', 72, 200], ['to', 72, 168], ['to', 120, 164], ['to', 120, 90], ['to', 104, 72],
    ['to', 88, 52], ['to', 88, 36], ['to', 8, 36], ['keys', 'left', 30]];
// north: landing -> r2 east -> c5 r3 -> c6 r4 -> c7 down the bridge -> r10
const TO_R10 = [['to', 88, 36], ['to', 104, 52], ['to', 120, 72], ['to', 120, 90], ['to', 120, 164]];
// north spot (down) and west spot (right)
const toN = [['to', 104, n('ny', '164')], ['keys', 'down', 1]];
const toW = [['to', 72, 164], ['to', 70, 184], ['to', 70, 200], ['to', n('wx', '69'), 200], ['keys', 'right', 1]];
// from the west spot, through the dead trap's disc, down the corridor to the L78 door
const ON_SOUTH = [['to', 72, 200], ['to', 88, 216], ['to', 104, 232], ['to', 104, 300], ['keys', 'down', 40]];
const ON_SOUTH_N = [['to', 72, 164], ['to', 72, 200], ...ON_SOUTH.slice(1)];
const CASES = {};
for (const [arm, flag, k, gap] of [['spear', 'hasSpear', 3, 40], ['wand', 'hasWand', 8, 40], ['sword', 'hasSword', 4, 40], ['fire', 'hasFire', 3, 40]]) {
    // FORWARD (L78 -> L76): kill from S, then out north
    CASES[`l77t-S-${arm}`] = { boot: SOUTH, items: [flag], script: [...toS, ['keys', 'up', 1], ...presses(k, gap), ['wait', 20], ...ON_NORTH] };
    // the kill alone (stay at S), to read the trap's fate without the walk
    CASES[`l77t-S-${arm}-only`] = { boot: SOUTH, items: [flag], script: [...toS, ['keys', 'up', 1], ...presses(k, gap), ['wait', 40]] };
    // REVERSE (L76 -> L78): kill from W (and from N for the spear), then out south
    CASES[`l77t-W-${arm}`] = { boot: NORTH, items: [flag], script: [...TO_R10, ...toW, ...presses(k, gap), ['wait', 20], ...ON_SOUTH] };
    CASES[`l77t-W-${arm}-only`] = { boot: NORTH, items: [flag], script: [...TO_R10, ...toW, ...presses(k, gap), ['wait', 40]] };
}
CASES['l77t-N-spear'] = { boot: NORTH, items: ['hasSpear'], script: [...TO_R10, ...toN, ...presses(3, 40), ['wait', 20], ...ON_SOUTH_N] };
CASES['l77t-N-spear-only'] = { boot: NORTH, items: ['hasSpear'], script: [...TO_R10, ...toN, ...presses(3, 40), ['wait', 40]] };
// SPOT probes: boot ON the kill spot (not a door landing), so only the arm-vs-trap exchange is measured
for (const [arm, flag, k] of [['spear', 'hasSpear', 3], ['wand', 'hasWand', 8], ['sword', 'hasSword', 4], ['fire', 'hasFire', 3]]) {
    CASES[`l77spot-W-${arm}`] = { boot: { level: 77, x: 61, y: 192 }, items: [flag], raw: true, script: [['keys', 'right', 1], ...presses(k, 40), ['wait', 60]] };
    CASES[`l77spot-N-${arm}`] = { boot: { level: 77, x: 96, y: 156 }, items: [flag], raw: true, script: [['keys', 'down', 1], ...presses(k, 40), ['wait', 60]] };
}
// CHAINED cases: a beam prefix (tapes/beam/<name>.tape.json, replayed on the model), then a kill segment
import { readFileSync, existsSync } from 'node:fs';
const BEAMS = join(new URL('../../', import.meta.url).pathname, 'tapes/beam');
const tapeKeys = (f) => { const t = JSON.parse(readFileSync(f, 'utf8')); const nn = Math.max(t.tick_count ?? 0, t.inputs.reduce((m, i) => Math.max(m, i.to), 0));
    const k = Array.from({ length: nn }, () => []); for (const i of t.inputs) for (let x = i.from; x < i.to; x++) k[x].push(i.key); return k; };
const beamKeys = (name) => (existsSync(join(BEAMS, `${name}.tape.json`)) ? tapeKeys(join(BEAMS, `${name}.tape.json`)) : null);
const K = (name) => beamKeys(name) ?? [];
// FORWARD kill at S after the beam to c6 r14 (the beam killed both runners with the Spear)
// (the model's player drifts ~2 px after a 'to' stops, so stop at 236 and let it settle facing up into [233, 235))
CASES['l77c-S-spear-kill'] = { boot: SOUTH, items: ['hasSpear'], script: [['replay', K('S-spear-to-S')], ['to', 104, n('sy', '237')], ['wait', 8], ['nudge', 'up', 'y', 233.3, 234.7],
    ...presses(3, 40), ['wait', 20]] };
// Wand FORWARD: no model route past the runners (beam, trap hidden from the model). Open-loop game attempts:
// shoot the nearer runner (left, then right) from the landing; and the S-spot kill probe booted ON the S spot
CASES['l77w-fwd-wand-left'] = { boot: SOUTH, items: ['hasWand'], raw: true, script: [['keys', 'left', 1], ...presses(6, 31), ['keys', 'right', 1], ...presses(6, 31)] };
CASES['l77w-fwd-wand-up'] = { boot: SOUTH, items: ['hasWand'], raw: true, script: [['keys', 'up', 1], ...presses(10, 31)] };
CASES['l77spot-S-wand'] = { boot: { level: 77, x: 96, y: 226 }, items: ['hasWand'], raw: true, script: [['keys', 'up', 1], ...presses(8, 40), ['wait', 60]] };
CASES['l77spot-S-spear'] = { boot: { level: 77, x: 96, y: 226 }, items: ['hasSpear'], raw: true, script: [['keys', 'up', 1], ...presses(3, 40), ['wait', 60]] };
// REVERSE kill at W after the beam to r10 c4 (the beam killed the bulb with the Spear): down c4 to r12 at x 66, then
// tap right into x in [68, 71) (facing right, outside the disc), thrust
CASES['l77c-W-spear-kill'] = { boot: NORTH, items: ['hasSpear'], script: [['replay', K('N-spear-to-r10')], ['to', 72, 168], ['to', 67, 176], ['to', 66, 200], ['wait', 8],
    ['nudge', 'right', 'x', 68, 70.6], ...presses(3, 40), ['wait', 20]] };
// Wand REVERSE: no model route past the bulb (Bulb.as: hitsMax 1, so 2 shots of 0.5, 30 ticks apart; its death
// writes lava under it, :79, so it must die off the c5 r3 neck). Open-loop game attempts: down the c5 column from the
// r2 floor while it is still at r4/r5 (knockback 3 per shot, WandShot.as:24)
for (const [nm, x, y] of [['a', 88, 36], ['b', 84, 36], ['c', 72, 36]]) {
    CASES[`l77w-rev-wand-bulb-${nm}`] = { boot: NORTH, items: ['hasWand'], script: [['to', x, y]], rawTail: [['keys', x === 72 ? 'right' : 'down', 1], ...presses(5, 31), ['wait', 40]] };
}
// L78 (lavatrap@96,80 = tile 6,5 alone seals L78's L77<->L79 neck, necks.mjs). From the L77 door's landing (256,16):
// kill lavatrap@144,96 (centre 152,104) from c11 r6 facing left (spear rect [x-32, x) hits iff x < 189; outside iff
// x >= 185), then lavatrap@96,80 (centre 104,88) from c8 r5 facing left (hits iff x < 141; outside iff x >= 137;
// 34.5 px from lavatrap@144,48's centre (152,56) there), then west along r5, up c2, the lock, the L79 door
const L78B = { level: 78, x: 256, y: 16 };
CASES['l78c-spear-kill96'] = { boot: L78B, items: ['hasSpear'], script: [['replay', K('L78-spear-to-E96')], ['to', 193, 104], ['wait', 8], ['keys', 'left', 1], ['wait', 6],
    ['nudge', 'left', 'x', 185.6, 188.4], ...presses(3, 40), ['wait', 10]] };
// then the neck trap lavatrap@96,80 from c8 r5 facing left: x in [137.6, 140.4), y ~ 92 (spear rect y [y-0.5, y+4.5)
// meets the hitbox 83..93; >= 36 px from lavatrap@144,48's centre: the game drifted ~2 px from the model and at
// (142.3, 85.5), 31.1 px from it, was pulled in and died, run l78c-spear-kill80 first attempt)
CASES['l78c-spear-kill80'] = { boot: L78B, items: ['hasSpear'], script: [['replay', K('L78-spear-to-E80b')],   // (a beam tape carries its --prefix)
    ['to', 143, 93], ['wait', 8], ['keys', 'left', 1], ['wait', 6], ['nudge', 'left', 'x', 137.6, 140.4], ...presses(3, 40), ['wait', 10]] };
// ad hoc: --adhoc='{"boot":"S"|"N","items":[...],"script":[...]}' (exploration on the model)
if (arg('adhoc')) { const a = JSON.parse(arg('adhoc')); CASES.adhoc = { ...a, boot: a.boot === 'N' ? NORTH : SOUTH }; }
export { CASES, SOUTH, NORTH, ON_NORTH, ON_SOUTH, TO_R10 };
if (import.meta.url === `file://${process.argv[1]}`) {
    const dir = arg('build');
    if (dir) mkdirSync(dir, { recursive: true });
    for (const name of arg('case') ? arg('case').split(',') : Object.keys(CASES)) {
        const a = build(CASES[name], { trace: process.argv.includes('--trace') });
        console.log('MODEL', name, JSON.stringify(a.model));
        if (process.argv.includes('--trace')) for (const s of a.log) if (s.t % n('every', '10') === 0) console.error(JSON.stringify(s));
        if (dir) writeFileSync(join(dir, `${name}.tape.json`), JSON.stringify(tapeOf(a, name, 'L77 trap kill from outside chompRange')));
    }
}
