// Pure functions for nutritional calculations
// No dependencies, can be tested independently

/**
 * Calculate nutritional content for a recipe based on its ingredients
 * @param {Object} recipe - Recipe object with ingredients array
 * @param {Object} ingredientsData - Nutritional data for ingredients
 * @returns {Object} Nutritional data for the recipe
 */
function calculateRecipeNutrition(recipe, ingredientsData) {
    // Start with recipe's own nutritional data if available
    let nutrition = recipe.nutritional || { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: {}, minerals: {} };

    // Initialize vitamins and minerals if not present
    if (!nutrition.vitamins) nutrition.vitamins = {};
    if (!nutrition.minerals) nutrition.minerals = {};

    // Calculate from ingredients if available
    if (recipe.ingredients && ingredientsData) {
        recipe.ingredients.forEach(ing => {
            const ingData = ingredientsData[ing.name];
            if (ingData) {
                // Aggregate vitamins (OR logic - if any ingredient has it, recipe has it)
                if (ingData.vitamins) {
                    Object.keys(ingData.vitamins).forEach(vitamin => {
                        if (ingData.vitamins[vitamin]) {
                            nutrition.vitamins[vitamin] = true;
                        }
                    });
                }
                // Aggregate minerals (OR logic - if any ingredient has it, recipe has it)
                if (ingData.minerals) {
                    Object.keys(ingData.minerals).forEach(mineral => {
                        if (ingData.minerals[mineral]) {
                            nutrition.minerals[mineral] = true;
                        }
                    });
                }
            }
        });
    }

    // Ensure all vitamin and mineral keys exist with default false values
    const allVitamins = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
    const allMinerals = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];

    allVitamins.forEach(vitamin => {
        if (nutrition.vitamins[vitamin] === undefined) {
            nutrition.vitamins[vitamin] = false;
        }
    });

    allMinerals.forEach(mineral => {
        if (nutrition.minerals[mineral] === undefined) {
            nutrition.minerals[mineral] = false;
        }
    });

    return nutrition;
}

/**
 * Calculate nutritional data for each day of the week
 * @param {Object} calendar - Weekly calendar with recipe IDs
 * @param {Function} getRecipeById - Function to get recipe by ID
 * @param {Object} ingredientsData - Nutritional data for ingredients
 * @returns {Array} Array of day nutrition objects
 */
function calculateDayNutrition(calendar, getRecipeById, ingredientsData) {
    return Object.keys(calendar).map(day => {
        const recipeId = calendar[day];
        if (!recipeId) return { day, nutrition: null };
        const recipe = getRecipeById(recipeId);
        if (!recipe) return { day, nutrition: null };
        return { day, nutrition: calculateRecipeNutrition(recipe, ingredientsData) };
    });
}

/**
 * Calculate weekly nutritional totals
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Weekly totals
 */
function calculateWeeklyTotals(dayNutrition) {
    return dayNutrition.reduce((total, day) => {
        if (!day.nutrition) return total;
        return {
            calories: total.calories + day.nutrition.calories,
            carbs: total.carbs + day.nutrition.carbs,
            fat: total.fat + day.nutrition.fat,
            protein: total.protein + day.nutrition.protein,
            fiber: total.fiber + day.nutrition.fiber,
            vitamins: Object.keys(total.vitamins).reduce((vits, vit) => ({ ...vits, [vit]: total.vitamins[vit] || day.nutrition.vitamins[vit] }), {}),
            minerals: Object.keys(total.minerals).reduce((mins, min) => ({ ...mins, [min]: total.minerals[min] || day.nutrition.minerals[min] }), {})
        };
    }, { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: { vitaminA: false, vitaminC: false, vitaminD: false, vitaminE: false, vitaminK1: false, vitaminK2: false, vitaminB12: false, folate: false }, minerals: { calcium: false, iron: false, magnesium: false, potassium: false, zinc: false } });
}

/**
 * Calculate omitted nutrients for the week
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Object with omitted vitamins and minerals arrays
 */
function calculateOmittedNutrients(dayNutrition) {
    const allVitamins = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
    const allMinerals = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];

    const omittedVitamins = allVitamins.filter(vitamin => {
        return !dayNutrition.some(day => day.nutrition && day.nutrition.vitamins[vitamin]);
    });

    const omittedMinerals = allMinerals.filter(mineral => {
        return !dayNutrition.some(day => day.nutrition && day.nutrition.minerals[mineral]);
    });

    return { omittedVitamins, omittedMinerals };
}

/**
 * Generate chart data for vitamins stacked bar chart
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Chart.js compatible data object
 */
function generateVitaminsChartData(dayNutrition) {
    const vitaminNames = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
    return {
        labels: dayNutrition.map(d => d.day.substring(0, 3)),
        datasets: vitaminNames.map(vitamin => ({
            label: vitamin,
            data: dayNutrition.map(d => d.nutrition && d.nutrition.vitamins[vitamin] ? 1 : 0),
            backgroundColor: getVitaminColor(vitamin),
            borderColor: getVitaminColor(vitamin, true),
            borderWidth: 1
        }))
    };
}

/**
 * Generate chart data for minerals stacked bar chart
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Chart.js compatible data object
 */
function generateMineralsChartData(dayNutrition) {
    const mineralNames = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];
    return {
        labels: dayNutrition.map(d => d.day.substring(0, 3)),
        datasets: mineralNames.map(mineral => ({
            label: mineral,
            data: dayNutrition.map(d => d.nutrition && d.nutrition.minerals[mineral] ? 1 : 0),
            backgroundColor: getMineralColor(mineral),
            borderColor: getMineralColor(mineral, true),
            borderWidth: 1
        }))
    };
}

/**
 * Generate chart data for weekly vitamins pie chart
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Chart.js compatible data object
 */
