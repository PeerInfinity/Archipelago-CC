// fidelity MASKS D1 search: a boot + an idle-then-swing script whose model run DIVERGES between
// `pixelMaskSightLines` OFF and ON because a swing's line crosses a pixelmask (the chaser arm's `why`).
// Usage: node search-swing.mjs --level=65 --box=160,32,240,112 [--items=hasSword] [--max=5] [--ticks=90]
import { atlasLevelSource } from '../../../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { withContactFidelity } from '../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { ropeStaging } from '../../../../frontend/modules/seedlingDemo/fidelityRope.js';
import { buildLevelWorld, ROLES } from '../../../../frontend/modules/seedlingDemo/levelWorld.js';
import { playerBoxAt } from '../../../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const level = Number(arg('level', 65));
const [bx0, by0, bx1, by1] = arg('box', '160,32,240,112').split(',').map(Number);
const items = arg('items', 'hasSword').split(',');
const MAX = Number(arg('max', 5)), TICKS = Number(arg('ticks', 90)), STEP = Number(arg('step', 8));
const src = atlasLevelSource();
const w = buildLevelWorld(src(level), { roles: ROLES });
function play(staging, script, on) {
    return withContactFidelity({ pixelMaskSightLines: on }, () => {
        const run = createRunForStaging(staging, src);
        const out = [];
        try {
            for (let t = 0; t < script.length; t++) {
                run.advance(new Set(script[t]));
                out.push({ x: run.state.x, y: run.state.y, lv: run.level, ch: run.chasers.map((c) => `${c.id}:${c.x},${c.y}`).join('|'), dr: (run.drills?.bodies ?? []).map((d) => `${d.id}:${d.x},${d.y},${d.anim}`).join('|'), wf: (run.entities?.('wallflyers') ?? []).map((d) => `${d.id}:${d.x},${d.y}`).join('|') });
            }
        } catch (e) { out.push({ err: e.message.slice(0, 160) }); }
        return { out, hits: run.chaserPressHits };
    });
}
let found = 0;
for (let y = by0; y <= by1 && found < MAX; y += STEP) for (let x = bx0; x <= bx1 && found < MAX; x += STEP) {
    if (w.collidesSolid(playerBoxAt(x, y))) continue;
    const staging = await ropeStaging({ boot: { level, x, y }, items, persistence: [] });
    for (const dirKey of arg('dirs', 'n,left,right,up,down').split(',').map((d) => (d === 'n' ? null : d))) for (let k = 2; k < Number(arg('kmax', TICKS - 20)) && found < MAX; k += Number(arg('kstep', 3))) {
        // walk `dirKey` until k, then swing every 12 ticks
        const script = Array.from({ length: TICKS }, (_, t) => {
            const s = []; if (dirKey && t < k) s.push(dirKey);
            if (arg('swing', '1') === '1' && t >= k && (t - k) % 12 === 0) s.push('primary');
            if (arg('swing', '1') === '0' && dirKey && t >= k && t < k + 20) s.push(dirKey === 'left' ? 'up' : dirKey === 'right' ? 'down' : dirKey === 'up' ? 'right' : 'left');
            return s;
        });
        const B = play(staging, script, true);
        const masked = B.hits.filter((h) => new RegExp(arg('why', 'collideLine')).test(h.why ?? ''));
        if (!masked.length && arg('any', '0') !== '1') continue;
        const A = play(staging, script, false);
        const d = A.out.findIndex((a, i) => JSON.stringify(a) !== JSON.stringify(B.out[i]));
        if (d < 0) continue;
        found++;
        console.log(`FOUND boot(${x},${y}) dir=${dirKey} k=${k}: masked ${masked.map((h) => `t${h.t} ${h.id} ${h.why}`).join('; ')}; first divergence t${d} OFF ${JSON.stringify(A.out[d])} ON ${JSON.stringify(B.out[d])}; ON err ${B.out.at(-1).err ?? '-'} OFF err ${A.out.at(-1).err ?? '-'}`);
        break;
    }
}
console.log(`done, ${found} found`);
