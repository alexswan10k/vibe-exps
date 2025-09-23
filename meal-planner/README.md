# Meal Planner Nutrition Calculations

This directory contains pure functions for calculating nutritional data in the meal planner application, along with comprehensive tests to ensure correctness.

## Files

- `nutrition-calculations.js` - Pure functions for all nutritional calculations
- `test-nutrition-calculations.js` - Comprehensive test suite
- `script.js` - Main application code (uses the pure functions)
- `index.html` - Application UI (loads nutrition-calculations.js and script.js)
- `styles.css` - Application styling

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
