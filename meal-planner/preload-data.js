// Script to preload common ingredients and recipes into the meal planner
// Embedded data to avoid CORS issues with JSON file fetching

// Embedded sample data - directly included to avoid fetch/CORS issues
const SAMPLE_RECIPES = [
    {
        "name": "Grilled Chicken Salad",
        "ingredients": [
            {"name": "chicken breast", "quantity": 150, "unit": "g"},
            {"name": "spinach", "quantity": 100, "unit": "g"},
            {"name": "broccoli", "quantity": 50, "unit": "g"},
            {"name": "carrots", "quantity": 50, "unit": "g"},
            {"name": "olive oil", "quantity": 1, "unit": "tbsp"}
        ],
        "method": [
            "Season chicken breast with salt and pepper",
            "Grill chicken for 6-8 minutes per side until cooked through",
            "Steam broccoli and carrots for 5 minutes",
            "Toss spinach with olive oil and lemon juice",
            "Slice chicken and serve over salad"
        ],
        "nutritional": {
            "calories": 350,
            "carbs": 15,
            "fat": 18,
            "protein": 35,
            "fiber": 6
        }
    },
    {
        "name": "Salmon with Quinoa",
        "ingredients": [
            {"name": "salmon", "quantity": 150, "unit": "g"},
            {"name": "quinoa", "quantity": 100, "unit": "g"},
            {"name": "broccoli", "quantity": 100, "unit": "g"},
            {"name": "olive oil", "quantity": 1, "unit": "tbsp"}
        ],
        "method": [
            "Cook quinoa according to package instructions",
            "Steam broccoli for 5-7 minutes",
            "Season salmon with salt and pepper",
            "Pan-fry salmon in olive oil for 4-5 minutes per side",
            "Serve salmon over quinoa with broccoli on the side"
        ],
        "nutritional": {
            "calories": 450,
            "carbs": 35,
            "fat": 22,
            "protein": 32,
            "fiber": 5
        }
    },
    {
        "name": "Vegetable Stir Fry with Tofu",
        "ingredients": [
            {"name": "tofu", "quantity": 200, "unit": "g"},
            {"name": "broccoli", "quantity": 100, "unit": "g"},
            {"name": "bell peppers", "quantity": 100, "unit": "g"},
            {"name": "carrots", "quantity": 50, "unit": "g"},
            {"name": "brown rice", "quantity": 100, "unit": "g"},
            {"name": "olive oil", "quantity": 1, "unit": "tbsp"}
        ],
        "method": [
            "Cook brown rice according to package instructions",
            "Press tofu and cut into cubes",
            "Heat olive oil in a wok or large pan",
            "Stir-fry tofu for 5 minutes until golden",
            "Add vegetables and stir-fry for another 5-7 minutes",
            "Serve over brown rice"
        ],
        "nutritional": {
            "calories": 380,
            "carbs": 45,
            "fat": 16,
            "protein": 18,
            "fiber": 8
        }
    },
    {
        "name": "Beef and Vegetable Stew",
        "ingredients": [
            {"name": "beef", "quantity": 150, "unit": "g"},
            {"name": "carrots", "quantity": 100, "unit": "g"},
            {"name": "potatoes", "quantity": 150, "unit": "g"},
            {"name": "onion", "quantity": 50, "unit": "g"},
            {"name": "tomatoes", "quantity": 100, "unit": "g"},
            {"name": "brown rice", "quantity": 100, "unit": "g"}
        ],
        "method": [
            "Cook brown rice according to package instructions",
            "Cut beef into cubes and brown in a pot",
            "Add chopped onion and cook until softened",
            "Add carrots, potatoes, and tomatoes",
            "Cover with water and simmer for 45-60 minutes",
            "Serve stew over brown rice"
        ],
        "nutritional": {
            "calories": 420,
            "carbs": 50,
            "fat": 12,
            "protein": 28,
            "fiber": 7
        }
    },
    {
        "name": "Greek Yogurt Parfait",
        "ingredients": [
            {"name": "yogurt", "quantity": 200, "unit": "g"},
            {"name": "strawberries", "quantity": 100, "unit": "g"},
            {"name": "blueberries", "quantity": 50, "unit": "g"},
            {"name": "almonds", "quantity": 30, "unit": "g"},
            {"name": "oats", "quantity": 30, "unit": "g"}
        ],
        "method": [
            "Layer yogurt in a glass or bowl",
            "Add mixed berries on top",
            "Sprinkle with chopped almonds and oats",
            "Repeat layers if desired",
            "Serve immediately or chill for 30 minutes"
        ],
        "nutritional": {
            "calories": 320,
            "carbs": 35,
            "fat": 14,
            "protein": 16,
            "fiber": 6
        }
    },
    {
        "name": "Egg and Vegetable Scramble",
        "ingredients": [
            {"name": "eggs", "quantity": 2, "unit": "whole"},
            {"name": "spinach", "quantity": 50, "unit": "g"},
            {"name": "tomatoes", "quantity": 50, "unit": "g"},
            {"name": "bell peppers", "quantity": 50, "unit": "g"},
            {"name": "whole wheat bread", "quantity": 2, "unit": "slices"},
            {"name": "olive oil", "quantity": 1, "unit": "tsp"}
        ],
        "method": [
            "Heat olive oil in a pan",
            "Sauté chopped vegetables for 3-4 minutes",
            "Whisk eggs and pour over vegetables",
            "Scramble until eggs are cooked through",
            "Toast bread and serve alongside"
        ],
        "nutritional": {
            "calories": 380,
            "carbs": 32,
            "fat": 18,
            "protein": 22,
            "fiber": 6
        }
    },
    {
        "name": "Turkey and Avocado Wrap",
        "ingredients": [
            {"name": "turkey", "quantity": 100, "unit": "g"},
            {"name": "avocado", "quantity": 50, "unit": "g"},
            {"name": "lettuce", "quantity": 50, "unit": "g"},
            {"name": "tomatoes", "quantity": 50, "unit": "g"},
            {"name": "whole wheat bread", "quantity": 2, "unit": "slices"}
        ],
        "method": [
            "Slice turkey breast thinly",
            "Mash avocado and spread on bread",
            "Layer turkey, lettuce, and tomato slices",
            "Roll up tightly in bread or tortilla",
            "Cut in half and serve"
        ],
        "nutritional": {
            "calories": 340,
            "carbs": 28,
            "fat": 16,
            "protein": 24,
            "fiber": 7
        }
    },
    {
        "name": "Lentil Soup",
        "ingredients": [
            {"name": "lentils", "quantity": 150, "unit": "g"},
            {"name": "carrots", "quantity": 100, "unit": "g"},
            {"name": "onion", "quantity": 50, "unit": "g"},
            {"name": "garlic", "quantity": 2, "unit": "cloves"},
            {"name": "tomatoes", "quantity": 100, "unit": "g"},
            {"name": "olive oil", "quantity": 1, "unit": "tbsp"}
        ],
        "method": [
            "Heat olive oil in a pot",
            "Sauté chopped onion and garlic for 3 minutes",
            "Add carrots and cook for 5 minutes",
            "Add lentils, tomatoes, and water",
            "Simmer for 25-30 minutes until lentils are tender",
            "Season with salt and pepper"
        ],
        "nutritional": {
            "calories": 320,
            "carbs": 45,
            "fat": 8,
            "protein": 18,
            "fiber": 12
        }
    },
    {
        "name": "Baked Sweet Potato with Beans",
        "ingredients": [
            {"name": "sweet potato", "quantity": 200, "unit": "g"},
            {"name": "chickpeas", "quantity": 100, "unit": "g"},
            {"name": "spinach", "quantity": 50, "unit": "g"},
            {"name": "olive oil", "quantity": 1, "unit": "tsp"}
        ],
        "method": [
            "Preheat oven to 400°F (200°C)",
            "Pierce sweet potato with fork and bake for 45-60 minutes",
            "Heat chickpeas and wilt spinach in olive oil",
            "Split open sweet potato and top with chickpeas and spinach",
            "Season with salt and pepper"
        ],
        "nutritional": {
            "calories": 380,
            "carbs": 55,
            "fat": 10,
            "protein": 14,
            "fiber": 11
        }
    },
    {
        "name": "Fruit and Nut Bowl",
        "ingredients": [
            {"name": "banana", "quantity": 1, "unit": "whole"},
            {"name": "apples", "quantity": 1, "unit": "whole"},
            {"name": "almonds", "quantity": 30, "unit": "g"},
            {"name": "yogurt", "quantity": 150, "unit": "g"}
        ],
        "method": [
            "Slice banana and apple",
            "Portion yogurt into a bowl",
            "Top with fruit slices and almonds",
            "Serve immediately"
        ],
        "nutritional": {
            "calories": 290,
            "carbs": 40,
            "fat": 12,
            "protein": 10,
            "fiber": 6
        }
    },
    {
        "name": "Oatmeal with Berries",
        "ingredients": [
            {"name": "oats", "quantity": 50, "unit": "g"},
            {"name": "milk", "quantity": 200, "unit": "ml"},
            {"name": "strawberries", "quantity": 100, "unit": "g"},
            {"name": "banana", "quantity": 50, "unit": "g"},
            {"name": "almonds", "quantity": 20, "unit": "g"}
        ],
        "method": [
            "Cook oats in milk according to package instructions",
            "Slice banana and strawberries",
            "Top oatmeal with fruit and chopped almonds",
            "Serve warm"
        ],
        "nutritional": {
            "calories": 320,
            "carbs": 50,
            "fat": 10,
            "protein": 12,
            "fiber": 8
        }
    },
    {
        "name": "Tuna Salad Sandwich",
        "ingredients": [
            {"name": "tuna", "quantity": 100, "unit": "g"},
            {"name": "lettuce", "quantity": 50, "unit": "g"},
            {"name": "tomatoes", "quantity": 50, "unit": "g"},
            {"name": "cucumber", "quantity": 50, "unit": "g"},
            {"name": "whole wheat bread", "quantity": 2, "unit": "slices"},
            {"name": "olive oil", "quantity": 1, "unit": "tsp"}
        ],
        "method": [
            "Mix tuna with a little olive oil",
            "Slice vegetables thinly",
            "Layer tuna and vegetables on bread",
            "Close sandwich and cut in half",
            "Serve immediately"
        ],
        "nutritional": {
            "calories": 340,
            "carbs": 32,
            "fat": 12,
            "protein": 26,
            "fiber": 6
        }
    }
];

