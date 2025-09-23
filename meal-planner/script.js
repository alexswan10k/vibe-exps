/**
 * @typedef {Object} RecipeNutritional
 * @property {number} calories - Calories per serving/portion (kcal)
 * @property {number} carbs - Carbohydrates per serving (g)
 * @property {number} fat - Fat per serving (g)
 * @property {number} protein - Protein per serving (g)
 * @property {number} fiber - Fiber per serving (g)
 * @property {Object} vitamins - Vitamin presence indicators
 * @property {boolean} vitamins.vitaminA
 * @property {boolean} vitamins.vitaminC
 * @property {boolean} vitamins.vitaminD
 * @property {boolean} vitamins.vitaminE
 * @property {boolean} vitamins.vitaminK1
 * @property {boolean} vitamins.vitaminK2
 * @property {boolean} vitamins.vitaminB12
 * @property {boolean} vitamins.folate
 * @property {Object} minerals - Mineral presence indicators
 * @property {boolean} minerals.calcium
 * @property {boolean} minerals.iron
 * @property {boolean} minerals.magnesium
 * @property {boolean} minerals.potassium
 * @property {boolean} minerals.zinc
 */

/**
 * @typedef {Object} Ingredient
 * @property {string} name
 * @property {number} quantity
 * @property {string} unit
 */

/**
 * @typedef {Object} Recipe
 * @property {number} id
 * @property {string} name
 * @property {Ingredient[]} ingredients
 * @property {string[]} method
 * @property {RecipeNutritional} nutritional
 */

/**
 * @typedef {Object} Calendar
 * @property {number|null} Monday
 * @property {number|null} Tuesday
 * @property {number|null} Wednesday
 * @property {number|null} Thursday
 * @property {number|null} Friday
 * @property {number|null} Saturday
 * @property {number|null} Sunday
 */

const { useState, useEffect } = React;

