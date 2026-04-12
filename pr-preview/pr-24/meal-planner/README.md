# Meal Planner Nutrition Calculations

This directory contains pure functions for calculating nutritional data in the meal planner application, along with comprehensive tests to ensure correctness.

## Files

- `domain.d.ts` - TypeScript type definitions for the application
- `nutrition-calculations.js` - Pure functions for all nutritional calculations
- `test-nutrition-calculations.js` - Comprehensive test suite for nutrition functions
- `react-component-test.js` - Component hierarchy and prop validation tests
- `script.js` - Main React application code (uses the pure functions)
- `index.html` - Application UI (loads all scripts)
- `styles.css` - Application styling
- `common-ingredients.json` - Common ingredients with nutritional data
- `common-recipes.json` - Common recipes with ingredients and methods
- `preload-data.js` - Script to load common data into the app
- `components/` - Directory containing React component implementations

## Pure Functions

### `calculateRecipeNutrition(recipe, ingredientsData)`
Calculates nutritional content for a recipe based on its ingredients.

**Parameters:**
- `recipe` - Recipe object with ingredients array
- `ingredientsData` - Nutritional data for ingredients

**Returns:** Nutritional data object with vitamins, minerals, and macronutrients

### `calculateDayNutrition(calendar, getRecipeById, ingredientsData)`
Calculates nutritional data for each day of the week.

**Parameters:**
- `calendar` - Weekly calendar with recipe IDs
- `getRecipeById` - Function to get recipe by ID
- `ingredientsData` - Nutritional data for ingredients

**Returns:** Array of day nutrition objects

### `calculateWeeklyTotals(dayNutrition)`
Calculates weekly nutritional totals from day-by-day data.

**Parameters:**
- `dayNutrition` - Array of day nutrition objects

**Returns:** Weekly totals object

### `calculateOmittedNutrients(dayNutrition)`
Identifies nutrients that are not present in the weekly meal plan.

**Parameters:**
- `dayNutrition` - Array of day nutrition objects

**Returns:** Object with omitted vitamins and minerals arrays

### Chart Data Generation Functions
- `generateVitaminsChartData(dayNutrition)` - Creates Chart.js data for vitamins stacked bar chart
- `generateMineralsChartData(dayNutrition)` - Creates Chart.js data for minerals stacked bar chart
- `generateWeeklyVitaminsChartData(dayNutrition)` - Creates Chart.js data for weekly vitamins pie chart
- `generateWeeklyMineralsChartData(dayNutrition)` - Creates Chart.js data for weekly minerals pie chart
- `generateWeeklyMacronutrientsChartData(dayNutrition)` - Creates Chart.js data for weekly macronutrients pie chart

### Color Functions
- `getVitaminColor(vitamin, border)` - Returns RGBA color for vitamins
- `getMineralColor(mineral, border)` - Returns RGBA color for minerals

## Running Tests

```bash
cd meal-planner
node test-nutrition-calculations.js
```

## Test Coverage

The test suite covers:
- ✅ Recipe nutrition calculation from ingredients
- ✅ Weekly calendar processing
- ✅ Nutrient aggregation and totals
- ✅ Omitted nutrient identification
- ✅ Chart data structure generation (vitamins, minerals, macronutrients)
- ✅ Color function correctness
- ✅ Edge cases (empty data, missing ingredients)

## Usage in Application

The pure functions are used in the main application to:
1. Calculate nutrition for individual recipes based on ingredients
2. Generate weekly nutritional summaries
3. Create interactive charts showing nutrient distribution
4. Identify nutritional gaps in meal planning

## Data Structures

### Ingredients Data
```javascript
{
  "chicken breast": {
    vitamins: { vitaminB12: true, /* ... */ },
    minerals: { iron: true, zinc: true, /* ... */ }
  },
  "spinach": {
    vitamins: { vitaminA: true, vitaminC: true, /* ... */ },
    minerals: { calcium: true, iron: true, /* ... */ }
  }
}
```

### Recipe Nutrition
```javascript
{
  calories: 450,
  carbs: 30.5,
  fat: 15.2,
  protein: 35.8,
  fiber: 8.3,
  vitamins: {
    vitaminA: true,
    vitaminC: true,
    vitaminD: false,
    // ...
  },
  minerals: {
    calcium: true,
    iron: true,
    magnesium: false,
    // ...
  }
}
```

## Features

