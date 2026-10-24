// SCRATCH (SFF2 D1): empty post-sword seed 30 with the escape ON (the slow row), its summary.
const root = process.argv[2];
const M = (p) => import(`${root}/frontend/modules/seedlingDemo/${p}`);
const { paletteFor } = await M('watchGenerate.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await M('procgenSeedling.js');
const { withHammerEscape } = await M('solverBot.js');
const { createHash } = await import('node:crypto');
const t0 = Date.now();
try {
    const on = withHammerEscape(true, () => generateSeedlingLevel({ seed: 30, palette: paletteFor('post-sword'),
        bounds: { obstacleTarget: 3 }, skeleton: seedlingSkeletonSpec('empty') }));
    const s = JSON.stringify(on.summary);
    console.log('summary', s.slice(0, 400), 'md5', createHash('md5').update(s).digest('hex'),
        'level-md5', createHash('md5').update(JSON.stringify(on.level ?? on.record ?? null)).digest('hex'), Date.now() - t0, 'ms');
} catch (e) { console.log('THREW', e.name, String(e.message).slice(0, 200), Date.now() - t0, 'ms'); }