function IngredientDropdown({ value, suggestions, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);

    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (inputValue.trim()) {
            const filtered = suggestions.filter(item =>
                item.toLowerCase().includes(inputValue.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setIsOpen(filtered.length > 0);
        } else {
            setIsOpen(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(false);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return React.createElement('div', { className: 'dropdown-container' },
        React.createElement('input', {
            type: 'text',
            value: value,
            onChange: handleInputChange,
            onKeyDown: handleKeyDown,
            onFocus: () => {
                if (value.trim() && filteredSuggestions.length > 0) {
                    setIsOpen(true);
                }
            },
            onBlur: () => {
                // Delay closing to allow click on suggestions
                setTimeout(() => setIsOpen(false), 150);
            },
            placeholder: placeholder,
            className: 'dropdown-input'
        }),
        isOpen && React.createElement('ul', { className: 'dropdown-list' },
            filteredSuggestions.slice(0, 5).map((suggestion, index) =>
                React.createElement('li', {
                    key: index,
                    onClick: () => handleSuggestionClick(suggestion),
                    className: 'dropdown-item'
                }, suggestion)
            )
        )
    );
}

function RecipeList({ recipes, inventory, addRecipe, updateRecipe, deleteRecipe, onEditRecipe, lmStudioEndpoint, lmStudioModel, aiMode, setLmStudioEndpoint, setLmStudioModel, setAiMode, generateRecipeWithAI }) {
    const [newRecipe, setNewRecipe] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pastedResult, setPastedResult] = useState('');
    const [showRecipeSelectModal, setShowRecipeSelectModal] = useState(false);
    const [selectingDay, setSelectingDay] = useState(null);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (newRecipe.trim()) {
            addRecipe({ name: newRecipe, ingredients: [] });
            setNewRecipe('');
        }
    };

    const copyPromptToClipboard = async () => {
        const prompt = `Generate a recipe based on: "${aiPrompt || 'your recipe description here'}"\n\nIMPORTANT INSTRUCTIONS:\n- All ingredient names must be in lowercase\n- Use simple, unambiguous ingredient names that can be found in a grocery store\n- Avoid compound ingredients - break them down to basic items\n- Use standard grocery product names (e.g., "chicken breast" not "chicken", "olive oil" not "oil")\n- Include specific quantities and units that make sense for shopping\n- Focus on actual purchasable items for a shopping list\n- Provide clear, step-by-step cooking method/instructions\n\nExamples of good ingredient names:\n- "chicken breast" (not "chicken")\n- "olive oil" (not "oil")\n- "brown rice" (not "rice")\n- "canned tomatoes" (not "tomatoes")\n- "garlic cloves" (not "garlic")\n\nFor the method, provide numbered steps that are easy to follow.\n\nReturn ONLY valid JSON in this exact format:\n{\n  "name": "Recipe Name Here",\n  "ingredients": [\n    {"name": "ingredient name", "quantity": 2, "unit": "cups"},\n    {"name": "another ingredient", "quantity": 1, "unit": "tbsp"}\n  ],\n  "method": [\n    "Step 1 instruction",\n    "Step 2 instruction"\n  ]\n}\n\nNo additional text or explanation.`;

        try {
            await navigator.clipboard.writeText(prompt);
            alert('Prompt copied to clipboard! Paste it into your preferred LLM (ChatGPT, Claude, etc.)');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = prompt;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Prompt copied to clipboard! Paste it into your preferred LLM (ChatGPT, Claude, etc.)');
        }
    };

    const handlePasteResult = () => {
        if (pastedResult.trim()) {
            try {
                const recipeData = JSON.parse(pastedResult.trim());

                // Validate the structure (method is now optional)
                if (!recipeData.name || !Array.isArray(recipeData.ingredients)) {
                    throw new Error('Invalid recipe format. Please ensure the JSON has name and ingredients array.');
                }

                // Ensure method is an array if it exists
                if (recipeData.method && !Array.isArray(recipeData.method)) {
                    recipeData.method = [];
                }

                // Add the recipe
                addRecipe(recipeData);
                setPastedResult('');
                setShowPasteModal(false);
                alert('Recipe imported successfully!');
            } catch (error) {
                alert(`Failed to parse recipe: ${error.message}`);
            }
        }
    };

    const handleAISubmit = async (e) => {
        e.preventDefault();
        if (aiPrompt.trim() && !isGenerating) {
            setIsGenerating(true);
            try {
                const result = await generateRecipeWithAI(aiPrompt.trim());
                if (result.success) {
                    setAiPrompt('');
                } else {
                    alert(`Failed to generate recipe: ${result.error}`);
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                setIsGenerating(false);
            }
        }
    };

    return React.createElement('div', { className: 'recipe-list' },
        React.createElement('h2', null, 'Recipes'),
        React.createElement('div', { className: 'ai-settings-toggle' },
            React.createElement('div', { className: 'mode-toggle' },
                React.createElement('button', {
                    className: !aiMode ? 'mode-btn active' : 'mode-btn',
                    onClick: () => setAiMode(false)
                }, 'Manual'),
                React.createElement('button', {
                    className: aiMode ? 'mode-btn active' : 'mode-btn',
                    onClick: () => setAiMode(true)
                }, 'AI Generate')
            ),
            aiMode && React.createElement('button', {
                onClick: () => setShowSettings(!showSettings),
                className: 'settings-toggle-btn'
            }, showSettings ? 'Hide Settings' : 'Show AI Settings')
        ),
        showSettings && React.createElement('div', { className: 'ai-settings' },
            React.createElement('div', { className: 'setting-row' },
                React.createElement('label', null, 'LMStudio Endpoint:'),
                React.createElement('input', {
                    type: 'text',
                    value: lmStudioEndpoint,
                    onChange: (e) => setLmStudioEndpoint(e.target.value),
                    placeholder: 'http://localhost:1234'
                })
            ),
            React.createElement('div', { className: 'setting-row' },
                React.createElement('label', null, 'Model:'),
                React.createElement('input', {
                    type: 'text',
                    value: lmStudioModel,
                    onChange: (e) => setLmStudioModel(e.target.value),
                    placeholder: 'google/gemma-3-4b'
                })
            )
        ),
        !aiMode ? React.createElement('form', { onSubmit: handleManualSubmit },
            React.createElement('input', {
                type: 'text',
                value: newRecipe,
                onChange: (e) => setNewRecipe(e.target.value),
                placeholder: 'Add new recipe'
            }),
            React.createElement('button', { type: 'submit' }, 'Add')
        ) : React.createElement('div', { className: 'ai-form-container' },
            React.createElement('form', { onSubmit: handleAISubmit },
                React.createElement('input', {
                    type: 'text',
                    value: aiPrompt,
                    onChange: (e) => setAiPrompt(e.target.value),
                    placeholder: 'Describe the recipe you want (e.g., "Italian pasta with tomatoes")',
                    disabled: isGenerating
                }),
                React.createElement('div', { className: 'ai-buttons' },
                    React.createElement('button', {
                        type: 'button',
                        onClick: copyPromptToClipboard,
                        className: 'copy-prompt-btn'
                    }, '📋 Copy Prompt'),
                    React.createElement('button', {
                        type: 'button',
                        onClick: () => setShowPasteModal(true),
                        className: 'paste-result-btn'
                    }, '📥 Paste Result'),
                    React.createElement('button', {
                        type: 'submit',
                        disabled: isGenerating || !aiPrompt.trim()
                    }, isGenerating ? 'Generating...' : 'Generate Recipe')
                )
            ),
            showPasteModal && React.createElement('div', { className: 'modal-overlay' },
                React.createElement('div', { className: 'modal paste-modal' },
                    React.createElement('h2', null, 'Paste LLM Result'),
                    React.createElement('p', null, 'Paste the JSON response from your preferred LLM (ChatGPT, Claude, etc.)'),
                    React.createElement('textarea', {
                        value: pastedResult,
                        onChange: (e) => setPastedResult(e.target.value),
                        placeholder: 'Paste the JSON response here...',
                        rows: 15,
                        className: 'paste-textarea'
                    }),
                    React.createElement('div', { className: 'modal-buttons' },
                        React.createElement('button', { onClick: handlePasteResult }, 'Import Recipe'),
                        React.createElement('button', { onClick: () => { setShowPasteModal(false); setPastedResult(''); } }, 'Cancel')
                    )
                )
            )
        ),
        React.createElement('ul', null,
            recipes.map(recipe =>
                React.createElement(RecipeItem, {
                    key: recipe.id,
                    recipe,
                    onEdit: onEditRecipe,
                    onDelete: deleteRecipe
                })
            )
        )
    );
}

function RecipeItem({ recipe, onEdit, onDelete }) {
    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', recipe.id);
    };

    const handleClick = (e) => {
        // Prevent drag when clicking buttons
        if (e.target.tagName === 'BUTTON') {
            e.stopPropagation();
        }
    };

    return React.createElement('li', {
        draggable: true,
        onDragStart: handleDragStart,
        onClick: handleClick,
        className: 'recipe-item'
    },
        React.createElement('span', { className: 'recipe-name' }, recipe.name),
        React.createElement('div', { className: 'recipe-actions' },
            React.createElement('button', {
                onClick: (e) => {
                    e.stopPropagation();
                    onEdit(recipe);
                },
                className: 'edit-btn'
            }, 'Edit'),
            React.createElement('button', {
                onClick: (e) => {
                    e.stopPropagation();
                    onDelete(recipe.id);
                },
                className: 'delete-btn'
            }, 'Delete')
        )
    );
}

function Calendar({ calendar, handleDrop, handleDragOver, getRecipeById, handleCook, onSelectRecipe, inventory }) {
    const days = Object.keys(calendar);

    return React.createElement('div', { className: 'calendar' },
        React.createElement('h2', null, 'Weekly Calendar'),
        React.createElement('div', { className: 'calendar-grid' },
            days.map(day =>
                React.createElement(DaySlot, {
                    key: day,
                    day,
                    recipeId: calendar[day],
                    getRecipeById,
                    handleDrop,
                    handleDragOver,
                    handleCook,
                    onSelectRecipe,
                    inventory
                })
            )
        )
    );
}

function DaySlot({ day, recipeId, getRecipeById, handleDrop, handleDragOver, handleCook, onSelectRecipe, inventory }) {
    const recipe = recipeId ? getRecipeById(recipeId) : null;
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isCurrentDay = day === currentDay;

    // Check if recipe can be cooked (all ingredients available)
    const canCook = recipe && recipe.ingredients.every(ing => {
        const available = inventory[ing.name] || 0;
        return available >= ing.quantity;
    });

    return React.createElement('div', {
        className: `day-slot ${isCurrentDay ? 'current-day' : ''}`,
        onDrop: (e) => handleDrop(e, day),
        onDragOver: handleDragOver
    },
        React.createElement('h3', null, day),
        recipe ? React.createElement('p', null, recipe.name) : React.createElement('p', null, 'Drop recipe here'),
        React.createElement('button', {
            onClick: () => onSelectRecipe(day),
            className: 'select-recipe-btn',
            style: { marginTop: '10px', width: '100%', marginBottom: '5px' }
        }, recipe ? 'Change Recipe' : 'Select Recipe'),
        recipe && React.createElement('button', {
            onClick: () => handleCook(recipe),
            className: canCook ? 'cook-btn' : 'cook-btn insufficient',
            style: { marginTop: '5px', width: '100%' }
        }, 'Cook')
    );
}

function Inventory({ inventory, updateInventory, recipes, calendar }) {
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState(1);

    const getAllIngredients = () => {
        const ingredients = new Set();
        recipes.forEach(recipe => {
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ing => ingredients.add(ing.name));
            }
        });
        return Array.from(ingredients);
    };

    const getRecipesUsingIngredient = (ingredient) => {
        const allUsing = recipes.filter(recipe => recipe.ingredients && recipe.ingredients.some(ing => ing.name === ingredient));
        const allocatedRecipeIds = new Set(Object.values(calendar).filter(id => id));
        const allocated = allUsing.filter(recipe => allocatedRecipeIds.has(recipe.id));
        const other = allUsing.filter(recipe => !allocatedRecipeIds.has(recipe.id));
        return { allocated, other };
    };

    const allIngredients = getAllIngredients();
    const neededIngredients = new Set();
    Object.values(calendar).forEach(recipeId => {
        if (recipeId) {
            const recipe = recipes.find(r => r.id == recipeId);
            if (recipe && recipe.ingredients) {
                recipe.ingredients.forEach(ing => neededIngredients.add(ing.name));
            }
        }
    });
    const inventoryItemsWithStock = Object.keys(inventory).filter(item => (inventory[item] || 0) > 0);
    const missingNeededItems = Array.from(neededIngredients).filter(item => (inventory[item] || 0) === 0);
    const allItems = [...new Set([...inventoryItemsWithStock, ...missingNeededItems])].sort();

    const handleAddItem = (e) => {
        e.preventDefault();
        if (newItem.trim()) {
            updateInventory(newItem, newQuantity);
            setNewItem('');
            setNewQuantity(1);
        }
    };

    const handleUpdateQuantity = (item, quantity) => {
        updateInventory(item, parseFloat(quantity) || 0);
    };

    const handleIncrement = (item, currentQuantity) => {
        updateInventory(item, currentQuantity + 1);
    };

    const handleDecrement = (item, currentQuantity) => {
        updateInventory(item, Math.max(0, currentQuantity - 1));
    };

    const handleRemoveItem = (item) => {
        updateInventory(item, 0);
    };

    return React.createElement('div', { className: 'inventory' },
        React.createElement('h2', null, 'Inventory'),
        React.createElement('form', { onSubmit: handleAddItem },
            React.createElement('input', {
                type: 'text',
                value: newItem,
                onChange: (e) => setNewItem(e.target.value),
                placeholder: 'Item name'
            }),
            React.createElement('input', {
                type: 'number',
                value: newQuantity,
                onChange: (e) => setNewQuantity(parseFloat(e.target.value) || 0),
                placeholder: 'Quantity'
            }),
            React.createElement('button', { type: 'submit' }, 'Add Item')
        ),
        React.createElement('ul', null,
            allItems.map(item => {
                const quantity = inventory[item] || 0;
                const { allocated, other } = getRecipesUsingIngredient(item);
                const isMissing = quantity === 0;
                let recipeText = '';
                if (allocated.length > 0) {
                    recipeText += `This week: ${allocated.map(r => r.name).join(', ')}`;
                }
                if (other.length > 0) {
                    if (recipeText) recipeText += ' | ';
                    recipeText += `Other recipes: ${other.map(r => r.name).join(', ')}`;
                }
                if (!recipeText) {
                    recipeText = 'Not used in any recipes';
                }
                return React.createElement('li', { key: item, className: `inventory-item ${isMissing ? 'missing-ingredient' : ''}` },
                    React.createElement('span', null, item),
                    React.createElement('div', { className: 'recipe-usage' }, recipeText),
                    React.createElement('div', { className: 'inventory-controls' },
                        React.createElement('div', { className: 'quantity-controls' },
                            React.createElement('button', {
                                onClick: () => handleDecrement(item, quantity),
                                className: 'quantity-btn'
                            }, '-'),
                            React.createElement('input', {
                                type: 'number',
                                value: quantity,
                                onChange: (e) => handleUpdateQuantity(item, e.target.value),
                                min: '0',
                                className: 'quantity-input'
                            }),
                            React.createElement('button', {
                                onClick: () => handleIncrement(item, quantity),
                                className: 'quantity-btn'
                            }, '+')
                        ),
                        React.createElement('button', {
                            onClick: () => handleRemoveItem(item)
                        }, 'Remove')
                    )
                );
            })
        )
    );
}

