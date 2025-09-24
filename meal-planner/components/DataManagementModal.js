function DataManagementModal({
    show,
    recipes,
    inventory,
    ingredientsData,
    calendar,
    shoppingList,
    onLoadSampleData,
    onResetToSampleData,
    onExportData,
    onImportData,
    onClearAllData,
    onClose,
    llmProvider,
    setLlmProvider,
    lmStudioEndpoint,
    setLmStudioEndpoint,
    lmStudioModel,
    setLmStudioModel,
    openRouterApiKey,
    setOpenRouterApiKey,
    openRouterModel,
    setOpenRouterModel
}) {
    const [availableModels, setAvailableModels] = React.useState([]);
    const [modelsLoading, setModelsLoading] = React.useState(false);
    const [modelsError, setModelsError] = React.useState(null);

    // Fetch available models when LMStudio endpoint changes
    React.useEffect(() => {
        if (llmProvider === 'lmStudio' && lmStudioEndpoint.trim()) {
            fetchAvailableModels();
        }
    }, [llmProvider, lmStudioEndpoint]);

    const fetchAvailableModels = async () => {
        setModelsLoading(true);
        setModelsError(null);
        try {
            const result = await LLMService.getAvailableModels(lmStudioEndpoint);
            if (result.success) {
                setAvailableModels(result.models);
            } else {
                setModelsError(result.error);
                setAvailableModels([]);
            }
        } catch (error) {
            setModelsError(error.message);
            setAvailableModels([]);
        } finally {
            setModelsLoading(false);
        }
    };

    if (!show) return null;

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: onClose
    },
        React.createElement('div', {
            className: 'modal data-modal',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('h2', null, 'Data Management'),
            React.createElement('div', { className: 'data-status' },
                React.createElement('h3', null, 'Current Data Status'),
                React.createElement('p', null, `Recipes: ${recipes.length}`),
                React.createElement('p', null, `Inventory items: ${Object.keys(inventory).length}`),
                React.createElement('p', null, `Calendar entries: ${Object.values(calendar).filter(v => v).length}`)
            ),
            React.createElement('div', { className: 'data-actions' },
                React.createElement('div', { className: 'data-section' },
                    React.createElement('h3', null, 'Get Started'),
                    React.createElement('div', { className: 'action-buttons' },
                        React.createElement('button', {
                            className: 'data-btn load-common',
                            onClick: () => {
                                onLoadSampleData();
                                alert('Sample data loaded! The new recipes and ingredients are now available.');
                                onClose();
                            }
                        },
                            React.createElement('div', null,
                                React.createElement('strong', null, 'Add Sample Data'),
                                React.createElement('div', { className: 'btn-description' }, 'Add built-in recipes and ingredients to your existing data')
                            )
                        ),
                        React.createElement('button', {
                            className: 'data-btn reset-sample',
                            onClick: () => {
                                if (confirm('This will clear all your current data and load only sample data. Continue?')) {
                                    onResetToSampleData();
                                    alert('Reset to sample data complete! The app has been reset with fresh sample data.');
                                    onClose();
                                }
                            }
                        },
                            React.createElement('div', null,
                                React.createElement('strong', null, 'Reset to Sample Data'),
                                React.createElement('div', { className: 'btn-description' }, 'Clear everything and start fresh with sample data')
                            )
                        )
                    )
                ),
                React.createElement('div', { className: 'data-section' },
                    React.createElement('h3', null, 'Backup & Restore'),
                    React.createElement('div', { className: 'action-buttons' },
                        React.createElement('button', {
                            className: 'data-btn export',
                            onClick: () => {
                                const data = {
                                    recipes,
                                    inventory,
                                    ingredientsData,
                                    calendar,
                                    shoppingList,
                                    exportDate: new Date().toISOString()
                                };
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'meal-planner-data.json';
                                a.click();
                                URL.revokeObjectURL(url);
                            }
                        },
                            React.createElement('div', null,
                                React.createElement('strong', null, 'Export Data'),
                                React.createElement('div', { className: 'btn-description' }, 'Download all your data as a backup file')
                            )
                        ),
                        React.createElement('label', { className: 'data-btn import' },
                            React.createElement('div', null,
                                React.createElement('strong', null, 'Import Data'),
                                React.createElement('div', { className: 'btn-description' }, 'Restore from a previously exported backup')
                            ),
                            React.createElement('input', {
                                type: 'file',
                                accept: '.json',
                                style: { display: 'none' },
                                onChange: (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            try {
                                                const data = JSON.parse(event.target.result);
                                                onImportData(data);
                                                alert('Data imported successfully!');
                                                onClose();
                                            } catch (error) {
                                                alert(`Failed to import data: ${error.message}`);
                                            }
                                        };
                                        reader.readAsText(file);
                                    }
                                }
                            })
                        )
                    )
                ),
                React.createElement('div', { className: 'data-section' },
                    React.createElement('h3', null, 'LLM Configuration'),
                    React.createElement('div', { className: 'llm-config' },
                        React.createElement('div', { className: 'setting-row' },
                            React.createElement('label', null, 'Provider:'),
                            React.createElement('select', {
                                value: llmProvider,
                                onChange: (e) => setLlmProvider(e.target.value)
                            },
                                React.createElement('option', { value: 'lmStudio' }, 'LMStudio'),
                                React.createElement('option', { value: 'openRouter' }, 'OpenRouter')
                            )
                        ),
                        llmProvider === 'lmStudio' && React.createElement(React.Fragment, null,
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'LMStudio Endpoint:'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: lmStudioEndpoint,
                                    onChange: (e) => setLmStudioEndpoint(e.target.value),
                                    placeholder: 'http://localhost:1234'
                                })
                            ),
                            React.createElement('div', { className: 'preset-buttons' },
                                React.createElement('h4', null, 'Available Models:'),
                                modelsLoading ? React.createElement('div', { className: 'model-loading' }, 'Loading models...') :
                                modelsError ? React.createElement('div', { className: 'model-error' },
                                    React.createElement('div', null, `⚠️ Could not load models: ${modelsError}`),
                                    React.createElement('button', {
                                        className: 'refresh-btn-small',
                                        onClick: fetchAvailableModels,
                                        title: 'Try again'
                                    }, '🔄 Retry')
                                ) :
                                availableModels.length > 0 ? React.createElement('div', { className: 'preset-grid' },
                                    ...availableModels.map(model => React.createElement('button', {
                                        key: model.id,
                                        className: `preset-btn ${lmStudioModel === model.id ? 'selected' : ''}`,
                                        onClick: () => setLmStudioModel(model.id)
                                    }, `${model.name}${model.size && model.size !== 'Unknown' ? ` (${model.size})` : ''}`)),
                                    React.createElement('button', {
                                        className: 'refresh-btn-small',
                                        onClick: fetchAvailableModels,
                                        title: 'Refresh models'
                                    }, '🔄')
                                ) : React.createElement('div', { className: 'model-fallback' },
                                    React.createElement('div', null, 'No models found. Enter manually:'),
                                    React.createElement('input', {
                                        type: 'text',
                                        value: lmStudioModel,
                                        onChange: (e) => setLmStudioModel(e.target.value),
                                        placeholder: 'Enter model name manually',
                                        style: { width: '100%', marginTop: '8px' }
                                    })
                                )
                            )
                        ),
                        llmProvider === 'openRouter' && React.createElement(React.Fragment, null,
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'API Key:'),
                                React.createElement('input', {
                                    type: 'password',
                                    value: openRouterApiKey,
                                    onChange: (e) => setOpenRouterApiKey(e.target.value),
                                    placeholder: 'sk-or-v1-...'
                                })
                            ),
                            React.createElement('div', { className: 'setting-row' },
                                React.createElement('label', null, 'Model:'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: openRouterModel,
                                    onChange: (e) => setOpenRouterModel(e.target.value),
                                    placeholder: 'Select a model below or enter manually'
                                })
                            ),
                            React.createElement('div', { className: 'preset-buttons' },
                                React.createElement('h4', null, 'Quick Setup - Popular Models:'),
                                React.createElement('div', { className: 'preset-grid' },
                                    React.createElement('button', {
                                        className: 'preset-btn',
                                        onClick: () => setOpenRouterModel('openai/gpt-4o')
                                    }, 'GPT-4o'),
                                    React.createElement('button', {
                                        className: 'preset-btn',
                                        onClick: () => setOpenRouterModel('anthropic/claude-3.5-sonnet')
                                    }, 'Claude 3.5 Sonnet'),
                                    React.createElement('button', {
                                        className: 'preset-btn',
                                        onClick: () => setOpenRouterModel('meta-llama/llama-3.1-70b-instruct')
                                    }, 'Llama 3.1 70B'),
                                    React.createElement('button', {
                                        className: 'preset-btn',
                                        onClick: () => setOpenRouterModel('google/gemini-pro-1.5')
                                    }, 'Gemini Pro 1.5')
                                )
                            )
                        )
                    )
                ),
                React.createElement('div', { className: 'data-section' },
                    React.createElement('h3', null, 'Danger Zone'),
                    React.createElement('button', {
                        className: 'data-btn cleanup',
                        onClick: () => {
                            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                                onClearAllData();
                                alert('All data cleared!');
                                onClose();
                            }
                        }
                    },
                        React.createElement('div', null,
                            React.createElement('strong', null, 'Clear All Data'),
                            React.createElement('div', { className: 'btn-description' }, 'Permanently delete everything - use with caution!')
                        )
                    )
                )
            ),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onClose }, 'Close')
            )
        )
    );
}
