// LLM Service Module
// Handles AI recipe generation for both LMStudio and OpenRouter providers

const LLMService = {
    /**
     * Generate a recipe using AI
     * @param {string} prompt - The recipe description prompt
     * @param {Object} inventory - Current inventory with ingredient quantities
     * @param {Object} config - Configuration object
     * @param {string} config.provider - 'lmStudio' or 'openRouter'
     * @param {string} config.lmStudioEndpoint - LMStudio server endpoint
     * @param {string} config.lmStudioModel - LMStudio model name
     * @param {string} config.openRouterApiKey - OpenRouter API key
     * @param {string} config.openRouterModel - OpenRouter model name
     * @returns {Promise<Object>} - {success: boolean, error?: string}
     */
    async generateRecipe(prompt, inventory, config) {
        try {
            const { provider, lmStudioEndpoint, lmStudioModel, openRouterApiKey, openRouterModel } = config;

            let endpoint, headers, model;

            if (provider === 'openRouter') {
                endpoint = 'https://openrouter.ai/api/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Meal Planner'
                };
                model = openRouterModel;
            } else {
                endpoint = `${lmStudioEndpoint}/v1/chat/completions`;
                headers = {
                    'Content-Type': 'application/json',
                };
                model = lmStudioModel;
            }

            // Format inventory for the prompt
            const availableIngredients = Object.entries(inventory)
                .filter(([_, qty]) => qty > 0)
                .map(([item, qty]) => `${item} (${qty})`)
                .join(', ');

            const inventoryText = availableIngredients ?
                `\n\nAvailable ingredients in your inventory: ${availableIngredients}. Try to use as many of these ingredients as possible to minimize shopping needs.` :
                '\n\nNo ingredients currently in inventory.';

            const basePrompt = `Generate a recipe based on: "${prompt}"${inventoryText}

IMPORTANT INSTRUCTIONS:
- All ingredient names must be in lowercase
- Use simple, unambiguous ingredient names that can be found in a grocery store
- Avoid compound ingredients - break them down to basic items
- Use standard grocery product names (e.g., "chicken breast" not "chicken", "olive oil" not "oil")
- Include specific quantities and units that make sense for shopping
- Focus on actual purchasable items for a shopping list
- Provide clear, step-by-step cooking method/instructions
- Prioritize using ingredients already in inventory when possible

Examples of good ingredient names:
- "chicken breast" (not "chicken")
- "olive oil" (not "oil")
- "brown rice" (not "rice")
- "canned tomatoes" (not "tomatoes")
- "garlic cloves" (not "garlic")

For the method, provide numbered steps that are easy to follow.`;

            const content = provider === 'openRouter'
                ? `${basePrompt}

Return ONLY valid JSON in this exact format:
{
  "name": "Recipe Name Here",
  "ingredients": [
    {"name": "ingredient name", "quantity": 2, "unit": "cups"},
    {"name": "another ingredient", "quantity": 1, "unit": "tbsp"}
  ],
  "method": [
    "Step 1 instruction",
    "Step 2 instruction"
  ]
}

No additional text or explanation.`
                : basePrompt;

            const requestBody = {
                model,
                messages: [
                    {
                        role: 'user',
                        content
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            };

            // Only add response_format for LMStudio
            if (provider !== 'openRouter') {
                requestBody.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "recipe_response",
                        strict: false,
                        schema: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "The name of the recipe"
                                },
                                ingredients: {
                                    type: "array",
                                    description: "List of ingredients with name, quantity, and unit",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: {
                                                type: "string",
                                                description: "Name of the ingredient"
                                            },
                                            quantity: {
                                                type: "number",
                                                description: "Quantity of the ingredient"
                                            },
                                            unit: {
                                                type: "string",
                                                description: "Unit of measurement (cups, tbsp, etc.)"
                                            }
                                        },
                                        required: ["name", "quantity", "unit"]
                                    }
                                },
                                method: {
                                    type: "array",
                                    description: "Step-by-step cooking instructions",
                                    items: {
                                        type: "string",
                                        description: "A single cooking instruction step"
                                    }
                                }
                            },
                            required: ["name", "ingredients"]
                        }
                    }
                };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const responseContent = data.choices[0].message.content.trim();

            // Try to parse the JSON response
            const recipeData = JSON.parse(responseContent);

            // Validate the structure (method is now optional)
            if (!recipeData.name || !Array.isArray(recipeData.ingredients)) {
                throw new Error('Invalid recipe format received from AI. Missing name or ingredients array.');
            }

            // Ensure method is an array if it exists
            if (recipeData.method && !Array.isArray(recipeData.method)) {
                recipeData.method = [];
            }

            return { success: true, recipeData };

        } catch (error) {
            console.error('AI generation error:', error);
            // Check if it's a CORS error
            if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
                return {
                    success: false,
                    error: 'CORS Error: Please run the meal planner through a local web server. Try: python -m http.server 8000'
                };
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * Generate a meal plan using AI
     * @param {Array} recipes - List of available recipes
     * @param {Object} currentCalendar - Current week's calendar to avoid repetition
     * @param {Object} inventory - Current inventory with ingredient quantities
     * @param {Object} config - Configuration object
     * @param {string} config.provider - 'lmStudio' or 'openRouter'
     * @param {string} config.lmStudioEndpoint - LMStudio server endpoint
     * @param {string} config.lmStudioModel - LMStudio model name
     * @param {string} config.openRouterApiKey - OpenRouter API key
     * @param {string} config.openRouterModel - OpenRouter model name
     * @returns {Promise<Object>} - {success: boolean, mealPlan?: Object, error?: string}
     */
    async generateMealPlan(recipes, currentCalendar, inventory, config) {
        try {
            const { provider, lmStudioEndpoint, lmStudioModel, openRouterApiKey, openRouterModel } = config;

            let endpoint, headers, model;

            if (provider === 'openRouter') {
                endpoint = 'https://openrouter.ai/api/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Meal Planner'
                };
                model = openRouterModel;
            } else {
                endpoint = `${lmStudioEndpoint}/v1/chat/completions`;
                headers = {
                    'Content-Type': 'application/json',
                };
                model = lmStudioModel;
            }

            // Get previous week's recipes to avoid repetition
            const previousRecipes = Object.values(currentCalendar).filter(id => id !== null).map(id => {
                const recipe = recipes.find(r => r.id == id);
                return recipe ? recipe.name : null;
            }).filter(name => name !== null);

            const recipesWithNutrition = recipes.map(r => {
                const nutrition = r.nutritional || {};
                return `- ${r.name} (Calories: ${nutrition.calories || 0}, Protein: ${nutrition.protein || 0}g, Carbs: ${nutrition.carbs || 0}g, Fat: ${nutrition.fat || 0}g)`;
            }).join('\n');

            // Format inventory for the prompt
            const availableIngredients = Object.entries(inventory)
                .filter(([_, qty]) => qty > 0)
                .map(([item, qty]) => `${item} (${qty})`)
                .join(', ');

            const inventoryText = availableIngredients ?
                `\n\nAvailable ingredients in your inventory: ${availableIngredients}. Prioritize recipes that use these ingredients to minimize shopping needs.` :
                '\n\nNo ingredients currently in inventory.';

            const previousWeekText = previousRecipes.length > 0 ? `\n\nPrevious week's meals (avoid repeating these): ${previousRecipes.join(', ')}` : '';

            const basePrompt = `Create a nutritionally balanced weekly meal plan using the following recipes:

${recipesWithNutrition}${inventoryText}

Assign one recipe to each day of the week: Monday through Sunday. Consider:
- Nutritional balance across the week (variety in protein sources, carbs, fats)
- Calorie distribution
- Meal variety and practicality
- Prioritize recipes that use ingredients already in inventory
- Avoid repeating recipes from the previous week${previousWeekText}

Aim for balanced nutrition:
- Mix of protein sources (meat, fish, vegetarian options if available)
- Include vegetables and complex carbs
- Balance calorie intake across days
- Consider meal prep practicality
- Maximize use of available inventory to reduce food waste and shopping

Return ONLY valid JSON in this exact format:
{
  "Monday": "Recipe Name",
  "Tuesday": "Recipe Name",
  "Wednesday": "Recipe Name",
  "Thursday": "Recipe Name",
  "Friday": "Recipe Name",
  "Saturday": "Recipe Name",
  "Sunday": "Recipe Name"
}

Use exact recipe names from the list provided.`;

            const requestBody = {
                model,
                messages: [
                    {
                        role: 'user',
                        content: basePrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            };

            // Only add response_format for LMStudio
            if (provider !== 'openRouter') {
                requestBody.response_format = {
                    type: "json_schema",
                    json_schema: {
                        name: "meal_plan_response",
                        strict: false,
                        schema: {
                            type: "object",
                            properties: {
                                Monday: { type: "string" },
                                Tuesday: { type: "string" },
                                Wednesday: { type: "string" },
                                Thursday: { type: "string" },
                                Friday: { type: "string" },
                                Saturday: { type: "string" },
                                Sunday: { type: "string" }
                            },
                            required: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                        }
                    }
                };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const responseContent = data.choices[0].message.content.trim();

            // Try to parse the JSON response
            const mealPlan = JSON.parse(responseContent);

            // Validate the structure
            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            for (const day of days) {
                if (!mealPlan[day]) {
                    throw new Error(`Invalid meal plan format. Missing ${day}.`);
                }
            }

            return { success: true, mealPlan };

        } catch (error) {
            console.error('AI meal plan generation error:', error);
            // Check if it's a CORS error
            if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
                return {
                    success: false,
                    error: 'CORS Error: Please run the meal planner through a local web server. Try: python -m http.server 8000'
                };
            }
            return { success: false, error: error.message };
        }
    }
};