const SAMPLE_INGREDIENTS = {
    "chicken breast": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true,
            "potassium": true
        }
    },
    "spinach": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true,
            "folate": true
        },
        "minerals": {
            "calcium": true,
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "orange": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {}
    },
    "almonds": {
        "vitamins": {
            "vitaminE": true
        },
        "minerals": {
            "calcium": true,
            "magnesium": true
        }
    },
    "salmon": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true,
            "iron": true,
            "zinc": true,
            "potassium": true
        }
    },
    "broccoli": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true,
            "folate": true
        },
        "minerals": {
            "calcium": true,
            "iron": true,
            "potassium": true
        }
    },
    "sweet potato": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "quinoa": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "eggs": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminE": true,
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        }
    },
    "milk": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        }
    },
    "yogurt": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        }
    },
    "cheese": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        }
    },
    "beef": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        }
    },
    "pork": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        }
    },
    "turkey": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        }
    },
    "tuna": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        }
    },
    "avocado": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminE": true,
            "vitaminK1": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "banana": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "strawberries": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {}
    },
    "blueberries": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {}
    },
    "apples": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {}
    },
    "carrots": {
        "vitamins": {
            "vitaminA": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "bell peppers": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {}
    },
    "tomatoes": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "cucumber": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "lettuce": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "brown rice": {
        "vitamins": {},
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "oats": {
        "vitamins": {},
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "whole wheat bread": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true
        }
    },
    "olive oil": {
        "vitamins": {
            "vitaminE": true,
            "vitaminK1": true
        },
        "minerals": {}
    },
    "butter": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true
        },
        "minerals": {}
    },
    "garlic": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {}
    },
    "onion": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {}
    },
    "potatoes": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "peas": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true
        },
        "minerals": {
            "iron": true
        }
    },
    "lentils": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "chickpeas": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        }
    },
    "tofu": {
        "vitamins": {},
        "minerals": {
            "calcium": true,
            "iron": true,
            "magnesium": true
        }
    },
    "nuts": {
        "vitamins": {
            "vitaminE": true
        },
        "minerals": {
            "magnesium": true
        }
    },
    "seeds": {
        "vitamins": {
            "vitaminE": true
        },
        "minerals": {
            "magnesium": true,
            "zinc": true
        }
    }
};

