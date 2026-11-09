#!/usr/bin/env node
/**
 * wait-cloud — wake a local session when a cloud session it launched says it is finished.
 *
 * Nothing the harness offers means "finished": a cloud session's `idle` state and the
 * `result` event in its log end a TURN, and its branch pushes (even of its report) land
 * mid-work. So the session says so itself: the LAST commit it pushes carries
 *
 *     Cloud-Slice: <slice>
 *     Cloud-Status: final        (or `blocked`, when it needs an answer)
 *
 * and this script, run as the launcher's one background waiter, exits when it sees that.
 * A background command exiting is what wakes an idle launcher. Git only: no session API,
 * no process matching. See scripts/cloud/README.md for the launcher's steps.
 *
 *   node scripts/cloud/wait-cloud.mjs snapshot <baseline-file>     # BEFORE launching
 *   node scripts/cloud/wait-cloud.mjs wait --baseline=<file> --slice=<name> [--slice=<name> …]
 *        [--check-in=<minutes>] [--interval=<seconds>] [--remote=<name-or-url>] [--heartbeat=<file>]
 *
 * Every line on stdout starts `CLOUD-WAIT`. Exit: 0 at least one watched slice reported,
 * 2 usage or an unreadable baseline, 3 the check-in period passed with no report.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REF_GLOB = 'refs/heads/claude/*';
const DEFAULT_INTERVAL_S = 60;
// Long enough that a healthy slice rarely trips it, short enough that a session which
// died without pushing is noticed the same working session.
const DEFAULT_CHECK_IN_MIN = 90;
const EXIT = { reported: 0, usage: 2, checkIn: 3 };

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function listRefs(remote) {
  const refs = new Map();
  for (const line of git(['ls-remote', remote, REF_GLOB]).split('\n')) {
    const [sha, ref] = line.split('\t');
    if (sha && ref) refs.set(ref, sha);
  }
  return refs;
}

/** The value of the last `Key: value` line of a commit message, or null. */
function readTrailer(message, key) {
  const pattern = new RegExp(`^${key}:[ \\t]*(\\S.*?)[ \\t]*$`, 'gim');
  let value = null;
  for (const match of message.matchAll(pattern)) value = match[1];
  return value;
}

/** What one commit message reports for the watched slices, or null. */
function reportOf(message, slices) {
  const slice = readTrailer(message, 'Cloud-Slice');
  const status = readTrailer(message, 'Cloud-Status');
  if (status === null || slice === null || !slices.includes(slice)) return null;
  return { slice, status };
}

/**
 * Commit messages come through a throwaway bare repository, so that a waiter never
 * touches the FETCH_HEAD or the refs of a tree that other work is using. The filter
 * brings the commit alone: this repository's trees are large and only the message is read.
 */
function makeCommitReader(remote) {
  const url = git(['remote', 'get-url', remote]).trim();
  const dir = mkdtempSync(join(tmpdir(), 'wait-cloud-'));
  const inCache = (args) => git(['--git-dir', dir, ...args]);
  inCache(['init', '--quiet', '--bare']);
  inCache(['remote', 'add', 'origin', url]);
  inCache(['config', 'remote.origin.promisor', 'true']);
  inCache(['config', 'remote.origin.partialclonefilter', 'tree:0']);
  return {
    message(ref) {
      inCache(['fetch', '--quiet', '--no-tags', '--depth=1', '--filter=tree:0', 'origin', `+${ref}:refs/wait-cloud/tip`]);
      return inCache(['log', '-1', '--format=%B', 'refs/wait-cloud/tip']);
    },
    close: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function parseOptions(argv) {
  const options = { slices: [] };
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`unrecognised argument: ${arg}`);
    const [, key, value] = match;
    if (key === 'slice') options.slices.push(value);
    else if (['baseline', 'check-in', 'interval', 'remote', 'heartbeat'].includes(key)) options[key] = value;
    else throw new Error(`unrecognised option: --${key}`);
  }
  return options;
}

function positiveNumber(text, name) {
  const value = Number(text);
  if (!(value > 0)) throw new Error(`--${name} must be a positive number, got ${text}`);
  return value;
}

function readBaseline(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return new Map(Object.entries(parsed.refs));
}

function snapshot(file, remote) {
  const refs = listRefs(remote);
  writeFileSync(file, `${JSON.stringify({ takenAt: new Date().toISOString(), refs: Object.fromEntries(refs) }, null, 1)}\n`);
  console.log(`CLOUD-WAIT snapshot refs=${refs.size} file=${file}`);
  return EXIT.reported;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function wait(options) {
  if (!options.baseline) throw new Error('--baseline=<file> is required: take it with `snapshot` BEFORE launching');
  if (options.slices.length === 0) throw new Error('at least one --slice=<name> is required');
  const baseline = readBaseline(options.baseline);
  const remote = options.remote ?? 'origin';
  const intervalMs = positiveNumber(options.interval ?? DEFAULT_INTERVAL_S, 'interval') * 1000;
  const checkInMs = positiveNumber(options['check-in'] ?? DEFAULT_CHECK_IN_MIN, 'check-in') * 60_000;

  const reader = makeCommitReader(remote);
  const examined = new Set();
  const startedAt = Date.now();
  let failures = 0;
  let moved = 0;
  try {
    for (;;) {
      if (options.heartbeat) writeFileSync(options.heartbeat, `${new Date().toISOString()}\n`);
      const reports = [];
      try {
        for (const [ref, sha] of listRefs(remote)) {
          if (baseline.get(ref) === sha || examined.has(sha)) continue;
          moved += 1;
          const report = reportOf(reader.message(ref), options.slices);
          examined.add(sha);
          if (report) reports.push({ ...report, ref, sha });
        }
      } catch (error) {
        // A network blip must not end the watch. The count in the check-in line says so
        // if it never recovers, so a dead remote cannot pass for a quiet one.
        failures += 1;
        console.error(`wait-cloud: poll failed: ${String(error.message).split('\n')[0]}`);
      }
      if (reports.length > 0) {
        for (const { slice, status, ref, sha } of reports) {
          console.log(`CLOUD-WAIT report slice=${slice} status=${status} ref=${ref.replace('refs/heads/', '')} sha=${sha}`);
        }
        return EXIT.reported;
      }
      if (Date.now() - startedAt >= checkInMs) {
        console.log(`CLOUD-WAIT check-in slices=${options.slices.join(',')} minutes=${Math.round((Date.now() - startedAt) / 60_000)} moved=${moved} failed-polls=${failures}`);
        return EXIT.checkIn;
      }
      await pause(intervalMs);
    }
  } finally {
    reader.close();
  }
}

async function main(argv) {
  const [command, ...rest] = argv;
  try {
    if (command === 'snapshot') {
      if (rest.length < 1) throw new Error('snapshot needs a file: snapshot <baseline-file> [--remote=<name>]');
      const [file, ...flags] = rest;
      return snapshot(file, parseOptions(flags).remote ?? 'origin');
    }
    if (command === 'wait') return await wait(parseOptions(rest));
    throw new Error('usage: wait-cloud.mjs snapshot <file> | wait --baseline=<file> --slice=<name> …');
  } catch (error) {
    console.error(`wait-cloud: ${error.message}`);
    return EXIT.usage;
  }
}

process.exitCode = await main(process.argv.slice(2));