function generateWeeklyVitaminsChartData(dayNutrition) {
    const vitaminNames = ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK1', 'vitaminK2', 'vitaminB12', 'folate'];
    const vitaminCounts = vitaminNames.map(vitamin => {
        return dayNutrition.reduce((count, day) => {
            return count + (day.nutrition && day.nutrition.vitamins[vitamin] ? 1 : 0);
        }, 0);
    });

    return {
        labels: vitaminNames,
        datasets: [{
            data: vitaminCounts,
            backgroundColor: vitaminNames.map(v => getVitaminColor(v)),
            borderColor: vitaminNames.map(v => getVitaminColor(v, true)),
            borderWidth: 1
        }]
    };
}

/**
 * Generate chart data for weekly minerals pie chart
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Chart.js compatible data object
 */
function generateWeeklyMineralsChartData(dayNutrition) {
    const mineralNames = ['calcium', 'iron', 'magnesium', 'potassium', 'zinc'];
    const mineralCounts = mineralNames.map(mineral => {
        return dayNutrition.reduce((count, day) => {
            return count + (day.nutrition && day.nutrition.minerals[mineral] ? 1 : 0);
        }, 0);
    });

    return {
        labels: mineralNames,
        datasets: [{
            data: mineralCounts,
            backgroundColor: mineralNames.map(m => getMineralColor(m)),
            borderColor: mineralNames.map(m => getMineralColor(m, true)),
            borderWidth: 1
        }]
    };
}

/**
 * Generate chart data for weekly macronutrients pie chart
 * @param {Array} dayNutrition - Array of day nutrition objects
 * @returns {Object} Chart.js compatible data object
 */
function generateWeeklyMacronutrientsChartData(dayNutrition) {
    const weeklyTotals = calculateWeeklyTotals(dayNutrition);

    const macroNames = ['Carbs', 'Fat', 'Protein', 'Fiber'];
    const macroValues = [
        weeklyTotals.carbs,
        weeklyTotals.fat,
        weeklyTotals.protein,
        weeklyTotals.fiber
    ];

    const macroColors = [
        'rgba(52, 152, 219, 0.8)',    // Carbs - blue
        'rgba(231, 76, 60, 0.8)',     // Fat - red
        'rgba(46, 204, 113, 0.8)',    // Protein - green
        'rgba(155, 89, 182, 0.8)'     // Fiber - purple
    ];

    const macroBorderColors = [
        'rgba(52, 152, 219, 1)',
        'rgba(231, 76, 60, 1)',
        'rgba(46, 204, 113, 1)',
        'rgba(155, 89, 182, 1)'
    ];

    return {
        labels: macroNames,
        datasets: [{
            data: macroValues,
            backgroundColor: macroColors,
            borderColor: macroBorderColors,
            borderWidth: 1
        }]
    };
}

// Helper functions for colors
function getVitaminColor(vitamin, border = false) {
    const colors = {
        vitaminA: border ? 'rgba(255, 99, 132, 1)' : 'rgba(255, 99, 132, 0.8)',
        vitaminC: border ? 'rgba(54, 162, 235, 1)' : 'rgba(54, 162, 235, 0.8)',
        vitaminD: border ? 'rgba(255, 205, 86, 1)' : 'rgba(255, 205, 86, 0.8)',
        vitaminE: border ? 'rgba(75, 192, 192, 1)' : 'rgba(75, 192, 192, 0.8)',
        vitaminK1: border ? 'rgba(153, 102, 255, 1)' : 'rgba(153, 102, 255, 0.8)',
        vitaminK2: border ? 'rgba(255, 159, 64, 1)' : 'rgba(255, 159, 64, 0.8)',
        vitaminB12: border ? 'rgba(199, 199, 199, 1)' : 'rgba(199, 199, 199, 0.8)',
        folate: border ? 'rgba(83, 102, 255, 1)' : 'rgba(83, 102, 255, 0.8)'
    };
    return colors[vitamin] || (border ? 'rgba(128, 128, 128, 1)' : 'rgba(128, 128, 128, 0.8)');
}

function getMineralColor(mineral, border = false) {
    const colors = {
        calcium: border ? 'rgba(255, 99, 132, 1)' : 'rgba(255, 99, 132, 0.8)',
        iron: border ? 'rgba(54, 162, 235, 1)' : 'rgba(54, 162, 235, 0.8)',
        magnesium: border ? 'rgba(255, 205, 86, 1)' : 'rgba(255, 205, 86, 0.8)',
        potassium: border ? 'rgba(75, 192, 192, 1)' : 'rgba(75, 192, 192, 0.8)',
        zinc: border ? 'rgba(153, 102, 255, 1)' : 'rgba(153, 102, 255, 0.8)'
    };
    return colors[mineral] || (border ? 'rgba(128, 128, 128, 1)' : 'rgba(128, 128, 128, 0.8)');
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateRecipeNutrition,
        calculateDayNutrition,
        calculateWeeklyTotals,
        calculateOmittedNutrients,
        generateVitaminsChartData,
        generateMineralsChartData,
        generateWeeklyVitaminsChartData,
        generateWeeklyMineralsChartData,
        generateWeeklyMacronutrientsChartData,
        getVitaminColor,
        getMineralColor
    };
} else if (typeof window !== 'undefined') {
    window.NutritionCalculations = {
        calculateRecipeNutrition,
        calculateDayNutrition,
        calculateWeeklyTotals,
        calculateOmittedNutrients,
        generateVitaminsChartData,
        generateMineralsChartData,
        generateWeeklyVitaminsChartData,
        generateWeeklyMineralsChartData,
        generateWeeklyMacronutrientsChartData,
        getVitaminColor,
        getMineralColor
    };
}
