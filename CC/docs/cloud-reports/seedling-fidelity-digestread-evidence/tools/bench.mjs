const root = process.argv[2];
const { loadTape } = await import(`${root}/frontend/modules/seedlingDemo/fixtures/index.js`);
const { atlasLevelSource } = await import(`${root}/frontend/modules/seedlingDemo/levelSource.js`);
const { createRunForStaging, stagingFromTape } = await import(`${root}/frontend/modules/seedlingDemo/tapeRunner.js`);
const S = stagingFromTape(loadTape('r9-solve-18'));
const run = createRunForStaging({ ...S, boot: { level: 63, x: 160, y: 120 }, persistence: [] }, atlasLevelSource());
let x = 0; const N = 5e6;
for (let r = 0; r < 3; r++) { const t0 = performance.now(); for (let i = 0; i < N; i++) x += run.state.x + run.ticksCompleted; console.log(root.slice(-6), 'state+ticks x', N, (performance.now() - t0).toFixed(0), 'ms'); }
