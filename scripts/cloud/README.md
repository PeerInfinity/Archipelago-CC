# Cloud session scripts

- `env_setup.sh`: the cloud environment's setup script.
- `session_bootstrap.sh`: run by a cloud session from the repo root.
- `wait-cloud.mjs`: wakes a local session when a cloud session it launched says it is finished.

## Hearing when a cloud session finishes

A cloud session's `idle` state and the `result` events in its log mark the end of a turn, and its pushes (even of its report) land mid-work. None of them means finished, so the session says so itself in its last commit.

**In the brief.** The last commit it pushes ends with:

```
Cloud-Slice: <slice>
Cloud-Status: final
```

`Cloud-Status: blocked` means it needs an answer. Use the slice name the launcher will wait for. It is matched exactly and the branch name is irrelevant, because the harness names `claude/*` branches from the session title.

**In the launcher.**

1. BEFORE launching, take the baseline. A baseline taken after the launch can miss a fast session:
   `node scripts/cloud/wait-cloud.mjs snapshot <scratch>/cloud-baseline.json`
2. Launch the session.
3. Start ONE waiter with Bash `run_in_background`, covering every slice this launcher has running. Its exit is what wakes an idle launcher:
   `node scripts/cloud/wait-cloud.mjs wait --baseline=<scratch>/cloud-baseline.json --slice=<a> --slice=<b> --heartbeat=<scratch>/cloud-heartbeat`
4. Add the hourly backstop, in case the waiter is reaped. `CronCreate` with cron `23 * * * *` and a prompt like the one below. It fires only while the session is idle, expires after 7 days and dies with the session.

   > Cloud-wait backstop: if slices are still out and `<scratch>/cloud-heartbeat` is more than 5 minutes old, re-arm `wait-cloud.mjs wait` with the same baseline and the remaining slices. Otherwise do nothing.

5. Stop the backstop with `CronDelete` once no slices are out.

**When the waiter exits.** Every stdout line starts `CLOUD-WAIT`.

| Exit | Line | Meaning | Next |
|---|---|---|---|
| 0 | `report slice=… status=… ref=… sha=…` | a watched slice reported | Harvest it, then re-arm for any slices still out. A `blocked` session is waiting for an answer |
| 3 | `check-in slices=… minutes=… moved=… failed-polls=…` | `--check-in` minutes (default 90) passed with no report | One `RemoteTrigger get_run_log` to tell working from crashed from asking in chat, then re-arm. `failed-polls` above 0 means the remote was unreachable for some polls |
| 2 | message on stderr | usage error or an unreadable baseline | Fix the call |

`moved` counts every `claude/*` branch that moved, including other sessions', so it is not a sign of life for your slice.
