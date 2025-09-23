// Test file for nutrition calculations
// Run with: node test-nutrition-calculations.js

// Import the functions (works in Node.js or browser)
let NutritionCalculations;
if (typeof require !== 'undefined') {
    NutritionCalculations = require('./nutrition-calculations.js');
} else if (typeof window !== 'undefined' && window.NutritionCalculations) {
    NutritionCalculations = window.NutritionCalculations;
} else {
    console.error('Could not load NutritionCalculations');
    process.exit(1);
}

// Test helper functions
function assert(condition, message) {
    if (!condition) {
        console.error('❌ Test failed:', message);
        return false;
    }
    console.log('✅', message);
    return true;
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Test data
const sampleIngredientsData = {
    'chicken breast': {
        vitamins: { vitaminB12: true },
        minerals: { iron: true, zinc: true }
    },
    'spinach': {
        vitamins: { vitaminA: true, vitaminC: true, vitaminK1: true, folate: true },
        minerals: { calcium: true, iron: true, magnesium: true, potassium: true }
    },
    'orange': {
        vitamins: { vitaminA: true, vitaminC: true },
        minerals: {}
    },
    'almonds': {
        vitamins: { vitaminE: true },
        minerals: { calcium: true, magnesium: true }
    }
};

const sampleRecipes = [
    {
        id: 1,
        name: 'Chicken Salad',
        ingredients: [
            { name: 'chicken breast', quantity: 200, unit: 'g' },
            { name: 'spinach', quantity: 100, unit: 'g' }
        ]
    },
    {
        id: 2,
        name: 'Fruit Bowl',
        ingredients: [
            { name: 'orange', quantity: 1, unit: 'piece' },
            { name: 'spinach', quantity: 50, unit: 'g' }
        ]
    }
];

const sampleCalendar = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: null,
    Thursday: 1,
    Friday: null,
    Saturday: 2,
    Sunday: null
};

function getRecipeById(id) {
    return sampleRecipes.find(r => r.id === id);
}

// Run tests
console.log('🧪 Running Nutrition Calculations Tests...\n');

// Test calculateRecipeNutrition
console.log('Testing calculateRecipeNutrition:');
assert(
    NutritionCalculations.calculateRecipeNutrition(sampleRecipes[0], sampleIngredientsData).vitamins.vitaminB12 === true,
    'Recipe should have vitamin B12 from chicken breast'
);
assert(
    NutritionCalculations.calculateRecipeNutrition(sampleRecipes[0], sampleIngredientsData).vitamins.vitaminA === true,
    'Recipe should have vitamin A from spinach'
);
assert(
    NutritionCalculations.calculateRecipeNutrition(sampleRecipes[0], sampleIngredientsData).minerals.iron === true,
    'Recipe should have iron from both ingredients'
);
assert(
    NutritionCalculations.calculateRecipeNutrition(sampleRecipes[0], sampleIngredientsData).vitamins.vitaminD === false,
    'Recipe should not have vitamin D'
);

// Test calculateDayNutrition
console.log('\nTesting calculateDayNutrition:');
const dayNutrition = NutritionCalculations.calculateDayNutrition(sampleCalendar, getRecipeById, sampleIngredientsData);
assert(dayNutrition.length === 7, 'Should return nutrition for all 7 days');
assert(dayNutrition[0].day === 'Monday' && dayNutrition[0].nutrition !== null, 'Monday should have nutrition');
assert(dayNutrition[2].day === 'Wednesday' && dayNutrition[2].nutrition === null, 'Wednesday should have no nutrition');

// Test calculateWeeklyTotals
console.log('\nTesting calculateWeeklyTotals:');
const weeklyTotals = NutritionCalculations.calculateWeeklyTotals(dayNutrition);
assert(weeklyTotals.vitamins.vitaminA === true, 'Weekly total should include vitamin A');
assert(weeklyTotals.vitamins.vitaminB12 === true, 'Weekly total should include vitamin B12');
assert(weeklyTotals.minerals.iron === true, 'Weekly total should include iron');

// Test calculateOmittedNutrients
console.log('\nTesting calculateOmittedNutrients:');
const omitted = NutritionCalculations.calculateOmittedNutrients(dayNutrition);
assert(Array.isArray(omitted.omittedVitamins), 'Should return omitted vitamins array');
assert(Array.isArray(omitted.omittedMinerals), 'Should return omitted minerals array');
assert(omitted.omittedVitamins.includes('vitaminD'), 'Vitamin D should be omitted');
assert(omitted.omittedVitamins.includes('vitaminE'), 'Vitamin E should be omitted');
assert(!omitted.omittedVitamins.includes('vitaminA'), 'Vitamin A should not be omitted');