/**
 * @param {Object} props
 * @param {Recipe} props.recipe
 * @param {Object} props.inventory
 * @param {Recipe[]} props.recipes
 * @param {Function} props.onSave
 * @param {Function} props.onCancel
 */
function EditRecipeForm({ recipe, inventory, recipes, onSave, onCancel }) {
    const defaultNutritional = {
        calories: 0,
        carbs: 0,
        fat: 0,
        protein: 0,
        fiber: 0,
        vitamins: {
            vitaminA: false,
            vitaminC: false,
            vitaminD: false,
            vitaminE: false,
            vitaminK1: false,
            vitaminK2: false,
            vitaminB12: false,
            folate: false
        },
        minerals: {
            calcium: false,
            iron: false,
            magnesium: false,
            potassium: false,
            zinc: false
        }
    };

    const [recipeForm, setRecipeForm] = useState({
        name: recipe.name,
        ingredients: (recipe.ingredients || []).map(ing => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit
        })),
        method: recipe.method || [],
        nutritional: recipe.nutritional || { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: { vitaminA: false, vitaminC: false, vitaminD: false, vitaminE: false, vitaminK1: false, vitaminK2: false, vitaminB12: false, folate: false }, minerals: { calcium: false, iron: false, magnesium: false, potassium: false, zinc: false } }
    });

    // Get all known ingredients from recipes and inventory
    const getAllIngredients = () => {
        const recipeIngredients = new Set();
        recipes.forEach(r => {
            if (r.ingredients) {
                r.ingredients.forEach(ing => {
                    if (ing.name) recipeIngredients.add(ing.name);
                });
            }
        });
        return Array.from(recipeIngredients).concat(Object.keys(inventory)).filter((item, index, arr) => arr.indexOf(item) === index);
    };

    const handleSave = () => {
        onSave(recipeForm);
    };

    const addIngredient = () => {
        setRecipeForm({
            ...recipeForm,
            ingredients: [...recipeForm.ingredients, { name: '', quantity: 1, unit: '' }]
        });
    };

    const updateIngredient = (index, field, value) => {
        const updatedIngredients = [...recipeForm.ingredients];
        updatedIngredients[index][field] = value;
        setRecipeForm({ ...recipeForm, ingredients: updatedIngredients });
    };

    const removeIngredient = (index) => {
        setRecipeForm({
            ...recipeForm,
            ingredients: recipeForm.ingredients.filter((_, i) => i !== index)
        });
    };

    const addMethodStep = () => {
        setRecipeForm({
            ...recipeForm,
            method: [...recipeForm.method, '']
        });
    };

    const updateMethodStep = (index, value) => {
        const updatedMethod = [...recipeForm.method];
        updatedMethod[index] = value;
        setRecipeForm({ ...recipeForm, method: updatedMethod });
    };

    const removeMethodStep = (index) => {
        setRecipeForm({
            ...recipeForm,
            method: recipeForm.method.filter((_, i) => i !== index)
        });
    };

    return React.createElement('div', { className: 'edit-recipe-form' },
        React.createElement('input', {
            type: 'text',
            value: recipeForm.name,
            onChange: (e) => setRecipeForm({ ...recipeForm, name: e.target.value }),
            placeholder: 'Recipe name',
            className: 'recipe-name-input'
        }),
        React.createElement('h4', null, 'Ingredients'),
        React.createElement('div', { className: 'ingredients-list' },
            recipeForm.ingredients.map((ing, index) =>
                React.createElement('div', { key: index, className: 'ingredient-row' },
                    React.createElement('div', { className: 'ingredient-main' },
                        React.createElement(IngredientDropdown, {
                            value: ing.name,
                            suggestions: getAllIngredients(),
                            onChange: (value) => updateIngredient(index, 'name', value),
                            placeholder: 'Ingredient name'
                        }),
                        React.createElement('input', {
                            type: 'number',
                            value: ing.quantity,
                            onChange: (e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0),
                            placeholder: 'Quantity'
                        }),
                        React.createElement('input', {
                            type: 'text',
                            value: ing.unit,
                            onChange: (e) => updateIngredient(index, 'unit', e.target.value),
                            placeholder: 'Unit'
                        }),
                        React.createElement('button', {
                            onClick: () => removeIngredient(index),
                            className: 'remove-ingredient-btn'
                        }, 'Remove')
                    ),

                )
            )
        ),
        React.createElement('button', { onClick: addIngredient, className: 'add-ingredient-btn' }, 'Add Ingredient'),
        React.createElement('h4', null, 'Method'),
        React.createElement('div', { className: 'method-list' },
            recipeForm.method.map((step, index) =>
                React.createElement('div', { key: index, className: 'method-row' },
                    React.createElement('span', { className: 'step-number' }, `${index + 1}.`),
                    React.createElement('textarea', {
                        value: step,
                        onChange: (e) => updateMethodStep(index, e.target.value),
                        placeholder: 'Enter cooking instruction',
                        rows: 2
                    }),
                    React.createElement('button', {
                        onClick: () => removeMethodStep(index),
                        className: 'remove-method-btn'
                    }, 'Remove')
                )
            )
        ),
        React.createElement('button', { onClick: addMethodStep, className: 'add-method-btn' }, 'Add Step'),
        React.createElement('h4', null, 'Nutritional Info (per serving)'),
        React.createElement('div', { className: 'recipe-nutritional' },
            React.createElement('div', { className: 'nutritional-macros' },
                React.createElement('label', null, 'Calories:', React.createElement('input', { type: 'number', value: recipeForm.nutritional.calories, onChange: (e) => setRecipeForm({ ...recipeForm, nutritional: { ...recipeForm.nutritional, calories: parseFloat(e.target.value) || 0 } }), step: '0.1' })),
                React.createElement('label', null, 'Carbs (g):', React.createElement('input', { type: 'number', value: recipeForm.nutritional.carbs, onChange: (e) => setRecipeForm({ ...recipeForm, nutritional: { ...recipeForm.nutritional, carbs: parseFloat(e.target.value) || 0 } }), step: '0.1' })),
                React.createElement('label', null, 'Fat (g):', React.createElement('input', { type: 'number', value: recipeForm.nutritional.fat, onChange: (e) => setRecipeForm({ ...recipeForm, nutritional: { ...recipeForm.nutritional, fat: parseFloat(e.target.value) || 0 } }), step: '0.1' })),
                React.createElement('label', null, 'Protein (g):', React.createElement('input', { type: 'number', value: recipeForm.nutritional.protein, onChange: (e) => setRecipeForm({ ...recipeForm, nutritional: { ...recipeForm.nutritional, protein: parseFloat(e.target.value) || 0 } }), step: '0.1' })),
                React.createElement('label', null, 'Fiber (g):', React.createElement('input', { type: 'number', value: recipeForm.nutritional.fiber, onChange: (e) => setRecipeForm({ ...recipeForm, nutritional: { ...recipeForm.nutritional, fiber: parseFloat(e.target.value) || 0 } }), step: '0.1' }))
            )
        ),
        React.createElement('div', { className: 'modal-buttons' },
            React.createElement('button', { onClick: handleSave }, 'Save'),
            React.createElement('button', { onClick: onCancel }, 'Cancel')
        )
    );
}