- **Pure Functions**: No side effects, easy to test and reason about
- **Comprehensive Testing**: 100% test coverage of all functions
- **Real Data**: Tests use realistic ingredient and recipe data
- **Edge Case Handling**: Gracefully handles empty data and missing information
- **Chart Integration**: Generates data structures compatible with Chart.js
- **Nutrient Tracking**: Tracks 8 vitamins and 5 minerals
- **OR Logic**: If any ingredient contains a nutrient, the recipe contains it
- **Event Logging**: Automatically logs cooking, shopping, and inventory changes
- **Analytics Dashboard**: View charts and statistics about your meal planning activity

## Example Usage

```javascript
const NutritionCalculations = require('./nutrition-calculations.js');

// Calculate nutrition for a recipe
const recipeNutrition = NutritionCalculations.calculateRecipeNutrition(recipe, ingredientsData);

// Get weekly nutrition breakdown
const dayNutrition = NutritionCalculations.calculateDayNutrition(calendar, getRecipeById, ingredientsData);

// Generate chart data
const chartData = NutritionCalculations.generateVitaminsChartData(dayNutrition);
```

All functions are exported for both Node.js (`module.exports`) and browser (`window.NutritionCalculations`) environments.

## Data Management

The app includes a comprehensive data management system accessible via the hamburger menu (☰) in the top right corner.

### Hamburger Menu & Data Modal

Click the hamburger button (☰) in the header to access the Data Management modal with the following features:

#### Current Status Display
Shows real-time counts of:
- Total recipes loaded
- Ingredients with nutrition data
- Items currently in inventory

#### Quick Actions
- **📥 Load Common Data**: Adds missing sample recipes and ingredients to your existing data (safe merge)
- **🔄 Reset to Sample Data**: Clears all data and loads fresh sample data (destructive)

#### Backup & Restore
- **💾 Export My Data**: Downloads your current data as a JSON backup file
- **📤 Import Data**: Uploads a previously exported backup file

#### Maintenance
- **🧹 Clean Up Data**: Removes empty/invalid recipes and ingredients

### Console Functions (Advanced)

For advanced users, the following functions are available in the browser console:

```javascript
// Load common data (merges with existing data)
PreloadData.preloadCommonData();

// Reset to only common data (clears everything first)
PreloadData.resetToCommonData();

// Check if common data is loaded
PreloadData.isCommonDataLoaded();
```

### Sample Data Included

**Common Ingredients (40+ items):**
- **Proteins**: chicken breast, salmon, beef, turkey, tuna, eggs, tofu
- **Vegetables**: spinach, broccoli, carrots, tomatoes, bell peppers, lettuce
- **Fruits**: oranges, bananas, apples, berries, avocado
- **Dairy**: milk, yogurt, cheese
- **Grains**: brown rice, quinoa, oats, whole wheat bread
- **Other**: olive oil, nuts, seeds, garlic, onion

**Common Recipes (12 recipes):**
- Grilled Chicken Salad
- Salmon with Quinoa
- Vegetable Stir Fry with Tofu
- Beef and Vegetable Stew
- Greek Yogurt Parfait
- Egg and Vegetable Scramble
- Turkey and Avocado Wrap
- Lentil Soup
- Baked Sweet Potato with Beans
- Fruit and Nut Bowl
- Oatmeal with Berries
- Tuna Salad Sandwich

Each recipe includes complete nutritional information and cooking instructions.

## Event Logging & Analytics

The meal planner automatically tracks and logs all user activities for analytics and insights.

### Logged Events

The system logs three types of events:

1. **Cooking Events**: When you cook a recipe, it records:
   - Recipe name
   - List of ingredients consumed with quantities and units

2. **Shopping Events**: When you transfer items from shopping list to inventory, it records:
   - Items purchased with quantities and unit costs
   - Total cost of the purchase

3. **Inventory Changes**: When you manually add/remove inventory items, it records:
   - Item name
   - Old quantity → new quantity
   - Change type (add/remove)

### Event Log Page

Access the event log by clicking the 📊 button in the main app header. The analytics dashboard includes:

- **Action Types Chart**: Pie chart showing distribution of cooking, shopping, and inventory activities
- **Top Ingredients Consumed**: Bar chart of most frequently used ingredients
- **Daily Activity**: Line chart showing activity levels over time
- **Detailed Log**: Chronological list of all logged events with timestamps

### Data Storage

All event logs are stored locally in the browser's localStorage under the key `eventLog`. The log persists between sessions and can be cleared from the analytics page.

### Privacy

All logging happens locally in your browser. No data is transmitted to external servers.
