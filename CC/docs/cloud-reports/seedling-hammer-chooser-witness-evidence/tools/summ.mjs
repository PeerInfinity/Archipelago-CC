import fs from 'node:fs';
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(JSON.parse);
for (const r of rows) {
  const h = r.history ?? [];
  const last = h.at(-1);
  const plans = (r.plans ?? []).map((p) => `${p.ok ? 'ok' : p.kind}${p.ticks ? ':' + p.ticks : ''}`).join(',');
  const msg = (r.plans ?? []).filter((p) => !p.ok).map((p) => p.message).at(-1) ?? '';
  console.log([r.id, r.end, `hits=${r.roomHits?.max ?? '?'}`, `divs=${(r.divs ?? []).length}`,
    `end=${last ? `${last.end?.level}:${last.end?.x},${last.end?.y}` : '-'}`, `exp=${last?.expectedEnd ? `${last.expectedEnd.level}:${last.expectedEnd.x},${last.expectedEnd.y}` : '-'}`,
    `plans=[${plans}]`, `env=${r.solverEnv ?? 'default'}`, r.key, msg.slice(0, 160).replace(/\t/g, ' '), r.error ?? ''].join('\t'));
}
