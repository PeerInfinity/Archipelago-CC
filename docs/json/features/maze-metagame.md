# Maze Metagame

The Maze Metagame integrates [A-Mazing-Idle](https://imgreghenry.github.io/A-Mazing-Idle/) as a meta-progression layer on top of the Archipelago tracker. Before you can move to a new region or check a location, you must complete a maze challenge.

## How It Works

1. You attempt an action in the Archipelago tracker (move to a region, check a location)
2. The MetaGame system intercepts the action and presents a maze in an iframe panel
3. You solve the maze (manually or using the game's built-in bot)
4. On completion, the original action goes through

This creates a second layer of gameplay on top of any Archipelago game, where physical maze-solving skill gates your progression through the randomizer logic.

## A-Mazing-Idle

A-Mazing-Idle is a browser-based incremental game with procedurally generated mazes across 15+ biomes. It features an upgrade system with 40+ upgrade types that carry over between mazes, so challenges get easier as you invest points in automation and movement speed.

## Two Configurations

### Standard Maze Game (`?metagame=mazegame`)

Mazes are required before:
- Moving to an undiscovered region
- Checking any location

### Loops-Compatible Maze Game (`?metagame=mazegameloops`)

Combines with [Loops mode](loops.md), adding maze gates to:
- Region exploration actions
- Location check actions
- Automatic pre-configured upgrades applied on each challenge

## Current Status

This is a proof of concept demonstrating the MetaGame system's ability to layer external games on top of Archipelago tracking. The core integration works — maze completion detection, event interception, iframe communication — but it hasn't been tuned for fun. The MetaGame system itself is designed to support any iframe-based game, not just A-Mazing-Idle.

## Further Reading

- [MetaGame Module Reference](../modules/metaGame.md)
- [A-Mazing-Idle Integration Plan](../../../CC/docs/plans/a-mazing-idle-iframe-integration.md)
