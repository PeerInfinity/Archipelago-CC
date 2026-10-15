// SCRATCH (seedling-hammer-sf D2): loaded through NODE_OPTIONS=--import (so a producer's child processes carry it too;
// SC's `--import` saw only `r8-tail`'s parent) — collects the lab's per-derivation records (`globalThis.__SF_LAB_SINK`,
// SF_LAB=census) and APPENDS them, one JSON line each, to $SF_LAB_OUT at exit (the runner truncates it first).
import { appendFileSync } from 'node:fs';
const rows = [];
globalThis.__SF_LAB_SINK = (rec) => { rows.push(JSON.stringify({ pid: process.pid, ...rec })); };
process.on('exit', () => { if (process.env.SF_LAB_OUT && rows.length) appendFileSync(process.env.SF_LAB_OUT, rows.join('\n') + '\n'); });
