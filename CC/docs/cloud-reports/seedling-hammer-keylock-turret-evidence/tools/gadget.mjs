// scratch (KEYLOCK-TURRET M): a generated room — a bosslock in a wall, its goal behind it, a live ice turret below the
// key line, the boot outside the range — solved under the env's switches. Prints the end, the verbs, the hits on a
// fresh replay of the keys and the switch's counters. Usage: [ENV] node gadget.mjs [turretTx turretTy] [bootTy]
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await import(R + 'procgenLevel.js');
const { DEFAULT_BUDGET, bootStaging, collectGoal, solve } = await import(R + 'procgenOracle.js');
const { POST_SWORD_ITEMS } = await import(R + 'procgenPalette.js');
const SB = await import(R + 'solverBot.js');
const [ttx = 4, tty = 12, bty = 27] = process.argv.slice(2).map(Number);
let record = emptyLevel({ level: 900, width: 11, height: 30 });
const walls = [];
for (let tx = 1; tx <= 9; tx += 1) if (tx !== 5) walls.push({ tx, ty: 10, terrain: 'wall' });
record = withTerrain(record, walls);
record = withEntities(record, [
    { type: 'totempart', ...oelAtTile(5, 2), attrs: { tag: '0' } },
    { type: 'bosslock', ...oelAtTile(5, 10), attrs: { keyType: '0', tag: '1' } },
    ...(ttx >= 0 ? [{ type: 'iceturret', ...oelAtTile(ttx, tty) }] : []),
]);
const staging = bootStaging({ boot: bootAtTile(record, 5, bty), items: POST_SWORD_ITEMS, pins: ['dead_frames'] });
staging.save = { ...staging.save, keys: [0] };
SB.resetKeylockTurretCounts();
const t0 = Date.now();
const GOAL = process.env.GADGET_GOAL === 'collect' ? collectGoal(5 * 16, 2 * 16)
    : { kind: 'clear-tag', tag: { level: 900, tag: 1 }, at: { x: 80, y: 160 } };
const out = solve(record, staging, [GOAL], DEFAULT_BUDGET, { name: 'keylock-turret' });
const ms = Date.now() - t0;
const res = { verdict: out.verdict, ms, ticks: out.ticks ?? null, keys: Object.keys(out),
    verbs: out.verbs ?? null, refusal: String(out.reasonText ?? '').slice(0, 700), error: out.errorName ?? null,
    hits: out.hits ?? out.playerHits ?? null, counts: SB.KEYLOCK_TURRET_COUNTS };
console.log(JSON.stringify(res));
