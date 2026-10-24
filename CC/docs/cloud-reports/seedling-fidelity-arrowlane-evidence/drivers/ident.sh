cd /home/user/Archipelago-CC && source .venv/bin/activate
SEEDLING_PORT=9684 bash scripts/procgen/identity-block.sh . > /tmp/claude-0/w/w0/identity-head-off.txt 2>&1
SEEDLING_ARROW_LANE_CROSSING=1 SEEDLING_PORT=9684 bash scripts/procgen/identity-block.sh . > /tmp/claude-0/w/w0/identity-head-on.txt 2>&1
cd /home/user/base-wt && SEEDLING_PORT=9685 bash scripts/procgen/identity-block.sh . > /tmp/claude-0/w/w0/identity-base.txt 2>&1
touch /tmp/claude-0/w/ident.done
