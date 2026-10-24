const root = process.argv[2];
const M = (p) => import(`${root}/frontend/modules/seedlingDemo/${p}`);
const { paletteFor } = await M('watchGenerate.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await M('procgenSeedling.js');
const { withHammerEscape } = await M('solverBot.js');
const on = withHammerEscape(true, () => generateSeedlingLevel({ seed: 30, palette: paletteFor('post-sword'),
    bounds: { obstacleTarget: 3 }, skeleton: seedlingSkeletonSpec('empty') }));
const s = on.summary;
console.log(JSON.stringify({ stop: s.stop, finalTicks: s.finalTicks, kept: s.kept?.map((k) => `${k.instance}@${JSON.stringify(k.at ?? k.anchor ?? null)}`), rejected: s.rejectedCount ?? s.rejected?.length }));