function ShoppingList({ shoppingList, selectedShoppingItems, toggleSelectShoppingItem, transferSelectedToInventory }) {
    const handleRowClick = (item, e) => {
        // Prevent toggling if clicking directly on the checkbox
        if (e.target.type !== 'checkbox') {
            toggleSelectShoppingItem(item);
        }
    };

    return React.createElement('div', { className: 'shopping-list' },
        React.createElement('h2', null, 'Shopping List'),
        React.createElement('ul', null,
            Object.entries(shoppingList).map(([item, quantity]) =>
                React.createElement('li', {
                    key: item,
                    className: 'shopping-item',
                    onClick: (e) => handleRowClick(item, e)
                },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: selectedShoppingItems.includes(item),
                        onChange: () => toggleSelectShoppingItem(item),
                        className: 'shopping-checkbox'
                    }),
                    React.createElement('span', null, `${item}: ${quantity}`)
                )
            )
        ),
        Object.keys(shoppingList).length === 0 && React.createElement('p', null, 'No items needed. Your shopping list updates automatically based on your meal plan and inventory.'),
        selectedShoppingItems.length > 0 && React.createElement('button', {
            onClick: transferSelectedToInventory,
            style: { marginTop: '20px' }
        }, 'Transfer Selected to Inventory')
    );
}

