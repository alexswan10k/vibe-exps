// LLM Service Module
// Handles AI recipe generation for both LMStudio and OpenRouter providers

const LLMService = {
    /**
     * Generate a recipe using AI
     * @param {string} prompt - The recipe description prompt
     * @param {Object} config - Configuration object
     * @param {string} config.provider - 'lmStudio' or 'openRouter'
     * @param {string} config.lmStudioEndpoint - LMStudio server endpoint
     * @param {string} config.lmStudioModel - LMStudio model name
     * @param {string} config.openRouterApiKey - OpenRouter API key
     * @param {string} config.openRouterModel - OpenRouter model name
     * @returns {Promise<Object>} - {success: boolean, error?: string}
     */
    async generateRecipe(prompt, config) {
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

            const basePrompt = `Generate a recipe based on: "${prompt}"

IMPORTANT INSTRUCTIONS:
- All ingredient names must be in lowercase
- Use simple, unambiguous ingredient names that can be found in a grocery store
- Avoid compound ingredients - break them down to basic items
- Use standard grocery product names (e.g., "chicken breast" not "chicken", "olive oil" not "oil")
- Include specific quantities and units that make sense for shopping
- Focus on actual purchasable items for a shopping list
- Provide clear, step-by-step cooking method/instructions

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
    }
};
