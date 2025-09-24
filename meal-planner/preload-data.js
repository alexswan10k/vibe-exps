// Script to preload common ingredients and recipes into the meal planner
// Embedded data to avoid CORS issues with JSON file fetching
// Embedded sample data - directly included to avoid fetch/CORS issues
const SAMPLE_RECIPES = [
    {
        "name": "Grilled Chicken Salad",
        "ingredients": [
            { "name": "chicken breast", "quantity": 150, "unit": "g" },
            { "name": "spinach", "quantity": 100, "unit": "g" },
            { "name": "broccoli", "quantity": 50, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tbsp" }
        ],
        "method": [
            "Season chicken breast with salt and pepper",
            "Grill chicken for 6-8 minutes per side until cooked through",
            "Steam broccoli and carrots for 5 minutes",
            "Toss spinach with olive oil and lemon juice",
            "Slice chicken and serve over salad"
        ],
        "nutritional": {
            "calories": 302,
            "carbs": 15,
            "fat": 18,
            "protein": 35,
            "fiber": 6
        }
    },
    {
        "name": "Salmon with Quinoa",
        "ingredients": [
            { "name": "salmon", "quantity": 150, "unit": "g" },
            { "name": "quinoa", "quantity": 100, "unit": "g" },
            { "name": "broccoli", "quantity": 100, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tbsp" }
        ],
        "method": [
            "Cook quinoa according to package instructions",
            "Steam broccoli for 5-7 minutes",
            "Season salmon with salt and pepper",
            "Pan-fry salmon in olive oil for 4-5 minutes per side",
            "Serve salmon over quinoa with broccoli on the side"
        ],
        "nutritional": {
            "calories": 566,
            "carbs": 35,
            "fat": 22,
            "protein": 32,
            "fiber": 5
        }
    },
    {
        "name": "Vegetable Stir Fry with Tofu",
        "ingredients": [
            { "name": "tofu", "quantity": 200, "unit": "g" },
            { "name": "broccoli", "quantity": 100, "unit": "g" },
            { "name": "bell peppers", "quantity": 100, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "brown rice", "quantity": 100, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tbsp" }
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
            "calories": 162,
            "carbs": 45,
            "fat": 16,
            "protein": 18,
            "fiber": 8
        }
    },
    {
        "name": "Beef and Vegetable Stew",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "carrots", "quantity": 100, "unit": "g" },
            { "name": "potatoes", "quantity": 150, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "tomatoes", "quantity": 100, "unit": "g" },
            { "name": "brown rice", "quantity": 100, "unit": "g" }
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
            "calories": 535,
            "carbs": 50,
            "fat": 12,
            "protein": 28,
            "fiber": 7
        }
    },
    {
        "name": "Greek Yogurt Parfait",
        "ingredients": [
            { "name": "yogurt", "quantity": 200, "unit": "g" },
            { "name": "strawberries", "quantity": 100, "unit": "g" },
            { "name": "blueberries", "quantity": 50, "unit": "g" },
            { "name": "almonds", "quantity": 30, "unit": "g" },
            { "name": "oats", "quantity": 30, "unit": "g" }
        ],
        "method": [
            "Layer yogurt in a glass or bowl",
            "Add mixed berries on top",
            "Sprinkle with chopped almonds and oats",
            "Repeat layers if desired",
            "Serve immediately or chill for 30 minutes"
        ],
        "nutritional": {
            "calories": 238,
            "carbs": 35,
            "fat": 14,
            "protein": 16,
            "fiber": 6
        }
    },
    {
        "name": "Egg and Vegetable Scramble",
        "ingredients": [
            { "name": "eggs", "quantity": 2, "unit": "whole" },
            { "name": "spinach", "quantity": 50, "unit": "g" },
            { "name": "tomatoes", "quantity": 50, "unit": "g" },
            { "name": "bell peppers", "quantity": 50, "unit": "g" },
            { "name": "whole wheat bread", "quantity": 2, "unit": "slices" },
            { "name": "olive oil", "quantity": 1, "unit": "tsp" }
        ],
        "method": [
            "Heat olive oil in a pan",
            "Sauté chopped vegetables for 3-4 minutes",
            "Whisk eggs and pour over vegetables",
            "Scramble until eggs are cooked through",
            "Toast bread and serve alongside"
        ],
        "nutritional": {
            "calories": 263,
            "carbs": 32,
            "fat": 18,
            "protein": 22,
            "fiber": 6
        }
    },
    {
        "name": "Turkey and Avocado Wrap",
        "ingredients": [
            { "name": "turkey", "quantity": 100, "unit": "g" },
            { "name": "avocado", "quantity": 50, "unit": "g" },
            { "name": "lettuce", "quantity": 50, "unit": "g" },
            { "name": "tomatoes", "quantity": 50, "unit": "g" },
            { "name": "whole wheat bread", "quantity": 2, "unit": "slices" }
        ],
        "method": [
            "Slice turkey breast thinly",
            "Mash avocado and spread on bread",
            "Layer turkey, lettuce, and tomato slices",
            "Roll up tightly in bread or tortilla",
            "Cut in half and serve"
        ],
        "nutritional": {
            "calories": 569,
            "carbs": 28,
            "fat": 16,
            "protein": 24,
            "fiber": 7
        }
    },
    {
        "name": "Lentil Soup",
        "ingredients": [
            { "name": "lentils", "quantity": 150, "unit": "g" },
            { "name": "carrots", "quantity": 100, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "garlic", "quantity": 2, "unit": "cloves" },
            { "name": "tomatoes", "quantity": 100, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tbsp" }
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
            "calories": 139,
            "carbs": 45,
            "fat": 8,
            "protein": 18,
            "fiber": 12
        }
    },
    {
        "name": "Baked Sweet Potato with Beans",
        "ingredients": [
            { "name": "sweet potato", "quantity": 200, "unit": "g" },
            { "name": "chickpeas", "quantity": 100, "unit": "g" },
            { "name": "spinach", "quantity": 50, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tsp" }
        ],
        "method": [
            "Preheat oven to 400°F (200°C)",
            "Pierce sweet potato with fork and bake for 45-60 minutes",
            "Heat chickpeas and wilt spinach in olive oil",
            "Split open sweet potato and top with chickpeas and spinach",
            "Season with salt and pepper"
        ],
        "nutritional": {
            "calories": 344,
            "carbs": 55,
            "fat": 10,
            "protein": 14,
            "fiber": 11
        }
    },
    {
        "name": "Fruit and Nut Bowl",
        "ingredients": [
            { "name": "banana", "quantity": 1, "unit": "whole" },
            { "name": "apples", "quantity": 1, "unit": "whole" },
            { "name": "almonds", "quantity": 30, "unit": "g" },
            { "name": "yogurt", "quantity": 150, "unit": "g" }
        ],
        "method": [
            "Slice banana and apple",
            "Portion yogurt into a bowl",
            "Top with fruit slices and almonds",
            "Serve immediately"
        ],
        "nutritional": {
            "calories": 246,
            "carbs": 40,
            "fat": 12,
            "protein": 10,
            "fiber": 6
        }
    },
    {
        "name": "Oatmeal with Berries",
        "ingredients": [
            { "name": "oats", "quantity": 50, "unit": "g" },
            { "name": "milk", "quantity": 200, "unit": "ml" },
            { "name": "strawberries", "quantity": 100, "unit": "g" },
            { "name": "banana", "quantity": 50, "unit": "g" },
            { "name": "almonds", "quantity": 20, "unit": "g" }
        ],
        "method": [
            "Cook oats in milk according to package instructions",
            "Slice banana and strawberries",
            "Top oatmeal with fruit and chopped almonds",
            "Serve warm"
        ],
        "nutritional": {
            "calories": 246,
            "carbs": 50,
            "fat": 10,
            "protein": 12,
            "fiber": 8
        }
    },
    {
        "name": "Tuna Salad Sandwich",
        "ingredients": [
            { "name": "tuna", "quantity": 100, "unit": "g" },
            { "name": "lettuce", "quantity": 50, "unit": "g" },
            { "name": "tomatoes", "quantity": 50, "unit": "g" },
            { "name": "cucumber", "quantity": 50, "unit": "g" },
            { "name": "whole wheat bread", "quantity": 2, "unit": "slices" },
            { "name": "olive oil", "quantity": 1, "unit": "tsp" }
        ],
        "method": [
            "Mix tuna with a little olive oil",
            "Slice vegetables thinly",
            "Layer tuna and vegetables on bread",
            "Close sandwich and cut in half",
            "Serve immediately"
        ],
        "nutritional": {
            "calories": 253,
            "carbs": 32,
            "fat": 12,
            "protein": 26,
            "fiber": 6
        }
    },
    {
        "name": "Spaghetti Carbonara",
        "ingredients": [
            { "name": "spaghetti", "quantity": 100, "unit": "g" },
            { "name": "bacon", "quantity": 50, "unit": "g" },
            { "name": "eggs", "quantity": 1, "unit": "whole" },
            { "name": "parmesan", "quantity": 30, "unit": "g" },
            { "name": "garlic", "quantity": 1, "unit": "clove" }
        ],
        "method": [
            "Boil spaghetti until al dente",
            "Fry bacon until crisp",
            "Whisk egg with parmesan",
            "Drain pasta, mix with egg mixture off heat",
            "Add bacon and pepper"
        ],
        "nutritional": {
            "calories": 440,
            "carbs": 45,
            "fat": 20,
            "protein": 18,
            "fiber": 2
        }
    },
    {
        "name": "Spaghetti Bolognese",
        "ingredients": [
            { "name": "spaghetti", "quantity": 100, "unit": "g" },
            { "name": "beef", "quantity": 100, "unit": "g" },
            { "name": "tomatoes", "quantity": 100, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "garlic", "quantity": 1, "unit": "clove" },
            { "name": "carrots", "quantity": 50, "unit": "g" }
        ],
        "method": [
            "Brown beef with onion and garlic",
            "Add carrots and tomatoes, simmer 20 min",
            "Boil spaghetti",
            "Serve sauce over pasta"
        ],
        "nutritional": {
            "calories": 667,
            "carbs": 55,
            "fat": 11,
            "protein": 23,
            "fiber": 6
        }
    },
    {
        "name": "Chicken Curry",
        "ingredients": [
            { "name": "chicken breast", "quantity": 150, "unit": "g" },
            { "name": "coconut milk", "quantity": 100, "unit": "ml" },
            { "name": "curry powder", "quantity": 1, "unit": "tbsp" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "garlic", "quantity": 1, "unit": "clove" },
            { "name": "brown rice", "quantity": 100, "unit": "g" }
        ],
        "method": [
            "Sauté onion and garlic",
            "Add chicken and curry powder",
            "Pour in coconut milk, simmer 15 min",
            "Serve over cooked rice"
        ],
        "nutritional": {
            "calories": 243,
            "carbs": 40,
            "fat": 20,
            "protein": 30,
            "fiber": 4
        }
    },
    {
        "name": "Vegetable Curry",
        "ingredients": [
            { "name": "broccoli", "quantity": 100, "unit": "g" },
            { "name": "carrots", "quantity": 100, "unit": "g" },
            { "name": "coconut milk", "quantity": 100, "unit": "ml" },
            { "name": "curry powder", "quantity": 1, "unit": "tbsp" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "brown rice", "quantity": 100, "unit": "g" }
        ],
        "method": [
            "Sauté onion",
            "Add vegetables and curry powder",
            "Pour in coconut milk, simmer 15 min",
            "Serve over cooked rice"
        ],
        "nutritional": {
            "calories": 188,
            "carbs": 50,
            "fat": 12,
            "protein": 10,
            "fiber": 8
        }
    },
    {
        "name": "Chicken Pot Pie",
        "ingredients": [
            { "name": "chicken breast", "quantity": 100, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "peas", "quantity": 50, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "puff pastry", "quantity": 50, "unit": "g" },
            { "name": "chicken broth", "quantity": 100, "unit": "ml" }
        ],
        "method": [
            "Cook chicken and vegetables",
            "Mix with broth",
            "Top with pastry",
            "Bake at 400°F for 20 min"
        ],
        "nutritional": {
            "calories": 400,
            "carbs": 35,
            "fat": 18,
            "protein": 25,
            "fiber": 4
        }
    },
    {
        "name": "Shepherd's Pie",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "potatoes", "quantity": 200, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "peas", "quantity": 50, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" }
        ],
        "method": [
            "Brown beef with vegetables",
            "Mash potatoes",
            "Top meat with mash",
            "Bake at 375°F for 20 min"
        ],
        "nutritional": {
            "calories": 420,
            "carbs": 40,
            "fat": 15,
            "protein": 25,
            "fiber": 5
        }
    },
    {
        "name": "Cottage Pie",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "potatoes", "quantity": 200, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "tomatoes", "quantity": 50, "unit": "g" }
        ],
        "method": [
            "Brown beef with onion and carrots",
            "Add tomatoes, simmer",
            "Top with mashed potatoes",
            "Bake at 375°F for 20 min"
        ],
        "nutritional": {
            "calories": 358,
            "carbs": 35,
            "fat": 14,
            "protein": 24,
            "fiber": 5
        }
    },
    {
        "name": "Beef Bourguignon",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "mushrooms", "quantity": 50, "unit": "g" },
            { "name": "red wine", "quantity": 100, "unit": "ml" },
            { "name": "beef broth", "quantity": 100, "unit": "ml" }
        ],
        "method": [
            "Brown beef",
            "Add vegetables, wine, broth",
            "Simmer 60 min"
        ],
        "nutritional": {
            "calories": 711,
            "carbs": 15,
            "fat": 20,
            "protein": 35,
            "fiber": 3
        }
    },
    {
        "name": "Grilled Steak",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "olive oil", "quantity": 1, "unit": "tsp" }
        ],
        "method": [
            "Season steak",
            "Grill 4-5 min per side"
        ],
        "nutritional": {
            "calories": 614,
            "carbs": 0,
            "fat": 25,
            "protein": 40,
            "fiber": 0
        }
    },
    {
        "name": "Chicken Stir Fry",
        "ingredients": [
            { "name": "chicken breast", "quantity": 150, "unit": "g" },
            { "name": "broccoli", "quantity": 100, "unit": "g" },
            { "name": "bell peppers", "quantity": 50, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "soy sauce", "quantity": 1, "unit": "tbsp" },
            { "name": "brown rice", "quantity": 100, "unit": "g" }
        ],
        "method": [
            "Stir-fry chicken and veggies",
            "Add soy sauce",
            "Serve over rice"
        ],
        "nutritional": {
            "calories": 255,
            "carbs": 45,
            "fat": 10,
            "protein": 30,
            "fiber": 5
        }
    },
    {
        "name": "Sweet & Sour Chicken",
        "ingredients": [
            { "name": "chicken breast", "quantity": 150, "unit": "g" },
            { "name": "bell peppers", "quantity": 50, "unit": "g" },
            { "name": "pineapple", "quantity": 50, "unit": "g" },
            { "name": "soy sauce", "quantity": 1, "unit": "tbsp" },
            { "name": "vinegar", "quantity": 1, "unit": "tbsp" },
            { "name": "brown rice", "quantity": 100, "unit": "g" }
        ],
        "method": [
            "Stir-fry chicken and veggies",
            "Add pineapple, soy, vinegar",
            "Serve over rice"
        ],
        "nutritional": {
            "calories": 413,
            "carbs": 50,
            "fat": 10,
            "protein": 28,
            "fiber": 4
        }
    },
    {
        "name": "Zuurvlees",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "vinegar", "quantity": 50, "unit": "ml" },
            { "name": "brown sugar", "quantity": 10, "unit": "g" },
            { "name": "bay leaf", "quantity": 1, "unit": "whole" }
        ],
        "method": [
            "Marinate beef in vinegar overnight",
            "Brown beef and onion",
            "Add sugar and bay leaf, simmer 60 min"
        ],
        "nutritional": {
            "calories": 538,
            "carbs": 20,
            "fat": 18,
            "protein": 30,
            "fiber": 2
        }
    },
    {
        "name": "Stamppot",
        "ingredients": [
            { "name": "potatoes", "quantity": 200, "unit": "g" },
            { "name": "kale", "quantity": 100, "unit": "g" },
            { "name": "bacon", "quantity": 50, "unit": "g" },
            { "name": "milk", "quantity": 50, "unit": "ml" }
        ],
        "method": [
            "Boil potatoes and kale",
            "Mash with milk",
            "Fry bacon, mix in"
        ],
        "nutritional": {
            "calories": 312,
            "carbs": 45,
            "fat": 12,
            "protein": 15,
            "fiber": 6
        }
    },
    {
        "name": "Wiener Schnitzel",
        "ingredients": [
            { "name": "veal", "quantity": 150, "unit": "g" },
            { "name": "flour", "quantity": 20, "unit": "g" },
            { "name": "eggs", "quantity": 1, "unit": "whole" },
            { "name": "breadcrumbs", "quantity": 50, "unit": "g" },
            { "name": "olive oil", "quantity": 2, "unit": "tbsp" },
            { "name": "lemon", "quantity": 0.25, "unit": "whole" }
        ],
        "method": [
            "Pound veal thin",
            "Season with salt and pepper",
            "Dredge in flour, then egg, then breadcrumbs",
            "Fry in hot oil until golden on both sides",
            "Serve with lemon wedge"
        ],
        "nutritional": {
            "calories": 550,
            "carbs": 35,
            "fat": 30,
            "protein": 35,
            "fiber": 2
        }
    },
    {
        "name": "Sauerbraten",
        "ingredients": [
            { "name": "beef", "quantity": 150, "unit": "g" },
            { "name": "onion", "quantity": 50, "unit": "g" },
            { "name": "carrots", "quantity": 50, "unit": "g" },
            { "name": "red wine", "quantity": 100, "unit": "ml" },
            { "name": "vinegar", "quantity": 50, "unit": "ml" },
            { "name": "brown sugar", "quantity": 10, "unit": "g" },
            { "name": "cloves", "quantity": 2, "unit": "whole" },
            { "name": "juniper berries", "quantity": 3, "unit": "whole" },
            { "name": "bay leaf", "quantity": 1, "unit": "whole" }
        ],
        "method": [
            "Marinate beef with onion, carrots, wine, vinegar, sugar, and spices for 2-3 days in fridge",
            "Remove beef, brown in pot",
            "Add marinade and veggies, simmer 1-2 hours until tender",
            "Thicken sauce if desired"
        ],
        "nutritional": {
            "calories": 500,
            "carbs": 25,
            "fat": 20,
            "protein": 40,
            "fiber": 3
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
        },
        "price": 5.99
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
        },
        "price": 2.49
    },
    "orange": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {},
        "price": 0.89
    },
    "almonds": {
        "vitamins": {
            "vitaminE": true
        },
        "minerals": {
            "calcium": true,
            "magnesium": true
        },
        "price": 4.99
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
        },
        "price": 8.99
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
        },
        "price": 1.99
    },
    "sweet potato": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 1.29
    },
    "quinoa": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        },
        "price": 3.99
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
        },
        "price": 2.99
    },
    "milk": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        },
        "price": 1.49
    },
    "yogurt": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        },
        "price": 2.49
    },
    "cheese": {
        "vitamins": {
            "vitaminA": true,
            "vitaminD": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        },
        "price": 3.99
    },
    "beef": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        },
        "price": 6.99
    },
    "pork": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        },
        "price": 4.99
    },
    "turkey": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true
        },
        "price": 5.49
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
        },
        "price": 2.99
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
        },
        "price": 1.49
    },
    "banana": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 0.49
    },
    "strawberries": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {},
        "price": 3.99
    },
    "blueberries": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {},
        "price": 4.49
    },
    "apples": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {},
        "price": 1.29
    },
    "carrots": {
        "vitamins": {
            "vitaminA": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 0.99
    },
    "bell peppers": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {},
        "price": 1.99
    },
    "tomatoes": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 1.99
    },
    "cucumber": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 0.79
    },
    "lettuce": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true
        },
        "minerals": {
            "potassium": true
        },
        "price": 1.49
    },
    "brown rice": {
        "vitamins": {},
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        },
        "price": 2.49
    },
    "oats": {
        "vitamins": {},
        "minerals": {
            "iron": true,
            "magnesium": true,
            "potassium": true
        },
        "price": 2.99
    },
    "whole wheat bread": {
        "vitamins": {
            "vitaminB12": false
        },
        "minerals": {
            "iron": true
        },
        "price": 2.99
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
    },
    "spaghetti": {
        "vitamins": {},
        "minerals": {
            "iron": true
        }
    },
    "bacon": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "zinc": true
        }
    },
    "parmesan": {
        "vitamins": {
            "vitaminA": true,
            "vitaminB12": true
        },
        "minerals": {
            "calcium": true
        }
    },
    "coconut milk": {
        "vitamins": {},
        "minerals": {
            "iron": true
        }
    },
    "curry powder": {
        "vitamins": {},
        "minerals": {
            "iron": true
        }
    },
    "puff pastry": {
        "vitamins": {},
        "minerals": {}
    },
    "chicken broth": {
        "vitamins": {},
        "minerals": {}
    },
    "mushrooms": {
        "vitamins": {
            "vitaminD": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "red wine": {
        "vitamins": {},
        "minerals": {}
    },
    "beef broth": {
        "vitamins": {},
        "minerals": {}
    },
    "soy sauce": {
        "vitamins": {},
        "minerals": {}
    },
    "pineapple": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {}
    },
    "vinegar": {
        "vitamins": {},
        "minerals": {}
    },
    "brown sugar": {
        "vitamins": {},
        "minerals": {}
    },
    "bay leaf": {
        "vitamins": {},
        "minerals": {}
    },
    "kale": {
        "vitamins": {
            "vitaminA": true,
            "vitaminC": true,
            "vitaminK1": true
        },
        "minerals": {
            "calcium": true
        }
    },
    "veal": {
        "vitamins": {
            "vitaminB12": true
        },
        "minerals": {
            "iron": true,
            "zinc": true,
            "potassium": true
        }
    },
    "flour": {
        "vitamins": {},
        "minerals": {
            "iron": true
        }
    },
    "breadcrumbs": {
        "vitamins": {},
        "minerals": {
            "iron": true
        }
    },
    "lemon": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {
            "potassium": true
        }
    },
    "cloves": {
        "vitamins": {
            "vitaminK1": true
        },
        "minerals": {}
    },
    "juniper berries": {
        "vitamins": {
            "vitaminC": true
        },
        "minerals": {}
    }
};
/**


Load common ingredients and recipes into the meal planner


Call this function to populate the app with sample data
*/
function preloadCommonData() {
    try {
        // Merge with existing ingredients data (existing takes precedence to avoid overwriting, case insensitive)
        const existingIngredients = JSON.parse(localStorage.getItem('ingredientsData') || '{}');
        const lowerExistingIngredients = {};
        for (const key in existingIngredients) {
            lowerExistingIngredients[key.toLowerCase()] = existingIngredients[key];
        }
        const mergedIngredients = { ...SAMPLE_INGREDIENTS, ...lowerExistingIngredients };
        // Save merged ingredients data
        localStorage.setItem('ingredientsData', JSON.stringify(mergedIngredients));
        const addedIngredients = Object.keys(SAMPLE_INGREDIENTS).filter(key => !lowerExistingIngredients.hasOwnProperty(key)).length;
        console.log('✅ Added', addedIngredients, 'new common ingredients');
        // Get existing recipes
        const existingRecipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        const existingRecipeNames = new Set(existingRecipes.map(r => r.name.toLowerCase()));
        // Add only new recipes with unique names (case insensitive)
        const newRecipes = SAMPLE_RECIPES
            .filter(recipe => !existingRecipeNames.has(recipe.name.toLowerCase()))
            .map(recipe => ({
                ...recipe,
                id: Date.now() + Math.random() // Ensure unique IDs
            }));
        const mergedRecipes = [...existingRecipes, ...newRecipes];
        // Save merged recipes
        localStorage.setItem('recipes', JSON.stringify(mergedRecipes));
        console.log('✅ Added', newRecipes.length, 'new common recipes');
        console.log('🎉 Common data preload complete. Refresh the page to see the new data.');
    } catch (error) {
        console.error('Error preloading data:', error);
    }
}


/**


Clear all data and reload with only common data
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


Check if common data is already loaded
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
