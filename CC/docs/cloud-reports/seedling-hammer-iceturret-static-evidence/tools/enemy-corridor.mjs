// scratch (ICEST W0/M): census-seedling-enemies.mjs's CORRIDOR arm for one class (default iceturret), with the whole
// refusal text, the records and ICETURRET_STATIC_KILL_COUNTS. Usage: node enemy-corridor.mjs [--root=<tree>] [--cls=iceturret] [--tile=4,1]
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = (p) => import(`${ROOT}/frontend/modules/seedlingDemo/${p}`);
const { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } = await M('procgenLevel.js');
const { DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve } = await M('procgenOracle.js');
const { POST_SWORD_ITEMS } = await M('procgenPalette.js');
const { SEEDLING_DEFAULTS } = await M('procgenSeedling.js');
const SB = await M('solverBot.js');
const cls = args.cls ?? 'iceturret';
const [btx, bty] = (args.tile ?? '4,1').split(',').map(Number);
let rec = emptyLevel({ level: SEEDLING_DEFAULTS.level });
const floor = new Set();
for (let x = 1; x <= 8; x += 1) floor.add(`${x},1`);
for (let y = 1; y <= 8; y += 1) floor.add(`8,${y}`);
for (const c of (args.open ?? '').split(';').filter(Boolean)) floor.add(c);
const wall = [];
for (let ty = 1; ty <= 8; ty += 1) for (let tx = 1; tx <= 8; tx += 1) if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
rec = withTerrain(rec, wall);
rec = withEntities(rec, [{ type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
    { type: cls, ...oelAtTile(btx, bty) }]);
const staging = bootStaging({ boot: bootAtTile(rec, 1, 1), items: POST_SWORD_ITEMS, pins: ['dead_frames'], time: GENERATED_BOOT_TIME });
SB.resetIceTurretStaticKillCounts?.();
const out = solve(rec, staging, [collectGoal(128, 128)], DEFAULT_BUDGET, { name: `icest-${cls}@corridor`, scratchPersistence: true });
console.log('verdict', out.verdict, 'ticks', out.ticks ?? null);
console.log('reason', String(out.reasonText ?? '').slice(0, 2500));
for (const r of out.records ?? []) if (r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 400));
console.log('ICEST', JSON.stringify(SB.ICETURRET_STATIC_KILL_COUNTS ?? null));