function RecipeSelectModal({ showRecipeSelectModal, selectingDay, recipes, onSelectRecipe, onClearRecipe, onClose }) {
    if (!showRecipeSelectModal || !selectingDay) return null;

    return React.createElement('div', { className: 'modal-overlay' },
        React.createElement('div', { className: 'modal recipe-select-modal' },
            React.createElement('h2', null, `Select Recipe for ${selectingDay}`),
            React.createElement('div', { className: 'recipe-select-list' },
                recipes.map(recipe =>
                    React.createElement('button', {
                        key: recipe.id,
                        onClick: () => onSelectRecipe(recipe.id),
                        className: 'recipe-select-item'
                    }, recipe.name)
                ),
                recipes.length === 0 && React.createElement('p', null, 'No recipes available. Add some recipes first.')
            ),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onClearRecipe }, 'Clear Recipe'),
                React.createElement('button', { onClick: onClose }, 'Cancel')
            )
        )
    );
}

/**
 * @param {Object} props
 * @param {Recipe[]} props.recipes
 * @param {Calendar} props.calendar
 * @param {Function} props.getRecipeById
 */
function Nutrition({ recipes, calendar, getRecipeById }) {
    const calculateRecipeNutrition = (recipe) => {
        return recipe.nutritional || { calories: 0, carbs: 0, fat: 0, protein: 0, fiber: 0, vitamins: { vitaminA: false, vitaminC: false, vitaminD: false, vitaminE: false, vitaminK1: false, vitaminK2: false, vitaminB12: false, folate: false }, minerals: { calcium: false, iron: false, magnesium: false, potassium: false, zinc: false } };
    };

    const dayNutrition = Object.keys(calendar).map(day => {
        const recipeId = calendar[day];
        if (!recipeId) return { day, nutrition: null };
        const recipe = getRecipeById(recipeId);
        if (!recipe) return { day, nutrition: null };
        return { day, nutrition: calculateRecipeNutrition(recipe) };
    });

    const weeklyTotal = dayNutrition.reduce((total, day) => {
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

    // Create stacked bar chart data for macronutrients
    const chartData = {
        labels: dayNutrition.map(d => d.day.substring(0, 3)), // Short day names
        datasets: [
            {
                label: 'Carbs (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.carbs : 0),
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            },
            {
                label: 'Fat (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.fat : 0),
                backgroundColor: 'rgba(231, 76, 60, 0.8)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            },
            {
                label: 'Protein (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.protein : 0),
                backgroundColor: 'rgba(46, 204, 113, 0.8)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            },
            {
                label: 'Fiber (g)',
                data: dayNutrition.map(d => d.nutrition ? d.nutrition.fiber : 0),
                backgroundColor: 'rgba(155, 89, 182, 0.8)',
                borderColor: 'rgba(155, 89, 182, 1)',
                borderWidth: 1
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: true,
                title: {
                    display: true,
                    text: 'Day of Week'
                }
            },
            y: {
                stacked: true,
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Macronutrients (grams)'
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            title: {
                display: true,
                text: 'Weekly Macronutrient Breakdown'
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + context.parsed.y + 'g';
                    }
                }
            }
        }
    };

    // Use useEffect to create the charts after component mounts
    React.useEffect(() => {
        // Calories chart
        const caloriesCtx = document.getElementById('caloriesChart');
        if (caloriesCtx) {
            const caloriesData = {
                labels: dayNutrition.map(d => d.day.substring(0, 3)),
                datasets: [{
                    label: 'Calories',
                    data: dayNutrition.map(d => d.nutrition ? d.nutrition.calories : 0),
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 1
                }]
            };

            const caloriesOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Calories'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Weekly Calorie Intake'
                    }
                }
            };

            new Chart(caloriesCtx, {
                type: 'bar',
                data: caloriesData,
                options: caloriesOptions
            });
        }

        // Macronutrients stacked chart
        const macroCtx = document.getElementById('macroChart');
        if (macroCtx) {
            new Chart(macroCtx, {
                type: 'bar',
                data: chartData,
                options: chartOptions
            });
        }
    }, [recipes, calendar]);

    return React.createElement('div', { className: 'nutrition' },
        React.createElement('h2', null, 'Nutritional Overview'),
        React.createElement('div', { className: 'nutrition-charts-container' },
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'caloriesChart', width: '400', height: '200' })
            ),
            React.createElement('div', { className: 'nutrition-chart-container' },
                React.createElement('canvas', { id: 'macroChart', width: '400', height: '200' })
            )
        ),
        React.createElement('h3', null, 'Daily Breakdown'),
        React.createElement('div', { className: 'daily-nutrition' },
            dayNutrition.map(({ day, nutrition }) =>
                React.createElement('div', { key: day, className: 'day-nutrition' },
                    React.createElement('h4', null, day),
                    nutrition ? React.createElement('div', null,
                        React.createElement('p', null, `Calories: ${nutrition.calories.toFixed(0)}`),
                        React.createElement('p', null, `Carbs: ${nutrition.carbs.toFixed(1)}g, Fat: ${nutrition.fat.toFixed(1)}g, Protein: ${nutrition.protein.toFixed(1)}g, Fiber: ${nutrition.fiber.toFixed(1)}g`),
                        React.createElement('p', null, 'Vitamins: ' + Object.keys(nutrition.vitamins).filter(v => nutrition.vitamins[v]).join(', ')),
                        React.createElement('p', null, 'Minerals: ' + Object.keys(nutrition.minerals).filter(m => nutrition.minerals[m]).join(', '))
                    ) : React.createElement('p', null, 'No recipe planned')
                )
            )
        ),
        React.createElement('h3', null, 'Weekly Totals'),
        React.createElement('div', { className: 'weekly-nutrition' },
            React.createElement('p', null, `Total Calories: ${weeklyTotal.calories.toFixed(0)}`),
            React.createElement('p', null, `Total Carbs: ${weeklyTotal.carbs.toFixed(1)}g, Fat: ${weeklyTotal.fat.toFixed(1)}g, Protein: ${weeklyTotal.protein.toFixed(1)}g, Fiber: ${weeklyTotal.fiber.toFixed(1)}g`),
            React.createElement('p', null, 'Vitamins present: ' + Object.keys(weeklyTotal.vitamins).filter(v => weeklyTotal.vitamins[v]).join(', ')),
            React.createElement('p', null, 'Minerals present: ' + Object.keys(weeklyTotal.minerals).filter(m => weeklyTotal.minerals[m]).join(', '))
        )
    );
}

