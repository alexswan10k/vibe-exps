const { useState, useEffect } = React;

// Main App Component
function App() {
    const [recipes, setRecipes] = useState([]);
    const [inventory, setInventory] = useState({});
    const [ingredientsData, setIngredientsData] = useState({});
    const [shoppingList, setShoppingList] = useState({});
    const [selectedShoppingItems, setSelectedShoppingItems] = useState([]);
    const [showCookModal, setShowCookModal] = useState(false);
    const [showDataModal, setShowDataModal] = useState(false);
    const [cookingRecipe, setCookingRecipe] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [activeTab, setActiveTab] = useState('calendar');
    const [calendar, setCalendar] = useState({
        Monday: null,
        Tuesday: null,
        Wednesday: null,
        Thursday: null,
        Friday: null,
        Saturday: null,
        Sunday: null
    });
    const [lmStudioEndpoint, setLmStudioEndpoint] = useState('http://localhost:1234');
    const [lmStudioModel, setLmStudioModel] = useState('qwen/qwen3-4b-thinking-2507');
    const [aiMode, setAiMode] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pastedResult, setPastedResult] = useState('');
    const [showRecipeSelectModal, setShowRecipeSelectModal] = useState(false);
    const [selectingDay, setSelectingDay] = useState(null);

    // Helper function to get current recipe by ID
    const getRecipeById = (id) => {
        return recipes.find(recipe => recipe.id == id);
    };

    useEffect(() => {
        const storedRecipes = localStorage.getItem('recipes');
        if (storedRecipes) {
            setRecipes(JSON.parse(storedRecipes));
        }
        const storedCalendar = localStorage.getItem('calendar');
        if (storedCalendar) {
            setCalendar(JSON.parse(storedCalendar));
        }
        const storedInventory = localStorage.getItem('inventory');
        if (storedInventory) {
            setInventory(JSON.parse(storedInventory));
        }
        const storedIngredientsData = localStorage.getItem('ingredientsData');
        if (storedIngredientsData) {
            setIngredientsData(JSON.parse(storedIngredientsData));
        }
        const storedShoppingList = localStorage.getItem('shoppingList');
        if (storedShoppingList) {
            setShoppingList(JSON.parse(storedShoppingList));
        }
        const storedEndpoint = localStorage.getItem('lmStudioEndpoint');
        if (storedEndpoint) {
            setLmStudioEndpoint(storedEndpoint);
        }
        const storedModel = localStorage.getItem('lmStudioModel');
        if (storedModel) {
            setLmStudioModel(storedModel);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('recipes', JSON.stringify(recipes));
    }, [recipes]);

    useEffect(() => {
        localStorage.setItem('calendar', JSON.stringify(calendar));
    }, [calendar]);

    useEffect(() => {
        localStorage.setItem('inventory', JSON.stringify(inventory));
    }, [inventory]);

    useEffect(() => {
        localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
    }, [shoppingList]);

    useEffect(() => {
        localStorage.setItem('lmStudioEndpoint', lmStudioEndpoint);
    }, [lmStudioEndpoint]);

    useEffect(() => {
        localStorage.setItem('lmStudioModel', lmStudioModel);
    }, [lmStudioModel]);

    useEffect(() => {
        localStorage.setItem('ingredientsData', JSON.stringify(ingredientsData));
    }, [ingredientsData]);

    // Auto-generate shopping list when inventory or calendar changes
    useEffect(() => {
        const needed = {};
        Object.values(calendar).forEach(recipeId => {
            if (recipeId) {
                const recipe = getRecipeById(recipeId);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const current = inventory[ing.name] || 0;
                        const required = needed[ing.name] || 0;
                        needed[ing.name] = required + ing.quantity;
                    });
                }
            }
        });

        const shopping = {};
        Object.entries(needed).forEach(([item, neededQty]) => {
            const available = inventory[item] || 0;
            if (neededQty > available) {
                // Get price from ingredients data, default to 0 if not found
                const ingredientData = ingredientsData[item];
                const defaultPrice = ingredientData && ingredientData.price ? ingredientData.price : 0;

                shopping[item] = {
                    quantity: neededQty - available,
                    unitCost: defaultPrice
                };
            }
        });
        setShoppingList(shopping);
    }, [inventory, calendar, recipes]);

    const addRecipe = (recipeData) => {
        const ingredients = (recipeData.ingredients || []).map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit
        }));
        const newRecipe = {
            id: Date.now(),
            name: recipeData.name,
            ingredients,
            method: recipeData.method || [],
            nutritional: recipeData.nutritional || { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: { vitaminA: false, vitaminC: false, vitaminD: false, vitaminE: false, vitaminK1: false, vitaminK2: false, vitaminB12: false, folate: false }, minerals: { calcium: false, iron: false, magnesium: false, potassium: false, zinc: false } }
        };
        setRecipes([...recipes, newRecipe]);
    };

    const updateRecipe = (id, recipeData) => {
        setRecipes(recipes.map(recipe =>
            recipe.id === id ? { ...recipe, ...recipeData } : recipe
        ));
    };

    const deleteRecipe = (id) => {
        setRecipes(recipes.filter(recipe => recipe.id !== id));
    };

    const updateInventory = (item, quantity) => {
        const newInv = { ...inventory };
        if (quantity <= 0) {
            delete newInv[item];
        } else {
            newInv[item] = quantity;
        }
        setInventory(newInv);
    };

    const updateIngredientsData = (newData) => {
        setIngredientsData(newData);
    };

    const loadSampleData = () => {
        // Load sample ingredients from preload-data.js
        const existingIngredients = { ...ingredientsData };
        const mergedIngredients = { ...existingIngredients, ...SAMPLE_INGREDIENTS };
        setIngredientsData(mergedIngredients);
        localStorage.setItem('ingredientsData', JSON.stringify(mergedIngredients));

        // Load sample recipes from preload-data.js
        const newRecipes = SAMPLE_RECIPES.map(recipe => ({
            ...recipe,
            id: Date.now() + Math.random()
        }));

        const mergedRecipes = [...recipes, ...newRecipes];
        setRecipes(mergedRecipes);
        localStorage.setItem('recipes', JSON.stringify(mergedRecipes));
    };

    const resetToSampleData = () => {
        // Reset ingredients from preload-data.js
        setIngredientsData(SAMPLE_INGREDIENTS);
        localStorage.setItem('ingredientsData', JSON.stringify(SAMPLE_INGREDIENTS));

        // Reset recipes from preload-data.js
        const resetRecipes = SAMPLE_RECIPES.map(recipe => ({
            ...recipe,
            id: Date.now() + Math.random()
        }));

        setRecipes(resetRecipes);
        localStorage.setItem('recipes', JSON.stringify(resetRecipes));

        // Clear other data
        setInventory({});
        localStorage.removeItem('inventory');

        setCalendar({
            Monday: null, Tuesday: null, Wednesday: null, Thursday: null,
            Friday: null, Saturday: null, Sunday: null
        });
        localStorage.removeItem('calendar');

        setShoppingList({});
        localStorage.removeItem('shoppingList');
    };

    const toggleSelectShoppingItem = (item) => {
        setSelectedShoppingItems(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };

    const updateShoppingItemCost = (item, unitCost) => {
        const newList = { ...shoppingList };
        if (newList[item]) {
            newList[item] = {
                ...newList[item],
                unitCost: unitCost
            };
            setShoppingList(newList);
        }
    };

    const transferSelectedToInventory = () => {
        const newInventory = { ...inventory };
        selectedShoppingItems.forEach(item => {
            if (shoppingList[item] && shoppingList[item].quantity) {
                newInventory[item] = (newInventory[item] || 0) + shoppingList[item].quantity;
            }
        });
        setInventory(newInventory);
        const newList = { ...shoppingList };
        selectedShoppingItems.forEach(item => delete newList[item]);
        setShoppingList(newList);
        setSelectedShoppingItems([]);
    };

    const handleCook = (recipe) => {
        setCookingRecipe(recipe);
        setShowCookModal(true);
    };

    const confirmCook = () => {
        if (cookingRecipe && cookingRecipe.ingredients) {
            const newInventory = { ...inventory };
            cookingRecipe.ingredients.forEach(ing => {
                const current = newInventory[ing.name] || 0;
                newInventory[ing.name] = Math.max(0, current - ing.quantity);
            });
            setInventory(newInventory);
            alert(`Successfully cooked ${cookingRecipe.name}! Ingredients have been consumed from your inventory.`);
        }
        setShowCookModal(false);
        setCookingRecipe(null);
    };

    const cancelCook = () => {
        setShowCookModal(false);
        setCookingRecipe(null);
    };

    const handleDrop = (e, day) => {
        e.preventDefault();
        const recipeId = e.dataTransfer.getData('text/plain');
        if (recipeId) {
            setCalendar({ ...calendar, [day]: recipeId });
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleSelectRecipe = (day) => {
        setSelectingDay(day);
        setShowRecipeSelectModal(true);
    };

    const selectRecipeForDay = (recipeId) => {
        if (selectingDay) {
            setCalendar({ ...calendar, [selectingDay]: recipeId });
            setShowRecipeSelectModal(false);
            setSelectingDay(null);
        }
    };

    const clearRecipeForDay = () => {
        if (selectingDay) {
            setCalendar({ ...calendar, [selectingDay]: null });
            setShowRecipeSelectModal(false);
            setSelectingDay(null);
        }
    };

    const generateRecipeWithAI = async (prompt) => {
        try {
            const response = await fetch(`${lmStudioEndpoint}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: lmStudioModel,
                    messages: [
                        {
                            role: 'user',
                            content: `Generate a recipe based on: "${prompt}"

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

For the method, provide numbered steps that are easy to follow.`
                        }
                    ],
                    response_format: {
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
                    },
                    temperature: 0.7,
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content.trim();

            // Try to parse the JSON response
            const recipeData = JSON.parse(content);

            // Validate the structure (method is now optional)
            if (!recipeData.name || !Array.isArray(recipeData.ingredients)) {
                throw new Error('Invalid recipe format received from AI. Missing name or ingredients array.');
            }

            // Ensure method is an array if it exists
            if (recipeData.method && !Array.isArray(recipeData.method)) {
                recipeData.method = [];
            }

            // Add the recipe
            addRecipe(recipeData);
            return { success: true };

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
    };

    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'app' },
            React.createElement('div', { className: 'header' },
                React.createElement('h1', null, 'Meal Planner'),
                React.createElement('button', {
                    className: 'hamburger-btn',
                    onClick: () => setShowDataModal(true),
                    title: 'Data Management'
                }, '☰')
            ),
            React.createElement('div', { className: 'tabs' },
                React.createElement('button', {
                    className: (activeTab === 'calendar' || activeTab === 'recipes') ? 'tab active' : 'tab',
                    onClick: () => setActiveTab('calendar')
                }, 'Meal Planner'),
                React.createElement('button', {
                    className: activeTab === 'inventory' ? 'tab active' : 'tab',
                    onClick: () => setActiveTab('inventory')
                }, 'Inventory'),
                React.createElement('button', {
                    className: activeTab === 'shopping' ? 'tab active' : 'tab',
                    onClick: () => setActiveTab('shopping')
                }, 'Shopping List'),
                React.createElement('button', {
                    className: activeTab === 'nutrition' ? 'tab active' : 'tab',
                    onClick: () => setActiveTab('nutrition')
                }, 'Nutrition')
            ),
            (activeTab === 'calendar' || activeTab === 'recipes') && React.createElement('div', { className: 'main-content' },
                React.createElement(Calendar, { calendar, handleDrop, handleDragOver, getRecipeById, handleCook, onSelectRecipe: handleSelectRecipe, inventory }),
                React.createElement(RecipeList, {
                    recipes,
                    inventory,
                    addRecipe,
                    updateRecipe,
                    deleteRecipe,
                    onEditRecipe: (recipe) => {
                        setEditingRecipe(recipe);
                        setShowEditModal(true);
                    },
                    lmStudioEndpoint,
                    lmStudioModel,
                    aiMode,
                    setLmStudioEndpoint,
                    setLmStudioModel,
                    setAiMode,
                    generateRecipeWithAI,
                    setShowPasteModal
                })
            ),
            activeTab === 'inventory' && React.createElement(Inventory, {
                inventory,
                updateInventory,
                recipes,
                calendar,
                ingredientsData,
                updateIngredientsData
            }),
            activeTab === 'shopping' && React.createElement(ShoppingList, {
                shoppingList,
                selectedShoppingItems,
                toggleSelectShoppingItem,
                transferSelectedToInventory,
                updateShoppingItemCost
            }),
            activeTab === 'nutrition' && React.createElement(Nutrition, { recipes, calendar, getRecipeById, ingredientsData })
        ),
        ReactDOM.createPortal(
            React.createElement(ModalManager, {
                showCookModal,
                cookingRecipe,
                showEditModal,
                editingRecipe,
                showPasteModal,
                pastedResult,
                showRecipeSelectModal,
                selectingDay,
                showDataModal,
                inventory,
                recipes,
                ingredientsData,
                calendar,
                shoppingList,
                confirmCook,
                cancelCook,
                updateRecipe,
                addRecipe,
                selectRecipeForDay,
                clearRecipeForDay,
                loadSampleData,
                resetToSampleData,
                setShowCookModal,
                setShowEditModal,
                setShowPasteModal,
                setPastedResult,
                setShowRecipeSelectModal,
                setShowDataModal,
                setRecipes,
                setInventory,
                setIngredientsData,
                setCalendar,
                setShoppingList
            }),
            document.body
        )
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('root'));
