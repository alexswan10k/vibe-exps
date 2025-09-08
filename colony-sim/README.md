# Colony Simulation Game

A modular colony management simulation game built with vanilla JavaScript, featuring resource gathering, crafting, and pawn AI.

## 🏗️ Architecture

This project uses a clean modular architecture with separation of concerns:

### Core Files
- **`types.js`** - JSDoc type definitions for better IDE support and documentation
- **`utils.js`** - Utility functions for inventory management and common operations
- **`entities.js`** - Game entity classes (Resource, Building, DroppedResource, Plant)

### Manager Classes
- **`input-manager.js`** - Handles all user input (mouse, keyboard, wheel events)
- **`renderer.js`** - Manages all game rendering (map, resources, pawns, buildings)
- **`ui-manager.js`** - Handles UI updates and DOM manipulation
- **`task-manager.js`** - Manages task creation, assignment, and resource operations

### Game Logic
- **`pawn.js`** - Pawn class with AI behavior and inventory management
- **`game.js`** - Main Game class that orchestrates all managers
- **`main.js`** - Entry point that initializes the game

## 🎮 Gameplay Features

- **Resource Management**: Gather wood, iron, stone, and food
- **Pawn AI**: Intelligent colonists that automatically perform tasks
- **Building System**: Construct walls, crafting tables, and storage areas
- **Crafting System**: Create food and tools from gathered resources
- **Task Queue**: Assign and manage work for your pawns
- **Real-time Updates**: Live UI showing pawn status, resources, and tasks

## 🚀 Getting Started

1. **Prerequisites**: Modern web browser with JavaScript enabled
2. **Setup**: Open `index.html` in your browser
3. **Controls**:
   - **Mouse**: Click and drag to select areas for tasks
   - **Keyboard**: WASD or arrow keys to move camera
   - **Mouse Wheel**: Zoom in/out
   - **ESC or Right-click**: Cancel current action

## 📁 File Structure

```
colony-sim/
├── index.html          # Main HTML file
├── styles.css          # Game styling
├── terrain.png         # Sprite sheet for terrain
├── types.js           # JSDoc type definitions
├── utils.js           # Utility functions
├── entities.js        # Game entity classes
├── pawn.js            # Pawn AI and behavior
├── input-manager.js   # Input handling system
├── renderer.js        # Rendering system
├── ui-manager.js      # UI management system
├── task-manager.js    # Task and resource management
├── game.js            # Main game orchestration
├── main.js            # Application entry point
└── README.md          # This file
```

## 🔧 Technical Details

### Modular Design Benefits
- **Maintainability**: Each module has a single responsibility
- **Testability**: Individual components can be tested in isolation
- **Extensibility**: New features can be added without affecting existing code
- **Readability**: Clear separation makes code easier to understand

### JSDoc Type System
All classes and methods include comprehensive JSDoc comments with type annotations for:
- Better IDE autocomplete and error detection
- Automatic documentation generation
- Improved code maintainability

### Game Loop
The game runs on a continuous loop that:
1. Updates game state (pawn AI, plant growth, task completion)
2. Renders the game world
3. Updates the user interface

## 🎯 Game Mechanics

### Pawns
- Have hunger, sleep, and carrying capacity needs
- Automatically find and complete tasks from the queue
- Can carry limited weight of resources
- Will eat food and rest when needs are critical

### Resources
- **Trees**: Provide wood when chopped
- **Iron Deposits**: Provide iron when mined
- **Stone Terrain**: Can be mined for stone
- **Plants**: Grow over time and provide food when harvested

### Tasks
- **Chop Trees**: Select tree areas to harvest wood
- **Mine Iron**: Select iron deposits to gather iron
- **Mine Stone**: Select stone tiles to mine stone
- **Harvest Plants**: Select mature plants to gather food
- **Build Structures**: Construct walls, tables, and storage areas

### Crafting
- **Food**: Requires 1 wood
- **Tools**: Requires 2 iron + 1 wood

## 🛠️ Development

### Adding New Features
1. Identify which manager should handle the new functionality
2. Add the feature to the appropriate manager class
3. Update the Game class if needed to integrate the new feature
4. Add JSDoc type definitions for any new types

### Code Style
- Use JSDoc comments for all classes and public methods
- Follow consistent naming conventions
- Keep functions focused on single responsibilities
- Use descriptive variable and function names

## 📝 API Reference

### Game Class
Main orchestration class that manages the entire game.

```javascript
const game = new Game(config);
```

### Manager Classes
Each manager handles a specific aspect of the game:

```javascript
// Input handling
game.inputManager.handleMouseDown(event);

// Rendering
game.renderer.render();

// UI updates
game.uiManager.updateUI();

// Task management
game.taskManager.craftItem('food');
```

## 🤝 Contributing

When contributing to this project:
1. Follow the existing modular structure
2. Add JSDoc comments to new code
3. Test changes thoroughly
4. Update this README if adding new features

## 📄 License

This project is open source and available under the MIT License.