/**
 * Load common ingredients and recipes into the meal planner
 * Call this function to populate the app with sample data
 */
function preloadCommonData() {
    try {
        // Merge with existing ingredients data
        const existingIngredients = JSON.parse(localStorage.getItem('ingredientsData') || '{}');
        const mergedIngredients = { ...existingIngredients, ...SAMPLE_INGREDIENTS };

        // Save merged ingredients data
        localStorage.setItem('ingredientsData', JSON.stringify(mergedIngredients));
        console.log('✅ Loaded', Object.keys(SAMPLE_INGREDIENTS).length, 'common ingredients');

        // Get existing recipes
        const existingRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');

        // Add new recipes with unique IDs
        const newRecipes = SAMPLE_RECIPES.map(recipe => ({
            ...recipe,
            id: Date.now() + Math.random() // Ensure unique IDs
        }));

        const mergedRecipes = [...existingRecipes, ...newRecipes];

        // Save merged recipes
        localStorage.setItem('recipes', JSON.stringify(mergedRecipes));
        console.log('✅ Loaded', SAMPLE_RECIPES.length, 'common recipes');

        console.log('🎉 Common data preload complete. Refresh the page to see the new data.');

    } catch (error) {
        console.error('Error preloading data:', error);
    }
}

/**
 * Clear all data and reload with only common data
 */
