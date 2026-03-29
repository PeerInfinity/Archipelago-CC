#!/usr/bin/env python3
"""Vibe Coding Simulator — Text-based game interface.

A simple terminal UI for testing the simulation engine.

Usage:
    python game.py [--graph PATH] [--instances N] [--seed N]
"""

import argparse
from pathlib import Path

from engine import GameState, TaskType, load_game


def print_status(state: GameState):
    """Print current game status."""
    day = int(state.simulated_time // (24 * 60)) + 1
    credit_hours = state.credits_remaining / 60.0  # hours of single-instance time left
    print(f"\n{'=' * 60}")
    print(f"  Day {day} {state._time_str()}  |  Credits: {credit_hours:.1f}h remaining  |  Progress: {state.get_overall_progress():.0%}")
    print(f"{'=' * 60}")

    # Features
    print("\n  Features:")
    for feat in state.features.values():
        bar = progress_bar(feat.completion, 20)
        print(f"    {feat.name:<20s} {bar} {feat.completion:.0%}")
        for phase in feat.phases:
            unlocked = state.is_phase_unlocked(phase.node_id)
            status = "DONE" if phase.is_complete else ("ready" if unlocked else "locked")
            marker = "x" if phase.is_complete else ("o" if unlocked else ".")
            short_name = phase.name.split(":", 1)[-1].strip() if ":" in phase.name else phase.name
            if len(short_name) > 35:
                short_name = short_name[:32] + "..."
            print(f"      [{marker}] {short_name:<35s} {phase.completion:.0%}  ({status})")

    # Claude instances
    print("\n  Claude Instances:")
    for inst in state.claude_instances:
        if inst.is_idle:
            print(f"    #{inst.id}: idle")
        else:
            bar = progress_bar(inst.overall_progress, 15)
            print(f"    #{inst.id}: {inst.task.label:<30s} {bar} [{inst.status_label()}]")

    # Test workflow
    if state.test_workflow:
        if state.test_workflow.is_complete:
            summary = state.get_test_summary()
            if summary:
                print(f"\n  Last test run: {summary['passing']}/{summary['total']} passing")
        else:
            elapsed = state.simulated_time - state.test_workflow.started_at
            pct = min(elapsed / state.test_workflow.duration, 1.0)
            bar = progress_bar(pct, 15)
            print(f"\n  Test workflow: {bar} running...")

    # Recent log
    if state.log:
        print(f"\n  Recent events:")
        for entry in state.log[-5:]:
            print(f"    {entry}")


def progress_bar(pct: float, width: int = 20) -> str:
    filled = int(pct * width)
    return f"[{'#' * filled}{'.' * (width - filled)}]"


def print_available_actions(state: GameState):
    """Print available actions."""
    available = state.get_available_phases()
    idle_instances = [i for i in state.claude_instances if i.is_idle]

    print("\n  Actions:")
    if state.pending_merge_conflicts and idle_instances:
        print(f"    resolve <instance#> <node_id> — assign Claude to resolve merge conflict")
        print(f"    Pending conflicts: {', '.join(state.pending_merge_conflicts)}")

    if idle_instances and available:
        print(f"    assign <instance#> <node_id>  — assign Claude to implement a phase")
        print(f"    Available phases: {', '.join(p.node_id for p in available)}")
        print(f"    Idle instances: {', '.join(f'#{i.id}' for i in idle_instances)}")
    elif not idle_instances:
        print(f"    (all Claude instances busy)")
    elif not available:
        print(f"    (no unlocked phases available)")

    busy = [i for i in state.claude_instances if not i.is_idle]
    if busy:
        print(f"    cancel <instance#>            — cancel a running task")
        print(f"    end-testing <instance#>        — skip regression testing, commit now")

    if state.test_workflow is None or state.test_workflow.is_complete:
        print(f"    test                          — start CI test workflow")
    else:
        print(f"    cancel-test                   — cancel CI test workflow")

    print(f"    wait                          — advance time (5 simulated minutes)")
    print(f"    wait <N>                      — advance time (N simulated minutes)")
    print(f"    wait-until <HH:MM>            — advance time until a specific time")
    print(f"    quit                          — exit")


def handle_input(state: GameState, line: str) -> bool:
    """Process a command. Returns False to quit."""
    parts = line.strip().split()
    if not parts:
        return True

    cmd = parts[0].lower()

    if cmd == "quit" or cmd == "q":
        return False

    elif cmd == "assign" and len(parts) >= 3:
        try:
            inst_id = int(parts[1].lstrip("#"))
            node_id = parts[2]
        except ValueError:
            print("  Usage: assign <instance#> <node_id>")
            return True

        instance = next((i for i in state.claude_instances if i.id == inst_id), None)
        if not instance:
            print(f"  No instance #{inst_id}")
        elif not instance.is_idle:
            print(f"  Instance #{inst_id} is busy")
        elif state.assign_task(instance, TaskType.IMPLEMENT, node_id):
            pass  # logged by engine
        else:
            print(f"  Can't assign {node_id} (locked or doesn't exist)")

    elif cmd == "cancel" and len(parts) >= 2:
        try:
            inst_id = int(parts[1].lstrip("#"))
        except ValueError:
            print("  Usage: cancel <instance#>")
            return True
        instance = next((i for i in state.claude_instances if i.id == inst_id), None)
        if instance:
            state.cancel_task(instance)
        else:
            print(f"  No instance #{inst_id}")

    elif cmd == "end-testing" and len(parts) >= 2:
        try:
            inst_id = int(parts[1].lstrip("#"))
        except ValueError:
            print("  Usage: end-testing <instance#>")
            return True
        instance = next((i for i in state.claude_instances if i.id == inst_id), None)
        if instance and not instance.is_idle:
            # Skip remaining subtasks, force completion
            instance.subtask_index = len(instance.subtask_durations)
            state.log.append(f"[{state._time_str()}] Claude #{instance.id}: skipped regression testing")
        else:
            print(f"  Instance #{inst_id} is not busy")

    elif cmd == "test":
        if not state.start_test_workflow():
            print("  Test workflow already running")

    elif cmd == "cancel-test":
        if not state.cancel_test_workflow():
            print("  No test workflow running")

    elif cmd == "resolve" and len(parts) >= 3:
        try:
            inst_id = int(parts[1].lstrip("#"))
            node_id = parts[2]
        except ValueError:
            print("  Usage: resolve <instance#> <node_id>")
            return True

        instance = next((i for i in state.claude_instances if i.id == inst_id), None)
        if not instance:
            print(f"  No instance #{inst_id}")
        elif not instance.is_idle:
            print(f"  Instance #{inst_id} is busy")
        elif node_id not in state.pending_merge_conflicts:
            print(f"  No pending merge conflict for {node_id}")
        elif state.assign_task(instance, TaskType.MERGE_CONFLICT, node_id):
            pass  # logged by engine
        else:
            print(f"  Can't resolve {node_id}")

    elif cmd == "wait":
        minutes = 5.0
        if len(parts) >= 2:
            try:
                minutes = float(parts[1])
            except ValueError:
                pass
        _advance_time(state, minutes)

    elif cmd == "wait-until" and len(parts) >= 2:
        try:
            h, m = parts[1].split(":")
            target_minutes = int(h) * 60 + int(m)
            wait_minutes = target_minutes - state.simulated_time
            if wait_minutes <= 0:
                # Next day
                wait_minutes += 24 * 60
            _advance_time(state, wait_minutes)
        except ValueError:
            print("  Usage: wait-until <HH:MM>")

    elif cmd == "auto":
        # Auto-assign idle instances to available phases (resolve conflicts first)
        available = state.get_available_phases()
        for inst in state.claude_instances:
            if not inst.is_idle:
                continue
            # Resolve merge conflicts first
            if state.pending_merge_conflicts:
                node_id = state.pending_merge_conflicts[0]
                state.assign_task(inst, TaskType.MERGE_CONFLICT, node_id)
            elif available:
                phase = available.pop(0)
                state.assign_task(inst, TaskType.IMPLEMENT, phase.node_id)

    elif cmd == "help" or cmd == "?":
        print_available_actions(state)

    else:
        print(f"  Unknown command: {cmd}  (type 'help' for commands)")

    return True


def _advance_time(state: GameState, minutes: float):
    """Advance simulated time by the given number of minutes."""
    steps = max(1, int(minutes * 2))
    dt_per_step = minutes / steps / (state.config.time_scale / 60.0)
    for _ in range(steps):
        state.tick(dt_per_step)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--graph",
        type=Path,
        default=Path(__file__).parent / "depgraph_example.json",
        help="DepGraph JSON file to load",
    )
    parser.add_argument("--instances", type=int, default=2, help="Number of Claude instances")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    args = parser.parse_args()

    state = load_game(args.graph, num_instances=args.instances, seed=args.seed)

    print("\n  VIBE CODING SIMULATOR")
    print(f"  Project: {args.graph.stem}")
    print(f"  Claude instances: {args.instances}")
    print(f"  Type 'help' for commands\n")

    running = True
    while running and not state.is_complete():
        print_status(state)
        print_available_actions(state)

        try:
            line = input("\n> ")
        except (EOFError, KeyboardInterrupt):
            break

        running = handle_input(state, line)

    if state.is_complete():
        print_status(state)
        print("\n  PROJECT COMPLETE!")
        print(f"  Total time: {state._time_str()}")
        print(f"  Total credits used: {sum(i.credits_used for i in state.claude_instances):.0f}")


if __name__ == "__main__":
    main()
