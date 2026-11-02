// MEASUREMENT ONLY: solveProgress.test.js's L40 kill rung (r5-l40-part5 → the totem part (160,640)), twoPassSolve as
// the row runs it (no game oracle), with the census hook; prints the answer and AXIS_STRIKE_COUNTS.
// node --import ./axis-register.mjs axis-l40part5.mjs [--on]
const ROOT = process.env.AXIS_ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { loadTape } = await import(M + 'fixtures/index.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { twoPassSolve } = await import(M + 'twoPassSolve.js');
const PK = await import(M + 'pressKillCost.js');
if (process.argv.includes('--on')) PK.AXIS_STRIKE.enabled = true;
const SOURCE = atlasLevelSource();
const base = stagingFromTape(loadTape('r5-l40-part5'));
const staging = { ...base, noclip: false, noDamage: false, equips: [], persistence: base.persistence.filter((c) => c.at === undefined) };
const out = await twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
    goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], name: 'r5-l40-part5', boot: staging.boot,
    persistence: staging.persistence, gameTick: () => { throw new Error('no game oracle here'); } });
const keys = out.out.perTick.map((k) => [...k].sort().join('+'));
console.log(JSON.stringify({ on: PK.AXIS_STRIKE.enabled, ticks: keys.length,
    plan: (await import('node:crypto')).createHash('md5').update(JSON.stringify(keys)).digest('hex'),
    counts: PK.AXIS_STRIKE_COUNTS }));
const S = globalThis.__axisStats;
if (S) console.log(JSON.stringify({ driveTicks: S.driveTicks, axisTicks: S.axisTicks, armed: S.axisArmed, inReach: S.rows.length,
    rows: S.rows.map((x) => `${x.t}:${x.axis}:${x.held}:${x.inReach.map((b) => b.id + '/' + b.dir).join(',')}:${x.along.join(',') || '-'}`) }));
