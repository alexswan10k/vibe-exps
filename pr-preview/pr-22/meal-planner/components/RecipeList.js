function RecipeList({ recipes, inventory, addRecipe, updateRecipe, deleteRecipe, onEditRecipe, lmStudioEndpoint, lmStudioModel, aiMode, setLmStudioEndpoint, setLmStudioModel, setAiMode, generateRecipeWithAI, onLoadSampleData }) {
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
        recipes.length === 0 && React.createElement('div', { className: 'empty-recipes' },
            React.createElement('button', {
                className: 'seed-btn',
                onClick: () => {
                    onLoadSampleData();
                    alert('Sample data loaded! The new recipes and ingredients are now available.');
                }
            }, '🌱 Seed')
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
        ),
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
            React.createElement('div', { className: 'settings-hint' }, 'Configure AI settings in the ☰ menu')
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
        )
    );
}
