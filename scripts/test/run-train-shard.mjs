#!/usr/bin/env node
/**
 * run-train-shard.mjs — run one shard of the train Vitest tier.
 *
 *   node scripts/test/run-train-shard.mjs --shard=k/N [--dry-run]
 *
 * Asks vitest itself which files vitest.train.config.js collects, partitions them
 * with trainShardPlan.js, fails on an unsound partition, then runs this shard's
 * files through `npm run test:unit:train`. `--dry-run` prints every shard and stops.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkTrainPartition, loadTrainCosts, parseShardArg, planTrainShards, staleTrainCosts } from './trainShardPlan.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function collectedFiles() {
    const r = spawnSync('npx', ['vitest', 'list', '--config', 'vitest.train.config.js', '--filesOnly'],
        { cwd: REPO, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`vitest list exited ${r.status}:\n${r.stdout}\n${r.stderr}`);
    // eslint-disable-next-line no-control-regex
    const lines = r.stdout.replace(/\x1b\[[0-9;]*m/g, '').split('\n').map((l) => l.trim());
    return lines.filter((l) => l.endsWith('.train.test.js'));
}

const args = process.argv.slice(2);
const { k, n } = parseShardArg(args.find((a) => a.startsWith('--shard='))?.slice('--shard='.length));
const files = collectedFiles();
if (!files.length) {
    console.error('::error title=train shard plan::vitest collected no train-tier file');
    process.exit(1);
}
const costs = loadTrainCosts();
const shards = planTrainShards({ files, costs, bins: n });
for (const s of shards) {
    console.log(`TRAIN-SHARD ${s.shard}/${n}: ${s.files.length} file(s), ~${s.seconds}s planned`);
    for (const f of s.files) console.log(`  ${f}${s.unpriced.includes(f) ? '  (no cost row: placed in the lightest shard)' : ''}`);
}
const problems = checkTrainPartition(shards, files);
if (problems.length) {
    for (const p of problems) console.error(`::error title=train shard plan::${p}`);
    process.exit(1);
}
for (const f of staleTrainCosts(files, costs)) console.log(`::warning title=train shard plan::cost row for a file that no longer exists: ${f}`);
for (const f of shards.flatMap((s) => s.unpriced)) console.log(`::warning title=train shard plan::no cost row in scripts/test/train-shard-costs.json: ${f}`);
if (args.includes('--dry-run')) process.exit(0);

const r = spawnSync('npm', ['run', 'test:unit:train', '--', ...shards[k - 1].files], { cwd: REPO, stdio: 'inherit' });
process.exit(r.status ?? 1);
