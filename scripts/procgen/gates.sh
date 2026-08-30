#!/bin/bash
# gates.sh — the one-liner. The body is `gates.mjs`, which is where the
# derivation and the exit-code rule live; this shim exists so the command
# reads like `identity-block.sh` beside it.
exec node "$(dirname "$0")/gates.mjs" "$@"
