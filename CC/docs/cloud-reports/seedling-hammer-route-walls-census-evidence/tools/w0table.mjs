// scratch (L40-CENSUS): the sweep's rows (--sweep=<jsonl>) as a TSV: id, end, plans, ticks of the shipped plan(s),
// roomHits, ms, seamTime, arrivalClock, and the failure text (the page's own words). Decides nothing.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const rows = readFileSync(args.sweep, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).sort((a, b) => a.id - b.id);
console.log(['id', 'end', 'plans', 'ticks', 'roomHits', 'ms', 'seamTime', 'arrivalClock', 'key', 'failed'].join('\t'));
for (const r of rows) {
    const ticks = (r.plans ?? []).map((p) => (p.ok ? p.ticks : 'R')).join('/');
    const failed = r.failed == null ? '' : (typeof r.failed === 'string' ? r.failed : JSON.stringify(r.failed));
    console.log([r.id, r.end, (r.plans ?? []).length, ticks, JSON.stringify(r.roomHits ?? null), r.ms, r.seamTime ?? '',
        JSON.stringify(r.arrivalClock ?? null), r.key, failed.replace(/\s+/g, ' ').slice(0, 2000)].join('\t'));
}
