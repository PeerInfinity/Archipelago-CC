# Bounce Demo Panel

The Bounce Demo plays a generated world's **bounce** regions: a climb in the style of Doodle Jump. The player bounces automatically whenever it lands on a platform; you steer left and right to land on the platforms that lead up to the pickups and the exits. What you can reach depends on what you hold — an arrow to steer each way, springs and jetpacks to launch higher, and the blue and brown platforms that only exist once you have their item.

## When it shows a level

The panel shows the bounce region you are in. In any other kind of region it says *Currently playing …* and offers a button to open that kind's panel; with no generated world loaded it says *No procgen substrate is active for the current region.* Entering a bounce region brings the panel to the front.

To try it: in the [Procgen Pipeline](procgenPipeline.md), choose the preset **Bounce demo (sphere growth)** (or **Maze + bounce**), press **Run all**, then **Load into frontend**.

## Playing

- **← / →** or **A / D** steer. There is no jump key: landing on a platform from above bounces you up. You pass up through platforms from below, and going off one side brings you back on the other.
- Steering left needs the **Left arrow** item and steering right the **Right arrow** item. A bounce world always gives you one of them at the start.
- On a touch screen, press the left or right half of the game.

The line above the game names the region and level.

### What the screen shows

| Mark | Meaning |
|---|---|
| Green rounded square with eyes | You. |
| Green platform | Always there. |
| Blue / brown platform | Needs the **Blue platforms** / **Brown platforms** item. Without it, it is a faint ghost you fall through. |
| Yellow spring / orange jetpack | Launches you much higher — once you hold **Springs** / **Jetpacks**. |
| Square with **?** | A pickup: land on its platform to check its location. **🔒** = locked until you have what it needs; an empty outline = already checked. |
| Purple circle with **↑ ↓ ← →** | An exit to the region on that side: land on its platform to go there. **🔒** = locked. |
| Cyan **⟲** | Sends you back to the entrance. |
| **← → S J B Br** (top left) | Your abilities — arrows, Springs, Jetpacks, Blue and Brown platforms — bright when you hold them. |

Short messages at the top say what just happened: *checked: …*, *locked — something is still missing*, *fell! back to the entrance*.

**Falling** off the bottom sends you back to the region's entrance — or, if the world was built that way, back to the region you came from. Items take effect the moment you receive them, even in mid-air.

## The bot and Loop mode

The [Playback Bot](playbackBot.md) plays bounce regions here, steering with the same left and right you use (your own keys still work while it plays). In a Loop-mode world, a bounce region's block in the [Loops](loops.md) panel can be played by hand, recorded and played back, or left to the bot.

## Changing a level

A bounce level can be edited in the **Bounce Region Editor**: open it with **Edit ▸** on a bounce region in the Procgen Pipeline's *3 Build regions* step or in the [APWorld Editor](apworldEditor.md). The tutorial [Procgen: editing a bounce region](../tutorials/procgen-bounce-region-editor.md) walks through it. How the levels are generated — width, platform chances, the physics, what a fall does — is set in the Procgen Pipeline's *bounce parameters*.

## Learn more

- Tutorials: [editing a bounce region](../tutorials/procgen-bounce-region-editor.md) and [a mixed world](../tutorials/procgen-mixed-world.md).
- [The procgen substrates](../../features/procgen-substrates.md).
- For developers: [the bounce substrate](../../developer/procgen/bounce.md).
