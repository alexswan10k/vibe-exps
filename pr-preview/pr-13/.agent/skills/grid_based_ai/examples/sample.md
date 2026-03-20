# City Delivery Truck AI

## Component: DeliveryTruck Class

### 1. Road & Intersection Handling
- **Semantic Type Usage**: The `DeliveryTruck` reads `tile.type` from the `WorldData` grid. It restricts its movement to lanes based on whether the type is `horizontal` or `vertical`.
- **Intersection Logic**: Upon entering a `crossroad` tile, the truck calculates its `desiredExitAngle`. It snaps its `angle` property to the nearest `Math.PI / 2` multiple and filters out the reverse direction (`currentAngle + Math.PI`) from its random choice list.

### 2. Collision & Evasion
- **Evasion Strategy**: On collision with a building, `targetDirection` is set to `collisionNormal + Math.PI / 2`. The truck's `velocity` is multiplied by `-0.5` for 10 frames to provide space for rotation.
- **Unstick Mechanism**: Uses a `posHistory` array of 60 samples. If `distance(posHistory[0], currentPos) < 10` pixels, a 90-degree steering jolt is applied.

### 3. Implementation Checklist
- [x] Use semantic road `type` from map data for navigation.
- [x] Implement intersection direction constraints.
- [x] Implement `unstick` routine with positional history.