// Modal Manager Component - renders modals outside the main app hierarchy
function ModalManager({ showCookModal, cookingRecipe, showEditModal, editingRecipe, showPasteModal, pastedResult, showRecipeSelectModal, selectingDay, inventory, recipes, confirmCook, cancelCook, updateRecipe, addRecipe, selectRecipeForDay, clearRecipeForDay, setShowCookModal, setShowEditModal, setShowPasteModal, setPastedResult, setShowRecipeSelectModal }) {
    const handlePasteResult = () => {
        if (pastedResult.trim()) {
            try {
                const recipeData = JSON.parse(pastedResult.trim());

                // Validate the structure (method is now optional)
                if (!recipeData.name || !Array.isArray(recipeData.ingredients)) {
                    throw new Error('Invalid recipe format. Please ensure the JSON has name and ingredients array.');
                }

                // Ensure method is an array if it exists
                if (recipeData.method && !Array.isArray(recipeData.method)) {
                    recipeData.method = [];
                }

                // Add the recipe
                addRecipe(recipeData);
                setPastedResult('');
                setShowPasteModal(false);
                alert('Recipe imported successfully!');
            } catch (error) {
                alert(`Failed to parse recipe: ${error.message}`);
            }
        }
    };

    const handleOverlayClick = (e, closeFunction) => {
        // Only close if clicking directly on the overlay, not on modal content
        if (e.target === e.currentTarget) {
            closeFunction();
        }
    };

    return React.createElement(React.Fragment, null,
        showCookModal && cookingRecipe && React.createElement('div', {
            className: 'modal-overlay',
            onClick: (e) => handleOverlayClick(e, () => setShowCookModal(false))
        },
            React.createElement('div', { className: 'modal cook-modal' },
                React.createElement('h2', null, `Cook ${cookingRecipe.name}?`),
                React.createElement('p', null, 'This will consume the following ingredients from your inventory:'),
                React.createElement('ul', null,
                    cookingRecipe.ingredients.map((ing, index) => {
                        const available = inventory[ing.name] || 0;
                        const required = ing.quantity;
                        const isInsufficient = available < required;
                        const isMissing = available === 0;
                        return React.createElement('li', {
                            key: index,
                            className: isInsufficient ? 'insufficient-ingredient' : ''
                        },
                            React.createElement('span', null, `${ing.name}: ${required} ${ing.unit || ''}`),
                            React.createElement('span', { className: 'inventory-status' },
                                ` (Available: ${available}${isMissing ? ' - MISSING' : isInsufficient ? ' - INSUFFICIENT' : ''})`
                            )
                        );
                    })
                ),
                cookingRecipe.method && cookingRecipe.method.length > 0 && React.createElement('div', { className: 'cook-method' },
                    React.createElement('h3', null, 'Cooking Method:'),
                    React.createElement('ol', null,
                        cookingRecipe.method.map((step, index) =>
                            React.createElement('li', { key: index, className: 'method-step' }, step)
                        )
                    )
                ),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', { onClick: confirmCook }, 'Confirm'),
                    React.createElement('button', { onClick: cancelCook }, 'Cancel')
                )
            )
        ),
        showEditModal && editingRecipe && React.createElement('div', {
            className: 'modal-overlay',
            onClick: (e) => handleOverlayClick(e, () => setShowEditModal(false))
        },
            React.createElement('div', { className: 'modal edit-modal' },
                React.createElement('h2', null, 'Edit Recipe'),
                React.createElement(EditRecipeForm, {
                    recipe: editingRecipe,
                    inventory,
                    recipes,
                    onSave: (recipeData) => {
                        updateRecipe(editingRecipe.id, recipeData);
                        setShowEditModal(false);
                    },
                    onCancel: () => {
                        setShowEditModal(false);
                    }
                })
            )
        ),
        showPasteModal && React.createElement('div', {
            className: 'modal-overlay',
            onClick: (e) => handleOverlayClick(e, () => { setShowPasteModal(false); setPastedResult(''); })
        },
            React.createElement('div', { className: 'modal paste-modal' },
                React.createElement('h2', null, 'Paste LLM Result'),
                React.createElement('p', null, 'Paste the JSON response from your preferred LLM (ChatGPT, Claude, etc.)'),
                React.createElement('textarea', {
                    value: pastedResult,
                    onChange: (e) => setPastedResult(e.target.value),
                    placeholder: 'Paste the JSON response here...',
                    rows: 15,
                    className: 'paste-textarea'
                }),
                React.createElement('div', { className: 'modal-buttons' },
                    React.createElement('button', { onClick: handlePasteResult }, 'Import Recipe'),
                    React.createElement('button', { onClick: () => { setShowPasteModal(false); setPastedResult(''); } }, 'Cancel')
                )
            )
        ),
        React.createElement(RecipeSelectModal, {
            showRecipeSelectModal,
            selectingDay,
            recipes,
            onSelectRecipe: selectRecipeForDay,
            onClearRecipe: clearRecipeForDay,
            onClose: () => setShowRecipeSelectModal(false)
        })
    );
}

