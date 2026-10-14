// SCRATCH (seedling-hammer-sc D1): the player's top speed from the MODEL — `playerPhysicsV1`'s own applyFriction +
// applyInput, in `Mobile.mobileUpdate`'s order (friction; input; move), no walls. An exact DP over the velocity state:
// for every n, the most x displacement any key sequence can make in n ticks from rest (or from a given v0), with the
// other axis FREE (it may zig-zag: the friction is on the vector's length, so a y component lowers x's loss).
//   node speed-model.mjs [--speed=0.8 --friction=0.25] [--n=60] [--v0=vx,vy]
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const { applyInput, applyFriction, WALK_SPEED, DEFAULT_FRICTION } = await import(`${REPO}/frontend/modules/seedlingDemo/playerPhysicsV1.js`);
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const speed = Number(arg('speed', WALK_SPEED)); const fr = Number(arg('friction', DEFAULT_FRICTION));
const N = Number(arg('n', 60)); const [v0x, v0y] = arg('v0', '0,0').split(',').map(Number);
const XS = [['right'], [], ['left']]; const YS = [['up'], [], ['down']];
const OPTS = XS.flatMap((a) => YS.map((b) => new Set([...a, ...b])));
const AXIS = OPTS.filter((s) => !s.has('up') && !s.has('down'));
function run(opts) {
  let states = new Map([[`${v0x},${v0y}`, { vx: v0x, vy: v0y, x: 0 }]]);
  const best = []; let vmax = 0;
  for (let n = 1; n <= N; n += 1) {
    const next = new Map();
    for (const s of states.values()) {
      const f = applyFriction({ x: s.vx, y: s.vy }, fr);
      for (const k of opts) {
        const v = applyInput(f, k, speed);
        const x = s.x + v.x; if (v.x > vmax) vmax = v.x;
        const key = `${v.x.toFixed(4)},${Math.abs(v.y).toFixed(4)}`;
        const o = next.get(key);
        if (!o || x > o.x) next.set(key, { vx: v.x, vy: Math.abs(v.y), x });
      }
    }
    // dominance prune: drop a state with both lower x and lower-or-equal vx than another with the same |vy| bucket
    states = next; if (states.size > 60000) { const arr = [...states.values()].sort((a, b) => b.x - a.x).slice(0, 60000); states = new Map(arr.map((s) => [`${s.vx.toFixed(9)},${s.vy.toFixed(9)}`, s])); }
    best.push([...states.values()].reduce((m, s) => Math.max(m, s.x), -Infinity));
  }
  return { best, vmax };
}
const axis = run(AXIS); const free = run(OPTS);
const holdRight = []; { let v = { x: v0x, y: v0y }, x = 0; for (let n = 1; n <= N; n++) { v = applyInput(applyFriction(v, fr), new Set(['right']), speed); x += v.x; holdRight.push(x); } }
const holdDiag = []; { let v = { x: v0x, y: v0y }, x = 0; for (let n = 1; n <= N; n++) { v = applyInput(applyFriction(v, fr), new Set(['right', 'down']), speed); x += v.x; holdDiag.push(x); } }
console.log(JSON.stringify({ speed, friction: fr, v0: [v0x, v0y], vmaxAxisOnly: axis.vmax, vmaxFree: free.vmax }));
console.log('n\thold→\thold↘\tbest(axis keys)\tbest(any keys)\tbest/n\tceil(d/0.8) for d=best');
for (let n = 1; n <= N; n++) {
  if (n <= 12 || n % 5 === 0) console.log([n, holdRight[n - 1].toFixed(3), holdDiag[n - 1].toFixed(3), axis.best[n - 1].toFixed(3), free.best[n - 1].toFixed(3), (free.best[n - 1] / n).toFixed(3), Math.ceil(free.best[n - 1] / 0.8)].join('\t'));
}
