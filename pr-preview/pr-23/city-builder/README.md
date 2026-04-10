# City Builder Game

## Overview
A simple 2D city management game where players place buildings, manage resources, and watch their city grow. This game will be built using HTML5 Canvas and JavaScript, following the modular approach seen in other projects like the Colony Simulator.

## Game Features

### Core Mechanics
- **Building Placement System**
  - Grid-based city layout
  - Multiple building types (residential, commercial, industrial, utilities)
  - Building cost and maintenance requirements
  - Visual feedback for valid/invalid placement

- **Resource Management**
  - Money (city budget)
  - Power supply and consumption
  - Water supply and consumption
  - Population happiness

- **Population Growth**
  - Population increases with residential buildings
  - Population affected by job availability and services
  - Visual population indicators

- **Zoning System**
  - Residential zones for housing
  - Commercial zones for businesses
  - Industrial zones for manufacturing
  - Utility zones for power plants and water facilities

### Building Types
1. **Residential Buildings**
   - Houses, apartments, skyscrapers
   - Provide housing for population
   - Require power and water
   - Generate tax revenue

2. **Commercial Buildings**
   - Shops, offices, malls
   - Provide jobs
   - Require power and water
   - Generate tax revenue

3. **Industrial Buildings**
   - Factories, warehouses
   - Provide jobs
   - Require power and water
   - May decrease happiness
   - Generate tax revenue

4. **Utility Buildings**
   - Power plants
   - Water treatment plants
   - Provide essential services to other buildings

### User Interface
- **Main Game Canvas**
  - Top-down view of the city
  - Grid overlay for building placement
  - Building sprites/representations

- **Control Panel**
  - Building selection toolbar
  - Resource meters (money, power, water, population, happiness)
  - Game speed controls
  - Save/Load functionality

- **Information Panel**
  - Selected building information
  - City statistics
  - Notifications and alerts

## Technical Architecture

### File Structure
```
city-builder/
├── index.html          # Main game page
├── styles.css          # Game styling
├── script.js           # Main game logic
├── game.js             # Game state and core mechanics
├── renderer.js         # Canvas rendering
├── input-manager.js    # User input handling
├── building-types.js   # Building definitions
├── grid-system.js      # City grid logic
└── ui-manager.js       # UI components and controls
```

### Core Classes
1. **Game Class**
   - Manages overall game state
   - Handles game loop
   - Coordinates other systems

2. **CityGrid Class**
   - Manages the city grid
   - Handles building placement
   - Checks for valid placement

3. **Building Class**
   - Base class for all buildings
   - Defines properties and behaviors
   - Handles building-specific logic

4. **ResourceManager Class**
   - Manages all game resources
   - Handles resource production/consumption
   - Updates resource meters

5. **Renderer Class**
   - Handles canvas rendering
   - Draws city grid and buildings
   - Manages visual effects

6. **UIManager Class**
   - Manages UI components
   - Handles user interactions
   - Updates information displays

## Implementation Roadmap

### Phase 1: Basic Framework
- [ ] Set up HTML structure with canvas
- [ ] Create basic CSS styling
- [ ] Implement game loop
- [ ] Create grid system
- [ ] Add basic building placement

### Phase 2: Core Mechanics
- [ ] Implement resource system (money, power, water)
- [ ] Add building types with different properties
- [ ] Create resource consumption/production logic
- [ ] Implement basic population system

### Phase 3: Game Features
- [ ] Add zoning system
- [ ] Implement population growth mechanics
- [ ] Create building cost and maintenance
- [ ] Add happiness system

### Phase 4: Polish and Enhancements
- [ ] Improve visual presentation
- [ ] Add sound effects (optional)
- [ ] Implement save/load functionality
- [ ] Add game speed controls
- [ ] Create notifications system

## Success Metrics
- Functional city building game with all core features
- Smooth performance with reasonable city sizes
- Intuitive user interface
- Engaging gameplay loop

## Dependencies
- HTML5 Canvas API
- JavaScript ES6+
- React (from CDN) for UI components - BUT DO NOT USE JSX, call components directly
- No other external libraries (to keep it lightweight)

## Technical Recommendations

### UI Framework
For the GUI components (control panels, information displays, building selection), use React loaded from CDN. However, follow the pattern used in other projects like the Meal Planner:
- **Do NOT use JSX** - Instead, call React components directly using `React.createElement()`
- This approach keeps the code compatible with standard JavaScript while leveraging React's component model
- Use React for state management of UI elements like resource meters, building selection, and notifications

### Game Engine
For the main game loop and city rendering:
- **Primary recommendation**: Use HTML5 Canvas API directly
  - Most performant for grid-based city rendering
  - Full control over drawing operations
  - No additional dependencies needed
  - Well-suited for this type of 2D game

- **Alternative consideration**: Consider a lightweight 2D game library like Phaser.js if the project becomes more complex
  - Better suited for sprite-based animations and particle effects
  - More built-in functionality for game mechanics
  - Would require adding an external dependency

### Architecture Pattern
Follow the modular approach seen in the Colony Simulator:
- Separate concerns into different modules (game logic, rendering, input, UI)
- Use a central game state manager
- Implement an event system for communication between components
- Keep the UI layer separate from the game logic layer

### Performance Considerations
- For larger cities, implement object pooling for buildings
- Use spatial partitioning for collision detection and rendering optimization
- Consider implementing a dirty rectangle system for canvas updates
- Optimize resource calculations by only updating changed values

## Design Considerations
- Keep the code modular and maintainable
- Follow the existing code style from other projects
- Optimize for performance with larger cities
- Make the interface responsive and user-friendly
- Ensure React components are properly unmounted to prevent memory leaks
- Use React's state management for UI elements, but keep game state separate

We want to try using pixijs through react https://react.pixijs.io/