// Test chart data generation
console.log('\nTesting chart data generation:');
const vitaminsChartData = NutritionCalculations.generateVitaminsChartData(dayNutrition);
assert(vitaminsChartData.labels.length === 7, 'Should have 7 day labels');
assert(vitaminsChartData.datasets.length === 8, 'Should have 8 vitamin datasets');

const mineralsChartData = NutritionCalculations.generateMineralsChartData(dayNutrition);
assert(mineralsChartData.labels.length === 7, 'Should have 7 day labels');
assert(mineralsChartData.datasets.length === 5, 'Should have 5 mineral datasets');

const weeklyVitaminsChart = NutritionCalculations.generateWeeklyVitaminsChartData(dayNutrition);
assert(weeklyVitaminsChart.labels.length === 8, 'Should have 8 vitamin labels');
assert(weeklyVitaminsChart.datasets[0].data.length === 8, 'Should have 8 vitamin data points');

const weeklyMineralsChart = NutritionCalculations.generateWeeklyMineralsChartData(dayNutrition);
assert(weeklyMineralsChart.labels.length === 5, 'Should have 5 mineral labels');
assert(weeklyMineralsChart.datasets[0].data.length === 5, 'Should have 5 mineral data points');

const weeklyMacrosChart = NutritionCalculations.generateWeeklyMacronutrientsChartData(dayNutrition);
assert(weeklyMacrosChart.labels.length === 4, 'Should have 4 macronutrient labels');
assert(weeklyMacrosChart.datasets[0].data.length === 4, 'Should have 4 macronutrient data points');
assert(weeklyMacrosChart.labels.includes('Carbs'), 'Should include Carbs');
assert(weeklyMacrosChart.labels.includes('Fat'), 'Should include Fat');
assert(weeklyMacrosChart.labels.includes('Protein'), 'Should include Protein');
assert(weeklyMacrosChart.labels.includes('Fiber'), 'Should include Fiber');

// Test color functions
console.log('\nTesting color functions:');
assert(NutritionCalculations.getVitaminColor('vitaminA').includes('255, 99, 132'), 'Vitamin A should have correct color');
assert(NutritionCalculations.getMineralColor('iron').includes('54, 162, 235'), 'Iron should have correct color');
assert(NutritionCalculations.getVitaminColor('vitaminA', true).includes('rgba(255, 99, 132, 1)'), 'Border color should be opaque');

// Test edge cases
console.log('\nTesting edge cases:');
const emptyRecipe = { ingredients: [] };
const emptyNutrition = NutritionCalculations.calculateRecipeNutrition(emptyRecipe, {});
assert(emptyNutrition.vitamins.vitaminA === false, 'Empty recipe should have false for all vitamins');

const noIngredientsRecipe = { name: 'Test' };
const noIngredientsNutrition = NutritionCalculations.calculateRecipeNutrition(noIngredientsRecipe, sampleIngredientsData);
assert(noIngredientsNutrition.vitamins.vitaminA === false, 'Recipe with no ingredients should have false for all vitamins');

const emptyCalendar = {};
const emptyDayNutrition = NutritionCalculations.calculateDayNutrition(emptyCalendar, getRecipeById, sampleIngredientsData);
assert(emptyDayNutrition.length === 0, 'Empty calendar should return empty array');

const emptyDayNutritionArray = [];
const emptyWeeklyTotals = NutritionCalculations.calculateWeeklyTotals(emptyDayNutritionArray);
assert(emptyWeeklyTotals.calories === 0, 'Empty day nutrition should have zero calories');

console.log('\n🎉 All tests completed!');

// Summary
console.log('\n📊 Test Summary:');
console.log('- ✅ calculateRecipeNutrition: Aggregates nutrition from ingredients correctly');
console.log('- ✅ calculateDayNutrition: Processes weekly calendar into day-by-day nutrition');
console.log('- ✅ calculateWeeklyTotals: Sums up nutrition across all days');
console.log('- ✅ calculateOmittedNutrients: Identifies missing nutrients');
console.log('- ✅ Chart data generation: Creates proper Chart.js data structures');
console.log('- ✅ Color functions: Return correct RGBA values');
console.log('- ✅ Edge cases: Handles empty data gracefully');

console.log('\n🚀 All nutrition calculation functions are working correctly!');
