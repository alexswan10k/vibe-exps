# Fix Summary

Fixed `index.html` over 3 turns:

1. **Inverted movement** — changed `yaw +=` to `yaw -=`
2. **Spawn in ground** — rewrote `collideAABB` + `safeSpawnPos`/`findSpawnY`
3. **Infinite terrain** — `generatedBlock`/`getHeight`/`isTreeBlock` with sparse `world` overrides and `chunkMap` streaming (`RENDER_DIST=5`)
4. **Page wouldn't load** — limited initial build to radius 2 and incremental `updateChunks` (2 per frame)
5. **Inside-out textures** — flipped winding to `idx.push(0,2,1 / 0,3,2)`
