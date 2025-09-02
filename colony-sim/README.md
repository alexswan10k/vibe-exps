# Colony Simulator

A real-time colony simulation game built with HTML5 Canvas and JavaScript. Manage a group of pawns as they gather resources, build structures, and develop their colony.

## Features

### Core Gameplay
- **Pawn Management**: Control multiple pawns with individual hunger, sleep, and inventory stats
- **Resource Gathering**: Chop trees for wood, mine iron deposits, and harvest plants
- **Building Construction**: Build walls, crafting tables, and storage areas
- **Crafting System**: Create food and tools from gathered resources
- **Task Queue System**: Assign and manage tasks for efficient colony management

### Terrain & Resources
- **Dynamic Map**: Procedurally generated terrain with grass, dirt, and stone tiles
- **Natural Resources**: Trees, iron deposits, and growing plants
- **Visual Feedback**: Hover over tiles to see terrain type and dropped resources
- **Sprite-based Rendering**: Custom terrain sprites for enhanced visuals

### User Interface
- **Real-time UI**: Live updates of pawn status, task queues, and resource inventories
- **Interactive Controls**: Click and drag to select areas for tasks
- **Camera Controls**: WASD movement and mouse wheel zoom
- **Detailed Information**: Hover over tiles to see contents and terrain type

## How to Play

### Getting Started
1. Open `index.html` in your web browser
2. The game starts with 3 pawns and a procedurally generated map

### Basic Controls
- **Movement**: WASD keys to move camera
- **Zoom**: Mouse wheel to zoom in/out
- **Task Selection**: Click buttons to select different tasks
- **Area Selection**: Click and drag to select areas for tasks

### Available Tasks
- **Chop Trees**: Select areas with trees to harvest wood
- **Mine Iron**: Select areas with iron deposits to gather iron
- **Mine Stone**: Select stone terrain to mine stone
- **Harvest Plants**: Select areas with mature plants (green) to harvest
- **Build Wall**: Select areas to build defensive walls
- **Build Crafting Table**: Place crafting tables for item production
- **Build Storage**: Designate storage areas for resource management

### Crafting
- **Food**: Craft from wood (1:1 ratio)
- **Tools**: Craft from iron and wood (2:1 ratio)

### Pawn Management
- Pawns have hunger and sleep needs that decrease over time
- Each pawn has weight limits for carrying resources
- Click on pawn names in the UI to focus camera on them

## Game Mechanics

### Resource System
- Resources are dropped on tiles when harvested
- Pawns automatically pick up nearby dropped resources
- Storage areas help organize resource management

### Task Priority
- Tasks are queued and assigned to the nearest available pawn
- Queued tasks show visual indicators on the map
- Pawns work through tasks automatically

### Terrain Interaction
- Different terrain types affect gameplay
- Plants grow on grass tiles over time
- Stone terrain can be mined for stone resources

## Technical Details

### Architecture
- **Modular Design**: Separate files for game logic, entities, utilities, and UI
- **Object-Oriented**: Classes for Game, Pawn, Resource, Building, and Plant entities
- **Canvas Rendering**: Efficient tile-based rendering with zoom and camera support

### Files Structure
- `index.html` - Main HTML file with UI layout
- `game.js` - Core game logic and rendering
- `pawn.js` - Pawn entity and AI behavior
- `entities.js` - Resource, Building, and Plant classes
- `types.js` - Type definitions and constants
- `utils.js` - Utility functions and helper methods
- `main.js` - Game initialization
- `styles.css` - UI styling and layout
- `terrain.png` - Sprite sheet for terrain tiles

### Performance
- Efficient rendering with viewport culling
- Optimized game loop with requestAnimationFrame
- Modular code structure for maintainability

## Browser Compatibility

Works in all modern browsers that support:
- HTML5 Canvas
- ES6 JavaScript features
- CSS Grid and Flexbox

## Development

The game was built iteratively using AI-assisted development tools, demonstrating the potential for rapid prototyping and iterative game development.

## Future Enhancements

Potential areas for expansion:
- More building types
- Advanced pawn AI behaviors
- Multiplayer support
- Save/load game states
- Additional resources and crafting recipes
- Weather and seasonal systems

## License

This project is part of the Vibe Experiments collection. Feel free to explore, modify, and learn from the codebase!