function resetToCommonData() {
    try {
        // Clear existing data
        localStorage.removeItem('recipes');
        localStorage.removeItem('ingredientsData');
        localStorage.removeItem('inventory');
        localStorage.removeItem('calendar');
        localStorage.removeItem('shoppingList');

        // Load common data
        const ingredientsData = { ...SAMPLE_INGREDIENTS };
        localStorage.setItem('ingredientsData', JSON.stringify(ingredientsData));

        const recipes = SAMPLE_RECIPES.map(recipe => ({
            ...recipe,
            id: Date.now() + Math.random()
        }));
        localStorage.setItem('recipes', JSON.stringify(recipes));

        console.log('🔄 Reset to common data complete. Refresh the page to see the changes.');

    } catch (error) {
        console.error('Error resetting data:', error);
    }
}

/**
 * Check if common data is already loaded
 */
function isCommonDataLoaded() {
    try {
        const ingredients = JSON.parse(localStorage.getItem('ingredientsData') || '{}');
        const recipes = JSON.parse(localStorage.getItem('recipes') || '[]');

        // Check if we have some common ingredients
        const hasCommonIngredients = Object.keys(ingredients).some(key =>
            ['chicken breast', 'spinach', 'salmon', 'broccoli'].includes(key)
        );

        // Check if we have some common recipes
        const hasCommonRecipes = recipes.some(recipe =>
            ['Grilled Chicken Salad', 'Salmon with Quinoa', 'Vegetable Stir Fry with Tofu'].includes(recipe.name)
        );

        return hasCommonIngredients && hasCommonRecipes;

    } catch (error) {
        return false;
    }
}

// Export functions for use in browser console or other scripts
if (typeof window !== 'undefined') {
    window.PreloadData = {
        preloadCommonData,
        resetToCommonData,
        isCommonDataLoaded
    };
}

// Auto-load common data if not already present (uncomment to enable)
// if (typeof window !== 'undefined' && !isCommonDataLoaded()) {
//     console.log('🔄 Auto-loading common data...');
//     preloadCommonData();
// }