// Main App Component
function App() {
    const [recipes, setRecipes] = useState([]);
    const [inventory, setInventory] = useState({});
    const [shoppingList, setShoppingList] = useState({});
    const [selectedShoppingItems, setSelectedShoppingItems] = useState([]);
    const [showCookModal, setShowCookModal] = useState(false);
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
                shopping[item] = neededQty - available;
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

    const toggleSelectShoppingItem = (item) => {
        setSelectedShoppingItems(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };



    const transferSelectedToInventory = () => {
        const newInventory = { ...inventory };
        selectedShoppingItems.forEach(item => {
            newInventory[item] = (newInventory[item] || 0) + shoppingList[item];
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
            React.createElement('h1', null, 'Meal Planner'),
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
                calendar
            }),
            activeTab === 'shopping' && React.createElement(ShoppingList, {
                shoppingList,
                selectedShoppingItems,
                toggleSelectShoppingItem,
                transferSelectedToInventory
            }),
            activeTab === 'nutrition' && React.createElement(Nutrition, { recipes, calendar, getRecipeById })
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
                inventory,
                recipes,
                confirmCook,
                cancelCook,
                updateRecipe,
                addRecipe,
                selectRecipeForDay,
                clearRecipeForDay,
                setShowCookModal,
                setShowEditModal,
                setShowPasteModal,
                setPastedResult,
                setShowRecipeSelectModal
            }),
            document.body
        )
    );
}

ReactDOM.render(React.createElement(App), document.getElementById('root'));
