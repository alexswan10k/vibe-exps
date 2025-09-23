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
