---
name: Top-Down Grid-Based AI and Pathing
description: Lessons on building top-down grid city vehicle AI, road pathing, and collision evasion.
---

# Top-Down Grid-Based Vehicle AI

When building classic top-down games (like early GTA or similar roaming AI), there are a few important patterns to follow to ensure the AI doesn't break or look foolish when navigating city streets.

## 1. Semantic Road Types vs. Dimension Checks
**The Problem**: A common trap when parsing roads from a procedurally generated or static grid is to infer the road's alignment by checking its dimensions (e.g., `if (road.width > road.height) { // assume horizontal road }`). This works fine for large stretched rectangles, but breaks entirely if the map represents roads as uniform square tiles (e.g., repeating 96x96 squares), as the width and height are identical.

**The Solution**: When parsing the world layout to build collision blocks and navigational meshes, explicitly assign a `type` property (`type: 'horizontal'`, `type: 'vertical'`, `type: 'crossroad'`) based on the map characters (`H`, `V`, `C`). The AI's lane-adherence and intersection detection must rely on this semantic `type`, never implicit geometry.

## 2. Navigating Intersections
Intersections should be discrete overlapping tiles or explicit node components.
- When an AI car detects it is touching a `crossroad` tile, it should intelligently snap its chosen exit direction to an exact 90-degree angle (e.g., `0`, `PI/2`, `PI`, `-PI/2`). 
- **Avoiding U-Turns**: When selecting a random valid direction to exit the intersection, the AI needs to check its current angle constraint and deliberately omit the exact 180-degree reflection so it doesn't spin around instantly.

## 3. Collision Evasion and Unsticking
Top-down AI vehicles are extremely prone to wedging themselves into corners or flat building faces.
- **Target Direction Override**: When calculating an escape angle upon hitting a bounding wall, do not just rely on external velocity bounces and assume the car's steering loop will correct it. You must explicitly overwrite the AI's internal `targetDirection` tracking variable so the car purposefully attempts to keep steering away long term.
- **Backward Ejection**: Apply a strong negative velocity pulse to "bounce" the car backward immediately on impact. This reverse distance grants the steering lerp functions the necessary space and time to rotate the car into the new clear path.
- **Unstick Timers**: Always maintain a trailing history queue of the AI's coordinates (e.g., positional samples recorded every `X` frames). If the net Euclidean distance traveled over the last interval falls below a threshold, the car is jammed in a micro-collision loop. Trigger a forced `unstick` routine that randomly blasts the steering 90 degrees and forces heavy forward acceleration to eject them from the geometry trap.
