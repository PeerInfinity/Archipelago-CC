// scratch: candidate boots near each stand where the model ON lands FIGHT swings (die > 0), the player free
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const S = await import(M + 'fidelitySkinSwing.js');
const [lvl, bx, by, R] = process.argv.slice(2).map(Number);
const rows = [];
for (let x = bx - R; x <= bx + R; x += 8) for (let y = by - R; y <= by + R; y += 8) {
    if (x < 0 || y < 0) continue;
    const w = { name: 'c', boot: { level: lvl, x, y }, n: 300 };
    let tape; try { tape = await S.skinSwingTape(w); } catch { continue; }
    const on = await S.skinSwingModelSamples(tape, { pixelMaskSightLines: true });
    const off = await S.skinSwingModelSamples(tape, { pixelMaskSightLines: false });
    const sm = on.samples.filter(Boolean);
    const moved = new Set(sm.map((s) => `${s.x},${s.y}`)).size;
    const die = sm.reduce((n, s) => n + s.chasers.filter((c) => c.dying).length, 0);
    const dieOff = off.samples.filter(Boolean).reduce((n, s) => n + s.chasers.filter((c) => c.dying).length, 0);
    const hits = S.hitEvents(on.samples, (c) => c.id).length;
    const tags = [...new Set(sm.flatMap((s) => s.chasers.filter((c) => c.dying).map((c) => c.id.split('@')[0])))];
    const lvlEnd = sm.at(-1)?.level, ph = sm.at(-1)?.hits;
    if (die > 0) rows.push({ x, y, die, dieOff, hits, moved, tags: tags.join('+'), lvlEnd, ph, err: (on.error ?? '').slice(0, 50) });
}
rows.sort((a, b) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by));
for (const r of rows.slice(0, 25)) console.log(JSON.stringify(r));
