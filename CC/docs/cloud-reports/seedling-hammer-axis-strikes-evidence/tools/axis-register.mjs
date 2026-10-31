// MEASUREMENT ONLY. `node --import ./axis-register.mjs <script>`: every driven tick of an AXIS-ALIGNED walk with a
// strikeable body in sword reach (the policy's own `strikeCandidates`, owed empty) is a row: level, tick, the walk's
// axis (velocity, else the held key), the bodies in reach, and which of them a strike aimed ALONG that axis reaches
// (the same scan with the bodies whose `facingToward` is on the axis). Rows are written at exit to $AXIS_OUT (jsonl).
import { register } from 'node:module';
register(new URL('./axis-loader.mjs', import.meta.url).href);
const ROOT = process.env.AXIS_ROOT ?? '/home/user/Archipelago-CC';
const D = ROOT + '/frontend/modules/seedlingDemo/';
const { facingToward } = await import(D + 'solverBot.js');
const { strikeCandidates } = await import(D + 'strikePolicy.js');
// Player.direction numbering (solverBot FACING_KEYS): 0 right, 1 up, 2 left, 3 down
const AXIS_OF_DIR = { 0: 'x', 2: 'x', 1: 'y', 3: 'y' };
const S = globalThis.__axisStats = { rows: [], driveTicks: 0, axisTicks: 0, axisArmed: 0 };
const axisOf = (st, held) => {
    if (st.vx !== 0 && st.vy === 0) return 'x';
    if (st.vy !== 0 && st.vx === 0) return 'y';
    if (st.vx !== 0 && st.vy !== 0) return 'diag';
    const hx = held.has('left') || held.has('right');
    const hy = held.has('up') || held.has('down');
    return hx && !hy ? 'x' : hy && !hx ? 'y' : hx && hy ? 'both' : 'rest';
};
globalThis.__axisDrive = (run, target, strike, axisAligned, held) => {
    S.driveTicks += 1;
    if (!axisAligned) return;
    S.axisTicks += 1;
    if (strike) S.axisArmed += 1;
    const inv = run.progress('inventory');
    if (!(inv?.hasSword || inv?.hasGhostSword)) return;
    const bodies = run.entities('strikeBodies') ?? [];
    if (bodies.length === 0) return;
    const st = run.state;
    const t = run.ticksCompleted;
    const { chosen } = strikeCandidates(st, bodies, { facingToward, owed: new Map(), tick: t });
    if (chosen.length === 0) return;
    const axis = axisOf(st, held);
    const onAxis = (axis === 'x' || axis === 'y')
        ? bodies.filter((b) => AXIS_OF_DIR[facingToward(st, b.rect)] === axis) : [];
    const { chosen: along } = onAxis.length
        ? strikeCandidates(st, onAxis, { facingToward, owed: new Map(), tick: t }) : { chosen: [] };
    S.rows.push({ level: run.level, t, x: st.x, y: st.y, vx: st.vx, vy: st.vy, axis, armed: Boolean(strike),
        held: [...held].sort().join('+'), target: { x: target.x, y: target.y },
        inReach: chosen.map((c) => ({ id: c.id, dir: c.direction ?? facingToward(st, bodies.find((b) => b.id === c.id).rect) })),
        along: along.map((c) => c.id) });
};
if (process.env.AXIS_OUT) {
    const { appendFileSync } = await import('node:fs');
    process.on('exit', () => {
        appendFileSync(process.env.AXIS_OUT, JSON.stringify({ tag: process.env.AXIS_TAG ?? null,
            driveTicks: S.driveTicks, axisTicks: S.axisTicks, axisArmed: S.axisArmed, rows: S.rows }) + '\n');
    });
}
